/**
 * Embedding in Research Station (research-station: docs/station/CONTRACT.md, §4).
 * The station opens the app in an iframe with `?embedded=1`; the app answers `ready` and sends its title.
 * Sessions, notes, photos and voice stay on this device inside the app: nothing is written for the station's
 * passport (the contract keeps therapeutic records in their own module).
 */
const MODULE = 'somatic';
const STATION_ORIGIN = 'https://drinkbeer228.github.io';

export function isEmbedded(search: string, framed: boolean): boolean {
  return framed && new URLSearchParams(search).get('embedded') === '1';
}

export function connectStation(win: Window = window): boolean {
  let framed = false;
  try {
    framed = win.parent !== win;
  } catch {
    framed = true;
  }
  if (!isEmbedded(win.location.search, framed)) return false;
  win.document.documentElement.classList.add('ers-embedded');
  try {
    win.parent.postMessage({ ers: 1, module: MODULE, type: 'ready' }, STATION_ORIGIN);
    win.parent.postMessage({ ers: 1, module: MODULE, type: 'title', title: 'Полевой блокнот' }, STATION_ORIGIN);
  } catch {
    // No station to tell.
  }
  return true;
}
