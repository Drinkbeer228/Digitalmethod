import React, { useState } from 'react';
import {
  AnatomicalAreaId,
  AnatomicalRegionId,
  AnnotationColor,
  DiagramAnnotation,
  DiagonalAnchor,
  EvaluationTableState,
  Language,
  Point,
  ReactionLevel,
  Side,
} from '../types';
import {
  ANATOMICAL_AREAS,
  ANATOMICAL_REGIONS,
  BODY_PART_FILTERS,
  BODY_SEGMENTS,
  BodyPartFilterId,
  BodySegmentId,
  getAreaCoordinate,
  getAreaReactionEndpoints,
  getBodySegmentForArea,
  matchesBodyPartFilter,
  TOP_VIEW_ANCHORS,
} from '../data/anatomicalAreas';

export type DrawingTool =
  | 'select'
  | 'reaction1'
  | 'reaction2'
  | 'reaction3'
  | 'restriction'
  | 'diagonal'
  | 'eraser';

interface HorseSilhouetteSvgProps {
  view: 'left' | 'right' | 'top';
  evaluationTable?: EvaluationTableState;
  annotations: DiagramAnnotation[];
  activeTool?: DrawingTool;
  activeColor?: AnnotationColor;
  selectedAnnotationId?: string | null;
  selectedAreaTarget?: { areaId: AnatomicalAreaId; side: Side } | null;
  hoveredAreaTarget?: { areaId: AnatomicalAreaId; side?: Side } | null;
  activeRegionFilter?: AnatomicalRegionId | 'all';
  bodyPartFilter?: BodyPartFilterId;
  onChangeBodyPartFilter?: (filter: BodyPartFilterId) => void;
  activeBodySegment?: BodySegmentId;
  onSelectBodySegment?: (segment: BodySegmentId) => void;
  showPastelZones?: boolean;
  showLandmarkNumbers?: boolean;
  hideZoomBar?: boolean;
  svgClassName?: string;
  onSelectAnnotation?: (id: string | null) => void;
  onChangeAnnotations?: (
    next: DiagramAnnotation[],
    syncedChange?: {
      view: 'left' | 'right';
      areaId: AnatomicalAreaId;
      reaction?: ReactionLevel | null;
      restriction?: boolean;
    }
  ) => void;
  onAreaLandmarkClick?: (areaId: AnatomicalAreaId, side: 'left' | 'right') => void;
  onHoverArea?: (target: { areaId: AnatomicalAreaId; side?: Side } | null) => void;
  onSelectDiagonalAnchors?: (
    fromAnchor: Exclude<DiagonalAnchor, 'custom'>,
    toAnchor: Exclude<DiagonalAnchor, 'custom'>
  ) => void;
  showLandmarkDots?: boolean;
  readOnly?: boolean;
  lang: Language;
}

const SIDE_W = 1000;
const SIDE_H = 860;
const TOP_W = 1000;
const TOP_H = 320;

/**
 * Convert normalized polyline points into an SVG path string.
 * For Level 3 reactions, renders a distinctive high-reactivity sawtooth zigzag wave along the stroke.
 */
function buildReactionSvgPath(
  points: Point[],
  level: ReactionLevel,
  width: number,
  height: number
): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const px = points[0].x * width;
    const py = points[0].y * height;
    return `M ${px - 18} ${py} L ${px + 18} ${py}`;
  }

  if (level !== 3) {
    return points
      .map(
        (pt, i) =>
          `${i === 0 ? 'M' : 'L'} ${(pt.x * width).toFixed(1)} ${(pt.y * height).toFixed(1)}`
      )
      .join(' ');
  }

  // Level 3: Distinctive high-reactivity zigzag path
  const scaled = points.map((p) => ({ x: p.x * width, y: p.y * height }));
  const zigzagPts: Array<{ x: number; y: number }> = [scaled[0]];
  const stepPx = 9.5;
  const ampPx = 9.5;
  let sign = 1;

  for (let i = 0; i < scaled.length - 1; i++) {
    const p0 = scaled[i];
    const p1 = scaled[i + 1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1) continue;
    const nx = -dy / segLen;
    const ny = dx / segLen;
    const steps = Math.max(3, Math.floor(segLen / stepPx));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const bx = p0.x + dx * t;
      const by = p0.y + dy * t;
      if (s === steps && i === scaled.length - 2) {
        zigzagPts.push({ x: bx, y: by });
      } else {
        zigzagPts.push({
          x: bx + nx * ampPx * sign,
          y: by + ny * ampPx * sign,
        });
        sign = -sign;
      }
    }
  }

  return zigzagPts
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');
}

function pointsToSvgPolygon(
  pts: Point[],
  width: number,
  height: number,
  mirrorX = false
): string {
  return pts
    .map((p) => {
      const x = (mirrorX ? 1 - p.x : p.x) * width;
      const y = p.y * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function doesRegionPolygonMatchBodyPart(
  regionId: AnatomicalRegionId,
  polygonIndex: number,
  filterId: BodyPartFilterId
): boolean {
  if (filterId === 'all') return true;
  if (filterId === 'head') {
    return regionId === 'head_poll' || regionId === 'neck_shoulder';
  }
  if (filterId === 'torso') {
    return (
      regionId === 'neck_shoulder' ||
      regionId === 'back_torso' ||
      regionId === 'pelvis_hindquarters'
    );
  }
  if (filterId === 'front') {
    return regionId === 'limbs_joints' && polygonIndex === 0;
  }
  if (filterId === 'hind') {
    return (
      regionId === 'pelvis_hindquarters' ||
      (regionId === 'limbs_joints' && polygonIndex === 1)
    );
  }
  return true;
}

export const HorseSilhouetteSvg: React.FC<HorseSilhouetteSvgProps> = ({
  view,
  evaluationTable,
  annotations,
  selectedAreaTarget = null,
  hoveredAreaTarget = null,
  activeRegionFilter = 'all',
  bodyPartFilter = 'all',
  onChangeBodyPartFilter,
  activeBodySegment,
  onSelectBodySegment,
  showPastelZones = true,
  showLandmarkNumbers = true,
  svgClassName,
  onChangeAnnotations,
  onAreaLandmarkClick,
  onHoverArea,
  onSelectDiagonalAnchors,
  showLandmarkDots = true,
  readOnly = false,
  lang,
}) => {
  const width = view === 'top' ? TOP_W : SIDE_W;
  const height = view === 'top' ? TOP_H : SIDE_H;
  const isMirrored = view === 'right';

  // Top View two-step anchor selection state (Atlas -> Gluteal/Sacrum)
  const [pendingAtlasAnchor, setPendingAtlasAnchor] = useState<
    'left_atlas' | 'right_atlas' | null
  >(null);

  const activeHighlightAreaId =
    (selectedAreaTarget && (view === 'top' || selectedAreaTarget.side === view)
      ? selectedAreaTarget.areaId
      : null) ??
    (hoveredAreaTarget && (!hoveredAreaTarget.side || hoveredAreaTarget.side === view)
      ? hoveredAreaTarget.areaId
      : null);

  const activeHighlightRegionId = activeHighlightAreaId
    ? ANATOMICAL_AREAS.find((a) => a.id === activeHighlightAreaId)?.regionId
    : undefined;

  const topDiagonals = annotations.filter(
    (a): a is Extract<DiagramAnnotation, { kind: 'diagonal' }> =>
      a.view === 'top' && a.kind === 'diagonal'
  );

  const handleTopAnchorTap = (
    anchorKey: Exclude<DiagonalAnchor, 'custom'>,
    role: 'atlas' | 'hind'
  ) => {
    if (readOnly) return;

    if (role === 'atlas') {
      const atlasKey = anchorKey as 'left_atlas' | 'right_atlas';
      setPendingAtlasAnchor((prev) => (prev === atlasKey ? null : atlasKey));
      return;
    }

    // Clicked a hindquarter destination (Gluteal / Sacrum)
    const fromAtlas =
      pendingAtlasAnchor ?? (anchorKey.startsWith('right_') ? 'left_atlas' : 'right_atlas');
    if (onSelectDiagonalAnchors) {
      onSelectDiagonalAnchors(fromAtlas, anchorKey);
    } else if (onChangeAnnotations) {
      const startPt = TOP_VIEW_ANCHORS[fromAtlas].point;
      const endPt = TOP_VIEW_ANCHORS[anchorKey].point;
      const newDiag: DiagramAnnotation = {
        id: `diag-${fromAtlas}-${anchorKey}-${Date.now()}`,
        kind: 'diagonal',
        view: 'top',
        start: { ...startPt },
        end: { ...endPt },
        fromAnchor: fromAtlas,
        toAnchor: anchorKey,
        color: '#1E2421',
        label: `${TOP_VIEW_ANCHORS[fromAtlas].labelEn} → ${TOP_VIEW_ANCHORS[anchorKey].labelEn}`,
      };
      const withoutOld = annotations.filter((a) => a.kind !== 'diagonal');
      onChangeAnnotations([...withoutOld, newDiag]);
    }
    setPendingAtlasAnchor(null);
  };

  const viewBoxStr = `0 0 ${width} ${height}`;

  return (
    <div className="relative w-full h-full flex flex-col select-none">
      {/* Floating Body-Part Filter in Top-Right Corner of Left/Right Diagram */}
      {!readOnly && view !== 'top' && onChangeBodyPartFilter && (
        <div
          data-testid={`body-part-filter-bar-${view}`}
          className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur-sm rounded-lg border border-slate-300/90 p-0.5 shadow-xs flex items-center gap-0.5"
          role="group"
          aria-label={lang === 'ru' ? 'Фильтр частей тела' : 'Body Part Filter'}
        >
          {BODY_PART_FILTERS.map((f) => {
            const isActive = bodyPartFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                data-testid={`body-part-filter-${view}-${f.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeBodyPartFilter(
                    bodyPartFilter === f.id && f.id !== 'all' ? 'all' : f.id
                  );
                }}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#2B4C3F] text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100/80'
                }`}
              >
                {lang === 'ru' ? f.labelRu : f.labelEn}
              </button>
            );
          })}
        </div>
      )}

      <svg
        viewBox={viewBoxStr}
        className={
          svgClassName ??
          'w-full h-auto block rounded-xl border border-slate-300/90 bg-[#FAF9F6] touch-manipulation'
        }
        data-testid={`horse-svg-${view}`}
      >
        <defs>
          {/* Subtle veterinary atlas coordinate grid */}
          <pattern
            id={`atlas-grid-${view}`}
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="#E6E2D8"
              strokeWidth="0.75"
            />
          </pattern>

          {/* Drop shadow for standardized semantic badges */}
          <filter id={`marker-shadow-${view}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.22" />
          </filter>

          {/* Arrowhead marker for Top View Predominant Diagonal */}
          <marker
            id={`diag-arrow-${view}`}
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#1E2421" />
          </marker>
        </defs>

        {/* LAYER 1: Veterinary Atlas Parchment Canvas & Calibration Grid */}
        <rect width={width} height={height} fill="#FAF9F6" />
        <rect width={width} height={height} fill={`url(#atlas-grid-${view})`} opacity={0.65} />

        {/* LAYER 2A: Interactive 3-Segment Body Regions when activeBodySegment is provided on Left/Right */}
        {showPastelZones && view !== 'top' && activeBodySegment ? (
          <g data-testid={`layer-body-segments-${view}`}>
            {BODY_SEGMENTS.map((seg) => {
              const isSegActive = activeBodySegment === seg.id;
              return (
                <g
                  key={seg.id}
                  data-testid={`svg-body-segment-${view}-${seg.id}`}
                  className={readOnly ? '' : 'cursor-pointer'}
                  onClick={(e) => {
                    if (readOnly || !onSelectBodySegment) return;
                    e.stopPropagation();
                    onSelectBodySegment(seg.id);
                  }}
                >
                  {seg.leftPolygons.map((poly, pIdx) => (
                    <polygon
                      key={`${seg.id}-${pIdx}`}
                      points={pointsToSvgPolygon(poly, width, height, isMirrored)}
                      fill={isSegActive ? seg.activeFill : seg.pastelFill}
                      fillOpacity={isSegActive ? 0.72 : 0.35}
                      stroke={isSegActive ? '#2B4C3F' : seg.pastelStroke}
                      strokeWidth={isSegActive ? 2.8 : 1.4}
                      strokeOpacity={isSegActive ? 0.9 : 0.6}
                      strokeDasharray={isSegActive ? undefined : '5 3'}
                      strokeLinejoin="round"
                    />
                  ))}
                </g>
              );
            })}
          </g>
        ) : (
          /* LAYER 2B: Five Brighter, Natural Color-Coded Anatomical Regions */
          showPastelZones && (
            <g data-testid={`layer-pastel-regions-${view}`}>
              {ANATOMICAL_REGIONS.map((region) => {
                const polygons =
                  view === 'top' ? region.topPolygons : region.leftPolygons;
                if (polygons.length === 0) return null;

                return (
                  <g key={region.id} data-region-id={region.id}>
                    {polygons.map((poly, pIdx) => {
                      const matchesBodyPart =
                        view === 'top' ||
                        doesRegionPolygonMatchBodyPart(region.id, pIdx, bodyPartFilter);
                      const isFilterFocused =
                        (bodyPartFilter !== 'all' && matchesBodyPart) ||
                        activeRegionFilter === region.id ||
                        activeHighlightRegionId === region.id;
                      const isDimmed =
                        (bodyPartFilter !== 'all' && !matchesBodyPart) ||
                        (activeRegionFilter !== 'all' && activeRegionFilter !== region.id);

                      const fill = isFilterFocused ? region.activeFill : region.pastelFill;
                      const stroke = isFilterFocused
                        ? region.activeStroke
                        : region.pastelStroke;
                      const fillOpacity = isDimmed ? 0.18 : isFilterFocused ? 0.75 : 0.58;
                      const strokeOpacity = isDimmed ? 0.25 : isFilterFocused ? 0.92 : 0.75;

                      return (
                        <polygon
                          key={`${region.id}-${pIdx}`}
                          points={pointsToSvgPolygon(poly, width, height, isMirrored)}
                          fill={fill}
                          fillOpacity={fillOpacity}
                          stroke={stroke}
                          strokeWidth={isFilterFocused ? 2.2 : 1.5}
                          strokeOpacity={strokeOpacity}
                          strokeLinejoin="round"
                        />
                      );
                    })}
                  </g>
                );
              })}
            </g>
          )
        )}

        {/* LAYER 3: Authoritative Anatomical Horse Line-Art Image (Multiply Blend Over Pastel Zones) */}
        {view === 'left' && (
          <image
            href="/diagrams/horse-left.png"
            x={0}
            y={0}
            width={width}
            height={height}
            preserveAspectRatio="none"
            style={{ mixBlendMode: 'multiply' }}
            className="pointer-events-none"
          />
        )}
        {view === 'right' && (
          <g
            transform={`translate(${width}, 0) scale(-1, 1)`}
            className="pointer-events-none"
          >
            <image
              href="/diagrams/horse-left.png"
              x={0}
              y={0}
              width={width}
              height={height}
              preserveAspectRatio="none"
              style={{ mixBlendMode: 'multiply' }}
            />
          </g>
        )}
        {view === 'top' && (
          <image
            href="/diagrams/horse-top.png"
            x={0}
            y={0}
            width={width}
            height={height}
            preserveAspectRatio="none"
            style={{ mixBlendMode: 'multiply' }}
            className="pointer-events-none"
          />
        )}

        {/* LAYER 4 (Left/Right): Standardized Semantic Vector Markers (Single Source of Truth) */}
        {view !== 'top' && (
          <g data-testid={`layer-vector-markers-${view}`}>
            {ANATOMICAL_AREAS.map((area) => {
              const coord = getAreaCoordinate(area.id, view);
              const cx = coord.x * width;
              const cy = coord.y * height;

              // Read observation from evaluationTable (or fallback to annotations array if table omitted)
              const obs = evaluationTable?.[area.id]?.[view] ?? {
                reaction:
                  annotations.find(
                    (a): a is Extract<DiagramAnnotation, { kind: 'reaction' }> =>
                      a.kind === 'reaction' &&
                      a.view === view &&
                      a.linkedAreaId === area.id
                  )?.level ?? null,
                restriction: annotations.some(
                  (a) =>
                    a.kind === 'restriction' &&
                    a.view === view &&
                    a.linkedAreaId === area.id
                ),
                released: annotations.some(
                  (a) =>
                    a.kind === 'release' &&
                    a.view === view &&
                    a.linkedAreaId === area.id
                ),
                note: '',
              };

              const hasObservation =
                Boolean(obs.reaction) ||
                obs.restriction ||
                obs.released ||
                Boolean(obs.releaseSigns && obs.releaseSigns.length > 0) ||
                Boolean(obs.resistanceSigns && obs.resistanceSigns.length > 0) ||
                Boolean(obs.techniques && obs.techniques.length > 0) ||
                Boolean(obs.note?.trim());

              const isSelected =
                selectedAreaTarget?.areaId === area.id &&
                selectedAreaTarget?.side === view;
              const isHovered =
                hoveredAreaTarget?.areaId === area.id &&
                (!hoveredAreaTarget.side || hoveredAreaTarget.side === view);

              const [rStart, rEnd] = getAreaReactionEndpoints(area.id, view);
              const reactionPath = obs.reaction
                ? buildReactionSvgPath([rStart, rEnd], obs.reaction, width, height)
                : '';

              const rx = area.defaultRadius.rx * width;
              const ry = area.defaultRadius.ry * height;
              const rot =
                view === 'left'
                  ? area.defaultRadius.rotation ?? 0
                  : -(area.defaultRadius.rotation ?? 0);

              // Non-overlapping badge offsets around (cx, cy)
              const dir = view === 'left' ? 1 : -1;
              const reactBadgeX = cx - dir * 24;
              const reactBadgeY = cy - 22;
              const releaseBadgeX = cx + dir * 24;
              const releaseBadgeY = cy - 22;
              const noteBadgeX = cx + dir * 26;
              const noteBadgeY = cy + 20;

              return (
                <g
                  key={`marker-group-${area.id}`}
                  data-testid={
                    hasObservation ? `marker-active-${view}-${area.id}` : undefined
                  }
                  className={readOnly ? '' : 'cursor-pointer'}
                  onClick={(e) => {
                    if (readOnly || !onAreaLandmarkClick) return;
                    e.stopPropagation();
                    onAreaLandmarkClick(area.id, view);
                  }}
                >
                  {/* Active or Hovered Landmark Halo */}
                  {(isSelected || isHovered) && (
                    <>
                      {area.hitPolygon && (
                        <polygon
                          points={pointsToSvgPolygon(
                            area.hitPolygon,
                            width,
                            height,
                            isMirrored
                          )}
                          fill="#2B4C3F"
                          fillOpacity={isSelected ? 0.16 : 0.1}
                          stroke="#2B4C3F"
                          strokeWidth={isSelected ? 2.5 : 1.6}
                          strokeDasharray={isSelected ? undefined : '5 3'}
                        />
                      )}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isSelected ? 26 : 22}
                        fill="#2B4C3F"
                        fillOpacity={0.12}
                        stroke="#2B4C3F"
                        strokeWidth={isSelected ? 2.4 : 1.5}
                        strokeDasharray={isSelected ? undefined : '4 3'}
                      />
                    </>
                  )}

                  {/* 1. Standardized Restriction Marker (Dark Blue #1E3A8A Anatomical Ellipse) */}
                  {obs.restriction && (
                    <g
                      transform={`rotate(${rot} ${cx} ${cy})`}
                      data-testid={`marker-restriction-${view}-${area.id}`}
                    >
                      <ellipse
                        cx={cx}
                        cy={cy}
                        rx={rx}
                        ry={ry}
                        fill="#1E3A8A"
                        fillOpacity={0.13}
                        stroke="#1E3A8A"
                        strokeWidth={3.2}
                      />
                      <ellipse
                        cx={cx}
                        cy={cy}
                        rx={Math.max(4, rx - 5)}
                        ry={Math.max(4, ry - 5)}
                        fill="none"
                        stroke="#1E3A8A"
                        strokeWidth={1}
                        strokeOpacity={0.4}
                        strokeDasharray="4 3"
                      />
                    </g>
                  )}

                  {/* 2. Standardized Reaction Marker (Crimson Red #B91C1C Line / Bar / Zigzag + R1/R2/R3 Badge) */}
                  {obs.reaction && (
                    <g data-testid={`marker-reaction-${view}-${area.id}`}>
                      {/* White halo underneath for high contrast over dark line-art */}
                      <path
                        d={reactionPath}
                        stroke="#FAF9F6"
                        strokeWidth={obs.reaction === 2 ? 11 : 7.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        opacity={0.85}
                      />
                      <path
                        d={reactionPath}
                        stroke="#B91C1C"
                        strokeWidth={
                          obs.reaction === 1 ? 3.4 : obs.reaction === 2 ? 7.2 : 3.8
                        }
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                      {/* Reaction Level Badge (R1 / R2 / R3) */}
                      <g
                        transform={`translate(${reactBadgeX}, ${reactBadgeY})`}
                        filter={`url(#marker-shadow-${view})`}
                      >
                        <rect
                          x={-14}
                          y={-10}
                          width={28}
                          height={20}
                          rx={6}
                          fill="#B91C1C"
                          stroke="#FFFFFF"
                          strokeWidth={1.5}
                        />
                        <text
                          x={0}
                          y={4}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="700"
                          fill="#FFFFFF"
                        >
                          R{obs.reaction}
                        </text>
                      </g>
                    </g>
                  )}

                  {/* 3. Standardized Release Indicator (Emerald Green #15803D Checkmark Badge) */}
                  {obs.released && (
                    <g
                      transform={`translate(${releaseBadgeX}, ${releaseBadgeY})`}
                      filter={`url(#marker-shadow-${view})`}
                      data-testid={`marker-released-${view}-${area.id}`}
                    >
                      <circle
                        cx={0}
                        cy={0}
                        r={11}
                        fill="#15803D"
                        stroke="#FFFFFF"
                        strokeWidth={1.6}
                      />
                      <path
                        d="M -4.5 0.5 L -1.2 3.8 L 5 -3.5"
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  )}

                  {/* 4. Note Indicator Pin */}
                  {obs.note && obs.note.trim().length > 0 && (
                    <g
                      transform={`translate(${noteBadgeX}, ${noteBadgeY})`}
                      filter={`url(#marker-shadow-${view})`}
                      data-testid={`marker-note-${view}-${area.id}`}
                    >
                      <title>{obs.note}</title>
                      <rect
                        x={-10}
                        y={-9}
                        width={20}
                        height={18}
                        rx={4}
                        fill="#334155"
                        stroke="#FFFFFF"
                        strokeWidth={1.3}
                      />
                      <line
                        x1={-5}
                        y1={-3}
                        x2={5}
                        y2={-3}
                        stroke="#FFFFFF"
                        strokeWidth={1.6}
                        strokeLinecap="round"
                      />
                      <line
                        x1={-5}
                        y1={2}
                        x2={2}
                        y2={2}
                        stroke="#FFFFFF"
                        strokeWidth={1.6}
                        strokeLinecap="round"
                      />
                    </g>
                  )}

                  {/* Center Anatomical Landmark Pin & Index Number */}
                  {(showLandmarkDots || hasObservation || isSelected || isHovered) && (
                    <g
                      opacity={
                        matchesBodyPartFilter(area.id, bodyPartFilter) &&
                        (!activeBodySegment ||
                          getBodySegmentForArea(area.id) === activeBodySegment)
                          ? 1
                          : isSelected || isHovered
                            ? 1
                            : 0.28
                      }
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={hasObservation || isSelected ? 11.5 : 9.5}
                        fill={
                          isSelected
                            ? '#2B4C3F'
                            : hasObservation
                              ? '#1E2421'
                              : '#FAF9F6'
                        }
                        fillOpacity={hasObservation || isSelected ? 0.95 : 0.88}
                        stroke={
                          isSelected
                            ? '#FFFFFF'
                            : obs.reaction
                              ? '#B91C1C'
                              : obs.restriction
                                ? '#1E3A8A'
                                : obs.released
                                  ? '#15803D'
                                  : '#2B4C3F'
                        }
                        strokeWidth={hasObservation || isSelected ? 2.2 : 1.5}
                      />
                      {showLandmarkNumbers && (
                        <text
                          x={cx}
                          y={cy + 3.8}
                          textAnchor="middle"
                          fontSize="10.5"
                          fontWeight="700"
                          fill={hasObservation || isSelected ? '#FFFFFF' : '#1E2421'}
                        >
                          {area.index}
                        </text>
                      )}
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}

        {/* LAYER 5 (Left/Right): 19 Independent Transparent Interactive Hit Targets */}
        {view !== 'top' && !readOnly && (
          <g data-testid={`layer-hit-targets-${view}`}>
            {ANATOMICAL_AREAS.map((area) => {
              const coord = getAreaCoordinate(area.id, view);
              const cx = coord.x * width;
              const cy = coord.y * height;
              const hitR = Math.max(24, area.hitRadius * width);

              return (
                <g
                  key={`hit-${area.id}`}
                  data-testid={`svg-hit-${view}-${area.id}`}
                  className="cursor-pointer"
                  onPointerEnter={() => onHoverArea?.({ areaId: area.id, side: view })}
                  onPointerLeave={() => onHoverArea?.(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBodySegment?.(getBodySegmentForArea(area.id));
                    onAreaLandmarkClick?.(area.id, view);
                  }}
                >
                  <title>
                    {area.index}. {lang === 'ru' ? area.nameRu : area.nameEn}
                  </title>
                  {area.hitPolygon && (
                    <polygon
                      points={pointsToSvgPolygon(
                        area.hitPolygon,
                        width,
                        height,
                        isMirrored
                      )}
                      fill="transparent"
                      stroke="transparent"
                      strokeWidth={8}
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={hitR}
                    fill="transparent"
                    stroke="transparent"
                  />
                </g>
              );
            })}
          </g>
        )}

        {/* TOP VIEW LAYER 4 & 5: Predominant Diagonal Vector Arrow + 6 Interactive Dorsal Anchors */}
        {view === 'top' && (
          <g data-testid="layer-top-view-diagonal">
            {/* Dorsal Midline Reference */}
            <line
              x1={185}
              y1={height / 2}
              x2={875}
              y2={height / 2}
              stroke="#64748B"
              strokeWidth={1.2}
              strokeDasharray="6 5"
              opacity={0.55}
            />

            {/* Saved Predominant Diagonal Vector Line(s) */}
            {topDiagonals.map((diag) => {
              const x1 = diag.start.x * width;
              const y1 = diag.start.y * height;
              const x2 = diag.end.x * width;
              const y2 = diag.end.y * height;
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              return (
                <g
                  key={diag.id}
                  data-testid="marker-predominant-diagonal"
                >
                  {/* Contrast halo */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#FAF9F6"
                    strokeWidth={9}
                    strokeLinecap="round"
                    opacity={0.85}
                  />
                  {/* Primary Vector Diagonal Arrow */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#1E2421"
                    strokeWidth={4.2}
                    strokeLinecap="round"
                    markerEnd={`url(#diag-arrow-${view})`}
                  />
                  <circle
                    cx={x1}
                    cy={y1}
                    r={7}
                    fill="#B91C1C"
                    stroke="#FFFFFF"
                    strokeWidth={1.8}
                  />
                  <circle
                    cx={x2}
                    cy={y2}
                    r={7}
                    fill="#1E3A8A"
                    stroke="#FFFFFF"
                    strokeWidth={1.8}
                  />
                  {diag.label && (
                    <g transform={`translate(${midX}, ${midY - 14})`}>
                      <rect
                        x={-98}
                        y={-11}
                        width={196}
                        height={20}
                        rx={5}
                        fill="#1E2421"
                        fillOpacity={0.9}
                      />
                      <text
                        x={0}
                        y={3}
                        textAnchor="middle"
                        fontSize="10.5"
                        fontWeight="600"
                        fill="#FAF9F6"
                      >
                        {diag.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* 6 Interactive Dorsal Anchors (Left/Right Atlas, Left/Right Sacrum, Left/Right Gluteal) */}
            {(
              Object.entries(TOP_VIEW_ANCHORS) as Array<
                [
                  Exclude<DiagonalAnchor, 'custom'>,
                  (typeof TOP_VIEW_ANCHORS)['left_atlas'],
                ]
              >
            ).map(([key, anchor]) => {
              const cx = anchor.point.x * width;
              const cy = anchor.point.y * height;
              const isSelectedStart = pendingAtlasAnchor === key;
              const isUsedInDiag = topDiagonals.some(
                (d) => d.fromAnchor === key || d.toAnchor === key
              );
              const isTopSide = anchor.point.y < 0.5;

              return (
                <g
                  key={key}
                  data-testid={`top-anchor-${key}`}
                  className={readOnly ? '' : 'cursor-pointer'}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTopAnchorTap(key, anchor.role);
                  }}
                >
                  {/* Generous 48px touch hitbox */}
                  <circle cx={cx} cy={cy} r={26} fill="transparent" />

                  {isSelectedStart && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={17}
                      fill="#2B4C3F"
                      fillOpacity={0.18}
                      stroke="#2B4C3F"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  )}

                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelectedStart || isUsedInDiag ? 10 : 8.5}
                    fill={
                      isSelectedStart
                        ? '#2B4C3F'
                        : isUsedInDiag
                          ? anchor.role === 'atlas'
                            ? '#B91C1C'
                            : '#1E3A8A'
                          : '#FAF9F6'
                    }
                    stroke={
                      isSelectedStart
                        ? '#2B4C3F'
                        : anchor.role === 'atlas'
                          ? '#B91C1C'
                          : '#1E3A8A'
                    }
                    strokeWidth={2.2}
                  />

                  {/* Label Pill */}
                  <g
                    transform={`translate(${cx}, ${
                      isTopSide ? cy - 20 : cy + 22
                    })`}
                  >
                    <rect
                      x={-54}
                      y={-10}
                      width={108}
                      height={19}
                      rx={5}
                      fill="#FAF9F6"
                      fillOpacity={0.92}
                      stroke="#CBD5E1"
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={3.5}
                      textAnchor="middle"
                      fontSize="10.5"
                      fontWeight="600"
                      fill="#1E2421"
                    >
                      {lang === 'ru' ? anchor.labelRu : anchor.labelEn}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {/* Interactive helper hint on Top View when an Atlas anchor is selected */}
      {view === 'top' && !readOnly && pendingAtlasAnchor && (
        <div className="mt-2 px-3 py-1.5 rounded-lg bg-[#2B4C3F]/10 border border-[#2B4C3F]/30 text-xs text-[#2B4C3F] font-medium flex items-center justify-between">
          <span>
            {lang === 'ru'
              ? `Выбран старт: ${TOP_VIEW_ANCHORS[pendingAtlasAnchor].labelRu}. Нажмите на Ягодичную или Крестец на схеме для построения диагонали.`
              : `Start selected: ${TOP_VIEW_ANCHORS[pendingAtlasAnchor].labelEn}. Now tap a Gluteal or Sacrum anchor on the Top View to place the diagonal.`}
          </span>
          <button
            type="button"
            onClick={() => setPendingAtlasAnchor(null)}
            className="text-xs underline ml-2 cursor-pointer"
          >
            {lang === 'ru' ? 'Отмена' : 'Cancel'}
          </button>
        </div>
      )}
    </div>
  );
};
