import Gtk from 'gi://Gtk?version=4.0';

import Gio from 'gi://Gio';
const Settings = Gio.Settings;
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as settings from './settings.js';
import * as log from './log.js';
import * as focus from './focus.js';

interface AppWidgets {
    stacking_with_mouse: Gtk.Switch;
    inner_gap: Gtk.Entry;
    mouse_cursor_follows_active_window: Gtk.Switch;
    outer_gap: Gtk.Entry;
    smart_gaps: Gtk.Switch;
    snap_to_grid: Gtk.Switch;
    mouse_cursor_focus_position: Gtk.ComboBoxText;
    log_level: Gtk.ComboBoxText;
    max_window_width: Gtk.Entry;
    untile_reset_windows: Gtk.Switch;
}

export default class ShatterShellPreferences extends ExtensionPreferences {
    getPreferencesWidget() {
        globalThis.shatterShellExtension = this;
        const dialog = settings_dialog_new();
        dialog.show();
        log.debug(JSON.stringify(dialog));
        return dialog;
    }
}

function settings_dialog_new(): Gtk.Grid {
    const [app, grid] = settings_dialog_view();

    const ext = new settings.ExtensionSettings();

    app.snap_to_grid.set_active(ext.snap_to_grid());
    app.snap_to_grid.connect('state-set', (_widget, state) => {
        ext.set_snap_to_grid(state);
        Settings.sync();
    });

    app.smart_gaps.set_active(ext.smart_gaps());
    app.smart_gaps.connect('state-set', (_widget, state) => {
        ext.set_smart_gaps(state);
        Settings.sync();
    });

    app.outer_gap.set_text(String(ext.gap_outer()));
    app.outer_gap.connect('activate', (widget) => {
        const parsed = parseInt(widget.get_text().trim());
        if (!isNaN(parsed)) {
            ext.set_gap_outer(parsed);
            Settings.sync();
        }
    });

    app.inner_gap.set_text(String(ext.gap_inner()));
    app.inner_gap.connect('activate', (widget) => {
        const parsed = parseInt(widget.get_text().trim());
        if (!isNaN(parsed)) {
            ext.set_gap_inner(parsed);
            Settings.sync();
        }
    });

    app.log_level.set_active(ext.log_level());
    app.log_level.connect('changed', () => {
        const active_id = parseInt(app.log_level.get_active_id()!);
        ext.set_log_level(active_id);
    });

    app.mouse_cursor_follows_active_window.set_active(ext.mouse_cursor_follows_active_window());
    app.mouse_cursor_follows_active_window.connect('state-set', (_widget, state) => {
        ext.set_mouse_cursor_follows_active_window(state);
        Settings.sync();
    });

    app.untile_reset_windows.set_active(ext.untile_reset_windows());
    app.untile_reset_windows.connect('state-set', (_widget, state) => {
        ext.set_untile_reset_windows(state);
        Settings.sync();
    });

    app.mouse_cursor_focus_position.set_active(ext.mouse_cursor_focus_location());
    app.mouse_cursor_focus_position.connect('changed', () => {
        const active_id = parseInt(app.mouse_cursor_focus_position.get_active_id()!);
        ext.set_mouse_cursor_focus_location(active_id);
    });

    app.stacking_with_mouse.set_active(ext.stacking_with_mouse());
    app.stacking_with_mouse.connect('state-set', (_widget, state) => {
        ext.set_stacking_with_mouse(state);
        Settings.sync();
    });

    app.max_window_width.set_text(String(ext.max_window_width()));
    app.max_window_width.connect('activate', (widget) => {
        const parsed = parseInt(widget.get_text().trim());
        if (!isNaN(parsed)) {
            ext.set_max_window_width(parsed);
            Settings.sync();
        }
    });

    return grid;
}

function settings_dialog_view(): [AppWidgets, Gtk.Grid] {
    const grid = new Gtk.Grid({
        column_spacing: 12,
        row_spacing: 12,
        margin_start: 10,
        margin_end: 10,
        margin_bottom: 10,
        margin_top: 10,
    });

    const snap_label = new Gtk.Label({
        label: 'Snap to Grid (Floating Mode)',
        xalign: 0.0,
    });

    const smart_label = new Gtk.Label({
        label: 'Smart Gaps',
        xalign: 0.0,
    });

    const mouse_cursor_follows_active_window_label = new Gtk.Label({
        label: 'Mouse Cursor Follows Active Window',
        xalign: 0.0,
    });

    const stacking_with_mouse = new Gtk.Label({
        label: 'Allow stacking with mouse',
        xalign: 0.0,
    });

    const max_window_width_label = new Gtk.Label({
        label: 'Max window width (in pixels); 0 to disable',
        xalign: 0.0,
    });

    const untile_reset_windows_label = new Gtk.Label({
        label: 'Reset windows to their previous position if tiling is disabled',
        xalign: 0.0,
    });

    const [inner_gap, outer_gap] = gaps_section(grid, 7);

    const settings: AppWidgets = {
        inner_gap,
        outer_gap,
        stacking_with_mouse: new Gtk.Switch({ halign: Gtk.Align.END }),
        smart_gaps: new Gtk.Switch({ halign: Gtk.Align.END }),
        snap_to_grid: new Gtk.Switch({ halign: Gtk.Align.END }),
        mouse_cursor_follows_active_window: new Gtk.Switch({ halign: Gtk.Align.END }),
        untile_reset_windows: new Gtk.Switch({ halign: Gtk.Align.END }),
        mouse_cursor_focus_position: build_combo(grid, 5, focus.FocusPosition, 'Mouse Cursor Focus Position'),
        log_level: build_combo(grid, 6, log.LOG_LEVELS, 'Log Level'),
        max_window_width: number_entry(),
    };

    grid.attach(snap_label, 0, 0, 1, 1);
    grid.attach(settings.snap_to_grid, 1, 0, 1, 1);

    grid.attach(smart_label, 0, 1, 1, 1);
    grid.attach(settings.smart_gaps, 1, 1, 1, 1);

    grid.attach(stacking_with_mouse, 0, 2, 1, 1);
    grid.attach(settings.stacking_with_mouse, 1, 2, 1, 1);

    grid.attach(mouse_cursor_follows_active_window_label, 0, 3, 1, 1);
    grid.attach(settings.mouse_cursor_follows_active_window, 1, 3, 1, 1);

    grid.attach(untile_reset_windows_label, 0, 4, 1, 1);
    grid.attach(settings.untile_reset_windows, 1, 4, 1, 1);

    grid.attach(max_window_width_label, 0, 10, 1, 1);
    grid.attach(settings.max_window_width, 1, 10, 1, 1);

    return [settings, grid];
}

function gaps_section(grid: Gtk.Grid, top: number): [Gtk.Entry, Gtk.Entry] {
    const outer_label = new Gtk.Label({
        label: 'Outer',
        xalign: 0.0,
        margin_start: 24,
    });

    const outer_entry = number_entry();

    const inner_label = new Gtk.Label({
        label: 'Inner',
        xalign: 0.0,
        margin_start: 24,
    });

    const inner_entry = number_entry();

    const section_label = new Gtk.Label({
        label: 'Gaps (in pixels)',
        xalign: 0.0,
    });

    grid.attach(section_label, 0, top, 1, 1);
    grid.attach(outer_label, 0, top + 1, 1, 1);
    grid.attach(outer_entry, 1, top + 1, 1, 1);
    grid.attach(inner_label, 0, top + 2, 1, 1);
    grid.attach(inner_entry, 1, top + 2, 1, 1);

    return [inner_entry, outer_entry];
}

function number_entry(): Gtk.Entry {
    return new Gtk.Entry({ input_purpose: Gtk.InputPurpose.NUMBER });
}

function build_combo<Enum extends Record<string, number | string>>(grid: Gtk.Grid, top_index: number, iter_enum: Enum, label: string): Gtk.ComboBoxText {
    const label_ = new Gtk.Label({
        label: label,
        halign: Gtk.Align.START,
    });

    grid.attach(label_, 0, top_index, 1, 1);

    const combo = new Gtk.ComboBoxText();

    for (const [index, key] of Object.keys(iter_enum).entries()) {
        if (typeof iter_enum[key] == 'string') {
            combo.append(`${index}`, iter_enum[key]);
        }
    }

    grid.attach(combo, 1, top_index, 1, 1);
    return combo;
}
