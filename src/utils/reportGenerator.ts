import { ANATOMICAL_AREAS, TOP_VIEW_ANCHORS } from '../data/anatomicalAreas';
import { BodyworkSession, Language, ReportSections } from '../types';

/**
 * Generates a structured 6-section session report from the practitioner's confirmed
 * 19-area evaluation table, diagram annotations, and session notes in English or Russian.
 */
export function buildReportFromSession(
  session: BodyworkSession,
  lang: Language
): ReportSections {
  const reactionsList: string[] = [];
  const restrictionsList: string[] = [];
  const releaseSignsSet = new Set<string>();
  const releasedAreasList: string[] = [];

  for (const area of ANATOMICAL_AREAS) {
    const row = session.evaluationTable[area.id];
    if (!row) continue;

    const areaLabel =
      lang === 'ru' ? `${area.nameRu} (${area.nameEn})` : area.nameEn;

    for (const side of ['left', 'right'] as const) {
      const cell = row[side];
      const sideLabel =
        lang === 'ru'
          ? side === 'left'
            ? 'Слева (Left)'
            : 'Справа (Right)'
          : side === 'left'
            ? 'Left'
            : 'Right';

      if (cell.reaction) {
        reactionsList.push(
          lang === 'ru'
            ? `• ${sideLabel} — ${areaLabel}: Реакция уровня ${cell.reaction}${cell.note ? ` (${cell.note})` : ''}`
            : `• ${sideLabel} ${areaLabel}: Reaction Level ${cell.reaction}${cell.note ? ` (${cell.note})` : ''}`
        );
      }

      if (cell.restriction) {
        restrictionsList.push(
          lang === 'ru'
            ? `• ${sideLabel} — ${areaLabel}: Отмечена рестрикция / закрепощение${cell.note ? ` (${cell.note})` : ''}`
            : `• ${sideLabel} ${areaLabel}: Restriction identified${cell.note ? ` (${cell.note})` : ''}`
        );
      }

      if (cell.released) {
        releasedAreasList.push(`${sideLabel} ${areaLabel}`);
      }

      if (cell.releaseSigns && cell.releaseSigns.length > 0) {
        for (const sign of cell.releaseSigns) {
          releaseSignsSet.add(sign);
        }
      }
    }
  }

  const diagonalAnns = session.annotations.filter((a) => a.kind === 'diagonal');
  let diagonalSummary = '';
  if (diagonalAnns.length > 0) {
    diagonalSummary = diagonalAnns
      .map((d) => {
        if (d.fromAnchor && d.toAnchor && d.fromAnchor !== 'custom' && d.toAnchor !== 'custom') {
          const fromMeta = TOP_VIEW_ANCHORS[d.fromAnchor];
          const toMeta = TOP_VIEW_ANCHORS[d.toAnchor];
          return lang === 'ru'
            ? `Зафиксирована преобладающая диагональ: ${fromMeta.labelRu} → ${toMeta.labelRu}.`
            : `Recorded Predominant Diagonal: ${fromMeta.labelEn} → ${toMeta.labelEn}.`;
        }
        return (
          d.label ||
          (lang === 'ru'
            ? 'Преобладающая диагональ отмечена на схеме вида сверху.'
            : 'Predominant Diagonal marked on the Top View diagram.')
        );
      })
      .join('\n');
  } else {
    diagonalSummary =
      lang === 'ru'
        ? 'Преобладающая диагональ еще не отмечена практиком на схеме вида сверху.'
        : 'No Predominant Diagonal explicitly marked on the Top View diagram yet.';
  }

  const initialEvaluation =
    reactionsList.length > 0
      ? reactionsList.join('\n')
      : lang === 'ru'
        ? 'При первичной пальпации выраженных реакций (уровни 1–3) в таблице не отмечено.'
        : 'No palpation reactions (Levels 1–3) currently marked in the 19-area evaluation table.';

  const restrictionsIdentified =
    restrictionsList.length > 0
      ? restrictionsList.join('\n')
      : lang === 'ru'
        ? 'Зоны рестрикций (более старых закрепощений) в таблице не отмечены.'
        : 'No areas of restriction (older issues) currently marked in the 19-area evaluation table.';

  const signsArr = Array.from(releaseSignsSet);
  const releaseSignsObserved =
    signsArr.length > 0 || releasedAreasList.length > 0
      ? lang === 'ru'
        ? `Признаки релиза: ${signsArr.length > 0 ? signsArr.join(', ') : 'отмечено расслабление'}.\nЗоны с подтвержденным релизом (${releasedAreasList.length}): ${releasedAreasList.join('; ')}.`
        : `Observed release indicators: ${signsArr.length > 0 ? signsArr.join(', ') : 'softening noted'}.\nAreas with confirmed release (${releasedAreasList.length}): ${releasedAreasList.join('; ')}.`
      : lang === 'ru'
        ? 'Признаки релиза еще не зафиксированы.'
        : 'No release signs recorded yet.';

  const sessionNotes =
    session.generalNotes?.trim() ||
    session.manualVoiceNotes?.trim() ||
    (lang === 'ru'
      ? 'Введите заметки по примененным техникам Masterson Method.'
      : 'Enter practitioner notes on Masterson Method techniques applied during this session.');

  const postSessionCareNotes =
    session.reportSections?.postSessionCareNotes?.trim() ||
    (lang === 'ru'
      ? 'Рекомендуется 24–48 часов свободного движения или легкой работы на корде/шагу. При любых физических жалобах проконсультируйтесь с ветеринарным врачом.'
      : 'Allow 24–48 hours of light movement or turnout following bodywork. Consult a veterinarian if there are any physical concerns with the horse.');

  return {
    initialEvaluation,
    restrictionsIdentified,
    releaseSignsObserved,
    predominantDiagonal: diagonalSummary,
    sessionNotes,
    postSessionCareNotes,
  };
}
