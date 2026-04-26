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
export default class AutoFoldHeadingPlugin extends Plugin {
	settings!: AutoFoldHeadingSettings;
	compiledHeadingRegex: RegExp | null = null;
	private pendingInitialFoldPath: string | null = null;
	private hasShownInvalidRegexNotice = false;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.updateCompiledRegex();
		this.addSettingTab(new AutoFoldHeadingSettingTab(this.app, this));

		this.registerEvent(this.app.workspace.on('file-open', (file) => {
			void this.handleFileOpen(file);
		}));

		// Folding relies on metadata that may not be ready at the time the file-open event fires,
		// so we also listen for metadata changes and fold if the changed file matches
		// the most recently opened file.
		this.registerEvent(this.app.metadataCache.on('changed', (file) => {
			if (this.pendingInitialFoldPath === file.path) {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView && markdownView.file === file) {
					if (this.foldMatchingHeadings(markdownView, file)) {
						this.pendingInitialFoldPath = null;
					}
				}
			}
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

		if (this.foldMatchingHeadings(markdownView, file)) {
			this.pendingInitialFoldPath = null;
		} else {
			this.pendingInitialFoldPath = file.path;
		}
	}

	/**
	 * Core behavior:
	 * - read heading metadata for the file
	 * - filter headings by user regex
	 * - merge matching heading folds with already existing folds
	 * - apply fold state back into the active editor mode
	 *
	 * Returns true if folding was completely resolved (or ignored), or false if metadata isn't ready.
	 */
	private foldMatchingHeadings(view: MarkdownView, file: TFile): boolean {
		const headingRegex = this.compiledHeadingRegex;
		if (!headingRegex) {
			return true;
		}

		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) {
			return false; // Metadata not yet parsed for this file
		}

		const headings = cache.headings ?? [];
		if (headings.length === 0) {
			return true;
		}

		const mode = view.currentMode as FoldCapableMarkdownSubView;
		if (typeof mode.applyFoldInfo !== 'function' || typeof mode.getFoldInfo !== 'function') {
			console.error("obsidian-auto-fold: Folding API changed?");
			return true;
		}

		const existingFolds = mode.getFoldInfo()?.folds ?? [];
		const foldedLines = new Set(existingFolds.map((fold) => fold.from));

		const additionalFolds: FoldRange[] = headings
			.filter((heading) => headingRegex.test(heading.heading) && !foldedLines.has(heading.position.start.line))
			.map((heading) => ({
				from: heading.position.start.line,
				to: heading.position.start.line + 1,
			}));

		if (additionalFolds.length === 0) {
			return true;
		}

		mode.applyFoldInfo({
			folds: [...existingFolds, ...additionalFolds],
			lines: view.editor.lineCount(),
		});

		(view as FoldCapableMarkdownView).onMarkdownFold?.();
		return true;
	}

	/**
	 * Updates the cached compiled regular expression.
	 *
	 * Supported input styles:
	 * - plain pattern: `^todo$`
	 * - slash form with flags: `/^todo$/i`
	 */
	updateCompiledRegex(showNotice: boolean = true): string | null {
		const trimmedPattern = this.settings.headingRegex.trim();
		if (trimmedPattern.length === 0) {
			this.hasShownInvalidRegexNotice = false;
			this.compiledHeadingRegex = null;
			return null;
		}

		try {
			this.compiledHeadingRegex = AutoFoldHeadingPlugin.buildRegex(trimmedPattern);
			this.hasShownInvalidRegexNotice = false;
			return null;
		} catch (error) {
			const errorText = error instanceof Error ? error.message : 'Invalid regular expression.';
			if (showNotice && !this.hasShownInvalidRegexNotice) {
				new Notice(`Auto Folder: invalid heading regex (${errorText}).`);
				this.hasShownInvalidRegexNotice = true;
			}
			this.compiledHeadingRegex = null;
			return errorText;
		}
	}

	private static buildRegex(rawPattern: string): RegExp {
		// support slash notation with flags (pattern/flags) https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#advanced_searching_with_flags
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
