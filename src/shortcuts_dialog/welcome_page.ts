import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

export const WelcomePage = GObject.registerClass(class WelcomePage extends Gtk.Box {
    declare setup_button;
    declare opt_out_button;
    declare logs;

    constructor() {
        super({
            orientation: Gtk.Orientation.VERTICAL,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            spacing: 4,
        });

        this.append(new Gtk.Label({
            label: '<span size="xx-large">Welcome to Shatter Shell</span>',
            use_markup: true,
            margin_bottom: 16,
        }));

        this.append(new Gtk.Label({
            label: `For full functionality of Shatter Shell, some of your system's default keybindings need updating.`,
            justify: Gtk.Justification.CENTER,
        }));
        this.append(new Gtk.Label({
            label: 'Click the button below to complete setup.',
            justify: Gtk.Justification.CENTER,
            margin_bottom: 16,
        }));

        this.logs = new Gtk.Label({
            justify: Gtk.Justification.LEFT,
            selectable: true,
            wrap: true,
        });
        this.logs.add_css_class('monospace');
        this.append(this.logs);

        this.setup_button = new Gtk.Button();
        this.setup_button.label = 'Setup keyboard shortcuts (recommended)';
        this.setup_button.add_css_class('suggested-action');
        this.setup_button.add_css_class('pill');
        this.setup_button.connect('clicked', () => this._setupKeybindings())
        this.append(this.setup_button);

        this.opt_out_button = new Gtk.Button();
        this.opt_out_button.label = 'Or opt out';
        this.opt_out_button.add_css_class('pill');
        this.opt_out_button.add_css_class('flat');
        this.append(this.opt_out_button);
    }

    _setupKeybindings() {
        console.log('Setting up keybindings...');

        const errors = [];

        const set = (settings: Gio.Settings, key: string, value: string[]) => {
            const success = settings.set_strv(key, value);
            if (!success) {
                errors.push(`Warning: Failed to set ${settings.schema_id} ${key} to ${value}.`);
            }
        }

        try {
            const wmKeys = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.keybindings' });
            // Maximize window: disable <Super>Up
            set(wmKeys, 'maximize', []);
            // Restore window: disable <Super>Down, retain <Alt>F5
            set(wmKeys, 'unmaximize', ['<Alt>F5']);
            // Toggle maximization state: changed from <Alt>F10
            set(wmKeys, 'toggle-maximized', ['<Super>m', '<Alt>F10']);
            // Close window: changed from <Alt>F4
            set(wmKeys, 'close', ['<Super>q', '<Alt>F4']);
        } catch (e) {
            errors.push(e);
            console.error(e);
        }

        try {
            const mutterKeys = new Gio.Settings({ schema_id: 'org.gnome.mutter.keybindings' });
            // Edge tiling (split screen): redundant with tiling wm
            set(mutterKeys, 'toggle-tiled-left', []);
            set(mutterKeys, 'toggle-tiled-right', []);
        } catch (e) {
            errors.push(e);
            console.error(e);
        }

        try {
            const mutterWaylandKeys = new Gio.Settings({ schema_id: 'org.gnome.mutter.wayland.keybindings' });
            // Restore the keyboard shortcuts: disable <Super>Escape
            set(mutterWaylandKeys, 'restore-shortcuts', []);
        } catch (e) {
            errors.push(e);
            console.error(e);
        }

        try {
            const mediaKeys = new Gio.Settings({ schema_id: 'org.gnome.settings-daemon.plugins.media-keys' });
            // Lock screen: changed from <Super>l
            set(mediaKeys, 'screensaver', ['<Super>Escape', '<Super>l']);
            // Toggle automatic screen orientation: disable <Super>o, retain XF86RotationLockToggle
            set(mediaKeys, 'rotate-video-lock-static', ['XF86RotationLockToggle']);
        } catch (e) {
            errors.push(e);
            console.error(e);
        }

        try {
            const shellKeys = new Gio.Settings({ schema_id: 'org.gnome.shell.keybindings' });
            // Toggle message tray: disable <Super>m, retain <Super>v
            set(shellKeys, 'toggle-message-tray', ['<Super>v']);
            // Toggle quick settings: disable <Super>s
            set(shellKeys, 'toggle-quick-settings', []);
        } catch (e) {
            errors.push(e);
            console.error(e);
        }

        if (errors.length) {
            let label = 'Failed to set some keybindings:\n';
            for (const error of errors) {
                label += error + '\n';
            }
            this.logs.label = label;
        }
    }
});
