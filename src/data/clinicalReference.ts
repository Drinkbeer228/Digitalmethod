/**
 * Source-backed clinical reference for the 21 evaluation zones.
 *
 * Everything here is descriptive reference data with a citation (source + page):
 *  - which equine myofascial kinetic lines pass through a zone (Elbrønd & Schultz dissections);
 *  - which Masterson techniques address a zone, with the book's pressure terms;
 *  - where a zone sits in the Masterson session order.
 *
 * It deliberately contains no diagnostic rules (e.g. primary vs compensatory lameness):
 * the sources state that static palpation cannot make that distinction — it needs
 * kinematic gait analysis and diagnostic anaesthesia by a veterinarian.
 */
import { AnatomicalAreaId, EvaluationTableState } from '../types';
import { ANATOMICAL_AREAS } from './anatomicalAreas';

export interface SourceRef {
  source: string;
  page: string;
  /** Short verbatim quote in the source language */
  quote?: string;
}

const ES2015 = 'Elbrønd & Schultz 2015, Medical Research Archives 3';
const ES2021 = 'Elbrønd & Schultz 2021, Open Journal of Veterinary Medicine 11(1)';
const BHM = 'J. Masterson, Beyond Horse Massage';

// ---------------------------------------------------------------------------
// Myofascial kinetic lines
// ---------------------------------------------------------------------------

export type MyofascialLineId =
  | 'SDL'
  | 'SVL'
  | 'LL'
  | 'SL'
  | 'FL'
  | 'FLPL'
  | 'FLRL'
  | 'DDL'
  | 'DVL'
  | 'FADL'
  | 'FABL';

export interface MyofascialLineMeta {
  id: MyofascialLineId;
  nameEn: string;
  nameRu: string;
  ref: SourceRef;
}

export const MYOFASCIAL_LINES: MyofascialLineMeta[] = [
  { id: 'SDL', nameEn: 'Superficial Dorsal Line', nameRu: 'Поверхностная дорсальная линия', ref: { source: ES2015, page: 'pp. 3–5' } },
  { id: 'SVL', nameEn: 'Superficial Ventral Line', nameRu: 'Поверхностная вентральная линия', ref: { source: ES2015, page: 'pp. 5–6' } },
  { id: 'LL', nameEn: 'Lateral Line (superficial & deep)', nameRu: 'Латеральная линия (поверхностная и глубокая)', ref: { source: ES2015, page: 'pp. 6–7' } },
  { id: 'SL', nameEn: 'Spiral Line', nameRu: 'Спиральная линия', ref: { source: ES2015, page: 'pp. 7–8' } },
  { id: 'FL', nameEn: 'Functional Line', nameRu: 'Функциональная линия', ref: { source: ES2015, page: 'pp. 8–9' } },
  { id: 'FLPL', nameEn: 'Front Limb Protraction Line', nameRu: 'Линия протракции передней конечности', ref: { source: ES2015, page: 'pp. 9–10' } },
  { id: 'FLRL', nameEn: 'Front Limb Retraction Line', nameRu: 'Линия ретракции передней конечности', ref: { source: ES2015, page: 'p. 10' } },
  { id: 'DDL', nameEn: 'Deep Dorsal Line', nameRu: 'Глубокая дорсальная линия', ref: { source: ES2021, page: 'pp. 24–27' } },
  { id: 'DVL', nameEn: 'Deep Ventral Line', nameRu: 'Глубокая вентральная линия', ref: { source: ES2021, page: 'pp. 17–23' } },
  { id: 'FADL', nameEn: 'Front Limb Adduction Line', nameRu: 'Линия аддукции передней конечности', ref: { source: ES2021, page: 'pp. 23–24' } },
  { id: 'FABL', nameEn: 'Front Limb Abduction Line', nameRu: 'Линия абдукции передней конечности', ref: { source: ES2021, page: 'p. 24' } },
];

export type LineRole = 'origin' | 'intermediate' | 'crossing' | 'termination';
/** Which body side the line continues on from this zone */
export type LineSide = 'ipsi' | 'contra' | 'bilateral';

export interface ZoneLineLink {
  areaId: AnatomicalAreaId;
  lineId: MyofascialLineId;
  role: LineRole;
  side: LineSide;
  ref: SourceRef;
}

export const ZONE_LINE_LINKS: ZoneLineLink[] = [
  {
    areaId: 'poll_front_atlas', lineId: 'DDL', role: 'intermediate', side: 'bilateral',
    ref: { source: ES2021, page: 'p. 25', quote: 'The suboccipital muscles connect to both the atlanto-occipital and atlanto-axial membranes which again connect to the dura mater, the so-called myodural bridges.' },
  },
  {
    areaId: 'poll_front_atlas', lineId: 'DVL', role: 'termination', side: 'bilateral',
    ref: { source: ES2021, page: 'p. 19', quote: 'It terminates ventrally at the Basis cranii externa close to the Synchondrosis spheno-basilaris.' },
  },
  {
    areaId: 'poll_top_atlas', lineId: 'SDL', role: 'termination', side: 'bilateral',
    ref: { source: ES2015, page: 'p. 5', quote: 'The longissimus capitis et atlantis and semispinalis capitis muscles… The nuchal crest of the occipital bone.' },
  },
  {
    areaId: 'tmj', lineId: 'SDL', role: 'termination', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 5', quote: 'The temporalis perimysium also continues into the masseter muscle and the lateral surface of the temporomandibular joint (TMJ).' },
  },
  {
    areaId: 'tmj', lineId: 'SVL', role: 'termination', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 6', quote: 'SDL and SVL connected through the fusion of the tendinous branch of the temporal muscle and the deep layers of m. masseter on the head.' },
  },
  {
    areaId: 'neck', lineId: 'FLPL', role: 'origin', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 9', quote: 'The cranial part of FLPL had its origin in the fascia cervicalis profunda… followed via m. brachiocephalicus and m. omotransversarius.' },
  },
  {
    areaId: 'neck', lineId: 'SL', role: 'crossing', side: 'contra',
    ref: { source: ES2015, page: 'p. 7', quote: 'In the region of C6 C7-T1-T2 T3 it crossed under the funicular part of the ligamentum nuchae to the contralateral side into m. rhomboideus.' },
  },
  {
    areaId: 'shoulder', lineId: 'FADL', role: 'intermediate', side: 'ipsi',
    ref: { source: ES2021, page: 'p. 23', quote: 'On the medial side, is a broad fascia connection which is present between M. subclavius and M. teres major.' },
  },
  {
    areaId: 'shoulder', lineId: 'FABL', role: 'intermediate', side: 'ipsi',
    ref: { source: ES2021, page: 'p. 24', quote: 'This fascia sheet continues in a distal direction on the abaxial side of the scapula into M. deltoideus.' },
  },
  {
    areaId: 'withers', lineId: 'DDL', role: 'intermediate', side: 'bilateral',
    ref: { source: ES2021, page: 'p. 27', quote: 'The Lig. supraspinosus is the most dorsal part of the DDL… until the lower part of the cervicothoracic junction where it transforms into the Lig. nuchae.' },
  },
  {
    areaId: 'withers', lineId: 'FLPL', role: 'intermediate', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 9', quote: 'The line approached the scapula in the fascia trunci with a cranial direction into m. trapezius pars thoracica.' },
  },
  {
    areaId: 'top_of_spine', lineId: 'SDL', role: 'intermediate', side: 'bilateral',
    ref: { source: ES2015, page: 'p. 4', quote: 'The SDL runs under the medial gluteal muscle in the erector spinae muscles: iliocostalis, longissimus and spinalis.' },
  },
  {
    areaId: 'top_of_spine', lineId: 'DDL', role: 'intermediate', side: 'bilateral',
    ref: { source: ES2021, page: 'p. 25', quote: 'The line joins the myofascia of the transversospinal system e.g. Mm. multifidi… along the spine until C2.' },
  },
  {
    areaId: 'saddle_outline', lineId: 'FL', role: 'crossing', side: 'contra',
    ref: { source: ES2015, page: 'p. 8', quote: 'The fascia continued into the fascia thoracolumbalis… and crossed the dorsal midline, over the lumbar vertebrae, to the contralateral side.' },
  },
  {
    areaId: 'ribs', lineId: 'LL', role: 'intermediate', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 6', quote: 'The external and internal intercostal muscles and the deep thoracolumbar fascia… to the costal arch.' },
  },
  {
    areaId: 'ribs', lineId: 'SL', role: 'intermediate', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 7', quote: 'The m. rhomboideus merged into the fascia fibres related to m. serratus ventralis thoracis and from there directly into m. obl. externus abd.' },
  },
  {
    areaId: 'lumbar', lineId: 'DVL', role: 'intermediate', side: 'bilateral',
    ref: { source: ES2021, page: 'p. 19', quote: 'It continues in a cranial direction through M. psoas minor and major to the thoracolumbar junction where it interacts and overlaps with the Crus dexter et sinister of the Diaphragma.' },
  },
  {
    areaId: 'lumbar', lineId: 'FL', role: 'crossing', side: 'contra',
    ref: { source: ES2015, page: 'p. 8', quote: 'The thoracolumbar fascia crosses the lumbar spine over to the contralateral side.' },
  },
  {
    areaId: 'gluteals', lineId: 'SDL', role: 'intermediate', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 4', quote: 'The SDL runs under the medial gluteal muscle (not through it), connecting to the sacrotuberous ligament.' },
  },
  {
    areaId: 'gluteals', lineId: 'FL', role: 'intermediate', side: 'contra',
    ref: { source: ES2015, page: 'p. 8', quote: 'Continuing through the gluteal muscles and fascia distally into the quadriceps and fascia genu.' },
  },
  {
    areaId: 'sacrum', lineId: 'SL', role: 'crossing', side: 'contra',
    ref: { source: ES2015, page: 'p. 8', quote: 'The dorsal sacroiliac ligament across the sacrum where it crosses over to the contralateral side.' },
  },
  {
    areaId: 'sacrum', lineId: 'DDL', role: 'intermediate', side: 'bilateral',
    ref: { source: ES2021, page: 'p. 25', quote: 'The M. sacrocaudalis dorsalis medialis, which cranially continues to the Mm. multifidi (origo S2/3)… are all parts of the line.' },
  },
  {
    areaId: 'hamstrings', lineId: 'SDL', role: 'intermediate', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 4', quote: 'The fascia cruris laterally radiated into m. biceps femoris pars caudalis and medially into m. semitendinosus.' },
  },
  {
    areaId: 'knee', lineId: 'FLPL', role: 'intermediate', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 9', quote: 'The line followed m. biceps brachii, lacertus fibrosus to m. extensor carpi radialis and then into the tendo m. extensor dig. communis.' },
  },
  {
    areaId: 'knee', lineId: 'FLRL', role: 'intermediate', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 10', quote: 'Flexor tendons, which traversed through the canalis carpalis and attached to the os phalanx media and distalis.' },
  },
  {
    areaId: 'front_fetlock', lineId: 'FLPL', role: 'intermediate', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 9', quote: 'Into the tendon of the common digital extensor muscle with a final insertion on the dorsal aspect of the distal phalanx.' },
  },
  {
    areaId: 'front_fetlock', lineId: 'FLRL', role: 'intermediate', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 10', quote: 'The SDF and DDF muscles and tendons… to the palmar aspect of the distal phalanx.' },
  },
  {
    areaId: 'hock', lineId: 'SDL', role: 'intermediate', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 4', quote: 'The superficial tendon attached to the tuber calcanei on the os calcaneus, into a tight, strong and branching fascia.' },
  },
  {
    areaId: 'hock', lineId: 'SVL', role: 'intermediate', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 5', quote: 'Proximally the line passed over the articulatio tarsi and branched into the dorsally situated extensor muscles.' },
  },
  {
    areaId: 'hind_fetlock', lineId: 'SDL', role: 'origin', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 3', quote: 'The SDL has its origin in the hind limb phalanx media, facies plantaris with the insertion of the tendo m. dig. sup.' },
  },
  {
    areaId: 'hind_fetlock', lineId: 'SVL', role: 'origin', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 5', quote: 'The SVL has its origin in the hind limb on the os phalanx distalis at the insertion of the tendon from m. extensor dig. longus.' },
  },
  {
    areaId: 'tuber_coxae', lineId: 'LL', role: 'intermediate', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 6', quote: 'The first passed through the mid part of fascia lata and m. tensor fascia lata to the tuber coxae.' },
  },
  {
    areaId: 'tuber_coxae', lineId: 'SL', role: 'intermediate', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 7', quote: 'It merged into the fibres of m. obl. interna abd., which attached to the tuber coxae.' },
  },
  {
    areaId: 'under_tail', lineId: 'DDL', role: 'intermediate', side: 'bilateral',
    ref: { source: ES2021, page: 'p. 25', quote: 'At the level of the Tuber ischiadicum the DDL connects to the SDL.' },
  },
  {
    areaId: 'under_tail', lineId: 'SDL', role: 'intermediate', side: 'ipsi',
    ref: { source: ES2015, page: 'p. 4', quote: 'These two muscles attached on the tuber ischiadicum and then continued into the lig. sacrotuberale latum.' },
  },
];

// ---------------------------------------------------------------------------
// Masterson pressure scale & techniques
// ---------------------------------------------------------------------------

/** Masterson's pressure terms, lightest first */
export type PressureLevel = 'air_gap' | 'egg_yolk' | 'grape' | 'lemon' | 'lime';

export const PRESSURE_LEVELS: Array<{ id: PressureLevel; en: string; ru: string }> = [
  { id: 'air_gap', en: 'Air gap', ru: 'Air gap (без касания)' },
  { id: 'egg_yolk', en: 'Egg yolk', ru: 'Egg yolk (желток)' },
  { id: 'grape', en: 'Grape', ru: 'Grape (виноградина)' },
  { id: 'lemon', en: 'Lemon', ru: 'Lemon (лимон)' },
  { id: 'lime', en: 'Lime', ru: 'Lime (лайм)' },
];

export interface ZoneTechniqueRef {
  areaId: AnatomicalAreaId;
  /** Technique names exactly as in the book */
  techniques: string[];
  /** Pressure range in book terms; null when the technique isn't graded that way */
  pressure: { from: PressureLevel; to: PressureLevel } | null;
  /** Pressure / handling note for techniques not on the pressure scale */
  handlingEn?: string;
  handlingRu?: string;
  orderEn: string;
  orderRu: string;
  ref: SourceRef;
}

export const ZONE_TECHNIQUES: ZoneTechniqueRef[] = [
  {
    areaId: 'poll_front_atlas', techniques: ['Lateral Cervical Flexion', 'Head Up'],
    pressure: { from: 'air_gap', to: 'grape' },
    orderEn: 'First technique after the Bladder Meridian; precedes neck and withers work.',
    orderRu: 'Первая техника после Bladder Meridian; выполняется до работы с шеей и холкой.',
    ref: { source: BHM, page: 'ch. 5, p. 36', quote: 'After the Bladder Meridian Technique, the Lateral Cervical Flexion Technique is the first step toward releasing tension in the poll and atlas.' },
  },
  {
    areaId: 'poll_top_atlas', techniques: ['Head Down', 'Head Up'],
    pressure: { from: 'grape', to: 'lemon' },
    orderEn: 'After Lateral Cervical Flexion; if the horse will not lower the head, move to Head Up.',
    orderRu: 'После Lateral Cervical Flexion; если лошадь не опускает голову — перейти к Head Up.',
    ref: { source: BHM, page: 'ch. 5, p. 40', quote: 'Start with grape pressure gradually increasing to lemon pressure if the horse stays relaxed with it.' },
  },
  {
    areaId: 'tmj', techniques: ['Search, Response, Stay, Release (within Head Up / Bladder Meridian)'],
    pressure: { from: 'air_gap', to: 'lemon' },
    orderEn: 'Checked early: on the Bladder Meridian pass and while holding the head in Head Up.',
    orderRu: 'Проверяется в начале: при проходе по меридиану и при удержании головы в Head Up.',
    ref: { source: BHM, page: 'ch. 5, p. 48', quote: 'He may ask for anything from an air gap to a lemon pressure massage.' },
  },
  {
    areaId: 'neck', techniques: ['Lateral Cervical Flexion'],
    pressure: null,
    handlingEn: 'Non-resistance: minimal effort, the horse yields on its own.',
    handlingRu: 'Без сопротивления: минимальное усилие, лошадь уступает сама.',
    orderEn: 'Start at the atlas and move down the neck in 2–3 inch steps toward the shoulder.',
    orderRu: 'Начать от атланта и спускаться по шее шагами 5–7 см к плечу.',
    ref: { source: BHM, page: 'ch. 5, p. 37', quote: 'Slide your right hand a few inches farther down the vertebrae of the neck, and again ask him to bring his nose a little farther back toward you.' },
  },
  {
    areaId: 'shoulder', techniques: ['Scapula Release — Down and Back', 'Scapula Release — Down and Forward'],
    pressure: null,
    handlingEn: 'Support the leg until it relaxes; do not pull or stretch.',
    handlingRu: 'Поддерживать ногу до расслабления; не тянуть и не растягивать.',
    orderEn: 'After poll and neck are released.',
    orderRu: 'После освобождения затылка и шеи.',
    ref: { source: BHM, page: 'ch. 6, p. 66', quote: 'You are not pulling or stretching the leg back. You are supporting the leg until the horse relaxes it then guiding the leg down and back.' },
  },
  {
    areaId: 'withers', techniques: ['Withers Check and Release'],
    pressure: { from: 'egg_yolk', to: 'grape' },
    orderEn: 'After the Scapula Releases and the C7–T1 release.',
    orderRu: 'После Scapula Release и релиза C7–T1.',
    ref: { source: BHM, page: 'ch. 6, p. 98', quote: 'Very gently (egg yolk or very soft grape pressure) wiggle the spinous process (wither) from side to side, closely watching the eye for the slightest blink.' },
  },
  {
    areaId: 'hoof_point', techniques: ['Bladder Meridian — Ting Point (coronary band)'],
    pressure: { from: 'air_gap', to: 'egg_yolk' },
    orderEn: 'End point of each Bladder Meridian pass; stay a few seconds and watch for a response.',
    orderRu: 'Конечная точка каждого прохода по меридиану; задержаться на несколько секунд и наблюдать ответ.',
    ref: { source: BHM, page: 'ch. 4, p. 29', quote: 'When you get to the Ting Point that is the termination of the bladder meridian, stay there for a few seconds to see what kind of response the horse gives you.' },
  },
  {
    areaId: 'top_of_spine', techniques: ['Bladder Meridian Technique'],
    pressure: { from: 'air_gap', to: 'air_gap' },
    orderEn: 'Very start of the session, as the overall scan.',
    orderRu: 'Самое начало сессии, как общий скрининг.',
    ref: { source: BHM, page: 'ch. 4, p. 26', quote: 'Barely touching the surface of the skin, slowly… run your hand down the bladder meridian.' },
  },
  {
    areaId: 'saddle_outline', techniques: ['Lateral Rocking', 'Bladder Meridian Technique'],
    pressure: null,
    handlingEn: 'Rhythmic rocking; air gap on the meridian.',
    handlingRu: 'Ритмичное покачивание; air gap на меридиане.',
    orderEn: 'In the back block, after the poll and the hind end are loose.',
    orderRu: 'В блоке спины — после того как расслаблены затылок и задняя часть.',
    ref: { source: BHM, page: 'ch. 8, p. 148', quote: 'When he releases something you will feel him soften, and see the eye soften.' },
  },
  {
    areaId: 'ribs', techniques: ['Lateral Rocking'],
    pressure: null,
    handlingEn: 'Gentle rhythmic rocking, one rib and vertebra at a time.',
    handlingRu: 'Мягкое ритмичное покачивание, по одному ребру и позвонку.',
    orderEn: 'Move from the last rib forward to the ribs behind the scapula.',
    orderRu: 'Двигаться от последнего ребра вперёд к рёбрам за лопаткой.',
    ref: { source: BHM, page: 'ch. 8, p. 146', quote: 'Use the rib to gently rock the corresponding vertebra. Continue moving your right hand forward as you gently rock each rib and vertebra.' },
  },
  {
    areaId: 'lumbar', techniques: ['Working the Hind End from the Top', 'Lateral Rocking'],
    pressure: { from: 'air_gap', to: 'egg_yolk' },
    orderEn: 'Released through the pelvic points before rocking the back directly.',
    orderRu: 'Освобождается через тазовые точки до прямого раскачивания спины.',
    ref: { source: BHM, page: 'ch. 7, p. 104', quote: 'The farther the leg and pelvis drop to one side, the more of a relaxed “twist” you will get in the lumbar vertebrae.' },
  },
  {
    areaId: 'gluteals', techniques: ['Dorsal Arch', 'Hip Joint Release Point'],
    pressure: { from: 'air_gap', to: 'lime' },
    orderEn: 'Final part of hind end and back work; only after poll and pelvis are relaxed. Air gap to find the hip point; lemon–lime for the Dorsal Arch reflex.',
    orderRu: 'Финал работы с тазом и спиной; только после расслабления затылка и таза. Air gap — поиск точки бедра; lemon–lime — рефлекс Dorsal Arch.',
    ref: { source: BHM, page: 'ch. 8, p. 154', quote: 'Push down with the tips of your fingers, using a fair amount of pressure—lemon or even lime.' },
  },
  {
    areaId: 'sacrum', techniques: ['Sacroiliac (SI) Point', 'Under-the-Tail Point'],
    pressure: { from: 'air_gap', to: 'egg_yolk' },
    orderEn: 'Hind end from the top: start with the Under-the-Tail Point, then the SI Point.',
    orderRu: 'Задняя часть сверху: начать с Under-the-Tail, затем точка КПС.',
    ref: { source: BHM, page: 'ch. 7, p. 114', quote: 'Place your fingertips about an inch off the centerline, on the bone (tuber sacral).' },
  },
  {
    areaId: 'hamstrings', techniques: ['Pubic Symphysis (PS) Point'],
    pressure: { from: 'egg_yolk', to: 'grape' },
    orderEn: 'Used for tight hind end and resistance to moving the hind leg.',
    orderRu: 'При зажатости зада и сопротивлении отведению задней ноги.',
    ref: { source: BHM, page: 'ch. 7, p. 121', quote: 'He relaxed behind and started to shift leg to leg. The hamstrings softened.' },
  },
  {
    areaId: 'knee', techniques: ['“Magic Button” (during Scapula Releases)'],
    pressure: null,
    handlingEn: 'Gentle tapping with the fingertips.',
    handlingRu: 'Лёгкое постукивание кончиками пальцев.',
    orderEn: 'During Scapula Release when the horse cannot let the leg go.',
    orderRu: 'Во время Scapula Release, если лошадь не может отпустить ногу.',
    ref: { source: BHM, page: 'ch. 6, p. 78', quote: 'When the horse can’t quite let the leg go, gently tap this spot with the fingertips of your “knee hand”.' },
  },
  {
    areaId: 'front_fetlock', techniques: ['Ankle support during Scapula Release'],
    pressure: null,
    handlingEn: 'Rest the ankle in the hand; support only.',
    handlingRu: 'Путо лежит в ладони; только поддержка.',
    orderEn: 'While lowering the leg down-and-back or down-and-forward.',
    orderRu: 'При опускании ноги вниз-назад или вниз-вперёд.',
    ref: { source: BHM, page: 'ch. 6, p. 66', quote: 'Rest the horse’s ankle in your right hand and place your left hand on the horse’s knee.' },
  },
  {
    areaId: 'hock', techniques: ['Hock wiggle (with the Stifle Point)'],
    pressure: null,
    handlingEn: 'Light touch, gentle wiggling.',
    handlingRu: 'Лёгкое касание, мягкое покачивание.',
    orderEn: 'Once the pelvis has dropped and the hind leg rests forward.',
    orderRu: 'Когда таз опущен и задняя нога расслабленно стоит вперёд.',
    ref: { source: BHM, page: 'ch. 7, p. 119', quote: 'Once the horse’s leg is relaxed and he is resting it forward, place your hand gently on his hock and wiggle gently on the leg.' },
  },
  {
    areaId: 'tuber_coxae', techniques: ['Pelvic Point'],
    pressure: { from: 'air_gap', to: 'egg_yolk' },
    orderEn: 'Hind end from the top, especially if the pelvis does not drop from the Under-the-Tail Point.',
    orderRu: 'Задняя часть сверху, особенно если таз не опускается от точки Under-the-Tail.',
    ref: { source: BHM, page: 'ch. 7, p. 117', quote: 'Not all horses will be responsive to this point, but once you get a blink, be patient and stay (lightly) on the point.' },
  },
  {
    areaId: 'under_tail', techniques: ['Under-the-Tail Point (Sacrotuberous Ligament)'],
    pressure: { from: 'air_gap', to: 'egg_yolk' },
    orderEn: 'Always the best place to start working the hind end from the top.',
    orderRu: 'Лучшая стартовая точка для работы с задней частью сверху.',
    ref: { source: BHM, page: 'ch. 7, pp. 111, 114', quote: 'An Under-the-Tail Point is always the best place to start working From the Top… literally between air gap and egg yolk.' },
  },
];

// ---------------------------------------------------------------------------
// Masterson session order
// ---------------------------------------------------------------------------

export type SessionPhaseId = 'bladder_meridian' | 'front_end' | 'neck_shoulders_withers' | 'hind_end' | 'back';

export interface SessionPhaseMeta {
  id: SessionPhaseId;
  order: number;
  nameEn: string;
  nameRu: string;
  /** Zones worked in this phase, in book order where the book gives one */
  areaIds: AnatomicalAreaId[];
  startEn: string;
  startRu: string;
}

export const SESSION_ORDER_REF: SourceRef = {
  source: BHM,
  page: 'ch. 8, p. 144; ch. 9, pp. 162, 167',
  quote: 'Before working on the back, it’s best to first loosen up both ends of the horse… then work your way toward the middle.',
};

export const SESSION_PHASES: SessionPhaseMeta[] = [
  {
    id: 'bladder_meridian', order: 1, nameEn: 'Bladder Meridian', nameRu: 'Меридиан мочевого пузыря',
    areaIds: ['top_of_spine', 'hoof_point'],
    startEn: 'Left side from eye to hind Ting Point, then the right side.',
    startRu: 'Левая сторона от глаза до Тинг-точки задней ноги, затем правая.',
  },
  {
    id: 'front_end', order: 2, nameEn: 'Front end: poll & atlas', nameRu: 'Перед: затылок и атлант',
    areaIds: ['poll_front_atlas', 'poll_top_atlas', 'tmj', 'neck'],
    startEn: 'Start with Lateral Cervical Flexion, then Head Down / Head Up.',
    startRu: 'Начать с Lateral Cervical Flexion, затем Head Down / Head Up.',
  },
  {
    id: 'neck_shoulders_withers', order: 3, nameEn: 'Neck–shoulders–withers (C7–T1)', nameRu: 'Шея–плечи–холка (C7–T1)',
    areaIds: ['shoulder', 'knee', 'front_fetlock', 'front_splints', 'withers'],
    startEn: 'Scapula Releases first, Withers Check and Release after.',
    startRu: 'Сначала Scapula Release, затем Withers Check and Release.',
  },
  {
    id: 'hind_end', order: 4, nameEn: 'Hind end', nameRu: 'Задняя часть',
    areaIds: ['under_tail', 'sacrum', 'tuber_coxae', 'hamstrings', 'gluteals', 'hock', 'hind_fetlock'],
    startEn: 'Start from the top with the Under-the-Tail Point; other release points in any order.',
    startRu: 'Начать сверху с точки Under-the-Tail; остальные точки релиза — в любом порядке.',
  },
  {
    id: 'back', order: 5, nameEn: 'Back (toward the middle)', nameRu: 'Спина (к середине)',
    areaIds: ['saddle_outline', 'ribs', 'lumbar'],
    startEn: 'Lateral Rocking, finishing with the Dorsal Arch.',
    startRu: 'Lateral Rocking, в конце — Dorsal Arch.',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getLineLinksForArea(areaId: AnatomicalAreaId): ZoneLineLink[] {
  return ZONE_LINE_LINKS.filter((l) => l.areaId === areaId);
}

export function getLineMeta(lineId: MyofascialLineId): MyofascialLineMeta {
  return MYOFASCIAL_LINES.find((l) => l.id === lineId)!;
}

export function getTechniquesForArea(areaId: AnatomicalAreaId): ZoneTechniqueRef | undefined {
  return ZONE_TECHNIQUES.find((t) => t.areaId === areaId);
}

export function getSessionPhaseForArea(areaId: AnatomicalAreaId): SessionPhaseMeta | undefined {
  return SESSION_PHASES.find((p) => p.areaIds.includes(areaId));
}

/** Zones on the same line, ordered by zone index (the zone itself excluded). */
export function getZonesOnLine(
  lineId: MyofascialLineId,
  exceptAreaId?: AnatomicalAreaId
): AnatomicalAreaId[] {
  const ids = new Set(
    ZONE_LINE_LINKS.filter((l) => l.lineId === lineId && l.areaId !== exceptAreaId).map((l) => l.areaId)
  );
  return ANATOMICAL_AREAS.filter((a) => ids.has(a.id)).map((a) => a.id);
}

/** True when either side of the zone has any reaction, restriction or release marked. */
export function isAreaMarked(table: EvaluationTableState | undefined, areaId: AnatomicalAreaId): boolean {
  const row = table?.[areaId];
  if (!row) return false;
  return (['left', 'right'] as const).some((s) => {
    const o = row[s];
    return Boolean(o && (o.reaction || o.restriction || o.released));
  });
}

export function formatPressureRange(
  pressure: ZoneTechniqueRef['pressure'],
  lang: 'en' | 'ru'
): string | null {
  if (!pressure) return null;
  const label = (id: PressureLevel) => {
    const p = PRESSURE_LEVELS.find((x) => x.id === id)!;
    return lang === 'ru' ? p.ru : p.en;
  };
  return pressure.from === pressure.to
    ? label(pressure.from)
    : `${label(pressure.from)} → ${label(pressure.to)}`;
}
