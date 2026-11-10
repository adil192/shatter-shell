import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
    downward_distance,
    leftward_distance,
    nearest_side,
    type Rect,
    rightward_distance,
    shortest_side,
    Side,
    upward_distance,
} from '../src/core/geom.js';

/** A 100×100 square at (0, 0) */
const square: Rect = { x: 0, y: 0, width: 100, height: 100 };

const framed = (rect: Rect) => ({ get_frame_rect: () => rect });

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
