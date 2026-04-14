/**
 * Shared UI tokens — use everywhere for consistent chrome, type, and logo sizes.
 */

export const UI = {
  /** Primary UI font (matches body in index.css) */
  fontApp: `"Montserrat", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
  /** Section / school name headings */
  fontHeading: `'Georgia', 'Times New Roman', serif`,
  /** Theme colors (see index.css :root) */
  navy: "var(--color-navy)",
  gray: "var(--color-gray)",
  green: "var(--color-green)",
  red: "var(--color-red)",
  gold: "var(--color-gold)",
  shellBg: "var(--bg-body)",
  canvasBg: "var(--ui-canvas-bg)",
  surface: "var(--bg-surface)",
  borderSubtle: "var(--border-subtle)",
  textMain: "var(--text-main)",
  textMuted: "var(--text-muted)",
  /** Brand logo in header, auth, admin, mobile drawer */
  logoApp: 88,
  /** Header hamburger — compact but ≥44px for touch */
  mobileMenuBtn: 44,
  /** Lucide Menu (three lines) inside hamburger */
  iconMenu: 20,
  /** Splash / boot screen emblem */
  logoSplash: 192,
  /** Sidebar route emojis (desktop + mobile) */
  navEmoji: 28,
  /** Main content padding (#print-section) */
  padMain: 18,
  /** Default body / control font size (px) */
  fontBody: 13,
  /** Secondary lines, captions */
  fontSmall: 12,
  /** Module inner card radius */
  radiusCard: 12,
  radiusControl: 8,
  /** Standard Lucide / toolbar icons */
  iconSm: 18,
  iconMd: 20,
  iconNav: 24,
  /** Page title (h2) — most modules */
  pageTitle: (marginBottom = 14) => ({
    margin: `0 0 ${marginBottom}px`,
    color: "var(--color-navy)",
    fontFamily: `'Georgia', 'Times New Roman', serif`,
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.25,
  }),
};

/** Hex navy for HTML/PDF strings where CSS variables are not available */
export const UI_NAVY_HEX = "#1B5E20";
