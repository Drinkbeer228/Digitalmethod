import { ANATOMICAL_AREAS } from '../data/anatomicalAreas';
import {
  AnatomicalAreaId,
  DiagonalAnchor,
  ProposedCaseSuggestion,
  ReactionLevel,
  Side,
} from '../types';

const RELEASE_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'Deep yawning', regex: /(?:^|[^a-zа-яё0-9])(yawn(?:ing|ed|s)?|зева(?:ние|ет|л|ть)|зевок)(?=[^a-zа-яё0-9]|$)/i },
  {
    label: 'Head lowering',
    regex: /(?:^|[^a-zа-яё0-9])(head\s+lower(?:ing|ed|s)?|lower(?:ed|ing)\s+head|опуска(?:ние|ет|л)\s+голов[уы]|опустил\s+голову)(?=[^a-zа-яё0-9]|$)/i,
  },
  {
    label: 'Licking & chewing',
    regex: /(?:^|[^a-zа-яё0-9])(lick(?:ing|ed)?|chew(?:ing|ed)?|облизыва(?:ние|ет|лся)|отжевыва(?:ние|ет|л)|жева(?:ние|л))(?=[^a-zа-яё0-9]|$)/i,
  },
  { label: 'Soft blinking', regex: /(?:^|[^a-zа-яё0-9])(blink(?:ing|ed|s)?|eye\s+soft(?:ening)?|морга(?:ние|ет|л)|мягкий\s+взгляд)(?=[^a-zа-яё0-9]|$)/i },
  { label: 'Deep sigh / exhalation', regex: /(?:^|[^a-zа-яё0-9])(sigh(?:ing|ed|s)?|exhal(?:e|ing|ation)|выдох(?:нул)?|вздох(?:нул)?)(?=[^a-zа-яё0-9]|$)/i },
  { label: 'Whole-body shake', regex: /(?:^|[^a-zа-яё0-9])(shak(?:e|ing)\s+off|body\s+shake|отрях(?:ивание|нулся))(?=[^a-zа-яё0-9]|$)/i },
];

function detectSides(clause: string): Array<Side | 'both'> {
  const lower = clause.toLowerCase();
  const hasBoth =
    /(?:^|[^a-zа-яё0-9])(both|bilateral(?:ly)?|left\s+and\s+right|right\s+and\s+left|обе(?:их)?|оба|двусторонн(?:ий|яя|ие)|слева\s+и\s+справа|с\s+обеих\s+сторон)(?=[^a-zа-яё0-9]|$)/i.test(
      lower
    );
  if (hasBoth) return ['both'];

  const hasLeft = /(?:^|[^a-zа-яё0-9])(left|l\.?\s+side|лев(?:ый|ая|ое|ые|ой|ом|ую)|слева)(?=[^a-zа-яё0-9]|$)/i.test(lower);
  const hasRight = /(?:^|[^a-zа-яё0-9])(right|r\.?\s+side|прав(?:ый|ая|ое|ые|ой|ом|ую)|справа)(?=[^a-zа-яё0-9]|$)/i.test(lower);

  if (hasLeft && hasRight) return ['both'];
  if (hasLeft) return ['left'];
  if (hasRight) return ['right'];
  return [];
}

function detectReactionLevel(clause: string): ReactionLevel | undefined {
  const lower = clause.toLowerCase();
  const m1 = lower.match(
    /(?:level|reaction|reactivity|grade|уровень|реакци[яи])\s*(?:level|уровень)?\s*[:#-]?\s*([123])(?=[^0-9]|$)/i
  );
  if (m1) return Number(m1[1]) as ReactionLevel;

  const m2 = lower.match(/(?:^|[^0-9])([123])\s*(?:st|nd|rd|й|го)?\s*(?:level|degree|уровн[яю]|уровень)\s*(?:reaction|реакци[ия])?/i);
  if (m2) return Number(m2[1]) as ReactionLevel;

  const m3 = lower.match(/(?:^|[^a-zа-яё0-9])(?:l|р)([123])\s*(?:reaction|reactivity|реакция)(?=[^a-zа-яё0-9]|$)/i);
  if (m3) return Number(m3[1]) as ReactionLevel;

  return undefined;
}

function detectRestriction(clause: string): boolean {
  return /(?:^|[^a-zа-яё0-9])(restriction|restricted|tightness|stiffness|older\s+issue|circle|oval|рестрикци[яию]|закрепощени[ея]|зажим|скованност[ьи])(?=[^a-zа-яё0-9]|$)/i.test(
    clause
  );
}

function detectRelease(clause: string): { released: boolean; signs: string[] } {
  const signs: string[] = [];
  for (const pat of RELEASE_PATTERNS) {
    if (pat.regex.test(clause)) {
      signs.push(pat.label);
    }
  }
  const explicitReleaseWord = /(?:^|[^a-zа-яё0-9])(releas(?:e|ed|ing)|soften(?:ed|ing)|релиз|расслаблени[ея]|отпустил[ао]?)(?=[^a-zа-яё0-9]|$)/i.test(
    clause
  );
  return {
    released: signs.length > 0 || explicitReleaseWord,
    signs,
  };
}

function detectExplicitDiagonal(
  sentence: string
): { from: DiagonalAnchor; to: DiagonalAnchor } | undefined {
  const lower = sentence.toLowerCase();
  if (!/(?:^|[^a-zа-яё0-9])(diagonal|диагонал[ьи])(?=[^a-zа-яё0-9]|$)/i.test(lower)) {
    return undefined;
  }

  let from: DiagonalAnchor | undefined;
  if (/(left\s+atlas|left\s+poll|лев(?:ый|ого|ому)\s+атлант|слева\s+атлант)/i.test(lower)) {
    from = 'left_atlas';
  } else if (/(right\s+atlas|right\s+poll|прав(?:ый|ого|ому)\s+атлант|справа\s+атлант)/i.test(lower)) {
    from = 'right_atlas';
  }

  let to: DiagonalAnchor | undefined;
  if (/(right\s+gluteal(?:s)?|right\s+hind|прав(?:ая|ой|ую)\s+ягодичн|правый\s+круп)/i.test(lower)) {
    to = 'right_gluteal';
  } else if (/(left\s+gluteal(?:s)?|left\s+hind|лев(?:ая|ой|ую)\s+ягодичн|левый\s+круп)/i.test(lower)) {
    to = 'left_gluteal';
  } else if (/(right\s+sacrum|прав(?:ый|ого|ому)\s+крест(?:ец|ца|цу))/i.test(lower)) {
    to = 'right_sacrum';
  } else if (/(left\s+sacrum|лев(?:ый|ого|ому)\s+крест(?:ец|ца|цу))/i.test(lower)) {
    to = 'left_sacrum';
  }

  if (from && to) {
    return { from, to };
  }
  return undefined;
}

function findMentionedAreas(clause: string): AnatomicalAreaId[] {
  const lower = clause.toLowerCase();
  const matched: Array<{ id: AnatomicalAreaId; specificity: number }> = [];

  for (const area of ANATOMICAL_AREAS) {
    const allSynonyms = [...area.synonymsEn, ...area.synonymsRu];
    let bestLen = 0;
    for (const syn of allSynonyms) {
      const s = syn.toLowerCase();
      const idx = lower.indexOf(s);
      if (idx !== -1) {
        // Check word boundary for short tokens like tmj, rib, neck
        const before = idx === 0 ? ' ' : lower[idx - 1];
        const after = idx + s.length >= lower.length ? ' ' : lower[idx + s.length];
        const validBoundary = /[^a-zа-яё0-9]/i.test(before) && /[^a-zа-яё0-9]/i.test(after);
        if (validBoundary && s.length > bestLen) {
          bestLen = s.length;
        }
      }
    }
    if (bestLen > 0) {
      matched.push({ id: area.id, specificity: bestLen });
    }
  }

  // If both poll_front_atlas / poll_top_atlas and generic 'poll' matched, keep only the specific one
  if (
    matched.some((m) => m.id === 'poll_front_atlas') &&
    matched.some((m) => m.id === 'poll_top_atlas')
  ) {
    const hasFront = /front\s+of\s+atlas|перед\s+атлантом/i.test(lower);
    const hasTop = /top\s+of\s+atlas|поверх\s+атланта/i.test(lower);
    if (hasFront && !hasTop) {
      return matched.filter((m) => m.id !== 'poll_top_atlas').map((m) => m.id);
    }
    if (hasTop && !hasFront) {
      return matched.filter((m) => m.id !== 'poll_front_atlas').map((m) => m.id);
    }
  }

  return matched.map((m) => m.id);
}

/**
 * Transparent, deterministic local note parser for English & Russian practitioner notes.
 * Never invents findings or diagnoses. Only proposes explicit observations and preserves unclassified statements.
 */
export function parsePractitionerNotes(
  text: string,
  sourceClipId?: string
): ProposedCaseSuggestion[] {
  if (!text || !text.trim()) return [];

  const suggestions: ProposedCaseSuggestion[] = [];
  let counter = 1;
  const nextId = () => `sug-${Date.now()}-${counter++}`;

  // Split by sentence boundaries or semicolons/newlines
  const rawSentences = text
    .split(/(?:[.!?\n;]+|\s+—\s+)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const sentence of rawSentences) {
    // 1. Check for explicit Predominant Diagonal statement
    const diag = detectExplicitDiagonal(sentence);
    if (diag) {
      suggestions.push({
        id: nextId(),
        sourceClipId,
        sourceSentence: sentence,
        type: 'diagonal',
        diagonalFrom: diag.from,
        diagonalTo: diag.to,
        noteToAppend: sentence,
        status: 'pending',
      });
      continue;
    }

    // Split compound sentences by ", and " or ", plus " when they contain separate side+area clauses
    const clauses = sentence
      .split(/,\s*(?:and|plus|а\s+также|и)\s+/i)
      .map((c) => c.trim())
      .filter(Boolean);

    let sentenceClassified = false;
    const sentenceLevelReaction = detectReactionLevel(sentence);
    const sentenceLevelRestriction = detectRestriction(sentence);
    const sentenceRelease = detectRelease(sentence);

    for (const clause of clauses) {
      // Check if clause has "Left X and Right X" pattern (e.g., "Left Neck C3-C5 and Right Neck C3-C5")
      const subParts = clause
        .split(/\s+(?:and|и)\s+(?=(?:left|right|both|лев|прав|слева|справа))/i)
        .map((p) => p.trim())
        .filter(Boolean);

      for (const part of subParts) {
        const areas = findMentionedAreas(part.length > 8 ? part : clause);
        const sides = detectSides(part);
        const reaction = detectReactionLevel(part) ?? sentenceLevelReaction;
        const restriction = detectRestriction(part) || sentenceLevelRestriction;
        const release = detectRelease(part);
        const hasObservation =
          reaction !== undefined ||
          restriction ||
          release.released ||
          sentenceRelease.released;

        if (areas.length > 0 && sides.length > 0 && hasObservation) {
          for (const areaId of areas) {
            for (const side of sides) {
              suggestions.push({
                id: nextId(),
                sourceClipId,
                sourceSentence: part,
                type: 'area_observation',
                areaId,
                side,
                reactionLevel: reaction,
                restriction: restriction ? true : undefined,
                released: release.released || sentenceRelease.released ? true : undefined,
                releaseSigns:
                  release.signs.length > 0
                    ? release.signs
                    : sentenceRelease.signs.length > 0
                      ? sentenceRelease.signs
                      : undefined,
                noteToAppend: part,
                status: 'pending',
              });
              sentenceClassified = true;
            }
          }
        } else if (areas.length > 0 && hasObservation && sides.length === 0) {
          // Poll / Top of Spine / Sacrum may be mentioned without explicit left/right -> propose 'both' so user can confirm/edit
          for (const areaId of areas) {
            suggestions.push({
              id: nextId(),
              sourceClipId,
              sourceSentence: part,
              type: 'area_observation',
              areaId,
              side: 'both',
              reactionLevel: reaction,
              restriction: restriction ? true : undefined,
              released: release.released || sentenceRelease.released ? true : undefined,
              releaseSigns:
                release.signs.length > 0 ? release.signs : sentenceRelease.signs,
              noteToAppend: part,
              status: 'pending',
            });
            sentenceClassified = true;
          }
        }
      }
    }

    if (!sentenceClassified) {
      // Check if it's a general release observation (e.g. "Observed deep yawning and head lowering")
      if (sentenceRelease.signs.length > 0) {
        suggestions.push({
          id: nextId(),
          sourceClipId,
          sourceSentence: sentence,
          type: 'release_general',
          released: true,
          releaseSigns: sentenceRelease.signs,
          noteToAppend: sentence,
          status: 'pending',
        });
      } else {
        // Preserve statements that cannot be confidently classified
        suggestions.push({
          id: nextId(),
          sourceClipId,
          sourceSentence: sentence,
          type: 'unclassified',
          noteToAppend: sentence,
          status: 'pending',
        });
      }
    }
  }

  return suggestions;
}
