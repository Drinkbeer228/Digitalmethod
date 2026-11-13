import React, { useEffect, useState } from 'react';
import { BodyworkSession, HorseProfile, Language, SessionPhoto } from '../types';
import { buildSessionPdfFile, shareOrDownloadPdfFile } from '../utils/pdfExport';
import { countMarkedZoneSides } from '../utils/zoneEditing';
import { AlertTriangle, Check, FileText, Loader2, RotateCw, Share2 } from 'lucide-react';

const NO_PHOTOS: SessionPhoto[] = [];

export type FinishPhase = 'saving' | 'saved' | 'error';

interface SessionFinishSheetProps {
  phase: FinishPhase;
  horse: HorseProfile;
  session: BodyworkSession;
  lang: Language;
  /** Before / After photos embedded into the PDF */
  photos?: SessionPhoto[];
  onRetry: () => void;
  onOpenReport: () => void;
  onClose: () => void;
}

/**
 * Result of "Finish": confirms the session is on disk, then offers the PDF straight away.
 * The PDF is built as soon as the save is confirmed so the Share tap can hand a ready
 * file to the system share sheet (iOS drops the tap's permission if we build it afterwards).
 */
export const SessionFinishSheet: React.FC<SessionFinishSheetProps> = ({
  phase,
  horse,
  session,
  lang,
  photos = NO_PHOTOS,
  onRetry,
  onOpenReport,
  onClose,
}) => {
  const ru = lang === 'ru';
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (phase !== 'saved') return undefined;
    let cancelled = false;
    setPdfFile(null);
    void buildSessionPdfFile(horse, session, lang, photos)
      .then((file) => {
        if (!cancelled) setPdfFile(file);
      })
      .catch((err) => console.error('Failed to pre-build PDF:', err));
    return () => {
      cancelled = true;
    };
  }, [phase, horse, session, lang, photos]);

  const handleShare = async () => {
    setIsSharing(true);
    setShareMsg(null);
    try {
      const file = pdfFile ?? (await buildSessionPdfFile(horse, session, lang, photos));
      const outcome = await shareOrDownloadPdfFile(
        file,
        `${horse.name} — #${session.sessionNumber}`
      );
      if (outcome === 'shared') {
        setShareMsg({ ok: true, text: ru ? 'PDF отправлен' : 'PDF shared' });
      } else if (outcome === 'downloaded') {
        setShareMsg({
          ok: true,
          text: ru ? `PDF сохранён: ${file.name}` : `PDF downloaded: ${file.name}`,
        });
      }
    } catch (err) {
      console.error('PDF export failed:', err);
      setShareMsg({
        ok: false,
        text: ru
          ? 'Не удалось создать PDF. Сессия сохранена — попробуйте ещё раз.'
          : 'Could not create the PDF. The session is saved — try again.',
      });
    } finally {
      setIsSharing(false);
    }
  };

  const zones = countMarkedZoneSides(session.evaluationTable);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-label={ru ? 'Завершение сессии' : 'Finish session'}
      data-testid="session-finish-sheet"
      data-phase={phase}
      onClick={phase === 'saving' ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-[#FAF9F6] border-t sm:border border-slate-300 shadow-2xl px-4 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {phase === 'saving' && (
          <div className="flex items-center gap-3 py-6 text-sm font-semibold text-slate-700">
            <Loader2 className="w-5 h-5 animate-spin text-[#2B4C3F]" />
            <span>{ru ? 'Сохранение сессии…' : 'Saving session…'}</span>
          </div>
        )}

        {phase === 'error' && (
          <>
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-red-800" data-testid="finish-title">
                  {ru ? 'Сессия не сохранена' : 'Session not saved'}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                  {ru
                    ? 'Не удалось записать данные на устройство. Ваши отметки остаются на экране — повторите попытку, не закрывая приложение.'
                    : 'The data could not be written to this device. Your marks are still on screen — retry before closing the app.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="finish-continue-btn"
                onClick={onClose}
                className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-xs font-semibold text-[#1E2421] cursor-pointer"
              >
                {ru ? 'Назад к оценке' : 'Back to evaluation'}
              </button>
              <button
                type="button"
                data-testid="finish-retry-btn"
                onClick={onRetry}
                className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 hover:bg-red-800 text-sm font-bold text-white cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
                <span>{ru ? 'Повторить' : 'Retry save'}</span>
              </button>
            </div>
          </>
        )}

        {phase === 'saved' && (
          <>
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-full bg-[#15803D] text-white flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 stroke-[3]" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-[#1E2421]" data-testid="finish-title">
                  {ru
                    ? `Сессия №${session.sessionNumber} сохранена`
                    : `Session #${session.sessionNumber} saved`}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5" data-testid="finish-summary">
                  {horse.name} · {session.date} ·{' '}
                  {ru ? `отмечено зон: ${zones}` : `${zones} zone${zones === 1 ? '' : 's'} marked`}
                </p>
              </div>
            </div>

            {shareMsg && (
              <div
                data-testid="finish-share-status"
                role="status"
                className={`px-3 py-2 rounded-lg border text-xs font-medium ${
                  shareMsg.ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {shareMsg.text}
              </div>
            )}

            <button
              type="button"
              data-testid="finish-share-pdf-btn"
              disabled={isSharing}
              onClick={() => void handleShare()}
              className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#2B4C3F] hover:bg-[#223D32] disabled:opacity-60 text-sm font-bold text-white cursor-pointer"
            >
              {isSharing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              <span>{ru ? 'Поделиться PDF' : 'Share PDF'}</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="finish-continue-btn"
                onClick={onClose}
                className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-xs font-semibold text-[#1E2421] cursor-pointer"
              >
                {ru ? 'Продолжить' : 'Continue'}
              </button>
              <button
                type="button"
                data-testid="finish-open-report-btn"
                onClick={onOpenReport}
                className="min-h-[48px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2B4C3F] bg-white text-xs font-semibold text-[#2B4C3F] cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>{ru ? 'Открыть отчёт' : 'Open report'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
