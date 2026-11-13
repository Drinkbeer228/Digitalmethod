/**
 * Reference base of 15 biomechanical / myofascial compensation patterns
 * (Masterson; Elbrønd & Schultz kinetic lines; locomotion research).
 *
 * Read-only practitioner aid: patterns are matched against the zones marked in a session
 * (see utils/patternDetection.ts). Nothing here is shown to the owner automatically.
 * Sources are reproduced as supplied by the practitioner and should be verified.
 */
import { AnatomicalAreaId } from '../types';

export type PatternLaterality = 'ipsilateral' | 'contralateral' | 'bilateral';

export interface PatternTriggerGroup {
  /** Any of these areas satisfies the group */
  areas: AnatomicalAreaId[];
  labelEn: string;
  labelRu: string;
  /** Contralateral patterns: side A (anterior chain), side B (opposite, posterior) or either */
  crossSide?: 'A' | 'B' | 'any';
  /** Axial / midline structure: for bilateral patterns one side is enough */
  axial?: boolean;
}

export interface BiomechanicalPattern {
  id: number;
  titleEn: string;
  titleRu: string;
  laterality: PatternLaterality;
  triggers: PatternTriggerGroup[];
  /** False when the trigger zones are not part of the 19-zone evaluation map */
  detectable: boolean;
  undetectableReasonEn?: string;
  undetectableReasonRu?: string;
  mechanismEn: string;
  mechanismRu: string;
  hintEn: string;
  hintRu: string;
  source: string;
  /** Contralateral pattern that the Top View predominant diagonal can confirm */
  usesPredominantDiagonal?: boolean;
}

const POLL: AnatomicalAreaId[] = ['poll_front_atlas', 'poll_top_atlas'];
const FRONT_DISTAL: AnatomicalAreaId[] = ['hoof_point', 'front_splints', 'knee', 'front_fetlock'];
const THORACIC: AnatomicalAreaId[] = ['top_of_spine', 'saddle_outline'];

/** Poll areas need a stronger signal to count (poll is reactive in most horses). */
export const POLL_AREA_IDS: readonly AnatomicalAreaId[] = POLL;

const g = (
  areas: AnatomicalAreaId[],
  labelEn: string,
  labelRu: string,
  extra: Partial<PatternTriggerGroup> = {}
): PatternTriggerGroup => ({ areas, labelEn, labelRu, ...extra });

const NOT_ON_MAP_EN = 'Requires zones that are not on the 19-zone evaluation map';
const NOT_ON_MAP_RU = 'Нужны зоны, которых нет на 19-зонной карте оценки';

export const BIOMECHANICAL_PATTERNS: BiomechanicalPattern[] = [
  {
    id: 1,
    titleEn: 'Axial cranio-sacral block',
    titleRu: 'Осевой кранио-сакральный блок',
    laterality: 'bilateral',
    triggers: [
      g(POLL, 'Poll (C1–C2)', 'Затылок (C1–C2)'),
      g(['sacrum'], 'Sacrum / SI', 'Крестец / КПС', { axial: true }),
    ],
    detectable: true,
    mechanismRu:
      'Твердая мозговая оболочка спинного мозга (dura mater) образует непрерывный рукав от затылочной кости до крестца, а Глубокая дорсальная линия (DDL) передает натяжение через миодуральный мост (MDB) в субокципитальной зоне прямо на связочный аппарат крестца. Первичный блок в затылке индуцирует продольное натяжение дуральной оболочки, сковывающее таз, и наоборот.',
    mechanismEn:
      'The spinal dura mater forms a continuous sleeve from the occiput to the sacrum, and the Deep Dorsal Line (DDL) transmits tension through the myodural bridge (MDB) in the suboccipital area directly to the sacral ligaments. A primary poll restriction creates longitudinal dural tension that binds the pelvis, and vice versa.',
    hintRu:
      'Стоит начать с мягкого релиза затылка и атланта без сопротивления (Lateral Cervical Flexion или Head Down) — это снимает первичное натяжение и облегчает последующий релиз крестца. Дополнительно можно проверить реакцию на лёгкое касание крестцово-бугорной связки под хвостом.',
    hintEn:
      'Consider starting with a soft, non-resisted poll/atlas release (Lateral Cervical Flexion or Head Down) to ease primary tension before working the sacrum. Also check the response to a light touch on the sacrotuberous ligament under the tail.',
    source:
      'Jim Masterson, Beyond Horse Massage, Chapter 5 (p. 35, 50) & Chapter 7 (p. 104–110); V.S. Elbrønd & R.M. Schultz (2021), Deep Myofascial Kinetic Lines in Horses, Section 3.2.',
  },
  {
    id: 2,
    titleEn: 'Brachiocephalic forehand syndrome',
    titleRu: 'Брахиоцефалический передний синдром',
    laterality: 'ipsilateral',
    triggers: [
      g(POLL, 'Poll (C1–C2)', 'Затылок (C1–C2)'),
      g(['shoulder'], 'Shoulder', 'Плечевой сустав'),
      g(FRONT_DISTAL, 'Distal forelimb', 'Передняя конечность (дистально)'),
    ],
    detectable: true,
    mechanismRu:
      'Плечеголовная (m. brachiocephalicus) и лопаточно-поперечная (m. omotransversarius) мышцы напрямую связывают атлант и основание черепа с плечевой костью. Боль или ушиб в копыте/дистальной части ноги заставляют эти мышцы спазмироваться для амортизации удара, блокируя сгибание затылка на той же стороне.',
    mechanismEn:
      'The brachiocephalicus and omotransversarius muscles connect the atlas and skull base directly to the humerus. Pain or bruising in the hoof/distal limb makes these muscles brace to absorb concussion, restricting poll flexion on the same side.',
    hintRu:
      'Стоит проверить копытный баланс и чувствительность подошвы (при подозрении — к ветеринару/ковалю). Релиз начните с атланта на уровне микро-ответов (мигание), чтобы расслабить проксимальное крепление мышцы до работы с плечом, затем — Scapula Down and Back.',
    hintEn:
      'Worth checking hoof balance and sole sensitivity (refer to a vet/farrier if suspected). Start with the atlas at the level of micro-responses (blinking) to relax the proximal attachment before working the shoulder, then Scapula Down and Back.',
    source:
      'Jim Masterson, Beyond Horse Massage, Chapter 5 (p. 34–35, 60) & Chapter 6 (p. 62–64).',
  },
  {
    id: 3,
    titleEn: 'Diagonal push-off deficit',
    titleRu: 'Диагональный толчковый дефицит',
    laterality: 'contralateral',
    usesPredominantDiagonal: true,
    triggers: [
      g(FRONT_DISTAL, 'Distal forelimb', 'Передняя конечность (дистально)', { crossSide: 'A' }),
      g(['lumbar'], 'Lumbar', 'Поясница', { crossSide: 'any' }),
      g(['hock'], 'Hock (opposite side)', 'Скакательный сустав (противоположная сторона)', {
        crossSide: 'B',
      }),
    ],
    detectable: true,
    mechanismRu:
      'Согласно «Закону сторон» (Law of Sides), при первичной хромоте передней ноги лошадь инстинктивно разгружает её, уменьшая пиковую силу толчка диагональной задней ноги. Сила передаётся по дорсальной ветви Функциональной линии (FL) через пояснично-грудную фасцию к разгибателям скакательного сустава противоположной стороны.',
    mechanismEn:
      'Per the "Law of Sides", with a primary forelimb lameness the horse unloads that limb and reduces the peak push-off force of the diagonal hindlimb. Force is transmitted along the dorsal branch of the Functional Line (FL) through the thoracolumbar fascia to the hock extensors of the opposite side.',
    hintRu:
      'Стоит проверить подошву и дистальный отдел переда на скрытую хромоту опоры (при подозрении — к ветеринару). Начните с релиза плече-лопаточной зоны переда, затем снимите компенсаторный спазм в пояснице и hamstrings диагонального зада.',
    hintEn:
      'Worth checking the sole and distal forelimb for a subtle weight-bearing lameness (refer to a vet if suspected). Start with the shoulder/scapula of the forelimb, then release compensatory tension in the lumbar area and hamstrings of the diagonal hindlimb.',
    source:
      'S. Maliye et al. (2015), Naturally occurring forelimb lameness in the horse results in significant compensatory load redistribution during trotting; V.S. Elbrønd & R.M. Schultz (2015), Section 3.5.',
  },
  {
    id: 4,
    titleEn: 'Compensatory head nod',
    titleRu: 'Компенсаторный кивок затылка',
    laterality: 'ipsilateral',
    triggers: [
      g(POLL, 'Poll (C1–C2)', 'Затылок (C1–C2)'),
      g(['withers'], 'Withers', 'Холка'),
      g(['hock'], 'Hock', 'Скакательный сустав'),
    ],
    detectable: true,
    mechanismRu:
      'При первичной боли в суставах задней ноги (скакательный/коленный) лошадь смещает центр тяжести вперёд, опуская голову в фазу опоры ипсилатерального переда («ложная хромота переда»). Холка при этом движется асимметрично, отражая истинную проблему тазовой конечности.',
    mechanismEn:
      'With primary hindlimb joint pain (hock/stifle) the horse shifts weight forward and drops the head during stance of the ipsilateral forelimb ("false forelimb lameness"). The withers move asymmetrically, reflecting the true hindlimb problem.',
    hintRu:
      'Стоит оценить вертикальную асимметрию холки на рыси, чтобы отличить истинную хромоту зада (при подозрении — к ветеринару). Не начинайте с передней ноги: расслабьте скакательный сустав и крестец, завершите Withers Wiggle.',
    hintEn:
      'Worth assessing vertical withers asymmetry at trot to tell a true hindlimb lameness apart (refer to a vet if suspected). Do not start with the forelimb: relax the hock and sacrum first, finish with Withers Wiggle.',
    source:
      'M. Rhodin, E. Persson-Sjodin et al. (2018), Vertical movement symmetry of the withers in horses with induced forelimb and hindlimb lameness at trot; Jim Masterson, Beyond Horse Massage, Chapter 6.',
  },
  {
    id: 5,
    titleEn: 'Deep viscero-somatic block',
    titleRu: 'Глубокий висцеро-соматический блок',
    laterality: 'ipsilateral',
    triggers: [
      g(['lumbar'], 'Lumbar', 'Поясница'),
      g([], 'Hip joint', 'Тазобедренный сустав'),
      g([], 'Stifle', 'Колено (задняя нога)'),
    ],
    detectable: false,
    undetectableReasonEn: `${NOT_ON_MAP_EN} (hip joint, stifle).`,
    undetectableReasonRu: `${NOT_ON_MAP_RU} (тазобедренный сустав, колено).`,
    mechanismRu:
      'Мышцы пояснично-подвздошного комплекса (mm. psoas major, psoas minor, iliacus) и портняжная мышца (m. sartorius) входят в Глубокую вентральную линию (DVL), соединяя нижнюю поверхность поясничных позвонков с бедром и медиальной фасцией коленного сустава. Напряжение в паху и колене спазмирует поясницу и ограничивает подвижность тазобедренного сустава.',
    mechanismEn:
      'The iliopsoas complex (psoas major/minor, iliacus) and sartorius belong to the Deep Ventral Line (DVL), linking the ventral lumbar vertebrae to the femur and medial stifle fascia. Groin and stifle tension tightens the lumbar area and limits hip mobility.',
    hintRu:
      'Стоит обратить внимание на коленную чашечку (фиксация надколенника — вопрос к ветеринару). Начинайте с мягкого покачивания таза (Lateral Rocking) и деликатного касания точки колена (Stifle Point), без сильного давления.',
    hintEn:
      'Pay attention to the patella (upward fixation is a question for the vet). Start with gentle Lateral Rocking of the pelvis and a delicate touch at the Stifle Point, without strong pressure.',
    source:
      'V.S. Elbrønd & R.M. Schultz (2021), Deep Myofascial Kinetic Lines in Horses, Section 3.1 & 4.1; Jim Masterson, Beyond Horse Massage, Chapter 7 (p. 106, 120).',
  },
  {
    id: 6,
    titleEn: 'Spiral diagonal torsion',
    titleRu: 'Спиральная диагональная торсия',
    laterality: 'contralateral',
    usesPredominantDiagonal: true,
    triggers: [
      g(['neck'], 'Base of neck (≈ C6–T1)', 'Основание шеи (≈ C6–T1)', { crossSide: 'A' }),
      g(['shoulder'], 'Scapula (opposite side)', 'Лопатка (противоположная сторона)', {
        crossSide: 'B',
      }),
      g(['sacrum'], 'Sacrum / SI', 'Крестец / КПС', { crossSide: 'any' }),
    ],
    detectable: true,
    mechanismRu:
      'Спиральная линия (SL) трижды перекрещивается по телу: от уха через основание шеи (C6–T3) на противоположную лопатку (m. rhomboideus, m. serratus ventralis), огибает живот и пересекает срединную линию на крестце. Спазм цепи скручивает шею в одну сторону с подъёмом и ретракцией противоположной лопатки.',
    mechanismEn:
      'The Spiral Line (SL) crosses the body three times: from below the ear across the base of the neck (C6–T3) to the opposite scapula (rhomboideus, serratus ventralis), around the abdomen and across the midline at the sacrum. Tension twists the neck to one side while lifting and retracting the opposite scapula.',
    hintRu:
      'Первым шагом стоит отпустить натяжение под лопаткой в зоне C7–T1 (Under the Scapula Release), затем проверить подвижность дорсальных крестцовых связок на диагональной стороне крупа.',
    hintEn:
      'First release tension under the scapula at C7–T1 (Under the Scapula Release), then check mobility of the dorsal sacral ligaments on the diagonal side of the croup.',
    source:
      'V.S. Elbrønd & R.M. Schultz (2015), Section 3.4; E. Walton (2024), Myofascial kinetic lines as a diagnostic tool in equine osteopathy, Section 2.8.',
  },
  {
    id: 7,
    titleEn: 'Cervico-thoracic sling clamp',
    titleRu: 'Цервико-торакальный зажим подвески',
    laterality: 'ipsilateral',
    triggers: [
      g(['neck'], 'Base of neck (C6–T1)', 'Основание шеи (C6–T1)'),
      g(['withers'], 'Withers', 'Холка'),
      g([], 'Sternum / pectorals', 'Грудина / грудные мышцы'),
    ],
    detectable: false,
    undetectableReasonEn: `${NOT_ON_MAP_EN} (pectorals).`,
    undetectableReasonRu: `${NOT_ON_MAP_RU} (грудные мышцы).`,
    mechanismRu:
      'У лошадей нет ключицы: передняя конечность подвешена к туловищу мышечным слингом — вентральная зубчатая, лестничные и грудные мышцы (m. pectoralis ascendens/descendens), крепящиеся к грудине и нижним шейным позвонкам (C6–T1). Спазм этой группы блокирует подъём холки и свободу плечевого пояса.',
    mechanismEn:
      'Horses have no clavicle: the forelimb is slung to the trunk by the serratus ventralis, scalenes and pectorals (ascending/descending) attached to the sternum and lower cervical vertebrae (C6–T1). Tension here blocks lifting of the withers and freedom of the shoulder girdle.',
    hintRu:
      'Начните с мягкого эффлеража грудных мышц позади локтя и у грудины при отведённой назад ноге, затем — глубокий релиз под лопаткой в точке C7–T1. Стоит проверить чувствительность подпружной зоны.',
    hintEn:
      'Start with gentle effleurage of the pectorals behind the elbow and at the sternum with the leg drawn back, then a deep release under the scapula at C7–T1. Worth checking girth-area sensitivity.',
    source:
      'Jim Masterson, Beyond Horse Massage, Chapter 6 (p. 62–65, 92–95); V.S. Elbrønd & R.M. Schultz (2021), Deep Front Limb Lines.',
  },
  {
    id: 8,
    titleEn: 'Dorsal hyperextension chain',
    titleRu: 'Дорсальная цепь гиперэкстензии',
    laterality: 'ipsilateral',
    triggers: [
      g(POLL, 'Poll (C1–C2)', 'Затылок (C1–C2)'),
      g(THORACIC, 'Back / thoracic', 'Спина / грудной отдел'),
      g(['hock'], 'Hock', 'Скакательный сустав'),
    ],
    detectable: true,
    mechanismRu:
      'Поверхностная дорсальная линия (SDL) соединяет плантарную фасцию и поверхностный пальцевый сгибатель скакательного сустава через седалищный бугор, крестцово-бугорную связку, длиннейшую мышцу спины и выйную связку с затылком. Статическое напряжение цепи прогибает спину («оленья шея») и мешает подведению зада.',
    mechanismEn:
      'The Superficial Dorsal Line (SDL) links the plantar fascia and superficial digital flexor at the hock via the ischial tuberosity, sacrotuberous ligament, longissimus dorsi and nuchal ligament to the poll. Static tension hollows the back ("ewe neck") and limits hindlimb engagement.',
    hintRu:
      'Начните со сканирования Bladder Meridian с давлением «в пол-яичного желтка» вдоль всей линии спины от затылка до пятки; на первом микро-ответе остановитесь на затылке, чтобы снизить общий тонус.',
    hintEn:
      'Start with a Bladder Meridian scan at "half-yolk" pressure along the whole topline from poll to heel; at the first micro-response pause at the poll to lower overall tone.',
    source:
      'V.S. Elbrønd & R.M. Schultz (2015), Section 3.1; Jim Masterson, Beyond Horse Massage, Chapter 4 (p. 24–32); C. Reece (2025), Equine Myofascial Kinetic Lines SDL.',
  },
  {
    id: 9,
    titleEn: 'Stomatognathic temporo-pelvic block',
    titleRu: 'Стоматогнатический височно-тазовый блок',
    laterality: 'ipsilateral',
    triggers: [
      g(['tmj'], 'TMJ', 'ВНЧС'),
      g(POLL, 'Poll (C1–C2)', 'Затылок (C1–C2)'),
      g(['sacrum'], 'Sacrum / SI', 'Крестец / КПС'),
    ],
    detectable: true,
    mechanismRu:
      'Фасции жевательной и височной мышц ВНЧС переходят в поверхностную и глубокую дорсальные линии и смыкаются с субокципитальными тканями атланта. Окклюзионная асимметрия челюсти может передавать хроническое напряжение через твёрдую мозговую оболочку на крестцово-подвздошное сочленение.',
    mechanismEn:
      'The masseter and temporalis fascia of the TMJ blend into the superficial and deep dorsal lines and meet the suboccipital tissues of the atlas. Occlusal asymmetry of the jaw can transmit chronic tension via the dura mater to the sacroiliac joint.',
    hintRu:
      'Стоит обсудить с ветеринаром/стоматологом подвижность челюсти и стирание зубов. Начните с декомпрессии ВНЧС лёгким пальцевым касанием без фиксации головы, затем оцените податливость крестца.',
    hintEn:
      'Worth discussing jaw mobility and tooth wear with a vet/equine dentist. Start with TMJ decompression using a light fingertip touch without restraining the head, then assess sacral give.',
    source:
      'V.S. Elbrønd & R.M. Schultz (2015), Discussion (p. 176); Jim Masterson, Beyond Horse Massage, Chapter 5 & Chapter 9 (p. 183).',
  },
  {
    id: 10,
    titleEn: 'Diagonal atlanto-gluteal spasm',
    titleRu: 'Диагональный атланто-ягодичный спазм',
    laterality: 'contralateral',
    usesPredominantDiagonal: true,
    triggers: [
      g(POLL, 'Poll (C1–C2)', 'Затылок (C1–C2)', { crossSide: 'A' }),
      g(['gluteals'], 'Hip point / gluteals (opposite side)', 'Тазобедренная точка / ягодичные (противоположная сторона)', {
        crossSide: 'B',
      }),
    ],
    detectable: true,
    mechanismRu:
      'Одностороннее смещение или зажим атланта (C1) рефлекторно активирует диагональную цепь компенсации, вызывая стойкий спазм средней ягодичной мышцы (m. gluteus medius) в области тазобедренного сустава на противоположной стороне.',
    mechanismEn:
      'A one-sided atlas (C1) restriction reflexively activates a diagonal compensation chain, producing persistent tension of the gluteus medius at the hip on the opposite side.',
    hintRu:
      'Проведите Lateral Cervical Flexion с акцентом на крыло атланта на зажатой стороне; после полноценного макро-ответа (зевок, облизывание) перепроверьте ягодичную зону — часто спазм уходит без локальной работы.',
    hintEn:
      'Do Lateral Cervical Flexion focusing on the atlas wing on the restricted side; after a full macro-response (yawn, licking) recheck the gluteal area — the tension often resolves without local work.',
    source:
      'Jim Masterson, Beyond Horse Massage, Chapter 7 (p. 110, 142) & Chapter 9 (p. 162–165).',
  },
  {
    id: 11,
    titleEn: 'Ventral contracture syndrome',
    titleRu: 'Вентральный контрактурный синдром',
    laterality: 'bilateral',
    triggers: [
      g(['tmj'], 'TMJ', 'ВНЧС'),
      g([], 'Sternum / pectorals', 'Грудина / грудные мышцы'),
      g([], 'Stifle', 'Колено (задняя нога)'),
    ],
    detectable: false,
    undetectableReasonEn: `${NOT_ON_MAP_EN} (pectorals, stifle).`,
    undetectableReasonRu: `${NOT_ON_MAP_RU} (грудные мышцы, колено).`,
    mechanismRu:
      'Поверхностная вентральная линия (SVL) идёт от челюсти через грудино-челюстную мышцу (m. sternomandibularis), вентральную фасцию грудины, прямую мышцу живота и через подвздошное сухожилие — к четырёхглавой мышце бедра и связкам надколенника. Статическое укорочение линии сгибает корпус, поджимает таз и провоцирует функциональный блок колена.',
    mechanismEn:
      'The Superficial Ventral Line (SVL) runs from the jaw via the sternomandibularis, ventral sternal fascia and rectus abdominis, through the prepubic tendon to the quadriceps and patellar ligaments. Static shortening flexes the trunk, tucks the pelvis and promotes a functional stifle block.',
    hintRu:
      'Начните с мягкого расслабления вентральной шейной борозды у челюсти и грудины в Head Down; затем стоит проверить чувствительность прикрепления прямой мышцы живота к лонной кости.',
    hintEn:
      'Start by softening the ventral neck groove near the jaw and sternum in Head Down; then check sensitivity at the rectus abdominis insertion on the pubis.',
    source:
      'V.S. Elbrønd & R.M. Schultz (2015), Section 3.2; E. Walton (2024), Myofascial kinetic lines as a diagnostic tool in equine osteopathy, Section 2.4.',
  },
  {
    id: 12,
    titleEn: 'Thoracolumbar anticlinal clamp',
    titleRu: 'Тораколюмбальный антиклинальный зажим',
    laterality: 'bilateral',
    triggers: [
      g(['withers'], 'Withers', 'Холка', { axial: true }),
      g(THORACIC, 'Back / thoracic', 'Спина / грудной отдел', { axial: true }),
      g(['lumbar'], 'Lumbar', 'Поясница', { axial: true }),
    ],
    detectable: true,
    mechanismRu:
      'Зона T18–L1 — ключевой переход позвоночника (от грудных позвонков с рёбрами к подвижной пояснице), где меняется наклон остистых отростков и сходятся ножки диафрагмы и поясничные мышцы. Неподходящее седло или слабость спины фиксируют этот узел, сковывая движение между холкой и поясницей.',
    mechanismEn:
      'T18–L1 is a key spinal transition (rib-bearing thoracic to mobile lumbar spine) where spinous process inclination changes and the diaphragmatic crura and lumbar muscles converge. Poor saddle fit or a weak back locks this junction, restricting movement between withers and loins.',
    hintRu:
      'Сначала освободите основание холки мягким Withers Wiggle, затем — лёгкое покачивание рёберной дуги (Lateral Rocking) и упражнение Dorsal Arch. Стоит проверить подгонку седла.',
    hintEn:
      'First free the withers with a gentle Withers Wiggle, then light Lateral Rocking of the rib cage and the Dorsal Arch exercise. Worth checking saddle fit.',
    source:
      'Jim Masterson, Beyond Horse Massage, Chapter 8 (p. 143–158); V.S. Elbrønd & R.M. Schultz (2021), Section 4.1.',
  },
  {
    id: 13,
    titleEn: 'Lateral contracture bend',
    titleRu: 'Латеральный контрактурный изгиб',
    laterality: 'ipsilateral',
    triggers: [
      g(['neck'], 'Upper neck', 'Верхняя шея'),
      g(['shoulder'], 'Scapula', 'Лопатка'),
      g(['gluteals'], 'Hip point / tuber coxae', 'Тазобедренная точка / маклок'),
    ],
    detectable: true,
    mechanismRu:
      'Латеральная линия (LL) объединяет фасции шеи, плечеголовную мышцу, кожную мышцу туловища поверх лопатки, наружную косую мышцу живота и напрягатель широкой фасции бедра до маклока (tuber coxae). Односторонний гипертонус LL удерживает корпус в постоянном латеральном сгибании («банановидная» поза).',
    mechanismEn:
      'The Lateral Line (LL) joins the neck fascia, brachiocephalicus, cutaneous trunci over the scapula, external abdominal oblique and tensor fasciae latae up to the tuber coxae. One-sided hypertonus holds the trunk in a constant lateral bend ("banana" posture).',
    hintRu:
      'Начните с мобилизации лопатки вперёд и вниз с мягким отведением конечности (Scapula Down and Forward), чтобы удлинить широкую фасцию, затем отпустите верхнюю треть шеи.',
    hintEn:
      'Start with Scapula Down and Forward with gentle limb abduction to lengthen the fascia, then release the upper third of the neck.',
    source: 'V.S. Elbrønd & R.M. Schultz (2015), Section 3.3; E. Walton (2024), Section 2.6.',
  },
  {
    id: 14,
    titleEn: 'Locomotor diagonal sling',
    titleRu: 'Локомоторный диагональный слинг',
    laterality: 'contralateral',
    triggers: [
      g(['shoulder'], 'Scapula', 'Лопатка', { crossSide: 'A' }),
      g(['lumbar'], 'Lumbar', 'Поясница', { crossSide: 'any' }),
      g([], 'Stifle (opposite side)', 'Колено (противоположная сторона)', { crossSide: 'B' }),
    ],
    detectable: false,
    undetectableReasonEn: `${NOT_ON_MAP_EN} (stifle).`,
    undetectableReasonRu: `${NOT_ON_MAP_RU} (колено задней ноги).`,
    mechanismRu:
      'Функциональная линия (FL) координирует диагональные пары на рыси и галопе: широчайшая мышца спины позади лопатки через пояснично-грудную фасцию пересекает позвоночник и вплетается в фасцию колена и связки надколенника противоположной ноги. Зажим линии укорачивает вынос переда и мешает подведению диагонального колена.',
    mechanismEn:
      'The Functional Line (FL) coordinates diagonal pairs at trot and canter: the latissimus dorsi behind the scapula crosses the spine via the thoracolumbar fascia into the stifle fascia and patellar ligaments of the opposite limb. Tension shortens forelimb reach and limits engagement of the diagonal stifle.',
    hintRu:
      'Освободите каудальный край лопатки и широчайшую мышцу (Scapula Down and Back), затем проверьте пассивную подвижность колена диагональной задней ноги назад и вниз.',
    hintEn:
      'Free the caudal scapula border and latissimus (Scapula Down and Back), then check passive mobility of the diagonal hind stifle back and down.',
    source: 'V.S. Elbrønd & R.M. Schultz (2015), Section 3.5; E. Walton (2024), Section 2.7.',
  },
  {
    id: 15,
    titleEn: 'Suboccipital-metatarsal postural chain',
    titleRu: 'Субокципитально-плюсневая постуральная цепь',
    laterality: 'ipsilateral',
    triggers: [
      g([], 'Head / ears', 'Голова / уши'),
      g(POLL, 'Poll (C1–C2)', 'Затылок (C1–C2)'),
      g(['hock', 'hind_fetlock'], 'Distal hindlimb', 'Задняя конечность (дистально)'),
    ],
    detectable: false,
    undetectableReasonEn: `${NOT_ON_MAP_EN} (head / ears).`,
    undetectableReasonRu: `${NOT_ON_MAP_RU} (голова / уши).`,
    mechanismRu:
      'Ветви поверхностной и глубокой дорсальных линий идут от дистальных фаланг и плантарных связок задней ноги вдоль ахиллова сухожилия и остисто-поперечной системы до выйного гребня и ушной/височной фасций. Хроническая болезненность дистального отдела задней ноги может проявляться гиперчувствительностью ушей и защитной реакцией на затылок (head-shyness).',
    mechanismEn:
      'Branches of the superficial and deep dorsal lines run from the distal phalanges and plantar ligaments of the hindlimb along the common calcanean tendon and transversospinal system to the nuchal crest and ear/temporal fascia. Chronic distal hindlimb soreness can show as ear sensitivity and head-shyness.',
    hintRu:
      'У лошадей с защитной реакцией на затылок начните с «воздушного зазора» (Air-Gap) в нескольких сантиметрах от затылка и ушей, не фиксируя недоуздок; затем стоит обследовать путовый сустав и копыто задней ноги.',
    hintEn:
      'With head-shy horses, start Air-Gap work a few centimetres from the poll and ears without holding the halter; then examine the hind fetlock and hoof.',
    source:
      'Jim Masterson, Beyond Horse Massage, Chapter 5 (p. 56, 60) & Chapter 9 (p. 182); V.S. Elbrønd & R.M. Schultz (2021), Section 3.2.',
  },
];
