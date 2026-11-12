import React, { useState } from 'react';
import {
  AnatomicalAreaId,
  AnatomicalRegionId,
  AreaSideObservation,
  EvaluationTableState,
  Language,
  ReactionLevel,
  Side,
} from '../types';
import { ANATOMICAL_AREAS, ANATOMICAL_REGIONS } from '../data/anatomicalAreas';
import { RELEASE_SIGNS_PRESETS, TRANSLATIONS } from '../data/translations';
import { Check, Info, MessageSquareText, Trash2, X } from 'lucide-react';

interface CentralEvaluationTableProps {
  tableState: EvaluationTableState;
  onUpdateCell: (
    areaId: AnatomicalAreaId,
    side: Side,
    next: AreaSideObservation,
    syncDiagram: boolean
  ) => void;
  lang: Language;
  readOnly?: boolean;
  activePopover?: { areaId: AnatomicalAreaId; side: Side } | null;
  onChangeActivePopover?: (target: { areaId: AnatomicalAreaId; side: Side } | null) => void;
  hoveredAreaTarget?: { areaId: AnatomicalAreaId; side?: Side } | null;
  onHoverArea?: (target: { areaId: AnatomicalAreaId; side?: Side } | null) => void;
  activeRegionFilter?: AnatomicalRegionId | 'all';
}

/**
 * Compact standardized vector symbols inside each Left/Right cell:
 * - Reaction Level 1: thin red line + "R1"
 * - Reaction Level 2: bold red bar + "R2"
 * - Reaction Level 3: zigzag red mark + "R3"
 * - Restriction: dark blue circle "◯"
 * - Released: green checkmark "✓"
 * - Note: subtle note icon
 */
const CellSymbols: React.FC<{ obs: AreaSideObservation }> = ({ obs }) => {
  const hasAnything =
    Boolean(obs.reaction) || obs.restriction || obs.released || Boolean(obs.note?.trim());

  if (!hasAnything) {
    return <span className="text-slate-300 text-xs select-none">·</span>;
  }

  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      {obs.reaction === 1 && (
        <span
          className="inline-flex items-center gap-0.5 text-[#B91C1C] font-tabular text-xs font-semibold"
          title="Reaction Level 1 (Thin line)"
        >
          <span>1</span>
          <span className="inline-block w-3 h-[1.5px] bg-[#B91C1C] rounded-full" />
        </span>
      )}
      {obs.reaction === 2 && (
        <span
          className="inline-flex items-center gap-0.5 text-[#B91C1C] font-tabular text-xs font-bold"
          title="Reaction Level 2 (Bold line)"
        >
          <span>2</span>
          <span className="inline-block w-3.5 h-[3.5px] bg-[#B91C1C] rounded-full" />
        </span>
      )}
      {obs.reaction === 3 && (
        <span
          className="inline-flex items-center gap-0.5 text-[#B91C1C] font-tabular text-xs font-bold"
          title="Reaction Level 3 (Zigzag high reactivity)"
        >
          <span>3</span>
          <svg className="w-4 h-3 stroke-[#B91C1C]" viewBox="0 0 18 10" fill="none">
            <path
              d="M1 8 L4 2 L7 8 L10 2 L13 8 L17 2"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
      {obs.restriction && (
        <span
          className="inline-block w-3.5 h-3.5 rounded-full border-2 border-[#1E3A8A] bg-[#1E3A8A]/15 shrink-0"
          title="Restriction observed (oval/circle)"
        />
      )}
      {obs.released && (
        <span
          className="inline-flex items-center justify-center text-[#15803D] font-bold"
          title="Released / release signs observed"
        >
          <Check className="w-3.5 h-3.5 stroke-[2.8]" />
        </span>
      )}
      {obs.note && obs.note.trim().length > 0 && (
        <MessageSquareText
          className="w-3 h-3 text-slate-500 shrink-0"
          aria-label="Has area note"
        />
      )}
    </div>
  );
};

export const CentralEvaluationTable: React.FC<CentralEvaluationTableProps> = ({
  tableState,
  onUpdateCell,
  lang,
  readOnly = false,
  activePopover: controlledPopover,
  onChangeActivePopover,
  hoveredAreaTarget = null,
  onHoverArea,
  activeRegionFilter = 'all',
}) => {
  const t = TRANSLATIONS[lang];
  const [internalPopover, setInternalPopover] = useState<{
    areaId: AnatomicalAreaId;
    side: Side;
  } | null>(null);
  const [infoAreaId, setInfoAreaId] = useState<AnatomicalAreaId | null>(null);

  const editingCell =
    controlledPopover !== undefined ? controlledPopover : internalPopover;
  const setEditingCell = (next: { areaId: AnatomicalAreaId; side: Side } | null) => {
    if (onChangeActivePopover) onChangeActivePopover(next);
    else setInternalPopover(next);
  };

  const activeAreaMeta = editingCell
    ? ANATOMICAL_AREAS.find((a) => a.id === editingCell.areaId)
    : null;
  const activeRegionMeta = activeAreaMeta
    ? ANATOMICAL_REGIONS.find((r) => r.id === activeAreaMeta.regionId)
    : null;
  const activeObs =
    editingCell && tableState[editingCell.areaId]
      ? tableState[editingCell.areaId][editingCell.side]
      : null;

  const infoMeta = infoAreaId ? ANATOMICAL_AREAS.find((a) => a.id === infoAreaId) : null;

  return (
    <div className="relative w-full">
      <div className="overflow-hidden rounded-xl border border-slate-300 bg-[#FAF9F6] shadow-xs">
        <table className="w-full border-collapse text-left table-fixed">
          <thead>
            <tr className="bg-[#2B4C3F] text-[#FAF9F6] text-xs font-semibold tracking-wide">
              <th className="w-[26%] py-2.5 px-2 text-center border-r border-[#FAF9F6]/20">
                {t.tableLeft}
              </th>
              <th className="w-[48%] py-2.5 px-2.5 text-center border-r border-[#FAF9F6]/20">
                {t.tableArea}
              </th>
              <th className="w-[26%] py-2.5 px-2 text-center">{t.tableRight}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300/80 text-xs">
            {ANATOMICAL_AREAS.map((area, idx) => {
              const row = tableState[area.id] ?? {
                left: { reaction: null, restriction: false, released: false, note: '' },
                right: { reaction: null, restriction: false, released: false, note: '' },
              };
              const region = ANATOMICAL_REGIONS.find((r) => r.id === area.regionId);
              const isLeftSelected =
                editingCell?.areaId === area.id && editingCell?.side === 'left';
              const isRightSelected =
                editingCell?.areaId === area.id && editingCell?.side === 'right';
              const isRowHovered = hoveredAreaTarget?.areaId === area.id;
              const isDimmedByFilter =
                activeRegionFilter !== 'all' && activeRegionFilter !== area.regionId;

              return (
                <tr
                  key={area.id}
                  data-testid={`table-row-${area.id}`}
                  onPointerEnter={() => onHoverArea?.({ areaId: area.id })}
                  onPointerLeave={() => onHoverArea?.(null)}
                  className={`transition-colors ${
                    isDimmedByFilter ? 'opacity-45' : ''
                  } ${
                    isLeftSelected || isRightSelected
                      ? 'bg-[#2B4C3F]/12'
                      : isRowHovered
                        ? 'bg-[#EAE6DF]'
                        : idx % 2 === 0
                          ? 'bg-[#FAF9F6]'
                          : 'bg-[#F3F1EC]'
                  }`}
                >
                  {/* LEFT CELL */}
                  <td className="p-0 border-r border-slate-300/80 align-middle">
                    {readOnly ? (
                      <div className="min-h-[36px] px-1.5 py-1 flex items-center justify-center">
                        <CellSymbols obs={row.left} />
                      </div>
                    ) : (
                      <button
                        type="button"
                        data-testid={`table-cell-left-${area.id}`}
                        onClick={() => setEditingCell({ areaId: area.id, side: 'left' })}
                        aria-label={`Left ${area.nameEn}`}
                        className={`w-full min-h-[38px] px-1.5 py-1 flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[#2B4C3F] ${
                          isLeftSelected
                            ? 'bg-[#2B4C3F]/18 ring-2 ring-inset ring-[#2B4C3F]'
                            : 'hover:bg-[#2B4C3F]/8'
                        }`}
                      >
                        <CellSymbols obs={row.left} />
                      </button>
                    )}
                  </td>

                  {/* CENTER ANATOMICAL AREA NAME + SUBTLE REGION SWATCH */}
                  <td className="py-1.5 px-2 border-r border-slate-300/80 text-center align-middle">
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-tabular font-semibold text-slate-700 shrink-0 border"
                        style={{
                          backgroundColor: region?.pastelFill ?? '#F3F1EC',
                          borderColor: region?.pastelStroke ?? '#CBD5E1',
                        }}
                        title={lang === 'ru' ? region?.nameRu : region?.nameEn}
                      >
                        {area.index}
                      </span>
                      <div className="flex-1 text-center leading-tight">
                        {lang === 'ru' ? (
                          <div>
                            <div className="font-medium text-[#1E2421] text-[11.5px]">
                              {area.nameRu}
                            </div>
                            <div className="text-[10px] text-slate-500">{area.nameEn}</div>
                          </div>
                        ) : (
                          <span className="font-medium text-[#1E2421] text-[12px]">
                            {area.nameEn}
                          </span>
                        )}
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            setInfoAreaId(infoAreaId === area.id ? null : area.id)
                          }
                          aria-label={`Explanation for ${area.nameEn}`}
                          className="p-1 text-slate-400 hover:text-[#2B4C3F] rounded shrink-0 cursor-pointer"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* RIGHT CELL */}
                  <td className="p-0 align-middle">
                    {readOnly ? (
                      <div className="min-h-[36px] px-1.5 py-1 flex items-center justify-center">
                        <CellSymbols obs={row.right} />
                      </div>
                    ) : (
                      <button
                        type="button"
                        data-testid={`table-cell-right-${area.id}`}
                        onClick={() => setEditingCell({ areaId: area.id, side: 'right' })}
                        aria-label={`Right ${area.nameEn}`}
                        className={`w-full min-h-[38px] px-1.5 py-1 flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[#2B4C3F] ${
                          isRightSelected
                            ? 'bg-[#2B4C3F]/18 ring-2 ring-inset ring-[#2B4C3F]'
                            : 'hover:bg-[#2B4C3F]/8'
                        }`}
                      >
                        <CellSymbols obs={row.right} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Anatomical Explanation Callout if opened */}
      {infoMeta && !readOnly && (
        <div className="mt-2 p-3 rounded-lg bg-[#F3F1EC] border border-slate-300 text-xs text-slate-700 flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-[#2B4C3F]">
              {infoMeta.index}.{' '}
              {lang === 'ru'
                ? `${infoMeta.nameRu} (${infoMeta.nameEn})`
                : infoMeta.nameEn}
            </div>
            <p className="mt-0.5 text-slate-600 leading-relaxed">
              {lang === 'ru' ? infoMeta.explanationRu : infoMeta.explanationEn}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setInfoAreaId(null)}
            className="p-1 text-slate-400 hover:text-slate-700"
            aria-label="Close explanation"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Contextual Anatomical Selection Menu (Opened from either SVG illustration or 19-Area Table) */}
      {editingCell && activeAreaMeta && activeObs && !readOnly && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print"
          onClick={() => setEditingCell(null)}
          role="dialog"
          aria-modal="true"
          data-testid="anatomical-context-menu"
          aria-label={`Edit ${editingCell.side} ${activeAreaMeta.nameEn}`}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#FAF9F6] border border-slate-300 p-5 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Side switcher, Region tag, and Area explanation */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-3 gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="inline-flex rounded-md bg-slate-200/80 p-0.5">
                    {(['left', 'right'] as Side[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          setEditingCell({ areaId: editingCell.areaId, side: s })
                        }
                        className={`px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase cursor-pointer transition-colors ${
                          editingCell.side === s
                            ? 'bg-[#2B4C3F] text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {s === 'left' ? t.tableLeft : t.tableRight}
                      </button>
                    ))}
                  </div>
                  {activeRegionMeta && (
                    <span className="text-slate-500">
                      · {lang === 'ru' ? activeRegionMeta.nameRu : activeRegionMeta.nameEn}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-semibold text-[#1E2421]">
                  {activeAreaMeta.index}.{' '}
                  {lang === 'ru'
                    ? `${activeAreaMeta.nameRu} (${activeAreaMeta.nameEn})`
                    : activeAreaMeta.nameEn}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {lang === 'ru'
                    ? activeAreaMeta.explanationRu
                    : activeAreaMeta.explanationEn}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
                aria-label="Close cell editor"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Standardized Reaction Level Markers (Red #B91C1C) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700">
                  {t.reactionLevel}
                </label>
                {activeObs.reaction && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateCell(
                        editingCell.areaId,
                        editingCell.side,
                        { ...activeObs, reaction: null },
                        true
                      )
                    }
                    className="text-[11px] text-red-700 hover:underline cursor-pointer"
                  >
                    {lang === 'ru' ? 'Убрать маркер реакции' : 'Remove reaction mark'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([1, 2, 3] as ReactionLevel[]).map((lvl) => {
                  const isActive = activeObs.reaction === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      data-testid={`menu-reaction-${lvl}`}
                      onClick={() =>
                        onUpdateCell(
                          editingCell.areaId,
                          editingCell.side,
                          {
                            ...activeObs,
                            reaction: isActive ? null : lvl,
                          },
                          true
                        )
                      }
                      className={`min-h-[46px] px-2.5 py-2 rounded-lg border text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#B91C1C] text-white border-[#B91C1C]'
                          : 'bg-white text-[#B91C1C] border-slate-300 hover:bg-red-50/60'
                      }`}
                    >
                      <span>Reaction Level {lvl}</span>
                      {lvl === 1 && (
                        <span
                          className={`w-7 h-[2px] rounded-full ${
                            isActive ? 'bg-white' : 'bg-[#B91C1C]'
                          }`}
                        />
                      )}
                      {lvl === 2 && (
                        <span
                          className={`w-7 h-[4px] rounded-full ${
                            isActive ? 'bg-white' : 'bg-[#B91C1C]'
                          }`}
                        />
                      )}
                      {lvl === 3 && (
                        <svg
                          className={`w-7 h-2.5 ${
                            isActive ? 'stroke-white' : 'stroke-[#B91C1C]'
                          }`}
                          viewBox="0 0 24 8"
                          fill="none"
                        >
                          <path
                            d="M1 7 L5 1 L9 7 L13 1 L17 7 L23 1"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Standardized Restriction (Dark Blue #1E3A8A) & Released (Green #15803D) Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                data-testid="menu-toggle-restriction"
                onClick={() =>
                  onUpdateCell(
                    editingCell.areaId,
                    editingCell.side,
                    { ...activeObs, restriction: !activeObs.restriction },
                    true
                  )
                }
                className={`min-h-[46px] px-3.5 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  activeObs.restriction
                    ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                    : 'bg-white text-[#1E3A8A] border-slate-300 hover:bg-blue-50/50'
                }`}
              >
                <span className="text-left">Restriction</span>
                <span
                  className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                    activeObs.restriction ? 'border-white bg-white/25' : 'border-[#1E3A8A]'
                  }`}
                />
              </button>

              <button
                type="button"
                data-testid="menu-toggle-released"
                onClick={() =>
                  onUpdateCell(
                    editingCell.areaId,
                    editingCell.side,
                    { ...activeObs, released: !activeObs.released },
                    true
                  )
                }
                className={`min-h-[46px] px-3.5 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  activeObs.released
                    ? 'bg-[#15803D] text-white border-[#15803D]'
                    : 'bg-white text-[#15803D] border-slate-300 hover:bg-emerald-50/50'
                }`}
              >
                <span className="text-left">Released</span>
                <Check
                  className={`w-4 h-4 shrink-0 ${
                    activeObs.released ? 'text-white' : 'text-[#15803D]'
                  }`}
                />
              </button>
            </div>

            {/* 3. Quick Release Sign Presets */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.releaseSignsLabel}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {RELEASE_SIGNS_PRESETS.map((preset) => {
                  const currentSigns = activeObs.releaseSigns ?? [];
                  const active = currentSigns.includes(preset.en);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        const nextSigns = active
                          ? currentSigns.filter((s) => s !== preset.en)
                          : [...currentSigns, preset.en];
                        onUpdateCell(
                          editingCell.areaId,
                          editingCell.side,
                          {
                            ...activeObs,
                            releaseSigns: nextSigns,
                            released: nextSigns.length > 0 ? true : activeObs.released,
                          },
                          true
                        );
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#15803D]/15 border-[#15803D] text-[#15803D] font-medium'
                          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {lang === 'ru' ? preset.ru : preset.en}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Add Note */}
            <div>
              <label
                htmlFor="cell-short-note"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                {lang === 'ru' ? 'Добавить заметку (Add note)' : 'Add note'}
              </label>
              <input
                id="cell-short-note"
                data-testid="menu-input-note"
                type="text"
                value={activeObs.note}
                onChange={(e) =>
                  onUpdateCell(
                    editingCell.areaId,
                    editingCell.side,
                    { ...activeObs, note: e.target.value },
                    true
                  )
                }
                placeholder={
                  lang === 'ru'
                    ? 'Напр., C3–C5, Lateral Cervical Flexion...'
                    : 'e.g., C3–C5, softened with Lateral Cervical Flexion...'
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#2B4C3F] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <button
                type="button"
                data-testid="menu-clear-all"
                onClick={() =>
                  onUpdateCell(
                    editingCell.areaId,
                    editingCell.side,
                    {
                      reaction: null,
                      restriction: false,
                      released: false,
                      releaseSigns: [],
                      note: '',
                    },
                    true
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.clearCell}</span>
              </button>
              <button
                type="button"
                data-testid="menu-done-btn"
                onClick={() => setEditingCell(null)}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#2B4C3F] hover:bg-[#223D32] rounded-lg cursor-pointer"
              >
                {t.saveClose}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
