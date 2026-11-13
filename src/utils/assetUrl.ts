/**
 * Resolves a file from `public/` against the app's deploy base path.
 *
 * The app is served from `/` locally but from a sub-path on GitHub Pages
 * (e.g. `/Digitalmethod/`), so root-absolute URLs like `/fonts/x.ttf` would 404 there.
 * Vite injects the base as `import.meta.env.BASE_URL`; under plain Node (unit tests)
 * it is undefined and we fall back to `/`.
 */
export const APP_BASE_URL: string =
  (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

export function assetUrl(publicPath: string): string {
  const base = APP_BASE_URL.endsWith('/') ? APP_BASE_URL : `${APP_BASE_URL}/`;
  return `${base}${publicPath.replace(/^\/+/, '')}`;
}
