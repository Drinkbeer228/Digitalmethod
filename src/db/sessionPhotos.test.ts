import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { db, deleteDemonstrationCase, loadSessionPhotos, restoreDemonstrationCase } from './database';
import { DEMO_SESSION_ID } from '../data/demoCase';
import { SessionPhoto } from '../types';

function photo(id: string, sessionId: string, kind: 'before' | 'after', createdAt: string): SessionPhoto {
  return {
    id,
    sessionId,
    kind,
    createdAt,
    width: 1600,
    height: 1200,
    mimeType: 'image/jpeg',
    sizeBytes: 4,
    imageBlob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
  };
}

test('Dexie v4 opens with sessionPhotos table and stores photos per session', async () => {
  await db.open();
  assert.equal(db.verno, 4);
  assert.ok(db.tables.some((t) => t.name === 'sessionPhotos'));

  await db.sessionPhotos.bulkPut([
    photo('p-after', 'sess-a', 'after', '2026-11-12T09:00:00.000Z'),
    photo('p-before', 'sess-a', 'before', '2026-11-12T08:00:00.000Z'),
    photo('p-other', 'sess-b', 'before', '2026-11-12T08:30:00.000Z'),
  ]);

  const loaded = await loadSessionPhotos('sess-a');
  assert.deepEqual(
    loaded.map((p) => p.id),
    ['p-before', 'p-after'],
    'photos load oldest first and only for the requested session'
  );
  assert.deepEqual(await loadSessionPhotos(''), []);

  await db.sessionPhotos.delete('p-before');
  assert.deepEqual((await loadSessionPhotos('sess-a')).map((p) => p.id), ['p-after']);
});

test('deleting the demonstration case also removes its photos', async () => {
  await restoreDemonstrationCase();
  await db.sessionPhotos.put(photo('p-demo', DEMO_SESSION_ID, 'before', '2026-11-12T08:00:00.000Z'));
  assert.equal((await loadSessionPhotos(DEMO_SESSION_ID)).length, 1);

  await deleteDemonstrationCase();
  assert.equal((await loadSessionPhotos(DEMO_SESSION_ID)).length, 0);
  assert.equal((await loadSessionPhotos('sess-b')).length, 1, 'other sessions keep their photos');
});
