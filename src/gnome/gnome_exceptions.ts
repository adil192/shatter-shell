import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { ControlsState } from 'resource:///org/gnome/shell/ui/overviewControls.js';

import type { Config } from '../config.js';
import type { Ext } from '../extension.js';
import type { ShellWindow } from '../window.js';

import * as add_exception from '../dialog_add_exception.js';
import { Log } from '../log.js';
import { get_current_path } from '../paths.js';
import * as utils from '../utils.js';

/**
 * The GNOME side of the floating exceptions: it opens their dialog, lets the user pick a window in
 * the overview to add one for, and applies the exceptions to the windows when they change.
 */
export class GnomeExceptions {
    /** Whether the user is picking a window in the overview to add an exception for */
    picking: boolean = false;

    constructor(
        private readonly conf: Config,
        private readonly ext: Ext,
    ) {}

    /** Opens the dialog that lists the exceptions, in a process of its own */
    open() {
        const { ext } = this;
        const path = get_current_path() + '/floating_exceptions/main.js';

        const event_handler = (event: string): boolean => {
            switch (event) {
                case 'MODIFIED':
                    ext.register_fn(() => void this.reload());
                    break;
                case 'SELECT':
                    ext.register_fn(() => this.pick());
                    return false;
            }

            return true;
        };

        const ipc = utils.async_process_ipc(['gjs', '--module', path]);

        if (ipc) {
            const decoder = new TextDecoder('utf-8');

            const generator: Gio.AsyncReadyCallback<Gio.DataInputStream> = (stdout, res) => {
                try {
                    const [bytes] = stdout!.read_line_finish(res);
                    if (bytes) {
                        if (event_handler(decoder.decode(bytes).trim())) {
                            ipc.stdout.read_line_async(0, ipc.cancellable, generator);
                        }
                    }
                } catch (why) {
                    Log.error(`failed to read response from floating exceptions dialog: ${why}`);
                }
            };

            ipc.stdout.read_line_async(0, ipc.cancellable, generator);
        }
    }

    /** Shows the overview, for the user to pick the window to add an exception for */
    private pick() {
        const { ext } = this;
        const source = GLib.timeout_add(GLib.PRIORITY_LOW, 100, () => {
            this.picking = true;
            Main.overview.show(ControlsState.WINDOW_PICKER);

            ext.timeouts.delete(source);
            return GLib.SOURCE_REMOVE;
        });
        ext.timeouts.add(source);
    }

    /** Asks whether to add an exception for the picked window's app, or for only that window */
    add(win: ShellWindow) {
        this.picking = false;

        const d = new add_exception.AddExceptionDialog(
            // Cancel
            () => this.open(),
            // this_app
            () => {
                let wmclass = win.meta.get_wm_class();
                if (wmclass != null) {
                    if (!wmclass.length) {
                        wmclass = win.name();
                    }
                    if (wmclass.length) {
                        this.conf.add_app_exception(wmclass);
                    }
                }
                this.open();
            },
            // current-window
            () => {
                const wmclass = win.meta.get_wm_class();
                if (wmclass !== null) this.conf.add_window_exception(wmclass, win.title());
                this.open();
            },
            // Reload the tiling config on dialog close
            () => void this.reload(),
        );
        d.open();
    }

    /** Reads the exceptions again, and tiles and untiles the windows as they say now */
    private async reload() {
        const { ext } = this;
        await this.conf.reload();

        const gnome_forest = ext.gnome_forest;
        if (!gnome_forest) return;

        for (const [entity, window] of ext.windows.iter()) {
            const attachment = gnome_forest.attached.get(entity);
            if (window.is_tilable()) {
                if (!attachment) {
                    gnome_forest.auto_tile(window, ext.init);
                }
            } else if (attachment) {
                gnome_forest.detach_window(entity);
            }
        }
    }
}
