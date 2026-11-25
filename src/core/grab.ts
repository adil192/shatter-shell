import { nearest_side, overlay_area, type Rect, Side } from './geom.js';

/** Where the dragged window would go, as the GNOME side found it */
export interface Target {
    /** The window that it would go beside or into the stack of */
    frame: Rect;
    /** Whether that window is the dragged one's sibling in its fork */
    sibling: boolean;
    fork_area: Rect;
    in_stack: boolean;
}

/** Decides where the overlay previews a drop */
export class Grab {
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
