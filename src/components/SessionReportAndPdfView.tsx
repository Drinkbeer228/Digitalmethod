import React, { useEffect, useState } from 'react';
import {
  AnatomicalAreaId,
  AreaSideObservation,
  BodyworkSession,
  HorseProfile,
  Language,
  ReportSections,
  SessionPhoto,
  SessionPhotoKind,
  Side,
} from '../types';
import { SessionPhotosPanel } from './SessionPhotosPanel';
import { ANATOMICAL_AREAS, ANATOMICAL_REGIONS } from '../data/anatomicalAreas';
import {
  formatChipLabel,
  MASTERSON_TECHNIQUES,
  MORE_RELEASE_SIGNS,
  QUICK_RELEASE_CHIPS,
  RESISTANCE_SIGNS,
  TRANSLATIONS,
} from '../data/translations';
import { HorseSilhouetteSvg } from './HorseSilhouetteSvg';
import { buildReportFromSession } from '../utils/reportGenerator';
import {
  buildSessionPdfFile,
  shareOrDownloadPdfFile,
  triggerPdfFileDownload,
} from '../utils/pdfExport';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  MapPin,
  Printer,
  RefreshCw,
  Share2,
} from 'lucide-react';

interface SessionReportAndPdfViewProps {
  horse: HorseProfile;
  session: BodyworkSession;
  lang: Language;
  onUpdateReportSections: (next: ReportSections, customized: boolean) => void;
  onEditOnMap?: () => void;
  photos?: SessionPhoto[];
  onAddPhotos?: (kind: SessionPhotoKind, files: File[]) => Promise<void>;
  onDeletePhoto?: (photoId: string) => Promise<void>;
}

interface MarkedZoneEntry {
  areaId: AnatomicalAreaId;
  index: number;
  nameEn: string;
  nameRu: string;
  regionNameEn: string;
  regionNameRu: string;
  pastelFill: string;
  pastelStroke: string;
  side: Side;
  obs: AreaSideObservation;
}

// Stable empty default so the PDF pre-build effect does not re-run on every render
const NO_PHOTOS: SessionPhoto[] = [];

const ALL_RELEASE_CHIP_DEFS = [...QUICK_RELEASE_CHIPS, ...MORE_RELEASE_SIGNS];

function localizeReleaseSign(rawEn: string, yawnCount: number | undefined, lang: Language): string {
  const found = ALL_RELEASE_CHIP_DEFS.find(
    (c) => c.en.toLowerCase() === rawEn.toLowerCase()
  );
  const label = found ? formatChipLabel(found, lang) : rawEn;
  if (found?.supportsCounter && yawnCount && yawnCount > 1) {
    return `${label} ×${yawnCount}`;
  }
  return label;
}

function localizeResistanceSign(rawEn: string, lang: Language): string {
  const found = RESISTANCE_SIGNS.find(
    (c) => c.en.toLowerCase() === rawEn.toLowerCase()
  );
  return found ? formatChipLabel(found, lang) : rawEn;
}

function localizeTechnique(rawEn: string, lang: Language): string {
  const found = MASTERSON_TECHNIQUES.find(
    (c) => c.en.toLowerCase() === rawEn.toLowerCase()
  );
  return found ? formatChipLabel(found, lang) : rawEn;
}

export const SessionReportAndPdfView: React.FC<SessionReportAndPdfViewProps> = ({
  horse,
  session,
  lang,
  onUpdateReportSections,
  onEditOnMap,
  photos = NO_PHOTOS,
  onAddPhotos,
  onDeletePhoto,
}) => {
  const t = TRANSLATIONS[lang];
  const [preBuiltPdfFile, setPreBuiltPdfFile] = useState<File | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [exportStatusMsg, setExportStatusMsg] = useState<string | null>(null);
  const [showNarrativeSections, setShowNarrativeSections] = useState(false);

  // Pre-build the unified A4 PDF File in the background whenever horse/session/lang changes
  // so Web Share API on iOS Safari can be invoked synchronously inside the tap gesture.
  useEffect(() => {
    let cancelled = false;
    setPreBuiltPdfFile(null);
    void (async () => {
      try {
        const file = await buildSessionPdfFile(horse, session, 'unified', lang, photos);
        if (!cancelled) {
          setPreBuiltPdfFile(file);
        }
      } catch (err) {
        console.error('Failed to pre-build A4 PDF:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [horse, session, lang, photos]);

  const handleSyncFromEvaluation = () => {
    const generated = buildReportFromSession(session, lang);
    onUpdateReportSections(generated, false);
  };

  const handleChangeSection = (key: keyof ReportSections, value: string) => {
    onUpdateReportSections(
      {
        ...session.reportSections,
        [key]: value,
      },
      true
    );
  };

  const handleSaveOrSharePdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const pdfFile =
        preBuiltPdfFile ??
        (await buildSessionPdfFile(horse, session, 'unified', lang, photos));
      const outcome = await shareOrDownloadPdfFile(
        pdfFile,
        `Masterson Method Report — ${horse.name}`
      );
      if (outcome !== 'aborted') {
        setExportStatusMsg(
          outcome === 'shared'
            ? lang === 'ru'
              ? 'PDF отправлен через системное меню'
              : 'PDF shared via system sheet'
            : lang === 'ru'
              ? `Скачан файл ${pdfFile.name}`
              : `Downloaded ${pdfFile.name}`
        );
        setTimeout(() => setExportStatusMsg(null), 3500);
      }
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDirectDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const pdfFile =
        preBuiltPdfFile ??
        (await buildSessionPdfFile(horse, session, 'unified', lang, photos));
      triggerPdfFileDownload(pdfFile);
      setExportStatusMsg(
        lang === 'ru' ? `Скачан файл ${pdfFile.name}` : `Downloaded ${pdfFile.name}`
      );
      setTimeout(() => setExportStatusMsg(null), 3500);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Build flat list of all marked zone+side entries for the Evaluated Zones Breakdown
  const markedZoneEntries: MarkedZoneEntry[] = [];
  for (const area of ANATOMICAL_AREAS) {
    const row = session.evaluationTable[area.id];
    if (!row) continue;
    const region = ANATOMICAL_REGIONS.find((r) => r.id === area.regionId);
    for (const side of ['left', 'right'] as Side[]) {
      const obs = row[side];
      const hasAny =
        Boolean(obs.reaction) ||
        obs.restriction ||
        obs.released ||
        Boolean(obs.releaseSigns && obs.releaseSigns.length > 0) ||
        Boolean(obs.resistanceSigns && obs.resistanceSigns.length > 0) ||
        Boolean(obs.techniques && obs.techniques.length > 0) ||
        Boolean(obs.note?.trim());
      if (hasAny) {
        markedZoneEntries.push({
          areaId: area.id,
          index: area.index,
          nameEn: area.nameEn,
          nameRu: area.nameRu,
          regionNameEn: region?.nameEn ?? '',
          regionNameRu: region?.nameRu ?? '',
          pastelFill: region?.pastelFill ?? '#F3F1EC',
          pastelStroke: region?.pastelStroke ?? '#CBD5E1',
          side,
          obs,
        });
      }
    }
  }

  // Clean metadata items (omits empty optional fields)
  const cleanMetaItems: Array<{ label: string; value: string; accent?: boolean }> = [
    { label: t.horseLabel, value: horse.name || 'Unnamed Horse', accent: true },
    { label: t.sessionNum, value: `#${session.sessionNumber}`, accent: true },
    { label: t.dateLabel, value: session.date },
  ];
  if (horse.breed?.trim()) cleanMetaItems.push({ label: t.breedLabel, value: horse.breed });
  if (horse.age?.trim()) cleanMetaItems.push({ label: t.ageLabel, value: horse.age });
  if (horse.job?.trim()) {
    cleanMetaItems.push({ label: t.jobLabel, value: horse.job, accent: true });
  }
  if (session.practitioner?.trim()) {
    cleanMetaItems.push({ label: t.studentLabel, value: session.practitioner });
  }
  if (horse.owner?.trim()) cleanMetaItems.push({ label: t.ownerLabel, value: horse.owner });
  if (horse.contactInfo?.trim()) {
    cleanMetaItems.push({ label: t.contactLabel, value: horse.contactInfo });
  }
  if (session.duration?.trim()) {
    cleanMetaItems.push({ label: t.durationLabel, value: session.duration });
  }

  return (
    <div
      data-testid="session-summary-and-export-view"
      className="space-y-6"
    >
      {/* Top Action Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-slate-300 bg-white shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="text-sm md:text-base font-bold text-[#1E2421]">
              {lang === 'ru'
                ? `Сводка сессии №${session.sessionNumber} и PDF — ${horse.name}`
                : `Session #${session.sessionNumber} Summary & PDF — ${horse.name}`}
            </div>
            <div className="text-xs text-slate-500 font-tabular">
              {session.date} ·{' '}
              {lang === 'ru'
                ? `Отмечено зон: ${markedZoneEntries.length}`
                : `${markedZoneEntries.length} marked zone side(s)`}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {exportStatusMsg && (
            <span
              data-testid="pdf-export-status"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{exportStatusMsg}</span>
            </span>
          )}

          {onEditOnMap && (
            <button
              type="button"
              data-testid="edit-on-map-btn"
              onClick={onEditOnMap}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-[#FAF9F6] hover:bg-slate-100 text-xs font-semibold text-[#1E2421] cursor-pointer whitespace-nowrap"
            >
              <MapPin className="w-3.5 h-3.5 text-[#2B4C3F]" />
              <span>{lang === 'ru' ? 'Редактировать на карте' : 'Edit on Map'}</span>
            </button>
          )}

          <button
            type="button"
            data-testid="download-a4-pdf-btn"
            disabled={isGeneratingPdf}
            onClick={() => void handleDirectDownloadPdf()}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#2B4C3F] bg-white hover:bg-[#2B4C3F]/5 text-xs font-semibold text-[#2B4C3F] cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lang === 'ru' ? 'Скачать .PDF' : 'Download .PDF'}</span>
          </button>

          <button
            type="button"
            data-testid="export-a4-pdf-btn"
            disabled={isGeneratingPdf}
            onClick={() => void handleSaveOrSharePdf()}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2B4C3F] hover:bg-[#223D32] disabled:opacity-60 text-white text-xs font-bold shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Share2 className="w-4 h-4" />
            <span>{t.printPdfBtn}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="hidden md:inline-flex min-h-[40px] items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer"
            title="Browser Print"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Session Summary & Export Card */}
      <section className="rounded-xl border border-slate-300 bg-white p-5 md:p-7 shadow-xs space-y-6">
        {/* Clean Horse & Session Metadata Grid */}
        <div
          data-testid="report-clean-metadata-grid"
          className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-xs border-b border-slate-200 pb-4"
        >
          {cleanMetaItems.map((item, idx) => (
            <div key={`${item.label}-${idx}`}>
              <span className="text-slate-500">{item.label}: </span>
              <span
                className={`font-semibold ${
                  item.accent ? 'text-[#1E3A8A]' : 'text-[#1E2421]'
                }`}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Side-by-Side Left & Right Profile Diagrams + Top View Predominant Diagonal */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-center text-[#2B4C3F]">
                {t.leftProfileTitle}
              </div>
              <HorseSilhouetteSvg
                view="left"
                evaluationTable={session.evaluationTable}
                annotations={session.annotations}
                showPastelZones={true}
                showLandmarkNumbers={true}
                readOnly
                lang={lang}
              />
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-center text-[#2B4C3F]">
                {t.rightProfileTitle}
              </div>
              <HorseSilhouetteSvg
                view="right"
                evaluationTable={session.evaluationTable}
                annotations={session.annotations}
                showPastelZones={true}
                showLandmarkNumbers={true}
                readOnly
                lang={lang}
              />
            </div>
          </div>

          {/* Top View Predominant Diagonal */}
          <div className="pt-2 border-t border-slate-200 space-y-1.5">
            <div className="text-xs font-semibold text-center text-[#2B4C3F]">
              {t.topViewTitle}
            </div>
            <div className="max-w-xl mx-auto">
              <HorseSilhouetteSvg
                view="top"
                evaluationTable={session.evaluationTable}
                annotations={session.annotations}
                showPastelZones={true}
                readOnly
                lang={lang}
              />
            </div>
          </div>
        </div>

        {/* EVALUATED ZONES BREAKDOWN */}
        <div
          data-testid="evaluated-zones-breakdown"
          className="rounded-xl border border-slate-300 overflow-hidden bg-[#FAF9F6]"
        >
          <div className="bg-[#2B4C3F] text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between">
            <span>
              {lang === 'ru'
                ? `Детализация отмеченных зон (${markedZoneEntries.length})`
                : `Evaluated Zones Breakdown (${markedZoneEntries.length})`}
            </span>
            <span className="text-[11px] text-white/80 font-normal">
              {lang === 'ru'
                ? 'Сторона · Реакция · Рестрикция / Релиз · Признаки SRSR · Заметка'
                : 'Side · Reaction · Restriction / Release · SRSR Chips · Zone Note'}
            </span>
          </div>

          {markedZoneEntries.length === 0 ? (
            <div className="p-6 text-xs text-slate-500 text-center">
              {lang === 'ru'
                ? 'В этой сессии пока не отмечено ни одной зоны. Нажмите «Редактировать на карте», чтобы добавить наблюдения.'
                : 'No anatomical zones marked in this session yet. Tap "Edit on Map" to record findings.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {markedZoneEntries.map((entry) => {
                const { obs } = entry;
                const releaseChips = (obs.releaseSigns ?? []).map((s) =>
                  localizeReleaseSign(s, obs.yawnCount, lang)
                );
                const resistanceChips = (obs.resistanceSigns ?? []).map((s) =>
                  localizeResistanceSign(s, lang)
                );
                const techniqueChips = (obs.techniques ?? []).map((s) =>
                  localizeTechnique(s, lang)
                );

                return (
                  <div
                    key={`${entry.areaId}-${entry.side}`}
                    data-testid={`breakdown-row-${entry.side}-${entry.areaId}`}
                    className="p-3.5 bg-white hover:bg-[#FAF9F6] transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 text-xs"
                  >
                    {/* Left Column: Area Index, Name, and Side Badge */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-tabular font-bold text-slate-800 shrink-0 border"
                        style={{
                          backgroundColor: entry.pastelFill,
                          borderColor: entry.pastelStroke,
                        }}
                      >
                        {entry.index}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-[#1E2421] flex items-center gap-2 flex-wrap">
                          <span>
                            {lang === 'ru' ? entry.nameRu : entry.nameEn}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                              entry.side === 'left'
                                ? 'bg-slate-200 text-slate-800'
                                : 'bg-[#2B4C3F]/15 text-[#2B4C3F]'
                            }`}
                          >
                            {entry.side === 'left' ? t.tableLeft : t.tableRight}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {lang === 'ru' ? entry.regionNameRu : entry.regionNameEn}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Reaction / Restriction / Release Badges + SRSR Chips + Per-Zone Note */}
                    <div className="flex flex-col sm:items-end gap-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {obs.reaction && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#B91C1C] text-white font-tabular text-[11px] font-bold">
                            {lang === 'ru'
                              ? `Реакция R${obs.reaction}`
                              : `Reaction R${obs.reaction}`}
                          </span>
                        )}
                        {obs.restriction && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1E3A8A]/12 border border-[#1E3A8A]/40 text-[#1E3A8A] text-[11px] font-semibold">
                            <span className="w-2 h-2 rounded-full border border-[#1E3A8A] bg-[#1E3A8A]/30" />
                            <span>{lang === 'ru' ? 'Рестрикция' : 'Restriction'}</span>
                          </span>
                        )}
                        {obs.released && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#15803D]/12 border border-[#15803D]/40 text-[#15803D] text-[11px] font-semibold">
                            <Check className="w-3 h-3 stroke-[2.8]" />
                            <span>{lang === 'ru' ? 'Релиз' : 'Released'}</span>
                          </span>
                        )}
                      </div>

                      {/* SRSR Release, Resistance & Technique Chips */}
                      {(releaseChips.length > 0 ||
                        resistanceChips.length > 0 ||
                        techniqueChips.length > 0) && (
                        <div className="flex flex-wrap sm:justify-end gap-1">
                          {releaseChips.map((chip, i) => (
                            <span
                              key={`rel-${i}`}
                              className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-medium"
                            >
                              {chip}
                            </span>
                          ))}
                          {resistanceChips.map((chip, i) => (
                            <span
                              key={`res-${i}`}
                              className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium"
                            >
                              ! {chip}
                            </span>
                          ))}
                          {techniqueChips.map((chip, i) => (
                            <span
                              key={`tech-${i}`}
                              className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-[#1E3A8A] text-[11px] font-medium"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Per-Zone Note */}
                      {obs.note && obs.note.trim().length > 0 && (
                        <div className="text-xs text-slate-700 bg-[#FAF9F6] border border-slate-200 rounded-lg px-2.5 py-1.5 sm:text-right max-w-xl">
                          {obs.note}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* BEFORE / AFTER SESSION PHOTOS (included in the A4 PDF) */}
        <div
          data-testid="pdf-session-photos-card"
          className="rounded-xl border border-slate-300 bg-[#FAF9F6] p-4 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs md:text-sm font-bold text-[#1E2421]">
              {lang === 'ru' ? 'Фото до / после' : 'Before / After Photos'}
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              {lang === 'ru'
                ? 'Сжимаются на устройстве · попадают в PDF-отчёт'
                : 'Compressed on-device · included in the PDF report'}
            </span>
          </div>
          <SessionPhotosPanel
            photos={photos}
            lang={lang}
            readOnly={!onAddPhotos || !onDeletePhoto}
            onAddPhotos={onAddPhotos ?? (async () => undefined)}
            onDeletePhoto={onDeletePhoto ?? (async () => undefined)}
          />
        </div>

        {/* OWNER CARE NOTES (POST-SESSION RECOMMENDATIONS) EDITOR */}
        <div
          data-testid="pdf-owner-recommendations-card"
          className="rounded-xl border border-amber-300 bg-amber-50/60 p-4 space-y-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="owner-care-notes"
              className="block text-xs md:text-sm font-bold text-amber-950"
            >
              {t.ownerCareNotesLabel}
            </label>
            <span className="text-[11px] text-amber-800 font-medium">
              {lang === 'ru'
                ? 'Включается в раздел рекомендаций экспортируемого PDF-отчета A4'
                : 'Included in the exported A4 PDF report'}
            </span>
          </div>
          <textarea
            id="owner-care-notes"
            data-testid="owner-care-notes-input"
            rows={3}
            value={session.reportSections.postSessionCareNotes}
            onChange={(e) => handleChangeSection('postSessionCareNotes', e.target.value)}
            placeholder={t.ownerCarePlaceholder}
            className="w-full rounded-xl border border-amber-300 bg-white p-3 text-xs text-slate-900 leading-relaxed focus:border-[#2B4C3F] focus:outline-none"
          />
        </div>

        {/* Optional Collapsible Written Report Narrative Sections (for Certification or Custom Edits) */}
        <div className="rounded-xl border border-slate-200 bg-[#FAF9F6] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#F3F1EC]">
            <button
              type="button"
              data-testid="toggle-narrative-sections-btn"
              onClick={() => setShowNarrativeSections((v) => !v)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#1E2421] cursor-pointer"
            >
              <FileText className="w-4 h-4 text-[#2B4C3F]" />
              <span>
                {lang === 'ru'
                  ? 'Текстовые разделы отчета A4 и заметки сессии'
                  : 'Written A4 Report Sections & Session Notes'}
              </span>
              {showNarrativeSections ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={handleSyncFromEvaluation}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t.regenerateReportBtn}</span>
            </button>
          </div>

          {showNarrativeSections && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#2B4C3F]">
                  {t.sec1Title}
                </label>
                <textarea
                  rows={3}
                  value={session.reportSections.initialEvaluation}
                  onChange={(e) =>
                    handleChangeSection('initialEvaluation', e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 leading-relaxed"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#2B4C3F]">
                  {t.sec2Title}
                </label>
                <textarea
                  rows={3}
                  value={session.reportSections.restrictionsIdentified}
                  onChange={(e) =>
                    handleChangeSection('restrictionsIdentified', e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 leading-relaxed"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#2B4C3F]">
                  {t.sec3Title}
                </label>
                <textarea
                  rows={3}
                  value={session.reportSections.releaseSignsObserved}
                  onChange={(e) =>
                    handleChangeSection('releaseSignsObserved', e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 leading-relaxed"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#1E3A8A]">
                  {t.sec5Title}
                </label>
                <textarea
                  rows={3}
                  value={session.reportSections.sessionNotes}
                  onChange={(e) => handleChangeSection('sessionNotes', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
