import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import { wm } from 'resource:///org/gnome/shell/ui/main.js';

import type { Ext } from './extension.js';

export class Keybindings {
    global;
    window_focus;

    private ext: Ext;

    constructor(ext: Ext) {
        this.ext = ext;
        this.global = {
            'tile-enter': () => ext.tiler.enter(ext),
        };

        this.window_focus = {
            'focus-left': () => ext.focus_left(),

            'focus-down': () => ext.focus_down(),

            'focus-up': () => ext.focus_up(),

            'focus-right': () => ext.focus_right(),

            'tile-orientation': () => {
                const win = ext.get_focused_window();
                if (win && ext.gnome_forest) {
                    ext.gnome_forest.toggle_orientation(win);
                    ext.register_fn(() => win.request_activate(true));
                }
            },

            'toggle-floating': () => ext.gnome_forest?.toggle_floating(),

            'toggle-tiling': () => ext.gnome_auto_tiling.toggle(),

            'toggle-stacking-global': () => ext.gnome_forest?.toggle_stacking(),

            'tile-move-left-global': () => ext.tiler.move_left(ext, ext.get_focused_window()?.entity),

            'tile-move-down-global': () => ext.tiler.move_down(ext, ext.get_focused_window()?.entity),

            'tile-move-up-global': () => ext.tiler.move_up(ext, ext.get_focused_window()?.entity),

            'tile-move-right-global': () => ext.tiler.move_right(ext, ext.get_focused_window()?.entity),
        };
    }

    enable(keybindings: Record<string, Meta.KeyHandlerFunc>) {
        for (const name in keybindings) {
            wm.addKeybinding(
                name,
                this.ext.settings.ext,
                Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL,
                keybindings[name]!,
            );
        }

        return this;
    }

    disable(keybindings: Record<string, Meta.KeyHandlerFunc>) {
        for (const name in keybindings) {
            wm.removeKeybinding(name);
        }

        return this;
    }
}
