import {
  AnatomicalAreaId,
  AnatomicalRegionId,
  DiagramAnnotation,
  EvaluationTableState,
  Point,
  Side,
} from '../types';

export interface AnatomicalRegionMeta {
  id: AnatomicalRegionId;
  nameEn: string;
  nameRu: string;
  /** Muted low-intensity pastel fill & border for veterinary atlas zoning */
  pastelFill: string;
  pastelStroke: string;
  /** Slightly richer tint when hovered or filtered */
  activeFill: string;
  activeStroke: string;
  /** Normalized (0..1) polygons on Left Profile (/diagrams/horse-left.png) */
  leftPolygons: Point[][];
  /** Normalized (0..1) polygons on Top View (/diagrams/horse-top.png) */
  topPolygons: Point[][];
}

export const ANATOMICAL_REGIONS: AnatomicalRegionMeta[] = [
  {
    id: 'head_poll',
    nameEn: 'Head & Poll',
    nameRu: 'Голова и затылок',
    pastelFill: '#F2E8D5',
    pastelStroke: '#CBB894',
    activeFill: '#EAD8B8',
    activeStroke: '#A68E63',
    leftPolygons: [
      [
        { x: 0.134, y: 0.042 },
        { x: 0.162, y: 0.036 },
        { x: 0.198, y: 0.082 },
        { x: 0.228, y: 0.125 },
        { x: 0.214, y: 0.205 },
        { x: 0.195, y: 0.242 },
        { x: 0.158, y: 0.254 },
        { x: 0.104, y: 0.312 },
        { x: 0.056, y: 0.305 },
        { x: 0.05, y: 0.262 },
        { x: 0.095, y: 0.175 },
        { x: 0.13, y: 0.105 },
      ],
    ],
    topPolygons: [
      [
        { x: 0.038, y: 0.45 },
        { x: 0.12, y: 0.34 },
        { x: 0.175, y: 0.3 },
        { x: 0.225, y: 0.35 },
        { x: 0.225, y: 0.65 },
        { x: 0.175, y: 0.7 },
        { x: 0.12, y: 0.66 },
        { x: 0.038, y: 0.55 },
      ],
    ],
  },
  {
    id: 'neck_shoulder',
    nameEn: 'Neck & Shoulder',
    nameRu: 'Шея и плечо',
    pastelFill: '#DCECE2',
    pastelStroke: '#9CC0AA',
    activeFill: '#C6E2D1',
    activeStroke: '#6B9E80',
    leftPolygons: [
      [
        { x: 0.198, y: 0.082 },
        { x: 0.285, y: 0.118 },
        { x: 0.365, y: 0.178 },
        { x: 0.425, y: 0.232 },
        { x: 0.478, y: 0.262 },
        { x: 0.455, y: 0.365 },
        { x: 0.438, y: 0.485 },
        { x: 0.428, y: 0.548 },
        { x: 0.35, y: 0.542 },
        { x: 0.312, y: 0.492 },
        { x: 0.303, y: 0.405 },
        { x: 0.262, y: 0.312 },
        { x: 0.218, y: 0.238 },
        { x: 0.195, y: 0.242 },
        { x: 0.214, y: 0.205 },
        { x: 0.228, y: 0.125 },
      ],
    ],
    topPolygons: [
      [
        { x: 0.225, y: 0.35 },
        { x: 0.335, y: 0.31 },
        { x: 0.385, y: 0.19 },
        { x: 0.465, y: 0.195 },
        { x: 0.465, y: 0.805 },
        { x: 0.385, y: 0.81 },
        { x: 0.335, y: 0.69 },
        { x: 0.225, y: 0.65 },
      ],
    ],
  },
  {
    id: 'back_torso',
    nameEn: 'Back & Torso',
    nameRu: 'Спина и корпус',
    pastelFill: '#DEE8F2',
    pastelStroke: '#9EB6CE',
    activeFill: '#C8DAEC',
    activeStroke: '#6D92B8',
    leftPolygons: [
      [
        { x: 0.478, y: 0.262 },
        { x: 0.545, y: 0.292 },
        { x: 0.618, y: 0.284 },
        { x: 0.692, y: 0.264 },
        { x: 0.695, y: 0.375 },
        { x: 0.705, y: 0.495 },
        { x: 0.615, y: 0.535 },
        { x: 0.525, y: 0.556 },
        { x: 0.428, y: 0.548 },
        { x: 0.438, y: 0.485 },
        { x: 0.455, y: 0.365 },
      ],
    ],
    topPolygons: [
      [
        { x: 0.465, y: 0.195 },
        { x: 0.59, y: 0.15 },
        { x: 0.7, y: 0.18 },
        { x: 0.7, y: 0.82 },
        { x: 0.59, y: 0.85 },
        { x: 0.465, y: 0.805 },
      ],
    ],
  },
  {
    id: 'pelvis_hindquarters',
    nameEn: 'Pelvis & Hindquarters',
    nameRu: 'Таз и задний отдел',
    pastelFill: '#EAE0EE',
    pastelStroke: '#BBA7C4',
    activeFill: '#DECBE6',
    activeStroke: '#967AA3',
    leftPolygons: [
      [
        { x: 0.692, y: 0.264 },
        { x: 0.748, y: 0.258 },
        { x: 0.812, y: 0.274 },
        { x: 0.865, y: 0.308 },
        { x: 0.882, y: 0.388 },
        { x: 0.868, y: 0.485 },
        { x: 0.854, y: 0.558 },
        { x: 0.768, y: 0.562 },
        { x: 0.725, y: 0.512 },
        { x: 0.705, y: 0.495 },
        { x: 0.695, y: 0.375 },
      ],
    ],
    topPolygons: [
      [
        { x: 0.7, y: 0.18 },
        { x: 0.78, y: 0.135 },
        { x: 0.865, y: 0.22 },
        { x: 0.892, y: 0.36 },
        { x: 0.892, y: 0.64 },
        { x: 0.865, y: 0.78 },
        { x: 0.78, y: 0.865 },
        { x: 0.7, y: 0.82 },
      ],
    ],
  },
  {
    id: 'limbs_joints',
    nameEn: 'Limbs & Joints',
    nameRu: 'Конечности и суставы',
    pastelFill: '#EAE5DC',
    pastelStroke: '#BEB5A4',
    activeFill: '#DFD7C8',
    activeStroke: '#998D77',
    leftPolygons: [
      // Forelimbs
      [
        { x: 0.35, y: 0.542 },
        { x: 0.445, y: 0.555 },
        { x: 0.452, y: 0.7 },
        { x: 0.47, y: 0.84 },
        { x: 0.455, y: 0.915 },
        { x: 0.33, y: 0.935 },
        { x: 0.368, y: 0.85 },
        { x: 0.368, y: 0.7 },
      ],
      // Hindlimbs
      [
        { x: 0.725, y: 0.512 },
        { x: 0.854, y: 0.558 },
        { x: 0.898, y: 0.665 },
        { x: 0.906, y: 0.86 },
        { x: 0.89, y: 0.942 },
        { x: 0.73, y: 0.922 },
        { x: 0.785, y: 0.835 },
        { x: 0.788, y: 0.685 },
      ],
    ],
    topPolygons: [],
  },
];

export type BodySegmentId = 'head_neck' | 'torso_pelvis' | 'limbs';

export interface BodySegmentMeta {
  id: BodySegmentId;
  nameEn: string;
  shortLabelEn: string;
  nameRu: string;
  shortLabelRu: string;
  areaIds: AnatomicalAreaId[];
  pastelFill: string;
  pastelStroke: string;
  activeFill: string;
  activeStroke: string;
  leftPolygons: Point[][];
}

export const BODY_SEGMENTS: BodySegmentMeta[] = [
  {
    id: 'head_neck',
    nameEn: 'Head & Neck',
    shortLabelEn: 'Head & Neck',
    nameRu: 'Голова и шея',
    shortLabelRu: 'Голова и шея',
    areaIds: ['poll_front_atlas', 'poll_top_atlas', 'tmj', 'neck'],
    pastelFill: '#F2E8D5',
    pastelStroke: '#CBB894',
    activeFill: '#DCECE2',
    activeStroke: '#2B4C3F',
    leftPolygons: [
      [
        { x: 0.048, y: 0.265 },
        { x: 0.095, y: 0.165 },
        { x: 0.135, y: 0.04 },
        { x: 0.195, y: 0.075 },
        { x: 0.285, y: 0.118 },
        { x: 0.365, y: 0.185 },
        { x: 0.335, y: 0.345 },
        { x: 0.255, y: 0.312 },
        { x: 0.195, y: 0.245 },
        { x: 0.104, y: 0.312 },
        { x: 0.055, y: 0.305 },
      ],
    ],
  },
  {
    id: 'torso_pelvis',
    nameEn: 'Torso & Pelvis',
    shortLabelEn: 'Torso & Pelvis',
    nameRu: 'Корпус и таз',
    shortLabelRu: 'Корпус и таз',
    areaIds: [
      'shoulder',
      'withers',
      'top_of_spine',
      'saddle_outline',
      'ribs',
      'lumbar',
      'gluteals',
      'sacrum',
    ],
    pastelFill: '#DEE8F2',
    pastelStroke: '#9EB6CE',
    activeFill: '#C8DAEC',
    activeStroke: '#2B4C3F',
    leftPolygons: [
      [
        { x: 0.365, y: 0.185 },
        { x: 0.435, y: 0.235 },
        { x: 0.545, y: 0.285 },
        { x: 0.692, y: 0.262 },
        { x: 0.812, y: 0.272 },
        { x: 0.865, y: 0.315 },
        { x: 0.805, y: 0.395 },
        { x: 0.725, y: 0.512 },
        { x: 0.615, y: 0.538 },
        { x: 0.525, y: 0.556 },
        { x: 0.428, y: 0.548 },
        { x: 0.335, y: 0.515 },
        { x: 0.312, y: 0.435 },
        { x: 0.335, y: 0.345 },
      ],
    ],
  },
  {
    id: 'limbs',
    nameEn: 'Limbs & Hooves',
    shortLabelEn: 'Limbs',
    nameRu: 'Конечности и копыта',
    shortLabelRu: 'Конечности',
    areaIds: [
      'hoof_point',
      'hamstrings',
      'front_splints',
      'knee',
      'front_fetlock',
      'hock',
      'hind_fetlock',
    ],
    pastelFill: '#EAE5DC',
    pastelStroke: '#BEB5A4',
    activeFill: '#DFD7C8',
    activeStroke: '#2B4C3F',
    leftPolygons: [
      // Forelimbs + Hoof Point (#7, #15, #16, #17)
      [
        { x: 0.335, y: 0.52 },
        { x: 0.445, y: 0.552 },
        { x: 0.468, y: 0.845 },
        { x: 0.455, y: 0.925 },
        { x: 0.325, y: 0.94 },
        { x: 0.358, y: 0.845 },
        { x: 0.358, y: 0.68 },
      ],
      // Caudal Hamstrings + Hindlimbs (#14, #18, #19)
      [
        { x: 0.795, y: 0.38 },
        { x: 0.882, y: 0.385 },
        { x: 0.898, y: 0.665 },
        { x: 0.908, y: 0.865 },
        { x: 0.89, y: 0.945 },
        { x: 0.73, y: 0.922 },
        { x: 0.785, y: 0.835 },
        { x: 0.785, y: 0.665 },
        { x: 0.735, y: 0.515 },
      ],
    ],
  },
];

export function getBodySegmentForArea(areaId: AnatomicalAreaId): BodySegmentId {
  for (const seg of BODY_SEGMENTS) {
    if (seg.areaIds.includes(areaId)) {
      return seg.id;
    }
  }
  return 'torso_pelvis';
}

export interface AnatomicalAreaMeta {
  id: AnatomicalAreaId;
  index: number;
  regionId: AnatomicalRegionId;
  landmarkKind: 'point' | 'line' | 'zone';
  nameEn: string;
  nameRu: string;
  explanationEn: string;
  explanationRu: string;
  /** Normalized coordinates (0..1) on the Left Profile diagram (/diagrams/horse-left.png) */
  leftCoord: Point;
  /** Standardized reaction vector line orientation and half-length (0..1) */
  reactionLine: { halfLen: number; angleDeg: number };
  /** Standardized radius (0..1) for restriction ovals placed on this landmark */
  defaultRadius: { rx: number; ry: number; rotation?: number };
  /** Optional interactive polygon hit area on Left Profile (0..1) for distinct anatomical lines/zones */
  hitPolygon?: Point[];
  /** Hit target radius (0..1) for focal joint/point landmarks */
  hitRadius: number;
  /** Synonyms in English and Russian for local note parsing */
  synonymsEn: string[];
  synonymsRu: string[];
}

export const ANATOMICAL_AREAS: AnatomicalAreaMeta[] = [
  {
    id: 'poll_front_atlas',
    index: 1,
    regionId: 'head_poll',
    landmarkKind: 'point',
    nameEn: 'Poll – In Front of Atlas',
    nameRu: 'Затылок — перед атлантом',
    explanationEn:
      'Occiput to C1 (Atlas) junction immediately behind the ears; sensitive to poll flexion and bridle pressure.',
    explanationRu:
      'Сочленение затылочной кости и C1 (атланта) сразу за ушами; чувствительно к сгибанию в затылке.',
    leftCoord: { x: 0.184, y: 0.092 },
    reactionLine: { halfLen: 0.02, angleDeg: -28 },
    defaultRadius: { rx: 0.024, ry: 0.019, rotation: -18 },
    hitRadius: 0.025,
    synonymsEn: [
      'poll in front of atlas',
      'in front of atlas',
      'front of atlas',
      'occiput',
      'poll front',
    ],
    synonymsRu: ['перед атлантом', 'затылок перед атлантом', 'перед первым шейным'],
  },
  {
    id: 'poll_top_atlas',
    index: 2,
    regionId: 'head_poll',
    landmarkKind: 'point',
    nameEn: 'Poll – On Top of Atlas',
    nameRu: 'Затылок — поверх атланта',
    explanationEn:
      'Dorsal aspect and wings of C1 (Atlas); key primary junction of the Bladder Meridian.',
    explanationRu:
      'Дорсальная поверхность и крылья C1 (атланта); ключевая точка меридиана мочевого пузыря.',
    leftCoord: { x: 0.216, y: 0.116 },
    reactionLine: { halfLen: 0.022, angleDeg: 22 },
    defaultRadius: { rx: 0.026, ry: 0.02, rotation: 18 },
    hitRadius: 0.026,
    synonymsEn: [
      'poll on top of atlas',
      'on top of atlas',
      'top of atlas',
      'atlas wing',
      'poll',
      'atlas',
    ],
    synonymsRu: [
      'поверх атланта',
      'затылок поверх атланта',
      'крыло атланта',
      'атлант',
      'затылок',
    ],
  },
  {
    id: 'tmj',
    index: 3,
    regionId: 'head_poll',
    landmarkKind: 'point',
    nameEn: 'TMJ',
    nameRu: 'ВНЧС (височно-нижнечелюстной сустав)',
    explanationEn:
      'Temporomandibular joint below the ear and caudal to the eye; closely linked with poll and hyoid apparatus.',
    explanationRu:
      'Височно-нижнечелюстной сустав ниже уха; тесно связан с затылком и подъязычным аппаратом.',
    leftCoord: { x: 0.174, y: 0.168 },
    reactionLine: { halfLen: 0.019, angleDeg: -15 },
    defaultRadius: { rx: 0.022, ry: 0.02, rotation: 0 },
    hitRadius: 0.026,
    synonymsEn: ['tmj', 'temporomandibular', 'jaw joint', 'mandible'],
    synonymsRu: ['внчс', 'височно-нижнечелюстной', 'челюстной сустав', 'челюсть'],
  },
  {
    id: 'neck',
    index: 4,
    regionId: 'neck_shoulder',
    landmarkKind: 'line',
    nameEn: 'Neck',
    nameRu: 'Шея (шейный отдел C2–C7)',
    explanationEn:
      'Cervical vertebrae C2–C7 and brachiocephalicus / trapezius musculature along the lateral neck.',
    explanationRu:
      'Шейные позвонки C2–C7 и плечеголовная / трапециевидная мускулатура вдоль боковой стороны шеи.',
    leftCoord: { x: 0.286, y: 0.236 },
    reactionLine: { halfLen: 0.036, angleDeg: 42 },
    defaultRadius: { rx: 0.048, ry: 0.026, rotation: 44 },
    hitRadius: 0.042,
    hitPolygon: [
      { x: 0.225, y: 0.155 },
      { x: 0.345, y: 0.245 },
      { x: 0.325, y: 0.315 },
      { x: 0.215, y: 0.215 },
    ],
    synonymsEn: [
      'neck',
      'cervical',
      'c2',
      'c3',
      'c4',
      'c5',
      'c6',
      'c7',
      'c3-c5',
      'c3–c5',
      'brachiocephalicus',
    ],
    synonymsRu: ['шея', 'шейный отдел', 'шейные позвонки', 'шеи', 'c3-c5', 'с3-с5'],
  },
  {
    id: 'shoulder',
    index: 5,
    regionId: 'neck_shoulder',
    landmarkKind: 'zone',
    nameEn: 'Shoulder',
    nameRu: 'Плечо и лопатка',
    explanationEn:
      'Scapula, point of shoulder, and triceps/deltoid junction supporting forehand movement.',
    explanationRu:
      'Лопатка, плечелопаточный сустав и область трицепса, отвечающие за вынос переда.',
    leftCoord: { x: 0.372, y: 0.415 },
    reactionLine: { halfLen: 0.034, angleDeg: -32 },
    defaultRadius: { rx: 0.046, ry: 0.036, rotation: -24 },
    hitRadius: 0.045,
    hitPolygon: [
      { x: 0.365, y: 0.31 },
      { x: 0.435, y: 0.34 },
      { x: 0.415, y: 0.5 },
      { x: 0.32, y: 0.48 },
    ],
    synonymsEn: ['shoulder', 'scapula', 'point of shoulder', 'triceps'],
    synonymsRu: ['плечо', 'лопатка', 'плечевой сустав', 'плеча', 'лопатки'],
  },
  {
    id: 'withers',
    index: 6,
    regionId: 'neck_shoulder',
    landmarkKind: 'point',
    nameEn: 'Withers',
    nameRu: 'Холка',
    explanationEn:
      'Dorsal spines of T3–T10 at the base of the neck and cranial saddle bearing region.',
    explanationRu:
      'Остистые отростки T3–T10 у основания шеи и передней луки седла.',
    leftCoord: { x: 0.435, y: 0.248 },
    reactionLine: { halfLen: 0.028, angleDeg: 18 },
    defaultRadius: { rx: 0.036, ry: 0.022, rotation: 16 },
    hitRadius: 0.034,
    synonymsEn: ['withers', 'wither', 'base of withers'],
    synonymsRu: ['холка', 'холки', 'основание холки'],
  },
  {
    id: 'hoof_point',
    index: 7,
    regionId: 'limbs_joints',
    landmarkKind: 'point',
    nameEn: 'Hoof Point',
    nameRu: 'Точка копыта / венчик',
    explanationEn:
      'Ting points along the coronary band of the hoof on the Bladder and governing meridians.',
    explanationRu:
      'Точки Тинг вдоль венчика копыта по меридиану мочевого пузыря.',
    leftCoord: { x: 0.354, y: 0.908 },
    reactionLine: { halfLen: 0.02, angleDeg: 12 },
    defaultRadius: { rx: 0.025, ry: 0.019, rotation: 0 },
    hitRadius: 0.048,
    synonymsEn: ['hoof point', 'coronary band', 'ting point', 'hoof'],
    synonymsRu: ['точка копыта', 'венчик', 'копыто', 'точки тинг'],
  },
  {
    id: 'top_of_spine',
    index: 8,
    regionId: 'back_torso',
    landmarkKind: 'line',
    nameEn: 'Top of Spine',
    nameRu: 'Верхняя линия спины',
    explanationEn:
      'Supraspinous ligament and dorsal spinous processes along the thoracic back.',
    explanationRu:
      'Надостистая связка и остистые отростки грудного отдела позвоночника.',
    leftCoord: { x: 0.552, y: 0.292 },
    reactionLine: { halfLen: 0.038, angleDeg: -2 },
    defaultRadius: { rx: 0.046, ry: 0.019, rotation: -2 },
    hitRadius: 0.034,
    hitPolygon: [
      { x: 0.485, y: 0.268 },
      { x: 0.612, y: 0.272 },
      { x: 0.612, y: 0.315 },
      { x: 0.485, y: 0.315 },
    ],
    synonymsEn: ['top of spine', 'dorsal spine', 'topline', 'thoracic spine'],
    synonymsRu: ['верхняя линия спины', 'верх спины', 'позвоночник', 'спина сверху'],
  },
  {
    id: 'saddle_outline',
    index: 9,
    regionId: 'back_torso',
    landmarkKind: 'zone',
    nameEn: 'Saddle outline',
    nameRu: 'Контур седла (область под седлом)',
    explanationEn:
      'Longissimus dorsi and iliocostalis musculature underneath the saddle panels.',
    explanationRu: 'Длиннейшая мышца спины под подушками седла.',
    leftCoord: { x: 0.545, y: 0.354 },
    reactionLine: { halfLen: 0.036, angleDeg: 4 },
    defaultRadius: { rx: 0.052, ry: 0.026, rotation: 4 },
    hitRadius: 0.038,
    hitPolygon: [
      { x: 0.475, y: 0.32 },
      { x: 0.615, y: 0.32 },
      { x: 0.615, y: 0.388 },
      { x: 0.475, y: 0.388 },
    ],
    synonymsEn: ['saddle outline', 'saddle area', 'under saddle', 'longissimus'],
    synonymsRu: ['контур седла', 'область седла', 'под седлом', 'спина под седлом'],
  },
  {
    id: 'ribs',
    index: 10,
    regionId: 'back_torso',
    landmarkKind: 'zone',
    nameEn: 'Ribs',
    nameRu: 'Ребра и межреберья',
    explanationEn:
      'Intercostal spaces, serratus ventralis, and lateral thoracic rib cage.',
    explanationRu:
      'Межреберные промежутки, зубчатая мышца и боковая грудная клетка.',
    leftCoord: { x: 0.555, y: 0.445 },
    reactionLine: { halfLen: 0.034, angleDeg: 72 },
    defaultRadius: { rx: 0.048, ry: 0.038, rotation: 12 },
    hitRadius: 0.044,
    hitPolygon: [
      { x: 0.465, y: 0.395 },
      { x: 0.635, y: 0.395 },
      { x: 0.635, y: 0.515 },
      { x: 0.465, y: 0.515 },
    ],
    synonymsEn: ['ribs', 'ribcage', 'rib', 'intercostals', 'girth area'],
    synonymsRu: ['ребра', 'межреберья', 'грудная клетка', 'область подпруги'],
  },
  {
    id: 'lumbar',
    index: 11,
    regionId: 'back_torso',
    landmarkKind: 'point',
    nameEn: 'Lumbar',
    nameRu: 'Поясница (поясничный отдел)',
    explanationEn:
      'L1–L6 lumbar region between the last rib and the tuber coxae (point of hip).',
    explanationRu:
      'Поясничный отдел L1–L6 между последним ребром и маклоком.',
    leftCoord: { x: 0.658, y: 0.288 },
    reactionLine: { halfLen: 0.028, angleDeg: -8 },
    defaultRadius: { rx: 0.034, ry: 0.024, rotation: -8 },
    hitRadius: 0.034,
    synonymsEn: ['lumbar', 'loin', 'loins', 'lower back'],
    synonymsRu: ['поясница', 'поясничный отдел', 'поясницы'],
  },
  {
    id: 'gluteals',
    index: 12,
    regionId: 'pelvis_hindquarters',
    landmarkKind: 'zone',
    nameEn: 'Gluteals',
    nameRu: 'Ягодичные мышцы (круп)',
    explanationEn:
      'Middle and superficial gluteal muscles over the croup driving hindquarter propulsion.',
    explanationRu:
      'Средняя и поверхностная ягодичные мышцы крупа, обеспечивающие толчок зада.',
    leftCoord: { x: 0.775, y: 0.342 },
    reactionLine: { halfLen: 0.032, angleDeg: 22 },
    defaultRadius: { rx: 0.042, ry: 0.032, rotation: 18 },
    hitRadius: 0.042,
    hitPolygon: [
      { x: 0.725, y: 0.305 },
      { x: 0.835, y: 0.305 },
      { x: 0.825, y: 0.39 },
      { x: 0.725, y: 0.39 },
    ],
    synonymsEn: ['gluteals', 'gluteal', 'glutes', 'croup'],
    synonymsRu: ['ягодичные', 'ягодичная мышца', 'круп', 'ягодицы'],
  },
  {
    id: 'sacrum',
    index: 13,
    regionId: 'pelvis_hindquarters',
    landmarkKind: 'line',
    nameEn: 'Sacrum',
    nameRu: 'Крестец и КПС',
    explanationEn:
      'Sacroiliac (SI) joint, tuber sacrale, and sacral spine to the tailhead.',
    explanationRu:
      'Крестцово-подвздошное сочленение (КПС), крестец и основание хвоста.',
    leftCoord: { x: 0.742, y: 0.268 },
    reactionLine: { halfLen: 0.028, angleDeg: 12 },
    defaultRadius: { rx: 0.034, ry: 0.021, rotation: 12 },
    hitRadius: 0.032,
    synonymsEn: ['sacrum', 'sacroiliac', 'si joint', 'croup top', 'tailhead'],
    synonymsRu: ['крестец', 'кпс', 'крестцово-подвздошный', 'репица'],
  },
  {
    id: 'hamstrings',
    index: 14,
    regionId: 'pelvis_hindquarters',
    landmarkKind: 'line',
    nameEn: 'Hamstrings',
    nameRu: 'Задняя поверхность бедра (седалищные мышцы)',
    explanationEn:
      'Biceps femoris, semitendinosus, and semimembranosus along the caudal hindquarters.',
    explanationRu:
      'Двуглавая, полусухожильная и полуперепончатая мышцы задней поверхности бедра.',
    leftCoord: { x: 0.836, y: 0.435 },
    reactionLine: { halfLen: 0.034, angleDeg: 102 },
    defaultRadius: { rx: 0.032, ry: 0.044, rotation: -12 },
    hitRadius: 0.04,
    hitPolygon: [
      { x: 0.8, y: 0.375 },
      { x: 0.875, y: 0.375 },
      { x: 0.865, y: 0.515 },
      { x: 0.79, y: 0.515 },
    ],
    synonymsEn: ['hamstrings', 'hamstring', 'biceps femoris', 'semitendinosus'],
    synonymsRu: [
      'задняя поверхность бедра',
      'седалищные мышцы',
      'хамстринги',
      'бедро сзади',
    ],
  },
  {
    id: 'front_splints',
    index: 15,
    regionId: 'limbs_joints',
    landmarkKind: 'line',
    nameEn: 'Front Splints (L/M)',
    nameRu: 'Грифельные кости переда (Лат./Мед.)',
    explanationEn:
      'Lateral and medial splint bones (MC2/MC4) and suspensory area along the fore cannon.',
    explanationRu:
      'Латеральная и медиальная грифельные кости и межкостный мускул пясти.',
    leftCoord: { x: 0.412, y: 0.758 },
    reactionLine: { halfLen: 0.026, angleDeg: 88 },
    defaultRadius: { rx: 0.02, ry: 0.032, rotation: 0 },
    hitRadius: 0.045,
    synonymsEn: ['front splints', 'splint bone', 'splints', 'cannon bone', 'suspensory'],
    synonymsRu: ['грифельные кости', 'грифельная кость', 'пясть', 'межкостник'],
  },
  {
    id: 'knee',
    index: 16,
    regionId: 'limbs_joints',
    landmarkKind: 'point',
    nameEn: 'Knee',
    nameRu: 'Запястье (переднее колено)',
    explanationEn:
      'Carpal joint of the forelimb; assessed for flexion tension and dorsal/palmar restriction.',
    explanationRu:
      'Запястный сустав передней конечности; оценивается на свободу сгибания.',
    leftCoord: { x: 0.376, y: 0.682 },
    reactionLine: { halfLen: 0.02, angleDeg: 0 },
    defaultRadius: { rx: 0.024, ry: 0.022, rotation: 0 },
    hitRadius: 0.046,
    synonymsEn: ['knee', 'carpus', 'carpal joint', 'front knee'],
    synonymsRu: ['запястье', 'запястный сустав', 'колено переда'],
  },
  {
    id: 'front_fetlock',
    index: 17,
    regionId: 'limbs_joints',
    landmarkKind: 'point',
    nameEn: 'Front Fetlock',
    nameRu: 'Передний путовый сустав',
    explanationEn:
      'Metacarpophalangeal joint and digital flexor tendons of the forelimb.',
    explanationRu:
      'Пястно-фаланговый (путовый) сустав и сухожилия сгибателей передней ноги.',
    leftCoord: { x: 0.382, y: 0.835 },
    reactionLine: { halfLen: 0.02, angleDeg: 0 },
    defaultRadius: { rx: 0.023, ry: 0.022, rotation: 0 },
    hitRadius: 0.046,
    synonymsEn: ['front fetlock', 'fore fetlock', 'fetlock front'],
    synonymsRu: ['передний путовый', 'путовый сустав переда', 'путо переда'],
  },
  {
    id: 'hock',
    index: 18,
    regionId: 'limbs_joints',
    landmarkKind: 'point',
    nameEn: 'Hock',
    nameRu: 'Скакательный сустав',
    explanationEn:
      'Tarsal joint of the hindlimb; critical junction for hindlimb engagement and flexion.',
    explanationRu: 'Скакательный (предплюсневый) сустав задней конечности.',
    leftCoord: { x: 0.845, y: 0.675 },
    reactionLine: { halfLen: 0.022, angleDeg: -10 },
    defaultRadius: { rx: 0.026, ry: 0.028, rotation: 0 },
    hitRadius: 0.048,
    synonymsEn: ['hock', 'hocks', 'tarsus', 'tarsal joint'],
    synonymsRu: ['скакательный сустав', 'скакалка', 'скакательный'],
  },
  {
    id: 'hind_fetlock',
    index: 19,
    regionId: 'limbs_joints',
    landmarkKind: 'point',
    nameEn: 'Hind Fetlock',
    nameRu: 'Задний путовый сустав',
    explanationEn: 'Metatarsophalangeal joint of the hindlimb.',
    explanationRu: 'Плюсне-фаланговый (путовый) сустав задней конечности.',
    leftCoord: { x: 0.884, y: 0.852 },
    reactionLine: { halfLen: 0.02, angleDeg: 0 },
    defaultRadius: { rx: 0.024, ry: 0.022, rotation: 0 },
    hitRadius: 0.048,
    synonymsEn: ['hind fetlock', 'rear fetlock', 'fetlock hind'],
    synonymsRu: ['задний путовый', 'путовый сустав зада', 'путо зада'],
  },
];

export function createEmptyEvaluationTable(): EvaluationTableState {
  const table = {} as EvaluationTableState;
  for (const area of ANATOMICAL_AREAS) {
    table[area.id] = {
      left: {
        reaction: null,
        restriction: false,
        released: false,
        releaseSigns: [],
        resistanceSigns: [],
        techniques: [],
        note: '',
      },
      right: {
        reaction: null,
        restriction: false,
        released: false,
        releaseSigns: [],
        resistanceSigns: [],
        techniques: [],
        note: '',
      },
    };
  }
  return table;
}

export function getAreaCoordinate(areaId: AnatomicalAreaId, view: 'left' | 'right'): Point {
  const meta = ANATOMICAL_AREAS.find((a) => a.id === areaId) ?? ANATOMICAL_AREAS[0];
  if (view === 'left') {
    return { ...meta.leftCoord };
  }
  // Right profile is horizontally mirrored (1 - x)
  return { x: Number((1 - meta.leftCoord.x).toFixed(4)), y: meta.leftCoord.y };
}

export function getAreaReactionEndpoints(
  areaId: AnatomicalAreaId,
  view: 'left' | 'right'
): [Point, Point] {
  const meta = ANATOMICAL_AREAS.find((a) => a.id === areaId) ?? ANATOMICAL_AREAS[0];
  const center = getAreaCoordinate(areaId, view);
  const angleDeg =
    view === 'left' ? meta.reactionLine.angleDeg : 180 - meta.reactionLine.angleDeg;
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad) * meta.reactionLine.halfLen;
  const dy = Math.sin(rad) * meta.reactionLine.halfLen;
  return [
    {
      x: Number((center.x - dx).toFixed(4)),
      y: Number((center.y - dy).toFixed(4)),
    },
    {
      x: Number((center.x + dx).toFixed(4)),
      y: Number((center.y + dy).toFixed(4)),
    },
  ];
}

/**
 * Rebuild standardized left/right vector annotations deterministically from the
 * 19-Area Evaluation Table (single source of truth), while preserving Top View
 * diagonal annotations.
 */
export function syncAnnotationsWithTable(
  table: EvaluationTableState,
  existingAnnotations: DiagramAnnotation[]
): DiagramAnnotation[] {
  const topAnnotations = existingAnnotations.filter((a) => a.view === 'top');
  const next: DiagramAnnotation[] = [];

  for (const area of ANATOMICAL_AREAS) {
    const row = table[area.id];
    if (!row) continue;

    for (const side of ['left', 'right'] as Side[]) {
      const obs = row[side];
      if (!obs) continue;
      const coord = getAreaCoordinate(area.id, side);

      if (obs.restriction) {
        const rot =
          side === 'left'
            ? area.defaultRadius.rotation ?? 0
            : -(area.defaultRadius.rotation ?? 0);
        next.push({
          id: `std-restr-${side}-${area.id}`,
          kind: 'restriction',
          view: side,
          cx: coord.x,
          cy: coord.y,
          rx: area.defaultRadius.rx,
          ry: area.defaultRadius.ry,
          rotation: rot,
          color: '#1E3A8A',
          linkedAreaId: area.id,
          label: `${side === 'left' ? 'Left' : 'Right'} ${area.nameEn}`,
        });
      }

      if (obs.reaction) {
        const [p0, p1] = getAreaReactionEndpoints(area.id, side);
        next.push({
          id: `std-react-${side}-${area.id}`,
          kind: 'reaction',
          view: side,
          level: obs.reaction,
          points: [p0, p1],
          color: '#B91C1C',
          linkedAreaId: area.id,
          label: `${side === 'left' ? 'Left' : 'Right'} ${area.nameEn} (L${obs.reaction})`,
        });
      }

      if (obs.released) {
        next.push({
          id: `std-rel-${side}-${area.id}`,
          kind: 'release',
          view: side,
          cx: Number((coord.x + (side === 'left' ? 0.022 : -0.022)).toFixed(4)),
          cy: Number((coord.y - 0.022).toFixed(4)),
          color: '#15803D',
          linkedAreaId: area.id,
          label: `${side === 'left' ? 'Left' : 'Right'} ${area.nameEn} Released`,
        });
      }
    }
  }

  return [...next, ...topAnnotations];
}

export function findNearestAnatomicalArea(
  point: Point,
  view: 'left' | 'right',
  maxDistance = 0.12
): AnatomicalAreaId | undefined {
  let bestId: AnatomicalAreaId | undefined;
  let bestDist = maxDistance;
  for (const area of ANATOMICAL_AREAS) {
    const coord = getAreaCoordinate(area.id, view);
    const dx = point.x - coord.x;
    const dy = point.y - coord.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = area.id;
    }
  }
  return bestId;
}

export const TOP_VIEW_ANCHORS: Record<
  | 'left_atlas'
  | 'right_atlas'
  | 'left_gluteal'
  | 'right_gluteal'
  | 'left_sacrum'
  | 'right_sacrum',
  { point: Point; labelEn: string; labelRu: string; role: 'atlas' | 'hind' }
> = {
  left_atlas: {
    point: { x: 0.205, y: 0.365 },
    labelEn: 'Left Atlas',
    labelRu: 'Левый атлант (Left Atlas)',
    role: 'atlas',
  },
  right_atlas: {
    point: { x: 0.205, y: 0.635 },
    labelEn: 'Right Atlas',
    labelRu: 'Правый атлант (Right Atlas)',
    role: 'atlas',
  },
  left_sacrum: {
    point: { x: 0.745, y: 0.38 },
    labelEn: 'Left Sacrum',
    labelRu: 'Левый крестец (Left Sacrum)',
    role: 'hind',
  },
  right_sacrum: {
    point: { x: 0.745, y: 0.62 },
    labelEn: 'Right Sacrum',
    labelRu: 'Правый крестец (Right Sacrum)',
    role: 'hind',
  },
  left_gluteal: {
    point: { x: 0.818, y: 0.265 },
    labelEn: 'Left Gluteal',
    labelRu: 'Левая ягодичная (Left Gluteal)',
    role: 'hind',
  },
  right_gluteal: {
    point: { x: 0.818, y: 0.735 },
    labelEn: 'Right Gluteal',
    labelRu: 'Правая ягодичная (Right Gluteal)',
    role: 'hind',
  },
};

