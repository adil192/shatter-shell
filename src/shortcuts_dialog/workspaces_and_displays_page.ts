import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import { LabelledShortcutLabel } from './shortcut_label.js';

export const WorkspacesAndDisplaysPage = GObject.registerClass(class WorkspacesAndDisplaysPage extends Gtk.Box {
    constructor() {
        super({
            orientation: Gtk.Orientation.VERTICAL,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
        });

        const add_shortcut = (...args: unknown[]) => this.append(new LabelledShortcutLabel(...args));

        add_shortcut(
            'Ctrl Alt ←→',
            'Navigate between workspaces',
            'Switch to the previous/next workspace',
        );
        add_shortcut(
            'Super Home/End',
            'First/last workspace',
            'Switch to first/last workspace',
        );
        add_shortcut(
            'Ctrl Shift Alt ←→',
            'Move window between workspaces',
            'Move active window to previous/next workspace',
        );
        add_shortcut(
            'Super Shift ↑↓←→',
            'Move window between displays',
            'Move active window to another monitor',
        );
        add_shortcut(
            'Super Esc',
            'Lock the screen',
            '(Or use Super L)',
        );
    }
});
