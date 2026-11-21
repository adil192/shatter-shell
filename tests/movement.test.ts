import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { type Rect, Side } from '../src/core/geom.js';
import { calculate, Movement, movement_is_valid } from '../src/core/movement.js';

const from: Rect = { x: 100, y: 100, width: 200, height: 200 };
const changed = (change: Partial<Rect>): Rect => ({ ...from, ...change });

describe('calculate', () => {
    test('nothing changed', () => {
        assert.equal(calculate(from, changed({})), Movement.NONE);
    });

    test('the bottom edge moved', () => {
        assert.equal(calculate(from, changed({ height: 250 })), Movement.GROW | Movement.DOWN);
        assert.equal(calculate(from, changed({ height: 150 })), Movement.SHRINK | Movement.UP);
    });

    test('the right edge moved', () => {
        assert.equal(calculate(from, changed({ width: 250 })), Movement.GROW | Movement.RIGHT);
        assert.equal(calculate(from, changed({ width: 150 })), Movement.SHRINK | Movement.LEFT);
    });

    test('the top edge moved', () => {
        assert.equal(calculate(from, changed({ y: 50, height: 250 })), Movement.GROW | Movement.UP);
        assert.equal(calculate(from, changed({ y: 150, height: 150 })), Movement.SHRINK | Movement.DOWN);
    });

    test('the left edge moved', () => {
        assert.equal(calculate(from, changed({ x: 50, width: 250 })), Movement.GROW | Movement.LEFT);
        assert.equal(calculate(from, changed({ x: 150, width: 150 })), Movement.SHRINK | Movement.RIGHT);
    });

    test('the whole window moved', () => {
        assert.equal(calculate(from, changed({ x: 150, y: 150 })), Movement.MOVED);
    });
});

describe('movement_is_valid', () => {
    const none = () => null;
    /** A neighbour at `rect` on `side` only */
    const only = (side: Side, rect: Rect) => (asked: Side) => (asked === side ? rect : null);

    test('growing and moving are always valid', () => {
        assert.equal(movement_is_valid(Movement.GROW | Movement.DOWN, from, none), true);
        assert.equal(movement_is_valid(Movement.MOVED, from, none), true);
        assert.equal(movement_is_valid(Movement.NONE, from, none), true);
    });

    test('shrinking needs a neighbour on the side it gives space to', () => {
        assert.equal(movement_is_valid(Movement.SHRINK | Movement.DOWN, from, none), false);
        assert.equal(movement_is_valid(Movement.SHRINK | Movement.UP, from, none), false);
        assert.equal(movement_is_valid(Movement.SHRINK | Movement.LEFT, from, none), false);
        assert.equal(movement_is_valid(Movement.SHRINK | Movement.RIGHT, from, none), false);
    });

    test('shrinking down: the neighbour above must end at or above the window', () => {
        const above = (bottom: number) => only(Side.TOP, { x: 100, y: 0, width: 200, height: bottom });
        assert.equal(movement_is_valid(Movement.SHRINK | Movement.DOWN, from, above(100)), true);
        assert.equal(movement_is_valid(Movement.SHRINK | Movement.DOWN, from, above(120)), false);
    });

    test('shrinking up: the neighbour below must not end above the window', () => {
        const below = (y: number, height: number) => only(Side.BOTTOM, { x: 100, y, width: 200, height });
        assert.equal(movement_is_valid(Movement.SHRINK | Movement.UP, from, below(300, 100)), true);
        assert.equal(movement_is_valid(Movement.SHRINK | Movement.UP, from, below(0, 50)), false);
    });

    test('shrinking left: the neighbour on the right must not end left of the window', () => {
        const right = (x: number, width: number) => only(Side.RIGHT, { x, y: 100, width, height: 200 });
        assert.equal(movement_is_valid(Movement.SHRINK | Movement.LEFT, from, right(300, 100)), true);
        assert.equal(movement_is_valid(Movement.SHRINK | Movement.LEFT, from, right(0, 50)), false);
    });

    test('shrinking right: the neighbour on the left must end at or left of the window', () => {
        const left = (width: number) => only(Side.LEFT, { x: 0, y: 100, width, height: 200 });
        assert.equal(movement_is_valid(Movement.SHRINK | Movement.RIGHT, from, left(100)), true);
        assert.equal(movement_is_valid(Movement.SHRINK | Movement.RIGHT, from, left(120)), false);
    });
});
