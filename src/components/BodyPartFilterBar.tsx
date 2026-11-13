import React from 'react';
import { BODY_PART_FILTERS, BodyPartFilterId } from '../data/anatomicalAreas';
import { Language } from '../types';

interface BodyPartFilterBarProps {
  value: BodyPartFilterId;
  onChange: (next: BodyPartFilterId) => void;
  lang: Language;
  className?: string;
}

/**
 * Full-width body-part filter that sits on the seam between the diagram and the zone
 * list, so it never covers the drawing and stays within thumb reach.
 * Tapping the active part again returns to "All".
 */
export const BodyPartFilterBar: React.FC<BodyPartFilterBarProps> = ({
  value,
  onChange,
  lang,
  className = '',
}) => (
  <div
    data-testid="body-part-filter-bar"
    role="group"
    aria-label={lang === 'ru' ? 'Фильтр частей тела' : 'Body part filter'}
    className={`flex items-stretch gap-0.5 rounded-xl border border-slate-300 bg-white p-0.5 ${className}`}
  >
    {BODY_PART_FILTERS.map((f) => {
      const isActive = value === f.id;
      return (
        <button
          key={f.id}
          type="button"
          data-testid={`body-part-filter-${f.id}`}
          aria-pressed={isActive}
          onClick={() => onChange(isActive && f.id !== 'all' ? 'all' : f.id)}
          className={`flex-1 min-h-[40px] px-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            isActive
              ? 'bg-[#2B4C3F] text-white shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          {lang === 'ru' ? f.labelRu : f.labelEn}
        </button>
      );
    })}
  </div>
);
