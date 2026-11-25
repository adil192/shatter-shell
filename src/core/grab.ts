import type { WindowHandle } from './window_handle.js';

import { nearest_side, overlay_area, type Rect, Side } from './geom.js';
import { calculate, Movement } from './movement.js';

export enum GrabKind {
    MouseMove,
    KeyboardMove,
    Resize,
    OverviewDrag,
}

export type GrabOutcome =
    | { kind: 'none' }
    /** Another window than the grabbed one was dropped, which shouldn't happen */
    | { kind: 'not_grabbed' }
    | { kind: 'minimized' }
    /** The window goes back to its place in its tree */
    | { kind: 'reflow' }
    /** The window goes where it was dropped, in whichever tree is there */
    | { kind: 'drop'; other_monitor: boolean }
    /** The window's tree resizes it, as its frame changed by `movement` */
    | { kind: 'resize'; movement: Movement }
    | { kind: 'snap' };

/** Where the window was dropped, and what's around it, as the GNOME side sees it */
export interface Drop {
    kind: GrabKind;
    minimized: boolean;
    maximized: boolean;
    auto_tiling: boolean;
    in_tree: boolean;
    /** Whether the window is on another monitor than its tree */
    other_monitor: boolean;
    pointer_in_work_area: boolean;
    pointer: [x: number, y: number];
    snap_to_grid: boolean;
}

/** Where the dragged window would go, as the GNOME side found it */
export interface Target {
    /** The window that it would go beside or into the stack of */
    frame: Rect;
    /** Whether that window is the dragged one's sibling in its fork */
    sibling: boolean;
    fork_area: Rect;
    in_stack: boolean;
}

/** Decides what dropping a grabbed window means, and where the overlay previews it */
export class Grab {
    /** The window being grabbed, and its frame when the grab started */
    private session: { window: WindowHandle; rect: Rect } | null = null;

    get window(): WindowHandle | null {
        return this.session?.window ?? null;
    }

    holds(window: WindowHandle): boolean {
        return this.session?.window === window;
    }

    /** @returns Whether to preview where the window would go */
    start(window: WindowHandle, kind: GrabKind, in_overview: boolean): boolean {
        const { x, y, width, height } = window.frame();
        this.session = { window, rect: { x, y, width, height } };

        return kind === GrabKind.MouseMove && !in_overview;
    }

    cancel() {
        this.session = null;
    }

    end(window: WindowHandle, drop: Drop): GrabOutcome {
        if (drop.minimized) return { kind: 'minimized' };
        if (drop.maximized) return { kind: 'none' };

        if (drop.kind === GrabKind.OverviewDrag && drop.auto_tiling) {
            return drop.pointer_in_work_area ? { kind: 'reflow' } : { kind: 'drop', other_monitor: true };
        }

        const session = this.session;
        if (session?.window !== window) return { kind: 'not_grabbed' };

        if (!drop.auto_tiling) return drop.snap_to_grid ? { kind: 'snap' } : { kind: 'none' };

        const rect = window.frame();
        const start = session.rect;

        if (drop.kind === GrabKind.MouseMove || drop.kind === GrabKind.KeyboardMove) {
            if (start.x === rect.x && start.y === rect.y) return { kind: 'none' };

            // Dropped within where it was, a window that isn't in a tree is reflowed instead
            if (contains(start, drop.pointer) && !drop.in_tree) return { kind: 'reflow' };

            return { kind: 'drop', other_monitor: drop.other_monitor };
        }

        if (!drop.in_tree) return { kind: 'none' };

        // A click on a resize edge can begin and end a grab without changing the window
        const movement = calculate(start, rect);
        if (movement === Movement.NONE) return { kind: 'none' };

        return { kind: 'resize', movement };
    }

    /** @param empty_area The work area that the window would fill, if the workspace has no tiled window */
    overlay_for(
        pointer: [x: number, y: number],
        empty_area: Rect | null,
        target: Target | null,
        stacking_with_mouse: boolean,
    ): Rect | null {
        if (empty_area !== null) return overlay_area(empty_area, Side.CENTER);
        if (target === null) return null;

        const area = target.sibling && !target.in_stack ? target.fork_area : target.frame;
        return overlay_area(area, nearest_side(pointer, area, stacking_with_mouse).side);
    }
}

function contains(rect: Rect, [x, y]: [number, number]): boolean {
    return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}
