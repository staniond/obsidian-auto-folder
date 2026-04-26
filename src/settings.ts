import {App, PluginSettingTab, Setting, debounce} from 'obsidian';
import AutoFoldHeadingPlugin from './main';

export interface AutoFoldHeadingSettings {
    headingRegex: string;
    delayMs: number;
}

export const DEFAULT_SETTINGS: AutoFoldHeadingSettings = {
    headingRegex: '',
    delayMs: 500,
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

        new Setting(containerEl)
            .setName('Fold delay (ms)')
            .setDesc('Delay in milliseconds before applying folds when opening a file. This gives Obsidian time to restore previously saved folds first.')
            .addText((text) => {
                text
                .setPlaceholder('500')
                .setValue(this.plugin.settings.delayMs.toString())
                .onChange((value) => {
                    const parsed = parseInt(value, 10);
                    if (isNaN(parsed) || parsed < 0) {
                        text.inputEl.setCustomValidity('Please enter a valid positive number.');
                    } else {
                        text.inputEl.setCustomValidity('');
                        this.plugin.settings.delayMs = parsed;
                        saveSettings();
                    }
                    text.inputEl.reportValidity();
                });
            });
    }
}
