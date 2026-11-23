import type { Misc } from '@girs/gnome-shell';
import type GObject from 'gi://GObject';

import Gio from 'gi://Gio';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import type { Signals } from '../core/signals.js';
import type { ExtensionSettings } from '../settings.js';

import { Style, style_of } from '../core/style.js';
import { Log } from '../log.js';
import { get_current_path } from '../paths.js';

function stylesheet_path(name: string) {
    return get_current_path() + '/' + name + '.css';
}

const STYLESHEET_PATHS = {
    light: stylesheet_path('light'),
    lightHc: stylesheet_path('light-hc'),
    dark: stylesheet_path('dark'),
    darkHc: stylesheet_path('dark-hc'),
} as const;

const STYLESHEETS = {
    light: Gio.File.new_for_path(STYLESHEET_PATHS.light),
    lightHc: Gio.File.new_for_path(STYLESHEET_PATHS.lightHc),
    dark: Gio.File.new_for_path(STYLESHEET_PATHS.dark),
    darkHc: Gio.File.new_for_path(STYLESHEET_PATHS.darkHc),
} as const;

/**
 * The GNOME side of the extension's look: it loads the stylesheet that goes with GNOME's color
 * scheme and high contrast setting into the shell's theme, and again when they change.
 */
export class GnomeTheme {
    /** The stylesheet that goes with GNOME's settings, as last read */
    style: Style = Style.dark;

    /**
     * @param defer Runs a function once the main loop is idle
     */
    constructor(
        private readonly settings: ExtensionSettings,
        private readonly defer: (func: () => void) => void,
    ) {}

    /** Connects to GNOME's color scheme and high contrast settings */
    attach(signals: Signals<GObject.Object | Misc.signals.EventEmitter>) {
        const defer_changed = () => this.defer(() => this.on_changed());

        signals.connect(this.settings.desktop_interface, settings =>
            settings.connect('changed::color-scheme', defer_changed),
        );
        signals.connect(this.settings.a11y_interface, settings =>
            settings.connect('changed::high-contrast', defer_changed),
        );
    }

    private on_changed() {
        this.pick_style();
        this.inject();
    }

    /** Chooses a stylesheet that goes with GNOME's settings. */
    pick_style() {
        this.style = style_of(this.settings.get_is_dark(), this.settings.get_is_high_contrast());
    }

    /** Supplements the global theme context with the extension's stylesheet. */
    inject() {
        try {
            const theme_context = St.ThemeContext.get_for_stage(global.stage);

            const existing_theme = theme_context.get_theme() as St.Theme | null;

            const shatter_stylesheet_path = STYLESHEET_PATHS[this.style];

            if (existing_theme) {
                /** Must unload stylesheets, or else the previously loaded
                 * stylesheets will persist when {@link Main.loadTheme} is called. */
                for (const other of Object.values(Style)) {
                    existing_theme.unload_stylesheet(STYLESHEETS[other]);
                }

                // Merge theme update with shatter shell styling
                existing_theme.load_stylesheet(STYLESHEETS[this.style]);

                // Perform theme update
                theme_context.set_theme(existing_theme);
            } else {
                // User does not have a theme loaded, so use shatter styling + default
                Main.setThemeStylesheet(shatter_stylesheet_path);
                Main.loadTheme();
            }
        } catch (e) {
            Log.error(`failed to load stylesheet: ${e}`);
        }
    }
}
