import React from 'react';
import { Check, Lightbulb, NotebookPen, X } from 'lucide-react';
import { Language } from '../types';
import {
  formatMatchedZones,
  formatMatchSides,
  isPatternInNotes,
  PatternMatch,
} from '../utils/patternDetection';

interface ClinicalInsightsSheetProps {
  matches: PatternMatch[];
  lang: Language;
  /** Current unified session notes (to show "Added" state) */
  sessionNotes: string;
  onAddToNotes: (match: PatternMatch) => void;
  onClose: () => void;
}

/**
 * Read-only practitioner aid: zone combinations that match known myofascial /
 * compensation patterns. Nothing here reaches the owner PDF unless the practitioner
 * adds it to the session notes.
 */
export const ClinicalInsightsSheet: React.FC<ClinicalInsightsSheetProps> = ({
  matches,
  lang,
  sessionNotes,
  onAddToNotes,
  onClose,
}) => {
  const ru = lang === 'ru';
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-label={ru ? 'Связки зон' : 'Zone patterns'}
      data-testid="clinical-insights-sheet"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[86dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#FAF9F6] border-t sm:border border-slate-300 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-3 pb-3 border-b border-slate-200 shrink-0">
          <div className="w-11 h-1.5 rounded-full bg-slate-300 mx-auto mb-2 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[#1E2421] flex items-center gap-1.5">
                <Lightbulb className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                {ru ? `Связки зон: ${matches.length}` : `Zone patterns: ${matches.length}`}
              </h3>
              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                {ru
                  ? 'Справочно для специалиста: сопоставление отмеченных зон с известными миофасциальными цепями. Источники приведены как есть — сверяйте. Не ветеринарная консультация.'
                  : 'Practitioner reference: marked zones compared with known myofascial chains. Sources are quoted as supplied — verify them. Not veterinary advice.'}
              </p>
            </div>
            <button
              type="button"
              data-testid="close-insights-btn"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-200/70 hover:bg-slate-200 text-slate-700 cursor-pointer shrink-0"
              aria-label={ru ? 'Закрыть' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
          {matches.map((m) => {
            const added = isPatternInNotes(sessionNotes, m.pattern.id);
            return (
              <article
                key={m.pattern.id}
                data-testid={`insight-card-${m.pattern.id}`}
                className="rounded-xl border border-slate-300 bg-white p-3.5 space-y-2.5"
              >
                <header className="space-y-1.5">
                  <h4 className="text-sm font-bold text-[#1E2421] leading-snug">
                    <span className="text-slate-400 font-tabular mr-1">№{m.pattern.id}</span>
                    {ru ? m.pattern.titleRu : m.pattern.titleEn}
                  </h4>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-[#2B4C3F] text-white font-semibold">
                      {formatMatchSides(m.sides, lang)}
                    </span>
                    {m.diagonalConfirmed && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">
                        {ru ? 'совпадает с диагональю сверху' : 'matches top-view diagonal'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {formatMatchedZones(m.matchedZones, lang)}
                  </p>
                </header>

                <section>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    {ru ? 'Механизм' : 'Mechanism'}
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed">
                    {ru ? m.pattern.mechanismRu : m.pattern.mechanismEn}
                  </p>
                </section>

                <section className="rounded-lg bg-[#2B4C3F]/8 border border-[#2B4C3F]/15 p-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[#2B4C3F]">
                    {ru ? 'Подсказка практику' : 'Practitioner hint'}
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed">
                    {ru ? m.pattern.hintRu : m.pattern.hintEn}
                  </p>
                </section>

                <p className="text-[10px] text-slate-500 leading-snug">
                  {ru ? 'Источник: ' : 'Source: '}
                  {m.pattern.source}
                </p>

                <button
                  type="button"
                  data-testid={`insight-add-notes-${m.pattern.id}`}
                  disabled={added}
                  onClick={() => onAddToNotes(m)}
                  className={`w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold cursor-pointer disabled:cursor-default ${
                    added
                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                      : 'bg-white border border-[#2B4C3F] text-[#2B4C3F] hover:bg-[#2B4C3F]/5'
                  }`}
                >
                  {added ? <Check className="w-4 h-4" /> : <NotebookPen className="w-4 h-4" />}
                  <span>
                    {added
                      ? ru
                        ? 'Добавлено в заметки'
                        : 'Added to notes'
                      : ru
                        ? 'Добавить в заметки сессии'
                        : 'Add to session notes'}
                  </span>
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
};
