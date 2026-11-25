import type { Misc } from '@girs/gnome-shell';
import type GObject from 'gi://GObject';

import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import type { Grab, Target } from '../core/grab.js';
import type { EdgeSide } from '../core/movement.js';
import type { Signals } from '../core/signals.js';
import type { Ext } from '../extension.js';
import type { MutterWindow } from './mutter_window.js';

import * as geom from '../core/geom.js';
import { Movement, movement_is_valid } from '../core/movement.js';
import * as Ecs from '../ecs.js';
import * as GrabOp from '../grab_op.js';
import { cursor_rect, is_keyboard_op, is_move_op, is_resize_op } from '../lib.js';
import { Log } from '../log.js';
import * as node from '../node.js';
import * as stack from '../stack.js';

const { overview } = Main;

/** Connects GNOME's grabs of windows to the extension */
export class GnomeGrab {
    /** Information about a current possible grab operation */
    grab_op: GrabOp.GrabOp | null = null;

    private preview_timer: SignalID | null = null;

    constructor(
        private readonly ext: Ext,
        private readonly grab: Grab,
    ) {}

    attach(signals: Signals<GObject.Object | Misc.signals.EventEmitter>) {
        const { ext } = this;
        const display = global.display;

        signals.connect_with(display, () =>
            display.connect('grab-op-begin', (_display, win, op) => {
                this.started(win, op);
            }),
        );

        signals.connect_with(display, () =>
            display.connect('grab-op-end', (_display, win, op) => {
                ext.register_fn(() => this.ended(win, op));
            }),
        );

        signals.connect_with(overview, () =>
            overview.connect('window-drag-begin', (_, win) => {
                this.started(win, 1);
            }),
        );

        signals.connect_with(overview, () =>
            overview.connect('window-drag-end', (_, win) => {
                ext.register_fn(() => this.ended(win));
            }),
        );

        signals.connect_with(overview, () =>
            overview.connect('window-drag-cancelled', () => {
                this.cancel();
            }),
        );
    }

    cancel() {
        const { ext } = this;
        if (this.preview_timer !== null) {
            ext.overlay.visible = false;
            GLib.source_remove(this.preview_timer);
            this.preview_timer = null;
        }

        if (this.grab_op !== null) {
            const window = ext.windows.get(this.grab_op.entity);
            if (window) ext.size_signals_unblock(window);
            this.grab_op = null;
        }
    }

    private ended(meta: Meta.Window, op?: number) {
        const { ext } = this;
        const win = ext.get_window(meta);

        if (win !== null) {
            win.grab = false;
        }

        if (null === win || !win.is_tilable()) {
            this.cancel();
            return;
        }

        this.drop(win, op);
        this.cancel();
    }

    private drop(win: MutterWindow, op?: number) {
        const { ext } = this;
        ext.size_signals_unblock(win);

        if (win.meta.minimized) {
            ext.on_minimize(win);
            return;
        }

        if (win.is_maximized()) {
            return;
        }

        const grab_op = this.grab_op;

        if (ext.gnome_forest && op == undefined) {
            const mon = ext.monitors.get(win.entity);
            if (mon) {
                const rect = win.meta.get_work_area_for_monitor(mon[0]);
                if (rect.contains_rect(cursor_rect())) {
                    ext.gnome_forest.reflow(win.entity);
                } else {
                    ext.gnome_forest.on_drop(win, true);
                }
            }

            return;
        }

        if (!(grab_op && Ecs.entity_eq(grab_op.entity, win.entity))) {
            Log.error(`grabbed entity is not the same as the one that was dropped`);
            return;
        }

        if (ext.gnome_forest) {
            const crect = win.frame();
            const rect = grab_op.rect;
            if (is_move_op(op!)) {
                const cmon = win.monitor_id();
                const prev_mon = ext.monitors.get(win.entity);
                const mon_drop = prev_mon ? prev_mon[0] !== cmon : false;

                ext.monitors.insert(win.entity, [win.monitor_id(), win.workspace_id()]);

                if (rect.x != crect.x || rect.y != crect.y) {
                    if (rect.contains_rect(cursor_rect())) {
                        if (ext.gnome_forest.attached.contains(win.entity)) {
                            ext.gnome_forest.on_drop(win, mon_drop);
                        } else {
                            ext.gnome_forest.reflow(win.entity);
                        }
                    } else {
                        ext.gnome_forest.on_drop(win, mon_drop);
                    }
                }
            } else {
                const movement = grab_op.operation(crect);

                // A click on a resize edge can begin and end a grab without
                // changing the window. Do not turn that into a tree resize.
                if (movement === Movement.NONE) return;

                this.resize(win, movement);
            }
        } else if (ext.settings.get_snap_to_grid()) {
            ext.gnome_tiling_mode.snap(win);
        }
    }

    private resize(win: MutterWindow, movement: Movement) {
        const { ext } = this;
        const at = ext.gnome_forest;
        if (!at) return;

        const fork_entity = at.attached.get(win.entity);
        if (!fork_entity) {
            Log.error(`no fork entity found`);
            return;
        }

        const forest = at.forest;
        const fork = forest.forks.get(fork_entity);
        if (!fork) {
            Log.error(`no fork component found`);
            return;
        }

        const crect = win.frame();
        if (win.stack != null) {
            const tab_dimension = ext.sizes.scale * stack.TAB_HEIGHT_UNSCALED;
            crect.height += tab_dimension;
            crect.y -= tab_dimension;
        }

        const top_level = forest.find_toplevel(ext.workspace_id());
        if (top_level) {
            geom.clamp(crect, forest.forks.get(top_level)!.area);
        }

        const neighbour_rect = (side: EdgeSide) => ext.focus_selector.toward(ext, side, win)?.frame() ?? null;
        if (movement_is_valid(movement, win.frame(), neighbour_rect)) {
            forest.resize(ext, fork_entity, fork, win.entity, movement, crect);
            forest.arrange(ext, fork.workspace);
        } else {
            forest.tile(ext, fork, fork.area);
        }
    }

    private started(meta: Meta.Window | null, op: number) {
        if (!meta) return;

        const { ext } = this;
        const win = ext.get_window(meta);
        if (!win) return;

        win.grab = true;
        if (!win.is_tilable()) return;

        this.cancel();

        this.grab_op = new GrabOp.GrabOp(win.entity, win.frame());

        ext.size_signals_block(win);

        if (overview.visible || is_keyboard_op(op) || is_resize_op(op)) return;

        const workspace = ext.active_workspace();
        this.preview_timer = GLib.timeout_add(GLib.PRIORITY_LOW, 200, () => this.preview(win, workspace));
    }

    private preview(win: MutterWindow, workspace: WorkspaceID): boolean {
        const { ext } = this;
        ext.overlay.visible = false;

        const at = ext.gnome_forest;
        if (!at || !this.grab_op || this.grab_op.entity !== win.entity) {
            this.preview_timer = null;
            return GLib.SOURCE_REMOVE;
        }

        const [cursor, monitor] = ext.cursor_status();

        // The tiled window under the pointer, or else the window's sibling in its fork
        let attach_to: MutterWindow | null = null;
        for (const found of ext.windows_at_pointer(cursor, monitor, workspace)) {
            if (found !== win && at.attached.contains(found.entity)) {
                attach_to = found;
                break;
            }
        }

        const fork = at.get_parent_fork(win.entity);
        if (!fork) return GLib.SOURCE_CONTINUE;

        if (attach_to === null) {
            if (fork.left.inner.kind === node.NodeKind.WINDOW && fork.right?.inner.kind === node.NodeKind.WINDOW) {
                const attaching = fork.left.is_window(win.entity) ? fork.right.inner.entity : fork.left.inner.entity;
                attach_to = ext.windows.get(attaching);
            }
        }

        let empty_area = null;
        if (at.largest_on_workspace(monitor, workspace) === null) {
            empty_area = ext.monitor_work_area(monitor);
            empty_area.x += ext.sizes.gap_outer;
            empty_area.y += ext.sizes.gap_outer;
            empty_area.width -= ext.sizes.gap_outer * 2;
            empty_area.height -= ext.sizes.gap_outer * 2;
        }

        const target: Target | null = attach_to && {
            frame: attach_to.meta.get_frame_rect(),
            sibling: at.windows_are_siblings(win.entity, attach_to.entity) !== null,
            fork_area: fork.area,
            in_stack: win.stack !== null,
        };

        const area = this.grab.overlay_for(
            [cursor.x, cursor.y],
            empty_area,
            target,
            ext.settings.get_stacking_with_mouse(),
        );

        if (area) {
            ext.set_overlay(area);
            ext.overlay.visible = true;
        }

        return GLib.SOURCE_CONTINUE;
    }
}
