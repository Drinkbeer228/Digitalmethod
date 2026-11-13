export type Language = 'en' | 'ru';

export type AnatomicalAreaId =
  | 'poll_front_atlas'
  | 'poll_top_atlas'
  | 'tmj'
  | 'neck'
  | 'shoulder'
  | 'withers'
  | 'hoof_point'
  | 'top_of_spine'
  | 'saddle_outline'
  | 'ribs'
  | 'lumbar'
  | 'gluteals'
  | 'sacrum'
  | 'hamstrings'
  | 'front_splints'
  | 'knee'
  | 'front_fetlock'
  | 'hock'
  | 'hind_fetlock';

export type AnatomicalRegionId =
  | 'head_poll'
  | 'neck_shoulder'
  | 'back_torso'
  | 'pelvis_hindquarters'
  | 'limbs_joints';

export type Side = 'left' | 'right';

export type ReactionLevel = 1 | 2 | 3;

export interface AreaSideObservation {
  reaction?: ReactionLevel | null;
  restriction: boolean;
  released: boolean;
  releaseSigns?: string[];
  yawnCount?: number;
  resistanceSigns?: string[];
  techniques?: string[];
  note: string;
}

export type AreaEvaluationRow = {
  left: AreaSideObservation;
  right: AreaSideObservation;
};

export type EvaluationTableState = Record<AnatomicalAreaId, AreaEvaluationRow>;

export type DiagramView = 'left' | 'right' | 'top';

export type AnnotationColor = '#1E3A8A' | '#B91C1C' | '#15803D' | '#1E2421'; // Blue, Red, Green, Charcoal

export interface Point {
  x: number; // Normalized 0..1 relative to SVG viewBox width
  y: number; // Normalized 0..1 relative to SVG viewBox height
}

export interface ReactionLineAnnotation {
  id: string;
  kind: 'reaction';
  view: 'left' | 'right';
  level: ReactionLevel;
  points: Point[];
  color: AnnotationColor;
  linkedAreaId?: AnatomicalAreaId;
  label?: string;
}

export interface RestrictionOvalAnnotation {
  id: string;
  kind: 'restriction';
  view: 'left' | 'right';
  cx: number; // Normalized 0..1
  cy: number; // Normalized 0..1
  rx: number; // Normalized 0..1
  ry: number; // Normalized 0..1
  rotation?: number; // Degrees
  color: AnnotationColor;
  linkedAreaId?: AnatomicalAreaId;
  label?: string;
}

export interface ReleaseMarkerAnnotation {
  id: string;
  kind: 'release';
  view: 'left' | 'right';
  cx: number;
  cy: number;
  color: AnnotationColor;
  linkedAreaId?: AnatomicalAreaId;
  label?: string;
}

export type DiagonalAnchor =
  | 'left_atlas'
  | 'right_atlas'
  | 'left_gluteal'
  | 'right_gluteal'
  | 'left_sacrum'
  | 'right_sacrum'
  | 'custom';

export interface DiagonalLineAnnotation {
  id: string;
  kind: 'diagonal';
  view: 'top';
  start: Point;
  end: Point;
  fromAnchor?: DiagonalAnchor;
  toAnchor?: DiagonalAnchor;
  color: AnnotationColor;
  label?: string;
}

export type DiagramAnnotation =
  | ReactionLineAnnotation
  | RestrictionOvalAnnotation
  | ReleaseMarkerAnnotation
  | DiagonalLineAnnotation;

export interface VoiceRecordingClip {
  id: string;
  sessionId: string;
  createdAt: string;
  durationSec: number;
  mimeType: string;
  audioBlob?: Blob;
  audioDataUrl?: string; // Used for JSON backup serialization or demo clip
  transcript: string;
  detectedLanguage?: 'en' | 'ru' | 'mixed';
  transcriptionStatus: 'idle' | 'transcribing' | 'completed' | 'error';
  transcriptionError?: string;
  modelUsed?: string;
  recordingState?: 'recording' | 'interrupted' | 'completed';
}

export interface ReportSections {
  initialEvaluation: string; // Direct observations
  restrictionsIdentified: string; // Direct observations
  releaseSignsObserved: string; // Direct observations
  predominantDiagonal: string; // Practitioner's interpretation
  sessionNotes: string; // Practitioner's interpretation / techniques used
  postSessionCareNotes: string; // Recommendations entered by practitioner
}

export interface HorseProfile {
  id: string;
  name: string;
  age: string;
  breed: string;
  job: string;
  owner: string;
  contactInfo: string;
  notes: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BodyworkSession {
  id: string;
  horseId: string;
  practitioner: string;
  caseStudyNumber: string;
  sessionNumber: number;
  date: string; // YYYY-MM-DD
  duration: string;
  generalNotes: string;
  manualVoiceNotes: string;
  evaluationTable: EvaluationTableState;
  annotations: DiagramAnnotation[];
  reportSections: ReportSections;
  reportCustomized: boolean;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WhisperModelId = 'whisper-base' | 'custom-imported';

export interface InstalledWhisperModel {
  id: WhisperModelId;
  name: string;
  hfRepo: string;
  revision: string;
  format: 'onnx';
  dtype?: 'q8' | 'q4' | 'fp32' | 'fp16' | 'int8' | 'uint8';
  sizeBytes: number;
  installMethod: 'downloaded' | 'imported';
  storageBackend?: 'opfs' | 'indexeddb';
  installedAt: string;
  verified: boolean;
  verificationDetail: string;
  fileNames: string[];
  active: boolean;
}

export interface ProposedCaseSuggestion {
  id: string;
  sourceClipId?: string;
  sourceSentence: string;
  type: 'area_observation' | 'diagonal' | 'release_general' | 'unclassified';
  areaId?: AnatomicalAreaId;
  side?: Side | 'both';
  reactionLevel?: ReactionLevel;
  restriction?: boolean;
  released?: boolean;
  releaseSigns?: string[];
  diagonalFrom?: DiagonalAnchor;
  diagonalTo?: DiagonalAnchor;
  noteToAppend?: string;
  status: 'pending' | 'accepted' | 'rejected';
}
