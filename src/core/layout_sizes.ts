/** Pixels in one unit of the gap settings, at a scale of 1 */
export const GAP_UNIT = 4;

/** The sizes in pixels that the layout uses, worked out from the settings and GNOME Shell's scale factor */
export class LayoutSizes {
    // The settings, each in its own unit
    private gap_inner_setting = 0;
    private gap_outer_setting = 0;
    private column_size_setting = 32;
    private row_size_setting = 32;

    /** @param scale_ GNOME Shell's scale factor */
    constructor(private scale_: number) {}

    /** GNOME Shell's scale factor */
    get scale(): number {
        return this.scale_;
    }

    /** The number of pixels between windows */
    get gap_inner(): number {
        return this.gap_inner_setting * GAP_UNIT * this.scale_;
    }

    /** Exactly half of the inner gap */
    get gap_inner_half(): number {
        return this.gap_inner / 2;
    }

    /** The number of pixels around a monitor's work area */
    get gap_outer(): number {
        return this.gap_outer_setting * GAP_UNIT * this.scale_;
    }

    /** The width of a snap-to-grid column, in pixels */
    get column_size(): number {
        return this.column_size_setting * this.scale_;
    }

    /** The height of a snap-to-grid row, in pixels */
    get row_size(): number {
        return this.row_size_setting * this.scale_;
    }

    /**
     * @param gap The gap between windows, in units of {@link GAP_UNIT} pixels
     * @returns How many pixels the inner gap grew by
     */
    set_gap_inner(gap: number): number {
        const before = this.gap_inner;
        this.gap_inner_setting = gap;
        return this.gap_inner - before;
    }

    /**
     * @param gap The gap around a monitor's work area, in units of {@link GAP_UNIT} pixels
     * @returns How many pixels the outer gap grew by
     */
    set_gap_outer(gap: number): number {
        const before = this.gap_outer;
        this.gap_outer_setting = gap;
        return this.gap_outer - before;
    }

    /** @param size The width of a snap-to-grid column, in pixels at a scale of 1 */
    set_column_size(size: number) {
        this.column_size_setting = size;
    }

    /** @param size The height of a snap-to-grid row, in pixels at a scale of 1 */
    set_row_size(size: number) {
        this.row_size_setting = size;
    }

    /** @returns How many pixels the outer gap grew by */
    set_scale(scale: number): number {
        const before = this.gap_outer;
        this.scale_ = scale;
        return this.gap_outer - before;
    }
}
