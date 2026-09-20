import * as log from './log.js';

import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';

export function bench<T>(name: string, callback: () => T): T {
    const start = new Date().getMilliseconds();
    const value = callback();
    const end = new Date().getMilliseconds();

    log.info(`bench ${name}: ${end - start} ms elapsed`);

    return value;
}

/* A unit square at the cursor's position */
export function cursor_rect(): Mtk.Rectangle {
    const [x, y] = global.get_pointer();
    return new Mtk.Rectangle({
        x, y, width: 1, height: 1,
    });
}

export function is_keyboard_op(op: number): boolean {
    const window_flag_keyboard = Meta.GrabOp.KEYBOARD_MOVING & ~Meta.GrabOp.WINDOW_BASE;
    return (op & window_flag_keyboard) != 0;
}

export function is_resize_op(op: number): boolean {
    const window_dir_mask
        = (Meta.GrabOp.RESIZING_N | Meta.GrabOp.RESIZING_E | Meta.GrabOp.RESIZING_S | Meta.GrabOp.RESIZING_W)
        & ~Meta.GrabOp.WINDOW_BASE;
    return (
        (op & window_dir_mask) != 0
        || (op & Meta.GrabOp.KEYBOARD_RESIZING_UNKNOWN) == Meta.GrabOp.KEYBOARD_RESIZING_UNKNOWN.valueOf()
    );
}

export function is_move_op(op: number): boolean {
    return !is_resize_op(op);
}

export function round_increment(value: number, increment: number): number {
    return Math.round(value / increment) * increment;
}
