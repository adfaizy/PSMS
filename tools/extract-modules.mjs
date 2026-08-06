/**
 * Extract feature modules from App.jsx and rewrite App to import them.
 * Run: node tools/extract-modules.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "src", "App.jsx");
const src = fs.readFileSync(appPath, "utf8");
const lines = src.split(/\r?\n/);

const slice = (a, b) => lines.slice(a - 1, b).join("\n");
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });

function write(rel, content) {
  const full = path.join(root, rel);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, content.replace(/\r\n/g, "\n"), "utf8");
  console.log("wrote", rel);
}

function exportify(code) {
  return code
    .replace(/^function /gm, "export function ")
    .replace(/^async function /gm, "export async function ")
    .replace(/^const ([A-Z_][A-Za-z0-9_]*)\s*=/gm, "export const $1 =");
}

const reactImports = `import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, startTransition } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "@/xlsxClient.js";
import JSZip from "@/jszipClient.js";
import jsPDFModule from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { X, Plus, Edit2, Trash2, Upload, Download, Menu, Settings, AlertTriangle, Eye, EyeOff } from "lucide-react";
import * as feeCore from "@/modules/fee/feeCore";
import { feeService, systemSettingsService, dashboardService } from "@/services";
import { UI } from "@/uiTokens.js";
import signImg from "@/assets/sign.png";
import { yieldToMain } from "@/yieldToMain.js";
import { C, schoolOrBrandLogo, APP_BRAND_LOGO, genId } from "@/shared/theme";
import { Btn, Sel, Inp, SchoolHeader } from "@/components/AppControls";
import * as H from "@/shared/helpers";

const {
  formatGradeLabel, formatClassDisplay, resolveClass, getClassLabel, normKey,
  getClassSubjects, isTeachingStaffMember, teachingStaffList, normalizeRollNo,
  findStudentByAdmissionNo, getRollNumberScopeClassIds, findStudentByRollInClass,
  maxNumericFromAdmissionStrings, nextAdmissionNo, maxRollInClass, nextRollNoForClass,
  stripDuplicateAdmissionsForImport, dedupeStudentsByIdentity, fmtMin, academicSession,
  calcTimes, getTT, setTT, setTTSingleDay, parseABVariantSubject, isABCounterpartSubject,
  getPeriodLabel, timetablePdfPeriodCell, getClassesByPortion, getStaffInPortion,
  isPortionMaskFull, formatPortionMaskLabel, getClassesByPortionMask, getStaffInPortionMask,
  normalizeStaffCategory, toProperCase, toProperCaseNameInput, staffDateToDDMMYYYY,
  staffFormatCNIC, staffFormatPhone, staffFormatDateInput, excelDateToDDMMYYYY,
  parseMarksImportCell, parseWorkbook, getExportHeaderMeta, sanitizePdfFilenamePart,
  sanitizePdfCell, sanitizePdfTableRows, pdfDataUrlFormat, getTeachersWithAssignments,
  DASHBOARD_EXAM_LS, exportTableToPdf, exportTableToExcel, exportTimetableBatchPlannerPdf,
  exportConsolidatedSheetToPdf, getTableDataFromElement, teacherPlannerFooterColumns,
  drawTeacherPlannerFooterColumn, appendTeacherPlannerScheduleFooterPdf,
  isTeacherPlannerTimetablePdfTitle, downloadExcel, brandingLogoDataUrlForPdf,
} = H;

const jsPDF =
  typeof jsPDFModule === "function"
    ? jsPDFModule
    : jsPDFModule?.jsPDF ?? jsPDFModule?.default;
`;

// ── helpers ──────────────────────────────────────────────────────────────────
const helpersSrc = [
  slice(195, 549),
  slice(827, 898),
  slice(1854, 2564),
  slice(7071, 7077),
].join("\n\n");

write(
  "src/shared/helpers.js",
  `import { systemSettingsService } from "@/services";
import * as XLSX from "@/xlsxClient.js";
import jsPDFModule from "jspdf";
import autoTable from "jspdf-autotable";
import { C, schoolOrBrandLogo, genId } from "@/shared/theme";
import { UI } from "@/uiTokens.js";
import { yieldToMain } from "@/yieldToMain.js";

const jsPDF =
  typeof jsPDFModule === "function"
    ? jsPDFModule
    : jsPDFModule?.jsPDF ?? jsPDFModule?.default;

export const DASHBOARD_EXAM_LS = "sms_dashboard_exam";

${exportify(helpersSrc)}
`
);

write(
  "src/modules/dashboard/DashboardPage.jsx",
  `${reactImports}
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

${exportify(slice(6643, 6933))}
`
);

write(
  "src/modules/timetable/TimetablePage.jsx",
  `${reactImports}

${exportify(slice(798, 826))}

${exportify(slice(899, 1784))}
`
);

write(
  "src/modules/examination/ExaminationPage.jsx",
  `${reactImports}

${exportify(slice(682, 796))}

${exportify(slice(4607, 5745))}

${exportify(slice(6194, 6640))}
`
);

write(
  "src/modules/paperGenerator/PaperGeneratorPage.jsx",
  `${reactImports}

${exportify(slice(5748, 6192))}
`
);

write(
  "src/modules/cardGenerator/CardGeneratorPage.jsx",
  `${reactImports}

${exportify(slice(7745, 8509))}
`
);

write(
  "src/modules/attendance/AttendancePage.jsx",
  `${reactImports}

export const ATTENDANCE_DATA_KEY = "system_management_attendance";
export function loadAttendanceFromLocal(schoolId) {
  try {
    if (typeof window === "undefined" || !schoolId) return {};
    const raw = window.localStorage.getItem(ATTENDANCE_DATA_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data[schoolId] && typeof data[schoolId] === "object" ? data[schoolId] : {};
  } catch { return {}; }
}
export function saveAttendanceToLocal(schoolId, att) {
  try {
    if (typeof window === "undefined" || !schoolId) return;
    const raw = window.localStorage.getItem(ATTENDANCE_DATA_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[schoolId] = att && typeof att === "object" ? att : {};
    window.localStorage.setItem(ATTENDANCE_DATA_KEY, JSON.stringify(data));
  } catch {}
}

${exportify(slice(4408, 4604))}
`
);

write(
  "src/modules/fee/FeePage.jsx",
  `${reactImports}

${exportify(slice(8512, 8976))}
`
);

write(
  "src/modules/staffProfiles/StaffProfilesPage.jsx",
  `${reactImports}

${exportify(slice(7079, 7750))}
`
);

write(
  "src/modules/settings/SettingsPage.jsx",
  `${reactImports}

${exportify(slice(1786, 1864))}

${exportify(slice(2566, 4406))}
`
);

// ── Rebuild slim App.jsx ─────────────────────────────────────────────────────
const head = `import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, startTransition } from "react";
import {
  verifyPassword,
  hashPassword,
} from "./cloudSync.js";
import { createPortal } from "react-dom";
import * as XLSX from "./xlsxClient.js";
import { X, Plus, Edit2, Trash2, Upload, Download, Menu, Settings, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { AboutUsPage } from "./AboutUsPage";
import { BookBankPage } from "./BookBankPage";
import { LibraryPage } from "./LibraryPage";
import * as feeCore from "./modules/fee/feeCore";
import { feeService, systemSettingsService, dashboardService } from "./services";
import PWAInstallBanner from "./PWAInstallBanner";
import { APP_BRAND_LOGO_URL } from "./branding.js";
import { yieldToMain } from "./yieldToMain.js";
import { UI } from "./uiTokens.js";
import { C, schoolOrBrandLogo, APP_BRAND_LOGO, genId } from "./shared/theme";
import { Btn, Sel, Inp, SchoolHeader } from "./components/AppControls";
import {
  formatGradeLabel, formatClassDisplay, resolveClass, getClassLabel, normKey,
  getClassSubjects, isTeachingStaffMember, teachingStaffList, normalizeRollNo,
  findStudentByAdmissionNo, getRollNumberScopeClassIds, findStudentByRollInClass,
  maxNumericFromAdmissionStrings, nextAdmissionNo, maxRollInClass, nextRollNoForClass,
  stripDuplicateAdmissionsForImport, dedupeStudentsByIdentity, fmtMin, academicSession,
  calcTimes, getTT, setTT, setTTSingleDay, parseABVariantSubject, isABCounterpartSubject,
  getPeriodLabel, timetablePdfPeriodCell, getClassesByPortion, getStaffInPortion,
  isPortionMaskFull, formatPortionMaskLabel, getClassesByPortionMask, getStaffInPortionMask,
  normalizeStaffCategory, toProperCase, toProperCaseNameInput, staffDateToDDMMYYYY,
  staffFormatCNIC, staffFormatPhone, staffFormatDateInput, excelDateToDDMMYYYY,
  parseMarksImportCell, parseWorkbook, getExportHeaderMeta, DASHBOARD_EXAM_LS,
} from "./shared/helpers";
import { DashboardPage } from "./modules/dashboard/DashboardPage";
import { TimetablePage } from "./modules/timetable/TimetablePage";
import { ExaminationPage } from "./modules/examination/ExaminationPage";
import { PaperGeneratorPage } from "./modules/paperGenerator/PaperGeneratorPage";
import { CardGeneratorPage } from "./modules/cardGenerator/CardGeneratorPage";
import { AttendancePage, loadAttendanceFromLocal, saveAttendanceToLocal, ATTENDANCE_DATA_KEY } from "./modules/attendance/AttendancePage";
import { FeePage } from "./modules/fee/FeePage";
import { StaffProfilesPage } from "./modules/staffProfiles/StaffProfilesPage";
import { SettingsPage } from "./modules/settings/SettingsPage";

/** Main shell navigation (left sidebar). */
const APP_MAIN_NAV = [
  { id: "dashboard", l: "Dashboard", i: "🏠" },
  { id: "timetable", l: "Timetable", i: "📅" },
  { id: "attendance", l: "Attendance", i: "📋" },
  { id: "fees", l: "Fees", i: "💳" },
  { id: "examination", l: "Examination", i: "📝" },
  { id: "paper", l: "Paper Generator", i: "📄" },
  { id: "card", l: "Card Generator", i: "💳" },
  { id: "book-bank", l: "PTBB Books", i: "📚" },
  { id: "library", l: "Library", i: "📖" },
  { id: "about", l: "About Us", i: "ℹ️" },
  { id: "settings", l: "Settings", i: "⚙️" },
];

const RESULT_CARD_BORDER_URL = "";
`;

const defaultData = slice(66, 193);
const printCss = slice(6935, 7068);
const persistence = slice(8977, 9048);
const authAndApp = slice(9070, lines.length);

const newApp = [
  head,
  defaultData,
  "",
  printCss,
  "",
  persistence,
  "",
  authAndApp,
  "",
].join("\n");

// Backup original once
const bak = path.join(root, "src", "App.jsx.bak");
if (!fs.existsSync(bak)) {
  fs.copyFileSync(appPath, bak);
  console.log("backed up App.jsx -> App.jsx.bak");
}
fs.writeFileSync(appPath, newApp.replace(/\r\n/g, "\n"), "utf8");
console.log("rewrote src/App.jsx");
console.log("done");
