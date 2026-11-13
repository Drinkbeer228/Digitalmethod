/**
 * Which sections the exported PDF contains. Page 1 (visual map + landmark key) is always
 * included. The choice is remembered in localStorage as the default for the next export.
 */
export interface PdfExportOptions {
  /** Page-2 zone table, response / release signs, predominant diagonal */
  protocol: boolean;
  /** Myofascial kinetic lines (Elbrønd & Schultz): "N of M zones" per line */
  myofascial: boolean;
  /** Masterson work plan: session stages with marked zones, techniques and pressure */
  mastersonPlan: boolean;
  /** Owner care recommendations */
  ownerCare: boolean;
  /** Practitioner session notes */
  notes: boolean;
  /** Before / after photos (only when photos are attached) */
  photos: boolean;
}

export type PdfPresetId = 'owner' | 'specialist';

export const PDF_PRESETS: Record<PdfPresetId, PdfExportOptions> = {
  owner: {
    protocol: true,
    myofascial: false,
    mastersonPlan: false,
    ownerCare: true,
    notes: true,
    photos: true,
  },
  specialist: {
    protocol: true,
    myofascial: true,
    mastersonPlan: true,
    ownerCare: true,
    notes: true,
    photos: true,
  },
};

export const DEFAULT_PDF_EXPORT_OPTIONS: PdfExportOptions = PDF_PRESETS.owner;

export const PDF_OPTION_KEYS: Array<keyof PdfExportOptions> = [
  'protocol',
  'myofascial',
  'mastersonPlan',
  'ownerCare',
  'notes',
  'photos',
];

export const PDF_EXPORT_OPTIONS_STORAGE_KEY = 'mcd.pdfExportOptions.v1';

export function detectPreset(opts: PdfExportOptions): PdfPresetId | 'custom' {
  for (const id of Object.keys(PDF_PRESETS) as PdfPresetId[]) {
    if (PDF_OPTION_KEYS.every((k) => PDF_PRESETS[id][k] === opts[k])) return id;
  }
  return 'custom';
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function safeLocalStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Reads saved options; any missing, invalid or unreadable value falls back to the default. */
export function loadPdfExportOptions(
  storage: StorageLike | null = safeLocalStorage()
): PdfExportOptions {
  const result = { ...DEFAULT_PDF_EXPORT_OPTIONS };
  if (!storage) return result;
  try {
    const raw = storage.getItem(PDF_EXPORT_OPTIONS_STORAGE_KEY);
    if (!raw) return result;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return result;
    for (const key of PDF_OPTION_KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === 'boolean') result[key] = value;
    }
  } catch {
    // Corrupt JSON or blocked storage: use defaults
  }
  return result;
}

export function savePdfExportOptions(
  opts: PdfExportOptions,
  storage: StorageLike | null = safeLocalStorage()
): void {
  if (!storage) return;
  try {
    const clean: Record<string, boolean> = {};
    for (const key of PDF_OPTION_KEYS) clean[key] = Boolean(opts[key]);
    storage.setItem(PDF_EXPORT_OPTIONS_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Private mode / quota: the choice simply isn't remembered
  }
}
