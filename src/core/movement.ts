import { type Rect, Side, xend, yend } from './geom.js';

export enum Movement {
    NONE = 0,
    MOVED = 0b1,
    GROW = 0b10,
    SHRINK = 0b100,
    LEFT = 0b1000,
    UP = 0b10000,
    RIGHT = 0b100000,
    DOWN = 0b1000000,
}

/** Works out how a window's frame changed: which edge moved, and whether it grew or shrank */
export function calculate(from: Rect, change: Rect): Movement {
    const xpos = from.x == change.x;
    const ypos = from.y == change.y;

    if (xpos && ypos) {
        if (from.width == change.width) {
            if (from.height == change.height) {
                return Movement.NONE;
            } else if (from.height < change.height) {
                return Movement.GROW | Movement.DOWN;
            } else {
                return Movement.SHRINK | Movement.UP;
            }
        } else if (from.width < change.width) {
            return Movement.GROW | Movement.RIGHT;
        } else {
            return Movement.SHRINK | Movement.LEFT;
        }
    } else if (xpos) {
        if (from.height < change.height) {
            return Movement.GROW | Movement.UP;
        } else {
            return Movement.SHRINK | Movement.DOWN;
        }
    } else if (ypos) {
        if (from.width < change.width) {
            return Movement.GROW | Movement.LEFT;
        } else {
            return Movement.SHRINK | Movement.RIGHT;
        }
    } else {
        return Movement.MOVED;
    }
}

/** A side of a window that can have a neighbour */
export type EdgeSide = Exclude<Side, Side.CENTER>;

/** The side that gets the space a shrinking window gives up */
function movement_to_side(movement: Movement): EdgeSide | null {
    // If several directions are set, the first one checked wins
    if ((movement & Movement.DOWN) !== 0) return Side.TOP;
    if ((movement & Movement.UP) !== 0) return Side.BOTTOM;
    if ((movement & Movement.LEFT) !== 0) return Side.RIGHT;
    if ((movement & Movement.RIGHT) !== 0) return Side.LEFT;
    return null;
}

/**
 * Whether a resize of the window at `rect` may go ahead.
 *
 * A window can only shrink if a neighbour takes the space it gives up.
 *
 * @param get_neighbour The nearest window on a side, or null if there's none
 */
export function movement_is_valid(
    movement: Movement,
    rect: Rect,
    get_neighbour: (side: EdgeSide) => Rect | null,
): boolean {
    if ((movement & Movement.SHRINK) === 0) return true;

    const side = movement_to_side(movement);
    if (side === null) return true;

    const neighbour = get_neighbour(side);
    if (neighbour === null) return false;

    // As in the old code, each case compares the neighbour's bottom or right edge with the
    // window's top or left edge
    switch (side) {
        case Side.TOP:
            return yend(neighbour) <= rect.y;
        case Side.BOTTOM:
            return yend(neighbour) >= rect.y;
        case Side.RIGHT:
            return xend(neighbour) >= rect.x;
        case Side.LEFT:
            return xend(neighbour) <= rect.x;
    }
}
