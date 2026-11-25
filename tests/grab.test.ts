import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { Rect } from '../src/core/geom.js';
import type { WindowHandle } from '../src/core/window_handle.js';

import { type Drop, Grab, GrabKind, type Target } from '../src/core/grab.js';
import { Movement } from '../src/core/movement.js';

/** A window whose frame the test moves */
class FakeWindow implements WindowHandle {
    constructor(public rect: Rect) {}
    frame(): Rect {
        return { ...this.rect };
    }
}

const at = (x: number, y: number, width = 100, height = 100): Rect => ({ x, y, width, height });

/** A drop of a tiled window with the auto-tiler on, with the pointer at (50, 50) */
function drop(changes: Partial<Drop> = {}): Drop {
    return {
        kind: GrabKind.MouseMove,
        minimized: false,
        maximized: false,
        auto_tiling: true,
        in_tree: true,
        other_monitor: false,
        pointer_in_work_area: true,
        pointer: [50, 50],
        snap_to_grid: false,
        ...changes,
    };
}

/** A window grabbed at (0, 0), and the grab */
function grabbed(kind = GrabKind.MouseMove) {
    const window = new FakeWindow(at(0, 0));
    const grab = new Grab();
    grab.start(window, kind, false);
    return { window, grab };
}

describe('Grab', () => {
    describe('start', () => {
        test('previews only a move with the mouse, outside the overview', () => {
            const window = new FakeWindow(at(0, 0));
            assert.equal(new Grab().start(window, GrabKind.MouseMove, false), true);
            assert.equal(new Grab().start(window, GrabKind.MouseMove, true), false);
            assert.equal(new Grab().start(window, GrabKind.KeyboardMove, false), false);
            assert.equal(new Grab().start(window, GrabKind.Resize, false), false);
        });

        test('remembers the grabbed window until it is cancelled', () => {
            const { window, grab } = grabbed();
            assert.equal(grab.window, window);
            grab.cancel();
            assert.equal(grab.window, null);
        });
    });

    describe('end', () => {
        test('a window minimized while grabbed counts as minimized', () => {
            const { window, grab } = grabbed();
            assert.deepEqual(grab.end(window, drop({ minimized: true })), { kind: 'minimized' });
        });

        test('nothing happens to a maximized window', () => {
            const { window, grab } = grabbed();
            window.rect = at(300, 0);
            assert.deepEqual(grab.end(window, drop({ maximized: true })), { kind: 'none' });
        });

        test('a drag in the overview reflows within the work area, and drops elsewhere', () => {
            const window = new FakeWindow(at(0, 0));
            const grab = new Grab();
            assert.deepEqual(grab.end(window, drop({ kind: GrabKind.OverviewDrag })), { kind: 'reflow' });
            assert.deepEqual(grab.end(window, drop({ kind: GrabKind.OverviewDrag, pointer_in_work_area: false })), {
                kind: 'drop',
                other_monitor: true,
            });
        });

        test('a window that the grab did not start with is not dropped', () => {
            const { grab } = grabbed();
            const other = new FakeWindow(at(0, 0));
            assert.deepEqual(grab.end(other, drop()), { kind: 'not_grabbed' });
            assert.deepEqual(new Grab().end(other, drop()), { kind: 'not_grabbed' });
        });

        test('without the auto-tiler, the window snaps to the grid if that is on', () => {
            const { window, grab } = grabbed();
            assert.deepEqual(grab.end(window, drop({ auto_tiling: false, snap_to_grid: true })), { kind: 'snap' });
            assert.deepEqual(grab.end(window, drop({ auto_tiling: false })), { kind: 'none' });
        });

        test('a move that left the window where it was changes nothing', () => {
            const { window, grab } = grabbed();
            assert.deepEqual(grab.end(window, drop()), { kind: 'none' });
        });

        test('a move drops the window, saying whether it went to another monitor', () => {
            const { window, grab } = grabbed();
            window.rect = at(300, 0);
            assert.deepEqual(grab.end(window, drop({ pointer: [350, 50], other_monitor: true })), {
                kind: 'drop',
                other_monitor: true,
            });
        });

        test('dropped within where it was, a window that is not in a tree is reflowed', () => {
            const { window, grab } = grabbed();
            window.rect = at(10, 0);
            assert.deepEqual(grab.end(window, drop({ in_tree: false })), { kind: 'reflow' });
            assert.deepEqual(grab.end(window, drop()), { kind: 'drop', other_monitor: false });
        });

        test('a keyboard move counts as a move', () => {
            const { window, grab } = grabbed(GrabKind.KeyboardMove);
            window.rect = at(300, 0);
            assert.deepEqual(grab.end(window, drop({ kind: GrabKind.KeyboardMove, pointer: [350, 50] })), {
                kind: 'drop',
                other_monitor: false,
            });
        });

        test('a resize resizes the tree by how the frame changed', () => {
            const { window, grab } = grabbed(GrabKind.Resize);
            window.rect = at(0, 0, 150);
            assert.deepEqual(grab.end(window, drop({ kind: GrabKind.Resize })), {
                kind: 'resize',
                movement: Movement.GROW | Movement.RIGHT,
            });
        });

        test('a resize that changed nothing, or of a window not in a tree, changes nothing', () => {
            const { window, grab } = grabbed(GrabKind.Resize);
            assert.deepEqual(grab.end(window, drop({ kind: GrabKind.Resize })), { kind: 'none' });
            window.rect = at(0, 0, 150);
            assert.deepEqual(grab.end(window, drop({ kind: GrabKind.Resize, in_tree: false })), { kind: 'none' });
        });
    });

    describe('overlay_for', () => {
        const grab = new Grab();
        const target = (changes: Partial<Target> = {}): Target => ({
            frame: at(100, 0),
            sibling: false,
            fork_area: at(0, 0, 200),
            in_stack: false,
            ...changes,
        });

        test('an empty workspace takes all of its area', () => {
            assert.deepEqual(grab.overlay_for([10, 10], at(0, 0, 500), target(), false), at(0, 0, 500));
        });

        test('nothing to preview without a target', () => {
            assert.equal(grab.overlay_for([10, 10], null, null, false), null);
        });

        test('beside another window, the half of its frame nearest the pointer', () => {
            assert.deepEqual(grab.overlay_for([105, 50], null, target(), false), at(100, 0, 50));
        });

        test("beside a sibling it isn't stacked with, the half of their fork nearest the pointer", () => {
            assert.deepEqual(grab.overlay_for([190, 50], null, target({ sibling: true }), false), at(100, 0, 100));
        });

        test('from a stack, a sibling counts as any other window', () => {
            assert.deepEqual(
                grab.overlay_for([105, 50], null, target({ sibling: true, in_stack: true }), false),
                at(100, 0, 50),
            );
        });
    });
});
