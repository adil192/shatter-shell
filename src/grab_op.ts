import Mtk from 'gi://Mtk';

import type { Entity } from './ecs.js';

import * as Movement from './movement.js';

export class GrabOp {
    entity: Entity;
    rect: Mtk.Rectangle;

    constructor(entity: Entity, rect: Mtk.Rectangle) {
        this.entity = entity;
        this.rect = rect;
    }

    operation(change: Mtk.Rectangle): Movement.Movement {
        return Movement.calculate(this.rect, change);
    }
}
