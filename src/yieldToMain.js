/**
 * Lets the browser paint before continuing heavy work (reduces INP / "blocked UI" on clicks).
 * Uses scheduler.yield() when available (Chromium), else double rAF.
 * @returns {Promise<void>}
 */
export function yieldToMain() {
  return new Promise((resolve) => {
    if (typeof scheduler !== "undefined" && typeof scheduler.yield === "function") {
      scheduler.yield().then(resolve);
    } else {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    }
  });
}
