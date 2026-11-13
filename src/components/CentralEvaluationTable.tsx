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
import {
  ANATOMICAL_AREAS,
  ANATOMICAL_REGIONS,
  BodyPartFilterId,
  BodySegmentId,
  matchesBodyPartFilter,
} from '../data/anatomicalAreas';
import {
  formatChipLabel,
  isReleaseSignSelected,
  MASTERSON_TECHNIQUES,
  MORE_RELEASE_SIGNS,
  QUICK_RELEASE_CHIPS,
  RESISTANCE_SIGNS,
  toggleReleaseSignInList,
  TRANSLATIONS,
} from '../data/translations';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  MessageSquareText,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

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
  bodyPartFilter?: BodyPartFilterId;
  /** Active 3-segment body region ('head_neck' | 'torso_pelvis' | 'limbs') for the unified single-screen view */
  activeBodySegment?: BodySegmentId;
  /** Active side ('left' | 'right') for the unified single-screen zone list */
  mobileSingleSide?: Side | null;
  /** Optional class applied only to the table/list container, never hiding the fixed Bottom Sheet */
  tableContainerClassName?: string;
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
}) => {
  const t = TRANSLATIONS[lang];
  const [internalPopover, setInternalPopover] = useState<{
    areaId: AnatomicalAreaId;
    side: Side;
  } | null>(null);
  const [infoAreaId, setInfoAreaId] = useState<AnatomicalAreaId | null>(null);
  const [isMoreTaxonomyOpen, setIsMoreTaxonomyOpen] = useState(false);

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

  const extraTaxonomyCount = activeObs
    ? MORE_RELEASE_SIGNS.filter((item) =>
        isReleaseSignSelected(activeObs.releaseSigns, item.en)
      ).length +
      (activeObs.resistanceSigns?.length ?? 0) +
      (activeObs.techniques?.length ?? 0)
    : 0;

  const filteredAreas = ANATOMICAL_AREAS.filter((area) =>
    matchesBodyPartFilter(area.id, bodyPartFilter)
  );

  return (
    <div className="relative w-full">
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
                  onPointerEnter={() =>
                    onHoverArea?.({ areaId: area.id, side: mobileSingleSide })
                  }
                  onPointerLeave={() => onHoverArea?.(null)}
                  onClick={() =>
                    !readOnly &&
                    setEditingCell({ areaId: area.id, side: mobileSingleSide })
                  }
                  className={`w-full min-h-[44px] px-3 py-2 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
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

      {/* Anatomical Explanation Callout if opened */}
      {infoMeta && !readOnly && (
        <div className="mt-2 p-3 rounded-lg bg-[#F3F1EC] border border-slate-300 text-xs text-slate-700 flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-[#2B4C3F]">
              {infoMeta.index}. {lang === 'ru' ? infoMeta.nameRu : infoMeta.nameEn}
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
      </div>

      {/* SLIDE-UP BOTTOM SHEET ZONE EDITOR (Thumb-Reachable on Mobile, Centered Card on Desktop) */}
      {editingCell && activeAreaMeta && activeObs && !readOnly && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4 no-print"
          onClick={() => setEditingCell(null)}
          role="dialog"
          aria-modal="true"
          data-testid="anatomical-context-menu"
          aria-label={`Edit ${editingCell.side} ${activeAreaMeta.nameEn}`}
        >
          <div
            className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#FAF9F6] border-t sm:border border-slate-300 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header with Drag Handle, Side switcher, Region tag, and Area explanation */}
            <div className="px-4 pt-3 pb-3 sm:px-5 sm:pt-4 border-b border-slate-200 bg-[#FAF9F6] shrink-0 space-y-2">
              <div className="w-11 h-1.5 rounded-full bg-slate-300 mx-auto sm:hidden" />
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="inline-flex rounded-lg bg-slate-200/80 p-0.5">
                      {(['left', 'right'] as Side[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            setEditingCell({ areaId: editingCell.areaId, side: s })
                          }
                          className={`min-h-[32px] px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase cursor-pointer transition-colors ${
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
                      <span className="text-slate-500 font-medium">
                        · {lang === 'ru' ? activeRegionMeta.nameRu : activeRegionMeta.nameEn}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-[#1E2421]">
                    {activeAreaMeta.index}.{' '}
                    {lang === 'ru' ? activeAreaMeta.nameRu : activeAreaMeta.nameEn}
                  </h3>
                  <p className="text-xs text-slate-500 leading-snug">
                    {lang === 'ru'
                      ? activeAreaMeta.explanationRu
                      : activeAreaMeta.explanationEn}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCell(null)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-xl bg-slate-200/60 hover:bg-slate-200 cursor-pointer shrink-0"
                  aria-label="Close cell editor"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Middle Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3.5 sm:px-5 space-y-4">
              {/* 1. Primary Status Controls: Reaction Level 1, 2, 3 (Red #B91C1C) */}
              <div>
              <div className="flex items-center justify-between mb-1.5">
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
                    className="text-[11px] font-medium text-red-700 hover:underline cursor-pointer"
                  >
                    {lang === 'ru' ? 'Сбросить реакцию' : 'Clear reaction'}
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
                      className={`min-h-[48px] px-2.5 py-2 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#B91C1C] text-white border-[#B91C1C] shadow-xs'
                          : 'bg-white text-[#B91C1C] border-slate-300 hover:bg-red-50/60'
                      }`}
                    >
                      <span>
                        {lang === 'ru' ? `Реакция ${lvl}` : `Reaction ${lvl}`}
                      </span>
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

            {/* 2. Primary Status Controls: Restriction (Dark Blue #1E3A8A) & Released (Green #15803D) */}
            <div className="grid grid-cols-2 gap-2.5">
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
                className={`min-h-[48px] px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  activeObs.restriction
                    ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-xs'
                    : 'bg-white text-[#1E3A8A] border-slate-300 hover:bg-blue-50/50'
                }`}
              >
                <span className="text-left">
                  {lang === 'ru' ? 'Рестрикция' : 'Restriction'}
                </span>
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
                className={`min-h-[48px] px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  activeObs.released
                    ? 'bg-[#15803D] text-white border-[#15803D] shadow-xs'
                    : 'bg-white text-[#15803D] border-slate-300 hover:bg-emerald-50/50'
                }`}
              >
                <span className="text-left">
                  {lang === 'ru' ? 'Релиз (✓)' : 'Released'}
                </span>
                <Check
                  className={`w-4 h-4 shrink-0 ${
                    activeObs.released ? 'text-white' : 'text-[#15803D]'
                  }`}
                />
              </button>
            </div>

            {/* 3. 8 Always-Visible Quick Response/Release Chips (1-tap toggle, >= 44px touch target) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.releaseSignsLabel}
              </label>
              <div
                data-testid="quick-release-chips-grid"
                className="grid grid-cols-2 gap-2"
              >
                {QUICK_RELEASE_CHIPS.map((chip) => {
                  const active = isReleaseSignSelected(activeObs.releaseSigns, chip.en);
                  const yawnCount = activeObs.yawnCount ?? 1;

                  if (chip.supportsCounter && active) {
                    return (
                      <div
                        key={chip.id}
                        className="min-h-[44px] flex items-stretch rounded-xl border border-[#15803D] bg-[#15803D]/15 text-[#15803D] overflow-hidden"
                      >
                        <button
                          type="button"
                          data-testid={`quick-chip-${chip.id}`}
                          onClick={() => {
                            const nextSigns = toggleReleaseSignInList(
                              activeObs.releaseSigns,
                              chip.en
                            );
                            onUpdateCell(
                              editingCell.areaId,
                              editingCell.side,
                              {
                                ...activeObs,
                                releaseSigns: nextSigns,
                                yawnCount: undefined,
                              },
                              true
                            );
                          }}
                          className="flex-1 px-2.5 py-2 text-xs font-semibold text-left cursor-pointer"
                        >
                          {formatChipLabel(chip, lang)}
                          {yawnCount > 1 ? ` ×${yawnCount}` : ''}
                        </button>
                        <button
                          type="button"
                          data-testid="yawn-counter-btn"
                          title={
                            lang === 'ru'
                              ? 'Увеличить счетчик повторных зевков'
                              : 'Increment repeated yawn count'
                          }
                          onClick={() => {
                            const nextCount = yawnCount >= 5 ? 1 : yawnCount + 1;
                            onUpdateCell(
                              editingCell.areaId,
                              editingCell.side,
                              {
                                ...activeObs,
                                yawnCount: nextCount,
                              },
                              true
                            );
                          }}
                          className="min-w-[40px] px-2 flex items-center justify-center bg-[#15803D] text-white text-xs font-bold cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{yawnCount > 1 ? yawnCount : ''}</span>
                        </button>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={chip.id}
                      type="button"
                      data-testid={`quick-chip-${chip.id}`}
                      onClick={() => {
                        const nextSigns = toggleReleaseSignInList(
                          activeObs.releaseSigns,
                          chip.en
                        );
                        onUpdateCell(
                          editingCell.areaId,
                          editingCell.side,
                          {
                            ...activeObs,
                            releaseSigns: nextSigns,
                            yawnCount:
                              chip.supportsCounter && !active ? 1 : activeObs.yawnCount,
                            released: nextSigns.length > 0 ? true : activeObs.released,
                          },
                          true
                        );
                      }}
                      className={`min-h-[44px] px-3 py-2 rounded-xl text-xs border text-left flex items-center justify-between gap-1.5 transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#15803D]/15 border-[#15803D] text-[#15803D] font-semibold'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <span className="truncate">{formatChipLabel(chip, lang)}</span>
                      {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Collapsible "+ More / Resistance / Technique" Section (Progressive Disclosure) */}
            <div className="rounded-xl border border-slate-300 bg-white overflow-hidden">
              <button
                type="button"
                data-testid="toggle-more-taxonomy-btn"
                onClick={() => setIsMoreTaxonomyOpen((v) => !v)}
                className="w-full min-h-[44px] px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-[#2B4C3F] bg-[#F3F1EC]/70 hover:bg-[#F3F1EC] cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span>{t.moreTaxonomyLabel}</span>
                  {extraTaxonomyCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#2B4C3F] text-white text-[10px]">
                      {extraTaxonomyCount}
                    </span>
                  )}
                </span>
                {isMoreTaxonomyOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {isMoreTaxonomyOpen && (
                <div
                  data-testid="more-taxonomy-panel"
                  className="p-3.5 space-y-3.5 border-t border-slate-200"
                >
                  {/* 4a. Additional Subtle & Release Signs */}
                  <div>
                    <div className="text-[11px] font-semibold text-[#15803D] mb-1.5">
                      {t.additionalReleasesLabel}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {MORE_RELEASE_SIGNS.map((item) => {
                        const active = isReleaseSignSelected(
                          activeObs.releaseSigns,
                          item.en
                        );
                        return (
                          <button
                            key={item.id}
                            type="button"
                            data-testid={`more-release-${item.id}`}
                            onClick={() => {
                              const nextSigns = toggleReleaseSignInList(
                                activeObs.releaseSigns,
                                item.en
                              );
                              onUpdateCell(
                                editingCell.areaId,
                                editingCell.side,
                                {
                                  ...activeObs,
                                  releaseSigns: nextSigns,
                                  released:
                                    nextSigns.length > 0 ? true : activeObs.released,
                                },
                                true
                              );
                            }}
                            className={`min-h-[44px] px-2.5 py-1.5 rounded-lg text-xs border text-left flex items-center justify-between gap-1 cursor-pointer ${
                              active
                                ? 'bg-[#15803D]/15 border-[#15803D] text-[#15803D] font-semibold'
                                : 'bg-[#FAF9F6] border-slate-300 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span className="truncate">
                              {formatChipLabel(item, lang)}
                            </span>
                            {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4b. Resistance / Guarding Signs */}
                  <div>
                    <div className="text-[11px] font-semibold text-amber-900 mb-1.5">
                      {t.resistanceSignsLabel}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {RESISTANCE_SIGNS.map((item) => {
                        const current = activeObs.resistanceSigns ?? [];
                        const active = current.includes(item.en);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            data-testid={`resistance-chip-${item.id}`}
                            onClick={() => {
                              const nextResistance = active
                                ? current.filter((x) => x !== item.en)
                                : [...current, item.en];
                              onUpdateCell(
                                editingCell.areaId,
                                editingCell.side,
                                {
                                  ...activeObs,
                                  resistanceSigns: nextResistance,
                                },
                                true
                              );
                            }}
                            className={`min-h-[44px] px-2.5 py-1.5 rounded-lg text-xs border text-left flex items-center justify-between gap-1 cursor-pointer ${
                              active
                                ? 'bg-amber-100 border-amber-600 text-amber-950 font-semibold'
                                : 'bg-[#FAF9F6] border-slate-300 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span className="truncate">
                              {formatChipLabel(item, lang)}
                            </span>
                            {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4c. Masterson Techniques Used */}
                  <div>
                    <div className="text-[11px] font-semibold text-[#1E3A8A] mb-1.5">
                      {t.techniquesUsedLabel}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {MASTERSON_TECHNIQUES.map((item) => {
                        const current = activeObs.techniques ?? [];
                        const active = current.includes(item.en);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            data-testid={`technique-chip-${item.id}`}
                            onClick={() => {
                              const nextTech = active
                                ? current.filter((x) => x !== item.en)
                                : [...current, item.en];
                              onUpdateCell(
                                editingCell.areaId,
                                editingCell.side,
                                {
                                  ...activeObs,
                                  techniques: nextTech,
                                },
                                true
                              );
                            }}
                            className={`min-h-[44px] px-2.5 py-1.5 rounded-lg text-xs border text-left flex items-center justify-between gap-1 cursor-pointer ${
                              active
                                ? 'bg-[#1E3A8A]/15 border-[#1E3A8A] text-[#1E3A8A] font-semibold'
                                : 'bg-[#FAF9F6] border-slate-300 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span className="truncate">
                              {formatChipLabel(item, lang)}
                            </span>
                            {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Single-line Area Note right below chips */}
            <div>
              <label
                htmlFor="cell-short-note"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                {t.observationNote}
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
                    ? 'Напр., C3–C5, смягчилось после бокового сгибания...'
                    : 'e.g., C3–C5, softened after Lateral Cervical Flexion...'
                }
                className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-[#2B4C3F] focus:outline-none"
              />
            </div>
            </div>

            {/* 6. Sticky Bottom-Anchored Action Bar (>= 48px Touch Targets) */}
            <div className="px-4 py-3 sm:px-5 border-t border-slate-200 bg-[#FAF9F6] shrink-0 flex items-center justify-between gap-3">
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
                      yawnCount: undefined,
                      resistanceSigns: [],
                      techniques: [],
                      note: '',
                    },
                    true
                  )
                }
                className="min-h-[48px] inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-xl border border-red-200 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t.clearCell}</span>
              </button>
              <button
                type="button"
                data-testid="menu-done-btn"
                onClick={() => setEditingCell(null)}
                className="flex-1 sm:flex-initial min-h-[48px] px-7 py-2.5 text-sm font-bold text-white bg-[#2B4C3F] hover:bg-[#223D32] rounded-xl shadow-xs cursor-pointer"
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
