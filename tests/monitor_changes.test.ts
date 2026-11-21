import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { Rect } from '../src/core/geom.js';

import {
    lowest_unused_workspace,
    type MonitorInfo,
    monitor_changes,
    plan_migrations,
    unchanged_monitors,
    workspace_on,
} from '../src/core/monitor_changes.js';

const rect = (x: number): Rect => ({ x, y: 0, width: 100, height: 100 });
const info = (x: number): MonitorInfo<Rect> => ({ area: rect(x), ws: rect(x) });

describe('monitor_changes', () => {
    test("each window says where its monitor's trees go", () => {
        const changes = monitor_changes(
            [
                [1, 0],
                [2, 2],
            ],
            0,
            0,
        );
        assert.deepEqual(
            [...changes],
            [
                [1, 0],
                [2, 2],
            ],
        );
    });

    test('windows on the old primary follow the new primary', () => {
        const changes = monitor_changes([[0, 5]], 0, 1);
        assert.deepEqual([...changes], [[0, 1]]);
    });

    test('the last window of a monitor wins', () => {
        const changes = monitor_changes(
            [
                [2, 0],
                [2, 1],
            ],
            0,
            0,
        );
        assert.deepEqual([...changes], [[2, 1]]);
    });
});

describe('unchanged_monitors', () => {
    test('are the monitors that map to themselves', () => {
        const changes = new Map([
            [0, 0],
            [1, 0],
            [2, 2],
        ]);
        assert.deepEqual([...unchanged_monitors(changes)], [0, 2]);
    });
});

describe('plan_migrations', () => {
    test('a tree on a changed monitor moves to the new one', () => {
        const tree = { monitor: 1 };
        const migrations = plan_migrations([tree], new Map([[1, 0]]), new Map([[0, info(0)]]));

        assert.deepEqual(migrations, [{ tree, monitor: 0, work_area: rect(0), moved: true }]);
        assert.equal(tree.monitor, 0);
    });

    test('a tree on a monitor that maps to itself counts as moved too', () => {
        const tree = { monitor: 0 };
        const migrations = plan_migrations([tree], new Map([[0, 0]]), new Map([[0, info(0)]]));

        assert.equal(migrations[0]?.moved, true);
    });

    test('a tree on a monitor without changes stays, if its monitor is known', () => {
        const tree = { monitor: 2 };
        const migrations = plan_migrations([tree], new Map([[1, 0]]), new Map([[2, info(200)]]));

        assert.deepEqual(migrations, [{ tree, monitor: 2, work_area: rect(200), moved: false }]);
    });

    test('a tree goes nowhere when the monitor it would go to is unknown', () => {
        const tree = { monitor: 1 };
        const migrations = plan_migrations([tree], new Map([[1, 3]]), new Map([[0, info(0)]]));

        assert.deepEqual(migrations, []);
        assert.equal(tree.monitor, 1);
    });

    test('a tree follows only the change of the monitor it was on', () => {
        // Monitor 0 is removed, so 1 and 2 become 0 and 1. The tree from 2 goes to 1, not on to 0.
        const tree = { monitor: 2 };
        const changes = new Map([
            [2, 1],
            [1, 0],
        ]);
        const monitors = new Map([
            [0, info(0)],
            [1, info(100)],
        ]);

        const migrations = plan_migrations([tree], changes, monitors);

        assert.equal(tree.monitor, 1);
        assert.deepEqual(migrations, [{ tree, monitor: 1, work_area: rect(100), moved: true }]);
    });

    test('the trees of two monitors that swapped swap too', () => {
        const a = { monitor: 0 };
        const b = { monitor: 1 };
        const changes = new Map([
            [0, 1],
            [1, 0],
        ]);
        const monitors = new Map([
            [0, info(0)],
            [1, info(100)],
        ]);

        const migrations = plan_migrations([a, b], changes, monitors);

        assert.deepEqual(
            migrations.map(step => step.monitor),
            [1, 0],
        );
    });
});

describe('workspace_on', () => {
    const unused = () => 7;

    test('the first tree on a monitor gets its first workspace', () => {
        const claimed = new Set<number>();
        assert.equal(workspace_on(0, claimed, unused), 0);
        assert.deepEqual([...claimed], [0]);
    });

    test('later trees get an unused workspace', () => {
        const claimed = new Set([0]);
        assert.equal(workspace_on(0, claimed, unused), 7);
    });
});

describe('lowest_unused_workspace', () => {
    test('is 0 when nothing is occupied', () => {
        assert.equal(lowest_unused_workspace([]), 0);
    });

    test('is the first gap', () => {
        assert.equal(lowest_unused_workspace([0, 1, 3]), 2);
        assert.equal(lowest_unused_workspace([3, 1, 0, 1]), 2);
    });

    test('is after the last when there is no gap', () => {
        assert.equal(lowest_unused_workspace([2, 0, 1]), 3);
    });
});
