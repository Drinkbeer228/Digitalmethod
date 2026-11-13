import React, { useEffect, useRef, useState } from 'react';
import {
  AnatomicalAreaId,
  AnatomicalRegionId,
  AreaSideObservation,
  EvaluationTableState,
  Language,
  Side,
} from '../types';
import {
  ANATOMICAL_AREAS,
  ANATOMICAL_REGIONS,
  BodyPartFilterId,
  matchesBodyPartFilter,
} from '../data/anatomicalAreas';
import { TRANSLATIONS } from '../data/translations';
import { UpdateCellFn, ZoneEditorSheet } from './ZoneEditorSheet';
import { Check, Info, MessageSquareText } from 'lucide-react';
import { ZoneInfoSheet } from './ZoneInfoSheet';

interface CentralEvaluationTableProps {
  tableState: EvaluationTableState;
  onUpdateCell: UpdateCellFn;
  lang: Language;
  readOnly?: boolean;
  activePopover?: { areaId: AnatomicalAreaId; side: Side } | null;
  onChangeActivePopover?: (target: { areaId: AnatomicalAreaId; side: Side } | null) => void;
  hoveredAreaTarget?: { areaId: AnatomicalAreaId; side?: Side } | null;
  onHoverArea?: (target: { areaId: AnatomicalAreaId; side?: Side } | null) => void;
  activeRegionFilter?: AnatomicalRegionId | 'all';
  bodyPartFilter?: BodyPartFilterId;
  /** Active side ('left' | 'right') for the unified single-screen zone list */
  mobileSingleSide?: Side | null;
  /** Optional class applied only to the table/list container, never hiding the fixed Bottom Sheet */
  tableContainerClassName?: string;
  /** Class for the outer wrapper (e.g. to make the list the only scrolling region) */
  rootClassName?: string;
  /** Receives a function that writes any note text still waiting on its debounce */
  flushPendingNoteRef?: React.MutableRefObject<(() => void) | null>;
}

/**
 * Compact standardized vector symbols inside each Left/Right cell:
 * - Reaction Level 1: thin red line + "1"
 * - Reaction Level 2: bold red bar + "2"
 * - Reaction Level 3: zigzag red mark + "3"
 * - Restriction: dark blue circle "◯"
 * - Released: green checkmark "✓"
 * - Note / Extra taxonomy badges
 */
const CellSymbols: React.FC<{ obs: AreaSideObservation }> = ({ obs }) => {
  const hasReleaseChips = Boolean(obs.releaseSigns && obs.releaseSigns.length > 0);
  const hasResistance = Boolean(obs.resistanceSigns && obs.resistanceSigns.length > 0);
  const hasTechniques = Boolean(obs.techniques && obs.techniques.length > 0);
  const hasAnything =
    Boolean(obs.reaction) ||
    obs.restriction ||
    obs.released ||
    hasReleaseChips ||
    hasResistance ||
    hasTechniques ||
    Boolean(obs.note?.trim());

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
      {hasResistance && (
        <span
          className="px-1 py-0.2 rounded bg-amber-100 border border-amber-300 text-amber-900 text-[9px] font-bold"
          title={obs.resistanceSigns?.join(', ')}
        >
          !
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

/**
 * Crisp status badges for the single-screen Region-Grouped Zone List:
 * Shows R1/R2/R3, Restriction, Released, and Notes badges clearly.
 */
const ZoneStatusBadges: React.FC<{ obs: AreaSideObservation; lang: Language }> = ({
  obs,
  lang,
}) => {
  const hasNotes =
    Boolean(obs.note?.trim()) ||
    Boolean(obs.releaseSigns && obs.releaseSigns.length > 0) ||
    Boolean(obs.resistanceSigns && obs.resistanceSigns.length > 0) ||
    Boolean(obs.techniques && obs.techniques.length > 0);
  const hasAny =
    Boolean(obs.reaction) || obs.restriction || obs.released || hasNotes;

  if (!hasAny) {
    return (
      <span className="text-[11px] text-slate-400 font-medium select-none">
        {lang === 'ru' ? '—' : '—'}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap justify-end">
      {obs.reaction && (
        <span
          data-testid={`badge-reaction-R${obs.reaction}`}
          className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#B91C1C] text-white font-tabular text-[10px] font-bold leading-none"
        >
          R{obs.reaction}
        </span>
      )}
      {obs.restriction && (
        <span
          data-testid="badge-restriction"
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#1E3A8A]/12 border border-[#1E3A8A]/40 text-[#1E3A8A] text-[10px] font-semibold leading-none"
        >
          <span className="w-2 h-2 rounded-full border border-[#1E3A8A] bg-[#1E3A8A]/20" />
          <span>{lang === 'ru' ? 'Рестр.' : 'Restr.'}</span>
        </span>
      )}
      {obs.released && (
        <span
          data-testid="badge-released"
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#15803D]/12 border border-[#15803D]/40 text-[#15803D] text-[10px] font-semibold leading-none"
        >
          <Check className="w-2.5 h-2.5 stroke-[2.8]" />
          <span>{lang === 'ru' ? 'Релиз' : 'Released'}</span>
        </span>
      )}
      {hasNotes && (
        <span
          data-testid="badge-notes"
          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-slate-200/80 text-slate-700 text-[10px] font-medium leading-none"
          title={obs.note || obs.releaseSigns?.join(', ')}
        >
          <MessageSquareText className="w-2.5 h-2.5" />
        </span>
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
  bodyPartFilter = 'all',
  mobileSingleSide = null,
  tableContainerClassName = '',
  rootClassName = '',
  flushPendingNoteRef,
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

  const filteredAreas = ANATOMICAL_AREAS.filter((area) =>
    matchesBodyPartFilter(area.id, bodyPartFilter)
  );

  // Keep the row being edited in view as Prev/Next walks the list behind the sheet.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const editingAreaId = editingCell?.areaId ?? null;
  useEffect(() => {
    if (!editingAreaId || !mobileSingleSide) return;
    rootRef.current
      ?.querySelector(`[data-area-row="${editingAreaId}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [editingAreaId, mobileSingleSide]);

  return (
    <div ref={rootRef} className={`relative w-full ${rootClassName}`}>
      <div className={tableContainerClassName}>
      {/* MOBILE FILTERED ZONE LIST FOR THE ACTIVE SIDE (LEFT OR RIGHT) — NO DARK HEADER BANNER */}
      {mobileSingleSide ? (
        <div
          data-testid={`mobile-area-list-${mobileSingleSide}`}
          className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xs"
        >
          <div className="divide-y divide-slate-200">
            {filteredAreas.map((area, idx) => {
              const row = tableState[area.id] ?? {
                left: { reaction: null, restriction: false, released: false, note: '' },
                right: { reaction: null, restriction: false, released: false, note: '' },
              };
              const obs = row[mobileSingleSide];
              const region = ANATOMICAL_REGIONS.find((r) => r.id === area.regionId);
              const isSelected =
                editingCell?.areaId === area.id && editingCell?.side === mobileSingleSide;

              return (
                <button
                  key={area.id}
                  type="button"
                  data-testid={`mobile-list-row-${mobileSingleSide}-${area.id}`}
                  data-area-row={area.id}
                  onPointerEnter={() =>
                    onHoverArea?.({ areaId: area.id, side: mobileSingleSide })
                  }
                  onPointerLeave={() => onHoverArea?.(null)}
                  onClick={() =>
                    !readOnly &&
                    setEditingCell({ areaId: area.id, side: mobileSingleSide })
                  }
                  className={`w-full min-h-[48px] px-3 py-2 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#2B4C3F]/12'
                      : idx % 2 === 0
                        ? 'bg-[#FAF9F6] hover:bg-[#EAE6DF]/60'
                        : 'bg-[#F3F1EC]/70 hover:bg-[#EAE6DF]/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className="inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-tabular font-bold text-slate-900 shrink-0 border"
                      style={{
                        backgroundColor: region?.pastelFill ?? '#F3F1EC',
                        borderColor: region?.pastelStroke ?? '#CBD5E1',
                      }}
                    >
                      {area.index}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[#1E2421] leading-snug truncate">
                        {lang === 'ru' ? area.nameRu : area.nameEn}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <ZoneStatusBadges obs={obs} lang={lang} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* STANDARD 3-COLUMN TABLE (LEFT | AREA | RIGHT) FILTERED BY BODY PART */
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
              {filteredAreas.map((area, idx) => {
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
                        <div className="min-h-[42px] px-1.5 py-1 flex items-center justify-center">
                          <CellSymbols obs={row.left} />
                        </div>
                      ) : (
                        <button
                          type="button"
                          data-testid={`table-cell-left-${area.id}`}
                          onClick={() => setEditingCell({ areaId: area.id, side: 'left' })}
                          aria-label={`Left ${area.nameEn}`}
                          className={`w-full min-h-[44px] px-1.5 py-1 flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[#2B4C3F] ${
                            isLeftSelected
                              ? 'bg-[#2B4C3F]/18 ring-2 ring-inset ring-[#2B4C3F]'
                              : 'hover:bg-[#2B4C3F]/8'
                          }`}
                        >
                          <CellSymbols obs={row.left} />
                        </button>
                      )}
                    </td>

                    {/* CENTER ANATOMICAL AREA NAME + SUBTLE REGION SWATCH (Crisp Single-Language) */}
                    <td className="py-1.5 px-2 border-r border-slate-300/80 text-center align-middle">
                      <div className="flex items-center justify-between gap-1.5">
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-tabular font-semibold text-slate-900 shrink-0 border"
                          style={{
                            backgroundColor: region?.pastelFill ?? '#F3F1EC',
                            borderColor: region?.pastelStroke ?? '#CBD5E1',
                          }}
                          title={lang === 'ru' ? region?.nameRu : region?.nameEn}
                        >
                          {area.index}
                        </span>
                        <div className="flex-1 text-center leading-tight">
                          <span className="font-medium text-[#1E2421] text-[12px]">
                            {lang === 'ru' ? area.nameRu : area.nameEn}
                          </span>
                        </div>
                        {!readOnly && (
                          <button
                            type="button"
                            data-testid={`table-info-${area.id}`}
                            aria-haspopup="dialog"
                            aria-expanded={infoAreaId === area.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setInfoAreaId(area.id);
                            }}
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
                        <div className="min-h-[42px] px-1.5 py-1 flex items-center justify-center">
                          <CellSymbols obs={row.right} />
                        </div>
                      ) : (
                        <button
                          type="button"
                          data-testid={`table-cell-right-${area.id}`}
                          onClick={() =>
                            setEditingCell({ areaId: area.id, side: 'right' })
                          }
                          aria-label={`Right ${area.nameEn}`}
                          className={`w-full min-h-[44px] px-1.5 py-1 flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[#2B4C3F] ${
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
      )}

      </div>

      {/* Zone information (ⓘ next to a zone name): opens as its own sheet, so it is
          visible wherever the row is — not appended below the 21-row table */}
      {infoAreaId && !readOnly && !editingCell && (
        <ZoneInfoSheet
          areaId={infoAreaId}
          tableState={tableState}
          lang={lang}
          onClose={() => setInfoAreaId(null)}
        />
      )}

      {/* Zone editor: half-height bottom sheet on mobile, centered card on wider screens */}
      {editingCell && !readOnly && (
        <ZoneEditorSheet
          cell={editingCell}
          tableState={tableState}
          navAreaIds={filteredAreas.map((a) => a.id)}
          lang={lang}
          onUpdateCell={onUpdateCell}
          onChangeCell={setEditingCell}
          flushRef={flushPendingNoteRef}
        />
      )}
    </div>
  );
};
