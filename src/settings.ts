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

export const DEFAULT_HINT_COLOR = 'rgba(53, 132, 228, 1)'; // adwaita blue

export const extSettings = gio_settings_from_schema('org.gnome.shell.extensions.shatter-shell');

export class ExtensionSettings {
    readonly ext = extSettings;
    readonly int = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
    readonly mutter = new Gio.Settings({ schema_id: 'org.gnome.mutter' });
    readonly shell = maybe_gio_settings('org.gnome.shell.extensions.user-theme');

    get_active_hint() { return this.ext.get_boolean('active-hint'); }
    set_active_hint(value: boolean) { this.ext.set_boolean('active-hint', value); }

    get_active_hint_border_radius() { return this.ext.get_uint('active-hint-border-radius'); }
    set_active_hint_border_radius(value: number) { this.ext.set_uint('active-hint-border-radius', value); }

    get_stacking_with_mouse(): boolean { return this.ext.get_boolean('stacking-with-mouse'); }
    set_stacking_with_mouse(value: boolean) { this.ext.set_boolean('stacking-with-mouse', value); }

    get_column_size() { return this.ext.get_uint('column-size'); }
    set_column_size(value: number) { this.ext.set_uint('column-size', value); }

    get_gap_inner() { return this.ext.get_uint('gap-inner'); }
    set_gap_inner(value: number) { this.ext.set_uint('gap-inner', value); }

    get_gap_outer() { return this.ext.get_uint('gap-outer'); }
    set_gap_outer(value: number) { this.ext.set_uint('gap-outer', value); }

    get_hint_color_rgba() { return this.ext.get_string('hint-color-rgba'); }
    set_hint_color_rgba(value: string) { this.ext.set_string('hint-color-rgba', value); }

    get_row_size() { return this.ext.get_uint('row-size'); }
    set_row_size(value: number) { this.ext.set_uint('row-size', value); }

    get_smart_gaps() { return this.ext.get_boolean('smart-gaps'); }
    set_smart_gaps(value: boolean) { this.ext.set_boolean('smart-gaps', value); }

    get_snap_to_grid() { return this.ext.get_boolean('snap-to-grid'); }
    set_snap_to_grid(value: boolean) { this.ext.set_boolean('snap-to-grid', value); }

    get_tile_by_default() { return this.ext.get_boolean('tile-by-default'); }
    set_tile_by_default(value: boolean) { this.ext.set_boolean('tile-by-default', value); }

    get_untile_reset_windows() { return this.ext.get_boolean('untile-reset-windows'); }
    set_untile_reset_windows(value: boolean) { this.ext.set_boolean('untile-reset-windows', value); }

    get_log_level(): LogLevel { return this.ext.get_uint('log-level'); }
    set_log_level(value: LogLevel) { this.ext.set_uint('log-level', value); }

    get_mouse_cursor_follows_active_window() { return this.ext.get_boolean('mouse-cursor-follows-active-window'); }
    set_mouse_cursor_follows_active_window(value: boolean) { this.ext.set_boolean('mouse-cursor-follows-active-window', value); }

    get_mouse_cursor_focus_location() { return this.ext.get_uint('mouse-cursor-focus-location'); }
    set_mouse_cursor_focus_location(value: number) { this.ext.set_uint('mouse-cursor-focus-location', value); }

    get_max_window_width() { return this.ext.get_uint('max-window-width'); }
    set_max_window_width(value: number) { this.ext.set_uint('max-window-width', value); }

    get_oversized_window_width() { return this.ext.get_uint('oversized-window-width'); }
    set_oversized_window_width(value: number) { this.ext.set_uint('oversized-window-width', value); }

    get_oversized_window_height() { return this.ext.get_uint('oversized-window-height'); }
    set_oversized_window_height(value: number) { this.ext.set_uint('oversized-window-height', value); }

    get_need_overrides_setup() { return this.ext.get_boolean('need-overrides-setup'); }
    set_need_overrides_setup(value: boolean) { this.ext.set_boolean('need-overrides-setup', value); }

    // External

    // TODO: Use real dark mode and high contrast settings rather than the gtk theme
    theme() {
        return this.shell
            ? this.shell.get_string('name')
            : this.int.get_string('gtk-theme');
    }

    is_dark() {
        const theme = this.theme().toLowerCase();
        return DARK.some(dark => theme.includes(dark));
    }

    is_high_contrast() {
        return this.theme().toLowerCase() === 'highcontrast';
    }

    get_dynamic_workspaces() { return this.mutter.get_boolean('dynamic-workspaces'); }

    get_workspaces_only_on_primary() { return this.mutter.get_boolean('workspaces-only-on-primary'); }

    set_edge_tiling(value: boolean) { this.mutter.set_boolean('edge-tiling', value); }
}
