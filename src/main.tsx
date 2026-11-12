import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const initOfflineSW = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/offline-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const collectLoadedUrls = () => {
        const entries = performance
          .getEntriesByType('resource')
          .map((r) => r.name)
          .filter((u) => u.startsWith(window.location.origin));
        return Array.from(
          new Set([
            window.location.origin + '/',
            window.location.origin + '/index.html',
            window.location.origin + '/src/main.tsx',
            window.location.origin + '/@vite/client',
            ...entries,
          ])
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

createRoot(document.getElementById('root')!).render(<App />);
