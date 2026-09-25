import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, startTransition } from "react";
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

// ─── DEFAULT DATA ─────────────────────────────────────────────────────────────
const defaultSettings = {
  schoolName: "",
  principalName: "",
  schoolCode: "",
  logo: null,
  banner: null,
  /** Data URL for headmaster signature on result cards; null uses bundled default image */
  resultCardSignature: null,
  /** Optional override; if empty, Principal / Headmaster name is used */
  resultCardStampLine1: "",
  /** Optional second line under signature; if empty, school name is used */
  resultCardStampLine2: "",
  institutionName: "",
  institutionAddress: "",
  ddoCode: "",
  na: "",
  ppNo: "",
  uc: "",
  tehsil: "",
  schoolPhoneNo: "",
  forTheMonth: "",
  schoolType: "",
  schoolLevel: "",
  genderCategory: "",
  schoolShift: "",
  schoolEmail: "",
  estDate: "",
  province: "",
  district: "",
  ruralUrban: "",
  ward: "",
  mauza: "",
  lat: "",
  lng: "",
  principalMobile: "",
  principalEmail: "",
  principalDesignation: "",
  principalQualification: "",
  principalJoinDate: "",
  classes: [],
  classSubjects: {},
  classSubjectsExam: {},
  classSubjectsTimetable: {},
  staff: [],
  commonTeachers: {},
  schoolHours: {
    mondayToThursday: { start:"08:30", end:"13:30" },
    friday:           { start:"08:30", end:"12:00" },
    saturday:         { start:"08:30", end:"13:00" },
  },
  assemblyTime: 15,
  firstPeriodTime: 40,
  otherPeriodTime: 30,
  periodsPerDay: 8,
  breakRequired: true,
  breakAfterPeriod: 5,
  breakDuration: 25,
  fridayBreak: false,
  fridayBreakAfter: 5,
  fridayBreakDuration: 0,
  periodLabelPrefix: "P-",
  passPercent: 50,
};

const defaultStudents = [];

class ExaminationErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("ExaminationErrorBoundary", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, background: "#fef2f2", borderRadius: 8, border: "1px solid rgb(128, 77, 77)", maxWidth: 560 }}>
          <h3 style={{ margin: "0 0 8px", color: "#b91c1c" }}>Something went wrong on the Examination page</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#7f1d1d" }}>{String(this.state.error?.message || this.state.error)}</p>
          <button type="button" onClick={() => this.setState({ hasError: false, error: null })} style={{ marginTop: 12, padding: "8px 16px", background: "#b91c1c", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

class AppErrorBoundary extends React.Component {
  state = { hasError: false, error: null, errorInfo: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) {
    console.error("AppErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, background: "#fef2f2", borderRadius: 8, border: "1px solid rgb(185, 28, 28)", maxWidth: 600, margin: "20px auto" }}>
          <h3 style={{ margin: "0 0 8px", color: "#b91c1c" }}>Something went wrong</h3>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#7f1d1d" }}>
            {String(this.state.error?.message || this.state.error)}
          </p>
          <details style={{ marginBottom: 12 }}>
            <summary style={{ cursor: "pointer", fontSize: 12, color: "#7f1d1d" }}>Error Details</summary>
            <pre style={{ fontSize: 11, color: "#7f1d1d", marginTop: 8, whiteSpace: "pre-wrap", overflow: "auto" }}>
              {this.state.error?.stack}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginRight: 8, padding: "8px 16px", background: "#b91c1c", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
          >
            Reload Page
          </button>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            style={{ padding: "8px 16px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


// ─── PRINT STYLES ─────────────────────────────────────────────────────────────
const PRINT_CSS=[
  "@media print {",
  "  @page{size:A4 portrait;margin:8mm}",
  "  @page landscape{size:A4 landscape;margin:8mm}",
  "  @page paperPortrait{size:A4 portrait;margin:0.5mm}",
  "  @page resultCard{size:A4 portrait;margin:0.5mm}",
  "  .app-sidebar,.app-right-sidebar,.app-header,.auth-topbar,.admin-topbar,.mobile-menu-btn,.mobile-menu-backdrop,.mobile-menu-panel{display:none!important;visibility:hidden!important}",
  "  #print-section .timetable-print-area{page:landscape}",
  "  #print-section .timetable-print-area .print-header-universal{margin-bottom:10px}",
  "  #print-section .timetable-print-area .timetable-main-content{margin:0;padding:0}",
  "  #print-section .all-classes-batch-print,#print-section .all-teachers-batch-print{page:landscape;width:281mm!important;max-width:100%!important;min-height:0;box-sizing:border-box}",
  "  #print-section .all-classes-batch-print > div,#print-section .all-teachers-batch-print > div{page:landscape;max-width:281mm!important;box-sizing:border-box!important}",
  "  #print-section .all-classes-batch-print table,#print-section .all-teachers-batch-print table{width:100%!important;max-width:100%!important;table-layout:fixed!important}",
  "  body.printing-all-classes-portion,body.printing-all-classes,body.printing-by-class-single,body.printing-teachers-portion{page:landscape}",
  "  html:has(body.printing-all-classes-portion),html:has(body.printing-all-classes),html:has(body.printing-by-class-single),html:has(body.printing-teachers-portion){page:landscape}",
  "  body.printing-by-class-single #print-section .by-class-single{page:landscape}",
  "  body.printing-all-teachers #print-section .by-teacher-single{display:none!important}",
  "  body.printing-teachers-portion #print-section .timetable-main-content{display:none!important}",
  "  body.printing-teachers-portion #print-section .teachers-portion-print{display:block!important;visibility:visible!important;page:landscape;width:281mm!important;max-width:100%!important;min-height:0;box-sizing:border-box}",
  "  body.printing-teachers-portion #print-section .teachers-portion-print *{visibility:visible!important}",
  "  body.printing-teachers-portion #print-section .teachers-portion-print table{width:100%!important;max-width:100%!important;table-layout:fixed!important}",
  "  body.printing-all-classes #print-section .by-class-single{display:none!important}",
  "  body.printing-all-classes #print-section .by-class-print-all{page:landscape}",
  "  body.printing-all-classes #print-section .by-class-print-all > div{page:landscape}",
  "  body.printing-all-classes-portion #print-section .timetable-main-content{display:none!important}",
  "  body.printing-all-classes-portion #print-section .all-classes-portion-print{display:block!important;visibility:visible!important;page:landscape}",
  "  body.printing-all-classes-portion #print-section .all-classes-portion-print *{visibility:visible!important}",
  "  body.printing-all-classes #print-section .by-class-print-all,",
  "  body.printing-all-classes-portion #print-section .all-classes-portion-print{",
  "    width:281mm!important;max-width:100%!important;min-height:0;box-sizing:border-box;",
  "  }",
  "  body.printing-all-classes #print-section .by-class-print-all table,",
  "  body.printing-all-classes-portion #print-section .all-classes-portion-print table{",
  "    width:100%!important;max-width:100%!important;table-layout:fixed!important;",
  "  }",
  "  body.printing-all-classes #print-section .by-class-print-all > div{",
  "    max-width:281mm!important;box-sizing:border-box!important;",
  "  }",
  "  body *{visibility:hidden}",
  "  html,body{overflow:hidden!important;height:auto!important;min-height:auto!important}",
  "  #print-section,#print-section *{visibility:visible}",
  "  #print-section{position:absolute;top:0;left:0;width:100%;max-width:297mm;padding:0;box-sizing:border-box;overflow:visible!important;height:auto!important;max-height:none!important}",
  "  #print-section .timetable-print-area,#print-section .timetable-print-area *,#print-section .timetable-main-content{overflow:visible!important;max-height:none!important}",
  "  #print-section .timetable-main-content>div{overflow:visible!important}",
  "  .no-print,.app-sidebar,.app-right-sidebar,.app-header,.auth-topbar,.admin-topbar,.timetable-toolbar{display:none!important}",
  "  #print-section .student-id-card{page-break-inside:avoid!important;width:88.9mm!important;height:60.96mm!important;display:flex!important;align-items:center!important;justify-content:center!important;margin:6mm auto!important}",
  "  #print-section .student-cards-print-area{display:grid!important;grid-template-columns:1fr!important;gap:16px!important}",
  "  #print-section .student-card-pair{display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;align-items:flex-start!important;justify-content:center!important;gap:12px!important;page-break-inside:avoid!important}",
  "  #print-section .staff-id-card-front,#print-section .staff-id-card-back{page-break-inside:avoid!important}",
  "  #print-section .staff-cards-print-area{display:grid!important;grid-template-columns:1fr!important;gap:16px!important}",
  "  #print-section .staff-card-pair{display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;align-items:flex-start!important;justify-content:center!important;gap:12px!important;page-break-inside:avoid!important}",
  "  #print-section .print-only{display:block!important;visibility:visible!important}",
  "  #print-section .timetable-print-area > .print-only{display:block!important;visibility:visible!important}",
  "  #print-section .print-header-universal{background:#fafbfc!important;padding:14px 20px!important;border-bottom:2px solid #1a3a6b!important}",
  "  #print-section table{border-collapse:collapse;border:1px solid #cbd5e1;width:100%;font-size:11px}",
  "  #print-section thead th{background:#1a3a6b!important;color:#fff!important;border:1px solid #1e3a5f!important;padding:8px 10px!important;font-weight:600!important;text-align:left}",
  "  #print-section th,#print-section td{border:1px solid #cbd5e1!important;padding:6px 10px!important}",
  "  #print-section tbody td{border-color:#e2e8f0!important}",
  "  #print-section tbody tr:nth-child(even){background:#f8fafc!important}",
  "  #print-section tbody tr:nth-child(odd){background:#fff!important}",
  "  #print-section .datesheet-table input,",
  "  #print-section .datesheet-table select{",
  "    border:none!important;",
  "    background:transparent!important;",
  "    box-shadow:none!important;",
  "    -webkit-appearance:none!important;",
  "    appearance:none!important;",
  "    padding:0!important;",
  "  }",
  "  #print-section .datesheet-table select option{background:#fff;color:#000}",
  "  #print-section .tt-empty-plus{display:none!important}",
  "  body.printing-paper #print-section *{visibility:hidden!important}",
  "  body.printing-paper #print-section .paper-print-only,body.printing-paper #print-section .paper-print-only *{visibility:visible!important}",
  "  body.printing-paper #print-section .paper-print-only{position:static!important;left:0!important;display:block!important;width:100%!important;max-width:186mm;margin:0 auto;padding:0;box-sizing:border-box;page:paperPortrait}",
  "  body.printing-paper #print-section .paper-print-only *{box-sizing:border-box}",
  "  body.printing-paper #print-section .paper-print-only .paper-section{page-break-inside:avoid}",
  "  body.printing-result-cards #print-section *{visibility:hidden!important}",
  "  body.printing-result-cards #print-section .result-card-print-area,body.printing-result-cards #print-section .result-card-print-area *{visibility:visible!important}",
  "  body.printing-result-cards #print-section .result-card-print-area{display:block!important;position:static!important;left:0!important;width:100%!important;max-width:100%!important;padding:0!important;margin:0!important}",
  "  body.printing-result-cards #print-section .result-card-print-area.print-only{display:block!important}",
  "  body.printing-result-cards #print-section .result-card-doc-header{page-break-inside:avoid!important}",
  "  body.printing-result-cards #print-section .result-card-page-wrap{break-inside:avoid!important;page-break-inside:avoid!important}",
  "  body.printing-result-cards #print-section .result-card-capture-root{break-inside:avoid!important;page-break-inside:avoid!important}",
  "  body.printing-result-cards #print-section .result-card-promo-banner{page-break-inside:avoid!important;break-inside:avoid!important;margin-top:10px!important;padding-top:8px!important}",
  "  body.printing-result-cards #print-section .result-card-promo-banner img{display:block!important;width:100%!important;max-width:100%!important;max-height:52mm!important;height:auto!important;object-fit:contain!important}",
  "  body.printing-result-cards-class #print-section .result-card-print-area:not(.print-only){visibility:hidden!important;display:none!important}",
  "  #print-section .students-record-print table th:last-child,#print-section .students-record-print table td:last-child{display:none!important}",
  "}"
].join("\n");

const MOBILE_CSS = [
  "/* Header hamburger: hide by default; never use inline display:none (breaks show rules in some engines). */",
  ".mobile-menu-btn{display:none!important}",
  ".app-page-timetable .timetable-print-area,.app-page-timetable .timetable-main-content{min-width:0;max-width:100%;box-sizing:border-box;}",
  ".app-page-timetable .timetable-main-content > div{max-width:100%;box-sizing:border-box;}",
  "@keyframes mobile-nav-drawer-in{from{transform:translateX(-100%);opacity:0.9}to{transform:translateX(0);opacity:1}}",
  ".mobile-menu-backdrop{position:fixed;inset:0;background:rgba(15,23,42,0.45);z-index:10000;-webkit-tap-highlight-color:transparent}",
  ".mobile-menu-panel{position:fixed;top:0;left:0;bottom:0;width:min(300px,88vw);max-width:100vw;background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);color:#f9fafb;z-index:10001;box-shadow:8px 0 32px rgba(0,0,0,0.35);display:flex;flex-direction:column;overflow:hidden;padding-bottom:env(safe-area-inset-bottom,0);animation:mobile-nav-drawer-in 0.22s ease-out}",
  ".mobile-menu-panel .mobile-menu-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}",
  ".mobile-menu-panel .mobile-menu-header{padding:14px 14px 12px;border-bottom:1px solid rgba(148,163,184,0.35);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0;background:rgba(15,23,42,0.6)}",
  ".mobile-menu-panel nav{display:flex;flex-direction:column;padding:8px 0 12px}",
  ".mobile-menu-panel nav button{width:100%;padding:14px 16px;background:transparent;border:none;color:#e5e7eb;cursor:pointer;text-align:left;font-size:15px;display:flex;align-items:center;gap:12px;border-left:4px solid transparent;-webkit-tap-highlight-color:transparent}",
  ".mobile-menu-panel nav button.active{background:rgba(248,250,252,0.1);border-left-color:#fbbf24;color:#fff;font-weight:600}",
  ".mobile-menu-panel .mobile-menu-footer{padding:12px 16px;border-top:1px solid rgba(148,163,184,0.35);font-size:11px;opacity:0.9;line-height:1.45;flex-shrink:0;background:rgba(15,23,42,0.5)}",
  "@media (max-width:768px){",
  "  .app-topbar-grid{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto;align-items:center!important}",
  "  .app-topbar-left{grid-column:1;grid-row:1}",
  "  .app-topbar-right{display:none!important}",
  "  .app-topbar-center{display:none!important}",
  "  .app-topbar-brandtext{display:none!important}",
  "  .app-topbar-logo{width:40px!important;height:40px!important}",
  "  .app-body-row{flex-direction:column!important}",
  "  .app-sidebar{display:none!important}",
  "  .app-main{flex:1 1 100%!important;min-width:0;width:100%!important}",
  "  .mobile-menu-btn{display:flex!important;align-items:center!important;justify-content:center!important;width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}",
  "  .hide-on-mobile{display:none!important}",
  "}",
  "@media (max-width:1280px){",
  "  .app-page-timetable .app-sidebar{display:none!important}",
  "  .app-page-timetable .app-body-row{gap:4px!important}",
  "  .app-page-timetable .app-main{flex:1 1 auto!important;min-width:0!important;width:100%!important;max-width:100%!important}",
  "  .app-page-timetable #print-section{padding:8px max(4px, env(safe-area-inset-left)) 8px max(4px, env(safe-area-inset-right))!important;max-width:100%!important;box-sizing:border-box!important}",
  "  .app-page-timetable .mobile-menu-btn{display:flex!important;align-items:center!important;justify-content:center!important;width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;touch-action:manipulation!important}",
  "}"
].join("\n");

// ─── LOCAL PERSISTENCE ────────────────────────────────────────────────────────
const LOCAL_DATA_KEY = "system_management_local_data";
function loadFromLocal(){
  try {
    if(typeof window==="undefined") return null;
    const raw=window.localStorage.getItem(LOCAL_DATA_KEY);
    if(!raw) return null;
    const data=JSON.parse(raw);
    if(!data||!Array.isArray(data.schools)||data.schools.length===0) return null;
    const defaultDs=()=>({dates:[],cols:[],subs:{},note:""});
    const y=new Date().getFullYear(), mo=new Date().getMonth();
    const defSession=mo>=6 ? (y + "-" + (y+1)) : ((y-1) + "-" + y);
    const schools=data.schools.map(s=>{
      const hasBySession=s.exam_by_session&&typeof s.exam_by_session==="object"&&Object.keys(s.exam_by_session).length>0;
      const curSession=s.currentSession||defSession;
      const sessionsList=Array.isArray(s.sessions)&&s.sessions.length>0?s.sessions:[defSession];
      const examBySession=hasBySession?s.exam_by_session:{[defSession]:{exam_tm:s.exam_tm||{},exam_om:s.exam_om||{},exam_datesheet:s.exam_datesheet&&typeof s.exam_datesheet==="object"?s.exam_datesheet:defaultDs()}};
      const rawSettings = s.settings || defaultSettings;
      const mergedSettings = { ...defaultSettings, ...rawSettings };
      if ((mergedSettings.emisCode || "").trim() && !(mergedSettings.schoolCode || "").trim())
        mergedSettings.schoolCode = (mergedSettings.emisCode || "").trim();
      delete mergedSettings.emisCode;
      return {
        id:s.id||genId(),
        name:s.name||"School",
        settings: mergedSettings,
        students:dedupeStudentsByIdentity(Array.isArray(s.students)?s.students:defaultStudents,mergedSettings.classes||[]),
        staffProfiles:Array.isArray(s.staffProfiles)?s.staffProfiles:[],
        staffTransferHistory:Array.isArray(s.staffTransferHistory)?s.staffTransferHistory:[],
        retiredStaff:Array.isArray(s.retiredStaff)?s.retiredStaff:[],
        timetable:s.timetable&&typeof s.timetable==="object"?s.timetable:{},
        currentSession:curSession,
        sessions:sessionsList,
        exam_by_session:examBySession,
        exam_tm:s.exam_tm&&typeof s.exam_tm==="object"?s.exam_tm:{},
        exam_om:s.exam_om&&typeof s.exam_om==="object"?s.exam_om:{},
        exam_datesheet:s.exam_datesheet&&typeof s.exam_datesheet==="object"?s.exam_datesheet:defaultDs(),
        questionBank:s.questionBank&&typeof s.questionBank==="object"?s.questionBank:{},
        status:s.status==="stopped"||s.status==="deleted"?s.status:"active",
      };
    });
    schools.forEach(s=>{
      const suffix=(s.settings?.schoolCode||s.settings?.schoolName||"default").replace(/[^a-zA-Z0-9_-]/g,"_");
      try{
        if(s.exam_tm&&Object.keys(s.exam_tm).length) window.localStorage.setItem("exam_TM_"+suffix,JSON.stringify(s.exam_tm));
        if(s.exam_om&&Object.keys(s.exam_om).length) window.localStorage.setItem("exam_OM_"+suffix,JSON.stringify(s.exam_om));
      }catch{}
    });
    const visible=schools.filter(sc=>sc.status!=="deleted");
    let activeSchoolId=data.activeSchoolId&&schools.some(sc=>sc.id===data.activeSchoolId)?data.activeSchoolId:schools[0]?.id;
    if(activeSchoolId&&schools.find(sc=>sc.id===activeSchoolId)?.status==="deleted") activeSchoolId=visible[0]?.id||null;
    if(!activeSchoolId&&visible.length) activeSchoolId=visible[0].id;
    return { schools, activeSchoolId };
  } catch { return null; }
}
function saveToLocal(schools,activeSchoolId){
  try {
    if(typeof window==="undefined") return;
    const defDs=()=>({dates:[],cols:[],subs:{},note:""});
    const toSave=(schools||[]).map(s=>{
      const curSession=s.currentSession||defaultSession();
      const sessionData=s.exam_by_session&&typeof s.exam_by_session==="object"?s.exam_by_session[curSession]:null;
      const exam_tm=sessionData?.exam_tm&&typeof sessionData.exam_tm==="object"?sessionData.exam_tm:(s.exam_tm||{});
      const exam_om=sessionData?.exam_om&&typeof sessionData.exam_om==="object"?sessionData.exam_om:(s.exam_om||{});
      const exam_datesheet=sessionData?.exam_datesheet&&typeof sessionData.exam_datesheet==="object"?sessionData.exam_datesheet:(s.exam_datesheet&&typeof s.exam_datesheet==="object"?s.exam_datesheet:defDs());
      const cls=s.settings?.classes||[];
      const studentsClean=dedupeStudentsByIdentity(Array.isArray(s.students)?s.students:[],cls);
      return { id:s.id,name:s.name,settings:s.settings,students:studentsClean,staffProfiles:s.staffProfiles||[],staffTransferHistory:Array.isArray(s.staffTransferHistory)?s.staffTransferHistory:[],retiredStaff:Array.isArray(s.retiredStaff)?s.retiredStaff:[],timetable:s.timetable||{},exam_tm,exam_om,exam_datesheet,currentSession:s.currentSession,sessions:s.sessions,exam_by_session:s.exam_by_session,questionBank:s.questionBank&&typeof s.questionBank==="object"?s.questionBank:{},status:s.status==="stopped"||s.status==="deleted"?s.status:"active" };
    });
    window.localStorage.setItem(LOCAL_DATA_KEY,JSON.stringify({ schools:toSave, activeSchoolId:activeSchoolId||null }));
  } catch {}
}

// ─── AUTH (SIGN IN / SCHOOL REGISTRATION) ──────────────────────────────────────
const AUTH_USERS_KEY = "sms_auth_users";
const AUTH_SESSION_KEY = "sms_auth_session";
const ADMIN_EMAIL = "adfaizy1976@gmail.com";
const ADMIN_PASSWORD = "4527280";
function loadAuthUsers() {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(AUTH_USERS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveAuthUsers(users) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(Array.isArray(users) ? users : []));
  } catch {}
}
function loadAuthSession() {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && (s.userId || s.admin) ? s : null;
  } catch { return null; }
}
function saveAuthSession(session) {
  try {
    if (typeof window === "undefined") return;
    if (session) window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(AUTH_SESSION_KEY);
  } catch {}
}

function AuthScreen({ onSignIn, setActiveSchoolId }) {
  const [panel, setPanel] = useState("user"); // "user" | "admin"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inp = { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", outline: "none" };
  const lbl = { display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600, color: "#374151" };

  const handleSignIn = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    const emailNorm = String(email).trim().toLowerCase();
    let users = loadAuthUsers();
    let user = users.find(u => String(u.email || "").toLowerCase() === emailNorm);
    if (!user) { setError("No account found with this email."); setLoading(false); return; }
    if (user.blocked) { setError("This account has been blocked by the administrator."); setLoading(false); return; }
    const pwOk = await verifyPassword(password, user.password);
    if (!pwOk) { setError("Incorrect password."); setLoading(false); return; }
    saveAuthSession({ userId: user.id, schoolId: user.schoolId || null, userType: user.userType });
    setActiveSchoolId(user.schoolId || null);
    onSignIn({ userId: user.id, schoolId: user.schoolId || null, userType: user.userType });
    setLoading(false);
  };

  const handleAdminLogin = (e) => {
    e.preventDefault(); setError("");
    if (String(adminEmail).trim().toLowerCase() === ADMIN_EMAIL && String(adminPassword) === ADMIN_PASSWORD) {
      saveAuthSession({ admin: true });
      onSignIn({ admin: true });
    } else {
      setError("Invalid administrator credentials.");
    }
  };


  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)", padding: 16, fontFamily: UI.fontApp }}>
      {panel === "user" ? (
        <div style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 16, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.45)", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ background: "var(--color-navy,#1a3a6b)", color: "#fff", padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }}>
            <img src={APP_BRAND_LOGO} alt="" style={{ width: 80, height: 80, objectFit: "contain", flexShrink: 0, borderRadius: 8, background: "rgba(255,255,255,0.1)", padding: 4 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>Punjab School Management System</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Sign in with your account</div>
            </div>
          </div>
          <div style={{ padding: 24 }}>
            {error && <div style={{ padding: "10px 12px", marginBottom: 16, background: "#fef2f2", color: "#b91c1c", borderRadius: 8, fontSize: 13, border: "1px solid #fecaca" }}>{error}</div>}
            <form onSubmit={handleSignIn}>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required style={inp} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={inp} />
              </div>
              <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px 16px", border: "none", borderRadius: 8, background: "var(--color-navy,#1a3a6b)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
            <div style={{ marginTop: 16, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, fontSize: 12, color: "#64748b", textAlign: "center" }}>
              Accounts are created by the administrator. Contact your admin if you don't have access.
            </div>
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <button type="button" onClick={() => { setPanel("admin"); setError(""); }}
                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", padding: "6px 8px", borderRadius: 6 }}>
                🔐 Administrator Login
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 16, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.45)", overflow: "hidden" }}>
          <div style={{ background: "#1e293b", color: "#fff", padding: "20px 24px" }}>
            <button type="button" onClick={() => { setPanel("user"); setError(""); }}
              style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
              ← Back to User Login
            </button>
            <div style={{ fontWeight: 700, fontSize: 17 }}>Administrator Login</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Restricted access — authorised personnel only</div>
          </div>
          <div style={{ padding: 24 }}>
            {error && <div style={{ padding: "10px 12px", marginBottom: 16, background: "#fef2f2", color: "#b91c1c", borderRadius: 8, fontSize: 13, border: "1px solid #fecaca" }}>{error}</div>}
            <form onSubmit={handleAdminLogin}>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Admin Email</label>
                <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin email" required style={inp} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Admin Password</label>
                <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="••••••••" required style={inp} />
              </div>
              <button type="submit" style={{ width: "100%", padding: "12px 16px", border: "none", borderRadius: 8, background: "#1e293b", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                Login as Administrator
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN (ALL REGISTERED SCHOOLS) ───────────────────────────────────────────
function AdminPage({ schools, setSchools, setSchoolStatus, onSignOut, onResetAll }) {
  const headerNow = useNowEverySecond();
  const [adminTab, setAdminTab] = useState("users"); // "users" | "schools" | "danger"
  const [usersList, setUsersList] = useState(() => loadAuthUsers());
  const refreshUsers = () => setUsersList(loadAuthUsers());
  // User management
  const [editUserId, setEditUserId] = useState(null);
  const [editNewPw, setEditNewPw] = useState("");
  const [editPwError, setEditPwError] = useState("");
  const [viewDetailsId, setViewDetailsId] = useState(null);
  // Create school form
  const [csName, setCsName] = useState("");
  const [csEmail, setCsEmail] = useState("");
  const [csAdminName, setCsAdminName] = useState("");
  const [csPassword, setCsPassword] = useState("");
  const [csError, setCsError] = useState("");
  const [csSuccess, setCsSuccess] = useState("");
  // Create school account (operator) form
  const [soName, setSoName] = useState("");
  const [soEmail, setSoEmail] = useState("");
  const [soPassword, setSoPassword] = useState("");
  const [soSchoolId, setSoSchoolId] = useState("");
  const [, setSoError] = useState("");
  const [, setSoSuccess] = useState("");
  const [resetSchoolBusyId, setResetSchoolBusyId] = useState(null);
  const [resetSchoolMsg, setResetSchoolMsg] = useState("");

  const buildClearedSchool = (school) => {
    const keepName = school?.settings?.schoolName || school?.name || "School";
    const keepCode = school?.settings?.schoolCode || "";
    const keepEmail = school?.settings?.schoolEmail || "";
    // Deep-clone defaults so we never keep stale class/subject maps from shared references.
    const baseSettings = JSON.parse(JSON.stringify(defaultSettings));
    return {
      ...school,
      settings: {
        ...baseSettings,
        schoolName: keepName,
        schoolCode: keepCode,
        schoolEmail: keepEmail,
        classes: [],
        classSubjects: {},
        classSubjectsExam: {},
        classSubjectsTimetable: {},
        commonTeachers: {},
        staff: [],
        students: [],
      },
      students: [],
      staffProfiles: [],
      staffTransferHistory: [],
      retiredStaff: [],
      timetable: {},
      exam_by_session: {},
      exam_tm: {},
      exam_om: {},
      exam_datesheet: { dates: [], cols: [], subs: {}, note: "" },
      questionBank: {},
    };
  };

  const handleResetSchool = async (school) => {
    if (!school?.id) return;
    const schoolName = school.settings?.schoolName || school.name || school.id;
    if (!window.confirm(`Reset "${schoolName}"? All classes, students, staff, timetable and exam data will be deleted.`)) return;
    setResetSchoolMsg("");
    setResetSchoolBusyId(school.id);
    const clearedSchool = buildClearedSchool(school);
    try {
      // Update local state first for immediate UI reflection.
      setSchools(prev => prev.map(sc => sc.id === school.id ? clearedSchool : sc));

      // Clear attendance bucket for this school from local storage.
      try {
        const raw = window.localStorage.getItem(ATTENDANCE_DATA_KEY);
        if (raw) {
          const allAtt = JSON.parse(raw);
          if (allAtt && typeof allAtt === "object" && school.id in allAtt) {
            delete allAtt[school.id];
            window.localStorage.setItem(ATTENDANCE_DATA_KEY, JSON.stringify(allAtt));
          }
        }
      } catch {}

      setResetSchoolMsg(`School "${schoolName}" has been reset.`);
    } catch (err) {
      setResetSchoolMsg(`Reset failed: ${err?.message || "unknown error"}`);
    } finally {
      setResetSchoolBusyId(null);
    }
  };

  const _handleCreateSchoolOperator = async (e) => {
    e.preventDefault();
    setSoError(""); setSoSuccess("");
    if (!(soName||"").trim()) { setSoError("Enter account name."); return; }
    if (!(soEmail||"").trim()) { setSoError("Enter email."); return; }
    if (!(soPassword||"").trim() || String(soPassword).length < 4) { setSoError("Password must be at least 4 characters."); return; }
    if (!soSchoolId) { setSoError("Select a school."); return; }
    const list = loadAuthUsers();
    const emailNorm = String(soEmail).trim().toLowerCase();
    if (list.some(u => String(u.email||"").toLowerCase() === emailNorm)) { setSoError("A user with this email already exists."); return; }
    const userId = genId();
    const pwHash = await hashPassword(String(soPassword).trim());
    saveAuthUsers([...list, { id:userId, email:emailNorm, password:pwHash, schoolId:soSchoolId, name:String(soName).trim(), userType:"school" }]);
    setSoName(""); setSoEmail(""); setSoPassword(""); setSoSchoolId("");
    setSoSuccess("School account created. User can now sign in and edit marks, students, and staff.");
    refreshUsers();
  };

  const handleCreateSchool = async (e) => {
    e.preventDefault();
    setCsError(""); setCsSuccess("");
    if (!(csName || "").trim()) { setCsError("Enter school name."); return; }
    if (!(csAdminName || "").trim()) { setCsError("Enter admin/contact name."); return; }
    if (!(csEmail || "").trim()) { setCsError("Enter email."); return; }
    if (!(csPassword || "").trim() || String(csPassword).length < 4) { setCsError("Password must be at least 4 characters."); return; }
    const list = loadAuthUsers();
    const emailNorm = String(csEmail).trim().toLowerCase();
    if (list.some(u => String(u.email || "").toLowerCase() === emailNorm)) { setCsError("A user with this email already exists."); return; }
    const schoolId = genId();
    const newSchool = { id: schoolId, name: String(csName).trim(), settings: { schoolName: String(csName).trim(), schoolEmail: emailNorm }, students: [], staffProfiles: [], staffTransferHistory: [], retiredStaff: [], timetable: {}, currentSession: defaultSession(), sessions: [defaultSession()], exam_by_session: {}, exam_tm: {}, exam_om: {}, exam_datesheet: { dates: [], cols: [], subs: {}, note: "" }, questionBank: {}, status: "active" };
    setSchools(prev => [...prev, newSchool]);
    const userId = genId();
    const pwHash = await hashPassword(String(csPassword).trim());
    saveAuthUsers([...list, { id: userId, email: emailNorm, password: pwHash, schoolId, name: String(csAdminName).trim(), userType: "principal" }]);
    setCsName(""); setCsEmail(""); setCsAdminName(""); setCsPassword("");
    setCsSuccess(`School "${csName.trim()}" created. They can now sign in on this device.`);
    refreshUsers();
  };

  const handleDeleteUser = (userId) => {
    const next = loadAuthUsers().filter(u => u.id !== userId);
    saveAuthUsers(next);
    refreshUsers();
  };

  const handleToggleBlock = (userId) => {
    const next = loadAuthUsers().map(u => u.id === userId ? { ...u, blocked: !u.blocked } : u);
    saveAuthUsers(next);
    refreshUsers();
  };

  const handleChangePassword = async (userId) => {
    if (!editNewPw.trim() || editNewPw.trim().length < 4) { setEditPwError("Min 4 characters."); return; }
    const pwHash = await hashPassword(editNewPw.trim());
    const next = loadAuthUsers().map(u => u.id === userId ? { ...u, password: pwHash } : u);
    saveAuthUsers(next);
    setEditUserId(null); setEditNewPw(""); setEditPwError("");
    refreshUsers();
  };

  const inp2 = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" };
  const lbl2 = { fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", flexDirection: "column", fontFamily: UI.fontApp }}>
      {/* Dark header */}
      <header style={{ background: "#1e293b", color: "#fff", padding: "12px 20px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <img src={APP_BRAND_LOGO} alt="" style={{ width: 72, height: 72, objectFit: "contain", borderRadius: 8, background: "rgba(255,255,255,0.1)", padding: 4, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Admin Panel</div>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 1 }}>PSMS — Full Control</div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, textAlign: "right", lineHeight: 1.5, marginRight: 8 }}>
          <div>{headerNow.toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" })}</div>
          <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{headerNow.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
        </div>
        <button type="button" onClick={onSignOut} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>Sign Out</button>
      </header>
      {/* Tab bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", padding: "0 20px" }}>
        {[["users","👥 User Management"],["schools","🏫 School Accounts"],["danger","⚠️ Danger Zone"]].map(([t,label]) => (
          <button key={t} type="button" onClick={() => setAdminTab(t)}
            style={{ padding: "12px 18px", border: "none", background: "transparent", color: adminTab === t ? "#1e293b" : "#64748b", fontWeight: adminTab === t ? 700 : 500, fontSize: 14, cursor: "pointer", borderBottom: `3px solid ${adminTab === t ? "#1e293b" : "transparent"}`, marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, padding: 20, overflow: "auto" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* ── TAB: USER MANAGEMENT ── */}
        {adminTab === "users" && (<>
          {/* Self-signup users */}
          <section style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 15, color: "#1e293b" }}>Self-Signup Users</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: C.gray }}>Users who registered on their own. You can view their passwords, block/unblock, change password, or delete.</p>
            {usersList.filter(u => u.userType === "local").length === 0 ? (
              <p style={{ fontSize: 13, color: C.gray, margin: 0 }}>No self-signup users yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {usersList.filter(u => u.userType === "local").map(u => (
                  <div key={u.id} style={{ padding: "12px 14px", background: u.blocked ? "#fef9f9" : "#f8fafc", borderRadius: 8, border: `1px solid ${u.blocked ? "#fecaca" : "#e2e8f0"}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 14 }}>{u.name || "—"}</div>
                        <div style={{ fontSize: 12, color: C.gray }}>{u.email}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Password: <strong style={{ fontFamily: "monospace" }}>{u.password}</strong>{u.blocked && <span style={{ marginLeft: 8, color: "#dc2626", fontWeight: 700 }}>BLOCKED</span>}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => { setEditUserId(editUserId === u.id ? null : u.id); setEditNewPw(""); setEditPwError(""); }}
                          style={{ padding: "5px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer" }}>Change PW</button>
                        <button type="button" onClick={() => handleToggleBlock(u.id)}
                          style={{ padding: "5px 10px", fontSize: 12, border: `1px solid ${u.blocked ? "#16a34a" : "#d97706"}`, borderRadius: 6, background: "#fff", color: u.blocked ? "#16a34a" : "#d97706", cursor: "pointer" }}>
                          {u.blocked ? "Unblock" : "Block"}
                        </button>
                        <button type="button" onClick={() => { if (window.confirm(`Delete user "${u.name || u.email}"?`)) handleDeleteUser(u.id); }}
                          style={{ padding: "5px 10px", fontSize: 12, border: "1px solid #dc2626", borderRadius: 6, background: "#fff", color: "#dc2626", cursor: "pointer" }}>Delete</button>
                      </div>
                    </div>
                    {editUserId === u.id && (
                      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <input type="text" value={editNewPw} onChange={e => { setEditNewPw(e.target.value); setEditPwError(""); }} placeholder="New password (min 4)" style={{ ...inp2, width: "auto", flex: "1 1 160px" }} />
                        <button type="button" onClick={() => handleChangePassword(u.id)} style={{ padding: "7px 14px", border: "none", borderRadius: 6, background: "#16a34a", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Save</button>
                        <button type="button" onClick={() => { setEditUserId(null); setEditNewPw(""); setEditPwError(""); }} style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                        {editPwError && <span style={{ fontSize: 12, color: "#dc2626" }}>{editPwError}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* School account users */}
          <section style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 15, color: "#1e293b" }}>School Account Users</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: C.gray }}>All school users — principals, operators, and teachers. Principals and school operators can edit/delete marks, students, and staff.</p>
            {usersList.filter(u => u.userType === "school" || u.userType === "admin-created" || u.userType === "principal" || u.userType === "teacher").length === 0 ? (
              <p style={{ fontSize: 13, color: C.gray, margin: 0 }}>No school account users yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {usersList.filter(u => u.userType === "school" || u.userType === "admin-created" || u.userType === "principal" || u.userType === "teacher").map(u => {
                  const schoolName = (schools || []).find(s => s.id === u.schoolId)?.settings?.schoolName || (schools || []).find(s => s.id === u.schoolId)?.name || (u.schoolId ? u.schoolId.slice(0,8)+"…" : "—");
                  const roleLabel = u.userType==="principal"?"Principal":u.userType==="teacher"?"Teacher":u.userType==="school"?"School Operator":"Admin-Created";
                  const roleBg = u.userType==="principal"?"#f0fdf4":u.userType==="teacher"?"#fefce8":u.userType==="school"?"#eff6ff":"#f5f3ff";
                  const roleColor = u.userType==="principal"?"#166534":u.userType==="teacher"?"#854d0e":u.userType==="school"?"#1e40af":"#5b21b6";
                  return (
                    <div key={u.id} style={{ padding: "12px 14px", background: u.blocked ? "#fef9f9" : "#f8fafc", borderRadius: 8, border: `1px solid ${u.blocked ? "#fecaca" : "#e2e8f0"}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 14 }}>{u.name || "—"} <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: roleBg, color: roleColor, marginLeft: 4 }}>{roleLabel}</span></div>
                          <div style={{ fontSize: 12, color: C.gray }}>{u.email} · {schoolName}</div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Password: <strong style={{ fontFamily: "monospace" }}>{u.password}</strong>{u.blocked && <span style={{ marginLeft: 8, color: "#dc2626", fontWeight: 700 }}>BLOCKED</span>}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => { setEditUserId(editUserId === u.id ? null : u.id); setEditNewPw(""); setEditPwError(""); }}
                            style={{ padding: "5px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer" }}>Change PW</button>
                          <button type="button" onClick={() => handleToggleBlock(u.id)}
                            style={{ padding: "5px 10px", fontSize: 12, border: `1px solid ${u.blocked ? "#16a34a" : "#d97706"}`, borderRadius: 6, background: "#fff", color: u.blocked ? "#16a34a" : "#d97706", cursor: "pointer" }}>
                            {u.blocked ? "Unblock" : "Block"}
                          </button>
                          <button type="button" onClick={() => { if (window.confirm(`Delete user "${u.name || u.email}"?`)) handleDeleteUser(u.id); }}
                            style={{ padding: "5px 10px", fontSize: 12, border: "1px solid #dc2626", borderRadius: 6, background: "#fff", color: "#dc2626", cursor: "pointer" }}>Delete</button>
                        </div>
                      </div>
                      {editUserId === u.id && (
                        <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <input type="text" value={editNewPw} onChange={e => { setEditNewPw(e.target.value); setEditPwError(""); }} placeholder="New password (min 4)" style={{ ...inp2, width: "auto", flex: "1 1 160px" }} />
                          <button type="button" onClick={() => handleChangePassword(u.id)} style={{ padding: "7px 14px", border: "none", borderRadius: 6, background: "#16a34a", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Save</button>
                          <button type="button" onClick={() => { setEditUserId(null); setEditNewPw(""); setEditPwError(""); }} style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                          {editPwError && <span style={{ fontSize: 12, color: "#dc2626" }}>{editPwError}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </>)}

        {/* ── TAB: SCHOOL ACCOUNTS ── */}
        {adminTab === "schools" && (<>
          {/* Create new school */}
          <section style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 15, color: "#1e293b" }}>Create New School Account</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: C.gray }}>Creates both the school data workspace and a user account. The user will share this school's data when they log in.</p>
            <form onSubmit={handleCreateSchool} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
              <div><label style={lbl2}>School Name</label><input type="text" value={csName} onChange={e => setCsName(e.target.value)} placeholder="e.g. PSMS Lahore" style={inp2} /></div>
              <div><label style={lbl2}>Principal / Headmaster Name</label><input type="text" value={csAdminName} onChange={e => setCsAdminName(e.target.value)} placeholder="e.g. Mr. Ahmed Khan" style={inp2} /></div>
              <div><label style={lbl2}>Login Email</label><input type="email" value={csEmail} onChange={e => setCsEmail(e.target.value)} placeholder="school@example.edu" style={inp2} /></div>
              <div><label style={lbl2}>Login Password</label><input type="password" value={csPassword} onChange={e => setCsPassword(e.target.value)} placeholder="Min 4 characters" minLength={4} style={inp2} /></div>
              {csError && <div style={{ padding: "8px 10px", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 12 }}>{csError}</div>}
              {csSuccess && <div style={{ padding: "8px 10px", background: "#f0fdf4", color: "#166534", borderRadius: 6, fontSize: 12 }}>{csSuccess}</div>}
              <button type="submit" style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "#1e293b", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", alignSelf: "flex-start" }}>Create School & Principal Account</button>
            </form>
          </section>

          {/* All schools list */}
          <section style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 15, color: "#1e293b" }}>All Schools</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: C.gray }}>Active, stopped, and deleted schools.</p>
            {(!schools || schools.length === 0) ? (
              <p style={{ margin: 0, fontSize: 13, color: C.gray }}>No schools registered yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {schools.map(s => {
                  const sName = s.settings?.schoolName || s.name || s.id;
                  const status = s.status || "active";
                  return (
                    <div key={s.id} style={{ padding: "12px 14px", background: status === "deleted" ? "#fef2f2" : "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 180px" }}>
                          <strong style={{ color: "#1e293b" }}>{sName}</strong>
                          <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 7px", borderRadius: 4, background: status === "deleted" ? "#fecaca" : status === "stopped" ? "#fef3c7" : "#d1fae5", color: status === "deleted" ? "#b91c1c" : status === "stopped" ? "#92400e" : "#065f46" }}>
                            {status === "deleted" ? "Deleted" : status === "stopped" ? "Stopped" : "Active"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => setViewDetailsId(viewDetailsId === s.id ? null : s.id)} style={{ padding: "5px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer" }}>Details</button>
                          {status !== "deleted" && <button type="button" onClick={() => { if(window.confirm(`Delete school "${sName}"?`)) setSchoolStatus(s.id, "deleted"); }} style={{ padding: "5px 10px", fontSize: 12, border: "1px solid #dc2626", borderRadius: 6, background: "#fff", color: "#dc2626", cursor: "pointer" }}>Delete</button>}
                          {status === "active" && <button type="button" onClick={() => setSchoolStatus(s.id, "stopped")} style={{ padding: "5px 10px", fontSize: 12, border: "1px solid #d97706", borderRadius: 6, background: "#fff", color: "#d97706", cursor: "pointer" }}>Stop</button>}
                          {status === "stopped" && <button type="button" onClick={() => setSchoolStatus(s.id, "active")} style={{ padding: "5px 10px", fontSize: 12, border: "1px solid #16a34a", borderRadius: 6, background: "#fff", color: "#16a34a", cursor: "pointer" }}>Start</button>}
                          {status === "deleted" && <button type="button" onClick={() => setSchoolStatus(s.id, "active")} style={{ padding: "5px 10px", fontSize: 12, border: "none", borderRadius: 6, background: "#16a34a", color: "#fff", cursor: "pointer" }}>Restore</button>}
                        </div>
                      </div>
                      {viewDetailsId === s.id && (
                        <div style={{ marginTop: 10, padding: 10, background: "#fff", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, color: "#374151", display: "flex", flexDirection: "column", gap: 3 }}>
                          <div><strong>ID:</strong> <span style={{ fontFamily: "monospace" }}>{s.id}</span></div>
                          <div><strong>School Name:</strong> {s.settings?.schoolName || "—"}</div>
                          <div><strong>School Code:</strong> {s.settings?.schoolCode || "—"}</div>
                          <div><strong>Email:</strong> {s.settings?.schoolEmail || "—"}</div>
                          <div><strong>Principal:</strong> {s.settings?.principalName || "—"}</div>
                          <div><strong>Classes:</strong> {(s.settings?.classes || []).length} · <strong>Students:</strong> {(s.students || []).length} · <strong>Staff:</strong> {(s.staffProfiles || []).length}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>)}

        {/* ── TAB: DANGER ZONE ── */}
        {adminTab === "danger" && (<>
          {/* Reset a single school */}
          <section style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #fecaca" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 16, color: "#b91c1c" }}>Reset a School</h2>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "#7f1d1d" }}>Permanently deletes all data for a single school — classes, students, staff, timetable, exam marks, settings. The school record remains but is wiped clean. Cannot be undone.</p>
            {resetSchoolMsg && <p style={{ margin: "8px 0 0", fontSize: 13, color: resetSchoolMsg.startsWith("Reset failed") ? "#b91c1c" : "#166534" }}>{resetSchoolMsg}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              {(schools || []).filter(s => s.status !== "deleted").map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#fef2f2", borderRadius: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{s.settings?.schoolName || s.name || s.id}</span>
                  <button type="button" disabled={resetSchoolBusyId===s.id} onClick={() => { handleResetSchool(s); }} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, fontSize: 12, cursor: resetSchoolBusyId===s.id?"not-allowed":"pointer", opacity: resetSchoolBusyId===s.id?0.7:1, flexShrink: 0 }}>
                    {resetSchoolBusyId===s.id?"Resetting...":"Reset School"}
                  </button>
                </div>
              ))}
              {(schools || []).filter(s => s.status !== "deleted").length === 0 && <p style={{ margin: 0, fontSize: 13, color: "#7f1d1d" }}>No active schools.</p>}
            </div>
          </section>
          {/* Full system reset */}
          <section style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #fecaca" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 16, color: "#b91c1c" }}>Full System Reset</h2>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "#7f1d1d" }}>Removes all schools, all user accounts, and all data from this device. The app restarts as new with School 1. You will be signed out.</p>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "#7f1d1d", fontWeight: 600 }}>This action cannot be undone.</p>
            <button type="button" onClick={onResetAll} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#7f1d1d", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Reset Everything</button>
          </section>
        </>)}

      </div>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
const defaultExamDatesheet=()=>({dates:[],cols:[],subs:{},note:""});
function defaultSession(){
  const y=new Date().getFullYear();
  const m=new Date().getMonth();
  return m>=6 ? (y + "-" + (y+1)) : ((y-1) + "-" + y);
}
function useNowEverySecond(){
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{
    const id=window.setInterval(()=>setNow(new Date()),1000);
    return ()=>window.clearInterval(id);
  },[]);
  return now;
}

function HeaderNow(){
  const now=useNowEverySecond();
  return (
    <div className="hide-on-mobile" style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:1,lineHeight:1.2}}>
      <span style={{fontSize:11,fontWeight:600,color:"#111827"}}>{now.toLocaleDateString("en-PK",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</span>
      <span style={{fontSize:13,fontWeight:700,color:C.navy,fontVariantNumeric:"tabular-nums"}}>{now.toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>
    </div>
  );
}

function schoolShape(id,name){
  const session=defaultSession();
  return {
    id,name,settings:defaultSettings,students:defaultStudents,staffProfiles:[],staffTransferHistory:[],retiredStaff:[],timetable:{},
    currentSession:session,
    sessions:[session],
    exam_by_session:{[session]:{exam_tm:{},exam_om:{},exam_datesheet:defaultExamDatesheet()}},
    exam_tm:{},exam_om:{},exam_datesheet:defaultExamDatesheet(),
    questionBank:{},
    status:"active",
  };
}
function App(){
  const [session,setSession]=useState(()=>loadAuthSession());
  const [page,setPage]=useState("dashboard");
  const [barSubtitle,setBarSubtitle]=useState("");
  useEffect(()=>{ queueMicrotask(()=>setBarSubtitle("")); },[page]);
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const [themeMode]=useState(()=>{
    try{
      const stored=window.localStorage.getItem("sms_theme_mode");
      // Only honour 'light' or 'dark' – never follow the OS ('system') to prevent
      // Windows dark mode from changing the app colours.
      if(stored==="light"||stored==="dark") return stored;
    }catch{}
    return "light"; // default: always light, ignore OS theme
  });
  const [schools,setSchools]=useState(()=>{
    const data=loadFromLocal();
    if(data&&data.schools.length) return data.schools;
    const id=genId();
    return [schoolShape(id,"School 1")];
  });
  const [activeSchoolId,setActiveSchoolId]=useState(()=>{
    const sess=loadAuthSession();
    if(sess&&sess.schoolId) return sess.schoolId;
    const data=loadFromLocal();
    if(data) return data.activeSchoolId;
    return null;
  });
  const [loadedFromDb,setLoadedFromDb]=useState(false);

  // Change-password modal state (for the currently logged-in user)
  const [showProfileMenu,setShowProfileMenu]=useState(false);
  const [showChangePw,setShowChangePw]=useState(false);
  const [changePwCurrent,setChangePwCurrent]=useState("");
  const [changePwNew,setChangePwNew]=useState("");
  const [changePwConfirm,setChangePwConfirm]=useState("");
  const [changePwError,setChangePwError]=useState("");
  const [changePwSuccess,setChangePwSuccess]=useState("");
  const [changePwLoading,setChangePwLoading]=useState(false);

  const handleChangeOwnPassword=async()=>{
    setChangePwError(""); setChangePwSuccess("");
    if(!changePwCurrent.trim()){setChangePwError("Enter current password.");return;}
    if(!changePwNew.trim()||changePwNew.length<4){setChangePwError("New password must be at least 4 characters.");return;}
    if(changePwNew!==changePwConfirm){setChangePwError("Passwords do not match.");return;}
    setChangePwLoading(true);
    const users=loadAuthUsers();
    const user=users.find(u=>u.id===session?.userId);
    if(!user){setChangePwError("User not found.");setChangePwLoading(false);return;}
    const pwOk=await verifyPassword(changePwCurrent,user.password);
    if(!pwOk){setChangePwError("Current password is incorrect.");setChangePwLoading(false);return;}
    const newHash=await hashPassword(changePwNew);
    saveAuthUsers(users.map(u=>u.id===session.userId?{...u,password:newHash}:u));
    setChangePwSuccess("Password changed successfully!");
    setChangePwLoading(false);
    setTimeout(()=>{
      setShowChangePw(false);
      setChangePwCurrent("");setChangePwNew("");setChangePwConfirm("");setChangePwSuccess("");
    },1800);
  };

  const signOut=()=>{ saveAuthSession(null); setSession(null); };
  const currentUser=useMemo(()=>{
    if(!session?.userId) return null;
    return loadAuthUsers().find(u=>u.id===session.userId)||null;
  },[session]);
  useEffect(()=>{if(!showProfileMenu)return;const h=(e)=>{if(!e.target.closest("[data-profile-menu]"))setShowProfileMenu(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[showProfileMenu]);

  const saveStatusTimeoutRef=useRef(null);
  const [saveStatus,setSaveStatus]=useState("idle"); // idle | saving | saved
  const _dbStatus="local";

  const visibleSchools=schools.filter(s=>s.status!=="deleted");
  const foundSchool=schools.find(s=>s.id===activeSchoolId);
  const activeSchool=(foundSchool&&foundSchool.status!=="deleted")?foundSchool:(visibleSchools[0]||schools[0]||schoolShape(genId(),"School 1"));
  const settings=(activeSchool||{}).settings||defaultSettings;
  const students=useMemo(
    ()=>dedupeStudentsByIdentity(Array.isArray(activeSchool.students)?activeSchool.students:defaultStudents,Array.isArray(settings.classes)?settings.classes:[]),
    [activeSchool.students,settings.classes]
  );
  const staffProfiles=activeSchool.staffProfiles||[];
  const effectiveSettings=useMemo(()=>{
    const s=settings||defaultSettings;
    return {
      ...s,
      classes:Array.isArray(s.classes)?s.classes:[],
      classSubjects:(s.classSubjects&&typeof s.classSubjects==="object")?s.classSubjects:{},
      classSubjectsExam:(s.classSubjectsExam&&typeof s.classSubjectsExam==="object")?s.classSubjectsExam:((s.classSubjects&&typeof s.classSubjects==="object")?s.classSubjects:{}),
      classSubjectsTimetable:(s.classSubjectsTimetable&&typeof s.classSubjectsTimetable==="object")?s.classSubjectsTimetable:((s.classSubjects&&typeof s.classSubjects==="object")?s.classSubjects:{}),
      staff:(staffProfiles||[]).map(p=>({id:p.id,name:p.name||"",designation:p.designation||"",photo:p.photo||null})),
    };
  },[settings,staffProfiles]);
  const timetable=activeSchool.timetable||{};
  const curSession=activeSchool.currentSession||defaultSession();
  const examBySession=activeSchool.exam_by_session&&typeof activeSchool.exam_by_session==="object"?activeSchool.exam_by_session:{};
  const sessionData=examBySession[curSession]||{exam_tm:{},exam_om:{},exam_datesheet:defaultExamDatesheet()};
  const exam_tm=sessionData.exam_tm&&typeof sessionData.exam_tm==="object"?sessionData.exam_tm:(activeSchool.exam_tm||{});
  const exam_om=sessionData.exam_om&&typeof sessionData.exam_om==="object"?sessionData.exam_om:(activeSchool.exam_om||{});
  const exam_datesheet=sessionData.exam_datesheet&&typeof sessionData.exam_datesheet==="object"?sessionData.exam_datesheet:(activeSchool.exam_datesheet||defaultExamDatesheet());
  const setTimetable=(updater)=>{
    setSchools(prev=>prev.map(s=>s.id===activeSchoolId?{...s,timetable:typeof updater==="function"?updater(s.timetable||{}):updater}:s));
  };
  const setExamMarksForActive=useCallback((exam_tmNext,exam_omNext)=>{
    setSchools(prev=>prev.map(s=>{
      if(s.id!==activeSchoolId) return s;
      const ses=s.currentSession||defaultSession();
      const bySession=s.exam_by_session&&typeof s.exam_by_session==="object"?{...s.exam_by_session}:{};
      const current=s.exam_by_session?.[ses]||{exam_tm:{},exam_om:{},exam_datesheet:defaultExamDatesheet()};
      const latestTM={...(s.exam_tm||{}),...(current.exam_tm||{})};
      const latestOM={...(s.exam_om||{}),...(current.exam_om||{})};
      const resolvedTM=typeof exam_tmNext==="function"?exam_tmNext(latestTM):(exam_tmNext??latestTM);
      const resolvedOM=typeof exam_omNext==="function"?exam_omNext(latestOM):(exam_omNext??latestOM);
      bySession[ses]={...current,exam_tm:resolvedTM,exam_om:resolvedOM};
      return {...s,exam_by_session:bySession,exam_tm:resolvedTM,exam_om:resolvedOM};
    }));
  },[activeSchoolId]);
  const setDatesheetForActive=useCallback((updater)=>{
    setSchools(prev=>prev.map(s=>{
      if(s.id!==activeSchoolId) return s;
      const ses=s.currentSession||defaultSession();
      const bySession=s.exam_by_session&&typeof s.exam_by_session==="object"?{...s.exam_by_session}:{};
      const current=s.exam_by_session?.[ses]||{exam_tm:{},exam_om:{},exam_datesheet:defaultExamDatesheet()};
      const next=typeof updater==="function"?updater(current.exam_datesheet||defaultExamDatesheet()):updater;
      bySession[ses]={...current,exam_datesheet:next};
      return {...s,exam_by_session:bySession,exam_datesheet:next};
    }));
  },[activeSchoolId]);
  const setCurrentSessionForActive=useCallback((session)=>{
    setSchools(prev=>prev.map(s=>s.id===activeSchoolId?{...s,currentSession:session}:s));
  },[activeSchoolId]);
  const addSessionForActive=useCallback((newSession)=>{
    if(!newSession||!/^\d{4}-\d{4}$/.test(String(newSession).trim())) return;
    const session=String(newSession).trim();
    setSchools(prev=>prev.map(s=>{
      if(s.id!==activeSchoolId) return s;
      const sessions=Array.isArray(s.sessions)?s.sessions:[s.currentSession||defaultSession()];
      if(sessions.includes(session)) return s;
      const bySession=s.exam_by_session&&typeof s.exam_by_session==="object"?{...s.exam_by_session}:{};
      bySession[session]={exam_tm:{},exam_om:{},exam_datesheet:defaultExamDatesheet()};
      return {...s,sessions:[...sessions,session].sort(),exam_by_session:bySession};
    }));
  },[activeSchoolId]);

  useEffect(()=>{ queueMicrotask(()=>setLoadedFromDb(true)); },[]);

  useEffect(()=>{
    if(!loadedFromDb) return;
    let cancelled=false;
    const run=()=>{
      if(cancelled) return;
      setSchools(prev=>{
        let changed=false;
        const next=prev.map(sc=>{
          const raw=Array.isArray(sc.students)?sc.students:[];
          const d=dedupeStudentsByIdentity(raw,sc.settings?.classes||[]);
          if(d.length===raw.length) return sc;
          changed=true;
          return {...sc,students:d};
        });
        return changed?next:prev;
      });
    };
    if(typeof window!=="undefined" && typeof window.requestIdleCallback==="function"){
      const idleId=window.requestIdleCallback(run,{timeout:300});
      return ()=>{ cancelled=true; window.cancelIdleCallback(idleId); };
    }
    const t=setTimeout(run,100);
    return ()=>{ cancelled=true; clearTimeout(t); };
  },[loadedFromDb,schools]);

  // Apply theme – always use the explicit user choice (light/dark), never follow OS.
  // This prevents Windows dark/light mode from changing the app colours.
  useEffect(()=>{
    const root=document.documentElement;
    // themeMode is always 'light' or 'dark' – no 'system' option any more.
    root.setAttribute("data-theme", themeMode==="dark" ? "dark" : "light");
  },[themeMode]);

  useEffect(()=>{
    try{ window.localStorage.setItem("sms_theme_mode",themeMode); }catch{}
  },[themeMode]);

  useEffect(()=>{
    if(!loadedFromDb) return;
    const visible=schools.filter(s=>s.status!=="deleted");
    if(visible.length>0&&(!activeSchoolId||!visible.some(s=>s.id===activeSchoolId)))
      queueMicrotask(()=>setActiveSchoolId(visible[0].id));
  },[loadedFromDb,schools,activeSchoolId]);

  useEffect(()=>{ try{ if(activeSchoolId) localStorage.setItem("activeSchoolId",activeSchoolId); }catch{} },[activeSchoolId]);

  useEffect(()=>{
    if(!mobileMenuOpen) return;
    const prev=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const onKey=(e)=>{ if(e.key==="Escape") setMobileMenuOpen(false); };
    window.addEventListener("keydown",onKey);
    return ()=>{ document.body.style.overflow=prev; window.removeEventListener("keydown",onKey); };
  },[mobileMenuOpen]);

  useEffect(()=>{
    if(!loadedFromDb) return;
    queueMicrotask(()=>setSaveStatus("saving"));
    const persistNow=()=>{
      saveToLocal(schools,activeSchoolId);
      setSaveStatus("saved");
      if(saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current);
      saveStatusTimeoutRef.current=setTimeout(()=>setSaveStatus("idle"),1200);
    };
    if(typeof window!=="undefined" && typeof window.requestIdleCallback==="function"){
      const idleId=window.requestIdleCallback(persistNow,{timeout:500});
      return ()=>window.cancelIdleCallback(idleId);
    }
    const t=setTimeout(persistNow,180);
    return ()=>clearTimeout(t);
  },[loadedFromDb,schools,activeSchoolId]);


  const setSettingsForActive=(updater)=>{
    setSchools(prev=>prev.map(s=>s.id===activeSchoolId
      ? {...s,settings:typeof updater==="function"?updater(s.settings):updater}
      : s));
  };
  const setStudentsForActive=(updater)=>{
    setSchools(prev=>prev.map(s=>s.id===activeSchoolId
      ? {...s,students:typeof updater==="function"?updater(s.students):updater}
      : s));
  };

  const setSchoolStatus=(id,status)=>{
    setSchools(prev=>{
      const next=prev.map(s=>s.id===id?{...s,status}:s);
      if(id===activeSchoolId&&status==="deleted"){ const v=next.filter(s=>s.status!=="deleted"); setActiveSchoolId(v[0]?.id||null); }
      return next;
    });
  };

  const resetAllData=async()=>{
    if(!confirm("Reset ALL data? This will delete all schools, accounts, and data from this device. The app will restart fresh with School 1. This cannot be undone.")) return;
    // Clear localStorage
    saveAuthSession(null);
    window.localStorage.removeItem(LOCAL_DATA_KEY);
    window.localStorage.removeItem(ATTENDANCE_DATA_KEY);
    try{ window.localStorage.removeItem("activeSchoolId"); }catch{}
    saveAuthUsers([]);
    window.location.reload();
  };
  if(session&&session.admin){
    return <AdminPage schools={schools} setSchools={setSchools} setSchoolStatus={setSchoolStatus} onSignOut={()=>{ saveAuthSession(null); setSession(null); }} onResetAll={resetAllData}/>;
  }
  // Teachers cannot access Settings; principals and all others can
  const isTeacher = session?.userType === "teacher";
  const nav = isTeacher ? APP_MAIN_NAV.filter(n => n.id !== "settings") : APP_MAIN_NAV;
  if(session===null){
    return <AuthScreen onSignIn={(s)=>{ setSession(s); if(s.schoolId) setActiveSchoolId(s.schoolId); }} setActiveSchoolId={setActiveSchoolId}/>;
  }
  return (
    <>
      <style>{PRINT_CSS}</style>
    <style>{MOBILE_CSS}</style>
    <div className={page==="timetable"?"app-layout app-page-timetable":"app-layout"} style={{display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden",fontFamily:UI.fontApp,background:UI.shellBg,padding:page==="timetable"?"0 max(6px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(6px, env(safe-area-inset-left))":"0 max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left))",boxSizing:"border-box",width:"100%",maxWidth:"100vw"}}>
      <header className="app-header no-print" style={{flexShrink:0,zIndex:20,margin:"8px 0 0",background:"#ffffff",borderBottom:"1px solid #e5e7eb",boxShadow:"0 1px 4px rgba(15,23,42,0.06)",borderRadius:12}}>
        <div className="app-topbar-grid" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,auto) minmax(0,1fr)",alignItems:"center",gap:12,padding:"10px 16px",maxWidth:"100%"}}>
          <div className="app-topbar-left" style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
            <button type="button" className="mobile-menu-btn" aria-label="Open menu" aria-expanded={mobileMenuOpen} style={{alignItems:"center",justifyContent:"center",width:UI.mobileMenuBtn,height:UI.mobileMenuBtn,minWidth:UI.mobileMenuBtn,minHeight:UI.mobileMenuBtn,padding:0,border:"none",background:C.navy,color:"#fff",borderRadius:UI.radiusControl,cursor:"pointer",flexShrink:0,touchAction:"manipulation",WebkitTapHighlightColor:"transparent",position:"relative",zIndex:30,pointerEvents:"auto"}} onClick={()=>setMobileMenuOpen(true)}>
              <Menu size={UI.iconMenu} strokeWidth={2} aria-hidden />
            </button>
            <img src={APP_BRAND_LOGO} alt="" className="app-topbar-logo" style={{width:UI.logoApp/2,height:UI.logoApp/2,objectFit:"contain",flexShrink:0}} />
            <div className="app-topbar-brandtext" style={{display:"flex",flexDirection:"column",minWidth:0,justifyContent:"center"}}>
              <div style={{fontFamily:UI.fontHeading,fontWeight:800,fontSize:13,color:C.navy,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Punjab School Management System</div>
              {(effectiveSettings.schoolName||"").trim()?(
                <div style={{fontSize:11,fontWeight:600,color:C.gray,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={(effectiveSettings.schoolName||"").trim()}>{(effectiveSettings.schoolName||"").trim()}</div>
              ):(
                <div style={{fontSize:11,color:C.gray,marginTop:2}}>Your school workspace</div>
              )}
            </div>
          </div>
          <div className="app-topbar-center" style={{textAlign:"center",justifySelf:"center",padding:"0 8px",maxWidth:"min(52vw, 480px)",minWidth:0}} title={barSubtitle?`${nav.find(n=>n.id===page)?.l} · ${barSubtitle}`:(nav.find(n=>n.id===page)?.l||"")}>
            <div style={{fontFamily:UI.fontHeading,fontWeight:700,fontSize:16,color:C.navy,lineHeight:1.25,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              <span>{nav.find(n=>n.id===page)?.i} {nav.find(n=>n.id===page)?.l}</span>
            </div>
            <div style={{fontSize:12,fontWeight:600,color:C.gray,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {barSubtitle?<span>{barSubtitle}</span>:<span style={{opacity:0.85}}>Main workspace</span>}
            </div>
          </div>
          <div className="app-topbar-right" style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:10,flexWrap:"wrap",minWidth:0}}>
            {saveStatus!=="idle"&&<span style={{fontSize:11,fontWeight:600,color:saveStatus==="saved"?C.green:C.gray,whiteSpace:"nowrap"}}>{saveStatus==="saved"?"✓ Saved":saveStatus==="saving"?"Saving…":""}</span>}
            <HeaderNow />
          </div>
        </div>
      </header>
      <div className="app-body-row" style={{display:"flex",flex:1,minHeight:0,overflow:"hidden",gap:10,marginTop:10}}>
      <div
        className="app-sidebar no-print"
        style={{
          height:"100%",
          overflowY:"auto",
          overflowX:"hidden",
          width:220,
          background:"linear-gradient(180deg, #0f3d14 0%, #1B5E20 55%, #2e7d32 100%)",
          color:"#f9fafb",
          display:"flex",
          flexDirection:"column",
          boxShadow:"0 4px 20px rgba(15,23,42,0.2)",
          flexShrink:0,
          border:"1px solid rgba(148,163,184,0.22)",
          borderRadius:12
        }}>
        <nav style={{flex:1,padding:"12px 10px 12px",display:"flex",flexDirection:"column",gap:4}}>
          {nav.map(item=><button
            key={item.id}
            onClick={()=>startTransition(()=>setPage(item.id))}
            style={{
              width:"100%",
              padding:"8px 10px",
              marginBottom:2,
              background:page===item.id?"rgba(248,250,252,0.16)":"transparent",
              border:"none",
              color:"#e5e7eb",
              cursor:"pointer",
              textAlign:"left",
              fontSize:13,
              display:"flex",
              alignItems:"center",
              gap:9,
              borderRadius:8,
              borderLeft:page===item.id?"3px solid #fbbf24":"3px solid transparent",
              transition:"background 0.18s ease,border-left-color 0.18s ease,transform 0.12s ease",
              transform:page===item.id?"translateX(2px)":"translateX(0)"
            }}>
            <span style={{fontSize:UI.navEmoji,lineHeight:1,flexShrink:0}}>{item.i}</span>
            <span style={{flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.l}</span>
          </button>)}
          <div data-profile-menu style={{position:"relative",marginTop:6}}>
            <button type="button" onClick={()=>setShowProfileMenu(p=>!p)} style={{width:"100%",padding:"8px 10px",background:showProfileMenu?"rgba(255,255,255,0.13)":"rgba(255,255,255,0.07)",border:"1px solid rgba(148,163,184,0.25)",color:"#e5e7eb",cursor:"pointer",textAlign:"left",fontSize:12,display:"flex",alignItems:"center",gap:8,borderRadius:8,transition:"background 0.18s ease"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff",flexShrink:0}}>
                {(currentUser?.name||currentUser?.email||"U").charAt(0).toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"#f1f5f9"}}>{currentUser?.name||"User"}</div>
                <div style={{fontSize:10,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser?.email||""}</div>
              </div>
              <span style={{fontSize:10,opacity:0.5,flexShrink:0,transform:showProfileMenu?"rotate(0deg)":"rotate(180deg)",transition:"transform 0.2s",display:"inline-block"}}>▲</span>
            </button>
            {showProfileMenu&&<div style={{position:"absolute",bottom:"calc(100% + 6px)",left:0,right:0,background:"#1e293b",border:"1px solid rgba(148,163,184,0.25)",borderRadius:10,boxShadow:"0 -6px 24px rgba(0,0,0,0.35)",overflow:"hidden",zIndex:200}}>
              <div style={{padding:"12px 14px",borderBottom:"1px solid rgba(148,163,184,0.18)",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#fff",flexShrink:0}}>
                  {(currentUser?.name||currentUser?.email||"U").charAt(0).toUpperCase()}
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#f1f5f9",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser?.name||"User"}</div>
                  <div style={{fontSize:11,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser?.email||""}</div>
                  {currentUser?.userType&&<div style={{fontSize:10,color:"#64748b",marginTop:1,textTransform:"capitalize"}}>{currentUser.userType}</div>}
                </div>
              </div>
              {session?.userId&&<button type="button" onClick={()=>{setShowProfileMenu(false);setShowChangePw(true);}} style={{width:"100%",padding:"9px 14px",background:"transparent",border:"none",color:"#94a3b8",cursor:"pointer",textAlign:"left",fontSize:12,display:"flex",alignItems:"center",gap:9,transition:"background 0.15s"}}>
                <span style={{fontSize:14,lineHeight:1}}>🔑</span> Change Password
              </button>}
              <button type="button" onClick={()=>{setShowProfileMenu(false);signOut();}} style={{width:"100%",padding:"9px 14px",background:"transparent",border:"none",color:"#fb7185",cursor:"pointer",textAlign:"left",fontSize:12,display:"flex",alignItems:"center",gap:9,fontWeight:600,transition:"background 0.15s"}}>
                <span style={{fontSize:14,lineHeight:1}}>🚪</span> Sign Out
              </button>
            </div>}
          </div>
        </nav>
        <div style={{padding:"8px 12px 6px",borderTop:"1px solid rgba(148,163,184,0.25)",fontSize:10,opacity:0.8,lineHeight:1.4}}>
          {isTeacher?(session?.name||"Teacher"):(effectiveSettings.principalName||"Principal / Headmaster")}
        </div>
        <div style={{padding:"6px 12px 10px",borderTop:"1px solid rgba(148,163,184,0.15)",fontSize:9,lineHeight:1.4,display:"flex",alignItems:"center",gap:6}} title="Local only — data stored on this device">
          <span style={{width:7,height:7,borderRadius:"50%",background:"#f59e0b",boxShadow:"0 0 8px rgba(245,158,11,0.9)",flexShrink:0}}/>
          Local only · This device
        </div>
      </div>
      <div className="app-main" style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,minHeight:0,overflow:"hidden",background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",boxShadow:"0 2px 12px rgba(15,23,42,0.06)"}}>
        {mobileMenuOpen&&typeof document!=="undefined"&&createPortal(
          <>
            <div className="mobile-menu-backdrop" aria-hidden="true" onClick={()=>setMobileMenuOpen(false)}/>
            <div className="mobile-menu-panel" role="dialog" aria-modal="true" aria-label="Sidebar navigation">
              <div className="mobile-menu-header">
                <div style={{display:"flex",alignItems:"center",gap:12,overflow:"hidden",minWidth:0}}>
                  <img src={APP_BRAND_LOGO} alt="" style={{width:UI.logoApp,height:UI.logoApp,borderRadius:UI.radiusControl,objectFit:"contain",flexShrink:0,boxShadow:"0 0 0 2px rgba(251,191,36,0.35)"}}/>
                  <div style={{overflow:"hidden",minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(effectiveSettings.schoolName||"").trim()||"School"}</div>
                    <div style={{fontSize:11,opacity:0.75,marginTop:2}}>{effectiveSettings.schoolCode||"—"}</div>
                  </div>
                </div>
                <button type="button" aria-label="Close menu" style={{width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",border:"none",background:"rgba(255,255,255,0.12)",color:"#fff",borderRadius:8,cursor:"pointer"}} onClick={()=>setMobileMenuOpen(false)}>
                  <X size={UI.iconMd} strokeWidth={2.25} aria-hidden />
                </button>
              </div>
              <div className="mobile-menu-scroll">
                <nav>
                  {nav.map(item=>(
                    <button key={item.id} type="button" className={page===item.id?"active":""} onClick={()=>{ startTransition(()=>setPage(item.id)); setMobileMenuOpen(false); }}>
                      <span style={{fontSize:UI.navEmoji,lineHeight:1,flexShrink:0,width:32,textAlign:"center"}}>{item.i}</span>
                      <span style={{flex:1}}>{item.l}</span>
                    </button>
                  ))}
                  <div style={{marginTop: 8, paddingTop: 12, borderTop: "1px solid rgba(148,163,184,0.2)"}}>
                    <div style={{padding:"10px 16px 8px",display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#fff",flexShrink:0}}>
                        {(currentUser?.name||currentUser?.email||"U").charAt(0).toUpperCase()}
                      </div>
                      <div style={{minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:13,color:"#f1f5f9",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser?.name||"User"}</div>
                        <div style={{fontSize:11,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser?.email||""}</div>
                      </div>
                    </div>
                    <button type="button" onClick={()=>{setMobileMenuOpen(false);signOut();}} style={{width: "100%", padding: "10px 16px", background: "transparent", border: "none", color: "#fb7185", cursor: "pointer", textAlign: "left", fontSize: 13, display: "flex", alignItems: "center", gap: 8, fontWeight: 600}}>
                      <span style={{fontSize:UI.navEmoji,lineHeight:1,width:32,textAlign:"center"}}>🚪</span> Sign out
                    </button>
                    {session?.userId&&<button type="button" onClick={()=>{setShowChangePw(true);setMobileMenuOpen(false);}} style={{width:"100%",padding:"10px 16px",background:"transparent",border:"none",color:"#94a3b8",cursor:"pointer",textAlign:"left",fontSize:13,display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:UI.navEmoji,lineHeight:1,width:32,textAlign:"center"}}>🔑</span> Change Password
                    </button>}
                  </div>
                </nav>
              </div>
              <div className="mobile-menu-footer">{isTeacher?(session?.name||"Teacher"):(effectiveSettings.principalName||"Principal / Headmaster")}<br/><span style={{opacity:0.75,fontSize:10}}>● Local only · This device</span></div>
            </div>
          </>,
          document.body
        )}
        <div id="print-section" style={{flex:1,minHeight:0,padding:UI.padMain,overflow:"auto",WebkitOverflowScrolling:"touch",background:UI.canvasBg,fontFamily:UI.fontApp}}>
          {page==="dashboard"&&<DashboardPage settings={effectiveSettings} students={students} staffProfiles={staffProfiles} exam_tm={exam_tm} exam_om={exam_om} activeSchoolId={activeSchoolId}/>}
          {page==="timetable"&&<TimetablePage settings={effectiveSettings} staffProfiles={staffProfiles} timetable={timetable} setTimetable={setTimetable} currentSession={curSession} setBarSubtitle={setBarSubtitle}/>}
          {page==="attendance"&&<AttendancePage settings={effectiveSettings} students={students} currentSession={curSession} activeSchoolId={activeSchoolId} setBarSubtitle={setBarSubtitle}/>}
          {page==="fees"&&<FeePage settings={effectiveSettings} students={students} activeSchoolId={activeSchoolId} setBarSubtitle={setBarSubtitle}/>}
          {page==="examination"&&<ExaminationErrorBoundary><ExaminationPage settings={effectiveSettings} setSettings={setSettingsForActive} students={students} setStudents={setStudentsForActive} timetable={timetable} exam_tm={exam_tm} exam_om={exam_om} setExamMarks={setExamMarksForActive} exam_datesheet={exam_datesheet} setDatesheet={setDatesheetForActive} currentSession={curSession} currentUser={currentUser} setBarSubtitle={setBarSubtitle}/></ExaminationErrorBoundary>}
          {page==="paper"&&<PaperGeneratorPage settings={effectiveSettings} questionBank={activeSchool.questionBank||{}} setQuestionBank={updater=>setSchools(prev=>prev.map(s=>s.id===activeSchoolId?{...s,questionBank:typeof updater==="function"?updater(s.questionBank||{}):updater}:s))} setBarSubtitle={setBarSubtitle}/>}
          {page==="card"&&<CardGeneratorPage settings={effectiveSettings} students={students} currentSession={curSession} staffProfiles={staffProfiles} setBarSubtitle={setBarSubtitle}/>}
          {page==="book-bank"&&<BookBankPage setBarSubtitle={setBarSubtitle}/>}
          {page==="library"&&<LibraryPage setBarSubtitle={setBarSubtitle} activeSchoolId={activeSchoolId} classes={effectiveSettings.classes} students={students}/>}
          {page==="about"&&<AboutUsPage />}
          {page==="settings"&&!isTeacher&&<SettingsPage settings={effectiveSettings} setSettings={setSettingsForActive} setSchools={setSchools} students={students} setStudents={setStudentsForActive} schools={schools} activeSchoolId={activeSchoolId} timetable={timetable} exam_tm={exam_tm} exam_om={exam_om} setExamMarks={setExamMarksForActive} currentSession={curSession} sessions={activeSchool.sessions||[curSession]} setCurrentSession={setCurrentSessionForActive} addSession={addSessionForActive} staffProfiles={staffProfiles} setBarSubtitle={setBarSubtitle} session={session}/>}
        </div>
      </div>
      </div>
      <PWAInstallBanner />
    </div>
    {/* ── Change Password Modal ── */}
    {showChangePw&&typeof document!=="undefined"&&createPortal(
      <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.65)",zIndex:10100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>{if(e.target===e.currentTarget){setShowChangePw(false);setChangePwError("");setChangePwSuccess("");}}}>
        <div style={{background:"#fff",borderRadius:16,padding:28,width:"100%",maxWidth:390,boxShadow:"0 25px 50px rgba(0,0,0,0.4)",fontFamily:UI.fontApp}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
            <h3 style={{margin:0,fontSize:18,fontWeight:700,color:"#1e293b"}}>🔑 Change Password</h3>
            <button type="button" onClick={()=>{setShowChangePw(false);setChangePwError("");setChangePwSuccess("");}} style={{border:"none",background:"transparent",fontSize:22,cursor:"pointer",color:"#64748b",lineHeight:1,padding:"0 4px"}}>×</button>
          </div>
          {changePwError&&<div style={{padding:"10px 12px",marginBottom:14,background:"#fef2f2",color:"#b91c1c",borderRadius:8,fontSize:13,border:"1px solid #fecaca"}}>{changePwError}</div>}
          {changePwSuccess&&<div style={{padding:"10px 12px",marginBottom:14,background:"#f0fdf4",color:"#166534",borderRadius:8,fontSize:13,border:"1px solid #bbf7d0"}}>{changePwSuccess}</div>}
          {[["Current Password",changePwCurrent,setChangePwCurrent],["New Password",changePwNew,setChangePwNew],["Confirm New Password",changePwConfirm,setChangePwConfirm]].map(([lbl,val,setter])=>(
            <div key={lbl} style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:13,fontWeight:600,color:"#374151",marginBottom:4}}>{lbl}</label>
              <input type="password" value={val} onChange={e=>setter(e.target.value)} style={{width:"100%",padding:"10px 12px",border:"1px solid #d1d5db",borderRadius:8,fontSize:14,boxSizing:"border-box",fontFamily:"inherit"}} onKeyDown={e=>{if(e.key==="Enter") handleChangeOwnPassword();}}/>
            </div>
          ))}
          <button type="button" onClick={handleChangeOwnPassword} disabled={changePwLoading} style={{width:"100%",padding:"12px",background:"#1e3a6b",color:"#fff",border:"none",borderRadius:8,fontSize:14,fontWeight:700,cursor:"pointer",marginTop:4,opacity:changePwLoading?0.7:1}}>
            {changePwLoading?"Saving…":"Change Password"}
          </button>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}

export default App;
