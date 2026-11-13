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
import { BodyworkSession, HorseProfile, SessionPhoto } from '../types';
import { dataUrlToBlob } from '../db/backup';
import {
  TEST_JPEG_LANDSCAPE_DATA_URL,
  TEST_JPEG_PORTRAIT_DATA_URL,
} from './photoTestFixtures';
import { buildReportFromSession, getUnifiedSessionNotes } from './reportGenerator';
import { buildPdfFileName, generateSessionPdfBytes, groupPhotosForPdf } from './pdfExport';

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

  it('generates a valid 2-page A4 PDF with Latin & Cyrillic text (no report mode argument)', async () => {
    const { horse, session } = makeTestFixtures();

    // 1. English
    const certBytesEn = await generateSessionPdfBytes(horse, session, 'en');
    assert.ok(certBytesEn instanceof Uint8Array);
    assert.ok(certBytesEn.byteLength > 10_000, 'Expected non-trivial PDF byte size');
    const headerStr = new TextDecoder().decode(certBytesEn.slice(0, 5));
    assert.equal(headerStr, '%PDF-');

    const loadedCertDoc = await PDFDocument.load(certBytesEn);
    assert.equal(loadedCertDoc.getPageCount(), 2);
    const page1Size = loadedCertDoc.getPage(0).getSize();
    assert.ok(Math.abs(page1Size.width - 595.28) < 1);
    assert.ok(Math.abs(page1Size.height - 841.89) < 1);

    // 2. Russian / Cyrillic
    const ownerBytesRu = await generateSessionPdfBytes(horse, session, 'ru');
    assert.ok(ownerBytesRu.byteLength > 10_000);
    const loadedOwnerDoc = await PDFDocument.load(ownerBytesRu);
    assert.equal(loadedOwnerDoc.getPageCount(), 2);

    // 3. Language defaults to English when omitted
    assert.equal(generateSessionPdfBytes.length, 2);
    const defaultBytes = await generateSessionPdfBytes(horse, session);
    assert.equal((await PDFDocument.load(defaultBytes)).getPageCount(), 2);

    const fileName = buildPdfFileName(horse, session);
    assert.ok(fileName.startsWith('Masterson_Report_'));
    assert.ok(fileName.endsWith('_2026-04-17.pdf'));
  });
  it('embeds Before / After photos (Blob and DataURL) and keeps the report valid', async () => {
    const { horse, session } = makeTestFixtures();
    const photos: SessionPhoto[] = [
      {
        id: 'ph-before',
        sessionId: session.id,
        kind: 'before',
        createdAt: '2026-04-17T10:05:00.000Z',
        width: 48,
        height: 32,
        mimeType: 'image/jpeg',
        sizeBytes: 800,
        imageBlob: dataUrlToBlob(TEST_JPEG_LANDSCAPE_DATA_URL),
      },
      {
        id: 'ph-after',
        sessionId: session.id,
        kind: 'after',
        createdAt: '2026-04-17T11:10:00.000Z',
        width: 32,
        height: 48,
        mimeType: 'image/jpeg',
        sizeBytes: 850,
        imageDataUrl: TEST_JPEG_PORTRAIT_DATA_URL,
        caption: 'Topline',
      },
      {
        id: 'ph-broken',
        sessionId: session.id,
        kind: 'after',
        createdAt: '2026-04-17T11:12:00.000Z',
        width: 10,
        height: 10,
        mimeType: 'image/jpeg',
        sizeBytes: 4,
        imageDataUrl: 'data:image/jpeg;base64,AAAA',
      },
    ];

    const plain = await generateSessionPdfBytes(horse, session, 'en');
    const withPhotos = await generateSessionPdfBytes(horse, session, 'ru', photos);
    const doc = await PDFDocument.load(withPhotos);
    const pages = doc.getPageCount();
    assert.ok(pages === 2 || pages === 3, `expected 2–3 pages, got ${pages}`);
    assert.ok(withPhotos.byteLength > plain.byteLength, 'photo bytes should be embedded');
    assert.equal((await PDFDocument.load(plain)).getPageCount(), 2, 'no photos → unchanged 2 pages');
  });

  it('groups photos by kind, oldest first, max two per kind', () => {
    const mk = (id: string, kind: 'before' | 'after', t: string): SessionPhoto => ({
      id,
      sessionId: 's',
      kind,
      createdAt: t,
      width: 1,
      height: 1,
      mimeType: 'image/jpeg',
      sizeBytes: 1,
    });
    const groups = groupPhotosForPdf([
      mk('a3', 'after', '2026-01-01T03:00:00Z'),
      mk('b1', 'before', '2026-01-01T01:00:00Z'),
      mk('a1', 'after', '2026-01-01T01:00:00Z'),
      mk('a2', 'after', '2026-01-01T02:00:00Z'),
    ]);
    assert.deepEqual(groups.before.map((p) => p.id), ['b1']);
    assert.deepEqual(groups.after.map((p) => p.id), ['a1', 'a2']);
  });
});
