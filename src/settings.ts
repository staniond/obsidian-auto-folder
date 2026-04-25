import {App, PluginSettingTab, Setting} from 'obsidian';
import AutoFolderPlugin from './main';

export interface AutoFoldHeadingSettings {
headingRegex: string;
}

export const DEFAULT_SETTINGS: AutoFoldHeadingSettings = {
headingRegex: '',
};

/**
 * Settings UI for the plugin.
 *
 * This page exposes one value: a regex used to select which headings should
 * be folded when a note opens.
 */
export class AutoFoldHeadingSettingTab extends PluginSettingTab {
plugin: AutoFolderPlugin;

constructor(app: App, plugin: AutoFolderPlugin) {
super(app, plugin);
this.plugin = plugin;
}

display(): void {
const {containerEl} = this;
containerEl.empty();

new Setting(containerEl)
.setName('Heading regex')
.setDesc('Fold headings whose text matches this JavaScript regex when a note opens. Leave blank to disable. Supports both ^pattern$ and /pattern/flags.')
.addText((text) => {
text
.setPlaceholder('^(Draft|Archive)$')
.setValue(this.plugin.settings.headingRegex)
.onChange(async (value) => {
this.plugin.settings.headingRegex = value;
await this.plugin.saveSettings();

const validationError = this.plugin.getRegexValidationError(value);
text.inputEl.setCustomValidity(validationError ?? '');
});
});
}
}
