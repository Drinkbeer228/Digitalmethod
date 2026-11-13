/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
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
  BodyPartFilterId,
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
import { OfflineConnectivityBanner, PWAInstallAction } from './pwa/PWAInstallBanner';
import {
  Check,
  Mic,
  Redo2,
  Save,
  Undo2,
} from 'lucide-react';

type ActiveTab = 'editor' | 'horses';

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
  const [sessionSavedFeedback, setSessionSavedFeedback] = useState<boolean>(false);

  // Mobile (< 1024px) diagram view switcher ('left' | 'right' | 'top') & responsive breakpoint
  const [mobileActiveView, setMobileActiveView] = useState<'left' | 'right' | 'top'>('left');
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [isAudioDrawerOpen, setIsAudioDrawerOpen] = useState<boolean>(false);

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

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#1E2421]">
      {/* STICKY HEADER BAR: 2-Tab Navigation (Evaluation & Horses) + Subtle Mic Button + Language Switch */}
      <header className="no-print sticky top-0 z-30 bg-[#FAF9F6]/95 backdrop-blur-xs border-b border-slate-300">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-2 px-3 md:px-6 py-2">
          <a
            href="#editor"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('editor');
            }}
            className="text-xs sm:text-sm md:text-base font-editorial font-bold tracking-tight text-[#2B4C3F] truncate shrink-0"
          >
            <span className="sm:hidden">Masterson</span>
            <span className="hidden sm:inline">{t.appName}</span>
          </a>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Two-Tab Primary Navigation: Evaluation | Horses */}
            <nav
              className="flex items-center bg-[#F3F1EC] p-0.5 rounded-lg border border-slate-300 text-xs font-semibold"
              aria-label="Main Navigation"
            >
              {(
                [
                  {
                    id: 'editor' as const,
                    label: lang === 'ru' ? 'Оценка' : 'Evaluation',
                  },
                  {
                    id: 'horses' as const,
                    label: lang === 'ru' ? 'Лошади' : 'Horses',
                  },
                ]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`nav-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 sm:px-4 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-[#2B4C3F] text-white shadow-2xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Subtle Microphone Icon Button (🎙 with clip count badge if > 0) */}
            {activeHorse && activeSession && (
              <button
                type="button"
                data-testid="header-audio-drawer-btn"
                onClick={() => {
                  if (activeTab !== 'editor') {
                    setActiveTab('editor');
                  }
                  setIsAudioDrawerOpen((v) => !v);
                }}
                title={
                  lang === 'ru'
                    ? `Аудиозаписи (${voiceClips.length})`
                    : `Audio Clips (${voiceClips.length})`
                }
                aria-label={
                  lang === 'ru'
                    ? `Аудиозаписи (${voiceClips.length})`
                    : `Audio Clips (${voiceClips.length})`
                }
                className={`relative min-h-[34px] px-2.5 py-1 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isAudioDrawerOpen
                    ? 'bg-[#2B4C3F] text-white border-[#2B4C3F]'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <Mic className="w-3.5 h-3.5 text-[#B91C1C]" />
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

            <div className="hidden lg:block">
              <PWAInstallAction lang={lang} />
            </div>

            {/* EN / RU Segmented Language Control */}
            <div
              className="inline-flex rounded-lg bg-white p-0.5 border border-slate-300"
              role="group"
              aria-label="Language Switcher"
            >
              <button
                type="button"
                onClick={() => void handleLanguageChange('en')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
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
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
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

        {/* Sub-Row: Horse/Session Selector + Mobile View Switcher (Left | Right | Top) + Undo/Redo */}
        {activeHorse && activeSession && (
          <div className="border-t border-slate-200/90 bg-[#F3F1EC] px-2.5 md:px-6 py-1.5">
            <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-1.5 sm:gap-2 text-xs">
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1">
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
                  className="max-w-[100px] sm:max-w-[200px] truncate rounded-md border border-slate-300 bg-white px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs font-semibold text-[#1E2421]"
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
                  onChange={(e) =>
                    void handleSelectHorseAndSession(activeHorse.id, e.target.value)
                  }
                  className="max-w-[88px] sm:max-w-[180px] truncate rounded-md border border-slate-300 bg-white px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs font-semibold font-tabular text-[#1E2421]"
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

              {activeTab === 'editor' && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Mobile (< 1024px) Segmented View Switcher: Left | Right | Top */}
                  {!isDesktop && (
                    <div
                      data-testid="mobile-thumb-top-bar"
                      className="inline-flex rounded-lg bg-white p-0.5 border border-slate-300"
                      role="group"
                      aria-label="View Switcher"
                    >
                      {(
                        [
                          { id: 'left' as const, label: t.tableLeft },
                          { id: 'right' as const, label: t.tableRight },
                          { id: 'top' as const, label: lang === 'ru' ? 'Сверху' : 'Top' },
                        ]
                      ).map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          data-testid={`mobile-view-${v.id}`}
                          onClick={() => setMobileActiveView(v.id)}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                            mobileActiveView === v.id
                              ? 'bg-[#2B4C3F] text-white shadow-2xs'
                              : 'text-slate-700 hover:text-slate-900'
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  )}

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
                    className="hidden sm:inline-flex p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTENT STAGE */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-3 md:px-8 py-4 md:py-6 pb-16">
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
          /* TAB 1: CLEAN EVALUATION SCREEN (Desktop 3-Column + Mobile Full-Horse & 19-Area List) */
          <div
            data-testid="evaluation-workspace"
            className="space-y-6"
          >
            {/* Conditional Interrupted Audio Recovery Banner + Controlled Audio Clips Drawer */}
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
              onAppendTranscriptToSessionNotes={(transcriptText) => {
                const current = getUnifiedSessionNotes(activeSession);
                const nextNotes = current
                  ? `${current}\n${transcriptText}`
                  : transcriptText;
                void persistSessionUpdate({
                  ...activeSession,
                  generalNotes: nextNotes,
                  manualVoiceNotes: '',
                });
              }}
              onNavigateToHorses={() => setActiveTab('horses')}
            />

            {isDesktop ? (
              /* DESKTOP (>= 1024px): Classic 3-Column Masterson Layout (Left Profile | 19-Area Table | Right Profile) + Top View Below */
              <div
                data-testid="desktop-three-column-evaluation"
                className="space-y-6"
              >
                <div className="grid grid-cols-12 gap-5 items-start">
                  {/* Left Profile Column — No Title Banner or Zoom Row Above Image */}
                  <div className="col-span-4 rounded-xl border border-slate-300 bg-white p-2.5 shadow-2xs sticky top-24">
                    <HorseSilhouetteSvg
                      view="left"
                      evaluationTable={activeSession.evaluationTable}
                      annotations={activeSession.annotations}
                      onChangeAnnotations={handleUpdateAnnotations}
                      selectedAreaTarget={activeTablePopover}
                      hoveredAreaTarget={hoveredAreaTarget}
                      onHoverArea={setHoveredAreaTarget}
                      onAreaLandmarkClick={(areaId, side) =>
                        setActiveTablePopover({ areaId, side })
                      }
                      activeRegionFilter={activeRegionFilter}
                      bodyPartFilter={bodyPartFilter}
                      onChangeBodyPartFilter={setBodyPartFilter}
                      showPastelZones={true}
                      showLandmarkNumbers={true}
                      lang={lang}
                    />
                  </div>

                  {/* Center Filtered Bilateral Table Column */}
                  <div className="col-span-4">
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
                    />
                  </div>

                  {/* Right Profile Column — No Title Banner or Zoom Row Above Image */}
                  <div className="col-span-4 rounded-xl border border-slate-300 bg-white p-2.5 shadow-2xs sticky top-24">
                    <HorseSilhouetteSvg
                      view="right"
                      evaluationTable={activeSession.evaluationTable}
                      annotations={activeSession.annotations}
                      onChangeAnnotations={handleUpdateAnnotations}
                      selectedAreaTarget={activeTablePopover}
                      hoveredAreaTarget={hoveredAreaTarget}
                      onHoverArea={setHoveredAreaTarget}
                      onAreaLandmarkClick={(areaId, side) =>
                        setActiveTablePopover({ areaId, side })
                      }
                      activeRegionFilter={activeRegionFilter}
                      bodyPartFilter={bodyPartFilter}
                      onChangeBodyPartFilter={setBodyPartFilter}
                      showPastelZones={true}
                      showLandmarkNumbers={true}
                      lang={lang}
                    />
                  </div>
                </div>

                {/* Desktop Top View & Predominant Diagonal Below */}
                <div className="rounded-xl border border-slate-300 bg-white p-5 shadow-2xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-[#2B4C3F]">
                        {t.topViewTitle}
                      </h2>
                      <p className="text-xs text-slate-600">{t.step3Desc}</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <button
                        type="button"
                        data-testid="top-preset-la-rg"
                        onClick={() =>
                          handleSetPredominantDiagonalPreset('left_atlas', 'right_gluteal')
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-[#FAF9F6] hover:bg-[#2B4C3F]/10 font-semibold text-[#1E2421] cursor-pointer"
                      >
                        L Atlas → R Gluteal
                      </button>
                      <button
                        type="button"
                        data-testid="top-preset-ra-lg"
                        onClick={() =>
                          handleSetPredominantDiagonalPreset('right_atlas', 'left_gluteal')
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-[#FAF9F6] hover:bg-[#2B4C3F]/10 font-semibold text-[#1E2421] cursor-pointer"
                      >
                        R Atlas → L Gluteal
                      </button>
                      <button
                        type="button"
                        data-testid="top-preset-la-rs"
                        onClick={() =>
                          handleSetPredominantDiagonalPreset('left_atlas', 'right_sacrum')
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-[#FAF9F6] hover:bg-[#2B4C3F]/10 font-semibold text-[#1E2421] cursor-pointer"
                      >
                        L Atlas → R Sacrum
                      </button>
                      <button
                        type="button"
                        data-testid="top-preset-ra-ls"
                        onClick={() =>
                          handleSetPredominantDiagonalPreset('right_atlas', 'left_sacrum')
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-[#FAF9F6] hover:bg-[#2B4C3F]/10 font-semibold text-[#1E2421] cursor-pointer"
                      >
                        R Atlas → L Sacrum
                      </button>
                    </div>
                  </div>

                  <div className="max-w-3xl mx-auto">
                    <HorseSilhouetteSvg
                      view="top"
                      evaluationTable={activeSession.evaluationTable}
                      annotations={activeSession.annotations}
                      onChangeAnnotations={handleUpdateAnnotations}
                      onSelectDiagonalAnchors={handleSetPredominantDiagonalPreset}
                      activeRegionFilter={activeRegionFilter}
                      showPastelZones={true}
                      lang={lang}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* MOBILE (< 1024px): Complete Horse Diagram at Top (No Header Banner) + Filtered Zone List Below */
              <div
                data-testid="mobile-full-horse-evaluation"
                className="space-y-3"
              >
                {mobileActiveView !== 'top' ? (
                  <div
                    data-testid="mobile-above-fold-diagram"
                    className="rounded-xl border border-slate-300 bg-white p-2 shadow-2xs"
                  >
                    <HorseSilhouetteSvg
                      view={mobileActiveView}
                      evaluationTable={activeSession.evaluationTable}
                      annotations={activeSession.annotations}
                      onChangeAnnotations={handleUpdateAnnotations}
                      selectedAreaTarget={activeTablePopover}
                      hoveredAreaTarget={hoveredAreaTarget}
                      onHoverArea={setHoveredAreaTarget}
                      onAreaLandmarkClick={(areaId, side) =>
                        setActiveTablePopover({ areaId, side })
                      }
                      activeRegionFilter={activeRegionFilter}
                      bodyPartFilter={bodyPartFilter}
                      onChangeBodyPartFilter={setBodyPartFilter}
                      showPastelZones={true}
                      showLandmarkNumbers={true}
                      lang={lang}
                    />
                  </div>
                ) : (
                  <div
                    data-testid="mobile-above-fold-diagram"
                    className="rounded-xl border border-slate-300 bg-white p-3.5 shadow-2xs space-y-3"
                  >
                    <div>
                      <h2 className="text-xs sm:text-sm font-bold text-[#2B4C3F]">
                        {t.topViewTitle}
                      </h2>
                      <p className="text-[11px] text-slate-600 mt-0.5">{t.step3Desc}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <button
                        type="button"
                        data-testid="top-preset-la-rg"
                        onClick={() =>
                          handleSetPredominantDiagonalPreset('left_atlas', 'right_gluteal')
                        }
                        className="min-h-[38px] px-2 py-1.5 rounded-lg border border-slate-300 bg-[#FAF9F6] hover:bg-[#2B4C3F]/10 font-semibold text-[#1E2421] cursor-pointer"
                      >
                        L Atlas → R Gluteal
                      </button>
                      <button
                        type="button"
                        data-testid="top-preset-ra-lg"
                        onClick={() =>
                          handleSetPredominantDiagonalPreset('right_atlas', 'left_gluteal')
                        }
                        className="min-h-[38px] px-2 py-1.5 rounded-lg border border-slate-300 bg-[#FAF9F6] hover:bg-[#2B4C3F]/10 font-semibold text-[#1E2421] cursor-pointer"
                      >
                        R Atlas → L Gluteal
                      </button>
                      <button
                        type="button"
                        data-testid="top-preset-la-rs"
                        onClick={() =>
                          handleSetPredominantDiagonalPreset('left_atlas', 'right_sacrum')
                        }
                        className="min-h-[38px] px-2 py-1.5 rounded-lg border border-slate-300 bg-[#FAF9F6] hover:bg-[#2B4C3F]/10 font-semibold text-[#1E2421] cursor-pointer"
                      >
                        L Atlas → R Sacrum
                      </button>
                      <button
                        type="button"
                        data-testid="top-preset-ra-ls"
                        onClick={() =>
                          handleSetPredominantDiagonalPreset('right_atlas', 'left_sacrum')
                        }
                        className="min-h-[38px] px-2 py-1.5 rounded-lg border border-slate-300 bg-[#FAF9F6] hover:bg-[#2B4C3F]/10 font-semibold text-[#1E2421] cursor-pointer"
                      >
                        R Atlas → L Sacrum
                      </button>
                    </div>

                    <HorseSilhouetteSvg
                      view="top"
                      evaluationTable={activeSession.evaluationTable}
                      annotations={activeSession.annotations}
                      onChangeAnnotations={handleUpdateAnnotations}
                      onSelectDiagonalAnchors={handleSetPredominantDiagonalPreset}
                      activeRegionFilter={activeRegionFilter}
                      showPastelZones={true}
                      lang={lang}
                    />
                  </div>
                )}

                {/* Filtered Zone List for Active Side (Left or Right) Directly Below */}
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
                  mobileSingleSide={mobileActiveView === 'right' ? 'right' : 'left'}
                />
              </div>
            )}

            {/* Bottom Action Bar: Primary "Save Session" Button */}
            <div className="pt-2 flex flex-col items-center gap-2">
              <button
                type="button"
                data-testid="save-session-btn"
                onClick={async () => {
                  await persistSessionUpdate(activeSession);
                  setSessionSavedFeedback(true);
                  setTimeout(() => setSessionSavedFeedback(false), 3000);
                }}
                className={`w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-white text-sm font-bold shadow-xs cursor-pointer transition-colors ${
                  sessionSavedFeedback
                    ? 'bg-[#15803D] hover:bg-emerald-800'
                    : 'bg-[#2B4C3F] hover:bg-[#223D32]'
                }`}
              >
                {sessionSavedFeedback ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span data-testid="save-session-feedback">
                      {lang === 'ru' ? 'Сессия сохранена' : 'Session Saved'}
                    </span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>
                      {lang === 'ru' ? 'Сохранить сессию' : 'Save Session'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* TAB 2: HORSES, SESSION HISTORY, EVALUATED ZONES BREAKDOWN, A4 PDF EXPORT & SETTINGS */
          <HorsesAndBackupView
            horses={horses}
            sessions={sessions}
            activeHorseId={activeHorse.id}
            activeSessionId={activeSession.id}
            lang={lang}
            onSelectHorseAndSession={(hId, sId) => {
              void handleSelectHorseAndSession(hId, sId);
            }}
            onEditSessionOnMap={(hId, sId) => {
              void handleSelectHorseAndSession(hId, sId);
              setActiveTab('editor');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
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

      <OfflineConnectivityBanner lang={lang} />
    </div>
  );
}
