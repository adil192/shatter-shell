import { Extension, InjectionManager } from 'resource:///org/gnome/shell/extensions/extension.js';

import type { Entity } from './ecs.js';
import type { ExtEvent } from './events.js';
import type { GnomeForest } from './gnome/gnome_forest.js';
import type { Indicator } from './panel_settings.js';

import * as Config from './config.js';
import * as movement from './core/movement.js';
import { type EdgeSide, movement_is_valid } from './core/movement.js';
import * as Ecs from './ecs.js';
import * as Events from './events.js';
import * as Executor from './executor.js';
import * as exec from './executor.js';
import * as Focus from './focus.js';
import { Fork } from './fork.js';
import { GnomeSizes } from './gnome/gnome_sizes.js';
import { GnomeTilingMode } from './gnome/gnome_tiling_mode.js';
import * as GrabOp from './grab_op.js';
import * as Keybindings from './keybindings.js';
import * as Lib from './lib.js';
import * as node from './node.js';
import * as PanelSettings from './panel_settings.js';
import * as Settings from './settings.js';
import * as stack from './stack.js';
import * as utils from './utils.js';
import * as Window from './window.js';

const display = global.display;
const wim = global.window_manager;
const wom = global.workspace_manager;

const Movement = movement.Movement;

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';
import Shell from 'gi://Shell';
import St from 'gi://St';
const { GlobalEvent, WindowEventType } = Events;
const { cursor_rect, is_keyboard_op, is_resize_op, is_move_op } = Lib;
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
const { layoutManager, modalActorFocusStack, overview, panel, screenShield } = Main;
import type { Misc } from '@girs/gnome-shell';

import { ScreenShield } from 'resource:///org/gnome/shell/ui/screenShield.js';

import { FocusHistory } from './core/focus_history.js';
import * as geom from './core/geom.js';
import { LayoutSizes } from './core/layout_sizes.js';
import {
    type Migration as MonitorMigration,
    type MonitorInfo,
    lowest_unused_workspace,
    monitor_changes,
    plan_migrations,
    unchanged_monitors,
    workspace_on,
} from './core/monitor_changes.js';
import { Signals } from './core/signals.js';
import { GnomeAutoTiling } from './gnome/gnome_auto_tiling.js';
import { GnomeExceptions } from './gnome/gnome_exceptions.js';
import { GnomeTheme } from './gnome/gnome_theme.js';
import { Log } from './log.js';
import { get_current_path } from './paths.js';
import { Tags } from './tags.js';
import { WindowAnimationController } from './window_animation_controller.js';
const { monitorID, workspaceID } = Lib;

const sessionMode = Main.sessionMode as typeof Main.sessionMode & { isLocked?: boolean };

export class Ext extends Ecs.System<ExtEvent> {
    extension: ShatterShellExtension | null;

    /** Mechanism for managing keybindings */
    keybindings: Keybindings.Keybindings = new Keybindings.Keybindings(this);

    /** Manage interactions with GSettings */
    settings: Settings.ExtensionSettings = new Settings.ExtensionSettings();

    // Widgets

    /** An overlay which shows a preview of where a window will be moved */
    overlay = new St.BoxLayout({ style_class: 'shatter-shell-overlay', visible: false });

    // State

    readonly conf: Config.Config;

    /** Loads the extension's stylesheet that goes with GNOME's color scheme */
    readonly gnome_theme = new GnomeTheme(this.settings, func => this.register_fn(func));

    /** Set when the display configuration has been triggered for execution */
    displays_updating: SignalID | null = null;

    /** The known display configuration, for tracking monitor removals and changes */
    displays: [primaryMonitor: MonitorID, monitors: Map<MonitorID, MonitorInfo<Mtk.Rectangle>>] = [
        monitorID(global.display.get_primary_monitor()),
        new Map<MonitorID, MonitorInfo<Mtk.Rectangle>>(),
    ];

    /** The sizes in pixels that the layout uses: the gaps, the snap-to-grid cells, and the scale factor */
    readonly sizes = new LayoutSizes(St.ThemeContext.get_for_stage(global.stage).scale_factor);

    drag_signal: SignalID | null = null;

    /** Opens the floating exceptions, and applies them to the windows */
    readonly gnome_exceptions: GnomeExceptions;

    /** Information about a current possible grab operation */
    grab_op: GrabOp.GrabOp | null = null;

    readonly gnome_sizes = new GnomeSizes(this);

    /** A display config update is triggered on a workspace addition */
    ignore_display_update: boolean = false;

    /** Functions replaced in GNOME */
    private readonly injections = new InjectionManager();

    /** Misc GLib timeouts that will need to be removed when the extension is `disable`d. */
    readonly timeouts = new Set<number>();

    /** Which windows were focused most recently, overall and on each workspace */
    readonly focus_history = new FocusHistory<Entity, WorkspaceID>(Ecs.entity_eq);

    /** Initially set to true when the extension is initializing */
    init: boolean = true;

    was_locked: boolean = false;

    /** Set when a window is being moved by the mouse */
    moved_by_mouse: boolean = false;

    private workareas_update: SignalID | null = null;

    /** The signals connected to global objects, which are disconnected when the extension is disabled. */
    readonly signals = new Signals<GObject.Object | Misc.signals.EventEmitter>();

    private size_requests: Map<GObject.Object, SignalID> = new Map();

    readonly window_animations = new WindowAnimationController(this.signals);

    // Entity-component associations

    /** Store for stable sequences of each registered window */
    ids: Ecs.Storage<number> = this.register_storage();

    /** Store for keeping track of which monitor + workspace a window is on */
    monitors: Ecs.Storage<MonitorWorkspaceID> = this.register_storage();

    /** Stores movements that have been queued */
    movements: Ecs.Storage<Mtk.Rectangle> = this.register_storage();

    /** Store for names associated with windows */
    names: Ecs.Storage<string> = this.register_storage();

    /** Set to true if a window is snapped to the grid */
    snapped: Ecs.Storage<boolean> = this.register_storage();

    /** Primary storage for the window entities, containing the actual window */
    windows: Ecs.Storage<Window.ShellWindow> = this.register_storage();

    /** Signals which have been registered for each window */
    window_signals: Ecs.Storage<Array<SignalID>> = this.register_storage();
    /** Signals which have been registered for each tilable window, a subset of {@link window_signals}. */
    tilable_window_signals: Ecs.Storage<Array<SignalID>> = this.register_storage();

    // Systems

    /** Manages automatic tiling behaviors in the shell */
    gnome_forest: GnomeForest | null = null;

    /** Switches auto-tiling on and off */
    readonly gnome_auto_tiling = new GnomeAutoTiling(this.settings, this);

    /** Performs focus selections */
    focus_selector: Focus.FocusSelector = new Focus.FocusSelector();

    /** Calculates window placements when tiling and focus-switching */
    readonly gnome_tiling_mode = new GnomeTilingMode(this);

    constructor(extension: ShatterShellExtension, conf: Config.Config) {
        super(new Executor.GLibExecutor());
        this.extension = extension;

        this.load_settings();

        this.conf = conf;
        this.gnome_exceptions = new GnomeExceptions(conf, this);
    }

    // System interface

    /** Registers a generic callback to be executed in the event loop. */
    register_fn(callback: () => void, name?: string) {
        this.register({ tag: 'callback', callback, name });
    }

    /** Executes an event on the system */
    override run(event: ExtEvent) {
        switch (event.tag) {
            case 'callback':
                event.callback();
                break;

            case 'window_move': {
                const window = event.window;

                /** Validate that the window's actor still exists. */
                if (!window.actor_exists()) return;

                const movement = this.movements.remove(window.entity);
                if (!movement) return;

                const actor = window.meta.get_compositor_private<Meta.WindowActor | null>();
                if (!actor) {
                    this.gnome_forest?.detach_window(window.entity);
                    return;
                }

                if (window.shouldnt_animate_next_movement) {
                    this.window_animations.stop(actor);
                    window.maybe_animate_next_movement();
                } else if (!this.settings.get_animate_windows()) {
                    this.window_animations.stop(actor);
                } else {
                    this.window_animations.start(window, actor, movement);
                }

                window.meta.move_resize_frame(false, movement.x, movement.y, movement.width, movement.height);

                this.monitors.insert(window.entity, [window.monitor_id(), window.workspace_id()]);

                if (window.activate_after_move) {
                    window.activate_after_move = false;
                    window.request_activate();
                }
                break;
            }

            case 'window_event':
                const win = event.window;

                /** Validate that the window's actor still exists. */
                if (!win.actor_exists()) return;

                switch (event.event) {
                    case WindowEventType.Maximize:
                        this.unset_grab_op();
                        this.on_maximize(win);
                        break;

                    case WindowEventType.Minimize:
                        this.unset_grab_op();
                        this.on_minimize(win);
                        break;

                    case WindowEventType.Size:
                        if (this.gnome_forest && !win.is_maximized() && !win.meta.is_fullscreen()) {
                            this.gnome_forest.reflow(win.entity);
                        }
                        break;

                    case WindowEventType.Workspace:
                        this.on_workspace_changed(win);
                        break;

                    case WindowEventType.Fullscreen:
                        if (this.gnome_forest) {
                            const attachment = this.gnome_forest.attached.get(win.entity);
                            if (attachment) {
                                if (!win.meta.is_fullscreen()) {
                                    const fork = this.gnome_forest.forest.forks.get(win.entity);
                                    if (fork) {
                                        this.gnome_forest.reflow(win.entity);
                                    }
                                    if (win.stack !== null) {
                                        this.gnome_forest.forest.stacks.get(win.stack)?.set_visible(true);
                                    }
                                } else {
                                    // not full screened
                                    if (win.stack !== null) {
                                        this.gnome_forest.forest.stacks.get(win.stack)?.set_visible(false);
                                    }
                                }
                            }
                        }

                        break;
                }

                break;

            /** Window Create Event */
            case 'window_create':
                const actor = event.window.get_compositor_private<Meta.WindowActor | null>();
                if (!actor) return;

                this.on_window_create(event.window, actor, event.is_new_window);
                break;

            /** Stateless global events */
            case 'global':
                switch (event.event) {
                    case GlobalEvent.MonitorsChanged:
                        this.update_display_configuration(false);
                        break;

                    case GlobalEvent.OverviewShown:
                        this.on_overview_shown();
                        break;
                }

                break;
        }
    }

    // Extension methods

    active_monitor(): MonitorID {
        return monitorID(display.get_current_monitor());
    }

    active_window_list(): Array<Window.ShellWindow> {
        const workspace = wom.get_active_workspace();
        return this.tab_list(Meta.TabList.NORMAL_ALL, workspace);
    }

    active_workspace(): WorkspaceID {
        const id = wom.get_active_workspace_index();
        return workspaceID(id);
    }

    /** Connects to a window signal and records it in {@link window_signals} and {@link tilable_window_signals}. */
    connect_meta(win: Window.ShellWindow, signal: keyof Meta.Window.SignalSignatures, callback: () => void): number {
        const id = win.meta.connect(signal, () => {
            if (win.actor_exists()) callback();
        });

        this.window_signals.get_or(win.entity, () => []).push(id);
        this.tilable_window_signals.get_or(win.entity, () => []).push(id);

        return id;
    }

    /**
     * Connects an event that only calls `func` if the window does not have {@link Tags.Blocked}.
     *
     * See also {@link size_signals_block} and {@link size_signals_unblock}.
     */
    connect_size_signal(win: Window.ShellWindow, signal: keyof Meta.Window.SignalSignatures, func: () => void): number {
        return this.connect_meta(win, signal, () => {
            if (!this.contains_tag(win.entity, Tags.Blocked)) func();
        });
    }

    connect_tilable_window_signals(win: Window.ShellWindow) {
        const debounce_size_event = () => {
            const old = this.size_requests.get(win.meta) ?? 0;
            if (old) {
                GLib.source_remove(old);
            }

            const new_s = GLib.timeout_add(GLib.PRIORITY_LOW, 150, () => {
                this.register(Events.window_event(win, WindowEventType.Size));
                this.size_requests.delete(win.meta);
                return GLib.SOURCE_REMOVE;
            });
            this.size_requests.set(win.meta, new_s);
        };

        this.connect_meta(win, 'workspace-changed', () => {
            this.register(Events.window_event(win, WindowEventType.Workspace));
        });
        this.connect_meta(win, 'notify::main-monitor', () => {
            this.register(Events.window_event(win, WindowEventType.Workspace));
        });

        this.connect_size_signal(win, 'size-changed', debounce_size_event);
        this.connect_size_signal(win, 'position-changed', debounce_size_event);

        this.connect_size_signal(win, 'notify::minimized', () => {
            this.register(Events.window_event(win, WindowEventType.Minimize));
        });
    }

    disconnect_tilable_window_signals(win: Window.ShellWindow) {
        this.tilable_window_signals.take_with(win.entity, signals => {
            const window_signals = this.window_signals.get(win.entity);

            for (const signal of signals) {
                win.meta.disconnect(signal);

                const i = window_signals?.indexOf(signal) ?? -1;
                if (i !== -1) {
                    window_signals!.splice(i, 1);
                }
            }
        });
    }

    exit_modes() {
        this.gnome_tiling_mode.exit();
        this.overlay.visible = false;
    }

    find_unused_workspace(monitor: MonitorID): [WorkspaceID, Meta.Workspace | null] {
        if (!this.gnome_forest) return [0, wom.get_workspace_by_index(0)];

        // Workspaces used by the monitor's tiled windows that aren't being moved
        const occupied: WorkspaceID[] = [];
        for (const [entity] of this.gnome_forest.attached.iter()) {
            if (!this.gnome_forest.attached.contains(entity)) continue;

            const win = this.windows.get(entity);

            if (win && !win.reassignment && win.monitor_id() === monitor) occupied.push(win.workspace_id());
        }

        let id = lowest_unused_workspace(occupied);

        let new_work: Meta.Workspace | null;
        if (id + 1 >= wom.get_n_workspaces()) {
            id = wom.get_n_workspaces();
            new_work = wom.append_new_workspace(true, global.get_current_time());
        } else {
            new_work = wom.get_workspace_by_index(id);
        }

        return [workspaceID(id), new_work];
    }

    focus_left() {
        this.stack_select(
            (id, stack) => (id === 0 ? null : stack.tabs[id - 1]?.entity),
            () => this.focus_selector.left(this, null)?.request_activate(),
        );
    }

    focus_right() {
        this.stack_select(
            (id, stack) => (stack.tabs.length > id + 1 ? stack.tabs[id + 1]?.entity : null),
            () => this.focus_selector.right(this, null)?.request_activate(),
        );
    }

    focus_down() {
        this.focus_selector.down(this, null)?.request_activate();
    }

    focus_up() {
        this.focus_selector.up(this, null)?.request_activate();
    }

    get_focused_window(): Window.ShellWindow | null {
        const meta = display.get_focus_window() as Meta.Window | null;
        return meta ? this.get_window(meta) : null;
    }

    stack_select(select: (id: number, stack: stack.Stack) => Entity | null | undefined, focus_shift: () => void) {
        const switched = this.stack_switch(stack => {
            const stack_con = this.gnome_forest?.forest.stacks.get(stack.idx);
            if (stack_con) {
                const id = stack_con.active_id;
                if (id !== -1) {
                    const next = select(id, stack_con);
                    if (next) {
                        stack_con.activate(next);
                        const window = this.windows.get(next);
                        if (window) {
                            window.request_activate();
                            return true;
                        }
                    }
                }
            }

            return false;
        });

        if (!switched) {
            focus_shift();
        }
    }

    stack_switch(apply: (stack: node.NodeStack) => boolean): boolean {
        if (!this.gnome_forest) return false;

        const window = this.get_focused_window();
        if (!window) return false;

        const node = this.gnome_forest.find_stack(window.entity);
        return node ? apply(node[1].inner) : false;
    }

    /** Fetches the window component from the entity associated with the metacity window metadata. */
    private get_window(meta: Meta.Window): Window.ShellWindow | null {
        const entity = this.window_entity(meta);
        return entity ? this.windows.get(entity) : null;
    }

    injections_add() {
        this.injections.overrideMethod(ScreenShield.prototype, 'deactivate', originalMethod => {
            return (animate: boolean) => {
                originalMethod.call(screenShield, animate);
                this.update_display_configuration(true);
            };
        });
    }

    injections_remove() {
        this.injections.clear();
    }

    load_settings() {
        this.sizes.set_gap_inner(this.settings.get_gap_inner());
        this.sizes.set_gap_outer(this.settings.get_gap_outer());
        this.sizes.set_column_size(this.settings.get_column_size());
        this.sizes.set_row_size(this.settings.get_row_size());
    }

    monitor_work_area(monitor: MonitorID): Mtk.Rectangle {
        return wom.get_active_workspace().get_work_area_for_monitor(monitor);
    }

    on_active_workspace_changed() {
        this.register_fn(() => {
            this.exit_modes();
            this.restack();

            const activate_window = (window: Window.ShellWindow) => {
                this.on_focused(window);
                window.request_activate(true);
                this.focus_history.restart_from(window.entity);
            };

            const focused = this.get_focused_window();
            if (focused && focused.same_workspace()) {
                activate_window(focused);
                return;
            }

            // Activate the last-active window on workspace.
            const workspace_id = this.active_workspace();
            const active = this.focus_history.last_on(workspace_id);
            if (active) {
                const window = this.windows.get(active);
                if (window && window.workspace_id() == workspace_id && !window.meta.minimized) {
                    activate_window(window);
                    return;
                }
            }

            // If window was not found, activate the first window on workspace.
            const workspace = wom.get_workspace_by_index(workspace_id);
            if (workspace) {
                for (const win of workspace.list_windows()) {
                    const window = this.get_window(win);
                    if (window && !window.meta.minimized) {
                        activate_window(window);
                        return;
                    }
                }
            }
        });
    }

    on_destroy(win: Entity) {
        // Exit tiling adjustment mode on window destroy.
        if (this.gnome_tiling_mode.window !== null && win == this.gnome_tiling_mode.window)
            this.gnome_tiling_mode.exit();

        this.focus_history.forget(win);

        const window = this.windows.get(win);
        if (!window) return;

        const stack = window.stack;

        window.destroying = true;

        // Disconnect all signals on this window
        this.window_signals.take_with(win, signals => {
            for (const signal of signals) {
                window.meta.disconnect(signal);
            }
        });

        if (this.gnome_forest) {
            const entity = this.gnome_forest.attached.get(win);
            if (entity) {
                const fork = this.gnome_forest.forest.forks.get(entity);
                if (fork?.right && fork.right.is_window(win)) {
                    const entity =
                        fork.right.inner.kind === node.NodeKind.STACK
                            ? fork.right.inner.entities[0]!
                            : fork.right.inner.entity;

                    this.windows.with(entity, sibling => sibling.request_activate());
                }
            }
        }

        const stack_node = this.gnome_forest?.find_stack(win)?.[1].inner;

        if (this.gnome_forest) this.gnome_forest.detach_window(win);

        // If destroyed window belonged to a stack, ensure that the next window
        // to be focused is also a window in the same stack
        if (this.gnome_forest && stack !== null) {
            const stack_object = this.gnome_forest.forest.stacks.get(stack);
            const prev = this.focus_history.current;
            if (stack_object && prev) {
                const prev_window = this.windows.get(prev);
                if (prev_window) {
                    if (prev_window.stack !== stack) {
                        stack_object.auto_activate();
                        this.focus_history.restart_from(stack_object.active);
                        this.windows.get(stack_object.active)?.request_activate();
                    }
                }
            } else if (
                !stack_object
                && prev
                && this.windows.contains(prev)
                && stack_node?.kind === node.NodeKind.STACK
            ) {
                // The stack dissolved, leaving just this window
                const remaining = stack_node.entities[0];
                if (remaining && !Ecs.entity_eq(remaining, win) && !Ecs.entity_eq(remaining, prev)) {
                    this.focus_history.restart_from(remaining);
                    this.windows.get(remaining)?.request_activate();
                }
            }
        }

        this.movements.remove(win);
        this.windows.remove(win);
        this.delete_entity(win);
    }

    /** Triggered when a window has been focused */
    on_focused(win: Window.ShellWindow) {
        // Track history of focused windows, but do not permit duplicates.
        this.focus_history.focused(win.entity, this.active_workspace());

        this.size_signals_unblock(win);

        if (this.gnome_exceptions.picking) {
            this.gnome_exceptions.add(win);
        }

        // Update the active tab in the stack.
        if (null !== this.gnome_forest && null !== win.stack) {
            ext?.gnome_forest?.forest.stacks.get(win.stack)?.activate(win.entity);
        }

        this.unmaximize_workspace(win);

        this.show_border_on_focused();

        const previous = this.focus_history.previous;
        if (this.gnome_forest && win.is_tilable() && previous !== null) {
            const prev = this.windows.get(previous);
            const is_attached = this.gnome_forest.attached.contains(previous);

            if (
                prev
                && prev !== win
                && is_attached
                && prev.actor_exists()
                && prev.name() !== win.name()
                && prev.workspace_id() === win.workspace_id()
            ) {
                if (prev.rect().contains_rect(win.rect())) {
                    if (prev.is_maximized()) {
                        prev.meta.unmaximize();
                    }
                } else if (prev.stack != null) {
                    prev.meta.unmaximize();
                    this.gnome_forest.forest.stacks.get(prev.stack)?.restack();
                }
            }
        }

        if (this.conf.log_on_focus) {
            let msg =
                `focused Window(${win.entity}) {\n`
                + `  class: "${win.meta.get_wm_class()}",\n`
                + `  monitor: ${win.monitor_id()},\n`
                + `  name: ${win.name()},\n`
                + `  rect: ${geom.fmt(win.rect())},\n`
                + `  workspace: ${win.workspace_id()},\n`
                + `  stack: ${win.stack},\n`;

            if (this.gnome_forest) {
                msg += `  fork: (${this.gnome_forest.attached.get(win.entity)}),\n`;
            }

            Log.debug(msg + '}');
        }
    }

    on_tile_attach(entity: Entity, window: Entity) {
        if (this.gnome_forest) {
            if (!this.gnome_forest.attached.contains(window)) {
                this.windows.with(window, w => {
                    if (w.prev_rect === null) {
                        w.prev_rect = w.meta.get_frame_rect();
                    }
                });
            }

            this.gnome_forest.attached.insert(window, entity);
        }
    }

    on_tile_detach(win: Entity) {
        if (!this.settings.get_untile_reset_windows()) return;
        this.windows.with(win, window => {
            if (window.prev_rect && !window.ignore_detach) {
                this.register(Events.window_move(this, window, window.prev_rect));
                window.prev_rect = null;
            }
        });
    }

    show_border_on_focused() {
        const focus = this.get_focused_window();
        for (const win of this.windows.values()) {
            if (win != focus) win.hide_border();
        }
        if (focus) focus.show_border();
    }

    hide_all_borders() {
        for (const win of this.windows.values()) {
            win.hide_border();
        }
    }

    maximized_on_active_display(): boolean {
        const aws = this.workspace_id();
        for (const window of this.windows.values()) {
            if (!window.actor_exists()) continue;

            const wws = this.workspace_id(window);
            if (aws[0] === wws[0] && aws[1] === wws[1]) {
                if (window.is_maximized()) return true;
            }
        }

        return false;
    }

    /** Unmaximize any maximized windows on the same workspace. */
    unmaximize_workspace(win: Window.ShellWindow) {
        if (this.gnome_forest) {
            if (!win.is_tilable()) {
                return;
            }

            const mon = win.monitor_id();
            const work = win.workspace_id();

            for (const [, compare] of this.windows.iter()) {
                const is_same_space = compare.monitor_id() === mon && compare.workspace_id() === work;

                if (
                    is_same_space
                    && !this.contains_tag(compare.entity, Tags.Floating)
                    && compare.is_maximized()
                    && win.entity[0] !== compare.entity[0]
                ) {
                    compare.meta.unmaximize();
                }
            }
        }
    }

    /** Triggered when a grab operation has been ended */
    on_grab_end(meta: Meta.Window, op?: number) {
        const win = this.get_window(meta);

        if (win !== null) {
            win.grab = false;
        }

        if (null === win || !win.is_tilable()) {
            this.unset_grab_op();
            return;
        }

        this.on_grab_end_(win, op);
        this.unset_grab_op();
    }

    on_grab_end_(win: Window.ShellWindow, op?: number) {
        this.moved_by_mouse = true;
        this.size_signals_unblock(win);

        if (win.meta.minimized) {
            this.on_minimize(win);
            return;
        }

        if (win.is_maximized()) {
            return;
        }

        const grab_op = this.grab_op;

        if (this.gnome_forest && op == undefined) {
            const mon = this.monitors.get(win.entity);
            if (mon) {
                const rect = win.meta.get_work_area_for_monitor(mon[0]);
                if (rect.contains_rect(cursor_rect())) {
                    this.gnome_forest.reflow(win.entity);
                } else {
                    this.gnome_forest.on_drop(win, true);
                }
            }

            return;
        }

        if (!(grab_op && Ecs.entity_eq(grab_op.entity, win.entity))) {
            Log.error(`grabbed entity is not the same as the one that was dropped`);
            return;
        }

        if (this.gnome_forest) {
            const crect = win.rect();
            const rect = grab_op.rect;
            if (is_move_op(op!)) {
                const cmon = win.monitor_id();
                const prev_mon = this.monitors.get(win.entity);
                const mon_drop = prev_mon ? prev_mon[0] !== cmon : false;

                this.monitors.insert(win.entity, [win.monitor_id(), win.workspace_id()]);

                if (rect.x != crect.x || rect.y != crect.y) {
                    if (rect.contains_rect(cursor_rect())) {
                        if (this.gnome_forest.attached.contains(win.entity)) {
                            this.gnome_forest.on_drop(win, mon_drop);
                        } else {
                            this.gnome_forest.reflow(win.entity);
                        }
                    } else {
                        this.gnome_forest.on_drop(win, mon_drop);
                    }
                }
            } else {
                const fork_entity = this.gnome_forest.attached.get(win.entity);
                if (fork_entity) {
                    const forest = this.gnome_forest.forest;
                    const fork = forest.forks.get(fork_entity);
                    if (fork) {
                        const movement = grab_op.operation(crect);

                        // A click on a resize edge can begin and end a grab without
                        // changing the window. Do not turn that into a tree resize.
                        if (movement === Movement.NONE) return;

                        if (win.stack != null) {
                            const tab_dimension = this.sizes.scale * stack.TAB_HEIGHT_UNSCALED;
                            crect.height += tab_dimension;
                            crect.y -= tab_dimension;
                        }

                        const top_level = forest.find_toplevel(this.workspace_id());
                        if (top_level) {
                            geom.clamp(crect, forest.forks.get(top_level)!.area);
                        }

                        const neighbour_rect = (side: EdgeSide) =>
                            this.focus_selector.toward(this, side, win)?.rect() ?? null;
                        if (movement_is_valid(movement, win.rect(), neighbour_rect)) {
                            forest.resize(this, fork_entity, fork, win.entity, movement, crect);
                            forest.arrange(this, fork.workspace);
                        } else {
                            forest.tile(this, fork, fork.area);
                        }
                    } else {
                        Log.error(`no fork component found`);
                    }
                } else {
                    Log.error(`no fork entity found`);
                }
            }
        } else if (this.settings.get_snap_to_grid()) {
            this.gnome_tiling_mode.snap(win);
        }
    }

    /** Triggered when a grab operation has been started */
    on_grab_start(meta: Meta.Window | null, op: number) {
        if (!meta) return;
        const win = this.get_window(meta);
        if (win) {
            win.grab = true;

            if (win.is_tilable()) {
                const entity = win.entity;
                const rect = win.rect();

                this.unset_grab_op();

                this.grab_op = new GrabOp.GrabOp(entity, rect);

                this.size_signals_block(win);

                /** Display an overlay indicating where the window will be placed if dropped */

                if (overview.visible || is_keyboard_op(op) || is_resize_op(op)) return;

                const workspace = this.active_workspace();

                this.drag_signal = GLib.timeout_add(GLib.PRIORITY_LOW, 200, () => {
                    this.overlay.visible = false;

                    if (!this.gnome_forest || !this.grab_op || this.grab_op.entity !== entity) {
                        this.drag_signal = null;
                        return GLib.SOURCE_REMOVE;
                    }

                    const [cursor, monitor] = this.cursor_status();

                    let attach_to = null;
                    for (const found of this.windows_at_pointer(cursor, monitor, workspace)) {
                        if (found != win && this.gnome_forest.attached.contains(found.entity)) {
                            attach_to = found;
                            break;
                        }
                    }

                    const fork = this.gnome_forest.get_parent_fork(entity);
                    if (!fork) return GLib.SOURCE_CONTINUE;

                    const windowless = this.gnome_forest.largest_on_workspace(monitor, workspace) === null;

                    if (attach_to === null) {
                        if (
                            fork.left.inner.kind === node.NodeKind.WINDOW
                            && fork.right?.inner.kind === node.NodeKind.WINDOW
                        ) {
                            const attaching = fork.left.is_window(entity)
                                ? fork.right.inner.entity
                                : fork.left.inner.entity;

                            attach_to = this.windows.get(attaching);
                        }
                    }

                    let area, monitor_attachment;

                    if (windowless) {
                        [area, monitor_attachment] = [this.monitor_work_area(monitor), true];
                        area.x += this.sizes.gap_outer;
                        area.y += this.sizes.gap_outer;
                        area.width -= this.sizes.gap_outer * 2;
                        area.height -= this.sizes.gap_outer * 2;
                    } else if (attach_to) {
                        const is_sibling = this.gnome_forest.windows_are_siblings(entity, attach_to.entity);

                        [area, monitor_attachment] =
                            (win.stack === null && attach_to.stack === null && is_sibling)
                            || (win.stack === null && is_sibling)
                                ? [fork.area, false]
                                : [attach_to.meta.get_frame_rect(), false];
                    } else {
                        return GLib.SOURCE_CONTINUE;
                    }

                    // A window dropped on a monitor takes all of it
                    let side = geom.Side.CENTER;
                    if (!monitor_attachment) {
                        const stacking_with_mouse = this.settings.get_stacking_with_mouse();
                        side = geom.nearest_side([cursor.x, cursor.y], area, stacking_with_mouse).side;
                    }

                    this.set_overlay(geom.overlay_area(area, side));
                    this.overlay.visible = true;

                    return GLib.SOURCE_CONTINUE;
                });
            }
        }
    }

    /** Handle window maximization notifications */
    on_maximize(win: Window.ShellWindow) {
        if (win.is_maximized()) {
            // Raise maximized to top so stacks won't appear over them.
            const actor = win.meta.get_compositor_private<Meta.WindowActor | null>();
            if (actor) global.window_group.set_child_above_sibling(actor, null);

            this.on_monitor_changed(win, (_cfrom, cto, workspace) => {
                win.ignore_detach = true;
                this.monitors.insert(win.entity, [cto, workspace]);
                this.gnome_forest?.detach_window(win.entity);
            });
        } else {
            // Retile on unmaximize after waiting for other events to complete, such as animations
            this.register_fn(() => {
                if (this.gnome_forest) {
                    const fork_ent = this.gnome_forest.attached.get(win.entity);
                    if (fork_ent) {
                        const fork = this.gnome_forest.forest.forks.get(fork_ent);
                        if (fork) this.gnome_forest.tile(fork, fork.area);
                    }
                }
            });
        }
    }

    /** Handle window minimization notifications */
    on_minimize(win: Window.ShellWindow) {
        if (this.get_focused_window() == win && this.settings.get_active_hint()) {
            if (win.meta.minimized) {
                win.hide_border();
            } else {
                this.show_border_on_focused();
            }
        }

        if (this.gnome_forest) {
            if (win.meta.minimized) {
                const attached = this.gnome_forest.attached.get(win.entity);
                if (!attached) return;

                const fork = this.gnome_forest.forest.forks.get(attached);
                if (!fork) return;

                let attachment: boolean | number;
                if (win.stack !== null) {
                    attachment = win.stack;
                } else {
                    attachment = fork.left.is_window(win.entity);
                }

                win.was_attached_to = [attached, attachment];
                this.gnome_forest.detach_window(win.entity);
            } else if (!this.contains_tag(win.entity, Tags.Floating)) {
                if (win.was_attached_to) {
                    const [entity, attachment] = win.was_attached_to;
                    delete win.was_attached_to;

                    const gnome_forest = this.gnome_forest;

                    const fork = gnome_forest.forest.forks.get(entity);
                    if (fork) {
                        if (typeof attachment === 'boolean') {
                            gnome_forest.forest.attach_fork(this, fork, win.entity, attachment);
                            gnome_forest.tile(fork, fork.area);
                            return;
                        } else {
                            const stack = gnome_forest.forest.stacks.get(attachment);
                            if (stack) {
                                const stack_info = gnome_forest.find_stack(stack.active);
                                if (stack_info) {
                                    const node: node.NodeStack = stack_info[1].inner;

                                    win.stack = attachment;
                                    node.entities.push(win.entity);
                                    gnome_forest.update_stack(node);
                                    gnome_forest.forest.on_attach(fork.entity, win.entity);
                                    stack.activate(win.entity);
                                    gnome_forest.tile(fork, fork.area);
                                    return;
                                }
                            }
                        }
                    }
                }

                this.gnome_forest.auto_tile(win, false);
            }
        }
    }

    /** Handles the event of a window moving from one monitor to another. */
    on_monitor_changed(
        win: Window.ShellWindow,
        func: (exp_mon: MonitorID | null, act_mon: MonitorID, act_work: WorkspaceID) => void,
    ) {
        const actual_monitor = win.monitor_id();
        const actual_workspace = win.workspace_id();
        const monitor = this.monitors.get(win.entity);

        if (monitor) {
            const [expected_monitor, expected_workspace] = monitor;
            if (expected_monitor != actual_monitor || actual_workspace != expected_workspace) {
                func(expected_monitor, actual_monitor, actual_workspace);
            }
        } else {
            func(null, actual_monitor, actual_workspace);
        }
    }

    on_overview_shown() {
        this.exit_modes();
        this.unset_grab_op();
    }

    on_window_create(window: Meta.Window, actor: Meta.WindowActor, is_new_window: boolean) {
        const win = this.get_window(window);
        if (!win) return;

        if (is_new_window) {
            win.dont_animate_next_movement();
            actor.connect('first-frame', () => {
                if (!this.movements.contains(win.entity)) win.maybe_animate_next_movement();
            });
        }

        this.signals.connect_with(actor, () =>
            actor.connect('destroy', () => {
                if (win.border) {
                    win.border.destroy();
                    win.border = null;
                }

                this.on_destroy(win.entity);

                this.signals.forget_source(actor);
            }),
        );

        // Disconnect any preexisting signals
        this.window_signals.take_with(win.entity, signals => {
            for (const signal of signals) {
                win.meta.disconnect(signal);
            }
        });
        this.tilable_window_signals.remove(win.entity);
        win.was_tilable = false;

        // Connect window signals
        win.bind_window_events();
        win.reconsider_tiling(false);
    }

    on_workspace_added(_number: number) {
        this.ignore_display_update = true;
    }

    /** Called when a window changes workspace/monitor */
    on_workspace_changed(win: Window.ShellWindow) {
        if (this.gnome_forest && !this.contains_tag(win.entity, Tags.Floating)) {
            const id = this.workspace_id(win);
            const prev_id = this.monitors.get(win.entity);
            if (!prev_id || id[0] != prev_id[0] || id[1] != prev_id[1]) {
                win.ignore_detach = true;
                this.monitors.insert(win.entity, id);
                if (win.is_tilable()) {
                    this.gnome_forest.detach_window(win.entity);
                    this.gnome_forest.attach_to_workspace(win, id);
                }
            }

            if (win.meta.minimized) {
                this.size_signals_block(win);
                win.meta.unminimize();
                this.size_signals_unblock(win);
            }
        }
    }

    on_workspace_index_changed(prev: WorkspaceID, next: WorkspaceID) {
        this.on_workspace_modify(
            current => current == prev,
            () => next,
        );
    }

    on_workspace_modify(
        condition: (current: WorkspaceID) => boolean,
        modify: (current: WorkspaceID) => WorkspaceID,
        change_workspace: boolean = false,
    ) {
        function window_move(ext: Ext, entity: Entity, ws: WorkspaceID) {
            if (change_workspace) {
                const window = ext.windows.get(entity);
                if (!window || !window.actor_exists() || window.meta.is_on_all_workspaces()) return;

                ext.size_signals_block(window);
                window.meta.change_workspace_by_index(ws, false);
                ext.size_signals_unblock(window);
            }
        }

        if (this.gnome_forest) {
            for (const [entity, monitor] of this.gnome_forest.forest.toplevel.values()) {
                if (condition(monitor[1])) {
                    const value = modify(monitor[1]);
                    monitor[1] = value;
                    let fork = this.gnome_forest.forest.forks.get(entity);
                    if (fork) {
                        fork.workspace = value;
                        for (const child of this.gnome_forest.forest.iter(entity)) {
                            if (child.inner.kind === node.NodeKind.FORK) {
                                fork = this.gnome_forest.forest.forks.get(child.inner.entity);
                                if (fork) fork.workspace = value;
                            } else if (child.inner.kind === node.NodeKind.WINDOW) {
                                window_move(this, child.inner.entity, value);
                            } else if (child.inner.kind === node.NodeKind.STACK) {
                                const stack = this.gnome_forest.forest.stacks.get(child.inner.idx);
                                if (stack) {
                                    stack.workspace = value;

                                    for (const entity of child.inner.entities) {
                                        window_move(this, entity, value);
                                    }

                                    stack.restack();
                                }
                            }
                        }
                    }
                }
            }

            // Fix phantom apps in dash
            for (const window of this.windows.values()) {
                if (!window.actor_exists()) this.gnome_forest.detach_window(window.entity);
            }
        } else {
            const to_delete = [];

            for (const [entity, window] of this.windows.iter()) {
                if (!window.actor_exists()) {
                    to_delete.push(entity);
                    continue;
                }

                const ws = window.workspace_id();
                if (condition(ws)) {
                    window_move(this, entity, modify(ws));
                }
            }

            for (const e of to_delete) this.delete_entity(e);
        }
    }

    on_workspace_removed(number: number) {
        this.on_workspace_modify(
            current => current > number,
            prev => workspaceID(prev - 1),
        );
    }

    restack() {
        // NOTE: Workaround for GNOME Shell showing our hidden windows on a workspace switch
        let attempts = 0;
        const source = GLib.timeout_add(GLib.PRIORITY_LOW, 50, () => {
            if (this.gnome_forest) {
                for (const container of this.gnome_forest.forest.stacks.values()) {
                    container.restack();
                }
            }

            if (attempts < 10) {
                ++attempts;
                return GLib.SOURCE_CONTINUE;
            } else {
                this.timeouts.delete(source);
                return GLib.SOURCE_REMOVE;
            }
        });
        this.timeouts.add(source);
    }

    set_overlay(rect: geom.Rect) {
        this.overlay.x = rect.x;
        this.overlay.y = rect.y;
        this.overlay.width = rect.width;
        this.overlay.height = rect.height;
    }

    /** Begin listening for signals from windows, and add any pre-existing windows. */
    signals_attach() {
        this.gnome_theme.attach(this.signals);

        this.gnome_tiling_mode.queue.start(100, movement => {
            movement();
            return true;
        });

        const workspace_manager = wom;

        for (const [, ws] of iter_workspaces(workspace_manager)) {
            let index = workspaceID(ws.index());

            this.signals.connect_with(ws, () =>
                ws.connect('notify::workspace-index', () => {
                    if (ws !== null) {
                        const new_index = workspaceID(ws.index());
                        this.on_workspace_index_changed(index, new_index);
                        index = new_index;
                    }
                }),
            );
        }

        this.signals.connect_with(display, () =>
            display.connect('workareas-changed', () => {
                this.update_display_configuration(true);
            }),
        );

        this.signals.connect_with(wim, () =>
            wim.connect('size-change', (_, actor, event) => {
                if (!this.gnome_forest) return;

                const meta = actor.get_meta_window();
                if (!meta) return;
                const win = this.get_window(meta);
                if (!win) return;

                switch (event) {
                    case Meta.SizeChange.MAXIMIZE:
                    case Meta.SizeChange.UNMAXIMIZE:
                        win.dont_animate_next_movement();
                        this.register(Events.window_event(win, WindowEventType.Maximize));
                        break;
                    case Meta.SizeChange.FULLSCREEN:
                    case Meta.SizeChange.UNFULLSCREEN:
                        win.dont_animate_next_movement();
                        this.register(Events.window_event(win, WindowEventType.Fullscreen));
                        break;
                    case Meta.SizeChange.MONITOR_MOVE:
                        // TODO(adil192): Consider removing `notify::main-monitor` listener from window and emitting the `WindowEventType.Workspace` event here. Must not regress https://github.com/adil192/shatter-shell/issues/98
                        break;
                }
            }),
        );

        this.signals.connect_with(this.settings.ext, settings =>
            settings.connect('changed::active-hint', () => this.show_border_on_focused()),
        );

        this.gnome_sizes.attach(this.signals);

        this.signals.connect_with(this.settings.mutter, mutter =>
            mutter.connect('changed::workspaces-only-on-primary', () => {
                this.register(Events.global(GlobalEvent.MonitorsChanged));
            }),
        );

        this.signals.connect_with(layoutManager, () =>
            // @ts-expect-error GObject.Object.connect types are borked
            layoutManager.connect('monitors-changed', () => {
                this.register(Events.global(GlobalEvent.MonitorsChanged));
            }),
        );

        this.signals.connect_with(sessionMode, () =>
            sessionMode.connect('updated', () => {
                if (indicator) {
                    indicator.button.visible = !sessionMode.isLocked;
                }

                if (sessionMode.isLocked) {
                    this.exit_modes();
                }
            }),
        );

        this.signals.connect_with(overview, () =>
            overview.connect('showing', () => {
                this.register(Events.global(GlobalEvent.OverviewShown));
            }),
        );

        this.signals.connect_with(overview, () =>
            overview.connect('hiding', () => {
                const window = this.get_focused_window();
                if (window) {
                    this.on_focused(window);
                }
            }),
        );

        // We have to connect this signal in an idle_add; otherwise work areas stop being calculated
        this.register_fn(() => {
            if (screenShield?.locked) this.update_display_configuration(false);

            this.signals.connect_with(display, () =>
                display.connect('notify::focus-window', () => {
                    // Disallow refocus if a modal window is active
                    if (Main.modalCount !== 0 && modalActorFocusStack.length) {
                        const { actor } = modalActorFocusStack[0]!;
                        if (!('style_class' in actor)) return;
                        if (actor.style_class !== 'switcher-popup') return;
                    }

                    const refocus_tiled_window = () => {
                        // Re-focus a window that was unfocused.
                        let window: Window.ShellWindow | null = null;
                        for (const entity of this.focus_history.recent()) {
                            window = this.windows.get(entity);
                            if (window) break;
                        }

                        if (window && window.same_monitor() && window.same_workspace() && !window.meta.minimized) {
                            window.request_activate(false);
                        } else {
                            this.hide_all_borders();
                        }
                    };

                    // Delay in case the focused window was not focused yet.
                    // Note: Fixes Intellij IDE windows.
                    this.register_fn(() => {
                        const meta_window = global.display.get_focus_window() as Meta.Window | null;

                        if (meta_window) {
                            const shell_window = this.get_window(meta_window);

                            if (shell_window) {
                                // Avoid re-focusing a window that's already focused.
                                if (
                                    !this.focus_history.is_current(shell_window.entity)
                                    && !shell_window.meta.minimized
                                ) {
                                    this.on_focused(shell_window);
                                }
                            } else if (!meta_window.is_override_redirect()) {
                                // Prevent focusing desktop extension in auto-tiler mode
                                if (this.gnome_forest && meta_window.window_type === Meta.WindowType.DESKTOP) {
                                    refocus_tiled_window();
                                } else {
                                    // This section fixes Steam's sub-menus.
                                    meta_window.activate(global.get_current_time());
                                }
                            }
                        } else if (this.gnome_forest) {
                            refocus_tiled_window();
                        }
                    });
                }),
            );

            const window = this.get_focused_window();
            if (window) {
                this.on_focused(window);
            }

            return false;
        });

        this.signals.connect_with(display, () =>
            display.connect('window-created', (_, window) => {
                this.register({ tag: 'window_create', window, is_new_window: true });
            }),
        );

        this.signals.connect_with(display, () =>
            display.connect('grab-op-begin', (_display, win, op) => {
                this.on_grab_start(win, op);
            }),
        );

        this.signals.connect_with(display, () =>
            display.connect('grab-op-end', (_display, win, op) => {
                this.register_fn(() => this.on_grab_end(win, op));
            }),
        );

        this.signals.connect_with(overview, () =>
            overview.connect('window-drag-begin', (_, win) => {
                this.on_grab_start(win, 1);
            }),
        );

        this.signals.connect_with(overview, () =>
            overview.connect('window-drag-end', (_, win) => {
                this.register_fn(() => this.on_grab_end(win));
            }),
        );

        this.signals.connect_with(overview, () =>
            overview.connect('window-drag-cancelled', () => {
                this.unset_grab_op();
            }),
        );

        this.signals.connect_with(wim, () =>
            wim.connect('switch-workspace', () => {
                this.hide_all_borders();
            }),
        );

        this.signals.connect_with(workspace_manager, () =>
            workspace_manager.connect('active-workspace-changed', () => {
                this.on_active_workspace_changed();
            }),
        );

        this.signals.connect_with(workspace_manager, () =>
            workspace_manager.connect('workspace-removed', (_, number) => {
                this.on_workspace_removed(number);
            }),
        );

        this.signals.connect_with(workspace_manager, () =>
            workspace_manager.connect('workspace-added', (_, number) => {
                this.on_workspace_added(number);
            }),
        );

        // Bind show desktop and remove the active hint
        this.signals.connect_with(workspace_manager, () =>
            workspace_manager.connect('showing-desktop-changed', () => {
                this.hide_all_borders();
                this.focus_history.clear();
            }),
        );

        // Modes

        this.gnome_auto_tiling.restore();

        // Post-init

        // Find any new available windows
        this.tab_list(Meta.TabList.NORMAL, null);

        // Re-register existing windows
        for (const window of this.windows.values()) {
            this.register({ tag: 'window_create', window: window.meta, is_new_window: false });
        }

        // Unset `this.init` after all other idle tasks
        if (this.init) this.register_fn(() => (this.init = false));
    }

    signals_remove() {
        this.signals.disconnect_all();

        this.window_signals.clear_with((entity, signals) => {
            const win = this.windows.get(entity);
            if (!win) return;
            for (const signal of signals) {
                win.meta.disconnect(signal);
            }
        });
        this.tilable_window_signals.clear();

        for (const [_meta, tag] of this.size_requests) {
            GLib.source_remove(tag);
        }
        this.size_requests.clear();

        for (const tag of this.timeouts) {
            GLib.source_remove(tag);
        }
        this.timeouts.clear();

        this.unset_grab_op();

        if (this.displays_updating !== null) {
            GLib.source_remove(this.displays_updating);
            this.displays_updating = null;
        }

        if (this.workareas_update !== null) {
            GLib.source_remove(this.workareas_update);
            this.workareas_update = null;
        }

        this.gnome_tiling_mode.queue.stop();
    }

    size_signals_block(win: Window.ShellWindow) {
        this.add_tag(win.entity, Tags.Blocked);
    }

    size_signals_unblock(win: Window.ShellWindow) {
        this.delete_tag(win.entity, Tags.Blocked);
    }

    // Snaps all windows to the window grid
    snap_windows() {
        for (const window of this.windows.values()) {
            if (window.is_tilable()) this.gnome_tiling_mode.snap(window);
        }
    }

    /** Switch to a workspace by its index */
    switch_to_workspace(id: WorkspaceID) {
        this.workspace_by_id(id)?.activate(global.get_current_time());
    }

    private tab_list(tablist: Meta.TabList, workspace: Meta.Workspace | null): Array<Window.ShellWindow> {
        const windows = display.get_tab_list(tablist, workspace);

        const matched = [];

        for (const window of windows) {
            const win = this.get_window(window);
            if (win) matched.push(win);
        }

        return matched;
    }

    /** Calls a function once windows are no longer queued for movement. */
    when_movements_empty(func: () => void) {
        if (this.movements.is_empty()) {
            return func();
        }
        const source = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 20, () => {
            if (this.movements.is_empty()) {
                func();
                this.timeouts.delete(source);
                return GLib.SOURCE_REMOVE;
            } else {
                return GLib.SOURCE_CONTINUE;
            }
        });
        this.timeouts.add(source);
    }

    should_ignore_workspace(monitor: MonitorID): boolean {
        return this.settings.get_workspaces_only_on_primary() && monitor !== global.display.get_primary_monitor();
    }

    unset_grab_op() {
        if (this.drag_signal !== null) {
            this.overlay.visible = false;
            GLib.source_remove(this.drag_signal);
            this.drag_signal = null;
        }

        if (this.grab_op !== null) {
            const window = this.windows.get(this.grab_op.entity);
            if (window) this.size_signals_unblock(window);
            this.grab_op = null;
        }

        this.moved_by_mouse = false;
    }

    update_display_configuration(workareas_only: boolean) {
        if (!this.gnome_forest || sessionMode.isLocked) return;

        if (this.ignore_display_update) {
            this.ignore_display_update = false;
            return;
        }

        // Ignore the update if there are no monitors to assign to
        if (layoutManager.monitors.length === 0) return;

        const primary_display = monitorID(global.display.get_primary_monitor());

        const primary_display_ready = (ext: Ext): boolean => {
            const area = global.display.get_monitor_geometry(primary_display);
            const work_area = ext.monitor_work_area(primary_display);
            return !(area.width === work_area.width && area.height === work_area.height);
        };

        function displays_ready(): boolean {
            const monitors = global.display.get_n_monitors();
            if (monitors === 0) return false;

            for (let i = 0; i < monitors; i += 1) {
                const display = global.display.get_monitor_geometry(i);
                if (display.width < 1 || display.height < 1) return false;
            }

            return true;
        }

        if (!displays_ready() || !primary_display_ready(this)) {
            if (this.displays_updating !== null) return;
            if (this.workareas_update !== null) {
                GLib.source_remove(this.workareas_update);
                this.workareas_update = null;
            }

            this.workareas_update = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                this.register_fn(() => {
                    this.update_display_configuration(workareas_only);
                });

                this.workareas_update = null;
                return GLib.SOURCE_REMOVE;
            });

            return;
        }

        // Update every tree on each display with the new dimensions
        const update_tiling = () => {
            if (!this.gnome_forest) return;

            for (const f of this.gnome_forest.forest.forks.values()) {
                if (!f.is_toplevel) continue;

                const area = this.monitor_work_area(f.monitor);

                f.smart_gapped = false;
                f.set_area(area.copy());
                this.gnome_forest.update_toplevel(f, f.monitor, this.settings.get_smart_gaps());
            }
        };

        type Migration = MonitorMigration<Fork, MonitorID, Mtk.Rectangle>;

        const apply_migrations = (migrations: Migration[], claimed: Set<MonitorID>) => {
            if (!migrations.length) return;

            new exec.OnceExecutor<Migration, Migration[]>(migrations).start(
                500,
                ({ tree: fork, monitor, work_area, moved }) => {
                    const workspace = moved
                        ? workspace_on(monitor, claimed, monitor => this.find_unused_workspace(monitor)[0])
                        : fork.workspace;

                    fork.migrate(this, forest, work_area, monitor, workspace);
                    fork.set_ratio(fork.length() / 2);

                    return true;
                },
                () => update_tiling(),
            );
        };

        function mark_for_reassignment(ext: Ext, fork: Ecs.Entity) {
            for (const win of forest.iter(fork)) {
                if (win.inner.kind !== node.NodeKind.WINDOW) continue;

                const entity = win.inner.entity;
                const window = ext.windows.get(entity);
                if (window) window.reassignment = true;
            }
        }

        const [old_primary, old_displays] = this.displays;

        // Each window's monitor before and after the change
        const placements = function* (ext: Ext): Generator<[MonitorID, MonitorID]> {
            for (const [entity, w] of ext.windows.iter()) {
                if (!w.actor_exists()) continue;

                const placement = ext.monitors.get(entity);
                if (placement) yield [placement[0], w.monitor_id()];
            }
        };

        // Where each monitor's windows ended up
        const changes = monitor_changes(placements(this), old_primary, primary_display);

        // Fetch a new list of monitors
        const updated = new Map<MonitorID, MonitorInfo<Mtk.Rectangle>>();

        for (const mon of layoutManager.monitors) {
            const area = new Mtk.Rectangle({ x: mon.x, y: mon.y, width: mon.width, height: mon.height });
            const ws = this.monitor_work_area(monitorID(mon.index));

            updated.set(monitorID(mon.index), { area, ws });
        }

        const forest = this.gnome_forest.forest;

        if (old_displays.size === updated.size) {
            update_tiling();

            this.displays = [primary_display, updated];

            return;
        }

        this.displays = [primary_display, updated];

        if (utils.map_eq(old_displays, updated)) {
            return;
        }

        if (this.displays_updating !== null) {
            GLib.source_remove(this.displays_updating);
            this.displays_updating = null;
        }

        if (this.workareas_update !== null) {
            GLib.source_remove(this.workareas_update);
            this.workareas_update = null;
        }

        // Delay actions in case of temporary connection loss
        this.displays_updating = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            (() => {
                if (!this.gnome_forest) return;

                const toplevels = Array.from(forest.forks.values()).filter(f => f.is_toplevel);
                const migrations = plan_migrations(toplevels, changes, this.displays[1]);

                for (const migration of migrations) {
                    if (migration.moved) migration.tree.workspace = 0;
                    mark_for_reassignment(this, migration.tree.entity);
                }

                apply_migrations(migrations, unchanged_monitors(changes));

                return;
            })();

            this.displays_updating = null;
            return false;
        });
    }

    /** Fetches the window entity which is associated with the metacity window metadata. */
    private window_entity(meta: Meta.Window): Entity | null {
        const id = meta.get_stable_sequence();

        // Locate the window entity with the matching ID
        let entity = this.ids.find(comp => comp == id).next().value ?? undefined;
        if (entity) return entity;

        // If not found, create a new entity with a ShellWindow component.
        const actor = meta.get_compositor_private<Meta.WindowActor | null>();
        if (!actor) return null;

        // Only permit normal, dialog, and modal dialogs
        const window_type = meta.get_window_type();
        if (
            window_type !== Meta.WindowType.NORMAL
            && window_type !== Meta.WindowType.DIALOG
            && window_type !== Meta.WindowType.MODAL_DIALOG
        ) {
            return null;
        }

        const window_app = Window.window_tracker.get_window_app(meta) as Shell.App | null;
        if (!window_app) return null;
        const name = window_app.get_name().replace(/&/g, '&amp;');

        entity = this.create_entity();
        this.ids.insert(entity, id);
        this.names.insert(entity, name);

        const win = new Window.ShellWindow(entity, meta, window_app, this);
        this.windows.insert(entity, win);
        this.monitors.insert(entity, [win.monitor_id(), win.workspace_id()]);

        const grab_focus = () => {
            this.when_movements_empty(() => {
                this.windows.with(entity, window => {
                    this.register_fn(() => window.request_activate(false));
                });
            });
        };

        if (this.gnome_forest && !win.meta.minimized && win.is_tilable()) {
            const id = actor.connect('first-frame', () => {
                this.gnome_forest?.auto_tile(win, this.init);
                grab_focus();
                actor.disconnect(id);
            });
        } else {
            grab_focus();
        }

        return entity;
    }

    /** Returns the tilable window(s) that the mouse pointer is currently hovering above. */
    *windows_at_pointer(cursor: Mtk.Rectangle, monitor: MonitorID, workspace: WorkspaceID) {
        for (const entity of this.monitors.find(m => m[0] == monitor && m[1] == workspace)) {
            const window = this.windows.with(entity, window => {
                return window.is_tilable() && window.rect().contains_rect(cursor) ? window : null;
            });

            if (window) yield window;
        }
    }

    cursor_status(): [Mtk.Rectangle, MonitorID] {
        const cursor = cursor_rect();
        const monitor = monitorID(display.get_monitor_index_for_rect(cursor));
        return [cursor, monitor];
    }

    /** Fetch a workspace by its index */
    workspace_by_id(id: WorkspaceID): Meta.Workspace | null {
        return wom.get_workspace_by_index(id);
    }

    workspace_id(window: Window.ShellWindow | null = null): MonitorWorkspaceID {
        const id: MonitorWorkspaceID = window
            ? [window.monitor_id(), window.workspace_id()]
            : [this.active_monitor(), this.active_workspace()];

        if (id[0] < 0) id[0] = monitorID(0);
        if (id[1] < 0) id[1] = 0;

        return id;
    }
}

let ext: Ext | null = null;
let indicator: Indicator | null = null;

export default class ShatterShellExtension extends Extension {
    // oxlint-disable-next-line typescript/no-misused-promises typescript/strict-void-return max-statements
    override async enable() {
        Log.settings = this.getSettings();
        Log.info('enable');

        if (!ext) {
            const config = new Config.Config();
            await config.reload();

            ext = new Ext(this, config);

            ext.register_fn(() => {
                if (ext?.gnome_forest) ext.snap_windows();
            });
        } else {
            ext.extension = this;
        }

        ext.gnome_theme.pick_style();
        ext.register_fn(() => ext!.gnome_theme.inject());

        if (ext.was_locked) {
            ext.was_locked = false;
            return;
        }

        ext.injections_add();
        ext.signals_attach();

        layoutManager.addChrome(ext.overlay);

        if (!indicator) {
            indicator = new PanelSettings.Indicator(ext);
            panel.addToStatusArea('shatter-shell', indicator.button);
        }

        ext.keybindings.enable(ext.keybindings.global).enable(ext.keybindings.window_focus);
        if (ext.settings.get_need_overrides_setup()) {
            const path = get_current_path() + '/shortcuts_dialog/main.js';
            GLib.spawn_command_line_async(`gjs --module "${path}" -- --need-overrides-setup`);
        }

        if (ext.settings.get_tile_by_default()) {
            ext.gnome_auto_tiling.on();
        }
    }

    override disable() {
        Log.info('disable');

        if (ext) {
            if (sessionMode.isLocked) {
                ext.was_locked = true;
                return;
            }

            ext.window_animations.stop_all();
            ext.injections_remove();
            ext.signals_remove();
            ext.exit_modes();
            ext.hide_all_borders();

            layoutManager.removeChrome(ext.overlay);

            ext.keybindings.disable(ext.keybindings.global).disable(ext.keybindings.window_focus);

            if (ext.gnome_forest) {
                ext.gnome_forest.destroy();
                ext.gnome_forest = null;
            }

            ext.extension = null;
        }

        if (indicator) {
            indicator.destroy();
            indicator = null;
        }

        Log.settings = null;
    }
}

function* iter_workspaces(manager: Meta.WorkspaceManager) {
    let idx = 0;
    let ws = manager.get_workspace_by_index(idx);
    while (ws !== null) {
        yield [idx, ws] as const;
        idx += 1;
        ws = manager.get_workspace_by_index(idx);
    }
}
