import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';

import * as Window from './window.js';

import type { Ext } from './extension.js';

/** Events handled by the extension's system. */
export type ExtEvent = CallbackEvent | WindowMove | CreateWindow | WindowEvent | GlobalEventMessage;

/** Event with generic callback */
export interface CallbackEvent {
    tag: 'callback';
    callback: () => void;
    name?: string;
}

/** Event that moves a registered window */
export interface WindowMove {
    tag: 'window_move';
    window: Window.ShellWindow;
}

/** Event that registers a new window */
export interface CreateWindow {
    tag: 'window_create';
    window: Meta.Window;
}

export interface WindowEvent {
    tag: 'window_event';
    window: Window.ShellWindow;
    event: WindowEventType;
}

export interface GlobalEventMessage {
    tag: 'global';
    event: GlobalEvent;
}

export enum GlobalEvent {
    GtkShellChanged,
    GtkThemeChanged,
    MonitorsChanged,
    OverviewShown,
    OverviewHidden,
}

/** The type of event triggered on a window */
export enum WindowEventType {
    Size,
    Workspace,
    Minimize,
    Maximize,
    Fullscreen,
}

export function global(event: GlobalEvent): GlobalEventMessage {
    return { tag: 'global', event };
}

export function window_move(ext: Ext, window: Window.ShellWindow, rect: Mtk.Rectangle): WindowMove {
    ext.movements.insert(window.entity, rect);
    return { tag: 'window_move', window };
}

export function window_event(window: Window.ShellWindow, event: WindowEventType): WindowEvent {
    return { tag: 'window_event', window, event };
}
