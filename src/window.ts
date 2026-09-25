import * as lib from './lib.js';
import * as log from './log.js';
import { Tags } from './tags.js';
import * as utils from './utils.js';
import type { Entity } from './ecs.js';
import type { Ext } from './extension.js';
import * as focus from './focus.js';
const { monitorID, workspaceID } = lib;

import Gdk from 'gi://Gdk';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Mtk from 'gi://Mtk';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const window_tracker = Shell.WindowTracker.get_default();

/** Contains SourceID of a restack operation. Used to prevent multiple restacks. */
let SCHEDULED_RESTACK: number | null = null;

/** Contains SourceID of an active hint operation. */
let ACTIVE_HINT_SHOW_ID: number | null = null;

enum RESTACK_STATE {
    RAISED,
    WORKSPACE_CHANGED,
    NORMAL,
}

enum RESTACK_SPEED {
    RAISED = 430,
    WORKSPACE_CHANGED = 300,
    NORMAL = 200,
}

export class ShellWindow {
    entity: Entity;
    meta: Meta.Window;
    ext: Ext;
    stack: number | null = null;
    known_workspace: WorkspaceID;
    grab: boolean = false;
    activate_after_move: boolean = false;
    ignore_detach: boolean = false;
    was_attached_to?: [Entity, boolean | number];
    destroying: boolean = false;

    // Awaiting reassignment after a display update
    reassignment: boolean = false;

    // True if this window is currently smart-gapped
    smart_gapped: boolean = false;

    border: null | St.Bin = new St.Bin({
        style_class: 'shatter-shell-active-hint shatter-shell-border-normal',
    });

    prev_rect: null | Mtk.Rectangle = null;

    window_app: Shell.App;

    private border_size = 0;

    constructor(entity: Entity, window: Meta.Window, window_app: Shell.App, ext: Ext) {
        this.window_app = window_app;

        this.entity = entity;
        this.meta = window;
        this.ext = ext;

        this.known_workspace = this.workspace_id();

        // Float fullscreen windows by default, such as Kodi.
        if (this.meta.is_fullscreen()) {
            ext.add_tag(entity, Tags.Floating);
        }

        this.bind_window_events();
        this.bind_hint_events();

        if (this.border) global.window_group.add_child(this.border);

        this.hide_border();
        this.restack();
        this.update_border_layout();

        if (this.meta.get_compositor_private<Meta.WindowActor | null>()?.get_stage()) this.on_style_changed();
    }

    /** Activates a window, and moves the mouse pointer. */
    request_activate(move_mouse: boolean = true): void {
        try {
            // Quit if window is destroying/destroyed.
            if (!this.actor_exists()) return;

            // Quit if window has override-redirect set.
            if (this.meta.is_override_redirect()) return;

            const workspace = this.meta.get_workspace();
            workspace.activate_with_focus(this.meta, global.get_current_time());

            move_mouse = move_mouse
                && Main.modalCount === 0
                && this.ext.settings.mouse_cursor_follows_active_window()
                && !pointer_already_on_window(this.meta)
                && pointer_in_work_area();
            if (move_mouse) {
                place_pointer_on(this.ext, this.meta);
            }
        } catch (error) {
            log.error(`failed to activate window: ${error}`);
        }
    }

    actor_exists(): boolean {
        return !this.destroying && this.meta.get_compositor_private<Meta.WindowActor | null>() !== null;
    }

    private bind_window_events() {
        this.ext.window_signals
            .get_or(this.entity, () => [])
            .push(
                this.meta.connect('size-changed', () => {
                    this.window_changed();
                }),
                this.meta.connect('position-changed', () => {
                    this.window_changed();
                }),
                this.meta.connect('workspace-changed', () => {
                    this.workspace_changed();
                }),
                this.meta.connect('notify::wm-class', () => {
                    this.wm_class_changed();
                }),
                this.meta.connect('raised', () => {
                    this.window_raised();
                }),
            );
    }

    private bind_hint_events() {
        if (!this.border) return;

        const settings = this.ext.settings;
        const change_id = settings.ext.connect('changed', (_, key) => {
            if (this.border) {
                if (key === 'hint-color-rgba') {
                    this.update_hint_colors();
                }
            }
            return false;
        });

        this.border.connect('destroy', () => {
            settings.ext.disconnect(change_id);
        });
        this.border.connect('style-changed', () => {
            this.on_style_changed();
        });

        this.update_hint_colors();
    }

    /**
     * Adjust the colors for:
     * - border hint
     * - overlay
     */
    private update_hint_colors() {
        const settings = this.ext.settings;
        const color_value = settings.hint_color_rgba();

        const gdk = new Gdk.RGBA();
        // TODO Probably move overlay color/opacity to prefs.js in future,
        // For now mimic the hint color with lower opacity
        const overlay_alpha = 0.3;
        const orig_overlay = 'rgba(53, 132, 228, 0.3)';
        gdk.parse(color_value);

        if (utils.is_dark(gdk.to_string())) {
            // too dark, use the blue overlay
            gdk.parse(orig_overlay);
        }

        gdk.alpha = overlay_alpha;
        this.ext.overlay.set_style(`background: ${gdk.to_string()}`);

        this.update_border_style();
    }

    cmdline(): string | null {
        const pid = this.meta.get_pid() as number;
        if (pid === 0) return null;

        const path = '/proc/' + pid + '/cmdline';
        if (!utils.exists(path)) return null;

        const result = utils.read_to_string(path);
        let out: string | null;
        if (result.ok) {
            out = result.value.trim();
        } else {
            out = null;
            log.error(`failed to fetch cmdline: ${result.why.format()}`);
        }

        return out;
    }

    icon(size: number) {
        let icon = this.window_app.create_icon_texture(size) as St.Icon | null;

        if (!icon) {
            icon = new St.Icon({
                icon_name: 'applications-other',
                icon_size: size,
            });
        }

        return icon;
    }

    /** Whether the window is maximized horizontally or vertically (not necessarily both). */
    is_maximized(): boolean {
        return this.meta.maximized_horizontally || this.meta.maximized_vertically;
    }

    /** Window is maximized, 0 gapped, or smart gapped */
    private is_max_screen(): boolean {
        return this.is_maximized()
            || this.ext.settings.gap_inner() === 0
            || this.smart_gapped;
    }

    is_single_max_screen(): boolean {
        const display = this.meta.get_display() as Meta.Display | null;

        if (display) {
            const monitor_count = display.get_n_monitors();
            return (this.is_maximized() || this.smart_gapped) && monitor_count == 1;
        }

        return false;
    }

    /** Whether the window has been "snapped" to the left or right. */
    is_snap_edge(): boolean {
        return this.meta.maximized_vertically && !this.meta.maximized_horizontally;
    }

    is_tilable(ext: Ext): boolean {
        if (ext.contains_tag(this.entity, Tags.Floating)) return false;

        let wm_class = this.meta.get_wm_class();
        if (wm_class !== null && !wm_class.trim().length) {
            wm_class = this.name(ext);
        }

        // Quake-style terminals such as Tilix's quake mode.
        if (this.meta.get_role() === 'quake') return false;

        if (!this.meta.allows_resize()) return false;
        if (!this.meta.allows_move()) return false;

        // Blacklist any windows that happen to leak through our filter
        // Windows that are tagged ForceTile are considered tilable despite exemption
        if (wm_class !== null && ext.conf.window_shall_float(wm_class, this.title())) {
            return ext.contains_tag(this.entity, Tags.ForceTile);
        }

        return (
            // Only normal windows will be considered for tiling
            this.meta.window_type == Meta.WindowType.NORMAL
            && !this.meta.is_skip_taskbar()
            // Transient windows are most likely dialogs
            && !this.is_transient()
            // If a window lacks a class, it's probably a web browser dialog
            && wm_class !== null
        );
    };

    is_transient(): boolean {
        return this.meta.get_transient_for() !== null;
    }

    move(ext: Ext, rect: Mtk.Rectangle, on_complete?: () => void) {
        if (!this.same_workspace() && this.is_maximized()) {
            return;
        }

        const max_width = ext.settings.max_window_width();
        if (max_width > 0 && rect.width > max_width) {
            rect.x += (rect.width - max_width) / 2;
            rect.width = max_width;
        }

        const meta = this.meta;
        const actor = meta.get_compositor_private<Meta.WindowActor | null>();

        if (actor) {
            if (this.is_maximized()) {
                meta.unmaximize();
            }
            actor.remove_all_transitions();

            ext.movements.insert(this.entity, rect);

            ext.register({ tag: 'window_move', window: this });
            if (on_complete) ext.register_fn(on_complete);
            if (meta.appears_focused) {
                this.update_border_layout();
                ext.show_border_on_focused();
            } else {
                this.hide_border();
            }
        }
    }

    name(ext: Ext): string {
        return ext.names.get_or(this.entity, () => 'unknown');
    }

    private on_style_changed() {
        if (!this.border) return;
        this.border_size = this.border.get_theme_node().get_border_width(St.Side.TOP);
    }

    rect(): Mtk.Rectangle {
        return this.meta.get_frame_rect();
    }

    swap(ext: Ext, other: ShellWindow): void {
        const ar = this.rect().copy();
        const br = other.rect().copy();

        other.move(ext, ar);
        this.move(ext, br, () => place_pointer_on(this.ext, this.meta));
    }

    title(): string {
        const title = this.meta.get_title();
        return title ? title : this.name(this.ext);
    }

    workspace_id(): WorkspaceID {
        const id = this.meta.get_workspace().index();
        return workspaceID(id);
    }

    monitor_id(): MonitorID {
        const id = this.meta.get_monitor();
        return monitorID(id);
    }

    show_border() {
        if (!this.border) return;

        this.restack();
        this.update_border_style();
        if (this.ext.settings.active_hint()) {
            const border = this.border;

            const permitted = () => {
                return (
                    this.actor_exists()
                    && this.ext.focus_window() == this
                    && !this.meta.is_fullscreen()
                    && (!this.is_single_max_screen() || this.is_snap_edge())
                    && !this.meta.minimized
                );
            };

            if (permitted()) {
                if (this.meta.appears_focused) {
                    border.show();

                    // Focus will be re-applied to fix windows moving across workspaces
                    let applications = 0;

                    // Ensure that the border is shown
                    if (ACTIVE_HINT_SHOW_ID !== null) GLib.source_remove(ACTIVE_HINT_SHOW_ID);
                    ACTIVE_HINT_SHOW_ID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 600, () => {
                        if ((applications > 4 && !this.same_workspace()) || !permitted()) {
                            ACTIVE_HINT_SHOW_ID = null;
                            return GLib.SOURCE_REMOVE;
                        }

                        applications += 1;
                        border.show();
                        return GLib.SOURCE_CONTINUE;
                    });
                }
            }
        }
    }

    same_workspace() {
        const workspace = this.meta.get_workspace() as Meta.Workspace | null;
        if (workspace) {
            const workspace_id = workspace.index();
            return workspace_id === global.workspace_manager.get_active_workspace_index();
        }
        return false;
    }

    same_monitor() {
        return this.monitor_id() === global.display.get_current_monitor();
    }

    /**
     * Sort the window group/always top group with each window border
     * @param updateState NORMAL, RAISED, WORKSPACE_CHANGED
     */
    restack(updateState: RESTACK_STATE = RESTACK_STATE.NORMAL) {
        this.update_border_layout();
        if (this.meta.is_fullscreen() || (this.is_single_max_screen() && !this.is_snap_edge()) || this.meta.minimized) {
            this.hide_border();
        }

        let restackSpeed = RESTACK_SPEED.NORMAL;

        switch (updateState) {
            case RESTACK_STATE.NORMAL:
                restackSpeed = RESTACK_SPEED.NORMAL;
                break;
            case RESTACK_STATE.RAISED:
                restackSpeed = RESTACK_SPEED.RAISED;
                break;
            case RESTACK_STATE.WORKSPACE_CHANGED:
                restackSpeed = RESTACK_SPEED.WORKSPACE_CHANGED;
                break;
        }

        let restacks = 0;

        const action = () => {
            const count = restacks;
            restacks += 1;

            if (!this.actor_exists() && count === 0) return true;

            if (count === 3) {
                if (SCHEDULED_RESTACK !== null) GLib.source_remove(SCHEDULED_RESTACK);
                SCHEDULED_RESTACK = null;
            }

            const border = this.border;
            const actor = this.meta.get_compositor_private<Meta.WindowActor | null>();
            const win_group = global.window_group;

            if (actor && border) {
                this.update_border_layout();
                // move the border above the window group first
                win_group.set_child_above_sibling(border, null);

                if (this.always_top_windows.length > 0) {
                    // honor the always-top windows
                    for (const above_actor of this.always_top_windows) {
                        if (actor != above_actor) {
                            if (border.get_parent() === above_actor.get_parent()) {
                                win_group.set_child_below_sibling(border, above_actor);
                            }
                        }
                    }

                    // Move the border above the current window actor
                    if (border.get_parent() === actor.get_parent()) {
                        win_group.set_child_above_sibling(border, actor);
                    }
                }

                // Honor transient windows
                for (const window of this.ext.windows.values()) {
                    const parent = window.meta.get_transient_for();
                    const window_actor = window.meta.get_compositor_private<Meta.WindowActor | null>();
                    if (!parent || !window_actor) continue;
                    const parent_actor = parent.get_compositor_private<Meta.WindowActor | null>();
                    if (!parent_actor && parent_actor !== actor) continue;
                    win_group.set_child_below_sibling(border, window_actor);
                }
            }

            return true;
        };

        if (SCHEDULED_RESTACK !== null) GLib.source_remove(SCHEDULED_RESTACK);
        SCHEDULED_RESTACK = GLib.timeout_add(GLib.PRIORITY_LOW, restackSpeed, action);
    }

    get always_top_windows(): Meta.WindowActor[] {
        const above_windows: Meta.WindowActor[] = [];

        for (const actor of global.get_window_actors()) {
            const window = actor.get_meta_window();
            if (window && window.is_above()) above_windows.push(actor);
        }

        return above_windows;
    }

    hide_border() {
        const b = this.border;
        if (b) b.hide();
    }

    update_border_layout() {
        let { x, y, width, height } = this.meta.get_frame_rect();

        const border = this.border;
        if (border) {
            const borderSize = (this.is_max_screen() || this.is_snap_edge())
                ? 0
                : this.border_size;

            const stack_number = this.stack;
            let dimensions: [number, number, number, number] | null = null;

            if (stack_number !== null) {
                const stack = this.ext.auto_tiler?.forest.stacks.get(stack_number);
                if (stack) {
                    let stack_tab_height = stack.tab_height;

                    if (borderSize === 0 || this.grab) {
                        // not in max screen state
                        stack_tab_height = 0;
                    }

                    dimensions = [
                        x - borderSize,
                        y - stack_tab_height - borderSize,
                        width + 2 * borderSize,
                        height + stack_tab_height + 2 * borderSize,
                    ];
                }
            } else {
                dimensions = [x - borderSize, y - borderSize, width + 2 * borderSize, height + 2 * borderSize];
            }

            if (dimensions) {
                [x, y, width, height] = dimensions;

                const workspace = this.meta.get_workspace();

                if (workspace === null) return;

                const screen = workspace.get_work_area_for_monitor(this.monitor_id());
                width = Math.min(width, screen.x + screen.width);
                height = Math.min(height, screen.y + screen.height);

                border.set_position(x, y);
                border.set_size(width, height);
            }
        }
    }

    update_border_style() {
        const { settings } = this.ext;
        const color_value = settings.hint_color_rgba();
        const radius_value = settings.active_hint_border_radius();
        if (this.border) {
            this.border.set_style(`border-color: ${color_value}; border-radius: ${radius_value}px;`);
        }
    }

    private wm_class_changed() {
        if (this.is_tilable(this.ext)) {
            this.ext.connect_window(this);
            if (!this.meta.minimized) {
                this.ext.auto_tiler?.auto_tile(this.ext, this, this.ext.init);
            }
        }
    }

    private window_changed() {
        this.update_border_layout();
        this.ext.show_border_on_focused();
    }

    private window_raised() {
        this.restack(RESTACK_STATE.RAISED);
        this.ext.show_border_on_focused();
    }

    private workspace_changed() {
        this.restack(RESTACK_STATE.WORKSPACE_CHANGED);
    }
}

function pointer_in_work_area(): boolean {
    const cursor = lib.cursor_rect();
    const indice = global.display.get_current_monitor();
    const mon = global.display.get_workspace_manager().get_active_workspace().get_work_area_for_monitor(indice);
    return cursor.overlap(mon);
}

function place_pointer_on(ext: Ext, win: Meta.Window) {
    const rect = win.get_frame_rect();
    let x = rect.x;
    let y = rect.y;

    const key = Object.keys(focus.FocusPosition)[ext.settings.mouse_cursor_focus_location()];
    const pointer_position_ = focus.FocusPosition[key as keyof typeof focus.FocusPosition];

    switch (pointer_position_) {
        case focus.FocusPosition.TopLeft:
            x += 8;
            y += 8;
            break;
        case focus.FocusPosition.BottomLeft:
            x += 8;
            y += rect.height - 16;
            break;
        case focus.FocusPosition.TopRight:
            x += rect.width - 16;
            y += 8;
            break;
        case focus.FocusPosition.BottomRight:
            x += rect.width - 16;
            y += rect.height - 16;
            break;
        case focus.FocusPosition.Center:
            x += rect.width / 2 + 8;
            y += rect.height / 2 + 8;
            break;
        default:
            x += 8;
            y += 8;
    }

    global.stage.get_context().get_backend().get_default_seat().warp_pointer(x, y);
}

function pointer_already_on_window(meta: Meta.Window): boolean {
    const cursor = lib.cursor_rect();

    return cursor.overlap(meta.get_frame_rect());
}
