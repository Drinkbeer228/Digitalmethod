/**
 * Offline-first IndexedDB database using Dexie.
 * Reuses storage persistence and quota estimation patterns from attached
 * `pwa-starter-kit` (src/db/persistence.ts) and `FormsOffline` (src/db/database.ts).
 */
import Dexie, { type Table } from 'dexie';
import {
  BodyworkSession,
  HorseProfile,
  InstalledWhisperModel,
  Language,
  VoiceRecordingClip,
} from '../types';
import {
  createDemoHorse,
  createDemoSession,
  createDemoVoiceClip,
  DEMO_CLIP_ID,
  DEMO_HORSE_ID,
  DEMO_SESSION_ID,
} from '../data/demoCase';

export interface AppSettingRow {
  key: string;
  value: string;
}

export interface StoredModelBlobRow {
  key: string; // e.g. `${modelId}/${fileName}`
  modelId: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  data: ArrayBuffer;
  updatedAt: string;
}

export interface StoredAudioChunkRow {
  id: string; // `${recordingId}-${sequenceNumber}`
  recordingId: string;
  sequenceNumber: number;
  data: ArrayBuffer;
  createdAt: string;
}

export interface StoredRecordingSessionRow {
  recordingId: string;
  sessionId: string;
  horseId: string;
  state: 'recording' | 'interrupted' | 'completed';
  lastUpdatedAt: string;
  startedAt: string;
  mimeType: string;
  ownerToken?: string;
}

export class MastersonDatabase extends Dexie {
  horses!: Table<HorseProfile, string>;
  sessions!: Table<BodyworkSession, string>;
  voiceClips!: Table<VoiceRecordingClip, string>;
  audioChunks!: Table<StoredAudioChunkRow, string>;
  recordingSessions!: Table<StoredRecordingSessionRow, string>;
  whisperModels!: Table<InstalledWhisperModel, string>;
  modelFileBlobs!: Table<StoredModelBlobRow, string>;
  settings!: Table<AppSettingRow, string>;

  constructor() {
    super('MastersonCaseDigitalDB');

    this.version(1).stores({
      horses: 'id, name, isDemo, updatedAt',
      sessions: 'id, horseId, sessionNumber, date, isDemo, updatedAt',
      voiceClips: 'id, sessionId, createdAt',
      whisperModels: 'id, active, installedAt',
      modelFileBlobs: 'key, modelId, fileName',
      settings: 'key',
    });

    this.version(2).stores({
      horses: 'id, name, isDemo, updatedAt',
      sessions: 'id, horseId, sessionNumber, date, isDemo, updatedAt',
      voiceClips: 'id, sessionId, createdAt, recordingState',
      audioChunks: 'id, recordingId, sequenceNumber',
      whisperModels: 'id, active, installedAt',
      modelFileBlobs: 'key, modelId, fileName',
      settings: 'key',
    });

    this.version(3).stores({
      horses: 'id, name, isDemo, updatedAt',
      sessions: 'id, horseId, sessionNumber, date, isDemo, updatedAt',
      voiceClips: 'id, sessionId, createdAt, recordingState',
      audioChunks: 'id, recordingId, sequenceNumber',
      recordingSessions: 'recordingId, sessionId, horseId, state, lastUpdatedAt',
      whisperModels: 'id, active, installedAt',
      modelFileBlobs: 'key, modelId, fileName',
      settings: 'key',
    });
  }
}

export const db = new MastersonDatabase();

/**
 * Storage durability (adapted from pwa-starter-kit/src/db/persistence.ts)
 */
export type PersistenceState =
  | { supported: false; persisted: false }
  | { supported: true; persisted: boolean };

export async function requestPersistentStorage(): Promise<PersistenceState> {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return { supported: false, persisted: false };
  }
  const sm = navigator.storage;
  if (typeof sm.persist !== 'function' || typeof sm.persisted !== 'function') {
    return { supported: false, persisted: false };
  }
  try {
    const persisted = await Promise.race([
      sm.persisted(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 250)),
    ]);
    if (persisted) return { supported: true, persisted: true };
    const granted = await Promise.race([
      sm.persist(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 250)),
    ]);
    return { supported: true, persisted: granted };
  } catch {
    return { supported: false, persisted: false };
  }
}

export interface StorageEstimate {
  usage: number | null;
  quota: number | null;
}

export async function estimateStorage(): Promise<StorageEstimate> {
  if (typeof navigator === 'undefined' || typeof navigator.storage?.estimate !== 'function') {
    return { usage: null, quota: null };
  }
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return { usage: usage ?? null, quota: quota ?? null };
  } catch {
    return { usage: null, quota: null };
  }
}

export async function getSetting(key: string): Promise<string | undefined> {
  const row = await db.settings.get(key);
  return row?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}

/**
 * Ensure initial seed of Demonstration Case (Yannis) on first launch unless deleted by user.
 */
export async function ensureInitialSeed(): Promise<{
  horses: HorseProfile[];
  sessions: BodyworkSession[];
  activeHorseId: string;
  activeSessionId: string;
  language: Language;
}> {
  await requestPersistentStorage();

  const demoDeleted = await getSetting('demoDeleted');
  let horses = await db.horses.orderBy('updatedAt').reverse().toArray();
  let sessions = await db.sessions.orderBy('updatedAt').reverse().toArray();

  if (horses.length === 0 && demoDeleted !== 'true') {
    const demoHorse = createDemoHorse();
    const demoSession = createDemoSession();
    const demoClip = createDemoVoiceClip();
    await db.transaction('rw', db.horses, db.sessions, db.voiceClips, async () => {
      await db.horses.put(demoHorse);
      await db.sessions.put(demoSession);
      await db.voiceClips.put(demoClip);
    });
    horses = [demoHorse];
    sessions = [demoSession];
  } else {
    // Ensure existing demo session uses calibrated standardized vector markers
    const existingDemo = sessions.find((s) => s.id === DEMO_SESSION_ID);
    if (
      existingDemo &&
      existingDemo.annotations.some((a) => a.id === 'demo-ann-1')
    ) {
      const updatedDemo = createDemoSession();
      await db.sessions.put(updatedDemo);
      sessions = sessions.map((s) => (s.id === DEMO_SESSION_ID ? updatedDemo : s));
    }
  }

  const savedLang = (await getSetting('language')) as Language | undefined;
  const language: Language = savedLang === 'ru' ? 'ru' : 'en';

  const savedHorseId = await getSetting('activeHorseId');
  const activeHorse =
    horses.find((h) => h.id === savedHorseId) ?? horses[0];
  const activeHorseId = activeHorse?.id ?? '';

  const horseSessions = sessions.filter((s) => s.horseId === activeHorseId);
  const savedSessionId = await getSetting('activeSessionId');
  const activeSession =
    horseSessions.find((s) => s.id === savedSessionId) ??
    horseSessions[0] ??
    sessions[0];
  const activeSessionId = activeSession?.id ?? '';

  return {
    horses,
    sessions,
    activeHorseId,
    activeSessionId,
    language,
  };
}

export async function deleteDemonstrationCase(): Promise<void> {
  await db.transaction('rw', db.horses, db.sessions, db.voiceClips, db.settings, async () => {
    await db.horses.delete(DEMO_HORSE_ID);
    await db.sessions.where('horseId').equals(DEMO_HORSE_ID).delete();
    await db.voiceClips.where('sessionId').equals(DEMO_SESSION_ID).delete();
    await db.voiceClips.delete(DEMO_CLIP_ID);
    await db.settings.put({ key: 'demoDeleted', value: 'true' });
  });
}

export async function restoreDemonstrationCase(): Promise<{
  horse: HorseProfile;
  session: BodyworkSession;
}> {
  const demoHorse = createDemoHorse();
  const demoSession = createDemoSession();
  const demoClip = createDemoVoiceClip();
  await db.transaction('rw', db.horses, db.sessions, db.voiceClips, db.settings, async () => {
    await db.horses.put(demoHorse);
    await db.sessions.put(demoSession);
    await db.voiceClips.put(demoClip);
    await db.settings.put({ key: 'demoDeleted', value: 'false' });
    await db.settings.put({ key: 'activeHorseId', value: demoHorse.id });
    await db.settings.put({ key: 'activeSessionId', value: demoSession.id });
  });
  return { horse: demoHorse, session: demoSession };
}
