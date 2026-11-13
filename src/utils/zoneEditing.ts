import { BodyPartFilterId } from '../data/anatomicalAreas';
import {
  isReleaseSignSelected,
  TaxonomyChipItem,
  toggleReleaseSignInList,
} from '../data/translations';
import {
  AnatomicalAreaId,
  AnatomicalRegionId,
  AreaSideObservation,
  EvaluationTableState,
} from '../types';

/**
 * Toggle a response/release sign chip on one zone side.
 * Response signs (Blink, Lip twitch, Fidgeting) are recorded as observed but do not
 * mark the zone Released; every other sign does. Removing a chip never clears Released,
 * because the practitioner may have set it by hand.
 */
export function toggleSignChip(
  obs: AreaSideObservation,
  chip: TaxonomyChipItem
): AreaSideObservation {
  const wasActive = isReleaseSignSelected(obs.releaseSigns, chip.en);
  const releaseSigns = toggleReleaseSignInList(obs.releaseSigns, chip.en);
  const next: AreaSideObservation = { ...obs, releaseSigns };

  if (chip.supportsCounter) {
    next.yawnCount = wasActive ? undefined : 1;
  }
  if (!wasActive && chip.group !== 'response') {
    next.released = true;
  }
  return next;
}

/** Previous (-1) or next (+1) zone in display order; null at either end or if not listed. */
export function getAdjacentAreaId(
  orderedIds: AnatomicalAreaId[],
  currentId: AnatomicalAreaId,
  direction: 1 | -1
): AnatomicalAreaId | null {
  const idx = orderedIds.indexOf(currentId);
  if (idx === -1) return null;
  return orderedIds[idx + direction] ?? null;
}

/** Which body-part filter a tap on a diagram region polygon selects. */
export function bodyPartForRegionPolygon(
  regionId: AnatomicalRegionId,
  polygonIndex: number
): Exclude<BodyPartFilterId, 'all'> {
  switch (regionId) {
    case 'head_poll':
      return 'head';
    case 'neck_shoulder':
    case 'back_torso':
      return 'torso';
    case 'pelvis_hindquarters':
      return 'hind';
    case 'limbs_joints':
      return polygonIndex === 0 ? 'front' : 'hind';
  }
}

export function hasAnyObservation(obs: AreaSideObservation | undefined): boolean {
  if (!obs) return false;
  return (
    Boolean(obs.reaction) ||
    obs.restriction ||
    obs.released ||
    Boolean(obs.releaseSigns?.length) ||
    Boolean(obs.resistanceSigns?.length) ||
    Boolean(obs.techniques?.length) ||
    Boolean(obs.note?.trim())
  );
}

/** Number of zone sides (left and right counted separately) carrying any observation. */
export function countMarkedZoneSides(table: EvaluationTableState): number {
  let count = 0;
  for (const row of Object.values(table)) {
    if (hasAnyObservation(row?.left)) count += 1;
    if (hasAnyObservation(row?.right)) count += 1;
  }
  return count;
}
