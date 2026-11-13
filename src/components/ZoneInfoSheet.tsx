import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { AnatomicalAreaId, EvaluationTableState, Language } from '../types';
import { ANATOMICAL_AREAS, ANATOMICAL_REGIONS } from '../data/anatomicalAreas';
import { ZoneReferencePanel } from './ZoneReferencePanel';

/**
 * Read-only zone information: name, explanation and the source-backed reference
 * (myofascial lines, Masterson techniques, session stage). Same content as the
 * zone editor's info button, opened from the ⓘ next to a zone name in the table.
 * Bottom sheet on phones, centered card on wider screens.
 */
export const ZoneInfoSheet: React.FC<{
  areaId: AnatomicalAreaId;
  tableState: EvaluationTableState;
  lang: Language;
  onClose: () => void;
}> = ({ areaId, tableState, lang, onClose }) => {
  const ru = lang === 'ru';
  const area = ANATOMICAL_AREAS.find((a) => a.id === areaId);
  const region = area ? ANATOMICAL_REGIONS.find((r) => r.id === area.regionId) : undefined;
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!area) return null;
  const title = `${area.index}. ${ru ? area.nameRu : area.nameEn}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 sm:bg-black/45 p-0 sm:p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="zone-info-sheet"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#FAF9F6] border-t sm:border border-slate-300 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2 px-4 pt-4 pb-2 sm:px-5">
          <span
            className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-tabular font-bold text-slate-900 shrink-0 border"
            style={{
              backgroundColor: region?.pastelFill ?? '#F3F1EC',
              borderColor: region?.pastelStroke ?? '#CBD5E1',
            }}
          >
            {area.index}
          </span>
          <h3 className="flex-1 min-w-0 text-base font-bold text-[#1E2421] leading-snug">
            {ru ? area.nameRu : area.nameEn}
          </h3>
          <button
            ref={closeRef}
            type="button"
            data-testid="zone-info-close"
            onClick={onClose}
            aria-label={ru ? 'Закрыть' : 'Close'}
            className="w-9 h-9 -mr-1 -mt-1 inline-flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 cursor-pointer shrink-0"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
          <p data-testid="zone-info-explanation" className="text-sm text-slate-700 leading-snug">
            {ru ? area.explanationRu : area.explanationEn}
          </p>
          <ZoneReferencePanel areaId={areaId} tableState={tableState} lang={lang} scrollable={false} />
        </div>
      </div>
    </div>
  );
};
