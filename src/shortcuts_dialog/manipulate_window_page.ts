import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import { LabelledShortcutLabel } from './shortcut_label.js';

export const ManipulateWindowPage = GObject.registerClass(class ManipulateWindowPage extends Gtk.Box {
    constructor() {
        super({
            orientation: Gtk.Orientation.VERTICAL,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
        });

        const add_shortcut = (...args: unknown[]) => this.append(new LabelledShortcutLabel(...args));

        add_shortcut(
            'Super Y',
            'Toggle tiling',
            'Automatically arranges your windows',
        );
        add_shortcut(
            'Super G',
            'Toggle tiling for a window',
            'Exclude/include window in tiling layout',
        );
        add_shortcut(
            'Super S',
            'Toggle stacking',
            'Stack windows on top of each other',
        );
        add_shortcut(
            'Super O',
            'Change tiling orientation',
            'Split windows horizontally or vertically',
        );
        add_shortcut(
            'Super M',
            'Maximize window',
            'Toggle window maximization',
        );
        add_shortcut(
            'Super Q',
            'Close window',
            '(Or use Alt F4)',
        );
        add_shortcut(
            'Super ↑↓←→',
            'Switch focus',
            'Move focus between windows',
        );
        add_shortcut(
            ['Super', 'Left click drag'],
            'Move window',
            'Drag and drop windows from anywhere',
        );
        add_shortcut(
            ['Super', 'Right click drag'],
            'Resize window',
            'Drag to resize windows from anywhere',
        );
    }
});
