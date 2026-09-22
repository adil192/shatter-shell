import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

type Keybinding = string | string[];

/** A shortcut with a title and subtitle. */
export const LabelledShortcutLabel = GObject.registerClass(class LabelledShortcutLabel extends Gtk.Box {
    constructor(keys: Keybinding, title: string, subtitle?: string) {
        super({
            spacing: 16,
            margin_bottom: 16,
            hexpand: true,
        });

        const shortcut = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: false,
        });
        shortcut.set_size_request(184, 40);
        shortcut.append(new ShortcutLabel(keys));
        this.append(shortcut);

        const details = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            halign: Gtk.Align.START,
            hexpand: true,
        });
        this.append(details);

        details.append(new Gtk.Label({
            label: `<span size="larger">${title}</span>`,
            use_markup: true,
            halign: Gtk.Align.START,
            justify: Gtk.Justification.LEFT,
        }));
        if (subtitle != undefined) {
            details.append(new Gtk.Label({
                label: subtitle,
                halign: Gtk.Align.START,
                justify: Gtk.Justification.LEFT,
                wrap: true,
            }));
        }
    }
});

/**
 * A row of keycaps representing a keyboard shortcut.
 * Styling is inherited from {@link Adw.ShortcutLabel}
 */
export const ShortcutLabel = GObject.registerClass(class ShortcutLabel extends Gtk.Box {
    constructor(keys: Keybinding) {
        super({
            css_name: 'shortcut-label',
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });
        keys = _normalize_keys(keys);
        for (const key of keys) {
            const keycap = Gtk.Label.new(key);
            keycap.add_css_class('keycap');
            this.append(keycap);
        }
    }
});

const _normalize_keys = (keys: Keybinding) => {
    if (Array.isArray(keys)) {
        return keys;
    } else {
        return keys.split(' ');
    }
};
