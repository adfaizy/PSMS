import { APP_BRAND_LOGO_URL } from "../branding.js";

/** Theme colors via CSS variables (light/dark via data-theme). */
export const C = {
  navy: "var(--color-navy)",
  navyL: "var(--color-navy-soft)",
  gold: "var(--color-gold)",
  green: "var(--color-green)",
  red: "var(--color-red)",
  gray: "var(--color-gray)",
  grayL: "var(--color-gray-soft)",
  breakC: "var(--break-main)",
  breakL: "var(--break-soft)",
};

export const APP_BRAND_LOGO = APP_BRAND_LOGO_URL;

/** System emblem fallback; school upload overrides prints/cards. */
export function schoolOrBrandLogo(logo) {
  return logo || APP_BRAND_LOGO;
}

export const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
