import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeBackup, parseBackup, BACKUP_FORMAT } from './backup';
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

