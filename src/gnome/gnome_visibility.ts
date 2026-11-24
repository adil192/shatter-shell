import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';

const FADE_DURATION = 150;

/** Shows, hides and fades a window's actor, with one set of rules for every caller */
export class GnomeVisibility {
    constructor(private readonly meta: Meta.Window) {}

    private actor(): Meta.WindowActor | null {
        return this.meta.get_compositor_private<Meta.WindowActor | null>();
    }

    fade_in() {
        const actor = this.actor();
        if (!actor) return;
        if (actor.visible && actor.opacity >= 255) return;

        actor.remove_all_transitions();
        if (actor.opacity > 250) actor.opacity = 0;
        actor.show();
        actor.ease({
            opacity: 255,
            duration: FADE_DURATION * (1 - actor.opacity / 255),
            mode: Clutter.AnimationMode.EASE_OUT_QUART,
        });
    }

    fade_out() {
        const actor = this.actor();
        if (!actor?.visible) return;

        actor.remove_all_transitions();
        actor.ease({
            opacity: 0,
            duration: FADE_DURATION * (actor.opacity / 255),
            mode: Clutter.AnimationMode.EASE_IN_QUART,
            onComplete: () => {
                actor.hide();
                actor.opacity = 255;
            },
        });
    }

    show_now() {
        const actor = this.actor();
        if (!actor) return;

        actor.remove_all_transitions();
        actor.opacity = 255;
        actor.show();
    }

    hide_now() {
        const actor = this.actor();
        if (!actor) return;

        actor.remove_all_transitions();
        actor.hide();
        actor.opacity = 255;
    }

    restore_opacity() {
        const actor = this.actor();
        if (actor) actor.opacity = 255;
    }

    stop_transitions() {
        this.actor()?.remove_all_transitions();
    }
}
