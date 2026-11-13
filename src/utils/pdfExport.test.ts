import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  ANATOMICAL_AREAS,
  BODY_PART_FILTERS,
  BODY_SEGMENTS,
  createEmptyEvaluationTable,
  getBodySegmentForArea,
  matchesBodyPartFilter,
  syncAnnotationsWithTable,
} from '../data/anatomicalAreas';
import {
  MASTERSON_TECHNIQUES,
  MORE_RELEASE_SIGNS,
  QUICK_RELEASE_CHIPS,
  RESISTANCE_SIGNS,
} from '../data/translations';
import { BodyworkSession, HorseProfile } from '../types';
import { buildReportFromSession, getUnifiedSessionNotes } from './reportGenerator';
import { buildPdfFileName, generateSessionPdfBytes } from './pdfExport';

function makeTestFixtures(): { horse: HorseProfile; session: BodyworkSession } {
  const nowIso = '2026-04-17T10:00:00.000Z';
  const horse: HorseProfile = {
    id: 'horse-test-1',
    name: 'Альтаир (Altair)',
    age: '9',
    breed: 'KWPN Warmblood',
    job: 'Dressage / Выездка',
    owner: 'Елена Смирнова',
    contactInfo: '', // Empty optional field — should be omitted in PDF metadata
    notes: '',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const table = createEmptyEvaluationTable();
  table.poll_top_atlas.left = {
    reaction: 2,
    restriction: true,
    released: true,
    releaseSigns: ['Blink / Soft eye', 'Yawn', 'Lick & chew'],
    yawnCount: 3,
    resistanceSigns: ['Bracing / Guarding'],
    techniques: ['Bladder Meridian', 'Poll / Atlas', 'Lateral Cervical Flexion'],
    note: 'Softened after 3 yawns / Смягчился после 3 зевков',
  };
  table.gluteals.right = {
    reaction: 3,
    restriction: true,
    released: true,
    releaseSigns: ['Deep sigh / Shake', 'Gut sounds (GI)'],
    resistanceSigns: ['Tail clamp / swish'],
    techniques: ['Hind End Points', 'Sacrum Float'],
    note: 'High reactivity on initial palpation',
  };

  const annotations = syncAnnotationsWithTable(table, [
    {
      id: 'diag-test-1',
      kind: 'diagonal',
      view: 'top',
      start: { x: 0.205, y: 0.365 },
      end: { x: 0.818, y: 0.735 },
      fromAnchor: 'left_atlas',
      toAnchor: 'right_gluteal',
      color: '#1E2421',
      label: 'Left Atlas → Right Gluteal',
    },
  ]);

  const session: BodyworkSession = {
    id: 'session-test-1',
    horseId: horse.id,
    practitioner: 'Anna Petrova',
    caseStudyNumber: 'CS-07',
    sessionNumber: 2,
    date: '2026-04-17',
    duration: '60 min',
    generalNotes: 'Left poll and right gluteal diagonal pattern. Released with LCF.',
    manualVoiceNotes: 'Legacy voice note merged cleanly.',
    evaluationTable: table,
    annotations,
    reportSections: {
      initialEvaluation: '',
      restrictionsIdentified: '',
      releaseSignsObserved: '',
      predominantDiagonal: '',
      sessionNotes: '',
      postSessionCareNotes: '24 hours turnout and hand-walking. / 24 часа выгула и шаговки.',
    },
    reportCustomized: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  session.reportSections = buildReportFromSession(session, 'en');
  return { horse, session };
}

describe('Complete Masterson Taxonomy, Lower-Limb Hit Targets & Offline A4 PDF Export', () => {
  it('partitions all 19 anatomical areas into 5 body-part filters (All: 19, Head: 4, Torso: 8, Front: 4, Hind: 3)', () => {
    assert.equal(BODY_PART_FILTERS.length, 5);
    assert.deepEqual(
      BODY_PART_FILTERS.map((f) => ({ id: f.id, count: f.areaIds.length })),
      [
        { id: 'all', count: 19 },
        { id: 'head', count: 4 },
        { id: 'torso', count: 8 },
        { id: 'front', count: 4 },
        { id: 'hind', count: 3 },
      ]
    );
    assert.equal(matchesBodyPartFilter('poll_front_atlas', 'head'), true);
    assert.equal(matchesBodyPartFilter('neck', 'head'), true);
    assert.equal(matchesBodyPartFilter('shoulder', 'head'), false);
    assert.equal(matchesBodyPartFilter('shoulder', 'torso'), true);
    assert.equal(matchesBodyPartFilter('sacrum', 'torso'), true);
    assert.equal(matchesBodyPartFilter('hoof_point', 'front'), true);
    assert.equal(matchesBodyPartFilter('front_fetlock', 'front'), true);
    assert.equal(matchesBodyPartFilter('hamstrings', 'hind'), true);
    assert.equal(matchesBodyPartFilter('hind_fetlock', 'hind'), true);
    assert.equal(matchesBodyPartFilter('hind_fetlock', 'all'), true);
  });

  it('partitions all 19 anatomical areas into 3 interactive body segments (Head & Neck: 4, Torso & Pelvis: 8, Limbs & Hooves: 7)', () => {
    assert.equal(BODY_SEGMENTS.length, 3);
    assert.deepEqual(
      BODY_SEGMENTS.map((s) => ({ id: s.id, count: s.areaIds.length })),
      [
        { id: 'head_neck', count: 4 },
        { id: 'torso_pelvis', count: 8 },
        { id: 'limbs', count: 7 },
      ]
    );
    const allGroupedIds = BODY_SEGMENTS.flatMap((s) => s.areaIds);
    assert.equal(allGroupedIds.length, 19);
    assert.equal(new Set(allGroupedIds).size, 19);
    assert.equal(getBodySegmentForArea('poll_front_atlas'), 'head_neck');
    assert.equal(getBodySegmentForArea('saddle_outline'), 'torso_pelvis');
    assert.equal(getBodySegmentForArea('hoof_point'), 'limbs');
    assert.equal(getBodySegmentForArea('hind_fetlock'), 'limbs');
  });

  it('defines all 8 quick release chips, 6 additional release signs, 5 resistance signs, and 12 Masterson techniques', () => {
    assert.equal(QUICK_RELEASE_CHIPS.length, 8);
    assert.deepEqual(
      QUICK_RELEASE_CHIPS.map((c) => c.en),
      [
        'Blink / Soft eye',
        'Lip twitch',
        'Fidgeting',
        'Lick & chew',
        'Yawn',
        'Snort / Sneeze',
        'Head drop',
        'Deep sigh / Shake',
      ]
    );
    assert.equal(MORE_RELEASE_SIGNS.length, 6);
    assert.equal(RESISTANCE_SIGNS.length, 5);
    assert.equal(MASTERSON_TECHNIQUES.length, 12);
  });

  it('increases lower-limb point landmark hitRadius to 0.045–0.05 without overlapping centers', () => {
    const lowerLimbIds = [
      'hoof_point',
      'knee',
      'front_fetlock',
      'hock',
      'hind_fetlock',
      'front_splints',
    ] as const;

    for (const id of lowerLimbIds) {
      const area = ANATOMICAL_AREAS.find((a) => a.id === id);
      assert.ok(area, `Missing area ${id}`);
      assert.ok(
        area.hitRadius >= 0.045 && area.hitRadius <= 0.05,
        `Expected ${id} hitRadius in [0.045, 0.05], got ${area.hitRadius}`
      );
    }
  });

  it('unifies generalNotes and legacy manualVoiceNotes without data loss or duplication', () => {
    const { session } = makeTestFixtures();
    const unified = getUnifiedSessionNotes(session);
    assert.ok(unified.includes('Left poll and right gluteal diagonal pattern.'));
    assert.ok(unified.includes('Legacy voice note merged cleanly.'));

    const reportEn = buildReportFromSession(session, 'en');
    assert.ok(reportEn.releaseSignsObserved.includes('Yawn ×3'));
    assert.ok(reportEn.releaseSignsObserved.includes('Bracing / Guarding'));
    assert.ok(reportEn.sessionNotes.includes('Lateral Cervical Flexion'));
    assert.ok(reportEn.postSessionCareNotes.includes('24 hours turnout'));

    const reportRu = buildReportFromSession(session, 'ru');
    assert.ok(reportRu.releaseSignsObserved.includes('Зевание ×3'));
    assert.ok(reportRu.releaseSignsObserved.includes('Зажатость / Охрана зоны'));
  });

  it('generates a valid 2-page A4 PDF in Certification and Owner modes with Latin & Cyrillic text', async () => {
    const { horse, session } = makeTestFixtures();

    // 1. Certification mode (English)
    const certBytesEn = await generateSessionPdfBytes(
      horse,
      session,
      'certification',
      'en'
    );
    assert.ok(certBytesEn instanceof Uint8Array);
    assert.ok(certBytesEn.byteLength > 10_000, 'Expected non-trivial PDF byte size');
    const headerStr = new TextDecoder().decode(certBytesEn.slice(0, 5));
    assert.equal(headerStr, '%PDF-');

    const loadedCertDoc = await PDFDocument.load(certBytesEn);
    assert.equal(loadedCertDoc.getPageCount(), 2);
    const page1Size = loadedCertDoc.getPage(0).getSize();
    assert.ok(Math.abs(page1Size.width - 595.28) < 1);
    assert.ok(Math.abs(page1Size.height - 841.89) < 1);

    // 2. Owner mode (Russian / Cyrillic)
    const ownerBytesRu = await generateSessionPdfBytes(horse, session, 'owner', 'ru');
    assert.ok(ownerBytesRu.byteLength > 10_000);
    const loadedOwnerDoc = await PDFDocument.load(ownerBytesRu);
    assert.equal(loadedOwnerDoc.getPageCount(), 2);

    const fileName = buildPdfFileName(horse, session);
    assert.ok(fileName.startsWith('Masterson_Report_'));
    assert.ok(fileName.endsWith('_2026-04-17.pdf'));
  });
});
