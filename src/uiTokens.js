/**
 * Shared UI tokens — aligned with shadcn theme (src/index.css).
 */

export const UI = {
  /** Primary UI font (matches body / shadcn sans) */
  fontApp: `"Montserrat", ui-sans-serif, system-ui, sans-serif`,
  /** Section / school name headings */
  fontHeading: `ui-sans-serif, system-ui, "Montserrat", sans-serif`,
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
  logoApp: 88,
  mobileMenuBtn: 44,
  iconMenu: 20,
  logoSplash: 192,
  navEmoji: 28,
  padMain: 18,
  fontBody: 13,
  fontSmall: 12,
  radiusCard: 12,
  radiusControl: 8,
  iconSm: 18,
  iconMd: 20,
  iconNav: 24,
  pageTitle: (marginBottom = 14) => ({
    margin: `0 0 ${marginBottom}px`,
    color: "var(--color-navy)",
    fontFamily: `ui-sans-serif, system-ui, "Montserrat", sans-serif`,
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: "-0.02em",
  }),
};

export const UI_NAVY_HEX = "#1B5E20";
