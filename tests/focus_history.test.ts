import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { FocusHistory } from '../src/core/focus_history.js';

const same = (a: number, b: number) => a === b;

/** A history where 1 and then 2 were focused on workspace 0 */
function one_then_two() {
    const history = new FocusHistory<number>(same);
    history.focused(1, 0);
    history.focused(2, 0);
    return history;
}

describe('FocusHistory', () => {
    test('starts empty', () => {
        const history = new FocusHistory<number>(same);
        assert.equal(history.current, null);
        assert.equal(history.previous, null);
        assert.deepEqual(history.recent(), []);
        assert.equal(history.previous_to(1), null);
        assert.equal(history.last_on(0), null);
    });

    test('focusing a window makes the current one previous', () => {
        const history = one_then_two();
        history.focused(3, 0);
        assert.equal(history.current, 3);
        assert.equal(history.previous, 2);
    });

    test('focusing the current window again leaves the order unchanged, but records its workspace', () => {
        const history = one_then_two();
        history.focused(2, 1);
        assert.equal(history.current, 2);
        assert.equal(history.previous, 1);
        assert.equal(history.last_on(1), 2);
    });

    test('is_current', () => {
        const history = one_then_two();
        assert.equal(history.is_current(2), true);
        assert.equal(history.is_current(1), false);
        assert.equal(new FocusHistory<number>(same).is_current(1), false);
    });

    test('remembers the last window focused on each workspace', () => {
        const history = new FocusHistory<number>(same);
        history.focused(1, 0);
        history.focused(2, 1);
        history.focused(3, 0);
        assert.equal(history.last_on(0), 3);
        assert.equal(history.last_on(1), 2);
        assert.equal(history.last_on(2), null);
    });

    test('forgetting the current window makes the previous one current', () => {
        const history = one_then_two();
        history.forget(2);
        assert.equal(history.current, 1);
        assert.equal(history.previous, null);
    });

    test('forgetting the previous window keeps the current one', () => {
        const history = one_then_two();
        history.forget(1);
        assert.equal(history.current, 2);
        assert.equal(history.previous, null);
    });

    test('forgetting a window forgets it on every workspace', () => {
        const history = new FocusHistory<number>(same);
        history.focused(1, 0);
        history.focused(2, 1);
        history.focused(1, 2);
        history.forget(1);
        assert.equal(history.last_on(0), null);
        assert.equal(history.last_on(1), 2);
        assert.equal(history.last_on(2), null);
    });

    test('forgetting an unknown window changes nothing', () => {
        const history = one_then_two();
        history.forget(3);
        assert.equal(history.current, 2);
        assert.equal(history.previous, 1);
    });

    test('restart_from leaves only that window', () => {
        const history = one_then_two();
        history.restart_from(3);
        assert.equal(history.current, 3);
        assert.equal(history.previous, null);
    });

    test('clear forgets the current and previous windows', () => {
        const history = one_then_two();
        history.clear();
        assert.deepEqual(history.recent(), []);
    });

    test('recent lists the most recent first', () => {
        assert.deepEqual(one_then_two().recent(), [2, 1]);
    });

    test('previous_to skips the given window', () => {
        const history = one_then_two();
        assert.equal(history.previous_to(2), 1);
        assert.equal(history.previous_to(1), 2);
        assert.equal(history.previous_to(3), 2);
    });

    test('previous_to is null when the only window is the given one', () => {
        const history = new FocusHistory<number>(same);
        history.focused(1, 0);
        assert.equal(history.previous_to(1), null);
    });

    test('compares ids with the given equality, not identity', () => {
        type Id = [index: number, generation: number];
        const eq = (a: Id, b: Id) => a[0] === b[0] && a[1] === b[1];
        const history = new FocusHistory<Id>(eq);

        history.focused([1, 0], 0);
        history.focused([2, 0], 0);
        history.focused([2, 0], 0);
        assert.deepEqual(history.recent(), [
            [2, 0],
            [1, 0],
        ]);
        assert.equal(history.is_current([2, 0]), true);
        assert.deepEqual(history.previous_to([2, 0]), [1, 0]);

        history.forget([2, 0]);
        assert.deepEqual(history.current, [1, 0]);
    });
});
