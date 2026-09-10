import type { Ext } from './extension.js';

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {
    PopupBaseMenuItem,
    PopupMenuItem,
    PopupSwitchMenuItem,
    PopupSeparatorMenuItem,
    PopupMenu,
} from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { get_current_path } from './paths.js';
// import * as Settings from './settings.js';

export class Indicator {
    button;

    toggle_tiled;
    toggle_active;
    border_radius;

    entry_gaps;

    constructor(ext: Ext) {
        const path = get_current_path();
        ext.button_auto_on_icon = Gio.icon_new_for_string(`${path}/icons/shatter-shell-auto-on-symbolic.svg`);
        ext.button_auto_off_icon = Gio.icon_new_for_string(`${path}/icons/shatter-shell-auto-off-symbolic.svg`);

        ext.button = this.button = new PanelMenu.Button(0.0, _('Shatter Shell Settings')) as
            PanelMenu.Button & { icon: St.Icon | null, };
        this.button.icon = new St.Icon({
            gicon: ext.settings.tile_by_default() ? ext.button_auto_on_icon : ext.button_auto_off_icon,
            style_class: 'system-status-icon',
        });

        this.button.add_child(this.button.icon);

        const bm = this.button.menu as PopupMenu;

        this.toggle_tiled = tiled(ext);

        this.toggle_active = toggle(_('Show Active Hint'), ext.settings.active_hint(), (toggle) => {
            ext.settings.set_active_hint(toggle.state);
        });

        this.entry_gaps = number_entry(_('Gaps'), ext.settings.gap_inner(), (value) => {
            ext.settings.set_gap_inner(value);
            ext.settings.set_gap_outer(value);
        });

        this.border_radius = number_entry(
            _('Active Border Radius'),
            {
                value: ext.settings.active_hint_border_radius(),
                min: 0,
                max: 30,
            },
            (value) => {
                ext.settings.set_active_hint_border_radius(value);
            },
        );

        bm.addMenuItem(this.toggle_tiled);
        bm.addMenuItem(floating_window_exceptions(ext, bm));

        bm.addMenuItem(menu_separator(''));
        bm.addMenuItem(shortcuts(bm));
        bm.addMenuItem(settings_button(bm));
        bm.addMenuItem(menu_separator(''));

        bm.addMenuItem(this.toggle_active);
        bm.addMenuItem(this.border_radius);

        // CSS Selector
        bm.addMenuItem(color_selector(ext, bm));

        bm.addMenuItem(this.entry_gaps);
    }

    destroy() {
        this.button.destroy();
    }
}

function menu_separator(text: string) {
    return new PopupSeparatorMenuItem(text);
}

function settings_button(menu: PopupMenu) {
    const item = new PopupMenuItem(_('View All'));
    item.connect('activate', () => {
        const path = GLib.find_program_in_path('shatter-shell-shortcuts');
        const [_success, _pid] = GLib.spawn_async(
            null,
            path
                ? [path]
                : ['xdg-open', 'https://support.system76.com/articles/pop-keyboard-shortcuts/'],
            null,
            GLib.SpawnFlags.SEARCH_PATH,
            null,
        );

        menu.close();
    });

    item.label.get_clutter_text().set_margin_left(12);

    return item;
}

function floating_window_exceptions(ext: Ext, menu: PopupMenu) {
    const label = new St.Label({ text: 'Floating Window Exceptions' });
    label.set_x_expand(true);

    const icon = new St.Icon({ icon_name: 'go-next-symbolic', icon_size: 16 });

    const widget = new St.BoxLayout({ orientation: Clutter.Orientation.HORIZONTAL });
    widget.add_child(label);
    widget.add_child(icon);
    widget.set_x_expand(true);

    const base = new PopupBaseMenuItem();
    base.add_child(widget);
    base.connect('activate', () => {
        ext.exception_dialog();

        GLib.timeout_add(GLib.PRIORITY_LOW, 300, () => {
            menu.close();
            return false;
        });
    });

    return base;
}

function shortcuts(menu: PopupMenu) {
    const layout_manager = new Clutter.GridLayout({ orientation: Clutter.Orientation.HORIZONTAL });
    const widget = new St.Widget({ layout_manager, x_expand: true });

    const item = new PopupBaseMenuItem();
    item.add_child(widget);
    item.connect('activate', () => {
        const path = GLib.find_program_in_path('shatter-shell-shortcuts');
        const [_success, _pid] = GLib.spawn_async(
            null,
            path
                ? [path]
                : ['xdg-open', 'https://support.system76.com/articles/pop-keyboard-shortcuts/'],
            null,
            GLib.SpawnFlags.SEARCH_PATH,
            null,
        );

        menu.close();
    });

    function create_label(text: string) {
        return new St.Label({ text });
    }

    function create_shortcut_label(text: string) {
        const label = create_label(text);
        label.set_x_align(Clutter.ActorAlign.END);
        return label;
    }

    layout_manager.set_row_spacing(12);
    layout_manager.set_column_spacing(30);
    layout_manager.attach(create_label(_('Shortcuts')), 0, 0, 2, 1);


    [
        [_('Navigate Windows'), _('Super + Arrow Keys')],
        [_('Toggle Tiling'), _('Super + Y')],
    ].forEach((section, idx) => {
        const key = create_label(section[0]);
        key.get_clutter_text().set_margin_left(12);

        const val = create_shortcut_label(section[1]);

        layout_manager.attach(key, 0, idx + 1, 1, 1);
        layout_manager.attach(val, 1, idx + 1, 1, 1);
    });

    return item;
}

function clamp(input: number, min = 0, max = 128): number {
    return Math.min(Math.max(min, input), max);
}

function number_entry(
    label: string,
    valueOrOptions: number | { value: number; min: number; max: number },
    callback: (a: number) => void,
) {
    let value = valueOrOptions,
        min: number,
        max: number;
    if (typeof valueOrOptions !== 'number') ({ value, min, max } = valueOrOptions);

    const entry = new St.Entry({
        text: String(value),
        input_purpose: Clutter.InputContentPurpose.NUMBER,
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: false,
    });

    entry.set_style('width: 5em');
    entry.connect('button-release-event', () => {
        return true;
    });

    const text = entry.clutter_text;
    text.set_max_length(2);

    entry.connect('key-release-event', (_, event) => {
        const symbol = event.get_key_symbol();

        const number: number | null =
            symbol == 65293 // enter key
                ? parse_number(text.text)
                : symbol == 65361 // left key
                    ? clamp(parse_number(text.text) - 1, min, max)
                    : symbol == 65363 // right key
                        ? clamp(parse_number(text.text) + 1, min, max)
                        : null;

        if (number !== null) {
            text.set_text(String(number));
        }
    });

    const create_icon = (icon_name: string) => {
        return new St.Icon({ icon_name, icon_size: 16 });
    };

    entry.set_primary_icon(create_icon('value-decrease'));
    entry.connect('primary-icon-clicked', () => {
        text.set_text(String(clamp(parseInt(text.get_text()) - 1, min, max)));
    });

    entry.set_secondary_icon(create_icon('value-increase'));
    entry.connect('secondary-icon-clicked', () => {
        text.set_text(String(clamp(parseInt(text.get_text()) + 1, min, max)));
    });

    text.connect('text-changed', () => {
        const input: string = text.get_text();
        let parsed = parseInt(input);

        if (isNaN(parsed)) {
            text.set_text(input.substr(0, input.length - 1));
            parsed = 0;
        }

        callback(parsed);
    });

    const item = new PopupMenuItem(label);
    item.label.get_clutter_text().set_x_expand(true);
    item.label.set_y_align(Clutter.ActorAlign.CENTER);
    item.add_child(entry);

    return item;
}

function parse_number(text: string): number {
    let number = parseInt(text, 10);
    if (isNaN(number)) {
        number = 0;
    }

    return number;
}

function toggle(desc: string, active: boolean, connect: (toggle: PopupSwitchMenuItem, state: boolean) => void) {
    const toggle = new PopupSwitchMenuItem(desc, active);

    toggle.label.set_y_align(Clutter.ActorAlign.CENTER);

    toggle.connect('toggled', (_, state: boolean) => {
        connect(toggle, state);
        return true;
    });

    return toggle;
}

function tiled(ext: Ext) {
    return toggle(_('Tile Windows'), null != ext.auto_tiler, (_, shouldTile) => {
        if (shouldTile) {
            ext.auto_tile_on();
        } else {
            ext.auto_tile_off();
        }
    });
}

function color_selector(ext: Ext, menu: PopupMenu) {
    const color_selector_item = new PopupMenuItem('Active Hint Color');
    const color_button = new St.Button();
    const settings = ext.settings;
    const selected_color = settings.hint_color_rgba();

    // TODO, find a way to expand the button text, :)
    color_button.label = '           '; // blank for now
    color_button.set_style(`background-color: ${selected_color}; border: 2px solid lightgray; border-radius: 2px`);

    settings.ext.connect('changed', (_, key) => {
        if (key === 'hint-color-rgba') {
            const color_value = settings.hint_color_rgba();
            color_button.set_style(`background-color: ${color_value}; border: 2px solid lightgray; border-radius: 2px`);
        }
    });

    color_button.set_x_align(Clutter.ActorAlign.END);
    color_button.set_x_expand(false);

    color_selector_item.label.get_clutter_text().set_x_expand(true);
    color_selector_item.label.set_y_align(Clutter.ActorAlign.CENTER);

    color_selector_item.add_child(color_button);
    color_button.connect('button-press-event', () => {
        const path = get_current_path() + '/color_dialog/main.js';
        const resp = GLib.spawn_command_line_async(`gjs --module ${path}`);
        if (!resp) {
            return null;
        }

        // clean up and focus on the color dialog
        GLib.timeout_add(GLib.PRIORITY_LOW, 300, () => {
            menu.close();
            return false;
        });
    });

    return color_selector_item;
}
