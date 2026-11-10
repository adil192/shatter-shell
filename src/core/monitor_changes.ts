/**
 * What happens to the tiling trees when monitors are added or removed.
 *
 * The monitor and workspace ids are generic, so that tests can use plain numbers.
 */

import type { Rect } from './geom.js';

/** A monitor's area, and the part of it that windows may use */
export interface MonitorInfo<R extends Rect> {
    area: R;
    ws: R;
}

/** The part of a tiling tree that monitor changes need */
export interface Tree<Monitor> {
    monitor: Monitor;
}

/** Where a tree should be after the monitors changed */
export interface Migration<T extends Tree<Monitor>, Monitor, R extends Rect = Rect> {
    tree: T;
    monitor: Monitor;
    /** The part of `monitor` that windows may use */
    work_area: R;
    /**
     * Whether the tree followed a monitor change and so needs a new workspace.
     * Can be true even if the monitor stayed the same.
     */
    moved: boolean;
}

/**
 * Works out where each monitor's trees should go, from where their windows ended up.
 *
 * Windows that were on the old primary monitor go to the new primary one.
 *
 * @param placements Each window's monitor before and after the change
 */
export function monitor_changes<Monitor>(
    placements: Iterable<[before: Monitor, now: Monitor]>,
    old_primary: Monitor,
    new_primary: Monitor,
): Map<Monitor, Monitor> {
    const changes = new Map<Monitor, Monitor>();

    for (const [before, now] of placements) {
        // When a monitor's windows ended up on different monitors, the last one wins
        changes.set(before, before === old_primary ? new_primary : now);
    }

    return changes;
}

/** The monitors whose trees stay on them */
export function unchanged_monitors<Monitor>(changes: Map<Monitor, Monitor>): Set<Monitor> {
    const unchanged = new Set<Monitor>();

    for (const [before, now] of changes) {
        if (before === now) unchanged.add(now);
    }

    return unchanged;
}

/**
 * Works out which monitor each tree should be on after the monitors changed, and updates
 * `tree.monitor` to match.
 *
 * Trees whose monitor is gone and not replaced are left out.
 */
export function plan_migrations<Monitor, T extends Tree<Monitor>, R extends Rect>(
    trees: Iterable<T>,
    changes: Map<Monitor, Monitor>,
    monitors: Map<Monitor, MonitorInfo<R>>,
): Array<Migration<T, Monitor, R>> {
    const migrations: Array<Migration<T, Monitor, R>> = [];

    for (const tree of trees) {
        const before = tree.monitor;
        // Only one step: `changes` already says where the tree's windows are now
        const now = changes.get(before);
        const target = now === undefined ? undefined : monitors.get(now);
        let migration: Migration<T, Monitor, R> | null = null;

        if (now !== undefined && target) {
            tree.monitor = now;
            migration = { tree, monitor: now, work_area: target.ws, moved: true };
        } else {
            const monitor = monitors.get(before);
            if (monitor) migration = { tree, monitor: before, work_area: monitor.ws, moved: false };
        }

        if (migration) migrations.push(migration);
    }

    return migrations;
}

/**
 * Picks the workspace for a tree that moved to `monitor`.
 *
 * The first tree to arrive gets workspace 0, later ones get an unused workspace.
 *
 * @param claimed Monitors whose workspace 0 is taken; updated by this call
 */
export function workspace_on<Monitor, Workspace>(
    monitor: Monitor,
    claimed: Set<Monitor>,
    unused_workspace: (monitor: Monitor) => Workspace,
): Workspace | 0 {
    if (claimed.has(monitor)) return unused_workspace(monitor);

    claimed.add(monitor);
    return 0;
}
