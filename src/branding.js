/**
 * Single source for the system brand mark: `public/app-brand-logo.png`
 * (PSMS Punjab School Management System logo; copied to `dist/` on build).
 * Replace that file to update favicon, PWA, splash, and in-app header.
 */
const base = import.meta.env.BASE_URL || "./";
const withSlash = base.endsWith("/") ? base : `${base}/`;
export const APP_BRAND_LOGO_URL = `${withSlash}app-brand-logo.png`;
