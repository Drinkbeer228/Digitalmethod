import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmbedded } from './link';

test('embedded only inside a frame with ?embedded=1', () => {
  assert.equal(isEmbedded('?embedded=1', true), true);
  assert.equal(isEmbedded('?embedded=1', false), false);
  assert.equal(isEmbedded('', true), false);
  assert.equal(isEmbedded('?embedded=0&x=1', true), false);
});
