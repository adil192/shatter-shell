/** A rectangle, such as an `Mtk.Rectangle` */
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Something with a frame, such as a `Meta.Window` */
interface Framed {
    get_frame_rect(): Rect;
}

export enum Side {
    LEFT,
    TOP,
    RIGHT,
    BOTTOM,
    CENTER,
}

function xend(rect: Rect): number {
    return rect.x + rect.width;
}

function xcenter(rect: Rect): number {
    return rect.x + rect.width / 2;
}

function yend(rect: Rect): number {
    return rect.y + rect.height;
}

function ycenter(rect: Rect): number {
    return rect.y + rect.height / 2;
}

function center(rect: Rect): [number, number] {
    return [xcenter(rect), ycenter(rect)];
}

function north(rect: Rect): [number, number] {
    return [xcenter(rect), rect.y];
}

function east(rect: Rect): [number, number] {
    return [xend(rect), ycenter(rect)];
}

function south(rect: Rect): [number, number] {
    return [xcenter(rect), yend(rect)];
}

function west(rect: Rect): [number, number] {
    return [rect.x, ycenter(rect)];
}

function distance([ax, ay]: [number, number], [bx, by]: [number, number]): number {
    return Math.sqrt(Math.pow(bx - ax, 2) + Math.pow(by - ay, 2));
}

function directional_distance(
    a: Rect,
    b: Rect,
    fn_a: (rect: Rect) => [number, number],
    fn_b: (rect: Rect) => [number, number],
) {
    return distance(fn_a(a), fn_b(b));
}

export function upward_distance(win_a: Framed, win_b: Framed) {
    return directional_distance(win_a.get_frame_rect(), win_b.get_frame_rect(), south, north);
}

export function rightward_distance(win_a: Framed, win_b: Framed) {
    return directional_distance(win_a.get_frame_rect(), win_b.get_frame_rect(), west, east);
}

export function downward_distance(win_a: Framed, win_b: Framed) {
    return directional_distance(win_a.get_frame_rect(), win_b.get_frame_rect(), north, south);
}

export function leftward_distance(win_a: Framed, win_b: Framed) {
    return directional_distance(win_a.get_frame_rect(), win_b.get_frame_rect(), east, west);
}

/**
 * The side of `rect` whose middle is nearest to `origin`, and how far away it is.
 *
 * @param stacking_with_mouse Whether the center of `rect` counts as a side too
 */
export function nearest_side(
    origin: [number, number],
    rect: Rect,
    stacking_with_mouse: boolean,
): { side: Side; distance: number } {
    const left = west(rect),
        top = north(rect),
        right = east(rect),
        bottom = south(rect),
        ctr = center(rect);

    const left_distance = distance(origin, left),
        top_distance = distance(origin, top),
        right_distance = distance(origin, right),
        bottom_distance = distance(origin, bottom),
        center_distance = distance(origin, ctr);

    let nearest =
        left_distance < right_distance
            ? { side: Side.LEFT, distance: left_distance }
            : { side: Side.RIGHT, distance: right_distance };

    if (top_distance < nearest.distance) nearest = { side: Side.TOP, distance: top_distance };
    if (bottom_distance < nearest.distance) nearest = { side: Side.BOTTOM, distance: bottom_distance };
    if (stacking_with_mouse && center_distance < nearest.distance) {
        nearest = { side: Side.CENTER, distance: center_distance };
    }

    return nearest;
}

/** The part of `area` that a window dropped at `side` of it would take: half of it, or all of it at the center */
export function overlay_area(area: Rect, side: Side): Rect {
    const { x, y, width, height } = area;

    switch (side) {
        case Side.LEFT:
            return { x, y, width: width / 2, height };
        case Side.RIGHT:
            return { x: x + width / 2, y, width: width / 2, height };
        case Side.TOP:
            return { x, y, width, height: height / 2 };
        case Side.BOTTOM:
            return { x, y: y + height / 2, width, height: height / 2 };
        case Side.CENTER:
            return { x, y, width, height };
    }
}

export function shortest_side(origin: [number, number], rect: Rect): number {
    let shortest = distance(origin, west(rect));
    shortest = Math.min(shortest, distance(origin, north(rect)));
    shortest = Math.min(shortest, distance(origin, east(rect)));
    return Math.min(shortest, distance(origin, south(rect)));
}
