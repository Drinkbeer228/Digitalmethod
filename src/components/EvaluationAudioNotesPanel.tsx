/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  BodyworkSession,
  InstalledWhisperModel,
  Language,
  ProposedCaseSuggestion,
  VoiceRecordingClip,
} from '../types';
import { TRANSLATIONS } from '../data/translations';
import { parsePractitionerNotes } from '../utils/caseParser';
import {
  transcribeAudioClipLocally,
} from '../whisper/localWhisperEngine';
import { db, StoredAudioChunkRow } from '../db/database';
import {
  ChevronDown,
  ChevronUp,
  Cpu,
  FolderUp,
  Mic,
  Pause,
  Play,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';

interface EvaluationAudioNotesPanelProps {
  session: BodyworkSession;
  clips: VoiceRecordingClip[];
  lang: Language;
  onSaveClip: (clip: VoiceRecordingClip) => Promise<void>;
  onDeleteClip: (clipId: string) => Promise<void>;
  onUpdateManualNotes: (notes: string) => void;
  onApplySuggestion: (suggestion: ProposedCaseSuggestion) => void;
  installedModels: InstalledWhisperModel[];
  onNavigateToHorses?: () => void;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 MB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRecordingCount(count: number, lang: Language): string {
  if (lang === 'ru') {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return `${count} запись`;
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${count} записи`;
    return `${count} записей`;
  }
  return `${count} clip(s)`;
}

const getSupportedMimeType = (): string => {
  const candidates = [
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/aac',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
};

const AudioClipPlayer: React.FC<{ clip: VoiceRecordingClip }> = ({ clip }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (clip.audioBlob) {
      const url = URL.createObjectURL(clip.audioBlob);
      setObjectUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
    setObjectUrl(null);
    return undefined;
  }, [clip.audioBlob]);

  const src = objectUrl ?? clip.audioDataUrl;
  if (!src) return null;

  return (
    <audio
      controls
      src={src}
      className="w-full h-8"
      preload="metadata"
    />
  );
};

export const EvaluationAudioNotesPanel: React.FC<EvaluationAudioNotesPanelProps> = ({
  session,
  clips,
  lang,
  onSaveClip,
  onDeleteClip,
  onUpdateManualNotes,
  onApplySuggestion,
  installedModels,
  onNavigateToHorses,
}) => {
  const t = TRANSLATIONS[lang];

  // Audio Recorder State
  const [recState, setRecState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [recSeconds, setRecSeconds] = useState(0);
  const [recError, setRecError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [isAudioDrawerOpen, setIsAudioDrawerOpen] = useState(false);
  const [interruptedRecordings, setInterruptedRecordings] = useState<
    {
      recordingId: string;
      chunkCount: number;
      createdAt: string;
      sessionId: string;
      horseId: string;
      hasMissingSequence: boolean;
    }[]
  >([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeRecordingIdRef = useRef<string | null>(null);
  const chunkSeqRef = useRef<number>(0);
  const pendingWritesRef = useRef<Promise<void>[]>([]);
  const heartbeatTimerRef = useRef<number | null>(null);
  const storageFailedRef = useRef<boolean>(false);
  const timerRef = useRef<number | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const clientTokenRef = useRef<string>(`client-${Math.random()}-${Date.now()}`);
  const inMemoryChunksMapRef = useRef<Map<number, Blob>>(new Map());

  // Transcription & Assisted Case Completion State
  const [transcribingClipId, setTranscribingClipId] = useState<string | null>(null);
  const [transcribeStage, setTranscribeStage] = useState<string>('');
  const [preferredSpeechLang, setPreferredSpeechLang] = useState<'auto' | 'en' | 'ru'>('auto');
  const [suggestions, setSuggestions] = useState<ProposedCaseSuggestion[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const allSessions = await db.recordingSessions.toArray();
        const now = Date.now();
        const activeInOtherTab = allSessions.some(
          (s) =>
            s.state === 'recording' &&
            now - new Date(s.lastUpdatedAt).getTime() < 10000 &&
            s.recordingId !== activeRecordingIdRef.current
        );
        if (activeInOtherTab) {
          setInterruptedRecordings([]);
          return;
        }

        const allChunks = await db.audioChunks.toArray();
        const map = new Map<string, number>();
        for (const c of allChunks) {
          map.set(c.recordingId, (map.get(c.recordingId) ?? 0) + 1);
        }

        const list: {
          recordingId: string;
          chunkCount: number;
          createdAt: string;
          sessionId: string;
          horseId: string;
          hasMissingSequence: boolean;
        }[] = [];

        for (const [recId, count] of map.entries()) {
          const meta = await db.recordingSessions.get(recId);
          const chunksForRec = allChunks.filter((c) => c.recordingId === recId);
          chunksForRec.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
          let hasMissing = false;
          if (chunksForRec.length > 0) {
            const maxSeq = chunksForRec[chunksForRec.length - 1].sequenceNumber;
            const seqSet = new Set(chunksForRec.map((c) => c.sequenceNumber));
            for (let i = 0; i <= maxSeq; i++) {
              if (!seqSet.has(i)) {
                hasMissing = true;
                break;
              }
            }
          }

          list.push({
            recordingId: recId,
            chunkCount: count,
            createdAt:
              meta?.startedAt ??
              chunksForRec[0]?.createdAt ??
              new Date().toISOString(),
            sessionId: meta?.sessionId ?? session.id,
            horseId: meta?.horseId ?? session.horseId,
            hasMissingSequence: hasMissing,
          });
        }
        setInterruptedRecordings(list);
      } catch (err) {
        console.error('Failed to check interrupted recordings:', err);
      }
    })();

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (heartbeatTimerRef.current) window.clearInterval(heartbeatTimerRef.current);
    };
  }, [clips.length]);

  const startTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setRecSeconds((s) => s + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleRestoreInterruptedRecording = async (
    recMeta: {
      recordingId: string;
      sessionId: string;
      horseId: string;
    },
    targetSessionId = session.id
  ) => {
    try {
      const { recordingId } = recMeta;
      const meta = await db.recordingSessions.get(recordingId);
      const chunks = await db.audioChunks
        .where('recordingId')
        .equals(recordingId)
        .toArray();
      chunks.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

      let hasMissing = false;
      if (chunks.length > 0) {
        const maxSeq = chunks[chunks.length - 1].sequenceNumber;
        const seqSet = new Set(chunks.map((c) => c.sequenceNumber));
        for (let i = 0; i <= maxSeq; i++) {
          if (!seqSet.has(i)) {
            hasMissing = true;
            break;
          }
        }
      }

      if (hasMissing) {
        setRecError(
          lang === 'ru'
            ? 'Предупреждение: запись содержит пропущенные фрагменты и не может быть завершена автоматически.'
            : 'Warning: recording contains missing sequence chunks and cannot be safely completed automatically.'
        );
        return;
      }

      if (chunks.length > 0) {
        const resolvedMime = meta?.mimeType || '';
        const blob = new Blob(
          chunks.map((c) => new Blob([c.data])),
          { type: resolvedMime }
        );

        const stableClipId = `clip-${recordingId}`;
        const restoredClip: VoiceRecordingClip = {
          id: stableClipId,
          sessionId: targetSessionId,
          createdAt: meta?.startedAt ?? chunks[0].createdAt,
          durationSec: Math.max(1, chunks.length * 2),
          mimeType: resolvedMime,
          audioBlob: blob,
          transcript: '',
          transcriptionStatus: 'idle',
          recordingState: 'completed',
        };

        await db.transaction(
          'rw',
          db.voiceClips,
          db.audioChunks,
          db.recordingSessions,
          db.sessions,
          async () => {
            const targetSess = await db.sessions.get(targetSessionId);
            if (!targetSess) {
              throw new Error('Target session does not exist');
            }
            await db.voiceClips.put(restoredClip);
            await db.audioChunks.where('recordingId').equals(recordingId).delete();
            await db.recordingSessions.update(recordingId, {
              state: 'completed',
              lastUpdatedAt: new Date().toISOString(),
            });
          }
        );
        await onSaveClip(restoredClip);
      }

      setInterruptedRecordings((prev) =>
        prev.filter((r) => r.recordingId !== recordingId)
      );
    } catch (err) {
      setRecError(err instanceof Error ? err.message : 'Failed to restore recording.');
    }
  };

  const handleDiscardInterruptedRecording = async (recordingId: string) => {
    try {
      await db.transaction(
        'rw',
        db.audioChunks,
        db.recordingSessions,
        async () => {
          await db.audioChunks.where('recordingId').equals(recordingId).delete();
          await db.recordingSessions.update(recordingId, {
            state: 'completed',
            lastUpdatedAt: new Date().toISOString(),
          });
        }
      );
      setInterruptedRecordings((prev) =>
        prev.filter((r) => r.recordingId !== recordingId)
      );
    } catch (err) {
      console.error('Failed to discard interrupted recording:', err);
    }
  };

  const handleStartRecording = async () => {
    setRecError(null);
    setStorageWarning(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setRecError(
        lang === 'ru'
          ? 'Запись аудио недоступна в этом окружении. Используйте импорт аудиофайла или поле текстовых заметок ниже.'
          : 'MediaRecorder microphone access is unavailable in this browser context. You can import an audio file or enter manual notes below.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedMime = getSupportedMimeType();
      const recorder = supportedMime ? new MediaRecorder(stream, { mimeType: supportedMime }) : new MediaRecorder(stream);

      audioChunksRef.current = [];
      inMemoryChunksMapRef.current.clear();
      pendingWritesRef.current = [];
      storageFailedRef.current = false;

      const recordingId = `rec-${Date.now()}`;
      activeRecordingIdRef.current = recordingId;
      chunkSeqRef.current = 0;
      const clientToken = clientTokenRef.current;

      const nowIso = new Date().toISOString();
      const mimeType = recorder.mimeType || supportedMime || '';

      try {
        await db.transaction('rw', db.recordingSessions, async () => {
          const now = Date.now();
          const allSessions = await db.recordingSessions.toArray();
          const activeOwner = allSessions.find(
            (s) =>
              s.state === 'recording' &&
              now - new Date(s.lastUpdatedAt).getTime() < 10000 &&
              s.recordingId !== recordingId
          );
          if (activeOwner) {
            throw new Error('Active recording already owned by another tab or session.');
          }
          await db.recordingSessions.put({
            recordingId,
            sessionId: session.id,
            horseId: session.horseId,
            state: 'recording',
            startedAt: nowIso,
            lastUpdatedAt: nowIso,
            mimeType,
            ownerToken: clientToken,
          });
        });
      } catch (ownErr) {
        stream.getTracks().forEach((tr) => tr.stop());
        setRecError(
          ownErr instanceof Error ? ownErr.message : 'Failed to acquire recording ownership.'
        );
        return;
      }

      if (heartbeatTimerRef.current) window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = window.setInterval(async () => {
        try {
          await db.transaction('rw', db.recordingSessions, async () => {
            const row = await db.recordingSessions.get(recordingId);
            if (!row || row.ownerToken !== clientToken || row.state !== 'recording') {
              throw new Error('Lost ownership lease');
            }
            await db.recordingSessions.update(recordingId, {
              lastUpdatedAt: new Date().toISOString(),
            });
          });
        } catch (hbErr) {
          console.warn('Heartbeat ownership check failed, stopping recording:', hbErr);
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        }
      }, 2500);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          const seq = chunkSeqRef.current++;
          inMemoryChunksMapRef.current.set(seq, e.data);
          const chunkId = `${recordingId}-${seq}`;
          const p = (async () => {
            try {
              const arrayBuffer = await e.data.arrayBuffer();
              const existing = await db.audioChunks.get(chunkId);
              if (!existing) {
                await db.audioChunks.put({
                  id: chunkId,
                  recordingId,
                  sequenceNumber: seq,
                  data: arrayBuffer,
                  createdAt: new Date().toISOString(),
                });
              }
            } catch (dbErr) {
              storageFailedRef.current = true;
              setStorageWarning(
                lang === 'ru'
                  ? 'Предупреждение: сбой записи в IndexedDB. Запись продолжается в памяти устройства.'
                  : 'Warning: IndexedDB persistence failed. Recording continues in device memory.'
              );
            }
          })();
          pendingWritesRef.current.push(p);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        if (heartbeatTimerRef.current) {
          window.clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = null;
        }

        await Promise.allSettled(pendingWritesRef.current);

        let storedChunks: StoredAudioChunkRow[] = [];
        try {
          storedChunks = await db.audioChunks
            .where('recordingId')
            .equals(recordingId)
            .toArray();
        } catch {
          storedChunks = [];
        }

        const dbMap = new Map<number, StoredAudioChunkRow>();
        for (const c of storedChunks) {
          dbMap.set(c.sequenceNumber, c);
        }

        const maxSeq = Math.max(
          ...Array.from(dbMap.keys()),
          ...Array.from(inMemoryChunksMapRef.current.keys()),
          -1
        );

        let hasMissing = false;
        const rawBlobs: Blob[] = [];
        for (let i = 0; i <= maxSeq; i++) {
          const dbChunk = dbMap.get(i);
          const memBlob = inMemoryChunksMapRef.current.get(i);
          if (dbChunk) {
            rawBlobs.push(new Blob([dbChunk.data]));
          } else if (memBlob) {
            rawBlobs.push(memBlob);
          } else {
            hasMissing = true;
          }
        }

        const meta = await db.recordingSessions.get(recordingId);
        const resolvedMime = meta?.mimeType || recorder.mimeType || supportedMime || rawBlobs[0]?.type || '';
        const assembledBlobs = rawBlobs.map((b) => new Blob([b], { type: resolvedMime }));

        const targetSessionId = meta?.sessionId ?? session.id;
        const startedAt = meta?.startedAt ?? nowIso;

        if (hasMissing || maxSeq < 0 || assembledBlobs.length === 0) {
          try {
            await db.recordingSessions.update(recordingId, {
              state: 'interrupted',
              lastUpdatedAt: new Date().toISOString(),
            });
          } catch {}
          setRecError(
            lang === 'ru'
              ? 'Ошибка: запись содержит пропущенные фрагменты и не может быть завершена.'
              : 'Error: recording has missing chunks and cannot be safely completed.'
          );
          setRecState('idle');
          setRecSeconds(0);
          activeRecordingIdRef.current = null;
          return;
        }

        const blob = new Blob(assembledBlobs, { type: resolvedMime });
        const stableClipId = `clip-${recordingId}`;
        const newClip: VoiceRecordingClip = {
          id: stableClipId,
          sessionId: targetSessionId,
          createdAt: startedAt,
          durationSec: Math.max(1, recSeconds),
          mimeType: resolvedMime,
          audioBlob: blob,
          transcript: '',
          transcriptionStatus: 'idle',
          recordingState: 'completed',
        };

        try {
          await db.transaction(
            'rw',
            db.voiceClips,
            db.audioChunks,
            db.recordingSessions,
            async () => {
              const sessionRow = await db.recordingSessions.get(recordingId);
              if (!sessionRow || sessionRow.ownerToken !== clientToken || sessionRow.state !== 'recording') {
                throw new Error('Ownership lost or session not in recording state');
              }
              await db.voiceClips.put(newClip);
              await db.audioChunks.where('recordingId').equals(recordingId).delete();
              await db.recordingSessions.update(recordingId, {
                state: 'completed',
                lastUpdatedAt: new Date().toISOString(),
              });
            }
          );
          activeRecordingIdRef.current = null;
          setRecState('idle');
          setRecSeconds(0);
          await onSaveClip(newClip);
        } catch (txErr) {
          console.error('Finalization transaction failed or ownership lost:', txErr);
          try {
            const currentSession = await db.recordingSessions.get(recordingId);
            if (currentSession && currentSession.ownerToken === clientToken && currentSession.state === 'recording') {
              await db.recordingSessions.update(recordingId, {
                state: 'interrupted',
                lastUpdatedAt: new Date().toISOString(),
              });
            }
          } catch {}
          setRecError(
            lang === 'ru'
              ? 'Ошибка: потерян токен владения записью или сбой базы данных.'
              : 'Error: recording ownership lost or database transaction failed.'
          );
          setRecState('idle');
          setRecSeconds(0);
          activeRecordingIdRef.current = null;
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecSeconds(0);
      setRecState('recording');
      startTimer();
      setIsAudioDrawerOpen(true);
    } catch (err) {
      setRecError(
        err instanceof Error
          ? err.message
          : 'Microphone permission denied or unavailable. Manual notes remain active.'
      );
    }
  };

  const handlePauseResume = () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    if (recState === 'recording') {
      rec.pause();
      stopTimer();
      setRecState('paused');
    } else if (recState === 'paused') {
      rec.resume();
      startTimer();
      setRecState('recording');
    }
  };

  const handleStopRecording = () => {
    const rec = mediaRecorderRef.current;
    stopTimer();
    if (rec && rec.state !== 'inactive') {
      rec.stop();
    }
    setRecState('idle');
    setRecSeconds(0);
  };

  const handleImportAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setRecError(null);
    try {
      const approxSec = Math.max(1, Math.round(file.size / 32_000));
      const newClip: VoiceRecordingClip = {
        id: `clip-${Date.now()}`,
        sessionId: session.id,
        createdAt: new Date().toISOString(),
        durationSec: approxSec,
        mimeType: file.type || 'audio/wav',
        audioBlob: file,
        transcript: '',
        transcriptionStatus: 'idle',
      };
      await onSaveClip(newClip);
      setIsAudioDrawerOpen(true);
    } catch (err) {
      setRecError(err instanceof Error ? err.message : 'Failed to import audio file.');
    }
  };

  const handleTranscribeClip = async (clip: VoiceRecordingClip) => {
    setTranscribingClipId(clip.id);
    setTranscribeStage(
      installedModels.length > 0
        ? 'Running local ONNX Whisper inference...'
        : lang === 'ru'
          ? 'Офлайн-модель распознавания не установлена. Установите модель в разделе: Лошади и сессии → Настройка офлайн-распознавания'
          : 'Offline recognition model not installed. Please install a model in: Horses & Sessions → Configure Whisper'
    );
    try {
      const audioSrc = clip.audioBlob ?? clip.audioDataUrl;
      if (!audioSrc) {
        throw new Error('Audio data missing for clip.');
      }
      const res = await transcribeAudioClipLocally(
        audioSrc,
        preferredSpeechLang,
        (stage) => setTranscribeStage(stage)
      );
      const updatedClip: VoiceRecordingClip = {
        ...clip,
        transcript: res.text,
        detectedLanguage: res.detectedLanguage,
        transcriptionStatus: 'completed',
        transcriptionError: undefined,
        modelUsed: res.modelUsed,
      };
      await onSaveClip(updatedClip);
    } catch (err) {
      const updatedClip: VoiceRecordingClip = {
        ...clip,
        transcriptionStatus: 'error',
        transcriptionError:
          err instanceof Error
            ? err.message
            : lang === 'ru'
              ? 'Офлайн-распознавание не удалось. Установите модель в разделе: Лошади и сессии → Настройка офлайн-распознавания.'
              : 'Local transcription failed. Check model installation in: Horses & Sessions → Configure Whisper.',
      };
      await onSaveClip(updatedClip);
    } finally {
      setTranscribingClipId(null);
      setTranscribeStage('');
    }
  };

  const handleRunNoteParser = (text: string, clipId?: string) => {
    const parsed = parsePractitionerNotes(text, clipId);
    setSuggestions(parsed);
  };

  const handleAcceptSingle = (sug: ProposedCaseSuggestion) => {
    onApplySuggestion(sug);
    setSuggestions((prev) =>
      prev.map((s) => (s.id === sug.id ? { ...s, status: 'accepted' } : s))
    );
  };

  const handleRejectSingle = (id: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'rejected' } : s))
    );
  };

  const handleAcceptAllPending = () => {
    const pending = suggestions.filter((s) => s.status === 'pending');
    for (const s of pending) {
      onApplySuggestion(s);
    }
    setSuggestions((prev) =>
      prev.map((s) => (s.status === 'pending' ? { ...s, status: 'accepted' } : s))
    );
  };

  const pendingSuggestionsCount = suggestions.filter((s) => s.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* STORAGE OR RECOVERY WARNINGS */}
      {storageWarning && (
        <div data-testid="storage-warning-banner" className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900">
          {storageWarning}
        </div>
      )}

      {interruptedRecordings.length > 0 && (
        <div data-testid="interrupted-recording-banner" className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-3">
          <div className="text-xs font-semibold text-amber-900">
            {lang === 'ru' ? 'Обнаружена незавершенная аудиозапись' : 'Interrupted audio recording found'}
          </div>
          {interruptedRecordings.map((rec) => (
            <div key={rec.recordingId} className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-lg border border-amber-200 text-xs">
              <div>
                <span className="font-medium text-slate-800">
                  Recording: {rec.recordingId} ({rec.chunkCount} chunks)
                </span>
                <span className="text-slate-500 block text-[11px]">
                  {new Date(rec.createdAt).toLocaleString()} · Session: {rec.sessionId}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleRestoreInterruptedRecording(rec)}
                  className="px-3 py-1.5 rounded-md bg-[#2B4C3F] hover:bg-[#223D32] text-white font-medium cursor-pointer"
                >
                  {lang === 'ru' ? 'Восстановить' : 'Restore'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDiscardInterruptedRecording(rec.recordingId)}
                  className="px-3 py-1.5 rounded-md bg-red-100 hover:bg-red-200 text-red-800 font-medium cursor-pointer"
                >
                  {lang === 'ru' ? 'Удалить' : 'Discard'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* COMPACT MOBILE FIELD AUDIO RECORDER & DRAWER TOGGLE BAR */}
      <div className="rounded-xl border border-slate-300 bg-white p-2.5 md:p-4 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                recState === 'recording'
                  ? 'bg-[#B91C1C] text-white animate-pulse'
                  : recState === 'paused'
                    ? 'bg-amber-600 text-white'
                    : 'bg-[#2B4C3F]/10 text-[#2B4C3F]'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#1E2421]">
                {recState === 'recording'
                  ? lang === 'ru' ? 'Запись...' : 'Recording...'
                  : recState === 'paused'
                    ? lang === 'ru' ? 'Пауза' : 'Paused'
                    : lang === 'ru' ? 'Диктофон' : 'Audio Recorder'}
              </div>
              <div className="text-xs font-tabular font-bold text-[#2B4C3F]">
                {String(Math.floor(recSeconds / 60)).padStart(2, '0')}:
                {String(recSeconds % 60).padStart(2, '0')} · {formatRecordingCount(clips.length, lang)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {recState === 'idle' ? (
              <>
                <button
                  type="button"
                  onClick={handleStartRecording}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#B91C1C] hover:bg-red-800 text-white text-xs font-semibold cursor-pointer"
                >
                  <Mic className="w-3 h-3" />
                  <span>{t.startRecording}</span>
                </button>
                <input
                  ref={audioFileInputRef}
                  type="file"
                  accept="audio/*,.wav,.webm,.mp3,.ogg,.m4a,.mp4"
                  onChange={handleImportAudioFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => audioFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium cursor-pointer"
                >
                  <FolderUp className="w-3 h-3" />
                  <span>{lang === 'ru' ? 'Импорт' : 'Import'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handlePauseResume}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 cursor-pointer"
                >
                  {recState === 'recording' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{recState === 'recording' ? t.pauseRecording : t.resumeRecording}</span>
                </button>
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1E2421] text-white text-xs font-semibold cursor-pointer"
                >
                  <Square className="w-3 h-3" />
                  <span>{t.stopRecording}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setIsAudioDrawerOpen((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2B4C3F] bg-[#2B4C3F]/5 text-[#2B4C3F] text-xs font-semibold cursor-pointer"
            >
              <span>{isAudioDrawerOpen ? (lang === 'ru' ? 'Скрыть' : 'Hide') : (lang === 'ru' ? `Архив (${clips.length})` : `Clips (${clips.length})`)}</span>
              {isAudioDrawerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {recError && (
          <div className="p-2.5 rounded bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-1.5">
            <div>{recError}</div>
            {onNavigateToHorses && (
              <button
                type="button"
                onClick={onNavigateToHorses}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#2B4C3F] text-white text-[11px] font-semibold cursor-pointer"
              >
                {lang === 'ru' ? 'Лошади и сессии → Настройка офлайн-распознавания' : 'Horses & Sessions → Configure Whisper'}
              </button>
            )}
          </div>
        )}

        {/* COMPACT RECORDINGS & TRANSCRIPTS DRAWER */}
        {isAudioDrawerOpen && (
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              {lang === 'ru' ? `Аудиозаписи сессии (${clips.length})` : `Session Audio Clips (${clips.length})`}
            </h3>

            {clips.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center border border-dashed border-slate-300 rounded-lg">
                {lang === 'ru' ? 'Записей в этой сессии пока нет.' : 'No voice clips recorded in this session yet.'}
              </p>
            ) : (
              clips.map((clip, index) => (
                <div key={clip.id} className="p-3 rounded-lg border border-slate-200 bg-[#FAF9F6] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-medium text-[#1E2421]">
                      <span>Clip #{index + 1} · {clip.durationSec}s</span>
                      <span className="mx-1.5 text-slate-400">·</span>
                      <span className="text-slate-500 font-tabular">
                        {new Date(clip.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {clip.modelUsed && (
                        <>
                          <span className="mx-1.5 text-slate-400">·</span>
                          <span className="text-slate-500">{clip.modelUsed}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={transcribingClipId === clip.id}
                        onClick={() => handleTranscribeClip(clip)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#2B4C3F] hover:bg-[#223D32] disabled:opacity-50 text-white text-[11px] font-medium cursor-pointer"
                      >
                        <Cpu className="w-3 h-3" />
                        <span>
                          {transcribingClipId === clip.id
                            ? lang === 'ru' ? 'Обработка...' : 'Transcribing...'
                            : t.transcribeClip}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteClip(clip.id)}
                        className="p-1 text-slate-400 hover:text-red-700 rounded cursor-pointer"
                        aria-label={`Delete clip ${index + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <AudioClipPlayer clip={clip} />

                  {transcribingClipId === clip.id && (
                    <div className="text-[11px] text-[#2B4C3F] font-medium">{transcribeStage}</div>
                  )}

                  {clip.transcriptionError && (
                    <div className="p-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-800 space-y-1">
                      <div>{clip.transcriptionError}</div>
                      {onNavigateToHorses && (
                        <button
                          type="button"
                          onClick={onNavigateToHorses}
                          className="px-2 py-0.5 rounded bg-[#2B4C3F] text-white text-[10px] font-medium cursor-pointer inline-block"
                        >
                          {lang === 'ru' ? 'Лошади и сессии → Настройка офлайн-распознавания' : 'Horses & Sessions → Configure Whisper'}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-[10px] font-medium text-slate-600">
                      {lang === 'ru' ? 'Транскрипт (редактируемый):' : 'Transcript (Editable):'}
                    </label>
                    <textarea
                      rows={2}
                      value={clip.transcript}
                      onChange={(e) => void onSaveClip({ ...clip, transcript: e.target.value })}
                      placeholder={lang === 'ru' ? 'Введите текст или нажмите «Распознать локально»...' : 'Type or transcribe locally...'}
                      className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 leading-relaxed focus:border-[#2B4C3F] focus:outline-none"
                    />
                    {clip.transcript.trim().length > 0 && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRunNoteParser(clip.transcript, clip.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#2B4C3F] text-[#2B4C3F] hover:bg-[#2B4C3F]/10 text-[11px] font-medium cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>{t.parseTranscript}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* FIELD NOTES & ASSISTED SUGGESTIONS SECTION */}
      <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
          <label htmlFor="manual-field-notes" className="text-xs font-semibold text-[#1E2421]">
            {t.manualNotesTitle}
          </label>
          <button
            type="button"
            onClick={() => handleRunNoteParser(session.manualVoiceNotes)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#2B4C3F] hover:bg-[#223D32] text-white text-xs font-medium cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.analyzeManualNotes}</span>
          </button>
        </div>

        <textarea
          id="manual-field-notes"
          rows={3}
          value={session.manualVoiceNotes}
          onChange={(e) => onUpdateManualNotes(e.target.value)}
          placeholder={t.manualNotesPlaceholder}
          className="w-full rounded-lg border border-slate-300 bg-[#FAF9F6] p-3 text-xs text-slate-900 leading-relaxed focus:border-[#2B4C3F] focus:outline-none"
        />

        {/* PROPOSED SUGGESTIONS BOX */}
        {suggestions.length > 0 && (
          <div className="pt-2 border-t border-slate-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#2B4C3F] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{lang === 'ru' ? 'Предложенные изменения в карту оценки' : 'Assisted Evaluation Suggestions'}</span>
                {pendingSuggestionsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#2B4C3F] text-white text-[10px]">
                    {pendingSuggestionsCount}
                  </span>
                )}
              </span>
              {pendingSuggestionsCount > 0 && (
                <button
                  type="button"
                  onClick={handleAcceptAllPending}
                  className="px-2.5 py-1 rounded bg-[#2B4C3F] text-white text-[11px] font-semibold cursor-pointer"
                >
                  {lang === 'ru' ? 'Принять все' : 'Accept All'}
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {suggestions.map((sug) => (
                <div
                  key={sug.id}
                  className={`p-2.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
                    sug.status === 'accepted'
                      ? 'bg-emerald-50/70 border-emerald-200 opacity-75'
                      : sug.status === 'rejected'
                        ? 'bg-slate-100 border-slate-200 opacity-50 line-through'
                        : 'bg-[#FAF9F6] border-slate-200'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-[#1E2421] capitalize">
                      {sug.type.replace('_', ' ')} {sug.areaId ? `(Area ${sug.areaId})` : ''}
                    </div>
                    <div className="text-slate-600 mt-0.5 italic">“{sug.sourceSentence}”</div>
                  </div>
                  {sug.status === 'pending' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAcceptSingle(sug)}
                        className="px-2.5 py-1 rounded bg-[#2B4C3F] text-white text-[11px] font-medium cursor-pointer"
                      >
                        {lang === 'ru' ? 'Принять' : 'Accept'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectSingle(sug.id)}
                        className="px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 text-[11px] font-medium cursor-pointer"
                      >
                        {lang === 'ru' ? 'Отклонить' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
