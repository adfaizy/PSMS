/**
 * SheetJS: the package `main` is CJS; Vite's dep optimizer can emit a broken
 * `import *` / default interop. Re-export the official ESM build only.
 */
export * from "xlsx/xlsx.mjs";
