import Gio from 'gi://Gio';
import { get_current_path } from './paths.js';
import { type LogLevel } from './log_level.js';

const DARK = ['dark', 'adapta', 'plata', 'dracula'];

function maybe_gio_settings(schema_id: string): Gio.Settings | null {
    try {
        return new Gio.Settings({ schema_id });
    } catch {
        return null;
    }
}

function gio_settings_from_schema(schema: string): Gio.Settings {
    const GioSSS = Gio.SettingsSchemaSource;
    const schemaDir = Gio.File.new_for_path(get_current_path()).get_child('schemas');

    const schemaSource = schemaDir.query_exists(null)
        ? GioSSS.new_from_directory(schemaDir.get_path()!, GioSSS.get_default(), false)
        : GioSSS.get_default();

    const schemaObj = schemaSource?.lookup(schema, true);

    if (!schemaObj) {
        throw new Error(`Schema ${schema} could not be found for Shatter Shell. Please check your installation.`);
    }

    return new Gio.Settings({ settings_schema: schemaObj });
}

const ACTIVE_HINT = 'active-hint';
const ACTIVE_HINT_BORDER_RADIUS = 'active-hint-border-radius';
const STACKING_WITH_MOUSE = 'stacking-with-mouse';
const COLUMN_SIZE = 'column-size';
const EDGE_TILING = 'edge-tiling';
const GAP_INNER = 'gap-inner';
const GAP_OUTER = 'gap-outer';
const ROW_SIZE = 'row-size';
const SMART_GAPS = 'smart-gaps';
const SNAP_TO_GRID = 'snap-to-grid';
const TILE_BY_DEFAULT = 'tile-by-default';
const UNTILE_RESET_WINDOWS = 'untile-reset-windows';
const HINT_COLOR_RGBA = 'hint-color-rgba';
export const DEFAULT_HINT_COLOR = 'rgba(53, 132, 228, 1)'; // adwaita blue
const LOG_LEVEL = 'log-level';
const MOUSE_CURSOR_FOLLOWS_ACTIVE_WINDOW = 'mouse-cursor-follows-active-window';
const MOUSE_CURSOR_FOCUS_LOCATION = 'mouse-cursor-focus-location';
const MAX_WINDOW_WIDTH = 'max-window-width';
const OVERSIZED_WINDOW_WIDTH = 'oversized-window-width';
const OVERSIZED_WINDOW_HEIGHT = 'oversized-window-height';
const NEED_OVERRIDES_SETUP = 'need-overrides-setup';

export const extSettings = gio_settings_from_schema('org.gnome.shell.extensions.shatter-shell');

export class ExtensionSettings {
    ext = extSettings;
    int = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
    mutter = new Gio.Settings({ schema_id: 'org.gnome.mutter' });
    shell = maybe_gio_settings('org.gnome.shell.extensions.user-theme');

    // Getters

    active_hint(): boolean {
        return this.ext.get_boolean(ACTIVE_HINT);
    }

    active_hint_border_radius(): number {
        return this.ext.get_uint(ACTIVE_HINT_BORDER_RADIUS);
    }

    stacking_with_mouse(): boolean {
        return this.ext.get_boolean(STACKING_WITH_MOUSE);
    }

    column_size(): number {
        return this.ext.get_uint(COLUMN_SIZE);
    }

    dynamic_workspaces(): boolean {
        return this.mutter.get_boolean('dynamic-workspaces');
    }

    gap_inner(): number {
        return this.ext.get_uint(GAP_INNER);
    }

    gap_outer(): number {
        return this.ext.get_uint(GAP_OUTER);
    }

    hint_color_rgba(): string {
        return this.ext.get_string(HINT_COLOR_RGBA);
    }

    theme(): string {
        return this.shell
            ? this.shell.get_string('name')
            : this.int.get_string('gtk-theme');
    }

    is_dark(): boolean {
        const theme = this.theme().toLowerCase();
        return DARK.some(dark => theme.includes(dark));
    }

    is_high_contrast(): boolean {
        return this.theme().toLowerCase() === 'highcontrast';
    }

    row_size(): number {
        return this.ext.get_uint(ROW_SIZE);
    }

    smart_gaps(): boolean {
        return this.ext.get_boolean(SMART_GAPS);
    }

    snap_to_grid(): boolean {
        return this.ext.get_boolean(SNAP_TO_GRID);
    }

    tile_by_default(): boolean {
        return this.ext.get_boolean(TILE_BY_DEFAULT);
    }

    untile_reset_windows(): boolean {
        return this.ext.get_boolean(UNTILE_RESET_WINDOWS);
    }

    workspaces_only_on_primary(): boolean {
        return this.mutter.get_boolean('workspaces-only-on-primary');
    }

    log_level(): LogLevel {
        return this.ext.get_uint(LOG_LEVEL);
    }

    mouse_cursor_follows_active_window(): boolean {
        return this.ext.get_boolean(MOUSE_CURSOR_FOLLOWS_ACTIVE_WINDOW);
    }

    mouse_cursor_focus_location(): number {
        return this.ext.get_uint(MOUSE_CURSOR_FOCUS_LOCATION);
    }

    max_window_width(): number {
        return this.ext.get_uint(MAX_WINDOW_WIDTH);
    }

    oversized_window_width(): number {
        return this.ext.get_uint(OVERSIZED_WINDOW_WIDTH);
    }

    oversized_window_height(): number {
        return this.ext.get_uint(OVERSIZED_WINDOW_HEIGHT);
    }

    need_overrides_setup(): boolean {
        return this.ext.get_boolean(NEED_OVERRIDES_SETUP);
    }

    // Setters

    set_active_hint(set: boolean) {
        this.ext.set_boolean(ACTIVE_HINT, set);
    }

    set_active_hint_border_radius(set: number) {
        this.ext.set_uint(ACTIVE_HINT_BORDER_RADIUS, set);
    }

    set_stacking_with_mouse(set: boolean) {
        this.ext.set_boolean(STACKING_WITH_MOUSE, set);
    }

    set_column_size(size: number) {
        this.ext.set_uint(COLUMN_SIZE, size);
    }

    set_edge_tiling(enable: boolean) {
        this.mutter?.set_boolean(EDGE_TILING, enable);
    }

    set_gap_inner(gap: number) {
        this.ext.set_uint(GAP_INNER, gap);
    }

    set_gap_outer(gap: number) {
        this.ext.set_uint(GAP_OUTER, gap);
    }

    set_hint_color_rgba(color: string) {
        this.ext.set_string(HINT_COLOR_RGBA, color);
    }

    set_row_size(size: number) {
        this.ext.set_uint(ROW_SIZE, size);
    }

    set_smart_gaps(set: boolean) {
        this.ext.set_boolean(SMART_GAPS, set);
    }

    set_snap_to_grid(set: boolean) {
        this.ext.set_boolean(SNAP_TO_GRID, set);
    }

    set_tile_by_default(set: boolean) {
        this.ext.set_boolean(TILE_BY_DEFAULT, set);
    }

    set_untile_reset_windows(set: boolean) {
        this.ext.set_boolean(UNTILE_RESET_WINDOWS, set);
    }

    set_log_level(set: LogLevel) {
        this.ext.set_uint(LOG_LEVEL, set);
    }

    set_mouse_cursor_follows_active_window(set: boolean) {
        this.ext.set_boolean(MOUSE_CURSOR_FOLLOWS_ACTIVE_WINDOW, set);
    }

    set_mouse_cursor_focus_location(set: number) {
        this.ext.set_uint(MOUSE_CURSOR_FOCUS_LOCATION, set);
    }

    set_max_window_width(set: number) {
        this.ext.set_uint(MAX_WINDOW_WIDTH, set);
    }

    set_oversized_window_width(set: number) {
        this.ext.set_uint(OVERSIZED_WINDOW_WIDTH, set);
    }

    set_oversized_window_height(set: number) {
        this.ext.set_uint(OVERSIZED_WINDOW_HEIGHT, set);
    }

    set_need_overrides_setup(set: boolean) {
        this.ext.set_boolean(NEED_OVERRIDES_SETUP, set);
    }
}
