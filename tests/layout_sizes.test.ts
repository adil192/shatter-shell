import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { GAP_UNIT, LayoutSizes } from '../src/core/layout_sizes.js';

/** Sizes at `scale`, with gaps of 2 and 3 units and 32×24 cells */
function sizes_at(scale: number) {
    const sizes = new LayoutSizes(scale);
    sizes.set_gap_inner(2);
    sizes.set_gap_outer(3);
    sizes.set_column_size(32);
    sizes.set_row_size(24);
    return sizes;
}

describe('LayoutSizes', () => {
    test('gaps are in units of GAP_UNIT pixels', () => {
        const sizes = sizes_at(1);
        assert.equal(sizes.gap_inner, 2 * GAP_UNIT);
        assert.equal(sizes.gap_outer, 3 * GAP_UNIT);
    });

    test('the snap-to-grid cells are in pixels', () => {
        const sizes = sizes_at(1);
        assert.equal(sizes.column_size, 32);
        assert.equal(sizes.row_size, 24);
    });

    test('every size grows with the scale', () => {
        const sizes = sizes_at(2);
        assert.equal(sizes.scale, 2);
        assert.equal(sizes.gap_inner, 2 * GAP_UNIT * 2);
        assert.equal(sizes.gap_outer, 3 * GAP_UNIT * 2);
        assert.equal(sizes.column_size, 64);
        assert.equal(sizes.row_size, 48);
    });

    test('a new scale rescales every size', () => {
        const sizes = sizes_at(1);
        sizes.set_scale(2);
        assert.deepEqual(
            [sizes.gap_inner, sizes.gap_outer, sizes.column_size, sizes.row_size],
            [2 * GAP_UNIT * 2, 3 * GAP_UNIT * 2, 64, 48],
        );
    });

    test('a new gap is scaled', () => {
        const sizes = sizes_at(2);
        sizes.set_gap_inner(5);
        sizes.set_gap_outer(1);
        assert.equal(sizes.gap_inner, 5 * GAP_UNIT * 2);
        assert.equal(sizes.gap_outer, GAP_UNIT * 2);
    });

    test('gap_inner_half is exactly half of the inner gap', () => {
        const sizes = sizes_at(1);
        sizes.set_gap_inner(3);
        assert.equal(sizes.gap_inner_half, 6);
        sizes.set_scale(2);
        assert.equal(sizes.gap_inner_half, 12);
    });

    test('starts with no gaps', () => {
        const sizes = new LayoutSizes(2);
        assert.equal(sizes.gap_inner, 0);
        assert.equal(sizes.gap_outer, 0);
    });
});

describe('what the gap setters return', () => {
    test('how many pixels the gap grew by, at the scale', () => {
        const sizes = new LayoutSizes(2);
        assert.equal(sizes.set_gap_inner(1), GAP_UNIT * 2);
        assert.equal(sizes.set_gap_inner(3), GAP_UNIT * 2 * 2);
        assert.equal(sizes.set_gap_outer(2), GAP_UNIT * 2 * 2);
        assert.equal(sizes.set_gap_outer(1), -GAP_UNIT * 2);
    });

    test('0 when the gap is set to what it was', () => {
        const sizes = new LayoutSizes(2);
        sizes.set_gap_inner(1);
        sizes.set_gap_outer(1);
        assert.equal(sizes.set_gap_inner(1), 0);
        assert.equal(sizes.set_gap_outer(1), 0);
    });
});

describe('what set_scale returns', () => {
    /** Sizes at `scale` with an outer gap of `gap` units */
    function outer(gap: number, scale: number) {
        const sizes = new LayoutSizes(scale);
        sizes.set_gap_outer(gap);
        return sizes;
    }

    test('how many pixels the outer gap grew or shrank by', () => {
        // Not the ratio of the scales, taken as a number of gap units
        assert.equal(outer(1, 1).set_scale(2), GAP_UNIT);
        assert.equal(outer(1, 2).set_scale(1), -GAP_UNIT);
    });

    test('0 when there is no outer gap', () => {
        assert.equal(outer(0, 1).set_scale(2), 0);
    });

    test('0 when the scale is set to what it was', () => {
        assert.equal(outer(1, 2).set_scale(2), 0);
    });
});
