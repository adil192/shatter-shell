/** The extension's stylesheets, one for each of GNOME's color schemes */
export enum Style {
    light = 'light',
    /** Light with high contrast */
    lightHc = 'lightHc',
    dark = 'dark',
    /** Dark with high contrast */
    darkHc = 'darkHc',
}

/** The stylesheet that goes with GNOME's color scheme and its high contrast setting */
export function style_of(dark: boolean, high_contrast: boolean): Style {
    if (dark) return high_contrast ? Style.darkHc : Style.dark;
    return high_contrast ? Style.lightHc : Style.light;
}
