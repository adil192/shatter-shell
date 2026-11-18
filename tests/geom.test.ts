import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
    add,
    clamp,
    diff,
    downward_distance,
    fmt,
    intersection,
    leftward_distance,
    nearest_side,
    overlay_area,
    type Rect,
    rightward_distance,
    shortest_side,
    Side,
    upward_distance,
} from '../src/core/geom.js';

/** A 100×100 square at (0, 0) */
const square: Rect = { x: 0, y: 0, width: 100, height: 100 };

const framed = (rect: Rect) => ({ get_frame_rect: () => rect });

describe('intersection', () => {
    test('is where the two rectangles overlap', () => {
        const other: Rect = { x: 50, y: 60, width: 100, height: 100 };
        assert.deepEqual(intersection(square, other), { x: 50, y: 60, width: 50, height: 40 });
        assert.deepEqual(intersection(other, square), { x: 50, y: 60, width: 50, height: 40 });
    });

    test('a rectangle inside the other is the whole of it', () => {
        const inner: Rect = { x: 10, y: 20, width: 30, height: 40 };
        assert.deepEqual(intersection(square, inner), inner);
    });

    test('rectangles that only touch, or are apart, do not overlap', () => {
        assert.equal(intersection(square, { x: 100, y: 0, width: 50, height: 50 }), null);
        assert.equal(intersection(square, { x: 0, y: 100, width: 50, height: 50 }), null);
        assert.equal(intersection(square, { x: 200, y: 200, width: 50, height: 50 }), null);
    });
});

describe('clamp', () => {
    test('shrinks the rectangle to the part inside the bounds, in place', () => {
        const rect: Rect = { x: -20, y: 50, width: 60, height: 80 };
        clamp(rect, square);
        assert.deepEqual(rect, { x: 0, y: 50, width: 40, height: 50 });
    });

    test('leaves the rectangle alone when it is outside the bounds', () => {
        const rect: Rect = { x: 200, y: 200, width: 10, height: 10 };
        clamp(rect, square);
        assert.deepEqual(rect, { x: 200, y: 200, width: 10, height: 10 });
    });
});

describe('add', () => {
    test('adds each field, in place', () => {
        const rect: Rect = { x: 1, y: 2, width: 3, height: 4 };
        add(rect, { x: 10, y: -20, width: 30, height: -4 });
        assert.deepEqual(rect, { x: 11, y: -18, width: 33, height: 0 });
    });
});

describe('diff', () => {
    test('is how much each field changes from the first to the second', () => {
        const from: Rect = { x: 1, y: 2, width: 3, height: 4 };
        const to: Rect = { x: 11, y: -18, width: 33, height: 0 };
        assert.deepEqual(diff(from, to), { x: 10, y: -20, width: 30, height: -4 });
    });

    test('adding the difference to the first gives the second', () => {
        const from: Rect = { x: 5, y: 6, width: 7, height: 8 };
        const to: Rect = { x: 0, y: 10, width: 20, height: 3 };
        add(from, diff(from, to));
        assert.deepEqual(from, to);
    });
});

describe('fmt', () => {
    test('lists the fields in order', () => {
        assert.equal(fmt({ x: 1, y: 2, width: 3, height: 4 }), 'Rect(1,2,3,4)');
    });
});

describe('nearest_side', () => {
    test('picks the side whose middle is nearest', () => {
        assert.deepEqual(nearest_side([10, 50], square, false), { distance: 10, side: Side.LEFT });
        assert.deepEqual(nearest_side([90, 50], square, false), { distance: 10, side: Side.RIGHT });
        assert.deepEqual(nearest_side([50, 10], square, false), { distance: 10, side: Side.TOP });
        assert.deepEqual(nearest_side([50, 90], square, false), { distance: 10, side: Side.BOTTOM });
    });

    test('the center only counts when stacking with the mouse', () => {
        assert.equal(nearest_side([50, 45], square, false).side, Side.TOP);
        assert.deepEqual(nearest_side([50, 45], square, true), { distance: 5, side: Side.CENTER });
    });

    test('a tie between left and right goes to the right', () => {
        assert.equal(nearest_side([50, 50], square, false).side, Side.RIGHT);
    });

    test('measures from the middle of each side, not the nearest point on it', () => {
        // (10, 10) is 10 from the left and top edges, but their middles are 40.something away
        const { distance } = nearest_side([10, 10], square, false);
        assert.equal(distance, Math.sqrt(10 * 10 + 40 * 40));
    });
});

describe('overlay_area', () => {
    const area: Rect = { x: 10, y: 20, width: 200, height: 100 };

    test('a side takes the half of the area on that side', () => {
        assert.deepEqual(overlay_area(area, Side.LEFT), { x: 10, y: 20, width: 100, height: 100 });
        assert.deepEqual(overlay_area(area, Side.RIGHT), { x: 110, y: 20, width: 100, height: 100 });
        assert.deepEqual(overlay_area(area, Side.TOP), { x: 10, y: 20, width: 200, height: 50 });
        assert.deepEqual(overlay_area(area, Side.BOTTOM), { x: 10, y: 70, width: 200, height: 50 });
    });

    test('the center takes all of it', () => {
        assert.deepEqual(overlay_area(area, Side.CENTER), area);
    });

    test('returns a new rectangle', () => {
        assert.notEqual(overlay_area(area, Side.CENTER), area);
    });
});

describe('shortest_side', () => {
    test('is the distance to the nearest middle of a side', () => {
        assert.equal(shortest_side([10, 50], square), 10);
        assert.equal(shortest_side([50, 120], square), 20);
    });
});

describe('directional distances', () => {
    const above = framed({ x: 0, y: 0, width: 100, height: 100 });
    const below = framed({ x: 0, y: 150, width: 100, height: 100 });
    const left = framed({ x: 0, y: 0, width: 100, height: 100 });
    const right = framed({ x: 130, y: 0, width: 100, height: 100 });

    test('upward: from the bottom of the first to the top of the second', () => {
        assert.equal(upward_distance(above, below), 50);
    });

    test('downward: from the top of the first to the bottom of the second', () => {
        assert.equal(downward_distance(below, above), 50);
    });

    test('rightward: from the left of the first to the right of the second', () => {
        assert.equal(rightward_distance(right, left), 30);
    });

    test('leftward: from the right of the first to the left of the second', () => {
        assert.equal(leftward_distance(left, right), 30);
    });
});
