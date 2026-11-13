import test from 'node:test';
import assert from 'node:assert/strict';
import { ANATOMICAL_AREAS, createEmptyEvaluationTable } from './anatomicalAreas';
import {
  formatPressureRange,
  getLineLinksForArea,
  getSessionPhaseForArea,
  getTechniquesForArea,
  getZonesOnLine,
  isAreaMarked,
  MYOFASCIAL_LINES,
  PRESSURE_LEVELS,
  SESSION_PHASES,
  ZONE_LINE_LINKS,
  ZONE_TECHNIQUES,
} from './clinicalReference';

const areaIds = new Set(ANATOMICAL_AREAS.map((a) => a.id));
const lineIds = new Set(MYOFASCIAL_LINES.map((l) => l.id));

test('defines the 11 equine myofascial lines with sources', () => {
  assert.equal(MYOFASCIAL_LINES.length, 11);
  assert.equal(lineIds.size, 11);
  for (const l of MYOFASCIAL_LINES) {
    assert.ok(l.ref.source && l.ref.page, `line ${l.id} needs a source and page`);
  }
});

test('every zone→line link points at a real zone and line and carries a cited quote', () => {
  const seen = new Set<string>();
  for (const link of ZONE_LINE_LINKS) {
    assert.ok(areaIds.has(link.areaId), `unknown zone ${link.areaId}`);
    assert.ok(lineIds.has(link.lineId), `unknown line ${link.lineId}`);
    assert.ok(link.ref.source && link.ref.page && link.ref.quote, `${link.areaId}/${link.lineId} needs a citation`);
    const key = `${link.areaId}:${link.lineId}`;
    assert.ok(!seen.has(key), `duplicate link ${key}`);
    seen.add(key);
  }
  // Zones the sources do not place on any line stay unlinked rather than guessed
  assert.equal(getLineLinksForArea('hoof_point').length, 0);
  assert.equal(getLineLinksForArea('front_splints').length, 0);
});

test('new pelvic zones sit on the lines the dissections describe', () => {
  assert.deepEqual(getLineLinksForArea('tuber_coxae').map((l) => l.lineId).sort(), ['LL', 'SL']);
  assert.deepEqual(getLineLinksForArea('under_tail').map((l) => l.lineId).sort(), ['DDL', 'SDL']);
  const sdl = getZonesOnLine('SDL', 'under_tail');
  assert.ok(sdl.includes('hamstrings') && sdl.includes('poll_top_atlas'));
  assert.ok(!sdl.includes('under_tail'));
  // Ordered by zone index
  const idx = sdl.map((id) => ANATOMICAL_AREAS.find((a) => a.id === id)!.index);
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
});

test('technique entries are cited and use the Masterson pressure scale', () => {
  const levels = PRESSURE_LEVELS.map((p) => p.id);
  for (const t of ZONE_TECHNIQUES) {
    assert.ok(areaIds.has(t.areaId), `unknown zone ${t.areaId}`);
    assert.ok(t.techniques.length > 0);
    assert.ok(t.ref.source && t.ref.page && t.ref.quote, `${t.areaId} needs a citation`);
    if (t.pressure) {
      assert.ok(levels.indexOf(t.pressure.from) <= levels.indexOf(t.pressure.to), `${t.areaId} pressure range reversed`);
    } else {
      assert.ok(t.handlingEn && t.handlingRu, `${t.areaId} needs a handling note when pressure is not graded`);
    }
  }
  assert.equal(new Set(ZONE_TECHNIQUES.map((t) => t.areaId)).size, ZONE_TECHNIQUES.length);
  assert.equal(getTechniquesForArea('front_splints'), undefined);
  assert.equal(formatPressureRange(getTechniquesForArea('under_tail')!.pressure, 'en'), 'Air gap → Egg yolk');
});

test('session phases cover every zone exactly once, hind end starts with Under-the-Tail', () => {
  const all = SESSION_PHASES.flatMap((p) => p.areaIds);
  assert.equal(all.length, ANATOMICAL_AREAS.length);
  assert.equal(new Set(all).size, ANATOMICAL_AREAS.length);
  assert.deepEqual(SESSION_PHASES.map((p) => p.order), [1, 2, 3, 4, 5]);
  const hind = getSessionPhaseForArea('sacrum')!;
  assert.equal(hind.id, 'hind_end');
  assert.equal(hind.areaIds[0], 'under_tail');
  assert.equal(getSessionPhaseForArea('poll_top_atlas')!.order < hind.order, true);
});

test('isAreaMarked tolerates missing rows from older sessions', () => {
  const table = createEmptyEvaluationTable();
  assert.equal(isAreaMarked(table, 'gluteals'), false);
  table.gluteals.right = { ...table.gluteals.right, reaction: 2 };
  assert.equal(isAreaMarked(table, 'gluteals'), true);
  const legacy = { ...table } as Partial<typeof table>;
  delete legacy.under_tail;
  assert.equal(isAreaMarked(legacy as typeof table, 'under_tail'), false);
  assert.equal(isAreaMarked(undefined, 'under_tail'), false);
});
