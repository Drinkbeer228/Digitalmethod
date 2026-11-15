/**
 * Practical session of the Masterson Method on an elephant (Research Station clinic): Search, Response, Stay,
 * Release (SRSR). Pure logic, no DOM. The trainee lays a palm on a muscle zone and raises the pressure slowly:
 * in the light window the elephant answers (a blink, an ear flick), the trainee stays — keeps the same light
 * pressure — for 2 s, and the release follows (licking, chewing, a yawn). Pressing too hard makes her brace;
 * lifting the palm during the stay loses the response.
 */

export type PracticePhase = 'search' | 'response' | 'stay' | 'released' | 'brace';

export interface MuscleZone {
  id: string;
  /** Russian and English names. */
  ru: string;
  en: string;
  /** Centre on the side-view diagram, viewBox 0 0 400 260. */
  x: number;
  y: number;
  r: number;
  /** The label goes above the circle (on the head, where below is the eye and the ear). */
  labelAbove?: boolean;
}

/** Muscle zones on the elephant's left side used in the clinic's practice. */
export const ELEPHANT_ZONES: readonly MuscleZone[] = [
  { id: 'poll', ru: 'Затылок', en: 'Poll', x: 84, y: 70, r: 13, labelAbove: true },
  { id: 'neck', ru: 'Шея', en: 'Neck', x: 166, y: 94, r: 15, labelAbove: true },
  { id: 'shoulder', ru: 'Плечо', en: 'Shoulder', x: 172, y: 146, r: 24 },
  { id: 'withers', ru: 'Холка', en: 'Withers', x: 212, y: 74, r: 17 },
  { id: 'back', ru: 'Спина', en: 'Back', x: 262, y: 78, r: 19 },
  { id: 'hip', ru: 'Бедро', en: 'Hip', x: 300, y: 118, r: 22 },
];

/** The session of this practice: the shoulder of Pretty, the herd's oldest elephant. */
export const PRACTICE = { zoneId: 'shoulder', elephant: 'pretty', itemId: 'masterson-release/shoulder-pretty' } as const;

/** Pressure, 0–100: the light window of the Masterson Method, and where the elephant braces. */
export const LIGHT_MIN = 12;
export const LIGHT_MAX = 32;
export const BRACE_AT = 45;
/** Seconds of light pressure before the response, and of the stay before the release. */
export const SEARCH_S = 1.2;
export const STAY_S = 2;
/** The first part of the stay during which the response (blink, ear flick) is shown. */
export const RESPONSE_S = 0.6;
const MISTAKE_COST = 15;
const MIN_SCORE = 40;

export interface PracticeState {
  phase: PracticePhase;
  /** Seconds spent in the current phase's condition (in the light window). */
  timer: number;
  mistakes: number;
  braces: number;
  lifts: number;
}

export function createPractice(): PracticeState {
  return { phase: 'search', timer: 0, mistakes: 0, braces: 0, lifts: 0 };
}

const inLight = (p: number) => p >= LIGHT_MIN && p <= LIGHT_MAX;

/** One step of the session with the current palm pressure. Returns the same object, updated. */
export function tick(s: PracticeState, pressure: number, dt: number): PracticeState {
  if (s.phase === 'released') return s;
  if (pressure >= BRACE_AT) {
    if (s.phase !== 'brace') {
      s.mistakes++;
      s.braces++;
    }
    s.phase = 'brace';
    s.timer = 0;
    return s;
  }
  if (s.phase === 'brace') {
    // She lets go of the brace only when the palm is light again.
    if (pressure <= LIGHT_MAX) {
      s.phase = 'search';
      s.timer = 0;
    }
    return s;
  }
  if (s.phase === 'search') {
    s.timer = inLight(pressure) ? s.timer + dt : 0;
    if (s.timer >= SEARCH_S) {
      s.phase = 'response';
      s.timer = 0;
    }
    return s;
  }
  // response → stay: the trainee keeps the same light pressure
  if (s.phase === 'response' || s.phase === 'stay') {
    if (pressure < LIGHT_MIN) {
      s.mistakes++;
      s.lifts++;
      s.phase = 'search';
      s.timer = 0;
      return s;
    }
    if (!inLight(pressure)) {
      // Pressing past the window (still below the brace): the stay does not count, nothing is lost yet.
      return s;
    }
    s.timer += dt;
    s.phase = s.timer < RESPONSE_S ? 'response' : 'stay';
    if (s.timer >= STAY_S) {
      s.phase = 'released';
      s.timer = STAY_S;
    }
  }
  return s;
}

export function score(s: PracticeState): number {
  return Math.max(MIN_SCORE, 100 - s.mistakes * MISTAKE_COST);
}

/** Share of the stay done, 0–1, for the hold indicator. */
export const stayProgress = (s: PracticeState): number =>
  s.phase === 'released' ? 1 : s.phase === 'stay' || s.phase === 'response' ? Math.min(1, s.timer / STAY_S) : 0;

/** The elephant's visible answer in each phase. */
export function reaction(s: PracticeState, lang: 'ru' | 'en'): string {
  const ru = lang === 'ru';
  switch (s.phase) {
    case 'search':
      return ru ? 'Претти стоит спокойно. Медленно добавляйте лёгкое давление ладонью.' : 'Pretty stands calmly. Add light palm pressure slowly.';
    case 'response':
      return ru ? 'Моргнула и повела ухом — это отклик. Не меняйте давление.' : 'She blinked and flicked an ear — the response. Keep the pressure.';
    case 'stay':
      return ru ? 'Держите то же лёгкое давление…' : 'Stay with the same light pressure…';
    case 'released':
      return ru ? 'Облизнулась, жуёт и зевает — релиз! Мышца плеча отпустила.' : 'Licking, chewing and a yawn — the release! The shoulder let go.';
    case 'brace':
      return ru ? 'Напряглась и отклонилась — слишком сильно. Ослабьте до лёгкого касания.' : 'She braced and leaned away — too much. Ease off to a light touch.';
  }
}
