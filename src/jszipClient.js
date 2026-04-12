/**
 * JSZip is published as CJS (`module.exports = JSZip`). Vite dev can serve it
 * without default-export interop when dependency pre-bundling is limited.
 * This module resolves the constructor once for both dev and production.
 */
import * as jszipNs from "jszip";

function resolveJSZip() {
  const d = jszipNs?.default;
  if (typeof d === "function") return d;
  const named = Object.keys(jszipNs || {}).find(
    (k) => k !== "__esModule" && typeof jszipNs[k] === "function",
  );
  if (named) return jszipNs[named];
  throw new Error(
    "JSZip could not be loaded: no default or function export from 'jszip'.",
  );
}

const JSZip = resolveJSZip();
export default JSZip;
