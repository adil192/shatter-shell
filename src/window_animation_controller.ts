import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';

import type { MutterWindow } from './gnome/mutter_window.js';

import { Signals } from './core/signals.js';

/**
 * GNOME's size change duration from
 * https://github.com/GNOME/mutter/blob/gnome-50/src/compositor/plugins/default.c#L54
 */
const WINDOW_GEOMETRY_ANIMATION_DURATION = 250;

interface WindowAnimation {
    actor_clone: Clutter.Actor;
    destroy_signal?: SignalID;
}

export class WindowAnimationController {
    constructor(readonly signals: Signals<any>) {}

    private readonly animations = new Map<Meta.WindowActor, WindowAnimation>();

    /**
     * Animates a window movement.
     *
     * Creates a clone of the window's contents and fades it out to zero opacity.
     * The real window and the clone are transitioned together to their target rect.
     *
     * This is based on Mutter's size_change transition:
     * https://github.com/GNOME/mutter/blob/gnome-50/src/compositor/plugins/default.c#L714
     *
     * The caller is responsible for checking {@link ExtensionSettings.get_animate_windows()}
     * to decide whether to call this function.
     */
    start(window: MutterWindow, actor: Meta.WindowActor, movement: Mtk.Rectangle) {
        const old_animation = this._popAnimation(actor);
        // Reuse the last clone if it exists, or create one later. Must be destroyed if we return early.
        let actor_clone = old_animation?.actor_clone;
        let actor_clone_unused = true;

        try {
            if (!actor.visible || actor.opacity === 0 || !actor.get_stage()) return;
            if (window.meta.fullscreen || window.is_maximized()) return;

            const parent = actor.get_parent();
            if (!parent) return;

            const frame = window.meta.get_frame_rect();
            const [x, y] = actor.get_position();
            const [width, height] = actor.get_size();
            const target = {
                x: x + movement.x - frame.x,
                y: y + movement.y - frame.y,
                width: width + movement.width - frame.width,
                height: height + movement.height - frame.height,
            };
            if (width <= 0 || height <= 0 || target.width <= 0 || target.height <= 0) return;
            if (x === target.x && y === target.y && width === target.width && height === target.height) return;

            actor_clone_unused = false;
            if (!actor_clone) {
                // Create a static clone of the window to be animated.
                const content = actor.paint_to_content(null);
                if (!content) return;
                actor_clone = new Clutter.Actor();
                actor_clone.set_content(content);
                actor_clone.set_offscreen_redirect(Clutter.OffscreenRedirect.ALWAYS);
                parent.add_child(actor_clone);
            } else if (actor_clone.get_parent() !== parent) {
                actor_clone.get_parent()?.remove_child(actor_clone);
                parent.add_child(actor_clone);
            }
            actor_clone.set_position(x, y);
            actor_clone.set_size(width, height);
            actor_clone.set_opacity(actor.opacity);
            parent.set_child_above_sibling(actor_clone, actor);

            const animation: WindowAnimation = { actor_clone };
            this.animations.set(actor, animation);
            animation.destroy_signal = this.signals.connect_with(actor, () =>
                actor.connect('destroy', () => {
                    if (this.animations.get(actor) !== animation) return;
                    this.animations.delete(actor);
                    animation.actor_clone.remove_all_transitions();
                    animation.actor_clone.destroy();
                }),
            );

            actor.set_pivot_point(0, 0);
            actor.set_translation(x - target.x, y - target.y, 0);
            actor.set_scale(width / target.width, height / target.height);

            actor.ease({
                scaleX: 1,
                scaleY: 1,
                translationX: 0,
                translationY: 0,
                duration: WINDOW_GEOMETRY_ANIMATION_DURATION,
                mode: Clutter.AnimationMode.LINEAR,
            });
            actor_clone.ease({
                ...target,
                opacity: 0,
                duration: WINDOW_GEOMETRY_ANIMATION_DURATION,
                mode: Clutter.AnimationMode.LINEAR,
                onComplete: () => this.stop(actor),
            });
        } finally {
            // Destroy unused actor_clone if we returned early
            if (actor_clone && actor_clone_unused) actor_clone.destroy();
        }
    }

    stop(actor: Meta.WindowActor) {
        const old_animation = this._popAnimation(actor);
        old_animation?.actor_clone.destroy();
    }

    stop_all() {
        for (const actor of this.animations.keys()) {
            this.stop(actor);
        }
    }

    /**
     * Stops and returns the currently running animation for `actor`
     * if one exists.
     *
     * This does not destroy the `actor_clone` since it may be reused.
     * The caller MUST destroy `actor_clone` if it is not needed.
     */
    private _popAnimation(actor: Meta.WindowActor): WindowAnimation | undefined {
        const animation = this.animations.get(actor);
        if (!animation) return;
        this.animations.delete(actor);

        if (animation.destroy_signal) {
            this.signals.disconnect(actor, animation.destroy_signal);
            animation.destroy_signal = undefined;
        }

        animation.actor_clone.remove_all_transitions();
        actor.remove_all_transitions();
        actor.set_translation(0, 0, 0);
        actor.set_scale(1, 1);
        actor.set_pivot_point(0, 0);

        return animation;
    }
}
