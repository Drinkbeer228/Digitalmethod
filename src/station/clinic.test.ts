import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeScenarioScore,
  createScenarioSession,
  ELEPHANT_SCENARIOS,
  FIRM_BRACE_AT,
  getObservedSignsForZone,
  getVeraCommentary,
  getZoneProgressRatio,
  isScenarioComplete,
  isStationRoute,
  REACTION_SIGN_LABELS,
  RELEASE_HOLD_S,
  RESPONSE_DURATION_S,
  SEARCH_DURATION_S,
  selectZone,
  SOFT_CONTACT_MAX,
  SOFT_CONTACT_MIN,
  STATION_ZONES,
  stepScenario,
  type ScenarioSessionState,
} from './clinic';
import {
  PROGRESS_KEY,
  readSomaticProgress,
  recordPractice,
  sendStationCloseRequest,
} from './link';

function runStep(
  session: ScenarioSessionState,
  pressure: number,
  seconds: number,
  dt = 0.1
): ScenarioSessionState {
  let cur = session;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    cur = stepScenario(cur, pressure, dt);
  }
  return cur;
}

test('isStationRoute activates strictly on #/station or ?mode=station', () => {
  assert.equal(isStationRoute('', ''), false);
  assert.equal(isStationRoute('', '#editor'), false);
  assert.equal(isStationRoute('?embedded=1', ''), false);
  assert.equal(isStationRoute('?mode=clinic', ''), false);

  assert.equal(isStationRoute('?mode=station', ''), true);
  assert.equal(isStationRoute('?foo=1&mode=station', ''), true);
  assert.equal(isStationRoute('', '#/station'), true);
  assert.equal(isStationRoute('', '#/station/'), true);
  assert.equal(isStationRoute('', '#/station?case=pretty'), true);
});

test('defines all 3 station elephants and 3 post-forest palpation zones', () => {
  assert.deepEqual(
    ELEPHANT_SCENARIOS.map((e) => e.name),
    ['Марго', 'Претти', 'Одри']
  );
  assert.ok(ELEPHANT_SCENARIOS[0].careFocus.includes('пяточной области'));
  assert.ok(ELEPHANT_SCENARIOS[1].careFocus.includes('сухости складок'));
  assert.ok(ELEPHANT_SCENARIOS[2].careFocus.includes('лесного выгула и купания'));

  assert.deepEqual(
    STATION_ZONES.map((z) => z.label),
    ['Затылочная зона', 'Плечевой пояс', 'Крестцово-поясничная линия']
  );

  assert.deepEqual(
    REACTION_SIGN_LABELS.map((r) => r.label),
    ['Моргание', 'Опускание головы', 'Расслабление нижней губы', 'Зевок']
  );
});

test('palpation state machine runs search → response → stay → release across all 3 zones with score 100', () => {
  let s = createScenarioSession('pretty');

  for (const zone of STATION_ZONES) {
    s = selectZone(s, zone.id);
    assert.equal(s.zones[zone.id].phase, 'idle');

    s = runStep(s, 24, SEARCH_DURATION_S);
    assert.equal(s.zones[zone.id].phase, 'response');
    assert.ok(getObservedSignsForZone(s, zone.id).includes('blink'));
    assert.ok(getObservedSignsForZone(s, zone.id).includes('head_lower'));

    s = runStep(s, 24, RESPONSE_DURATION_S);
    assert.equal(s.zones[zone.id].phase, 'stay');
    assert.ok(getObservedSignsForZone(s, zone.id).includes('lip_relax'));
    assert.ok(getZoneProgressRatio(s.zones[zone.id]) >= 0.49);

    s = runStep(s, 24, RELEASE_HOLD_S - RESPONSE_DURATION_S + 0.1);
    assert.equal(s.zones[zone.id].phase, 'release');
    assert.equal(s.zones[zone.id].completed, true);
    assert.ok(getObservedSignsForZone(s, zone.id).includes('yawn'));
  }

  assert.equal(isScenarioComplete(s), true);
  assert.equal(computeScenarioScore(s), 100);
  const finalCommentary = getVeraCommentary(s);
  assert.equal(finalCommentary.tone, 'complete');
  assert.ok(finalCommentary.text.includes('Протокол клиники Веры Павловны'));
});

test('excessive pressure triggers brace penalty and mid-hold lift triggers lift penalty with 60 floor', () => {
  let s = createScenarioSession('margo');
  s = runStep(s, FIRM_BRACE_AT, 0.3);
  assert.equal(s.zones.poll.phase, 'brace');
  assert.equal(s.zones.poll.braces, 1);
  assert.equal(getVeraCommentary(s).tone, 'caution');

  // Easing back into soft window clears brace
  s = stepScenario(s, SOFT_CONTACT_MAX, 0.1);
  assert.equal(s.zones.poll.phase, 'search');

  // Reach response then drop hand below SOFT_CONTACT_MIN
  s = runStep(s, 25, SEARCH_DURATION_S);
  assert.equal(s.zones.poll.phase, 'response');
  s = stepScenario(s, SOFT_CONTACT_MIN - 5, 0.1);
  assert.equal(s.zones.poll.phase, 'idle');
  assert.equal(s.zones.poll.lifts, 1);
  assert.equal(computeScenarioScore(s), 85);

  // Repeated braces do not push score below 60
  for (let i = 0; i < 6; i++) {
    s = stepScenario(s, FIRM_BRACE_AT + 10, 0.1);
    s = stepScenario(s, 0, 0.1);
  }
  assert.equal(computeScenarioScore(s), 60);
});

test('completing a scenario writes ers.progress/1 under ers_progress_v1:somatic', () => {
  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };

  const scenario = ELEPHANT_SCENARIOS[2]; // Одри
  assert.equal(recordPractice(scenario.itemId, 95, storage, '2026-11-15T12:00:00.000Z'), true);
  assert.equal(recordPractice(scenario.itemId, 80, storage, '2026-11-15T12:05:00.000Z'), true);

  const raw = mem.get(PROGRESS_KEY);
  assert.ok(raw);
  const parsed = readSomaticProgress(storage);
  assert.ok(parsed);
  assert.equal(parsed.schema, 'ers.progress/1');
  assert.equal(parsed.module, 'somatic');
  assert.deepEqual(parsed.items[scenario.itemId], {
    kind: 'practice',
    status: 'done',
    at: '2026-11-15T12:05:00.000Z',
    score: 95,
  });
});

test('sendStationCloseRequest posts { type: "ers:close-request" } to location.origin', () => {
  const sent: Array<{ payload: unknown; origin: string }> = [];
  const fakeWindow = {
    location: { origin: 'https://station.example' },
    parent: {
      postMessage: (payload: unknown, origin: string) => {
        sent.push({ payload, origin });
      },
    },
  } as unknown as Window;

  assert.equal(sendStationCloseRequest(fakeWindow), true);
  assert.deepEqual(sent, [
    { payload: { type: 'ers:close-request' }, origin: 'https://station.example' },
  ]);
});

test('station clinic domain copy avoids trademarks, web jargon, and external URLs', () => {
  const forbidden = /(masterson|мастерсон|https?:\/\/|(?<![а-яёa-z])(сайт|браузер|вкладк))/iu;
  const textPool: string[] = [
    ...REACTION_SIGN_LABELS.map((r) => r.label),
    ...STATION_ZONES.flatMap((z) => [z.label, z.shortLabel, z.anatomyHint]),
  ];

  for (const e of ELEPHANT_SCENARIOS) {
    textPool.push(
      e.name,
      e.careFocus,
      e.reserveContext,
      e.scenarioTitle,
      e.scenarioBadge,
      e.completionSummary,
      e.itemId,
      e.traitTag
    );
    for (const z of STATION_ZONES) {
      const script = e.zones[z.id];
      textPool.push(script.search, script.response, script.stay, script.release, script.brace);
    }
  }

  for (const line of textPool) {
    assert.equal(forbidden.test(line), false, `Forbidden token found in station copy: "${line}"`);
  }
});
