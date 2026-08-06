import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, startTransition } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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


// Shared ID card layout (school template: teal band, circular logo, white detail panel, dark strip + gold code on back)
const ID_CARD_HEADER_GRADIENT =
  "linear-gradient(135deg, #0f766e 0%, #0d9488 18%, #14b8a6 38%, #2dd4bf 58%, #34d399 72%, #0f172a 100%)";
const ID_CARD_PHOTO_RING = "#a7f3d0";
/** Photo slot: 1.5" wide × 2" tall; modest corner radius (rectangle, not pill). */
const ID_CARD_PHOTO_W = "1.5in";
const ID_CARD_PHOTO_H = "2in";
const ID_CARD_PHOTO_R = 8;
const ID_CARD_CHARCOAL = "#0f172a";
const ID_CARD_STRIP_GOLD = "#facc15";
const ID_CARD_MAX_W = 320;
/** Fixed height so front and back align; back uses flex to fill space to QR. */
const ID_CARD_FIXED_H = 528;
/** Alias for older references (e.g. min-height). */
const ID_CARD_MIN_H = ID_CARD_FIXED_H;
/** On-screen QR size (px); generated at higher res for sharp scans. */
const ID_CARD_QR_PX = 120;
const ID_CARD_QR_GEN = { width: 400, margin: 2, errorCorrectionLevel: "H", color: { dark: "#000000", light: "#ffffffff" } };

/** Module-level QR so React keeps the same component type across renders (nested defs remounted every paint → blink). */
export function IdCardStudentQRCode({ student, clsName, settings }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const payloadSig = useMemo(() => {
    const s = settings?.schoolName || "School";
    const c = (settings?.schoolCode || "").trim() || "";
    const payload = {
      t: "S",
      s,
      c,
      n: (student?.name || "").trim().slice(0, 40),
      a: (student?.admissionNo || "").trim(),
      r: (student?.rollNo || "").trim(),
      f: (student?.fatherName || "").trim().slice(0, 40),
      cls: (clsName || "").slice(0, 20),
      v: "Apr2025-Mar2026",
      w: (student?.whatsapp || "").trim().slice(0, 15),
    };
    return JSON.stringify(payload);
  }, [
    student?.id,
    student?.name,
    student?.admissionNo,
    student?.rollNo,
    student?.fatherName,
    student?.whatsapp,
    clsName,
    settings?.schoolName,
    settings?.schoolCode,
  ]);

  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((mod) => {
        const QRCode = mod.default || mod;
        if (QRCode && typeof QRCode.toDataURL === "function") {
          return QRCode.toDataURL(payloadSig, ID_CARD_QR_GEN);
        }
        return Promise.reject(new Error("toDataURL not available"));
      })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [payloadSig]);

  const logo = schoolOrBrandLogo(settings?.logo);
  return (
    <div style={{ padding: 6, background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", display: "inline-block", lineHeight: 0 }}>
      <div style={{ position: "relative", width: ID_CARD_QR_PX, height: ID_CARD_QR_PX, background: "#fff", borderRadius: 4 }}>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt=""
            decoding="async"
            style={{
              width: ID_CARD_QR_PX,
              height: ID_CARD_QR_PX,
              display: "block",
              imageRendering: "pixelated",
              borderRadius: 4,
            }}
          />
        ) : (
          <div style={{ width: ID_CARD_QR_PX, height: ID_CARD_QR_PX, background: "#fff" }} aria-hidden />
        )}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "#fff",
            border: "2px solid #e5e7eb",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </div>
    </div>
  );
}

/** Alias for older references / hot-reload — same component as IdCardStudentQRCode */
export const StudentQRCode = IdCardStudentQRCode;

export function IdCardStaffQRCode({ profile, settings }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const profileSig = useMemo(
    () =>
      STAFF_PROFILE_FIELDS.filter((f) => f.id !== "photo")
        .map((f) => String(profile[f.id] ?? ""))
        .join("\x01") + `\x01${settings?.schoolName ?? ""}\x01${settings?.schoolCode ?? ""}`,
    [profile, settings?.schoolName, settings?.schoolCode]
  );

  useEffect(() => {
    let cancelled = false;
    const short = {};
    const maxLen = 35;
    STAFF_PROFILE_FIELDS.forEach((f) => {
      if (f.id === "photo") return;
      const v = profile[f.id];
      if (v == null || v === "") return;
      let val = String(v).trim();
      if (val.length > maxLen) val = val.slice(0, maxLen);
      short[f.id] = val;
    });
    const payload = { t: "T", s: (settings.schoolName || "School").slice(0, 30), e: (settings.schoolCode || "").trim().slice(0, 12) || "", p: short };
    const text = JSON.stringify(payload);
    import("qrcode")
      .then((mod) => {
        const QRCode = mod.default || mod;
        if (QRCode && typeof QRCode.toDataURL === "function") {
          return QRCode.toDataURL(text, ID_CARD_QR_GEN);
        }
        return Promise.reject(new Error("toDataURL not available"));
      })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profileSig]);

  const logo = schoolOrBrandLogo(settings?.logo);
  return (
    <div style={{ padding: 6, background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", display: "inline-block", lineHeight: 0 }}>
      <div style={{ position: "relative", width: ID_CARD_QR_PX, height: ID_CARD_QR_PX, background: "#fff", borderRadius: 4 }}>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt=""
            decoding="async"
            style={{
              width: ID_CARD_QR_PX,
              height: ID_CARD_QR_PX,
              display: "block",
              imageRendering: "pixelated",
              borderRadius: 4,
            }}
          />
        ) : (
          <div style={{ width: ID_CARD_QR_PX, height: ID_CARD_QR_PX, background: "#fff" }} aria-hidden />
        )}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "#fff",
            border: "2px solid #e5e7eb",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </div>
    </div>
  );
}

/** Alias for older references / hot-reload — same component as IdCardStaffQRCode */
export const StaffQRCode = IdCardStaffQRCode;

// ─── STUDENT CARD GENERATOR (on demand: class + roll and/or admission #) ───────
export function parseRollTokensToSet(input) {
  const rollNums = new Set();
  const rawStr = new Set();
  const tokens = String(input || "").split(/[,،\s]+/).filter(Boolean);
  tokens.forEach((token) => {
    const part = token.trim();
    if (!part) return;
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-").map((p) => p.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        for (let n = start; n <= end; n++) rollNums.add(n);
      } else {
        rawStr.add(part.toLowerCase());
      }
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n)) rollNums.add(n);
      else rawStr.add(part.toLowerCase());
    }
  });
  return { rollNums, rawStr };
}

export function parseAdmissionTokens(input) {
  return String(input || "")
    .split(/[,،]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export function StudentCardGeneratorPage({ settings, students, currentSession }) {
  const firstCls = settings.classes[0]?.id || "";
  const [selCls, setSelCls] = useState(firstCls);
  const [singleRoll, setSingleRoll] = useState("");
  const [singleAdm, setSingleAdm] = useState("");
  const [downloading, setDownloading] = useState(false);
  const cardContainerRef = useRef(null);

  useEffect(() => {
    if (selCls && settings.classes.some((c) => c.id === selCls)) return;
    setSelCls(settings.classes[0]?.id || "");
  }, [settings.classes, selCls]);

  const filtered = selCls
    ? students.filter((s) => {
        const filterCls = resolveClass(settings.classes, selCls);
        const studentCls = resolveClass(settings.classes, s.classId);
        return filterCls && studentCls && filterCls.id === studentCls.id;
      })
    : [];
  const className = (clsId) => getClassLabel(settings, clsId) || "—";

  const cardsToRender = (() => {
    if (!selCls || !filtered.length) return [];
    const rollIn = (singleRoll || "").trim();
    const admIn = (singleAdm || "").trim();
    if (!rollIn && !admIn) return [];

    const byId = new Map();
    if (rollIn) {
      const { rollNums, rawStr } = parseRollTokensToSet(rollIn);
      if (rollNums.size > 0 || rawStr.size > 0) {
        filtered.forEach((s) => {
          const rNum = parseInt(String(s.rollNo || "").trim(), 10);
          const rStr = String(s.rollNo || "").trim().toLowerCase();
          let ok = false;
          if (rollNums.size > 0 && !isNaN(rNum) && rollNums.has(rNum)) ok = true;
          if (rawStr.size > 0 && rStr && [...rawStr].some((t) => rStr === t)) ok = true;
          if (ok) byId.set(s.id, s);
        });
      }
    }
    if (admIn) {
      const admTokens = parseAdmissionTokens(admIn);
      if (admTokens.length > 0) {
        filtered.forEach((s) => {
          const a = String(s.admissionNo || "").trim().toLowerCase();
          if (a && admTokens.some((t) => a === t)) byId.set(s.id, s);
        });
      }
    }
    return Array.from(byId.values());
  })();

  const needsSelection = !!(singleRoll || "").trim() || !!(singleAdm || "").trim();
  const selectionHintEmpty = selCls && filtered.length > 0 && !needsSelection;

  function formatDob(d) {
    if (!d) return "—";
    const s = String(d).trim();
    const parts = s.split(/[/-]/);
    if (parts.length >= 3) {
      const [d_, m_, y_] = parts;
      const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const mi = parseInt(m_, 10);
      const month = (mi >= 1 && mi <= 12) ? months[mi - 1] : m_;
      return `${d_.padStart(2,"0")} ${month}, ${y_}`;
    }
    return s;
  }

  function StudentCardFront({ student }) {
    const clsName = className(student.classId);
    const bayFormId = (student.bayForm || "").trim();
    const idValue = bayFormId || student.admissionNo || student.rollNo || "—";
    const fullName = (student.name || "").trim() || "—";
    const fatherName = (student.fatherName || "").trim() || "—";
    const validity = "April 2025 to March 2026";
    return (
      <div className="student-id-card-front" style={{ position: "relative", width: "100%", maxWidth: ID_CARD_MAX_W, height: ID_CARD_FIXED_H, minHeight: ID_CARD_MIN_H, background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #cbd5e1", boxSizing: "border-box", boxShadow: "0 6px 20px rgba(15,23,42,0.1)", display: "flex", flexDirection: "column" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 148, background: ID_CARD_HEADER_GRADIENT, transform: "skewY(-2.5deg)", transformOrigin: "top left" }} />
        <div style={{ position: "relative", zIndex: 1, flexShrink: 0, display: "flex", alignItems: "flex-start", gap: 12, paddingTop: 16, paddingLeft: 16, paddingRight: 16 }}>
          <div style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 16, overflow: "hidden", background: "#fff", border: "3px solid rgba(255,255,255,0.5)", boxShadow: "0 2px 10px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={schoolOrBrandLogo(settings.logo)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.3, textShadow: "0 1px 3px rgba(0,0,0,0.35)", fontFamily: UI.fontHeading }}>{settings.schoolName || "School"}</div>
            {(settings.institutionAddress || "").trim() && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.96)", marginTop: 3, lineHeight: 1.35 }}>{settings.institutionAddress.trim()}</div>}
            {(settings.schoolCode || "").trim() && <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginTop: 5, letterSpacing: "0.04em", textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}>{(settings.schoolCode || "").trim()}</div>}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "stretch", padding: "10px 16px 8px", gap: 10, position: "relative", zIndex: 2 }}>
          <div
            style={{
              width: ID_CARD_PHOTO_W,
              maxWidth: ID_CARD_PHOTO_W,
              height: ID_CARD_PHOTO_H,
              alignSelf: "center",
              borderRadius: ID_CARD_PHOTO_R,
              overflow: "hidden",
              border: "4px solid " + ID_CARD_PHOTO_RING,
              boxShadow: "0 4px 16px rgba(15,23,42,0.18)",
              background: "#e2e8f0",
              boxSizing: "border-box",
            }}
          >
            {student.photo ? <img src={student.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 20%", display: "block" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: C.gray }}>👤</div>}
          </div>
          <div style={{ position: "relative", zIndex: 1, flexShrink: 0, background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 2px 12px rgba(15,23,42,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <tbody>
              <tr><td style={{ padding: "7px 11px", borderBottom: "1px solid #e5e7eb", color: C.gray, width: "38%" }}>Name:</td><td style={{ padding: "7px 11px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, color: ID_CARD_CHARCOAL }}>{fullName}</td></tr>
              <tr><td style={{ padding: "7px 11px", borderBottom: "1px solid #e5e7eb", color: C.gray }}>Father Name:</td><td style={{ padding: "7px 11px", borderBottom: "1px solid #e5e7eb", color: ID_CARD_CHARCOAL }}>{fatherName}</td></tr>
              <tr><td style={{ padding: "7px 11px", borderBottom: "1px solid #e5e7eb", color: C.gray }}>Form-B:</td><td style={{ padding: "7px 11px", borderBottom: "1px solid #e5e7eb", color: ID_CARD_CHARCOAL }}>{idValue}</td></tr>
              <tr><td style={{ padding: "7px 11px", borderBottom: "1px solid #e5e7eb", color: C.gray }}>D.O.B:</td><td style={{ padding: "7px 11px", borderBottom: "1px solid #e5e7eb", color: ID_CARD_CHARCOAL }}>{formatDob(student.dob)}</td></tr>
              <tr><td style={{ padding: "7px 11px", borderBottom: "1px solid #e5e7eb", color: C.gray }}>Class:</td><td style={{ padding: "7px 11px", borderBottom: "1px solid #e5e7eb", color: ID_CARD_CHARCOAL }}>{clsName}</td></tr>
              <tr><td style={{ padding: "7px 11px", color: C.gray }}>Validity:</td><td style={{ padding: "7px 11px", color: ID_CARD_CHARCOAL }}>{validity}</td></tr>
            </tbody>
          </table>
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1, flexShrink: 0, textAlign: "center", padding: "8px 0 12px", fontSize: 17, fontWeight: 800, color: ID_CARD_CHARCOAL, letterSpacing: "0.08em" }}>STUDENT</div>
      </div>
    );
  }

  function StudentCardBack({ student, clsName }) {
    const principal = (settings.principalName || "").trim() || "Principal";
    const schoolName = settings.schoolName || "School";
    const schoolCode = (settings.schoolCode || "").trim() || "";
    const contactNo = (student.whatsapp || "").trim() || (settings.schoolPhoneNo || "").trim() || "—";
    const schoolAddr = (settings.institutionAddress || "").trim();
    return (
      <div className="student-id-card-back" style={{ position: "relative", width: "100%", maxWidth: ID_CARD_MAX_W, height: ID_CARD_FIXED_H, minHeight: ID_CARD_MIN_H, background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #cbd5e1", boxSizing: "border-box", boxShadow: "0 6px 20px rgba(15,23,42,0.1)", display: "flex", flexDirection: "column" }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 46, height: "100%", background: ID_CARD_CHARCOAL, zIndex: 1 }} />
        <div style={{ position: "absolute", top: "22%", right: 10, transform: "rotate(-90deg)", transformOrigin: "center", color: "#fff", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", zIndex: 2, maxWidth: 320 }}>{schoolName}</div>
        <div style={{ position: "absolute", bottom: "18%", right: 10, transform: "rotate(-90deg)", transformOrigin: "center", color: ID_CARD_STRIP_GOLD, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", zIndex: 2, letterSpacing: "0.06em" }}>{schoolCode || "—"}</div>
        <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", minHeight: 0, padding: "18px 16px 12px", marginRight: 46 }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: ID_CARD_CHARCOAL, marginBottom: 8 }}>Terms & Conditions</div>
            <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 10, color: C.gray, lineHeight: 1.6 }}>
              <li>This card is property of the institution and must be returned on leaving.</li>
              <li>Card must be shown on demand to authorized personnel.</li>
              <li>Loss or damage must be reported immediately.</li>
            </ul>
            <div style={{ fontSize: 10, color: C.gray, lineHeight: 1.7, marginBottom: 12 }}>
              {schoolAddr ? (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}><span style={{ color: "#e11d48", flexShrink: 0 }}>📍</span> <span>{schoolAddr}</span></div>
              ) : null}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: schoolAddr ? 6 : 4 }}><span style={{ color: "#e11d48" }}>📞</span> <span>{contactNo}</span></div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: C.gray, marginBottom: 4 }}>Signature Authority</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: ID_CARD_CHARCOAL }}>{principal}</div>
              <div style={{ width: 100, height: 24, marginTop: 4, borderBottom: "1px solid #9ca3af", fontSize: 9, color: "#6b7280" }}>Signature</div>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 8 }} />
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 8 }}>
            <StudentQRCode student={student} clsName={clsName} settings={settings} />
            <div style={{ textAlign: "center", fontSize: 8, color: C.gray, marginTop: 6 }}>Scan for full profile</div>
          </div>
        </div>
      </div>
    );
  }

  function StudentCard({ student }) {
    const clsName = className(student.classId);
    return (
      <div
        className="student-card-pair"
        style={{
          pageBreakInside: "avoid",
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 14,
          alignItems: "flex-start",
          justifyContent: "center",
          padding: 14,
          borderRadius: 16,
          background: "#e2e8f0",
          boxShadow: "0 10px 28px rgba(15,23,42,0.14)",
        }}
      >
        <StudentCardFront student={student} />
        <StudentCardBack student={student} clsName={clsName} />
      </div>
    );
  }

  const STUDENT_CARD_WIDTH_MM = 2.4 * 25.4;
  const STUDENT_CARD_HEIGHT_MM = 3.5 * 25.4;

  const handleDownloadPdf = async () => {
    if (!cardContainerRef.current || cardsToRender.length === 0 || downloading) return;
    try {
      setDownloading(true);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const boxWidth = STUDENT_CARD_WIDTH_MM;
      const boxHeight = STUDENT_CARD_HEIGHT_MM;
      const boxX = (pageWidth - boxWidth) / 2;
      const boxY = (pageHeight - boxHeight) / 2;

      const pairs = Array.from(cardContainerRef.current.querySelectorAll(".student-card-pair"));
      if (!pairs.length) {
        alert("No cards to export.");
        return;
      }

      for (let i = 0; i < pairs.length; i++) {
        const el = pairs[i];
        const canvas = await html2canvas(el, {
          scale: 3,
          backgroundColor: "#ffffff",
          useCORS: true,
        });
        const imgData = canvas.toDataURL("image/png");
        const imgWidthPx = canvas.width;
        const imgHeightPx = canvas.height;
        const ratio = Math.min(boxWidth / imgWidthPx, boxHeight / imgHeightPx);
        const imgWidth = imgWidthPx * ratio;
        const imgHeight = imgHeightPx * ratio;
        const x = boxX + (boxWidth - imgWidth) / 2;
        const y = boxY + (boxHeight - imgHeight) / 2;

        if (i > 0) doc.addPage();
        doc.addImage(imgData, "PNG", x, y, imgWidth, imgHeight);
      }

      const clsPart = (className(selCls) || selCls || "Class").replace(/\s+/g, "_");
      const sessionPart = (currentSession || "").toString().replace(/\s+/g, "_");
      const filename = `Student_Cards_${clsPart}${sessionPart ? "_" + sessionPart : ""}.pdf`;
      doc.save(filename);
    } catch (e) {
      console.error(e);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: C.gray, marginBottom: 14 }}>
        Generate student ID cards <strong>on demand</strong>: pick a class, then enter roll number(s) and/or admission number(s). At least one of roll or admission is required. Roll supports lists and ranges (e.g. 1,3,5-10); multiple admission numbers are comma-separated.
      </p>
      <div className="no-print" style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Sel
          label="Class"
          value={selCls}
          onChange={setSelCls}
          options={settings.classes.map((c) => ({ value: c.id, label: formatClassDisplay(c) }))}
        />
        <Inp
          label="Roll No(s)"
          value={singleRoll}
          onChange={setSingleRoll}
          placeholder="e.g. 1,3,5-10 or roll text"
        />
        <Inp
          label="Admission No(s)"
          value={singleAdm}
          onChange={setSingleAdm}
          placeholder="Comma-separated, exact match"
        />
        <Btn
          outline
          onClick={handleDownloadPdf}
          disabled={cardsToRender.length === 0 || downloading}
        >
          {downloading ? "⏳ Preparing PDF..." : "📄 Download cards PDF"}
        </Btn>
      </div>
      {!settings.classes?.length ? (
        <div style={{ padding: 24, textAlign: "center", color: C.gray, background: "#f9fafb", borderRadius: 8 }}>Add at least one class in Settings before generating student cards.</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: C.gray, background: "#f9fafb", borderRadius: 8 }}>No students in the selected class. Add students in Student Record (Examination → Student Record) or choose another class.</div>
      ) : selectionHintEmpty ? (
        <div style={{ padding: 24, textAlign: "center", color: C.gray, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, lineHeight: 1.5 }}>
          Choose a class, then enter <strong>roll number(s)</strong> and/or <strong>admission number(s)</strong> to load cards on demand. Roll supports ranges (e.g. <code style={{ fontSize: 12 }}>1,3,5-10</code>); admission numbers are comma-separated (exact match).
        </div>
      ) : cardsToRender.length === 0 && needsSelection ? (
        <div style={{ padding: 24, textAlign: "center", color: C.red, background: "#fef2f2", borderRadius: 8 }}>
          No student matched in this class for the roll / admission criteria you entered. Check values and try again.
        </div>
      ) : (
        <div ref={cardContainerRef} className="student-cards-print-area" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 680px), 1fr))", gap: 20 }}>
          {cardsToRender.map((s) => (
            <StudentCard key={s.id} student={s} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── STAFF CARD GENERATOR (two-sided, QR = full profile) ──────────────────────
// Physical size for staff ID card when exported to PDF (in mm)
export const STAFF_CARD_WIDTH_MM = 2.4 * 25.4;  // ≈ 60.96mm
export const STAFF_CARD_HEIGHT_MM = 3.5 * 25.4; // ≈ 88.90mm

export function StaffCardGeneratorPage({ settings = {}, staffProfiles = [] }) {
  const safeProfiles = Array.isArray(staffProfiles) ? staffProfiles : [];
  const [staffNameQuery, setStaffNameQuery] = useState("");
  const cardContainerRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const profilesToRender = useMemo(() => {
    const q = staffNameQuery.trim();
    if (!q) return [];
    const parts = q
      .split(/[,،]+/)
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    if (!parts.length) return [];
    return safeProfiles.filter((p) => {
      const n = String(p.name || "").toLowerCase();
      return parts.some((part) => n.includes(part));
    });
  }, [safeProfiles, staffNameQuery]);

  const handleDownloadPdf = async () => {
    if (!cardContainerRef.current || profilesToRender.length === 0 || downloading) return;
    try {
      setDownloading(true);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const boxWidth = STAFF_CARD_WIDTH_MM;
      const boxHeight = STAFF_CARD_HEIGHT_MM;
      const boxX = (pageWidth - boxWidth) / 2;
      const boxY = (pageHeight - boxHeight) / 2;
      const pairs = Array.from(cardContainerRef.current.querySelectorAll(".staff-card-pair"));

      for (let i = 0; i < pairs.length; i++) {
        const el = pairs[i];
        // Render each front+back pair as a single colourful page
        const canvas = await html2canvas(el, {
          scale: 3,
          backgroundColor: "#ffffff",
          useCORS: true,
        });
        const imgData = canvas.toDataURL("image/png");
        const imgWidthPx = canvas.width;
        const imgHeightPx = canvas.height;
        const ratio = Math.min(boxWidth / imgWidthPx, boxHeight / imgHeightPx);
        const imgWidth = imgWidthPx * ratio;
        const imgHeight = imgHeightPx * ratio;
        const x = boxX + (boxWidth - imgWidth) / 2;
        const y = boxY + (boxHeight - imgHeight) / 2;

        if (i > 0) doc.addPage();
        doc.addImage(imgData, "PNG", x, y, imgWidth, imgHeight);
      }

      const namePart = staffNameQuery
        .trim()
        .slice(0, 40)
        .replace(/[^\w-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
      doc.save(namePart ? `Staff_Cards_${namePart}.pdf` : "staff-id-cards.pdf");
    } catch (e) {
      console.error(e);
      try {
        alert("Sorry, something went wrong while creating the PDF.");
      } catch {}
    } finally {
      setDownloading(false);
    }
  };

  function StaffCardFront({ profile }) {
    const qual = [profile.aq, profile.subj, profile.pq].filter(Boolean).join(", ") || "—";
    const idNumber = staffFormatCNIC(profile.cnic) || "—";
    const workingSince = profile.doe ? staffDateToDDMMYYYY(profile.doe) : "—";
    const fullName = toProperCase(profile.name || "") || "—";
    return (
      <div className="staff-id-card-front" style={{ position: "relative", width: "100%", maxWidth: ID_CARD_MAX_W, height: ID_CARD_FIXED_H, minHeight: ID_CARD_MIN_H, background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #cbd5e1", boxSizing: "border-box", boxShadow: "0 6px 20px rgba(15,23,42,0.1)", display: "flex", flexDirection: "column" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 148, background: ID_CARD_HEADER_GRADIENT, transform: "skewY(-2.5deg)", transformOrigin: "top left" }} />
        <div style={{ position: "relative", zIndex: 1, flexShrink: 0, display: "flex", alignItems: "flex-start", gap: 12, paddingTop: 16, paddingLeft: 16, paddingRight: 16 }}>
          <div style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 16, overflow: "hidden", background: "#fff", border: "3px solid rgba(255,255,255,0.5)", boxShadow: "0 2px 10px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={schoolOrBrandLogo(settings.logo)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.3, textShadow: "0 1px 3px rgba(0,0,0,0.35)", fontFamily: UI.fontHeading }}>{settings.schoolName || "School"}</div>
            {(settings.institutionAddress || "").trim() && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.96)", marginTop: 3, lineHeight: 1.35 }}>{settings.institutionAddress.trim()}</div>}
            {(settings.schoolCode || "").trim() && <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginTop: 5, letterSpacing: "0.04em", textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}>{(settings.schoolCode || "").trim()}</div>}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "stretch", padding: "10px 16px 8px", gap: 10, position: "relative", zIndex: 2 }}>
          <div
            style={{
              width: ID_CARD_PHOTO_W,
              maxWidth: ID_CARD_PHOTO_W,
              height: ID_CARD_PHOTO_H,
              alignSelf: "center",
              borderRadius: ID_CARD_PHOTO_R,
              overflow: "hidden",
              border: "4px solid " + ID_CARD_PHOTO_RING,
              boxShadow: "0 4px 16px rgba(15,23,42,0.18)",
              background: "#e2e8f0",
              boxSizing: "border-box",
            }}
          >
            {profile.photo ? <img src={profile.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: profile.photoPosition || "50% 20%", display: "block" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: C.gray }}>👤</div>}
          </div>
          <div style={{ position: "relative", zIndex: 1, flexShrink: 0, background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 2px 12px rgba(15,23,42,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <tbody>
              <tr><td style={{ padding: "7px 11px", borderBottom: "1px solid #e5e7eb", color: C.gray, width: "38%" }}>Name:</td><td style={{ padding: "7px 11px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, color: ID_CARD_CHARCOAL }}>{fullName}</td></tr>
              <tr><td style={{ padding: "7px 11px", borderBottom: "1px solid #e5e7eb", color: C.gray }}>Qualification:</td><td style={{ padding: "7px 11px", borderBottom: "1px solid #e5e7eb", color: ID_CARD_CHARCOAL }}>{qual}</td></tr>
              <tr><td style={{ padding: "7px 11px", borderBottom: "1px solid #e5e7eb", color: C.gray }}>ID Number:</td><td style={{ padding: "7px 11px", borderBottom: "1px solid #e5e7eb", color: ID_CARD_CHARCOAL }}>{idNumber}</td></tr>
              <tr><td style={{ padding: "7px 11px", color: C.gray }}>Working Since:</td><td style={{ padding: "7px 11px", color: ID_CARD_CHARCOAL }}>{workingSince}</td></tr>
            </tbody>
          </table>
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1, flexShrink: 0, textAlign: "center", padding: "8px 0 12px", fontSize: 17, fontWeight: 800, color: ID_CARD_CHARCOAL, letterSpacing: "0.08em" }}>TEACHER</div>
      </div>
    );
  }

  function StaffCardBack({ profile }) {
    const homeAddress = (profile.address || "").trim() || "—";
    const contactNo = staffFormatPhone(profile.contact) || (profile.contact || "").trim() || "—";
    const principal = (settings.principalName || "").trim() || "Principal";
    const schoolName = settings.schoolName || "School";
    const schoolCode = (settings.schoolCode || "").trim() || "";
    return (
      <div className="staff-id-card-back" style={{ position: "relative", width: "100%", maxWidth: ID_CARD_MAX_W, height: ID_CARD_FIXED_H, minHeight: ID_CARD_MIN_H, background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #cbd5e1", boxSizing: "border-box", boxShadow: "0 6px 20px rgba(15,23,42,0.1)", display: "flex", flexDirection: "column" }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 46, height: "100%", background: ID_CARD_CHARCOAL, zIndex: 1 }} />
        <div style={{ position: "absolute", top: "22%", right: 10, transform: "rotate(-90deg)", transformOrigin: "center", color: "#fff", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", zIndex: 2, maxWidth: 320 }}>{schoolName}</div>
        <div style={{ position: "absolute", bottom: "18%", right: 10, transform: "rotate(-90deg)", transformOrigin: "center", color: ID_CARD_STRIP_GOLD, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", zIndex: 2, letterSpacing: "0.06em" }}>{schoolCode || "—"}</div>
        <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", minHeight: 0, padding: "18px 16px 12px", marginRight: 46 }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: ID_CARD_CHARCOAL, marginBottom: 8 }}>Terms & Conditions</div>
            <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 10, color: C.gray, lineHeight: 1.6 }}>
              <li>This card is property of the institution and must be returned on leaving service.</li>
              <li>Card must be shown on demand to authorized personnel.</li>
              <li>Loss or damage must be reported immediately.</li>
            </ul>
            <div style={{ fontSize: 10, color: C.gray, lineHeight: 1.7, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}><span style={{ color: "#e11d48", flexShrink: 0 }}>📍</span> <span>{homeAddress}</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}><span style={{ color: "#e11d48" }}>📞</span> <span>{contactNo}</span></div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: C.gray, marginBottom: 4 }}>Signature Authority</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: ID_CARD_CHARCOAL }}>{principal}</div>
              <div style={{ width: 100, height: 24, marginTop: 4, borderBottom: "1px solid #9ca3af", fontSize: 9, color: "#6b7280" }}>Signature</div>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 8 }} />
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 8 }}>
            <StaffQRCode profile={profile} settings={settings} />
            <div style={{ textAlign: "center", fontSize: 8, color: C.gray, marginTop: 6 }}>Scan for full profile</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: C.gray, marginBottom: 14 }}>
        Generate staff ID cards <strong>on demand</strong>: enter a staff name or several names separated by commas. Matching uses the name in Staff Profiles (partial match, case-insensitive). PDF includes only the people that match.
      </p>
      <div className="no-print" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 18, alignItems: "flex-end" }}>
        <Inp
          label="Staff name(s)"
          value={staffNameQuery}
          onChange={setStaffNameQuery}
          placeholder="e.g. Ali or Ali, Sara Khan"
          width={280}
        />
        <Btn outline onClick={handleDownloadPdf} disabled={profilesToRender.length === 0 || downloading}>
          {downloading ? "⏳ Preparing PDF..." : "📄 Download cards PDF"}
        </Btn>
      </div>
      {safeProfiles.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: C.gray, background: "#f9fafb", borderRadius: 8 }}>No staff profiles. Add profiles in Staff Profiles first.</div>
      ) : !staffNameQuery.trim() ? (
        <div style={{ padding: 24, textAlign: "center", color: C.gray, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, lineHeight: 1.5 }}>
          Type a <strong>staff name</strong> above to load matching cards. Use commas to match several people (e.g. <code style={{ fontSize: 12 }}>Ali, Sara</code>) — each part is matched against the full name.
        </div>
      ) : profilesToRender.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: C.red, background: "#fef2f2", borderRadius: 8 }}>No staff profile matched that name. Check spelling or Staff Profiles (Settings).</div>
      ) : (
        <div ref={cardContainerRef} className="staff-cards-print-area" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 680px), 1fr))", gap: 20 }}>
          {profilesToRender.map((p) => (
            <div
              key={p.id}
              className="staff-card-pair"
              style={{
                pageBreakInside: "avoid",
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 14,
                alignItems: "flex-start",
                justifyContent: "center",
                padding: 14,
                borderRadius: 16,
                background: "#e2e8f0",
                boxShadow: "0 10px 28px rgba(15,23,42,0.14)",
              }}
            >
              <StaffCardFront profile={p} />
              <StaffCardBack profile={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CARD GENERATOR (merged Student + Staff) ───────────────────────────────────
export const CARD_TABS =[{id:"staff",label:"Staff Cards",i:"🪪"},{id:"student",label:"Student Cards",i:"💳"}];
export function CardGeneratorPage({settings,students,currentSession,staffProfiles,setBarSubtitle}){
  const [cardTab,setCardTab]=useState("staff");
  useEffect(()=>{
    if(!setBarSubtitle) return;
    const t=CARD_TABS.find(x=>x.id===cardTab);
    setBarSubtitle(t?.label||"");
  },[cardTab,setBarSubtitle]);
  return <div>
    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      <Tabs value={cardTab} onValueChange={setCardTab}>
        <TabsList className="h-auto flex-wrap">
          {CARD_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              <span className="mr-1.5">{t.i}</span>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
    {cardTab==="student"&&<StudentCardGeneratorPage settings={settings} students={students} currentSession={currentSession}/>}
    {cardTab==="staff"&&<StaffCardGeneratorPage settings={settings} staffProfiles={staffProfiles}/>}
  </div>;
}
