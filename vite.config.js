import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Vite `base`: `/` or `/subdir/` (leading slash, trailing slash for subpaths). */
function viteBase(mode) {
  const env = loadEnv(mode, process.cwd(), "");
  const raw = (env.VITE_BASE || "/").trim();
  if (!raw || raw === "/") return "/";
  const withSlash = raw.endsWith("/") ? raw : `${raw}/`;
  return withSlash.startsWith("/") ? withSlash : `/${withSlash}`;
}

/** Rewrite root-absolute links in `index.html` when hosting under a subpath. */
function patchHtmlPublicLinks(base) {
  return {
    name: "psms-html-public-links",
    transformIndexHtml(html) {
      if (base === "/") return html;
      return html
        .replaceAll('href="/favicon.png"', `href="${base}favicon.png"`)
        .replaceAll('href="/manifest.webmanifest"', `href="${base}manifest.webmanifest"`);
    },
  };
}

/** Align PWA manifest with `base` after files are copied to `dist/`. */
function patchManifestScope(base) {
  return {
    name: "psms-manifest-scope",
    closeBundle() {
      const file = path.resolve("dist/manifest.webmanifest");
      if (!fs.existsSync(file)) return;
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      data.start_url = base;
      data.scope = base;
      data.id = base;
      const root = base === "/" ? "" : base.replace(/\/$/, "");
      if (Array.isArray(data.icons)) {
        data.icons = data.icons.map((icon) => {
          const src = icon.src;
          if (typeof src !== "string" || !src.startsWith("/") || src.startsWith(root + "/")) return icon;
          return { ...icon, src: `${root}${src}` };
        });
      }
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
    },
  };
}

export default defineConfig(({ mode }) => {
  const base = viteBase(mode);
  return {
    base,
    plugins: [
      react({
        babel: {
          presets: [["@babel/preset-react", { runtime: "automatic" }]],
        },
      }),
      patchHtmlPublicLinks(base),
      patchManifestScope(base),
    ],
    /**
     * Dev dependency pre-bundling needs esbuild (default). Disabling esbuild globally
     * or using `optimizeDeps.noDiscovery: true` without full `include` caused raw CJS
     * `react` / `react-dom` to load in the browser (no `createContext` / `createRoot`).
     */
    optimizeDeps: {
      // jspdf / jspdf-autotable ship ESM; forcing needsInterop breaks `import { jsPDF }` / constructor binding.
      needsInterop: ["jszip", "html2canvas"],
    },
    build: {
      chunkSizeWarningLimit: 2500,
      minify: false,
      cssMinify: false,
    },
  };
});
