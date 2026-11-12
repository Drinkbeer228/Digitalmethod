import React, { useState } from 'react';
import {
  BodyworkSession,
  HorseProfile,
  Language,
  ReportSections,
} from '../types';
import { TRANSLATIONS } from '../data/translations';
import { HorseSilhouetteSvg } from './HorseSilhouetteSvg';
import { CentralEvaluationTable } from './CentralEvaluationTable';
import { buildReportFromSession } from '../utils/reportGenerator';
import { FileText, Printer, RefreshCw, ShieldAlert } from 'lucide-react';

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

  const handlePrintA4 = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Toolbar (Hidden when printing A4 PDF) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-slate-300 bg-white">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 mr-1">
            {lang === 'ru' ? 'Режим отчета A4:' : 'A4 Report Mode:'}
          </span>
          <div className="inline-flex rounded-lg bg-[#F3F1EC] p-1 border border-slate-300">
            <button
              type="button"
              onClick={() => setReportMode('certification')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                reportMode === 'certification'
                  ? 'bg-[#2B4C3F] text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {t.reportModeCert}
            </button>
            <button
              type="button"
              onClick={() => setReportMode('owner')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                reportMode === 'owner'
                  ? 'bg-[#2B4C3F] text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {t.reportModeOwner}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleSyncFromEvaluation}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-[#FAF9F6] hover:bg-slate-100 text-xs font-medium text-slate-800 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t.regenerateReportBtn}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintA4}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2B4C3F] hover:bg-[#223D32] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>{t.printPdfBtn}</span>
          </button>
        </div>
      </div>

      {/* PRINT-READY MULTI-PAGE A4 DOCUMENT CONTAINER */}
      <div className="mx-auto max-w-[1050px] space-y-8">
        {/* A4 PAGE 1: HEADER + ANATOMICAL DIAGRAMS + 19-AREA TABLE + TOP VIEW */}
        <section className="rounded-xl border border-slate-300 bg-white p-6 md:p-8 shadow-xs space-y-6">
          {/* Document Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-[#2B4C3F] pb-4">
            <div className="flex items-center gap-3.5">
              {/* Masterson-inspired Classic Oval Seal */}
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

          {/* Horse & Session Metadata Grid matching the paper form */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2.5 text-xs border-b border-slate-300 pb-4">
            <div>
              <span className="text-slate-500">{t.studentLabel}: </span>
              <span className="font-semibold text-[#1E2421]">
                {session.practitioner || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">{t.caseStudyNum}: </span>
              <span className="font-semibold font-tabular text-[#1E2421]">
                {session.caseStudyNumber || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">{t.sessionNum}: </span>
              <span className="font-semibold font-tabular text-[#1E3A8A]">
                {session.sessionNumber}
              </span>
            </div>
            <div>
              <span className="text-slate-500">{t.dateLabel}: </span>
              <span className="font-semibold font-tabular text-[#1E2421]">
                {session.date}
              </span>
            </div>

            <div>
              <span className="text-slate-500">{t.horseLabel}: </span>
              <span className="font-semibold text-[#1E3A8A]">{horse.name}</span>
            </div>
            <div>
              <span className="text-slate-500">{t.ageLabel}: </span>
              <span className="font-semibold font-tabular text-[#1E2421]">
                {horse.age || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">{t.breedLabel}: </span>
              <span className="font-semibold text-[#1E2421]">
                {horse.breed || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">{t.jobLabel}: </span>
              <span className="font-semibold text-[#1E3A8A]">
                {horse.job || '—'}
              </span>
            </div>

            <div>
              <span className="text-slate-500">{t.ownerLabel}: </span>
              <span className="font-semibold text-[#1E2421]">
                {horse.owner || '—'}
              </span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-500">{t.contactLabel}: </span>
              <span className="font-semibold text-[#1E2421]">
                {horse.contactInfo || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">{t.durationLabel}: </span>
              <span className="font-semibold font-tabular text-[#1E2421]">
                {session.duration || '—'}
              </span>
            </div>
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

          {/* 3-Column Sheet Layout: Left Profile | 19-Area Table | Right Profile */}
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

          {/* Mandatory Educational Disclaimer in Certification Mode */}
          {reportMode === 'certification' && (
            <div className="pt-3 border-t border-slate-300 flex items-start gap-2.5 text-[11px] text-slate-700 leading-snug">
              <ShieldAlert className="w-4 h-4 text-[#2B4C3F] shrink-0 mt-0.5" />
              <p>{t.certDisclaimer}</p>
            </div>
          )}
        </section>

        {/* A4 PAGE 2: STRUCTURED SESSION REPORT & EDITABLE SECTIONS */}
        <section className="print-page-break rounded-xl border border-slate-300 bg-white p-6 md:p-8 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2B4C3F]" />
              <h2 className="text-lg font-editorial font-bold text-[#1E2421]">
                {lang === 'ru'
                  ? `Структурированный отчет по сессии №${session.sessionNumber} — ${horse.name}`
                  : `Structured Session Summary (Session #${session.sessionNumber} — ${horse.name})`}
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              {reportMode === 'certification' ? t.reportModeCert : t.reportModeOwner}
            </span>
          </div>

          {/* Category Distinction Legend */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-[#FAF9F6] p-3 rounded-lg border border-slate-200">
            <div>
              <span className="font-semibold text-[#2B4C3F]">
                {lang === 'ru' ? 'I. Прямые наблюдения:' : 'I. Direct Observations:'}
              </span>{' '}
              <span className="text-slate-600">
                {lang === 'ru'
                  ? 'Разделы 1–3 (фактические реакции, рестрикции и признаки релиза).'
                  : 'Sections 1–3 (factual palpation reactions, restrictions, and release signs).'}
              </span>
            </div>
            <div>
              <span className="font-semibold text-[#1E3A8A]">
                {lang === 'ru'
                  ? 'II. Интерпретация практика:'
                  : "II. Practitioner's Interpretation:"}
              </span>{' '}
              <span className="text-slate-600">
                {lang === 'ru'
                  ? 'Разделы 4–5 (преобладающая диагональ и ход сессии).'
                  : 'Sections 4–5 (predominant diagonal pattern and bodywork notes).'}
              </span>
            </div>
            <div>
              <span className="font-semibold text-amber-800">
                {lang === 'ru'
                  ? 'III. Рекомендации практика:'
                  : 'III. Practitioner Recommendations:'}
              </span>{' '}
              <span className="text-slate-600">
                {lang === 'ru'
                  ? 'Раздел 6 (уход после сессии; не является вет. диагнозом).'
                  : 'Section 6 (post-session care notes; non-veterinary).'}
              </span>
            </div>
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

            {/* Section 3: Direct Observations - Release Signs */}
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

            {/* Section 6: Practitioner Recommendations - Post-Session Care Notes */}
            <div className="space-y-1.5 print-avoid-break">
              <label className="block text-xs font-semibold text-amber-900">
                {t.sec6Title}
              </label>
              <textarea
                rows={4}
                value={session.reportSections.postSessionCareNotes}
                onChange={(e) =>
                  handleChangeSection('postSessionCareNotes', e.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-[#FAF9F6] p-3 text-xs text-slate-900 leading-relaxed focus:border-[#2B4C3F] focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              {t.studentLabel}: <strong>{session.practitioner || '—'}</strong> ·{' '}
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
