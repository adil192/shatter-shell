import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Signals } from '../src/core/signals.js';

/** A source that hands out increasing ids and records what's disconnected */
class Source {
    private next = 1;
    readonly disconnected: Array<number> = [];

    connect(): number {
        return this.next++;
    }

    disconnect(id: number) {
        this.disconnected.push(id);
    }
}

describe('Signals', () => {
    test('connect returns the id that the connect function returned', () => {
        const signals = new Signals<Source>();
        const source = new Source();
        assert.equal(
            signals.connect(source, s => s.connect()),
            1,
        );
        assert.equal(
            signals.connect(source, s => s.connect()),
            2,
        );
    });

    test('disconnect_all disconnects every signal from its own source', () => {
        const signals = new Signals<Source>();
        const a = new Source();
        const b = new Source();

        signals.connect(a, s => s.connect());
        signals.connect(b, s => s.connect());
        signals.connect(a, s => s.connect());
        signals.disconnect_all();

        assert.deepEqual(a.disconnected, [1, 2]);
        assert.deepEqual(b.disconnected, [1]);
    });

    test('disconnect_all forgets the signals, so a second call disconnects nothing', () => {
        const signals = new Signals<Source>();
        const source = new Source();

        signals.connect(source, s => s.connect());
        signals.disconnect_all();
        signals.disconnect_all();

        assert.deepEqual(source.disconnected, [1]);
    });
});
