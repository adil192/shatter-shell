/**
 * Which windows were focused most recently, overall and on each workspace.
 */
export class FocusHistory<Id, Workspace = number> {
    /** The focused window */
    private current_: Id | null = null;

    /** The window that was focused before {@link current_} */
    private previous_: Id | null = null;

    /** The window that was focused last on each workspace */
    private readonly last_on_workspace = new Map<Workspace, Id>();

    /** @param eq Whether two ids are of the same window */
    constructor(private readonly eq: (a: Id, b: Id) => boolean) {}

    get current(): Id | null {
        return this.current_;
    }

    get previous(): Id | null {
        return this.previous_;
    }

    is_current(id: Id): boolean {
        return this.current_ !== null && this.eq(this.current_, id);
    }

    /**
     * Records that a window on `workspace` was focused. Focusing the current window again leaves the
     * focus order unchanged, but still records it as the last window focused on `workspace`.
     */
    focused(id: Id, workspace: Workspace) {
        this.last_on_workspace.set(workspace, id);

        if (!this.is_current(id)) {
            this.previous_ = this.current_;
            this.current_ = id;
        }
    }

    /** Starts the history over, from `id` */
    restart_from(id: Id) {
        this.previous_ = null;
        this.current_ = id;
    }

    clear() {
        this.previous_ = null;
        this.current_ = null;
    }

    /**
     * Removes a window that's gone. If it was the current window, the previous one becomes current.
     *
     * A workspace that it was focused on last is left without a last window. Otherwise, as entities
     * get reused, the workspace could later name a window that was never focused on it.
     */
    forget(id: Id) {
        if (this.previous_ !== null && this.eq(this.previous_, id)) {
            this.previous_ = null;
        } else if (this.is_current(id)) {
            this.current_ = this.previous_;
            this.previous_ = null;
        }

        for (const [workspace, last] of this.last_on_workspace) {
            if (this.eq(last, id)) this.last_on_workspace.delete(workspace);
        }
    }

    /** The window that was focused last on `workspace` */
    last_on(workspace: Workspace): Id | null {
        return this.last_on_workspace.get(workspace) ?? null;
    }

    /** The most recently focused window other than `id` */
    previous_to(id: Id): Id | null {
        for (const candidate of this.recent()) {
            if (!this.eq(candidate, id)) return candidate;
        }
        return null;
    }

    /** The current and the previous window, most recent first */
    recent(): Id[] {
        const recent = [];
        if (this.current_ !== null) recent.push(this.current_);
        if (this.previous_ !== null) recent.push(this.previous_);
        return recent;
    }
}
