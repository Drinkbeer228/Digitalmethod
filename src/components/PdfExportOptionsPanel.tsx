import React, { useCallback, useState } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { Language } from '../types';
import {
  detectPreset,
  loadPdfExportOptions,
  PDF_OPTION_KEYS,
  PDF_PRESETS,
  PdfExportOptions,
  PdfPresetId,
  savePdfExportOptions,
} from '../utils/pdfExportOptions';

/** PDF section choice, initialised from and saved to localStorage. */
export function usePdfExportOptions(): [PdfExportOptions, (next: PdfExportOptions) => void] {
  const [options, setOptions] = useState<PdfExportOptions>(() => loadPdfExportOptions());
  const update = useCallback((next: PdfExportOptions) => {
    setOptions(next);
    savePdfExportOptions(next);
  }, []);
  return [options, update];
}

const PRESET_LABEL: Record<PdfPresetId | 'custom', { en: string; ru: string }> = {
  owner: { en: 'For owner', ru: 'Для владельца' },
  specialist: { en: 'For specialist', ru: 'Для специалиста' },
  custom: { en: 'Custom', ru: 'Свой набор' },
};

const OPTION_TEXT: Record<keyof PdfExportOptions, { en: string; ru: string; hintEn: string; hintRu: string }> = {
  protocol: {
    en: 'Zones & responses',
    ru: 'Зоны и реакции',
    hintEn: 'Zone table, release signs, diagonal',
    hintRu: 'Таблица зон, признаки релиза, диагональ',
  },
  myofascial: {
    en: 'Myofascial lines',
    ru: 'Миофасциальные линии',
    hintEn: 'Marked zones per line (Elbrønd & Schultz)',
    hintRu: 'Отмеченные зоны по линиям (Elbrønd & Schultz)',
  },
  mastersonPlan: {
    en: 'Masterson work plan',
    ru: 'План по Мастерсону',
    hintEn: 'Stages, start points, pressure',
    hintRu: 'Этапы, стартовые точки, давление',
  },
  ownerCare: {
    en: 'Owner care',
    ru: 'Рекомендации владельцу',
    hintEn: 'Aftercare after the session',
    hintRu: 'Уход после сессии',
  },
  notes: {
    en: 'Practitioner notes',
    ru: 'Заметки практика',
    hintEn: 'Session notes and techniques',
    hintRu: 'Заметки сессии и техники',
  },
  patternNotes: {
    en: 'Pattern lines in notes',
    ru: 'Строки паттернов в заметках',
    hintEn: '[Pattern #N] lines from Clinical Insights',
    hintRu: '[Паттерн №N] из клинических подсказок',
  },
  photos: {
    en: 'Before / after photos',
    ru: 'Фото до / после',
    hintEn: 'Photo band',
    hintRu: 'Блок с фотографиями',
  },
};

/**
 * Compact PDF section picker: one collapsed row ("PDF: For owner ▾") that expands to
 * presets and per-section checkboxes. Lives next to the export buttons so the PDF can be
 * rebuilt in the background on each change and Share stays a single tap.
 */
export const PdfExportOptionsPanel: React.FC<{
  options: PdfExportOptions;
  onChange: (next: PdfExportOptions) => void;
  lang: Language;
  hasPhotos: boolean;
  defaultOpen?: boolean;
}> = ({ options, onChange, lang, hasPhotos, defaultOpen = false }) => {
  const ru = lang === 'ru';
  const [open, setOpen] = useState(defaultOpen);
  const preset = detectPreset(options);

  return (
    <div
      data-testid="pdf-export-options"
      data-preset={preset}
      className="rounded-xl border border-slate-300 bg-white text-left"
    >
      <button
        type="button"
        data-testid="pdf-export-options-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full min-h-[44px] flex items-center gap-2 px-3 py-2 text-sm cursor-pointer"
      >
        <FileText className="w-4 h-4 text-[#2B4C3F] shrink-0" />
        <span className="font-semibold text-[#1E2421]">PDF:</span>
        <span className="text-slate-700">{PRESET_LABEL[preset][lang]}</span>
        <span className="ml-auto text-slate-500">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-200 px-3 pb-3 pt-2 space-y-2">
          <div role="group" aria-label={ru ? 'Пресеты' : 'Presets'} className="grid grid-cols-2 gap-2">
            {(Object.keys(PDF_PRESETS) as PdfPresetId[]).map((id) => (
              <button
                key={id}
                type="button"
                data-testid={`pdf-preset-${id}`}
                aria-pressed={preset === id}
                onClick={() => onChange({ ...PDF_PRESETS[id] })}
                className={`min-h-[40px] rounded-lg border px-2 text-xs font-semibold cursor-pointer ${
                  preset === id
                    ? 'border-[#2B4C3F] bg-[#2B4C3F] text-white'
                    : 'border-slate-300 bg-[#FAF9F6] text-[#1E2421] hover:bg-slate-100'
                }`}
              >
                {PRESET_LABEL[id][lang]}
              </button>
            ))}
          </div>

          <ul className="space-y-0.5">
            {PDF_OPTION_KEYS.map((key) => {
              const text = OPTION_TEXT[key];
              const disabled = key === 'photos' && !hasPhotos;
              return (
                <li key={key}>
                  <label
                    className={`flex min-h-[40px] items-center gap-2.5 rounded-lg px-1 ${
                      disabled ? 'opacity-50' : 'cursor-pointer hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      data-testid={`pdf-option-${key}`}
                      className="h-4 w-4 accent-[#2B4C3F]"
                      checked={options[key] && !disabled}
                      disabled={disabled}
                      onChange={(e) => onChange({ ...options, [key]: e.target.checked })}
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-[#1E2421]">
                        {ru ? text.ru : text.en}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {disabled
                          ? ru
                            ? 'Фото не добавлены'
                            : 'No photos attached'
                          : ru
                            ? text.hintRu
                            : text.hintEn}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-slate-500">
            {ru
              ? 'Карта зон (стр. 1) входит всегда. Выбор запоминается для следующих выгрузок.'
              : 'The zone map (page 1) is always included. Your choice is remembered for next exports.'}
          </p>
        </div>
      )}
    </div>
  );
};
