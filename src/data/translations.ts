import { Language } from '../types';

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    appName: 'Masterson Case Digital',
    navCaseEditor: 'Evaluation',
    newSession: '+ New Session',
    newHorse: '+ New Horse',
    deleteDemo: 'Delete Demo Case',
    restoreDemo: 'Restore Demo Case',
    studentLabel: 'Practitioner / Student',
    sessionNum: 'Session #',
    dateLabel: 'Date',
    horseLabel: 'Horse',
    ageLabel: 'Age',
    breedLabel: 'Breed',
    jobLabel: "Horse's Job",
    ownerLabel: 'Owner',
    contactLabel: 'Contact Info',
    durationLabel: 'Session Duration',
    generalNotesLabel: 'Session Notes (Clinical Observations & Transcripts)',
    ownerCareNotesLabel: 'Owner Care Notes (Post-Session Recommendations)',
    step3Desc:
      "Look at the 'whole picture' of Reactions (current issues) and Restrictions (older issues) as depicted by your lines and circles. Decide what you feel the horse's Predominant Diagonal might be. Draw the Predominant Diagonal on the horse's top view below with a line from the Atlas to the Gluteal or Sacrum.",
    leftProfileTitle: 'A. Left Profile (Anatomical Left)',
    rightProfileTitle: 'B. Right Profile (Anatomical Right)',
    topViewTitle: 'C. Top View — Predominant Diagonal',
    tableLeft: 'Left',
    tableArea: 'Area',
    tableRight: 'Right',
    undo: 'Undo',
    redo: 'Redo',
    reactionLevel: 'Reaction Level',
    observationNote: 'Area Note',
    releaseSignsLabel: 'Quick Response & Release Chips (SRSR)',
    moreTaxonomyLabel: '+ More / Resistance / Technique',
    additionalReleasesLabel: 'Additional Subtle & Release Signs',
    resistanceSignsLabel: 'Resistance / Guarding Signs',
    techniquesUsedLabel: 'Masterson Techniques Used',
    saveClose: 'Done',
    clearCell: 'Clear Area',
    startRecording: 'Record',
    pauseRecording: 'Pause',
    resumeRecording: 'Resume',
    stopRecording: 'Stop',
    transcribeClip: 'Transcribe Locally',
    appendTranscriptBtn: 'Append to Session Notes',
    aboutTitle: 'About this app',
    methodDisclaimer:
      "Independent field tool for equine bodywork practitioners, inspired by Jim Masterson's Beyond Horse Massage and research on myofascial kinetic lines (V.S. Elbrønd & R.M. Schultz). Not an official product of The Masterson Method®. Not veterinary advice.",
    deleteModel: 'Delete Model',
    printPdfBtn: 'Save / Share A4 PDF',
    regenerateReportBtn: 'Sync Summary from Map & Notes',
    sec1Title: '1. Initial Evaluation & Reactions (Direct Observations)',
    sec2Title: '2. Restrictions Identified (Direct Observations)',
    sec3Title: '3. Response, Release & Guarding Signs (Direct Observations)',
    sec4Title: '4. Predominant Diagonal (Practitioner Interpretation)',
    sec5Title: '5. Session Notes & Techniques Used (Practitioner Interpretation)',
    sec6Title: '6. Owner Care Notes (Post-Session Recommendations)',
    navReport: 'Report',
    navHorses: 'Horses',
    navSettings: 'Settings',
    mainNavLabel: 'Main navigation',
    cancel: 'Cancel',
    saveHorse: 'Save Horse',
    deleteHorse: 'Delete Horse',
    horsesCount: 'Horses ({n})',
    newHorseProfile: 'New Horse Profile',
    horseNameRequired: 'Please enter the horse name.',
    demoBadge: 'Demo',
    ageYears: '{n} yrs',
    horseProfileTitle: 'Horse Profile: {name}',
    horseProfileHint: 'Persistent horse record shared across all sessions for this horse.',
    editProfile: 'Edit',
    hideProfile: 'Hide',
    horseNotesLabel: 'Additional Horse Notes',
    sessionHistoryTitle: 'Session History — {name} ({n})',
    sessionHistoryHint: 'Tap a session to open its report, or continue it on the map.',
    sessionRowTitle: 'Session #{n}',
    selectedBadge: 'Selected',
    openReport: 'Report',
    editOnMap: 'Edit on Map',
    deleteSessionAria: 'Delete session #{n}',
    noHorsesHint: 'Create a horse profile above, or restore the Yannis demo case in Settings.',
    settingsTitle: 'Settings',
    settingsHint: 'Offline speech model, backup and app information.',
    speechModelTitle: 'Offline Speech Recognition (EN / RU)',
    speechModelHint: 'Transcribes voice clips directly on your device without an internet connection.',
    speechModelDownloading: 'Downloading...',
    speechModelReady: 'Downloaded · Ready Offline',
    speechModelDownload: 'Download Offline Speech Model (~76 MB)',
    speechModelDownloadFailed: 'Download failed.',
    backupTitle: 'Backup & Restore (JSON)',
    backupHint:
      'Export all horse profiles, evaluation tables, vector drawings, and voice clips to a single portable JSON file.',
    demoCaseTitle: 'Demo Case (Yannis)',
    demoCaseHint: 'A sample horse with a completed session, for training and trying things out.',
    creditsLead: 'Open source: offline speech recognition adapts code from ',
    creditsBy: ' by ',
    creditsTail: ' (MIT License).',
    exportJsonBtn: 'Export Full JSON Backup',
    importJsonBtn: 'Restore from JSON Backup',
  },
  ru: {
    appName: 'Masterson Case Digital',
    navCaseEditor: 'Оценка',
    newSession: '+ Новая сессия',
    newHorse: '+ Новая лошадь',
    deleteDemo: 'Удалить демо-кейс',
    restoreDemo: 'Восстановить демо-кейс',
    studentLabel: 'Практик / Студент',
    sessionNum: 'Сессия №',
    dateLabel: 'Дата',
    horseLabel: 'Кличка лошади',
    ageLabel: 'Возраст',
    breedLabel: 'Порода',
    jobLabel: 'Специализация / Работа',
    ownerLabel: 'Владелец',
    contactLabel: 'Контакты',
    durationLabel: 'Длительность',
    generalNotesLabel: 'Заметки по сессии (Наблюдения и транскрипты)',
    ownerCareNotesLabel: 'Рекомендации владельцу (Уход после сессии)',
    step3Desc:
      'Посмотрите на общую картину Реакций и Рестрикций. Определите Преобладающую Диагональ (Predominant Diagonal) и проведите линию на виде сверху от Атланта к Ягодичной мышце или Крестцу.',
    leftProfileTitle: 'A. Левый профиль (Анатомическая левая сторона)',
    rightProfileTitle: 'B. Правый профиль (Анатомическая правая сторона)',
    topViewTitle: 'C. Вид сверху — Преобладающая диагональ',
    tableLeft: 'Слева',
    tableArea: 'Анатомическая зона',
    tableRight: 'Справа',
    undo: 'Отменить',
    redo: 'Повторить',
    reactionLevel: 'Уровень реакции',
    observationNote: 'Заметка по зоне',
    releaseSignsLabel: 'Быстрые признаки ответа и релиза (SRSR)',
    moreTaxonomyLabel: '+ Ещё / Сопротивление / Техники',
    additionalReleasesLabel: 'Дополнительные признаки ответа и релиза',
    resistanceSignsLabel: 'Признаки сопротивления / зажатости',
    techniquesUsedLabel: 'Использованные техники Masterson Method',
    saveClose: 'Готово',
    clearCell: 'Очистить зону',
    startRecording: 'Запись',
    pauseRecording: 'Пауза',
    resumeRecording: 'Продолжить',
    stopRecording: 'Стоп',
    transcribeClip: 'Распознать локально',
    appendTranscriptBtn: 'Добавить в заметки сессии',
    aboutTitle: 'О приложении',
    methodDisclaimer:
      'Независимый полевой инструмент специалиста по бодиворку лошадей, созданный под вдохновением от книги Jim Masterson «Beyond Horse Massage» и исследований миофасциальных кинетических линий (V.S. Elbrønd & R.M. Schultz). Не является официальным продуктом The Masterson Method®. Не является ветеринарной консультацией.',
    deleteModel: 'Удалить модель',
    printPdfBtn: 'Сохранить / Поделиться A4 PDF',
    regenerateReportBtn: 'Обновить сводку из карты и заметок',
    sec1Title: '1. Первичная оценка и реакции (Прямые наблюдения)',
    sec2Title: '2. Выявленные рестрикции (Прямые наблюдения)',
    sec3Title: '3. Признаки ответа, релиза и сопротивления (Прямые наблюдения)',
    sec4Title: '4. Преобладающая диагональ (Интерпретация практика)',
    sec5Title: '5. Заметки по сессии и техники (Интерпретация практика)',
    sec6Title: '6. Рекомендации владельцу после сессии (Рекомендации практика)',
    navReport: 'Отчёт',
    navHorses: 'Лошади',
    navSettings: 'Настройки',
    mainNavLabel: 'Основная навигация',
    cancel: 'Отмена',
    saveHorse: 'Сохранить',
    deleteHorse: 'Удалить лошадь',
    horsesCount: 'Лошади ({n})',
    newHorseProfile: 'Новый профиль лошади',
    horseNameRequired: 'Пожалуйста, укажите кличку лошади.',
    demoBadge: 'Демо',
    ageYears: '{n} лет',
    horseProfileTitle: 'Профиль лошади: {name}',
    horseProfileHint: 'Постоянная карточка лошади (общая для всех сессий).',
    editProfile: 'Изменить',
    hideProfile: 'Скрыть',
    horseNotesLabel: 'Дополнительные заметки о лошади',
    sessionHistoryTitle: 'История сессий — {name} ({n})',
    sessionHistoryHint: 'Нажмите на сессию, чтобы открыть отчёт, или продолжите её на карте.',
    sessionRowTitle: 'Сессия №{n}',
    selectedBadge: 'Выбрана',
    openReport: 'Отчёт',
    editOnMap: 'На карту',
    deleteSessionAria: 'Удалить сессию №{n}',
    noHorsesHint: 'Добавьте лошадь выше или восстановите демо-кейс Yannis в настройках.',
    settingsTitle: 'Настройки',
    settingsHint: 'Офлайн-модель речи, резервная копия и сведения о приложении.',
    speechModelTitle: 'Офлайн-распознавание голоса (RU / EN)',
    speechModelHint: 'Позволяет расшифровывать голосовые заметки без интернета прямо на устройстве.',
    speechModelDownloading: 'Загрузка...',
    speechModelReady: 'Скачано · Готово офлайн',
    speechModelDownload: 'Скачать офлайн-модель речи (~76 МБ)',
    speechModelDownloadFailed: 'Не удалось скачать модель.',
    backupTitle: 'Резервная копия и восстановление (JSON)',
    backupHint:
      'Экспортируйте все профили лошадей, сессии, рисунки и аудиозаписи в один JSON-файл.',
    demoCaseTitle: 'Демо-кейс (Yannis)',
    demoCaseHint: 'Пример лошади с завершённой сессией — для обучения и знакомства с приложением.',
    creditsLead: 'Открытый код: офлайн-распознавание речи использует адаптированный код ',
    creditsBy: ' (автор ',
    creditsTail: ', лицензия MIT).',
    exportJsonBtn: 'Экспорт полной резервной копии (JSON)',
    importJsonBtn: 'Восстановить из резервной копии (JSON)',
  },
};

export interface TaxonomyChipItem {
  id: string;
  en: string;
  ru: string;
  category?: 'subtle' | 'pre_release' | 'release' | 'resistance' | 'technique';
  /**
   * Quick-chip group in the zone editor. 'response' signs (the horse is processing)
   * are recorded without marking the zone Released; 'release' signs mark it Released.
   */
  group?: 'response' | 'release';
  supportsCounter?: boolean;
}

/**
 * 8 always-visible quick chips in the zone editor, split into Response and Release groups
 */
export const QUICK_RELEASE_CHIPS: TaxonomyChipItem[] = [
  {
    id: 'blink_soft_eye',
    en: 'Blink / Soft eye',
    ru: 'Моргание / Мягкий глаз',
    category: 'subtle',
    group: 'response',
  },
  {
    id: 'lip_twitch',
    en: 'Lip twitch',
    ru: 'Подергивание губы',
    category: 'subtle',
    group: 'response',
  },
  {
    id: 'fidgeting',
    en: 'Fidgeting',
    ru: 'Суетливость (перед релизом)',
    category: 'pre_release',
    group: 'response',
  },
  {
    id: 'lick_chew',
    en: 'Lick & chew',
    ru: 'Облизывание и отжевывание',
    category: 'release',
    group: 'release',
  },
  {
    id: 'yawn',
    en: 'Yawn',
    ru: 'Зевание',
    category: 'release',
    group: 'release',
    supportsCounter: true,
  },
  {
    id: 'snort_sneeze',
    en: 'Snort / Sneeze',
    ru: 'Отфыркивание / Чих',
    category: 'release',
    group: 'release',
  },
  {
    id: 'head_drop',
    en: 'Head drop',
    ru: 'Опускание головы',
    category: 'release',
    group: 'release',
  },
  {
    id: 'deep_sigh_shake',
    en: 'Deep sigh / Shake',
    ru: 'Глубокий выдох / Встряхивание',
    category: 'release',
    group: 'release',
  },
];

/**
 * Additional Subtle & Release Signs inside collapsible "+ More / Resistance / Technique"
 */
export const MORE_RELEASE_SIGNS: TaxonomyChipItem[] = [
  {
    id: 'weight_shift',
    en: 'Weight shift',
    ru: 'Перенос веса',
    category: 'subtle',
  },
  {
    id: 'rest_hind_leg',
    en: 'Rest hind leg',
    ru: 'Постановка задней ноги на зацеп',
    category: 'subtle',
  },
  {
    id: 'breath_shift_swallow',
    en: 'Breath shift / Swallow',
    ru: 'Изменение дыхания / Глотание',
    category: 'subtle',
  },
  {
    id: 'self_stretch_scratch',
    en: 'Self-stretch / Scratch',
    ru: 'Потягивание / Почесывание',
    category: 'release',
  },
  {
    id: 'seeking_contact',
    en: 'Seeking contact',
    ru: 'Поиск контакта',
    category: 'release',
  },
  {
    id: 'gut_sounds_gi',
    en: 'Gut sounds (GI)',
    ru: 'Перистальтика (ЖКТ)',
    category: 'release',
  },
];

/**
 * Resistance / Guarding Signs inside collapsible "+ More / Resistance / Technique"
 */
export const RESISTANCE_SIGNS: TaxonomyChipItem[] = [
  {
    id: 'bracing_guarding',
    en: 'Bracing / Guarding',
    ru: 'Зажатость / Охрана зоны',
    category: 'resistance',
  },
  {
    id: 'ears_pinned',
    en: 'Ears pinned',
    ru: 'Прижатые уши',
    category: 'resistance',
  },
  {
    id: 'head_toss_pull_away',
    en: 'Head toss / Pull away',
    ru: 'Вскидывание головы / Уход от контакта',
    category: 'resistance',
  },
  {
    id: 'tail_clamp_swish',
    en: 'Tail clamp / swish',
    ru: 'Зажатие / Отмахивание хвостом',
    category: 'resistance',
  },
  {
    id: 'stepping_away_pawing',
    en: 'Stepping away / Pawing',
    ru: 'Отшагивание / Копание ногой',
    category: 'resistance',
  },
];

/**
 * Masterson Techniques Used inside collapsible "+ More / Resistance / Technique"
 */
export const MASTERSON_TECHNIQUES: TaxonomyChipItem[] = [
  {
    id: 'bladder_meridian',
    en: 'Bladder Meridian',
    ru: 'Меридиан мочевого пузыря (Bladder Meridian)',
    category: 'technique',
  },
  {
    id: 'poll_atlas',
    en: 'Poll / Atlas',
    ru: 'Затылок / Атлант (Poll / Atlas)',
    category: 'technique',
  },
  {
    id: 'lateral_cervical_flexion',
    en: 'Lateral Cervical Flexion',
    ru: 'Боковое сгибание шеи (LCF)',
    category: 'technique',
  },
  {
    id: 'tmj_tongue_release',
    en: 'TMJ / Tongue Release',
    ru: 'Релиз ВНЧС / языка (TMJ / Tongue)',
    category: 'technique',
  },
  {
    id: 'under_scapula',
    en: 'Under Scapula',
    ru: 'Под лопаткой (Under Scapula)',
    category: 'technique',
  },
  {
    id: 'withers_wiggle',
    en: 'Withers Wiggle',
    ru: 'Покачивание холки (Withers Wiggle)',
    category: 'technique',
  },
  {
    id: 'lateral_diagonal_rocking',
    en: 'Lateral / Diagonal Rocking',
    ru: 'Боковое / диагональное раскачивание',
    category: 'technique',
  },
  {
    id: 'sternum_lift',
    en: 'Sternum Lift',
    ru: 'Подъем грудины (Sternum Lift)',
    category: 'technique',
  },
  {
    id: 'hind_end_points',
    en: 'Hind End Points',
    ru: 'Точки крупа и таза (Hind End Points)',
    category: 'technique',
  },
  {
    id: 'sacrum_float',
    en: 'Sacrum Float',
    ru: 'Флоатинг крестца (Sacrum Float)',
    category: 'technique',
  },
  {
    id: 'psoas_release',
    en: 'Psoas Release',
    ru: 'Релиз пояснично-подвздошной мышцы (Psoas)',
    category: 'technique',
  },
  {
    id: 'leg_releases',
    en: 'Leg Releases',
    ru: 'Релизы конечностей (Leg Releases)',
    category: 'technique',
  },
];

/**
 * Normalizes legacy release sign strings (e.g. "Deep yawning" -> "Yawn") or matches canonical labels.
 */
const LEGACY_RELEASE_MAP: Record<string, string> = {
  'Deep yawning': 'Yawn',
  'Head lowering': 'Head drop',
  'Licking & chewing': 'Lick & chew',
  'Soft blinking': 'Blink / Soft eye',
  'Deep sigh / exhalation': 'Deep sigh / Shake',
  'Whole-body shake': 'Deep sigh / Shake',
};

export function normalizeReleaseSignLabel(raw: string): string {
  return LEGACY_RELEASE_MAP[raw] || raw;
}

export function isReleaseSignSelected(selectedList: string[] | undefined, chipEn: string): boolean {
  if (!selectedList || selectedList.length === 0) return false;
  return selectedList.some((item) => normalizeReleaseSignLabel(item) === chipEn);
}

export function toggleReleaseSignInList(selectedList: string[] | undefined, chipEn: string): string[] {
  const current = selectedList || [];
  const exists = current.some((item) => normalizeReleaseSignLabel(item) === chipEn);
  if (exists) {
    return current.filter((item) => normalizeReleaseSignLabel(item) !== chipEn);
  }
  return [...current, chipEn];
}

export function formatChipLabel(item: TaxonomyChipItem, lang: Language): string {
  return lang === 'ru' ? item.ru : item.en;
}

export function translateStoredTaxonomyValue(raw: string, lang: Language): string {
  const normalized = normalizeReleaseSignLabel(raw);
  if (lang === 'en') return normalized;
  const allItems = [
    ...QUICK_RELEASE_CHIPS,
    ...MORE_RELEASE_SIGNS,
    ...RESISTANCE_SIGNS,
    ...MASTERSON_TECHNIQUES,
  ];
  const found = allItems.find((item) => item.en === normalized || item.en === raw);
  return found ? found.ru : raw;
}
