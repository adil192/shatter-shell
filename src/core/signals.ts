/** Something that a signal can be disconnected from, such as a `GObject.Object` */
interface Disconnectable {
    disconnect(id: number): void;
}

/** The signals connected to objects, kept so that they can all be disconnected at once */
export class Signals<Source extends Disconnectable> {
    private readonly connections = new Map<Source, Array<number>>();

    /**
     * Connects to `source` with `connect`, and keeps the signal's id.
     *
     * @param connect Connects a signal on `source`, and returns its id
     */
    connect<T extends Source>(source: T, connect: (source: T) => number): number {
        const id = connect(source);

        const ids = this.connections.get(source);
        if (ids) {
            ids.push(id);
        } else {
            this.connections.set(source, [id]);
        }

        return id;
    }

    /** Disconnects every signal that was connected, and forgets them */
    disconnect_all() {
        for (const [source, ids] of this.connections) {
            for (const id of ids) source.disconnect(id);
        }

        this.connections.clear();
    }

    /**
     * Disconnects a specific signal id and removes it from {@link connections}.
     *
     * It is programmer error to disconnect an id that's not connected,
     * since GLib reuses ids.
     * Like GLib, this function will try regardless to disconnect your id,
     * here be dragons.
     */
    disconnect(source: Source, id: number) {
        source.disconnect(id);

        const ids = this.connections.get(source);
        if (ids) {
            const index = ids.indexOf(id);
            if (index !== -1) {
                ids.splice(index, 1);

                if (ids.length === 0) {
                    this.connections.delete(source);
                }
            }
        }
    }

    /**
     * Forgets a source.
     *
     * This does not disconnect any signals.
     *
     * This can be safely called from a 'destroy' signal handler
     * because after a source is destroyed, nothing needs to be disconnected.
     */
    forget_source(source: Source) {
        this.connections.delete(source);
    }
}
