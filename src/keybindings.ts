import type { Ext } from './extension.js';

import { wm } from 'resource:///org/gnome/shell/ui/main.js';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';

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
                const win = ext.focus_window();
                if (win && ext.auto_tiler) {
                    ext.auto_tiler.toggle_orientation(ext, win);
                    ext.register_fn(() => win.request_activate(true));
                }
            },

            'toggle-floating': () => ext.auto_tiler?.toggle_floating(ext),

            'toggle-tiling': () => ext.toggle_tiling(),

            'toggle-stacking-global': () => ext.auto_tiler?.toggle_stacking(ext),

            'tile-move-left-global': () => ext.tiler.move_left(ext, ext.focus_window()?.entity),

            'tile-move-down-global': () => ext.tiler.move_down(ext, ext.focus_window()?.entity),

            'tile-move-up-global': () => ext.tiler.move_up(ext, ext.focus_window()?.entity),

            'tile-move-right-global': () => ext.tiler.move_right(ext, ext.focus_window()?.entity),

            'shatter-shell-monitor-left': () => ext.move_monitor(Meta.DisplayDirection.LEFT),

            'shatter-shell-monitor-right': () => ext.move_monitor(Meta.DisplayDirection.RIGHT),

            'shatter-shell-monitor-up': () => ext.move_monitor(Meta.DisplayDirection.UP),

            'shatter-shell-monitor-down': () => ext.move_monitor(Meta.DisplayDirection.DOWN),

            'shatter-shell-workspace-up': () => ext.move_workspace(Meta.DisplayDirection.UP),

            'shatter-shell-workspace-down': () => ext.move_workspace(Meta.DisplayDirection.DOWN),
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

    disable(keybindings: object) {
        for (const name in keybindings) {
            wm.removeKeybinding(name);
        }

        return this;
    }
}
