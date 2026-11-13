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
import { transcribeAudioClipLocally } from '../whisper/localWhisperEngine';
import { db, StoredAudioChunkRow } from '../db/database';
import {
  Check,
  Cpu,
  FileDown,
  FilePlus2,
  FolderUp,
  Headphones,
  Mic,
  Pause,
  Play,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';

interface EvaluationAudioNotesPanelProps {
  session: BodyworkSession;
  clips: VoiceRecordingClip[];
  lang: Language;
  onSaveClip: (clip: VoiceRecordingClip) => Promise<void>;
  onDeleteClip: (clipId: string) => Promise<void>;
  onAppendTranscriptToSessionNotes: (text: string) => void;
  onApplySuggestion: (suggestion: ProposedCaseSuggestion) => void;
  installedModels: InstalledWhisperModel[];
  onNavigateToHorses?: () => void;
  onQuickExportPdf?: () => void;
  isExportingPdf?: boolean;
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
      className="w-full h-9"
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
  onAppendTranscriptToSessionNotes,
  onApplySuggestion,
  installedModels,
  onNavigateToHorses,
  onQuickExportPdf,
  isExportingPdf = false,
}) => {
  const t = TRANSLATIONS[lang];

  // Audio Recorder State (Phase 1 Crash-Safe Chunked Persistence)
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

  // Transcription & Optional Per-Clip Suggestion State
  const [transcribingClipId, setTranscribingClipId] = useState<string | null>(null);
  const [transcribeStage, setTranscribeStage] = useState<string>('');
  const [preferredSpeechLang, setPreferredSpeechLang] = useState<'auto' | 'en' | 'ru'>('auto');
  const [clipSuggestionsMap, setClipSuggestionsMap] = useState<
    Record<string, ProposedCaseSuggestion[]>
  >({});
  const [appendedClipId, setAppendedClipId] = useState<string | null>(null);

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
  }, [clips.length, session.id, session.horseId]);

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
          ? 'Запись аудио недоступна в этом окружении. Используйте импорт аудиофайла в панели записей.'
          : 'MediaRecorder microphone access is unavailable in this browser context. You can import an audio file in Clips.'
      );
      setIsAudioDrawerOpen(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedMime = getSupportedMimeType();
      const recorder = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime })
        : new MediaRecorder(stream);

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
          ownErr instanceof Error
            ? ownErr.message
            : 'Failed to acquire recording ownership.'
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
            } catch {
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
        const resolvedMime =
          meta?.mimeType || recorder.mimeType || supportedMime || rawBlobs[0]?.type || '';
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
              if (
                !sessionRow ||
                sessionRow.ownerToken !== clientToken ||
                sessionRow.state !== 'recording'
              ) {
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
          setIsAudioDrawerOpen(true);
        } catch (txErr) {
          console.error('Finalization transaction failed or ownership lost:', txErr);
          try {
            const currentSession = await db.recordingSessions.get(recordingId);
            if (
              currentSession &&
              currentSession.ownerToken === clientToken &&
              currentSession.state === 'recording'
            ) {
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
    } catch (err) {
      setRecError(
        err instanceof Error
          ? err.message
          : 'Microphone permission denied or unavailable.'
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
    const hasUsableModel = installedModels.some(
      (m) => (m.id as string) !== 'whisper-tiny' && m.verified && m.format === 'onnx'
    );
    setTranscribingClipId(clip.id);
    setTranscribeStage(
      hasUsableModel
        ? 'Running local ONNX Whisper inference...'
        : lang === 'ru'
          ? 'Офлайн-модель Whisper Base не установлена. Установите модель в разделе: Лошади и сессии → Настройка офлайн-распознавания'
          : 'Offline Whisper Base model not installed. Please install onnx-community/whisper-base in: Horses & Sessions → Configure Whisper'
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

  const handleRunClipNoteParser = (clip: VoiceRecordingClip) => {
    const parsed = parsePractitionerNotes(clip.transcript, clip.id);
    setClipSuggestionsMap((prev) => ({
      ...prev,
      [clip.id]: parsed,
    }));
  };

  const handleAcceptClipSuggestion = (clipId: string, sug: ProposedCaseSuggestion) => {
    onApplySuggestion(sug);
    setClipSuggestionsMap((prev) => ({
      ...prev,
      [clipId]: (prev[clipId] ?? []).map((s) =>
        s.id === sug.id ? { ...s, status: 'accepted' } : s
      ),
    }));
  };

  const handleDismissClipSuggestion = (clipId: string, sugId: string) => {
    setClipSuggestionsMap((prev) => ({
      ...prev,
      [clipId]: (prev[clipId] ?? []).map((s) =>
        s.id === sugId ? { ...s, status: 'rejected' } : s
      ),
    }));
  };

  const formattedTimer = `${String(Math.floor(recSeconds / 60)).padStart(2, '0')}:${String(
    recSeconds % 60
  ).padStart(2, '0')}`;

  return (
    <>
      {/* TOP BANNERS: ONLY RENDERED WHEN INTERRUPTED RECORDING OR STORAGE/REC ERROR EXISTS */}
      {(storageWarning || interruptedRecordings.length > 0 || recError) && (
        <div className="space-y-3 mb-4">
          {storageWarning && (
            <div
              data-testid="storage-warning-banner"
              className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900"
            >
              {storageWarning}
            </div>
          )}

          {interruptedRecordings.length > 0 && (
            <div
              data-testid="interrupted-recording-banner"
              className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 space-y-2.5 shadow-xs"
            >
              <div className="text-xs font-bold text-amber-950">
                {lang === 'ru'
                  ? 'Обнаружена незавершенная аудиозапись'
                  : 'Interrupted audio recording found'}
              </div>
              {interruptedRecordings.map((rec) => (
                <div
                  key={rec.recordingId}
                  className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-amber-200 text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-800">
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
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#2B4C3F] hover:bg-[#223D32] text-white font-semibold cursor-pointer"
                    >
                      {lang === 'ru' ? 'Восстановить' : 'Restore'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDiscardInterruptedRecording(rec.recordingId)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 font-semibold cursor-pointer"
                    >
                      {lang === 'ru' ? 'Удалить' : 'Discard'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {recError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
              <span>{recError}</span>
              <div className="flex items-center gap-2">
                {onNavigateToHorses && (
                  <button
                    type="button"
                    onClick={onNavigateToHorses}
                    className="px-2.5 py-1 rounded-md bg-[#2B4C3F] text-white text-[11px] font-semibold cursor-pointer"
                  >
                    {lang === 'ru'
                      ? 'Лошади и сессии → Whisper'
                      : 'Horses & Sessions → Whisper'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setRecError(null)}
                  className="p-1 text-amber-800 hover:text-amber-950 cursor-pointer"
                  aria-label="Dismiss error"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HIDDEN AUDIO FILE INPUT FOR IMPORT */}
      <input
        ref={audioFileInputRef}
        type="file"
        accept="audio/*,.wav,.webm,.mp3,.ogg,.m4a,.mp4"
        onChange={handleImportAudioFile}
        className="hidden"
      />

      {/* SLIDE-UP AUDIO CLIPS & LOCAL WHISPER DRAWER */}
      {isAudioDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4 no-print"
          onClick={() => setIsAudioDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          data-testid="audio-clips-drawer"
        >
          <div
            className="w-full max-w-xl max-h-[86vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#FAF9F6] border-t sm:border border-slate-300 px-4 pt-3 pb-6 sm:p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="w-11 h-1.5 rounded-full bg-slate-300 mx-auto sm:hidden" />

            <div className="flex items-center justify-between border-b border-slate-200 pb-3 gap-2">
              <div>
                <h3 className="text-base font-bold text-[#1E2421]">
                  {lang === 'ru'
                    ? `Аудиозаписи сессии (${clips.length})`
                    : `Session Audio Clips (${clips.length})`}
                </h3>
                <p className="text-xs text-slate-500">{t.voiceSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAudioDrawerOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-200/70 hover:bg-slate-200 text-slate-700 cursor-pointer shrink-0"
                aria-label="Close audio clips drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Recorder Controls + Import + Speech Language inside Drawer */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                {recState === 'idle' ? (
                  <button
                    type="button"
                    onClick={() => void handleStartRecording()}
                    className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#B91C1C] hover:bg-red-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Mic className="w-4 h-4" />
                    <span>{t.startRecording}</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handlePauseResume}
                      className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 cursor-pointer"
                    >
                      {recState === 'recording' ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      <span>
                        {recState === 'recording' ? t.pauseRecording : t.resumeRecording}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleStopRecording}
                      className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1E2421] text-white text-xs font-semibold cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>
                        {t.stopRecording} ({formattedTimer})
                      </span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  data-testid="drawer-import-audio-btn"
                  onClick={() => audioFileInputRef.current?.click()}
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-[#FAF9F6] hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  <FolderUp className="w-4 h-4" />
                  <span>{lang === 'ru' ? 'Импорт аудио' : 'Import Audio'}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="speech-language-select"
                  className="text-xs font-medium text-slate-600"
                >
                  {lang === 'ru' ? 'Язык:' : 'Speech:'}
                </label>
                <select
                  id="speech-language-select"
                  value={preferredSpeechLang}
                  onChange={(e) =>
                    setPreferredSpeechLang(e.target.value as 'auto' | 'en' | 'ru')
                  }
                  className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-[#2B4C3F] focus:outline-none cursor-pointer"
                >
                  <option value="auto">Auto (EN / RU)</option>
                  <option value="en">English (EN)</option>
                  <option value="ru">Русский (RU)</option>
                </select>
              </div>
            </div>

            {/* Clips List */}
            {clips.length === 0 ? (
              <div className="text-xs text-slate-500 py-8 text-center border border-dashed border-slate-300 rounded-xl bg-white">
                {lang === 'ru'
                  ? 'Записей в этой сессии пока нет. Нажмите «Запись» или импортируйте аудиофайл.'
                  : 'No voice clips in this session yet. Tap Record or Import Audio above.'}
              </div>
            ) : (
              <div className="space-y-3">
                {clips.map((clip, index) => {
                  const clipSugs = clipSuggestionsMap[clip.id] ?? [];
                  return (
                    <div
                      key={clip.id}
                      data-testid={`clip-card-${index + 1}`}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2.5 shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-[#1E2421]">
                          <span>
                            Clip #{index + 1} · {clip.durationSec}s
                          </span>
                          <span className="mx-1.5 text-slate-400">·</span>
                          <span className="text-slate-500 font-tabular">
                            {new Date(clip.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
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
                            onClick={() => void handleTranscribeClip(clip)}
                            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2B4C3F] hover:bg-[#223D32] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                          >
                            <Cpu className="w-3.5 h-3.5" />
                            <span>
                              {transcribingClipId === clip.id
                                ? lang === 'ru'
                                  ? 'Обработка...'
                                  : 'Transcribing...'
                                : t.transcribeClip}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteClip(clip.id)}
                            className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-red-700 rounded-lg hover:bg-red-50 cursor-pointer"
                            aria-label={`Delete clip ${index + 1}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <AudioClipPlayer clip={clip} />

                      {transcribingClipId === clip.id && (
                        <div className="text-xs text-[#2B4C3F] font-medium">
                          {transcribeStage}
                        </div>
                      )}

                      {clip.transcriptionError && (
                        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 space-y-1.5">
                          <div>{clip.transcriptionError}</div>
                          {onNavigateToHorses && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsAudioDrawerOpen(false);
                                onNavigateToHorses();
                              }}
                              className="px-2.5 py-1 rounded-md bg-[#2B4C3F] text-white text-[11px] font-semibold cursor-pointer inline-block"
                            >
                              {lang === 'ru'
                                ? 'Лошади и сессии → Настройка офлайн-распознавания'
                                : 'Horses & Sessions → Configure Whisper'}
                            </button>
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-slate-600">
                          {lang === 'ru'
                            ? 'Транскрипт (редактируемый):'
                            : 'Transcript (Editable):'}
                        </label>
                        <textarea
                          rows={2}
                          value={clip.transcript}
                          onChange={(e) =>
                            void onSaveClip({ ...clip, transcript: e.target.value })
                          }
                          placeholder={
                            lang === 'ru'
                              ? 'Введите текст или нажмите «Распознать локально»...'
                              : 'Type or tap Transcribe Locally...'
                          }
                          className="w-full rounded-lg border border-slate-300 bg-[#FAF9F6] p-2.5 text-xs text-slate-900 leading-relaxed focus:border-[#2B4C3F] focus:outline-none"
                        />

                        {clip.transcript.trim().length > 0 && (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              data-testid={`append-transcript-btn-${index + 1}`}
                              onClick={() => {
                                onAppendTranscriptToSessionNotes(clip.transcript.trim());
                                setAppendedClipId(clip.id);
                                setTimeout(() => setAppendedClipId(null), 2000);
                              }}
                              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2B4C3F]/10 hover:bg-[#2B4C3F]/20 text-[#2B4C3F] text-xs font-semibold cursor-pointer"
                            >
                              {appendedClipId === clip.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>
                                    {lang === 'ru' ? 'Добавлено!' : 'Appended!'}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <FilePlus2 className="w-3.5 h-3.5" />
                                  <span>{t.appendTranscriptBtn}</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              data-testid={`parse-transcript-btn-${index + 1}`}
                              onClick={() => handleRunClipNoteParser(clip)}
                              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[#2B4C3F]" />
                              <span>{t.parseTranscript}</span>
                            </button>
                          </div>
                        )}

                        {/* Optional Secondary Per-Clip Suggestions */}
                        {clipSugs.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5">
                            <div className="text-[11px] font-semibold text-[#2B4C3F]">
                              {t.suggestionsTitle}
                            </div>
                            {clipSugs.map((sug) => (
                              <div
                                key={sug.id}
                                className={`p-2 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
                                  sug.status === 'accepted'
                                    ? 'bg-emerald-50 border-emerald-200 opacity-75'
                                    : sug.status === 'rejected'
                                      ? 'bg-slate-100 border-slate-200 opacity-50 line-through'
                                      : 'bg-[#FAF9F6] border-slate-200'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-[#1E2421]">
                                    {sug.type.replace('_', ' ')}{' '}
                                    {sug.areaId ? `(${sug.areaId})` : ''}
                                  </div>
                                  <div className="text-slate-600 italic truncate">
                                    “{sug.sourceSentence}”
                                  </div>
                                </div>
                                {sug.status === 'pending' && (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAcceptClipSuggestion(clip.id, sug)
                                      }
                                      className="px-2.5 py-1 rounded-md bg-[#2B4C3F] text-white text-[11px] font-semibold cursor-pointer"
                                    >
                                      {t.acceptSuggestion}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDismissClipSuggestion(clip.id, sug.id)
                                      }
                                      className="px-2 py-1 rounded-md border border-slate-300 bg-white text-slate-600 text-[11px] cursor-pointer"
                                    >
                                      {t.rejectSuggestion}
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STICKY BOTTOM THUMB BAR (Record/Stop + Clips (N) + Export PDF) */}
      <div
        data-testid="sticky-bottom-thumb-bar"
        className="no-print fixed bottom-0 left-0 right-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-md border-t border-slate-300 px-3 py-2 shadow-lg"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-2">
          {/* 1. Record / Stop Button with Live Timer */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            {recState === 'idle' ? (
              <button
                type="button"
                data-testid="thumb-record-btn"
                onClick={() => void handleStartRecording()}
                className="w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#B91C1C] hover:bg-red-800 text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
              >
                <Mic className="w-4 h-4 shrink-0" />
                <span>{t.startRecording}</span>
                <span className="font-tabular text-white/85 text-xs">00:00</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  data-testid="thumb-stop-btn"
                  onClick={handleStopRecording}
                  className="flex-1 sm:flex-initial min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#1E2421] text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
                  <span>{t.stopRecording}</span>
                  <span className="font-tabular text-amber-300">{formattedTimer}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePauseResume}
                  aria-label={
                    recState === 'recording' ? t.pauseRecording : t.resumeRecording
                  }
                  className="min-h-[46px] min-w-[46px] inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-800 cursor-pointer"
                >
                  {recState === 'recording' ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* 2. Clips (N) Drawer Button */}
          <button
            type="button"
            data-testid="thumb-clips-btn"
            onClick={() => setIsAudioDrawerOpen((v) => !v)}
            className="flex-1 sm:flex-initial min-h-[46px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-[#1E2421] text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <Headphones className="w-4 h-4 text-[#2B4C3F] shrink-0" />
            <span>
              {lang === 'ru' ? `Записи (${clips.length})` : `Clips (${clips.length})`}
            </span>
          </button>

          {/* 3. Export PDF Quick Action Button */}
          {onQuickExportPdf && (
            <button
              type="button"
              data-testid="thumb-export-pdf-btn"
              disabled={isExportingPdf}
              onClick={onQuickExportPdf}
              className="flex-1 sm:flex-initial min-h-[46px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#2B4C3F] hover:bg-[#223D32] disabled:opacity-60 text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
            >
              <FileDown className="w-4 h-4 shrink-0" />
              <span>
                {isExportingPdf
                  ? lang === 'ru'
                    ? 'PDF...'
                    : 'PDF...'
                  : lang === 'ru'
                    ? 'Экспорт PDF'
                    : 'Export PDF'}
              </span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};
