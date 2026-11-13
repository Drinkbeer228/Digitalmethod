import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTargetSize } from './imageCompression';

test('computeTargetSize scales landscape photos to max side keeping aspect ratio', () => {
  assert.deepEqual(computeTargetSize(4032, 3024, 1600), { width: 1600, height: 1200 });
});

test('computeTargetSize scales portrait photos by their height', () => {
  assert.deepEqual(computeTargetSize(3024, 4032, 1600), { width: 1200, height: 1600 });
});

test('computeTargetSize never upscales small photos', () => {
  assert.deepEqual(computeTargetSize(800, 600, 1600), { width: 800, height: 600 });
});

test('computeTargetSize handles square photos and rejects invalid sizes', () => {
  assert.deepEqual(computeTargetSize(3000, 3000, 1600), { width: 1600, height: 1600 });
  assert.throws(() => computeTargetSize(0, 100));
  assert.throws(() => computeTargetSize(Number.NaN, 100));
});
