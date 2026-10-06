import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

export const WelcomePage = GObject.registerClass({
    Signals: { quit: {} },
}, class WelcomePage extends Gtk.Box {
    declare logs;
    declare setup_button;
    declare skip_button;
    declare close_button;

    declare confirming_skip;

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
            wrap: true,
        });
        this.logs.add_css_class('monospace');
        this.append(this.logs);

        const buttons_box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            halign: Gtk.Align.CENTER,
            hexpand: false,
            spacing: 4,
        });
        this.append(buttons_box);

        this.setup_button = new Gtk.Button();
        this.setup_button.label = 'Setup keyboard shortcuts (recommended)';
        this.setup_button.add_css_class('suggested-action');
        this.setup_button.add_css_class('pill');
        this.setup_button.connect('clicked', () => this._setupKeybindings());
        buttons_box.append(this.setup_button);

        this.confirming_skip = false;
        this.skip_button = new Gtk.Button();
        this.skip_button.label = 'No thanks';
        this.skip_button.add_css_class('pill');
        this.skip_button.add_css_class('flat');
        this.skip_button.connect('clicked', () => this._skip());
        buttons_box.append(this.skip_button);

        this.close_button = new Gtk.Button();
        this.close_button.visible = false;
        this.close_button.label = 'Close';
        this.close_button.add_css_class('suggested-action');
        this.close_button.add_css_class('pill');
        this.close_button.connect('clicked', () => this.emit('quit'));
        buttons_box.append(this.close_button);
    }

    _setupKeybindings() {
        console.log('Setting up keybindings...');

        const errors = [];

        const set = (settings: Gio.Settings, key: string, value: string[]) => {
            const success = settings.set_strv(key, value);
            if (!success) {
                errors.push(`Warning: Failed to set ${settings.schema_id} ${key} to ${value}.`);
            }
        };

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
            let label = `<span size="x-large">Error</span>

Something went wrong. Please try again or make a bug report with the following logs:
`;
            for (const error of errors) {
                label += error as string + '\n';
            }
            this.logs.label = label;
            this.logs.add_css_class('monospace');
            this.logs.justify = Gtk.Justification.LEFT;
            this.logs.use_markup = true;
            this.logs.selectable = true;

            this.setup_button.visible = true;
            this.skip_button.visible = true;
            this.close_button.visible = false;
        } else {
            this.logs.label = `<span size="x-large">Success!</span>

View available keyboard shortcuts in the other tabs,
or click below to close this dialog.
`;
            this.logs.remove_css_class('monospace');
            this.logs.justify = Gtk.Justification.CENTER;
            this.logs.use_markup = true;
            this.logs.selectable = false;

            this.setup_button.visible = false;
            this.skip_button.visible = false;
            this.close_button.visible = true;

            const settings = new Gio.Settings({ schema_id: 'org.gnome.shell.extensions.shatter-shell' });
            settings.set_boolean('need-overrides-setup', false);
        }
    }

    _skip() {
        if (!this.confirming_skip) {
            this.skip_button.label = 'Some keybindings will conflict. Confirm skip?';
            this.confirming_skip = true;
            return;
        }

        const settings = new Gio.Settings({ schema_id: 'org.gnome.shell.extensions.shatter-shell' });
        settings.set_boolean('need-overrides-setup', false);
        this.emit('quit');
    }
});
