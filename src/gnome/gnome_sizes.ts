import type { Misc } from '@girs/gnome-shell';
import type GObject from 'gi://GObject';

import Gio from 'gi://Gio';
import St from 'gi://St';

import type { Signals } from '../core/signals.js';
import type { Ext } from '../extension.js';

/** Applies gap and scale changes to {@link LayoutSizes}, and lays the windows out again */
export class GnomeSizes {
    constructor(private readonly ext: Ext) {}

    /** Connects to the settings and to the scale factor */
    attach(signals: Signals<GObject.Object | Misc.signals.EventEmitter>) {
        const settings = this.ext.settings.ext;
        const on = (key: string, react: () => void) =>
            signals.connect_with(settings, s => s.connect(`changed::${key}`, react));

        on('gap-inner', () => this.on_gap_inner());
        on('gap-outer', () => this.on_gap_outer());
        on('smart-gaps', () => this.on_smart_gaps());

        signals.connect_with(St.ThemeContext.get_for_stage(global.stage), theme =>
            theme.connect('notify::scale-factor', () => this.on_scale()),
        );
    }

    private on_gap_inner() {
        const { ext } = this;
        if (ext.sizes.set_gap_inner(ext.settings.get_gap_inner()) === 0) return;

        this.retile();
        Gio.Settings.sync();
    }

    private on_gap_outer() {
        const { ext } = this;
        const change = ext.sizes.set_gap_outer(ext.settings.get_gap_outer());
        if (change === 0) return;

        this.move_in(change);
        Gio.Settings.sync();
    }

    private on_smart_gaps() {
        const { ext } = this;
        if (ext.gnome_forest) {
            const smart_gaps = ext.settings.get_smart_gaps();
            for (const [fork, monitor] of Array.from(ext.gnome_forest.forest.lone_trees())) {
                ext.gnome_forest.update_toplevel(fork, monitor, smart_gaps);
            }
        }

        ext.show_border_on_focused();
    }

    private on_scale() {
        const change = this.ext.sizes.set_scale(St.ThemeContext.get_for_stage(global.stage).scale_factor);

        // The inner gap scales too, so both lay the trees out again
        if (change !== 0) {
            this.move_in(change);
        } else {
            this.retile();
        }
    }

    private retile() {
        const { ext } = this;
        if (!ext.gnome_forest) {
            this.snap_again();
            return;
        }

        for (const [entity] of ext.gnome_forest.forest.toplevel.values()) {
            const fork = ext.gnome_forest.forest.forks.get(entity);
            if (fork) ext.gnome_forest.tile(fork, fork.area);
        }
    }

    private move_in(change: number) {
        const { ext } = this;
        if (!ext.gnome_forest) {
            this.snap_again();
            return;
        }

        ext.gnome_forest.forest.move_in(change);
        this.retile();
    }

    private snap_again() {
        const { ext } = this;
        for (const entity of ext.snapped.find(val => val)) {
            const window = ext.windows.get(entity);
            if (window) ext.gnome_tiling_mode.snap(window);
        }
    }
}
