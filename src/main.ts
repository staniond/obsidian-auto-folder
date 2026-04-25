import {MarkdownSubView, MarkdownView, Notice, Plugin, TFile} from 'obsidian';
import {AutoFoldHeadingSettingTab, AutoFoldHeadingSettings, DEFAULT_SETTINGS} from './settings';

/**
 * Obsidian does not expose heading-fold controls in the public MarkdownSubView type,
 * but they are available at runtime.
 *
 * We keep the unofficial surface in small local interfaces so the rest of the plugin
 * remains strongly typed and easy to follow.
 */
interface FoldRange {
from: number;
to: number;
}

interface FoldState {
folds: FoldRange[];
lines: number;
}

interface FoldCapableMarkdownSubView extends MarkdownSubView {
getFoldInfo?: () => FoldState | null;
applyFoldInfo?: (foldInfo: FoldState) => void;
}

interface FoldCapableMarkdownView extends MarkdownView {
onMarkdownFold?: () => void;
}

/**
 * Main plugin class.
 *
 * Lifecycle summary:
 * 1. Load persisted settings.
 * 2. Register the settings tab.
 * 3. Listen for `file-open` workspace events.
 * 4. Whenever a note opens in a markdown editor, fold headings whose text matches
 *    the user's regex.
 */
export default class AutoFolderPlugin extends Plugin {
settings: AutoFoldHeadingSettings;
private hasShownInvalidRegexNotice = false;

async onload(): Promise<void> {
await this.loadSettings();
this.addSettingTab(new AutoFoldHeadingSettingTab(this.app, this));

this.registerEvent(this.app.workspace.on('file-open', (file) => {
void this.handleFileOpen(file);
}));

// Also handle the currently open note when Obsidian finishes restoring the UI.
this.app.workspace.onLayoutReady(() => {
const activeFile = this.app.workspace.getActiveFile();
if (activeFile) {
void this.handleFileOpen(activeFile);
}
});
}

async loadSettings(): Promise<void> {
this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<AutoFoldHeadingSettings>);
}

async saveSettings(): Promise<void> {
await this.saveData(this.settings);
}

/**
 * Used by the settings tab to provide immediate feedback when the user types a regex.
 */
getRegexValidationError(rawPattern: string): string | null {
const trimmedPattern = rawPattern.trim();
if (trimmedPattern.length === 0) {
return null;
}

try {
AutoFolderPlugin.buildRegex(trimmedPattern);
return null;
} catch (error) {
return error instanceof Error ? error.message : 'Invalid regular expression';
}
}

/**
 * Called whenever the active file changes.
 *
 * We only fold when the active view is a markdown source editor and it matches the
 * newly opened file.
 */
private async handleFileOpen(file: TFile | null): Promise<void> {
if (!file) {
return;
}

const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
if (!markdownView || markdownView.file !== file) {
return;
}

this.foldMatchingHeadings(markdownView, file);
}

/**
 * Core behavior:
 * - read heading metadata for the file
 * - filter headings by user regex
 * - merge matching heading folds with already existing folds
 * - apply fold state back into the active editor mode
 */
private foldMatchingHeadings(view: MarkdownView, file: TFile): void {
if (view.getMode() !== 'source') {
return;
}

const headingRegex = this.getCompiledHeadingRegex();
if (!headingRegex) {
return;
}

const headings = this.app.metadataCache.getFileCache(file)?.headings ?? [];
if (headings.length === 0) {
return;
}

const mode = view.currentMode as FoldCapableMarkdownSubView;
if (!mode.applyFoldInfo) {
return;
}

const existingFolds = mode.getFoldInfo?.()?.folds ?? [];
const foldedLines = new Set(existingFolds.map((fold) => fold.from));

const additionalFolds: FoldRange[] = headings
.filter((heading) => headingRegex.test(heading.heading) && !foldedLines.has(heading.position.start.line))
.map((heading) => ({
from: heading.position.start.line,
to: heading.position.start.line + 1,
}));

if (additionalFolds.length === 0) {
return;
}

mode.applyFoldInfo({
folds: [...existingFolds, ...additionalFolds],
lines: view.editor.lineCount(),
});

(view as FoldCapableMarkdownView).onMarkdownFold?.();
}

/**
 * Returns `null` when folding should be skipped (empty regex or invalid regex).
 *
 * Supported input styles:
 * - plain pattern: `^todo$`
 * - slash form with flags: `/^todo$/i`
 */
private getCompiledHeadingRegex(): RegExp | null {
const trimmedPattern = this.settings.headingRegex.trim();
if (trimmedPattern.length === 0) {
this.hasShownInvalidRegexNotice = false;
return null;
}

try {
const regex = AutoFolderPlugin.buildRegex(trimmedPattern);
this.hasShownInvalidRegexNotice = false;
return regex;
} catch (error) {
if (!this.hasShownInvalidRegexNotice) {
const errorText = error instanceof Error ? error.message : 'Invalid regular expression';
new Notice(`Auto Folder: invalid heading regex (${errorText}).`);
this.hasShownInvalidRegexNotice = true;
}
return null;
}
}

private static buildRegex(rawPattern: string): RegExp {
if (rawPattern.startsWith('/')) {
const lastSlashIndex = rawPattern.lastIndexOf('/');
if (lastSlashIndex > 0) {
const pattern = rawPattern.slice(1, lastSlashIndex);
const flags = rawPattern.slice(lastSlashIndex + 1);
return new RegExp(pattern, flags);
}
}

return new RegExp(rawPattern);
}
}
