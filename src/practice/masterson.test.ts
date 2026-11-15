import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRACE_AT, RESPONSE_S, createPractice, ELEPHANT_ZONES, LIGHT_MAX, LIGHT_MIN, PRACTICE, reaction, score, SEARCH_S, STAY_S, stayProgress, tick } from './masterson';
import { PROGRESS_KEY, recordPractice } from '../station/link';

/** Hold one pressure for `seconds`, in 0.1 s steps. */
function hold(s: ReturnType<typeof createPractice>, pressure: number, seconds: number) {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) tick(s, pressure, 0.1);
  return s;
}

test('light touch → response after the search, a 2 s stay → release; a clean session scores 100', () => {
  const s = createPractice();
  hold(s, 20, SEARCH_S - 0.2);
  assert.equal(s.phase, 'search');
  hold(s, 20, 0.3);
  assert.equal(s.phase, 'response');
  hold(s, 20, RESPONSE_S - 0.2); // the response stays visible for a beat
  assert.equal(s.phase, 'response');
  hold(s, 20, STAY_S - RESPONSE_S);
  assert.equal(s.phase, 'stay');
  assert.ok(stayProgress(s) > 0.7 && stayProgress(s) < 1);
  hold(s, 20, 0.4);
  assert.equal(s.phase, 'released');
  assert.equal(stayProgress(s), 1);
  assert.equal(score(s), 100);
  // Nothing changes after the release.
  tick(s, 90, 0.1);
  assert.equal(s.phase, 'released');
});

test('too much pressure makes her brace (a mistake once per brace), she lets go only at a light touch', () => {
  const s = createPractice();
  hold(s, BRACE_AT, 0.5);
  assert.equal(s.phase, 'brace');
  assert.equal(s.braces, 1);
  hold(s, 40, 0.5); // still above the light window
  assert.equal(s.phase, 'brace');
  tick(s, LIGHT_MAX, 0.1);
  assert.equal(s.phase, 'search');
  assert.equal(score(s), 85);
});

test('lifting the palm during the stay loses the response; pressing past the window only pauses the stay', () => {
  const s = createPractice();
  hold(s, 20, SEARCH_S + RESPONSE_S + 0.3);
  assert.equal(s.phase, 'stay');
  const before = s.timer;
  hold(s, 38, 0.5); // between the window and the brace
  assert.equal(s.phase, 'stay');
  assert.equal(s.timer, before);
  tick(s, LIGHT_MIN - 1, 0.1);
  assert.equal(s.phase, 'search');
  assert.equal(s.lifts, 1);
  assert.equal(score(s), 85);
});

test('the score never drops below 40; reactions exist in both languages; the shoulder is a zone', () => {
  const s = createPractice();
  for (let i = 0; i < 8; i++) {
    tick(s, 90, 0.1);
    tick(s, 10, 0.1);
  }
  assert.equal(score(s), 40);
  for (const lang of ['ru', 'en'] as const) assert.ok(reaction(s, lang).length > 10);
  assert.ok(ELEPHANT_ZONES.some((z) => z.id === PRACTICE.zoneId));
  assert.equal(PRACTICE.itemId, 'masterson-release/shoulder-pretty');
});

test('the result goes to ers_progress_v1:somatic as practice/done with the best score', () => {
  const data = new Map<string, string>();
  const s = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  assert.equal(recordPractice(PRACTICE.itemId, 85, s, '2026-11-15T10:00:00.000Z'), true);
  assert.equal(recordPractice(PRACTICE.itemId, 70, s, '2026-11-15T11:00:00.000Z'), true);
  const sum = JSON.parse(data.get(PROGRESS_KEY)!);
  assert.equal(sum.schema, 'ers.progress/1');
  assert.equal(sum.module, 'somatic');
  assert.deepEqual(sum.items[PRACTICE.itemId], { kind: 'practice', status: 'done', at: '2026-11-15T11:00:00.000Z', score: 85 });
  assert.equal(recordPractice('bad id!', 100, s), false);
});
