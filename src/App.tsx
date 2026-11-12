/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  AnatomicalAreaId,
  AnatomicalRegionId,
  AnnotationColor,
  AreaSideObservation,
  BodyworkSession,
  DiagramAnnotation,
  DiagonalAnchor,
  EvaluationTableState,
  HorseProfile,
  InstalledWhisperModel,
  Language,
  ProposedCaseSuggestion,
  ReactionLevel,
  ReportSections,
  Side,
  VoiceRecordingClip,
} from './types';
import {
  db,
  deleteDemonstrationCase,
  ensureInitialSeed,
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
} from './db/backup';
import {
  ANATOMICAL_AREAS,
  ANATOMICAL_REGIONS,
  createEmptyEvaluationTable,
  syncAnnotationsWithTable,
  TOP_VIEW_ANCHORS,
} from './data/anatomicalAreas';
import { TRANSLATIONS } from './data/translations';
import { buildReportFromSession } from './utils/reportGenerator';
import { DrawingTool, HorseSilhouetteSvg } from './components/HorseSilhouetteSvg';
import { CentralEvaluationTable } from './components/CentralEvaluationTable';
import { EvaluationAudioNotesPanel } from './components/EvaluationAudioNotesPanel';
import { SessionReportAndPdfView } from './components/SessionReportAndPdfView';
import { HorsesAndBackupView } from './components/HorsesAndBackupView';
import { OfflineConnectivityBanner, PWAInstallAction } from './pwa/PWAInstallBanner';
import {
  Eye,
  Hash,
  Layers,
  Redo2,
  Trash2,
  Undo2,
} from 'lucide-react';

type ActiveTab = 'editor' | 'horses' | 'report';

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
  const [activeTool] = useState<DrawingTool>('select');
  const [activeColor] = useState<AnnotationColor>('#1E3A8A');
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
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
  const [activeRegionFilter, setActiveRegionFilter] = useState<
    AnatomicalRegionId | 'all'
  >('all');
  const [showPastelZones, setShowPastelZones] = useState<boolean>(true);
  const [showLandmarkNumbers, setShowLandmarkNumbers] = useState<boolean>(true);

  // Mobile responsive sub-view switcher for evaluation workspace
  const [mobileEvalPane, setMobileEvalPane] = useState<'all' | 'left' | 'table' | 'right'>('all');

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

  const t = TRANSLATIONS[lang];

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
    setSelectedAnnotationId(null);

    if (nextSessionId) {
      const clips = await db.voiceClips
        .where('sessionId')
        .equals(nextSessionId)
        .toArray();
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

  const persistSessionUpdate = async (
    updatedSession: BodyworkSession,
    autoRefreshReport = true
  ) => {
    const nextReport =
      autoRefreshReport && !updatedSession.reportCustomized
        ? buildReportFromSession(updatedSession, lang)
        : updatedSession.reportSections;

    const stamped: BodyworkSession = {
      ...updatedSession,
      reportSections: nextReport,
      updatedAt: new Date().toISOString(),
    };
    await db.sessions.put(stamped);
    setSessions((prev) => prev.map((s) => (s.id === stamped.id ? stamped : s)));
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
    await db.transaction('rw', db.horses, db.sessions, db.voiceClips, async () => {
      const horseSess = await db.sessions.where('horseId').equals(horseId).toArray();
      for (const s of horseSess) {
        await db.voiceClips.where('sessionId').equals(s.id).delete();
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
    await db.transaction('rw', db.sessions, db.voiceClips, async () => {
      await db.voiceClips.where('sessionId').equals(sessionId).delete();
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
   * Synchronize 19-Area Table Cell update -> Session Table + Standardized Vector Markers
   */
  const handleUpdateTableCell = (
    areaId: AnatomicalAreaId,
    side: Side,
    nextObs: AreaSideObservation,
    syncDiagram: boolean
  ) => {
    if (!activeSession) return;

    setUndoStack((prev) => [
      ...prev.slice(-24),
      {
        evaluationTable: activeSession.evaluationTable,
        annotations: activeSession.annotations,
      },
    ]);
    setRedoStack([]);

    const nextTable: EvaluationTableState = {
      ...activeSession.evaluationTable,
      [areaId]: {
        ...activeSession.evaluationTable[areaId],
        [side]: nextObs,
      },
    };

    const nextAnnotations = syncDiagram
      ? syncAnnotationsWithTable(nextTable, activeSession.annotations)
      : activeSession.annotations;

    void persistSessionUpdate({
      ...activeSession,
      evaluationTable: nextTable,
      annotations: nextAnnotations,
    });
  };

  /**
   * Clear all observations and markers on Left or Right side
   */
  const handleClearSideView = (side: Side) => {
    if (!activeSession) return;
    setUndoStack((prev) => [
      ...prev.slice(-24),
      {
        evaluationTable: activeSession.evaluationTable,
        annotations: activeSession.annotations,
      },
    ]);
    setRedoStack([]);

    const nextTable: EvaluationTableState = { ...activeSession.evaluationTable };
    for (const area of ANATOMICAL_AREAS) {
      nextTable[area.id] = {
        ...nextTable[area.id],
        [side]: {
          reaction: null,
          restriction: false,
          released: false,
          releaseSigns: [],
          note: '',
        },
      };
    }

    const filteredAnns = activeSession.annotations.filter((a) => a.view !== side);
    const nextAnnotations = syncAnnotationsWithTable(nextTable, filteredAnns);

    if (activeTablePopover?.side === side) {
      setActiveTablePopover(null);
    }

    void persistSessionUpdate({
      ...activeSession,
      evaluationTable: nextTable,
      annotations: nextAnnotations,
    });
  };

  /**
   * Synchronize Diagram Annotation changes -> Undo Stack + 19-Area Table
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
    if (!activeSession) return;
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
    if (!activeSession || undoStack.length === 0) return;
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
    if (!activeSession || redoStack.length === 0) return;
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

  /**
   * Apply a confirmed Assisted Case Completion suggestion to the session
   */
  const handleApplySuggestion = (sug: ProposedCaseSuggestion) => {
    if (!activeSession) return;

    if (sug.type === 'area_observation' && sug.areaId) {
      setUndoStack((prev) => [
        ...prev.slice(-24),
        {
          evaluationTable: activeSession.evaluationTable,
          annotations: activeSession.annotations,
        },
      ]);
      setRedoStack([]);

      const targetSides: Side[] =
        sug.side === 'both' || !sug.side ? ['left', 'right'] : [sug.side];

      const nextTable = { ...activeSession.evaluationTable };

      for (const side of targetSides) {
        const cur = nextTable[sug.areaId][side];
        const mergedSigns = Array.from(
          new Set([...(cur.releaseSigns ?? []), ...(sug.releaseSigns ?? [])])
        );
        const updatedCell: AreaSideObservation = {
          reaction: sug.reactionLevel !== undefined ? sug.reactionLevel : cur.reaction,
          restriction: sug.restriction !== undefined ? sug.restriction : cur.restriction,
          released: sug.released !== undefined ? sug.released : cur.released,
          releaseSigns: mergedSigns,
          note: cur.note
            ? `${cur.note}; ${sug.noteToAppend ?? ''}`.trim()
            : (sug.noteToAppend ?? ''),
        };

        nextTable[sug.areaId] = {
          ...nextTable[sug.areaId],
          [side]: updatedCell,
        };
      }

      const nextAnnotations = syncAnnotationsWithTable(
        nextTable,
        activeSession.annotations
      );

      void persistSessionUpdate({
        ...activeSession,
        evaluationTable: nextTable,
        annotations: nextAnnotations,
      });
      return;
    }

    if (
      sug.type === 'diagonal' &&
      sug.diagonalFrom &&
      sug.diagonalTo &&
      sug.diagonalFrom !== 'custom' &&
      sug.diagonalTo !== 'custom'
    ) {
      handleSetPredominantDiagonalPreset(sug.diagonalFrom, sug.diagonalTo);
      return;
    }

    // Unclassified or general release note -> append to generalNotes
    const appendedNotes = activeSession.generalNotes
      ? `${activeSession.generalNotes}\n${sug.sourceSentence}`
      : sug.sourceSentence;
    void persistSessionUpdate({
      ...activeSession,
      generalNotes: appendedNotes,
    });
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

    const nowIso = new Date().toISOString();
    const json = serializeBackup(
      {
        horses: allHorses,
        sessions: allSessions,
        voiceClips: serializedClips,
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

      const { horses: inHorses, sessions: inSessions, voiceClips: inClips, language } =
        parsed.backup.data;

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
        db.settings,
        async () => {
          await db.horses.clear();
          await db.sessions.clear();
          await db.voiceClips.clear();
          await db.horses.bulkPut(inHorses);
          await db.sessions.bulkPut(inSessions);
          await db.voiceClips.bulkPut(hydratedClips);
          await db.settings.put({ key: 'language', value: language });
        }
      );

      setHorses(inHorses);
      setSessions(inSessions);
      setLang(language);
      const firstH = inHorses[0]?.id ?? '';
      const firstS = inSessions.find((s) => s.horseId === firstH)?.id ?? inSessions[0]?.id ?? '';
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

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#1E2421]">
      {/* TOP NAVIGATION BAR (Strict 3-Zone Contract: Brand — 4 Nav Links — 1 Primary Action) */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-8 px-4 md:px-8 py-3.5 bg-[#FAF9F6]/95 backdrop-blur-xs border-b border-slate-300">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#editor"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('editor');
          }}
          className="text-lg font-editorial font-bold tracking-tight text-[#2B4C3F] whitespace-nowrap shrink-0"
        >
          {t.appName}
        </a>

        {/* Zone 2: 3 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'editor'
                ? 'text-[#2B4C3F] font-semibold underline underline-offset-8 decoration-2'
                : 'hover:text-[#1E2421]'
            }`}
          >
            {t.navCaseEditor}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('horses')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'horses'
                ? 'text-[#2B4C3F] font-semibold underline underline-offset-8 decoration-2'
                : 'hover:text-[#1E2421]'
            }`}
          >
            {t.navHorses}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('report')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'report'
                ? 'text-[#2B4C3F] font-semibold underline underline-offset-8 decoration-2'
                : 'hover:text-[#1E2421]'
            }`}
          >
            {t.navReport}
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => void handleCreateNewSession()}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#2B4C3F] rounded-lg hover:bg-[#223D32] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.newSession}
          </button>
        </div>
      </header>

      {/* MOBILE NAVIGATION STRIP (Only on small screens) */}
      <div className="no-print md:hidden grid grid-cols-3 gap-1 border-b border-slate-300 bg-[#F3F1EC] px-2 py-1.5 text-[11px] font-medium">
        {(['editor', 'horses', 'report'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-1.5 py-1.5 rounded-md text-center truncate cursor-pointer ${
              activeTab === tab
                ? 'bg-[#2B4C3F] text-white font-semibold'
                : 'text-slate-700'
            }`}
          >
            {tab === 'editor'
              ? t.navCaseEditor
              : tab === 'horses'
                ? t.navHorses
                : t.navReport}
          </button>
        ))}
      </div>

      {/* WORKSPACE UTILITY SUB-BAR: Horse/Session Switcher, EN/RU Language Switch, PWA Install, Demo Controls */}
      <div className="no-print border-b border-slate-300/80 bg-[#F3F1EC] px-4 md:px-8 py-2.5">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-2.5 text-xs">
          {/* Active Horse & Session Switchers */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <label htmlFor="horse-switcher" className="font-semibold text-slate-600">
                {t.horseLabel}:
              </label>
              <select
                id="horse-switcher"
                value={activeHorse?.id ?? ''}
                onChange={(e) => {
                  const hId = e.target.value;
                  const firstSess = sessions.find((s) => s.horseId === hId);
                  void handleSelectHorseAndSession(hId, firstSess?.id ?? '');
                }}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#1E2421]"
              >
                {horses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} {h.isDemo ? '(Demo)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {activeHorse && (
              <div className="flex items-center gap-1.5">
                <label htmlFor="session-switcher" className="font-semibold text-slate-600">
                  {t.sessionNum}:
                </label>
                <select
                  id="session-switcher"
                  value={activeSession?.id ?? ''}
                  onChange={(e) =>
                    void handleSelectHorseAndSession(activeHorse.id, e.target.value)
                  }
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold font-tabular text-[#1E2421]"
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
              </div>
            )}

            <span className="text-slate-400 hidden sm:inline">·</span>
            <span className="text-slate-500 hidden sm:inline">{t.autoSaveStatus}</span>
          </div>

          {/* Right side: Demo Delete Button, PWA Install, EN / RU Language Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {activeHorse?.isDemo && (
              <div className="flex items-center gap-1.5 bg-amber-100/80 border border-amber-300 text-amber-950 px-2.5 py-1 rounded-md text-[11px]">
                <span className="font-medium">{t.demoBadge}</span>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteDemonstrationCase();
                    const remH = await db.horses.toArray();
                    const remS = await db.sessions.toArray();
                    setHorses(remH);
                    setSessions(remS);
                    await handleSelectHorseAndSession(
                      remH[0]?.id ?? '',
                      remS[0]?.id ?? ''
                    );
                  }}
                  className="underline font-semibold text-red-800 hover:text-red-950 ml-1 cursor-pointer whitespace-nowrap"
                >
                  {t.deleteDemo}
                </button>
              </div>
            )}

            <PWAInstallAction lang={lang} />

            {/* EN / RU Segmented Language Control */}
            <div
              className="inline-flex rounded-lg bg-white p-0.5 border border-slate-300"
              role="group"
              aria-label="Language Switcher"
            >
              <button
                type="button"
                onClick={() => void handleLanguageChange('en')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  lang === 'en'
                    ? 'bg-[#2B4C3F] text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => void handleLanguageChange('ru')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  lang === 'ru'
                    ? 'bg-[#2B4C3F] text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                RU
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT STAGE */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-8 py-6">
        {!activeHorse || !activeSession ? (
          <HorsesAndBackupView
            horses={horses}
            sessions={sessions}
            activeHorseId={activeHorseId}
            activeSessionId={activeSessionId}
            lang={lang}
            onSelectHorseAndSession={(hId, sId) => {
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
          /* TAB 1: CASE STUDY EVALUATION SHEET EDITOR & INTEGRATED AUDIO/NOTES PANEL */
          <div className="space-y-5">
            {/* INTEGRATED FIELD AUDIO RECORDER & NOTES PANEL */}
            <EvaluationAudioNotesPanel
              session={activeSession}
              clips={voiceClips}
              lang={lang}
              installedModels={installedModels}
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
              onUpdateManualNotes={(notes) =>
                void persistSessionUpdate({
                  ...activeSession,
                  manualVoiceNotes: notes,
                })
              }
              onApplySuggestion={handleApplySuggestion}
              onNavigateToHorses={() => setActiveTab('horses')}
            />

            {/* PAPER SHEET HEADER CARD */}
            <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-10 rounded-full border-2 border-[#2B4C3F] bg-[#FAF9F6] flex flex-col items-center justify-center shrink-0 text-[#2B4C3F]">
                    <span className="text-[7px] font-bold tracking-widest uppercase">
                      MASTERSON
                    </span>
                    <span className="text-[8.5px] font-serif font-bold">METHOD</span>
                  </div>
                  <div>
                    <h1 className="text-lg md:text-xl font-editorial font-bold text-[#1E2421]">
                      {t.formTitle}
                    </h1>
                    <p className="text-xs text-slate-500">
                      {t.step1Title} {t.step1Desc} · <strong>{t.step2Title}</strong>{' '}
                      {t.step2Desc}
                    </p>
                  </div>
                </div>
              </div>

              {/* Editable Form Header Fields (3 rows matching the paper evaluation sheet) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {/* Row 1: Student | Case Study # | Session # | Date */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                    {t.studentLabel}
                  </label>
                  <input
                    type="text"
                    value={activeSession.practitioner}
                    onChange={(e) =>
                      void persistSessionUpdate({
                        ...activeSession,
                        practitioner: e.target.value,
                      })
                    }
                    className="w-full rounded border border-slate-300 bg-[#FAF9F6] px-2.5 py-1.5 font-medium text-[#1E2421] focus:border-[#2B4C3F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                    {t.caseStudyNum}
                  </label>
                  <input
                    type="text"
                    value={activeSession.caseStudyNumber}
                    onChange={(e) =>
                      void persistSessionUpdate({
                        ...activeSession,
                        caseStudyNumber: e.target.value,
                      })
                    }
                    className="w-full rounded border border-slate-300 bg-[#FAF9F6] px-2.5 py-1.5 font-tabular font-medium text-[#1E2421] focus:border-[#2B4C3F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                    {t.sessionNum}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={activeSession.sessionNumber}
                    onChange={(e) =>
                      void persistSessionUpdate({
                        ...activeSession,
                        sessionNumber: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="w-full rounded border border-slate-300 bg-[#FAF9F6] px-2.5 py-1.5 font-tabular font-bold text-[#1E3A8A] focus:border-[#2B4C3F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                    {t.dateLabel}
                  </label>
                  <input
                    type="date"
                    value={activeSession.date}
                    onChange={(e) =>
                      void persistSessionUpdate({
                        ...activeSession,
                        date: e.target.value,
                      })
                    }
                    className="w-full rounded border border-slate-300 bg-[#FAF9F6] px-2.5 py-1.5 font-tabular font-medium text-[#1E2421] focus:border-[#2B4C3F] focus:outline-none"
                  />
                </div>

                {/* Row 2: Horse | Age | Breed | Horse's Job */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                    {t.horseLabel}
                  </label>
                  <input
                    type="text"
                    value={activeHorse.name}
                    onChange={(e) =>
                      void persistHorseUpdate({
                        ...activeHorse,
                        name: e.target.value,
                      })
                    }
                    className="w-full rounded border border-slate-300 bg-[#FAF9F6] px-2.5 py-1.5 font-semibold text-[#1E3A8A] focus:border-[#2B4C3F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                    {t.ageLabel}
                  </label>
                  <input
                    type="text"
                    value={activeHorse.age}
                    onChange={(e) =>
                      void persistHorseUpdate({
                        ...activeHorse,
                        age: e.target.value,
                      })
                    }
                    className="w-full rounded border border-slate-300 bg-[#FAF9F6] px-2.5 py-1.5 font-tabular font-medium text-[#1E2421] focus:border-[#2B4C3F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                    {t.breedLabel}
                  </label>
                  <input
                    type="text"
                    value={activeHorse.breed}
                    onChange={(e) =>
                      void persistHorseUpdate({
                        ...activeHorse,
                        breed: e.target.value,
                      })
                    }
                    className="w-full rounded border border-slate-300 bg-[#FAF9F6] px-2.5 py-1.5 font-medium text-[#1E2421] focus:border-[#2B4C3F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                    {t.jobLabel}
                  </label>
                  <input
                    type="text"
                    value={activeHorse.job}
                    onChange={(e) =>
                      void persistHorseUpdate({
                        ...activeHorse,
                        job: e.target.value,
                      })
                    }
                    className="w-full rounded border border-slate-300 bg-[#FAF9F6] px-2.5 py-1.5 font-semibold text-[#1E3A8A] focus:border-[#2B4C3F] focus:outline-none"
                  />
                </div>

                {/* Row 3: Owner | Contact Info | Session Duration */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                    {t.ownerLabel}
                  </label>
                  <input
                    type="text"
                    value={activeHorse.owner}
                    onChange={(e) =>
                      void persistHorseUpdate({
                        ...activeHorse,
                        owner: e.target.value,
                      })
                    }
                    className="w-full rounded border border-slate-300 bg-[#FAF9F6] px-2.5 py-1.5 font-medium text-[#1E2421] focus:border-[#2B4C3F] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                    {t.contactLabel}
                  </label>
                  <input
                    type="text"
                    value={activeHorse.contactInfo}
                    onChange={(e) =>
                      void persistHorseUpdate({
                        ...activeHorse,
                        contactInfo: e.target.value,
                      })
                    }
                    className="w-full rounded border border-slate-300 bg-[#FAF9F6] px-2.5 py-1.5 font-medium text-[#1E2421] focus:border-[#2B4C3F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                    {t.durationLabel}
                  </label>
                  <input
                    type="text"
                    value={activeSession.duration}
                    onChange={(e) =>
                      void persistSessionUpdate({
                        ...activeSession,
                        duration: e.target.value,
                      })
                    }
                    className="w-full rounded border border-slate-300 bg-[#FAF9F6] px-2.5 py-1.5 font-tabular font-medium text-[#1E2421] focus:border-[#2B4C3F] focus:outline-none"
                  />
                </div>
              </div>
            </section>

            {/* ANATOMICAL ZONING & STANDARDIZED MARKER CONTROL BAR */}
            <section
              data-testid="anatomical-region-toolbar"
              className="rounded-xl border border-slate-300 bg-white p-3.5 shadow-xs space-y-3"
            >
              {/* Top Row: 5 Pastel Anatomical Region Filters + View Toggles + Undo/Redo */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                    <Layers className="w-3.5 h-3.5 text-[#2B4C3F]" />
                    {lang === 'ru' ? 'Анатомические зоны:' : 'Anatomical Zones:'}
                  </span>

                  <button
                    type="button"
                    data-testid="region-filter-all"
                    onClick={() => setActiveRegionFilter('all')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activeRegionFilter === 'all'
                        ? 'bg-[#2B4C3F] text-white shadow-2xs'
                        : 'bg-[#FAF9F6] text-slate-700 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {lang === 'ru' ? 'Все зоны (1–19)' : 'All Zones (1–19)'}
                  </button>

                  {ANATOMICAL_REGIONS.map((region) => {
                    const isSelected = activeRegionFilter === region.id;
                    return (
                      <button
                        key={region.id}
                        type="button"
                        data-testid={`region-filter-${region.id}`}
                        onClick={() =>
                          setActiveRegionFilter(isSelected ? 'all' : region.id)
                        }
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                          isSelected
                            ? 'ring-2 ring-[#2B4C3F] font-semibold text-[#1E2421] shadow-2xs'
                            : 'text-slate-700 hover:text-slate-900'
                        }`}
                        style={{
                          backgroundColor: isSelected
                            ? region.activeFill
                            : '#FAF9F6',
                          borderColor: isSelected
                            ? region.activeStroke
                            : region.pastelStroke,
                        }}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-xs border shrink-0"
                          style={{
                            backgroundColor: region.pastelFill,
                            borderColor: region.activeStroke,
                          }}
                        />
                        <span>{lang === 'ru' ? region.nameRu : region.nameEn}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Right controls: Pastel Zone toggle, Landmark numbers toggle, Undo/Redo */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowPastelZones((v) => !v)}
                    title={
                      lang === 'ru'
                        ? 'Показать/скрыть пастельные анатомические регионы'
                        : 'Toggle subtle pastel anatomical regions'
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                      showPastelZones
                        ? 'bg-[#2B4C3F]/10 border-[#2B4C3F]/40 text-[#2B4C3F] font-semibold'
                        : 'bg-[#FAF9F6] border-slate-300 text-slate-600'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      {lang === 'ru' ? 'Зоны' : 'Zones'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowLandmarkNumbers((v) => !v)}
                    title={
                      lang === 'ru'
                        ? 'Показать/скрыть номера точек 1–19'
                        : 'Toggle landmark numbers #1–19'
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                      showLandmarkNumbers
                        ? 'bg-[#2B4C3F]/10 border-[#2B4C3F]/40 text-[#2B4C3F] font-semibold'
                        : 'bg-[#FAF9F6] border-slate-300 text-slate-600'
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">1–19</span>
                  </button>

                  <button
                    type="button"
                    disabled={undoStack.length === 0}
                    onClick={handleUndo}
                    aria-label={t.undo}
                    title={t.undo}
                    className="p-1.5 rounded-lg border border-slate-300 bg-[#FAF9F6] hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={redoStack.length === 0}
                    onClick={handleRedo}
                    aria-label={t.redo}
                    title={t.redo}
                    className="p-1.5 rounded-lg border border-slate-300 bg-[#FAF9F6] hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>

                  {selectedAnnotationId && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = activeSession.annotations.filter(
                          (a) => a.id !== selectedAnnotationId
                        );
                        handleUpdateAnnotations(next);
                        setSelectedAnnotationId(null);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === 'ru' ? 'Удалить' : 'Delete'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom Row: Standardized Vector Marker Legend & Touch Prompt */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-[11px] text-slate-600">
                <span>
                  {lang === 'ru'
                    ? 'Нажмите на любую анатомическую область на схеме лошади или в таблице 1–19 для выбора реакций, рестрикций, релиза и заметок:'
                    : 'Tap any anatomical landmark on the horse illustration or central 19-area table to record standardized markers:'}
                </span>

                <div className="flex flex-wrap items-center gap-3 font-semibold">
                  <span className="inline-flex items-center gap-1.5 text-[#B91C1C]">
                    <span className="w-4 h-[1.5px] bg-[#B91C1C] inline-block" />
                    <span>R1</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#B91C1C]">
                    <span className="w-4 h-[3.5px] bg-[#B91C1C] inline-block" />
                    <span>R2</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#B91C1C]">
                    <svg className="w-4 h-2.5 stroke-[#B91C1C]" viewBox="0 0 18 10" fill="none">
                      <path
                        d="M1 8 L4 2 L7 8 L10 2 L13 8 L17 2"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>R3</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[#1E3A8A]">
                    <span className="w-3 h-3 rounded-full border-2 border-[#1E3A8A] bg-[#1E3A8A]/10 inline-block" />
                    <span>{lang === 'ru' ? 'Рестрикция' : 'Restriction'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[#15803D]">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#15803D] text-white text-[9px] inline-flex items-center justify-center font-bold">
                      ✓
                    </span>
                    <span>{lang === 'ru' ? 'Релиз' : 'Released'}</span>
                  </span>
                </div>
              </div>
            </section>

            {/* MOBILE PANE FILTER (Only shown below lg breakpoint so table & silhouettes stay roomy) */}
            <div className="lg:hidden flex items-center gap-1.5 bg-[#F3F1EC] p-1 rounded-lg border border-slate-300 text-xs">
              {(
                [
                  { id: 'all', label: lang === 'ru' ? 'Все панели' : 'All Views' },
                  { id: 'left', label: t.tableLeft },
                  { id: 'table', label: '19-Area Table' },
                  { id: 'right', label: t.tableRight },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setMobileEvalPane(p.id)}
                  className={`flex-1 py-1.5 rounded-md font-medium cursor-pointer ${
                    mobileEvalPane === p.id
                      ? 'bg-white text-[#2B4C3F] font-semibold shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* MAIN 3-COLUMN MASTERSON EVALUATION SHEET: LEFT PROFILE | 19-AREA TABLE | RIGHT PROFILE */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Column A: Left Profile */}
              <div
                className={`lg:col-span-4 lg:sticky lg:top-16 rounded-xl border border-slate-300 bg-white p-4 shadow-xs space-y-2.5 ${
                  mobileEvalPane !== 'all' && mobileEvalPane !== 'left'
                    ? 'hidden lg:block'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[#2B4C3F]">
                    {t.leftProfileTitle}
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleClearSideView('left')}
                    className="text-[11px] text-slate-500 hover:text-red-700 cursor-pointer"
                  >
                    {t.clearView}
                  </button>
                </div>

                <HorseSilhouetteSvg
                  view="left"
                  evaluationTable={activeSession.evaluationTable}
                  annotations={activeSession.annotations}
                  activeTool={activeTool}
                  activeColor={activeColor}
                  selectedAnnotationId={selectedAnnotationId}
                  onSelectAnnotation={setSelectedAnnotationId}
                  onChangeAnnotations={handleUpdateAnnotations}
                  selectedAreaTarget={activeTablePopover}
                  hoveredAreaTarget={hoveredAreaTarget}
                  onHoverArea={setHoveredAreaTarget}
                  onAreaLandmarkClick={(areaId, side) =>
                    setActiveTablePopover({ areaId, side })
                  }
                  activeRegionFilter={activeRegionFilter}
                  showPastelZones={showPastelZones}
                  showLandmarkNumbers={showLandmarkNumbers}
                  lang={lang}
                />
              </div>

              {/* Center Column: 19-Area Table */}
              <div
                className={`lg:col-span-4 ${
                  mobileEvalPane !== 'all' && mobileEvalPane !== 'table'
                    ? 'hidden lg:block'
                    : ''
                }`}
              >
                <CentralEvaluationTable
                  tableState={activeSession.evaluationTable}
                  onUpdateCell={handleUpdateTableCell}
                  lang={lang}
                  activePopover={activeTablePopover}
                  onChangeActivePopover={setActiveTablePopover}
                  hoveredAreaTarget={hoveredAreaTarget}
                  onHoverArea={setHoveredAreaTarget}
                  activeRegionFilter={activeRegionFilter}
                />
              </div>

              {/* Column B: Right Profile */}
              <div
                className={`lg:col-span-4 lg:sticky lg:top-16 rounded-xl border border-slate-300 bg-white p-4 shadow-xs space-y-2.5 ${
                  mobileEvalPane !== 'all' && mobileEvalPane !== 'right'
                    ? 'hidden lg:block'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[#2B4C3F]">
                    {t.rightProfileTitle}
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleClearSideView('right')}
                    className="text-[11px] text-slate-500 hover:text-red-700 cursor-pointer"
                  >
                    {t.clearView}
                  </button>
                </div>

                <HorseSilhouetteSvg
                  view="right"
                  evaluationTable={activeSession.evaluationTable}
                  annotations={activeSession.annotations}
                  activeTool={activeTool}
                  activeColor={activeColor}
                  selectedAnnotationId={selectedAnnotationId}
                  onSelectAnnotation={setSelectedAnnotationId}
                  onChangeAnnotations={handleUpdateAnnotations}
                  selectedAreaTarget={activeTablePopover}
                  hoveredAreaTarget={hoveredAreaTarget}
                  onHoverArea={setHoveredAreaTarget}
                  onAreaLandmarkClick={(areaId, side) =>
                    setActiveTablePopover({ areaId, side })
                  }
                  activeRegionFilter={activeRegionFilter}
                  showPastelZones={showPastelZones}
                  showLandmarkNumbers={showLandmarkNumbers}
                  lang={lang}
                />
              </div>
            </section>

            {/* STEP 3 — FINAL EVALUATION: TOP VIEW PREDOMINANT DIAGONAL & GENERAL SESSION NOTES */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              <div className="lg:col-span-7 rounded-xl border border-slate-300 bg-white p-5 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-[#2B4C3F]">
                      {t.topViewTitle}
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">{t.step3Desc}</p>
                  </div>
                </div>

                {/* Quick Diagonal Presets + Interactive Top View SVG */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      handleSetPredominantDiagonalPreset('left_atlas', 'right_gluteal')
                    }
                    className="px-2.5 py-1.5 rounded-md border border-slate-300 bg-[#FAF9F6] hover:bg-[#2B4C3F]/10 font-medium text-[#1E2421] cursor-pointer"
                  >
                    Left Atlas → Right Gluteal
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSetPredominantDiagonalPreset('right_atlas', 'left_gluteal')
                    }
                    className="px-2.5 py-1.5 rounded-md border border-slate-300 bg-[#FAF9F6] hover:bg-[#2B4C3F]/10 font-medium text-[#1E2421] cursor-pointer"
                  >
                    Right Atlas → Left Gluteal
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSetPredominantDiagonalPreset('left_atlas', 'right_sacrum')
                    }
                    className="px-2.5 py-1.5 rounded-md border border-slate-300 bg-[#FAF9F6] hover:bg-[#2B4C3F]/10 font-medium text-[#1E2421] cursor-pointer"
                  >
                    Left Atlas → Right Sacrum
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSetPredominantDiagonalPreset('right_atlas', 'left_sacrum')
                    }
                    className="px-2.5 py-1.5 rounded-md border border-slate-300 bg-[#FAF9F6] hover:bg-[#2B4C3F]/10 font-medium text-[#1E2421] cursor-pointer"
                  >
                    Right Atlas → Left Sacrum
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateAnnotations(
                        activeSession.annotations.filter((a) => a.kind !== 'diagonal')
                      )
                    }
                    className="px-2.5 py-1.5 rounded-md text-red-700 hover:bg-red-50 font-medium cursor-pointer ml-auto"
                  >
                    {t.clearView}
                  </button>
                </div>

                <HorseSilhouetteSvg
                  view="top"
                  evaluationTable={activeSession.evaluationTable}
                  annotations={activeSession.annotations}
                  activeTool="select"
                  activeColor={activeColor}
                  selectedAnnotationId={selectedAnnotationId}
                  onSelectAnnotation={setSelectedAnnotationId}
                  onChangeAnnotations={handleUpdateAnnotations}
                  onSelectDiagonalAnchors={handleSetPredominantDiagonalPreset}
                  activeRegionFilter={activeRegionFilter}
                  showPastelZones={showPastelZones}
                  lang={lang}
                />
              </div>

              {/* General Session Notes */}
              <div className="lg:col-span-5 rounded-xl border border-slate-300 bg-white p-5 shadow-xs flex flex-col justify-between space-y-3">
                <div className="space-y-2 flex-1 flex flex-col">
                  <label
                    htmlFor="general-session-notes"
                    className="text-sm font-semibold text-[#1E2421]"
                  >
                    {t.generalNotesLabel}
                  </label>
                  <textarea
                    id="general-session-notes"
                    rows={6}
                    value={activeSession.generalNotes}
                    onChange={(e) =>
                      void persistSessionUpdate({
                        ...activeSession,
                        generalNotes: e.target.value,
                      })
                    }
                    placeholder={
                      lang === 'ru'
                        ? 'Запишите техники Masterson Method, реакции, релизы и наблюдения по сессии...'
                        : 'Record Masterson Method techniques applied, palpation shifts, release signs, and general observations...'
                    }
                    className="w-full flex-1 rounded-lg border border-slate-300 bg-[#FAF9F6] p-3 text-xs text-slate-900 leading-relaxed focus:border-[#2B4C3F] focus:outline-none"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 leading-snug">
                  {t.certDisclaimer}
                </div>
              </div>
            </section>
          </div>
        ) : activeTab === 'horses' ? (
          /* TAB 2: HORSES, SESSIONS & JSON BACKUP */
          <HorsesAndBackupView
            horses={horses}
            sessions={sessions}
            activeHorseId={activeHorse.id}
            activeSessionId={activeSession.id}
            lang={lang}
            onSelectHorseAndSession={(hId, sId) => {
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
        ) : (
          /* TAB 3: STRUCTURED REPORT & PRINT-READY A4 PDF EXPORT */
          <SessionReportAndPdfView
            horse={activeHorse}
            session={activeSession}
            lang={lang}
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
          />
        )}
      </main>

      <OfflineConnectivityBanner lang={lang} />
    </div>
  );
}
