/**
 * JSON Backup & Restore serialization and validation.
 * Reuses and adapts the strict validation architecture from attached
 * `pwa-starter-kit` (src/domain/backup.ts & src/db/backupIo.ts).
 */
import { BodyworkSession, HorseProfile, Language, VoiceRecordingClip } from '../types';

export const BACKUP_FORMAT = 'masterson-case-digital-backup';
export const BACKUP_VERSION = 1;

export interface BackupPayload {
  horses: HorseProfile[];
  sessions: BodyworkSession[];
  voiceClips: Omit<VoiceRecordingClip, 'audioBlob'>[];
  language: Language;
}

export interface BackupFile {
  format: string;
  version: number;
  exportedAt: string;
  data: BackupPayload;
}

export type BackupParseResult =
  | { ok: true; backup: BackupFile }
  | { ok: false; reason: 'invalid-json' | 'not-a-backup' | 'unsupported-version' | 'corrupt-records'; detail?: string };

export function serializeBackup(payload: BackupPayload, exportedAt = new Date().toISOString()): string {
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    data: payload,
  };
  return JSON.stringify(file, null, 2);
}

export function backupFileName(exportedAt = new Date().toISOString()): string {
  return `${BACKUP_FORMAT}-${exportedAt.slice(0, 10)}.json`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseBackup(raw: string): BackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }

  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) {
    return { ok: false, reason: 'not-a-backup' };
  }
  if (typeof parsed.version !== 'number' || !Number.isInteger(parsed.version)) {
    return { ok: false, reason: 'not-a-backup' };
  }
  if (parsed.version !== BACKUP_VERSION) {
    return { ok: false, reason: 'unsupported-version', detail: String(parsed.version) };
  }

  const data = parsed.data;
  if (!isRecord(data) || !Array.isArray(data.horses) || !Array.isArray(data.sessions)) {
    return { ok: false, reason: 'not-a-backup' };
  }

  const seenHorses = new Set<string>();
  for (const h of data.horses) {
    if (!isRecord(h) || typeof h.id !== 'string' || !h.id.trim() || typeof h.name !== 'string') {
      return { ok: false, reason: 'corrupt-records', detail: 'Invalid horse record in backup' };
    }
    if (seenHorses.has(h.id)) {
      return { ok: false, reason: 'corrupt-records', detail: `Duplicate horse id: ${h.id}` };
    }
    seenHorses.add(h.id);
  }

  const seenSessions = new Set<string>();
  for (const s of data.sessions) {
    if (
      !isRecord(s) ||
      typeof s.id !== 'string' ||
      !s.id.trim() ||
      typeof s.horseId !== 'string' ||
      !isRecord(s.evaluationTable)
    ) {
      return { ok: false, reason: 'corrupt-records', detail: 'Invalid session record in backup' };
    }
    if (seenSessions.has(s.id)) {
      return { ok: false, reason: 'corrupt-records', detail: `Duplicate session id: ${s.id}` };
    }
    seenSessions.add(s.id);
  }

  const voiceClips = Array.isArray(data.voiceClips)
    ? (data.voiceClips as Omit<VoiceRecordingClip, 'audioBlob'>[])
    : [];

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
      data: {
        horses: data.horses as HorseProfile[],
        sessions: data.sessions as BodyworkSession[],
        voiceClips,
        language: data.language === 'ru' ? 'ru' : 'en',
      },
    },
  };
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    throw new Error('Invalid data URL');
  }
  const header = dataUrl.slice(0, commaIdx);
  const mimeMatch = header.match(/^data:([^;]+)/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'audio/wav';
  const b64 = dataUrl.slice(commaIdx + 1);
  const binary =
    typeof atob === 'function'
      ? atob(b64)
      : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export function downloadBackupJson(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
    reader.readAsText(file);
  });
}
