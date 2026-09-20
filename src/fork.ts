import Clutter from 'gi://Clutter';
import Mtk from 'gi://Mtk';

import type { Forest } from './forest.js';
import type { Entity } from './ecs.js';
import type { Ext } from './extension.js';
import type { Node } from './node.js';

import * as Ecs from './ecs.js';
import * as node from './node.js';
import { ShellWindow } from './window.js';
const { NodeKind } = node;

const XPOS = 'x' as const;
const YPOS = 'y' as const;
const WIDTH = 'width' as const;
const HEIGHT = 'height' as const;

/** A tiling fork contains two children nodes.
 *
 * These nodes may either be windows, or sub-forks.
 */
export class Fork {
    left: Node;
    right: Node | null;
    area: Mtk.Rectangle;
    entity: Entity;
    on_primary_display: boolean;
    workspace: WorkspaceID;
    length_left: number;
    prev_length_left: number;
    prev_ratio: number = 0.5;
    monitor: MonitorID;
    minimum_ratio: number = 0.1;
    orientation;

    orientation_changed: boolean = false;
    is_toplevel: boolean = false;

    smart_gapped: boolean = false;

    /** Tracks toggle count so that we may swap branches when toggled twice */
    private n_toggled: number = 0;

    constructor(
        entity: Entity,
        left: Node,
        right: Node | null,
        area: Mtk.Rectangle,
        workspace: WorkspaceID,
        monitor: MonitorID,
        orientation = Clutter.Orientation.HORIZONTAL,
    ) {
        this.on_primary_display = global.display.get_primary_monitor() === monitor;
        this.area = area;
        this.left = left;
        this.right = right;
        this.workspace = workspace;
        this.length_left = orientation === Clutter.Orientation.HORIZONTAL
            ? this.area.width / 2
            : this.area.height / 2;
        this.prev_length_left = this.length_left;
        this.entity = entity;
        this.orientation = orientation;
        this.monitor = monitor;
    }

    /** The calculated left area of this fork */
    area_of_left(ext: Ext): Mtk.Rectangle {
        let { x, y, width, height } = this.area;
        if (this.is_horizontal()) {
            width = this.length_left - ext.gap_inner_half;
        } else {
            height = this.length_left - ext.gap_inner_half;
        }
        return new Mtk.Rectangle({ x, y, width, height });
    }

    /** The calculated right area of this fork */
    area_of_right(ext: Ext): Mtk.Rectangle {
        let { x, y, width, height } = this.area;
        if (this.is_horizontal()) {
            x = x + this.length_left + ext.gap_inner_half;
            width = width - this.length_left - ext.gap_inner_half;
        } else {
            y = y + this.length_left + ext.gap_inner_half;
            height = height - this.length_left - ext.gap_inner_half;
        }
        return new Mtk.Rectangle({ x, y, width, height });
    }

    depth(): number {
        return this.is_horizontal() ? this.area.height : this.area.width;
    }

    find_branch(entity: Entity): Node | null {
        const locate = (branch: Node): Node | null => {
            switch (branch.inner.kind) {
                case NodeKind.WINDOW:
                    if (Ecs.entity_eq(branch.inner.entity, entity)) {
                        return branch;
                    }

                    break;
                case NodeKind.STACK:
                    for (const e of branch.inner.entities) {
                        if (Ecs.entity_eq(e, entity)) {
                            return branch;
                        }
                    }
            }

            return null;
        };

        const node = locate(this.left);
        if (node) return node;

        return this.right ? locate(this.right) : null;
    }

    /** If this fork has a horizontal orientation */
    is_horizontal(): boolean {
        return this.orientation == Clutter.Orientation.HORIZONTAL;
    }

    length(): number {
        return this.is_horizontal() ? this.area.width : this.area.height;
    }

    /** Replaces the association of a window in a fork with another */
    replace_window(ext: Ext, a: ShellWindow, b: ShellWindow): null | (() => void) {
        let closure = null;

        const check_right = () => {
            if (this.right) {
                const inner = this.right.inner;
                if (inner.kind === NodeKind.WINDOW) {
                    closure = () => {
                        inner.entity = b.entity;
                    };
                } else if (inner.kind === NodeKind.STACK) {
                    const idx = node.stack_find(inner, a.entity);
                    if (idx === null) {
                        closure = null;
                        return;
                    }

                    closure = () => {
                        node.stack_replace(ext, inner, b);
                        inner.entities[idx] = b.entity;
                    };
                }
            }
        };

        switch (this.left.inner.kind) {
            case NodeKind.FORK:
                check_right();
                break;
            case NodeKind.WINDOW:
                const inner = this.left.inner;
                if (Ecs.entity_eq(inner.entity, a.entity)) {
                    closure = () => {
                        inner.entity = b.entity;
                    };
                } else {
                    check_right();
                }

                break;
            case NodeKind.STACK:
                const inner_s = this.left.inner;
                const idx = node.stack_find(inner_s, a.entity);
                if (idx !== null) {
                    const id = idx;
                    closure = () => {
                        node.stack_replace(ext, inner_s, b);
                        inner_s.entities[id] = b.entity;
                    };
                } else {
                    check_right();
                }
        }

        return closure;
    }

    /** Sets a new area for this fork */
    set_area(area: Mtk.Rectangle): Mtk.Rectangle {
        this.area = area;
        return this.area;
    }

    /** Sets the ratio of this fork
     *
     * Ensures that the ratio is never smaller or larger than the constraints.
     */
    set_ratio(left_length: number): Fork {
        const fork_len = this.is_horizontal() ? this.area.width : this.area.height;
        const clamped = Math.round(Math.max(256, Math.min(fork_len - 256, left_length)));
        this.prev_length_left = clamped;
        this.length_left = clamped;
        return this;
    }

    /** Defines this fork as a top level fork, and records it in the forest */
    set_toplevel(tiler: Forest, entity: Entity, string: string, id: MonitorWorkspaceID): Fork {
        this.is_toplevel = true;
        tiler.toplevel.set(string, [entity, id]);
        return this;
    }

    /** Calculates the future arrangement of windows in this fork */
    measure(tiler: Forest, ext: Ext, area: Mtk.Rectangle, record: (win: Entity, parent: Entity, area: Mtk.Rectangle) => void) {
        let ratio = null;

        const manually_moved = ext.grab_op !== null || ext.tiler.resizing_window;

        if (!this.is_toplevel) {
            if (this.orientation_changed) {
                this.orientation_changed = false;
                ratio = this.length_left / this.depth();
            } else {
                ratio = this.length_left / this.length();
            }

            this.area = this.set_area(area.copy());
        } else if (this.orientation_changed) {
            this.orientation_changed = false;
            ratio = this.length_left / this.depth();
        }

        if (ratio != null) {
            this.length_left = Math.round(ratio * this.length());
            if (manually_moved) this.prev_ratio = ratio;
        } else if (manually_moved) {
            this.prev_ratio = this.length_left / this.length();
        }

        if (this.right) {
            const [l, p, startpos] = this.is_horizontal() ? [WIDTH, XPOS, this.area.x] : [HEIGHT, YPOS, this.area.y];

            const region = this.area.copy();

            const half = this.area[l] / 2;

            let length;
            if (this.length_left > half - 32 && this.length_left < half + 32) {
                length = half;
            } else {
                const diff = (startpos + this.length_left) % 32;
                length = this.length_left - diff + (diff > 16 ? 32 : 0);
                if (length == 0) length = 32;
            }

            region[l] = length - ext.gap_inner_half;

            this.left.measure(tiler, ext, this.entity, region, record);

            region[p] = region[p] + length + ext.gap_inner_half;
            region[l] = this.area[l] - length - ext.gap_inner_half;

            this.right.measure(tiler, ext, this.entity, region, record);
        } else {
            this.left.measure(tiler, ext, this.entity, this.area, record);
        }
    }

    migrate(ext: Ext, forest: Forest, area: Mtk.Rectangle, monitor: number, workspace: number) {
        if (ext.auto_tiler && this.is_toplevel) {
            const primary = global.display.get_primary_monitor() === monitor;

            this.monitor = monitor;
            this.workspace = workspace;
            this.on_primary_display = primary;

            const blocked = [];

            forest.toplevel.set(forest.string_reps.get(this.entity) as string, [this.entity, [monitor, workspace]]);

            for (const child of forest.iter(this.entity)) {
                switch (child.inner.kind) {
                    case NodeKind.FORK:
                        const cfork = forest.forks.get(child.inner.entity);
                        if (!cfork) continue;
                        cfork.workspace = workspace;
                        cfork.monitor = monitor;
                        cfork.on_primary_display = primary;
                        break;
                    case NodeKind.WINDOW:
                        const window = ext.windows.get(child.inner.entity);
                        if (window) {
                            ext.size_signals_block(window);
                            window.reassignment = false;
                            window.known_workspace = workspace;
                            window.meta.change_workspace_by_index(workspace, true);
                            ext.monitors.insert(window.entity, [monitor, workspace]);
                            blocked.push(window);
                        }
                        break;
                    case NodeKind.STACK:
                        for (const entity of child.inner.entities) {
                            const stack = ext.auto_tiler.forest.stacks.get(child.inner.idx);
                            if (stack) {
                                stack.workspace = workspace;
                            }

                            const window = ext.windows.get(entity);

                            if (window) {
                                ext.size_signals_block(window);
                                window.known_workspace = workspace;
                                window.meta.change_workspace_by_index(workspace, true);
                                ext.monitors.insert(window.entity, [monitor, workspace]);
                                blocked.push(window);
                            }
                        }
                }
            }

            area.x += ext.gap_outer;
            area.y += ext.gap_outer;
            area.width -= ext.gap_outer * 2;
            area.height -= ext.gap_outer * 2;

            this.set_area(area.copy());
            this.measure(forest, ext, area, forest.on_record());
            forest.arrange(ext, workspace, true);

            for (const window of blocked) {
                ext.size_signals_unblock(window);
            }
        }
    }

    rebalance_orientation() {
        this.set_orientation(
            this.area.height > this.area.width ? Clutter.Orientation.VERTICAL : Clutter.Orientation.HORIZONTAL,
        );
    }

    set_orientation(o: Clutter.Orientation) {
        if (o !== this.orientation) {
            this.orientation = o;
            this.orientation_changed = true;
        }
    }

    /** Swaps the left branch with the right branch, if there is a right branch */
    swap_branches() {
        if (this.right) {
            const temp = this.left;
            this.left = this.right;
            this.right = temp;
        }
    }

    /** Toggles the orientation of this fork */
    toggle_orientation() {
        this.orientation = this.orientation === Clutter.Orientation.HORIZONTAL
            ? Clutter.Orientation.VERTICAL
            : Clutter.Orientation.HORIZONTAL;

        this.orientation_changed = true;
        if (this.n_toggled === 1) {
            if (this.right) {
                const tmp = this.right;
                this.right = this.left;
                this.left = tmp;
            }
            this.n_toggled = 0;
        } else {
            this.n_toggled += 1;
        }
    }
}
