import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
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

/** Write + inline public cloud config so EVERY browser/device gets Cloud ON. */
function psmsCloudConfigPlugin(mode, base) {
  const runWrite = () => {
    const scriptPath = path.resolve(__dirname, "scripts/write-psms-config.mjs");
    if (!fs.existsSync(scriptPath)) {
      console.warn("[psms-cloud] write-psms-config.mjs missing — skipping config write");
      return;
    }
    try {
      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: process.cwd(),
        stdio: "inherit",
      });
      if (result.error) {
        console.warn("[psms-cloud] config write failed:", result.error.message || result.error);
        return;
      }
      if (result.status !== 0 && result.status != null) {
        console.warn(`[psms-cloud] config write exited with code ${result.status}`);
      }
    } catch (err) {
      console.warn("[psms-cloud] config write threw:", err?.message || err);
    }
  };

  const readPublicConfig = () => {
    // Vite loadEnv + process.env (Vercel injects VITE_* into the build env)
    const env = loadEnv(mode, process.cwd(), "");
    let url = String(
      process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || ""
    ).trim();
    let anonKey = String(
      process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ""
    ).trim();
    const jsonPath = path.resolve(process.cwd(), "public/psms-config.json");
    if (fs.existsSync(jsonPath)) {
      try {
        const j = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
        url = url || String(j.url || "").trim();
        anonKey = anonKey || String(j.anonKey || "").trim();
      } catch {
        /* ignore */
      }
    }
    return { url, anonKey };
  };

  const marker = '<script src="/psms-config.js"></script>';

  return {
    name: "psms-cloud-config",
    buildStart() {
      runWrite();
    },
    configureServer() {
      runWrite();
    },
    transformIndexHtml(html) {
      const cfg = readPublicConfig();
      const scriptSrc = `${base}psms-config.js`;
      if (!cfg.url || !cfg.anonKey) {
        console.warn("[psms-cloud] No Supabase URL/key — Cloud will stay OFF");
        return html.replace(
          marker,
          `<script>window.__PSMS_CLOUD__=null;</script>\n    <script src="${scriptSrc}"></script>`
        );
      }
      const inline = `<script>window.__PSMS_CLOUD__=${JSON.stringify(cfg)};</script>`;
      console.log("[psms-cloud] Inlined cloud config into index.html");
      return html.replace(
        marker,
        `${inline}\n    <script src="${scriptSrc}"></script>`
      );
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
      psmsCloudConfigPlugin(mode, base),
      patchHtmlPublicLinks(base),
      patchManifestScope(base),
      {
        name: "psms-serve-photos",
        configureServer(server) {
          server.middlewares.use("/Photos-api", (req, res, next) => {
            try {
              const url = new URL(req.url || "/", "http://psms.local");
              const pathname = url.pathname || "";
              if (pathname === "/folder-exists" || pathname.endsWith("/folder-exists")) {
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
              // Create Photos/<Class>/ folders (+ .gitkeep) when classes are added
              if (pathname === "/ensure-folders" || pathname.endsWith("/ensure-folders")) {
                if (req.method !== "POST" && req.method !== "PUT") {
                  res.statusCode = 405;
                  res.end("Method not allowed");
                  return;
                }
                const chunks = [];
                req.on("data", (c) => chunks.push(c));
                req.on("end", () => {
                  try {
                    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
                    const names = Array.isArray(body.folders)
                      ? body.folders
                      : Array.isArray(body.names)
                        ? body.names
                        : [];
                    const created = [];
                    const existing = [];
                    const failed = [];
                    if (!fs.existsSync(photosRoot)) fs.mkdirSync(photosRoot, { recursive: true });
                    for (const raw of names) {
                      const name = String(raw || "")
                        .trim()
                        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
                        .replace(/\s+/g, " ")
                        .replace(/[. ]+$/g, "")
                        .trim();
                      if (!name || name === "." || name === "..") continue;
                      const dir = path.normalize(path.join(photosRoot, name));
                      if (!dir.startsWith(photosRoot)) {
                        failed.push(name);
                        continue;
                      }
                      try {
                        if (!fs.existsSync(dir)) {
                          fs.mkdirSync(dir, { recursive: true });
                          created.push(name);
                        } else {
                          existing.push(name);
                        }
                        const keep = path.join(dir, ".gitkeep");
                        if (!fs.existsSync(keep)) fs.writeFileSync(keep, "");
                      } catch {
                        failed.push(name);
                      }
                    }
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ ok: true, created, existing, failed }));
                  } catch (err) {
                    res.statusCode = 400;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ ok: false, error: String(err?.message || err) }));
                  }
                });
                return;
              }
              // List image files in a class folder (one call instead of dozens of 404 probes)
              if (pathname === "/list-folder" || pathname.endsWith("/list-folder")) {
                const name = String(url.searchParams.get("name") || "").trim();
                const dir = path.normalize(path.join(photosRoot, name));
                const imageExt =
                  /\.(jpe?g|jfif|jpe|png|webp|bmp|gif|heic|heif|avif|tiff?|ico|svg)$/i;
                let files = [];
                let dirExists = false;
                if (
                  name &&
                  dir.startsWith(photosRoot) &&
                  fs.existsSync(dir) &&
                  fs.statSync(dir).isDirectory()
                ) {
                  dirExists = true;
                  files = fs
                    .readdirSync(dir)
                    .map((f) => {
                      try {
                        const full = path.join(dir, f);
                        const st = fs.statSync(full);
                        if (!st.isFile() || !imageExt.test(f)) return null;
                        return { name: f, size: st.size, mtime: Math.floor(st.mtimeMs || 0) };
                      } catch {
                        return null;
                      }
                    })
                    .filter(Boolean);
                }
                const signature = files
                  .map((f) => `${f.name}:${f.size}:${f.mtime}`)
                  .sort()
                  .join("|");
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    exists: dirExists,
                    files,
                    signature,
                  }),
                );
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
              // Must 404 — do not fall through to SPA index.html (that was saved as "photos")
              if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
                res.statusCode = 404;
                res.setHeader("Content-Type", "text/plain; charset=utf-8");
                res.end("Not found");
                return;
              }
              const ext = path.extname(filePath).toLowerCase();
              const types = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".jpe": "image/jpeg",
                ".jfif": "image/jpeg",
                ".png": "image/png",
                ".webp": "image/webp",
                ".gif": "image/gif",
                ".bmp": "image/bmp",
                ".tif": "image/tiff",
                ".tiff": "image/tiff",
                ".heic": "image/heic",
                ".heif": "image/heif",
                ".avif": "image/avif",
                ".ico": "image/x-icon",
                ".svg": "image/svg+xml",
              };
              res.setHeader("Content-Type", types[ext] || "application/octet-stream");
              res.setHeader("Cache-Control", "no-cache");
              fs.createReadStream(filePath).pipe(res);
            } catch {
              res.statusCode = 500;
              res.end("Error");
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