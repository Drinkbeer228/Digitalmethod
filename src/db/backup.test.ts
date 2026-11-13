import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeBackup, parseBackup, BACKUP_FORMAT, dataUrlToBlob } from './backup';
import {
  TEST_JPEG_LANDSCAPE_DATA_URL,
  TEST_JPEG_PORTRAIT_DATA_URL,
} from '../utils/photoTestFixtures';
import { createDemoHorse, createDemoSession, createDemoVoiceClip } from '../data/demoCase';

test('serializes and parses a valid backup payload round-trip', () => {
  const horse = createDemoHorse();
  const session = createDemoSession();
  const clip = createDemoVoiceClip();

  const json = serializeBackup(
    {
      horses: [horse],
      sessions: [session],
      voiceClips: [clip],
      language: 'en',
    },
    '2026-11-12T08:00:00.000Z'
  );

  const parsed = parseBackup(json);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.backup.format, BACKUP_FORMAT);
    assert.equal(parsed.backup.data.horses.length, 1);
    assert.equal(parsed.backup.data.horses[0].name, 'Yannis');
    assert.equal(parsed.backup.data.sessions.length, 1);
    assert.equal(parsed.backup.data.sessions[0].sessionNumber, 2);
  }
});

test('rejects invalid JSON or duplicate IDs during backup validation', () => {
  assert.equal(parseBackup('{bad json').ok, false);
  assert.equal(parseBackup(JSON.stringify({ format: 'wrong', version: 1 })).ok, false);

  const horse = createDemoHorse();
  const dupJson = serializeBackup({
    horses: [horse, horse],
    sessions: [],
    voiceClips: [],
    language: 'en',
  });
  const res = parseBackup(dupJson);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.reason, 'corrupt-records');
  }
});

test('preserves expanded Masterson taxonomy (yawnCount, resistanceSigns, techniques) and unified notes across backup round-trip', () => {
  const horse = createDemoHorse();
  const session = createDemoSession();
  session.evaluationTable.poll_top_atlas.left = {
    ...session.evaluationTable.poll_top_atlas.left,
    reaction: 2,
    restriction: true,
    released: true,
    releaseSigns: ['Yawn', 'Blink / Soft eye', 'Weight shift'],
    yawnCount: 4,
    resistanceSigns: ['Bracing / Guarding', 'Head toss / Pull away'],
    techniques: ['Poll / Atlas', 'Lateral Cervical Flexion'],
    note: 'Reassessed after Poll release',
  };
  session.generalNotes = 'Unified session notes with Cyrillic: Спокойный выдох.';
  session.reportSections.postSessionCareNotes = '24h turnout and light hand-walking.';

  const json = serializeBackup({
    horses: [horse],
    sessions: [session],
    voiceClips: [],
    language: 'en',
  });

  const parsed = parseBackup(json);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    const restoredObs = parsed.backup.data.sessions[0].evaluationTable.poll_top_atlas.left;
    assert.equal(restoredObs.yawnCount, 4);
    assert.deepEqual(restoredObs.resistanceSigns, ['Bracing / Guarding', 'Head toss / Pull away']);
    assert.deepEqual(restoredObs.techniques, ['Poll / Atlas', 'Lateral Cervical Flexion']);
    assert.equal(
      parsed.backup.data.sessions[0].generalNotes,
      'Unified session notes with Cyrillic: Спокойный выдох.'
    );
    assert.equal(
      parsed.backup.data.sessions[0].reportSections.postSessionCareNotes,
      '24h turnout and light hand-walking.'
    );
  }
});


function makePhotoRecords(sessionId: string) {
  return [
    {
      id: 'photo-before-1',
      sessionId,
      kind: 'before' as const,
      createdAt: '2026-11-12T08:05:00.000Z',
      width: 48,
      height: 32,
      mimeType: 'image/jpeg',
      sizeBytes: 800,
      imageDataUrl: TEST_JPEG_LANDSCAPE_DATA_URL,
    },
    {
      id: 'photo-after-1',
      sessionId,
      kind: 'after' as const,
      createdAt: '2026-11-12T09:10:00.000Z',
      width: 32,
      height: 48,
      mimeType: 'image/jpeg',
      sizeBytes: 850,
      imageDataUrl: TEST_JPEG_PORTRAIT_DATA_URL,
    },
  ];
}

test('round-trips Before / After session photos through JSON backup', () => {
  const horse = createDemoHorse();
  const session = createDemoSession();
  const photos = makePhotoRecords(session.id);

  const json = serializeBackup({
    horses: [horse],
    sessions: [session],
    voiceClips: [],
    sessionPhotos: photos,
    language: 'ru',
  });
  const parsed = parseBackup(json);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    const restored = parsed.backup.data.sessionPhotos ?? [];
    assert.equal(restored.length, 2);
    assert.deepEqual(
      restored.map((p) => [p.id, p.kind, p.sessionId]),
      [
        ['photo-before-1', 'before', session.id],
        ['photo-after-1', 'after', session.id],
      ]
    );
    assert.equal(restored[0].imageDataUrl, TEST_JPEG_LANDSCAPE_DATA_URL);
    const blob = dataUrlToBlob(restored[1].imageDataUrl!);
    assert.equal(blob.type, 'image/jpeg');
    assert.ok(blob.size > 100);
  }
});

test('accepts legacy backups without sessionPhotos', () => {
  const legacy = JSON.parse(
    serializeBackup({
      horses: [createDemoHorse()],
      sessions: [createDemoSession()],
      voiceClips: [],
      language: 'en',
    })
  );
  delete legacy.data.sessionPhotos;
  const parsed = parseBackup(JSON.stringify(legacy));
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.backup.data.sessionPhotos, []);
});

test('rejects corrupt session photo records', () => {
  const horse = createDemoHorse();
  const session = createDemoSession();
  const [before, after] = makePhotoRecords(session.id);
  const cases = [
    [before, { ...before }],
    [{ ...before, kind: 'during' }],
    [{ ...after, sessionId: 'missing-session' }],
    [{ ...after, imageDataUrl: 'data:text/html;base64,AAAA' }],
  ];
  for (const sessionPhotos of cases) {
    const res = parseBackup(
      serializeBackup({
        horses: [horse],
        sessions: [session],
        voiceClips: [],
        sessionPhotos: sessionPhotos as never,
        language: 'en',
      })
    );
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.reason, 'corrupt-records');
  }
});
