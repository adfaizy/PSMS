/**
 * Single source for the Punjab-SMS brand mark: `public/app-brand-logo.png`
 * (copied to `dist/` on build). Companion icons:
 * - `favicon.png` (browser tab)
 * - `apple-touch-icon.png` (iOS home screen)
 * - `pwa-icon-192.png` / `pwa-icon-512.png` (PWA install on mobile/desktop)
 * Replace those files together when updating the system logo.
 */
const base = import.meta.env.BASE_URL || "./";
const withSlash = base.endsWith("/") ? base : `${base}/`;
export const APP_BRAND_LOGO_URL = `${withSlash}app-brand-logo.png`;
export const APP_PWA_ICON_192_URL = `${withSlash}pwa-icon-192.png`;
export const APP_PWA_ICON_512_URL = `${withSlash}pwa-icon-512.png`;
