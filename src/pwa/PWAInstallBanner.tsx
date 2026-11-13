import React, { useEffect, useState } from 'react';
import { Download, WifiOff, Share, X } from 'lucide-react';
import { Language } from '../types';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const PWAInstallAction: React.FC<{ lang: Language }> = ({ lang }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  if (isInstalled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isInstallable) {
            void install();
          } else {
            setShowModal(true);
          }
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2B4C3F] bg-[#2B4C3F]/10 hover:bg-[#2B4C3F]/15 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        title={
          lang === 'ru'
            ? 'Установить приложение для работы офлайн в конюшне'
            : 'Install app for offline barn & arena use'
        }
      >
        <Download className="w-3.5 h-3.5" />
        <span>{lang === 'ru' ? 'Установить PWA' : 'Install App'}</span>
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print"
          role="dialog"
          aria-modal="true"
          aria-label="Install Offline PWA"
        >
          <div className="w-full max-w-md rounded-xl bg-[#FAF9F6] border border-slate-300 p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-[#1E2421]">
                {lang === 'ru'
                  ? 'Установка приложения на устройство (Офлайн PWA)'
                  : 'Install Masterson Case Digital for Offline Use'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-500 hover:text-slate-800 rounded-md"
                aria-label="Close install guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-700 leading-relaxed">
              {isIOS ? (
                <p>
                  {lang === 'ru' ? (
                    <>
                      1. Нажмите кнопку <strong>Поделиться</strong> (<Share className="inline w-4 h-4" />) в панели Safari.<br />
                      2. Выберите <strong>На экран «Домой»</strong> (Add to Home Screen).
                    </>
                  ) : (
                    <>
                      1. Tap the <strong>Share</strong> button (<Share className="inline w-4 h-4" />) in your iPad/iPhone Safari toolbar.<br />
                      2. Scroll down and tap <strong>Add to Home Screen</strong>.
                    </>
                  )}
                </p>
              ) : (
                <p>
                  {lang === 'ru'
                    ? 'Используйте значок установки в адресной строке браузера (Chrome / Edge / Safari), чтобы добавить приложение на главный экран. Все данные, схемы и модели Whisper сохраняются локально.'
                    : 'Use the Install icon in your browser address bar (or Add to Home Screen on tablet) to pin Masterson Case Digital as a standalone offline app. All records, drawings, and Whisper models stay 100% on your device.'}
                </p>
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-medium text-white bg-[#2B4C3F] rounded-lg hover:bg-[#223D32]"
              >
                {lang === 'ru' ? 'Понятно' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineConnectivityBanner: React.FC<{
  lang: Language;
  /** Sit just under the header instead of the bottom corner (keeps the thumb bar clear). */
  raised?: boolean;
}> = ({ lang, raised = false }) => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      className={`fixed right-3 z-40 ${raised ? 'top-14' : 'bottom-3'} flex items-center gap-2 rounded-lg bg-[#2B4C3F] px-3.5 py-2 text-xs font-medium text-[#FAF9F6] shadow-md border border-[#FAF9F6]/20 no-print`}
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
      <span>
        {lang === 'ru'
          ? 'Автономный режим (Airplane / Offline) — все функции и хранилище работают локально'
          : 'Offline Mode Active — Working 100% from local device storage'}
      </span>
    </div>
  );
};
