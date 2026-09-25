import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';

import type { Ext } from './extension.js';

export enum Side {
    LEFT,
    TOP,
    RIGHT,
    BOTTOM,
    CENTER,
}

function xend(rect: Mtk.Rectangle): number {
    return rect.x + rect.width;
}

function xcenter(rect: Mtk.Rectangle): number {
    return rect.x + rect.width / 2;
}

function yend(rect: Mtk.Rectangle): number {
    return rect.y + rect.height;
}

function ycenter(rect: Mtk.Rectangle): number {
    return rect.y + rect.height / 2;
}

function center(rect: Mtk.Rectangle): [number, number] {
    return [xcenter(rect), ycenter(rect)];
}

function north(rect: Mtk.Rectangle): [number, number] {
    return [xcenter(rect), rect.y];
}

function east(rect: Mtk.Rectangle): [number, number] {
    return [xend(rect), ycenter(rect)];
}

function south(rect: Mtk.Rectangle): [number, number] {
    return [xcenter(rect), yend(rect)];
}

function west(rect: Mtk.Rectangle): [number, number] {
    return [rect.x, ycenter(rect)];
}

function distance([ax, ay]: [number, number], [bx, by]: [number, number]): number {
    return Math.sqrt(Math.pow(bx - ax, 2) + Math.pow(by - ay, 2));
}

function directional_distance(
    a: Mtk.Rectangle,
    b: Mtk.Rectangle,
    fn_a: (rect: Mtk.Rectangle) => [number, number],
    fn_b: (rect: Mtk.Rectangle) => [number, number],
) {
    return distance(fn_a(a), fn_b(b));
}

export function upward_distance(win_a: Meta.Window, win_b: Meta.Window) {
    return directional_distance(win_a.get_frame_rect(), win_b.get_frame_rect(), south, north);
}

export function rightward_distance(win_a: Meta.Window, win_b: Meta.Window) {
    return directional_distance(win_a.get_frame_rect(), win_b.get_frame_rect(), west, east);
}

export function downward_distance(win_a: Meta.Window, win_b: Meta.Window) {
    return directional_distance(win_a.get_frame_rect(), win_b.get_frame_rect(), north, south);
}

export function leftward_distance(win_a: Meta.Window, win_b: Meta.Window) {
    return directional_distance(win_a.get_frame_rect(), win_b.get_frame_rect(), east, west);
}

export function nearest_side(ext: Ext, origin: [number, number], rect: Mtk.Rectangle): [number, Side] {
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

    let nearest: [number, Side]
        = left_distance < right_distance ? [left_distance, Side.LEFT] : [right_distance, Side.RIGHT];

    if (top_distance < nearest[0]) nearest = [top_distance, Side.TOP];
    if (bottom_distance < nearest[0]) nearest = [bottom_distance, Side.BOTTOM];
    if (ext.settings.stacking_with_mouse() && center_distance < nearest[0]) nearest = [center_distance, Side.CENTER];

    return nearest;
}

export function shortest_side(origin: [number, number], rect: Mtk.Rectangle): number {
    let shortest = distance(origin, west(rect));
    shortest = Math.min(shortest, distance(origin, north(rect)));
    shortest = Math.min(shortest, distance(origin, east(rect)));
    return Math.min(shortest, distance(origin, south(rect)));
}
