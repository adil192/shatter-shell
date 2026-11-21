import type Meta from 'gi://Meta';

import type { Entity } from '../ecs.js';
import type { Ext } from '../extension.js';
import type { ExtensionSettings } from '../settings.js';

import { AutoTiler } from '../auto_tiler.js';
import { Forest } from '../forest.js';

/** Switches auto-tiling on and off, keeping the setting and GNOME's edge tiling in step */
export class GnomeAutoTiling {
    constructor(
        private readonly settings: ExtensionSettings,
        private readonly ext: Ext,
    ) {}

    /** An auto-tiler over a new, empty forest */
    private create(): AutoTiler {
        const { ext } = this;
        return new AutoTiler(
            new Forest()
                .connect_on_attach(ext.on_tile_attach.bind(ext))
                .connect_on_detach(ext.on_tile_detach.bind(ext)),
            ext.register_storage<Entity>(),
        );
    }

    /** Turns auto-tiling back on at startup if the setting says so */
    restore() {
        if (this.settings.get_tile_by_default() && !this.ext.auto_tiler) this.ext.auto_tiler = this.create();
    }

    /** Switches auto-tiling off if it's on, and on if it's off */
    toggle() {
        if (this.settings.get_tile_by_default()) {
            this.off();
        } else {
            this.on();
        }
    }

    /** Switches auto-tiling off, giving the windows back to GNOME's edge tiling */
    off() {
        const { ext, settings } = this;
        settings.set_edge_tiling(true);

        if (ext.auto_tiler) {
            ext.unregister_storage(ext.auto_tiler.attached);
            ext.auto_tiler.destroy(ext);
            ext.auto_tiler = null;
            settings.set_tile_by_default(false);

            if (settings.get_active_hint()) {
                ext.show_border_on_focused();
            }
        }
    }

    /** Switches auto-tiling on and tiles the open windows */
    on() {
        const { ext, settings } = this;
        settings.set_edge_tiling(false);

        const original = ext.active_workspace();

        const tiler = this.create();
        ext.auto_tiler = tiler;

        settings.set_tile_by_default(true);

        for (const window of ext.windows.values()) {
            if (window.is_tilable()) {
                const actor = window.meta.get_compositor_private<Meta.WindowActor | null>();
                if (actor) {
                    if (!window.meta.minimized) {
                        tiler.auto_tile(ext, window, true);
                    }
                }
            }
        }

        ext.register_fn(() => ext.switch_to_workspace(original));
    }
}
