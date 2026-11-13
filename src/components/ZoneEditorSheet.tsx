import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnatomicalAreaId,
  AreaSideObservation,
  EvaluationTableState,
  Language,
  ReactionLevel,
  Side,
} from '../types';
import { ANATOMICAL_AREAS } from '../data/anatomicalAreas';
import {
  formatChipLabel,
  isReleaseSignSelected,
  MASTERSON_TECHNIQUES,
  MORE_RELEASE_SIGNS,
  QUICK_RELEASE_CHIPS,
  RESISTANCE_SIGNS,
  TaxonomyChipItem,
  TRANSLATIONS,
} from '../data/translations';
import { getAdjacentAreaId, toggleSignChip } from '../utils/zoneEditing';
import { ZoneReferencePanel } from './ZoneReferencePanel';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Info,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';

export interface UpdateCellOptions {
  /** Consecutive updates sharing a key collapse into a single undo step. */
  coalesceKey?: string;
}

export type UpdateCellFn = (
  areaId: AnatomicalAreaId,
  side: Side,
  next: AreaSideObservation,
  syncDiagram: boolean,
  options?: UpdateCellOptions
) => void;

interface ZoneEditorSheetProps {
  cell: { areaId: AnatomicalAreaId; side: Side };
  tableState: EvaluationTableState;
  /** Zones Prev/Next walk through, in display order. */
  navAreaIds: AnatomicalAreaId[];
  lang: Language;
  onUpdateCell: UpdateCellFn;
  onChangeCell: (next: { areaId: AnatomicalAreaId; side: Side } | null) => void;
  /** Lets the parent force a pending note to be written (e.g. before Finish). */
  flushRef?: React.MutableRefObject<(() => void) | null>;
}

const NOTE_DEBOUNCE_MS = 500;

const EMPTY_OBS: AreaSideObservation = {
  reaction: null,
  restriction: false,
  released: false,
  note: '',
};

const QUICK_RESPONSE_CHIPS = QUICK_RELEASE_CHIPS.filter((c) => c.group === 'response');
const QUICK_RELEASE_GROUP_CHIPS = QUICK_RELEASE_CHIPS.filter((c) => c.group !== 'response');

export const ZoneEditorSheet: React.FC<ZoneEditorSheetProps> = ({
  cell,
  tableState,
  navAreaIds,
  lang,
  onUpdateCell,
  onChangeCell,
  flushRef,
}) => {
  const t = TRANSLATIONS[lang];
  const ru = lang === 'ru';
  const { areaId, side } = cell;
  const area = ANATOMICAL_AREAS.find((a) => a.id === areaId);
  const obs = tableState[areaId]?.[side] ?? EMPTY_OBS;

  const [expanded, setExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(() => Boolean(obs.note?.trim()));
  const [noteDraft, setNoteDraft] = useState(obs.note ?? '');

  // Per-zone UI resets in the same render that shows another zone or side, so the
  // previous zone's note text is never painted under the new zone's title.
  const cellKey = `${areaId}:${side}`;
  const [shownCellKey, setShownCellKey] = useState(cellKey);
  if (shownCellKey !== cellKey) {
    setShownCellKey(cellKey);
    setShowInfo(false);
    setShowMenu(false);
    setNoteOpen(Boolean(obs.note?.trim()));
    setNoteDraft(obs.note ?? '');
  }

  // The note is edited locally and written after a pause, so typing costs one
  // database write and one undo step per burst instead of one per keystroke.
  const pendingNoteRef = useRef<{
    areaId: AnatomicalAreaId;
    side: Side;
    note: string;
    key: string;
  } | null>(null);
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteBurstKeyRef = useRef('');
  const latestRef = useRef({ tableState, onUpdateCell });
  latestRef.current = { tableState, onUpdateCell };

  const takePendingNote = () => {
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = null;
    const pending = pendingNoteRef.current;
    pendingNoteRef.current = null;
    return pending;
  };

  const flushNote = useCallback(() => {
    const pending = takePendingNote();
    if (!pending) return;
    const current = latestRef.current.tableState[pending.areaId]?.[pending.side] ?? EMPTY_OBS;
    if ((current.note ?? '') === pending.note) return;
    latestRef.current.onUpdateCell(
      pending.areaId,
      pending.side,
      { ...current, note: pending.note },
      true,
      { coalesceKey: pending.key }
    );
  }, []);

  useEffect(() => {
    if (flushRef) flushRef.current = flushNote;
    return () => {
      flushNote();
      if (flushRef) flushRef.current = null;
    };
  }, [flushNote, flushRef]);

  // Follow outside changes to the note (undo, clear) unless the user is mid-edit.
  useEffect(() => {
    if (!pendingNoteRef.current) setNoteDraft(obs.note ?? '');
  }, [obs.note]);

  if (!area) return null;

  /** Apply a change to this zone, carrying along any note text not yet written. */
  const update = (change: (base: AreaSideObservation) => AreaSideObservation) => {
    const pending = pendingNoteRef.current;
    let base = obs;
    if (pending && pending.areaId === areaId && pending.side === side) {
      takePendingNote();
      base = { ...obs, note: pending.note };
    }
    onUpdateCell(areaId, side, change(base), true);
  };

  const goTo = (next: { areaId: AnatomicalAreaId; side: Side } | null) => {
    flushNote();
    onChangeCell(next);
  };

  const navIds = navAreaIds.includes(areaId)
    ? navAreaIds
    : ANATOMICAL_AREAS.map((a) => a.id);
  const prevId = getAdjacentAreaId(navIds, areaId, -1);
  const nextId = getAdjacentAreaId(navIds, areaId, 1);

  const extraCount =
    MORE_RELEASE_SIGNS.filter((item) => isReleaseSignSelected(obs.releaseSigns, item.en))
      .length +
    (obs.resistanceSigns?.length ?? 0) +
    (obs.techniques?.length ?? 0);

  const renderSignChip = (chip: TaxonomyChipItem) => {
    const active = isReleaseSignSelected(obs.releaseSigns, chip.en);
    const yawnCount = obs.yawnCount ?? 1;
    const tone =
      chip.group === 'response'
        ? active
          ? 'bg-[#2B4C3F]/12 border-[#2B4C3F] text-[#2B4C3F] font-semibold'
          : 'bg-white border-slate-300 text-slate-700 font-medium'
        : active
          ? 'bg-[#15803D]/15 border-[#15803D] text-[#15803D] font-semibold'
          : 'bg-white border-slate-300 text-slate-700 font-medium';

    if (chip.supportsCounter && active) {
      return (
        <div
          key={chip.id}
          className="min-h-[44px] flex items-stretch rounded-xl border border-[#15803D] bg-[#15803D]/15 text-[#15803D] overflow-hidden"
        >
          <button
            type="button"
            data-testid={`quick-chip-${chip.id}`}
            aria-pressed
            onClick={() => update((base) => toggleSignChip(base, chip))}
            className="flex-1 min-w-0 px-2 py-1 text-xs font-semibold text-left leading-tight cursor-pointer"
          >
            {formatChipLabel(chip, lang)} ×{yawnCount}
          </button>
          <button
            type="button"
            data-testid="yawn-counter-btn"
            aria-label={ru ? 'Ещё один зевок' : 'Add one yawn'}
            onClick={() =>
              update((base) => ({ ...base, yawnCount: yawnCount >= 5 ? 1 : yawnCount + 1 }))
            }
            className="min-w-[40px] flex items-center justify-center bg-[#15803D] text-white cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      );
    }

    return (
      <button
        key={chip.id}
        type="button"
        data-testid={`quick-chip-${chip.id}`}
        aria-pressed={active}
        onClick={() => update((base) => toggleSignChip(base, chip))}
        className={`min-h-[44px] px-2 py-1 rounded-xl text-xs border text-center leading-tight transition-colors cursor-pointer ${tone}`}
      >
        {formatChipLabel(chip, lang)}
      </button>
    );
  };

  const renderListChip = (
    item: TaxonomyChipItem,
    active: boolean,
    testId: string,
    activeClass: string,
    onToggle: () => void
  ) => (
    <button
      key={item.id}
      type="button"
      data-testid={testId}
      aria-pressed={active}
      onClick={onToggle}
      className={`min-h-[44px] px-2.5 py-1.5 rounded-lg text-xs border text-left leading-tight flex items-center justify-between gap-1 cursor-pointer ${
        active
          ? activeClass
          : 'bg-[#FAF9F6] border-slate-300 text-slate-700 hover:bg-slate-100'
      }`}
    >
      <span>{formatChipLabel(item, lang)}</span>
      {active && <Check className="w-3.5 h-3.5 shrink-0" />}
    </button>
  );

  const toggleInList = (list: string[] | undefined, value: string) => {
    const current = list ?? [];
    return current.includes(value) ? current.filter((x) => x !== value) : [...current, value];
  };

  const groupLabel = 'text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 sm:bg-black/45 p-0 sm:p-4 no-print"
      onClick={() => goTo(null)}
      role="dialog"
      aria-modal="true"
      data-testid="anatomical-context-menu"
      aria-label={`Edit ${side} ${area.nameEn}`}
    >
      <div
        data-testid="zone-editor-sheet"
        data-expanded={expanded}
        className={`w-full max-w-lg flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#FAF9F6] border-t sm:border border-slate-300 shadow-2xl overflow-hidden transition-[height] duration-200 sm:h-auto sm:max-h-[88vh] ${
          expanded ? 'h-[92dvh]' : 'h-[60dvh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: handle, zone title, side toggle, info, overflow menu */}
        <div className="shrink-0 border-b border-slate-200 px-3 pb-2 sm:px-5 sm:pt-3">
          <button
            type="button"
            data-testid="zone-sheet-handle"
            aria-label={
              expanded
                ? ru
                  ? 'Свернуть панель'
                  : 'Collapse panel'
                : ru
                  ? 'Развернуть панель'
                  : 'Expand panel'
            }
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="sm:hidden w-full h-6 flex items-center justify-center cursor-pointer"
          >
            <span className="w-11 h-1.5 rounded-full bg-slate-300" />
          </button>

          <div className="flex items-center gap-1.5">
            <h3
              data-testid="zone-sheet-title"
              className="flex-1 min-w-0 text-sm font-bold text-[#1E2421] leading-tight line-clamp-2"
            >
              {area.index}. {ru ? area.nameRu : area.nameEn}
            </h3>

            <div className="inline-flex rounded-lg bg-slate-200/80 p-0.5 shrink-0">
              {(['left', 'right'] as Side[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  data-testid={`zone-sheet-side-${s}`}
                  aria-pressed={side === s}
                  onClick={() => goTo({ areaId, side: s })}
                  className={`min-h-[36px] px-2.5 rounded-md text-[11px] font-semibold uppercase cursor-pointer transition-colors ${
                    side === s ? 'bg-[#2B4C3F] text-white' : 'text-slate-600'
                  }`}
                >
                  {s === 'left' ? t.tableLeft : t.tableRight}
                </button>
              ))}
            </div>

            <button
              type="button"
              data-testid="zone-sheet-info-btn"
              aria-label={ru ? 'Пояснение к зоне' : 'About this zone'}
              aria-expanded={showInfo}
              onClick={() => setShowInfo((v) => !v)}
              className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl cursor-pointer shrink-0 ${
                showInfo ? 'bg-[#2B4C3F] text-white' : 'text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Info className="w-[18px] h-[18px]" />
            </button>

            <div className="relative shrink-0">
              <button
                type="button"
                data-testid="zone-sheet-more-btn"
                aria-label={ru ? 'Ещё' : 'More actions'}
                aria-expanded={showMenu}
                onClick={() => setShowMenu((v) => !v)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 z-10 rounded-xl border border-slate-300 bg-white shadow-lg p-1">
                  <button
                    type="button"
                    data-testid="menu-clear-all"
                    onClick={() => {
                      takePendingNote();
                      setNoteDraft('');
                      setNoteOpen(false);
                      setShowMenu(false);
                      onUpdateCell(
                        areaId,
                        side,
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
                      );
                    }}
                    className="min-h-[44px] inline-flex items-center gap-2 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t.clearCell}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {showInfo && (
            <p
              data-testid="zone-sheet-explanation"
              className="mt-1.5 text-xs text-slate-600 leading-snug"
            >
              {ru ? area.explanationRu : area.explanationEn}
            </p>
          )}
          {showInfo && (
            <ZoneReferencePanel areaId={areaId} tableState={tableState} lang={lang} />
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 sm:px-5 space-y-3">
          {/* Reaction: — | 1 | 2 | 3 */}
          <div
            role="group"
            aria-label={t.reactionLevel}
            className="grid grid-cols-4 gap-0.5 rounded-xl border border-slate-300 bg-white p-0.5"
          >
            <button
              type="button"
              data-testid="menu-reaction-none"
              aria-pressed={!obs.reaction}
              aria-label={ru ? 'Нет реакции' : 'No reaction'}
              onClick={() => update((base) => ({ ...base, reaction: null }))}
              className={`min-h-[48px] rounded-lg text-base font-bold cursor-pointer transition-colors ${
                !obs.reaction ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              —
            </button>
            {([1, 2, 3] as ReactionLevel[]).map((lvl) => {
              const isActive = obs.reaction === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  data-testid={`menu-reaction-${lvl}`}
                  aria-pressed={isActive}
                  aria-label={ru ? `Реакция ${lvl}` : `Reaction ${lvl}`}
                  onClick={() =>
                    update((base) => ({ ...base, reaction: isActive ? null : lvl }))
                  }
                  className={`min-h-[48px] rounded-lg text-base font-bold font-tabular cursor-pointer transition-colors ${
                    isActive ? 'bg-[#B91C1C] text-white' : 'text-[#B91C1C] hover:bg-red-50'
                  }`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>

          {/* Restriction + Released */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="menu-toggle-restriction"
              aria-pressed={obs.restriction}
              onClick={() => update((base) => ({ ...base, restriction: !base.restriction }))}
              className={`min-h-[48px] px-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                obs.restriction
                  ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                  : 'bg-white text-[#1E3A8A] border-slate-300'
              }`}
            >
              <span>{ru ? 'Рестрикция' : 'Restriction'}</span>
              <span
                className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                  obs.restriction ? 'border-white bg-white/25' : 'border-[#1E3A8A]'
                }`}
              />
            </button>
            <button
              type="button"
              data-testid="menu-toggle-released"
              aria-pressed={obs.released}
              onClick={() => update((base) => ({ ...base, released: !base.released }))}
              className={`min-h-[48px] px-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                obs.released
                  ? 'bg-[#15803D] text-white border-[#15803D]'
                  : 'bg-white text-[#15803D] border-slate-300'
              }`}
            >
              <span>{ru ? 'Релиз' : 'Released'}</span>
              <Check className="w-4 h-4 shrink-0" />
            </button>
          </div>

          {/* Response signs: recorded, but do not mark the zone Released */}
          <div data-testid="quick-response-chips">
            <div className={groupLabel}>{ru ? 'Ответ' : 'Response'}</div>
            <div className="grid grid-cols-3 gap-1.5">
              {QUICK_RESPONSE_CHIPS.map(renderSignChip)}
            </div>
          </div>

          {/* Release signs: also mark the zone Released */}
          <div data-testid="quick-release-chips-grid">
            <div className={groupLabel}>
              {ru ? 'Релиз — отмечает зону' : 'Release — marks zone released'}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {QUICK_RELEASE_GROUP_CHIPS.map(renderSignChip)}
            </div>
          </div>

          {/* More: extra release signs, resistance, techniques */}
          <div className="rounded-xl border border-slate-300 bg-white overflow-hidden">
            <button
              type="button"
              data-testid="toggle-more-taxonomy-btn"
              aria-expanded={isMoreOpen}
              onClick={() => setIsMoreOpen((v) => !v)}
              className="w-full min-h-[44px] px-3 flex items-center justify-between text-xs font-semibold text-[#2B4C3F] bg-[#F3F1EC]/70 cursor-pointer"
            >
              <span className="flex items-center gap-2 text-left">
                <span>{t.moreTaxonomyLabel}</span>
                {extraCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#2B4C3F] text-white text-[10px]">
                    {extraCount}
                  </span>
                )}
              </span>
              {isMoreOpen ? (
                <ChevronUp className="w-4 h-4 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 shrink-0" />
              )}
            </button>

            {isMoreOpen && (
              <div
                data-testid="more-taxonomy-panel"
                className="p-3 space-y-3 border-t border-slate-200"
              >
                <div>
                  <div className="text-[11px] font-semibold text-[#15803D] mb-1.5">
                    {t.additionalReleasesLabel}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {MORE_RELEASE_SIGNS.map((item) =>
                      renderListChip(
                        item,
                        isReleaseSignSelected(obs.releaseSigns, item.en),
                        `more-release-${item.id}`,
                        'bg-[#15803D]/15 border-[#15803D] text-[#15803D] font-semibold',
                        () => update((base) => toggleSignChip(base, item))
                      )
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-amber-900 mb-1.5">
                    {t.resistanceSignsLabel}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {RESISTANCE_SIGNS.map((item) =>
                      renderListChip(
                        item,
                        (obs.resistanceSigns ?? []).includes(item.en),
                        `resistance-chip-${item.id}`,
                        'bg-amber-100 border-amber-600 text-amber-950 font-semibold',
                        () =>
                          update((base) => ({
                            ...base,
                            resistanceSigns: toggleInList(base.resistanceSigns, item.en),
                          }))
                      )
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-[#1E3A8A] mb-1.5">
                    {t.techniquesUsedLabel}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {MASTERSON_TECHNIQUES.map((item) =>
                      renderListChip(
                        item,
                        (obs.techniques ?? []).includes(item.en),
                        `technique-chip-${item.id}`,
                        'bg-[#1E3A8A]/15 border-[#1E3A8A] text-[#1E3A8A] font-semibold',
                        () =>
                          update((base) => ({
                            ...base,
                            techniques: toggleInList(base.techniques, item.en),
                          }))
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Note: collapsed until asked for */}
          {noteOpen ? (
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
                autoComplete="off"
                value={noteDraft}
                onFocus={() => {
                  noteBurstKeyRef.current = `note:${areaId}:${side}:${Date.now()}`;
                }}
                onChange={(e) => {
                  const value = e.target.value;
                  setNoteDraft(value);
                  if (!noteBurstKeyRef.current) {
                    noteBurstKeyRef.current = `note:${areaId}:${side}:${Date.now()}`;
                  }
                  pendingNoteRef.current = {
                    areaId,
                    side,
                    note: value,
                    key: noteBurstKeyRef.current,
                  };
                  if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
                  noteTimerRef.current = setTimeout(flushNote, NOTE_DEBOUNCE_MS);
                }}
                onBlur={() => {
                  flushNote();
                  noteBurstKeyRef.current = '';
                }}
                placeholder={
                  ru
                    ? 'Напр., C3–C5, смягчилось после бокового сгибания…'
                    : 'e.g., C3–C5, softened after lateral cervical flexion…'
                }
                className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-base sm:text-xs text-slate-900 focus:border-[#2B4C3F] focus:outline-none"
              />
            </div>
          ) : (
            <button
              type="button"
              data-testid="zone-sheet-add-note-btn"
              onClick={() => setNoteOpen(true)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-600 inline-flex items-center gap-1.5 hover:bg-white cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{ru ? 'Заметка' : 'Note'}</span>
            </button>
          )}
        </div>

        {/* Footer: Prev · Done · Next */}
        <div className="shrink-0 border-t border-slate-200 px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-5 grid grid-cols-[1fr_1.3fr_1fr] gap-2">
          <button
            type="button"
            data-testid="zone-sheet-prev-btn"
            disabled={!prevId}
            onClick={() => prevId && goTo({ areaId: prevId, side })}
            className="min-h-[48px] inline-flex items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-[#1E2421] disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{ru ? 'Назад' : 'Prev'}</span>
          </button>
          <button
            type="button"
            data-testid="menu-done-btn"
            onClick={() => goTo(null)}
            className="min-h-[48px] rounded-xl bg-[#2B4C3F] hover:bg-[#223D32] text-sm font-bold text-white cursor-pointer"
          >
            {t.saveClose}
          </button>
          <button
            type="button"
            data-testid="zone-sheet-next-btn"
            disabled={!nextId}
            onClick={() => nextId && goTo({ areaId: nextId, side })}
            className="min-h-[48px] inline-flex items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-[#1E2421] disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            <span>{ru ? 'Далее' : 'Next'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
