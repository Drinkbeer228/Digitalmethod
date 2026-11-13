/**
 * Pure matcher: marked zones of a session → biomechanical patterns (read-only practitioner aid).
 * Strict rules keep the hint meaningful instead of firing on every session:
 *  - a zone counts when it has a reaction or a restriction;
 *  - poll zones need reaction ≥ 2 or a restriction (the poll is reactive in most horses);
 *  - every trigger group of a pattern must be satisfied;
 *  - patterns needing zones absent from the 19-zone map never fire;
 *  - at most MAX_PATTERN_MATCHES are returned, strongest first.
 */
import {
  AnatomicalAreaId,
  AreaSideObservation,
  BodyworkSession,
  DiagramAnnotation,
  Language,
  Side,
} from '../types';
import { ANATOMICAL_AREAS } from '../data/anatomicalAreas';
import {
  BIOMECHANICAL_PATTERNS,
  BiomechanicalPattern,
  PatternTriggerGroup,
  POLL_AREA_IDS,
} from '../data/biomechanicalPatterns';

export const MAX_PATTERN_MATCHES = 3;

export type PatternMatchSides =
  | 'left'
  | 'right'
  | 'both'
  | 'left_to_right'
  | 'right_to_left'
  | 'bilateral';

export interface MatchedZone {
  areaId: AnatomicalAreaId;
  side: Side;
}

export interface PatternMatch {
  pattern: BiomechanicalPattern;
  sides: PatternMatchSides;
  matchedZones: MatchedZone[];
  score: number;
  diagonalConfirmed: boolean;
}

type SessionLike = Pick<BodyworkSession, 'evaluationTable' | 'annotations'>;

const SIDES: Side[] = ['left', 'right'];
const opposite = (s: Side): Side => (s === 'left' ? 'right' : 'left');

export function isAreaActive(
  obs: AreaSideObservation | undefined,
  areaId: AnatomicalAreaId
): boolean {
  if (!obs) return false;
  if (obs.restriction) return true;
  const reaction = obs.reaction ?? 0;
  return POLL_AREA_IDS.includes(areaId) ? reaction >= 2 : reaction >= 1;
}

function activeAreasOfGroup(
  session: SessionLike,
  group: PatternTriggerGroup,
  side: Side
): AnatomicalAreaId[] {
  return group.areas.filter((id) => isAreaActive(session.evaluationTable[id]?.[side], id));
}

function zoneWeight(session: SessionLike, z: MatchedZone): number {
  const obs = session.evaluationTable[z.areaId]?.[z.side];
  if (!obs) return 0;
  return (obs.reaction ?? 0) + (obs.restriction ? 1 : 0);
}

function scoreOf(session: SessionLike, zones: MatchedZone[]): number {
  return zones.reduce((sum, z) => sum + zoneWeight(session, z), 0);
}

/** Top-view predominant diagonal running from the A-side atlas to the B-side hindquarter. */
export function hasPredominantDiagonal(
  annotations: DiagramAnnotation[],
  sideA: Side,
  sideB: Side
): boolean {
  return annotations.some(
    (a) =>
      a.kind === 'diagonal' &&
      a.fromAnchor === `${sideA}_atlas` &&
      (a.toAnchor === `${sideB}_gluteal` || a.toAnchor === `${sideB}_sacrum`)
  );
}

function matchIpsilateral(session: SessionLike, pattern: BiomechanicalPattern): PatternMatch | null {
  const perSide: { side: Side; zones: MatchedZone[] }[] = [];
  for (const side of SIDES) {
    const zones: MatchedZone[] = [];
    let ok = true;
    for (const group of pattern.triggers) {
      const active = activeAreasOfGroup(session, group, side);
      if (active.length === 0) {
        ok = false;
        break;
      }
      zones.push(...active.map((areaId) => ({ areaId, side })));
    }
    if (ok) perSide.push({ side, zones });
  }
  if (perSide.length === 0) return null;
  const zones = perSide.flatMap((p) => p.zones);
  return {
    pattern,
    sides: perSide.length === 2 ? 'both' : perSide[0].side,
    matchedZones: zones,
    score: scoreOf(session, zones),
    diagonalConfirmed: false,
  };
}

function matchContralateral(
  session: SessionLike,
  pattern: BiomechanicalPattern
): PatternMatch | null {
  let best: PatternMatch | null = null;
  for (const sideA of SIDES) {
    const sideB = opposite(sideA);
    const zones: MatchedZone[] = [];
    let ok = true;
    for (const group of pattern.triggers) {
      const cross = group.crossSide ?? 'any';
      const candidateSides: Side[] = cross === 'A' ? [sideA] : cross === 'B' ? [sideB] : SIDES;
      const found = candidateSides.flatMap((side) =>
        activeAreasOfGroup(session, group, side).map((areaId) => ({ areaId, side }))
      );
      if (found.length === 0) {
        ok = false;
        break;
      }
      zones.push(...found);
    }
    if (!ok) continue;
    const diagonalConfirmed =
      Boolean(pattern.usesPredominantDiagonal) &&
      hasPredominantDiagonal(session.annotations, sideA, sideB);
    const match: PatternMatch = {
      pattern,
      sides: sideA === 'left' ? 'left_to_right' : 'right_to_left',
      matchedZones: zones,
      score: scoreOf(session, zones) + (diagonalConfirmed ? 1 : 0),
      diagonalConfirmed,
    };
    if (
      !best ||
      match.score > best.score ||
      (match.score === best.score && match.diagonalConfirmed && !best.diagonalConfirmed)
    ) {
      best = match;
    }
  }
  return best;
}

function matchBilateral(session: SessionLike, pattern: BiomechanicalPattern): PatternMatch | null {
  const zones: MatchedZone[] = [];
  for (const group of pattern.triggers) {
    const left = activeAreasOfGroup(session, group, 'left');
    const right = activeAreasOfGroup(session, group, 'right');
    const satisfied = group.axial
      ? left.length > 0 || right.length > 0
      : left.length > 0 && right.length > 0;
    if (!satisfied) return null;
    zones.push(
      ...left.map((areaId) => ({ areaId, side: 'left' as const })),
      ...right.map((areaId) => ({ areaId, side: 'right' as const }))
    );
  }
  return {
    pattern,
    sides: 'bilateral',
    matchedZones: zones,
    score: scoreOf(session, zones),
    diagonalConfirmed: false,
  };
}

export function matchPattern(
  session: SessionLike,
  pattern: BiomechanicalPattern
): PatternMatch | null {
  if (!pattern.detectable || pattern.triggers.some((t) => t.areas.length === 0)) return null;
  switch (pattern.laterality) {
    case 'ipsilateral':
      return matchIpsilateral(session, pattern);
    case 'contralateral':
      return matchContralateral(session, pattern);
    case 'bilateral':
      return matchBilateral(session, pattern);
    default:
      return null;
  }
}

/** Strongest matching patterns for a session (max MAX_PATTERN_MATCHES), highest score first. */
export function detectActivePatterns(
  session: SessionLike,
  patterns: BiomechanicalPattern[] = BIOMECHANICAL_PATTERNS,
  limit: number = MAX_PATTERN_MATCHES
): PatternMatch[] {
  return patterns
    .map((p) => matchPattern(session, p))
    .filter((m): m is PatternMatch => m !== null)
    .sort((a, b) => b.score - a.score || a.pattern.id - b.pattern.id)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

export function formatMatchSides(sides: PatternMatchSides, lang: Language): string {
  const ru = lang === 'ru';
  switch (sides) {
    case 'left':
      return ru ? 'Л' : 'L';
    case 'right':
      return ru ? 'П' : 'R';
    case 'both':
      return ru ? 'Л и П' : 'L & R';
    case 'left_to_right':
      return ru ? 'Диагональ Л→П' : 'Diagonal L→R';
    case 'right_to_left':
      return ru ? 'Диагональ П→Л' : 'Diagonal R→L';
    case 'bilateral':
    default:
      return ru ? 'Двусторонне' : 'Bilateral';
  }
}

export function formatMatchedZones(zones: MatchedZone[], lang: Language): string {
  const ru = lang === 'ru';
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const z of zones) {
    const key = `${z.areaId}:${z.side}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const area = ANATOMICAL_AREAS.find((a) => a.id === z.areaId);
    if (!area) continue;
    const sideLetter = z.side === 'left' ? (ru ? 'Л' : 'L') : ru ? 'П' : 'R';
    parts.push(`#${area.index} ${ru ? area.nameRu : area.nameEn} (${sideLetter})`);
  }
  return parts.join(', ');
}

export function patternNoteTag(patternId: number, lang: Language): string {
  return lang === 'ru' ? `[Паттерн №${patternId}]` : `[Pattern #${patternId}]`;
}

/** True when the session notes already contain this pattern (in either language). */
export function isPatternInNotes(notes: string, patternId: number): boolean {
  return notes.includes(patternNoteTag(patternId, 'ru')) || notes.includes(patternNoteTag(patternId, 'en'));
}

export function buildPatternNoteLine(match: PatternMatch, lang: Language): string {
  const ru = lang === 'ru';
  const title = ru ? match.pattern.titleRu : match.pattern.titleEn;
  return `💡 ${patternNoteTag(match.pattern.id, lang)} ${title} (${formatMatchSides(
    match.sides,
    lang
  )}) — ${ru ? 'зоны' : 'zones'}: ${formatMatchedZones(match.matchedZones, lang)}`;
}

/** Appends the pattern line once; returns the notes unchanged when already present. */
export function appendPatternToNotes(notes: string, match: PatternMatch, lang: Language): string {
  if (isPatternInNotes(notes, match.pattern.id)) return notes;
  const line = buildPatternNoteLine(match, lang);
  return notes.trim() ? `${notes.replace(/\s+$/, '')}\n${line}` : line;
}

const PATTERN_TAG_PREFIXES = [patternNoteTag(0, 'ru'), patternNoteTag(0, 'en')].map((tag) =>
  tag.slice(0, tag.indexOf('0'))
);

/** True for a notes line produced by appendPatternToNotes (optional leading emoji/space). */
export function isPatternNoteLine(line: string): boolean {
  const text = line.replace(/^[\s\p{Extended_Pictographic}️‍]+/u, '');
  return PATTERN_TAG_PREFIXES.some((prefix) => text.startsWith(prefix));
}

/**
 * Removes the technical "[Паттерн №N] …" / "[Pattern #N] …" lines from notes (for the
 * owner PDF) and collapses the blank runs they leave. Other lines are untouched.
 */
export function stripPatternNoteLines(notes: string): string {
  if (!notes) return notes;
  return notes
    .split(/\r?\n/)
    .filter((line) => !isPatternNoteLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
