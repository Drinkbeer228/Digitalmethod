import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePractitionerNotes } from './caseParser';
import { buildReportFromSession } from './reportGenerator';
import { createDemoSession } from '../data/demoCase';
import {
  ANATOMICAL_AREAS,
  ANATOMICAL_REGIONS,
  createEmptyEvaluationTable,
  syncAnnotationsWithTable,
} from '../data/anatomicalAreas';

test('recognizes English anatomical areas, sides, reaction levels, and restrictions', () => {
  const input =
    'Left Poll on top of Atlas showed Level 2 reaction. Found restriction in Right Neck C3–C5.';
  const suggestions = parsePractitionerNotes(input);

  const pollSug = suggestions.find(
    (s) => s.type === 'area_observation' && s.areaId === 'poll_top_atlas'
  );
  assert.ok(pollSug, 'Should identify Poll - On Top of Atlas');
  assert.equal(pollSug.side, 'left');
  assert.equal(pollSug.reactionLevel, 2);

  const neckSug = suggestions.find(
    (s) => s.type === 'area_observation' && s.areaId === 'neck'
  );
  assert.ok(neckSug, 'Should identify Neck (C3-C5)');
  assert.equal(neckSug.side, 'right');
  assert.equal(neckSug.restriction, true);
});

test('recognizes Russian anatomical areas, sides, reactions, and release signs', () => {
  const input =
    'Левое плечо реакция 2. Правая ягодичная мышца рестрикция и глубокое зевание.';
  const suggestions = parsePractitionerNotes(input);

  const shoulderSug = suggestions.find(
    (s) => s.type === 'area_observation' && s.areaId === 'shoulder'
  );
  assert.ok(shoulderSug, 'Should identify Russian shoulder (плечо)');
  assert.equal(shoulderSug.side, 'left');
  assert.equal(shoulderSug.reactionLevel, 2);

  const gluteSug = suggestions.find(
    (s) => s.type === 'area_observation' && s.areaId === 'gluteals'
  );
  assert.ok(gluteSug, 'Should identify Russian gluteals (ягодичная мышца)');
  assert.equal(gluteSug.side, 'right');
  assert.equal(gluteSug.restriction, true);
  assert.equal(gluteSug.released, true);
  assert.ok(gluteSug.releaseSigns?.includes('Deep yawning'));
});

test('recognizes hip point (tuber coxae) and under-the-tail (tuber ischii) without stealing hamstrings', () => {
  const ru = parsePractitionerNotes('Маклок слева реакция 2. Под хвостом справа рестрикция.');
  const hip = ru.find((s) => s.type === 'area_observation' && s.areaId === 'tuber_coxae');
  assert.ok(hip, 'Should identify маклок');
  assert.equal(hip.side, 'left');
  assert.equal(hip.reactionLevel, 2);
  const tail = ru.find((s) => s.type === 'area_observation' && s.areaId === 'under_tail');
  assert.ok(tail, 'Should identify под хвостом');
  assert.equal(tail.side, 'right');
  assert.equal(tail.restriction, true);

  const en = parsePractitionerNotes('Left point of hip showed Level 1 reaction. Right tuber ischii restriction.');
  assert.ok(en.some((s) => s.type === 'area_observation' && s.areaId === 'tuber_coxae'));
  assert.ok(en.some((s) => s.type === 'area_observation' && s.areaId === 'under_tail'));

  const ham = parsePractitionerNotes('Правые седалищные мышцы реакция 2.');
  const hamAreas = ham.filter((s) => s.type === 'area_observation').map((s) => s.areaId);
  assert.deepEqual(hamAreas, ['hamstrings']);
});

test('only suggests Predominant Diagonal when explicitly stated and preserves unclassified notes', () => {
  const input =
    'Started with Bladder Meridian scan. Predominant diagonal is from Left Atlas to Right Gluteal.';
  const suggestions = parsePractitionerNotes(input);

  const unclassified = suggestions.find((s) => s.type === 'unclassified');
  assert.ok(unclassified, 'Should preserve unclassified statement without inventing findings');
  assert.match(unclassified.sourceSentence, /Bladder Meridian/i);

  const diag = suggestions.find((s) => s.type === 'diagonal');
  assert.ok(diag, 'Should detect explicit Predominant Diagonal');
  assert.equal(diag.diagonalFrom, 'left_atlas');
  assert.equal(diag.diagonalTo, 'right_gluteal');
});

test('builds structured bilingual report from Yannis demonstration session', () => {
  const session = createDemoSession();
  const enReport = buildReportFromSession(session, 'en');
  assert.match(enReport.initialEvaluation, /Poll – On Top of Atlas: Reaction Level 2/);
  assert.match(enReport.initialEvaluation, /Left Shoulder: Reaction Level 2/);
  assert.match(enReport.restrictionsIdentified, /Left Neck/);
  assert.match(enReport.predominantDiagonal, /Left Atlas → Right Gluteal/);

  const ruReport = buildReportFromSession(session, 'ru');
  assert.match(ruReport.initialEvaluation, /Poll – On Top of Atlas/);
  assert.match(ruReport.predominantDiagonal, /Левый атлант \(Left Atlas\) → Правая ягодичная \(Right Gluteal\)/);
});

test('maps all 21 anatomical areas into 5 pastel regions and synchronizes multiple markers per location', () => {
  assert.equal(ANATOMICAL_REGIONS.length, 5, 'Should define exactly 5 pastel anatomical regions');
  assert.equal(ANATOMICAL_AREAS.length, 21, 'Should define all 21 Masterson anatomical areas');

  const validRegionIds = new Set(ANATOMICAL_REGIONS.map((r) => r.id));
  for (const area of ANATOMICAL_AREAS) {
    assert.ok(validRegionIds.has(area.regionId), `Area ${area.id} must belong to a valid pastel region`);
    assert.ok(
      area.leftCoord.x > 0 && area.leftCoord.x < 1 && area.leftCoord.y > 0 && area.leftCoord.y < 1,
      `Area ${area.id} must have normalized relative coordinates`
    );
  }

  const table = createEmptyEvaluationTable();
  table.ribs.left = {
    reaction: 3,
    restriction: true,
    released: true,
    releaseSigns: ['Deep sigh'],
    note: 'Intercostal guarding released after rib rock',
  };

  const synced = syncAnnotationsWithTable(table, []);
  const ribsMarkers = synced.filter((a) => a.view === 'left' && 'linkedAreaId' in a && a.linkedAreaId === 'ribs');
  assert.equal(ribsMarkers.length, 3, 'Should create Reaction (#B91C1C), Restriction (#1E3A8A), and Release (#15803D) vector markers simultaneously');
  assert.ok(ribsMarkers.some((m) => m.kind === 'reaction' && m.level === 3 && m.color === '#B91C1C'));
  assert.ok(ribsMarkers.some((m) => m.kind === 'restriction' && m.color === '#1E3A8A'));
  assert.ok(ribsMarkers.some((m) => m.kind === 'release' && m.color === '#15803D'));
});

