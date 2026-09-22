import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import { LabelledShortcutLabel } from './shortcut_label.js';

export const AdjustmentModePage = GObject.registerClass(class AdjustmentModePage extends Gtk.Box {
    constructor() {
        super({
            orientation: Gtk.Orientation.VERTICAL,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
        });
        this.append(new Gtk.Label({
            label: 'Activate additional keyboard control over the currently-focused window.',
            wrap: true,
        }));
        this.append(new Gtk.Label({
            label: 'Adjustment mode changes slightly based on whether the window is tiled.',
            wrap: true,
        }));

        const box = new Gtk.Box({
            homogeneous: true,
            margin_top: 32,
            spacing: 32,
        });
        box.append(new _AdjustmentModeFloating());
        box.append(new _AdjustmentModeTiled());
        this.append(box);
    }
});

const _AdjustmentModeFloating = GObject.registerClass(class _AdjustmentModeFloating extends Gtk.Box {
    constructor() {
        super({
            orientation: Gtk.Orientation.VERTICAL,
            hexpand: true,
        });

        this.append(new Gtk.Label({
            label: '<span size="x-large">Floating windows</span>',
            use_markup: true,
        }));
        this.append(new Gtk.Label({
            label: 'An overlay will be displayed showing the\nfuture location and size of your window.',
            justify: Gtk.Justification.CENTER,
            margin_bottom: 24,
        }));

        const add_shortcut = (...args: unknown[]) => this.append(new LabelledShortcutLabel(...args));

        add_shortcut(
            'Super Enter',
            'Enter adjustment mode',
        );
        add_shortcut(
            '↑↓←→',
            'Move the overlay',
        );
        add_shortcut(
            'Shift ↑↓←→',
            'Resize the overlay',
        );
        add_shortcut(
            'Ctrl ↑↓←→',
            'Select another window',
        );
        add_shortcut(
            'Enter',
            'Apply changes',
        );
        add_shortcut(
            'Esc',
            'Cancel changes',
        );
    }
});

const _AdjustmentModeTiled = GObject.registerClass(class _AdjustmentModeTiled extends Gtk.Box {
    constructor() {
        super({
            orientation: Gtk.Orientation.VERTICAL,
            hexpand: true,
        });

        this.append(new Gtk.Label({
            label: '<span size="x-large">Tiled windows</span>',
            use_markup: true,
        }));
        this.append(new Gtk.Label({
            label: 'Resizing is performed immediately and\noverlays are only shown when swapping windows.',
            justify: Gtk.Justification.CENTER,
            margin_bottom: 24,
        }));

        const add_shortcut = (...args: unknown[]) => this.append(new LabelledShortcutLabel(...args));

        add_shortcut(
            'Super Enter',
            'Enter adjustment mode',
        );
        add_shortcut(
            '↑↓←→',
            'Move the window',
        );
        add_shortcut(
            'Ctrl ↑↓←→',
            'Swap tiled position',
        );
        add_shortcut(
            'Shift ↑↓←→',
            'Resize the window',
        );
        add_shortcut(
            'O',
            'Switch tile orientation',
        );
        add_shortcut(
            'S',
            'Toggle stack',
        );
        add_shortcut(
            'Enter',
            'Apply changes',
        );
        add_shortcut(
            'Esc',
            'Cancel changes',
        );
    }
});
