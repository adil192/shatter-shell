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
}
