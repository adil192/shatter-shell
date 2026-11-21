import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Style, style_of } from '../src/core/style.js';

describe('style_of', () => {
    test('follows the color scheme and high contrast', () => {
        assert.equal(style_of(true, false), Style.dark);
        assert.equal(style_of(true, true), Style.darkHc);
        assert.equal(style_of(false, false), Style.light);
        assert.equal(style_of(false, true), Style.lightHc);
    });
});
