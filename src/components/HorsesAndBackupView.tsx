/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  BodyworkSession,
  HorseProfile,
  InstalledWhisperModel,
  Language,
} from '../types';
import { TRANSLATIONS } from '../data/translations';
import { DEMO_HORSE_ID } from '../data/demoCase';
import {
  deleteInstalledWhisperModel,
  DownloadProgressInfo,
  downloadWhisperModelOnce,
  hasOPFS,
  importLocalWhisperFiles,
  inspectLegacyWhisperTinyStorage,
  LegacyWhisperTinyStatus,
  removeLegacyWhisperTinyStorage,
  setActiveWhisperModel,
  verifyInstalledModelFiles,
  WHISPER_MODEL_SPECS,
} from '../whisper/localWhisperEngine';
import { db, estimateStorage, StorageEstimate } from '../db/database';
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileJson,
  FolderUp,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';

interface HorsesAndBackupViewProps {
  horses: HorseProfile[];
  sessions: BodyworkSession[];
  activeHorseId: string;
  activeSessionId: string;
  lang: Language;
  installedModels: InstalledWhisperModel[];
  onSelectHorseAndSession: (horseId: string, sessionId: string) => void;
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

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 MB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const HorsesAndBackupView: React.FC<HorsesAndBackupViewProps> = ({
  horses,
  sessions,
  activeHorseId,
  activeSessionId,
  lang,
  installedModels,
  onSelectHorseAndSession,
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

  // Whisper Model Manager State (Collapsible Accordion)
  const [showWhisperSettings, setShowWhisperSettings] = useState(false);
  const [selectedModelToInstall, setSelectedModelToInstall] = useState<'whisper-base'>('whisper-base');
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [importStatus, setImportStatus] = useState<{ percent: number; text: string } | null>(null);
  const [modelActionStatus, setModelActionStatus] = useState<string | null>(null);
  const [modelActionError, setModelActionError] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageEstimate>({ usage: null, quota: null });
  const [legacyTinyStatus, setLegacyTinyStatus] = useState<LegacyWhisperTinyStatus | null>(null);
  const [isRemovingLegacyTiny, setIsRemovingLegacyTiny] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void estimateStorage().then(setStorageInfo);
    void inspectLegacyWhisperTinyStorage().then(setLegacyTinyStatus);
  }, [installedModels.length]);

  const activeSupportedModels = installedModels.filter(
    (m) => (m.id as string) !== 'whisper-tiny'
  );
  const currentSpec = WHISPER_MODEL_SPECS[selectedModelToInstall];

  const selectedHorse =
    horses.find((h) => h.id === activeHorseId) ?? horses[0] ?? null;
  const horseSessions = selectedHorse
    ? sessions
        .filter((s) => s.horseId === selectedHorse.id)
        .sort((a, b) => b.sessionNumber - a.sessionNumber)
    : [];
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
    setModelActionStatus(null);
    setIsDownloading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const installed = await downloadWhisperModelOnce(
        selectedModelToInstall,
        (info) => setDownloadProgress(info),
        controller.signal
      );
      await onRefreshModels();
      setModelActionStatus(
        `Installed & verified ${installed.name} (${formatBytes(installed.sizeBytes)}) in persistent local storage.`
      );
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setModelActionStatus(
          lang === 'ru'
            ? 'Загрузка приостановлена. Уже скачанные файлы сохранены.'
            : 'Download paused/cancelled. Completed files remain cached.'
        );
      } else {
        setModelActionError(
          err instanceof Error ? err.message : 'Download failed.'
        );
      }
    } finally {
      setIsDownloading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelDownload = () => {
    abortControllerRef.current?.abort();
  };

  const handleImportFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    setModelActionError(null);
    setModelActionStatus(null);
    setImportStatus({ percent: 10, text: 'Validating model files...' });

    try {
      const installed = await importLocalWhisperFiles(
        files,
        selectedModelToInstall,
        (p, text) => setImportStatus({ percent: p, text })
      );
      await onRefreshModels();
      setModelActionStatus(`Successfully imported & verified ${installed.name}.`);
    } catch (err) {
      setModelActionError(
        err instanceof Error ? err.message : 'Failed to import local model files.'
      );
    } finally {
      setImportStatus(null);
    }
  };

  const handleRemoveLegacyTiny = async () => {
    setModelActionError(null);
    setModelActionStatus(null);
    setIsRemovingLegacyTiny(true);
    try {
      const res = await removeLegacyWhisperTinyStorage();
      await onRefreshModels();
      const updatedTiny = await inspectLegacyWhisperTinyStorage();
      setLegacyTinyStatus(updatedTiny);
      if (res.removed) {
        setModelActionStatus(
          lang === 'ru'
            ? `Устаревшие файлы Whisper Tiny удалены (${formatBytes(res.freedBytes)} освобождено). Модель Whisper Base сохранена.`
            : `Legacy Whisper Tiny files removed (${formatBytes(res.freedBytes)} reclaimed). Whisper Base was not affected.`
        );
      }
    } catch (err) {
      setModelActionError(
        err instanceof Error ? err.message : 'Failed to remove legacy Whisper Tiny files.'
      );
    } finally {
      setIsRemovingLegacyTiny(false);
    }
  };

  return (
    <div className="space-y-6">
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
                <div
                  key={h.id}
                  onClick={() => {
                    const firstSession = sessions.find((s) => s.horseId === h.id);
                    onSelectHorseAndSession(h.id, firstSession?.id ?? '');
                  }}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors flex items-center justify-between ${
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
                </div>
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
                  <h3 className="text-base font-semibold text-[#1E2421]">
                    {lang === 'ru'
                      ? `История сессий — ${selectedHorse.name} (${horseSessions.length})`
                      : `Session History — ${selectedHorse.name} (${horseSessions.length})`}
                  </h3>
                  <button
                    type="button"
                    onClick={() => onCreateSessionForHorse(selectedHorse.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2B4C3F] hover:bg-[#223D32] text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.newSession.replace('+ ', '')}</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {horseSessions.map((sess) => {
                    const isCurrent = sess.id === activeSessionId;
                    return (
                      <div
                        key={sess.id}
                        className={`p-3.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-3 ${
                          isCurrent
                            ? 'border-[#2B4C3F] bg-[#2B4C3F]/8'
                            : 'border-slate-200 bg-[#FAF9F6]'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-[#1E2421] text-sm">
                            Session #{sess.sessionNumber} · {sess.date}
                            {sess.caseStudyNumber ? ` (${sess.caseStudyNumber})` : ''}
                          </div>
                          <div className="text-slate-600">
                            {t.studentLabel}: {sess.practitioner || '—'} ·{' '}
                            {t.durationLabel}: {sess.duration || '—'} · Annotations:{' '}
                            {sess.annotations.length}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onSelectHorseAndSession(selectedHorse.id, sess.id)
                            }
                            className="px-3.5 py-1.5 rounded-lg bg-[#2B4C3F] text-white font-semibold cursor-pointer"
                          >
                            {isCurrent
                              ? lang === 'ru'
                                ? 'Открыта'
                                : 'Open in Editor'
                              : lang === 'ru'
                                ? 'Открыть сессию'
                                : 'Switch to Session'}
                          </button>
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

      {/* WHISPER MODEL MANAGEMENT (COLLAPSIBLE SETTINGS ACCORDION) */}
      <div className="rounded-xl border border-slate-300 bg-white p-5 space-y-4">
        <div
          className="flex items-center justify-between cursor-pointer border-b border-slate-200 pb-3"
          onClick={() => setShowWhisperSettings((v) => !v)}
        >
          <div>
            <h3 className="text-base font-semibold text-[#1E2421]">
              {t.whisperSettingsTitle} (Local ONNX Whisper Models)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'ru'
                ? 'Настройка и скачивание локальных ONNX моделей для распознавания речи в полевых условиях.'
                : 'Manage local multilingual ONNX Whisper models for offline speech-to-text transcription.'}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2B4C3F]/10 text-[#2B4C3F] text-xs font-semibold cursor-pointer"
          >
            <span>{showWhisperSettings ? (lang === 'ru' ? 'Скрыть настройки' : 'Hide Settings') : (lang === 'ru' ? 'Настроить Whisper' : 'Configure Whisper')}</span>
            {showWhisperSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {legacyTinyStatus?.hasLegacyTiny && (
          <div
            data-testid="legacy-whisper-tiny-cleanup"
            className="p-3 rounded-lg bg-amber-50 border border-amber-300 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950"
          >
            <div>
              <div className="font-semibold">
                {lang === 'ru'
                  ? 'Обнаружены устаревшие локальные файлы Whisper Tiny'
                  : 'Legacy local Whisper Tiny files detected'}
              </div>
              <div className="text-[11px] text-amber-800 mt-0.5">
                {lang === 'ru'
                  ? `Модель Whisper Tiny больше не используется (${formatBytes(legacyTinyStatus.estimatedBytes)}). Вы можете безопасно удалить её, не затрагивая Whisper Base.`
                  : `Whisper Tiny is no longer used (${formatBytes(legacyTinyStatus.estimatedBytes)}). You can safely remove it without affecting Whisper Base.`}
              </div>
            </div>
            <button
              type="button"
              disabled={isRemovingLegacyTiny}
              onClick={handleRemoveLegacyTiny}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900 hover:bg-amber-950 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {isRemovingLegacyTiny
                  ? lang === 'ru' ? 'Удаление...' : 'Removing...'
                  : lang === 'ru' ? 'Удалить Whisper Tiny' : 'Remove Whisper Tiny'}
              </span>
            </button>
          </div>
        )}

        {showWhisperSettings && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            {/* Left side of accordion: Model Selection & Download / Import */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  {lang === 'ru'
                    ? 'Выберите мультиязычную ONNX модель (RU / EN):'
                    : 'Select Multilingual ONNX Whisper Model (EN / RU):'}
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(() => {
                    const mId = 'whisper-base' as const;
                    const spec = WHISPER_MODEL_SPECS[mId];
                    return (
                      <label
                        key={mId}
                        className="flex items-start gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition-colors border-[#2B4C3F] bg-[#2B4C3F]/8"
                      >
                        <input
                          type="radio"
                          name="whisper-model-size-acc"
                          checked={true}
                          readOnly
                          className="mt-0.5 accent-[#2B4C3F]"
                        />
                        <div>
                          <div className="font-semibold text-[#1E2421]">
                            {spec.hfRepo}{' '}
                            <span className="font-mono text-[10px] text-slate-500">
                              @{spec.revision.slice(0, 8)}
                            </span>
                          </div>
                          <div className="text-slate-600 mt-0.5">
                            {t.modelBaseDesc}
                          </div>
                        </div>
                      </label>
                    );
                  })()}
                </div>
              </div>

              {/* Option 1 & 2 */}
              <div className="space-y-2.5">
                <div className="p-3 rounded-lg bg-[#FAF9F6] border border-slate-200 space-y-2">
                  <div className="text-xs font-semibold text-slate-700">
                    Option 1 — One-Time Download ({currentSpec.hfRepo}@{currentSpec.revision.slice(0, 8)})
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isDownloading}
                      onClick={handleDownloadModel}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-[#2B4C3F] hover:bg-[#223D32] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Download className="w-4 h-4 shrink-0" />
                      <span>Download model once for offline use</span>
                    </button>
                    {isDownloading && (
                      <button
                        type="button"
                        onClick={handleCancelDownload}
                        className="px-3 py-2 rounded-lg border border-red-300 bg-red-50 text-red-700 text-xs font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {downloadProgress && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px] font-tabular text-slate-600">
                        <span>
                          {downloadProgress.modelId}: {downloadProgress.currentFile}
                        </span>
                        <span>
                          {downloadProgress.percent}% ({formatBytes(downloadProgress.loadedBytes)} / {formatBytes(downloadProgress.totalBytes)})
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-[#2B4C3F] transition-all"
                          style={{ width: `${downloadProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-[#FAF9F6] border border-slate-200 space-y-2">
                  <div className="text-xs font-semibold text-slate-700">
                    Option 2 — Local ONNX Bundle Import (USB / AirDrop)
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".onnx,.json,.bin"
                    onChange={handleImportFilesSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-[#2B4C3F] bg-white hover:bg-[#2B4C3F]/10 text-[#2B4C3F] text-xs font-semibold cursor-pointer"
                  >
                    <FolderUp className="w-4 h-4 shrink-0" />
                    <span>Import local ONNX model files</span>
                  </button>

                  {importStatus && (
                    <div className="text-xs text-[#2B4C3F] font-medium">
                      {importStatus.percent}% — {importStatus.text}
                    </div>
                  )}
                </div>
              </div>

              {modelActionStatus && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>{modelActionStatus}</span>
                </div>
              )}

              {modelActionError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-300 text-xs text-red-900">
                  {modelActionError}
                </div>
              )}
            </div>

            {/* Right side of accordion: Installed Models Management List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">{t.installedModels}</span>
                <span className="text-slate-500 font-tabular">
                  {hasOPFS() ? 'OPFS Primary' : 'IndexedDB'} · {storageInfo.usage ? formatBytes(storageInfo.usage) : 'Local'}
                </span>
              </div>

              {activeSupportedModels.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 text-center">
                  {t.noModelsInstalled}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeSupportedModels.map((m) => (
                    <div
                      key={m.id}
                      className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                        m.active
                          ? 'border-[#2B4C3F] bg-[#2B4C3F]/5'
                          : 'border-slate-200 bg-[#FAF9F6]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-[#1E2421]">{m.name}</div>
                        <span className={`text-[11px] font-semibold ${m.verified ? 'text-[#2B4C3F]' : 'text-red-700'}`}>
                          {m.verified ? (m.active ? `${t.activeModelBadge} · VERIFIED` : 'VERIFIED') : 'UNVERIFIED'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 font-tabular">
                        Repo: {m.hfRepo || `onnx-community/${m.id}`} ({m.format.toUpperCase()} · {formatBytes(m.sizeBytes)})
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        {!m.active && (
                          <button
                            type="button"
                            onClick={async () => {
                              await setActiveWhisperModel(m.id);
                              await onRefreshModels();
                            }}
                            className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
                          >
                            {t.setActiveModel}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            setModelActionError(null);
                            setModelActionStatus('Running local ONNX inference test...');
                            const res = await verifyInstalledModelFiles(m.id, m.fileNames);
                            await db.whisperModels.update(m.id, {
                              verified: res.verified,
                              verificationDetail: res.detail,
                            });
                            await onRefreshModels();
                            if (res.verified) {
                              setModelActionStatus(res.detail);
                            } else {
                              setModelActionStatus(null);
                              setModelActionError(res.detail);
                            }
                          }}
                          className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
                        >
                          {t.verifyModel}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteInstalledWhisperModel(m.id);
                            await onRefreshModels();
                          }}
                          className="px-2.5 py-1 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-medium cursor-pointer"
                        >
                          {t.deleteModel}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row: JSON Backup & Restore + Open-Source Repository Attributions */}
      <div className="rounded-xl border border-slate-300 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileJson className="w-5 h-5 text-[#2B4C3F]" />
            <div>
              <h3 className="text-base font-semibold text-[#1E2421]">
                {lang === 'ru'
                  ? 'Локальное резервное копирование и восстановление (JSON)'
                  : 'Offline JSON Backup & Restore'}
              </h3>
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
              onClick={() => backupInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-[#FAF9F6] hover:bg-slate-100 text-slate-800 text-xs font-semibold cursor-pointer"
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

        {/* Preserved Open-Source License Attributions from Attached Repositories */}
        <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-500 leading-relaxed">
          <strong>Open-Source Notices & Reused Architecture (MIT Licensed):</strong>{' '}
          Storage durability & validated JSON backup patterns adapted from{' '}
          <em>pwa-starter-kit</em> and <em>FormsOffline</em> (Copyright © 2026
          Deekshith Vodela, MIT License). Local OPFS model cache, 16 kHz linear
          audio resampler, and ONNX Whisper pipeline adapted from{' '}
          <em>browser-whisper</em> (Copyright © 2026 Tanpreet Singh Jolly, MIT
          License). GGML <code>.bin</code> magic header detection adapted from{' '}
          <em>whisper.cpp</em> (Copyright © 2023–2026 The ggml authors, MIT
          License).
        </div>
      </div>
    </div>
  );
};
