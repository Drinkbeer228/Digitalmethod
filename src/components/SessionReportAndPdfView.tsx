import React, { useEffect, useState } from 'react';
import {
  BodyworkSession,
  HorseProfile,
  Language,
  ReportSections,
} from '../types';
import { ANATOMICAL_AREAS } from '../data/anatomicalAreas';
import { TRANSLATIONS } from '../data/translations';
import { HorseSilhouetteSvg } from './HorseSilhouetteSvg';
import { CentralEvaluationTable } from './CentralEvaluationTable';
import { buildReportFromSession } from '../utils/reportGenerator';
import {
  buildSessionPdfFile,
  shareOrDownloadPdfFile,
  triggerPdfFileDownload,
} from '../utils/pdfExport';
import {
  Check,
  Download,
  FileDown,
  FileText,
  Printer,
  RefreshCw,
  Share2,
  ShieldAlert,
} from 'lucide-react';

interface SessionReportAndPdfViewProps {
  horse: HorseProfile;
  session: BodyworkSession;
  lang: Language;
  onUpdateReportSections: (next: ReportSections, customized: boolean) => void;
}

export const SessionReportAndPdfView: React.FC<SessionReportAndPdfViewProps> = ({
  horse,
  session,
  lang,
  onUpdateReportSections,
}) => {
  const t = TRANSLATIONS[lang];
  const [reportMode, setReportMode] = useState<'certification' | 'owner'>('certification');
  const [preBuiltPdfFile, setPreBuiltPdfFile] = useState<File | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [exportStatusMsg, setExportStatusMsg] = useState<string | null>(null);

  // Pre-build the A4 PDF File in the background whenever horse/session/mode/lang changes
  // so Web Share API on iOS Safari can be invoked synchronously inside the tap gesture.
  useEffect(() => {
    let cancelled = false;
    setPreBuiltPdfFile(null);
    void (async () => {
      try {
        const file = await buildSessionPdfFile(horse, session, reportMode, lang);
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
  }, [horse, session, reportMode, lang]);

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
        (await buildSessionPdfFile(horse, session, reportMode, lang));
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
        (await buildSessionPdfFile(horse, session, reportMode, lang));
      triggerPdfFileDownload(pdfFile);
      setExportStatusMsg(
        lang === 'ru' ? `Скачан файл ${pdfFile.name}` : `Downloaded ${pdfFile.name}`
      );
      setTimeout(() => setExportStatusMsg(null), 3500);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Count evaluated areas for Owner Report Mode summary
  const evaluatedAreas = ANATOMICAL_AREAS.filter((area) => {
    const row = session.evaluationTable[area.id];
    if (!row) return false;
    return (
      Boolean(row.left.reaction) ||
      row.left.restriction ||
      row.left.released ||
      Boolean(row.left.note?.trim()) ||
      Boolean(row.right.reaction) ||
      row.right.restriction ||
      row.right.released ||
      Boolean(row.right.note?.trim())
    );
  });

  // Clean metadata items (omits empty optional fields instead of printing blank underscores)
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
  if (reportMode === 'certification' && session.caseStudyNumber?.trim()) {
    cleanMetaItems.push({ label: t.caseStudyNum, value: session.caseStudyNumber });
  }
  if (horse.owner?.trim()) cleanMetaItems.push({ label: t.ownerLabel, value: horse.owner });
  if (horse.contactInfo?.trim()) {
    cleanMetaItems.push({ label: t.contactLabel, value: horse.contactInfo });
  }
  if (session.duration?.trim()) {
    cleanMetaItems.push({ label: t.durationLabel, value: session.duration });
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Toolbar (Hidden when printing A4 PDF) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-slate-300 bg-white shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 mr-1">
            {lang === 'ru' ? 'Режим отчета A4:' : 'A4 Report Mode:'}
          </span>
          <div className="inline-flex rounded-xl bg-[#F3F1EC] p-1 border border-slate-300">
            <button
              type="button"
              data-testid="report-mode-certification"
              onClick={() => setReportMode('certification')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                reportMode === 'certification'
                  ? 'bg-[#2B4C3F] text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {t.reportModeCert}
            </button>
            <button
              type="button"
              data-testid="report-mode-owner"
              onClick={() => setReportMode('owner')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                reportMode === 'owner'
                  ? 'bg-[#2B4C3F] text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {t.reportModeOwner}
            </button>
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

          <button
            type="button"
            onClick={handleSyncFromEvaluation}
            className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-[#FAF9F6] hover:bg-slate-100 text-xs font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t.regenerateReportBtn}</span>
          </button>

          <button
            type="button"
            data-testid="download-a4-pdf-btn"
            disabled={isGeneratingPdf}
            onClick={() => void handleDirectDownloadPdf()}
            className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#2B4C3F] bg-white hover:bg-[#2B4C3F]/5 text-xs font-semibold text-[#2B4C3F] cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lang === 'ru' ? 'Скачать .PDF' : 'Download .PDF'}</span>
          </button>

          <button
            type="button"
            data-testid="export-a4-pdf-btn"
            disabled={isGeneratingPdf}
            onClick={() => void handleSaveOrSharePdf()}
            className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2B4C3F] hover:bg-[#223D32] disabled:opacity-60 text-white text-xs font-bold shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Share2 className="w-4 h-4" />
            <span>{t.printPdfBtn}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="hidden md:inline-flex min-h-[42px] items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer"
            title="Browser Print"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* PRINT-READY MULTI-PAGE A4 DOCUMENT CONTAINER */}
      <div className="mx-auto max-w-[1050px] space-y-8">
        {/* A4 PAGE 1: HEADER + ANATOMICAL DIAGRAMS + EVALUATION SUMMARY */}
        <section className="rounded-xl border border-slate-300 bg-white p-5 md:p-8 shadow-xs space-y-6">
          {/* Document Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-[#2B4C3F] pb-4">
            <div className="flex items-center gap-3.5">
              <div className="w-16 h-12 rounded-full border-2 border-[#2B4C3F] bg-[#FAF9F6] flex flex-col items-center justify-center shrink-0 text-[#2B4C3F]">
                <span className="text-[8px] font-bold tracking-widest uppercase">
                  MASTERSON
                </span>
                <span className="text-[10px] font-serif font-bold">CASE STUDY</span>
                <span className="text-[7px] tracking-wider uppercase">METHOD</span>
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-editorial font-bold text-[#1E2421]">
                  {reportMode === 'certification'
                    ? t.formTitle
                    : lang === 'ru'
                      ? 'Отчет о сессии бодиворка для владельца лошади (Masterson Method)'
                      : 'Masterson Method Equine Bodywork — Owner Session Summary'}
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  {reportMode === 'certification'
                    ? lang === 'ru'
                      ? 'Сертификационная карта оценки реакций, рестрикций и преобладающей диагонали'
                      : 'Certification Case Study Evaluation Diagram & Structured Clinical Notebook'
                    : t.ownerHeaderNote}
                </p>
              </div>
            </div>

            {horse.isDemo && (
              <div className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-md shrink-0">
                {t.demoBadge}
              </div>
            )}
          </div>

          {/* Clean Horse & Session Metadata Grid (Omits empty optional fields) */}
          <div
            data-testid="report-clean-metadata-grid"
            className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2.5 text-xs border-b border-slate-300 pb-4"
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

          {/* Diagram Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-700 bg-[#FAF9F6] px-3.5 py-2 rounded-lg border border-slate-200">
            <div>
              <strong>{t.step1Title}</strong> {t.step1Desc}
            </div>
            <div className="flex items-center gap-3 font-semibold shrink-0">
              <span className="inline-flex items-center gap-1 text-[#B91C1C]">
                R1 (<span className="w-4 h-[1.5px] bg-[#B91C1C] inline-block" />)
              </span>
              <span className="inline-flex items-center gap-1 text-[#B91C1C]">
                R2 (<span className="w-4 h-[3.5px] bg-[#B91C1C] inline-block" />)
              </span>
              <span className="inline-flex items-center gap-1 text-[#B91C1C]">
                R3 (zigzag)
              </span>
              <span className="inline-flex items-center gap-1 text-[#1E3A8A]">
                ◯ Restriction
              </span>
              <span className="inline-flex items-center gap-1 text-[#15803D]">
                ✓ Released
              </span>
            </div>
          </div>

          {/* Side-by-Side Profiles + Table (or Owner Evaluated Areas Summary) */}
          {reportMode === 'certification' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-4 space-y-1.5">
                <div className="text-xs font-semibold text-center text-[#2B4C3F]">
                  {t.leftProfileTitle}
                </div>
                <HorseSilhouetteSvg
                  view="left"
                  evaluationTable={session.evaluationTable}
                  annotations={session.annotations}
                  activeTool="select"
                  activeColor="#1E3A8A"
                  selectedAnnotationId={null}
                  onSelectAnnotation={() => {}}
                  onChangeAnnotations={() => {}}
                  showPastelZones={true}
                  showLandmarkNumbers={true}
                  readOnly
                  lang={lang}
                />
              </div>

              <div className="lg:col-span-4">
                <CentralEvaluationTable
                  tableState={session.evaluationTable}
                  onUpdateCell={() => {}}
                  lang={lang}
                  readOnly
                />
              </div>

              <div className="lg:col-span-4 space-y-1.5">
                <div className="text-xs font-semibold text-center text-[#2B4C3F]">
                  {t.rightProfileTitle}
                </div>
                <HorseSilhouetteSvg
                  view="right"
                  evaluationTable={session.evaluationTable}
                  annotations={session.annotations}
                  activeTool="select"
                  activeColor="#1E3A8A"
                  selectedAnnotationId={null}
                  onSelectAnnotation={() => {}}
                  onChangeAnnotations={() => {}}
                  showPastelZones={true}
                  showLandmarkNumbers={true}
                  readOnly
                  lang={lang}
                />
              </div>
            </div>
          ) : (
            /* OWNER REPORT MODE: Side-by-side diagrams + filtered table of marked areas only */
            <div className="space-y-5">
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

              {/* Owner Mode Filtered Summary Table */}
              <div
                data-testid="owner-evaluated-areas-table"
                className="rounded-xl border border-slate-300 overflow-hidden bg-[#FAF9F6]"
              >
                <div className="bg-[#2B4C3F] text-white px-4 py-2 text-xs font-semibold">
                  {lang === 'ru'
                    ? `Отмеченные анатомические зоны (${evaluatedAreas.length})`
                    : `Evaluated Anatomical Areas (${evaluatedAreas.length})`}
                </div>
                {evaluatedAreas.length === 0 ? (
                  <div className="p-4 text-xs text-slate-500 text-center">
                    {lang === 'ru'
                      ? 'В этой сессии специфических зон реакций или рестрикций не отмечено.'
                      : 'No specific area reactions or restrictions marked in this session.'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 text-xs">
                    {evaluatedAreas.map((area) => {
                      const row = session.evaluationTable[area.id];
                      return (
                        <div
                          key={area.id}
                          className="grid grid-cols-12 items-center px-3 py-2 gap-2"
                        >
                          <div className="col-span-4 text-slate-700">
                            {row.left.reaction ? `R${row.left.reaction} ` : ''}
                            {row.left.restriction ? '◯ Restr. ' : ''}
                            {row.left.released ? '✓ Released ' : ''}
                            {row.left.note ? `(${row.left.note})` : ''}
                          </div>
                          <div className="col-span-4 font-semibold text-center text-[#1E2421]">
                            {area.index}. {lang === 'ru' ? area.nameRu : area.nameEn}
                          </div>
                          <div className="col-span-4 text-right text-slate-700">
                            {row.right.reaction ? `R${row.right.reaction} ` : ''}
                            {row.right.restriction ? '◯ Restr. ' : ''}
                            {row.right.released ? '✓ Released ' : ''}
                            {row.right.note ? `(${row.right.note})` : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Top View Predominant Diagonal */}
          {reportMode === 'certification' && (
            <div className="pt-2 border-t border-slate-200 space-y-2 print-avoid-break">
              <div className="text-[11px] text-slate-700">
                <strong>{t.step3Title}</strong> {t.step3Desc}
              </div>
              <div className="max-w-xl mx-auto">
                <HorseSilhouetteSvg
                  view="top"
                  evaluationTable={session.evaluationTable}
                  annotations={session.annotations}
                  activeTool="select"
                  activeColor="#1E2421"
                  selectedAnnotationId={null}
                  onSelectAnnotation={() => {}}
                  onChangeAnnotations={() => {}}
                  showPastelZones={true}
                  readOnly
                  lang={lang}
                />
              </div>
            </div>
          )}

          {/* Mandatory Educational Disclaimer in Certification Mode only */}
          {reportMode === 'certification' && (
            <div
              data-testid="certification-disclaimer-banner"
              className="pt-3 border-t border-slate-300 flex items-start gap-2.5 text-[11px] text-slate-700 leading-snug"
            >
              <ShieldAlert className="w-4 h-4 text-[#2B4C3F] shrink-0 mt-0.5" />
              <p>{t.certDisclaimer}</p>
            </div>
          )}
        </section>

        {/* A4 PAGE 2: STRUCTURED SESSION REPORT & EDITABLE SECTIONS */}
        <section className="print-page-break rounded-xl border border-slate-300 bg-white p-5 md:p-8 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2B4C3F]" />
              <h2 className="text-lg font-editorial font-bold text-[#1E2421]">
                {lang === 'ru'
                  ? `Структурированный отчет по сессии №${session.sessionNumber} — ${horse.name}`
                  : `Structured Session Summary (Session #${session.sessionNumber} — ${horse.name})`}
              </h2>
            </div>
            <span className="text-xs font-semibold text-[#2B4C3F]">
              {reportMode === 'certification' ? t.reportModeCert : t.reportModeOwner}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Section 1: Direct Observations - Reactions */}
            <div className="space-y-1.5 print-avoid-break">
              <label className="block text-xs font-semibold text-[#2B4C3F]">
                {t.sec1Title}
              </label>
              <textarea
                rows={4}
                value={session.reportSections.initialEvaluation}
                onChange={(e) => handleChangeSection('initialEvaluation', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-[#FAF9F6] p-3 text-xs text-slate-900 leading-relaxed focus:border-[#2B4C3F] focus:outline-none"
              />
            </div>

            {/* Section 2: Direct Observations - Restrictions */}
            <div className="space-y-1.5 print-avoid-break">
              <label className="block text-xs font-semibold text-[#2B4C3F]">
                {t.sec2Title}
              </label>
              <textarea
                rows={4}
                value={session.reportSections.restrictionsIdentified}
                onChange={(e) =>
                  handleChangeSection('restrictionsIdentified', e.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-[#FAF9F6] p-3 text-xs text-slate-900 leading-relaxed focus:border-[#2B4C3F] focus:outline-none"
              />
            </div>

            {/* Section 3: Direct Observations - Release & Guarding Signs */}
            <div className="space-y-1.5 print-avoid-break">
              <label className="block text-xs font-semibold text-[#2B4C3F]">
                {t.sec3Title}
              </label>
              <textarea
                rows={4}
                value={session.reportSections.releaseSignsObserved}
                onChange={(e) =>
                  handleChangeSection('releaseSignsObserved', e.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-[#FAF9F6] p-3 text-xs text-slate-900 leading-relaxed focus:border-[#2B4C3F] focus:outline-none"
              />
            </div>

            {/* Section 4: Practitioner Interpretation - Predominant Diagonal */}
            {reportMode === 'certification' && (
              <div className="space-y-1.5 print-avoid-break">
                <label className="block text-xs font-semibold text-[#1E3A8A]">
                  {t.sec4Title}
                </label>
                <textarea
                  rows={4}
                  value={session.reportSections.predominantDiagonal}
                  onChange={(e) =>
                    handleChangeSection('predominantDiagonal', e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-[#FAF9F6] p-3 text-xs text-slate-900 leading-relaxed focus:border-[#2B4C3F] focus:outline-none"
                />
              </div>
            )}

            {/* Section 5: Practitioner Interpretation - Session Notes */}
            <div className="space-y-1.5 print-avoid-break">
              <label className="block text-xs font-semibold text-[#1E3A8A]">
                {t.sec5Title}
              </label>
              <textarea
                rows={4}
                value={session.reportSections.sessionNotes}
                onChange={(e) => handleChangeSection('sessionNotes', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-[#FAF9F6] p-3 text-xs text-slate-900 leading-relaxed focus:border-[#2B4C3F] focus:outline-none"
              />
            </div>

            {/* Section 6: Owner Care Notes (Highlighted in Owner Mode) */}
            <div
              className={`space-y-1.5 print-avoid-break ${
                reportMode === 'owner'
                  ? 'md:col-span-2 p-3.5 rounded-xl bg-amber-50/70 border border-amber-300'
                  : ''
              }`}
            >
              <label className="block text-xs font-bold text-amber-900">
                {t.sec6Title}
              </label>
              <textarea
                rows={4}
                value={session.reportSections.postSessionCareNotes}
                onChange={(e) =>
                  handleChangeSection('postSessionCareNotes', e.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 leading-relaxed focus:border-[#2B4C3F] focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              {session.practitioner ? (
                <>
                  {t.studentLabel}: <strong>{session.practitioner}</strong> ·{' '}
                </>
              ) : null}
              {t.dateLabel}: <strong className="font-tabular">{session.date}</strong>
            </span>
            <span>
              {lang === 'ru'
                ? 'Не является ветеринарным диагнозом или медицинским назначением.'
                : 'Not a veterinary diagnosis or medical prescription.'}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
};
