/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AnatomicalAreaId,
  AnatomicalRegionId,
  AreaSideObservation,
  BodyworkSession,
  DiagramAnnotation,
  DiagonalAnchor,
  EvaluationTableState,
  HorseProfile,
  InstalledWhisperModel,
  Language,
  ReactionLevel,
  ReportSections,
  SessionPhoto,
  SessionPhotoKind,
  Side,
  VoiceRecordingClip,
} from './types';
import {
  db,
  deleteDemonstrationCase,
  ensureInitialSeed,
  estimateStorage,
  loadSessionPhotos,
  restoreDemonstrationCase,
  setSetting,
} from './db/database';
import {
  backupFileName,
  blobToDataUrl,
  dataUrlToBlob,
  downloadBackupJson,
  parseBackup,
  readFileAsText,
  serializeBackup,
  type SerializedSessionPhoto,
} from './db/backup';
import { compressImageFile } from './utils/imageCompression';
import {
  BodyPartFilterId,
  createEmptyAreaRow,
  createEmptyEvaluationTable,
  syncAnnotationsWithTable,
  TOP_VIEW_ANCHORS,
} from './data/anatomicalAreas';
import { TRANSLATIONS } from './data/translations';
import {
  buildReportFromSession,
  getUnifiedSessionNotes,
} from './utils/reportGenerator';
import { removeLegacyWhisperTinyStorage } from './whisper/localWhisperEngine';
import { HorseSilhouetteSvg } from './components/HorseSilhouetteSvg';
import { CentralEvaluationTable } from './components/CentralEvaluationTable';
import { EvaluationAudioNotesPanel } from './components/EvaluationAudioNotesPanel';
import { HorsesAndBackupView } from './components/HorsesAndBackupView';
import { SessionPhotosPanel } from './components/SessionPhotosPanel';
import { ClinicalInsightsSheet } from './components/ClinicalInsightsSheet';
import {
  appendPatternToNotes,
  detectActivePatterns,
  PatternMatch,
} from './utils/patternDetection';
import { BodyPartFilterBar } from './components/BodyPartFilterBar';
import { FinishPhase, SessionFinishSheet } from './components/SessionFinishSheet';
import { UpdateCellOptions } from './components/ZoneEditorSheet';
import { OfflineConnectivityBanner, PWAInstallAction } from './pwa/PWAInstallBanner';
import {
  Camera,
  Check,
  ChevronDown,
  Lightbulb,
  Mic,
  MoreHorizontal,
  Redo2,
  RotateCw,
  Undo2,
  X,
} from 'lucide-react';

type ActiveTab = 'editor' | 'horses';
type SaveStatus = 'saved' | 'saving' | 'error';

const DIAGONAL_PRESETS: Array<{
  id: string;
  from: Exclude<DiagonalAnchor, 'custom'>;
  to: Exclude<DiagonalAnchor, 'custom'>;
  label: string;
}> = [
  { id: 'la-rg', from: 'left_atlas', to: 'right_gluteal', label: 'L Atlas → R Gluteal' },
  { id: 'ra-lg', from: 'right_atlas', to: 'left_gluteal', label: 'R Atlas → L Gluteal' },
  { id: 'la-rs', from: 'left_atlas', to: 'right_sacrum', label: 'L Atlas → R Sacrum' },
  { id: 'ra-ls', from: 'right_atlas', to: 'left_sacrum', label: 'R Atlas → L Sacrum' },
];

interface EvaluationHistorySnapshot {
  evaluationTable: EvaluationTableState;
  annotations: DiagramAnnotation[];
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('editor');
  const [lang, setLang] = useState<Language>('en');

  const [horses, setHorses] = useState<HorseProfile[]>([]);
  const [sessions, setSessions] = useState<BodyworkSession[]>([]);
  const [activeHorseId, setActiveHorseId] = useState<string>('');
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [voiceClips, setVoiceClips] = useState<VoiceRecordingClip[]>([]);
  const [installedModels, setInstalledModels] = useState<InstalledWhisperModel[]>([]);

  // Interactive Anatomical Map & Contextual Selection State
  const [undoStack, setUndoStack] = useState<EvaluationHistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EvaluationHistorySnapshot[]>([]);
  const [activeTablePopover, setActiveTablePopover] = useState<{
    areaId: AnatomicalAreaId;
    side: Side;
  } | null>(null);
  const [hoveredAreaTarget, setHoveredAreaTarget] = useState<{
    areaId: AnatomicalAreaId;
    side?: Side;
  } | null>(null);
  const [activeRegionFilter] = useState<AnatomicalRegionId | 'all'>('all');
  const [bodyPartFilter, setBodyPartFilter] = useState<BodyPartFilterId>('all');

  // Autosave state (drives the header indicator) and the Finish result sheet
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [finishPhase, setFinishPhase] = useState<FinishPhase | null>(null);
  const [reportFocusSignal, setReportFocusSignal] = useState(0);
  const [isSessionPickerOpen, setIsSessionPickerOpen] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const saveSeqRef = useRef(0);
  const lastUndoKeyRef = useRef<string | null>(null);
  const flushPendingNoteRef = useRef<(() => void) | null>(null);
  /**
   * The newest version of the active session, updated synchronously on every edit.
   * Handlers build on this rather than on the last render, so two edits in the same
   * tick (e.g. a flushed note followed by Finish) can never overwrite each other.
   */
  const liveSessionRef = useRef<BodyworkSession | null>(null);

  // Mobile (< 1024px) diagram view switcher ('left' | 'right' | 'top') & responsive breakpoint
  const [mobileActiveView, setMobileActiveView] = useState<'left' | 'right' | 'top'>('left');
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [isAudioDrawerOpen, setIsAudioDrawerOpen] = useState<boolean>(false);
  const [sessionPhotos, setSessionPhotos] = useState<SessionPhoto[]>([]);
  const [isPhotoDrawerOpen, setIsPhotoDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mql = window.matchMedia('(min-width: 1024px)');
    const handleResize = () => setIsDesktop(mql.matches);
    handleResize();
    mql.addEventListener('change', handleResize);
    return () => mql.removeEventListener('change', handleResize);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const seed = await ensureInitialSeed();
        setHorses(seed.horses);
        setSessions(seed.sessions);
        setActiveHorseId(seed.activeHorseId);
        setActiveSessionId(seed.activeSessionId);
        setLang(seed.language);

        if (seed.activeSessionId) {
          const clips = await db.voiceClips
            .where('sessionId')
            .equals(seed.activeSessionId)
            .toArray();
          clips.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setVoiceClips(clips);
        }
        await removeLegacyWhisperTinyStorage().catch(() => null);
        const models = await db.whisperModels.toArray();
        setInstalledModels(models);
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const activeHorse =
    horses.find((h) => h.id === activeHorseId) ?? horses[0] ?? null;
  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ??
    sessions.find((s) => s.horseId === activeHorse?.id) ??
    sessions[0] ??
    null;

  liveSessionRef.current = activeSession;

  const t = TRANSLATIONS[lang];

  // Read-only biomechanical pattern hints for the practitioner (never auto-added to the PDF)
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const insightMatches = useMemo(
    () => (activeSession ? detectActivePatterns(activeSession) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSession?.evaluationTable, activeSession?.annotations]
  );

  const activeSessionKey = activeSession?.id ?? '';
  const activeSessionKeyRef = useRef(activeSessionKey);
  activeSessionKeyRef.current = activeSessionKey;
  useEffect(() => {
    let cancelled = false;
    void loadSessionPhotos(activeSessionKey)
      .then((rows) => {
        if (!cancelled) setSessionPhotos(rows);
      })
      .catch(() => {
        if (!cancelled) setSessionPhotos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSessionKey]);

  /**
   * Compresses picked photos on-device (max 1600px, JPEG ~80%) and stores them in `sessionPhotos`.
   * Throws a user-facing message on decode or storage-quota errors.
   */
  const handleAddSessionPhotos = async (kind: SessionPhotoKind, files: File[]) => {
    const sessionId = activeSessionKey;
    if (!sessionId) return;
    const added: SessionPhoto[] = [];
    for (const [idx, file] of files.entries()) {
      let compressed;
      try {
        compressed = await compressImageFile(file);
      } catch {
        throw new Error(
          lang === 'ru'
            ? 'Не удалось прочитать фото. Попробуйте другой снимок или формат JPEG.'
            : 'Could not read this photo. Try another shot or a JPEG image.'
        );
      }
      const photo: SessionPhoto = {
        id: `photo-${kind}-${Date.now()}-${idx}`,
        sessionId,
        kind,
        createdAt: new Date().toISOString(),
        width: compressed.width,
        height: compressed.height,
        mimeType: compressed.mimeType,
        sizeBytes: compressed.blob.size,
        imageBlob: compressed.blob,
      };
      try {
        await db.sessionPhotos.put(photo);
      } catch (err) {
        const isQuota =
          err instanceof Error && /quota/i.test(`${err.name} ${err.message}`);
        const { usage, quota } = await estimateStorage();
        const usageInfo =
          usage !== null && quota !== null
            ? ` (${Math.round(usage / 1e6)} / ${Math.round(quota / 1e6)} MB)`
            : '';
        throw new Error(
          isQuota
            ? lang === 'ru'
              ? `Недостаточно места в хранилище${usageInfo}. Удалите старые фото или аудио.`
              : `Device storage is full${usageInfo}. Delete old photos or audio clips.`
            : lang === 'ru'
              ? 'Не удалось сохранить фото на устройстве.'
              : 'Could not save the photo on this device.'
        );
      }
      added.push(photo);
    }
    if (added.length > 0 && activeSessionKeyRef.current === sessionId) {
      setSessionPhotos(await loadSessionPhotos(sessionId));
    }
  };

  const handleDeleteSessionPhoto = async (photoId: string) => {
    await db.sessionPhotos.delete(photoId);
    setSessionPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const handleLanguageChange = async (nextLang: Language) => {
    setLang(nextLang);
    await setSetting('language', nextLang);
  };

  const handleSelectHorseAndSession = async (horseId: string, sessionId: string) => {
    setActiveHorseId(horseId);
    await setSetting('activeHorseId', horseId);
    const targetSession =
      sessions.find((s) => s.id === sessionId) ??
      sessions.find((s) => s.horseId === horseId);
    const nextSessionId = targetSession?.id ?? '';
    setActiveSessionId(nextSessionId);
    await setSetting('activeSessionId', nextSessionId);
    setUndoStack([]);
    setRedoStack([]);
    lastUndoKeyRef.current = null;
    setSaveStatus('saved');
    setLastSavedAt(null);

    if (nextSessionId) {
      const clips = await db.voiceClips
        .where('sessionId')
        .equals(nextSessionId)
        .toArray();
      clips.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setVoiceClips(clips);
    } else {
      setVoiceClips([]);
    }
  };

  const persistHorseUpdate = async (updatedHorse: HorseProfile) => {
    const stamped = { ...updatedHorse, updatedAt: new Date().toISOString() };
    await db.horses.put(stamped);
    setHorses((prev) => prev.map((h) => (h.id === stamped.id ? stamped : h)));
  };

  /**
   * Write a session to IndexedDB. The UI is updated first (so it never lags a tap),
   * then the write is awaited; failures surface in the header indicator instead of
   * being silently dropped. Resolves to the stored session, or null if the write failed.
   */
  const persistSessionUpdate = async (
    updatedSession: BodyworkSession,
    autoRefreshReport = true
  ): Promise<BodyworkSession | null> => {
    const nextReport =
      autoRefreshReport && !updatedSession.reportCustomized
        ? buildReportFromSession(updatedSession, lang)
        : updatedSession.reportSections;

    const stamped: BodyworkSession = {
      ...updatedSession,
      reportSections: nextReport,
      updatedAt: new Date().toISOString(),
    };
    if (liveSessionRef.current?.id === stamped.id) {
      liveSessionRef.current = stamped;
    }
    setSessions((prev) => prev.map((s) => (s.id === stamped.id ? stamped : s)));

    const seq = ++saveSeqRef.current;
    setSaveStatus('saving');
    try {
      await db.sessions.put(stamped);
      if (seq === saveSeqRef.current) {
        setSaveStatus('saved');
        setLastSavedAt(new Date());
      }
      return stamped;
    } catch (err) {
      console.error('Autosave failed:', err);
      if (seq === saveSeqRef.current) setSaveStatus('error');
      return null;
    }
  };

  const handleRetrySave = () => {
    if (liveSessionRef.current) void persistSessionUpdate(liveSessionRef.current);
  };

  /**
   * Finish: write any note still being typed, save, then read the session back from
   * IndexedDB before telling the practitioner it is safe.
   */
  const handleFinishSession = async () => {
    flushPendingNoteRef.current?.();
    setActiveTablePopover(null);
    const session = liveSessionRef.current;
    if (!session) return;
    setFinishPhase('saving');
    const stored = await persistSessionUpdate(session);
    let verified = false;
    if (stored) {
      try {
        const readBack = await db.sessions.get(stored.id);
        verified = Boolean(readBack) && readBack!.updatedAt >= stored.updatedAt;
      } catch (err) {
        console.error('Read-back after save failed:', err);
      }
    }
    if (!verified) setSaveStatus('error');
    setFinishPhase(verified ? 'saved' : 'error');
  };

  const handleCreateNewSession = async (targetHorseId?: string) => {
    const horseId = targetHorseId ?? activeHorse?.id;
    if (!horseId) {
      setActiveTab('horses');
      return;
    }
    const existingForHorse = sessions.filter((s) => s.horseId === horseId);
    const maxNum = existingForHorse.reduce(
      (max, s) => Math.max(max, s.sessionNumber),
      0
    );
    const nowIso = new Date().toISOString();
    const emptyTable = createEmptyEvaluationTable();
    const newSession: BodyworkSession = {
      id: `session-${Date.now()}`,
      horseId,
      practitioner: activeSession?.practitioner ?? '',
      caseStudyNumber: activeSession?.caseStudyNumber ?? 'CS-01',
      sessionNumber: maxNum + 1,
      date: nowIso.slice(0, 10),
      duration: '60 min',
      generalNotes: '',
      manualVoiceNotes: '',
      evaluationTable: emptyTable,
      annotations: [],
      reportSections: {
        initialEvaluation: '',
        restrictionsIdentified: '',
        releaseSignsObserved: '',
        predominantDiagonal: '',
        sessionNotes: '',
        postSessionCareNotes: '',
      },
      reportCustomized: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    newSession.reportSections = buildReportFromSession(newSession, lang);

    await db.sessions.put(newSession);
    const nextSessions = [newSession, ...sessions];
    setSessions(nextSessions);
    await handleSelectHorseAndSession(horseId, newSession.id);
    setActiveTab('editor');
  };

  const handleCreateHorse = async (
    data: Omit<HorseProfile, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    const nowIso = new Date().toISOString();
    const horse: HorseProfile = {
      ...data,
      id: `horse-${Date.now()}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await db.horses.put(horse);
    setHorses((prev) => [horse, ...prev]);
    await handleCreateNewSession(horse.id);
  };

  const handleDeleteHorse = async (horseId: string) => {
    await db.transaction('rw', [db.horses, db.sessions, db.voiceClips, db.sessionPhotos], async () => {
      const horseSess = await db.sessions.where('horseId').equals(horseId).toArray();
      for (const s of horseSess) {
        await db.voiceClips.where('sessionId').equals(s.id).delete();
        await db.sessionPhotos.where('sessionId').equals(s.id).delete();
      }
      await db.sessions.where('horseId').equals(horseId).delete();
      await db.horses.delete(horseId);
    });
    const nextHorses = horses.filter((h) => h.id !== horseId);
    const nextSessions = sessions.filter((s) => s.horseId !== horseId);
    setHorses(nextHorses);
    setSessions(nextSessions);
    const fallbackHorse = nextHorses[0];
    const fallbackSession = nextSessions.find(
      (s) => s.horseId === fallbackHorse?.id
    );
    await handleSelectHorseAndSession(
      fallbackHorse?.id ?? '',
      fallbackSession?.id ?? ''
    );
  };

  const handleDeleteSession = async (sessionId: string) => {
    await db.transaction('rw', [db.sessions, db.voiceClips, db.sessionPhotos], async () => {
      await db.voiceClips.where('sessionId').equals(sessionId).delete();
      await db.sessionPhotos.where('sessionId').equals(sessionId).delete();
      await db.sessions.delete(sessionId);
    });
    const nextSessions = sessions.filter((s) => s.id !== sessionId);
    setSessions(nextSessions);
    const fallback =
      nextSessions.find((s) => s.horseId === activeHorse?.id) ?? nextSessions[0];
    await handleSelectHorseAndSession(
      fallback?.horseId ?? activeHorse?.id ?? '',
      fallback?.id ?? ''
    );
  };

  /**
   * Synchronize Area Table Cell update -> Session Table + Standardized Vector Markers
   */
  const handleUpdateTableCell = (
    areaId: AnatomicalAreaId,
    side: Side,
    nextObs: AreaSideObservation,
    syncDiagram: boolean,
    options?: UpdateCellOptions
  ) => {
    const session = liveSessionRef.current;
    if (!session) return;

    // Updates sharing a coalesce key (one burst of note typing) are a single undo step.
    const key = options?.coalesceKey ?? null;
    if (!key || key !== lastUndoKeyRef.current) {
      setUndoStack((prev) => [
        ...prev.slice(-24),
        {
          evaluationTable: session.evaluationTable,
          annotations: session.annotations,
        },
      ]);
    }
    lastUndoKeyRef.current = key;
    setRedoStack([]);

    const nextTable: EvaluationTableState = {
      ...session.evaluationTable,
      [areaId]: {
        ...(session.evaluationTable[areaId] ?? createEmptyAreaRow()),
        [side]: nextObs,
      },
    };

    const nextAnnotations = syncDiagram
      ? syncAnnotationsWithTable(nextTable, session.annotations)
      : session.annotations;

    void persistSessionUpdate({
      ...session,
      evaluationTable: nextTable,
      annotations: nextAnnotations,
    });
  };

  /**
   * Synchronize Diagram Annotation changes -> Undo Stack + Area Table
   */
  const handleUpdateAnnotations = (
    nextAnnotations: DiagramAnnotation[],
    syncedChange?: {
      view: 'left' | 'right';
      areaId: AnatomicalAreaId;
      reaction?: ReactionLevel | null;
      restriction?: boolean;
      released?: boolean;
    }
  ) => {
    const activeSession = liveSessionRef.current;
    if (!activeSession) return;
    lastUndoKeyRef.current = null;
    setUndoStack((prev) => [
      ...prev.slice(-24),
      {
        evaluationTable: activeSession.evaluationTable,
        annotations: activeSession.annotations,
      },
    ]);
    setRedoStack([]);

    let nextTable = activeSession.evaluationTable;
    if (syncedChange) {
      const currentCell = nextTable[syncedChange.areaId][syncedChange.view];
      nextTable = {
        ...nextTable,
        [syncedChange.areaId]: {
          ...nextTable[syncedChange.areaId],
          [syncedChange.view]: {
            ...currentCell,
            ...(syncedChange.reaction !== undefined
              ? { reaction: syncedChange.reaction }
              : {}),
            ...(syncedChange.restriction !== undefined
              ? { restriction: syncedChange.restriction }
              : {}),
            ...(syncedChange.released !== undefined
              ? { released: syncedChange.released }
              : {}),
          },
        },
      };
    }

    void persistSessionUpdate({
      ...activeSession,
      evaluationTable: nextTable,
      annotations: nextAnnotations,
    });
  };

  const handleUndo = () => {
    const activeSession = liveSessionRef.current;
    if (!activeSession || undoStack.length === 0) return;
    lastUndoKeyRef.current = null;
    const prevSnapshot = undoStack[undoStack.length - 1];
    setRedoStack((r) => [
      ...r,
      {
        evaluationTable: activeSession.evaluationTable,
        annotations: activeSession.annotations,
      },
    ]);
    setUndoStack((u) => u.slice(0, -1));
    void persistSessionUpdate({
      ...activeSession,
      evaluationTable: prevSnapshot.evaluationTable,
      annotations: prevSnapshot.annotations,
    });
  };

  const handleRedo = () => {
    const activeSession = liveSessionRef.current;
    if (!activeSession || redoStack.length === 0) return;
    lastUndoKeyRef.current = null;
    const nextSnapshot = redoStack[redoStack.length - 1];
    setUndoStack((u) => [
      ...u,
      {
        evaluationTable: activeSession.evaluationTable,
        annotations: activeSession.annotations,
      },
    ]);
    setRedoStack((r) => r.slice(0, -1));
    void persistSessionUpdate({
      ...activeSession,
      evaluationTable: nextSnapshot.evaluationTable,
      annotations: nextSnapshot.annotations,
    });
  };

  const handleSetPredominantDiagonalPreset = (
    fromAnchor: Exclude<DiagonalAnchor, 'custom'>,
    toAnchor: Exclude<DiagonalAnchor, 'custom'>
  ) => {
    const activeSession = liveSessionRef.current;
    if (!activeSession) return;
    const withoutDiag = activeSession.annotations.filter((a) => a.kind !== 'diagonal');
    const newDiag: DiagramAnnotation = {
      id: `ann-diag-${Date.now()}`,
      kind: 'diagonal',
      view: 'top',
      start: TOP_VIEW_ANCHORS[fromAnchor].point,
      end: TOP_VIEW_ANCHORS[toAnchor].point,
      fromAnchor,
      toAnchor,
      color: '#1E2421',
      label: `${TOP_VIEW_ANCHORS[fromAnchor].labelEn} → ${TOP_VIEW_ANCHORS[toAnchor].labelEn}`,
    };
    handleUpdateAnnotations([...withoutDiag, newDiag]);
  };

  const handleExportBackup = async () => {
    const allHorses = await db.horses.toArray();
    const allSessions = await db.sessions.toArray();
    const allClips = await db.voiceClips.toArray();
    const serializedClips: Omit<VoiceRecordingClip, 'audioBlob'>[] = [];

    for (const c of allClips) {
      let dataUrl = c.audioDataUrl;
      if (!dataUrl && c.audioBlob) {
        try {
          dataUrl = await blobToDataUrl(c.audioBlob);
        } catch {
          // Ignore blob conversion error
        }
      }
      const { audioBlob: _omitted, ...rest } = c;
      serializedClips.push({ ...rest, audioDataUrl: dataUrl });
    }

    const allPhotos = await db.sessionPhotos.toArray();
    const serializedPhotos: SerializedSessionPhoto[] = [];
    for (const p of allPhotos) {
      let dataUrl = p.imageDataUrl;
      if (!dataUrl && p.imageBlob) {
        try {
          dataUrl = await blobToDataUrl(p.imageBlob);
        } catch {
          // Skip unreadable photo blobs rather than failing the whole backup
        }
      }
      if (!dataUrl) continue;
      const { imageBlob: _omittedImage, ...rest } = p;
      serializedPhotos.push({ ...rest, imageDataUrl: dataUrl });
    }

    const nowIso = new Date().toISOString();
    const json = serializeBackup(
      {
        horses: allHorses,
        sessions: allSessions,
        voiceClips: serializedClips,
        sessionPhotos: serializedPhotos,
        language: lang,
      },
      nowIso
    );
    downloadBackupJson(json, backupFileName(nowIso));
  };

  const handleImportBackupFile = async (
    file: File
  ): Promise<{ ok: boolean; message: string }> => {
    try {
      const raw = await readFileAsText(file);
      const parsed = parseBackup(raw);
      if (!parsed.ok) {
        return {
          ok: false,
          message: `Backup validation failed (${parsed.reason})${
            parsed.detail ? `: ${parsed.detail}` : ''
          }`,
        };
      }

      const {
        horses: inHorses,
        sessions: inSessions,
        voiceClips: inClips,
        sessionPhotos: inPhotos = [],
        language,
      } = parsed.backup.data;

      const hydratedPhotos: SessionPhoto[] = inPhotos.map((p) => {
        try {
          const blob = dataUrlToBlob(p.imageDataUrl ?? '');
          const { imageDataUrl: _omitted, ...rest } = p;
          return { ...rest, imageBlob: blob, sizeBytes: blob.size };
        } catch {
          return p as SessionPhoto;
        }
      });

      const hydratedClips: VoiceRecordingClip[] = inClips.map((c) => {
        if (c.audioDataUrl) {
          try {
            const blob = dataUrlToBlob(c.audioDataUrl);
            const { audioDataUrl: _omitted, ...rest } = c;
            return { ...rest, audioBlob: blob };
          } catch {
            return c as VoiceRecordingClip;
          }
        }
        return c as VoiceRecordingClip;
      });

      await db.transaction(
        'rw',
        db.horses,
        db.sessions,
        db.voiceClips,
        db.sessionPhotos,
        db.settings,
        async () => {
          await db.horses.clear();
          await db.sessions.clear();
          await db.voiceClips.clear();
          await db.sessionPhotos.clear();
          await db.horses.bulkPut(inHorses);
          await db.sessions.bulkPut(inSessions);
          await db.voiceClips.bulkPut(hydratedClips);
          await db.sessionPhotos.bulkPut(hydratedPhotos);
          await db.settings.put({ key: 'language', value: language });
        }
      );

      setHorses(inHorses);
      setSessions(inSessions);
      setLang(language);
      const firstH = inHorses[0]?.id ?? '';
      const firstS =
        inSessions.find((s) => s.horseId === firstH)?.id ?? inSessions[0]?.id ?? '';
      await handleSelectHorseAndSession(firstH, firstS);

      return {
        ok: true,
        message: `Restored ${inHorses.length} horse(s), ${inSessions.length} session(s), and ${inClips.length} voice clip(s).`,
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Failed to read backup file.',
      };
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] text-sm text-slate-600">
        Loading local case notebook...
      </div>
    );
  }

  const ru = lang === 'ru';
  const hasSession = Boolean(activeHorse && activeSession);
  /** Mobile Evaluation runs in a fixed, non-scrolling shell: only the zone list scrolls. */
  const isMobileShell = !isDesktop && activeTab === 'editor' && hasSession;

  const savedTime = (
    lastSavedAt ?? (activeSession ? new Date(activeSession.updatedAt) : null)
  )?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  const saveIndicator = (
    <span
      data-testid="save-indicator"
      data-status={saveStatus}
      role="status"
      className={`inline-flex items-center gap-1 text-[10px] lg:text-[11px] font-semibold font-tabular whitespace-nowrap ${
        saveStatus === 'error' ? 'text-red-700' : 'text-slate-500'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          saveStatus === 'error'
            ? 'bg-red-600'
            : saveStatus === 'saving'
              ? 'bg-amber-500'
              : 'bg-[#15803D]'
        }`}
      />
      <span>
        {saveStatus === 'error'
          ? ru
            ? 'Не сохранено'
            : 'Not saved'
          : `${ru ? 'Сохранено' : 'Saved'}${savedTime ? ` ${savedTime}` : ''}`}
      </span>
    </span>
  );

  const retrySaveButton = saveStatus === 'error' && (
    <button
      type="button"
      data-testid="save-retry-btn"
      onClick={handleRetrySave}
      className="min-h-[36px] inline-flex items-center gap-1 px-2.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold cursor-pointer shrink-0"
    >
      <RotateCw className="w-3.5 h-3.5" />
      <span>{ru ? 'Повторить' : 'Retry'}</span>
    </button>
  );

  const sessionSelects = activeHorse && activeSession && (
    <>
      <select
        id="horse-switcher"
        aria-label={t.horseLabel}
        value={activeHorse.id}
        onChange={(e) => {
          const hId = e.target.value;
          const firstSess = sessions
            .filter((s) => s.horseId === hId)
            .sort((a, b) => b.sessionNumber - a.sessionNumber)[0];
          void handleSelectHorseAndSession(hId, firstSess?.id ?? '');
        }}
        className="w-full lg:w-auto lg:max-w-[200px] min-h-[44px] lg:min-h-0 truncate rounded-lg lg:rounded-md border border-slate-300 bg-white px-3 lg:px-2 py-1 text-sm lg:text-xs font-semibold text-[#1E2421]"
      >
        {horses.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name} {h.isDemo ? '(Demo)' : ''}
          </option>
        ))}
      </select>

      <select
        id="session-switcher"
        aria-label={t.sessionNum}
        value={activeSession.id}
        onChange={(e) => void handleSelectHorseAndSession(activeHorse.id, e.target.value)}
        className="w-full lg:w-auto lg:max-w-[180px] min-h-[44px] lg:min-h-0 truncate rounded-lg lg:rounded-md border border-slate-300 bg-white px-3 lg:px-2 py-1 text-sm lg:text-xs font-semibold font-tabular text-[#1E2421]"
      >
        {sessions
          .filter((s) => s.horseId === activeHorse.id)
          .sort((a, b) => b.sessionNumber - a.sessionNumber)
          .map((s) => (
            <option key={s.id} value={s.id}>
              #{s.sessionNumber} · {s.date}
            </option>
          ))}
      </select>
    </>
  );

  const languageSwitch = (
    <div
      className="inline-flex rounded-lg bg-white p-0.5 border border-slate-300"
      role="group"
      aria-label="Language Switcher"
    >
      {(['en', 'ru'] as Language[]).map((code) => (
        <button
          key={code}
          type="button"
          data-testid={`lang-${code}`}
          aria-pressed={lang === code}
          onClick={() => void handleLanguageChange(code)}
          className={`min-h-[36px] lg:min-h-0 px-3 lg:px-2 py-1 rounded text-[11px] font-semibold uppercase transition-colors cursor-pointer ${
            lang === code ? 'bg-[#2B4C3F] text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );

  /** Rewrites the unified session notes from the latest session state (transcripts, pattern hints). */
  const updateSessionNotes = (next: (currentNotes: string) => string) => {
    const base = liveSessionRef.current ?? activeSession;
    if (!base) return;
    const current = getUnifiedSessionNotes(base);
    const nextNotes = next(current);
    if (nextNotes === current) return;
    void persistSessionUpdate({ ...base, generalNotes: nextNotes, manualVoiceNotes: '' });
  };

  const handleAddPatternToNotes = (match: PatternMatch) =>
    updateSessionNotes((current) => appendPatternToNotes(current, match, lang));

  const insightsPill = (extraClass: string) =>
    insightMatches.length > 0 ? (
      <button
        type="button"
        data-testid="insights-pill"
        onClick={() => setIsInsightsOpen(true)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 font-semibold cursor-pointer ${extraClass}`}
      >
        <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          {ru ? 'Связки зон' : 'Zone patterns'}: {insightMatches.length}
        </span>
      </button>
    ) : null;

  const finishButton = (extraClass: string) => (
    <button
      type="button"
      data-testid="finish-session-btn"
      onClick={() => void handleFinishSession()}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2B4C3F] hover:bg-[#223D32] text-white font-bold shadow-xs cursor-pointer ${extraClass}`}
    >
      <Check className="w-4 h-4 shrink-0 max-[379px]:hidden" />
      <span>{ru ? 'Завершить' : 'Finish'}</span>
    </button>
  );

  const activeDiagonal = activeSession?.annotations.find(
    (a): a is Extract<DiagramAnnotation, { kind: 'diagonal' }> => a.kind === 'diagonal'
  );

  const diagonalPresetButtons = (buttonClass: string) =>
    DIAGONAL_PRESETS.map((preset) => {
      const isActive =
        activeDiagonal?.fromAnchor === preset.from && activeDiagonal?.toAnchor === preset.to;
      return (
        <button
          key={preset.id}
          type="button"
          data-testid={`top-preset-${preset.id}`}
          aria-pressed={isActive}
          onClick={() => handleSetPredominantDiagonalPreset(preset.from, preset.to)}
          className={`rounded-xl border font-semibold cursor-pointer transition-colors ${buttonClass} ${
            isActive
              ? 'bg-[#2B4C3F] border-[#2B4C3F] text-white'
              : 'border-slate-300 bg-white hover:bg-[#2B4C3F]/10 text-[#1E2421]'
          }`}
        >
          {preset.label}
        </button>
      );
    });

  const sideDiagram = (view: 'left' | 'right', svgClassName?: string) =>
    activeSession && (
      <HorseSilhouetteSvg
        view={view}
        evaluationTable={activeSession.evaluationTable}
        annotations={activeSession.annotations}
        onChangeAnnotations={handleUpdateAnnotations}
        selectedAreaTarget={activeTablePopover}
        hoveredAreaTarget={hoveredAreaTarget}
        onHoverArea={setHoveredAreaTarget}
        onAreaLandmarkClick={(areaId, side) => setActiveTablePopover({ areaId, side })}
        activeRegionFilter={activeRegionFilter}
        bodyPartFilter={bodyPartFilter}
        onChangeBodyPartFilter={setBodyPartFilter}
        showPastelZones={true}
        showLandmarkNumbers={true}
        svgClassName={svgClassName}
        lang={lang}
      />
    );

  const topDiagram = (svgClassName?: string) =>
    activeSession && (
      <HorseSilhouetteSvg
        view="top"
        evaluationTable={activeSession.evaluationTable}
        annotations={activeSession.annotations}
        onChangeAnnotations={handleUpdateAnnotations}
        onSelectDiagonalAnchors={handleSetPredominantDiagonalPreset}
        activeRegionFilter={activeRegionFilter}
        showPastelZones={true}
        svgClassName={svgClassName}
        lang={lang}
      />
    );

  const MOBILE_SVG_CLASS =
    'block w-full h-auto max-h-[36dvh] rounded-xl border border-slate-300/90 bg-[#FAF9F6] touch-manipulation';

  return (
    <div
      data-testid="app-root"
      className={`flex flex-col bg-[#FAF9F6] text-[#1E2421] ${
        isMobileShell ? 'h-dvh overflow-hidden' : 'min-h-screen'
      }`}
    >
      {/* HEADER: one row on mobile — tabs, horse/session chip with autosave state, mic, overflow */}
      <header className="no-print shrink-0 sticky top-0 z-30 bg-[#FAF9F6]/95 backdrop-blur-xs border-b border-slate-300">
        <div className="relative max-w-[1400px] mx-auto flex items-center gap-1.5 lg:gap-2 px-2 lg:px-6 py-1.5 lg:py-2">
          <a
            href="#editor"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('editor');
            }}
            className="hidden lg:block text-base font-editorial font-bold tracking-tight text-[#2B4C3F] truncate shrink-0 mr-auto"
          >
            {t.appName}
          </a>

          <nav
            className="flex items-center bg-[#F3F1EC] p-0.5 rounded-lg border border-slate-300 text-xs font-semibold shrink-0"
            aria-label="Main Navigation"
          >
            {(
              [
                { id: 'editor' as const, label: ru ? 'Оценка' : 'Evaluation' },
                { id: 'horses' as const, label: ru ? 'Лошади' : 'Horses' },
              ]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-testid={`nav-tab-${tab.id}`}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[36px] lg:min-h-0 px-2.5 max-[359px]:px-1.5 lg:px-4 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[#2B4C3F] text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Mobile: Horse · #N chip (opens the pickers) with the autosave state underneath */}
          {!isDesktop && activeHorse && activeSession && (
            <button
              type="button"
              data-testid="session-chip-btn"
              aria-haspopup="dialog"
              onClick={() => setIsSessionPickerOpen(true)}
              className="flex-1 min-w-0 min-h-[40px] px-2 rounded-lg border border-slate-300 bg-white text-left cursor-pointer overflow-hidden"
            >
              <span className="flex items-center gap-1 text-xs font-bold text-[#1E2421] leading-tight">
                <span className="truncate">{activeHorse.name}</span>
                <span className="font-tabular shrink-0">· #{activeSession.sessionNumber}</span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-500" />
              </span>
              <span className="block leading-tight overflow-hidden">{saveIndicator}</span>
            </button>
          )}
          {!isDesktop && !hasSession && <span className="flex-1" />}
          {!isDesktop && retrySaveButton}

          {activeHorse && activeSession && (
            <button
              type="button"
              data-testid="header-audio-drawer-btn"
              onClick={() => {
                if (activeTab !== 'editor') {
                  setActiveTab('editor');
                }
                setIsPhotoDrawerOpen(false);
                setIsAudioDrawerOpen((v) => !v);
              }}
              title={ru ? `Аудиозаписи (${voiceClips.length})` : `Audio Clips (${voiceClips.length})`}
              aria-label={
                ru ? `Аудиозаписи (${voiceClips.length})` : `Audio Clips (${voiceClips.length})`
              }
              className={`relative min-h-[40px] lg:min-h-[34px] min-w-[40px] max-[359px]:min-w-[34px] px-2 max-[359px]:px-1 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0 ${
                isAudioDrawerOpen
                  ? 'bg-[#2B4C3F] text-white border-[#2B4C3F]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Mic className="w-4 h-4 text-[#B91C1C]" />
              {voiceClips.length > 0 && (
                <span
                  data-testid="header-audio-clip-badge"
                  className="px-1.5 py-0.5 rounded-full bg-[#2B4C3F] text-white font-tabular text-[10px] font-bold leading-none"
                >
                  {voiceClips.length}
                </span>
              )}
            </button>
          )}

          {/* Before / After Photos (📷 with photo count badge if > 0) */}
          {activeHorse && activeSession && (
            <button
              type="button"
              data-testid="header-photo-drawer-btn"
              onClick={() => {
                setIsAudioDrawerOpen(false);
                setIsPhotoDrawerOpen(true);
              }}
              title={ru ? 'Фото до / после' : 'Before / After Photos'}
              aria-label={
                ru
                  ? `Фото до / после (${sessionPhotos.length})`
                  : `Before / After Photos (${sessionPhotos.length})`
              }
              className={`relative min-h-[40px] lg:min-h-[34px] min-w-[40px] max-[359px]:min-w-[34px] px-2 max-[359px]:px-1 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0 ${
                isPhotoDrawerOpen
                  ? 'bg-[#2B4C3F] text-white border-[#2B4C3F]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Camera className="w-4 h-4" />
              {sessionPhotos.length > 0 && (
                <span
                  data-testid="header-photo-count-badge"
                  className="px-1.5 py-0.5 rounded-full bg-[#2B4C3F] text-white font-tabular text-[10px] font-bold leading-none"
                >
                  {sessionPhotos.length}
                </span>
              )}
            </button>
          )}

          {isDesktop ? (
            <>
              <PWAInstallAction lang={lang} />
              {languageSwitch}
            </>
          ) : (
            <>
              <button
                type="button"
                data-testid="header-more-btn"
                aria-label={ru ? 'Ещё' : 'More'}
                aria-expanded={isHeaderMenuOpen}
                onClick={() => setIsHeaderMenuOpen((v) => !v)}
                className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-300 bg-white inline-flex items-center justify-center text-slate-700 cursor-pointer shrink-0"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Desktop sub-row: horse/session selectors, autosave state, undo/redo, Finish */}
        {isDesktop && activeHorse && activeSession && (
          <div className="border-t border-slate-200/90 bg-[#F3F1EC] px-6 py-1.5">
            <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {sessionSelects}
                <span className="ml-2">{saveIndicator}</span>
                {retrySaveButton}
              </div>

              {activeTab === 'editor' && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={undoStack.length === 0}
                    onClick={handleUndo}
                    aria-label={t.undo}
                    title={t.undo}
                    className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={redoStack.length === 0}
                    onClick={handleRedo}
                    aria-label={t.redo}
                    title={t.redo}
                    className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                  {insightsPill('min-h-[32px] px-3 text-xs ml-1')}
                  {finishButton('min-h-[32px] px-4 text-xs ml-1')}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* SLIDE-UP BEFORE / AFTER PHOTOS DRAWER (available on both tabs) */}
      {isPhotoDrawerOpen && activeSession && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4 no-print"
          onClick={() => setIsPhotoDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          data-testid="photo-drawer"
        >
          <div
            className="w-full max-w-xl max-h-[86vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#FAF9F6] border-t sm:border border-slate-300 px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-1.5 rounded-full bg-slate-300 mx-auto sm:hidden" />
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1E2421]">
                  {lang === 'ru' ? 'Фото до / после' : 'Before / After Photos'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {lang === 'ru'
                    ? `Сессия №${activeSession.sessionNumber} · сжимаются на устройстве и попадают в PDF`
                    : `Session #${activeSession.sessionNumber} · compressed on-device, included in the PDF`}
                </p>
              </div>
              <button
                type="button"
                data-testid="close-photo-drawer-btn"
                onClick={() => setIsPhotoDrawerOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-200/70 hover:bg-slate-200 text-slate-700 cursor-pointer shrink-0"
                aria-label={lang === 'ru' ? 'Закрыть' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SessionPhotosPanel
              photos={sessionPhotos}
              lang={lang}
              onAddPhotos={handleAddSessionPhotos}
              onDeletePhoto={handleDeleteSessionPhoto}
            />
          </div>
        </div>
      )}

      {/* MAIN CONTENT STAGE */}
      <main
        className={
          isMobileShell
            ? 'flex-1 min-h-0 w-full flex flex-col'
            : 'flex-1 w-full max-w-[1400px] mx-auto px-3 md:px-8 py-4 md:py-6 pb-24 lg:pb-16'
        }
      >
        {!activeHorse || !activeSession ? (
          <HorsesAndBackupView
            horses={horses}
            sessions={sessions}
            activeHorseId={activeHorseId}
            activeSessionId={activeSessionId}
            lang={lang}
            onSelectHorseAndSession={(hId, sId) => {
              void handleSelectHorseAndSession(hId, sId);
            }}
            onEditSessionOnMap={(hId, sId) => {
              void handleSelectHorseAndSession(hId, sId);
              setActiveTab('editor');
            }}
            onCreateHorse={handleCreateHorse}
            onUpdateHorse={persistHorseUpdate}
            onDeleteHorse={handleDeleteHorse}
            onCreateSessionForHorse={handleCreateNewSession}
            onDeleteSession={handleDeleteSession}
            onDeleteDemoCase={async () => {
              await deleteDemonstrationCase();
              setHorses([]);
              setSessions([]);
            }}
            onRestoreDemoCase={async () => {
              const restored = await restoreDemonstrationCase();
              const allH = await db.horses.toArray();
              const allS = await db.sessions.toArray();
              setHorses(allH);
              setSessions(allS);
              await handleSelectHorseAndSession(
                restored.horse.id,
                restored.session.id
              );
            }}
            onExportBackup={handleExportBackup}
            onImportBackupFile={handleImportBackupFile}
            installedModels={installedModels}
            onRefreshModels={async () => {
              const models = await db.whisperModels.toArray();
              setInstalledModels(models);
            }}
          />
        ) : activeTab === 'editor' ? (
          <div
            data-testid="evaluation-workspace"
            className={isMobileShell ? 'flex-1 min-h-0 flex flex-col' : 'space-y-6'}
          >
            {/* Interrupted-recording banner (only when needed) + audio clips drawer */}
            <div className={isMobileShell ? 'shrink-0 px-2 empty:hidden' : 'contents'}>
            <EvaluationAudioNotesPanel
              session={activeSession}
              clips={voiceClips}
              lang={lang}
              installedModels={installedModels}
              isOpen={isAudioDrawerOpen}
              onClose={() => setIsAudioDrawerOpen(false)}
              onSaveClip={async (clip) => {
                await db.voiceClips.put(clip);
                const updated = await db.voiceClips
                  .where('sessionId')
                  .equals(activeSession.id)
                  .toArray();
                updated.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
                setVoiceClips(updated);
              }}
              onDeleteClip={async (clipId) => {
                await db.voiceClips.delete(clipId);
                setVoiceClips((prev) => prev.filter((c) => c.id !== clipId));
              }}
              onAppendTranscriptToSessionNotes={(transcriptText) =>
                updateSessionNotes((current) =>
                  current ? `${current}\n${transcriptText}` : transcriptText
                )
              }
              onNavigateToHorses={() => setActiveTab('horses')}
            />
            </div>

            {isDesktop ? (
              /* DESKTOP (>= 1024px): Left Profile | Filter + Area Table | Right Profile, Top View below */
              <div data-testid="desktop-three-column-evaluation" className="space-y-6">
                <div className="grid grid-cols-12 gap-5 items-start">
                  <div className="col-span-4 rounded-xl border border-slate-300 bg-white p-2.5 shadow-2xs sticky top-24">
                    {sideDiagram('left')}
                  </div>

                  <div className="col-span-4 space-y-2">
                    <BodyPartFilterBar
                      value={bodyPartFilter}
                      onChange={setBodyPartFilter}
                      lang={lang}
                    />
                    <CentralEvaluationTable
                      tableState={activeSession.evaluationTable}
                      onUpdateCell={handleUpdateTableCell}
                      lang={lang}
                      activePopover={activeTablePopover}
                      onChangeActivePopover={setActiveTablePopover}
                      hoveredAreaTarget={hoveredAreaTarget}
                      onHoverArea={setHoveredAreaTarget}
                      activeRegionFilter={activeRegionFilter}
                      bodyPartFilter={bodyPartFilter}
                      flushPendingNoteRef={flushPendingNoteRef}
                    />
                  </div>

                  <div className="col-span-4 rounded-xl border border-slate-300 bg-white p-2.5 shadow-2xs sticky top-24">
                    {sideDiagram('right')}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-300 bg-white p-5 shadow-2xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-[#2B4C3F]">{t.topViewTitle}</h2>
                      <p className="text-xs text-slate-600">{t.step3Desc}</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {diagonalPresetButtons('px-3 py-1.5')}
                    </div>
                  </div>
                  <div className="max-w-3xl mx-auto">{topDiagram()}</div>
                </div>
              </div>
            ) : (
              /* MOBILE (< 1024px): pinned diagram, filter on the seam, scrolling list, thumb bar */
              <div
                data-testid="mobile-full-horse-evaluation"
                className="flex-1 min-h-0 flex flex-col"
              >
                <div data-testid="mobile-above-fold-diagram" className="shrink-0 px-2 pt-2">
                  {mobileActiveView === 'top'
                    ? topDiagram(MOBILE_SVG_CLASS)
                    : sideDiagram(mobileActiveView, MOBILE_SVG_CLASS)}
                </div>

                {mobileActiveView === 'top' ? (
                  <div
                    data-testid="mobile-top-view-presets"
                    className="flex-1 min-h-0 overflow-y-auto px-2 py-3 space-y-3"
                  >
                    <div>
                      <h2 className="text-sm font-bold text-[#2B4C3F]">{t.topViewTitle}</h2>
                      <p className="text-xs text-slate-600 mt-0.5">{t.step3Desc}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {diagonalPresetButtons('min-h-[56px] px-2 py-2')}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="shrink-0 px-2 py-1.5">
                      <BodyPartFilterBar
                        value={bodyPartFilter}
                        onChange={setBodyPartFilter}
                        lang={lang}
                      />
                    </div>
                    <CentralEvaluationTable
                      tableState={activeSession.evaluationTable}
                      onUpdateCell={handleUpdateTableCell}
                      lang={lang}
                      activePopover={activeTablePopover}
                      onChangeActivePopover={setActiveTablePopover}
                      hoveredAreaTarget={hoveredAreaTarget}
                      onHoverArea={setHoveredAreaTarget}
                      activeRegionFilter={activeRegionFilter}
                      bodyPartFilter={bodyPartFilter}
                      mobileSingleSide={mobileActiveView}
                      rootClassName="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-2"
                      flushPendingNoteRef={flushPendingNoteRef}
                    />
                  </>
                )}

                {insightMatches.length > 0 && (
                  <div className="no-print shrink-0 px-2 pt-1.5 bg-[#FAF9F6]">
                    {insightsPill('w-full min-h-[40px] px-3 text-xs')}
                  </div>
                )}

                {/* Bottom thumb bar: view switcher, Undo, Finish */}
                <div
                  data-testid="mobile-thumb-bar"
                  className="no-print shrink-0 border-t border-slate-300 bg-[#FAF9F6] px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center gap-2"
                >
                  <div
                    className="inline-flex rounded-xl bg-white p-0.5 border border-slate-300 shrink-0"
                    role="group"
                    aria-label={ru ? 'Вид' : 'View'}
                  >
                    {(
                      [
                        { id: 'left' as const, label: t.tableLeft },
                        { id: 'right' as const, label: t.tableRight },
                        { id: 'top' as const, label: ru ? 'Сверху' : 'Top' },
                      ]
                    ).map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        data-testid={`mobile-view-${v.id}`}
                        aria-pressed={mobileActiveView === v.id}
                        onClick={() => setMobileActiveView(v.id)}
                        className={`min-h-[44px] px-2 min-w-[44px] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          mobileActiveView === v.id
                            ? 'bg-[#2B4C3F] text-white shadow-2xs'
                            : 'text-slate-700'
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    data-testid="mobile-undo-btn"
                    disabled={undoStack.length === 0}
                    onClick={handleUndo}
                    aria-label={t.undo}
                    className="min-h-[48px] min-w-[48px] rounded-xl border border-slate-300 bg-white inline-flex items-center justify-center disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    <Undo2 className="w-5 h-5" />
                  </button>

                  {finishButton('flex-1 min-w-0 min-h-[48px] px-2 text-sm whitespace-nowrap')}
                </div>
              </div>
            )}
          </div>
        ) : (
          <HorsesAndBackupView
            horses={horses}
            sessions={sessions}
            activeHorseId={activeHorse.id}
            activeSessionId={activeSession.id}
            lang={lang}
            focusReportSignal={reportFocusSignal}
            onSelectHorseAndSession={(hId, sId) => {
              void handleSelectHorseAndSession(hId, sId);
            }}
            onEditSessionOnMap={(hId, sId) => {
              void handleSelectHorseAndSession(hId, sId);
              setActiveTab('editor');
            }}
            sessionPhotos={sessionPhotos}
            sessionPhotosSessionId={activeSessionKey}
            onAddSessionPhotos={handleAddSessionPhotos}
            onDeleteSessionPhoto={handleDeleteSessionPhoto}
            onUpdateReportSections={(nextSections: ReportSections, customized: boolean) =>
              void persistSessionUpdate(
                {
                  ...activeSession,
                  reportSections: nextSections,
                  reportCustomized: customized,
                },
                false
              )
            }
            onCreateHorse={handleCreateHorse}
            onUpdateHorse={persistHorseUpdate}
            onDeleteHorse={handleDeleteHorse}
            onCreateSessionForHorse={handleCreateNewSession}
            onDeleteSession={handleDeleteSession}
            onDeleteDemoCase={async () => {
              await deleteDemonstrationCase();
              const remH = await db.horses.toArray();
              const remS = await db.sessions.toArray();
              setHorses(remH);
              setSessions(remS);
              await handleSelectHorseAndSession(remH[0]?.id ?? '', remS[0]?.id ?? '');
            }}
            onRestoreDemoCase={async () => {
              const restored = await restoreDemonstrationCase();
              const allH = await db.horses.toArray();
              const allS = await db.sessions.toArray();
              setHorses(allH);
              setSessions(allS);
              await handleSelectHorseAndSession(
                restored.horse.id,
                restored.session.id
              );
            }}
            onExportBackup={handleExportBackup}
            onImportBackupFile={handleImportBackupFile}
            installedModels={installedModels}
            onRefreshModels={async () => {
              const models = await db.whisperModels.toArray();
              setInstalledModels(models);
            }}
          />
        )}
      </main>

      {/* Mobile overflow menu. Rendered outside the header: its backdrop blur would
          otherwise trap these fixed layers inside the header box. */}
      {isHeaderMenuOpen && !isDesktop && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsHeaderMenuOpen(false)}
                  />
                  <div
                    data-testid="header-more-menu"
                    className="fixed right-2 top-[3.75rem] z-40 w-56 rounded-xl border border-slate-300 bg-white shadow-lg p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                      <span>{ru ? 'Язык' : 'Language'}</span>
                      {languageSwitch}
                    </div>
                    {activeTab === 'editor' && hasSession && (
                      <button
                        type="button"
                        data-testid="header-redo-btn"
                        disabled={redoStack.length === 0}
                        onClick={handleRedo}
                        className="w-full min-h-[44px] px-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 text-xs font-semibold text-[#1E2421] disabled:opacity-40 cursor-pointer"
                      >
                        <Redo2 className="w-4 h-4" />
                        <span>{t.redo}</span>
                      </button>
                    )}
                    <PWAInstallAction lang={lang} />
                  </div>
                </>
              )}

      {/* Mobile horse / session picker */}
      {isSessionPickerOpen && !isDesktop && activeHorse && activeSession && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 no-print"
          role="dialog"
          aria-modal="true"
          aria-label={ru ? 'Лошадь и сессия' : 'Horse and session'}
          data-testid="session-picker-sheet"
          onClick={() => setIsSessionPickerOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl bg-[#FAF9F6] border-t border-slate-300 shadow-2xl px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1E2421]">
                {ru ? 'Лошадь и сессия' : 'Horse and session'}
              </h3>
              <button
                type="button"
                aria-label={ru ? 'Закрыть' : 'Close'}
                onClick={() => setIsSessionPickerOpen(false)}
                className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-200/60 inline-flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="block text-xs font-semibold text-slate-600" htmlFor="horse-switcher">
              {t.horseLabel}
            </label>
            {sessionSelects}
            <button
              type="button"
              data-testid="session-picker-done-btn"
              onClick={() => setIsSessionPickerOpen(false)}
              className="w-full min-h-[48px] rounded-xl bg-[#2B4C3F] text-white text-sm font-bold cursor-pointer"
            >
              {t.saveClose}
            </button>
          </div>
        </div>
      )}

      {isInsightsOpen && activeSession && insightMatches.length > 0 && (
        <ClinicalInsightsSheet
          matches={insightMatches}
          lang={lang}
          sessionNotes={getUnifiedSessionNotes(activeSession)}
          onAddToNotes={handleAddPatternToNotes}
          onClose={() => setIsInsightsOpen(false)}
        />
      )}

      {finishPhase && activeHorse && activeSession && (
        <SessionFinishSheet
          phase={finishPhase}
          horse={activeHorse}
          session={activeSession}
          lang={lang}
          photos={sessionPhotos}
          onRetry={() => void handleFinishSession()}
          onClose={() => setFinishPhase(null)}
          onOpenReport={() => {
            setFinishPhase(null);
            setActiveTab('horses');
            setReportFocusSignal((n) => n + 1);
          }}
        />
      )}

      <OfflineConnectivityBanner lang={lang} raised={isMobileShell} />
    </div>
  );
}
