import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, startTransition } from "react";
import {
  verifyPassword,
  hashPassword,
} from "./cloudSync.js";
import {
  isSupabaseConfigured,
  loadSchoolsFromCloud,
  saveSchoolsToCloud,
  loadAuthUsersFromCloud,
  saveAuthUsersToCloud,
  findAuthUserByEmailFromCloud,
  upsertAuthUserToCloud,
  deleteAuthUsersFromCloud,
  clearAllCloudData,
  saveAttendanceToCloud,
  saveFeesToCloud,
  saveLibraryToCloud,
  saveDiscussionToCloud,
} from "./supabaseSync.js";
import { supabase, initSupabaseCloud, ensureCloudReady, pingSupabaseCloud, getIsSupabaseConfigured, getSupabase } from "./lib/supabase.js";
import { hydrateModuleLocalsFromCloud, pushModuleLocalsToCloud } from "./lib/moduleLocalsSync.js";
import { mergeAuthUserLists } from "./modules/auth/authCore.js";
import { loadLibraryFromLocal } from "./modules/library/libraryCore.js";
import { loadDiscussionMessages } from "./modules/aboutSupport/aboutSupportCore.js";
import * as XLSX from "./xlsxClient.js";
import { Plus, Edit2, Trash2, Upload, Download, Settings, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { AboutUsPage } from "./AboutUsPage";
import { BookBankPage } from "./BookBankPage";
import { LibraryModulePage } from "./modules/library/LibraryModulePage";
import { DailyRegisterPage } from "./modules/dailyRegister/DailyRegisterPage";
import * as feeCore from "./modules/fee/feeCore";
import { feeService, systemSettingsService, dashboardService } from "./services";
import PWAInstallBanner from "./PWAInstallBanner";
import { APP_BRAND_LOGO_URL } from "./branding.js";
import { yieldToMain } from "./yieldToMain.js";
import { UI } from "./uiTokens.js";
import { C, schoolOrBrandLogo, APP_BRAND_LOGO, genId } from "./shared/theme";
import { AppDashboardShell } from "./components/AppDashboardShell";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Separator } from "./components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
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
import { StudentsModulePage } from "./modules/students/StudentsModulePage";
import { StaffModulePage } from "./modules/staff/StaffModulePage";
import { AcademicModulePage } from "./modules/academic/AcademicModulePage";
import { TimetablePage } from "./modules/timetable/TimetablePage";
import { ExaminationPage } from "./modules/examination/ExaminationPage";
import { PaperGeneratorPage } from "./modules/paperGenerator/PaperGeneratorPage";
import { CardGeneratorPage } from "./modules/cardGenerator/CardGeneratorPage";
import { loadAttendanceFromLocal, ATTENDANCE_DATA_KEY } from "./modules/attendance/AttendancePage";
import { AttendanceLeaveModulePage } from "./modules/attendance/AttendanceLeaveModulePage";
import { FeeFinanceModulePage } from "./modules/fee/FeeFinanceModulePage";
import { SettingsPage } from "./modules/settings/SettingsPage";

/** Main shell navigation (left sidebar). */
const APP_MAIN_NAV = [
  { id: "dashboard", l: "Dashboard", i: "🏠" },
  { id: "students", l: "Students", i: "👨‍🎓" },
  { id: "staff", l: "Staff", i: "👩‍🏫" },
  { id: "academic", l: "Academic", i: "🎓" },
  { id: "timetable", l: "Timetable", i: "📅" },
  { id: "attendance", l: "Attendance & Leave", i: "📋" },
  { id: "fees", l: "Fees & Finance", i: "💳" },
  { id: "examination", l: "Examination", i: "📝" },
  { id: "daily-register", l: "Daily Tests", i: "✏️" },
  { id: "paper", l: "Paper Generator", i: "📄" },
  { id: "card", l: "ID Cards", i: "🪪" },
  { id: "book-bank", l: "Book Bank", i: "📚" },
  { id: "library", l: "Library", i: "📖" },
  { id: "about", l: "About", i: "ℹ️" },
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
        <Card className="max-w-[560px] border-red-300 bg-red-50">
          <CardContent className="p-6">
            <h3 className="text-red-700 font-semibold text-base mb-2">Something went wrong on the Examination page</h3>
            <p className="text-red-900 text-[13px]">{String(this.state.error?.message || this.state.error)}</p>
            <Button variant="destructive" size="sm" className="mt-4" onClick={() => this.setState({ hasError: false, error: null })}>Try again</Button>
          </CardContent>
        </Card>
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
        <Card className="max-w-[600px] mx-auto mt-5 border-red-300 bg-red-50">
          <CardContent className="p-6">
            <h3 className="text-red-700 font-semibold text-base mb-2">Something went wrong</h3>
            <p className="text-red-900 text-[13px] mb-3">
              {String(this.state.error?.message || this.state.error)}
            </p>
            <details className="mb-4">
              <summary className="cursor-pointer text-xs text-red-700">Error Details</summary>
              <pre className="text-[11px] text-red-800 mt-2 whitespace-pre-wrap overflow-auto">
                {this.state.error?.stack}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={() => window.location.reload()}>
                Reload Page
              </Button>
              <Button variant="outline" size="sm" onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}>
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
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
  ".app-page-timetable .timetable-print-area,.app-page-timetable .timetable-main-content{min-width:0;max-width:100%;box-sizing:border-box;}",
  ".app-page-timetable .timetable-main-content > div{max-width:100%;box-sizing:border-box;}",
  ".hide-on-mobile{display:none!important}",
  "@media (max-width:768px){",
  "  .hide-on-mobile{display:none!important}",
  "}",
  "@media (max-width:1280px){",
  "  .app-page-timetable #print-section{padding:8px max(4px, env(safe-area-inset-left)) 8px max(4px, env(safe-area-inset-right))!important;max-width:100%!important;box-sizing:border-box!important}",
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
/**
 * Persist auth users locally and upsert to Supabase (never wipes other cloud accounts).
 * Pass deletedIds when removing users; replace:true only for full admin reset.
 */
async function saveAuthUsers(users, { deletedIds = [], replace = false } = {}) {
  const list = Array.isArray(users) ? users : [];
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(list));
    }
  } catch {}
  if (!isSupabaseConfigured) return { ok: true, cloud: false };
  try {
    if (deletedIds.length) {
      const del = await deleteAuthUsersFromCloud(deletedIds);
      if (del?.ok === false) return { ok: false, cloud: true, error: del.error };
    }
    const result = await saveAuthUsersToCloud(list, { replace });
    if (result?.ok === false) return { ok: false, cloud: true, error: result.error };
    return { ok: true, cloud: true };
  } catch (err) {
    return { ok: false, cloud: true, error: err };
  }
}

function worldwideLoginNote(email, password, { cloudOk } = {}) {
  if (!cloudOk) {
    return `Login NOT saved to cloud — it will NOT work on other devices.\n\nEmail: ${email}\nPassword: ${password}\n\nFix: check internet, ensure Cloud ON, then Create Login again.`;
  }
  return `✓ Login is LIVE worldwide.\n\nEmail: ${email}\nPassword: ${password}\n\nThis account works on any phone, PC, or browser that opens this app with internet.`;
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

async function hydrateAuthUsersMirror() {
  if (!isSupabaseConfigured) return loadAuthUsers();
  try {
    const cloudUsers = (await loadAuthUsersFromCloud()) || [];
    const localUsers = loadAuthUsers();
    const { merged, localOnly } = mergeAuthUserLists(cloudUsers, localUsers);
    try { window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(merged)); } catch {}
    // Push only local-only accounts; never delete other devices' cloud logins
    if (localOnly.length) {
      await saveAuthUsersToCloud(localOnly, { replace: false });
    } else if (!cloudUsers.length && merged.length) {
      await saveAuthUsersToCloud(merged, { replace: false });
    }
    return merged;
  } catch {
    return loadAuthUsers();
  }
}

function AuthScreen({ onSignIn, setActiveSchoolId }) {
  const [panel, setPanel] = useState("user"); // "user" | "admin"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accountsReady, setAccountsReady] = useState(() => !getIsSupabaseConfigured());
  const [cloudConfigured, setCloudConfigured] = useState(() => getIsSupabaseConfigured());
  useEffect(() => {
    let cancelled = false;
    const readyUp = async () => {
      await ensureCloudReady();
      await hydrateAuthUsersMirror();
      if (cancelled) return;
      setCloudConfigured(getIsSupabaseConfigured());
      setAccountsReady(true);
    };
    readyUp().catch(() => {
      if (!cancelled) {
        setCloudConfigured(getIsSupabaseConfigured());
        setAccountsReady(true);
      }
    });
    const refresh = () => {
      readyUp().catch(() => {});
    };
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    const emailNorm = String(email).trim().toLowerCase();
    try {
      // Always reconnect to cloud first — logins must work worldwide
      const cloud = await ensureCloudReady();
      let user = null;
      if (cloud?.ok) {
        user = await findAuthUserByEmailFromCloud(emailNorm);
        if (user) {
          const merged = mergeAuthUserLists([user], loadAuthUsers()).merged;
          try { window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(merged)); } catch {}
        } else {
          const users = await hydrateAuthUsersMirror();
          user = users.find(u => String(u.email || "").toLowerCase() === emailNorm) || null;
        }
      } else {
        const users = loadAuthUsers();
        user = users.find(u => String(u.email || "").toLowerCase() === emailNorm) || null;
      }
      if (!user) {
        setError(
          cloud?.ok
            ? "No account found with this email in the cloud. Ask admin to Create Login (with Cloud ON)."
            : "Cloud is OFF on this device. Open the main app URL with internet, then try again."
        );
        setLoading(false);
        return;
      }
      if (user.blocked) { setError("This account has been blocked by the administrator."); setLoading(false); return; }
      const pwOk = await verifyPassword(password, user.password);
      if (!pwOk) { setError("Incorrect password."); setLoading(false); return; }
      saveAuthSession({ userId: user.id, schoolId: user.schoolId || null, userType: user.userType });
      setActiveSchoolId(user.schoolId || null);
      onSignIn({ userId: user.id, schoolId: user.schoolId || null, userType: user.userType });
    } catch (err) {
      console.warn("Sign-in failed", err);
      setError("Could not reach cloud accounts. Check internet and try again.");
    }
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" style={{ fontFamily: UI.fontApp }}>
      {panel === "user" ? (
        <Card className="w-full max-w-[440px] overflow-hidden shadow-2xl rounded-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-5 text-white" style={{ background: "var(--color-navy,#1a3a6b)" }}>
            <img src={APP_BRAND_LOGO} alt="" className="w-20 h-20 object-contain shrink-0 rounded-lg bg-white/10 p-1" />
            <div>
              <div className="font-bold text-[17px]">Punjab-SMS</div>
              <div className="text-xs opacity-80 mt-0.5">Sign in with your account</div>
            </div>
          </div>
          <CardContent className="p-6">
            {error && (
              <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[13px]">{error}</div>
            )}
            <form onSubmit={handleSignIn} className="space-y-4">
              {!accountsReady && (
                <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs">
                  Syncing accounts from cloud…
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Email</Label>
                <Input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required disabled={!accountsReady} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">Password</Label>
                <Input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required disabled={!accountsReady} />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !accountsReady}>
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
            <div className={`mt-4 px-3 py-2.5 rounded-lg text-xs text-center border ${cloudConfigured ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-orange-50 border-orange-200 text-orange-700"}`}>
              {cloudConfigured
                ? "☁ Worldwide cloud — school logins created by admin work on any device with internet."
                : "⚠ Cloud OFF — open this app from the main server URL (or deploy with Supabase keys) so logins work worldwide."}
            </div>
            <div className="mt-3 flex justify-center">
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto px-2 py-1.5 text-xs text-muted-foreground"
                onClick={() => { setPanel("admin"); setError(""); }}
              >
                🔐 Administrator Login
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-[400px] overflow-hidden shadow-2xl rounded-2xl">
          <div className="bg-slate-800 text-white px-6 py-5">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="mb-3 h-auto justify-start gap-1 p-0 text-[13px] text-slate-400 hover:text-slate-200"
              onClick={() => { setPanel("user"); setError(""); }}
            >
              ← Back to User Login
            </Button>
            <div className="font-bold text-[17px]">Administrator Login</div>
            <div className="text-xs opacity-70 mt-1">Restricted access — authorised personnel only</div>
          </div>
          <CardContent className="p-6">
            {error && (
              <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[13px]">{error}</div>
            )}
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="admin-email">Admin Email</Label>
                <Input id="admin-email" type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin email" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-password">Admin Password</Label>
                <Input id="admin-password" type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <Button type="submit" className="w-full bg-slate-800 hover:bg-slate-700">
                Login as Administrator
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── ADMIN (ALL REGISTERED SCHOOLS) ───────────────────────────────────────────
function AdminPage({ schools, setSchools, setSchoolStatus, onSignOut, onResetAll }) {
  const headerNow = useNowEverySecond();
  const [adminTab, setAdminTab] = useState("users"); // "users" | "schools" | "danger"
  const [usersList, setUsersList] = useState(() => loadAuthUsers());
  const [usersSyncing, setUsersSyncing] = useState(false);
  const [cloudOk, setCloudOk] = useState(() => getIsSupabaseConfigured());
  const [cloudMsg, setCloudMsg] = useState("");
  const cloudPullInFlight = useRef(false);
  const syncUiDepthRef = useRef(0);
  const refreshUsers = () => setUsersList(loadAuthUsers());
  /** Pull schools + logins from cloud so other devices see admin-created accounts.
   *  `{ silent: true }` = background poll — do not touch Syncing badge / depth. */
  const pullUsersFromCloud = useCallback(async ({ silent = false } = {}) => {
    if (cloudPullInFlight.current) return loadAuthUsers();
    cloudPullInFlight.current = true;
    const showSyncUi = !silent;
    if (showSyncUi) {
      syncUiDepthRef.current += 1;
      setUsersSyncing(true);
      setCloudMsg("");
    }
    // Release in-flight + Syncing UI exactly once (timeout OR finally — never both)
    let released = false;
    const releasePull = () => {
      if (released) return;
      released = true;
      cloudPullInFlight.current = false;
      if (showSyncUi) {
        syncUiDepthRef.current = Math.max(0, syncUiDepthRef.current - 1);
        if (syncUiDepthRef.current === 0) setUsersSyncing(false);
      }
    };
    const safety = setTimeout(releasePull, 12000);
    try {
      let init = await ensureCloudReady();
      if (!init?.ok || !init?.client) {
        // One more hard retry — covers HMR / late inline config
        await new Promise((r) => setTimeout(r, 500));
        init = await ensureCloudReady();
      }
      if (!init?.ok || !init?.client) {
        setCloudOk(false);
        if (showSyncUi) {
          setCloudMsg(
            typeof location !== "undefined" && /vercel\.app$/i.test(location.hostname)
              ? "Cloud config missing on this deploy. Redeploy after committing public/psms-config.js (or set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in Vercel → Environment Variables)."
              : "Cloud config missing. On the main PC run: npm run psms-config then restart npm run dev — hard-refresh (Ctrl+F5). Other devices must open that Network URL (or the Vercel site)."
          );
        }
        setUsersList(loadAuthUsers());
        return loadAuthUsers();
      }
      const ping = await pingSupabaseCloud(8000);
      setCloudOk(ping.ok);
      if (!ping.ok) {
        if (showSyncUi) setCloudMsg(`Cloud unreachable (${ping.reason || "network"}). Check internet.`);
        return loadAuthUsers();
      }
      const [cloudUsers, cloudSchools] = await Promise.all([
        loadAuthUsersFromCloud(),
        loadSchoolsFromCloud(),
      ]);
      const cloudList = Array.isArray(cloudUsers) ? cloudUsers : [];
      const localUsers = loadAuthUsers();
      const { merged, localOnly } = mergeAuthUserLists(cloudList, localUsers);
      try { window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(merged)); } catch {}
      if (localOnly.length) await saveAuthUsersToCloud(localOnly, { replace: false });
      setUsersList(merged);
      // Only replace schools when payload actually changed — avoids Cloud badge blink loops
      if (cloudSchools?.schools?.length) {
        setSchools((prev) => {
          try {
            if (JSON.stringify(prev) === JSON.stringify(cloudSchools.schools)) return prev;
          } catch { /* fall through */ }
          return cloudSchools.schools;
        });
      }
      setCloudOk(true);
      if (showSyncUi) {
        setCloudMsg(cloudList.length ? `${cloudList.length} login(s) from cloud` : "Cloud connected");
      }
      return merged;
    } catch (err) {
      console.warn("Admin cloud pull failed", err);
      if (showSyncUi) {
        setCloudOk(false);
        setCloudMsg("Cloud sync failed — try Refresh again.");
      }
      return loadAuthUsers();
    } finally {
      clearTimeout(safety);
      releasePull();
    }
  }, [setSchools]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const users = await pullUsersFromCloud({ silent: false });
      if (!cancelled) setUsersList(users);
    })();
    const silentPull = () => { pullUsersFromCloud({ silent: true }); };
    const onFocus = () => { silentPull(); };
    const onVisible = () => { if (document.visibilityState === "visible") silentPull(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(silentPull, 30000);
    let channel = null;
    const sbClient = typeof getSupabase === "function" ? getSupabase() : supabase;
    if ((getIsSupabaseConfigured?.() || isSupabaseConfigured) && sbClient) {
      channel = sbClient
        .channel("admin-app-users")
        .on("postgres_changes", { event: "*", schema: "public", table: "app_users" }, () => {
          silentPull();
        })
        .subscribe();
    }
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
      const live = typeof getSupabase === "function" ? getSupabase() : supabase;
      if (channel && live) live.removeChannel(channel);
    };
  }, [pullUsersFromCloud]);
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
    const list = await hydrateAuthUsersMirror();
    const emailNorm = String(soEmail).trim().toLowerCase();
    if (list.some(u => String(u.email||"").toLowerCase() === emailNorm)) { setSoError("A user with this email already exists."); return; }
    const userId = genId();
    const plainPw = String(soPassword).trim();
    const pwHash = await hashPassword(plainPw);
    const next = [...list, { id:userId, email:emailNorm, password:pwHash, schoolId:soSchoolId, name:String(soName).trim(), userType:"school" }];
    const sync = await saveAuthUsers(next);
    setSoName(""); setSoEmail(""); setSoPassword(""); setSoSchoolId("");
    if (sync.ok && sync.cloud) {
      setSoSuccess("School account created and synced to cloud. User can sign in from anywhere.");
    } else if (sync.ok) {
      setSoSuccess("School account created on this device. Connect Supabase for worldwide login.");
    } else {
      setSoSuccess("Account saved locally, but cloud sync failed — fix internet / Cloud Sync so it works worldwide.");
    }
    refreshUsers();
  };

  const handleCreateSchool = async (e) => {
    e.preventDefault();
    setCsError(""); setCsSuccess("");
    if (!(csName || "").trim()) { setCsError("Enter school name."); return; }
    if (!(csAdminName || "").trim()) { setCsError("Enter admin/contact name."); return; }
    if (!(csEmail || "").trim()) { setCsError("Enter email."); return; }
    if (!(csPassword || "").trim() || String(csPassword).length < 4) { setCsError("Password must be at least 4 characters."); return; }
    const cloud = await ensureCloudReady();
    if (!cloud?.ok) {
      setCsError("Cloud is OFF — cannot create a worldwide school login. Fix Cloud ON first.");
      return;
    }
    const list = await hydrateAuthUsersMirror();
    const emailNorm = String(csEmail).trim().toLowerCase();
    if (await findAuthUserByEmailFromCloud(emailNorm) || list.some(u => String(u.email || "").toLowerCase() === emailNorm)) {
      setCsError("A user with this email already exists.");
      return;
    }
    const schoolId = genId();
    const schoolName = String(csName).trim();
    const plainPw = String(csPassword).trim();
    const newSchool = { id: schoolId, name: schoolName, settings: { schoolName, schoolEmail: emailNorm }, students: [], staffProfiles: [], staffTransferHistory: [], retiredStaff: [], timetable: {}, currentSession: defaultSession(), sessions: [defaultSession()], exam_by_session: {}, exam_tm: {}, exam_om: {}, exam_datesheet: { dates: [], cols: [], subs: {}, note: "" }, questionBank: {}, status: "active" };
    const nextSchools = [...(schools || []), newSchool];
    setSchools(nextSchools);
    try {
      const schoolSync = await saveSchoolsToCloud(nextSchools, schoolId);
      if (schoolSync?.ok === false) throw schoolSync.error || new Error("School cloud save failed");
    } catch (err) {
      console.warn("School cloud save failed", err);
      setCsError("Could not sync school to cloud. Check internet, then try again.");
      return;
    }
    const userId = genId();
    const pwHash = await hashPassword(plainPw);
    const newUser = { id: userId, email: emailNorm, password: pwHash, schoolId, name: String(csAdminName).trim(), userType: "principal" };
    await upsertAuthUserToCloud(newUser);
    let verify = await findAuthUserByEmailFromCloud(emailNorm);
    if (!verify) {
      await upsertAuthUserToCloud(newUser);
      verify = await findAuthUserByEmailFromCloud(emailNorm);
    }
    // Cloud is source of truth — do not mirror locally unless cloud verify succeeded
    if (!verify) {
      setCsError(`School is on the cloud, but login for "${emailNorm}" did not save. Use Create Login for "${schoolName}" after checking internet.`);
      await pullUsersFromCloud();
      return;
    }
    await saveAuthUsers([...list, newUser]);
    setCsName(""); setCsEmail(""); setCsAdminName(""); setCsPassword("");
    setCsSuccess(`School "${schoolName}" created. Login is LIVE worldwide — Email: ${emailNorm}`);
    await pullUsersFromCloud();
  };

  const handleDeleteUser = async (userId) => {
    const next = loadAuthUsers().filter(u => u.id !== userId);
    await saveAuthUsers(next, { deletedIds: [userId] });
    refreshUsers();
  };

  const handleToggleBlock = async (userId) => {
    const next = loadAuthUsers().map(u => u.id === userId ? { ...u, blocked: !u.blocked } : u);
    await saveAuthUsers(next);
    refreshUsers();
  };

  const handleChangePassword = async (userId) => {
    if (!editNewPw.trim() || editNewPw.trim().length < 4) { setEditPwError("Min 4 characters."); return; }
    const pwHash = await hashPassword(editNewPw.trim());
    const next = loadAuthUsers().map(u => u.id === userId ? { ...u, password: pwHash } : u);
    await saveAuthUsers(next);
    setEditUserId(null); setEditNewPw(""); setEditPwError("");
    refreshUsers();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col" style={{ fontFamily: UI.fontApp }}>
      {/* Dark header */}
      <header className="bg-slate-800 text-white px-5 py-3 flex items-center gap-3.5 shrink-0">
        <img src={APP_BRAND_LOGO} alt="" className="w-[72px] h-[72px] object-contain rounded-lg bg-white/10 p-1 shrink-0" />
        <div className="flex-1">
          <div className="font-bold text-base">Admin Panel</div>
          <div className="text-xs opacity-65 mt-px">Punjab-SMS — Full Control</div>
        </div>
        <Badge
          title={cloudMsg || (cloudOk ? "Cloud connected — school logins sync to every device" : "Cloud not connected — logins stay on this device only")}
          className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap border ${cloudOk ? "bg-green-500/20 text-green-300 border-green-400/40" : "bg-red-400/20 text-red-300 border-red-300/40"}`}
        >
          {usersSyncing ? "☁ Syncing…" : cloudOk ? "☁ Cloud ON" : "☁ Cloud OFF"}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => pullUsersFromCloud()}
          disabled={usersSyncing}
          className="border-white/25 bg-blue-500/35 text-white hover:bg-blue-500/50 hover:text-white whitespace-nowrap"
        >
          {usersSyncing ? "Syncing…" : "Refresh from cloud"}
        </Button>
        <div className="text-xs opacity-70 text-right leading-snug mr-2 tabular-nums">
          <div>{headerNow.toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" })}</div>
          <div className="font-bold">{headerNow.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
        </div>
        <Button variant="outline" size="sm" onClick={onSignOut} className="border-white/20 bg-white/8 text-white hover:bg-white/15 hover:text-white whitespace-nowrap">Sign Out</Button>
      </header>
      {cloudMsg && (
        <div className={`px-5 py-2 text-xs font-semibold border-b ${cloudOk ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-orange-50 text-orange-800 border-orange-200"}`}>
          {cloudMsg}
        </div>
      )}
      {/* Tab bar */}
      <div className="bg-white border-b border-slate-200 px-5">
        <Tabs value={adminTab} onValueChange={setAdminTab}>
          <TabsList className="bg-transparent border-0 rounded-none h-auto p-0 gap-0">
            {[["users","👥 User Management"],["schools","🏫 School Accounts"],["danger","⚠️ Danger Zone"]].map(([t,label]) => (
              <TabsTrigger
                key={t}
                value={t}
                className="rounded-none border-b-[3px] data-[state=active]:border-slate-800 data-[state=active]:text-slate-800 data-[state=active]:font-bold data-[state=inactive]:border-transparent data-[state=inactive]:text-slate-500 bg-transparent px-4 py-3 text-sm font-medium shadow-none -mb-px"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="flex-1 p-5 overflow-auto">
      <div className="max-w-[900px] mx-auto">

        {/* ── TAB: USER MANAGEMENT ── */}
        {adminTab === "users" && (<>
          <div className="flex justify-end mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pullUsersFromCloud()}
              disabled={usersSyncing}
              className="border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
            >
              {usersSyncing ? "Syncing logins…" : "☁ Refresh logins from cloud"}
            </Button>
          </div>
          {/* Self-signup users */}
          <Card className="mb-5">
            <CardHeader className="pb-1">
              <CardTitle className="text-[15px] text-slate-800">Self-Signup Users</CardTitle>
              <CardDescription className="text-[13px]">Users who registered on their own. You can view their passwords, block/unblock, change password, or delete.</CardDescription>
            </CardHeader>
            <CardContent>
              {usersList.filter(u => u.userType === "local").length === 0 ? (
                <p className="text-[13px] text-slate-500 m-0">No self-signup users yet.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {usersList.filter(u => u.userType === "local").map(u => (
                    <div key={u.id} className={`px-3.5 py-3 rounded-lg border ${u.blocked ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="flex-1 min-w-[160px]">
                          <div className="font-bold text-slate-800 text-sm">{u.name || "—"}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">Password: <strong className="font-mono">{u.password}</strong>{u.blocked && <span className="ml-2 text-red-600 font-bold">BLOCKED</span>}</div>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => { setEditUserId(editUserId === u.id ? null : u.id); setEditNewPw(""); setEditPwError(""); }}>Change PW</Button>
                          <Button variant="outline" size="sm" onClick={() => handleToggleBlock(u.id)} className={u.blocked ? "border-green-600 text-green-700 hover:bg-green-50" : "border-amber-500 text-amber-700 hover:bg-amber-50"}>
                            {u.blocked ? "Unblock" : "Block"}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { if (window.confirm(`Delete user "${u.name || u.email}"?`)) handleDeleteUser(u.id); }} className="border-red-400 text-red-600 hover:bg-red-50">Delete</Button>
                        </div>
                      </div>
                      {editUserId === u.id && (
                        <div className="mt-2.5 flex gap-2 items-center flex-wrap">
                          <Input type="text" value={editNewPw} onChange={e => { setEditNewPw(e.target.value); setEditPwError(""); }} placeholder="New password (min 4)" className="w-auto flex-[1_1_160px]" />
                          <Button size="sm" onClick={() => handleChangePassword(u.id)} className="bg-green-600 hover:bg-green-700 text-white">Save</Button>
                          <Button variant="outline" size="sm" onClick={() => { setEditUserId(null); setEditNewPw(""); setEditPwError(""); }}>Cancel</Button>
                          {editPwError && <span className="text-[12px] text-red-600">{editPwError}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* School account users */}
          <Card className="mb-5">
            <CardHeader className="pb-1">
              <CardTitle className="text-[15px] text-slate-800">School Account Users</CardTitle>
              <CardDescription className="text-[13px]">All school users — principals, operators, and teachers. Principals and school operators can edit/delete marks, students, and staff.</CardDescription>
            </CardHeader>
            <CardContent>
              {usersList.filter(u => u.userType === "school" || u.userType === "admin-created" || u.userType === "principal" || u.userType === "teacher").length === 0 ? (
                <p className="text-[13px] text-slate-500 m-0">No school account users yet.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {usersList.filter(u => u.userType === "school" || u.userType === "admin-created" || u.userType === "principal" || u.userType === "teacher").map(u => {
                    const schoolName = (schools || []).find(s => s.id === u.schoolId)?.settings?.schoolName || (schools || []).find(s => s.id === u.schoolId)?.name || (u.schoolId ? u.schoolId.slice(0,8)+"…" : "—");
                    const roleLabel = u.userType==="principal"?"Principal":u.userType==="teacher"?"Teacher":u.userType==="school"?"School Operator":"Admin-Created";
                    const roleCls = u.userType==="principal"?"bg-green-50 text-green-800":u.userType==="teacher"?"bg-yellow-50 text-yellow-800":u.userType==="school"?"bg-blue-50 text-blue-800":"bg-purple-50 text-purple-800";
                    return (
                      <div key={u.id} className={`px-3.5 py-3 rounded-lg border ${u.blocked ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <div className="flex-1 min-w-[160px]">
                            <div className="font-bold text-slate-800 text-sm">{u.name || "—"} <span className={`text-[11px] px-1.5 py-0.5 rounded ${roleCls} ml-1`}>{roleLabel}</span></div>
                            <div className="text-xs text-slate-500">{u.email} · {schoolName}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">Password: <strong className="font-mono">{u.password}</strong>{u.blocked && <span className="ml-2 text-red-600 font-bold">BLOCKED</span>}</div>
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            <Button variant="outline" size="sm" onClick={() => { setEditUserId(editUserId === u.id ? null : u.id); setEditNewPw(""); setEditPwError(""); }}>Change PW</Button>
                            <Button variant="outline" size="sm" onClick={() => handleToggleBlock(u.id)} className={u.blocked ? "border-green-600 text-green-700 hover:bg-green-50" : "border-amber-500 text-amber-700 hover:bg-amber-50"}>
                              {u.blocked ? "Unblock" : "Block"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { if (window.confirm(`Delete user "${u.name || u.email}"?`)) handleDeleteUser(u.id); }} className="border-red-400 text-red-600 hover:bg-red-50">Delete</Button>
                          </div>
                        </div>
                        {editUserId === u.id && (
                          <div className="mt-2.5 flex gap-2 items-center flex-wrap">
                            <Input type="text" value={editNewPw} onChange={e => { setEditNewPw(e.target.value); setEditPwError(""); }} placeholder="New password (min 4)" className="w-auto flex-[1_1_160px]" />
                            <Button size="sm" onClick={() => handleChangePassword(u.id)} className="bg-green-600 hover:bg-green-700 text-white">Save</Button>
                            <Button variant="outline" size="sm" onClick={() => { setEditUserId(null); setEditNewPw(""); setEditPwError(""); }}>Cancel</Button>
                            {editPwError && <span className="text-[12px] text-red-600">{editPwError}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </>)}

        {/* ── TAB: SCHOOL ACCOUNTS ── */}
        {adminTab === "schools" && (<>
          {/* Create new school */}
          <Card className="mb-5">
            <CardHeader className="pb-1">
              <CardTitle className="text-[15px] text-slate-800">Create New School Account</CardTitle>
              <CardDescription className="text-[13px]">
                {isSupabaseConfigured
                  ? "Creates the school workspace and a principal login synced to the cloud — works on any device worldwide."
                  : "Creates both the school data workspace and a user account on this device."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateSchool} className="flex flex-col gap-3 max-w-[420px]">
                <div className="space-y-1.5"><Label>School Name</Label><Input type="text" value={csName} onChange={e => setCsName(e.target.value)} placeholder="e.g. PSMS Lahore" /></div>
                <div className="space-y-1.5"><Label>Principal / Headmaster Name</Label><Input type="text" value={csAdminName} onChange={e => setCsAdminName(e.target.value)} placeholder="e.g. Mr. Ahmed Khan" /></div>
                <div className="space-y-1.5"><Label>Login Email</Label><Input type="email" value={csEmail} onChange={e => setCsEmail(e.target.value)} placeholder="school@example.edu" /></div>
                <div className="space-y-1.5"><Label>Login Password</Label><Input type="password" value={csPassword} onChange={e => setCsPassword(e.target.value)} placeholder="Min 4 characters" minLength={4} /></div>
                {csError && <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">{csError}</div>}
                {csSuccess && <div className="px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs">{csSuccess}</div>}
                <Button type="submit" className="self-start">Create School &amp; Principal Account</Button>
              </form>
            </CardContent>
          </Card>

          {/* All schools list */}
          <Card className="mb-5">
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between gap-2.5 flex-wrap">
                <div>
                  <CardTitle className="text-[15px] text-slate-800">All Schools</CardTitle>
                  <CardDescription className="text-[13px] mt-0.5">Create Login saves to the worldwide cloud. Any device can sign in with that email/password.</CardDescription>
                </div>
                {isSupabaseConfigured && (
                  <Button variant="outline" size="sm" onClick={() => pullUsersFromCloud()} disabled={usersSyncing} className="border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 shrink-0">
                    {usersSyncing ? "Syncing…" : "☁ Refresh logins"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {(!schools || schools.length === 0) ? (
                <p className="text-[13px] text-slate-500 m-0">No schools registered yet.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {schools.map(s => {
                    const sName = s.settings?.schoolName || s.name || s.id;
                    const status = s.status || "active";
                    const schoolEmail = String(s.settings?.schoolEmail || "").trim().toLowerCase();
                    const linkedUsers = usersList.filter(u => {
                      const em = String(u.email || "").toLowerCase();
                      return u.schoolId === s.id || (schoolEmail && em === schoolEmail);
                    });
                    const hasLogin = linkedUsers.length > 0;
                    return (
                      <div key={s.id} className={`px-3.5 py-3 rounded-lg border ${status === "deleted" ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <div className="flex-[1_1_180px]">
                            <strong className="text-slate-800">{sName}</strong>
                            <span className={`ml-2 text-[11px] px-1.5 py-0.5 rounded ${status === "deleted" ? "bg-red-100 text-red-700" : status === "stopped" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
                              {status === "deleted" ? "Deleted" : status === "stopped" ? "Stopped" : "Active"}
                            </span>
                            {hasLogin && (
                              <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                Login: {linkedUsers.map(u => u.email).join(", ")}
                              </span>
                            )}
                            {!hasLogin && status !== "deleted" && (
                              <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">No login account</span>
                            )}
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            <Button variant="outline" size="sm" onClick={() => setViewDetailsId(viewDetailsId === s.id ? null : s.id)}>Details</Button>
                            {!hasLogin && status !== "deleted" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold"
                                onClick={async () => {
                                  const cloud = await ensureCloudReady();
                                  if (!cloud?.ok) {
                                    alert("Cloud is OFF.\n\nSchool logins only work worldwide when Cloud is ON.\n\nOpen this Admin from the main app URL with internet, click Refresh from cloud, then try again.");
                                    return;
                                  }
                                  const emailDefault = String(s.settings?.schoolEmail || "").trim().toLowerCase();
                                  const email = window.prompt("Login email for this school (works worldwide):", emailDefault || "");
                                  if (email == null) return;
                                  const emailNorm = String(email).trim().toLowerCase();
                                  if (!emailNorm) { alert("Email is required."); return; }
                                  const pw = window.prompt("Temporary password (min 4 characters):", "1234");
                                  if (pw == null) return;
                                  const plainPw = String(pw).trim();
                                  if (plainPw.length < 4) { alert("Password must be at least 4 characters."); return; }
                                  const existingCloud = await findAuthUserByEmailFromCloud(emailNorm);
                                  if (existingCloud) {
                                    alert("This email already exists in the worldwide cloud.\n\nUse that email/password to sign in from any device.");
                                    await pullUsersFromCloud();
                                    return;
                                  }
                                  const list = await hydrateAuthUsersMirror();
                                  if (list.some(u => String(u.email || "").toLowerCase() === emailNorm)) {
                                    // Local has it but cloud didn't — push to cloud so it works worldwide
                                    const localUser = list.find(u => String(u.email || "").toLowerCase() === emailNorm);
                                    if (localUser) {
                                      await upsertAuthUserToCloud(localUser);
                                      const v = await findAuthUserByEmailFromCloud(emailNorm);
                                      await pullUsersFromCloud();
                                      alert(worldwideLoginNote(emailNorm, "(existing password)", { cloudOk: !!v }));
                                      return;
                                    }
                                    alert("A user with this email already exists.");
                                    return;
                                  }
                                  try {
                                    const schoolSync = await saveSchoolsToCloud(schools, s.id);
                                    if (schoolSync?.ok === false) throw schoolSync.error || new Error("School cloud save failed");
                                  } catch (err) {
                                    console.warn("School cloud save failed", err);
                                    alert("Could not sync school to cloud. Check internet, then try Create Login again.");
                                    return;
                                  }
                                  const pwHash = await hashPassword(plainPw);
                                  const newUser = {
                                    id: genId(),
                                    email: emailNorm,
                                    password: pwHash,
                                    schoolId: s.id,
                                    name: s.settings?.principalName || sName,
                                    userType: "principal",
                                  };
                                  // Cloud first — source of truth for the whole world
                                  const upsert = await upsertAuthUserToCloud(newUser);
                                  let verify = await findAuthUserByEmailFromCloud(emailNorm);
                                  if ((!upsert || upsert.ok === false || !verify)) {
                                    // One retry
                                    await upsertAuthUserToCloud(newUser);
                                    verify = await findAuthUserByEmailFromCloud(emailNorm);
                                  }
                                  const ok = !!verify;
                                  if (!ok) {
                                    alert("Cloud save failed. Login was NOT created for other devices.\n\nCheck internet, confirm Cloud ON, then try again.");
                                    return;
                                  }
                                  await saveAuthUsers([...list, newUser]);
                                  await pullUsersFromCloud();
                                  alert(worldwideLoginNote(emailNorm, plainPw, { cloudOk: true }));
                                }}
                              >
                                Create Login
                              </Button>
                            )}
                            {status !== "deleted" && <Button variant="outline" size="sm" onClick={() => { if(window.confirm(`Delete school "${sName}"?`)) setSchoolStatus(s.id, "deleted"); }} className="border-red-400 text-red-600 hover:bg-red-50">Delete</Button>}
                            {status === "active" && <Button variant="outline" size="sm" onClick={() => setSchoolStatus(s.id, "stopped")} className="border-amber-500 text-amber-700 hover:bg-amber-50">Stop</Button>}
                            {status === "stopped" && <Button variant="outline" size="sm" onClick={() => setSchoolStatus(s.id, "active")} className="border-green-600 text-green-700 hover:bg-green-50">Start</Button>}
                            {status === "deleted" && <Button size="sm" onClick={() => setSchoolStatus(s.id, "active")} className="bg-green-600 hover:bg-green-700 text-white">Restore</Button>}
                          </div>
                        </div>
                        {viewDetailsId === s.id && (
                          <div className="mt-2.5 p-2.5 bg-white rounded-md border border-slate-200 text-xs text-slate-700 flex flex-col gap-1">
                            <div><strong>ID:</strong> <span className="font-mono">{s.id}</span></div>
                            <div><strong>School Name:</strong> {s.settings?.schoolName || "—"}</div>
                            <div><strong>School Code:</strong> {s.settings?.schoolCode || "—"}</div>
                            <div><strong>Email:</strong> {s.settings?.schoolEmail || "—"}</div>
                            <div><strong>Principal:</strong> {s.settings?.principalName || "—"}</div>
                            <div><strong>Login accounts:</strong> {hasLogin ? linkedUsers.map(u => u.email).join(", ") : "None — create a login to sign in"}</div>
                            <div><strong>Classes:</strong> {(s.settings?.classes || []).length} · <strong>Students:</strong> {(s.students || []).length} · <strong>Staff:</strong> {(s.staffProfiles || []).length}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>)}

        {/* ── TAB: DANGER ZONE ── */}
        {adminTab === "danger" && (<>
          {/* Reset a single school */}
          <Card className="mb-5 border-red-200">
            <CardHeader className="pb-1">
              <CardTitle className="text-base text-red-700">Reset a School</CardTitle>
              <CardDescription className="text-[13px] text-red-800">Permanently deletes all data for a single school — classes, students, staff, timetable, exam marks, settings. The school record remains but is wiped clean. Cannot be undone.</CardDescription>
            </CardHeader>
            <CardContent>
              {resetSchoolMsg && (
                <p className={`text-[13px] mb-3 ${resetSchoolMsg.startsWith("Reset failed") ? "text-red-700" : "text-green-700"}`}>{resetSchoolMsg}</p>
              )}
              <div className="flex flex-col gap-2">
                {(schools || []).filter(s => s.status !== "deleted").map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-3.5 py-2.5 bg-red-50 rounded-lg">
                    <span className="flex-1 text-[13px] font-semibold text-slate-800">{s.settings?.schoolName || s.name || s.id}</span>
                    <Button variant="destructive" size="sm" disabled={resetSchoolBusyId===s.id} onClick={() => { handleResetSchool(s); }} className="shrink-0">
                      {resetSchoolBusyId===s.id ? "Resetting..." : "Reset School"}
                    </Button>
                  </div>
                ))}
                {(schools || []).filter(s => s.status !== "deleted").length === 0 && <p className="text-[13px] text-red-800 m-0">No active schools.</p>}
              </div>
            </CardContent>
          </Card>
          {/* Full system reset */}
          <Card className="mb-5 border-red-200">
            <CardHeader className="pb-1">
              <CardTitle className="text-base text-red-700">Full System Reset</CardTitle>
              <CardDescription className="text-[13px] text-red-800">Removes all schools, all user accounts, and all data from this device. The app restarts as new with School 1. You will be signed out.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] text-red-800 font-semibold mb-4">This action cannot be undone.</p>
              <Button variant="destructive" onClick={onResetAll} className="bg-red-900 hover:bg-red-800">Reset Everything</Button>
            </CardContent>
          </Card>
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
    await saveAuthUsers(users.map(u=>u.id===session.userId?{...u,password:newHash}:u));
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

  const saveStatusTimeoutRef=useRef(null);
  const cloudSaveTimerRef=useRef(null);
  const cloudRetryTimerRef=useRef(null);
  const cloudPushInFlightRef=useRef(false);
  const skipNextCloudPushRef=useRef(false);
  const cloudReadyRef=useRef(false);
  const schoolsRef=useRef(schools);
  const activeSchoolIdRef=useRef(activeSchoolId);
  const [saveStatus,setSaveStatus]=useState("idle"); // idle | saving | saved | error | offline
  const [cloudReady,setCloudReady]=useState(false);
  const [cloudSyncing,setCloudSyncing]=useState(false);
  const [isOnline,setIsOnline]=useState(()=>typeof navigator==="undefined"?true:navigator.onLine!==false);
  const [lastSyncedAt,setLastSyncedAt]=useState(null);

  useEffect(()=>{ schoolsRef.current=schools; },[schools]);
  useEffect(()=>{ activeSchoolIdRef.current=activeSchoolId; },[activeSchoolId]);
  useEffect(()=>{ cloudReadyRef.current=cloudReady; },[cloudReady]);

  const flushModuleLocalsToCloud=useCallback(async(schoolList)=>{
    if(!getIsSupabaseConfigured()) return;
    if(typeof navigator!=="undefined" && navigator.onLine===false) return;
    const ids=(schoolList||schoolsRef.current||[]).map(s=>s?.id).filter(Boolean);
    for(const schoolId of ids){
      try{
        const att=loadAttendanceFromLocal(schoolId);
        if(att&&Object.keys(att).length) await saveAttendanceToCloud(schoolId, att);
      }catch(e){ console.warn("Attendance cloud flush failed", e); }
      try{
        // Hydrate first so this device does not overwrite newer worldwide fee marks
        const cloudFees=await feeCore.hydrateFeesFromCloud(schoolId);
        const fees=Array.isArray(cloudFees)?cloudFees:feeCore.loadFeeFromLocal(schoolId);
        await saveFeesToCloud(schoolId, fees||[]);
      }catch(e){ console.warn("Fees cloud flush failed", e); }
      try{
        const lib=loadLibraryFromLocal(schoolId);
        if(lib?.books?.length||lib?.borrowings?.length) await saveLibraryToCloud(schoolId, lib);
      }catch(e){ console.warn("Library cloud flush failed", e); }
      try{
        await pushModuleLocalsToCloud(schoolId);
      }catch(e){ console.warn("Module locals cloud flush failed", e); }
    }
    try{
      const msgs=loadDiscussionMessages();
      if(msgs?.length) await saveDiscussionToCloud(msgs);
    }catch(e){ console.warn("Discussion cloud flush failed", e); }
    try{
      const users=loadAuthUsers();
      if(users?.length) await saveAuthUsersToCloud(users);
    }catch(e){ console.warn("Auth users cloud flush failed", e); }
  },[]);

  const pushToCloud=useCallback(async(nextSchools, nextActiveId, { retryCount=0, quiet=false }={})=>{
    if(!getIsSupabaseConfigured()) return;
    if(typeof navigator!=="undefined" && navigator.onLine===false){
      cloudReadyRef.current=false;
      setCloudReady(false);
      setIsOnline(false);
      setSaveStatus("offline");
      return;
    }
    if(cloudPushInFlightRef.current && retryCount===0){
      // Coalesce: another push is running; schedule one follow-up after it finishes.
      // Do NOT clear skipNextCloudPushRef — photo-migration may still need that flag.
      if(cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
      cloudSaveTimerRef.current=setTimeout(()=>{
        pushToCloud(schoolsRef.current, activeSchoolIdRef.current, { quiet:true });
      },2200);
      return;
    }
    const payloadSchools=nextSchools||schoolsRef.current;
    const payloadActiveId=nextActiveId!==undefined?nextActiveId:activeSchoolIdRef.current;
    cloudPushInFlightRef.current=true;
    // Only flash Syncing on first connect or manual sync — keep Cloud steady once ready
    if(!quiet || !cloudReadyRef.current) setCloudSyncing(true);
    if(!quiet) setSaveStatus("saving");
    try{
      const result=await saveSchoolsToCloud(payloadSchools, payloadActiveId);
      if(result?.schools&&Array.isArray(result.schools)){
        const changed=result.schools.some((sc,i)=>{
          const prev=payloadSchools[i];
          if(!prev) return true;
          return JSON.stringify(prev.students)!==JSON.stringify(sc.students)
            || JSON.stringify(prev.staffProfiles)!==JSON.stringify(sc.staffProfiles);
        });
        if(changed){
          // Apply migrated photos without an immediate blinky re-push; follow up quietly for remaining batches
          skipNextCloudPushRef.current=true;
          setSchools(result.schools);
          if(cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
          cloudSaveTimerRef.current=setTimeout(()=>{
            pushToCloud(schoolsRef.current, activeSchoolIdRef.current, { quiet:true });
          },2800);
        }
      }
      if(result?.ok===false) throw result.error||new Error("Cloud save failed");
      await flushModuleLocalsToCloud(payloadSchools);
      setSaveStatus("saved");
      // Ref first (sync), then React state — same order as onOffline
      cloudReadyRef.current=true;
      setCloudReady(true);
      setIsOnline(true);
      setLastSyncedAt(Date.now());
      if(cloudRetryTimerRef.current){ clearTimeout(cloudRetryTimerRef.current); cloudRetryTimerRef.current=null; }
    }catch(err){
      console.warn("Cloud sync failed", err);
      setSaveStatus("error");
      if(retryCount>=2){
        cloudReadyRef.current=false;
        setCloudReady(false);
      }
      if(retryCount<2){
        const delay=2500*(retryCount+1);
        if(cloudRetryTimerRef.current) clearTimeout(cloudRetryTimerRef.current);
        cloudRetryTimerRef.current=setTimeout(()=>{
          pushToCloud(payloadSchools, payloadActiveId, { retryCount: retryCount+1, quiet:true });
        }, delay);
      }
    }finally{
      cloudPushInFlightRef.current=false;
      setCloudSyncing(false);
      if(saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current);
      saveStatusTimeoutRef.current=setTimeout(()=>setSaveStatus("idle"),1600);
    }
  },[flushModuleLocalsToCloud]);

  // Online / offline: resume sync when connection returns
  useEffect(()=>{
    if(!isSupabaseConfigured) return;
    const onOnline=()=>{
      setIsOnline(true);
      if(!loadedFromDb) return;
      saveToLocal(schoolsRef.current, activeSchoolIdRef.current);
      pushToCloud(schoolsRef.current, activeSchoolIdRef.current);
    };
    const onOffline=()=>{
      // Ref first (sync), then React state — badge must not briefly stay "Cloud"
      cloudReadyRef.current=false;
      setCloudReady(false);
      setIsOnline(false);
      setSaveStatus("offline");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return ()=>{
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  },[loadedFromDb,pushToCloud]);

  // Flush debounced cloud save when tab hides or page unloads
  useEffect(()=>{
    if(!isSupabaseConfigured||!loadedFromDb) return;
    const flush=()=>{
      if(cloudSaveTimerRef.current){
        clearTimeout(cloudSaveTimerRef.current);
        cloudSaveTimerRef.current=null;
      }
      saveToLocal(schoolsRef.current, activeSchoolIdRef.current);
      // Fire-and-forget; browsers may kill long async work on unload
      pushToCloud(schoolsRef.current, activeSchoolIdRef.current);
    };
    const onVisibility=()=>{ if(document.visibilityState==="hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return ()=>{
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  },[loadedFromDb,pushToCloud]);

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
      staff:(staffProfiles||[]).map(p=>({
        id:p.id,
        name:p.name||"",
        designation:p.designation||"",
        staffCategory:normalizeStaffCategory(p.staffCategory),
        photo:p.photo||null,
      })),
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

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        if(isSupabaseConfigured){
          const [cloudSchools, cloudUsers]=await Promise.all([
            loadSchoolsFromCloud(),
            loadAuthUsersFromCloud(),
          ]);
          if(cancelled) return;
          {
            // Merge cloud + local; upsert local-only (never wipe other devices' logins)
            const cloudList=Array.isArray(cloudUsers)?cloudUsers:[];
            const localUsers=loadAuthUsers();
            const { merged, localOnly }=mergeAuthUserLists(cloudList, localUsers);
            try{ window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(merged)); }catch{}
            if(localOnly.length) await saveAuthUsersToCloud(localOnly, { replace:false });
            else if(!cloudList.length && merged.length) await saveAuthUsersToCloud(merged, { replace:false });
          }
          if(cloudSchools&&Array.isArray(cloudSchools.schools)&&cloudSchools.schools.length){
            setSchools(cloudSchools.schools);
            if(cloudSchools.activeSchoolId) setActiveSchoolId(cloudSchools.activeSchoolId);
            saveToLocal(cloudSchools.schools, cloudSchools.activeSchoolId);
            for(const s of cloudSchools.schools){
              if(!s?.id) continue;
              try{ await hydrateModuleLocalsFromCloud(s.id); }catch(e){ console.warn("Module locals hydrate failed", e); }
            }
          }else{
            // Seed cloud from whatever is already on this device
            const local=loadFromLocal();
            if(local?.schools?.length){
              await saveSchoolsToCloud(local.schools, local.activeSchoolId);
              for(const s of local.schools){
                if(!s?.id) continue;
                try{ await pushModuleLocalsToCloud(s.id); }catch(e){ console.warn("Module locals seed failed", e); }
              }
            }
          }
          if(!cancelled) setCloudReady(true);
        }
      }catch(err){
        console.warn("Supabase hydrate failed; using local data.", err);
      }finally{
        if(!cancelled) setLoadedFromDb(true);
      }
    })();
    return ()=>{ cancelled=true; };
  },[]);

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
    if(!loadedFromDb) return;
    saveToLocal(schools,activeSchoolId);
    if(!isSupabaseConfigured){
      setSaveStatus("saved");
      if(saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current);
      saveStatusTimeoutRef.current=setTimeout(()=>setSaveStatus("idle"),1200);
      return;
    }
    if(!isOnline){
      setSaveStatus("offline");
      return;
    }
    // Photo-migration / coalesce path sets skip to avoid an immediate blinky re-push.
    // Still guarantee a deferred cloud sync so local≠cloud gap cannot stick.
    if(skipNextCloudPushRef.current){
      skipNextCloudPushRef.current=false;
      queueMicrotask(()=> setSaveStatus("saving"));
      if(!cloudSaveTimerRef.current){
        cloudSaveTimerRef.current=setTimeout(()=>{
          pushToCloud(schoolsRef.current, activeSchoolIdRef.current, { quiet:true });
        },2800);
      }
      return;
    }
    if(cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
    // Local edit queued — show Saving until quiet push finishes (push sets saved/idle)
    queueMicrotask(()=> setSaveStatus("saving"));
    cloudSaveTimerRef.current=setTimeout(()=>{
      pushToCloud(schools,activeSchoolId, { quiet:true });
    },1800);
    return ()=>{
      if(cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
    };
  },[loadedFromDb,schools,activeSchoolId,pushToCloud,isOnline]);


  const setSettingsForActive=(updater)=>{
    setSchools(prev=>prev.map(s=>{
      if(s.id!==activeSchoolId) return s;
      const base={
        ...defaultSettings,
        ...(s.settings||{}),
        classes:Array.isArray(s.settings?.classes)?s.settings.classes:[],
        classSubjects:(s.settings?.classSubjects&&typeof s.settings.classSubjects==="object")?s.settings.classSubjects:{},
        classSubjectsExam:(s.settings?.classSubjectsExam&&typeof s.settings.classSubjectsExam==="object")?s.settings.classSubjectsExam:{},
        classSubjectsTimetable:(s.settings?.classSubjectsTimetable&&typeof s.settings.classSubjectsTimetable==="object")?s.settings.classSubjectsTimetable:{},
      };
      const next=typeof updater==="function"?updater(base):updater;
      return {
        ...s,
        settings:{
          ...defaultSettings,
          ...(next||{}),
          classes:Array.isArray(next?.classes)?next.classes:[],
        },
      };
    }));
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
    if(!confirm("Reset ALL data on this device? Schools, accounts, and local data will be cleared. This cannot be undone.")) return;
    const wipeCloud = isSupabaseConfigured && confirm("Also wipe ALL cloud data on Supabase? Choose Cancel to keep cloud data (other devices stay intact).");
    saveAuthSession(null);
    window.localStorage.removeItem(LOCAL_DATA_KEY);
    window.localStorage.removeItem(ATTENDANCE_DATA_KEY);
    try{ window.localStorage.removeItem("activeSchoolId"); }catch{}
    try{
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("psms_library_") || k.startsWith("exam_TM_") || k.startsWith("exam_OM_") || k === "system_management_fee" || k === "sms_about_discussion_messages_v1") {
          localStorage.removeItem(k);
        }
      }
    }catch{}
    // Clear local accounts only; do not wipe cloud logins unless user confirmed
    try { window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify([])); } catch {}
    if (wipeCloud) {
      try { await clearAllCloudData(); } catch (err) { console.warn("Cloud wipe failed", err); }
    }
    window.location.reload();
  };
  if(session&&session.admin){
    return <AdminPage schools={schools} setSchools={setSchools} setSchoolStatus={setSchoolStatus} onSignOut={()=>{ saveAuthSession(null); setSession(null); }} onResetAll={resetAllData}/>;
  }
  // Teachers cannot access Settings; principals and all others can
  const isTeacher = session?.userType === "teacher";
  const nav = isTeacher ? APP_MAIN_NAV.filter(n => n.id !== "settings" && n.id !== "staff" && n.id !== "academic") : APP_MAIN_NAV;
  if(session===null){
    return <AuthScreen onSignIn={(s)=>{ setSession(s); if(s.schoolId) setActiveSchoolId(s.schoolId); }} setActiveSchoolId={setActiveSchoolId}/>;
  }
  return (
    <>
      <style>{PRINT_CSS}</style>
    <style>{MOBILE_CSS}</style>
    <div
      className={page==="timetable"?"app-layout app-page-timetable":"app-layout"}
      style={{
        display:"flex",
        flexDirection:"column",
        overflow:"hidden",
        fontFamily:UI.fontApp,
        background:"#ffffff",
        padding:"0 max(0px, env(safe-area-inset-right)) max(0px, env(safe-area-inset-bottom)) max(0px, env(safe-area-inset-left))",
        boxSizing:"border-box",
        // Keep zoom at 1 for the shadcn shell — CSS zoom cracks the fixed sidebar on Timetable.
        zoom: 1,
        width: "100vw",
        maxWidth: "100vw",
        height: "100dvh",
        minHeight: "100dvh",
        ["--psms-zoom"]: "1",
      }}
    >
      <AppDashboardShell
        className="h-full min-h-0 flex-1"
        nav={nav}
        page={page}
        onNavigate={(id)=>startTransition(()=>setPage(id))}
        schoolName={effectiveSettings.schoolName}
        schoolCode={effectiveSettings.schoolCode}
        pageTitle={nav.find(n=>n.id===page)?.l || "Page"}
        pageSubtitle={barSubtitle}
        currentUser={currentUser}
        session={session}
        roleLabel={isTeacher?(session?.name||"Teacher"):(effectiveSettings.principalName||"Principal / Headmaster")}
        isSupabaseConfigured={isSupabaseConfigured}
        isOnline={isOnline}
        cloudReady={cloudReady}
        cloudSyncing={cloudSyncing}
        onSignOut={signOut}
        onChangePassword={()=>setShowChangePw(true)}
      >
          {page==="dashboard"&&(
            <DashboardPage
              settings={effectiveSettings}
              students={students}
              staffProfiles={staffProfiles}
              exam_tm={exam_tm}
              exam_om={exam_om}
              exam_datesheet={exam_datesheet}
              activeSchoolId={activeSchoolId}
              currentSession={curSession}
              onNavigate={(id)=>startTransition(()=>setPage(id))}
              setBarSubtitle={setBarSubtitle}
            />
          )}
          {page==="students"&&(
            <StudentsModulePage
              settings={effectiveSettings}
              students={students}
              setStudents={setStudentsForActive}
              currentSession={curSession}
              currentUser={currentUser}
              activeSchoolId={activeSchoolId}
              setBarSubtitle={setBarSubtitle}
            />
          )}
          {page==="staff"&&(
            <StaffModulePage
              settings={effectiveSettings}
              schools={schools}
              setSchools={setSchools}
              staffProfiles={staffProfiles}
              staffTransferHistory={activeSchool.staffTransferHistory||[]}
              retiredStaff={activeSchool.retiredStaff||[]}
              activeSchoolId={activeSchoolId}
              currentSession={curSession}
              setBarSubtitle={setBarSubtitle}
            />
          )}
          {page==="academic"&&!isTeacher&&(
            <AcademicModulePage
              settings={effectiveSettings}
              setSettings={setSettingsForActive}
              students={students}
              sessions={activeSchool.sessions||[curSession]}
              currentSession={curSession}
              setCurrentSession={setCurrentSessionForActive}
              addSession={addSessionForActive}
              exam_datesheet={exam_datesheet}
              onNavigate={(id)=>startTransition(()=>setPage(id))}
              setBarSubtitle={setBarSubtitle}
            />
          )}
          {page==="timetable"&&<TimetablePage settings={effectiveSettings} staffProfiles={staffProfiles} timetable={timetable} setTimetable={setTimetable} currentSession={curSession} setBarSubtitle={setBarSubtitle}/>}
          {page==="attendance"&&(
            <AttendanceLeaveModulePage
              settings={effectiveSettings}
              students={students}
              setStudents={setStudentsForActive}
              staffProfiles={staffProfiles}
              setSchools={setSchools}
              activeSchoolId={activeSchoolId}
              currentSession={curSession}
              setBarSubtitle={setBarSubtitle}
              canManageStaff={!isTeacher}
            />
          )}
          {page==="fees"&&(
            <FeeFinanceModulePage
              settings={effectiveSettings}
              setSettings={setSettingsForActive}
              students={students}
              activeSchoolId={activeSchoolId}
              setBarSubtitle={setBarSubtitle}
            />
          )}
          {page==="examination"&&<ExaminationErrorBoundary><ExaminationPage settings={effectiveSettings} setSettings={setSettingsForActive} students={students} setStudents={setStudentsForActive} timetable={timetable} exam_tm={exam_tm} exam_om={exam_om} setExamMarks={setExamMarksForActive} exam_datesheet={exam_datesheet} setDatesheet={setDatesheetForActive} currentSession={curSession} currentUser={currentUser} activeSchoolId={activeSchoolId} setBarSubtitle={setBarSubtitle}/></ExaminationErrorBoundary>}
          {page==="daily-register"&&(
            <DailyRegisterPage
              settings={effectiveSettings}
              students={students}
              activeSchoolId={activeSchoolId}
              currentSession={curSession}
              setBarSubtitle={setBarSubtitle}
            />
          )}
          {page==="paper"&&<PaperGeneratorPage settings={effectiveSettings} questionBank={activeSchool.questionBank||{}} setQuestionBank={updater=>setSchools(prev=>prev.map(s=>s.id===activeSchoolId?{...s,questionBank:typeof updater==="function"?updater(s.questionBank||{}):updater}:s))} setBarSubtitle={setBarSubtitle}/>}
          {page==="card"&&<CardGeneratorPage settings={effectiveSettings} students={students} currentSession={curSession} staffProfiles={staffProfiles} setBarSubtitle={setBarSubtitle}/>}
          {page==="book-bank"&&<BookBankPage setBarSubtitle={setBarSubtitle}/>}
          {page==="library"&&(
            <LibraryModulePage
              settings={effectiveSettings}
              students={students}
              activeSchoolId={activeSchoolId}
              setBarSubtitle={setBarSubtitle}
            />
          )}
          {page==="about"&&<AboutUsPage />}
          {page==="settings"&&!isTeacher&&<SettingsPage settings={effectiveSettings} setSettings={setSettingsForActive} setSchools={setSchools} students={students} setStudents={setStudentsForActive} schools={schools} activeSchoolId={activeSchoolId} timetable={timetable} exam_tm={exam_tm} exam_om={exam_om} setExamMarks={setExamMarksForActive} currentSession={curSession} sessions={activeSchool.sessions||[curSession]} setCurrentSession={setCurrentSessionForActive} addSession={addSessionForActive} staffProfiles={staffProfiles} setBarSubtitle={setBarSubtitle} session={session}/>}
      </AppDashboardShell>
      <PWAInstallBanner />
    </div>
    <Dialog
      open={showChangePw}
      onOpenChange={(open)=>{
        setShowChangePw(open);
        if(!open){ setChangePwError(""); setChangePwSuccess(""); }
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>Update the password for your signed-in account.</DialogDescription>
        </DialogHeader>
        {changePwError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {changePwError}
          </div>
        ) : null}
        {changePwSuccess ? (
          <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
            {changePwSuccess}
          </div>
        ) : null}
        <div className="grid gap-3">
          {[
            ["Current Password", changePwCurrent, setChangePwCurrent],
            ["New Password", changePwNew, setChangePwNew],
            ["Confirm New Password", changePwConfirm, setChangePwConfirm],
          ].map(([lbl, val, setter]) => (
            <div key={lbl} className="grid gap-1.5">
              <Label htmlFor={`pw-${lbl}`}>{lbl}</Label>
              <Input
                id={`pw-${lbl}`}
                type="password"
                value={val}
                onChange={(e) => setter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleChangeOwnPassword();
                }}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowChangePw(false);
              setChangePwError("");
              setChangePwSuccess("");
            }}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleChangeOwnPassword} disabled={changePwLoading}>
            {changePwLoading ? "Saving…" : "Change Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

export default App;
