import * as Ecs from './ecs.js';
import GLib from 'gi://GLib';

export interface Executor<T> {
    wake<S extends Ecs.System<T>>(system: S, event: T): void;
}

/** Glib-based event executor */
export class GLibExecutor<T> implements Executor<T> {
    #event_loop: SignalID = 0;
    #events: Array<T> = [];

    /** Creates an idle_add signal that exists only for as long as there are events to process.
     *
     * - If the signal has already been created, the event will be added to the queue.
     * - The signal will continue executing for as long as there are events remaining in the queue.
     * - Events are handled within batches, yielding between each new set of events.
     */
    wake<S extends Ecs.System<T>>(system: S, event: T): void {
        this.#events.unshift(event);

        if (this.#event_loop) return;

        this.#event_loop = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            const event = this.#events.pop();
            if (event !== undefined) system.run(event);

            if (this.#events.length === 0) {
                this.#event_loop = 0;
                return false;
            }

            return true;
        });
    }
}

/**
 * An executor that polls iterable periodically.
 * Quits polling when the iterable is exhausted.
 */
export class OnceExecutor<X, T extends Iterable<X, void>> {
    #iterable: T;
    #source: SignalID | null = null;

    constructor(iterable: T) {
        this.#iterable = iterable;
    }

    start(delay: number, apply: (v: X) => boolean, then?: () => void) {
        this.stop();

        const iterator = this.#iterable[Symbol.iterator]();

        this.#source = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            const next = iterator.next().value ?? undefined;
            if (typeof next === 'undefined') {
                if (then) then();
                return GLib.SOURCE_REMOVE;
            } else {
                return apply(next);
            }
        });
    }

    stop() {
        if (this.#source !== null) {
            GLib.source_remove(this.#source);
            this.#source = null;
        }
    }
}

/**
 * An executor that polls #channel periodically.
 * Continues polling even if #channel is empty.
 */
export class ChannelExecutor<X> {
    #channel: Array<X> = [];

    #source: number | null = null;

    clear() {
        this.#channel.splice(0);
    }

    get length(): number {
        return this.#channel.length;
    }

    send(v: X) {
        this.#channel.push(v);
    }

    start(delay: number, apply: (v: X) => boolean) {
        this.stop();

        this.#source = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            const next = this.#channel.shift();
            if (typeof next === 'undefined') {
                return GLib.SOURCE_CONTINUE;
            } else {
                return apply(next);
            }
        });
    }

    stop() {
        if (this.#source !== null) {
            GLib.source_remove(this.#source);
            this.#source = null;
        }
    }
}
