import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { Rect } from '../src/core/geom.js';
import type { WindowHandle } from '../src/core/window_handle.js';

import { Grab, GrabKind, type Target } from '../src/core/grab.js';

/** A window whose frame the test moves */
class FakeWindow implements WindowHandle {
    constructor(public rect: Rect) {}
    frame(): Rect {
        return { ...this.rect };
    }
}

const at = (x: number, y: number, width = 100, height = 100): Rect => ({ x, y, width, height });

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
