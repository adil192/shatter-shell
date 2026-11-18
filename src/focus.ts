import type { EdgeSide } from './core/movement.js';
import type { Ext } from './extension.js';
import type { MutterWindow } from './gnome/mutter_window.js';

import * as Geom from './core/geom.js';

export enum FocusPosition {
    TopLeft = 'Top Left',
    TopRight = 'Top Right',
    BottomLeft = 'Bottom Left',
    BottomRight = 'Bottom Right',
    Center = 'Center',
}

export class FocusSelector {
    select(
        ext: Ext,
        direction: (a: MutterWindow, b: Array<MutterWindow>) => Array<MutterWindow>,
        window: MutterWindow | null,
    ): MutterWindow | null {
        window = window ?? ext.get_focused_window();
        if (window) {
            const window_list = ext.active_window_list();
            return select(direction, window, window_list);
        }

        return null;
    }

    down(ext: Ext, window: MutterWindow | null): MutterWindow | null {
        return this.select(ext, window_down, window);
    }

    left(ext: Ext, window: MutterWindow | null): MutterWindow | null {
        return this.select(ext, window_left, window);
    }

    right(ext: Ext, window: MutterWindow | null): MutterWindow | null {
        return this.select(ext, window_right, window);
    }

    up(ext: Ext, window: MutterWindow | null): MutterWindow | null {
        return this.select(ext, window_up, window);
    }

    /**
     * The window on `side` of `window`.
     *
     * Temporary bridge until the focus code takes the direction as a value.
     */
    toward(ext: Ext, side: EdgeSide, window: MutterWindow | null): MutterWindow | null {
        switch (side) {
            case Geom.Side.TOP:
                return this.up(ext, window);
            case Geom.Side.BOTTOM:
                return this.down(ext, window);
            case Geom.Side.LEFT:
                return this.left(ext, window);
            case Geom.Side.RIGHT:
                return this.right(ext, window);
        }
    }
}

function select(
    windows: (a: MutterWindow, b: Array<MutterWindow>) => Array<MutterWindow>,
    focused: MutterWindow,
    window_list: Array<MutterWindow>,
): MutterWindow | null {
    const array = windows(focused, window_list);
    return array.length ? array[0]! : null;
}

function window_down(focused: MutterWindow, windows: Array<MutterWindow>) {
    return windows
        .filter(win => !win.meta.minimized && win.meta.get_frame_rect().y > focused.meta.get_frame_rect().y)
        .sort((a, b) => Geom.downward_distance(a.meta, focused.meta) - Geom.downward_distance(b.meta, focused.meta));
}

function window_left(focused: MutterWindow, windows: Array<MutterWindow>) {
    return windows
        .filter(win => !win.meta.minimized && win.meta.get_frame_rect().x < focused.meta.get_frame_rect().x)
        .sort((a, b) => Geom.leftward_distance(a.meta, focused.meta) - Geom.leftward_distance(b.meta, focused.meta));
}

function window_right(focused: MutterWindow, windows: Array<MutterWindow>) {
    return windows
        .filter(win => !win.meta.minimized && win.meta.get_frame_rect().x > focused.meta.get_frame_rect().x)
        .sort((a, b) => Geom.rightward_distance(a.meta, focused.meta) - Geom.rightward_distance(b.meta, focused.meta));
}

function window_up(focused: MutterWindow, windows: Array<MutterWindow>) {
    return windows
        .filter(win => !win.meta.minimized && win.meta.get_frame_rect().y < focused.meta.get_frame_rect().y)
        .sort((a, b) => Geom.upward_distance(a.meta, focused.meta) - Geom.upward_distance(b.meta, focused.meta));
}
