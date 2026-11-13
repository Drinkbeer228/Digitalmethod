import test from 'node:test';
import assert from 'node:assert/strict';
import { ANATOMICAL_AREAS, createEmptyEvaluationTable } from '../data/anatomicalAreas';
import { BIOMECHANICAL_PATTERNS } from '../data/biomechanicalPatterns';
import { createDemoSession } from '../data/demoCase';
import {
  AnatomicalAreaId,
  AreaSideObservation,
  DiagramAnnotation,
  ReactionLevel,
  Side,
} from '../types';
import {
  appendPatternToNotes,
  isPatternNoteLine,
  stripPatternNoteLines,
  detectActivePatterns,
  isAreaActive,
  matchPattern,
  MAX_PATTERN_MATCHES,
} from './patternDetection';

type Mark = [AnatomicalAreaId, Side, { reaction?: ReactionLevel; restriction?: boolean }];

function makeSession(marks: Mark[], annotations: DiagramAnnotation[] = []) {
  const evaluationTable = createEmptyEvaluationTable();
  for (const [areaId, side, m] of marks) {
    evaluationTable[areaId][side] = {
      ...evaluationTable[areaId][side],
      reaction: m.reaction ?? null,
      restriction: m.restriction ?? false,
    };
  }
  return { evaluationTable, annotations };
}

const pattern = (id: number) => {
  const p = BIOMECHANICAL_PATTERNS.find((x) => x.id === id);
  assert.ok(p, `pattern ${id} exists`);
  return p;
};

test('pattern base: 15 patterns, unique ids, all trigger area ids exist', () => {
  assert.equal(BIOMECHANICAL_PATTERNS.length, 15);
  assert.equal(new Set(BIOMECHANICAL_PATTERNS.map((p) => p.id)).size, 15);
  const known = new Set(ANATOMICAL_AREAS.map((a) => a.id));
  for (const p of BIOMECHANICAL_PATTERNS) {
    for (const t of p.triggers) for (const id of t.areas) assert.ok(known.has(id), `${p.id}: ${id}`);
    if (!p.detectable) assert.ok(p.undetectableReasonRu && p.undetectableReasonEn);
    assert.ok(!p.mechanismRu.includes('\\('), 'no leftover formula markup');
  }
  assert.deepEqual(
    BIOMECHANICAL_PATTERNS.filter((p) => !p.detectable).map((p) => p.id),
    [5, 7, 11, 14, 15]
  );
});

test('poll needs reaction ≥ 2 or a restriction; other zones count from reaction 1', () => {
  const obs = (reaction: ReactionLevel | null, restriction = false): AreaSideObservation => ({
    reaction,
    restriction,
    released: false,
    note: '',
  });
  assert.equal(isAreaActive(obs(1), 'poll_top_atlas'), false);
  assert.equal(isAreaActive(obs(2), 'poll_top_atlas'), true);
  assert.equal(isAreaActive(obs(null, true), 'poll_front_atlas'), true);
  assert.equal(isAreaActive(obs(1), 'withers'), true);
  assert.equal(isAreaActive(obs(null), 'withers'), false);
});

test('ipsilateral: fires per side, not across sides, merges when both sides match', () => {
  const p4 = pattern(4); // poll + withers + hock
  const left: Mark[] = [
    ['poll_top_atlas', 'left', { reaction: 2 }],
    ['withers', 'left', { reaction: 1 }],
    ['hock', 'left', { restriction: true }],
  ];
  assert.equal(matchPattern(makeSession(left), p4)?.sides, 'left');

  const mixed: Mark[] = [
    ['poll_top_atlas', 'left', { reaction: 2 }],
    ['withers', 'left', { reaction: 1 }],
    ['hock', 'right', { reaction: 3 }],
  ];
  assert.equal(matchPattern(makeSession(mixed), p4), null);

  const both: Mark[] = [
    ...left,
    ['poll_front_atlas', 'right', { restriction: true }],
    ['withers', 'right', { reaction: 1 }],
    ['hock', 'right', { reaction: 1 }],
  ];
  assert.equal(matchPattern(makeSession(both), p4)?.sides, 'both');

  const weakPoll: Mark[] = [['poll_top_atlas', 'left', { reaction: 1 }], ...left.slice(1)];
  assert.equal(matchPattern(makeSession(weakPoll), p4), null, 'poll reaction 1 is not enough');
});

test('contralateral: needs A and B on opposite sides; either direction; diagonal confirms', () => {
  const p10 = pattern(10); // poll (A) + gluteals (B)
  const lr: Mark[] = [
    ['poll_top_atlas', 'left', { reaction: 2 }],
    ['gluteals', 'right', { reaction: 2 }],
  ];
  const m = matchPattern(makeSession(lr), p10);
  assert.equal(m?.sides, 'left_to_right');
  assert.equal(m?.diagonalConfirmed, false);

  const rl: Mark[] = [
    ['poll_front_atlas', 'right', { restriction: true }],
    ['gluteals', 'left', { reaction: 1 }],
  ];
  assert.equal(matchPattern(makeSession(rl), p10)?.sides, 'right_to_left');

  const sameSide: Mark[] = [
    ['poll_top_atlas', 'left', { reaction: 2 }],
    ['gluteals', 'left', { reaction: 2 }],
  ];
  assert.equal(matchPattern(makeSession(sameSide), p10), null);

  const diag: DiagramAnnotation = {
    id: 'd1',
    kind: 'diagonal',
    view: 'top',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    fromAnchor: 'left_atlas',
    toAnchor: 'right_gluteal',
    color: '#1E2421',
  };
  const confirmed = matchPattern(makeSession(lr, [diag]), p10);
  assert.equal(confirmed?.diagonalConfirmed, true);
  assert.equal(confirmed?.score, (m?.score ?? 0) + 1);

  // "any" group (lumbar in #3) may be on either side
  const p3 = pattern(3);
  const p3marks: Mark[] = [
    ['front_fetlock', 'right', { reaction: 1 }],
    ['lumbar', 'right', { reaction: 1 }],
    ['hock', 'left', { reaction: 2 }],
  ];
  assert.equal(matchPattern(makeSession(p3marks), p3)?.sides, 'right_to_left');
});

test('bilateral: axial groups need one side, non-axial groups need both sides', () => {
  const p1 = pattern(1); // poll (non-axial) + sacrum (axial)
  const oneSidedPoll: Mark[] = [
    ['poll_top_atlas', 'left', { reaction: 2 }],
    ['sacrum', 'right', { reaction: 1 }],
  ];
  assert.equal(matchPattern(makeSession(oneSidedPoll), p1), null);
  const bothPoll: Mark[] = [...oneSidedPoll, ['poll_front_atlas', 'right', { restriction: true }]];
  assert.equal(matchPattern(makeSession(bothPoll), p1)?.sides, 'bilateral');

  const p12 = pattern(12); // withers + thoracic + lumbar, all axial
  const axial: Mark[] = [
    ['withers', 'left', { reaction: 1 }],
    ['saddle_outline', 'right', { restriction: true }],
    ['lumbar', 'left', { reaction: 1 }],
  ];
  assert.equal(matchPattern(makeSession(axial), p12)?.sides, 'bilateral');
  assert.equal(matchPattern(makeSession(axial.slice(0, 2)), p12), null);
});

test('non-detectable patterns never fire even when every zone is marked', () => {
  const all: Mark[] = ANATOMICAL_AREAS.flatMap((a) => [
    [a.id, 'left', { reaction: 3, restriction: true }] as Mark,
    [a.id, 'right', { reaction: 3, restriction: true }] as Mark,
  ]);
  const session = makeSession(all);
  for (const id of [5, 7, 11, 14, 15]) assert.equal(matchPattern(session, pattern(id)), null);
  const top = detectActivePatterns(session);
  assert.equal(top.length, MAX_PATTERN_MATCHES);
  assert.ok(top.every((m) => m.pattern.detectable));
  for (let i = 1; i < top.length; i++) assert.ok(top[i - 1].score >= top[i].score);
});

test('empty session has no matches; demo case stays within the cap', () => {
  assert.deepEqual(detectActivePatterns(makeSession([])), []);
  const demo = detectActivePatterns(createDemoSession());
  assert.ok(demo.length <= MAX_PATTERN_MATCHES);
});

test('pattern lines are appended to notes once (de-duplicated across languages)', () => {
  const [m] = detectActivePatterns(
    makeSession([
      ['poll_top_atlas', 'left', { reaction: 2 }],
      ['gluteals', 'right', { reaction: 2 }],
    ])
  );
  assert.ok(m);
  const once = appendPatternToNotes('Existing note', m, 'ru');
  assert.ok(once.startsWith('Existing note\n💡 [Паттерн №10]'));
  assert.ok(once.includes('Диагональ Л→П'));
  assert.equal(appendPatternToNotes(once, m, 'ru'), once);
  assert.equal(appendPatternToNotes(once, m, 'en'), once);
  assert.ok(appendPatternToNotes('', m, 'en').startsWith('💡 [Pattern #10]'));
});

test('stripPatternNoteLines removes only the "[Паттерн №N]" / "[Pattern #N]" lines', () => {
  const notes = [
    'Left poll softened after LCF.',
    '💡 [Паттерн №10] Осевая связь затылок – крестец (Л) — зоны: #2 Затылок (Л)',
    '',
    '💡 [Pattern #4] Diagonal pattern (L/R)',
    '[Паттерн №7] без эмодзи',
    'Паттерн №3 обсуждали с владельцем — эта строка остаётся.',
    'Owner asked about [Pattern #2] mid-sentence — stays.',
  ].join('\n');
  const stripped = stripPatternNoteLines(notes);
  assert.equal(
    stripped,
    [
      'Left poll softened after LCF.',
      '',
      'Паттерн №3 обсуждали с владельцем — эта строка остаётся.',
      'Owner asked about [Pattern #2] mid-sentence — stays.',
    ].join('\n')
  );
  assert.equal(stripPatternNoteLines('💡 [Pattern #1] only\n[Паттерн №2] only'), '');
  assert.equal(stripPatternNoteLines(''), '');
  assert.equal(isPatternNoteLine('  💡 [Паттерн №12] x'), true);
  assert.equal(isPatternNoteLine('Note [Pattern #12]'), false);
});
