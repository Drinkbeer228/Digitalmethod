/**
 * Pure domain logic for Vera Pavlovna's Rehabilitation Clinic tablet mode
 * (`#/station` or `?mode=station`), designed for offline integration with the
 * research-station 2D game. Zero DOM dependencies, zero external network calls.
 */

export type ElephantId = 'margo' | 'pretty' | 'audrey';
export type ZoneId = 'poll' | 'shoulder' | 'sacrolumbar';
export type PalpationPhase = 'idle' | 'search' | 'response' | 'stay' | 'release' | 'brace';
export type ReleaseReactionId = 'blink' | 'head_lower' | 'lip_relax' | 'yawn';

export interface ReactionBadgeMeta {
  id: ReleaseReactionId;
  label: string;
}

export const REACTION_SIGN_LABELS: readonly ReactionBadgeMeta[] = [
  { id: 'blink', label: 'Моргание' },
  { id: 'head_lower', label: 'Опускание головы' },
  { id: 'lip_relax', label: 'Расслабление нижней губы' },
  { id: 'yawn', label: 'Зевок' },
];

export interface ZoneCoordinate {
  id: ZoneId;
  label: string;
  shortLabel: string;
  anatomyHint: string;
  /** Center on viewBox 0 0 520 320 */
  x: number;
  y: number;
  r: number;
}

export const STATION_ZONES: readonly ZoneCoordinate[] = [
  {
    id: 'poll',
    label: 'Затылочная зона',
    shortLabel: 'Затылок',
    anatomyHint: 'Гребень затылка и основание ушных складок',
    x: 112,
    y: 86,
    r: 18,
  },
  {
    id: 'shoulder',
    label: 'Плечевой пояс',
    shortLabel: 'Плечо',
    anatomyHint: 'Лопаточно-плечевая мускулатура и передняя опора',
    x: 212,
    y: 162,
    r: 25,
  },
  {
    id: 'sacrolumbar',
    label: 'Крестцово-поясничная линия',
    shortLabel: 'Крестец и поясница',
    anatomyHint: 'Верхняя линия поясницы, крестца и тазового перехода',
    x: 344,
    y: 108,
    r: 24,
  },
];

export interface ZoneDialogueScript {
  search: string;
  response: string;
  stay: string;
  release: string;
  brace: string;
  responseSigns: readonly ReleaseReactionId[];
  releaseSigns: readonly ReleaseReactionId[];
}

export interface ElephantScenarioProfile {
  id: ElephantId;
  name: string;
  /** Exact clinical passport focus */
  careFocus: string;
  reserveContext: string;
  scenarioTitle: string;
  scenarioBadge: string;
  completionSummary: string;
  /** Persisted item key in ers_progress_v1:somatic */
  itemId: string;
  /** Subtle visual accent trait for the field illustration */
  traitTag: string;
  zones: Record<ZoneId, ZoneDialogueScript>;
}

export const ELEPHANT_SCENARIOS: readonly ElephantScenarioProfile[] = [
  {
    id: 'margo',
    name: 'Марго',
    careFocus: 'контроль пяточной области и нагрузки на передние конечности',
    reserveContext:
      'Вернулась с утреннего обхода лесной тропы: проверяем распределение веса и разгрузку передних ног.',
    scenarioTitle: 'Осмотр после лесного маршрута: баланс передней опоры',
    scenarioBadge: 'После лесной тропы',
    completionSummary:
      'Плечевой пояс и спина разгружены — Марго равномерно переносит вес на пяточные подушки без зажима.',
    itemId: 'clinic/margo-forest',
    traitTag: 'Опорный баланс',
    zones: {
      poll: {
        search:
          'Начнём с затылочной зоны Марго. Положите ладонь невесомо за гребень — вес не должен переходить на передние конечности.',
        response:
          'Видите мягкое моргание и плавное опускание головы? Шея отпускает компенсацию после тропы.',
        stay:
          'Сохраняйте то же лёгкое тепло на затылке: Марго выравнивает дыхание и смягчает линию челюсти.',
        release:
          'Глубокий зевок и расслабление нижней губы! Затылочный узел разжался — нагрузка спереди уже ниже.',
        brace:
          'Слишком плотно — Марго напрягла затылок и ушла весом в пятки. Ослабьте ладонь до лёгкого касания.',
        responseSigns: ['blink', 'head_lower'],
        releaseSigns: ['blink', 'head_lower', 'lip_relax', 'yawn'],
      },
      shoulder: {
        search:
          'Переходите на плечевой пояс. Мягкая фасциальная пальпация поможет снять усталость с передней опоры и пяток.',
        response:
          'Отклик пошёл: частое мягкое моргание и лёгкое опускание головы — лопатка начинает скользить свободно.',
        stay:
          'Не усиливайте нажим, просто ждите в окне контакта — фасция плеча сама перестраивает натяжение.',
        release:
          'Замечательно: протяжный зевок и расслабление нижней губы. Передние конечности встали мягче и ровнее.',
        brace:
          'Плечо замкнулось от сильного давления. Снимите лишний нажим и вернитесь к невесомому контакту.',
        responseSigns: ['blink', 'head_lower'],
        releaseSigns: ['blink', 'head_lower', 'lip_relax', 'yawn'],
      },
      sacrolumbar: {
        search:
          'Проверяем крестцово-поясничную линию: когда задняя линия работает свободно, пяточная область передних ног отдыхает.',
        response:
          'Хороший отклик — опускание головы и спокойное моргание, таз перестал поджиматься.',
        stay:
          'Побудьте с этим прикосновением ещё секунду, дайте пояснице отдать остаточное напряжение.',
        release:
          'Есть полный релиз: выраженное расслабление нижней губы и тёплый зевок. Осмотр Марго завершён чисто.',
        brace:
          'Марго поджала поясницу — давление выше порога комфорта. Ослабьте руку и дождитесь мягкости.',
        responseSigns: ['blink', 'head_lower'],
        releaseSigns: ['blink', 'head_lower', 'lip_relax', 'yawn'],
      },
    },
  },
  {
    id: 'pretty',
    name: 'Претти',
    careFocus: 'профилактика сухости складок и затылочно-шейного зажима',
    reserveContext:
      'Вернулась с ветреной опушки заповедника: кожа за ушами пересохла, а затылок удерживает осторожное напряжение.',
    scenarioTitle: 'Осмотр после прогулки: бережная работа со складками и шеей',
    scenarioBadge: 'Профилактика зажима',
    completionSummary:
      'Затылочно-шейный зажим снят мягким контактом, кожа складок спокойна и готова к увлажняющему уходу.',
    itemId: 'clinic/pretty-forest',
    traitTag: 'Затылок и складки',
    zones: {
      poll: {
        search:
          'У Претти чувствительны складки за ушами. Касайтесь затылочной зоны так бережно, словно слушаете пульс.',
        response:
          'Прекрасно: едва заметное моргание и опускание головы показывают, что зажим у основания ушей тает.',
        stay:
          'Остаёмся в мягком окне контакта — не сдвигайте складку, дайте ткани самой расправиться под ладонью.',
        release:
          'Чистый релиз: расслабление нижней губы и долгий зевок! Затылочно-шейный переход полностью смягчился.',
        brace:
          'Претти отстранилась и зажала шею — кожа складок не терпит нажима. Верните руке лёгкость.',
        responseSigns: ['blink', 'head_lower'],
        releaseSigns: ['blink', 'head_lower', 'lip_relax', 'yawn'],
      },
      shoulder: {
        search:
          'Теперь прослушаем плечевой пояс Претти — шейный зажим часто тянет за собой верхнюю дугу лопатки.',
        response:
          'Отклик есть: спокойное моргание и мягкое опускание головы в такт выдоху.',
        stay:
          'Держим ровный невесомый контакт — ткани плеча выравниваются следом за шеей.',
        release:
          'Отлично! Расслабление нижней губы и глубокий зевок подтверждают, что фасция плеча отпустила.',
        brace:
          'Слишком твёрдая ладонь — Претти сдержала дыхание. Смягчите контакт до минимального касания.',
        responseSigns: ['blink', 'head_lower'],
        releaseSigns: ['blink', 'head_lower', 'lip_relax', 'yawn'],
      },
      sacrolumbar: {
        search:
          'Завершаем крестцово-поясничной линией, чтобы выровнять всю верхнюю цепочку после затылочно-шейной разгрузки.',
        response:
          'Смотрите: плавное опускание головы и тихое моргание — волна расслабления дошла до крестца.',
        stay:
          'Удерживайте ту же бережную паузу, пока спина окончательно не опустится в покой.',
        release:
          'Релиз по всей линии: мягкое расслабление нижней губы и финальный зевок. Протокол Претти выполнен.',
        brace:
          'Напряжение вернулось из-за сильного нажима. Ослабьте ладонь — Претти откликается только на мягкость.',
        responseSigns: ['blink', 'head_lower'],
        releaseSigns: ['blink', 'head_lower', 'lip_relax', 'yawn'],
      },
    },
  },
  {
    id: 'audrey',
    name: 'Одри',
    careFocus: 'восстановление после лесного выгула и купания',
    reserveContext:
      'Только что вернулась из лесного заповедника и речного купания: разогретые мышцы остывают, нужна плавная соматическая разгрузка.',
    scenarioTitle: 'Осмотр после выгула и купания: глубокое восстановление',
    scenarioBadge: 'После купания',
    completionSummary:
      'Одри полностью восстановилась после активного лесного выгула и воды — все три зоны мягкие и симметричные.',
    itemId: 'clinic/audrey-forest',
    traitTag: 'Восстановление',
    zones: {
      poll: {
        search:
          'Одри ещё бодра после воды и лесной тропы. Положите ладонь на затылочную зону и дайте ей выдохнуть.',
        response:
          'Вот и первый знак доверия — медленное моргание и опускание головы вниз.',
        stay:
          'Задержитесь на том же лёгком уровне — суета после купания уходит из затылка.',
        release:
          'Есть релиз! Выраженное расслабление нижней губы и спокойный зевок — нервная система перешла в отдых.',
        brace:
          'Слишком сильно нажали — Одри вскинула голову и напряглась. Уменьшите давление в окно мягкого контакта.',
        responseSigns: ['blink', 'head_lower'],
        releaseSigns: ['blink', 'head_lower', 'lip_relax', 'yawn'],
      },
      shoulder: {
        search:
          'Переходим к плечевому поясу — в воде и на подъёмах плечи Одри несли основную работу.',
        response:
          'Заметили моргание и мягкое опускание головы? Лопатка отвечает на тёплое касание.',
        stay:
          'Сохраняем ровный контакт без толчков, слушаем постепенное смягчение фасции.',
        release:
          'Замечательный отклик: расслабление нижней губы и широкий зевок — плечевой пояс полностью свободен.',
        brace:
          'Одри поджала плечо от избыточного нажима. Ослабьте руку до комфортной лёгкости.',
        responseSigns: ['blink', 'head_lower'],
        releaseSigns: ['blink', 'head_lower', 'lip_relax', 'yawn'],
      },
      sacrolumbar: {
        search:
          'И последний этап — крестцово-поясничная линия Одри после плавания и лесных подъёмов.',
        response:
          'Спина смягчается: опускание головы и тёплое моргание говорят о готовности к релизу.',
        stay:
          'Ещё немного спокойного удержания — поясничная фасция добирает тепло.',
        release:
          'Полный соматический релиз: глубокий зевок и расслабление нижней губы! Одри готова к отдыху в вольере.',
        brace:
          'Поясница сгруппировалась — контакт стал слишком жёстким. Вернитесь к мягкому прикосновению.',
        responseSigns: ['blink', 'head_lower'],
        releaseSigns: ['blink', 'head_lower', 'lip_relax', 'yawn'],
      },
    },
  },
];

/** Pressure window (0–100 scale) */
export const SOFT_CONTACT_MIN = 15;
export const SOFT_CONTACT_MAX = 38;
export const FIRM_BRACE_AT = 50;

/** Phase timings (seconds) */
export const SEARCH_DURATION_S = 0.6;
export const RESPONSE_DURATION_S = 0.8;
export const RELEASE_HOLD_S = 1.6;

const BRACE_PENALTY = 10;
const LIFT_PENALTY = 5;
const MIN_SESSION_SCORE = 60;

export interface ZonePalpationState {
  phase: PalpationPhase;
  timer: number;
  braces: number;
  lifts: number;
  completed: boolean;
}

export interface ScenarioSessionState {
  elephantId: ElephantId;
  activeZoneId: ZoneId;
  pressure: number;
  zones: Record<ZoneId, ZonePalpationState>;
}

/**
 * Returns true ONLY when the app URL explicitly opens Station Clinic mode
 * via `#/station` hash route or `?mode=station` query parameter.
 * Root `/` and other routes remain strictly untouched.
 */
export function isStationRoute(search: string, hash: string): boolean {
  try {
    const params = new URLSearchParams(search);
    if (params.get('mode') === 'station') return true;
  } catch {
    // Ignore malformed query
  }
  const normalizedHash = hash.trim().toLowerCase();
  return /^#\/station(?:[/?#]|$)/.test(normalizedHash);
}

export function getElephantScenario(id: ElephantId): ElephantScenarioProfile {
  return ELEPHANT_SCENARIOS.find((e) => e.id === id) ?? ELEPHANT_SCENARIOS[0];
}

function emptyZoneState(): ZonePalpationState {
  return { phase: 'idle', timer: 0, braces: 0, lifts: 0, completed: false };
}

export function createScenarioSession(elephantId: ElephantId): ScenarioSessionState {
  return {
    elephantId,
    activeZoneId: 'poll',
    pressure: 0,
    zones: {
      poll: emptyZoneState(),
      shoulder: emptyZoneState(),
      sacrolumbar: emptyZoneState(),
    },
  };
}

export function selectZone(
  session: ScenarioSessionState,
  zoneId: ZoneId
): ScenarioSessionState {
  if (session.activeZoneId === zoneId) return session;
  return {
    ...session,
    activeZoneId: zoneId,
    pressure: 0,
  };
}

export const inSoftWindow = (pressure: number): boolean =>
  pressure >= SOFT_CONTACT_MIN && pressure <= SOFT_CONTACT_MAX;

/**
 * Advances the active zone's palpation state by `dt` seconds at `pressure`.
 * Immutable update safe for React state and deterministic unit tests.
 */
export function stepScenario(
  session: ScenarioSessionState,
  pressure: number,
  dt: number
): ScenarioSessionState {
  const zoneId = session.activeZoneId;
  const cur = session.zones[zoneId];

  if (cur.completed) {
    return pressure === session.pressure ? session : { ...session, pressure };
  }

  let nextZone: ZonePalpationState = { ...cur };

  const EPS = 1e-9;

  if (pressure >= FIRM_BRACE_AT) {
    if (cur.phase !== 'brace') {
      nextZone.braces += 1;
    }
    nextZone.phase = 'brace';
    nextZone.timer = 0;
  } else if (cur.phase === 'brace') {
    if (pressure <= SOFT_CONTACT_MAX) {
      nextZone.phase = pressure >= SOFT_CONTACT_MIN ? 'search' : 'idle';
      nextZone.timer = 0;
    }
  } else if (cur.phase === 'idle') {
    if (inSoftWindow(pressure)) {
      nextZone.phase = 'search';
      nextZone.timer = dt;
      if (nextZone.timer + EPS >= SEARCH_DURATION_S) {
        nextZone.phase = 'response';
        nextZone.timer = 0;
      }
    }
  } else if (cur.phase === 'search') {
    if (pressure < SOFT_CONTACT_MIN) {
      nextZone.phase = 'idle';
      nextZone.timer = 0;
    } else if (inSoftWindow(pressure)) {
      nextZone.timer += dt;
      if (nextZone.timer + EPS >= SEARCH_DURATION_S) {
        nextZone.phase = 'response';
        nextZone.timer = 0;
      }
    }
  } else if (cur.phase === 'response' || cur.phase === 'stay') {
    if (pressure < SOFT_CONTACT_MIN) {
      nextZone.lifts += 1;
      nextZone.phase = 'idle';
      nextZone.timer = 0;
    } else if (inSoftWindow(pressure)) {
      nextZone.timer += dt;
      if (nextZone.timer + EPS >= RELEASE_HOLD_S) {
        nextZone.phase = 'release';
        nextZone.timer = RELEASE_HOLD_S;
        nextZone.completed = true;
      } else {
        nextZone.phase = nextZone.timer + EPS < RESPONSE_DURATION_S ? 'response' : 'stay';
      }
    }
  }

  return {
    ...session,
    pressure,
    zones: {
      ...session.zones,
      [zoneId]: nextZone,
    },
  };
}

export function isScenarioComplete(session: ScenarioSessionState): boolean {
  return STATION_ZONES.every((z) => session.zones[z.id].completed);
}

export function getNextIncompleteZone(session: ScenarioSessionState): ZoneId | null {
  const currentIdx = STATION_ZONES.findIndex((z) => z.id === session.activeZoneId);
  for (let offset = 1; offset <= STATION_ZONES.length; offset++) {
    const candidate = STATION_ZONES[(currentIdx + offset) % STATION_ZONES.length];
    if (!session.zones[candidate.id].completed) {
      return candidate.id;
    }
  }
  return null;
}

export function computeScenarioScore(session: ScenarioSessionState): number {
  let totalBraces = 0;
  let totalLifts = 0;
  for (const z of STATION_ZONES) {
    totalBraces += session.zones[z.id].braces;
    totalLifts += session.zones[z.id].lifts;
  }
  const raw = 100 - totalBraces * BRACE_PENALTY - totalLifts * LIFT_PENALTY;
  return Math.max(MIN_SESSION_SCORE, Math.min(100, raw));
}

export function getZoneProgressRatio(zoneState: ZonePalpationState): number {
  if (zoneState.completed || zoneState.phase === 'release') return 1;
  if (zoneState.phase === 'response' || zoneState.phase === 'stay') {
    return Math.min(1, zoneState.timer / RELEASE_HOLD_S);
  }
  return 0;
}

export function getObservedSignsForZone(
  session: ScenarioSessionState,
  zoneId: ZoneId
): readonly ReleaseReactionId[] {
  const profile = getElephantScenario(session.elephantId);
  const zState = session.zones[zoneId];
  const script = profile.zones[zoneId];
  if (zState.completed || zState.phase === 'release') {
    return script.releaseSigns;
  }
  if (zState.phase === 'stay') {
    return ['blink', 'head_lower', 'lip_relax'];
  }
  if (zState.phase === 'response') {
    return script.responseSigns;
  }
  return [];
}

export interface VeraCommentary {
  speaker: string;
  tone: 'calm' | 'response' | 'release' | 'caution' | 'complete';
  text: string;
}

export function getVeraCommentary(session: ScenarioSessionState): VeraCommentary {
  const profile = getElephantScenario(session.elephantId);
  const zState = session.zones[session.activeZoneId];
  const script = profile.zones[session.activeZoneId];

  if (isScenarioComplete(session) && zState.completed) {
    return {
      speaker: 'Вера Павловна',
      tone: 'complete',
      text: `${profile.completionSummary} Протокол клиники Веры Павловны обновлён.`,
    };
  }

  switch (zState.phase) {
    case 'brace':
      return { speaker: 'Вера Павловна', tone: 'caution', text: script.brace };
    case 'response':
      return { speaker: 'Вера Павловна', tone: 'response', text: script.response };
    case 'stay':
      return { speaker: 'Вера Павловна', tone: 'response', text: script.stay };
    case 'release':
      return { speaker: 'Вера Павловна', tone: 'release', text: script.release };
    case 'idle':
    case 'search':
    default:
      return { speaker: 'Вера Павловна', tone: 'calm', text: script.search };
  }
}

export function describePressureLevel(pressure: number): string {
  if (pressure >= FIRM_BRACE_AT) return 'Избыточный нажим';
  if (pressure > SOFT_CONTACT_MAX) return 'Плотнее окна';
  if (pressure >= SOFT_CONTACT_MIN) return 'Мягкий контакт';
  if (pressure > 0) return 'Лёгкий поиск';
  return 'Нет касания';
}
