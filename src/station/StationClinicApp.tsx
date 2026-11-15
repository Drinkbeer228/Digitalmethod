import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Hand,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import {
  computeScenarioScore,
  createScenarioSession,
  describePressureLevel,
  ELEPHANT_SCENARIOS,
  FIRM_BRACE_AT,
  getElephantScenario,
  getNextIncompleteZone,
  getObservedSignsForZone,
  getVeraCommentary,
  getZoneProgressRatio,
  inSoftWindow,
  isScenarioComplete,
  REACTION_SIGN_LABELS,
  selectZone,
  SOFT_CONTACT_MAX,
  SOFT_CONTACT_MIN,
  STATION_ZONES,
  stepScenario,
  type ElephantId,
  type ScenarioSessionState,
  type ZoneId,
} from './clinic';
import { ElephantDiagramSvg } from './ElephantDiagramSvg';
import {
  PROGRESS_KEY,
  readSomaticProgress,
  recordPractice,
  sendStationCloseRequest,
  type SomaticProgressRecord,
} from './link';

const TICK_MS = 100;

const VeraAvatarSvg: React.FC = () => (
  <svg
    viewBox="0 0 48 48"
    className="w-12 h-12 shrink-0 rounded-full border border-[#C9C2B3] bg-[#E8E4DA]"
    aria-hidden="true"
  >
    {/* Hair bun & soft hair silhouette */}
    <circle cx="24" cy="11" r="6" fill="#5A4A42" />
    <circle cx="24" cy="21" r="10.5" fill="#EAD7C5" stroke="#2C302E" strokeWidth="1.4" />
    <path d="M13.5 19 C15 12 33 12 34.5 19 C30 15 18 15 13.5 19 Z" fill="#5A4A42" />
    {/* Round field glasses */}
    <circle cx="20" cy="21" r="3" fill="none" stroke="#2C302E" strokeWidth="1.3" />
    <circle cx="28" cy="21" r="3" fill="none" stroke="#2C302E" strokeWidth="1.3" />
    <line x1="23" y1="21" x2="25" y2="21" stroke="#2C302E" strokeWidth="1.3" />
    <path d="M21 26.5 q3 2 6 0" fill="none" stroke="#2C302E" strokeWidth="1.3" strokeLinecap="round" />
    {/* Field clinic coat */}
    <path
      d="M8 46 C10 35 17 32 24 32 C31 32 38 35 40 46 Z"
      fill="#2E5A44"
      stroke="#2C302E"
      strokeWidth="1.4"
    />
    <path d="M21 32 L24 38 L27 32" fill="#F4F1EA" />
  </svg>
);

const ClinicSealSvg: React.FC = () => (
  <svg viewBox="0 0 36 36" className="w-9 h-9 shrink-0" aria-hidden="true">
    <rect x="1.5" y="1.5" width="33" height="33" rx="9" fill="#E8E4DA" stroke="#2E5A44" strokeWidth="1.8" />
    <path
      d="M11 22 C11 15 16 11 22 11 C24.5 11 26 12.5 26 15 C26 19 22.5 22 18 22 L15 22 L15 26"
      fill="none"
      stroke="#2C302E"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="20.5" cy="15.5" r="1.4" fill="#2E5A44" />
    <path d="M8 26 Q18 23 28 26" fill="none" stroke="#2E5A44" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const StationClinicApp: React.FC = () => {
  const [selectedElephantId, setSelectedElephantId] = useState<ElephantId>('margo');
  const [session, setSession] = useState<ScenarioSessionState>(() =>
    createScenarioSession('margo')
  );
  const [pressure, setPressure] = useState<number>(0);
  const [progress, setProgress] = useState<SomaticProgressRecord | null>(() =>
    typeof window !== 'undefined' ? readSomaticProgress() : null
  );
  const [savedNotice, setSavedNotice] = useState<{
    itemId: string;
    score: number;
    ok: boolean;
  } | null>(null);
  const [returnDispatched, setReturnDispatched] = useState(false);

  const pressureRef = useRef(0);
  pressureRef.current = pressure;
  const recordedForSessionRef = useRef<string | null>(null);

  const activeElephant = useMemo(
    () => getElephantScenario(selectedElephantId),
    [selectedElephantId]
  );

  // Apply station palette to document & title strictly while mounted in station mode
  useEffect(() => {
    const prevTitle = document.title;
    const prevBg = document.body.style.backgroundColor;
    const prevColor = document.body.style.color;
    document.title = 'Клиника реабилитации · Протокол Веры Павловны';
    document.body.style.backgroundColor = '#E8E4DA';
    document.body.style.color = '#2C302E';
    return () => {
      document.title = prevTitle;
      document.body.style.backgroundColor = prevBg;
      document.body.style.color = prevColor;
    };
  }, []);

  const scenarioFinished = isScenarioComplete(session);
  const activeZoneState = session.zones[session.activeZoneId];

  // Drive palpation simulation ticks cleanly at 10 Hz while scenario is active
  useEffect(() => {
    if (scenarioFinished) return undefined;
    const id = window.setInterval(() => {
      setSession((prev) => stepScenario(prev, pressureRef.current, TICK_MS / 1000));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [scenarioFinished, selectedElephantId]);

  // Persist completion to ers_progress_v1:somatic as soon as all 3 zones are released
  useEffect(() => {
    if (!scenarioFinished) return;
    const completionKey = `${session.elephantId}:${activeElephant.itemId}`;
    if (recordedForSessionRef.current === completionKey) return;

    recordedForSessionRef.current = completionKey;
    const finalScore = computeScenarioScore(session);
    const ok = recordPractice(activeElephant.itemId, finalScore);
    setProgress(readSomaticProgress());
    setSavedNotice({ itemId: activeElephant.itemId, score: finalScore, ok });
  }, [scenarioFinished, session, activeElephant.itemId]);

  const handleSelectElephant = (id: ElephantId) => {
    setSelectedElephantId(id);
    setSession(createScenarioSession(id));
    setPressure(0);
    setSavedNotice(null);
    recordedForSessionRef.current = null;
  };

  const handleSelectZone = (zoneId: ZoneId) => {
    setPressure(0);
    setSession((prev) => selectZone(prev, zoneId));
  };

  const handleRestartScenario = () => {
    setPressure(0);
    setSavedNotice(null);
    recordedForSessionRef.current = null;
    setSession(createScenarioSession(selectedElephantId));
  };

  const handleReturnToStation = () => {
    const sent = sendStationCloseRequest();
    if (sent) {
      setReturnDispatched(true);
    }
  };

  const completedElephantsCount = ELEPHANT_SCENARIOS.filter(
    (e) => progress?.items?.[e.itemId]?.status === 'done'
  ).length;

  const activeZoneSpec =
    STATION_ZONES.find((z) => z.id === session.activeZoneId) ?? STATION_ZONES[0];
  const commentary = getVeraCommentary(session);
  const observedSigns = getObservedSignsForZone(session, session.activeZoneId);
  const zoneProgressPct = Math.round(getZoneProgressRatio(activeZoneState) * 100);
  const currentScore = computeScenarioScore(session);
  const nextIncompleteZoneId = getNextIncompleteZone(session);
  const nextIncompleteZoneSpec = nextIncompleteZoneId
    ? STATION_ZONES.find((z) => z.id === nextIncompleteZoneId) ?? null
    : null;
  const completedZoneCount = STATION_ZONES.filter(
    (z) => session.zones[z.id].completed
  ).length;

  const nextElephant = useMemo(() => {
    const idx = ELEPHANT_SCENARIOS.findIndex((e) => e.id === selectedElephantId);
    return ELEPHANT_SCENARIOS[(idx + 1) % ELEPHANT_SCENARIOS.length];
  }, [selectedElephantId]);

  return (
    <div
      data-testid="station-clinic-root"
      className="min-h-dvh bg-[#E8E4DA] text-[#2C302E] antialiased selection:bg-[#2E5A44]/20"
    >
      {/* Top Field Tablet Bar */}
      <header className="border-b border-[#D6D0C2] bg-[#F4F1EA]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ClinicSealSvg />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#2C302E] leading-snug">
                Клиника реабилитации · Протокол клиники Веры Павловны
              </h1>
              <p className="text-xs text-[#555B57] leading-snug">
                Мягкая соматическая реабилитация · Фасциальная пальпация · Автономный планшет
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div
              data-testid="station-overall-progress"
              className="px-3 py-1.5 rounded-lg border border-[#D6D0C2] bg-[#E8E4DA] text-xs font-semibold text-[#2C302E] font-tabular"
            >
              Осмотры: {completedElephantsCount} / {ELEPHANT_SCENARIOS.length}
            </div>
            <button
              type="button"
              data-testid="station-return-btn"
              onClick={handleReturnToStation}
              className="min-h-[44px] px-4 rounded-lg bg-[#2E5A44] hover:bg-[#244836] text-[#F4F1EA] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C302E]"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Вернуться на станцию</span>
            </button>
          </div>
        </div>
        {returnDispatched && (
          <div
            data-testid="station-return-status"
            role="status"
            className="border-t border-[#D6D0C2] bg-[#E8E4DA]/70 px-4 py-1.5 text-center text-xs font-medium text-[#2E5A44]"
          >
            Сигнал возврата отправлен в станцию.
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4">
        {/* 3 Patient Cards: Марго, Претти, Одри */}
        <section aria-label="Карточки пациенток клиники" className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ELEPHANT_SCENARIOS.map((elephant) => {
            const isSelected = elephant.id === selectedElephantId;
            const savedRecord = progress?.items?.[elephant.itemId];
            const isDone = savedRecord?.status === 'done';

            return (
              <button
                key={elephant.id}
                type="button"
                data-testid={`station-patient-${elephant.id}`}
                aria-pressed={isSelected}
                onClick={() => handleSelectElephant(elephant.id)}
                className={`min-h-[44px] flex flex-col justify-between text-left rounded-xl p-3.5 border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E5A44] ${
                  isSelected
                    ? 'bg-[#F4F1EA] border-[#2E5A44] ring-2 ring-[#2E5A44]/25'
                    : 'bg-[#F4F1EA]/85 border-[#D6D0C2] hover:bg-[#F4F1EA] hover:border-[#9FA79F]'
                }`}
              >
                <div className="flex items-start justify-between gap-2 w-full">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-[#2C302E]">
                        {elephant.name}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#E8E4DA] text-[#454B47] border border-[#D6D0C2]">
                        {elephant.scenarioBadge}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-[#2C302E] leading-relaxed">
                      {elephant.careFocus}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 w-full border-t border-[#D6D0C2]/80 flex items-center justify-between text-[11px] font-semibold">
                  {isDone ? (
                    <span
                      data-testid={`station-patient-status-${elephant.id}`}
                      className="inline-flex items-center gap-1 text-[#2E5A44] font-tabular"
                    >
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      Осмотр пройден · {savedRecord.score ?? 100} б.
                    </span>
                  ) : (
                    <span
                      data-testid={`station-patient-status-${elephant.id}`}
                      className="text-[#5C635E]"
                    >
                      Ожидает осмотра
                    </span>
                  )}
                  <span className="text-[#2E5A44]">
                    {isSelected ? 'На приёме' : 'Открыть →'}
                  </span>
                </div>
              </button>
            );
          })}
        </section>

        {/* Active Clinical Scenario Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Stage: Anatomical Diagram & 3-Zone Switcher */}
          <section
            aria-labelledby="station-scenario-heading"
            className="lg:col-span-7 rounded-xl border border-[#D6D0C2] bg-[#F4F1EA] p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#2E5A44]">
                  {activeElephant.traitTag} · Зон выполнено: <span className="font-tabular">{completedZoneCount} / 3</span>
                </p>
                <h2
                  id="station-scenario-heading"
                  className="text-base sm:text-lg font-bold text-[#2C302E] mt-0.5"
                >
                  {activeElephant.name}: {activeElephant.scenarioTitle}
                </h2>
                <p className="text-xs text-[#4D534F] mt-1 leading-relaxed">
                  {activeElephant.reserveContext}
                </p>
              </div>

              <button
                type="button"
                onClick={handleRestartScenario}
                data-testid="station-restart-btn"
                className="min-h-[44px] px-3 rounded-lg border border-[#D6D0C2] bg-[#E8E4DA]/70 hover:bg-[#E8E4DA] text-xs font-semibold text-[#2C302E] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Заново</span>
              </button>
            </div>

            {/* 3 Zone Selector Buttons */}
            <div
              role="group"
              aria-label="Зоны фасциальной пальпации"
              className="grid grid-cols-1 sm:grid-cols-3 gap-2"
            >
              {STATION_ZONES.map((z, idx) => {
                const zState = session.zones[z.id];
                const isActive = z.id === session.activeZoneId;
                return (
                  <button
                    key={z.id}
                    type="button"
                    data-testid={`station-zone-btn-${z.id}`}
                    aria-pressed={isActive}
                    onClick={() => handleSelectZone(z.id)}
                    className={`min-h-[44px] px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      isActive
                        ? 'bg-[#2E5A44] text-[#F4F1EA] border-[#2E5A44]'
                        : zState.completed
                          ? 'bg-[#E8E4DA] text-[#2C302E] border-[#2E5A44]/50'
                          : 'bg-[#E8E4DA]/55 text-[#2C302E] border-[#D6D0C2] hover:bg-[#E8E4DA]'
                    }`}
                  >
                    <span className="text-xs font-semibold leading-tight">
                      {idx + 1}. {z.label}
                    </span>
                    {zState.completed && (
                      <Check
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[#F4F1EA]' : 'text-[#2E5A44]'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Interactive Elephant Anatomical Diagram */}
            <ElephantDiagramSvg
              elephantId={activeElephant.id}
              elephantName={activeElephant.name}
              activeZoneId={session.activeZoneId}
              zones={session.zones}
              pressure={pressure}
              observedSigns={observedSigns}
              onSelectZone={handleSelectZone}
            />
          </section>

          {/* Right Deck: Vera Pavlovna Dialogue + Palpation Console + Completion Card */}
          <div className="lg:col-span-5 space-y-4">
            {/* Vera Pavlovna Live Commentary */}
            <section
              aria-label="Комментарий Веры Павловны"
              className={`rounded-xl border p-4 space-y-3 ${
                commentary.tone === 'caution'
                  ? 'bg-[#F4F1EA] border-[#B86B35]'
                  : commentary.tone === 'release' || commentary.tone === 'complete'
                    ? 'bg-[#F4F1EA] border-[#2E5A44]'
                    : 'bg-[#F4F1EA] border-[#D6D0C2]'
              }`}
            >
              <div className="flex items-start gap-3">
                <VeraAvatarSvg />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#2E5A44]">
                      {commentary.speaker}
                    </span>
                    <span className="text-[11px] font-semibold text-[#555B57]">
                      {activeZoneSpec.shortLabel}
                    </span>
                  </div>
                  <p
                    data-testid="vera-dialogue"
                    role="status"
                    aria-live="polite"
                    className={`mt-1 text-sm leading-relaxed font-medium ${
                      commentary.tone === 'caution'
                        ? 'text-[#8C491E]'
                        : 'text-[#2C302E]'
                    }`}
                  >
                    «{commentary.text}»
                  </p>
                </div>
              </div>

              {/* Visible Elephant Release Reaction Badges */}
              <div className="pt-2 border-t border-[#D6D0C2]/80">
                <p className="text-[11px] font-semibold text-[#555B57] mb-1.5">
                  Наблюдаемые реакции на мягкий контакт:
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {REACTION_SIGN_LABELS.map((sign) => {
                    const active = observedSigns.includes(sign.id);
                    return (
                      <div
                        key={sign.id}
                        data-testid={`station-sign-${sign.id}`}
                        data-active={active ? '1' : '0'}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                          active
                            ? 'bg-[#2E5A44]/12 border-[#2E5A44] text-[#2C302E]'
                            : 'bg-[#E8E4DA]/50 border-[#D6D0C2] text-[#666C68]'
                        }`}
                      >
                        <Check
                          className={`w-3.5 h-3.5 shrink-0 ${
                            active ? 'text-[#2E5A44]' : 'text-[#A8AFA9]'
                          }`}
                        />
                        <span className="leading-tight">{sign.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Palpation Console */}
            <section
              aria-label="Пульт фасциальной пальпации"
              className="rounded-xl border border-[#D6D0C2] bg-[#F4F1EA] p-4 space-y-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#2C302E]">
                    Фасциальная пальпация: {activeZoneSpec.label}
                  </h3>
                  <p className="text-xs text-[#555B57] mt-0.5">
                    {activeZoneSpec.anatomyHint}
                  </p>
                </div>
                <span className="text-xs font-bold font-tabular px-2 py-1 rounded-md bg-[#E8E4DA] border border-[#D6D0C2] text-[#2C302E] shrink-0">
                  {currentScore} б.
                </span>
              </div>

              {/* Pressure Slider & Optimal Window Track */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <label htmlFor="station-palm-pressure" className="text-[#2C302E]">
                    Давление ладони
                  </label>
                  <span
                    data-testid="station-pressure-readout"
                    className={`font-tabular ${
                      pressure >= FIRM_BRACE_AT
                        ? 'text-[#9A4E22]'
                        : inSoftWindow(pressure)
                          ? 'text-[#2E5A44]'
                          : 'text-[#555B57]'
                    }`}
                  >
                    {describePressureLevel(pressure)} ({pressure})
                  </span>
                </div>

                {/* Visual gauge showing the Soft Contact Window (15..38) */}
                <div className="relative pt-1">
                  <div
                    aria-hidden="true"
                    className="h-2 rounded-full bg-[#DCD6C8] overflow-hidden relative"
                  >
                    <div
                      className="absolute inset-y-0 bg-[#2E5A44]/35 border-x border-[#2E5A44]"
                      style={{
                        left: `${SOFT_CONTACT_MIN}%`,
                        width: `${SOFT_CONTACT_MAX - SOFT_CONTACT_MIN}%`,
                      }}
                    />
                    <div
                      className="absolute inset-y-0 right-0 bg-[#B86B35]/30"
                      style={{ left: `${FIRM_BRACE_AT}%` }}
                    />
                  </div>
                  <input
                    id="station-palm-pressure"
                    data-testid="station-pressure-slider"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={pressure}
                    disabled={activeZoneState.completed}
                    aria-valuetext={`${describePressureLevel(pressure)}, ${pressure}`}
                    onChange={(e) => setPressure(Number(e.target.value))}
                    className="w-full mt-1.5 accent-[#2E5A44] cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#5C635E]">
                  <span>0 · Воздух</span>
                  <span className="font-semibold text-[#2E5A44]">
                    Окно контакта ({SOFT_CONTACT_MIN}–{SOFT_CONTACT_MAX})
                  </span>
                  <span>{FIRM_BRACE_AT}+ · Зажим</span>
                </div>
              </div>

              {/* Hold Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-[#2C302E]">
                  <span>Отклик и релиз ткани</span>
                  <span className="font-tabular" data-testid="station-zone-progress">
                    {zoneProgressPct}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-[#DCD6C8] overflow-hidden">
                  <div
                    className="h-full bg-[#2E5A44] transition-[width] duration-100"
                    style={{ width: `${zoneProgressPct}%` }}
                  />
                </div>
              </div>

              {/* Tactile Control Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                {!activeZoneState.completed ? (
                  <>
                    <button
                      type="button"
                      data-testid="station-soft-touch-btn"
                      onClick={() => setPressure(24)}
                      className={`flex-1 min-h-[44px] px-3 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                        inSoftWindow(pressure)
                          ? 'bg-[#2E5A44] text-[#F4F1EA]'
                          : 'bg-[#E8E4DA] hover:bg-[#DDD7C9] text-[#2C302E] border border-[#2E5A44]'
                      }`}
                    >
                      <Hand className="w-4 h-4 shrink-0" />
                      <span>Мягкая ладонь (24)</span>
                    </button>
                    <button
                      type="button"
                      data-testid="station-release-hand-btn"
                      onClick={() => setPressure(0)}
                      className="min-h-[44px] px-3 rounded-lg border border-[#D6D0C2] bg-[#E8E4DA]/70 hover:bg-[#E8E4DA] text-xs font-semibold text-[#2C302E] cursor-pointer"
                    >
                      Убрать руку
                    </button>
                  </>
                ) : nextIncompleteZoneSpec ? (
                  <button
                    type="button"
                    data-testid="station-next-zone-btn"
                    onClick={() => handleSelectZone(nextIncompleteZoneSpec.id)}
                    className="w-full min-h-[44px] px-4 rounded-lg bg-[#2E5A44] hover:bg-[#244836] text-[#F4F1EA] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Следующая зона: {nextIncompleteZoneSpec.label}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                ) : null}
              </div>
            </section>

            {/* Completion Summary & Data Contract Confirmation */}
            {scenarioFinished && (
              <section
                data-testid="station-completion-card"
                aria-label="Итоги осмотра"
                className="rounded-xl border-2 border-[#2E5A44] bg-[#F4F1EA] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-[#2E5A44]">
                    <Sparkles className="w-5 h-5 shrink-0" />
                    <h3 className="text-base font-bold text-[#2C302E]">
                      Осмотр слонихи {activeElephant.name} завершён
                    </h3>
                  </div>
                  <span
                    data-testid="station-final-score"
                    className="px-2.5 py-1 rounded-lg bg-[#2E5A44] text-[#F4F1EA] text-sm font-bold font-tabular shrink-0"
                  >
                    {savedNotice?.score ?? currentScore} / 100
                  </span>
                </div>

                <p className="text-xs text-[#2C302E] leading-relaxed">
                  {activeElephant.completionSummary}
                </p>

                <div
                  data-testid="station-progress-saved"
                  data-saved={savedNotice?.ok ? '1' : '0'}
                  className="rounded-lg border border-[#D6D0C2] bg-[#E8E4DA]/75 px-3 py-2 text-xs text-[#2C302E] flex items-center gap-2"
                >
                  {savedNotice?.ok === false ? (
                    <>
                      <ShieldAlert className="w-4 h-4 text-[#B86B35] shrink-0" />
                      <span>
                        Не удалось сохранить результат в локальную память ({PROGRESS_KEY}).
                      </span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-[#2E5A44] shrink-0" />
                      <span>
                        Запись сохранена в протокол клиники (<code>{PROGRESS_KEY}</code>).
                      </span>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="station-next-elephant-btn"
                    onClick={() => handleSelectElephant(nextElephant.id)}
                    className="min-h-[44px] px-3.5 rounded-lg border border-[#D6D0C2] bg-[#E8E4DA] hover:bg-[#DDD7C9] text-xs sm:text-sm font-semibold text-[#2C302E] cursor-pointer"
                  >
                    Осмотреть следующую: {nextElephant.name}
                  </button>
                  <button
                    type="button"
                    data-testid="station-complete-return-btn"
                    onClick={handleReturnToStation}
                    className="flex-1 min-h-[44px] px-4 rounded-lg bg-[#2E5A44] hover:bg-[#244836] text-[#F4F1EA] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4 shrink-0" />
                    <span>Вернуться на станцию</span>
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
