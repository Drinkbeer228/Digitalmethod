import { BodyworkSession, HorseProfile, VoiceRecordingClip } from '../types';
import {
  createEmptyEvaluationTable,
  syncAnnotationsWithTable,
  TOP_VIEW_ANCHORS,
} from './anatomicalAreas';

export const DEMO_HORSE_ID = 'demo-horse-yannis';
export const DEMO_SESSION_ID = 'demo-session-yannis-2';
export const DEMO_CLIP_ID = 'demo-clip-yannis-1';

export function createDemoHorse(): HorseProfile {
  return {
    id: DEMO_HORSE_ID,
    name: 'Yannis',
    age: '11',
    breed: 'Warmblood',
    job: 'Circus',
    owner: 'Circus Equestrian Troupe (Demo)',
    contactInfo: 'Training Ground Barn #2',
    notes:
      'Preloaded demonstration case based on the certification evaluation sheet. Performs liberty and ring work in circus routines.',
    isDemo: true,
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
  };
}

export function createDemoSession(): BodyworkSession {
  const table = createEmptyEvaluationTable();

  // Populate reactions per prompt:
  // - Left Shoulder: Level 2
  // - Poll – On Top of Atlas: Level 2
  table.poll_top_atlas.left = {
    reaction: 2,
    restriction: false,
    released: true,
    releaseSigns: ['Head lowering', 'Soft blinking'],
    note: 'Level 2 reactivity on dorsal Atlas palpation; softened after Bladder Meridian & poll release.',
  };

  table.shoulder.left = {
    reaction: 2,
    restriction: false,
    released: true,
    releaseSigns: ['Deep yawning', 'Licking & chewing'],
    note: 'Level 2 palpation reaction at point of shoulder / scapula junction.',
  };

  // Populate restrictions per prompt & reference sheet:
  // - Left Neck (C3–C5)
  // - Right Neck (C3–C5)
  // - Left Gluteals / Hamstrings
  // - Right Gluteals / Hamstrings
  table.neck.left = {
    reaction: 1,
    restriction: true,
    released: true,
    releaseSigns: ['Deep yawning', 'Head lowering'],
    note: 'Restriction oval C3–C5; addressed with Lateral Cervical Flexion.',
  };

  table.neck.right = {
    reaction: 1,
    restriction: true,
    released: true,
    releaseSigns: ['Licking & chewing'],
    note: 'Restriction oval C3–C5 on right cervical vertebrae.',
  };

  table.gluteals.left = {
    reaction: null,
    restriction: true,
    released: true,
    releaseSigns: ['Deep sigh / exhalation'],
    note: 'Older restriction over left croup / middle gluteal.',
  };

  table.hamstrings.left = {
    reaction: null,
    restriction: true,
    released: true,
    releaseSigns: ['Licking & chewing'],
    note: 'Restriction circle over upper caudal hamstring.',
  };

  table.gluteals.right = {
    reaction: 1,
    restriction: true,
    released: true,
    releaseSigns: ['Deep yawning', 'Head lowering'],
    note: 'Primary diagonal compensatory restriction in right gluteal.',
  };

  table.hamstrings.right = {
    reaction: null,
    restriction: true,
    released: true,
    releaseSigns: ['Soft blinking'],
    note: 'Restriction circle over right upper hamstring.',
  };

  const annotations = syncAnnotationsWithTable(table, [
    {
      id: 'demo-ann-9',
      kind: 'diagonal',
      view: 'top',
      start: { ...TOP_VIEW_ANCHORS.left_atlas.point },
      end: { ...TOP_VIEW_ANCHORS.right_gluteal.point },
      fromAnchor: 'left_atlas',
      toAnchor: 'right_gluteal',
      color: '#1E2421',
      label: 'Left Atlas → Right Gluteal',
    },
  ]);

  return {
    id: DEMO_SESSION_ID,
    horseId: DEMO_HORSE_ID,
    practitioner: 'Certification Student (Demo)',
    caseStudyNumber: 'CS-01',
    sessionNumber: 2,
    date: '2026-11-12',
    duration: '65 min',
    generalNotes:
      'Demonstration Case (For Training Purposes Only). Evaluated along the Bladder Meridian. Observed bilateral C3–C5 neck restrictions and bilateral gluteal/hamstring restrictions, with Level 2 reactions at Left Poll (On Top of Atlas) and Left Shoulder. Predominant Diagonal identified from Left Atlas to Right Gluteal.',
    manualVoiceNotes:
      'Bladder Meridian initial scan: Left Poll on top of Atlas reaction level 2, Left Shoulder reaction level 2. Restrictions found in Left Neck C3–C5 and Right Neck C3–C5, plus Left Gluteals and Hamstrings and Right Gluteals and Hamstrings. Performed Lateral Cervical Flexion and hindquarter releases — observed deep yawning and head lowering. Predominant diagonal from Left Atlas to Right Gluteal.',
    evaluationTable: table,
    annotations,
    reportSections: {
      initialEvaluation:
        'Bladder Meridian palpation scan identified Level 2 reactivity at Left Poll – On Top of Atlas and Left Shoulder, with mild Level 1 sensitivity along Left and Right Neck (C3–C5) and Right Gluteals.',
      restrictionsIdentified:
        'Bilateral older restrictions marked in Left Neck (C3–C5) and Right Neck (C3–C5), as well as Left Gluteals / Hamstrings and Right Gluteals / Hamstrings, consistent with ring curvature demands in circus liberty work.',
      releaseSignsObserved:
        'Deep yawning, pronounced head lowering, soft blinking, and licking & chewing following Lateral Cervical Flexion and hindquarter release junctions.',
      predominantDiagonal:
        'Predominant Diagonal recorded from Left Atlas to Right Gluteal based on the combined pattern of Left Atlas/Shoulder reactivity and Right Gluteal/Hamstring restriction.',
      sessionNotes:
        'Performed Bladder Meridian scan, Poll/Atlas release, Lateral Cervical Flexion (C3–C5 bilateral), Scapula/Shoulder release on the left forehand, and Gluteal/Hamstring release on both hindquarters.',
      postSessionCareNotes:
        'Allow 24–48 hours of light movement or turnout before resuming intense ring collection. Observe head carriage and symmetry on both reins.',
    },
    reportCustomized: false,
    isDemo: true,
    createdAt: '2026-11-10T10:05:00.000Z',
    updatedAt: '2026-11-12T08:00:00.000Z',
  };
}

/** Generate a tiny valid 1-second WAV Blob for the demo clip without storing Base64 in IndexedDB */
function createDemoWavBlob(): Blob {
  const sampleRate = 16000;
  const numSamples = sampleRate * 1;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 3.5);
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.15 * env;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export function createDemoVoiceClip(): VoiceRecordingClip {
  return {
    id: DEMO_CLIP_ID,
    sessionId: DEMO_SESSION_ID,
    createdAt: '2026-11-10T10:15:00.000Z',
    durationSec: 1,
    mimeType: 'audio/wav',
    audioBlob: createDemoWavBlob(),
    transcript: '',
    transcriptionStatus: 'idle',
  };
}
