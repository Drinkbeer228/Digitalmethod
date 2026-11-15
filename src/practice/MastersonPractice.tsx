import React, { useEffect, useRef, useState } from 'react';
import {
  BRACE_AT,
  createPractice,
  ELEPHANT_ZONES,
  PRACTICE,
  reaction,
  score,
  stayProgress,
  tick,
  type PracticeState,
} from './masterson';
import { embeddedNow, recordPractice, requestStationClose } from '../station/link';

const STEP_MS = 100;

/**
 * The clinic's practical session (Research Station): the Masterson Method's Search–Response–Stay–Release on the
 * shoulder of Pretty. The palm pressure is a slider (keyboard and touch); the elephant answers on the diagram.
 */
export function MastersonPractice({ lang }: { lang: 'ru' | 'en' }) {
  const ru = lang === 'ru';
  const [pressure, setPressure] = useState(0);
  const [state, setState] = useState<PracticeState>(() => createPractice());
  /** The score once the session ended, and whether it reached the station's summary. */
  const [saved, setSaved] = useState<{ score: number; ok: boolean } | null>(null);
  const pressureRef = useRef(0);
  pressureRef.current = pressure;
  const embedded = typeof window !== 'undefined' && embeddedNow();

  useEffect(() => {
    if (state.phase === 'released') return;
    const id = window.setInterval(() => {
      setState((prev) => {
        const next = tick({ ...prev }, pressureRef.current, STEP_MS / 1000);
        return next;
      });
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [state.phase === 'released']);

  useEffect(() => {
    if (state.phase === 'released' && saved === null) {
      const sc = score(state);
      setSaved({ score: sc, ok: recordPractice(PRACTICE.itemId, sc) });
    }
  }, [state, saved]);

  const restart = () => {
    setPressure(0);
    setSaved(null);
    setState(createPractice());
  };

  const phase = state.phase;
  const held = (stayProgress(state) * 2).toLocaleString(ru ? 'ru-RU' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const target = ELEPHANT_ZONES.find((z) => z.id === PRACTICE.zoneId)!;
  const level = pressure >= BRACE_AT ? (ru ? 'сильное' : 'firm') : pressure >= 33 ? (ru ? 'среднее' : 'medium') : pressure > 0 ? (ru ? 'лёгкое' : 'light') : ru ? 'нет касания' : 'no touch';

  return (
    <section data-testid="masterson-practice" aria-labelledby="practice-title" className="max-w-3xl mx-auto space-y-4">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#2B4C3F]">
          {ru ? 'Клиника станции · практический сеанс' : 'Station clinic · practical session'}
        </p>
        <h2 id="practice-title" className="text-xl font-bold text-[#1E2421]">
          {ru ? 'Метод Мастерсона: плечо Претти' : 'Masterson Method: Pretty’s shoulder'}
        </h2>
        <p className="text-sm text-slate-700">
          {ru
            ? 'Положите ладонь на зону плеча и медленно добавляйте давление. Найдите лёгкое касание, дождитесь отклика и удержите его 2 секунды до релиза. Сильное давление заставит слониху напрячься.'
            : 'Lay your palm on the shoulder zone and add pressure slowly. Find the light touch, wait for the response and stay with it for 2 seconds until the release. Firm pressure makes her brace.'}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[1fr_auto] items-start">
        <svg
          viewBox="0 0 400 260"
          role="img"
          aria-label={ru ? 'Слониха Претти, вид слева, мышечные зоны' : 'Pretty the elephant, left side, muscle zones'}
          className={`w-full rounded-xl border border-slate-300 bg-[#F3F1EC] ${phase === 'brace' ? 'practice-brace' : ''}`}
        >
          {/* body */}
          <g fill="#9AA3A0" stroke="#4B5552" strokeWidth="2">
            <ellipse cx="225" cy="130" rx="125" ry="78" />
            <rect x="130" y="170" width="34" height="70" rx="12" />
            <rect x="182" y="176" width="32" height="64" rx="12" />
            <rect x="272" y="170" width="34" height="70" rx="12" />
            <rect x="316" y="166" width="30" height="72" rx="12" />
            <ellipse cx="96" cy="104" rx="52" ry="48" />
            <path d="M58 128 C40 170 52 214 74 236 L86 230 C70 206 64 172 80 140 Z" />
          </g>
          {/* ear: flicks on the response */}
          <path
            d="M104 70 C136 60 152 96 146 128 C140 150 116 152 104 136 Z"
            fill="#8A9390"
            stroke="#4B5552"
            strokeWidth="2"
            className={phase === 'response' ? 'practice-ear-flick' : ''}
            style={{ transformOrigin: '110px 90px' }}
          />
          {/* eye: closed on the response and the release */}
          {phase === 'response' || phase === 'released' ? (
            <path d="M74 96 q6 4 12 0" stroke="#1E2421" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          ) : (
            <circle cx="80" cy="96" r="3.5" fill="#1E2421" />
          )}
          {/* mouth: licking and chewing on the release */}
          {phase === 'released' && <path d="M66 132 q10 8 20 0" stroke="#C86D51" strokeWidth="3" fill="none" strokeLinecap="round" />}
          {/* zones */}
          {ELEPHANT_ZONES.map((z) => {
            const isTarget = z.id === target.id;
            return (
              <g key={z.id}>
                <circle
                  cx={z.x}
                  cy={z.y}
                  r={z.r}
                  fill={isTarget ? `rgba(43,76,63,${0.15 + Math.min(pressure, 60) / 150})` : 'rgba(255,255,255,0.25)'}
                  stroke={isTarget ? '#2B4C3F' : '#6B7470'}
                  strokeWidth={isTarget ? 3 : 1.2}
                  strokeDasharray={isTarget ? undefined : '3 3'}
                />
                <text x={z.x} y={z.labelAbove ? z.y - z.r - 5 : z.y + z.r + 12} textAnchor="middle" fontSize="11" fill="#1E2421">
                  {ru ? z.ru : z.en}
                </text>
              </g>
            );
          })}
          {/* the palm on the shoulder */}
          {pressure > 0 && (
            <circle cx={target.x} cy={target.y} r={8 + pressure / 10} fill="none" stroke="#C86D51" strokeWidth="2" opacity="0.8" />
          )}
        </svg>

        <div className="flex md:flex-col items-center gap-3 md:w-28">
          <label htmlFor="palm-pressure" className="text-xs font-semibold text-slate-700 text-center">
            {ru ? 'Давление ладони' : 'Palm pressure'}
          </label>
          <input
            id="palm-pressure"
            data-testid="palm-pressure"
            type="range"
            min={0}
            max={100}
            step={1}
            value={pressure}
            disabled={phase === 'released'}
            onChange={(e) => setPressure(Number(e.target.value))}
            aria-valuetext={level}
            className="w-full md:w-auto md:h-48 accent-[#2B4C3F] md:[writing-mode:vertical-lr] md:[direction:rtl]"
          />
          <span className="text-xs text-slate-600 text-center" aria-hidden="true">
            {level}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-300 bg-white p-3 space-y-2">
        <p data-testid="practice-reaction" role="status" aria-live="polite" className={`text-sm font-semibold ${phase === 'brace' ? 'text-[#9A3412]' : phase === 'released' ? 'text-[#156534]' : 'text-[#1E2421]'}`}>
          {reaction(state, lang)}
        </p>
        <div className="h-2 rounded-full bg-slate-200 overflow-hidden" aria-hidden="true">
          <div className="h-full bg-[#2B4C3F] transition-[width] duration-100" style={{ width: `${Math.round(stayProgress(state) * 100)}%` }} />
        </div>
        <p className="text-xs text-slate-600">
          {ru
            ? `Удержание: ${held} из 2 с · Ошибки: ${state.mistakes}`
            : `Stay: ${held} of 2 s · Mistakes: ${state.mistakes}`}
        </p>
      </div>

      {phase === 'released' && (
        <div data-testid="practice-result" className="rounded-xl border border-[#2B4C3F] bg-[#2B4C3F]/5 p-3 space-y-3">
          <p className="text-sm text-[#1E2421]" data-testid="practice-saved" data-ok={saved?.ok ? '1' : '0'}>
            {saved && !saved.ok
              ? ru
                ? `Сеанс завершён: ${saved.score} баллов, но результат не записался в Студенческий билет — память браузера недоступна.`
                : `Session complete: ${saved.score} points, but the result did not reach the student ID — browser storage is unavailable.`
              : ru
                ? `Сеанс завершён: ${saved?.score ?? score(state)} баллов. Результат внесён в Студенческий билет.`
                : `Session complete: ${saved?.score ?? score(state)} points. The result is in the student ID.`}
          </p>
          {saved && !saved.ok && (
            <button
              type="button"
              data-testid="practice-retry-save"
              onClick={() => setSaved({ score: saved.score, ok: recordPractice(PRACTICE.itemId, saved.score) })}
              className="min-h-[44px] px-4 rounded-lg border border-slate-300 text-sm font-semibold text-[#1E2421] cursor-pointer"
            >
              {ru ? 'Записать ещё раз' : 'Save again'}
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={restart} className="min-h-[44px] px-4 rounded-lg border border-slate-300 text-sm font-semibold text-[#1E2421] cursor-pointer">
              {ru ? 'Ещё один сеанс' : 'Another session'}
            </button>
            {embedded && (
              <button
                type="button"
                data-testid="practice-close"
                onClick={() => requestStationClose()}
                className="min-h-[44px] px-4 rounded-lg bg-[#2B4C3F] text-white text-sm font-semibold cursor-pointer"
              >
                {ru ? '← Вернуться на станцию' : '← Back to the station'}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
