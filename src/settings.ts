import {App, PluginSettingTab, Setting, debounce} from 'obsidian';
import AutoFoldHeadingPlugin from './main';

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
    plugin: AutoFoldHeadingPlugin;

    constructor(app: App, plugin: AutoFoldHeadingPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        const saveSettings = debounce(async () => {
            await this.plugin.saveSettings();
        }, 500, true);

        new Setting(containerEl)
            .setName('Heading regex')
            .setDesc('Fold headings whose text matches this JavaScript regex when a note opens. Leave blank to disable. Supports plain patterns (for example \'^pattern$\') and slash notation with flags (\'/pattern/flags\').')
            .addText((text) => {
                text
                .setPlaceholder('Enter a heading regex')
                .setValue(this.plugin.settings.headingRegex)
                .onChange((value) => {
                    this.plugin.settings.headingRegex = value;

                    const validationError = this.plugin.updateCompiledRegex(false);
                    text.inputEl.setCustomValidity(validationError ?? '');
                    text.inputEl.reportValidity();

                    saveSettings();
                });
            });
    }
}
