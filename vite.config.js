import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

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
  const photosRoot = path.resolve(__dirname, "Photos");
  return {
    base,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    plugins: [
      tailwindcss(),
      react({
        babel: {
          presets: [["@babel/preset-react", { runtime: "automatic" }]],
        },
      }),
      patchHtmlPublicLinks(base),
      patchManifestScope(base),
      {
        name: "psms-serve-photos",
        configureServer(server) {
          server.middlewares.use("/Photos-api", (req, res, next) => {
            try {
              const url = new URL(req.url || "/", "http://psms.local");
              if (url.pathname === "/folder-exists" || url.pathname.endsWith("/folder-exists")) {
                const name = String(url.searchParams.get("name") || "").trim();
                const dir = path.normalize(path.join(photosRoot, name));
                const ok =
                  !!name &&
                  dir.startsWith(photosRoot) &&
                  fs.existsSync(dir) &&
                  fs.statSync(dir).isDirectory();
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ exists: ok }));
                return;
              }
              next();
            } catch {
              next();
            }
          });
          server.middlewares.use("/Photos", (req, res, next) => {
            try {
              const rel = decodeURIComponent((req.url || "/").split("?")[0] || "/");
              const filePath = path.normalize(path.join(photosRoot, rel));
              if (!filePath.startsWith(photosRoot)) {
                res.statusCode = 403;
                res.end("Forbidden");
                return;
              }
              if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
                next();
                return;
              }
              const ext = path.extname(filePath).toLowerCase();
              const types = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".webp": "image/webp",
                ".gif": "image/gif",
                ".bmp": "image/bmp",
              };
              res.setHeader("Content-Type", types[ext] || "application/octet-stream");
              res.setHeader("Cache-Control", "no-cache");
              fs.createReadStream(filePath).pipe(res);
            } catch {
              next();
            }
          });
        },
      },
    ],
    /**
     * Dev dependency pre-bundling needs esbuild (default). Disabling esbuild globally
     * or using `optimizeDeps.noDiscovery: true` without full `include` caused raw CJS
     * `react` / `react-dom` to load in the browser (no `createContext` / `createRoot`).
     */
    optimizeDeps: {
      // jspdf / jspdf-autotable ship ESM; forcing needsInterop breaks `import { jsPDF }` / constructor binding.
      needsInterop: ["jszip", "html2canvas"],
      include: ["@imgly/background-removal", "onnxruntime-web"],
    },
    worker: {
      format: "es",
    },
    server: {
      watch: {
        // Student photo files lock on Windows and crash Vite's watcher
        ignored: ["**/Photos/**", "**/node_modules/**"],
      },
    },
    build: {
      chunkSizeWarningLimit: 2500,
      minify: false,
      cssMinify: false,
    },
  };
});