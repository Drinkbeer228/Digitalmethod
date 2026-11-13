/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  BodyworkSession,
  HorseProfile,
  InstalledWhisperModel,
  Language,
  ReportSections,
} from '../types';
import { TRANSLATIONS } from '../data/translations';
import { DEMO_HORSE_ID } from '../data/demoCase';
import {
  deleteInstalledWhisperModel,
  DownloadProgressInfo,
  downloadWhisperModelOnce,
} from '../whisper/localWhisperEngine';
import { SessionReportAndPdfView } from './SessionReportAndPdfView';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileJson,
  MapPin,
  Plus,
  RotateCcw,
  Settings,
  Trash2,
  Upload,
} from 'lucide-react';

interface HorsesAndBackupViewProps {
  horses: HorseProfile[];
  sessions: BodyworkSession[];
  activeHorseId: string;
  activeSessionId: string;
  lang: Language;
  /** Bump to bring the selected session's report into view (e.g. "Open report" after Finish). */
  focusReportSignal?: number;
  installedModels: InstalledWhisperModel[];
  onSelectHorseAndSession: (horseId: string, sessionId: string) => void;
  onEditSessionOnMap?: (horseId: string, sessionId: string) => void;
  onUpdateReportSections?: (next: ReportSections, customized: boolean) => void;
  onCreateHorse: (horse: Omit<HorseProfile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateHorse: (horse: HorseProfile) => Promise<void>;
  onDeleteHorse: (horseId: string) => Promise<void>;
  onCreateSessionForHorse: (horseId: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onDeleteDemoCase: () => Promise<void>;
  onRestoreDemoCase: () => Promise<void>;
  onExportBackup: () => Promise<void>;
  onImportBackupFile: (file: File) => Promise<{ ok: boolean; message: string }>;
  onRefreshModels: () => Promise<void>;
}

export const HorsesAndBackupView: React.FC<HorsesAndBackupViewProps> = ({
  horses,
  sessions,
  activeHorseId,
  activeSessionId,
  lang,
  focusReportSignal = 0,
  installedModels,
  onSelectHorseAndSession,
  onEditSessionOnMap,
  onUpdateReportSections,
  onCreateHorse,
  onUpdateHorse,
  onDeleteHorse,
  onCreateSessionForHorse,
  onDeleteSession,
  onDeleteDemoCase,
  onRestoreDemoCase,
  onExportBackup,
  onImportBackupFile,
  onRefreshModels,
}) => {
  const t = TRANSLATIONS[lang];
  const [showNewHorseForm, setShowNewHorseForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newBreed, setNewBreed] = useState('');
  const [newJob, setNewJob] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [backupFeedback, setBackupFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const summarySectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (focusReportSignal > 0) {
      summarySectionRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [focusReportSignal]);

  // Collapsible Settings & Backup State
  const [showSettingsAndBackup, setShowSettingsAndBackup] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [modelActionError, setModelActionError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const installedBaseModel = installedModels.find(
    (m) => m.id === 'whisper-base'
  );
  const isModelInstalled = Boolean(installedBaseModel);

  const selectedHorse =
    horses.find((h) => h.id === activeHorseId) ?? horses[0] ?? null;
  const horseSessions = selectedHorse
    ? sessions
        .filter((s) => s.horseId === selectedHorse.id)
        .sort((a, b) => b.sessionNumber - a.sessionNumber)
    : [];
  const selectedSession =
    horseSessions.find((s) => s.id === activeSessionId) ??
    horseSessions[0] ??
    null;

  const hasDemoCase = horses.some((h) => h.id === DEMO_HORSE_ID || h.isDemo);

  const handleAddHorseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setFormError(
        lang === 'ru'
          ? 'Пожалуйста, укажите кличку лошади.'
          : 'Please enter the horse name.'
      );
      return;
    }
    setFormError(null);
    await onCreateHorse({
      name: newName.trim(),
      age: newAge.trim(),
      breed: newBreed.trim(),
      job: newJob.trim(),
      owner: newOwner.trim(),
      contactInfo: newContact.trim(),
      notes: newNotes.trim(),
    });
    setNewName('');
    setNewAge('');
    setNewBreed('');
    setNewJob('');
    setNewOwner('');
    setNewContact('');
    setNewNotes('');
    setShowNewHorseForm(false);
  };

  const handleDownloadModel = async () => {
    setModelActionError(null);
    setIsDownloading(true);
    setDownloadProgress({
      modelId: 'whisper-base',
      currentFile: 'onnx',
      loadedBytes: 0,
      totalBytes: 76 * 1024 * 1024,
      percent: 0,
    });
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await downloadWhisperModelOnce(
        'whisper-base',
        (info) => setDownloadProgress(info),
        controller.signal
      );
      await onRefreshModels();
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setModelActionError(
          err instanceof Error ? err.message : 'Download failed.'
        );
      }
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
      abortControllerRef.current = null;
    }
  };

  const handleDeleteModel = async () => {
    setModelActionError(null);
    await deleteInstalledWhisperModel('whisper-base');
    await onRefreshModels();
  };

  return (
    <div className="space-y-6">
      {/* Selected session's report comes first: it is what Finish hands off to.
          SELECTED SESSION SUMMARY, EVALUATED ZONES BREAKDOWN & OFFLINE A4 PDF EXPORT */}
      {selectedHorse && selectedSession && onUpdateReportSections && (
        <div ref={summarySectionRef} className="scroll-mt-16">
          <SessionReportAndPdfView
            horse={selectedHorse}
            session={selectedSession}
            lang={lang}
            onUpdateReportSections={onUpdateReportSections}
            onEditOnMap={
              onEditSessionOnMap
                ? () => onEditSessionOnMap(selectedHorse.id, selectedSession.id)
                : undefined
            }
          />
        </div>
      )}

      {/* Top Row: Horses List + Selected Horse Persistent Profile & Session History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 4 cols: Horse Roster */}
        <div className="lg:col-span-4 rounded-xl border border-slate-300 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-base font-semibold text-[#1E2421]">
              {lang === 'ru' ? `Лошади (${horses.length})` : `Horses (${horses.length})`}
            </h2>
            <button
              type="button"
              data-testid="new-horse-btn"
              onClick={() => setShowNewHorseForm((v) => !v)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2B4C3F] hover:bg-[#223D32] text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.newHorse.replace('+ ', '')}</span>
            </button>
          </div>

          {showNewHorseForm && (
            <form
              onSubmit={handleAddHorseSubmit}
              className="p-3.5 rounded-lg bg-[#FAF9F6] border border-slate-300 space-y-2.5 text-xs"
            >
              <div className="font-semibold text-[#2B4C3F]">
                {lang === 'ru' ? 'Новый профиль лошади' : 'New Horse Profile'}
              </div>
              {formError && (
                <div className="p-2 rounded bg-red-50 text-red-700 border border-red-200">
                  {formError}
                </div>
              )}
              <input
                type="text"
                placeholder={`${t.horseLabel} *`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={t.ageLabel}
                  value={newAge}
                  onChange={(e) => setNewAge(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5"
                />
                <input
                  type="text"
                  placeholder={t.breedLabel}
                  value={newBreed}
                  onChange={(e) => setNewBreed(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5"
                />
              </div>
              <input
                type="text"
                placeholder={t.jobLabel}
                value={newJob}
                onChange={(e) => setNewJob(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5"
              />
              <input
                type="text"
                placeholder={t.ownerLabel}
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5"
              />
              <input
                type="text"
                placeholder={t.contactLabel}
                value={newContact}
                onChange={(e) => setNewContact(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewHorseForm(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-[#2B4C3F] text-white font-semibold cursor-pointer"
                >
                  Save Horse
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {horses.map((h) => {
              const count = sessions.filter((s) => s.horseId === h.id).length;
              const isSelected = h.id === selectedHorse?.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  data-testid={`horse-roster-item-${h.id}`}
                  onClick={() => {
                    const firstSession = sessions
                      .filter((s) => s.horseId === h.id)
                      .sort((a, b) => b.sessionNumber - a.sessionNumber)[0];
                    onSelectHorseAndSession(h.id, firstSession?.id ?? '');
                  }}
                  className={`w-full p-3 rounded-lg border text-xs text-left cursor-pointer transition-colors flex items-center justify-between ${
                    isSelected
                      ? 'border-[#2B4C3F] bg-[#2B4C3F]/8'
                      : 'border-slate-200 bg-[#FAF9F6] hover:bg-slate-100/70'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-[#1E2421] text-sm">
                      {h.name}
                      {h.isDemo ? ' (Demo)' : ''}
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      {[h.breed, h.age ? `${h.age} yrs` : '', h.job]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <div className="text-right font-tabular text-slate-600">
                    {count} {count === 1 ? 'session' : 'sessions'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Demo Case Delete / Restore Controls */}
          <div className="pt-3 border-t border-slate-200">
            {hasDemoCase ? (
              <button
                type="button"
                onClick={onDeleteDemoCase}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50/70 hover:bg-red-100 text-red-800 text-xs font-medium cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.deleteDemo} (Yannis)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onRestoreDemoCase}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-[#FAF9F6] hover:bg-slate-100 text-slate-700 text-xs font-medium cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.restoreDemo} (Yannis)</span>
              </button>
            )}
          </div>
        </div>

        {/* Right 8 cols: Selected Horse Profile & Session History */}
        <div className="lg:col-span-8 space-y-6">
          {selectedHorse ? (
            <>
              <div className="rounded-xl border border-slate-300 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-base font-semibold text-[#1E2421]">
                      {lang === 'ru'
                        ? `Профиль лошади: ${selectedHorse.name}`
                        : `Horse Profile: ${selectedHorse.name}`}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {lang === 'ru'
                        ? 'Постоянная карточка лошади (общая для всех сессий).'
                        : 'Persistent horse record shared across all sessions for this horse.'}
                    </p>
                  </div>
                  {!selectedHorse.isDemo && (
                    <button
                      type="button"
                      onClick={() => onDeleteHorse(selectedHorse.id)}
                      className="px-2.5 py-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium cursor-pointer"
                    >
                      Delete Horse
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">
                      {t.horseLabel}
                    </label>
                    <input
                      type="text"
                      value={selectedHorse.name}
                      onChange={(e) =>
                        void onUpdateHorse({ ...selectedHorse, name: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-[#FAF9F6] px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">
                      {t.ageLabel}
                    </label>
                    <input
                      type="text"
                      value={selectedHorse.age}
                      onChange={(e) =>
                        void onUpdateHorse({ ...selectedHorse, age: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-[#FAF9F6] px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">
                      {t.breedLabel}
                    </label>
                    <input
                      type="text"
                      value={selectedHorse.breed}
                      onChange={(e) =>
                        void onUpdateHorse({ ...selectedHorse, breed: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-[#FAF9F6] px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">
                      {t.jobLabel}
                    </label>
                    <input
                      type="text"
                      value={selectedHorse.job}
                      onChange={(e) =>
                        void onUpdateHorse({ ...selectedHorse, job: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-[#FAF9F6] px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">
                      {t.ownerLabel}
                    </label>
                    <input
                      type="text"
                      value={selectedHorse.owner}
                      onChange={(e) =>
                        void onUpdateHorse({ ...selectedHorse, owner: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-[#FAF9F6] px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">
                      {t.contactLabel}
                    </label>
                    <input
                      type="text"
                      value={selectedHorse.contactInfo}
                      onChange={(e) =>
                        void onUpdateHorse({
                          ...selectedHorse,
                          contactInfo: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-[#FAF9F6] px-3 py-2"
                    />
                  </div>
                </div>

                <div className="text-xs">
                  <label className="block font-medium text-slate-600 mb-1">
                    {lang === 'ru' ? 'Дополнительные заметки о лошади' : 'Additional Horse Notes'}
                  </label>
                  <textarea
                    rows={2}
                    value={selectedHorse.notes}
                    onChange={(e) =>
                      void onUpdateHorse({ ...selectedHorse, notes: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-[#FAF9F6] p-2.5"
                  />
                </div>
              </div>

              {/* Session History for Selected Horse */}
              <div className="rounded-xl border border-slate-300 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#1E2421]">
                      {lang === 'ru'
                        ? `История сессий — ${selectedHorse.name} (${horseSessions.length})`
                        : `Session History — ${selectedHorse.name} (${horseSessions.length})`}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {lang === 'ru'
                        ? 'Выберите сессию для просмотра сводки, детализации зон и экспорта PDF A4.'
                        : 'Select a session below to view its evaluated zones breakdown and export A4 PDF.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="new-session-btn"
                    onClick={() => onCreateSessionForHorse(selectedHorse.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2B4C3F] hover:bg-[#223D32] text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.newSession.replace('+ ', '')}</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {horseSessions.map((sess) => {
                    const isCurrent = sess.id === selectedSession?.id;
                    return (
                      <div
                        key={sess.id}
                        data-testid={`session-history-row-${sess.id}`}
                        onClick={() => {
                          onSelectHorseAndSession(selectedHorse.id, sess.id);
                          summarySectionRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                        }}
                        className={`p-3.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isCurrent
                            ? 'border-[#2B4C3F] bg-[#2B4C3F]/8 ring-1 ring-[#2B4C3F]/30'
                            : 'border-slate-200 bg-[#FAF9F6] hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-[#1E2421] text-sm flex items-center gap-2">
                            <span>
                              Session #{sess.sessionNumber} · {sess.date}
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-full bg-[#2B4C3F] text-white text-[10px] font-bold">
                                {lang === 'ru' ? 'Выбрана' : 'Selected'}
                              </span>
                            )}
                          </div>
                          <div className="text-slate-600">
                            {t.studentLabel}: {sess.practitioner || '—'} ·{' '}
                            {t.durationLabel}: {sess.duration || '—'}
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            data-testid={`session-view-summary-btn-${sess.id}`}
                            onClick={() => {
                              onSelectHorseAndSession(selectedHorse.id, sess.id);
                              summarySectionRef.current?.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start',
                              });
                            }}
                            className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                              isCurrent
                                ? 'bg-[#2B4C3F] text-white'
                                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {lang === 'ru' ? 'Сводка и PDF' : 'Summary & PDF'}
                          </button>

                          {onEditSessionOnMap && (
                            <button
                              type="button"
                              data-testid={`session-edit-map-btn-${sess.id}`}
                              onClick={() =>
                                onEditSessionOnMap(selectedHorse.id, sess.id)
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#2B4C3F] bg-white hover:bg-[#2B4C3F]/10 text-[#2B4C3F] font-semibold cursor-pointer"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{lang === 'ru' ? 'На карту' : 'Edit on Map'}</span>
                            </button>
                          )}

                          {horseSessions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => onDeleteSession(sess.id)}
                              className="p-1.5 text-slate-400 hover:text-red-700 rounded cursor-pointer"
                              aria-label={`Delete Session ${sess.sessionNumber}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              {lang === 'ru'
                ? 'Добавьте лошадь или восстановите демонстрационный кейс Yannis.'
                : 'Create a horse profile on the left or restore the Yannis demonstration case.'}
            </div>
          )}
        </div>
      </div>

      {/* COLLAPSIBLE SETTINGS & BACKUP (Minimalist Offline Speech Model + JSON Backup/Restore) */}
      <div
        data-testid="settings-and-backup-section"
        className="no-print rounded-xl border border-slate-300 bg-white overflow-hidden"
      >
        <button
          type="button"
          data-testid="toggle-settings-backup-btn"
          onClick={() => setShowSettingsAndBackup((v) => !v)}
          className="w-full p-5 flex items-center justify-between text-left hover:bg-[#FAF9F6] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-[#2B4C3F] shrink-0" />
            <div>
              <h3 className="text-base font-semibold text-[#1E2421]">
                {lang === 'ru'
                  ? 'Настройки и резервное копирование'
                  : 'Settings & Backup'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {lang === 'ru'
                  ? 'Офлайн-модель распознавания речи и экспорт/импорт резервной копии JSON.'
                  : 'Offline speech recognition model and portable JSON backup & restore.'}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2B4C3F]/10 text-[#2B4C3F] text-xs font-semibold">
            <span>
              {showSettingsAndBackup
                ? lang === 'ru'
                  ? 'Скрыть'
                  : 'Hide'
                : lang === 'ru'
                  ? 'Открыть'
                  : 'Open'}
            </span>
            {showSettingsAndBackup ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </span>
        </button>

        {showSettingsAndBackup && (
          <div className="px-5 pb-5 pt-2 border-t border-slate-200 space-y-5">
            {/* 1. Minimalist Offline Speech Model Control (3 States Only) */}
            <div
              data-testid="minimalist-speech-model-card"
              className="p-4 rounded-xl bg-[#FAF9F6] border border-slate-200 flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <div className="text-sm font-semibold text-[#1E2421]">
                  {lang === 'ru'
                    ? 'Офлайн-распознавание голоса (RU / EN)'
                    : 'Offline Speech Recognition (EN / RU)'}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'ru'
                    ? 'Позволяет расшифровывать голосовые заметки без интернета прямо на устройстве.'
                    : 'Transcribes voice clips directly on your device without an internet connection.'}
                </p>
              </div>

              <div className="flex flex-col sm:items-end gap-2 min-w-[240px]">
                {isDownloading ? (
                  /* State 2: Downloading (progress bar + percentage) */
                  <div
                    data-testid="speech-model-progress"
                    className="w-full sm:w-64 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-[#2B4C3F] font-tabular">
                      <span>
                        {lang === 'ru' ? 'Загрузка...' : 'Downloading...'}
                      </span>
                      <span>{downloadProgress?.percent ?? 0}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-[#2B4C3F] transition-all"
                        style={{ width: `${downloadProgress?.percent ?? 0}%` }}
                      />
                    </div>
                  </div>
                ) : isModelInstalled ? (
                  /* State 3: Installed (Downloaded · Ready Offline badge + compact Delete Model button) */
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      data-testid="speech-model-ready-badge"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>
                        {lang === 'ru'
                          ? 'Скачано · Готово офлайн'
                          : 'Downloaded · Ready Offline'}
                      </span>
                    </span>
                    <button
                      type="button"
                      data-testid="delete-speech-model-btn"
                      onClick={() => void handleDeleteModel()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 text-xs font-semibold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t.deleteModel}</span>
                    </button>
                  </div>
                ) : (
                  /* State 1: Not installed (Download Offline Speech Model (~76 MB) button) */
                  <button
                    type="button"
                    data-testid="download-speech-model-btn"
                    onClick={() => void handleDownloadModel()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2B4C3F] hover:bg-[#223D32] text-white text-xs font-semibold cursor-pointer shadow-2xs"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>
                      {lang === 'ru'
                        ? 'Скачать офлайн-модель речи (~76 МБ)'
                        : 'Download Offline Speech Model (~76 MB)'}
                    </span>
                  </button>
                )}

                {modelActionError && (
                  <div className="text-xs text-red-700 font-medium">
                    {modelActionError}
                  </div>
                )}
              </div>
            </div>

            {/* 2. JSON Backup & Restore Cleanly Below */}
            <div className="p-4 rounded-xl bg-[#FAF9F6] border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <FileJson className="w-5 h-5 text-[#2B4C3F] shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold text-[#1E2421]">
                      {lang === 'ru'
                        ? 'Локальное резервное копирование и восстановление (JSON)'
                        : 'Offline JSON Backup & Restore'}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {lang === 'ru'
                        ? 'Экспортируйте все профили лошадей, сессии, рисунки и аудиозаписи в один JSON-файл.'
                        : 'Export all horse profiles, evaluation tables, vector drawings, and voice clips to a single portable JSON file.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    data-testid="export-json-backup-btn"
                    onClick={onExportBackup}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2B4C3F] hover:bg-[#223D32] text-white text-xs font-semibold cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t.exportJsonBtn}</span>
                  </button>

                  <input
                    ref={backupInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      const res = await onImportBackupFile(file);
                      setBackupFeedback(res);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    data-testid="import-json-backup-btn"
                    onClick={() => backupInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{t.importJsonBtn}</span>
                  </button>
                </div>
              </div>

              {backupFeedback && (
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    backupFeedback.ok
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-red-50 border-red-300 text-red-900'
                  }`}
                >
                  {backupFeedback.message}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
