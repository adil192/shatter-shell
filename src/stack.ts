import type { Entity } from './ecs.js';
import type { Ext } from './extension.js';
import type { ShellWindow } from './window.js';

import * as Ecs from './ecs.js';
import * as a from './arena.js';

const Arena = a.Arena;
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';
import St from 'gi://St';
import { ExtensionSettings } from './settings.js';

enum TabActive { active, inactive, urgent }

export const TAB_HEIGHT_UNSCALED = 43 as const;

/** Space between the tab bar and the window. This should be subtracted from TAB_HEIGHT_UNSCALED. */
const TAB_SEPARATION_UNSCALED = 3 as const;

interface Tab {
    active: boolean;
    entity: Entity;
    button: number;
    button_signal: SignalID | null;
    signals: Array<SignalID>;
}

interface StackWidgets {
    tabs: St.Widget;
}

function stack_widgets_new(): StackWidgets {
    const tabs = new St.BoxLayout({
        style_class: 'shatter-shell-stack',
        x_expand: true,
    });

    tabs.get_layout_manager()?.set_homogeneous(true);

    return { tabs };
}

interface TabButton extends St.Button {
    set_title: (title: string) => void;
    set_active: (style: TabActive, settings: ExtensionSettings) => void;
}

const TabButton = GObject.registerClass(
    {
        Signals: { activate: {} },
    },
    class TabButton extends St.Button {
        _title?: St.Label;

        _styles: { class: string } = {
            class: 'shatter-shell-tab shatter-shell-tab-inactive',
        };

        _init(window: ShellWindow) {
            const icon = window.icon(Math.floor(TAB_HEIGHT_UNSCALED * 0.4));
            icon.set_x_align(Clutter.ActorAlign.START);
            icon.set_style('padding: 4px; margin-left: 4px;');

            const title = new St.Label({
                y_expand: true,
                x_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                style: 'padding-left: 4px; padding-right: 4px;',
                text: window.title(),
            });

            const close_button = new St.Button({
                child: new St.Icon({
                    icon_name: 'window-close-symbolic',
                    icon_size: Math.floor(TAB_HEIGHT_UNSCALED * 0.4),
                    y_align: Clutter.ActorAlign.CENTER,
                }),
                y_expand: true,
                x_align: Clutter.ActorAlign.END,
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'shatter-shell-window-close',
            });
            close_button.connect('clicked', () => {
                window.meta.delete(global.get_current_time());
            });

            const container = new St.BoxLayout({
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
            });
            container.add_child(icon);
            container.add_child(title);
            container.add_child(close_button);

            super._init({
                child: container,
                x_expand: true,
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._title = title;
        }

        set_title(text: string) {
            if (this._title) {
                this._title.text = text;
            }
        }

        set_active(style: TabActive, settings: ExtensionSettings) {
            switch (style) {
                case TabActive.active:
                    this._styles.class = 'shatter-shell-tab shatter-shell-tab-active';
                    break;
                case TabActive.inactive:
                    // Don't dismiss urgent state
                    if (this._styles.class.includes('shatter-shell-tab-urgent')) return;

                    this._styles.class = 'shatter-shell-tab shatter-shell-tab-inactive';
                    break;
                case TabActive.urgent:
                    this._styles.class = 'shatter-shell-tab shatter-shell-tab-urgent';
                    break;
            }
            this._update_style(settings);
        }

        _update_style(settings: ExtensionSettings) {
            const hint_color_rgba = settings.hint_color_rgba();
            const style = `--accent-color: ${hint_color_rgba}; `;

            this.set_style_class_name(this._styles.class);
            this.set_style(style);
        }
    },
);

export class Stack {
    ext: Ext;

    widgets: null | StackWidgets = null;

    active: Entity;

    active_id: number = 0;

    prev_active: null | Entity = null;
    prev_active_id: number = 0;

    tabs: Array<Tab> = [];

    monitor: number;

    workspace: number;

    buttons: a.Arena<TabButton> = new Arena();

    tab_height: number;
    tab_separation: number;

    stack_rect: Mtk.Rectangle = new Mtk.Rectangle({ x: 0, y: 0, width: 0, height: 0 });

    private active_signals: [SignalID, SignalID] | null = null;

    private rect: Mtk.Rectangle = new Mtk.Rectangle({ x: 0, y: 0, width: 0, height: 0 });

    private restacker: SignalID = global.display.connect('restacked', () => this.restack());

    private tabs_destroy: SignalID;

    constructor(ext: Ext, active: Entity, workspace: number, monitor: number) {
        this.ext = ext;
        this.active = active;
        this.monitor = monitor;
        this.workspace = workspace;
        this.tab_height = TAB_HEIGHT_UNSCALED * this.ext.dpi;
        this.tab_separation = TAB_SEPARATION_UNSCALED * this.ext.dpi;

        this.widgets = stack_widgets_new();

        global.window_group.add_child(this.widgets.tabs);

        this.reposition();

        this.tabs_destroy = this.widgets.tabs.connect('destroy', () => this.recreate_widgets());
    }

    /** Adds a new window to the stack */
    add(window: ShellWindow) {
        if (!this.widgets) return;

        const entity = window.entity;
        const active = Ecs.entity_eq(entity, this.active);

        const button = new TabButton(window);
        button.natural_height = this.tab_height - this.tab_separation;
        const id = this.buttons.insert(button);

        const tab: Tab = { active, entity, signals: [], button: id, button_signal: null };
        const comp = this.tabs.length;
        this.bind_hint_events(tab);
        this.tabs.push(tab);
        this.watch_signals(comp, id, window);
        this.widgets.tabs.add_child(button);

        const actor = window.meta.get_compositor_private<Clutter.Actor | null>();
        if (actor) {
            actor.remove_all_transitions();
            if (active) {
                actor.opacity = 255;
                actor.show();
            } else {
                actor.opacity = 0;
                actor.hide();
            }
        }
    }

    /** Activates a tab based on the previously active entry */
    auto_activate(): null | Entity {
        if (this.tabs.length === 0) return null;

        if (this.tabs.length <= this.active_id) {
            this.active_id = this.tabs.length - 1;
        }

        const c = this.tabs[this.active_id];

        this.activate(c.entity);
        return c.entity;
    }

    activate_prev() {
        if (this.prev_active) {
            this.activate(this.prev_active);
        }
    }

    /** Activates the tab of this entity, and hides other windows. */
    activate(entity: Entity) {
        const permitted = this.permitted_to_show();

        if (this.widgets) this.widgets.tabs.visible = permitted;

        this.reset_visibility(permitted);

        const win = this.ext.windows.get(entity);
        if (!win) return;

        if (!Ecs.entity_eq(entity, this.active)) {
            this.prev_active = this.active;
            this.prev_active_id = this.active_id;
        }

        this.active_connect(win.meta, entity);

        let id = 0;

        for (const [_idx, tab] of this.tabs.entries()) {
            let tab_active: TabActive;

            this.window_exec(id, tab.entity, (window) => {
                const actor = window.meta.get_compositor_private<Clutter.Actor | null>();

                if (Ecs.entity_eq(entity, tab.entity)) {
                    this.active_id = id;
                    tab.active = true;
                    tab_active = TabActive.active;
                    if (actor) this.fade_in(actor);
                } else {
                    tab.active = false;
                    tab_active = TabActive.inactive;
                    if (actor) this.fade_out(actor);
                }

                const button = this.buttons.get(tab.button);
                if (button) {
                    button.set_active(tab_active, this.ext.settings);
                }
            });

            id += 1;
        }
    }

    private fade_in(actor: Clutter.Actor) {
        if (actor.visible && actor.opacity >= 255) return;
        actor.remove_all_transitions();
        actor.show();
        actor.ease({
            opacity: 255,
            duration: 100 * (1 - actor.opacity / 255),
            mode: Clutter.AnimationMode.EASE_OUT,
        });
    }

    private fade_out(actor: Clutter.Actor) {
        if (!actor.visible) return;
        actor.remove_all_transitions();
        actor.ease({
            opacity: 0,
            duration: 150 * (actor.opacity / 255),
            mode: Clutter.AnimationMode.EASE_IN,
            onComplete: () => actor.hide(),
        });
    }

    /** Connects `on_window_changed` callbacks to the newly-active window */
    private active_connect(window: Meta.Window, active: Entity) {
        // Disconnect before attaching new window as active window
        this.active_disconnect();

        // Memorize them for future calls
        this.active = active;

        this.active_reconnect(window);
    }

    private active_reconnect(window: Meta.Window) {
        // Attach this callback on both signals of the window
        const on_window_changed = () =>
            this.on_grab(() => {
                const window = this.ext.windows.get(this.active);
                if (window) {
                    this.update_positions(window.meta.get_frame_rect());
                    this.window_changed();
                } else {
                    this.active_disconnect();
                }
            });

        this.active_signals = [
            window.connect('size-changed', on_window_changed),
            window.connect('position-changed', on_window_changed),
        ];
    }

    /** Disconnects signals from the active window in the stack */
    private active_disconnect() {
        const active_meta = this.active_meta();

        if (this.active_signals && active_meta) {
            for (const s of this.active_signals) active_meta.disconnect(s);
        }

        this.active_signals = null;
    }

    private active_meta(): Meta.Window | undefined {
        return this.ext.windows.get(this.active)?.meta;
    }

    private bind_hint_events(tab: Tab) {
        const settings = this.ext.settings;
        const button = this.buttons.get(tab.button);
        if (button) {
            const change_id = settings.ext.connect('changed', (_, key) => {
                if (key === 'hint-color-rgba') {
                    const active = Ecs.entity_eq(tab.entity, this.active);
                    button.set_active(active ? TabActive.active : TabActive.inactive, settings);
                }
                return false;
            });
            button.connect('destroy', () => {
                settings.ext.disconnect(change_id);
            });
            const active = Ecs.entity_eq(tab.entity, this.active);
            button.set_active(active ? TabActive.active : TabActive.inactive, settings);
        }
    }

    /** Clears watched tabs and removes all tabs */
    clear() {
        this.active_disconnect();
        for (const c of this.tabs.splice(0)) this.tab_disconnect(c);
        this.widgets?.tabs.destroy_all_children();
        this.buttons.truncate(0);
    }

    /** Disconnects a tab from the stack */
    tab_disconnect(c: Tab) {
        const window = this.ext.windows.get(c.entity);
        if (window) {
            for (const s of c.signals) window.meta.disconnect(s);
            if (this.workspace === this.ext.active_workspace()) {
                const actor = window.meta.get_compositor_private<Clutter.Actor | null>();
                if (actor) this.fade_in(actor);
            }
        }

        c.signals = [];

        if (c.button_signal) {
            const b = this.buttons.get(c.button);
            if (b) {
                b.disconnect(c.button_signal);
                c.button_signal = null;
            }
        }
    }

    /** Deactivate the signals belonging to an entity */
    deactivate(w: ShellWindow) {
        for (const c of this.tabs)
            if (Ecs.entity_eq(c.entity, w.entity)) {
                this.tab_disconnect(c);
            }

        if (this.active_signals && Ecs.entity_eq(this.active, w.entity)) {
            this.active_disconnect();
        }
    }

    /** Disconnects this stack's signal, and destroys its widgets */
    destroy() {
        global.display.disconnect(this.restacker);
        this.active_disconnect();

        // Disconnect stack signals from each window, and unhide them.
        for (const c of this.tabs) {
            this.tab_disconnect(c);
            if (this.workspace === this.ext.active_workspace()) {
                const win = this.ext.windows.get(c.entity);
                if (win) {
                    const actor = win.meta.get_compositor_private<Clutter.Actor | null>();
                    if (actor) this.fade_in(actor);
                    win.stack = null;
                }
            }
        }

        for (const b of this.buttons.values()) {
            try {
                b.destroy();
            } catch (_) { /* empty */ }
        }

        if (this.widgets) {
            const tabs = this.widgets.tabs;
            this.widgets = null;
            tabs.destroy();
        }
    }

    private on_grab(or: () => void) {
        if (this.ext.grab_op !== null) {
            if (Ecs.entity_eq(this.ext.grab_op.entity, this.active)) {
                if (this.widgets) {
                    const parent = this.widgets.tabs.get_parent();
                    const actor = this.active_meta()?.get_compositor_private<Clutter.Actor | null>();
                    if (actor && parent) {
                        parent.set_child_below_sibling(this.widgets.tabs, actor);
                    }
                }

                return;
            }
        }

        or();
    }

    /** Workaround for when GNOME Shell destroys our widgets when they're reparented
     *  in an active workspace change. */
    recreate_widgets() {
        if (this.widgets !== null) {
            this.widgets.tabs.disconnect(this.tabs_destroy);
            this.widgets = stack_widgets_new();

            global.window_group.add_child(this.widgets.tabs);

            this.tabs_destroy = this.widgets.tabs.connect('destroy', () => this.recreate_widgets());

            this.active_disconnect();

            for (const c of this.tabs.splice(0)) {
                this.tab_disconnect(c);
                const window = this.ext.windows.get(c.entity);
                if (window) this.add(window);
            }

            this.update_positions(this.rect);
            this.restack();

            const window = this.ext.windows.get(this.active);
            if (!window) return;

            this.active_reconnect(window.meta);
        }
    }

    remove_by_pos(idx: number) {
        const c = this.tabs[idx];
        if (c) this.remove_tab_component(c, idx);
    }

    remove_tab_component(c: Tab, idx: number) {
        if (!this.widgets) return;

        this.tab_disconnect(c);

        const b = this.buttons.get(c.button);
        if (b) {
            this.widgets.tabs.remove_child(b);
            b.destroy();
            this.buttons.remove(c.button);
        }

        this.tabs.splice(idx, 1);
    }

    /** Removes the tab associated with the entity */
    remove_tab(entity: Entity): null | number {
        if (!this.widgets) return null;

        if (this.prev_active && Ecs.entity_eq(entity, this.prev_active)) {
            this.prev_active = null;
            this.prev_active_id = 0;
        }

        let idx = 0;
        for (const c of this.tabs) {
            if (Ecs.entity_eq(c.entity, entity)) {
                this.remove_tab_component(c, idx);
                if (this.active_id > idx) {
                    this.active_id -= 1;
                }
                return idx;
            }
            idx += 1;
        }

        return null;
    }

    replace(window: ShellWindow) {
        if (!this.widgets) return;
        const c = this.tabs[this.active_id],
            actor = window.meta.get_compositor_private<Clutter.Actor | null>();
        if (c && actor) {
            this.tab_disconnect(c);

            if (Ecs.entity_eq(window.entity, this.active)) {
                this.active_connect(window.meta, window.entity);
                this.fade_in(actor);
            } else {
                this.fade_out(actor);
            }

            this.watch_signals(this.active_id, c.button, window);
            this.buttons.get(c.button)?.set_title(window.title());
            this.activate(window.entity);
        }
    }

    /** Repositions the stack, arranging the stack's actors around the active window */
    reposition() {
        if (!this.widgets) return;

        const window = this.ext.windows.get(this.active);
        if (!window) return;

        const actor = window.meta.get_compositor_private<Clutter.Actor | null>();
        if (!actor) {
            this.active_disconnect();
            return;
        }

        this.fade_in(actor);

        const parent = actor.get_parent();

        if (!parent) {
            return;
        }

        const stack_parent = this.widgets.tabs.get_parent();
        if (stack_parent) {
            stack_parent.remove_child(this.widgets.tabs);
        }

        parent.add_child(this.widgets.tabs);

        // Reposition actors on the screen, being careful about not displaying over maximized windows
        if (!window.meta.is_fullscreen() && !window.is_maximized() && !this.ext.maximized_on_active_display()) {
            parent.set_child_above_sibling(this.widgets.tabs, actor);
        } else {
            parent.set_child_below_sibling(this.widgets.tabs, actor);
        }
    }

    /** Whether the stack is permitted to show on the active workspace. */
    permitted_to_show(): boolean {
        const active_workspace = global.workspace_manager.get_active_workspace_index();
        return this.workspace == active_workspace;
    }

    reset_visibility(permitted: boolean) {
        let idx = 0;

        for (const c of this.tabs) {
            this.window_exec(idx, c.entity, (window) => {
                const actor = window.meta.get_compositor_private<Clutter.Actor | null>();
                if (!actor) return;
                if (permitted && this.active_id === idx) {
                    this.fade_in(actor);
                } else {
                    this.fade_out(actor);
                }
            });

            idx += 1;
        }
    }

    /** Repositions the stack, and hides all but the active window in the stack */
    restack() {
        this.on_grab(() => {
            if (!this.widgets) return;

            const permitted = this.permitted_to_show();

            this.widgets.tabs.visible = permitted;

            if (permitted) this.reposition();

            this.reset_visibility(permitted);
        });
    }

    /** Changes visibility of the stack's actors */
    set_visible(visible: boolean) {
        if (!this.widgets) return;

        this.widgets.tabs.visible = visible;

        if (visible) {
            this.widgets.tabs.show();
        } else {
            this.widgets.tabs.hide();
        }
    }

    /** Updates the dimensions and positions of the stack's actors */
    update_positions(rect: Mtk.Rectangle) {
        if (!this.widgets) return;

        this.rect = rect;

        this.tab_height = TAB_HEIGHT_UNSCALED * this.ext.dpi;
        this.tab_separation = TAB_SEPARATION_UNSCALED * this.ext.dpi;

        this.stack_rect = new Mtk.Rectangle({
            x: rect.x,
            y: rect.y - this.tab_height,
            width: rect.width,
            height: rect.height + this.tab_height,
        });

        this.widgets.tabs.x = rect.x;
        this.widgets.tabs.y = this.stack_rect.y;
        this.widgets.tabs.height = this.tab_height - this.tab_separation;
        this.widgets.tabs.width = rect.width;
    }

    private watch_signals(comp: number, button: number, window: ShellWindow) {
        const entity = window.entity;
        const widget = this.buttons.get(button);
        if (!widget) return;

        const c = this.tabs[comp];

        // Detach button signal if it's still attached
        if (c.button_signal) widget.disconnect(c.button_signal);

        // Connect tab-clicked signal
        c.button_signal = widget.connect('clicked', () => {
            this.activate(entity);
            this.window_exec(comp, entity, (window) => {
                const actor = window.meta.get_compositor_private<Clutter.Actor | null>();
                if (!actor) return;

                this.fade_in(actor);
                window.activate(false);

                this.reposition();

                for (const comp of this.tabs) {
                    this.buttons.get(comp.button)?.set_active(TabActive.inactive, this.ext.settings);
                }
                widget.set_active(TabActive.active, this.ext.settings);
            });
        });

        // Detach signals if they're still attached
        if (this.tabs[comp].signals) {
            for (const c of this.tabs[comp].signals) window.meta.disconnect(c);
        }

        // Attach new signals
        this.tabs[comp].signals = [
            window.meta.connect('notify::title', () => {
                this.window_exec(comp, entity, (window) => {
                    this.buttons.get(button)?.set_title(window.title());
                });
            }),

            window.meta.connect('notify::urgent', () => {
                this.window_exec(comp, entity, (window) => {
                    if (!window.meta.has_focus()) {
                        this.buttons.get(button)?.set_active(TabActive.urgent, this.ext.settings);
                    }
                });
            }),
        ];
    }

    private window_changed() {
        this.ext.show_border_on_focused();
    }

    private window_exec(comp: number, entity: Entity, func: (window: ShellWindow) => void) {
        const window = this.ext.windows.get(entity);
        if (window && window.actor_exists()) {
            func(window);
        } else {
            const tab = this.tabs[comp];
            if (tab) this.tab_disconnect(tab);
        }
    }
}
