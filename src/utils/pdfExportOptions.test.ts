import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PDF_EXPORT_OPTIONS,
  detectPreset,
  loadPdfExportOptions,
  PDF_EXPORT_OPTIONS_STORAGE_KEY,
  PDF_PRESETS,
  savePdfExportOptions,
} from './pdfExportOptions';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

test('defaults to the owner preset: no myofascial lines, no work plan', () => {
  assert.deepEqual(DEFAULT_PDF_EXPORT_OPTIONS, PDF_PRESETS.owner);
  assert.equal(PDF_PRESETS.owner.myofascial, false);
  assert.equal(PDF_PRESETS.owner.mastersonPlan, false);
  assert.equal(PDF_PRESETS.owner.ownerCare, true);
  assert.ok(Object.values(PDF_PRESETS.specialist).every(Boolean));
});

test('detects presets and custom choices', () => {
  assert.equal(detectPreset({ ...PDF_PRESETS.owner }), 'owner');
  assert.equal(detectPreset({ ...PDF_PRESETS.specialist }), 'specialist');
  assert.equal(detectPreset({ ...PDF_PRESETS.owner, photos: false }), 'custom');
});

test('saves and loads the choice', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadPdfExportOptions(storage), DEFAULT_PDF_EXPORT_OPTIONS);
  const custom = { ...PDF_PRESETS.specialist, notes: false };
  savePdfExportOptions(custom, storage);
  assert.deepEqual(loadPdfExportOptions(storage), custom);
});

test('corrupt or partial saved data falls back to defaults per field', () => {
  assert.deepEqual(
    loadPdfExportOptions(memoryStorage({ [PDF_EXPORT_OPTIONS_STORAGE_KEY]: '{not json' })),
    DEFAULT_PDF_EXPORT_OPTIONS
  );
  const partial = loadPdfExportOptions(
    memoryStorage({
      [PDF_EXPORT_OPTIONS_STORAGE_KEY]: JSON.stringify({ myofascial: true, notes: 'yes', extra: 1 }),
    })
  );
  assert.equal(partial.myofascial, true);
  assert.equal(partial.notes, DEFAULT_PDF_EXPORT_OPTIONS.notes);
  assert.ok(!('extra' in partial));
});

test('blocked storage never throws', () => {
  const throwing = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceeded');
    },
  };
  assert.deepEqual(loadPdfExportOptions(throwing), DEFAULT_PDF_EXPORT_OPTIONS);
  assert.doesNotThrow(() => savePdfExportOptions(PDF_PRESETS.specialist, throwing));
  assert.deepEqual(loadPdfExportOptions(null), DEFAULT_PDF_EXPORT_OPTIONS);
});

test('pattern lines: off for owner, on for specialist; older saved specialist choice stays specialist', () => {
  assert.equal(PDF_PRESETS.owner.patternNotes, false);
  assert.equal(PDF_PRESETS.specialist.patternNotes, true);
  const { patternNotes: _p, ...oldSpecialist } = PDF_PRESETS.specialist;
  const oldOwner = { ...PDF_PRESETS.owner } as Partial<typeof PDF_PRESETS.owner>;
  delete oldOwner.patternNotes;
  const loadedSpec = loadPdfExportOptions(
    memoryStorage({ [PDF_EXPORT_OPTIONS_STORAGE_KEY]: JSON.stringify(oldSpecialist) })
  );
  const loadedOwner = loadPdfExportOptions(
    memoryStorage({ [PDF_EXPORT_OPTIONS_STORAGE_KEY]: JSON.stringify(oldOwner) })
  );
  assert.equal(detectPreset(loadedSpec), 'specialist');
  assert.equal(detectPreset(loadedOwner), 'owner');
});
