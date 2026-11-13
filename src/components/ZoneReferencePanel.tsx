import React from 'react';
import { AnatomicalAreaId, EvaluationTableState, Language } from '../types';
import { ANATOMICAL_AREAS } from '../data/anatomicalAreas';
import {
  formatPressureRange,
  getLineLinksForArea,
  getLineMeta,
  getSessionPhaseForArea,
  getTechniquesForArea,
  getZonesOnLine,
  isAreaMarked,
  LineRole,
  LineSide,
  SESSION_ORDER_REF,
  SESSION_PHASES,
  SourceRef,
} from '../data/clinicalReference';

const ROLE_LABEL: Record<LineRole, { en: string; ru: string }> = {
  origin: { en: 'origin', ru: 'начало' },
  intermediate: { en: 'on the line', ru: 'на линии' },
  crossing: { en: 'crossing', ru: 'перекрест' },
  termination: { en: 'end', ru: 'конец' },
};

const SIDE_LABEL: Record<LineSide, { en: string; ru: string }> = {
  ipsi: { en: 'same side', ru: 'своя сторона' },
  contra: { en: 'to opposite side', ru: 'на другую сторону' },
  bilateral: { en: 'both sides', ru: 'обе стороны' },
};

const areaIndex = (id: AnatomicalAreaId) => ANATOMICAL_AREAS.find((a) => a.id === id)?.index ?? 0;
const areaName = (id: AnatomicalAreaId, ru: boolean) => {
  const a = ANATOMICAL_AREAS.find((x) => x.id === id);
  return a ? (ru ? a.nameRu : a.nameEn) : id;
};

const Cite: React.FC<{ refData: SourceRef }> = ({ refData }) => (
  <span className="text-[10px] text-slate-400">
    {refData.source}, {refData.page}
  </span>
);

/**
 * Source-backed reference for one zone: myofascial lines through it (with the other
 * zones on each line, marked ones highlighted), Masterson techniques and pressure,
 * and the zone's place in the session order. Purely informational — no diagnosis.
 */
export const ZoneReferencePanel: React.FC<{
  areaId: AnatomicalAreaId;
  tableState: EvaluationTableState;
  lang: Language;
}> = ({ areaId, tableState, lang }) => {
  const ru = lang === 'ru';
  const links = getLineLinksForArea(areaId);
  const tech = getTechniquesForArea(areaId);
  const phase = getSessionPhaseForArea(areaId);
  const pressure = tech ? formatPressureRange(tech.pressure, lang) : null;
  const notInSource = ru ? 'В источниках не описано' : 'Not described in the sources';

  return (
    <div
      data-testid="zone-reference-panel"
      className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white/70 p-2 text-xs text-slate-700 space-y-2.5"
    >
      {/* Myofascial lines */}
      <section data-testid="zone-ref-lines">
        <h4 className="font-semibold text-[#2B4C3F]">
          {ru ? 'Миофасциальные линии' : 'Myofascial lines'}
        </h4>
        {links.length === 0 ? (
          <p className="text-slate-500">{notInSource}</p>
        ) : (
          <ul className="mt-1 space-y-1.5">
            {links.map((link) => {
              const line = getLineMeta(link.lineId);
              const others = getZonesOnLine(link.lineId, areaId);
              const markedCount = others.filter((id) => isAreaMarked(tableState, id)).length;
              return (
                <li key={link.lineId} data-testid={`zone-ref-line-${link.lineId}`}>
                  <div>
                    <span className="mr-1 rounded bg-[#2B4C3F] px-1 py-px text-[10px] font-bold text-white">
                      {line.id}
                    </span>
                    <span className="font-medium">{ru ? line.nameRu : line.nameEn}</span>
                    <span className="text-slate-500">
                      {' · '}
                      {ROLE_LABEL[link.role][lang]}, {SIDE_LABEL[link.side][lang]}
                    </span>
                  </div>
                  {others.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <span className="text-slate-500">
                        {ru ? 'Также на линии' : 'Also on the line'} ({ru ? 'отмечено' : 'marked'} {markedCount}/
                        {others.length}):
                      </span>
                      {others.map((id) => {
                        const marked = isAreaMarked(tableState, id);
                        return (
                          <span
                            key={id}
                            title={areaName(id, ru)}
                            data-marked={marked ? 'true' : 'false'}
                            className={
                              marked
                                ? 'rounded bg-amber-100 px-1 font-semibold text-amber-900 ring-1 ring-amber-300'
                                : 'rounded bg-slate-100 px-1 text-slate-600'
                            }
                          >
                            {areaIndex(id)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <details className="mt-0.5">
                    <summary className="cursor-pointer">
                      <Cite refData={link.ref} />
                    </summary>
                    {link.ref.quote && (
                      <blockquote className="mt-0.5 border-l-2 border-slate-200 pl-1.5 italic text-slate-500">
                        {link.ref.quote}
                      </blockquote>
                    )}
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Masterson techniques */}
      <section data-testid="zone-ref-techniques">
        <h4 className="font-semibold text-[#2B4C3F]">
          {ru ? 'Техники Мастерсона' : 'Masterson techniques'}
        </h4>
        {!tech ? (
          <p className="text-slate-500">{notInSource}</p>
        ) : (
          <div className="mt-0.5 space-y-0.5">
            <p className="font-medium">{tech.techniques.join(' · ')}</p>
            <p>
              <span className="text-slate-500">{ru ? 'Давление: ' : 'Pressure: '}</span>
              {pressure ?? (ru ? tech.handlingRu : tech.handlingEn)}
            </p>
            <p>
              <span className="text-slate-500">{ru ? 'Порядок: ' : 'Order: '}</span>
              {ru ? tech.orderRu : tech.orderEn}
            </p>
            <details>
              <summary className="cursor-pointer">
                <Cite refData={tech.ref} />
              </summary>
              {tech.ref.quote && (
                <blockquote className="mt-0.5 border-l-2 border-slate-200 pl-1.5 italic text-slate-500">
                  {tech.ref.quote}
                </blockquote>
              )}
            </details>
          </div>
        )}
      </section>

      {/* Session order */}
      {phase && (
        <section data-testid="zone-ref-phase">
          <h4 className="font-semibold text-[#2B4C3F]">
            {ru ? 'Этап сессии' : 'Session stage'} {phase.order}/{SESSION_PHASES.length}:{' '}
            {ru ? phase.nameRu : phase.nameEn}
          </h4>
          <p>{ru ? phase.startRu : phase.startEn}</p>
          <Cite refData={SESSION_ORDER_REF} />
        </section>
      )}

      <p className="text-[10px] leading-snug text-slate-400">
        {ru
          ? 'Справка по анатомическим и методическим источникам. Пальпация не отличает первичную хромоту от компенсаторной — это задача ветеринарного осмотра.'
          : 'Reference from anatomical and method sources. Palpation cannot tell primary from compensatory lameness — that needs a veterinary exam.'}
      </p>
    </div>
  );
};
