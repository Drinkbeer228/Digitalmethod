import React from 'react';
import {
  FIRM_BRACE_AT,
  STATION_ZONES,
  inSoftWindow,
  type ElephantId,
  type PalpationPhase,
  type ReleaseReactionId,
  type ZoneId,
  type ZonePalpationState,
} from './clinic';

interface ElephantDiagramSvgProps {
  elephantId: ElephantId;
  elephantName: string;
  activeZoneId: ZoneId;
  zones: Record<ZoneId, ZonePalpationState>;
  pressure: number;
  observedSigns: readonly ReleaseReactionId[];
  onSelectZone: (zoneId: ZoneId) => void;
}

export const ElephantDiagramSvg: React.FC<ElephantDiagramSvgProps> = ({
  elephantId,
  elephantName,
  activeZoneId,
  zones,
  pressure,
  observedSigns,
  onSelectZone,
}) => {
  const activePhase: PalpationPhase = zones[activeZoneId].phase;
  const headLowered =
    observedSigns.includes('head_lower') ||
    activePhase === 'response' ||
    activePhase === 'stay' ||
    activePhase === 'release';
  const blinking =
    observedSigns.includes('blink') ||
    activePhase === 'response' ||
    activePhase === 'stay';
  const lipRelaxed =
    observedSigns.includes('lip_relax') ||
    activePhase === 'stay' ||
    activePhase === 'release';
  const yawning = observedSigns.includes('yawn') || activePhase === 'release';
  const braced = activePhase === 'brace' || pressure >= FIRM_BRACE_AT;

  const activeZoneSpec = STATION_ZONES.find((z) => z.id === activeZoneId) ?? STATION_ZONES[0];

  // Subtle hide tint variation per individual elephant
  const hideFill =
    elephantId === 'margo'
      ? '#C2BCB0'
      : elephantId === 'pretty'
        ? '#CAC4B8'
        : '#B9C0BC';
  const earFill =
    elephantId === 'margo'
      ? '#B4AEA2'
      : elephantId === 'pretty'
        ? '#BDB7AA'
        : '#ACB3AF';

  return (
    <svg
      viewBox="0 0 520 320"
      role="img"
      aria-label={`Анатомическая схема осмотра слонихи ${elephantName}`}
      data-testid="station-elephant-svg"
      className={`w-full h-auto rounded-xl border border-[#D6D0C2] bg-[#ECE8DF] select-none ${
        braced ? 'station-brace' : ''
      }`}
    >
      {/* Reserve horizon / ground reference */}
      <path
        d="M24 276 Q140 272 260 276 T496 274"
        fill="none"
        stroke="#C7C0B1"
        strokeWidth="1.5"
      />
      <ellipse cx="268" cy="282" rx="158" ry="12" fill="#DDD7C9" />

      {/* Subtle dorsal anatomical guide line (poll -> withers -> sacrolumbar) */}
      <path
        d="M112 86 Q190 66 266 78 T366 112"
        fill="none"
        stroke="#8C938E"
        strokeWidth="1.4"
        strokeDasharray="4 4"
        opacity="0.7"
      />

      {/* Hind & far-side legs */}
      <g fill={earFill} stroke="#2C302E" strokeWidth="2" strokeLinejoin="round">
        {/* Far foreleg */}
        <path d="M188 186 L184 268 Q195 274 210 268 L214 192 Z" />
        {/* Far hindleg */}
        <path d="M322 184 L318 266 Q330 272 344 266 L348 188 Z" />
      </g>

      {/* Main torso & near legs */}
      <g fill={hideFill} stroke="#2C302E" strokeWidth="2.2" strokeLinejoin="round">
        {/* Tail */}
        <path
          d="M402 142 Q434 166 430 218"
          fill="none"
          stroke="#2C302E"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path d="M425 216 L435 228 L423 226 Z" fill="#2C302E" />

        {/* Torso */}
        <path d="M152 140 C166 86 226 66 296 74 C362 82 406 112 404 156 C402 192 368 206 318 204 C272 202 232 206 196 202 C164 198 146 176 152 140 Z" />

        {/* Near foreleg */}
        <path d="M164 176 L160 272 Q178 279 196 272 L202 186 Z" />
        {/* Near hindleg */}
        <path d="M342 170 L340 270 Q358 277 376 270 L380 174 Z" />
      </g>

      {/* Subtle toenail arcs on fore/hind feet */}
      <g fill="#EAE5DA" stroke="#2C302E" strokeWidth="1.2">
        <path d="M163 268 q5 -4 10 0" />
        <path d="M177 269 q5 -4 10 0" />
        <path d="M343 267 q5 -4 10 0" />
        <path d="M357 268 q5 -4 10 0" />
      </g>

      {/* Trait markers per elephant */}
      {elephantId === 'margo' && (
        <g aria-hidden="true">
          {/* Heel-pad & forelimb alignment callout under Margo's front feet */}
          <path
            d="M150 282 L214 282"
            stroke="#2E5A44"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="3 3"
          />
          <circle cx="195" cy="272" r="4" fill="#2E5A44" opacity="0.7" />
        </g>
      )}
      {elephantId === 'audrey' && (
        <g aria-hidden="true" opacity="0.65" stroke="#2E5A44" fill="none" strokeWidth="1.5">
          {/* Gentle cool water mist droplets over Audrey's back/shoulder after bathing */}
          <path d="M236 58 q3 -6 6 0 q-3 6 -6 0 Z" />
          <path d="M254 50 q3 -6 6 0 q-3 6 -6 0 Z" />
          <path d="M274 56 q3 -6 6 0 q-3 6 -6 0 Z" />
        </g>
      )}

      {/* Animated Head, Trunk, Ear, Eye & Jaw Group (responds to head_lower, blink, lip_relax, yawn) */}
      <g
        style={{
          transform: braced
            ? 'rotate(3deg)'
            : headLowered
              ? 'rotate(-5deg) translateY(5px)'
              : 'rotate(0deg)',
          transformOrigin: '166px 128px',
          transition: 'transform 450ms ease',
        }}
      >
        {/* Cranium & forehead */}
        <path
          d="M168 124 C164 82 132 64 100 72 C72 80 58 106 62 134 C66 154 74 166 76 196 C78 228 60 250 48 258 C42 262 46 270 55 268 C74 264 92 238 94 202 C96 178 102 166 116 164 C138 162 162 150 168 124 Z"
          fill={hideFill}
          stroke="#2C302E"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {/* Lower jaw / mouth — opens smoothly on yawn or softens on lip_relax */}
        {yawning ? (
          <path
            d="M84 156 Q98 176 116 162"
            fill="#9A6C64"
            stroke="#2C302E"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        ) : (
          <path
            d={lipRelaxed ? 'M84 155 Q100 167 115 156' : 'M84 152 Q99 158 114 152'}
            fill="none"
            stroke="#2C302E"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        )}

        {/* Small tusk / ivory curve */}
        <path
          d="M72 150 Q52 158 46 146"
          fill="none"
          stroke="#F4F1EA"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M72 150 Q52 158 46 146"
          fill="none"
          stroke="#2C302E"
          strokeWidth="1.4"
          strokeLinecap="round"
        />

        {/* Eye — soft blink crescent during response/stay/release */}
        {blinking || activePhase === 'release' ? (
          <path
            d="M84 114 Q92 120 100 114"
            fill="none"
            stroke="#2C302E"
            strokeWidth="2.4"
            strokeLinecap="round"
            className={activePhase === 'response' ? 'station-blink' : ''}
          />
        ) : (
          <g>
            <circle cx="92" cy="113" r="4" fill="#2C302E" />
            <circle cx="90.8" cy="111.8" r="1.1" fill="#F4F1EA" />
          </g>
        )}

        {/* Large Asian/Indian elephant ear with gentle skin-fold contour */}
        <g
          style={{
            transform: headLowered ? 'rotate(4deg)' : 'rotate(0deg)',
            transformOrigin: '130px 96px',
            transition: 'transform 450ms ease',
          }}
        >
          <path
            d="M126 84 C162 72 184 106 178 144 C172 174 146 180 130 162 C122 152 120 114 126 84 Z"
            fill={earFill}
            stroke="#2C302E"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          {elephantId === 'pretty' && (
            /* Highlighted ear/neck skin folds for Pretty */
            <g stroke="#2E5A44" strokeWidth="1.4" fill="none" opacity="0.8">
              <path d="M134 102 Q146 116 138 134" />
              <path d="M144 96 Q156 114 148 138" />
            </g>
          )}
        </g>
      </g>

      {/* Active palm contact halo on current zone */}
      {pressure > 0 && (
        <circle
          cx={activeZoneSpec.x}
          cy={activeZoneSpec.y}
          r={activeZoneSpec.r + 6 + Math.min(pressure, 60) * 0.18}
          fill="none"
          stroke={braced ? '#B86B35' : inSoftWindow(pressure) ? '#2E5A44' : '#6A716C'}
          strokeWidth="2.5"
          strokeDasharray={inSoftWindow(pressure) ? undefined : '4 3'}
          opacity="0.85"
        />
      )}

      {/* 3 Interactive Palpation Zones */}
      {STATION_ZONES.map((z, idx) => {
        const zState = zones[z.id];
        const isActive = z.id === activeZoneId;
        const isDone = zState.completed;
        const ringColor =
          isActive && braced
            ? '#B86B35'
            : isDone || isActive
              ? '#2E5A44'
              : '#5C635E';
        const badgeY = z.id === 'poll' ? z.y - z.r - 14 : z.id === 'shoulder' ? z.y + z.r + 18 : z.y - z.r - 14;

        return (
          <g
            key={z.id}
            role="button"
            tabIndex={0}
            data-testid={`station-zone-hotspot-${z.id}`}
            aria-label={`${z.label}${isDone ? ' — осмотр завершён' : isActive ? ' — активная зона' : ''}`}
            onClick={() => onSelectZone(z.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectZone(z.id);
              }
            }}
            className="cursor-pointer focus:outline-none"
          >
            {isActive && !isDone && (
              <circle
                cx={z.x}
                cy={z.y}
                r={z.r + 5}
                fill="none"
                stroke={ringColor}
                strokeWidth="1.8"
                className="station-pulse-ring"
              />
            )}
            <circle
              cx={z.x}
              cy={z.y}
              r={z.r}
              fill={
                isDone
                  ? 'rgba(46, 90, 68, 0.24)'
                  : isActive
                    ? 'rgba(46, 90, 68, 0.14)'
                    : 'rgba(244, 241, 234, 0.45)'
              }
              stroke={ringColor}
              strokeWidth={isActive ? 2.8 : 1.6}
              strokeDasharray={isActive || isDone ? undefined : '4 3'}
            />
            <text
              x={z.x}
              y={z.y + 4}
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill="#2C302E"
            >
              {isDone ? '✓' : String(idx + 1)}
            </text>

            {/* Zone pill label */}
            <g>
              <rect
                x={z.x - 62}
                y={badgeY - 12}
                width="124"
                height="20"
                rx="6"
                fill={isActive ? '#2E5A44' : '#F4F1EA'}
                stroke={isActive ? '#2E5A44' : '#C9C2B3'}
                strokeWidth="1"
              />
              <text
                x={z.x}
                y={badgeY + 2}
                textAnchor="middle"
                fontSize="10.5"
                fontWeight="700"
                fill={isActive ? '#F4F1EA' : '#2C302E'}
              >
                {z.shortLabel}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
};
