import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk?version=4.0';

import Gio from 'gi://Gio';
const Settings = Gio.Settings;
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as settings from './settings.js';
import * as focus from './focus.js';
import { LogLevel } from './log_level.js';

export default class ShatterShellPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window: Adw.PreferencesWindow) {
        const ext = new settings.ExtensionSettings();

        const page = new Adw.PreferencesPage();
        window.add(page);
        window.default_height = 720;

        {
            const group = new Adw.PreferencesGroup({ title: 'General' });
            page.add(group);

            {
                const row = new Adw.SwitchRow({
                    title: 'Allow stacking with mouse',
                    subtitle: 'Drag a window over another to stack them',
                    active: ext.stacking_with_mouse(),
                });
                row.connect('notify::active', (row) => {
                    ext.set_stacking_with_mouse(row.active);
                    Settings.sync();
                });
                group.add(row);
            }

            {
                const row = new Adw.SpinRow({
                    title: 'Max window width',
                    subtitle: '0 to disable',
                    adjustment: new Gtk.Adjustment({
                        lower: 0,
                        upper: 9999,
                        value: ext.max_window_width(),
                        step_increment: 1,
                        page_increment: 100,
                    }),
                    numeric: true,
                    digits: 0,
                    snap_to_ticks: true,
                });
                row.connect('notify::value', (row) => {
                    const value = row.value;
                    ext.set_max_window_width(value);
                    Settings.sync();
                });
                group.add(row);
            }

            {
                const row = new Adw.SwitchRow({
                    title: 'Snap floating windows to grid',
                    subtitle: 'Move windows in discrete steps',
                    active: ext.snap_to_grid(),
                });
                row.connect('notify::active', (row) => {
                    ext.set_snap_to_grid(row.active);
                    Settings.sync();
                });
                group.add(row);
            }

            {
                const row = new Adw.SwitchRow({
                    title: 'Reset untiled window\'s position',
                    subtitle: 'Restore previous position if tiling is disabled',
                    active: ext.untile_reset_windows(),
                });
                row.connect('notify::active', (row) => {
                    ext.set_untile_reset_windows(row.active);
                    Settings.sync();
                });
                group.add(row);
            }

            {
                const row = new Adw.ComboRow({
                    title: 'Log level',
                    subtitle: 'For developers',
                    model: Gtk.StringList.new(Object.values(LogLevel).filter(option => typeof option == 'string')),
                    selected: ext.log_level(),
                });
                row.connect('notify::selected', (row) => {
                    ext.set_log_level(row.selected);
                    Settings.sync();
                });
                group.add(row);
            }
        }

        {
            const group = new Adw.PreferencesGroup({ title: 'Gaps' });
            page.add(group);

            {
                const row = new Adw.SpinRow({
                    title: 'Inner gap',
                    subtitle: 'Gap between tiled windows',
                    adjustment: new Gtk.Adjustment({
                        lower: 0,
                        upper: 99,
                        value: ext.gap_inner(),
                        step_increment: 1,
                        page_increment: 4,
                    }),
                    numeric: true,
                    digits: 0,
                    snap_to_ticks: true,
                });
                row.connect('notify::value', (row) => {
                    const value = row.value;
                    ext.set_gap_inner(value);
                    Settings.sync();
                });
                group.add(row);
            }

            {
                const row = new Adw.SpinRow({
                    title: 'Outer gap',
                    subtitle: 'Gap around the monitor edge',
                    adjustment: new Gtk.Adjustment({
                        lower: 0,
                        upper: 99,
                        value: ext.gap_outer(),
                        step_increment: 1,
                        page_increment: 4,
                    }),
                    numeric: true,
                    digits: 0,
                    snap_to_ticks: true,
                });
                row.connect('notify::value', (row) => {
                    const value = row.value;
                    ext.set_gap_outer(value);
                    Settings.sync();
                });
                group.add(row);
            }

            {
                const row = new Adw.SwitchRow({
                    title: 'Smart gaps',
                    subtitle: 'Remove outer gap when only one window',
                    active: ext.smart_gaps(),
                });
                row.connect('notify::active', (row) => {
                    ext.set_smart_gaps(row.active);
                    Settings.sync();
                });
                group.add(row);
            }
        }

        {
            const group = new Adw.PreferencesGroup({ title: 'Mouse cursor' });
            page.add(group);

            {
                const row = new Adw.SwitchRow({
                    title: 'Mouse cursor follows active window',
                    subtitle: 'Automatically moves your mouse when switching windows',
                    active: ext.mouse_cursor_follows_active_window(),
                });
                row.connect('notify::active', (row) => {
                    ext.set_mouse_cursor_follows_active_window(row.active);
                    Settings.sync();
                });
                group.add(row);
            }

            {
                const row = new Adw.ComboRow({
                    title: 'Mouse cursor focus position',
                    subtitle: 'Controls where the mouse moves if the above is enabled',
                    model: Gtk.StringList.new(Object.values(focus.FocusPosition)),
                    selected: ext.mouse_cursor_focus_location(),
                });
                row.connect('notify::selected', (row) => {
                    ext.set_mouse_cursor_focus_location(row.selected);
                    Settings.sync();
                });
                group.add(row);
            }
        }

        return Promise.resolve();
    }
}
