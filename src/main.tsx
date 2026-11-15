import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { APP_BASE_URL, assetUrl } from './utils/assetUrl';
import { connectStation } from './station/link';
import { isStationRoute } from './station/clinic';
import { StationClinicApp } from './station/StationClinicApp';

const EquineApp = lazy(() => import('./App.tsx'));

connectStation();

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const initOfflineSW = async () => {
    try {
      // Scope = deploy base ("/" locally, "/Digitalmethod/" on GitHub Pages)
      const reg = await navigator.serviceWorker.register(assetUrl('offline-sw.js'), {
        scope: APP_BASE_URL,
      });
      await navigator.serviceWorker.ready;
      const appRoot = new URL(APP_BASE_URL, window.location.origin).href;
      const collectLoadedUrls = () => {
        const entries = performance
          .getEntriesByType('resource')
          .map((r) => r.name)
          .filter((u) => u.startsWith(appRoot));
        const devEntries = import.meta.env.DEV
          ? [appRoot + 'src/main.tsx', appRoot + '@vite/client']
          : [];
        return Array.from(
          new Set([appRoot, appRoot + 'index.html', ...devEntries, ...entries])
        );
      };
      const sendWarm = () => {
        const sw = reg.active || navigator.serviceWorker.controller;
        sw?.postMessage({ type: 'WARM_URLS', urls: collectLoadedUrls() });
      };
      sendWarm();
      setTimeout(sendWarm, 800);
    } catch {
      // Ignore if SW unsupported
    }
  };
  void initOfflineSW();
}

function RootEntry() {
  const [stationMode, setStationMode] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? isStationRoute(window.location.search, window.location.hash)
      : false
  );

  useEffect(() => {
    const syncRoute = () => {
      setStationMode(isStationRoute(window.location.search, window.location.hash));
    };
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);
    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, []);

  if (stationMode) {
    return <StationClinicApp />;
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF9F6]" />}>
      <EquineApp />
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(<RootEntry />);
