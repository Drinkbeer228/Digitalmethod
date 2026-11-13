/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { InstalledWhisperModel, Language } from '../types';
import { TRANSLATIONS } from '../data/translations';
import {
  deleteInstalledWhisperModel,
  DownloadProgressInfo,
  downloadWhisperModelOnce,
} from '../whisper/localWhisperEngine';
import {
  CheckCircle2,
  Download,
  FileJson,
  FlaskConical,
  Info,
  Mic,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';

interface SettingsViewProps {
  lang: Language;
  installedModels: InstalledWhisperModel[];
  hasDemoCase: boolean;
  onRefreshModels: () => Promise<void>;
  onExportBackup: () => Promise<void>;
  onImportBackupFile: (file: File) => Promise<{ ok: boolean; message: string }>;
  onDeleteDemoCase: () => Promise<void>;
  onRestoreDemoCase: () => Promise<void>;
}

const CARD = 'rounded-xl border border-slate-300 bg-white p-4 md:p-5 space-y-3';

/** System screen: offline speech model, JSON backup, demo case and About. */
export const SettingsView: React.FC<SettingsViewProps> = ({
  lang,
  installedModels,
  hasDemoCase,
  onRefreshModels,
  onExportBackup,
  onImportBackupFile,
  onDeleteDemoCase,
  onRestoreDemoCase,
}) => {
  const t = TRANSLATIONS[lang];
  const [backupFeedback, setBackupFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [modelActionError, setModelActionError] = useState<string | null>(null);

  const isModelInstalled = installedModels.some((m) => m.id === 'whisper-base');

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
    try {
      await downloadWhisperModelOnce('whisper-base', (info) => setDownloadProgress(info));
      await onRefreshModels();
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setModelActionError(err instanceof Error ? err.message : t.speechModelDownloadFailed);
      }
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const handleDeleteModel = async () => {
    setModelActionError(null);
    await deleteInstalledWhisperModel('whisper-base');
    await onRefreshModels();
  };

  return (
    <div
      data-testid="settings-and-backup-section"
      className="no-print max-w-2xl mx-auto space-y-4"
    >
      <div>
        <h2 className="text-lg font-bold text-[#1E2421]">{t.settingsTitle}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{t.settingsHint}</p>
      </div>

      {/* 1. Offline speech model: not installed / downloading / installed */}
      <section data-testid="minimalist-speech-model-card" className={CARD}>
        <div className="flex items-start gap-3">
          <Mic className="w-5 h-5 text-[#2B4C3F] shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-[#1E2421]">{t.speechModelTitle}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{t.speechModelHint}</p>
          </div>
        </div>

        {isDownloading ? (
          <div data-testid="speech-model-progress" className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-[#2B4C3F] font-tabular">
              <span>{t.speechModelDownloading}</span>
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
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              data-testid="speech-model-ready-badge"
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{t.speechModelReady}</span>
            </span>
            <button
              type="button"
              data-testid="delete-speech-model-btn"
              onClick={() => void handleDeleteModel()}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 text-xs font-semibold cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.deleteModel}</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-testid="download-speech-model-btn"
            onClick={() => void handleDownloadModel()}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-[#2B4C3F] hover:bg-[#223D32] text-white text-xs font-semibold cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>{t.speechModelDownload}</span>
          </button>
        )}

        {modelActionError && (
          <div className="text-xs text-red-700 font-medium">{modelActionError}</div>
        )}
      </section>

      {/* 2. JSON backup & restore */}
      <section className={CARD}>
        <div className="flex items-start gap-3">
          <FileJson className="w-5 h-5 text-[#2B4C3F] shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-[#1E2421]">{t.backupTitle}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{t.backupHint}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            data-testid="export-json-backup-btn"
            onClick={() => void onExportBackup()}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 rounded-lg bg-[#2B4C3F] hover:bg-[#223D32] text-white text-xs font-semibold cursor-pointer"
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
              setBackupFeedback(await onImportBackupFile(file));
            }}
            className="hidden"
          />
          <button
            type="button"
            data-testid="import-json-backup-btn"
            onClick={() => backupInputRef.current?.click()}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{t.importJsonBtn}</span>
          </button>
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
      </section>

      {/* 3. Demo case */}
      <section className={CARD}>
        <div className="flex items-start gap-3">
          <FlaskConical className="w-5 h-5 text-[#2B4C3F] shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-[#1E2421]">{t.demoCaseTitle}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{t.demoCaseHint}</p>
          </div>
        </div>
        {hasDemoCase ? (
          <button
            type="button"
            data-testid="delete-demo-case-btn"
            onClick={() => void onDeleteDemoCase()}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 rounded-lg border border-red-200 bg-red-50/70 hover:bg-red-100 text-red-800 text-xs font-semibold cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.deleteDemo}</span>
          </button>
        ) : (
          <button
            type="button"
            data-testid="restore-demo-case-btn"
            onClick={() => void onRestoreDemoCase()}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 rounded-lg border border-slate-300 bg-[#FAF9F6] hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.restoreDemo}</span>
          </button>
        )}
      </section>

      {/* 4. About / method disclaimer */}
      <section data-testid="about-disclaimer" className={CARD}>
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-[#2B4C3F] shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-[#1E2421]">{t.aboutTitle}</h3>
            <p className="text-xs leading-relaxed text-slate-600">{t.methodDisclaimer}</p>
            <p data-testid="about-credits" className="text-xs leading-relaxed text-slate-600">
              {t.creditsLead}
              <a
                href="https://github.com/tanpreetjolly/browser-whisper"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[#2B4C3F]"
              >
                browser-whisper
              </a>
              {t.creditsBy}
              <a
                href="https://github.com/tanpreetjolly"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[#2B4C3F]"
              >
                Tanpreet Singh Jolly
              </a>
              {t.creditsTail}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
