import type { Rect } from './geom.js';

export interface WindowHandle {
    frame(): Rect;
}
