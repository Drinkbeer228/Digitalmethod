/**
 * Embedding in Research Station (research-station: docs/station/CONTRACT.md, §4).
 * The station opens the app in an iframe with `?embedded=1`; the app answers `ready` and sends its title.
 * Sessions, notes, photos and voice stay on this device inside the app. The station's passport gets only the
 * clinic's practice results (`ers_progress_v1:somatic`, CONTRACT.md §2): an id, a status, a time and a score.
 */
const MODULE = 'somatic';
const STATION_ORIGIN = 'https://drinkbeer228.github.io';
export const PROGRESS_KEY = 'ers_progress_v1:somatic';
const ID = /^[A-Za-z0-9/_.:-]{1,120}$/;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

interface ProgressItem {
  kind: string;
  status: 'started' | 'done';
  at: string;
  score?: number;
}

function store(): Store | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * One practice result in the station's summary. `done` is never lowered to `started`, and the best score is kept
 * (CONTRACT.md §3). Returns false when the id is not valid or memory refuses.
 */
export function recordPractice(id: string, score: number, s: Store | null = store(), now = new Date().toISOString()): boolean {
  if (!ID.test(id) || !s) return false;
  try {
    let cur: { schema: string; module: string; updatedAt: string; items: Record<string, ProgressItem> } | null = null;
    try {
      const x = JSON.parse(s.getItem(PROGRESS_KEY) ?? 'null');
      if (x && x.schema === 'ers.progress/1' && x.module === MODULE && x.items && typeof x.items === 'object') cur = x;
    } catch {
      cur = null;
    }
    const next = cur ?? { schema: 'ers.progress/1', module: MODULE, updatedAt: now, items: {} };
    const prev = next.items[id];
    const best = prev && typeof prev.score === 'number' ? Math.max(prev.score, score) : score;
    next.items[id] = { kind: 'practice', status: 'done', at: now, score: Math.round(best) };
    next.updatedAt = now;
    s.setItem(PROGRESS_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export interface SomaticProgressRecord {
  schema: string;
  module: string;
  updatedAt: string;
  items: Record<string, ProgressItem>;
}

/** Reads the saved `ers_progress_v1:somatic` record safely, or null if absent/invalid. */
export function readSomaticProgress(s: Store | null = store()): SomaticProgressRecord | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s.getItem(PROGRESS_KEY) ?? 'null');
    if (
      parsed &&
      parsed.schema === 'ers.progress/1' &&
      parsed.module === MODULE &&
      parsed.items &&
      typeof parsed.items === 'object'
    ) {
      return parsed as SomaticProgressRecord;
    }
    return null;
  } catch {
    return null;
  }
}

function framed(win: Window): boolean {
  try {
    return win.parent !== win;
  } catch {
    return true;
  }
}

/** Whether the app runs inside the station's tablet. */
export function embeddedNow(win: Window = window): boolean {
  return isEmbedded(win.location.search, framed(win));
}

/**
 * Dispatches `{ type: 'ers:close-request' }` via `postMessage` to `location.origin`
 * from the Station Clinic mode (`#/station` or `?mode=station`).
 */
export function sendStationCloseRequest(win: Window = window): boolean {
  try {
    const origin = win.location?.origin;
    if (!origin || origin === 'null') return false;
    const target = win.parent ?? win;
    target.postMessage({ type: 'ers:close-request' }, origin);
    return true;
  } catch {
    return false;
  }
}

/** Asks the station to close the tablet; outside the station nothing happens. */
export function requestStationClose(win: Window = window): void {
  if (!embeddedNow(win)) return;
  try {
    win.parent.postMessage({ ers: 1, module: MODULE, type: 'close-request' }, STATION_ORIGIN);
  } catch {
    // No station to tell.
  }
}

export function isEmbedded(search: string, framed: boolean): boolean {
  return framed && new URLSearchParams(search).get('embedded') === '1';
}

export function connectStation(win: Window = window): boolean {
  let isInFrame = false;
  try {
    isInFrame = win.parent !== win;
  } catch {
    isInFrame = true;
  }
  if (!isEmbedded(win.location.search, isInFrame)) return false;
  win.document.documentElement.classList.add('ers-embedded');
  try {
    win.parent.postMessage({ ers: 1, module: MODULE, type: 'ready' }, STATION_ORIGIN);
    win.parent.postMessage({ ers: 1, module: MODULE, type: 'title', title: 'Полевой блокнот' }, STATION_ORIGIN);
  } catch {
    // No station to tell.
  }
  return true;
}
