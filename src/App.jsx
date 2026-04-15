import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, startTransition } from "react";
import {
  verifyPassword,
  hashPassword,
} from "./cloudSync.js";
import { createPortal } from "react-dom";
import * as XLSX from "./xlsxClient.js";
import JSZip from "./jszipClient.js";
import jsPDFModule from "jspdf";
import autoTable from "jspdf-autotable";

/** Vite `needsInterop` can wrap `jspdf` so `{ jsPDF }` is not the constructor; default + fallbacks are reliable. */
const jsPDF =
  typeof jsPDFModule === "function"
    ? jsPDFModule
    : jsPDFModule?.jsPDF ?? jsPDFModule?.default;
import html2canvas from "html2canvas";
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
import signImg from "./assets/sign.png";

/** Main shell navigation (left sidebar). */
const APP_MAIN_NAV = [
  { id: "dashboard", l: "Dashboard", i: "🏠" },
  { id: "timetable", l: "Timetable", i: "📅" },
  { id: "attendance", l: "Attendance", i: "📋" },
  { id: "fees", l: "Fees", i: "💳" },
  { id: "examination", l: "Examination", i: "📝" },
  { id: "paper", l: "Paper Generator", i: "📄" },
  { id: "card", l: "Card Generator", i: "💳" },
  { id: "book-bank", l: "Book Bank", i: "📚" },
  { id: "library", l: "Library", i: "📖" },
  { id: "about", l: "About Us", i: "ℹ️" },
  { id: "settings", l: "Settings", i: "⚙️" },
];

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
// Colors use CSS variables so light/dark theme can switch via data-theme on :root
const C = {
  navy: "var(--color-navy)",
  navyL: "var(--color-navy-soft)",
  gold: "var(--color-gold)",
  green: "var(--color-green)",
  red: "var(--color-red)",
  gray: "var(--color-gray)",
  grayL: "var(--color-gray-soft)",
  breakC: "var(--break-main)",
  breakL: "var(--break-soft)",
};
/** System emblem from `public/app-brand-logo.png`. School upload in settings overrides prints/cards only. */
const APP_BRAND_LOGO = APP_BRAND_LOGO_URL;
function schoolOrBrandLogo(logo) {
  return logo || APP_BRAND_LOGO;
}
const RESULT_CARD_BORDER_URL = "";
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2,6)}`;

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

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getPeriodLabel(idx,settings){
  const n=idx+1;
  const prefix=settings&&settings.periodLabelPrefix!=null?settings.periodLabelPrefix:"P-";
  return `${prefix}${n}`;
}

function formatGradeLabel(grade) { return systemSettingsService?.formatGradeLabel?.(grade) || ""; }
function formatClassDisplay(cls) { return systemSettingsService?.formatClassDisplay?.(cls) || ""; }
function resolveClass(classes, classId) { return systemSettingsService?.resolveClass?.(classes, classId) || null; }
function getClassLabel(settingsOrClasses, classId) { return systemSettingsService?.getClassLabel?.(settingsOrClasses, classId) || String(classId || ""); }
function normKey(x) { return systemSettingsService?.normKey?.(x) || String(x || "").trim().toLowerCase(); }

function getClassSubjects(settings,classId,type="exam"){
  if(!classId) return [];
  const source=type==="timetable" ? settings?.classSubjectsTimetable : settings?.classSubjectsExam;
  if(source&&Array.isArray(source[classId])) return source[classId];
  const legacy=settings?.classSubjects;
  if(legacy&&Array.isArray(legacy[classId])) return legacy[classId];
  return [];
}
function isTeachingStaffMember(staff){
  if(!staff) return false;
  const rawCat=String(staff.staffCategory||"").trim().toLowerCase();
  if(rawCat){
    if(rawCat.includes("non teaching")||rawCat.includes("non-teaching")||rawCat.includes("worker")) return false;
    if(rawCat.includes("teaching")||rawCat.includes("teacher")) return true;
  }
  const d=String(staff.designation||staff.role||"").trim().toLowerCase();
  if(!d) return true;
  if(d.includes("clerk")||d.includes("peon")||d.includes("naib")||d.includes("qasid")||d.includes("chowkidar")||d.includes("sweeper")||d.includes("driver")||d.includes("support")||d.includes("non teaching")||d.includes("non-teaching")||d.includes("labour")||d.includes("labor")) return false;
  return true;
}
function teachingStaffList(settings,staffProfiles){
  const list=Array.isArray(settings?.staff)?settings.staff:[];
  const profiles=Array.isArray(staffProfiles)?staffProfiles:[];
  const catByName=new Map(
    profiles
      .filter(p=>p&&p.name)
      .map(p=>[String(p.name).trim().toLowerCase(),String(p.staffCategory||"").trim().toLowerCase()])
  );
  return list.filter(st=>{
    const key=String(st?.name||"").trim().toLowerCase();
    const cat=catByName.get(key)||"";
    if(cat.includes("non teaching")||cat.includes("non-teaching")||cat.includes("worker")) return false;
    return isTeachingStaffMember(st);
  });
}

/** Normalize numeric roll so "01" and "1" match. */
function normalizeRollNo(roll){
  const s=normKey(roll);
  if(/^\d+$/.test(s)){
    const n=parseInt(s,10);
    return Number.isNaN(n)?s:String(n);
  }
  return s;
}
function findStudentByAdmissionNo(students,admissionNo,excludeId){
  const k=normKey(admissionNo);
  if(!k) return null;
  for(const s of students||[]){
    if(excludeId&&s.id===excludeId) continue;
    if(normKey(s.admissionNo)===k) return s;
  }
  return null;
}
function getRollNumberScopeClassIds(classes,classId,commonTeachers){
  const filterCls=resolveClass(classes,classId);
  if(!filterCls) return [normKey(classId)];
  const grade=String(filterCls.grade||"").trim();
  const gradeCommon=commonTeachers?.[grade]||{};
  const hasAnyCommon=Object.values(gradeCommon).some(Boolean);
  if(!hasAnyCommon) return [String(filterCls.id)];
  const sameGradeSectionClasses=(classes||[]).filter(c=>
    String(c.grade||"").trim()===grade&&String(c.section||"").trim()
  );
  if(sameGradeSectionClasses.length<2) return [String(filterCls.id)];
  return sameGradeSectionClasses.map(c=>String(c.id));
}
function findStudentByRollInClass(students,classes,classId,rollNo,excludeId,commonTeachers){
  const rk=normalizeRollNo(rollNo);
  if(!rk) return null;
  const filterCls=resolveClass(classes,classId);
  const scopeIds=new Set(getRollNumberScopeClassIds(classes,classId,commonTeachers));
  for(const s of students||[]){
    if(excludeId&&s.id===excludeId) continue;
    const sc=resolveClass(classes,s.classId);
    const same=filterCls&&sc?scopeIds.has(String(sc.id)):scopeIds.has(normKey(s.classId));
    if(!same) continue;
    if(normalizeRollNo(s.rollNo)===rk) return s;
  }
  return null;
}
function maxNumericFromAdmissionStrings(students){
  let max=0;
  for(const s of students||[]){
    const a=String(s.admissionNo||"").trim();
    if(!a) continue;
    const digits=a.replace(/\D/g,"");
    if(digits){
      const n=parseInt(digits,10);
      if(!Number.isNaN(n)) max=Math.max(max,n);
    }
  }
  return max;
}
function nextAdmissionNo(students){
  return String(maxNumericFromAdmissionStrings(students)+1);
}
function maxRollInClass(students,classes,classId,commonTeachers){
  const filterCls=resolveClass(classes,classId);
  const scopeIds=new Set(getRollNumberScopeClassIds(classes,classId,commonTeachers));
  const list=(students||[]).filter(s=>{
    const sc=resolveClass(classes,s.classId);
    if(filterCls&&sc) return scopeIds.has(String(sc.id));
    return scopeIds.has(normKey(s.classId));
  });
  let max=0;
  for(const s of list){
    const r=String(s.rollNo||"").trim();
    if(/^\d+$/.test(r)){
      const n=parseInt(r,10);
      if(!Number.isNaN(n)) max=Math.max(max,n);
    }
  }
  return max;
}
function nextRollNoForClass(students,classes,classId,commonTeachers){
  return String(maxRollInClass(students,classes,classId,commonTeachers)+1);
}
/**
 * Excel import: strip Adm# when it duplicates another person (within file or vs DB). Keeps row data.
 */
function stripDuplicateAdmissionsForImport(importedStudents,merged,allClasses){
  const nn=v=>String(v||"").trim().toLowerCase();
  const sameClass=(a,b)=>{
    if(!a&&!b) return true;
    if(a===b) return true;
    const ca=resolveClass(allClasses,a);
    const cb=resolveClass(allClasses,b);
    return ca&&cb&&ca.id===cb.id;
  };
  const byAdmission=new Map();
  merged.forEach((s,idx)=>{ if(s.admissionNo) byAdmission.set(nn(s.admissionNo),idx); });
  const seenAdmInFile=new Set();
  let strippedCount=0;
  const list=importedStudents.map(imp=>{
    let admissionNo=imp.admissionNo;
    if(admissionNo&&seenAdmInFile.has(nn(admissionNo))){
      admissionNo="";
      strippedCount++;
    }else if(admissionNo){
      const idx=byAdmission.get(nn(admissionNo));
      if(idx!==undefined&&idx>=0){
        const ex=merged[idx];
        const samePerson=nn(ex.name)===nn(imp.name)&&nn(ex.fatherName)===nn(imp.fatherName)&&sameClass(ex.classId,imp.classId);
        if(!samePerson){
          admissionNo="";
          strippedCount++;
        }
      }
    }
    if(admissionNo) seenAdmInFile.add(nn(admissionNo));
    return {...imp,admissionNo};
  });
  return {list,strippedCount};
}
/** Keep in sync with package.json @imgly/background-removal version (WASM/model CDN path). */
const IMGLY_BACKGROUND_REMOVAL_DATA_VER="1.7.0";
const IMGLY_BG_MODEL_BASE_URL=`https://staticimgly.com/@imgly/background-removal-data/${IMGLY_BACKGROUND_REMOVAL_DATA_VER}/dist/`;

async function processStudentPhotoWithBackground(file){
  const compositeToWhiteJpeg=(src)=>{
    const sw="naturalWidth" in src&&src.naturalWidth?src.naturalWidth:src.width;
    const sh="naturalHeight" in src&&src.naturalHeight?src.naturalHeight:src.height;
    const MAX_W=400,MAX_H=500;
    let w=sw,h=sh;
    if(!w||!h) return null;
    const ratio=Math.min(MAX_W/w,MAX_H/h,1);
    w=Math.round(w*ratio); h=Math.round(h*ratio);
    const canvas=document.createElement("canvas");
    canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#ffffff";
    ctx.fillRect(0,0,w,h);
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality="high";
    ctx.drawImage(src,0,0,w,h);
    return canvas.toDataURL("image/jpeg",0.88);
  };
  const fallbackFromFile=()=>new Promise(resolve=>{
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=async ()=>{
      URL.revokeObjectURL(url);
      try{ if(img.decode) await img.decode(); }catch{ /* ignore */ }
      resolve(compositeToWhiteJpeg(img)||"");
    };
    img.onerror=()=>{
      URL.revokeObjectURL(url);
      const r=new FileReader();
      r.onload=e=>resolve(e.target.result);
      r.readAsDataURL(file);
    };
    img.src=url;
  });
  try{
    const { removeBackground }=await import("@imgly/background-removal");
    const blob=await removeBackground(file,{
      publicPath:IMGLY_BG_MODEL_BASE_URL,
      model:"isnet_quint8",
      device:"cpu",
      output:{format:"image/png"},
    });
    if(!blob||blob.size===0) throw new Error("empty result from background removal");
    if(typeof createImageBitmap==="function"){
      try{
        const bmp=await createImageBitmap(blob);
        try{
          const out=compositeToWhiteJpeg(bmp);
          if(out) return out;
        }finally{ bmp.close(); }
      }catch{ /* fall through to Image() */ }
    }
    const objUrl=URL.createObjectURL(blob);
    return await new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=async ()=>{
        URL.revokeObjectURL(objUrl);
        try{ if(img.decode) await img.decode(); }catch{ /* ignore */ }
        const out=compositeToWhiteJpeg(img);
        if(out) resolve(out);
        else reject(new Error("composite failed"));
      };
      img.onerror=()=>{
        URL.revokeObjectURL(objUrl);
        reject(new Error("PNG decode failed"));
      };
      img.src=objUrl;
    });
  }catch(e){
    console.warn("Background removal failed, using fallback",e);
    return fallbackFromFile();
  }
}
/**
 * One row per pupil when admission is missing or class_id strings differ across sync (e.g. operator devices).
 * Prefers the record with more filled fields.
 */
function dedupeStudentsByIdentity(students,classes){
  if(!Array.isArray(students)||students.length<2) return students;
  const clsList=Array.isArray(classes)?classes:[];
  const canonClassId=(classId)=>{
    if(!classId||!clsList.length) return normKey(classId)||"__none__";
    const r=resolveClass(clsList,classId);
    return r?r.id:(normKey(classId)||"__none__");
  };
  const richness=(st)=>
    (normKey(st.admissionNo)?4:0)+
    (normKey(st.bayForm)?1:0)+
    (normKey(st.fatherCnic)?1:0)+
    (normKey(st.whatsapp)?1:0)+
    (String(st.photo||"").length>30?1:0)+
    (Array.isArray(st.personalInfoHistory)?Math.min(st.personalInfoHistory.length,5):0)+
    (st.personalInfoLockSession?1:0);
  const keyOf=(st)=>{
    const adm=normKey(st.admissionNo);
    const roll=normalizeRollNo(st.rollNo);
    const cls=canonClassId(st.classId);
    const name=normKey(st.name);
    const fname=normKey(st.fatherName);
    if(adm) return `a:${adm}|${cls}`;
    if(roll) return `r:${roll}|${name}|${fname}|${cls}`;
    return `id:${st.id}`;
  };
  const pick=new Map();
  for(const st of students){
    const k=keyOf(st);
    const prev=pick.get(k);
    if(!prev){ pick.set(k,st); continue; }
    if(richness(st)>richness(prev)) pick.set(k,st);
  }
  return Array.from(pick.values());
}

function fmtMin(m){
  if(m===undefined||m===null) return "--";
  const h=Math.floor(m/60), mm=m%60;
  const sfx=h>=12?"PM":"AM", hh=h>12?h-12:h===0?12:h;
  return `${hh}:${String(mm).padStart(2,"0")} ${sfx}`;
}
function academicSession(d=new Date()){
  const y=d.getFullYear();
  const m=d.getMonth(); // 0-indexed
  // Session changes in April: e.g. Apr 2025 -> 2025-2026, Jan 2025 -> 2024-2025
  if(m>=3) return `${y}-${y+1}`;
  return `${y-1}-${y}`;
}

function calcTimes(settings, day){
  const isFri=day==="Friday", isSat=day==="Saturday";
  const key=isFri?"friday":isSat?"saturday":"mondayToThursday";
  const [h,m]=settings.schoolHours[key].start.split(":").map(Number);
  let mins=h*60+m;
  const assStart=mins, assEnd=mins+settings.assemblyTime;
  mins=assEnd;
  const brReq=isFri?settings.fridayBreak:settings.breakRequired;
  const brAfter=isFri?settings.fridayBreakAfter:settings.breakAfterPeriod;
  const brDur=isFri?settings.fridayBreakDuration:settings.breakDuration;
  const rows=[];
  for(let i=0;i<settings.periodsPerDay;i++){
    const s=mins, dur=i===0?settings.firstPeriodTime:settings.otherPeriodTime;
    mins+=dur;
    rows.push({isBreak:false, idx:i, start:s, end:mins});
    if(brReq&&(i+1)===brAfter){ rows.push({isBreak:true, start:mins, end:mins+brDur}); mins+=brDur; }
  }
  return {assStart, assEnd, rows};
}

function getTT(tt,cls,day,pi){ return tt?.[cls]?.[day]?.[pi]||{subject:"",teacher:""}; }
function setTT(setFn,cls,day,pi,val){ setFn(p=>{ const c=p[cls]||{}, n={...c}; ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].forEach(d=>n[d]={...(c[d]||{}),[pi]:val}); return {...p,[cls]:n}; }); }
function parseABVariantSubject(subject){
  const s=String(subject||"").trim();
  if(!s) return null;
  let m=s.match(/^(.*?)(?:\s*\(\s*([ABab])\s*\))\s*$/);
  if(!m) m=s.match(/^(.*?)(?:\s*\[\s*([ABab])\s*\])\s*$/);
  if(!m) m=s.match(/^(.*?)(?:\s+Part\s*([ABab]))\s*$/i);
  if(!m) m=s.match(/^(.*?)[\s\-–—]+\s*([ABab])\s*$/);
  if(!m) return null;
  const base=String(m[1]||"").trim().toLowerCase();
  const variant=String(m[2]||"").trim().toUpperCase();
  if(!base||(variant!=="A"&&variant!=="B")) return null;
  return {base,variant};
}
function isABCounterpartSubject(a,b){
  const pa=parseABVariantSubject(a);
  const pb=parseABVariantSubject(b);
  if(!pa||!pb) return false;
  return pa.base===pb.base&&pa.variant!==pb.variant;
}

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────
function Btn({children,onClick,color,small,danger,outline,disabled,style:sx,type}){
  const bg=danger?C.red:outline?"transparent":(color||C.navy);
  const tc=outline?(color||C.navy):"#fff";
  const bd=outline?`1.5px solid ${color||C.navy}`:"none";
  const radius=8;
  return <button
    type={type||"button"}
    onClick={onClick}
    disabled={disabled}
    style={{
      background:bg,
      color:tc,
      border:bd,
      borderRadius:radius,
      padding:small?"5px 12px":"8px 18px",
      fontSize:small?12:13,
      cursor:disabled?"not-allowed":"pointer",
      fontWeight:600,
      opacity:disabled?0.55:1,
      whiteSpace:"nowrap",
      boxShadow:outline||disabled?"none":"0 8px 18px rgba(15,23,42,0.18)",
      transform:"translateY(0)",
      transition:"background 0.18s ease,box-shadow 0.18s ease,transform 0.1s ease",
      ...sx
    }}
    onMouseEnter={e=>{ if(disabled) return; e.currentTarget.style.transform="translateY(-1px)"; e.currentTarget.style.boxShadow=outline?"0 0 0 1px rgba(148,163,184,0.7)":"0 10px 22px rgba(15,23,42,0.22)"; }}
    onMouseLeave={e=>{ if(disabled) return; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow=outline||disabled?"none":"0 8px 18px rgba(15,23,42,0.18)"; }}
  >
    {children}
  </button>;
}
function Sel({label,value,onChange,options,width,className,selectClassName,touchFriendly}){
  const fullW=width==="100%";
  return <div className={className||undefined} style={{display:"flex",flexDirection:"column",gap:3,minWidth:fullW?0:undefined,width:fullW?"100%":undefined}}>
    {label&&<label style={{fontSize:11,fontWeight:700,color:C.gray,textTransform:"uppercase",letterSpacing:0.4}}>{label}</label>}
    <select
      className={selectClassName||undefined}
      value={value}
      onChange={e=>onChange(e.target.value)}
      style={{
        padding:touchFriendly?"10px 12px":"4px 10px",
        height:touchFriendly?undefined:28,
        minHeight:touchFriendly?44:undefined,
        border:"1.5px solid #d1d5db",
        borderRadius:7,
        fontSize:touchFriendly?16:13,
        lineHeight:touchFriendly?1.25:undefined,
        background:"#fff",
        width:width||"auto",
        maxWidth:fullW?"100%":undefined,
        boxSizing:"border-box",
        cursor:"pointer",
        boxShadow:"0 1px 2px rgba(15,23,42,0.06)",
        transition:"border-color 0.18s ease,box-shadow 0.18s ease",
        ...(touchFriendly?{WebkitAppearance:"menulist"}:{})
      }}
      onFocus={e=>{e.currentTarget.style.borderColor=C.navy; e.currentTarget.style.boxShadow="0 0 0 3px rgba(37,99,235,0.25)";}}
      onBlur={e=>{e.currentTarget.style.borderColor="#d1d5db"; e.currentTarget.style.boxShadow="0 1px 2px rgba(15,23,42,0.06)";}}
    >
      {options.map(o=><option key={typeof o==="string"?o:o.value} value={typeof o==="string"?o:o.value}>{typeof o==="string"?o:o.label}</option>)}
    </select>
  </div>;
}
function Inp({label,value,onChange,type="text",width,...rest}){
  return <div style={{display:"flex",flexDirection:"column",gap:3}}>
    {label&&<label style={{fontSize:11,fontWeight:700,color:C.gray,textTransform:"uppercase",letterSpacing:0.4}}>{label}</label>}
    <input
      type={type}
      value={value}
      onChange={e=>onChange(e.target.value)}
      style={{
        padding:"7px 10px",
        border:"1.5px solid #d1d5db",
        borderRadius:7,
        fontSize:13,
        width:width||"auto",
        boxSizing:"border-box",
        boxShadow:"0 1px 2px rgba(15,23,42,0.06)",
        transition:"border-color 0.18s ease,box-shadow 0.18s ease"
      }}
      onFocus={e=>{e.currentTarget.style.borderColor=C.navy; e.currentTarget.style.boxShadow="0 0 0 3px rgba(37,99,235,0.25)";}}
      onBlur={e=>{e.currentTarget.style.borderColor="#d1d5db"; e.currentTarget.style.boxShadow="0 1px 2px rgba(15,23,42,0.06)";}}
      {...rest}
    />
  </div>;
}

function SchoolHeader({settings,subtitle,rightText,session,printOrder}){
  const dateStr=new Date().toLocaleDateString("en-PK",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  const timeStr=new Date().toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"});
  const dateTime=rightText?null:(
    <>
      {session&&<div style={{fontWeight:600}}>Session: {session}</div>}
      <div>Date: {dateStr}</div>
      <div>Time: {timeStr}</div>
    </>
  );
  if(printOrder){
    return (
      <div className="print-header-universal" style={{
        display:"flex",alignItems:"center",gap:20,padding:"14px 20px",
        borderBottom:`2px solid ${C.navy}`,marginBottom:14,flexWrap:"wrap",
        background:"#fafbfc",
      }}>
        <div style={{flexShrink:0}}>
          <img src={schoolOrBrandLogo(settings.logo)} style={{width:112,height:112,borderRadius:8,objectFit:"cover",border:`1px solid ${C.navy}`}} alt="School logo"/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:17,color:C.navy,letterSpacing:"0.02em"}}>{settings.schoolName||"School Name"}</div>
          {subtitle&&<div style={{fontSize:13,color:C.gray,marginTop:4,fontWeight:600}}>{subtitle}</div>}
        </div>
        <div style={{fontSize:11,color:C.gray,textAlign:"right",lineHeight:1.5}}>
          {rightText?(<>{(String(rightText).split(" | ").map((p,i)=><div key={i} style={{fontWeight:i===0?700:500}}>{p}</div>))}{session&&<div style={{fontWeight:600,marginTop:2}}>Session: {session}</div>}</>):dateTime}
        </div>
      </div>
    );
  }
  return <div className="print-header-universal" style={{display:"flex",alignItems:"center",gap:14,padding:"10px 18px",borderBottom:`2px solid ${C.navy}`,marginBottom:10}}>
    <img src={schoolOrBrandLogo(settings.logo)} style={{width:96,height:96,borderRadius:"50%",objectFit:"cover",flexShrink:0}} alt=""/>
    <div style={{flex:1,textAlign:"center"}}>
      <div style={{fontWeight:700,fontSize:15,color:C.navy}}>{settings.schoolName}</div>
      {subtitle&&<div style={{fontSize:12,color:C.gray,marginTop:2}}>{subtitle}</div>}
    </div>
    <div style={{fontSize:11,color:C.gray,textAlign:"right"}}>
      {rightText?(<>{(String(rightText).split(" | ").map((p,i)=><div key={i} style={{fontWeight:i===0?700:500}}>{p}</div>))}{session&&<div style={{fontWeight:600,marginTop:2}}>Session: {session}</div>}</>):dateTime}
    </div>
  </div>;
}

/** Result card / print / Save as PDF: logo | school + title | time/session; then Exam | Class | Pass % | Date (row under logo). */
function ResultCardHeader({ settings, sessionLabel, examLabel, className }) {
  const passPctNum = Number(settings?.passPercent);
  const passPercentLabel = `${Number.isFinite(passPctNum) ? Math.max(0, Math.min(100, passPctNum)) : 50}%`;
  const dateStr = new Date().toLocaleDateString("en-PK", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const pipeStyle = { margin: "0 8px", color: "#9ca3af", fontWeight: 300 };
  return (
    <div
      className="result-card-doc-header print-header-universal"
      style={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr) auto",
        gridTemplateRows: "auto auto",
        rowGap: 4,
        columnGap: 14,
        alignItems: "center",
        padding: "10px 16px",
        borderBottom: `2px solid ${C.navy}`,
        marginBottom: 12,
        background: "#fafbfc",
      }}
    >
      <div style={{ gridColumn: 1, gridRow: 1, alignSelf: "center" }}>
        <img
          src={schoolOrBrandLogo(settings?.logo)}
          alt=""
          style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", border: `1px solid ${C.navy}` }}
        />
      </div>
      <div
        style={{
          gridColumn: 2,
          gridRow: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 8px",
        }}
      >
        <div
          title={settings?.schoolName || "School Name"}
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: C.navy,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
            width: "100%",
          }}
        >
          {settings?.schoolName || "School Name"}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            fontWeight: 700,
            color: C.gray,
            letterSpacing: "0.06em",
            lineHeight: 1.25,
          }}
        >
          STUDENT RESULT CARD
        </div>
      </div>
      <div style={{ gridColumn: 3, gridRow: 1, fontSize: 11, color: "#4b5563", textAlign: "right", lineHeight: 1.5, minWidth: 0, alignSelf: "center" }}>
        <div style={{ marginTop: 2 }}>
          <strong>Session:</strong> {sessionLabel || "—"}
        </div>
      </div>
      <div
        style={{
          gridColumn: "1 / -1",
          gridRow: 2,
          fontSize: 12,
          color: "#4b5563",
          lineHeight: 1.35,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "flex-start",
          alignItems: "baseline",
          gap: "0 2px",
          justifySelf: "stretch",
        }}
      >
        <span>
          <strong style={{ color: "#374151" }}>Exam:</strong> {examLabel || "—"}
        </span>
        <span style={pipeStyle}>|</span>
        <span>
          <strong style={{ color: "#374151" }}>Class:</strong> {className || "—"}
        </span>
        <span style={pipeStyle}>|</span>
        <span>
          <strong style={{ color: "#374151" }}>Pass %:</strong> {passPercentLabel}
        </span>
        <span style={pipeStyle}>|</span>
        <span>
          <strong style={{ color: "#374151" }}>Date:</strong> {dateStr}
        </span>
      </div>
    </div>
  );
}

// ─── TIMETABLE CELL ───────────────────────────────────────────────────────────
function TTCell(props){
  const {subject,teacher,onOpen}=props;
  const hasAssign=!!(subject||teacher);
  return <div
    onClick={onOpen}
    role="button"
    tabIndex={0}
    onKeyDown={e=>e.key==="Enter"&&onOpen?.()}
    style={{padding:"3px 2px",minHeight:38,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}
  >
    {hasAssign
      ? (
        <div style={{textAlign:"center",width:"100%"}}>
          <div style={{fontWeight:700,fontSize:12,color:"#000"}}>{subject}</div>
          <br />
          <div style={{fontSize:10,color:"#000",fontWeight:400}}>{teacher||""}</div>
        </div>
      )
      : (
        <div className="tt-empty-plus" style={{fontWeight:700,fontSize:16}}>+</div>
      )}
  </div>;
}

// Portion filter for All Classes print: primary = nursery + 1–5, middle 6–8, high 9–12, full = all
function getClassesByPortion(classes,portion){
  if(!Array.isArray(classes)) return [];
  if(portion==="full"||!portion) return classes;
  const gNum=(g)=>{ const n=parseInt(String(g||"").trim(),10); return isNaN(n)?-1:n; };
  const isNurseryOrKg=(g)=>{ const s=String(g||"").trim().toLowerCase(); return s==="nursery"||s==="kg"||s==="k"||s==="prep"||s==="play"||s==="lkg"||s==="ukg"; };
  if(portion==="primary") return classes.filter(c=>{ const n=gNum(c.grade); return (n>=1&&n<=5)||isNurseryOrKg(c.grade); });
  if(portion==="middle") return classes.filter(c=>{ const n=gNum(c.grade); return n>=6&&n<=8; });
  if(portion==="high") return classes.filter(c=>{ const n=gNum(c.grade); return n>=9&&n<=12; });
  return classes;
}
// Teachers who have at least one assignment in a class in the given portion (for Teachers view print)
function getStaffInPortion(settings,timetable,portion,staffProfiles){
  const staff=teachingStaffList(settings,staffProfiles);
  if(!staff.length) return [];
  if(portion==="full"||!portion) return staff;
  const portionClasses=getClassesByPortion(settings.classes||[],portion);
  const classIds=new Set(portionClasses.map(c=>c.id));
  if(classIds.size===0) return [];
  const {rows}=calcTimes(settings,"Monday");
  const pRows=rows.filter(r=>!r.isBreak);
  return staff.filter(teacher=>{
    for(let pi=0;pi<pRows.length;pi++){
      for(const classId of classIds){
        const cell=getTT(timetable,classId,"Monday",pi);
        if(cell&&cell.teacher===teacher.name) return true;
      }
    }
    return false;
  });
}
const DEFAULT_PRINT_PORTION_MASK={primary:true,middle:true,high:true};
function isPortionMaskFull(mask){
  return !!(mask&&mask.primary&&mask.middle&&mask.high);
}
function formatPortionMaskLabel(mask){
  if(isPortionMaskFull(mask)) return "Full";
  const parts=[];
  if(mask.primary) parts.push("Primary");
  if(mask.middle) parts.push("Middle");
  if(mask.high) parts.push("High");
  return parts.join(" + ")||"—";
}
/** Union of classes in every selected portion (Primary / Middle / High). All three = full list. */
function getClassesByPortionMask(classes,mask){
  if(!Array.isArray(classes)) return [];
  if(!mask||isPortionMaskFull(mask)) return classes;
  const map=new Map();
  if(mask.primary) getClassesByPortion(classes,"primary").forEach(c=>map.set(c.id,c));
  if(mask.middle) getClassesByPortion(classes,"middle").forEach(c=>map.set(c.id,c));
  if(mask.high) getClassesByPortion(classes,"high").forEach(c=>map.set(c.id,c));
  return Array.from(map.values());
}
function getStaffInPortionMask(settings,timetable,mask,staffProfiles){
  const staff=teachingStaffList(settings,staffProfiles);
  if(!staff.length) return [];
  if(!mask||isPortionMaskFull(mask)) return staff;
  const portionClasses=getClassesByPortionMask(settings.classes||[],mask);
  const classIds=new Set(portionClasses.map(c=>c.id));
  if(classIds.size===0) return [];
  const {rows}=calcTimes(settings,"Monday");
  const pRows=rows.filter(r=>!r.isBreak);
  return staff.filter(teacher=>{
    for(let pi=0;pi<pRows.length;pi++){
      for(const classId of classIds){
        const cell=getTT(timetable,classId,"Monday",pi);
        if(cell&&cell.teacher===teacher.name) return true;
      }
    }
    return false;
  });
}

// ─── ALL CLASSES VIEW ─────────────────────────────────────────────────────────
function AllClassesView({settings,staffProfiles,timetable,setTimetable,day,classes:classesOverride}){
  const classes=(classesOverride!=null&&Array.isArray(classesOverride))?classesOverride:settings.classes;
  const {rows} = calcTimes(settings,day);
  const pRows = rows.filter(r=>!r.isBreak);
  const brRow = rows.find(r=>r.isBreak);

  const [editCell,setEditCell]=useState(null); // {cid,pi}
  const [editSubject,setEditSubject]=useState("");
  const [editTeacher,setEditTeacher]=useState("");

  function teacherBusy(teacher,pi,excludeCls){
    if(!teacher) return false;
    return classes.some(c=>c.id!==excludeCls&&getTT(timetable,c.id,day,pi).teacher===teacher);
  }
  function subjectUsed(cid,subj,excludePi){
    if(!subj) return false;
    return pRows.some((_,i)=>i!==excludePi&&getTT(timetable,cid,day,i).subject===subj);
  }
  function applyCommon(cid,pi,subject,teacher){
    const cls=classes.find(c=>c.id===cid); if(!cls) return;
    const common=settings.commonTeachers?.[cls.grade]||{};
    const normSubj=(subject||"").trim();
    if(!normSubj||!common[normSubj]||!teacher) return;
    classes.filter(c=>c.grade===cls.grade&&c.id!==cid).forEach(sc=>{
      if(getClassSubjects(settings,sc.id,"timetable").some(s=>(s||"").trim()===normSubj)){
        const existing=getTT(timetable,sc.id,day,pi);
        if(!existing.subject && !existing.teacher){
          setTT(setTimetable,sc.id,day,pi,{subject:normSubj,teacher,isCommon:true});
        }
      }
    });
  }
  const brAfterIdx = settings.breakRequired ? settings.breakAfterPeriod-1 : -1;

  const openEditor=(cid,pi)=>{
    const cell=getTT(timetable,cid,day,pi);
    setEditCell({cid,pi});
    setEditSubject(cell.subject||"");
    setEditTeacher(cell.teacher||"");
  };
  const closeEditor=()=>{ setEditCell(null); };
  const saveEditor=()=>{
    if(!editCell) return;
    if(!editSubject){ alert("Please select a subject before saving this period."); return; }
    if(!editTeacher){ alert("Please select a teacher before saving this period."); return; }
    const {cid,pi}=editCell;
    if(teacherBusy(editTeacher,pi,cid)){
      alert("This teacher is already assigned in the same period for another class. Please select a different teacher.");
      return;
    }
    const counterpartMismatches=[];
    pRows.forEach((_,i)=>{
      if(i===pi) return;
      const cell=getTT(timetable,cid,day,i);
      if(!isABCounterpartSubject(cell.subject,editSubject)) return;
      if(cell.teacher&&cell.teacher!==editTeacher){
        counterpartMismatches.push({period:i,teacher:cell.teacher});
      }
    });
    if(counterpartMismatches.length){
      const details=counterpartMismatches
        .map(item=>`${getPeriodLabel(item.period,settings)}: ${item.teacher}`)
        .join(", ");
      alert("Warning: This class already has a different teacher for the A/B pair ("+details+").\n\nThe system will now auto-match both parts to "+editTeacher+".");
    }
    // Write subject+teacher together so they can't overwrite each other
    const next={subject:editSubject,teacher:editTeacher};
    setTT(setTimetable,cid,day,pi,next);
    pRows.forEach((_,i)=>{
      if(i===pi) return;
      const cell=getTT(timetable,cid,day,i);
      if(isABCounterpartSubject(cell.subject,editSubject)){
        setTT(setTimetable,cid,day,i,{...cell,teacher:editTeacher});
      }
    });
    applyCommon(cid,pi,next.subject,next.teacher);
    setEditCell(null);
  };

  const renderModal=()=>{
    if(!editCell) return null;
    const {cid,pi}=editCell;
    const cls=settings.classes.find(c=>c.id===cid);
    const subjects=getClassSubjects(settings,cid,"timetable");
    const period=pRows[pi];
    const currentCell=getTT(timetable,cid,day,pi);
    const subjectOptions=subjects.filter(s=>!subjectUsed(cid,s,pi)||s===currentCell.subject);
    const gradeCommon=settings.commonTeachers?.[cls?.grade]||{};
    const teacherOptions=teachingStaffList(settings,staffProfiles).filter(st=>{
      const isCurrent=st.name===currentCell.teacher;
      if(isCurrent) return true;
      // Strict rule: no teacher can be assigned in the same period twice.
      return !teacherBusy(st.name,pi,cid);
    });
    return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={closeEditor}>
      <div style={{background:"#fff",borderRadius:10,width:"100%",maxWidth:420,maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:C.navy,color:"#fff",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontWeight:700,fontSize:14}}>Assign Period</span>
          <button onClick={closeEditor} style={{background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{padding:16,fontSize:14}}>
          <div style={{marginBottom:8,color:"#000"}}>
            <div><strong>Class:</strong> {cls?formatClassDisplay(cls):""}</div>
            <div><strong>Period:</strong> {getPeriodLabel(pi,settings)} ({fmtMin(period.start)}–{fmtMin(period.end)})</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8,marginBottom:12}}>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#000",display:"block",marginBottom:4}}>Subject</label>
              <select value={editSubject} onChange={e=>setEditSubject(e.target.value)} style={{width:"100%",padding:"6px 8px",border:"1.5px solid #d1d5db",borderRadius:5,fontSize:13}}>
                <option value="">— Select subject —</option>
                {subjectOptions.map(s=>{
                  const isCommon = !!gradeCommon[(s||"").trim()];
                  return <option key={s} value={s}>{isCommon?"★ ":""}{s}</option>;
                })}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#000",display:"block",marginBottom:4}}>Teacher</label>
              <select value={editTeacher} onChange={e=>setEditTeacher(e.target.value)} disabled={!editSubject} style={{width:"100%",padding:"6px 8px",border:"1.5px solid #d1d5db",borderRadius:5,fontSize:13,background:editSubject?"#fff":"#f3f4f6",opacity:editSubject?1:0.7}}>
                <option value="">— Select teacher —</option>
                {teacherOptions.map(st=><option key={st.id} value={st.name}>{st.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <button
              onClick={()=>{
                if(!editCell) return;
                const {cid,pi}=editCell;
                setEditSubject("");
                setEditTeacher("");
                setTT(setTimetable,cid,day,pi,{subject:"",teacher:""});
                setEditCell(null);
              }}
              style={{background:"none",border:"none",color:C.red,fontSize:12,cursor:"pointer"}}
            >
              Clear
            </button>
            <div style={{display:"flex",gap:8}}>
              <Btn outline color={C.gray} onClick={closeEditor}>Cancel</Btn>
              <Btn onClick={saveEditor}>Save</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>;
  };

  return <div style={{overflowX:"auto"}}>
    <table className="timetable-pdf-export" style={{borderCollapse:"collapse",fontSize:11,minWidth:900}}>
      <thead>
        <tr>
          <th style={{background:C.navy,color:"#fff",padding:"6px 8px",minWidth:88,position:"sticky",left:0,zIndex:2,fontSize:12}}>Class</th>
          {pRows.map((p,i)=>[
            <th key={`ph${i}`} style={{background:C.navy,color:"#fff",padding:"4px 5px",minWidth:88,textAlign:"center"}}>
              <div style={{fontWeight:700}}>{getPeriodLabel(i,settings)}</div>
              <div style={{fontSize:9,fontWeight:400,opacity:0.85}}>{fmtMin(p.start)}–{fmtMin(p.end)}</div>
            </th>,
            i===brAfterIdx&&brRow&&<th key={`bh${i}`} style={{background:C.breakC,color:"#78350f",padding:"4px 5px",minWidth:58,textAlign:"center",fontWeight:700,fontSize:10}}>Break<br/><span style={{fontWeight:400,fontSize:9}}>{fmtMin(brRow.start)}–{fmtMin(brRow.end)}</span></th>
          ])}
        </tr>
      </thead>
      <tbody>
        {classes.map((cls,ri)=>{
          const gradeCommon=settings.commonTeachers?.[cls.grade]||{};
          return <tr key={cls.id} style={{background:ri%2===0?"#f9fafb":"#fff"}}>
            <td style={{padding:"4px 8px",fontWeight:700,color:"#000",background:ri%2===0?"#e8edf8":"#eef2fc",position:"sticky",left:0,zIndex:1,fontSize:12,whiteSpace:"nowrap"}}>{formatClassDisplay(cls)}</td>
            {pRows.map((p,pi)=>{
              const cell=getTT(timetable,cls.id,day,pi);
              const busy=teacherBusy(cell.teacher,pi,cls.id);
              const isCommon=!!(cell.subject&&gradeCommon[cell.subject]);
              return [
                <td key={`c${pi}`} style={{padding:2,minWidth:88,border:"1px solid #9ca3af",verticalAlign:"top"}}>
                  <TTCell subject={cell.subject} teacher={cell.teacher}
                    isCommon={isCommon} busy={busy}
                    onOpen={()=>openEditor(cls.id,pi)}/>
                </td>,
                pi===brAfterIdx&&<td key={`b${pi}`} style={{background:C.breakL,textAlign:"center",fontWeight:700,fontSize:10,color:"#92400e",padding:"3px 2px",minWidth:58}}>BREAK</td>
              ];
            })}
          </tr>;
        })}
      </tbody>
    </table>
    {renderModal()}
  </div>;
}

// ─── ALL CLASSES VIEW (single table for all days) ─────────────────────────────
function AllClassesAllDaysView({settings,staffProfiles,timetable,setTimetable}){
  const {rows} = calcTimes(settings,"Monday");
  const pRows = rows.filter(r=>!r.isBreak);
  const brRow = rows.find(r=>r.isBreak);
  const brAfterIdx = settings.breakRequired ? settings.breakAfterPeriod-1 : -1;

  function teacherBusy(teacher,day,pi,excludeCls){
    if(!teacher) return false;
    return settings.classes.some(c=>c.id!==excludeCls&&getTT(timetable,c.id,day,pi).teacher===teacher);
  }
  function applyCommon(cid,day,pi,subject,teacher){
    const cls=settings.classes.find(c=>c.id===cid); if(!cls) return;
    const common=settings.commonTeachers?.[cls.grade]||{};
    if(!subject||!common[subject]) return;
    settings.classes.filter(c=>c.grade===cls.grade&&c.id!==cid).forEach(sc=>{
      if(getClassSubjects(settings,sc.id,"timetable").includes(subject))
        setTT(setTimetable,sc.id,day,pi,{subject,teacher,isCommon:true});
    });
  }
  function handleChange(cid,day,pi,field,value){
    const prev=getTT(timetable,cid,day,pi);
    const next={...prev,[field]:value};
    setTT(setTimetable,cid,day,pi,next);
    if(field==="teacher"||field==="subject") applyCommon(cid,day,pi,next.subject,next.teacher);
  }

  return <div style={{overflowX:"auto"}}>
    <table className="timetable-pdf-export" style={{borderCollapse:"collapse",fontSize:11,minWidth:900}}>
      <thead>
        <tr>
          <th style={{background:C.navy,color:"#fff",padding:"6px 8px",minWidth:88,position:"sticky",left:0,zIndex:2,fontSize:12}}>Class</th>
          {pRows.map((p,i)=>[
            <th key={`ph${i}`} style={{background:C.navy,color:"#fff",padding:"4px 5px",minWidth:88,textAlign:"center"}}>
              <div style={{fontWeight:700}}>{getPeriodLabel(i,settings)}</div>
              <div style={{fontSize:9,fontWeight:400,opacity:0.85}}>{fmtMin(p.start)}–{fmtMin(p.end)}</div>
            </th>,
            i===brAfterIdx&&brRow&&<th key={`bh${i}`} style={{background:C.breakC,color:"#78350f",padding:"4px 5px",minWidth:58,textAlign:"center",fontWeight:700,fontSize:10}}>Break<br/><span style={{fontWeight:400,fontSize:9}}>{fmtMin(brRow.start)}–{fmtMin(brRow.end)}</span></th>
          ])}
        </tr>
      </thead>
      <tbody>
        {settings.classes.flatMap((cls,ri)=>{
          const days=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
          const subjects=getClassSubjects(settings,cls.id,"timetable");
          const gradeCommon=settings.commonTeachers?.[cls.grade]||{};
          return days.map((day,di)=>{
            const rowIdx=ri*days.length+di;
            return <tr key={`${cls.id}_${day}`} style={{background:rowIdx%2===0?"#f9fafb":"#fff"}}>
              {di===0&&<td rowSpan={days.length} style={{padding:"4px 8px",fontWeight:700,color:"#000",background:"#e8edf8",position:"sticky",left:0,zIndex:1,fontSize:12,whiteSpace:"nowrap",verticalAlign:"middle"}}>{formatClassDisplay(cls)}</td>}
              {pRows.map((p,pi)=>{
                const cell=getTT(timetable,cls.id,day,pi);
                const busy=teacherBusy(cell.teacher,day,pi,cls.id);
                const isCommon=!!(cell.subject&&gradeCommon[cell.subject]);
                return [
                  <td key={`c${pi}`} style={{padding:2,minWidth:88,border:"1px solid #9ca3af",verticalAlign:"top"}}>
                    <TTCell subject={cell.subject} teacher={cell.teacher} subjects={subjects} staff={teachingStaffList(settings,staffProfiles)}
                      isCommon={isCommon} busy={busy}
                      onSubj={v=>handleChange(cls.id,day,pi,"subject",v)}
                      onTeach={v=>handleChange(cls.id,day,pi,"teacher",v)}/>
                  </td>,
                  pi===brAfterIdx&&<td key={`b${pi}`} style={{background:C.breakL,textAlign:"center",fontWeight:700,fontSize:10,color:"#92400e",padding:"3px 2px",minWidth:58}}>BREAK</td>
                ];
              })}
            </tr>;
          });
        })}
      </tbody>
    </table>
  </div>;
}

// ─── TEACHERS VIEW ────────────────────────────────────────────────────────────
function TeachersView({settings,timetable,day,staff:staffOverride,printSubtitle,suppressPrintHeader}){
  const staffList=staffOverride!=null&&Array.isArray(staffOverride)?staffOverride:settings.staff;
  const {rows} = calcTimes(settings,day);
  const pRows = rows.filter(r=>!r.isBreak);
  const brAfterIdx = settings.breakRequired ? settings.breakAfterPeriod-1 : -1;

  function getAssignment(tName,pi){
    for(const cls of settings.classes){
      const cell=getTT(timetable,cls.id,day,pi);
      if(cell.teacher===tName) return {subject:cell.subject,className:formatClassDisplay(cls)};
    }
    return null;
  }
  function countPeriods(tName){
    return pRows.reduce((acc,_,pi)=>acc+(getAssignment(tName,pi)?1:0),0);
  }

  return <div style={{overflowX:"auto"}}>
    {!suppressPrintHeader&&<div className="print-only" style={{display:"none",marginBottom:8}}>
      <SchoolHeader settings={settings} subtitle={printSubtitle||"TEACHERS TIMETABLE"}/>
    </div>}
    <table className="timetable-pdf-export" style={{borderCollapse:"collapse",fontSize:9,minWidth:700}}>
      <thead>
        <tr>
          <th style={{background:C.navy,color:"#fff",padding:"4px 6px",minWidth:100,position:"sticky",left:0,zIndex:2,fontSize:9}}>Teacher</th>
          {pRows.map((p,i)=>[
            <th key={`th${i}`} style={{background:C.navy,color:"#fff",padding:"3px 4px",minWidth:80,textAlign:"center",fontSize:9}}>
              <div>{getPeriodLabel(i,settings)}</div>
              <div style={{fontSize:8,fontWeight:400}}>{fmtMin(p.start)}–{fmtMin(p.end)}</div>
            </th>,
            i===brAfterIdx&&<th key={`tbh${i}`} style={{background:C.breakC,color:"#78350f",padding:"3px 4px",minWidth:55,textAlign:"center",fontWeight:700,fontSize:8}}>Break</th>
          ])}
          <th style={{background:C.navy,color:"#fff",padding:"4px 6px",minWidth:65,textAlign:"center",fontSize:9}}>Periods/Day</th>
        </tr>
      </thead>
      <tbody>
        {staffList.map((teacher,ri)=>{
          const count=countPeriods(teacher.name);
          return <tr key={teacher.id} style={{background:ri%2===0?"#f9fafb":"#fff"}}>
            <td style={{padding:"3px 6px",fontWeight:700,color:"#000",background:ri%2===0?"#e8edf8":"#eef2fc",position:"sticky",left:0,zIndex:1,whiteSpace:"nowrap",fontSize:9}}>
              <div>{teacher.name}</div>
              <div style={{fontSize:8,color:"#000",fontWeight:400}}>{teacher.designation}</div>
            </td>
            {pRows.map((_,pi)=>{
              const assigned=getAssignment(teacher.name,pi);
              return [
                <td key={`tc${pi}`} style={{padding:2,border:"1px solid #9ca3af",textAlign:"center",minWidth:80,fontSize:9,verticalAlign:"middle"}}>
                  {assigned?(<div style={{background:"#dbeafe",borderRadius:4,padding:"2px 3px",textAlign:"center"}}>
                    <div style={{fontWeight:700,color:"#000",fontSize:9}}>{assigned.subject}</div>
                    <br />
                    <div style={{fontSize:8,color:"#000",fontWeight:400}}>{assigned.className}</div>
                  </div>):<span style={{color:"#d1d5db",fontSize:8}}>Free</span>}
                </td>,
                pi===brAfterIdx&&<td key={`tb${pi}`} style={{background:C.breakL,textAlign:"center",fontWeight:700,fontSize:8,color:"#92400e",padding:2}}>BREAK</td>
              ];
            })}
            <td style={{textAlign:"center",fontWeight:700,fontSize:12,color:count>0?C.navy:C.gray}}>{count||"—"}</td>
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}

// ─── BY CLASS VIEW ────────────────────────────────────────────────────────────
function ByClassView({settings,timetable,selCls,suppressPrintHeader}){
  const {rows:monRows} = calcTimes(settings,"Monday");
  const pRows = monRows.filter(r=>!r.isBreak);
  const brRow = monRows.find(r=>r.isBreak);
  const brAfterIdx = settings.breakRequired ? settings.breakAfterPeriod-1 : -1;
  const cls=settings.classes.find(c=>c.id===selCls);

  return <div>
    {!suppressPrintHeader&&<div className="print-only" style={{display:"none",marginBottom:8}}>
      <SchoolHeader settings={settings} subtitle={`${cls?.name||""} — CLASS TIMETABLE`}/>
    </div>}
    <div style={{overflowX:"auto"}}>
      <table className="timetable-pdf-export" style={{borderCollapse:"collapse",fontSize:11,width:"100%"}}>
          <thead>
            <tr>
              <th style={{background:C.navy,color:"#fff",padding:"6px 10px",minWidth:80}}>Day</th>
              {pRows.map((_,i)=>[
                <th key={`bch${i}`} style={{background:C.navy,color:"#fff",padding:"4px 6px",minWidth:80,textAlign:"center"}}>{getPeriodLabel(i,settings)}</th>,
                i===brAfterIdx&&<th key={`bcbh${i}`} style={{background:C.breakC,color:"#78350f",padding:"4px 6px",minWidth:50,fontWeight:700,fontSize:10,textAlign:"center"}}>Break</th>
              ])}
            </tr>
            <tr>
              <th style={{background:"#e8edf8",padding:"4px 10px",color:"#000",fontSize:11}}>Time</th>
              {pRows.map((p,i)=>[
                <th key={`bct${i}`} style={{background:"#e8edf8",padding:"3px 5px",textAlign:"center",fontSize:10,fontWeight:600,color:"#000"}}>{fmtMin(p.start)}–{fmtMin(p.end)}</th>,
                i===brAfterIdx&&brRow&&<th key={`bcbt${i}`} style={{background:C.breakL,padding:"3px 5px",textAlign:"center",fontSize:10,fontWeight:600,color:"#92400e"}}>{fmtMin(brRow.start)}–{fmtMin(brRow.end)}</th>
              ])}
            </tr>
          </thead>
          <tbody>
            {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((day,di)=>{
              const {rows} = calcTimes(settings,day);
              const dp = rows.filter(r=>!r.isBreak);
              return <tr key={day} style={{background:di%2===0?"#f9fafb":"#fff"}}>
                <td style={{padding:"5px 10px",fontWeight:700,color:"#000",background:di%2===0?"#e8edf8":"#eef2fc"}}>{day}</td>
                {dp.map((_,pi)=>{
                  const cell=getTT(timetable,selCls,day,pi);
                  return [
                    <td key={`byc${pi}`} style={{padding:4,border:"1px solid #9ca3af",textAlign:"center",minWidth:80,verticalAlign:"middle"}}>
                      {cell.subject?(
                        <div style={{textAlign:"center"}}>
                          <div style={{fontWeight:700,color:"#000",fontSize:11}}>{cell.subject}</div>
                          <br />
                          <div style={{fontSize:10,color:"#000",fontWeight:400}}>{cell.teacher||""}</div>
                        </div>
                      ):(<span style={{color:"#d1d5db",fontSize:10}}>—</span>)}
                    </td>,
                    pi===brAfterIdx&&<td key={`bycb${pi}`} style={{background:C.breakL,textAlign:"center",fontWeight:700,fontSize:10,color:"#92400e",padding:2}}>BREAK</td>
                  ];
                })}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
  </div>;
}

// ─── BY TEACHER VIEW ──────────────────────────────────────────────────────────
function ByTeacherView({settings,timetable,selT,suppressPrintHeader}){
  const teacher=settings.staff.find(st=>st.name===selT);
  const {rows:monRows} = calcTimes(settings,"Monday");
  const {rows:friRows} = calcTimes(settings,"Friday");
  const monP = monRows.filter(r=>!r.isBreak);
  const friP = friRows.filter(r=>!r.isBreak);
  const monBr = monRows.find(r=>r.isBreak);
  const friBr = friRows.find(r=>r.isBreak);

  function getAssign(day,pi){
    for(const cls of settings.classes){
      const cell=getTT(timetable,cls.id,day,pi);
      if(cell.teacher===selT) return {subject:cell.subject,className:cls.name,grade:cls.grade};
    }
    return null;
  }
  const monAssigns = monP.map((_,pi)=>getAssign("Monday",pi));
  const totalP = monAssigns.filter(Boolean).length;

  // Incharge: first period — show class only (e.g. Class-9 or 9th), not section
  const incharge = (() => {
    const a=monAssigns[0];
    if(!a||!a.grade) return a?a.className:"—";
    const g=String(a.grade).trim();
    return g ? `Class-${g}` : (a.className||"—");
  })();

  return <div className="by-teacher-print">
    <div style={{overflow:"hidden",background:"#fff"}}>
      {!suppressPrintHeader&&<div className="print-only" style={{display:"none",marginBottom:8}}>
        <SchoolHeader settings={settings} subtitle="TEACHERS TIMETABLE"/>
      </div>}
      {/* Info bar */}
      <div style={{padding:"10px 16px",borderBottom:`1px solid #e5e7eb`,fontSize:12,display:"flex",justifyContent:"center",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <span>Name: <span style={{fontWeight:700,textTransform:"uppercase"}}>{teacher?.name}</span></span>
        <span>Designation: <span style={{fontWeight:700,textTransform:"uppercase"}}>{teacher?.designation}</span></span>
        <span>|</span>
        <span>Incharge: <span style={{fontWeight:700,textTransform:"uppercase"}}>{incharge}</span></span>
        <span>|</span>
        <span>Periods/Day: <span style={{fontWeight:700}}>{totalP}</span></span>
      </div>

      {/* Schedule table */}
      <div style={{overflowX:"auto"}}>
        <table className="timetable-pdf-export" style={{borderCollapse:"collapse",fontSize:11,width:"100%"}}>
          <thead>
            <tr style={{background:C.navy,color:"#fff"}}>
              <th style={{padding:"5px 8px",textAlign:"left",minWidth:70}}>Periods</th>
              <th colSpan={2} style={{padding:"5px 8px",textAlign:"center",borderLeft:"1px solid #2563eb"}}>MONDAY TO THURSDAY</th>
              <th colSpan={2} style={{padding:"5px 8px",textAlign:"center",borderLeft:"1px solid #2563eb"}}>FRIDAY</th>
              <th style={{padding:"5px 8px",textAlign:"center",borderLeft:"1px solid #2563eb",minWidth:120}}>CLASS–SUBJECT</th>
            </tr>
          </thead>
          <tbody>
            {/* Assembly */}
            <tr style={{background:"#f0f4fc"}}>
              <td style={{padding:"4px 8px",fontWeight:600}}>Assembly</td>
              <td style={{padding:"4px 8px",textAlign:"center"}}>{fmtMin(monP[0]?.start-settings.assemblyTime)}</td>
              <td style={{padding:"4px 8px",textAlign:"center"}}>{fmtMin(monP[0]?.start)}</td>
              <td style={{padding:"4px 8px",textAlign:"center"}}>{fmtMin(friP[0]?.start-settings.assemblyTime)}</td>
              <td style={{padding:"4px 8px",textAlign:"center"}}>{fmtMin(friP[0]?.start)}</td>
              <td></td>
            </tr>
            {monP.map((mp,pi)=>{
              const fp=friP[pi];
              const monAssign=monAssigns[pi];
              const isBreakRow=settings.breakRequired&&pi===settings.breakAfterPeriod;
              return [
                isBreakRow&&<tr key={`br${pi}`} style={{background:C.breakL}}>
                  <td style={{padding:"4px 8px",fontWeight:700,color:"#92400e"}}>Break</td>
                  <td style={{padding:"4px 8px",textAlign:"center",color:"#92400e"}}>{monBr?fmtMin(monBr.start):"—"}</td>
                  <td style={{padding:"4px 8px",textAlign:"center",color:"#92400e"}}>{monBr?fmtMin(monBr.end):"—"}</td>
                  <td colSpan={2} style={{padding:"4px 8px",textAlign:"center",color:"#92400e",fontStyle:"italic"}}>
                    {settings.fridayBreak&&friBr?`${fmtMin(friBr.start)} – ${fmtMin(friBr.end)}`:"No Break"}
                  </td>
                  <td></td>
                </tr>,
                <tr key={pi} style={{background:pi%2===0?"#f9fafb":"#fff"}}>
                  <td style={{padding:"4px 8px",fontWeight:600}}>{getPeriodLabel(pi,settings)}</td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}>{fmtMin(mp.start)}</td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}>{fmtMin(mp.end)}</td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}>{fp?fmtMin(fp.start):"—"}</td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}>{fp?fmtMin(fp.end):"—"}</td>
                  <td style={{padding:"4px 8px",textAlign:"center",verticalAlign:"middle"}}>
                    {monAssign?(<div style={{background:"#f3f4ff",borderRadius:6,padding:"3px 9px",display:"inline-block",minWidth:120,textAlign:"center"}}>
                      <div style={{fontWeight:700,color:"#000",fontSize:11}}>{monAssign.subject}</div>
                      <br />
                      <div style={{fontSize:10,color:"#000",fontWeight:400}}>{monAssign.className}</div>
                    </div>):<span style={{color:"#d1d5db"}}>—</span>}
                  </td>
                </tr>
              ];
            })}
          </tbody>
        </table>
      </div>

      {/* Footer summary */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderTop:`1px solid #e5e7eb`,background:"#f9fafb"}}>
        {[
          {label:"Monday to Thursday and Saturday",rows:[
            ["Assembly",`${settings.assemblyTime} minutes`],
            [getPeriodLabel(0,settings),`${settings.firstPeriodTime} minutes`],
            [`${getPeriodLabel(1,settings)} to ${getPeriodLabel(settings.periodsPerDay-1,settings)}`,`${settings.otherPeriodTime} minutes`],
            ["Break",settings.breakRequired?`${settings.breakDuration} minutes`:"No Break"],
          ]},
          {label:"Friday",rows:[
            ["Assembly",`${settings.assemblyTime} minutes`],
            [getPeriodLabel(0,settings),`${settings.firstPeriodTime} minutes`],
            [`${getPeriodLabel(1,settings)} to ${getPeriodLabel(4,settings)}`,`${settings.otherPeriodTime} minutes`],
            ["Break",settings.fridayBreak?`${settings.fridayBreakDuration} minutes`:"0 minutes"],
          ]},
        ].map(col=>(
          <div key={col.label} style={{padding:"8px 16px",borderRight:"1px solid #e5e7eb"}}>
            <div style={{fontWeight:700,color:"#000",marginBottom:5,fontSize:12}}>{col.label}</div>
            {col.rows.map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"2px 0",borderBottom:"1px dotted #e5e7eb"}}>
                <span style={{fontWeight:k==="Break"?700:400,color:k==="Break"?"#92400e":"#374151"}}>{k}</span>
                <span style={{fontWeight:k==="Break"?700:400,color:k==="Break"?"#92400e":"#374151"}}>{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{padding:"6px 16px",borderTop:"1px solid #e5e7eb",fontSize:10,color:"#000",textAlign:"center",fontStyle:"italic"}}>
        The teacher will arrive <strong>15 minutes before school starts</strong>. School: Mon–Thu {settings.schoolHours.mondayToThursday.start}–{settings.schoolHours.mondayToThursday.end} | Friday {settings.schoolHours.friday.start}–{settings.schoolHours.friday.end}
      </div>
    </div>
  </div>;
}

// ─── TIMETABLE PAGE ───────────────────────────────────────────────────────────
function TimetablePage({settings,staffProfiles,timetable,setTimetable,currentSession,setBarSubtitle}){
  const [view,setView]=useState("allClasses");
  const [byClassCls,setByClassCls]=useState(settings.classes[0]?.id||"__all_classes__");
  const [byTeacherName,setByTeacherName]=useState(teachingStaffList(settings,staffProfiles)[0]?.name||"__all_staff__");
  const [printPortionMask,setPrintPortionMask]=useState(()=>({...DEFAULT_PRINT_PORTION_MASK}));
  const timetableTableRef=useRef(null);

  const views=[{id:"allClasses",label:"Classes"},{id:"teachers",label:"Faculty"},{id:"byClass",label:"Class Planner"},{id:"byTeacher",label:"Teacher Planner"}];
  const tableNames={allClasses:"ALL CLASSES — TIMETABLE",teachers:"TEACHERS TIMETABLE",byClass:"CLASS TIMETABLE",byTeacher:"TEACHER TIMETABLE"};
  const portionLabel=formatPortionMaskLabel(printPortionMask);
  const portionFilterActive=!isPortionMaskFull(printPortionMask);
  const currentTableName=view==="byClass"&&byClassCls!=="__all_classes__"
    ? `${settings.classes.find(c=>c.id===byClassCls)?.name||""} — CLASS TIMETABLE`
    : view==="byTeacher"&&byTeacherName!=="__all_staff__"
      ? `${byTeacherName} — TEACHER TIMETABLE`
      : view==="allClasses"&&portionFilterActive
        ? `ALL CLASSES — TIMETABLE (${portionLabel})`
        : view==="teachers"&&portionFilterActive
          ? `TEACHERS TIMETABLE (${portionLabel})`
          : tableNames[view]||"TIMETABLE";
  const classesForView=view==="allClasses"?getClassesByPortionMask(settings.classes,printPortionMask):settings.classes;
  const teachingStaff=teachingStaffList(settings,staffProfiles);
  const staffForView=view==="teachers"?getStaffInPortionMask(settings,timetable,printPortionMask,staffProfiles):teachingStaff;

  const togglePrintPortion=(key)=>{
    setPrintPortionMask((m)=>{
      const next={...m,[key]:!m[key]};
      if(!next.primary&&!next.middle&&!next.high) return m;
      return next;
    });
  };
  const portionChkStyle={display:"inline-flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,fontWeight:600,color:C.navy,userSelect:"none"};

  useEffect(()=>{
    if(!setBarSubtitle) return;
    const v=views.find(x=>x.id===view);
    queueMicrotask(()=>setBarSubtitle(v?.label||""));
  },[view,setBarSubtitle]);
  useEffect(()=>{
    const names=teachingStaff.map(st=>st.name);
    if(byTeacherName==="__all_staff__") return;
    if(!names.includes(byTeacherName)) queueMicrotask(()=>setByTeacherName(names[0]||"__all_staff__"));
  },[teachingStaff,byTeacherName]);

  const doExportTimetable=(format)=>{
    const container=timetableTableRef.current;
    const batchPlannerPdf=
      (view==="byClass"&&byClassCls==="__all_classes__")||
      (view==="byTeacher"&&byTeacherName==="__all_staff__");
    const baseName="Timetable_"+String(currentTableName).replace(/\s*—\s*/g,"_").replace(/\s+/g,"_").slice(0,40);
    if(format==="pdf"&&batchPlannerPdf){
      const tables=[...(container?.querySelectorAll("table.timetable-pdf-export")||[])];
      if(!tables.length){ alert("No table data to export. Select a view with a timetable."); return; }
      const sections=
        view==="byClass"
          ? classesForView.map((c,i)=>({tableName:`${formatClassDisplay(c)||c.name||"Class"} — CLASS TIMETABLE`,htmlTableEl:tables[i]})).filter((s)=>s.htmlTableEl)
          : staffForView.map((st,i)=>({tableName:`${st.name} — TEACHER TIMETABLE`,htmlTableEl:tables[i]})).filter((s)=>s.htmlTableEl);
      if(!sections.length){ alert("No table data to export. Select a view with a timetable."); return; }
      void exportTimetableBatchPlannerPdf(settings,currentSession,sections,baseName+".pdf").catch((e)=>alert("PDF export failed: "+(e?.message||String(e))));
      return;
    }
    const tableEl=container?.querySelector("table.timetable-pdf-export")||container?.querySelector("table");
    const {headers,rows}=getTableDataFromElement(container);
    const hasDom=tableEl&&tableEl.rows&&tableEl.rows.length>0;
    const hasMatrix=(Array.isArray(headers)&&headers.length>0)||(Array.isArray(rows)&&rows.length>0);
    if(!hasDom&&!hasMatrix){ alert("No table data to export. Select a view with a timetable."); return; }
    if(format==="pdf") void exportTableToPdf(settings,currentSession,currentTableName,headers,rows,baseName+".pdf",hasDom?tableEl:undefined).catch((e)=>alert("PDF export failed: "+(e?.message||String(e))));
  };

  const handleTimetablePdf=()=>{ doExportTimetable("pdf"); };

  return <div className="timetable-page timetable-print-area" style={{width:"100%",maxWidth:"100%",minWidth:0,boxSizing:"border-box"}}>
    <div className="no-print timetable-toolbar" style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap",padding:"10px 14px",background:"#fff",borderRadius:8,boxShadow:"0 1px 4px rgba(0,0,0,0.08)",width:"100%",maxWidth:"100%",boxSizing:"border-box"}}>
      <div style={{display:"flex",gap:4,minWidth:0}}>
        {views.map(v=>(
          <button
            key={v.id}
            onClick={()=>setView(v.id)}
            style={{
              flex:1,
              padding:"6px 14px",
              borderRadius:999,
              border:"none",
              background:view===v.id?C.navy:"#e5e7eb",
              color:view===v.id?"#fff":"#374151",
              fontWeight:600,
              fontSize:12,
              cursor:"pointer",
              whiteSpace:"nowrap",
              textAlign:"center",
              boxShadow:view===v.id?"0 4px 10px rgba(15,23,42,0.25)":"none",
              transition:"background 0.18s ease,box-shadow 0.18s ease,transform 0.1s ease"
            }}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        {(view==="allClasses"||view==="teachers")&&(
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{fontSize:12,fontWeight:600,color:C.gray}}>Portion:</span>
            <label style={portionChkStyle}>
              <input type="checkbox" checked={printPortionMask.primary} onChange={()=>togglePrintPortion("primary")}/>
              Primary
            </label>
            <label style={portionChkStyle}>
              <input type="checkbox" checked={printPortionMask.middle} onChange={()=>togglePrintPortion("middle")}/>
              Middle
            </label>
            <label style={portionChkStyle}>
              <input type="checkbox" checked={printPortionMask.high} onChange={()=>togglePrintPortion("high")}/>
              High
            </label>
            {portionFilterActive&&(
              <button type="button" className="no-print" onClick={()=>setPrintPortionMask({...DEFAULT_PRINT_PORTION_MASK})} style={{fontSize:11,fontWeight:600,color:C.navy,background:"transparent",border:"none",cursor:"pointer",textDecoration:"underline",padding:0}}>
                All portions
              </button>
            )}
          </div>
        )}
        {view==="byClass"&&<Sel value={byClassCls} onChange={setByClassCls} options={[{value:"__all_classes__",label:"All classes"},...settings.classes.map(c=>({value:c.id,label:formatClassDisplay(c)}))]}/>}
        {view==="byTeacher"&&<Sel value={byTeacherName} onChange={setByTeacherName} options={[{value:"__all_staff__",label:"All staff"},...teachingStaff.map(st=>({value:st.name,label:st.name}))]}/>}
        <Btn small outline onClick={handleTimetablePdf}>Export PDF</Btn>
      </div>
    </div>

    <div className="timetable-main-content" ref={timetableTableRef} style={{width:"100%",maxWidth:"100%",minWidth:0,boxSizing:"border-box"}}>
    {view==="allClasses"&&(classesForView.length>0?<AllClassesView settings={settings} staffProfiles={staffProfiles} timetable={timetable} setTimetable={setTimetable} day="Monday" classes={classesForView}/>:<div className="no-print" style={{padding:20,textAlign:"center",color:C.gray,fontSize:13}}>No classes for <strong>{portionLabel}</strong>. Tick another portion or use &quot;All portions&quot;.</div>)}
    {view==="teachers"&&(staffForView.length>0?<TeachersView settings={settings} timetable={timetable} day="Monday" staff={staffForView} suppressPrintHeader/>:<div className="no-print" style={{padding:20,textAlign:"center",color:C.gray,fontSize:13}}>No teachers for <strong>{portionLabel}</strong>. Tick another portion or use &quot;All portions&quot;.</div>)}
    {view==="byClass"&&byClassCls!=="__all_classes__"&&<div className="by-class-single"><ByClassView settings={settings} timetable={timetable} selCls={byClassCls} suppressPrintHeader/></div>}
    {view==="byClass"&&byClassCls==="__all_classes__"&&<div className="all-classes-batch-print">
      {classesForView.map((c, i) => (
        <div key={c.id} style={{ pageBreakAfter: i < classesForView.length - 1 ? 'always' : 'auto', breakAfter: i < classesForView.length - 1 ? 'page' : 'auto', marginBottom: i < classesForView.length - 1 ? 40 : 0 }}>
          <ByClassView settings={settings} timetable={timetable} selCls={c.id} suppressPrintHeader={false}/>
        </div>
      ))}
    </div>}
    {view==="byTeacher"&&byTeacherName!=="__all_staff__"&&<div className="by-teacher-single"><ByTeacherView settings={settings} timetable={timetable} selT={byTeacherName} suppressPrintHeader/></div>}
    {view==="byTeacher"&&byTeacherName==="__all_staff__"&&<div className="all-teachers-batch-print">
      {staffForView.map((st, i) => (
        <div key={st.id || st.name} style={{ pageBreakAfter: i < staffForView.length - 1 ? 'always' : 'auto', breakAfter: i < staffForView.length - 1 ? 'page' : 'auto', marginBottom: i < staffForView.length - 1 ? 40 : 0 }}>
          <ByTeacherView settings={settings} timetable={timetable} selT={st.name} suppressPrintHeader={false}/>
        </div>
      ))}
    </div>}
    </div>
  </div>;
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
function ClassSubjCard({cls,examSubjects,timetableSubjects,onAddExam,onRemoveExam,onAddTimetable,onRemoveTimetable,onRemoveClass}){
  const [examNs,setExamNs]=useState("");
  const [ttNs,setTtNs]=useState("");
  return <div style={{background:"#f9fafb",border:"1px solid #9ca3af",borderRadius:8,padding:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <span style={{fontWeight:700,color:C.navy,fontSize:13}}>{formatClassDisplay(cls)}</span>
      <Btn small danger onClick={onRemoveClass}>×</Btn>
    </div>
    <div style={{marginBottom:10}}>
      <div style={{fontSize:11,fontWeight:700,color:C.gray,marginBottom:6}}>Subjects for Examination</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
        {examSubjects.map(s=><span key={`exam_${s}`} style={{background:"#dbeafe",color:"#1e40af",borderRadius:20,padding:"2px 8px",fontSize:11,display:"flex",alignItems:"center",gap:3}}>
          {s}<button onClick={()=>onRemoveExam(s)} style={{background:"none",border:"none",cursor:"pointer",color:"#1e40af",padding:0,fontWeight:700}}>×</button>
        </span>)}
      </div>
      <div style={{display:"flex",gap:6}}>
        <input value={examNs} onChange={e=>setExamNs(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){onAddExam(examNs);setExamNs("");}}} placeholder="Add exam subject..."
          style={{flex:1,padding:"4px 8px",border:"1px solid #d1d5db",borderRadius:4,fontSize:12}}/>
        <Btn small onClick={()=>{onAddExam(examNs);setExamNs("");}}>+</Btn>
      </div>
    </div>
    <div>
      <div style={{fontSize:11,fontWeight:700,color:C.gray,marginBottom:6}}>Subjects for Timetable</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
        {timetableSubjects.map(s=><span key={`tt_${s}`} style={{background:"#dcfce7",color:"#166534",borderRadius:20,padding:"2px 8px",fontSize:11,display:"flex",alignItems:"center",gap:3}}>
          {s}<button onClick={()=>onRemoveTimetable(s)} style={{background:"none",border:"none",cursor:"pointer",color:"#166534",padding:0,fontWeight:700}}>×</button>
        </span>)}
      </div>
      <div style={{display:"flex",gap:6}}>
        <input value={ttNs} onChange={e=>setTtNs(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){onAddTimetable(ttNs);setTtNs("");}}} placeholder="Add timetable subject..."
          style={{flex:1,padding:"4px 8px",border:"1px solid #d1d5db",borderRadius:4,fontSize:12}}/>
        <Btn small onClick={()=>{onAddTimetable(ttNs);setTtNs("");}}>+</Btn>
      </div>
    </div>
  </div>;
}

function CommonTeachersEditor({settings,setSettings}){
  // Only consider classes that have a section (i.e. multiple sections per grade)
  const grades=[...new Set(settings.classes.filter(c=>c.section).map(c=>c.grade))];
  const getC=(g,s)=>settings.commonTeachers?.[g]?.[s]||false;
  const setC=(g,s,t)=>setSettings(prev=>({...prev,commonTeachers:{...prev.commonTeachers,[g]:{...(prev.commonTeachers?.[g]||{}),[s]:t}}}));
  return <div>
    <p style={{fontSize:13,color:C.gray,marginTop:0}}>Assign a common teacher for a subject shared across all sections of the same grade. Auto-fills other sections when you assign in the timetable.</p>
    {grades.map(grade=>{
      const gClasses=settings.classes.filter(c=>c.grade===grade && c.section);
      if(gClasses.length<1) return null;
      // All subjects from classes that have a section (no duplicate filtering by sections now)
      const allSubjs=[...new Set(
        gClasses.flatMap(cls=>getClassSubjects(settings,cls.id,"timetable").map(s=>(s||"").trim()).filter(Boolean))
      )];
      return <div key={grade} style={{background:"#f9fafb",border:"1px solid #9ca3af",borderRadius:8,padding:14,marginBottom:12}}>
        <h4 style={{margin:"0 0 10px",color:C.navy}}>Grade {grade} — Sections: {gClasses.map(c=>c.name).join(", ")}</h4>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
          {allSubjs.map(subj=>{
            const isCommon=!!getC(grade,subj);
            return <div key={subj} style={{display:"flex",flexDirection:"row",alignItems:"center",gap:6}}>
              <input type="checkbox" checked={isCommon} onChange={e=>setC(grade,subj,e.target.checked)} />
              <span style={{fontSize:12,fontWeight:700,color:C.gray}}>{subj}</span>
            </div>;
          })}
        </div>
      </div>;
    })}
  </div>;
}

// ─── EXCEL HELPERS (Settings) ───────────────────────────────────────────────
async function downloadExcel(wb, filename) {
  await yieldToMain();
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function pdfDataUrlFormat(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return "PNG";
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) return "JPEG";
  return "PNG";
}
async function brandingLogoDataUrlForPdf(settingsLogo) {
  if (settingsLogo && (settingsLogo.startsWith("data:") || settingsLogo.startsWith("blob:"))) return settingsLogo;
  try {
    const res = await fetch(APP_BRAND_LOGO_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
/** PDF header emblem size (mm); keep in sync with text offset below. */
const PDF_HEADER_LOGO_MM = 14;
async function addPdfBrandingLogoRow(doc, settingsLogo, left, yTop) {
  const data = await brandingLogoDataUrlForPdf(settingsLogo);
  const size = PDF_HEADER_LOGO_MM;
  if (!data) return { textX: left, tableStartY: yTop + 8 };
  const fmt = pdfDataUrlFormat(data);
  try {
    doc.addImage(data, fmt, left, yTop, size, size);
  } catch {
    try {
      doc.addImage(data, fmt === "JPEG" ? "PNG" : "JPEG", left, yTop, size, size);
    } catch {
      doc.setFillColor(26, 58, 107);
      doc.rect(left, yTop, size, size, "F");
    }
  }
  return { textX: left + size + 4, tableStartY: yTop + size + 6 };
}

// ─── EXPORT TABLE TO PDF / EXCEL (header: logo, school name, session, table name, date/time) ───
function getExportHeaderMeta(settings, session, tableName){
  const dateStr = new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
  return {
    schoolName: settings?.schoolName || "School Name",
    session: session || "",
    tableName: tableName || "",
    dateStr,
    timeStr,
    subtitle: [session, tableName].filter(Boolean).join(" - "),
  };
}

/** Safe fragment for PDF download filenames (class name, etc.). */
function sanitizePdfFilenamePart(raw) {
  const s = String(raw || "export")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return (s || "export").slice(0, 72);
}
async function exportTableToExcel(settings, session, tableName, columnHeaders, dataRows, filename) {
  await yieldToMain();
  const meta = getExportHeaderMeta(settings, session, tableName);
  const headerRows = [
    [meta.schoolName],
    [meta.subtitle || meta.tableName],
    ["Date: " + meta.dateStr, "Time: " + meta.timeStr],
    [],
    columnHeaders,
  ];
  const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  await downloadExcel(wb, filename || "export.xlsx");
}
/** Ensure autotable cells are strings or { content, colSpan?, rowSpan? } (no undefined / bad objects). */
function sanitizePdfCell(val) {
  if (val == null) return "";
  if (typeof val === "object" && !Array.isArray(val)) {
    const content = val.content != null ? String(val.content) : "";
    const out = { content };
    const cs = Number(val.colSpan);
    const rs = Number(val.rowSpan);
    if (cs > 1) out.colSpan = cs;
    if (rs > 1) out.rowSpan = rs;
    return out;
  }
  return String(val);
}
function sanitizePdfTableRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => (Array.isArray(row) ? row.map(sanitizePdfCell) : []));
}

/** Same summary blocks as `ByTeacherView` footer — for teacher planner PDF only (not Faculty / TEACHERS). */
function teacherPlannerFooterColumns(settings) {
  const ppd = Number(settings.periodsPerDay) || 8;
  const friEnd = 4;
  return [
    {
      label: "Monday to Thursday and Saturday",
      rows: [
        ["Assembly", `${settings.assemblyTime} minutes`],
        [getPeriodLabel(0, settings), `${settings.firstPeriodTime} minutes`],
        [`${getPeriodLabel(1, settings)} to ${getPeriodLabel(ppd - 1, settings)}`, `${settings.otherPeriodTime} minutes`],
        ["Break", settings.breakRequired ? `${settings.breakDuration} minutes` : "No Break"],
      ],
    },
    {
      label: "Friday",
      rows: [
        ["Assembly", `${settings.assemblyTime} minutes`],
        [getPeriodLabel(0, settings), `${settings.firstPeriodTime} minutes`],
        [`${getPeriodLabel(1, settings)} to ${getPeriodLabel(friEnd, settings)}`, `${settings.otherPeriodTime} minutes`],
        ["Break", settings.fridayBreak ? `${settings.fridayBreakDuration} minutes` : "0 minutes"],
      ],
    },
  ];
}

function drawTeacherPlannerFooterColumn(doc, x, colW, y0, col) {
  const lh = 4.2;
  let y = y0;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const titleLines = doc.splitTextToSize(col.label, colW);
  titleLines.forEach((ln) => {
    doc.text(ln, x, y);
    y += lh;
  });
  y += 1;
  doc.setFontSize(9);
  col.rows.forEach(([k, val]) => {
    const isBreak = k === "Break";
    doc.setFont("helvetica", isBreak ? "bold" : "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(String(k), x, y);
    doc.text(String(val), x + colW, y, { align: "right" });
    y += lh;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.15);
    doc.line(x, y - lh * 0.35, x + colW, y - lh * 0.35);
  });
  return y;
}

/** Schedule summary + school hours note under the teacher planner table in exported PDFs. */
function appendTeacherPlannerScheduleFooterPdf(doc, settings, tableEndY) {
  if (!settings) return;
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const left = 10;
  const right = pageW - 10;
  const gutter = 4;
  const colW = (right - left - gutter) / 2;
  const xL = left;
  const xR = left + colW + gutter;
  const cols = teacherPlannerFooterColumns(settings);
  const estH = 52;
  let yTop = tableEndY + 5;
  if (yTop + estH > pageH - 8) {
    doc.addPage();
    yTop = 14;
  }
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.25);
  doc.line(left, yTop, right, yTop);
  const yBase = yTop + 4;
  const yEndL = drawTeacherPlannerFooterColumn(doc, xL, colW, yBase, cols[0]);
  const yEndR = drawTeacherPlannerFooterColumn(doc, xR, colW, yBase, cols[1]);
  let y = Math.max(yEndL, yEndR) + 3;
  doc.setDrawColor(229, 231, 235);
  doc.line(left, y, right, y);
  y += 4;
  const sh = settings.schoolHours || {};
  const mth = sh.mondayToThursday || {};
  const fri = sh.friday || {};
  const note = `The teacher will arrive 15 minutes before school starts. School: Mon–Thu ${mth.start || "—"}–${mth.end || "—"} | Friday ${fri.start || "—"}–${fri.end || "—"}`;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  const noteLines = doc.splitTextToSize(note, right - left);
  noteLines.forEach((ln) => {
    doc.text(ln, (left + right) / 2, y, { align: "center" });
    y += 3.8;
  });
  doc.setFont("helvetica", "normal");
}

function isTeacherPlannerTimetablePdfTitle(tableName) {
  return /\bTEACHER\s+TIMETABLE\b/i.test(String(tableName || ""));
}

/**
 * Appends branding header + one table to the current page of `doc` (used by single-file export and multi-section timetable batch PDF).
 * @param {HTMLTableElement} [htmlTableEl] — when set for timetable exports, use autotable `html` mode (fixes colspan/rowspan vs manual matrix).
 * @param {{ subtitleOverride?: string }} [exportPdfOptions] — optional PDF header subtitle (e.g. class-first attendance titles).
 */
async function appendExportTablePdfSection(doc, settings, session, tableName, columnHeaders, dataRows, htmlTableEl, exportPdfOptions) {
  const meta = getExportHeaderMeta(settings, session, tableName);
  const pageW = doc.internal.pageSize.getWidth();
  const yTop = 10;
  const left = 10;
  const right = pageW - 10;
  const hdr = await addPdfBrandingLogoRow(doc, settings?.logo, left, yTop);
  const headTextMaxW = Math.max(40, right - hdr.textX - 2);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  const schoolLines = doc.splitTextToSize(String(meta.schoolName || "School Name"), headTextMaxW);
  let leftY = yTop + 10;
  schoolLines.forEach((ln) => {
    doc.text(ln, hdr.textX, leftY);
    leftY += 5.2;
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const subLine =
    exportPdfOptions?.subtitleOverride != null && String(exportPdfOptions.subtitleOverride).trim() !== ""
      ? String(exportPdfOptions.subtitleOverride).trim()
      : meta.subtitle || meta.tableName;
  const subLines = doc.splitTextToSize(subLine, headTextMaxW);
  let subY = leftY + 2;
  subLines.forEach((ln) => {
    doc.text(ln, hdr.textX, subY);
    subY += 4.2;
  });
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("Date: " + meta.dateStr, right, yTop + 10, { align: "right" });
  doc.text("Time: " + meta.timeStr, right, yTop + 18, { align: "right" });
  // Table must start below subtitle and below logo-derived tableStartY (subtitle is not in tableStartY).
  const yAfterSubtitle = subY + 5;
  let y = Math.max(hdr.tableStartY + 2, yAfterSubtitle);
  const titleStr = String(tableName || "");
  const isTimetableGridExport = /\bTIMETABLE\b/i.test(titleStr);
  const isExamConsolidated = titleStr.includes("Consolidated");
  /** Timetable PDFs (Classes / Faculty / Class planner / Teacher planner): black/white table, solid borders. */
  const timetablePdfTable = isTimetableGridExport
    ? {
        headStyles: {
          fillColor: [0, 0, 0],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
          cellPadding: 2,
          fontSize: 7,
        },
        bodyStyles: {
          halign: "center",
          valign: "middle",
          cellPadding: 2,
          fontSize: 7,
          overflow: "linebreak",
          textColor: 0,
          fillColor: false,
        },
        styles: {
          halign: "center",
          valign: "middle",
          lineWidth: { top: 0.35, right: 0.35, bottom: 0.35, left: 0.35 },
          lineColor: [0, 0, 0],
          textColor: 0,
          overflow: "linebreak",
          fontSize: 7,
        },
        alternateRowStyles: { fillColor: false, textColor: 0 },
      }
    : {
        headStyles: {
          fillColor: [26, 58, 107],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
          cellPadding: isExamConsolidated ? 2 : 4,
          fontSize: isExamConsolidated ? 8 : undefined,
        },
        bodyStyles: {
          halign: "center",
          valign: "middle",
          cellPadding: isExamConsolidated ? 2 : 4,
          fontSize: isExamConsolidated ? 8 : undefined,
          overflow: "linebreak",
          textColor: [0, 0, 0],
          fillColor: false,
        },
        styles: {
          halign: "center",
          valign: "middle",
          lineWidth: 0.2,
          lineColor: [0, 0, 0],
          overflow: "linebreak",
          fontSize: isExamConsolidated ? 8 : undefined,
          textColor: [0, 0, 0],
        },
        alternateRowStyles: { fillColor: [248, 250, 252], textColor: [0, 0, 0] },
      };
  const margin = { left: left, right: 10 };
  try {
    if (
      isTimetableGridExport &&
      htmlTableEl &&
      typeof htmlTableEl.rows === "object" &&
      htmlTableEl.rows &&
      htmlTableEl.rows.length > 0
    ) {
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      autoTable(doc, {
        html: htmlTableEl,
        startY: y,
        theme: "grid",
        ...timetablePdfTable,
        margin,
      });
      if (isTeacherPlannerTimetablePdfTitle(tableName)) {
        const endY = doc.lastAutoTable?.finalY ?? y;
        appendTeacherPlannerScheduleFooterPdf(doc, settings, endY);
      }
    } else {
      const head = Array.isArray(columnHeaders[0]) ? columnHeaders : [columnHeaders];
      const headSan = sanitizePdfTableRows(head);
      const bodySan = sanitizePdfTableRows(Array.isArray(dataRows) ? dataRows : []);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      autoTable(doc, {
        head: headSan,
        body: bodySan,
        startY: y,
        theme: "grid",
        ...timetablePdfTable,
        margin,
      });
    }
  } catch (err) {
    console.error("appendExportTablePdfSection", err);
    throw err;
  }
}

/** Class planner (all classes) / Teacher planner (all staff): one PDF, one section per class or staff member. */
async function exportTimetableBatchPlannerPdf(settings, session, sections, filename) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  for (let i = 0; i < sections.length; i++) {
    if (i > 0) doc.addPage();
    const { tableName, htmlTableEl } = sections[i];
    await appendExportTablePdfSection(doc, settings, session, tableName, [], [], htmlTableEl);
  }
  doc.save(filename || "export.pdf");
}

/**
 * @param {HTMLTableElement} [htmlTableEl] — when set for timetable exports, use autotable `html` mode (fixes colspan/rowspan vs manual matrix).
 * @param {{ subtitleOverride?: string }} [exportPdfOptions] — optional PDF header subtitle.
 */
async function exportTableToPdf(settings, session, tableName, columnHeaders, dataRows, filename, htmlTableEl, exportPdfOptions) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await appendExportTablePdfSection(doc, settings, session, tableName, columnHeaders, dataRows, htmlTableEl, exportPdfOptions);
  doc.save(filename || "export.pdf");
}

/** Consolidated marks PDF: logo + school, session, exam, sheet title, class, counts, date/time on every page. */
async function exportConsolidatedSheetToPdf(settings, session, exam, className, columnHeaders, dataRows, filename) {
  const meta = getExportHeaderMeta(settings, session, `${exam} — Consolidated (${className})`);
  // Handle multi-row headers if present
  const headRows = Array.isArray(columnHeaders[0]) ? columnHeaders : [columnHeaders];
  const headers = headRows[0]; // First row for index lookups

  const rows = Array.isArray(dataRows) ? dataRows : [];
  const statusIdx = headers.findIndex((h) => /^status$/i.test(String(typeof h === "object" ? h.content : h || "").trim()));
  const pctIdx = headers.findIndex((h) => {
    const val = typeof h === "object" ? h.content : h;
    const n = String(val || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    return n === "pct" || n === "pct%" || n === "%";
  });
  const passThreshold = Number(settings?.passPercent) || 50;
  const passPctNumHdr = Number(settings?.passPercent);
  const passPercentHdr = `${Number.isFinite(passPctNumHdr) ? Math.max(0, Math.min(100, passPctNumHdr)) : 50}%`;
  let passCount = 0;
  let failCount = 0;
  if (statusIdx >= 0) {
    rows.forEach((row) => {
      const v = String(row[statusIdx] || "")
        .trim()
        .toLowerCase();
      if (v === "pass") passCount++;
      else if (v === "fail") failCount++;
    });
  } else if (pctIdx >= 0) {
    rows.forEach((row) => {
      const raw = String(row[pctIdx] || "")
        .replace(/%/g, "")
        .trim();
      const p = parseFloat(raw);
      if (Number.isNaN(p)) return;
      if (p >= passThreshold) passCount++;
      else failCount++;
    });
  }

  const totalStudents = rows.length;
  const logoData = await brandingLogoDataUrlForPdf(settings?.logo);
  const logoFmt = logoData ? pdfDataUrlFormat(logoData) : null;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const left = 10;
  const right = pageW - 10;
  const yTop = 7;
  const logoSize = PDF_HEADER_LOGO_MM;
  const textXBase = left + (logoData && logoFmt ? logoSize + 4 : 0);
  const maxTextW = Math.max(60, right - textXBase - 2);

  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  const nameLines = doc.splitTextToSize(String(meta.schoolName || "School Name"), maxTextW);
  const nameBlockH = nameLines.length * 4.6;
  const bottomTextBlock = yTop + 5 + nameBlockH + 1 + 4.2 + 4.2 + 4;
  const marginTop = Math.max(yTop + logoSize + 7, bottomTextBlock + 4);

  const nameLeftColumnStyles = {};
  headers.forEach((h, idx) => {
    const val = typeof h === "object" ? h.content : h;
    const t = String(val || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (t === "student name" || t.includes("student name")) nameLeftColumnStyles[idx] = { halign: "left" };
    if (t === "father's name" || t === "fathers name" || t.includes("father's name") || (t.includes("father") && t.includes("name")))
      nameLeftColumnStyles[idx] = { halign: "left" };
  });

  const drawHeader = (pdf, pageNumber) => {
    let textX = left;
    if (logoData && logoFmt) {
      try {
        pdf.addImage(logoData, logoFmt, left, yTop, logoSize, logoSize);
      } catch {
        try {
          pdf.addImage(logoData, logoFmt === "JPEG" ? "PNG" : "JPEG", left, yTop, logoSize, logoSize);
        } catch {
          /* ignore */
        }
      }
      textX = left + logoSize + 4;
    }
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(12);
    pdf.setFont(undefined, "bold");
    pdf.text(nameLines, textX, yTop + 5);
    const afterNameY = yTop + 5 + nameBlockH + 1;
    pdf.setFont(undefined, "normal");
    pdf.setFontSize(8.8);
    pdf.setTextColor(65, 65, 65);
    let yLine = afterNameY;
    pdf.text(`Session: ${session || "—"}  |  Exam: ${exam || "—"}  |  Sheet: Consolidated Sheet`, textX, yLine);
    yLine += 4.2;
    pdf.text(
      `Class: ${className || "—"}  |  Pass %: ${passPercentHdr}  |  Total students: ${totalStudents}  |  Pass: ${passCount}  |  Fail: ${failCount}`,
      textX,
      yLine
    );
    pdf.setFontSize(8);
    pdf.setTextColor(45, 45, 45);
    pdf.text(`Date: ${meta.dateStr}`, right, yTop + 5, { align: "right" });
    pdf.text(`Page ${pageNumber}`, right, yTop + 10, { align: "right" });
    pdf.setTextColor(0, 0, 0);
  };

  autoTable(doc, {
    head: headRows,
    body: rows,
    margin: { top: marginTop, left, right: 10, bottom: 10 },
    willDrawPage: (data) => {
      drawHeader(data.doc, data.pageNumber);
    },
    showHead: "everyPage",
    theme: "grid",
    headStyles: {
      fillColor: [26, 58, 107],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      cellPadding: 2,
      fontSize: 8,
    },
    bodyStyles: {
      halign: "center",
      valign: "middle",
      cellPadding: 2,
      fontSize: 8,
      overflow: "linebreak",
    },
    styles: {
      halign: "center",
      valign: "middle",
      lineWidth: 0.2,
      lineColor: [0, 0, 0],
      overflow: "linebreak",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: nameLeftColumnStyles,
  });
  doc.save(filename || "Consolidated.pdf");
}

function getTableDataFromElement(containerEl) {
  if (!containerEl) return { headers: [], rows: [] };
  const table =
    containerEl.querySelector("table.timetable-pdf-export") || containerEl.querySelector("table");
  if (!table) return { headers: [], rows: [] };
  const extractCell = (cell) => {
    const colSpan = parseInt(cell.getAttribute("colspan") || "1", 10);
    const rowSpan = parseInt(cell.getAttribute("rowspan") || "1", 10);
    const content = (cell.innerText || cell.textContent || "").trim();
    if (colSpan > 1 || rowSpan > 1) {
      const o = { content };
      if (colSpan > 1) o.colSpan = colSpan;
      if (rowSpan > 1) o.rowSpan = rowSpan;
      return o;
    }
    return content;
  };
  const extractRow = (tr) => {
    const row = [];
    tr.querySelectorAll("th, td").forEach((cell) => row.push(extractCell(cell)));
    return row;
  };
  const headRows = [];
  const thead = table.querySelector("thead");
  if (thead) {
    thead.querySelectorAll("tr").forEach((tr) => {
      const r = extractRow(tr);
      if (r.length) headRows.push(r);
    });
  }
  const rows = [];
  table.querySelectorAll("tbody tr").forEach((tr) => {
    const rd = extractRow(tr);
    if (rd.length) rows.push(rd);
  });
  return { headers: headRows.length === 1 ? headRows[0] : headRows, rows };
}
/** Parse marks from Excel for import: finite number, or null to skip cell (no error). */
function parseMarksImportCell(raw){
  if(raw==null||raw==="") return null;
  if(typeof raw==="boolean") return null;
  if(typeof raw==="number"){
    return Number.isFinite(raw)?raw:null;
  }
  let s=String(raw).replace(/\u00a0/g," ").trim();
  if(!s) return null;
  if(/^(?:-|—|–|n\/?a|na|abs|absent|leave|exc|\.{2,})$/i.test(s.replace(/\s+/g,""))) return null;
  s=s.replace(/,/g,"").replace(/\s+/g," ");
  let n=parseFloat(s);
  if(Number.isFinite(n)) return n;
  const m=s.match(/-?\d+(?:\.\d+)?/);
  if(m){
    n=parseFloat(m[0]);
    if(Number.isFinite(n)) return n;
  }
  return null;
}
function excelDateToDDMMYYYY(v){
  if (v === undefined || v === null || v === "") return "";
  if (typeof v === "number") {
    const base = new Date(Date.UTC(1899, 11, 30)); // Excel serial date base
    base.setUTCDate(base.getUTCDate() + Math.floor(v));
    const d = String(base.getUTCDate()).padStart(2,"0");
    const m = String(base.getUTCMonth()+1).padStart(2,"0");
    const y = base.getUTCFullYear();
    return `${d}/${m}/${y}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  return s;
}
// Staff profile: dates dd/mm/yyyy, CNIC 00000-0000000-0, phone 0000 0000000, text proper case
function staffDateToDDMMYYYY(val) {
  if (val == null || val === "") return "";
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  return s;
}
function staffFormatCNIC(val) {
  if (val == null) return "";
  const digits = String(val).replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return digits.slice(0, 5) + "-" + digits.slice(5);
  return digits.slice(0, 5) + "-" + digits.slice(5, 12) + "-" + digits.slice(12, 13);
}
function staffFormatPhone(val) {
  if (val == null) return "";
  const digits = String(val).replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  return digits.slice(0, 4) + " " + digits.slice(4);
}
function toProperCase(str) {
  if (str == null || typeof str !== "string") return "";
  return str.trim().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, " ");
}
/** Title-case while typing: normalizes internal spaces but keeps trailing spaces so gaps between words can be entered. */
function toProperCaseNameInput(str) {
  if (str == null || typeof str !== "string") return "";
  const trailing = str.match(/\s*$/)[0];
  const head = str.slice(0, str.length - trailing.length);
  const collapsed = head.replace(/^\s+/, "").replace(/\s+/g, " ");
  if (!collapsed && !trailing) return "";
  const titled = collapsed.replace(/\b\w/g, (c) => c.toUpperCase());
  return titled + trailing;
}
function staffFormatDateInput(val) {
  if (val == null || val === "") return "";
  const s = String(val).trim();
  const digits = s.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4, 8);
}
function parseWorkbook(file, cb){
  const r = new FileReader();
  r.onerror = () => cb(new Error("Could not read file. Make sure it is a valid .xlsx or .xls file."), null);
  r.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: "array" });
      const getSheet = (name) => {
        const sh = wb.Sheets[name];
        return sh ? XLSX.utils.sheet_to_json(sh, { header: 1, defval: "" }) : null;
      };
      const sheetNames = Array.isArray(wb.SheetNames) ? wb.SheetNames : [];
      const reserved = new Set([
        "General",
        "Classes & Subjects",
        "Classes",
        "Staff Profiles",
        "Staff Profile",
        "Staff",
        "Student Records",
        "Students",
      ]);
      const classSheets = sheetNames
        .filter((n) => !reserved.has(n))
        .map((name) => ({ name, rows: getSheet(name) }))
        .filter((s) => Array.isArray(s.rows) && s.rows.length >= 2);
      cb(null, {
        General: getSheet("General"),
        Classes: getSheet("Classes & Subjects") || getSheet("Classes"),
        Staff: getSheet("Staff Profiles") || getSheet("Staff Profile") || getSheet("Staff"),
        Students: getSheet("Student Records") || getSheet("Students"),
        ClassSheets: classSheets,
        SheetNames: sheetNames,
      });
    } catch (err) {
      cb(err, null);
    }
  };
  r.readAsArrayBuffer(file);
}

function getTeachersWithAssignments(settings,timetable){
  if(!settings?.classes?.length||!timetable) return [];
  const periodsPerDay=Number(settings.periodsPerDay)||8;
  const byTeacher=new Map();
  for(const cls of settings.classes){
    const days=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    for(const day of days){
      for(let pi=0;pi<periodsPerDay;pi++){
        const cell=getTT(timetable,cls.id,day,pi);
        if(cell?.teacher){
          const t=cell.teacher.trim();
          if(!t) continue;
          if(!byTeacher.has(t)) byTeacher.set(t,{teacherName:t,classes:[]});
          const arr=byTeacher.get(t).classes;
          if(!arr.some(c=>c.classId===cls.id&&c.subject===(cell.subject||"").trim())) arr.push({classId:cls.id,className:cls.name,grade:cls.grade||"",subject:(cell.subject||"").trim()});
        }
      }
    }
  }
  return Array.from(byTeacher.values());
}

function SettingsPage({settings,setSettings,setSchools,students,setStudents,schools,activeSchoolId,timetable,exam_tm,exam_om,setExamMarks,currentSession,sessions,setCurrentSession,addSession,staffProfiles,setBarSubtitle,session}){
  const isPrincipal = !session || session.userType==="principal"||session.userType==="school"||session.userType==="admin-created"||session.userType==="local";
  const staffList=Array.isArray(staffProfiles)?staffProfiles:[];
  const teachingStaffCount=staffList.filter(isTeachingStaffMember).length;
  const nonTeachingStaffCount=Math.max(0,staffList.length-teachingStaffCount);
  const [tab,setTab]=useState("general");
  const [newCls,setNewCls]=useState({grade:"",section:""});
  const fileRef=useRef();
  const bannerUploadRef=useRef();
  const resultCardSignatureUploadRef=useRef();
  const settingsExcelRef=useRef();
  const awardListExcelRef=useRef();
  const classesAndStaffExcelRef=useRef();
  const studentImportRef=useRef();
  const sessionInputRef=useRef();
  const tabs=[{id:"general",label:"General"},{id:"school",label:"School"},{id:"classes",label:"Classes & Subjects"},{id:"staffProfiles",label:"Staff Profiles"},{id:"common",label:"Common Teachers"},{id:"time",label:"Time & Periods"},{id:"awardList",label:"Award List"},...(isPrincipal?[{id:"teachers",label:"👩‍🏫 Teacher Accounts"}]:[])];
  // ── Teacher management state (principals only) ──
  const [tcStaffId,setTcStaffId]=useState("");
  const [tcName,setTcName]=useState("");
  const [tcEmail,setTcEmail]=useState("");
  const [tcPassword,setTcPassword]=useState("");
  const [tcError,setTcError]=useState("");
  const [tcSuccess,setTcSuccess]=useState("");
  const [tcList,setTcList]=useState(()=>loadAuthUsers().filter(u=>u.userType==="teacher"&&u.schoolId===activeSchoolId));
  const refreshTc=()=>setTcList(loadAuthUsers().filter(u=>u.userType==="teacher"&&u.schoolId===activeSchoolId));
  const [tcEditId,setTcEditId]=useState(null);
  const [tcEditPw,setTcEditPw]=useState("");
  const [tcEditPwErr,setTcEditPwErr]=useState("");
  // ── Operator account state (principals only) ──
  const [opName,setOpName]=useState("");
  const [opEmail,setOpEmail]=useState("");
  const [opPassword,setOpPassword]=useState("");
  const [opError,setOpError]=useState("");
  const [opSuccess,setOpSuccess]=useState("");
  const [opList,setOpList]=useState(()=>loadAuthUsers().filter(u=>u.userType==="school"&&u.schoolId===activeSchoolId));
  const refreshOp=()=>setOpList(loadAuthUsers().filter(u=>u.userType==="school"&&u.schoolId===activeSchoolId));
  const [opEditId,setOpEditId]=useState(null);
  const [opEditPw,setOpEditPw]=useState("");
  const [opEditPwErr,setOpEditPwErr]=useState("");

  // Sheet header definitions for the master workbook
  const STAFF_PROFILE_SHEET_HEADERS = [
    { id: "photo", label: "Photo" },
    { id: "staffCategory", label: "Category" },
    { id: "cpn", label: "Personal#" },
    { id: "name", label: "Full Name" },
    { id: "fname", label: "Father's Name" },
    { id: "cnic", label: "CNIC" },
    { id: "bps", label: "BPS" },
    { id: "designation", label: "Designation" },
    { id: "dob", label: "DOB" },
    { id: "domicile", label: "Domicile" },
    { id: "aq", label: "Academic Qualification" },
    { id: "subj", label: "Subject" },
    { id: "pq", label: "Professional Qualification" },
    { id: "doe", label: "Date of Employment" },
    { id: "dprs", label: "Date of Present Scale" },
    { id: "dppp", label: "Date of Promotion to Present Position" },
    { id: "daps", label: "Date of Appointment in Present Scale" },
    { id: "contact", label: "Contact Number" },
    { id: "email", label: "Email Address" },
    { id: "bankName", label: "BankName" },
    { id: "accNo", label: "AccNo" },
    { id: "iban", label: "IBAN" },
    { id: "bankCode", label: "BankCode" },
    { id: "branch", label: "BranchName" },
    { id: "address", label: "Address" },
    { id: "emergencyContact", label: "Emergency Contact" },
    { id: "employeeStatus", label: "Employee Status" },
    { id: "department", label: "Department" },
  ];
  const STAFF_PROFILE_HEADER_TO_ID = {
    ...STAFF_PROFILE_SHEET_HEADERS.reduce((map,h)=>{ map[h.label.toLowerCase()] = h.id; return map; },{}),
    // backward compat with old short labels
    "staff category": "staffCategory", "staff type": "staffCategory", "category": "staffCategory", "type": "staffCategory",
    "cpn": "cpn", "name": "name", "fname": "fname", "desgcadre": "designation",
    "aq": "aq", "subj": "subj", "pq": "pq", "doe": "doe", "dprs": "dprs",
    "dppp": "dppp", "daps": "daps", "contactno": "contact", "email": "email",
    "bankname": "bankName", "accno": "accNo", "branchname": "branch",
  };

  const _downloadTemplate = async () => {
    await yieldToMain();
    const wb = XLSX.utils.book_new();
    const wsClasses = XLSX.utils.aoa_to_sheet([
      ["Class ID","Class Name","Grade","Section","Subjects for Examination","Subjects for Timetable"],
      ["10-BS","10TH-BS","10","BS","English, Physics, Urdu","English, Physics, Urdu"],
      ["9-CS","9TH-CS","9","CS","English, Computer, Urdu","English, Computer, Urdu"],
    ]);
    const staffTemplateHeaders = STAFF_PROFILE_SHEET_HEADERS.filter(h=>h.id!=="photo").map(h=>h.label);
    const wsStaff = XLSX.utils.aoa_to_sheet([staffTemplateHeaders]);
    XLSX.utils.book_append_sheet(wb, wsClasses, "Classes & Subjects");
    XLSX.utils.book_append_sheet(wb, wsStaff, "Staff Profiles");
    await downloadExcel(wb, "template.xlsx");
  };
  const importFromExcel=(e)=>{
    const f = e.target.files[0]; if (!f) return;
    parseWorkbook(f, (err, sheets)=>{
      if (err) { alert("Failed to read file: " + err.message); e.target.value = ""; return; }
      let msg = [];
      let importedClasses = [];
      if (sheets.General && sheets.General.length >= 2) { const r = sheets.General[1] || []; setSettings(s => ({ ...s, schoolName: String(r[0] || s.schoolName || ""), principalName: String(r[1] || s.principalName || ""), schoolCode: String(r[2] || s.schoolCode || "") })); msg.push("General"); }
      if (sheets.Classes && sheets.Classes.length >= 2) {
        const [, ...dataRows] = sheets.Classes;
        const classSubjectsExam = {};
        const classSubjectsTimetable = {};
        const conflicts = [];
        const byId = {};
        dataRows.forEach(row => {
          const id = String(row[0] || "").trim();
          const name = String(row[1] || "").trim();
          const grade = String(row[2] || "").trim();
          const section = String(row[3] || "").trim();
          const examSubjsStr = String(row[4] || "").trim();
          const ttSubjsStr = String(row[5] || "").trim();
          if (!id && !name && !grade) return;
          const cid = id || (grade ? `${grade}-${section || name}` : name) || genId();
          // Make class name consistent with manual Add Class (e.g. 10TH-BS)
          let autoName=name;
          if(!autoName){
            if(grade){
              if(section) autoName=`${formatGradeLabel(grade)}-${section.trim().toUpperCase()}`;
              else autoName=formatGradeLabel(grade);
            }else{
              autoName=cid;
            }
          }
          const norm = { name: autoName, grade: grade || "", section: section || "" };
          const prev = byId[cid];
          if (prev && (prev.name !== norm.name || prev.grade !== norm.grade || prev.section !== norm.section)) {
            conflicts.push(cid);
            return;
          }
          // First occurrence defines the class; later identical ones just merge subjects
          if (!prev) {
            byId[cid] = norm;
          }
          const examSubjs = examSubjsStr ? examSubjsStr.split(",").map(s => s.trim()).filter(Boolean) : [];
          const ttSubjs = ttSubjsStr
            ? ttSubjsStr.split(",").map(s => s.trim()).filter(Boolean)
            : examSubjs;
          if (!classSubjectsExam[cid]) classSubjectsExam[cid] = [];
          if (!classSubjectsTimetable[cid]) classSubjectsTimetable[cid] = [];
          examSubjs.forEach(s => {
            if (!classSubjectsExam[cid].includes(s)) classSubjectsExam[cid].push(s);
          });
          ttSubjs.forEach(s => {
            if (!classSubjectsTimetable[cid].includes(s)) classSubjectsTimetable[cid].push(s);
          });
        });
        const classes = Object.entries(byId).map(([id, norm]) => ({ id, ...norm }));
        if (classes.length) {
          importedClasses = classes;
          setSettings(s => ({
            ...s,
            classes: [
              // keep existing classes whose IDs are not in imported set
              ...s.classes.filter(c => !classes.find(n => n.id === c.id)),
              // add imported classes (one per ID)
              ...classes,
            ],
            // merge/replace subjects per class ID
            classSubjects: { ...s.classSubjects, ...classSubjectsExam },
            classSubjectsExam: { ...(s.classSubjectsExam||{}), ...classSubjectsExam },
            classSubjectsTimetable: { ...(s.classSubjectsTimetable||{}), ...classSubjectsTimetable },
          }));
          msg.push(classes.length + " class(es)");
        }
        if (conflicts.length) {
          msg.push("Class conflicts for IDs: " + Array.from(new Set(conflicts)).join(", "));
        }
      }
      if (sheets.Staff && sheets.Staff.length >= 2) {
        const [header, ...dataRows] = sheets.Staff;
        const colToId = {};
        (header || []).forEach((h, idx) => {
          const key = String(h || "").trim().toLowerCase();
          const id = STAFF_PROFILE_HEADER_TO_ID[key];
          if (id) colToId[idx] = id;
        });
        const profiles = dataRows.map((row) => {
          const profile = { id: genId(), staffCategory: "Teaching" };
          let hasAny = false;
          Object.entries(colToId).forEach(([col, id]) => {
            const v = row[Number(col)];
            const s = v == null ? "" : String(v).trim();
            if (s) hasAny = true;
            profile[id] = s;
          });
          if (!hasAny) return null;
          profile.staffCategory = normalizeStaffCategory(profile.staffCategory);
          return profile;
        }).filter(Boolean);
        if (profiles.length) {
          if (!setSchools || !activeSchoolId) {
            msg.push(profiles.length + " staff row(s) (could not attach to school)");
          } else {
            setSchools(prev =>
              prev.map(s => {
                if(s.id !== activeSchoolId) return s;
                const existing = s.staffProfiles || [];
                const merged = [...existing];
                const nn = v => String(v||"").trim().toLowerCase();
                profiles.forEach(p => {
                  const match = merged.find(e => e.name && p.name && nn(e.name) === nn(p.name));
                  if(match){const i=merged.findIndex(e=>e.id===match.id);if(i>=0)merged[i]={...match,...p,id:match.id,photo:match.photo||p.photo};}
                  else merged.push(p);
                });
                return { ...s, staffProfiles: merged };
              })
            );
            msg.push(profiles.length + " staff profile(s)");
          }
        }
      }
      if (sheets.ClassSheets && sheets.ClassSheets.length) {
        const importedStudents=[];
        const allClasses = importedClasses.length ? importedClasses : (settings.classes || []);
        const findClassForSheet=(sheetName)=>{
          const target=String(sheetName||"").trim().toLowerCase();
          const byDisplay=allClasses.find(c=>{
            const san=sanitizeSheetName(formatClassDisplay(c)||c.id||"");
            return san.toLowerCase()===target;
          });
          if(byDisplay) return byDisplay;
          return resolveClass(allClasses,sheetName)||null;
        };
        const findIndex=(headers,patterns)=>{
          const norm=headers.map(h=>String(h||"").trim().toLowerCase());
          for(let i=0;i<norm.length;i++){
            const h=norm[i];
            if(patterns.some(p=>h.includes(p))) return i;
          }
          return -1;
        };
        sheets.ClassSheets.forEach(sh=>{
          const rows=sh.rows;
          if(!rows||rows.length<2) return;
          const [header,...dataRows]=rows;
          const idxAdm=findIndex(header,["admission","adm"]);
          const idxRoll=findIndex(header,["roll"]);
          const idxName=findIndex(header,["student name","name"]);
          const idxFather=findIndex(header,["father's name","father name","fname"]);
          const idxDob=findIndex(header,["dob","date of birth"]);
          const idxBay=findIndex(header,["bay","form-b","form b"]);
          const idxCnic=findIndex(header,["cnic"]);
          const idxWhatsapp=findIndex(header,["whatsapp","mobile","phone"]);
          if(idxName===-1 && idxAdm===-1 && idxRoll===-1) return;
          const cls=findClassForSheet(sh.name);
          const classId=cls?cls.id:sh.name;
          dataRows.forEach(row=>{
            const get=(idx)=>idx>=0?String(row[idx]||"").trim():"";
            const admissionNo=get(idxAdm);
            const rollNo=get(idxRoll);
            const name=get(idxName);
            if(!admissionNo&&!rollNo&&!name) return;
            const fatherName=get(idxFather);
            const rawDob=idxDob>=0?row[idxDob]:"";
            const dob=rawDob?excelDateToDDMMYYYY(rawDob):"";
            const bayForm=get(idxBay);
            const fatherCnic=get(idxCnic);
            let whatsapp=get(idxWhatsapp);
            const wDigits=whatsapp.replace(/\D/g,"");
            if(wDigits.length===10) whatsapp="0"+wDigits;
            else if(wDigits.length===11) whatsapp=wDigits;
            importedStudents.push({
              id:genId(),
              admissionNo,
              rollNo,
              name,
              fatherName,
              classId,
              dob,
              bayForm,
              fatherCnic,
              whatsapp,
              photo:null,
            });
          });
        });
        if(importedStudents.length){
          let stripDupAdm=0;
          setStudents(prev=>{
            const merged=[...prev];
            const allCls=importedClasses.length?importedClasses:(settings.classes||[]);
            const {list:strippedList,strippedCount}=stripDuplicateAdmissionsForImport(importedStudents,merged,allCls);
            stripDupAdm=strippedCount;
            strippedList.forEach(imp=>{
              const nn=v=>String(v||"").trim().toLowerCase();
              const match=merged.find(s=>
                (imp.admissionNo&&s.admissionNo&&nn(s.admissionNo)===nn(imp.admissionNo))||
                (imp.rollNo&&s.rollNo&&s.rollNo===imp.rollNo&&s.classId===imp.classId)||
                (imp.name&&s.name&&nn(s.name)===nn(imp.name)&&s.classId===imp.classId&&nn(s.fatherName)===nn(imp.fatherName))
              );
              if(match){const i=merged.findIndex(s=>s.id===match.id);if(i>=0)merged[i]={...match,...imp,id:match.id,photo:match.photo||imp.photo};}
              else merged.push(imp);
            });
            return merged;
          });
          msg.push(importedStudents.length+" student(s) from class sheets"+(stripDupAdm?` (${stripDupAdm} duplicate Adm# cleared)`:""));
        }
      } else if (sheets.Students && sheets.Students.length >= 2) {
        const [, ...dataRows] = sheets.Students;
        const imported = dataRows.map((row) => {
          const admissionNo = String(row[0] || "").trim();
          const rollNo = String(row[1] || "").trim();
          const name = String(row[2] || "").trim();
          const fatherName = String(row[3] || "").trim();
          const grade = String(row[4] || "").trim();
          const section = String(row[5] || "").trim();
          const dob = excelDateToDDMMYYYY(row[6]);
          const bayForm = String(row[7] || "").trim();
          const fatherCnic = String(row[8] || "").trim();
          let whatsapp = String(row[9] || "").trim();
          // Normalize WhatsApp to preserve leading zero when Excel drops it
          const wDigits = whatsapp.replace(/\D/g,"");
          if (wDigits.length === 10) {
            whatsapp = "0" + wDigits;
          } else if (wDigits.length === 11) {
            whatsapp = wDigits;
          }
          if (!admissionNo && !rollNo && !name) return null;
          let classId = "";
          if (grade) {
            const gNorm = grade.toLowerCase();
            const sNorm = section.toLowerCase();
            let cls = importedClasses.find(c =>
              String(c.grade || "").trim().toLowerCase() === gNorm &&
              String(c.section || "").trim().toLowerCase() === sNorm
            );
            if (!cls) {
              cls = settings.classes.find(c =>
                String(c.grade || "").trim().toLowerCase() === gNorm &&
                String(c.section || "").trim().toLowerCase() === sNorm
              );
            }
            if (cls) {
              classId = cls.id;
            } else {
              classId = `${grade}-${section || ""}`;
            }
          }
          return {
            id: genId(),
            admissionNo,
            rollNo,
            name,
            fatherName,
            classId,
            dob,
            bayForm,
            fatherCnic,
            whatsapp,
            photo: null,
          };
        }).filter(Boolean);
        if (imported.length) {
          const allClsFlat=importedClasses.length?importedClasses:(settings.classes||[]);
          let stripDupAdmFlat=0;
          setStudents(prev=>{
            const merged=[...prev];
            const {list:strippedList,strippedCount}=stripDuplicateAdmissionsForImport(imported,merged,allClsFlat);
            stripDupAdmFlat=strippedCount;
            strippedList.forEach(imp=>{
              const nn=v=>String(v||"").trim().toLowerCase();
              const match=merged.find(s=>
                (imp.admissionNo&&s.admissionNo&&nn(s.admissionNo)===nn(imp.admissionNo))||
                (imp.rollNo&&s.rollNo&&s.rollNo===imp.rollNo&&s.classId===imp.classId)||
                (imp.name&&s.name&&nn(s.name)===nn(imp.name)&&s.classId===imp.classId&&nn(s.fatherName)===nn(imp.fatherName))
              );
              if(match){const i=merged.findIndex(s=>s.id===match.id);if(i>=0)merged[i]={...match,...imp,id:match.id,photo:match.photo||imp.photo};}
              else merged.push(imp);
            });
            return merged;
          });
          msg.push(imported.length + " student(s)"+(stripDupAdmFlat?` (${stripDupAdmFlat} duplicate Adm# cleared)`:""));
        }
      }
      e.target.value = ""; alert(msg.length ? "Imported: " + msg.join(", ") : "No data found in General, Classes, Staff, or Students sheets.");
    });
  };

  const _importStaffProfilesFromExcel=(e)=>{
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) { alert("No sheet in file."); e.target.value = ""; return; }
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (!rows || rows.length < 2) { alert("File must have a header row and at least one data row."); e.target.value = ""; return; }
        const headers = (rows[0] || []).map((h) => String(h ?? "").trim());
        const colToId = {};
        headers.forEach((h, idx) => {
          const norm = h.toLowerCase();
          const field = STAFF_PROFILE_FIELDS.find((f) => f.id.toLowerCase() === norm || f.label.toLowerCase() === norm || f.label.toLowerCase().replace(/\s*\([^)]*\)\s*/g, " ").trim() === norm);
          if (field) colToId[idx] = field.id;
        });
        const profiles = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] || [];
          const profile = { id: genId(), staffCategory: "Teaching" };
          let hasAny = false;
          Object.entries(colToId).forEach(([col, id]) => {
            const val = row[Number(col)];
            const s = val == null ? "" : (typeof val === "number" && STAFF_PROFILE_FIELDS.find((f) => f.id === id)?.type === "date" ? excelDateToDDMMYYYY(val) : String(val).trim());
            if (s) hasAny = true;
            profile[id] = s;
          });
          if (hasAny || (row[0] != null && String(row[0]).trim() !== "")) {
            profile.staffCategory = normalizeStaffCategory(profile.staffCategory);
            profiles.push(profile);
          }
        }
        if (profiles.length === 0) { alert("No valid staff profile rows found. Use headers matching: CPN, Name Of Officer/Official, etc."); e.target.value = ""; return; }
        if (!setSchools || !activeSchoolId) { alert("Cannot update school data."); e.target.value = ""; return; }
        setSchools((prev) => prev.map((s) => {
          if(s.id!==activeSchoolId) return s;
          const existing=s.staffProfiles||[];
          const merged=[...existing];
          const nn=v=>String(v||"").trim().toLowerCase();
          profiles.forEach(p=>{
            const match=merged.find(e=>e.name&&p.name&&nn(e.name)===nn(p.name));
            if(match){const i=merged.findIndex(e=>e.id===match.id);if(i>=0)merged[i]={...match,...p,id:match.id,photo:match.photo||p.photo};}
            else merged.push(p);
          });
          return {...s,staffProfiles:merged};
        }));
        alert("Imported " + profiles.length + " staff profile(s).");
      } catch (err) {
        alert("Failed to read file: " + (err.message || String(err)));
      }
      e.target.value = "";
    };
    reader.readAsArrayBuffer(f);
  };

  const exportData = async () => {
    await yieldToMain();
    const wb = XLSX.utils.book_new();
    const wsClasses = XLSX.utils.aoa_to_sheet([
      ["Class ID","Class Name","Grade","Section","Subjects for Examination","Subjects for Timetable"],
      ...(settings.classes||[]).map(c => [
        c.id,
        formatClassDisplay(c),
        c.grade,
        c.section,
        getClassSubjects(settings,c.id,"exam").join(", "),
        getClassSubjects(settings,c.id,"timetable").join(", ")
      ]),
    ]);
    const staffExportHeaders = STAFF_PROFILE_SHEET_HEADERS.filter(h=>h.id!=="photo").map(h=>h.label);
    const staffRows = (Array.isArray(staffProfiles)?staffProfiles:[]).map(p =>
      STAFF_PROFILE_SHEET_HEADERS.filter(h=>h.id!=="photo").map(h => {
        const v = p[h.id];
        if (v == null || v === "") return "";
        const s = String(v).trim();
        if (["dob","doe","dprs","dppp","daps"].includes(h.id)) return staffDateToDDMMYYYY(s) || s;
        if (h.id === "cnic") return staffFormatCNIC(s) || s;
        if (h.id === "contact") return staffFormatPhone(s) || s;
        return s;
      })
    );
    const wsStaff = XLSX.utils.aoa_to_sheet([staffExportHeaders, ...staffRows]);
    XLSX.utils.book_append_sheet(wb, wsClasses, "Classes & Subjects");
    XLSX.utils.book_append_sheet(wb, wsStaff, "Staff Profiles");

    // One sheet per class with students + subject columns (importable via Classes List)
    for (const cls of settings.classes || []) {
      await yieldToMain();
      const sheetName = sanitizeSheetName(formatClassDisplay(cls) || cls.id || "Class");
      const subjects = getClassSubjects(settings,cls.id,"exam");
      const header = ["Adm#","Roll#","Student Name","Father's Name","DOB","Form B","Father CNIC","WhatsApp", ...subjects];
      const rows = students
        .filter(s => resolveClass(settings.classes, s.classId)?.id === cls.id)
        .map(s => [
          s.admissionNo || "",
          s.rollNo || "",
          s.name || "",
          s.fatherName || "",
          s.dob || "",
          s.bayForm || "",
          s.fatherCnic || "",
          s.whatsapp || "",
          ...subjects.map(() => ""),
        ]);
      const wsClass = XLSX.utils.aoa_to_sheet([header, ...rows]);
      XLSX.utils.book_append_sheet(wb, wsClass, sheetName);
    }

    await downloadExcel(wb, "settings_export.xlsx");
  };

  const STUDENT_TEMPLATE_HEADER=["Adm#","Roll#","Student Name","Father's Name","DOB","Form B","Father CNIC","WhatsApp"];
  const _exportClassesList = async () => {
    await yieldToMain();
    const wb=XLSX.utils.book_new();
    const classes=Array.isArray(settings.classes)?settings.classes:[];
    if(!classes.length){alert("No classes defined. Add classes first.");return;}
    for (const cls of classes) {
      await yieldToMain();
      const sheetName=sanitizeSheetName(formatClassDisplay(cls)||cls.id||"Class");
      const rows=students
        .filter(s=>resolveClass(classes,s.classId)?.id===cls.id)
        .map(s=>[
          s.admissionNo||"",
          s.rollNo||"",
          s.name||"",
          s.fatherName||"",
          s.dob||"",
          s.bayForm||"",
          s.fatherCnic||"",
          s.whatsapp||"",
        ]);
      const ws=XLSX.utils.aoa_to_sheet([STUDENT_TEMPLATE_HEADER,...rows]);
      XLSX.utils.book_append_sheet(wb,ws,sheetName);
    }
    await downloadExcel(wb,"Students_Template.xlsx");
  };

  const importStudentsFromExcel=(e)=>{
    const f=e?.target?.files?.[0];
    if(!f) return;
    parseWorkbook(f,(err,sheets)=>{
      const reset=()=>{};
      try{
        if(err){alert("Failed to read file:\n"+err.message);reset();return;}
        const allSheetNames=(sheets.SheetNames||[]).join(", ")||"(none)";
        const rawClassSheets=Array.isArray(sheets.ClassSheets)?sheets.ClassSheets:[];
        const flatStudentsSheet=Array.isArray(sheets.Students)&&sheets.Students.length>=2
          ? [{name:"Students",rows:sheets.Students}]
          : [];
        const classSheets=[...rawClassSheets,...flatStudentsSheet];
        if(!classSheets.length){
          alert("No student sheets found in this file.\n\nSheets found: "+allSheetNames+"\n\nTip: Use the 'Classes List' button to download the student import template, fill it in, then click 'Import Students'.");
          reset();return;
        }
        const allClasses=settings.classes||[];
        const pickClassByGradeSection=(value)=>{
          const txt=String(value||"").trim();
          if(!txt) return null;
          const m=txt.match(/(?:class|grade)?\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-_ ]\s*([a-z]))?/i);
          if(!m) return null;
          const gradeNum=String(parseInt(m[1],10));
          const sec=(m[2]||"").toUpperCase();
          const byGrade=allClasses.filter(c=>{
            const g=String(c.grade||"").trim();
            const gm=g.match(/\d{1,2}/);
            return gm&&String(parseInt(gm[0],10))===gradeNum;
          });
          if(!byGrade.length) return null;
          if(sec){
            const bySec=byGrade.find(c=>String(c.section||"").trim().toUpperCase()===sec);
            if(bySec) return bySec;
          }
          // Important fallback: don't drop rows for ambiguous grade labels.
          return byGrade[0];
        };
        const findClassForSheet=(sheetName)=>{
          const target=String(sheetName||"").trim().toLowerCase();
          const byDisplay=allClasses.find(c=>{
            const san=sanitizeSheetName(formatClassDisplay(c)||c.id||"");
            return san.toLowerCase()===target;
          });
          if(byDisplay) return byDisplay;
          const byGeneric=resolveClass(allClasses,sheetName);
          if(byGeneric) return byGeneric;
          return pickClassByGradeSection(sheetName);
        };
        const normalizeHeaderCell=(val)=>String(val||"")
          .trim()
          .toLowerCase()
          .replace(/[’']/g,"")
          .replace(/[^a-z0-9]+/g," ")
          .replace(/\s+/g," ")
          .trim();
        const findIdx=(headers,patterns)=>{
          const norm=headers.map(normalizeHeaderCell);
          const pats=patterns.map(normalizeHeaderCell);
          for(let i=0;i<norm.length;i++){if(pats.some(p=>p&&norm[i].includes(p)))return i;}
          return -1;
        };
        const findHeaderRow=(rows)=>{
          const scanLimit=Math.min(rows.length,10);
          let best={idx:0,score:-1};
          for(let i=0;i<scanLimit;i++){
            const hdr=Array.isArray(rows[i])?rows[i]:[];
            const score=[
              findIdx(hdr,["adm#","admission no","adm no","admission","adm"])>=0?1:0,
              findIdx(hdr,["roll#","roll no","roll"])>=0?1:0,
              findIdx(hdr,["student name","name"])>=0?1:0,
              findIdx(hdr,["father's name","father name","fname","father"])>=0?1:0,
            ].reduce((a,b)=>a+b,0);
            if(score>best.score) best={idx:i,score};
          }
          return best.score>0?best.idx:0;
        };
        const importedStudents=[];
        let skippedRows=0;
        let unresolvedClassRows=0;
        classSheets.forEach(sh=>{
          const rows=sh.rows;
          if(!rows||rows.length<2)return;
          const headerRowIdx=findHeaderRow(rows);
          const header=rows[headerRowIdx]||[];
          const dataRows=rows.slice(headerRowIdx+1);
          const idxAdm=findIdx(header,["adm#","admission no","adm no","admission","adm"]);
          const idxRoll=findIdx(header,["roll#","roll no","roll"]);
          const idxName=findIdx(header,["student name","name"]);
          const idxFather=findIdx(header,["father's name","father name","fname","father"]);
          const idxDob=findIdx(header,["dob","date of birth","birthdate"]);
          const idxBay=findIdx(header,["form b","form-b","bay form","bay","b-form","form"]);
          const idxCnic=findIdx(header,["father cnic","father's cnic","father ci","cnic"]);
          const idxWa=findIdx(header,["whatsapp","mobile","phone","contact"]);
          const idxClass=findIdx(header,["class id","class","grade","section"]);
          if(idxName===-1&&idxAdm===-1&&idxRoll===-1)return;
          const clsFromSheet=findClassForSheet(sh.name);
          dataRows.forEach(row=>{
            const get=(idx)=>idx>=0?String(row[idx]??'').trim():"";
            const admissionNo=get(idxAdm);
            const rollNo=get(idxRoll);
            const name=get(idxName);
            if(!admissionNo&&!rollNo&&!name){ skippedRows++; return; }
            const rawClass=idxClass>=0?get(idxClass):"";
            const clsFromRow=rawClass?(resolveClass(allClasses,rawClass)||pickClassByGradeSection(rawClass)):null;
            const fallbackSingleClass=allClasses.length===1?allClasses[0]:null;
            const classId=(clsFromSheet?.id)||(clsFromRow?.id)||(fallbackSingleClass?.id)||"";
            if(!classId){ unresolvedClassRows++; return; }
            const rawDob=idxDob>=0?row[idxDob]:"";
            let whatsapp=get(idxWa);
            const wd=whatsapp.replace(/\D/g,"");
            if(wd.length===10)whatsapp="0"+wd;
            else if(wd.length===11)whatsapp=wd;
            importedStudents.push({id:genId(),admissionNo,rollNo,name,fatherName:get(idxFather),classId,dob:rawDob?excelDateToDDMMYYYY(rawDob):"",bayForm:get(idxBay),fatherCnic:get(idxCnic),whatsapp,photo:null});
          });
        });
        if(!importedStudents.length){
          alert("No student data rows found.\n\nSheets processed: "+classSheets.map(s=>s.name).join(", ")+"\n\nMake sure you have filled in student rows below the header row in the template.");
          reset();return;
        }
        let stripDupAdm=0;
        startTransition(()=>setStudents(prev=>{
          const merged=[...prev];
          const {list:importList,strippedCount}=stripDuplicateAdmissionsForImport(importedStudents,merged,allClasses);
          stripDupAdm=strippedCount;
          const nn=v=>String(v||"").trim().toLowerCase();
          const sameClass=(a,b)=>{
            if(!a&&!b)return true;
            if(a===b)return true;
            const ca=resolveClass(allClasses,a);
            const cb=resolveClass(allClasses,b);
            return ca&&cb&&ca.id===cb.id;
          };
          const byAdmission=new Map();
          const byRollClass=new Map();
          const byNameFatherClass=new Map();
          const mkRollKey=(roll,classId)=>`${nn(roll)}|${resolveClass(allClasses,classId)?.id||nn(classId)}`;
          const mkNameKey=(name,father,classId)=>`${nn(name)}|${nn(father)}|${resolveClass(allClasses,classId)?.id||nn(classId)}`;
          merged.forEach((s,idx)=>{
            if(s.admissionNo) byAdmission.set(nn(s.admissionNo),idx);
            if(s.rollNo) byRollClass.set(mkRollKey(s.rollNo,s.classId),idx);
            if(s.name) byNameFatherClass.set(mkNameKey(s.name,s.fatherName,s.classId),idx);
          });
          importList.forEach(imp=>{
            let idx=-1;
            if(imp.admissionNo&&byAdmission.has(nn(imp.admissionNo))) idx=byAdmission.get(nn(imp.admissionNo));
            if(idx<0&&imp.rollNo&&byRollClass.has(mkRollKey(imp.rollNo,imp.classId))) idx=byRollClass.get(mkRollKey(imp.rollNo,imp.classId));
            if(idx<0&&imp.name&&byNameFatherClass.has(mkNameKey(imp.name,imp.fatherName,imp.classId))) idx=byNameFatherClass.get(mkNameKey(imp.name,imp.fatherName,imp.classId));
            if(idx>=0){
              const current=merged[idx];
              if(current&&sameClass(current.classId,imp.classId)) merged[idx]={...current,...imp,id:current.id,photo:current.photo||imp.photo};
            } else {
              merged.push(imp);
              const ni=merged.length-1;
              if(imp.admissionNo) byAdmission.set(nn(imp.admissionNo),ni);
              if(imp.rollNo) byRollClass.set(mkRollKey(imp.rollNo,imp.classId),ni);
              if(imp.name) byNameFatherClass.set(mkNameKey(imp.name,imp.fatherName,imp.classId),ni);
            }
          });
          return merged;
        }));
        const unmatched=importedStudents.filter(s=>!resolveClass(allClasses,s.classId)).length;
        const msg="✓ Imported "+importedStudents.length+" student(s) from "+classSheets.length+" sheet(s)."
          +"\nGo to Examination → Student Record to view them."
          +(skippedRows?"\n\nℹ Skipped "+skippedRows+" blank row(s).":"")
          +(unresolvedClassRows?"\n\n⚠ Skipped "+unresolvedClassRows+" row(s) because class could not be identified. Use class-wise sheet names from template, or add a 'Class' column.":"")
          +(unmatched?"\n\n⚠ "+unmatched+" student(s) have unrecognised class names. Check that sheet names in your file match class names defined in Settings.":"")
          +(stripDupAdm?"\n\nDuplicate Adm# cleared on "+stripDupAdm+" row(s); assign Adm# in Student Record if needed.":"");
        alert(msg);
        reset();
      }catch(ex){
        alert("Import error: "+ex.message);
        reset();
      }
    });
  };

  const _downloadClassesAndStaffTemplate = async () => {
    await yieldToMain();
    const wb=XLSX.utils.book_new();
    const wsClasses=XLSX.utils.aoa_to_sheet([["Class ID","Class Name","Grade","Section","Subjects for Examination","Subjects for Timetable"],["10-BS","10TH-BS","10","BS","English, Physics, Urdu","English, Physics, Urdu"],["9-CS","9TH-CS","9","CS","English, Computer, Urdu","English, Computer, Urdu"]]);
    const wsStaff=XLSX.utils.aoa_to_sheet([["Name","Designation"],["Kazmi","SST"],["Imtiaz","SST"]]);
    XLSX.utils.book_append_sheet(wb,wsClasses,"Classes");
    XLSX.utils.book_append_sheet(wb,wsStaff,"Staff");
    await downloadExcel(wb,"classes_and_staff_template.xlsx");
  };
  const _exportClassesAndStaffExcel = async () => {
    await yieldToMain();
    const wb=XLSX.utils.book_new();
    const wsClasses=XLSX.utils.aoa_to_sheet([["Class ID","Class Name","Grade","Section","Subjects for Examination","Subjects for Timetable"],...settings.classes.map(c=>[c.id,formatClassDisplay(c),c.grade,c.section,getClassSubjects(settings,c.id,"exam").join(", "),getClassSubjects(settings,c.id,"timetable").join(", ")])]);
    const wsStaff=XLSX.utils.aoa_to_sheet([["Name","Designation"],...settings.staff.map(st=>[st.name,st.designation||""])]);
    XLSX.utils.book_append_sheet(wb,wsClasses,"Classes");
    XLSX.utils.book_append_sheet(wb,wsStaff,"Staff");
    await downloadExcel(wb,"classes_and_staff_export.xlsx");
  };
  const importClassesAndStaffExcel=(e)=>{
    const f=e?.target?.files?.[0]; if(!f){ e.target.value=""; return; }
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const wb=XLSX.read(reader.result,{type:"array"});
        const msg=[];
        const getSheet=(name)=>wb.Sheets[name]?XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:""}):null;
        const sheetsClasses=getSheet("Classes");
        const sheetsStaff=getSheet("Staff");
        let nextClasses=settings.classes;
        let nextClassSubjectsExam={...(settings.classSubjectsExam||settings.classSubjects||{})};
        let nextClassSubjectsTimetable={...(settings.classSubjectsTimetable||settings.classSubjects||{})};
        let newStaffProfiles=[];
        if(sheetsClasses&&sheetsClasses.length>=2){
          const [,...dataRows]=sheetsClasses;
          const classSubjectsExam={};
          const classSubjectsTimetable={};
          const byId={};
          const conflicts=[];
          dataRows.forEach(row=>{
            const id=String(row[0]||"").trim();
            const name=String(row[1]||"").trim();
            const grade=String(row[2]||"").trim();
            const section=String(row[3]||"").trim();
            const examSubjsStr=String(row[4]||"").trim();
            const ttSubjsStr=String(row[5]||"").trim();
            if(!id&&!name&&!grade) return;
            const cid=id||(grade?`${grade}-${section||name}`:name)||genId();
            let autoName=name;
            if(!autoName){
              if(grade){ if(section) autoName=`${formatGradeLabel(grade)}-${section.trim().toUpperCase()}`; else autoName=formatGradeLabel(grade); }
              else autoName=cid;
            }
            const norm={name:autoName,grade:grade||"",section:section||""};
            const prev=byId[cid];
            if(prev&&(prev.name!==norm.name||prev.grade!==norm.grade||prev.section!==norm.section)){ conflicts.push(cid); return; }
            if(!prev) byId[cid]=norm;
            const examSubjs=examSubjsStr?examSubjsStr.split(",").map(s=>s.trim()).filter(Boolean):[];
            const ttSubjs=ttSubjsStr?ttSubjsStr.split(",").map(s=>s.trim()).filter(Boolean):examSubjs;
            if(!classSubjectsExam[cid]) classSubjectsExam[cid]=[];
            if(!classSubjectsTimetable[cid]) classSubjectsTimetable[cid]=[];
            examSubjs.forEach(s=>{ if(!classSubjectsExam[cid].includes(s)) classSubjectsExam[cid].push(s); });
            ttSubjs.forEach(s=>{ if(!classSubjectsTimetable[cid].includes(s)) classSubjectsTimetable[cid].push(s); });
          });
          const classes=Object.entries(byId).map(([id,norm])=>({id,...norm}));
          if(classes.length){
            nextClasses=[...settings.classes.filter(c=>!classes.find(n=>n.id===c.id)),...classes];
            nextClassSubjectsExam={...(settings.classSubjectsExam||settings.classSubjects||{}),...classSubjectsExam};
            nextClassSubjectsTimetable={...(settings.classSubjectsTimetable||settings.classSubjects||{}),...classSubjectsTimetable};
            msg.push(classes.length+" class(es)");
          }
          if(conflicts.length) msg.push("Skipped duplicate class IDs: "+[...new Set(conflicts)].join(", "));
        }
        if(sheetsStaff&&sheetsStaff.length>=2){
          const [,...dataRows]=sheetsStaff;
          newStaffProfiles=dataRows.map((row,i)=>{ const name=String(row[0]||"").trim(); const designation=String(row[1]||"").trim(); if(!name) return null; return {id:genId(),staffCategory:normalizeStaffCategory(designation),name:name||"Staff "+(i+1),designation:designation||"",photo:null}; }).filter(Boolean);
          if(newStaffProfiles.length) msg.push(newStaffProfiles.length+" staff profile(s)");
        }
        if(msg.length){
          setSettings(s=>({...s,classes:nextClasses,classSubjects:nextClassSubjectsExam,classSubjectsExam:nextClassSubjectsExam,classSubjectsTimetable:nextClassSubjectsTimetable}));
          if(newStaffProfiles.length) setSchools(prev=>prev.map(s=>s.id===activeSchoolId?{...s,staffProfiles:[...(s.staffProfiles||[]),...newStaffProfiles]}:s));
        }
        if(!msg.length) alert("No 'Classes' or 'Staff' sheets with data found.");
        else alert("Imported: "+msg.join(". "));
      }catch(err){ alert("Failed to import: "+err.message); }
      e.target.value="";
    };
    reader.readAsArrayBuffer(f);
  };

  const AWARD_LIST_EXAMS=["1st Term","Mid Term","Final Term","Annual"];
  const [awardListExam,setAwardListExam]=useState(AWARD_LIST_EXAMS[0]);
  const [awardListTeacher,setAwardListTeacher]=useState("");
  const teachersWithAssignments=useMemo(()=>getTeachersWithAssignments(settings,timetable),[settings,timetable]);
  const selectedTeacherData=teachersWithAssignments.find(t=>t.teacherName===awardListTeacher);

  function sanitizeSheetName(s){ return String(s).replace(/[\]:*?/\\]/g,"_").slice(0,31); }

  // Award list: treat English-A, English-B (and Urdu-A, Urdu-B etc.) as single subject "English", "Urdu" for export/import
  function awardListBaseSubject(subject){
    let s=String(subject||"").trim();
    if(!s) return s;
    // Examples to normalize:
    //  - "English-A" / "English - A" / "English – A"
    //  - "English (A)"
    //  - "English Part A"
    //  - "English A" (ONLY if it is a trailing single-letter A/B token after whitespace)
    let m=s.match(/^(.*?)(?:\s*\(\s*([ABab])\s*\))\s*$/);
    if(m) return m[1].trim();
    m=s.match(/^(.*?)(?:\s*\[\s*([ABab])\s*\])\s*$/);
    if(m) return m[1].trim();
    m=s.match(/^(.*?)(?:\s+Part\s*([ABab]))\s*$/i);
    if(m) return m[1].trim();
    m=s.match(/^(.*?)[\s\-–—]+\s*([ABab])\s*$/);
    if(m){
      // Require a delimiter before the suffix so we don't accidentally cut valid trailing letters.
      const prefix=m[1]||"";
      const suffix=String(m[2]||"").toUpperCase();
      if(suffix==="A"||suffix==="B") return prefix.trim();
    }
    return s;
  }
  function awardListSubjectMatchesBase(subject,base){
    return awardListBaseSubject(subject)===awardListBaseSubject(base);
  }
  function isAwardListSubjectCommonForGrade(grade,baseSubject){
    const gradeCommon=settings.commonTeachers?.[grade]||{};
    return Object.entries(gradeCommon).some(([subject,isCommon])=>{
      if(!isCommon) return false;
      return awardListSubjectMatchesBase(subject,baseSubject);
    });
  }
  function sortStudentsForAwardList(list){
    return (list||[]).slice().sort((a,b)=>{
      const rn=String(a.rollNo||"").localeCompare(String(b.rollNo||""),undefined,{numeric:true,sensitivity:"base"});
      if(rn!==0) return rn;
      return String(a.name||"").localeCompare(String(b.name||""),undefined,{sensitivity:"base"});
    });
  }

  const buildAwardListWorkbookForTeacher=(teacherData)=>{
    if(!teacherData?.classes?.length) return null;
    const wb=XLSX.utils.book_new();
    const exam=awardListExam;
      // Group by (grade, baseSubject) only when subject is common across sections.
    const groupKey=(grade,baseSubj,isCommon,classId)=>isCommon
      ?`common|${String(grade).trim()}|${String(baseSubj||"").trim()}`
      :`class|${String(classId||"").trim()}|${String(baseSubj||"").trim()}`;
    const groups=new Map();
    for(const {classId,className,grade,subject} of selectedTeacherData.classes){
      const baseSubj=awardListBaseSubject(subject||"Subject");
      const isCommon=isAwardListSubjectCommonForGrade(grade,baseSubj);
      const key=groupKey(grade,baseSubj,isCommon,classId);
      if(!groups.has(key)) groups.set(key,{grade:grade||"",baseSubject:baseSubj,classIds:[],className,isCommon});
      const g=groups.get(key);
      if(!g.classIds.includes(classId)) g.classIds.push(classId);
    }
    for(const [,g] of groups){
      const {grade,baseSubject,classIds,className,isCommon}=g;
      const allStudents=sortStudentsForAwardList(students.filter(s=>classIds.includes(s.classId)));
      const firstClassId=classIds[0];
      const classSubjs=getClassSubjects(settings,firstClassId,"exam");
      const matchingTotalSubjects=classSubjs.filter(s=>awardListSubjectMatchesBase(s,baseSubject));
      const firstActualSubject=matchingTotalSubjects[0] || baseSubject;
      // If only one part (A/B) has marks entered, export that part's total/obtained value.
      const totalActualSubject=
        matchingTotalSubjects.find(s=>{
          const v=exam_tm[`${exam}_${firstClassId}_${s}`];
          return v!=null&&v!=="";
        }) || firstActualSubject;
      const totalKey=`${exam}_${firstClassId}_${totalActualSubject}`;
      const totalVal=exam_tm[totalKey]!=null&&exam_tm[totalKey]!==""?String(exam_tm[totalKey]):"";
      const rows=[["Roll#","Student Name","Father's Name","Marks obtained","Total marks"]];
      allStudents.forEach((st,idx)=>{
        const subjOptions=getClassSubjects(settings,st.classId,"exam").filter(s=>awardListSubjectMatchesBase(s,baseSubject));
        const actualSubject=
          subjOptions.find(s=>{
            const v=exam_om[`${exam}_${st.classId}_${st.id}_${s}`];
            return v!=null&&v!=="";
          }) || subjOptions[0] || totalActualSubject || firstActualSubject;
        const obtKey=`${exam}_${st.classId}_${st.id}_${actualSubject}`;
        const obt=exam_om[obtKey]!=null&&exam_om[obtKey]!==""?String(exam_om[obtKey]):"";
        const exportRoll=isCommon?String(idx+1):(st.rollNo||"");
        rows.push([exportRoll,st.name||"",st.fatherName||"",obt,totalVal]);
      });
      const ws=XLSX.utils.aoa_to_sheet(rows);
      const singleClass=resolveClass(settings.classes,classIds[0]);
      const singleClassLabel=singleClass?formatClassDisplay(singleClass):(className||classIds[0]||"Class");
      const sheetName=isCommon
        ?(grade
            ?sanitizeSheetName("Class "+grade+"_"+baseSubject)
            :sanitizeSheetName((className||"")+"_"+baseSubject))
        :sanitizeSheetName(singleClassLabel+"_"+baseSubject);
      XLSX.utils.book_append_sheet(wb,ws,sheetName);
    }
    return wb;
  };

  const exportAwardListTeacher = async () => {
    if(!selectedTeacherData?.classes?.length){ alert("Select a teacher who has class assignments in the timetable."); return; }
    if(!setExamMarks||!exam_tm||!exam_om) return;
    await yieldToMain();
    const wb=buildAwardListWorkbookForTeacher(selectedTeacherData);
    if(!wb){ alert("Could not build award list workbook."); return; }
    const safeName=(awardListTeacher||"Teacher").replace(/[^a-zA-Z0-9_-]/g,"_");
    await downloadExcel(wb,`AwardList_${safeName}_${awardListExam.replace(/\s/g,"_")}.xlsx`);
  };

  const exportAwardListAllTeachersZip=async ()=>{
    if(!teachersWithAssignments?.length){
      alert("No teachers with timetable assignments found.");
      return;
    }
    if(!setExamMarks||!exam_tm||!exam_om) return;
    try{
      await yieldToMain();
      const zip=new JSZip();
      let fileCount=0;
      const safeExam=String(awardListExam||"Exam").replace(/\s+/g,"_");
      for (const teacherData of teachersWithAssignments) {
        await yieldToMain();
        const wb=buildAwardListWorkbookForTeacher(teacherData);
        if(!wb) continue;
        const safeTeacher=String(teacherData.teacherName||"Teacher").replace(/[^a-zA-Z0-9_-]/g,"_");
        const wbArray=XLSX.write(wb,{bookType:"xlsx",type:"array"});
        zip.file(`AwardList_${safeTeacher}_${safeExam}.xlsx`,wbArray);
        fileCount++;
      }
      if(fileCount===0){
        alert("No award lists were generated.");
        return;
      }
      const zipBlob=await zip.generateAsync({type:"blob"});
      const url=URL.createObjectURL(zipBlob);
      const a=document.createElement("a");
      a.href=url;
      a.download=`AwardLists_AllTeachers_${safeExam}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    }catch(err){
      alert("Failed to export ZIP: "+(err?.message||err));
    }
  };

  const importAwardListTeacher=(e)=>{
    const f=e?.target?.files?.[0]; if(!f){ e.target.value=""; return; }
    if(!setExamMarks||!exam_tm||!exam_om){ alert("Exam data not available."); e.target.value=""; return; }
    const exam=awardListExam;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const wb=XLSX.read(reader.result,{type:"array"});
        const nextTM={...exam_tm};
        const nextOM={...exam_om};
        let sheetsImported=0;
        wb.SheetNames.forEach(sheetName=>{
          const sh=wb.Sheets[sheetName];
          if(!sh) return;
          const rows=XLSX.utils.sheet_to_json(sh,{header:1,defval:""});
          if(!rows.length||rows.length<2) return;
          const header=(rows[0]||[]).map(c=>String(c).trim().toLowerCase());
          const rollIdx=header.findIndex(h=>h==="roll#"||h==="roll no");
          const nameIdx=header.findIndex(h=>h==="name"||h==="student name");
          const fatherIdx=header.findIndex(h=>h==="father name"||h==="fathername");
          const obtIdx=header.findIndex(h=>h==="marks obtained"||h==="obtained");
          const totIdx=header.findIndex(h=>h==="total marks"||h==="total");
          if(obtIdx<0&&totIdx<0) return;
          const parts=String(sheetName).trim().split("_");
          let classIds=[];
          let baseSubject="";
          const matchClassGrade=sheetName.match(/^Class\s+(\d+)_(.+)$/i);
          if(matchClassGrade){
            const grade=matchClassGrade[1];
            baseSubject=(matchClassGrade[2]||"").trim();
            classIds=settings.classes
              .filter(c=>String(c.grade||"").trim()===grade&&getClassSubjects(settings,c.id,"exam").some(s=>awardListSubjectMatchesBase(s,baseSubject)))
              .map(c=>c.id);
          }
          if(!classIds.length){
            let cls=settings.classes.find(c=>c.name===sheetName||c.id===sheetName);
            let possibleSubject="";
            if(!cls&&parts.length>1){
              const possibleClassName=parts.slice(0,-1).join("_");
              possibleSubject=parts[parts.length-1]||"";
              cls=settings.classes.find(c=>c.name===possibleClassName||c.id===possibleClassName);
            }
            if(!cls) return;
            classIds=[cls.id];
            baseSubject=possibleSubject||awardListBaseSubject(Object.keys(nextTM).find(k=>k.startsWith(`${exam}_${cls.id}_`))?.split("_").slice(3).join("_")||"");
          }
          if(!baseSubject) return;
          const isCommonGroup=classIds.length>1&&isAwardListSubjectCommonForGrade(String(resolveClass(settings.classes,classIds[0])?.grade||""),baseSubject);
          const commonStudents=isCommonGroup
            ?sortStudentsForAwardList(students.filter(s=>classIds.includes(resolveClass(settings.classes,s.classId)?.id)))
            :[];
          let totalFromSheet="";
          for(let r=1;r<rows.length;r++){
            const row=rows[r]||[];
            const roll=String(row[rollIdx]??"").trim();
            const name=String(row[nameIdx]??"").trim();
            const father=String(row[fatherIdx]??"").trim();
            const obt=row[obtIdx]!=null&&row[obtIdx]!==""?String(row[obtIdx]).trim():"";
            const tot=row[totIdx]!=null&&row[totIdx]!==""?String(row[totIdx]).trim():"";
            if(tot) totalFromSheet=tot;
            for(const classId of classIds){
              const classStudents=students.filter(s=>resolveClass(settings.classes,s.classId)?.id===classId);
              let st=null;
              if(isCommonGroup&&/^\d+$/.test(roll)){
                const seqIdx=parseInt(roll,10)-1;
                st=(seqIdx>=0&&seqIdx<commonStudents.length)?commonStudents[seqIdx]:null;
                if(st&&resolveClass(settings.classes,st.classId)?.id!==classId) st=null;
              }
              if(!st){
                st=classStudents.find(s=>(roll&&s.rollNo===roll)||(name&&s.name===name&&(!father||s.fatherName===father)));
              }
              if(!st) continue;
              const actualSubjects=getClassSubjects(settings,classId,"exam").filter(s=>awardListSubjectMatchesBase(s,baseSubject));
              if(obt!=="") actualSubjects.forEach(actualSubj=>{ nextOM[`${exam}_${classId}_${st.id}_${actualSubj}`]=obt; });
              break;
            }
          }
          if(totalFromSheet!=="") classIds.forEach(classId=>{
            getClassSubjects(settings,classId,"exam").filter(s=>awardListSubjectMatchesBase(s,baseSubject)).forEach(actualSubj=>{
              nextTM[`${exam}_${classId}_${actualSubj}`]=totalFromSheet;
            });
          });
          sheetsImported++;
        });
        setExamMarks(nextTM,nextOM);
        alert(sheetsImported?"Imported award list for "+sheetsImported+" sheet(s).":"No award list sheets found in file.");
      }catch(err){ alert("Failed to import: "+err.message); }
      e.target.value="";
    };
    reader.readAsArrayBuffer(f);
  };

  const addClass=()=>{
    if(!newCls.grade) return;
    const tempCls={grade:newCls.grade,section:newCls.section};
    const name=formatClassDisplay(tempCls);
    const id=`${newCls.grade}-${newCls.section||name}`;
    if(settings.classes.find(c=>c.id===id)) return alert("Class already exists");
    setSettings(s=>({
      ...s,
      classes:[...s.classes,{id,name,grade:newCls.grade,section:newCls.section}],
      classSubjects:{...s.classSubjects,[id]:[]},
      classSubjectsExam:{...(s.classSubjectsExam||{}),[id]:[]},
      classSubjectsTimetable:{...(s.classSubjectsTimetable||{}),[id]:[]}
    }));
    setNewCls({grade:"",section:""});
  };
  const removeClass=(id)=>setSettings(s=>({
    ...s,
    classes:s.classes.filter(c=>c.id!==id),
    classSubjects:Object.fromEntries(Object.entries(s.classSubjects||{}).filter(([k])=>k!==id)),
    classSubjectsExam:Object.fromEntries(Object.entries(s.classSubjectsExam||{}).filter(([k])=>k!==id)),
    classSubjectsTimetable:Object.fromEntries(Object.entries(s.classSubjectsTimetable||{}).filter(([k])=>k!==id)),
  }));
  const addSubj=(id,subj,type="exam")=>{
    const cleaned=String(subj||"").trim();
    if(!cleaned) return;
    if(type==="timetable"){
      setSettings(s=>({...s,classSubjectsTimetable:{...(s.classSubjectsTimetable||{}),[id]:[...getClassSubjects(s,id,"timetable"),cleaned]}}));
      return;
    }
    setSettings(s=>({
      ...s,
      classSubjects:{...s.classSubjects,[id]:[...getClassSubjects(s,id,"exam"),cleaned]},
      classSubjectsExam:{...(s.classSubjectsExam||{}),[id]:[...getClassSubjects(s,id,"exam"),cleaned]}
    }));
  };
  const rmSubj=(id,subj,type="exam")=>{
    if(type==="timetable"){
      setSettings(s=>({...s,classSubjectsTimetable:{...(s.classSubjectsTimetable||{}),[id]:getClassSubjects(s,id,"timetable").filter(x=>x!==subj)}}));
      return;
    }
    setSettings(s=>({
      ...s,
      classSubjects:{...s.classSubjects,[id]:getClassSubjects(s,id,"exam").filter(x=>x!==subj)},
      classSubjectsExam:{...(s.classSubjectsExam||{}),[id]:getClassSubjects(s,id,"exam").filter(x=>x!==subj)}
    }));
  };
  useEffect(()=>{
    if(!setBarSubtitle) return;
    const t=tabs.find(x=>x.id===tab);
    setBarSubtitle(t?.label||"");
  },[tab,setBarSubtitle]);
  return <div>
    <div style={{display:"flex",gap:6,marginBottom:18,flexWrap:"wrap"}}>
      {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"7px 16px",borderRadius:5,border:"none",background:tab===t.id?C.navy:"#e5e7eb",color:tab===t.id?"#fff":"#374151",fontWeight:600,cursor:"pointer",fontSize:13}}>{t.label}</button>)}
    </div>
    <input ref={settingsExcelRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={importFromExcel}/>
    <input ref={classesAndStaffExcelRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={importClassesAndStaffExcel}/>
    <input ref={studentImportRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={importStudentsFromExcel}/>

    {tab==="general"&&<div style={{maxWidth:520}}>
      <div style={{marginBottom:18}}>
        <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:6}}>Session</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <select value={currentSession||""} onChange={e=>setCurrentSession(e.target.value)} style={{padding:"8px 12px",border:"1.5px solid #d1d5db",borderRadius:6,fontSize:13,background:"#fff",minWidth:140}}>
            {(sessions||[]).map(ses=><option key={ses} value={ses}>{ses}</option>)}
          </select>
          <span style={{fontSize:12,color:C.gray}}>or add:</span>
          <input ref={sessionInputRef} type="text" placeholder="e.g. 2025-2026" style={{padding:"6px 10px",border:"1.5px solid #d1d5db",borderRadius:5,fontSize:13,width:110}} onKeyDown={e=>{if(e.key==="Enter"){const v=e.target.value.trim();if(v&&addSession){addSession(v);e.target.value="";}}}} />
          <button type="button" onClick={()=>{const v=sessionInputRef.current?.value?.trim();if(v&&addSession){addSession(v);if(sessionInputRef.current)sessionInputRef.current.value="";}}} style={{padding:"6px 12px",borderRadius:5,border:"1px solid "+C.navy,background:C.navy,color:"#fff",fontSize:12,cursor:"pointer"}}>Add session</button>
        </div>
        <p style={{margin:"6px 0 0",fontSize:11,color:C.gray}}>Exam marks and date sheet are saved per session. Switch session to view or edit that year&apos;s data.</p>
      </div>
      <div style={{marginBottom:18,padding:14,borderRadius:10,background:"#f9fafb",border:"1px solid #e5e7eb"}}>
        <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:6}}>Data Workbook</label>
        <p style={{margin:"0 0 10px",fontSize:11,color:C.gray}}>
          <strong>Export Data</strong> backs up all data. <strong>Import Data</strong> restores classes and subjects, staff profiles, and students in each class from a previously exported file.
        </p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn small outline onClick={()=>settingsExcelRef.current?.click()}>Import Data</Btn>
          <Btn small outline onClick={() => void exportData()}>Export Data</Btn>
        </div>
        <div style={{marginTop:10,padding:"8px 12px",background:"#e8f0fe",borderRadius:7,fontSize:12,color:"#1f3b73",display:"flex",gap:16,flexWrap:"wrap"}}>
          <span>📊 <strong>Students in system:</strong> {(students||[]).length}</span>
          <span>🏫 <strong>Classes defined:</strong> {(settings.classes||[]).length}</span>
          <span>👩‍🏫 <strong>Teaching staff:</strong> {teachingStaffCount}</span>
          <span>🧑‍💼 <strong>Non-teaching staff:</strong> {nonTeachingStaffCount}</span>
        </div>
      </div>
    </div>}

    {tab==="teachers"&&isPrincipal&&<div style={{maxWidth:560}}>
      {/* Create Operator account */}
      <div style={{background:"#fff",borderRadius:12,padding:20,marginBottom:20,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",border:"1px solid #dbeafe"}}>
        <h3 style={{margin:"0 0 4px",fontSize:15,color:"#1e293b"}}>Create Operator Account</h3>
        <p style={{margin:"0 0 14px",fontSize:13,color:C.gray}}>Operator can <strong>edit and delete marks, students, and staff</strong> but cannot create new schools or manage accounts.</p>
        <div style={{display:"flex",flexDirection:"column",gap:10,maxWidth:380}}>
          <div><label style={{display:"block",marginBottom:3,fontSize:12,fontWeight:600,color:"#374151"}}>Full Name</label>
            <input type="text" value={opName} onChange={e=>setOpName(e.target.value)} placeholder="e.g. School Operator" style={{width:"100%",padding:"9px 11px",border:"1px solid #d1d5db",borderRadius:7,fontSize:13,boxSizing:"border-box"}}/></div>
          <div><label style={{display:"block",marginBottom:3,fontSize:12,fontWeight:600,color:"#374151"}}>Login Email</label>
            <input type="email" value={opEmail} onChange={e=>setOpEmail(e.target.value)} placeholder="operator@school.edu" style={{width:"100%",padding:"9px 11px",border:"1px solid #d1d5db",borderRadius:7,fontSize:13,boxSizing:"border-box"}}/></div>
          <div><label style={{display:"block",marginBottom:3,fontSize:12,fontWeight:600,color:"#374151"}}>Password</label>
            <input type="password" value={opPassword} onChange={e=>setOpPassword(e.target.value)} placeholder="Min 4 characters" style={{width:"100%",padding:"9px 11px",border:"1px solid #d1d5db",borderRadius:7,fontSize:13,boxSizing:"border-box"}}/></div>
          {opError&&<div style={{padding:"8px 10px",background:"#fef2f2",color:"#b91c1c",borderRadius:6,fontSize:12}}>{opError}</div>}
          {opSuccess&&<div style={{padding:"8px 10px",background:"#f0fdf4",color:"#166534",borderRadius:6,fontSize:12}}>{opSuccess}</div>}
          <button type="button" onClick={async()=>{
            setOpError("");setOpSuccess("");
            if(!opName.trim()){setOpError("Enter full name.");return;}
            if(!opEmail.trim()){setOpError("Enter email.");return;}
            if(!opPassword.trim()||opPassword.length<4){setOpError("Password must be at least 4 characters.");return;}
            const list=loadAuthUsers();
            const em=opEmail.trim().toLowerCase();
            if(list.some(u=>String(u.email||"").toLowerCase()===em)){setOpError("A user with this email already exists.");return;}
            const pwHash=await hashPassword(opPassword.trim());
            saveAuthUsers([...list,{id:genId(),email:em,password:pwHash,schoolId:activeSchoolId,name:opName.trim(),userType:"school"}]);
            setOpName("");setOpEmail("");setOpPassword("");
            setOpSuccess("Operator account created. They can now sign in.");
            refreshOp();
          }} style={{padding:"9px 16px",borderRadius:7,border:"none",background:"#1e40af",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer",alignSelf:"flex-start"}}>Create Operator Account</button>
        </div>
      </div>
      {/* Operators list */}
      {opList.length>0&&<div style={{background:"#fff",borderRadius:12,padding:20,marginBottom:20,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",border:"1px solid #dbeafe"}}>
        <h3 style={{margin:"0 0 12px",fontSize:15,color:"#1e293b"}}>Operators ({opList.length})</h3>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {opList.map(op=>(
            <div key={op.id} style={{padding:"10px 14px",background:op.blocked?"#fef2f2":"#eff6ff",borderRadius:8,border:"1px solid #bfdbfe",display:"flex",flexWrap:"wrap",alignItems:"center",gap:8}}>
              <div style={{flex:"1 1 180px",minWidth:0}}>
                <div style={{fontWeight:600,fontSize:13,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{op.name||"—"} <span style={{fontSize:10,padding:"1px 5px",borderRadius:3,background:"#dbeafe",color:"#1e40af",fontWeight:700}}>Operator</span></div>
                <div style={{fontSize:11,color:C.gray,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{op.email}</div>
                {op.blocked&&<span style={{fontSize:10,fontWeight:600,color:"#b91c1c"}}>BLOCKED</span>}
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button type="button" onClick={()=>{const n=loadAuthUsers().map(u=>u.id===op.id?{...u,blocked:!op.blocked}:u);saveAuthUsers(n);refreshOp();}}
                  style={{padding:"5px 10px",borderRadius:6,border:"1px solid #d1d5db",background:op.blocked?"#d1fae5":"#fef2f2",color:op.blocked?"#065f46":"#b91c1c",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                  {op.blocked?"Unblock":"Block"}
                </button>
                {opEditId===op.id?(
                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                    <input type="password" value={opEditPw} onChange={e=>setOpEditPw(e.target.value)} placeholder="New password" style={{padding:"4px 8px",border:"1px solid #d1d5db",borderRadius:5,fontSize:12,width:120}}/>
                    {opEditPwErr&&<span style={{fontSize:10,color:"#b91c1c"}}>{opEditPwErr}</span>}
                    <button type="button" onClick={async()=>{
                      if(!opEditPw.trim()||opEditPw.length<4){setOpEditPwErr("Min 4 chars");return;}
                      const h=await hashPassword(opEditPw.trim());
                      saveAuthUsers(loadAuthUsers().map(u=>u.id===op.id?{...u,password:h}:u));
                      setOpEditId(null);setOpEditPw("");setOpEditPwErr("");refreshOp();
                    }} style={{padding:"4px 8px",borderRadius:5,border:"none",background:"#1e40af",color:"#fff",fontSize:11,cursor:"pointer"}}>Save</button>
                    <button type="button" onClick={()=>{setOpEditId(null);setOpEditPw("");setOpEditPwErr("");}} style={{padding:"4px 8px",borderRadius:5,border:"1px solid #d1d5db",background:"#fff",fontSize:11,cursor:"pointer"}}>Cancel</button>
                  </div>
                ):(
                  <button type="button" onClick={()=>{setOpEditId(op.id);setOpEditPw("");setOpEditPwErr("");}}
                    style={{padding:"5px 10px",borderRadius:6,border:"1px solid #d1d5db",background:"#fff",color:"#374151",fontSize:11,cursor:"pointer"}}>Reset PW</button>
                )}
                <button type="button" onClick={()=>{if(!confirm(`Remove operator "${op.name}"?`))return;saveAuthUsers(loadAuthUsers().filter(u=>u.id!==op.id));refreshOp();}}
                  style={{padding:"5px 10px",borderRadius:6,border:"none",background:"#fef2f2",color:"#b91c1c",fontSize:11,fontWeight:600,cursor:"pointer"}}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>}
      {/* Create teacher account */}
      <div style={{background:"#fff",borderRadius:12,padding:20,marginBottom:20,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",border:"1px solid #e2e8f0"}}>
        <h3 style={{margin:"0 0 4px",fontSize:15,color:"#1e293b"}}>Create Teacher Account</h3>
        <p style={{margin:"0 0 14px",fontSize:13,color:C.gray}}>Teachers can log in on any device and access Dashboard, Timetable, Attendance, Examination, Paper & Card generators.</p>
        <div style={{display:"flex",flexDirection:"column",gap:10,maxWidth:380}}>
          <div>
            <label style={{display:"block",marginBottom:3,fontSize:12,fontWeight:600,color:"#374151"}}>Select Staff Member</label>
            {(staffProfiles||[]).length===0
              ? <p style={{margin:0,fontSize:12,color:C.gray}}>No staff profiles found. Add staff in the <strong>Staff Profiles</strong> tab first.</p>
              : <select value={tcStaffId} onChange={e=>{
                  const id=e.target.value;
                  setTcStaffId(id);
                  const sp=(staffProfiles||[]).find(p=>p.id===id);
                  if(sp){setTcName(sp.name||"");setTcEmail(sp.email||"");}
                  else{setTcName("");setTcEmail("");}
                }} style={{width:"100%",padding:"9px 11px",border:"1px solid #d1d5db",borderRadius:7,fontSize:13,boxSizing:"border-box",background:"#fff"}}>
                <option value="">— Select staff member —</option>
                {(staffProfiles||[]).filter(p=>p.name).map(p=><option key={p.id} value={p.id}>{p.name}{p.designation?` (${p.designation})`:""}</option>)}
              </select>
            }
          </div>
          <div><label style={{display:"block",marginBottom:3,fontSize:12,fontWeight:600,color:"#374151"}}>Email</label>
            <input type="email" value={tcEmail} onChange={e=>setTcEmail(e.target.value)} placeholder="teacher@school.edu" style={{width:"100%",padding:"9px 11px",border:"1px solid #d1d5db",borderRadius:7,fontSize:13,boxSizing:"border-box"}}/></div>
          <div><label style={{display:"block",marginBottom:3,fontSize:12,fontWeight:600,color:"#374151"}}>Password</label>
            <input type="password" value={tcPassword} onChange={e=>setTcPassword(e.target.value)} placeholder="Min 4 characters" style={{width:"100%",padding:"9px 11px",border:"1px solid #d1d5db",borderRadius:7,fontSize:13,boxSizing:"border-box"}}/></div>
          {tcError&&<div style={{padding:"8px 10px",background:"#fef2f2",color:"#b91c1c",borderRadius:6,fontSize:12}}>{tcError}</div>}
          {tcSuccess&&<div style={{padding:"8px 10px",background:"#f0fdf4",color:"#166534",borderRadius:6,fontSize:12}}>{tcSuccess}</div>}
          <button type="button" onClick={async()=>{
            setTcError("");setTcSuccess("");
            if(!tcName.trim()){setTcError("Select a staff member.");return;}
            if(!tcEmail.trim()){setTcError("Enter email.");return;}
            if(!tcPassword.trim()||tcPassword.length<4){setTcError("Password must be at least 4 characters.");return;}
            const list=loadAuthUsers();
            const em=tcEmail.trim().toLowerCase();
            if(list.some(u=>String(u.email||"").toLowerCase()===em)){setTcError("A user with this email already exists.");return;}
            const pwHash=await hashPassword(tcPassword.trim());
            saveAuthUsers([...list,{id:genId(),email:em,password:pwHash,schoolId:activeSchoolId,name:tcName.trim(),userType:"teacher"}]);
            setTcStaffId("");setTcName("");setTcEmail("");setTcPassword("");
            setTcSuccess("Teacher account created. They can now sign in.");
            refreshTc();
          }} style={{padding:"9px 16px",borderRadius:7,border:"none",background:"#1e293b",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer",alignSelf:"flex-start"}}>Create Teacher Account</button>
        </div>
      </div>
      {/* Teachers list */}
      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",border:"1px solid #e2e8f0"}}>
        <h3 style={{margin:"0 0 12px",fontSize:15,color:"#1e293b"}}>Teachers ({tcList.length})</h3>
        {tcList.length===0&&<p style={{margin:0,fontSize:13,color:C.gray}}>No teacher accounts yet. Create one above.</p>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {tcList.map(tc=>(
            <div key={tc.id} style={{padding:"10px 14px",background:tc.blocked?"#fef2f2":"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0",display:"flex",flexWrap:"wrap",alignItems:"center",gap:8}}>
              <div style={{flex:"1 1 180px",minWidth:0}}>
                <div style={{fontWeight:600,fontSize:13,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tc.name||"—"}</div>
                <div style={{fontSize:11,color:C.gray,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tc.email}</div>
                {tc.blocked&&<span style={{fontSize:10,fontWeight:600,color:"#b91c1c"}}>BLOCKED</span>}
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button type="button" onClick={()=>{const n=loadAuthUsers().map(u=>u.id===tc.id?{...u,blocked:!u.blocked}:u);saveAuthUsers(n);refreshTc();}}
                  style={{padding:"5px 10px",borderRadius:6,border:"1px solid #d1d5db",background:tc.blocked?"#d1fae5":"#fef2f2",color:tc.blocked?"#065f46":"#b91c1c",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                  {tc.blocked?"Unblock":"Block"}
                </button>
                {tcEditId===tc.id?(
                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                    <input type="password" value={tcEditPw} onChange={e=>setTcEditPw(e.target.value)} placeholder="New password" style={{padding:"4px 8px",border:"1px solid #d1d5db",borderRadius:5,fontSize:12,width:120}}/>
                    {tcEditPwErr&&<span style={{fontSize:10,color:"#b91c1c"}}>{tcEditPwErr}</span>}
                    <button type="button" onClick={async()=>{
                      if(!tcEditPw.trim()||tcEditPw.length<4){setTcEditPwErr("Min 4 chars");return;}
                      const h=await hashPassword(tcEditPw.trim());
                      saveAuthUsers(loadAuthUsers().map(u=>u.id===tc.id?{...u,password:h}:u));
                      setTcEditId(null);setTcEditPw("");setTcEditPwErr("");refreshTc();
                    }} style={{padding:"4px 8px",borderRadius:5,border:"none",background:"#1e293b",color:"#fff",fontSize:11,cursor:"pointer"}}>Save</button>
                    <button type="button" onClick={()=>{setTcEditId(null);setTcEditPw("");setTcEditPwErr("");}} style={{padding:"4px 8px",borderRadius:5,border:"1px solid #d1d5db",background:"#fff",fontSize:11,cursor:"pointer"}}>Cancel</button>
                  </div>
                ):(
                  <button type="button" onClick={()=>{setTcEditId(tc.id);setTcEditPw("");setTcEditPwErr("");}}
                    style={{padding:"5px 10px",borderRadius:6,border:"1px solid #d1d5db",background:"#fff",color:"#374151",fontSize:11,cursor:"pointer"}}>Reset PW</button>
                )}
                <button type="button" onClick={()=>{if(!confirm(`Remove teacher "${tc.name}"?`))return;saveAuthUsers(loadAuthUsers().filter(u=>u.id!==tc.id));refreshTc();}}
                  style={{padding:"5px 10px",borderRadius:6,border:"none",background:"#fef2f2",color:"#b91c1c",fontSize:11,fontWeight:600,cursor:"pointer"}}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>}


    {tab==="school"&&<div style={{maxWidth:900}}>
      {/* Logo row */}
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:18}}>
        <img src={schoolOrBrandLogo(settings.logo)} alt="" style={{width:144,height:144,borderRadius:"50%",objectFit:"cover",border:"3px solid #e5e7eb",boxShadow:"0 4px 16px rgba(15,23,42,0.2)"}}/>
        <div>
          <div style={{fontWeight:700,fontSize:14,marginBottom:4,color:C.navy}}>School Logo / Emblem</div>
          <div style={{fontSize:11,color:C.gray,marginBottom:6}}>Upload your school&apos;s official logo (PNG, JPG – max 2MB) to replace the default emblem on ID cards and printouts.</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Btn small onClick={()=>fileRef.current.click()}>Upload Logo</Btn>
            {settings.logo&&<Btn small danger onClick={()=>setSettings(s=>({...s,logo:null}))}>Remove</Btn>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setSettings(s=>({...s,logo:ev.target.result}));r.readAsDataURL(f);}}/>
        </div>
      </div>

      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:18}}>
        <div style={{width:72,height:72,borderRadius:8,background:"#f3f4f6",display:"flex",alignItems:"center",justifyContent:"center",border:"1.5px dashed #d1d5db",overflow:"hidden"}}>
          {settings.banner ? <img src={settings.banner} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : <span style={{fontSize:10,color:C.gray,textAlign:"center"}}>No Banner</span>}
        </div>
        <div>
          <div style={{fontWeight:700,fontSize:14,marginBottom:4,color:C.navy}}>Promotion Banner (Result Card)</div>
          <div style={{fontSize:11,color:C.gray,marginBottom:6}}>Upload a promotional banner (e.g. Admission Campaign) to display at the bottom of student result cards.</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Btn small onClick={()=>bannerUploadRef.current.click()}>Upload Banner</Btn>
            {settings.banner&&<Btn small danger onClick={()=>setSettings(s=>({...s,banner:null}))}>Remove</Btn>}
          </div>
          <input ref={bannerUploadRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setSettings(s=>({...s,banner:ev.target.result}));r.readAsDataURL(f);}}/>
        </div>
      </div>

      <div style={{display:"flex",alignItems:"flex-start",gap:16,marginBottom:18}}>
        <div style={{width:72,height:72,borderRadius:8,background:"#f3f4f6",display:"flex",alignItems:"center",justifyContent:"center",border:"1.5px dashed #d1d5db",overflow:"hidden",flexShrink:0}}>
          <img src={settings.resultCardSignature||signImg} alt="" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:4,color:C.navy}}>Result card — signature and stamp</div>
          <div style={{fontSize:11,color:C.gray,marginBottom:8}}>Upload a signature image for the headmaster block on printed result cards. Optional text lines override the stamp; if left blank, Principal name and School name from Administration are used.</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
            <Btn small onClick={()=>resultCardSignatureUploadRef.current.click()}>Upload signature</Btn>
            {settings.resultCardSignature&&<Btn small danger onClick={()=>setSettings(s=>({...s,resultCardSignature:null}))}>Use default sign</Btn>}
          </div>
          <input ref={resultCardSignatureUploadRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setSettings(s=>({...s,resultCardSignature:ev.target.result}));r.readAsDataURL(f);}}/>
          <div style={{marginBottom:8}}>
            <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Stamp line 1 (headmaster / title)</label>
            <input
              value={settings.resultCardStampLine1||""}
              onChange={e=>setSettings(s=>({...s,resultCardStampLine1:e.target.value}))}
              placeholder={`Optional — defaults to Principal name (${(settings.principalName||"").trim()||"—"})`}
              style={{width:"100%",maxWidth:480,padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f9fafb",boxSizing:"border-box"}}
            />
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Stamp line 2 (school line)</label>
            <input
              value={settings.resultCardStampLine2||""}
              onChange={e=>setSettings(s=>({...s,resultCardStampLine2:e.target.value}))}
              placeholder={`Optional — defaults to school name (${(settings.schoolName||"").trim()||"—"})`}
              style={{width:"100%",maxWidth:480,padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f9fafb",boxSizing:"border-box"}}
            />
          </div>
        </div>
      </div>

      <div style={{background:"#fff",borderRadius:14,boxShadow:"0 18px 55px rgba(15,23,42,0.18)",overflow:"hidden"}}>
        <div style={{display:"flex",borderBottom:"1px solid #e5e7eb",overflowX:"auto"}}>
          {[
            "Basic Info",
            "Location",
            "Administration",
          ].map(label=>(
            <div key={label} style={{flex:"1 1 0",minWidth:120,padding:"10px 12px",textAlign:"center",fontSize:11,fontWeight:700,color:"#4b5563",borderBottom:"3px solid transparent"}}>
              {label}
            </div>
          ))}
        </div>

        <div style={{padding:"22px 24px"}}>
          {/* Basic Info */}
          <div style={{marginBottom:26}}>
            <div style={{fontFamily:UI.fontHeading,fontSize:18,color:C.navy,marginBottom:4}}>Basic School Information</div>
            <div style={{fontSize:12,color:C.gray,marginBottom:16,borderBottom:"1px dashed #e5e7eb",paddingBottom:10}}>
              Official identity and core administrative details of the school.
            </div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:4}}>
              <div style={{gridColumn:"1 / span 2"}}>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>School Name (Official)</label>
                <input
                  value={settings.schoolName||""}
                  onChange={e=>setSettings(s=>({...s,schoolName:e.target.value}))}
                  placeholder="e.g. PSMS Ladheke-Unchay Rainwind Road, Lahore"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>School Code (EMIS)</label>
                <input
                  value={settings.schoolCode||""}
                  onChange={e=>setSettings(s=>({...s,schoolCode:e.target.value}))}
                  placeholder="8-digit EMIS code"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>D.D.O Code</label>
                <input
                  value={settings.ddoCode||""}
                  onChange={e=>setSettings(s=>({...s,ddoCode:e.target.value}))}
                  placeholder="DDO code"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>School Type</label>
                <select
                  value={settings.schoolType||""}
                  onChange={e=>setSettings(s=>({...s,schoolType:e.target.value}))}
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f9fafb",boxSizing:"border-box"}}
                >
                  <option value="">Select type</option>
                  <option value="Government">Government</option>
                  <option value="Semi-Government">Semi-Government</option>
                  <option value="Private">Private</option>
                  <option value="Model School">Model School</option>
                  <option value="Special Education">Special Education</option>
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>School Level</label>
                <select
                  value={settings.schoolLevel||""}
                  onChange={e=>setSettings(s=>({...s,schoolLevel:e.target.value}))}
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f9fafb",boxSizing:"border-box"}}
                >
                  <option value="">Select level</option>
                  <option value="Primary (I–V)">Primary (I–V)</option>
                  <option value="Middle (I–VIII)">Middle (I–VIII)</option>
                  <option value="High (I–X)">High (I–X)</option>
                  <option value="Higher Secondary (I–XII)">Higher Secondary (I–XII)</option>
                  <option value="Elementary">Elementary</option>
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Gender Category</label>
                <select
                  value={settings.genderCategory||""}
                  onChange={e=>setSettings(s=>({...s,genderCategory:e.target.value}))}
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f9fafb",boxSizing:"border-box"}}
                >
                  <option value="">Select</option>
                  <option value="Boys">Boys</option>
                  <option value="Girls">Girls</option>
                  <option value="Co-Education">Co-Education</option>
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>School Shift</label>
                <select
                  value={settings.schoolShift||""}
                  onChange={e=>setSettings(s=>({...s,schoolShift:e.target.value}))}
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f9fafb",boxSizing:"border-box"}}
                >
                  <option value="">Select shift</option>
                  <option value="Morning">Morning</option>
                  <option value="Evening">Evening</option>
                  <option value="Both">Both</option>
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>School Phone No</label>
                <input
                  value={settings.schoolPhoneNo||""}
                  onChange={e=>setSettings(s=>({...s,schoolPhoneNo:e.target.value}))}
                  placeholder="+92-XX-XXXXXXX"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>School Email Address</label>
                <input
                  value={settings.schoolEmail||""}
                  onChange={e=>setSettings(s=>({...s,schoolEmail:e.target.value}))}
                  placeholder="school@edu.punjab.gov.pk"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Date of Establishment</label>
                <input
                  type="date"
                  value={settings.estDate||""}
                  onChange={e=>setSettings(s=>({...s,estDate:e.target.value}))}
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>For The Month</label>
                <input
                  value={settings.forTheMonth||""}
                  onChange={e=>setSettings(s=>({...s,forTheMonth:e.target.value}))}
                  placeholder="e.g. March 2025"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div style={{marginBottom:26}}>
            <div style={{fontFamily:UI.fontHeading,fontSize:18,color:C.navy,marginBottom:4}}>Location & Geographic Details</div>
            <div style={{fontSize:12,color:C.gray,marginBottom:16,borderBottom:"1px dashed #e5e7eb",paddingBottom:10}}>
              Administrative and physical location of the school.
            </div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
              <div style={{gridColumn:"1 / span 2"}}>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Full School Address</label>
                <textarea
                  value={settings.institutionAddress||""}
                  onChange={e=>setSettings(s=>({...s,institutionAddress:e.target.value}))}
                  placeholder="Street / Mohallah / Village, Tehsil, District, Province"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",minHeight:70,resize:"vertical",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Province</label>
                <select
                  value={settings.province||""}
                  onChange={e=>setSettings(s=>({...s,province:e.target.value}))}
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f9fafb",boxSizing:"border-box"}}
                >
                  <option value="">Select province</option>
                  <option value="Punjab">Punjab</option>
                  <option value="Sindh">Sindh</option>
                  <option value="KPK">KPK</option>
                  <option value="Balochistan">Balochistan</option>
                  <option value="AJK">AJK</option>
                  <option value="GB">GB</option>
                  <option value="ICT">ICT</option>
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>District</label>
                <input
                  value={settings.district||""}
                  onChange={e=>setSettings(s=>({...s,district:e.target.value}))}
                  placeholder="e.g. Lahore"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Tehsil</label>
                <input
                  value={settings.tehsil||""}
                  onChange={e=>setSettings(s=>({...s,tehsil:e.target.value}))}
                  placeholder="Tehsil name"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Union Council (UC)</label>
                <input
                  value={settings.uc||""}
                  onChange={e=>setSettings(s=>({...s,uc:e.target.value}))}
                  placeholder="UC number / name"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>N.A Constituency</label>
                <input
                  value={settings.na||""}
                  onChange={e=>setSettings(s=>({...s,na:e.target.value}))}
                  placeholder="e.g. NA-120"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>P.P Constituency</label>
                <input
                  value={settings.ppNo||""}
                  onChange={e=>setSettings(s=>({...s,ppNo:e.target.value}))}
                  placeholder="e.g. PP-145"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Ward No.</label>
                <input
                  value={settings.ward||""}
                  onChange={e=>setSettings(s=>({...s,ward:e.target.value}))}
                  placeholder="Ward number"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Mauza / Village</label>
                <input
                  value={settings.mauza||""}
                  onChange={e=>setSettings(s=>({...s,mauza:e.target.value}))}
                  placeholder="Mauza or village name"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>GPS Latitude</label>
                <input
                  value={settings.lat||""}
                  onChange={e=>setSettings(s=>({...s,lat:e.target.value}))}
                  placeholder="e.g. 31.5204"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>GPS Longitude</label>
                <input
                  value={settings.lng||""}
                  onChange={e=>setSettings(s=>({...s,lng:e.target.value}))}
                  placeholder="e.g. 74.3587"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Rural / Urban</label>
                <select
                  value={settings.ruralUrban||""}
                  onChange={e=>setSettings(s=>({...s,ruralUrban:e.target.value}))}
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f9fafb",boxSizing:"border-box"}}
                >
                  <option value="">Select</option>
                  <option value="Urban">Urban</option>
                  <option value="Rural">Rural</option>
                  <option value="Peri-Urban">Peri-Urban</option>
                </select>
              </div>
            </div>
          </div>

          {/* Administration */}
          <div>
            <div style={{fontFamily:UI.fontHeading,fontSize:18,color:C.navy,marginBottom:4}}>Administration & Head of Institution</div>
            <div style={{fontSize:12,color:C.gray,marginBottom:16,borderBottom:"1px dashed #e5e7eb",paddingBottom:10}}>
              Principal details and key administrative contacts.
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Principal / Headmaster Name</label>
                <input
                  value={settings.principalName||""}
                  onChange={e=>setSettings(s=>({...s,principalName:e.target.value}))}
                  placeholder="Full name"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Designation</label>
                <select
                  value={settings.principalDesignation||""}
                  onChange={e=>setSettings(s=>({...s,principalDesignation:e.target.value}))}
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f9fafb",boxSizing:"border-box"}}
                >
                  <option value="">Select</option>
                  <option value="Principal">Principal</option>
                  <option value="Headmaster">Headmaster</option>
                  <option value="Headmistress">Headmistress</option>
                  <option value="In-Charge">In-Charge</option>
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Mobile No.</label>
                <input
                  value={settings.principalMobile||""}
                  onChange={e=>setSettings(s=>({...s,principalMobile:e.target.value}))}
                  placeholder="03XX-XXXXXXX"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Email Address</label>
                <input
                  value={settings.principalEmail||""}
                  onChange={e=>setSettings(s=>({...s,principalEmail:e.target.value}))}
                  placeholder="principal@email.com"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Qualification</label>
                <input
                  value={settings.principalQualification||""}
                  onChange={e=>setSettings(s=>({...s,principalQualification:e.target.value}))}
                  placeholder="e.g. M.Ed, M.A"
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Date of Joining</label>
                <input
                  type="date"
                  value={settings.principalJoinDate||""}
                  onChange={e=>setSettings(s=>({...s,principalJoinDate:e.target.value}))}
                  style={{width:"100%",padding:"8px 11px",border:"1.5px solid #cbd5e1",borderRadius:8,fontSize:13,background:"#f1f5f9",boxSizing:"border-box"}}
                />
              </div>
            </div>
          </div>

          <div style={{marginTop:20,padding:"10px 12px",background:"#d1fae5",borderRadius:8,fontSize:12,color:"#065f46"}}>
            ✅ Changes saved automatically
          </div>
        </div>
      </div>
    </div>}

    {tab==="classes"&&<div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"flex-end"}}>
        <Inp label="Grade" value={newCls.grade} onChange={v=>setNewCls(x=>({...x,grade:v}))} width={80}/>
        <Inp label="Section" value={newCls.section} onChange={v=>setNewCls(x=>({...x,section:v}))} width={80}/>
        <Btn onClick={addClass}>+ Add Class</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
        {settings.classes.map(cls=><ClassSubjCard
          key={cls.id}
          cls={cls}
          examSubjects={getClassSubjects(settings,cls.id,"exam")}
          timetableSubjects={getClassSubjects(settings,cls.id,"timetable")}
          onAddExam={s=>addSubj(cls.id,s,"exam")}
          onRemoveExam={s=>rmSubj(cls.id,s,"exam")}
          onAddTimetable={s=>addSubj(cls.id,s,"timetable")}
          onRemoveTimetable={s=>rmSubj(cls.id,s,"timetable")}
          onRemoveClass={()=>removeClass(cls.id)}
        />)}
      </div>
    </div>}

    {tab==="staffProfiles"&&<StaffProfilesPage settings={settings} schools={schools||[]} staffProfiles={staffProfiles||[]} setSchools={setSchools} activeSchoolId={activeSchoolId} currentSession={currentSession}/>}

    {tab==="common"&&<CommonTeachersEditor settings={settings} setSettings={setSettings}/>}

    {tab==="time"&&<div style={{maxWidth:620}}>
      <div style={{background:"#f9fafb",borderRadius:8,padding:14,marginBottom:14}}>
        <h4 style={{margin:"0 0 10px",color:C.navy}}>School Hours</h4>
        {[{key:"mondayToThursday",label:"Monday – Thursday"},{key:"friday",label:"Friday"},{key:"saturday",label:"Saturday"}].map(({key,label})=>(
          <div key={key} style={{display:"grid",gridTemplateColumns:"160px 1fr 1fr",gap:8,marginBottom:8,alignItems:"flex-end"}}>
            <span style={{fontSize:13,fontWeight:600}}>{label}</span>
            <Inp label="Start" type="time" value={settings.schoolHours[key].start} onChange={v=>setSettings(s=>({...s,schoolHours:{...s.schoolHours,[key]:{...s.schoolHours[key],start:v}}}))}/>
            <Inp label="End" type="time" value={settings.schoolHours[key].end} onChange={v=>setSettings(s=>({...s,schoolHours:{...s.schoolHours,[key]:{...s.schoolHours[key],end:v}}}))}/>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        {[["assemblyTime","Assembly Time (min)"],["firstPeriodTime","P-1 (min)"],["otherPeriodTime","Other Periods (min)"],["periodsPerDay","Periods Per Day"]].map(([key,label])=>(
          <div key={key}>
            <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:3}}>{label}</label>
            <input type="number" value={settings[key]} onChange={e=>setSettings(s=>({...s,[key]:+e.target.value}))} style={{width:"100%",padding:"7px 10px",border:"1.5px solid #d1d5db",borderRadius:5,fontSize:14,boxSizing:"border-box"}}/>
          </div>
        ))}
      </div>
      <div style={{background:"#f9fafb",borderRadius:8,padding:14}}>
        <h4 style={{margin:"0 0 10px",color:C.navy}}>Break Settings</h4>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:14,fontWeight:600,marginBottom:10,cursor:"pointer"}}>
          <input type="checkbox" checked={settings.breakRequired} onChange={e=>setSettings(s=>({...s,breakRequired:e.target.checked}))}/>
          Break Required (Mon–Thu / Sat)
        </label>
        {settings.breakRequired&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div><label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:3}}>Break After Period #</label><input type="number" value={settings.breakAfterPeriod} onChange={e=>setSettings(s=>({...s,breakAfterPeriod:+e.target.value}))} style={{width:"100%",padding:"7px 10px",border:"1.5px solid #d1d5db",borderRadius:5,fontSize:14,boxSizing:"border-box"}}/></div>
          <div><label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:3}}>Break Duration (min)</label><input type="number" value={settings.breakDuration} onChange={e=>setSettings(s=>({...s,breakDuration:+e.target.value}))} style={{width:"100%",padding:"7px 10px",border:"1.5px solid #d1d5db",borderRadius:5,fontSize:14,boxSizing:"border-box"}}/></div>
        </div>}
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:14,fontWeight:600,marginBottom:8,cursor:"pointer"}}>
          <input type="checkbox" checked={settings.fridayBreak} onChange={e=>setSettings(s=>({...s,fridayBreak:e.target.checked}))}/>
          Friday Break Required
        </label>
        {settings.fridayBreak&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:3}}>Friday Break After Period #</label><input type="number" value={settings.fridayBreakAfter} onChange={e=>setSettings(s=>({...s,fridayBreakAfter:+e.target.value}))} style={{width:"100%",padding:"7px 10px",border:"1.5px solid #d1d5db",borderRadius:5,fontSize:14,boxSizing:"border-box"}}/></div>
          <div><label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:3}}>Friday Break Duration (min)</label><input type="number" value={settings.fridayBreakDuration} onChange={e=>setSettings(s=>({...s,fridayBreakDuration:+e.target.value}))} style={{width:"100%",padding:"7px 10px",border:"1.5px solid #d1d5db",borderRadius:5,fontSize:14,boxSizing:"border-box"}}/></div>
        </div>}
      </div>
    </div>}

    {tab==="awardList"&&<div style={{maxWidth:560}}>
      <p style={{fontSize:13,color:C.gray,marginBottom:14}}>Export a list of students per class for teachers with timetable assignments, then import after filling marks.</p>
      <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:18}}>
        <div>
          <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Exam</label>
          <select value={awardListExam} onChange={e=>setAwardListExam(e.target.value)} style={{width:"100%",padding:"8px 10px",border:"1.5px solid #d1d5db",borderRadius:6,fontSize:13,background:"#fff"}}>
            {AWARD_LIST_EXAMS.map(ex=><option key={ex} value={ex}>{ex}</option>)}
          </select>
        </div>
        <div>
          <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Teacher name</label>
          <select value={awardListTeacher} onChange={e=>setAwardListTeacher(e.target.value)} style={{width:"100%",padding:"8px 10px",border:"1.5px solid #d1d5db",borderRadius:6,fontSize:13,background:"#fff"}}>
            <option value="">— Select teacher —</option>
            {teachersWithAssignments.map(t=>{
              const distinctCount=new Set((t.classes||[]).map(c=>{
                return `${c.classId}|${awardListBaseSubject(c.subject||"")}`;
              })).size;
              return <option key={t.teacherName} value={t.teacherName}>{t.teacherName} ({distinctCount} {distinctCount===1?"subject":"subjects"})</option>;
            })}
          </select>
        </div>
      </div>
      {teachersWithAssignments.length===0&&<div style={{padding:12,background:"#fef3c7",borderRadius:6,fontSize:12,color:"#92400e",marginBottom:14}}>No teachers with timetable assignments. Assign teachers to classes in Timetable first.</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,maxWidth:400}}>
        <Btn outline onClick={() => void exportAwardListTeacher()} disabled={!selectedTeacherData?.classes?.length}>Export List (Teacher Name)</Btn>
        <Btn outline onClick={()=>void exportAwardListAllTeachersZip()} disabled={!teachersWithAssignments?.length}>Export All Teachers (ZIP)</Btn>
        <Btn outline onClick={()=>awardListExcelRef.current?.click()} disabled={!setExamMarks}>Import Award List (Teacher)</Btn>
        <input ref={awardListExcelRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={importAwardListTeacher}/>
      </div>
    </div>}

  </div>;
}

// ─── ATTENDANCE ────────────────────────────────────────────────────────────────
function AttendancePage({settings,students,currentSession,activeSchoolId,setBarSubtitle}){
  const [selCls,setSelCls]=useState(settings.classes[0]?.id||"");
  const [date,setDate]=useState(new Date().toISOString().split("T")[0]);
  const [att,setAtt]=useState(()=>loadAttendanceFromLocal(activeSchoolId||""));
  const [applications,setApplications]=useState({});
  const [viewApp,setViewApp]=useState(null);
  const [attView,setAttView]=useState("mark"); // "mark" | "register"
  const [registerMonth,setRegisterMonth]=useState(()=>{ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; });
  const attendanceTableRef=useRef(null);
  const registerTableRef=useRef(null);

  useEffect(()=>{
    queueMicrotask(()=>setAtt(loadAttendanceFromLocal(activeSchoolId||"")));
  },[activeSchoolId]);

  useEffect(()=>{
    if(activeSchoolId) saveAttendanceToLocal(activeSchoolId,att);
  },[activeSchoolId,att]);

  const key=`${selCls}_${date}`;
  const classAtt=att[key]||{};
  const classApps=applications[key]||{};
  const cs=students.filter(s=>{
    if(selCls==="all") return true;
    const filterCls=resolveClass(settings.classes,selCls);
    const studentCls=resolveClass(settings.classes,s.classId);
    return filterCls&&studentCls&&filterCls.id===studentCls.id;
  });
  const toggle=(id,status)=>setAtt(a=>({...a,[key]:{...classAtt,[id]:status}}));
  const markAll=(status)=>{ const v={}; cs.forEach(s=>{v[s.id]=status;}); setAtt(a=>({...a,[key]:v})); };
  const present=cs.filter(s=>classAtt[s.id]==="P").length;
  const absent=cs.filter(s=>classAtt[s.id]==="A").length;
  const handleUpload=(sid,e)=>{
    const f=e?.target?.files?.[0]; if(!f)return;
    if(!f.type.match(/^image\//)&&f.type!=="application/pdf"&&f.type!=="application/msword"&&f.type!=="application/vnd.openxmlformats-officedocument.wordprocessingml.document")return;
    const r=new FileReader(); r.onload=ev=>{ setApplications(a=>({...a,[key]:{...classApps,[sid]:{data:ev.target.result,mime:f.type,name:f.name}}})); }; r.readAsDataURL(f);
  };
  const openUpload=(sid)=>{ const el=document.createElement("input"); el.type="file"; el.accept="image/*,.pdf,.doc,.docx"; el.onchange=e=>handleUpload(sid,e); el.click(); };
  const isImage=(m)=>m&&m.startsWith("image/");
  const isPdf=(m)=>m==="application/pdf";
  const tableTitle=()=>{ const clsName=getClassLabel(settings,selCls); return `${clsName} — Attendance — ${date}`; };
  const attendancePdfSubtitle=()=>{
    const clsName=getClassLabel(settings,selCls);
    return [clsName, currentSession, `Attendance — ${date}`].filter(Boolean).join(" — ");
  };
  const doExportAttendance=()=>{
    const {headers,rows}=getTableDataFromElement(attendanceTableRef.current);
    if(!headers.length){ alert("No data to export. Select a class with students."); return; }
    const markExportCols=Math.min(4, headers.length);
    const h=headers.slice(0,markExportCols);
    const r=rows.map((row)=>row.slice(0,markExportCols));
    const clsName=getClassLabel(settings,selCls);
    const name=`${sanitizePdfFilenamePart(clsName)}_Attendance_${date}`;
    void exportTableToPdf(settings,currentSession,tableTitle(),h,r,name+".pdf",undefined,{subtitleOverride:attendancePdfSubtitle()}).catch(()=>alert("PDF export failed."));
  };

  const [y, m] = registerMonth.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const registerDates = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  });
  const getStatusForDate = (studentId, dateStr) => {
    const k = `${selCls}_${dateStr}`;
    const dayAtt = att[k] || {};
    return dayAtt[studentId] || "—";
  };
  const registerTitle = () => {
    const clsName = getClassLabel(settings, selCls);
    const monthName = new Date(y, m - 1, 1).toLocaleString("en-PK", { month: "long", year: "numeric" });
    return `${clsName} — Attendance Register — ${monthName}`;
  };
  const registerPdfSubtitle = () => {
    const clsName = getClassLabel(settings, selCls);
    const monthName = new Date(y, m - 1, 1).toLocaleString("en-PK", { month: "long", year: "numeric" });
    return [clsName, currentSession, `Attendance Register — ${monthName}`].filter(Boolean).join(" — ");
  };
  const doExportRegister = (format) => {
    const clsName = getClassLabel(settings, selCls);
    const monthName = new Date(y, m - 1, 1).toLocaleString("en-PK", { month: "long", year: "numeric" });
    const concatHdr = `P/A/L (${monthName}, days 1–${registerDates.length}; – = unmarked)`;
    const name = `${sanitizePdfFilenamePart(clsName)}_Attendance_Register_${registerMonth}`;
    if (format === "pdf") {
      const pdfHeaders = ["Roll No", "Name", "Father's Name", concatHdr];
      const pdfRows = cs.map((s) => [
        s.rollNo,
        s.name,
        s.fatherName,
        registerDates
          .map((d) => getStatusForDate(s.id, d))
          .map((st) => (st === "—" ? "–" : String(st).charAt(0)))
          .join(""),
      ]);
      void exportTableToPdf(settings, currentSession, registerTitle(), pdfHeaders, pdfRows, name + ".pdf", undefined, {
        subtitleOverride: registerPdfSubtitle(),
      }).catch(() => alert("PDF export failed."));
    }
  };

  useEffect(()=>{
    if(!setBarSubtitle) return;
    setBarSubtitle(attView==="mark"?"Mark Attendance":"Register (Date-wise)");
  },[attView,setBarSubtitle]);

  return <div>
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
      {[{id:"mark",label:"Mark Attendance"},{id:"register",label:"Register (Date-wise)"}].map(v=>(
        <button key={v.id} onClick={()=>setAttView(v.id)} style={{padding:"8px 16px",borderRadius:6,border:"none",background:attView===v.id?C.navy:"#e5e7eb",color:attView===v.id?"#fff":"#374151",fontWeight:600,fontSize:13,cursor:"pointer"}}>{v.label}</button>
      ))}
    </div>

    {attView==="mark"&&<>
    <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap",alignItems:"flex-end"}}>
        <Sel label="Class" value={selCls} onChange={setSelCls} options={settings.classes.map(c=>({value:c.id,label:formatClassDisplay(c)}))}/>
      <Inp label="Date" type="date" value={date} onChange={setDate}/>
      <div style={{display:"flex",gap:8,paddingTop:16,flexWrap:"wrap"}}><Btn small color={C.green} onClick={()=>markAll("P")}>✔ All Present</Btn><Btn small color={C.red} onClick={()=>markAll("A")}>✘ All Absent</Btn>{cs.length>0&&<Btn small outline onClick={doExportAttendance}>📄 PDF</Btn>}</div>
    </div>
    <div style={{display:"flex",gap:12,marginBottom:14}}>
      {[{l:"Total",v:cs.length,c:C.navy},{l:"Present",v:present,c:C.green},{l:"Absent",v:absent,c:C.red},{l:"Unmarked",v:cs.length-present-absent,c:C.gold}].map(({l,v,c})=>(
        <div key={l} style={{background:"#fff",border:`2px solid ${c}`,borderRadius:8,padding:"8px 16px",textAlign:"center"}}>
          <div style={{fontSize:26,fontWeight:700,color:c}}>{v}</div>
          <div style={{fontSize:11,color:C.gray}}>{l}</div>
        </div>
      ))}
    </div>
    {cs.length===0?<div style={{padding:20,color:C.gray,textAlign:"center"}}>No students in this class.</div>:(
      <div ref={attendanceTableRef}><table style={{borderCollapse:"collapse",fontSize:13,width:"100%"}}>
        <thead><tr style={{background:C.navy,color:"#fff"}}>{["Roll No","Name","Father's Name","Status","Mark","Application"].map(h=><th key={h} style={{padding:"7px 10px",textAlign:"left"}}>{h}</th>)}</tr></thead>
        <tbody>{cs.map((s,i)=><tr key={s.id} style={{background:i%2===0?"#f9fafb":"#fff"}}>
          <td style={{padding:"6px 10px",fontWeight:700}}>{s.rollNo}</td><td style={{padding:"6px 10px"}}>{s.name}</td><td style={{padding:"6px 10px"}}>{s.fatherName}</td>
          <td style={{padding:"6px 10px",fontWeight:700,color:classAtt[s.id]==="P"?C.green:classAtt[s.id]==="A"?C.red:C.gold}}>{classAtt[s.id]||"—"}</td>
          <td style={{padding:"6px 10px"}}><div style={{display:"flex",gap:4}}><Btn small color={C.green} onClick={()=>toggle(s.id,"P")}>P</Btn><Btn small color={C.red} onClick={()=>toggle(s.id,"A")}>A</Btn><Btn small color={C.gold} onClick={()=>toggle(s.id,"L")}>L</Btn></div></td>
          <td style={{padding:"6px 10px"}}>
            {classApps[s.id]?<Btn small outline onClick={()=>setViewApp(classApps[s.id])}>View</Btn>:<Btn small outline onClick={()=>openUpload(s.id)}>Upload Application</Btn>}
          </td>
        </tr>)}</tbody>
      </table></div>
    )}
    </>}

    {attView==="register"&&<>
    <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap",alignItems:"flex-end"}}>
      <Sel label="Class" value={selCls} onChange={setSelCls} options={settings.classes.map(c=>({value:c.id,label:formatClassDisplay(c)}))}/>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <label style={{fontSize:12,fontWeight:600,color:C.gray}}>Month</label>
        <input type="month" value={registerMonth} onChange={e=>setRegisterMonth(e.target.value)} style={{padding:"6px 10px",border:"1.5px solid #d1d5db",borderRadius:6,fontSize:13,background:"#fff"}}/>
      </div>
      {cs.length>0&&<div style={{display:"flex",gap:8}}><Btn small outline onClick={()=>doExportRegister("pdf")}>📄 PDF</Btn></div>}
    </div>
    <p style={{fontSize:12,color:C.gray,margin:"0 0 10px"}}>Register shows Roll No, Name, Father's Name and status (P=Present, A=Absent, L=Late) for each date in the selected month. Mark attendance in &quot;Mark Attendance&quot; first.</p>
    {cs.length===0?<div style={{padding:20,color:C.gray,textAlign:"center"}}>No students in this class.</div>:(
      <div ref={registerTableRef} style={{overflowX:"auto",border:"1px solid #e5e7eb",borderRadius:8,background:"#fff"}}>
        <table style={{borderCollapse:"collapse",fontSize:12,width:"100%",minWidth:400}}>
          <thead>
            <tr style={{background:C.navy,color:"#fff"}}>
              <th style={{padding:"6px 10px",textAlign:"left",whiteSpace:"nowrap"}}>Roll No</th>
              <th style={{padding:"6px 10px",textAlign:"left",whiteSpace:"nowrap",minWidth:100}}>Name</th>
              <th style={{padding:"6px 10px",textAlign:"left",whiteSpace:"nowrap",minWidth:100}}>Father's Name</th>
              {registerDates.map(d=>(
                <th key={d} style={{padding:"4px 6px",textAlign:"center",minWidth:28,fontSize:11}} title={d}>{d.slice(8)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cs.map((s,i)=><tr key={s.id} style={{background:i%2===0?"#f9fafb":"#fff"}}>
              <td style={{padding:"5px 10px",fontWeight:700}}>{s.rollNo}</td>
              <td style={{padding:"5px 10px"}}>{s.name}</td>
              <td style={{padding:"5px 10px"}}>{s.fatherName}</td>
              {registerDates.map(d=>{
                const st = getStatusForDate(s.id, d);
                return (
                  <td key={d} style={{padding:"3px 4px",textAlign:"center",fontWeight:600,color:st==="P"?C.green:st==="A"?C.red:st==="L"?C.gold:"#9ca3af"}}>{st}</td>
                );
              })}
            </tr>)}
          </tbody>
        </table>
      </div>
    )}
    </>}

    {viewApp&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setViewApp(null)}>
      <div style={{background:"#fff",borderRadius:10,maxWidth:"90vw",maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid #e5e7eb"}}>
          <span style={{fontWeight:700,fontSize:14}}>{viewApp.name||"Application"}</span>
          <button onClick={()=>setViewApp(null)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.gray}}>×</button>
        </div>
        <div style={{padding:16,minHeight:200}}>
          {isImage(viewApp.mime)&&<img src={viewApp.data} alt="Application" style={{maxWidth:"100%",height:"auto",display:"block"}}/>}
          {isPdf(viewApp.mime)&&<embed src={viewApp.data} type="application/pdf" style={{width:"100%",minHeight:"70vh"}}/>}
          {viewApp.mime&&!isImage(viewApp.mime)&&!isPdf(viewApp.mime)&&<div style={{textAlign:"center",padding:24}}><p style={{marginBottom:12}}>Word/document file — open in new tab to view.</p><a href={viewApp.data} download={viewApp.name||"application.doc"} target="_blank" rel="noopener noreferrer" style={{color:C.navy,fontWeight:600}}>Open / Download</a></div>}
        </div>
      </div>
    </div>}
  </div>;
}

// ─── EXAMINATION ───────────────────────────────────────────────────────────────
const EXAM_TABS=[{id:"admission",l:"Admission Form"},{id:"record",l:"Student Record"},{id:"marks",l:"Enter Marks"},{id:"consolidated",l:"Consolidated Sheet"},{id:"card",l:"Result Card"},{id:"datesheet",l:"Date Sheet"}];
function MarksInput({initialValue,onSave,rowIdx,colIdx,totalRows,totalCols,inputStyle}){
  const [local,setLocal]=React.useState(String(initialValue||""));
  const dirty=React.useRef(false);
  const prevInitial=React.useRef(initialValue);
  // Sync from external marks when not actively editing (after import / class switch).
  useLayoutEffect(()=>{
    if(dirty.current) return;
    if(initialValue===prevInitial.current) return;
    prevInitial.current=initialValue;
    queueMicrotask(()=>setLocal(String(initialValue||"")));
  },[initialValue]);
  return <input type="number" min="0" data-mark-row={rowIdx} data-mark-col={colIdx}
    value={local}
    onChange={e=>{dirty.current=true;setLocal(e.target.value);}}
    onBlur={()=>{dirty.current=false;onSave(local);}}
    onKeyDown={e=>{
      if(e.key==="Tab"||e.key==="Enter"){
        e.preventDefault();
        dirty.current=false;
        onSave(local);
        let nr=rowIdx,nc=colIdx;
        if(e.shiftKey){nr--;if(nr<0){nr=totalRows-1;nc--;}if(nc<0)return;}
        else{nr++;if(nr>=totalRows){nr=0;nc++;}if(nc>=totalCols)return;}
        const next=document.querySelector('[data-mark-row="'+nr+'"][data-mark-col="'+nc+'"]');
        if(next)next.focus();
      }
    }}
    style={{width:58,padding:"4px",border:"1.5px solid #d1d5db",borderRadius:4,fontSize:12,textAlign:"center",...(inputStyle||{})}}/>;
}
function ExaminationPage({settings:settingsProp,setSettings,students:studentsProp,setStudents,timetable,exam_tm:exam_tmProp,exam_om:exam_omProp,setExamMarks,exam_datesheet:exam_datesheetProp,setDatesheet,currentSession,currentUser,setBarSubtitle}){
  const settings=useMemo(()=>{
    const s=settingsProp||defaultSettings;
    return {
      ...s,
      classes:Array.isArray(s.classes)?s.classes:[],
      classSubjects:(s.classSubjects&&typeof s.classSubjects==="object")?s.classSubjects:{},
      classSubjectsExam:(s.classSubjectsExam&&typeof s.classSubjectsExam==="object")?s.classSubjectsExam:((s.classSubjects&&typeof s.classSubjects==="object")?s.classSubjects:{}),
      classSubjectsTimetable:(s.classSubjectsTimetable&&typeof s.classSubjectsTimetable==="object")?s.classSubjectsTimetable:((s.classSubjects&&typeof s.classSubjects==="object")?s.classSubjects:{})
    };
  },[settingsProp]);
  const students=Array.isArray(studentsProp)?studentsProp:defaultStudents;
  const [tab,setTab]=useState("admission");
  const admissionEmpty={admissionNo:"",rollNo:"",name:"",fatherName:"",classId:settings.classes[0]?.id||"",dob:"",bayForm:"",fatherCnic:"",whatsapp:"",photo:null};
  const [admissionForm,setAdmissionForm]=useState(admissionEmpty);
  const admissionPhotoGalleryRef=useRef(null);
  const admissionPhotoCameraRef=useRef(null);
  const [admissionPhotoBusy,setAdmissionPhotoBusy]=useState(false);
  const suggestedNextAdm=useMemo(()=>nextAdmissionNo(students),[students]);
  const suggestedNextRoll=useMemo(()=>nextRollNoForClass(students,settings.classes,admissionForm.classId,settings.commonTeachers),[students,settings.classes,admissionForm.classId,settings.commonTeachers]);
  const formatDobAf=(v)=>{ const d=String(v||"").replace(/\D/g,"").slice(0,8); if(d.length<=2) return d; if(d.length<=4) return d.slice(0,2)+"/"+d.slice(2); return d.slice(0,2)+"/"+d.slice(2,4)+"/"+d.slice(4); };
  const formatCnicAf=(v)=>{ const d=(v||"").replace(/\D/g,"").slice(0,13); if(d.length<=5) return d; if(d.length<=12) return d.slice(0,5)+"-"+d.slice(5); return d.slice(0,5)+"-"+d.slice(5,12)+"-"+d.slice(12); };
  const formatWhatsappAf=(v)=>{ const d=(v||"").replace(/\D/g,"").slice(0,11); if(d.length<=4) return d; return d.slice(0,4)+"-"+d.slice(4); };
  const handleAdmissionPhotoFile=async (f)=>{
    if(!f) return;
    setAdmissionPhotoBusy(true);
    try{
      const data=await processStudentPhotoWithBackground(f);
      setAdmissionForm(x=>({...x,photo:data}));
    }finally{
      setAdmissionPhotoBusy(false);
    }
  };
  const saveAdmission=()=>{
    if(!(admissionForm.name||"").trim()){ alert("Please enter Student Name."); return; }
    const name=toProperCase(admissionForm.name||"");
    const fatherName=toProperCase(admissionForm.fatherName||"");
    let admissionNo=(admissionForm.admissionNo||"").trim();
    let rollNo=(admissionForm.rollNo||"").trim();
    if(!admissionNo) admissionNo=nextAdmissionNo(students);
    if(!rollNo) rollNo=nextRollNoForClass(students,settings.classes,admissionForm.classId,settings.commonTeachers);
    const dupAdm=findStudentByAdmissionNo(students,admissionNo,null);
    if(dupAdm){
      alert("This admission number is already assigned to:\nClass: "+getClassLabel(settings,dupAdm.classId)+"\nRoll: "+(dupAdm.rollNo||"—")+"\nName: "+(dupAdm.name||"")+"\nFather: "+(dupAdm.fatherName||""));
      return;
    }
    const dupRoll=findStudentByRollInClass(students,settings.classes,admissionForm.classId,rollNo,null,settings.commonTeachers);
    if(dupRoll){
      alert("This roll number is already used in this class by:\nName: "+(dupRoll.name||"")+"\nFather: "+(dupRoll.fatherName||"")+"\nAdm#: "+(dupRoll.admissionNo||"—"));
      return;
    }
    const id=genId();
    const payload={
      ...admissionForm,
      name,
      fatherName,
      admissionNo,
      rollNo,
      id,
      photo:admissionForm.photo||null,
      personalInfoLockSession: null,
      personalInfoHistory: [],
    };
    setStudents(s=>[...s,payload]);
    setAdmissionForm(admissionEmpty);
    alert("Student admitted successfully. You can view them in Student Record.");
  };
  const [selCls,setSelCls]=useState(settings.classes[0]?.id||"");
  const [promotionTargetByStudent,setPromotionTargetByStudent]=useState({});
  const [exam,setExam]=useState("1st Term");
  const [rcCls,setRcCls]=useState(settings.classes[0]?.id||""); const [rcRoll,setRcRoll]=useState("");
  const [defaultDateRow]=useState(()=>({id:genId(),date:new Date().toISOString().split("T")[0]}));
  const [defaultDateCol]=useState(()=>({id:genId(),classId:settings.classes[0]?.id||""}));
  const datesheetTableRef=useRef(null);
  const marksTableRef=useRef(null);
  const consolidatedTableRef=useRef(null);
  const resultCardRef=useRef(null);
  const classResultPdfContainerRef=useRef(null);
  const datesheet=exam_datesheetProp&&typeof exam_datesheetProp==="object"?exam_datesheetProp:{dates:[],cols:[],subs:{},note:""};
  const dsDates=Array.isArray(datesheet.dates)&&datesheet.dates.length>0?datesheet.dates:[defaultDateRow];
  const dsCols=Array.isArray(datesheet.cols)&&datesheet.cols.length>0?datesheet.cols:[defaultDateCol];
  const dsSubs=datesheet.subs&&typeof datesheet.subs==="object"?datesheet.subs:{};
  const dsNote=String(datesheet.note||"");
  const setDsDates=(updater)=>{ if(!setDatesheet) return; const next=typeof updater==="function"?updater(dsDates):updater; setDatesheet(prev=>({...prev,dates:next})); };
  const setDsCols=(updater)=>{ if(!setDatesheet) return; const next=typeof updater==="function"?updater(dsCols):updater; setDatesheet(prev=>({...prev,cols:next})); };
  const setDsSubs=(updater)=>{ if(!setDatesheet) return; const next=typeof updater==="function"?updater(dsSubs):updater; setDatesheet(prev=>({...prev,subs:next})); };
  const setDsNote=(v)=>{ if(setDatesheet) setDatesheet(prev=>({...prev,note:v})); };
  const exams=["1st Term","Mid Term","Final Term","Annual"];
  const subjs=(cls)=>getClassSubjects(settings,cls,"exam");
  const cs=(clsId)=>{
    if(!clsId) return [];
    const filterCls=resolveClass(settings.classes,clsId);
    if(!filterCls) return [];
    return students.filter(s=>resolveClass(settings.classes,s.classId)?.id===filterCls.id);
  };
  const sortStudentsByRoll=(list)=>{
    if(!Array.isArray(list)) return [];
    return list.slice().sort((a,b)=>{
      const r=String(a.rollNo||"").localeCompare(String(b.rollNo||""),undefined,{numeric:true,sensitivity:"base"});
      return r!==0?r:String(a.admissionNo||"").localeCompare(String(b.admissionNo||""),undefined,{numeric:true,sensitivity:"base"});
    });
  };
  const [classPdfBusy,setClassPdfBusy]=useState(false);
  const [singlePdfBusy,setSinglePdfBusy]=useState(false);
  useEffect(()=>{ setPromotionTargetByStudent({}); },[selCls,exam]);
  /** Only mounted while building Class PDF — avoids rendering every card on every paint. */
  const [classPdfExportList,setClassPdfExportList]=useState(null);
  /** html2canvas devicePixelRatio-style scale: 2× = sharp text/borders on A4 PDF (jsPDF scales down to fit). */
  const RESULT_CARD_PDF_H2C_SCALE=2;
  /** High JPEG quality so PDF text and colored borders stay crisp (not soft/blocky). */
  const RESULT_CARD_PDF_JPEG_Q=0.92;
  /** Parallel captures; keep at 3 with HD scale to limit peak memory on large classes. */
  const CLASS_PDF_H2C_CONCURRENCY=3;
  const [rcExam,setRcExam]=useState("overall");
  const tm=exam_tmProp&&typeof exam_tmProp==="object"?exam_tmProp:{};
  const om=exam_omProp&&typeof exam_omProp==="object"?exam_omProp:{};
  const examsWithData = useMemo(() => {
    const classIds = (settings.classes || []).map((c) => String(c.id || "")).filter(Boolean);
    const discovered = new Set();
    const addFromKey = (key) => {
      const k = String(key || "");
      for (const classId of classIds) {
        const marker = `_${classId}_`;
        const idx = k.indexOf(marker);
        if (idx > 0) {
          const examName = k.slice(0, idx).trim();
          if (examName) discovered.add(examName);
          break;
        }
      }
    };
    Object.keys(tm || {}).forEach(addFromKey);
    Object.keys(om || {}).forEach(addFromKey);
    return discovered.size ? Array.from(discovered) : exams;
  }, [tm, om, settings.classes]);
  const gtm=(e,c,s)=>tm[`${e}_${c}_${s}`]||"";
  const stm=(e,c,s,v)=>{ if(!setExamMarks) return; setExamMarks(prevTM=>({...prevTM,[`${e}_${c}_${s}`]:v}),null); };
  const gom=(e,c,id,s)=>om[`${e}_${c}_${id}_${s}`]||"";
  const som=(e,c,id,s,v)=>{ const totalM=parseFloat(gtm(e,c,s)),n=parseFloat(v); if(v!==""&&(n<0||(!isNaN(totalM)&&n>totalM))) return; if(!setExamMarks) return; setExamMarks(null,prevOM=>({...prevOM,[`${e}_${c}_${id}_${s}`]:v})); };
  const calc=(e,c,id)=>{ let tot=0,obt=0; subjs(c).forEach(s=>{const t=parseFloat(gtm(e,c,s)),o=parseFloat(gom(e,c,id,s)); if(!isNaN(t))tot+=t; if(!isNaN(o))obt+=o;}); return {tot,obt,pct:tot>0?((obt/tot)*100).toFixed(1):"—"}; };
  const passThreshold=Number(settings.passPercent)||50;
  /** Letter grade: must align with Pass % — below threshold is always F; above uses A+…D bands. */
  const grade=(p)=>{ const n=parseFloat(p); if(isNaN(n))return "—"; if(n<passThreshold)return "F"; if(n>=80)return "A+"; if(n>=70)return "A"; if(n>=60)return "B"; if(n>=50)return "C"; if(n>=40)return "D"; return "D"; };
  const getClassTeacher=(classId)=>{
    if(!classId) return "";
    const cell=getTT(timetable||{},classId,"Monday",0);
    return cell.teacher||"";
  };

  const sanitizeMarksSheetName=(s)=>String(s||"").replace(/[\]:*?/\\]/g,"_").slice(0,31);
  const normalizeHeader=(s)=>String(s||"").trim().toLowerCase().replace(/\s+/g," ");

  const exportMarksTemplateExcel = async () => {
    if(!settings?.classes?.length){ alert("No classes found in settings."); return; }
    await yieldToMain();
    const wb=XLSX.utils.book_new();
    for (const cls of settings.classes) {
      await yieldToMain();
      const classId=cls.id;
      const subjects=subjs(classId);
      const header=["Adm#","Roll#","Student Name","Father's Name",...subjects];
      // Row 2: total marks row — first 4 cells label, then one total per subject
      const totalRow=["Total Marks","","","",...subjects.map(s=>gtm(exam,classId,s)||"")];
      const studentRows=cs(classId)
        .slice()
        .sort((a,b)=>String(a.rollNo||"").localeCompare(String(b.rollNo||""),undefined,{numeric:true,sensitivity:"base"}))
        .map(st=>[st.admissionNo||"",st.rollNo||"",st.name||"",st.fatherName||"",...subjects.map(s=>gom(exam,classId,st.id,s)||"")]);
      const ws=XLSX.utils.aoa_to_sheet([header,totalRow,...studentRows]);
      const sheetName=sanitizeMarksSheetName(formatClassDisplay(cls)||cls.id||"Class");
      XLSX.utils.book_append_sheet(wb,ws,sheetName);
    }
    const safeExam=String(exam||"Marks").replace(/\s/g,"_");
    const safeSession=String(currentSession||"").replace(/\s/g,"_");
    await downloadExcel(wb,`Marks_${safeExam}${safeSession?`_${safeSession}`:""}.xlsx`);
  };

  const importMarksFromExcel=(e)=>{
    const f=e.target.files?.[0];
    if(!f) return;
    if(!setExamMarks){ alert("Marks import is not available."); return; }
    parseWorkbook(f,(err,sheets)=>{
      if(err){ alert("Failed to read Excel file: "+err.message); return; }
      const classSheets=Array.isArray(sheets?.ClassSheets)?sheets.ClassSheets:[];
      if(!classSheets.length){ alert("No class-wise sheets found in this file."); return; }

      const allClasses=settings.classes||[];
      const headerTokens=(h)=>normalizeHeader(String(h||"")).replace(/[^a-z0-9]+/g,"");
      const subjectHeaderMatches=(cell,subj)=>{
        const a=normalizeHeader(String(cell||""));
        const b=normalizeHeader(String(subj||""));
        if(a===b) return true;
        const at=headerTokens(cell);
        const bt=headerTokens(subj);
        if(!at||!bt) return false;
        return at===bt||at.includes(bt)||bt.includes(at);
      };
      const findClassForSheet=(sheetName)=>{
        const target=normalizeHeader(sanitizeMarksSheetName(sheetName));
        const byDisplay=allClasses.find(c=>{
          const label=sanitizeMarksSheetName(formatClassDisplay(c)||c.id||"");
          return normalizeHeader(label)===target;
        });
        if(byDisplay) return byDisplay;
        const byResolve=resolveClass(allClasses,sheetName);
        if(byResolve) return byResolve;
        const m=String(sheetName||"").match(/(?:class|grade)?\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-_ ]\s*([a-z]))?/i);
        if(m){
          const gradeNum=String(parseInt(m[1],10));
          const sec=(m[2]||"").toUpperCase();
          const byGrade=allClasses.filter(c=>{
            const g=String(c.grade||"").trim();
            const gm=g.match(/\d{1,2}/);
            return gm&&String(parseInt(gm[0],10))===gradeNum;
          });
          if(sec){
            const hit=byGrade.find(c=>String(c.section||"").trim().toUpperCase()===sec);
            if(hit) return hit;
          }
          if(byGrade.length>=1) return byGrade[0];
        }
        return null;
      };
      const findMarksHeaderRowIndex=(rows)=>{
        const scan=Math.min(rows.length,12);
        let best={idx:0,score:-1};
        for(let i=0;i<scan;i++){
          const hdr=rows[i]||[];
          const hNorm=hdr.map(normalizeHeader);
          const hasAdm=hNorm.some(h=>h==="adm#"||h.includes("adm"));
          const hasRoll=hNorm.some(h=>h==="roll#"||h.includes("roll"));
          const hasName=hNorm.some(h=>h==="name"||h.includes("student"));
          const score=(hasAdm?1:0)+(hasRoll?1:0)+(hasName?1:0);
          if(score>best.score) best={idx:i,score};
        }
        return best.score>=2?best.idx:0;
      };
      const buildSubjectColumns=(headerRow,subjects,fixedEnd)=>{
        if(!subjects.length) return {cols:[],err:"No subjects in Settings for this class."};
        const subjStart=fixedEnd+1;
        const strictOk=subjects.every((s,i)=>{
          const cell=headerRow[subjStart+i];
          return subjectHeaderMatches(cell,s);
        });
        if(strictOk) return {cols:subjects.map((s,i)=>({subj:s,idx:subjStart+i})),err:null};
        const used=new Set();
        const cols=[];
        for(const subj of subjects){
          let found=-1;
          for(let ci=fixedEnd+1;ci<headerRow.length;ci++){
            if(used.has(ci)) continue;
            if(subjectHeaderMatches(headerRow[ci],subj)){ found=ci; break; }
          }
          if(found<0) return {cols:null,err:`Subject column not found for "${subj}". Check spelling matches Settings → class subjects.`};
          used.add(found);
          cols.push({subj,idx:found});
        }
        return {cols,err:null};
      };

      const importedMarks={};
      const importedTotals={};
      const errors=[];
      let updates=0;

      classSheets.forEach(sh=>{
        const rows=sh.rows;
        if(!Array.isArray(rows)||rows.length<2) return;
        const cls=findClassForSheet(sh.name);
        if(!cls){ errors.push(`Sheet "${sh.name}": could not match to any class.`); return; }
        const classId=cls.id;
        const subjects=subjs(classId);
        const headerRowIdx=findMarksHeaderRowIndex(rows);
        const header=rows[headerRowIdx]||[];
        const hNorm=header.map(normalizeHeader);
        const admIdx=hNorm.findIndex(h=>h==="adm#"||h.includes("adm"));
        const rollIdx=hNorm.findIndex(h=>h==="roll#"||h.includes("roll"));
        const nameIdx=hNorm.findIndex(h=>h==="name"||h.includes("student"));
        const fatherIdx=hNorm.findIndex(h=>h.includes("father"));
        if(rollIdx===-1&&admIdx===-1){
          errors.push(`Sheet "${sh.name}": header must include Adm# or Roll#.`); return;
        }
        if(nameIdx===-1){ errors.push(`Sheet "${sh.name}": header must include Student Name.`); return; }
        const idxsForEnd=[admIdx,rollIdx,nameIdx].filter(i=>i>=0);
        if(fatherIdx>=0) idxsForEnd.push(fatherIdx);
        const fixedEnd=Math.max(...idxsForEnd);
        const {cols:subjectCols,err:subjErr}=buildSubjectColumns(header,subjects,fixedEnd);
        if(subjErr||!subjectCols){
          errors.push(`Sheet "${sh.name}": ${subjErr||"subject columns error"}`); return;
        }

        // Row after header: only treat as total-marks row when first cell mentions "total" (empty first cell used to skip real student rows).
        let dataStartRow=headerRowIdx+1;
        if(rows.length>dataStartRow){
          const row2=rows[dataStartRow]||[];
          const firstCell=normalizeHeader(String(row2[0]||""));
          if(firstCell.includes("total")){
            subjectCols.forEach(({subj,idx})=>{
              const raw=row2[idx];
              const n=parseMarksImportCell(raw);
              if(n!==null&&n>0) importedTotals[`${exam}_${classId}_${subj}`]=String(n);
            });
            dataStartRow++;
          }
        }

        const studentsInClass=cs(classId);
        const sortedStudents=studentsInClass.slice().sort((a,b)=>String(a.rollNo||"").localeCompare(String(b.rollNo||""),undefined,{numeric:true,sensitivity:"base"}));
        const byAdm=new Map(); const byRoll=new Map(); const byName=new Map();
        sortedStudents.forEach(st=>{
          const an=String(st.admissionNo||"").trim(); if(an) byAdm.set(an,st);
          const rn=String(st.rollNo||"").trim(); if(rn) byRoll.set(rn,st);
          byName.set(normalizeHeader(st.name||""),st);
        });
        for(let r=dataStartRow;r<rows.length;r++){
          const row=rows[r]||[];
          const adm=admIdx>=0?String(row[admIdx]||"").trim():"";
          const roll=rollIdx>=0?String(row[rollIdx]||"").trim():"";
          const rowName=nameIdx>=0?normalizeHeader(String(row[nameIdx]||"").trim()):"";
          if(!adm&&!roll&&!rowName) continue;
          const st=byAdm.get(adm)||byRoll.get(roll)||(rowName?byName.get(rowName):null);
          if(!st){ errors.push(`Sheet "${sh.name}" row ${r+1}: student "${adm||roll||rowName}" not found.`); continue; }
          subjectCols.forEach(({subj,idx})=>{
            const raw=row[idx];
            const n=parseMarksImportCell(raw);
            if(n===null) return;
            if(n<0){ errors.push(`Sheet "${sh.name}" row ${r+1}: marks cannot be negative (${roll||adm||rowName} / ${subj}).`); return; }
            const total=parseFloat(importedTotals[`${exam}_${classId}_${subj}`]||gtm(exam,classId,subj));
            if(!Number.isNaN(total)&&total>0&&n>total){ errors.push(`Sheet "${sh.name}" row ${r+1}: marks ${n} exceed total ${total} (${roll||adm||rowName} / ${subj}).`); return; }
            importedMarks[`${exam}_${classId}_${st.id}_${subj}`]=String(n);
            updates++;
          });
        }
      });

      const hasTotals=Object.keys(importedTotals).length>0;
      if(updates>0||hasTotals) startTransition(()=>{
        setExamMarks(
          hasTotals?prevTM=>({...prevTM,...importedTotals}):null,
          updates>0?prevOM=>({...prevOM,...importedMarks}):null
        );
      });
      if(errors.length){
        const preview=errors.slice(0,12).join("\n");
        alert(`Imported marks updates: ${updates}\nErrors: ${errors.length}\n\nFirst errors:\n${preview}`);
      }else if(updates>0||hasTotals){
        alert(`Imported successfully. Marks updated: ${updates}${hasTotals?" (including total marks row).":""}`);
      }else{
        alert("No marks were imported. Check sheet names match your classes, the header row includes Adm#/Roll# and Student Name, and subject columns match Settings.");
      }
      if(e?.target) e.target.value="";
    });
  };
  const exportMarksPdf=async()=>{
    const subjects=subjs(selCls);
    if(!subjects.length){ alert("No subjects defined for this class."); return; }
    const cls=settings.classes.find(c=>c.id===selCls);
    const clsName=cls?formatClassDisplay(cls):selCls;
    const dateStr=new Date().toLocaleDateString("en-PK",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
    const timeStr=new Date().toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"});
    // Sort students by obtained marks descending (position order)
    const ranked=cs(selCls).map(s=>{const {obt,tot,pct}=calc(exam,selCls,s.id);return{s,obt,tot,pct};}).sort((a,b)=>b.obt-a.obt);
    let pos=0;
    ranked.forEach((row,i)=>{if(i===0||row.obt!==ranked[i-1].obt)pos++;row.pos=pos;});
    const margin=5;
    const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
    const pageW=doc.internal.pageSize.getWidth();
    // ── Header ──
    let y=margin;
    const hdr=await addPdfBrandingLogoRow(doc,settings?.logo,margin,y);
    doc.setFontSize(13); doc.setFont(undefined,"bold");
    doc.text(settings?.schoolName||"School Name",hdr.textX,y+7);
    doc.setFontSize(10); doc.setFont(undefined,"normal");
    doc.text(`Class: ${clsName}   |   Examination: ${exam}`,hdr.textX,y+14);
    doc.setFontSize(9); doc.setTextColor(80,80,80);
    doc.text(`Date: ${dateStr}`,pageW-margin,y+7,{align:"right"});
    doc.text(`Time: ${timeStr}`,pageW-margin,y+14,{align:"right"});
    doc.setTextColor(0,0,0);
    y=hdr.tableStartY;
    // ── Table ──
    const head=[["Pos","Adm#","Roll#","Student Name","Father's Name",...subjects,"Total","Marks","Pct%"]];
    const body=ranked.map(({s,obt,tot,pct,pos:p})=>{
      const allTot=subjects.reduce((acc,sb)=>{const t=parseFloat(gtm(exam,selCls,sb));return acc+(isNaN(t)?0:t);},0);
      return[
        String(p),
        s.admissionNo||"",
        s.rollNo||"",
        s.name||"",
        s.fatherName||"",
        ...subjects.map(sb=>gom(exam,selCls,s.id,sb)||"—"),
        `${obt}/${allTot||"—"}`,
        String(obt||0),
        tot>0?`${pct}%`:"—",
      ];
    });
    autoTable(doc,{
      head,body,startY:y,theme:"grid",
      headStyles:{fillColor:[26,58,107],textColor:[255,255,255],fontStyle:"bold",halign:"center",fontSize:8,cellPadding:2},
      bodyStyles:{halign:"center",fontSize:8,cellPadding:2,overflow:"linebreak"},
      columnStyles:{3:{halign:"left"},4:{halign:"left"}},
      styles:{lineWidth:0.2,lineColor:[0,0,0]},
      alternateRowStyles:{fillColor:[248,250,252]},
      margin:{left:margin,right:margin},
    });
    const safeExam=String(exam||"Marks").replace(/\s/g,"_");
    doc.save(`Marks_${safeExam}_${sanitizeMarksSheetName(clsName)}.pdf`);
  };

  const subjectStat=(mode,classId,studentId,subj)=>{
    let tot=0,obt=0;
    if(mode==="overall"){
      examsWithData.forEach(e=>{
        const t=parseFloat(gtm(e,classId,subj));
        const o=parseFloat(gom(e,classId,studentId,subj));
        if(!isNaN(t)) tot+=t;
        if(!isNaN(o)) obt+=o;
      });
    }else{
      const t=parseFloat(gtm(mode,classId,subj));
      const o=parseFloat(gom(mode,classId,studentId,subj));
      if(!isNaN(t)) tot=t;
      if(!isNaN(o)) obt=o;
    }
    let pctStr="—",gradeStr="—",status="—";
    if(tot>0){
      const pct=(obt/tot)*100;
      pctStr=pct.toFixed(1);
      gradeStr=grade(pctStr);
      status=pct>=passThreshold?"PASS":"FAIL";
    }
    return {obt,tot,pctStr,gradeStr,status};
  };
  const overallStat=(mode,classId,studentId)=>{
    let tot=0,obt=0;
    subjs(classId).forEach(subj=>{
      const s=subjectStat(mode,classId,studentId,subj);
      tot+=s.tot;
      obt+=s.obt;
    });
    let pctStr="—",gradeStr="—",status="—";
    if(tot>0){
      const pct=(obt/tot)*100;
      pctStr=pct.toFixed(1);
      gradeStr=grade(pctStr);
      status=pct>=passThreshold?"PASS":"FAIL";
    }
    return {obt,tot,pctStr,gradeStr,status};
  };
  const presentExamsForCard=(mode,classId,studentId)=>{
    if(mode!=="overall") return [String(mode||"").trim()].filter(Boolean);
    const subjects=subjs(classId);
    const matches=examsWithData.filter(ex=>{
      return subjects.some(subj=>{
        const t=parseFloat(gtm(ex,classId,subj));
        const o=parseFloat(gom(ex,classId,studentId,subj));
        return !isNaN(t)||!isNaN(o);
      });
    });
    return matches.length?matches:examsWithData;
  };
  const extractGradeNumber = (cls) => {
    if (!cls) return null;
    const raw = String(cls.grade || formatClassDisplay(cls) || "").trim();
    const m = raw.match(/\d{1,2}/);
    if (!m) return null;
    const n = parseInt(m[0], 10);
    return Number.isNaN(n) ? null : n;
  };
  const getNextPromotionClassOptions = (classId) => {
    const current = resolveClass(settings.classes, classId);
    if (!current) return [];
    const curGrade = extractGradeNumber(current);
    if (curGrade == null) return [];
    const targetGrade = curGrade + 1;
    const targetPool = (settings.classes || []).filter((c) => extractGradeNumber(c) === targetGrade);
    if (!targetPool.length) return [];
    const curSection = String(current.section || "").trim().toUpperCase();
    const sameSection = curSection ? targetPool.find((c) => String(c.section || "").trim().toUpperCase() === curSection) : null;
    if (sameSection) return [sameSection, ...targetPool.filter((c) => c.id !== sameSection.id)];
    return targetPool;
  };
  const getSelectedPromotionClass = (student) => {
    const options = getNextPromotionClassOptions(selCls);
    if (!options.length) return null;
    const selectedId = promotionTargetByStudent[student.id];
    if (selectedId) {
      const hit = options.find((c) => c.id === selectedId);
      if (hit) return hit;
    }
    if (options.length === 1) return options[0];
    return null;
  };
  const promoteStudentToNextClass = (student) => {
    if (!setStudents) {
      alert("Student promotion is not available.");
      return;
    }
    const nextClass = getSelectedPromotionClass(student);
    if (!nextClass) {
      const options = getNextPromotionClassOptions(selCls);
      if (options.length > 1) alert("Please select a section before promotion.");
      else alert("Next class not found for promotion.");
      return;
    }
    setStudents((prev) => {
      let nextRoll = maxRollInClass(prev, settings.classes, nextClass.id, settings.commonTeachers);
      return prev.map((st) => {
        if (st.id !== student.id) return st;
        nextRoll += 1;
        return {
          ...st,
          classId: nextClass.id,
          rollNo: String(nextRoll),
          personalInfoLockSession: currentSession || null,
          personalInfoHistory: Array.isArray(st.personalInfoHistory) ? st.personalInfoHistory : [],
          promotionInfo: {
            promotedAt: new Date().toISOString(),
            promotedExam: exam,
            fromClassId: selCls,
            toClassId: nextClass.id,
          },
        };
      });
    });
    alert(`${student.name || "Student"} promoted to ${formatClassDisplay(nextClass)}.`);
  };
  const renderResultCard=(st,classId,mode,cardRef)=>{
    const cls=settings.classes.find(c=>c.id===classId);
    const className=cls?formatClassDisplay(cls):"";
    const classTeacher=getClassTeacher(classId);
    const o=overallStat(mode,classId,st.id);
    const sortedByObt=cs(classId).map(s=>({s,...overallStat(mode,classId,s.id)})).sort((a,b)=>b.obt-a.obt);
    let pos=0;
    sortedByObt.forEach((row,i)=>{ if(i===0||row.obt!==sortedByObt[i-1].obt) pos++; row.position=pos; });
    const myPosition=sortedByObt.find(r=>r.s.id===st.id)?.position??"—";
    const detailRows=[["Name",st.name],["Father",st.fatherName],["Class",className],["Roll No",st.rollNo],["Adm No",st.admissionNo],["Position",String(myPosition)],["Pass %",o.pctStr==="—"?"—":o.pctStr+"%"],["Result",o.status]];
    const presentExams=presentExamsForCard(mode,classId,st.id);
    const examLabel=mode==="overall"
      ?(presentExams.length?presentExams.join(" + "):"Overall")
      :String(mode||"—");
    const marksColLabel=mode==="overall"&&presentExams.length>1
      ?presentExams.join(" + ")
      :"Marks";
    const sessionLabel=String(currentSession||"").trim()||academicSession();
    const promoBanner=settings.banner;
    const resultSigSrc=settings.resultCardSignature||signImg;
    const stampLine1=(String(settings.resultCardStampLine1||"").trim()||String(settings.principalName||"").trim()||"Principal / Headmaster");
    const stampLine2=(String(settings.resultCardStampLine2||"").trim()||String(settings.schoolName||"").trim());
    return <div key={st.id} className="result-card-page-wrap" style={{maxWidth:736,margin:"0 auto 28px",padding:"0 10px",boxSizing:"border-box",pageBreakAfter:"always",page:"resultCard"}}>
      <div id={cardRef?"result-card":undefined} ref={cardRef} className="result-card-capture-root" style={{position:"relative",background:"transparent"}}>
      {/* Real borders (not box-shadow) so html2canvas / PDF capture shows green + red frame */}
      <div className="result-card-border-outer" style={{border:`6px solid ${C.red}`,borderRadius:14,boxSizing:"border-box",width:"100%",background:C.red}}>
      <div className="result-card-border-inner" style={{position:"relative",padding:36,background:"#fff",border:`5px solid ${C.green}`,borderRadius:8,boxSizing:"border-box",...(RESULT_CARD_BORDER_URL?{backgroundImage:`url(${RESULT_CARD_BORDER_URL})`,backgroundRepeat:"no-repeat",backgroundPosition:"center",backgroundSize:"contain"}:{}),...(promoBanner?{}:{minHeight:990})}}>
      <ResultCardHeader
        settings={settings}
        sessionLabel={sessionLabel}
        examLabel={examLabel}
        className={className}
      />
      <div style={{display:"flex",gap:18,marginBottom:14,alignItems:"flex-start"}}>
        <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 20px",alignContent:"start"}}>{detailRows.map(([k,v])=>(
          <div key={k} style={{display:"flex",gap:8,fontSize:13,alignItems:"baseline",minWidth:0}}><span style={{fontWeight:700,minWidth:72,flexShrink:0,color:"#374151"}}>{k}:</span><span style={k==="Result"?{fontWeight:700,color:v==="PASS"?C.green:v==="FAIL"?C.red:C.gray,wordBreak:"break-word"}:{wordBreak:"break-word"}}>{v}</span></div>
        ))}</div>
        <div style={{width:80,height:100,border:"2px solid #d1d5db",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",background:"#f3f4f6"}}>
          {st.photo?<img src={st.photo} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:10,color:C.gray,textAlign:"center"}}>Photo</span>}
        </div>
      </div>
      <div style={{overflowX:"auto"}}><table style={{borderCollapse:"collapse",fontSize:12,width:"100%",background:"#fff"}}>
        <thead>
          <tr style={{background:C.navy,color:"#fff"}}>
            <th style={{padding:"5px 8px"}}>Subject</th>
            <th style={{padding:"5px 8px",textAlign:"center"}}>{marksColLabel}</th>
            <th style={{padding:"5px 8px",textAlign:"center"}}>Pass %</th>
            <th style={{padding:"5px 8px",textAlign:"center"}}>Grade</th>
            <th style={{padding:"5px 8px",textAlign:"center"}}>Result</th>
          </tr>
        </thead>
        <tbody>
          {subjs(classId).map((subj,i)=>{
            const s=subjectStat(mode,classId,st.id,subj);
            return <tr key={subj} style={{background:i%2===0?"#f9fafb":"#fff"}}>
              <td style={{padding:"5px 8px",fontWeight:600}}>{subj}</td>
              <td style={{padding:"5px 8px",textAlign:"center"}}>{s.tot>0?`${s.obt}/${s.tot}`:"—"}</td>
              <td style={{padding:"5px 8px",textAlign:"center"}}>{s.pctStr==="—"?"—":`${s.pctStr}%`}</td>
              <td style={{padding:"5px 8px",textAlign:"center"}}>{s.gradeStr}</td>
              <td style={{padding:"5px 8px",textAlign:"center",fontWeight:700,color:s.status==="PASS"?C.green:s.status==="FAIL"?C.red:C.gray}}>{s.status}</td>
            </tr>;
          })}
          {(()=>{const o=overallStat(mode,classId,st.id);return (
            <tr style={{background:"#dbeafe",fontWeight:700}}>
              <td style={{padding:"5px 8px"}}>Overall</td>
              <td style={{padding:"5px 8px",textAlign:"center"}}>{o.tot>0?`${o.obt}/${o.tot}`:"—"}</td>
              <td style={{padding:"5px 8px",textAlign:"center"}}>{o.pctStr==="—"?"—":`${o.pctStr}%`}</td>
              <td style={{padding:"5px 8px",textAlign:"center"}}>{o.gradeStr}</td>
              <td style={{padding:"5px 8px",textAlign:"center",fontWeight:700,color:o.status==="PASS"?C.green:o.status==="FAIL"?C.red:C.gray}}>{o.status}</td>
            </tr>
          );})()}
        </tbody>
      </table></div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:50,paddingTop:12,borderTop:"1px solid #e5e7eb"}}>
        <div style={{textAlign:"center"}}><div style={{borderTop:"1px solid #374151",paddingTop:4,fontSize:11,width:130}}>{classTeacher||"Class Teacher"}</div></div>
        <div style={{textAlign:"center", position:"relative"}}>
          <img src={resultSigSrc} style={{width:130, position:"absolute", top:-60, left:"50%", transform:"translateX(-50%)"}} alt="Signature"/>
          <div style={{borderTop:"1px solid #374151",paddingTop:4,fontSize:10,width:180,fontWeight:600}}>
            {stampLine1}
            {stampLine2 ? <><br/>{stampLine2}</> : null}
          </div>
        </div>
      </div>
      {promoBanner ? (
        <div
          className="result-card-promo-banner"
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid #e5e7eb",
            width: "100%",
            boxSizing: "border-box",
            lineHeight: 0,
          }}
        >
          <img
            src={promoBanner}
            alt=""
            style={{
              display: "block",
              width: "100%",
              maxWidth: "100%",
              height: "auto",
              borderRadius: 6,
              objectFit: "contain",
              objectPosition: "center top",
            }}
          />
        </div>
      ) : null}
      </div>
      </div>
      </div>
    </div>;
  };
  const requestClassPdfExport=()=>{
    const list=sortStudentsByRoll(cs(rcCls));
    if(!list.length){ alert("No students in this class to export."); return; }
    setClassPdfBusy(true);
    setClassPdfExportList(list);
  };

  const exportSingleResultCardPdf=async()=>{
    if(!rcCls||!String(rcRoll||"").trim()){
      alert("Select a class and roll number first.");
      return;
    }
    const st=cs(rcCls).find(s=>String(s.rollNo)===String(rcRoll));
    if(!st){
      alert("Student not found for this roll number.");
      return;
    }
    const el=resultCardRef.current;
    if(!el){
      alert("Result card is not ready. Wait a moment and try again.");
      return;
    }
    setSinglePdfBusy(true);
    try{
      await new Promise((r)=>requestAnimationFrame(r));
      const canvas=await html2canvas(el,{
        scale:RESULT_CARD_PDF_H2C_SCALE,
        backgroundColor:"#ffffff",
        useCORS:true,
        logging:false,
        foreignObjectRendering:false,
      });
      const imgData=canvas.toDataURL("image/jpeg",RESULT_CARD_PDF_JPEG_Q);
      const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
      const pageW=doc.internal.pageSize.getWidth();
      const pageH=doc.internal.pageSize.getHeight();
      const margin=10;
      const maxW=pageW-2*margin;
      const maxH=pageH-2*margin;
      const iw=canvas.width;
      const ih=canvas.height;
      const ratio=Math.min(maxW/iw,maxH/ih);
      const w=iw*ratio;
      const h=ih*ratio;
      const x=margin+(maxW-w)/2;
      const y=margin+(maxH-h)/2;
      doc.addImage(imgData,"JPEG",x,y,w,h);
      const clsObj=settings.classes.find(c=>c.id===rcCls);
      const clsName=clsObj?formatClassDisplay(clsObj):"Class";
      const safeCls=clsName.replace(/\s+/g,"_").replace(/[^\w-]+/g,"")||"Class";
      const safeRoll=String(st.rollNo??rcRoll??"").replace(/\s+/g,"_").replace(/[^\w-]+/g,"")||"Roll";
      doc.save(`ResultCard_${safeCls}_Roll_${safeRoll}.pdf`);
    }catch(e){
      console.error(e);
      alert("PDF export failed.");
    }finally{
      setSinglePdfBusy(false);
    }
  };

  useEffect(()=>{
    if(!classPdfExportList?.length) return undefined;
    let cancelled=false;
    const h2cOpts={
      scale:RESULT_CARD_PDF_H2C_SCALE,
      backgroundColor:"#ffffff",
      useCORS:true,
      logging:false,
      foreignObjectRendering:false,
    };
    const run=async()=>{
      await new Promise((r)=>requestAnimationFrame(r));
      if(cancelled) return;
      const container=classResultPdfContainerRef.current;
      if(!container){
        setClassPdfExportList(null);
        setClassPdfBusy(false);
        return;
      }
      const roots=container.querySelectorAll(".result-card-capture-root");
      if(!roots.length){
        if(!cancelled) alert("No result cards found for export.");
        setClassPdfExportList(null);
        setClassPdfBusy(false);
        return;
      }
      try{
        const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
        const pageW=doc.internal.pageSize.getWidth();
        const pageH=doc.internal.pageSize.getHeight();
        const margin=10;
        const maxW=pageW-2*margin;
        const maxH=pageH-2*margin;
        const rootArr=Array.from(roots);
        const canvases=[];
        for(let b=0;b<rootArr.length;b+=CLASS_PDF_H2C_CONCURRENCY){
          if(cancelled) return;
          const slice=rootArr.slice(b,b+CLASS_PDF_H2C_CONCURRENCY);
          const batch=await Promise.all(slice.map((node)=>html2canvas(node,h2cOpts)));
          canvases.push(...batch);
        }
        for(let i=0;i<canvases.length;i++){
          if(cancelled) return;
          const canvas=canvases[i];
          const imgData=canvas.toDataURL("image/jpeg",RESULT_CARD_PDF_JPEG_Q);
          const iw=canvas.width;
          const ih=canvas.height;
          const ratio=Math.min(maxW/iw,maxH/ih);
          const w=iw*ratio;
          const h=ih*ratio;
          const x=margin+(maxW-w)/2;
          const y=margin+(maxH-h)/2;
          if(i>0) doc.addPage();
          doc.addImage(imgData,"JPEG",x,y,w,h);
        }
        if(cancelled) return;
        const clsObj=settings.classes.find(c=>c.id===rcCls);
        const clsName=clsObj?formatClassDisplay(clsObj):"Class";
        const safeClsRaw=clsName.replace(/\s+/g,"_").replace(/[^\w-]+/g,"");
        const safeCls=safeClsRaw||"Class";
        const examPart=rcExam==="overall"?"Overall":String(rcExam||"Exam").replace(/\s+/g,"_");
        doc.save(`ResultCards_${safeCls}_${examPart}.pdf`);
      }catch(e){
        console.error(e);
        if(!cancelled) alert("Class PDF export failed.");
      }finally{
        if(!cancelled){
          setClassPdfExportList(null);
          setClassPdfBusy(false);
        }
      }
    };
    void run();
    return()=>{ cancelled=true; };
    // Intentionally only classPdfExportList: avoid re-running when settings/rc* identity changes mid-export.
  },[classPdfExportList]);

  useEffect(()=>{
    if(!setBarSubtitle) return;
    const t=EXAM_TABS.find(x=>x.id===tab);
    setBarSubtitle(t?.l||"");
  },[tab,setBarSubtitle]);

  return <div>
    <div className="no-print">
    <div style={{display:"flex",gap:6,marginBottom:14}}>{EXAM_TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"7px 16px",borderRadius:5,border:"none",background:tab===t.id?C.navy:"#e5e7eb",color:tab===t.id?"#fff":"#374151",fontWeight:600,cursor:"pointer",fontSize:13}}>{t.l}</button>)}</div></div>

    {tab==="admission"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <p style={{fontSize:13,color:C.gray,margin:0}}>Fill the form below to admit a new student. After saving, the student will appear in Student Record.</p>
        <Btn small outline onClick={()=>{ const el=document.getElementById("admission-form-print"); if(!el){ alert("Print area not found."); return; } const printWindow=window.open("","","width=800,height=600"); if(!printWindow){ alert("Please allow pop-ups to print."); return; } const style="body{font-family:'Segoe UI',sans-serif;margin:12px;padding:0}"; printWindow.document.write("<html><head><title>Admission Form</title><style>"+style+"</style></head><body>"); printWindow.document.write(el.innerHTML); printWindow.document.write("</body></html>"); printWindow.document.close(); printWindow.focus(); printWindow.print(); printWindow.onafterprint=()=>printWindow.close(); }}>Print</Btn>
      </div>
      <div id="admission-form-print" style={{maxWidth:640,margin:"0 auto"}}>
        <SchoolHeader settings={settings} subtitle="ADMISSION FORM"/>
        <div style={{background:"#fff",borderRadius:8,border:"1px solid #e5e7eb",padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",marginTop:12}}>
          <div style={{display:"flex",gap:16,alignItems:"flex-start",marginBottom:14}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,flexShrink:0}}>
              <div style={{width:80,height:100,border:"2px dashed #d1d5db",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",background:"#fafafa"}}>
                {admissionPhotoBusy?<span style={{fontSize:10,color:C.gray,textAlign:"center",padding:4}}>Processing…</span>:admissionForm.photo?<img src={admissionForm.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:10,color:C.gray,textAlign:"center"}}>Photo</span>}
              </div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"center"}}>
                <Btn type="button" small outline onClick={()=>admissionPhotoGalleryRef.current?.click()} disabled={admissionPhotoBusy}>Gallery</Btn>
                <Btn type="button" small outline onClick={()=>admissionPhotoCameraRef.current?.click()} disabled={admissionPhotoBusy}>Camera</Btn>
              </div>
              <input ref={admissionPhotoGalleryRef} type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];if(!f)return;e.target.value="";await handleAdmissionPhotoFile(f);}}/>
              <input ref={admissionPhotoCameraRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];if(!f)return;e.target.value="";await handleAdmissionPhotoFile(f);}}/>
            </div>
            <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Inp label="Admission No" value={admissionForm.admissionNo} onChange={v=>setAdmissionForm(x=>({...x,admissionNo:v}))} placeholder={"Next: "+suggestedNextAdm}/>
              <Inp label="Roll No" value={admissionForm.rollNo} onChange={v=>setAdmissionForm(x=>({...x,rollNo:v}))} placeholder={"Next in class: "+suggestedNextRoll}/>
              <Inp label="Student Name" value={admissionForm.name} onChange={v=>setAdmissionForm(x=>({...x,name:toProperCaseNameInput(v)}))}/>
              <Inp label="Father's Name" value={admissionForm.fatherName} onChange={v=>setAdmissionForm(x=>({...x,fatherName:toProperCaseNameInput(v)}))}/>
              <Inp label="Form B / Bay Form" value={admissionForm.bayForm} onChange={v=>setAdmissionForm(x=>({...x,bayForm:formatCnicAf(v)}))} placeholder="00000-0000000-0"/>
              <Inp label="Father's CNIC" value={admissionForm.fatherCnic} onChange={v=>setAdmissionForm(x=>({...x,fatherCnic:formatCnicAf(v)}))} placeholder="00000-0000000-0"/>
              <Inp label="WhatsApp No" value={admissionForm.whatsapp} onChange={v=>setAdmissionForm(x=>({...x,whatsapp:formatWhatsappAf(v)}))} placeholder="0000-0000000"/>
              <Sel label="Class" value={admissionForm.classId} onChange={v=>setAdmissionForm(x=>({...x,classId:v}))} options={settings.classes.map(c=>({value:c.id,label:formatClassDisplay(c)}))}/>
              <Inp label="Date of Birth" value={admissionForm.dob} onChange={v=>setAdmissionForm(x=>({...x,dob:formatDobAf(v)}))} placeholder="dd/mm/yyyy"/>
            </div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn onClick={saveAdmission}>Save & Admit Student</Btn></div>
        </div>
      </div>
    </div>}
    {tab==="record"&&<StudentsPage settings={settings} students={students} setStudents={setStudents} embedded currentSession={currentSession} currentUser={currentUser}/>}
    {tab==="marks"&&<div>
      <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap",alignItems:"flex-end"}}>
        <Sel label="Exam" value={exam} onChange={setExam} options={exams}/>
        <Sel label="Class" value={selCls} onChange={setSelCls} options={settings.classes.map(c=>({value:c.id,label:formatClassDisplay(c)}))}/>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <Btn small outline onClick={() => void exportMarksTemplateExcel()}>📊 Export Excel</Btn>
          <Btn small outline onClick={()=>{const inp=document.createElement("input");inp.type="file";inp.accept=".xlsx,.xls";inp.style.display="none";document.body.appendChild(inp);inp.onchange=(ev)=>{importMarksFromExcel(ev);document.body.removeChild(inp);};inp.click();}} disabled={!setExamMarks}>📥 Import Excel</Btn>
          <Btn small outline onClick={()=>exportMarksPdf().catch(()=>alert("PDF export failed."))}>📄 PDF</Btn>
        </div>
      </div>
      <div ref={marksTableRef} style={{overflowX:"auto",maxHeight:"70vh"}}><table style={{borderCollapse:"collapse",fontSize:12}}>
        <thead>
          <tr style={{background:C.navy,color:"#fff"}}>
            {["Adm#","Roll#","Student Name","Father's Name",...subjs(selCls),"Total"].map(h=><th key={h} style={{padding:"7px 8px",whiteSpace:"nowrap",position:"sticky",top:0,zIndex:3,background:C.navy}}>{h}</th>)}
          </tr>
          <tr style={{background:"#e8edf8"}}>
            <th colSpan={4} style={{padding:"5px 8px",fontWeight:700,fontSize:11,color:"#000",position:"sticky",top:34,zIndex:2,background:"#e8edf8"}}>Total Marks {"->"}</th>
            {subjs(selCls).map(s=><td key={s} style={{padding:"3px 3px",position:"sticky",top:34,zIndex:2,background:"#e8edf8"}}><MarksInput initialValue={gtm(exam,selCls,s)} onSave={v=>stm(exam,selCls,s,v)} rowIdx={-1} colIdx={-1} totalRows={0} totalCols={0} inputStyle={{border:"1.5px solid #1a3a6b",background:"#dbeafe"}}/></td>)}
            <td></td>
          </tr>
        </thead>
        <tbody>{(()=>{const students_=cs(selCls).slice().sort((a,b)=>{const r=String(a.rollNo||"").localeCompare(String(b.rollNo||""),undefined,{numeric:true,sensitivity:"base"});return r!==0?r:String(a.admissionNo||"").localeCompare(String(b.admissionNo||""),undefined,{numeric:true,sensitivity:"base"});});const subjects_=subjs(selCls);const totalRows=students_.length;const totalCols=subjects_.length;return students_.map((s,i)=>{const {obt,tot}=calc(exam,selCls,s.id);return(<tr key={s.id} style={{background:i%2===0?"#f9fafb":"#fff"}}>
          <td style={{padding:"5px 8px"}}>{s.admissionNo}</td><td style={{padding:"5px 8px",fontWeight:700}}>{s.rollNo}</td><td style={{padding:"5px 8px"}}>{s.name}</td><td style={{padding:"5px 8px"}}>{s.fatherName}</td>
          {subjects_.map((subj,sIdx)=><td key={subj} style={{padding:"3px 3px"}}><MarksInput initialValue={gom(exam,selCls,s.id,subj)} onSave={v=>som(exam,selCls,s.id,subj,v)} rowIdx={i} colIdx={sIdx} totalRows={totalRows} totalCols={totalCols}/></td>)}
          <td style={{padding:"5px 8px",textAlign:"center",fontWeight:700}}>{obt}/{tot||"—"}</td>
        </tr>);});})()}</tbody>
      </table></div>
    </div>}

    {tab==="consolidated"&&<div>
      <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap",alignItems:"flex-end"}}>
        <Sel label="Exam" value={exam} onChange={setExam} options={exams}/>
        <Sel label="Class" value={selCls} onChange={setSelCls} options={settings.classes.map(c=>({value:c.id,label:formatClassDisplay(c)}))}/>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <Btn small outline onClick={()=>{ const {headers,rows}=getTableDataFromElement(consolidatedTableRef.current); if(!headers.length&&!rows.length){ alert("No data to export."); return; } const clsName=getClassLabel(settings, selCls); const safeCls=sanitizeMarksSheetName(clsName||"Class"); void exportConsolidatedSheetToPdf(settings,currentSession,exam,clsName,headers,rows,`Consolidated_${String(exam||"").replace(/\s/g,"_")}_${safeCls}.pdf`).catch(()=>alert("PDF export failed.")); }}>📄 PDF</Btn>
        </div>
      </div>
      <div ref={consolidatedTableRef} style={{overflowX:"auto",maxHeight:"70vh"}}><table style={{borderCollapse:"collapse",fontSize:12,width:"100%"}}>
        <thead>
          <tr style={{background:C.navy,color:"#fff"}}>{["Photo","Adm#","Roll#","Student Name","Father's Name",...subjs(selCls),"Total","%","Status","Grade","Position"].map(h=><th key={h} style={{padding:"6px 8px",whiteSpace:"nowrap",position:"sticky",top:0,zIndex:3,background:C.navy}}>{h}</th>)}</tr>
          <tr style={{background:"#e8edf8"}}>
            <th colSpan={5} style={{padding:"5px 8px",fontWeight:700,fontSize:11,textAlign:"right",color:"#000",position:"sticky",top:34,zIndex:2,background:"#e8edf8"}}>Total Marks {"->"}</th>
            {subjs(selCls).map(s=><td key={s} style={{padding:"5px 8px",textAlign:"center",fontWeight:700,color:"#000",position:"sticky",top:34,zIndex:2,background:"#e8edf8"}}>{gtm(exam,selCls,s)||"—"}</td>)}
            <th colSpan={5} style={{position:"sticky",top:34,zIndex:2,background:"#e8edf8"}}></th>
          </tr>
        </thead>
        <tbody>{(()=>{
          const sorted=cs(selCls).map(s=>({s,...calc(exam,selCls,s.id)})).sort((a,b)=>b.obt-a.obt);
          let pos=0;
          return sorted.map((row,i)=>{
            if(i===0||row.obt!==sorted[i-1].obt) pos++;
            const {s,obt,tot,pct}=row;
            const pctNum=parseFloat(pct);
            const passFail=Number.isNaN(pctNum)?"—":(pctNum>=passThreshold?"Pass":"Fail");
            const passFailColor=Number.isNaN(pctNum)?C.gray:(pctNum>=passThreshold?C.green:C.red);
            return <tr key={s.id} style={{background:i%2===0?"#f9fafb":"#fff"}}>
              <td style={{padding:4,verticalAlign:"middle"}}><div style={{width:36,height:44,border:"1px solid #d1d5db",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",background:"#f3f4f6"}}>{s.photo?<img src={s.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:9,color:C.gray}}>Photo</span>}</div></td>
              <td style={{padding:"5px 8px"}}>{s.admissionNo}</td><td style={{padding:"5px 8px",fontWeight:700}}>{s.rollNo}</td><td style={{padding:"5px 8px"}}>{s.name}</td>
              <td style={{padding:"5px 8px"}}>{s.fatherName}</td>
              {subjs(selCls).map(subj=><td key={subj} style={{padding:"5px 8px",textAlign:"center"}}>{gom(exam,selCls,s.id,subj)||"—"}</td>)}
              <td style={{padding:"5px 8px",fontWeight:700,textAlign:"center"}}>{obt}/{tot||"—"}</td>
              <td style={{padding:"5px 8px",textAlign:"center"}}>{pct}%</td>
              <td style={{padding:"5px 8px",textAlign:"center",fontWeight:700,color:passFailColor}}>{passFail}</td>
              <td style={{padding:"5px 8px",textAlign:"center",fontWeight:700,color:parseFloat(pct)>=passThreshold?C.green:C.red}}>{grade(pct)}</td>
              <td style={{padding:"5px 8px",textAlign:"center",fontWeight:700}}>
                <div>{pos}</div>
                {passFail==="Pass" && (
                  <div style={{marginTop:4,display:"grid",gap:4,justifyItems:"center"}}>
                    {(() => {
                      const options = getNextPromotionClassOptions(selCls);
                      const selected = promotionTargetByStudent[s.id] || "";
                      if (options.length > 1) {
                        return (
                          <select
                            value={selected}
                            onChange={(e)=>setPromotionTargetByStudent(prev=>({...prev,[s.id]:e.target.value}))}
                            style={{padding:"2px 4px",fontSize:11,border:"1px solid #cbd5e1",borderRadius:4,background:"#fff",minWidth:120}}
                          >
                            <option value="">Select section</option>
                            {options.map((c)=><option key={c.id} value={c.id}>{formatClassDisplay(c)}</option>)}
                          </select>
                        );
                      }
                      return null;
                    })()}
                    <button
                      type="button"
                      onClick={() => promoteStudentToNextClass(s)}
                      style={{padding:"2px 7px",fontSize:11,border:"1px solid #86efac",borderRadius:4,background:"#f0fdf4",color:"#166534",cursor:"pointer",fontWeight:700}}
                    >
                      Promote
                    </button>
                  </div>
                )}
              </td>
            </tr>;
          });
        })()}</tbody>
      </table></div>
    </div>}

    {tab==="card"&&<div>
      <div className="no-print" style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap",alignItems:"flex-end"}}>
        <Sel label="Class" value={rcCls} onChange={setRcCls} options={settings.classes.map(c=>({value:c.id,label:formatClassDisplay(c)}))}/>
        <Sel label="Exam" value={rcExam} onChange={setRcExam} options={[{value:"overall",label:"Overall (All Terms)"},...exams.map(e=>({value:e,label:e}))]}/>
        <div style={{display:"flex",flexDirection:"column",gap:3}}>
          <label style={{fontSize:11,fontWeight:700,color:C.gray,textTransform:"uppercase",letterSpacing:0.4}}>Pass %</label>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={settings.passPercent ?? 50}
              onChange={e=>{
                const v=Number(e.target.value);
                if(!isNaN(v)&&v>=0&&v<=100&&setSettings) setSettings(s=>({...s,passPercent:v}));
              }}
              style={{padding:"6px 10px",border:"1.5px solid #d1d5db",borderRadius:5,fontSize:13,background:"#fff",width:72,boxSizing:"border-box"}}
            />
            <span style={{fontSize:13,color:C.gray,fontWeight:600}}>%</span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",gap:6}}>
          <button
            type="button"
            onClick={()=>{
              const list=cs(rcCls);
              const rolls=list
                .map(s=>parseInt(s.rollNo,10))
                .filter(n=>!isNaN(n))
                .sort((a,b)=>a-b);
              if(!rolls.length){ setRcRoll(""); return; }
              const min=rolls[0];
              const max=rolls[rolls.length-1];
              const cur=parseInt(rcRoll||"",10);
              if(isNaN(cur)){ setRcRoll(String(max)); return; }
              const next=Math.max(min,cur-1);
              setRcRoll(String(next));
            }}
            style={{border:"1px solid #d1d5db",background:"#fff",borderRadius:4,padding:"6px 8px",cursor:"pointer",fontSize:13}}
          >
            ←
          </button>
          <Inp label="Roll No" value={rcRoll} onChange={setRcRoll} placeholder="Enter Roll No"/>
          <button
            type="button"
            onClick={()=>{
              const list=cs(rcCls);
              const rolls=list
                .map(s=>parseInt(s.rollNo,10))
                .filter(n=>!isNaN(n))
                .sort((a,b)=>a-b);
              if(!rolls.length){ setRcRoll(""); return; }
              const min=rolls[0];
              const max=rolls[rolls.length-1];
              const cur=parseInt(rcRoll||"",10);
              if(isNaN(cur)){ setRcRoll(String(min)); return; }
              const next=Math.min(max,cur+1);
              setRcRoll(String(next));
            }}
            style={{border:"1px solid #d1d5db",background:"#fff",borderRadius:4,padding:"6px 8px",cursor:"pointer",fontSize:13}}
          >
            →
          </button>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,paddingTop:16}}>
          <Btn
            small
            outline
            disabled={singlePdfBusy||classPdfBusy||!String(rcRoll||"").trim()}
            onClick={()=>void exportSingleResultCardPdf()}
          >
            {singlePdfBusy?"⏳ PDF…":"📄 PDF"}
          </Btn>
          <Btn small disabled={classPdfBusy||singlePdfBusy} onClick={requestClassPdfExport}>
            {classPdfBusy?"⏳ Class PDF…":"📄 Class PDF"}
          </Btn>
        </div>
      </div>
      {rcRoll&&(()=>{const st=cs(rcCls).find(s=>s.rollNo===rcRoll); if(!st) return <div style={{color:C.red,padding:16}}>Student not found for Roll No: {rcRoll}</div>;
        return <div className="result-card-print-area">{renderResultCard(st,rcCls,rcExam,resultCardRef)}</div>;
      })()}
      {classPdfExportList?.length ? (
        <div
          ref={classResultPdfContainerRef}
          aria-hidden
          className="class-result-cards-pdf-source"
          style={{position:"fixed",left:-99999,top:0,width:720,pointerEvents:"none"}}
        >
          {classPdfExportList.map((st)=>renderResultCard(st,rcCls,rcExam))}
        </div>
      ) : null}
    </div>}

    {tab==="datesheet"&&<div>
      <div className="no-print" style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap",alignItems:"flex-end"}}>
        <Sel label="Exam" value={exam} onChange={setExam} options={exams}/>
        <Btn onClick={()=>setDsDates(rows=>[...rows,{id:genId(),date:new Date().toISOString().split("T")[0]}])}>+ Add Date</Btn>
        <Btn outline danger disabled={dsDates.length<=1} onClick={()=>setDsDates(rows=>rows.length>1?rows.slice(0,-1):rows)}>Remove Date</Btn>
        <Btn outline onClick={()=>setDsCols(cols=>[...cols,{id:genId(),classId:""}])}>+ Add Class Column</Btn>
        <Btn outline danger disabled={dsCols.length<=1} onClick={()=>setDsCols(cols=>cols.length>1?cols.slice(0,-1):cols)}>Remove Class Column</Btn>
      </div>
      <div ref={datesheetTableRef} style={{overflowX:"auto",maxHeight:"70vh",background:"#fff",padding:12,borderRadius:8,border:"1px solid #9ca3af"}}>
        <table className="datesheet-table" style={{borderCollapse:"collapse",fontSize:12,minWidth:0,margin:"0 auto"}}>
          <thead>
            <tr style={{background:C.navy,color:"#fff",textAlign:"center"}}>
              <th style={{padding:"4px 6px",border:"1px solid #000",minWidth:70,width:70,height:32,textAlign:"center",position:"sticky",top:0,zIndex:3,background:C.navy}}>Date</th>
              <th style={{padding:"4px 6px",border:"1px solid #000",minWidth:70,width:70,height:32,textAlign:"center",position:"sticky",top:0,zIndex:3,background:C.navy}}>Day</th>
              {dsCols.map(col=>{
                const usedIds=dsCols.filter(c=>c.id!==col.id).map(c=>c.classId).filter(Boolean);
                return <th key={col.id} style={{padding:"4px 6px",border:"1px solid #000",minWidth:70,width:70,height:32,textAlign:"center",position:"sticky",top:0,zIndex:3,background:C.navy}}>
                  <select
                    value={col.classId}
                    onChange={e=>{
                      const v=e.target.value;
                      setDsCols(cols=>cols.map(c=>c.id===col.id?{...c,classId:v}:c));
                    }}
                    style={{width:"100%",padding:"3px 4px",border:"1px solid #d1d5db",borderRadius:4,fontSize:11,textAlign:"center"}}
                  >
                    <option value="">— Select class —</option>
                    {settings.classes
                      .filter(cls=>!usedIds.includes(cls.id)||cls.id===col.classId)
                      .map(cls=><option key={cls.id} value={cls.id}>{formatClassDisplay(cls)}</option>)}
                  </select>
                </th>;
              })}
            </tr>
          </thead>
          <tbody>
            {dsDates.map(row=>{
              const dObj=row.date?new Date(row.date):null;
              const dayName=dObj&& !isNaN(dObj) ? dObj.toLocaleDateString("en-PK",{weekday:"long"}) : "";
              return <tr key={row.id}>
                <td style={{padding:"6px 8px",border:"1px solid #000",minWidth:70,width:70,height:32,textAlign:"center"}}>
                  <input
                    type="date"
                    value={row.date}
                    onChange={e=>setDsDates(rs=>rs.map(r=>r.id===row.id?{...r,date:e.target.value}:r))}
                    style={{width:"100%",padding:"2px 3px",border:"1px solid #d1d5db",borderRadius:4,fontSize:10,boxSizing:"border-box",textAlign:"center"}}
                  />
                </td>
                <td style={{padding:"6px 8px",border:"1px solid #000",fontWeight:700,minWidth:70,width:70,height:32,textAlign:"center"}}>{dayName}</td>
                {dsCols.map(col=>{
                  const cid=col.classId;
                  const key=`${row.id}_${col.id}`;
                  const current=dsSubs[key]||"";
                  const allSubs=cid?getClassSubjects(settings,cid,"exam"):[];
                  const usedSubs=dsDates
                    .map(r=>dsSubs[`${r.id}_${col.id}`])
                    .filter(s=>s && s!==current);
                  const options=allSubs.filter(s=>!usedSubs.includes(s));
                  return <td key={key} style={{padding:"6px 8px",border:"1px solid #000",minWidth:70,width:70,height:32,textAlign:"center"}}>
                    <select
                      value={current}
                      onChange={e=>{
                        const v=e.target.value;
                        setDsSubs(prev=>({...prev,[key]:v}));
                      }}
                      disabled={!cid}
                      style={{width:"100%",padding:"2px 3px",border:"1px solid #d1d5db",borderRadius:4,fontSize:10,background:cid?"#fff":"#f3f4f6",opacity:cid?1:0.7,textAlign:"center"}}
                    >
                      <option value="">---</option>
                      {options.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>;
                })}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <div style={{marginTop:12}}>
        <label style={{fontSize:11,fontWeight:700,color:C.gray,display:"block",marginBottom:4}}>Note / Instructions</label>
        <textarea
          value={dsNote}
          onChange={e=>setDsNote(e.target.value)}
          rows={3}
          style={{width:"100%",padding:"6px 8px",border:"1.5px solid #d1d5db",borderRadius:6,fontSize:12,resize:"vertical",boxSizing:"border-box"}}
          placeholder="Write important instructions for students (e.g. reporting time, allowed materials, etc.)"
        />
      </div>
    </div>}
  </div>;
}

// ─── PAPER GENERATOR ─────────────────────────────────────────────────────────
const PAPER_TYPES=[{id:"regular",label:"Regular Paper"},{id:"english",label:"English Medium Paper"},{id:"urdu",label:"Urdu Medium Paper"},{id:"englishLang",label:"English Language Paper"},{id:"urduLang",label:"Urdu Language Paper"},{id:"autoPaper",label:"Auto Paper Generator"}];
function PaperGeneratorPage({settings,questionBank,setQuestionBank,setBarSubtitle}){
  const [paperType,setPaperType]=useState("regular");
  const [selCls,setSelCls]=useState(settings.classes[0]?.id||"");
  const [subj,setSubj]=useState("");
  const [exam,setExam]=useState("Annual");
  const [time,setTime]=useState(180);
  const [preview,setPreview]=useState(false);
  const [printPaperMode,setPrintPaperMode]=useState(false);
  useEffect(()=>{
    if(printPaperMode)document.body.classList.add("printing-paper");
    else document.body.classList.remove("printing-paper");
    return ()=>document.body.classList.remove("printing-paper");
  },[printPaperMode]);
  useEffect(()=>{
    const onAfter=()=>setPrintPaperMode(false);
    window.addEventListener("afterprint",onAfter);
    return ()=>window.removeEventListener("afterprint",onAfter);
  },[]);
  const [sections,setSections]=useState([
    {id:1,title:"Section A – Objective",type:"MCQs",marks:20,instructions:"",questions:[{id:genId(),text:"",options:["","","",""],correct:0}]},
    {id:2,title:"Section B – Short Questions",type:"Short",marks:40,instructions:"",questions:[{id:genId(),text:""}]},
    {id:3,title:"Section C – Long Questions",type:"Long",marks:40,instructions:"",questions:[{id:genId(),text:""}]},
  ]);
  const subs=getClassSubjects(settings,selCls,"exam");
  useEffect(()=>{
    const nextSubs=getClassSubjects(settings,selCls,"exam");
    if(!nextSubs.length) return;
    queueMicrotask(()=>setSubj(nextSubs[0]));
  },[selCls, settings]);
  const currentClsObj = useMemo(()=>settings.classes.find(c=>c.id===selCls), [settings.classes, selCls]);
  const isCommonSubj = useMemo(()=>{
    if(!currentClsObj || !subj) return false;
    return !!(settings.commonTeachers?.[currentClsObj.grade]?.[subj]);
  }, [settings.commonTeachers, currentClsObj, subj]);

  const bankByClassSubj=questionBank&&typeof questionBank==="object"?questionBank:{};
  
  const bankForCurrent = useMemo(() => {
    if(!subj) return [];
    if(isCommonSubj && currentClsObj) {
      const g = currentClsObj.grade;
      return (bankByClassSubj["common"]?.[g]?.[subj]) || [];
    }
    return (bankByClassSubj[selCls]?.[subj]) || [];
  }, [bankByClassSubj, selCls, subj, isCommonSubj, currentClsObj]);
  const setBankForCurrent = (list) => {
    if (!Array.isArray(list)) return;
    setQuestionBank(prev => {
      const next = { ...prev };
      if (isCommonSubj && currentClsObj) {
        const g = currentClsObj.grade;
        if (!next["common"]) next["common"] = {};
        if (!next["common"][g]) next["common"][g] = {};
        next["common"][g] = { ...next["common"][g], [subj]: list };
      } else {
        if (!next[selCls]) next[selCls] = {};
        next[selCls] = { ...next[selCls], [subj]: list };
      }
      return next;
    });
  };
  const _addBankQuestion=(type)=>{
    const q={id:genId(),text:"",type:type};
    if(type==="MCQs") q.options=["","","",""],q.correct=0;
    setBankForCurrent([...bankForCurrent,q]);
  };
  const _updateBankQuestion=(qid,field,value)=>{
    setBankForCurrent(bankForCurrent.map(q=>q.id===qid?{...q,[field]:value}:q));
  };
  const _removeBankQuestion=(qid)=>setBankForCurrent(bankForCurrent.filter(q=>q.id!==qid));
  const [autoPaperSubPage,setAutoPaperSubPage]=useState("dashboard"); // "dashboard" | "planning" | "upload"
  useEffect(()=>{
    if(!setBarSubtitle) return;
    const base=PAPER_TYPES.find(x=>x.id===paperType)?.label||"Paper";
    if(paperType==="autoPaper"){
      const sub=autoPaperSubPage==="dashboard"?"Dashboard":autoPaperSubPage==="upload"?"Import":"Planning";
      setBarSubtitle(`${base} · ${sub}`);
    }else{
      setBarSubtitle(base);
    }
  },[paperType,autoPaperSubPage,setBarSubtitle]);
  const [qbSearch, setQbSearch] = useState("");
  const [qbFilterType, setQbFilterType] = useState("all");
  const [qbFilterDifficulty, setQbFilterDifficulty] = useState("all");
  const [qbFilterChapter, setQbFilterChapter] = useState("all");
  const [qbFilterTopic, setQbFilterTopic] = useState("all");
  const [qbPage, setQbPage] = useState(1);
  const itemsPerPage = 8;

  // States for paper planning
  const [genPercentMcq, setGenPercentMcq] = useState("");
  const [genPercentShort, setGenPercentShort] = useState("");
  const [genPercentLong, setGenPercentLong] = useState("");
  const [genChapter, setGenChapter] = useState("all");
  const [genTopic, setGenTopic] = useState("all");

  // Excel Preview State
  const [excelPreview, setExcelPreview] = useState(null);

  const bankMcq=bankForCurrent.filter(q=>q.type==="MCQs");
  const bankShort=bankForCurrent.filter(q=>q.type==="Short");
  const bankLong=bankForCurrent.filter(q=>q.type==="Long");

  const chapters = useMemo(() => {
    const set = new Set(bankForCurrent.map(q => q.chapter).filter(Boolean));
    return Array.from(set).sort();
  }, [bankForCurrent]);

  const topics = useMemo(() => {
    const list = qbFilterChapter === "all" ? bankForCurrent : bankForCurrent.filter(q => q.chapter === qbFilterChapter);
    const set = new Set(list.map(q => q.topic).filter(Boolean));
    return Array.from(set).sort();
  }, [bankForCurrent, qbFilterChapter]);

  const genTopics = useMemo(() => {
    const list = genChapter === "all" ? bankForCurrent : bankForCurrent.filter(q => q.chapter === genChapter);
    const set = new Set(list.map(q => q.topic).filter(Boolean));
    return Array.from(set).sort();
  }, [bankForCurrent, genChapter]);

  const filteredQb = useMemo(() => {
    return bankForCurrent.filter(q => {
      const matchType = qbFilterType === "all" || q.type === qbFilterType;
      const matchDifficulty = qbFilterDifficulty === "all" || q.difficulty === qbFilterDifficulty;
      const matchChapter = qbFilterChapter === "all" || q.chapter === qbFilterChapter;
      const matchTopic = qbFilterTopic === "all" || q.topic === qbFilterTopic;
      const matchSearch = !qbSearch || (q.text || "").toLowerCase().includes(qbSearch.toLowerCase());
      return matchType && matchDifficulty && matchChapter && matchTopic && matchSearch;
    });
  }, [bankForCurrent, qbFilterType, qbFilterDifficulty, qbFilterChapter, qbFilterTopic, qbSearch]);

  const paginatedQb = filteredQb.slice((qbPage - 1) * itemsPerPage, qbPage * itemsPerPage);
  const totalQbPages = Math.ceil(filteredQb.length / itemsPerPage);

  const handleExcelFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx")) {
      alert("Please upload a .xlsx file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const result = { mcqs: [], short: [], long: [] };
        if (workbook.SheetNames.includes("MCQs")) {
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets["MCQs"]);
          result.mcqs = rows.map(r => ({
            id: genId(), type: "MCQs",
            chapter: String(r.Chapter || r.chapter || ""),
            topic: String(r.Topic || r.topic || ""),
            text: String(r.Question || r.question || ""),
            options: [String(r["Option A"]||""), String(r["Option B"]||""), String(r["Option C"]||""), String(r["Option D"]||"")],
            correct: ["A","B","C","D"].indexOf(String(r["Correct Answer"]||"A").toUpperCase()),
            difficulty: String(r.Difficulty || "Medium")
          }));
        }
        if (workbook.SheetNames.includes("Short Questions")) {
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets["Short Questions"]);
          result.short = rows.map(r => ({
            id: genId(), type: "Short",
            chapter: String(r.Chapter || ""), topic: String(r.Topic || ""),
            text: String(r.Question || ""), ans: String(r.Answer || "")
          }));
        }
        if (workbook.SheetNames.includes("Long Questions")) {
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets["Long Questions"]);
          result.long = rows.map(r => ({
            id: genId(), type: "Long",
            chapter: String(r.Chapter || ""), topic: String(r.Topic || ""),
            text: String(r.Question || ""), ans: String(r.Answer || "")
          }));
        }
        setExcelPreview(result);
      } catch (err) { alert("Error parsing Excel: " + err.message); }
    };
    reader.readAsBinaryString(file);
  };

  const advancedGenerateFromBank = () => {
    const pool = bankForCurrent.filter(q => (genChapter === "all" || q.chapter === genChapter) && (genTopic === "all" || q.topic === genTopic));
    const pMcq = pool.filter(q => q.type === "MCQs"), pShort = pool.filter(q => q.type === "Short"), pLong = pool.filter(q => q.type === "Long");
    const getC = (p, s) => { if (!s) return p.length; const v = parseFloat(s); return isNaN(v) ? p.length : Math.floor((v/100) * p.length); };
    const pick = (arr, n) => { const c = [...arr], o = []; for (let i = 0; i < n && c.length; i++) o.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]); return o; };
    const cMcq = getC(pMcq, genPercentMcq), cShort = getC(pShort, genPercentShort), cLong = getC(pLong, genPercentLong);
    const rdMcq = pick(pMcq, cMcq), rdShort = pick(pShort, cShort), rdLong = pick(pLong, cLong);
    setSections([
      { id: 1, title: "Section A – Objective", type: "MCQs", marks: rdMcq.length, instructions: "Choose the correct option.", questions: rdMcq.map(q => ({ id: genId(), text: q.text, options: q.options || ["", "", "", ""], correct: q.correct || 0 })) },
      { id: 2, title: "Section B – Short Questions", type: "Short", marks: rdShort.length * 2, instructions: "Answer briefly.", questions: rdShort.map(q => ({ id: genId(), text: q.text })) },
      { id: 3, title: "Section C – Long Questions", type: "Long", marks: rdLong.length * 5, instructions: "Answer in detail.", questions: rdLong.map(q => ({ id: genId(), text: q.text })) },
    ]);
    setPreview(true);
  };

  const handleExportExcel = async () => {
    if (!bankForCurrent.length) {
      alert("No questions to export.");
      return;
    }
    await yieldToMain();
    const clsLabel = getClassLabel(settings, selCls);
    const mcqs = bankForCurrent.filter(q => q.type === "MCQs").map(q => ({
      Class: clsLabel, Subject: subj, Chapter: q.chapter || "", Topic: q.topic || "", Question: q.text || "",
      "Option A": q.options?.[0] || "", "Option B": q.options?.[1] || "", "Option C": q.options?.[2] || "", "Option D": q.options?.[3] || "",
      "Correct Answer": ["A", "B", "C", "D"][q.correct] || "A", Difficulty: q.difficulty || "Medium"
    }));
    const short = bankForCurrent.filter(q => q.type === "Short").map(q => ({
      Class: clsLabel, Subject: subj, Chapter: q.chapter || "", Topic: q.topic || "", Question: q.text || "", Answer: q.ans || ""
    }));
    const long = bankForCurrent.filter(q => q.type === "Long").map(q => ({
      Class: clsLabel, Subject: subj, Chapter: q.chapter || "", Topic: q.topic || "", Question: q.text || "", Answer: q.ans || ""
    }));
    const wb = XLSX.utils.book_new();
    const addSheet = (data, name, template) => {
      const ws = XLSX.utils.json_to_sheet(data.length ? data : [template]);
      XLSX.utils.book_append_sheet(wb, ws, name);
    };
    addSheet(mcqs, "MCQs", {Class:"", Subject:"", Chapter:"", Topic:"", Question:"", "Option A":"", "Option B":"", "Option C":"", "Option D":"", "Correct Answer":"", Difficulty:""});
    addSheet(short, "Short Questions", {Class:"", Subject:"", Chapter:"", Topic:"", Question:"", Answer:""});
    addSheet(long, "Long Questions", {Class:"", Subject:"", Chapter:"", Topic:"", Question:"", Answer:""});
    await downloadExcel(wb, `Question_Bank_${subj}_${clsLabel.replace(/\s+/g, "_")}.xlsx`);
  };

  const handleDownloadTemplate = async () => {
    await yieldToMain();
    const wb = XLSX.utils.book_new();
    const headersMcq = [["Chapter", "Topic", "Question", "Option A", "Option B", "Option C", "Option D", "Correct Answer (A/B/C/D)", "Difficulty (Easy/Medium/Hard)"]];
    const headersShort = [["Chapter", "Topic", "Question", "Answer"]];
    const headersLong = [["Chapter", "Topic", "Question", "Answer"]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(headersMcq), "MCQs");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(headersShort), "Short Questions");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(headersLong), "Long Questions");
    await downloadExcel(wb, "Question_Bank_Template.xlsx");
  };
  const _generateFromBank=(countMcq,countShort,countLong)=>{
    const pick=(arr,n)=>{ const copy=[...arr]; const out=[]; for(let i=0;i<n&&copy.length;i++){ const j=Math.floor(Math.random()*copy.length); out.push(copy.splice(j,1)[0]); } return out; };
    const mcqPicked=pick(bankMcq,Math.min(countMcq,bankMcq.length));
    const shortPicked=pick(bankShort,Math.min(countShort,bankShort.length));
    const longPicked=pick(bankLong,Math.min(countLong,bankLong.length));
    setSections([
      {id:1,title:"Section A – Objective",type:"MCQs",marks:20,instructions:"",questions:mcqPicked.map(q=>({id:genId(),text:q.text,options:q.options||["","","",""],correct:q.correct!=null?q.correct:0}))},
      {id:2,title:"Section B – Short Questions",type:"Short",marks:40,instructions:"",questions:shortPicked.map(q=>({id:genId(),text:q.text}))},
      {id:3,title:"Section C – Long Questions",type:"Long",marks:40,instructions:"",questions:longPicked.map(q=>({id:genId(),text:q.text}))},
    ]);
    setPreview(true);
  };
  const addQ=(sid)=>setSections(s=>s.map(sec=>sec.id===sid?{...sec,questions:[...sec.questions,{id:genId(),text:"",...(sec.type==="MCQs"?{options:["","","",""],correct:0}:{})}]}:sec));
  const rmQ=(sid,qid)=>setSections(s=>s.map(sec=>sec.id===sid?{...sec,questions:sec.questions.filter(q=>q.id!==qid)}:sec));
  const upQ=(sid,qid,f,v)=>setSections(s=>s.map(sec=>sec.id===sid?{...sec,questions:sec.questions.map(q=>q.id===qid?{...q,[f]:v}:q)}:sec));
  const total=sections.reduce((a,s)=>a+(parseInt(s.marks)||0),0);
  const paperContent=<>
    <SchoolHeader settings={settings} subtitle={`${exam} — ${subj} — Class ${selCls}`}/>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,fontSize:13}}>
      <span>Total Marks: <strong>{total}</strong></span><span>Time: <strong>{time} minutes</strong></span>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,padding:"6px 0",marginBottom:8,fontSize:12}}>
      <span>Name: ___________</span><span>Roll No: ___________</span><span>Date: ___________</span>
    </div>
    <div style={{borderTop:"3px solid #000",marginBottom:14}}/>
    {sections.map((sec,si)=><div key={si} className="paper-section" style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",borderBottom:"1px solid #000",marginBottom:6,fontWeight:700,fontSize:14}}><span>{sec.title}</span><span>Marks: <strong>{sec.marks}</strong></span></div>
      <p style={{fontStyle:"italic",margin:"0 0 8px",fontSize:12}}>{sec.instructions}</p>
      {sec.type==="Short"
        ? (<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",columnGap:20,rowGap:6}}>
            {sec.questions.map((q,qi)=><div key={qi} style={{marginBottom:4}}><p style={{margin:"0 0 2px",fontSize:13}}><strong>Q{qi+1}.</strong> {q.text||"(question)"}</p></div>)}
          </div>)
        : sec.questions.map((q,qi)=><div key={qi} style={{marginBottom:8}}>
            <p style={{margin:"0 0 4px",fontSize:13}}><strong>Q{qi+1}.</strong> {q.text||"(question)"}</p>
            {sec.type==="MCQs"&&q.options&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:2,fontSize:12,marginLeft:16}}>{q.options.map((o,oi)=><span key={oi}>({String.fromCharCode(65+oi)}) {o||`Option ${String.fromCharCode(65+oi)}`}</span>)}</div>}
          </div>)
      }
    </div>)}
    <div style={{textAlign:"center",borderTop:"1px solid #000",paddingTop:8,marginTop:16}}>
      <span style={{fontSize:12,fontStyle:"italic"}}>End of Paper</span>
    </div>
  </>;
  return <div>
    {printPaperMode&&<div className="paper-print-only" style={{position:"absolute",left:"-9999px",top:0,width:"100%",padding:20,fontFamily:(paperType==="urdu"||paperType==="urduLang")?"'Jameel Noori Nastaliq Regular','Jameel Noori Nastaliq',serif":UI.fontHeading,direction:(paperType==="urdu"||paperType==="urduLang")?"rtl":"ltr",textAlign:(paperType==="urdu"||paperType==="urduLang")?"right":"left",fontSize:(paperType==="urdu"||paperType==="urduLang")?14:undefined,boxSizing:"border-box"}}>{paperContent}</div>}
    <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:6,marginBottom:14,width:"100%",boxSizing:"border-box"}}>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,flex:"1 1 auto",alignItems:"center",minWidth:0}}>
        {PAPER_TYPES.map(t=><button key={t.id} onClick={()=>setPaperType(t.id)} style={{padding:"8px 14px",borderRadius:6,border:paperType===t.id?"2px solid "+C.navy:"1px solid #d1d5db",background:paperType===t.id?C.navyL:"#fff",color:paperType===t.id?C.navy:"#374151",fontWeight:paperType===t.id?700:500,fontSize:13,cursor:"pointer"}}>{t.label}</button>)}
      </div>
      {paperType!=="autoPaper"&&<Btn outline onClick={()=>setPreview(true)} style={{flexShrink:0,alignSelf:"center"}}>👁️ Preview</Btn>}
    </div>
    {paperType==="autoPaper" ? (
      <div style={{padding:24,background:"#f9fafb",borderRadius:8,border:"1px solid #e5e7eb"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
          <div>
            <h3 style={{margin:"0 0 4px",color:C.navy,fontSize:18}}>🤖 Question Bank & Auto Paper</h3>
            <p style={{margin:0,color:C.gray,fontSize:13}}>Manage questions chapter-wise and generate papers using smart selection.</p>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button onClick={() => setAutoPaperSubPage("dashboard")} style={{padding:"8px 14px",borderRadius:6,border:autoPaperSubPage==="dashboard"?"none":"1px solid #d1d5db",background:autoPaperSubPage==="dashboard"?C.navy:"#fff",color:autoPaperSubPage==="dashboard"?"#fff":"#374151",fontWeight:600,fontSize:13,cursor:"pointer"}}>📚 Dashboard</button>
            <button onClick={() => setAutoPaperSubPage("upload")} style={{padding:"8px 14px",borderRadius:6,border:autoPaperSubPage==="upload"?"none":"1px solid #d1d5db",background:autoPaperSubPage==="upload"?C.navy:"#fff",color:autoPaperSubPage==="upload"?"#fff":"#374151",fontWeight:600,fontSize:13,cursor:"pointer"}}>📤 Import</button>
            <button onClick={() => setAutoPaperSubPage("planning")} style={{padding:"8px 14px",borderRadius:6,border:autoPaperSubPage==="planning"?"none":"1px solid #d1d5db",background:autoPaperSubPage==="planning"?C.navy:"#fff",color:autoPaperSubPage==="planning"?"#fff":"#374151",fontWeight:600,fontSize:13,cursor:"pointer"}}>📑 Planning</button>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12,marginBottom:20,padding:16,background:"#fff",borderRadius:8,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
          <Sel label="Class" value={selCls} onChange={setSelCls} options={settings.classes.map(c=>({value:c.id,label:formatClassDisplay(c)}))}/>
          <Sel label="Subject" value={subj} onChange={setSubj} options={subs}/>
        </div>

        {!subj ? (
          <div style={{textAlign:"center",padding:40,color:C.gray}}>Select a class and subject to access the bank.</div>
          ) : autoPaperSubPage === "upload" ? (
          <div style={{background:"#fff",padding:24,borderRadius:8,border:"1px solid #e5e7eb"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h4 style={{margin:0,color:C.navy}}>Import from Excel</h4>
              <button type="button" onClick={() => void handleDownloadTemplate()} style={{padding:"6px 14px",borderRadius:6,border:"1px solid "+C.navy,background:"#fff",color:C.navy,fontSize:12,cursor:"pointer"}}>⬇️ Download Template</button>
            </div>
            <div style={{border:"2px dashed #cbd5e1",padding:40,textAlign:"center",borderRadius:12,background:"#f8fafc",marginBottom:20}}>
              <input type="file" accept=".xlsx" onChange={handleExcelFile} style={{display:"none"}} id="qbExcelInput"/>
              <label htmlFor="qbExcelInput" style={{cursor:"pointer"}}>
                <div style={{fontSize:40,marginBottom:10}}>📁</div>
                <div style={{fontWeight:700,color:C.navy}}>Click to upload Excel file</div>
                <div style={{fontSize:12,color:C.gray,marginTop:4}}>Sheets: MCQs, Short Questions, Long Questions</div>
              </label>
            </div>
            {excelPreview && (
              <div>
                <h5 style={{margin:"0 0 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>Preview ({excelPreview.mcqs.length + excelPreview.short.length + excelPreview.long.length} questions)</span>
                  <Btn onClick={()=>{ setBankForCurrent([...bankForCurrent, ...excelPreview.mcqs, ...excelPreview.short, ...excelPreview.long]); setExcelPreview(null); alert("Imported!"); setAutoPaperSubPage("dashboard"); }}>✅ Save to Bank</Btn>
                </h5>
                <div style={{maxHeight:300,overflowY:"auto",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead style={{position:"sticky",top:0,background:"#f1f5f9"}}><tr><th style={{padding:6,textAlign:"left"}}>Type</th><th style={{padding:6,textAlign:"left"}}>Chapter</th><th style={{padding:6,textAlign:"left"}}>Topic</th><th style={{padding:6,textAlign:"left"}}>Question</th></tr></thead>
                    <tbody>
                      {excelPreview.mcqs.map((q,i) => <tr key={i}><td style={{padding:6,borderBottom:"1px solid #f1f5f9"}}>MCQ</td><td style={{padding:6,borderBottom:"1px solid #f1f5f9"}}>{q.chapter}</td><td style={{padding:6,borderBottom:"1px solid #f1f5f9"}}>{q.topic}</td><td style={{padding:6,borderBottom:"1px solid #f1f5f9"}}>{q.text}</td></tr>)}
                      {excelPreview.short.map((q,i) => <tr key={i}><td style={{padding:6,borderBottom:"1px solid #f1f5f9"}}>Short</td><td style={{padding:6,borderBottom:"1px solid #f1f5f9"}}>{q.chapter}</td><td style={{padding:6,borderBottom:"1px solid #f1f5f9"}}>{q.topic}</td><td style={{padding:6,borderBottom:"1px solid #f1f5f9"}}>{q.text}</td></tr>)}
                      {excelPreview.long.map((q,i) => <tr key={i}><td style={{padding:6,borderBottom:"1px solid #f1f5f9"}}>Long</td><td style={{padding:6,borderBottom:"1px solid #f1f5f9"}}>{q.chapter}</td><td style={{padding:6,borderBottom:"1px solid #f1f5f9"}}>{q.topic}</td><td style={{padding:6,borderBottom:"1px solid #f1f5f9"}}>{q.text}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : autoPaperSubPage === "planning" ? (
          <div style={{background:"#fff",padding:24,borderRadius:8,border:"1px solid #e5e7eb"}}>
            <h4 style={{margin:"0 0 16px",color:C.navy}}>Random Selection Planning</h4>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16,marginBottom:20}}>
              <Sel label="Chapter" value={genChapter} onChange={setGenChapter} options={[{value:"all",label:"All Chapters"}, ...chapters.map(c=>({value:c,label:c}))]}/>
              <Sel label="Topic" value={genTopic} onChange={setGenTopic} options={[{value:"all",label:"All Topics"}, ...genTopics.map(t=>({value:t,label:t}))]}/>
            </div>
            <div style={{display:"flex",gap:16,alignItems:"center",padding:20,background:"#f1f5f9",borderRadius:12,marginBottom:24,flexWrap:"wrap"}}>
              <div style={{display:"flex",flexDirection:"column",gap:4}}><label style={{fontSize:11,fontWeight:700,color:C.gray}}>MCQs (%)</label><input type="number" value={genPercentMcq} onChange={e=>setGenPercentMcq(e.target.value)} placeholder="All" style={{padding:8,border:"1px solid #cbd5e1",borderRadius:6,width:70}}/></div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}><label style={{fontSize:11,fontWeight:700,color:C.gray}}>Short (%)</label><input type="number" value={genPercentShort} onChange={e=>setGenPercentShort(e.target.value)} placeholder="All" style={{padding:8,border:"1px solid #cbd5e1",borderRadius:6,width:70}}/></div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}><label style={{fontSize:11,fontWeight:700,color:C.gray}}>Long (%)</label><input type="number" value={genPercentLong} onChange={e=>setGenPercentLong(e.target.value)} placeholder="All" style={{padding:8,border:"1px solid #cbd5e1",borderRadius:6,width:70}}/></div>
              <Btn style={{marginTop:18}} onClick={advancedGenerateFromBank}>🎲 Random Selection & Preview</Btn>
            </div>
            {preview && <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><h5 style={{margin:0}}>Preview</h5><Btn outline onClick={()=>{setPrintPaperMode(true); setTimeout(()=>window.print(),50);}}>🖨️ Print</Btn></div><div style={{padding:24,background:"#fff",border:"2px solid #e2e8f0",borderRadius:8,fontFamily:UI.fontHeading}}>{paperContent}</div></div>}
          </div>
        ) : (
          <div style={{background:"#fff",padding:20,borderRadius:8,border:"1px solid #e5e7eb"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}}>
              <Inp label="Search" value={qbSearch} onChange={v=>{setQbSearch(v); setQbPage(1);}} placeholder="Keyword..."/>
              <Sel label="Type" value={qbFilterType} onChange={v=>{setQbFilterType(v); setQbPage(1);}} options={[{value:"all",label:"All Types"},{value:"MCQs",label:"MCQs"},{value:"Short",label:"Short"},{value:"Long",label:"Long"}]}/>
              <Sel label="Difficulty" value={qbFilterDifficulty} onChange={v=>{setQbFilterDifficulty(v); setQbPage(1);}} options={[{value:"all",label:"All"},{value:"Easy",label:"Easy"},{value:"Medium",label:"Medium"},{value:"Hard",label:"Hard"}]}/>
              <Sel label="Chapter" value={qbFilterChapter} onChange={v=>{setQbFilterChapter(v); setQbPage(1);}} options={[{value:"all",label:"All Chapters"}, ...chapters.map(c=>({value:c,label:c}))]}/>
              <Sel label="Topic" value={qbFilterTopic} onChange={v=>{setQbFilterTopic(v); setQbPage(1);}} options={[{value:"all",label:"All Topics"}, ...topics.map(t=>({value:t,label:t}))]}/>
            </div>
            <div style={{marginBottom:16,display:"flex",gap:8,flexWrap:"wrap"}}>
              <Btn outline onClick={()=>setBankForCurrent([...bankForCurrent, {id:genId(),type:"MCQs",text:"",options:["","","",""],correct:0,chapter:"",topic:"",difficulty:"Medium"}])}>+ MCQ</Btn>
              <Btn outline onClick={()=>setBankForCurrent([...bankForCurrent, {id:genId(),type:"Short",text:"",chapter:"",topic:"",difficulty:"Medium"}])}>+ Short</Btn>
              <Btn outline onClick={()=>setBankForCurrent([...bankForCurrent, {id:genId(),type:"Long",text:"",chapter:"",topic:"",difficulty:"Medium"}])}>+ Long</Btn>
              <button type="button" onClick={() => void handleExportExcel()} style={{marginLeft:"auto",padding:"8px 14px",borderRadius:6,border:"1px solid #10b981",background:"#fff",color:"#10b981",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",gap:6,alignItems:"center"}}><Download size={14}/> Export Excel</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
              {paginatedQb.length===0?<div style={{textAlign:"center",padding:40,color:C.gray}}>No questions found.</div>:paginatedQb.map(q=>(
                <div key={q.id} style={{padding:15,background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <div style={{display:"flex",gap:4}}>
                      <span style={{fontSize:10,fontWeight:700,background:C.navy,color:"#fff",padding:"2px 6px",borderRadius:4}}>{q.type}</span>
                      <span style={{fontSize:10,fontWeight:700,background:q.difficulty==="Hard"?"#ef4444":q.difficulty==="Medium"?"#f59e0b":"#10b981",color:"#fff",padding:"2px 6px",borderRadius:4}}>{q.difficulty || "Medium"}</span>
                    </div>
                    <button onClick={()=>setBankForCurrent(bankForCurrent.filter(x=>x.id!==q.id))} style={{color:C.red,background:"none",border:"none",cursor:"pointer",fontSize:11}}>Delete</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
                    <textarea value={q.text} onChange={e=>setBankForCurrent(bankForCurrent.map(x=>x.id===q.id?{...x,text:e.target.value}:x))} placeholder="Question text..." style={{padding:6,fontSize:12,border:"1px solid #cbd5e1",borderRadius:4,height:60}}/>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:4}}>
                        <Inp label="Chapter" value={q.chapter} onChange={v=>setBankForCurrent(bankForCurrent.map(x=>x.id===q.id?{...x,chapter:v}:x))}/>
                        <Inp label="Topic" value={q.topic} onChange={v=>setBankForCurrent(bankForCurrent.map(x=>x.id===q.id?{...x,topic:v}:x))}/>
                      </div>
                      <Sel label="Difficulty" value={q.difficulty||"Medium"} onChange={v=>setBankForCurrent(bankForCurrent.map(x=>x.id===q.id?{...x,difficulty:v}:x))} options={[{value:"Easy",label:"Easy"},{value:"Medium",label:"Medium"},{value:"Hard",label:"Hard"}]}/>
                    </div>
                  </div>
                  {q.type==="MCQs"&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>{(q.options||["","","",""]).map((o,oi)=><input key={oi} value={o} onChange={e=>{const op=[...(q.options||["","","",""])];op[oi]=e.target.value;setBankForCurrent(bankForCurrent.map(x=>x.id===q.id?{...x,options:op}:x));}} placeholder={`Opt ${String.fromCharCode(65+oi)}`} style={{padding:4,fontSize:11,border:"1px solid #cbd5e1",borderRadius:4}}/>)}</div>}
                </div>
              ))}
            </div>
            {totalQbPages > 1 && <div style={{marginTop:20,display:"flex",justifyContent:"center",gap:8}}>{Array.from({length:totalQbPages},(_,i)=>i+1).map(p=><button key={p} onClick={()=>setQbPage(p)} style={{padding:"4px 10px",borderRadius:4,border:"1px solid #cbd5e1",background:qbPage===p?C.navy:"#fff",color:qbPage===p?"#fff":"#374151",cursor:"pointer"}}>{p}</button>)}</div>}
          </div>
        )}
      </div>
    ) : (
    <>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10,marginBottom:12}}>
      <Sel label="Class" value={selCls} onChange={setSelCls} options={settings.classes.map(c=>({value:c.id,label:formatClassDisplay(c)}))}/>
      <Sel label="Subject" value={subj} onChange={setSubj} options={subs}/>
      <Sel label="Exam" value={exam} onChange={setExam} options={["1st Term","Mid Term","Final Term","Annual"]}/>
      <Inp label="Time (min)" type="number" value={time} onChange={v=>setTime(+v)}/>
    </div>
    <div style={{padding:"6px 12px",background:"#fef3c7",borderRadius:5,fontSize:12,color:"#92400e",fontWeight:700,marginBottom:12,marginTop:6}}>Total Marks: {total}</div>
    {sections.map(sec=><div key={sec.id} style={{border:"1.5px solid #e5e7eb",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
      <div style={{background:C.navy,color:"#fff",padding:"8px 12px",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <input value={sec.title} onChange={e=>setSections(s=>s.map(x=>x.id===sec.id?{...x,title:e.target.value}:x))} style={{background:"transparent",border:"none",color:"#fff",fontSize:13,fontWeight:700,flex:1,outline:"none"}}/>
        <input type="number" value={sec.marks} onChange={e=>setSections(s=>s.map(x=>x.id===sec.id?{...x,marks:+e.target.value}:x))} style={{width:55,padding:"3px 6px",borderRadius:4,border:"none",fontSize:12,textAlign:"center"}}/>
        <span style={{fontSize:11}}>marks</span>
      </div>
      <div style={{padding:10}}>
        <input value={sec.instructions} onChange={e=>setSections(s=>s.map(x=>x.id===sec.id?{...x,instructions:e.target.value}:x))} placeholder="Instructions…" style={{width:"100%",padding:"5px 8px",border:"1px solid #d1d5db",borderRadius:5,fontSize:12,marginBottom:8,boxSizing:"border-box"}}/>
        {sec.questions.map((q,qi)=><div key={q.id} style={{background:"#f9fafb",borderRadius:6,padding:8,marginBottom:6}}>
          <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>
            <span style={{fontWeight:700,color:C.navy,minWidth:22,paddingTop:6,fontSize:12}}>Q{qi+1}.</span>
            <textarea value={q.text} onChange={e=>upQ(sec.id,q.id,"text",e.target.value)} placeholder="Question…" style={{flex:1,padding:"5px 8px",border:"1px solid #d1d5db",borderRadius:5,fontSize:12,resize:"vertical",minHeight:44}}/>
            <Btn small danger onClick={()=>rmQ(sec.id,q.id)}>×</Btn>
          </div>
          {sec.type==="MCQs"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginTop:4,marginLeft:28}}>
            {q.options.map((opt,oi)=><div key={oi} style={{display:"flex",alignItems:"center",gap:4}}>
              <input type="radio" name={`cr_${q.id}`} checked={q.correct===oi} onChange={()=>upQ(sec.id,q.id,"correct",oi)}/>
              <input value={opt} onChange={e=>{const opts=[...q.options];opts[oi]=e.target.value;upQ(sec.id,q.id,"options",opts);}} placeholder={`Opt ${String.fromCharCode(65+oi)}`} style={{flex:1,padding:"3px 6px",border:"1px solid #d1d5db",borderRadius:4,fontSize:11}}/>
            </div>)}
          </div>}
        </div>)}
        <Btn small outline color={C.navy} onClick={()=>addQ(sec.id)}>+ Add Question</Btn>
      </div>
    </div>)}
    </>
    )}
    {preview&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:10,width:"100%",maxWidth:780,maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div className="no-print" style={{background:C.navy,color:"#fff",padding:"12px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontWeight:700}}>Paper Preview</span>
          <button onClick={()=>setPreview(false)} style={{background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{padding:20,fontFamily:(paperType==="urdu"||paperType==="urduLang")?"'Jameel Noori Nastaliq Regular','Jameel Noori Nastaliq',serif":UI.fontHeading,direction:(paperType==="urdu"||paperType==="urduLang")?"rtl":"ltr",textAlign:(paperType==="urdu"||paperType==="urduLang")?"right":"left",fontSize:(paperType==="urdu"||paperType==="urduLang")?14:undefined}}>{paperContent}</div>
      </div>
    </div>}
  </div>;
}

// ─── STUDENTS PAGE ────────────────────────────────────────────────────────────
function StudentsPage({settings:settingsProp,students:studentsProp,setStudents,embedded,currentSession,currentUser}){
  const settings=useMemo(()=>{
    const s=settingsProp||defaultSettings;
    return {
      ...s,
      classes:Array.isArray(s.classes)?s.classes:[],
      classSubjects:(s.classSubjects&&typeof s.classSubjects==="object")?s.classSubjects:{},
      classSubjectsExam:(s.classSubjectsExam&&typeof s.classSubjectsExam==="object")?s.classSubjectsExam:((s.classSubjects&&typeof s.classSubjects==="object")?s.classSubjects:{}),
      classSubjectsTimetable:(s.classSubjectsTimetable&&typeof s.classSubjectsTimetable==="object")?s.classSubjectsTimetable:((s.classSubjects&&typeof s.classSubjects==="object")?s.classSubjects:{})
    };
  },[settingsProp]);
  const students=Array.isArray(studentsProp)?studentsProp:defaultStudents;
  const [showAdd,setShowAdd]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [filterCls,setFilterCls]=useState(()=>settings.classes[0]?.id||"all");
  const [search,setSearch]=useState("");
  const emptyForm={admissionNo:"",rollNo:"",name:"",fatherName:"",classId:settings.classes[0]?.id||"",dob:"",bayForm:"",fatherCnic:"",whatsapp:"",photo:null};
  const [form,setForm]=useState(emptyForm);
  const photoGalleryRef=useRef();
  const photoCameraRef=useRef();
  const photoFileRef=useRef(null);
  const [photoBusy,setPhotoBusy]=useState(false);
  const suggestedFormAdm=useMemo(()=>nextAdmissionNo(students),[students]);
  const suggestedFormRoll=useMemo(()=>nextRollNoForClass(students,settings.classes,form.classId,settings.commonTeachers),[students,settings.classes,form.classId,settings.commonTeachers]);
  const classGradeNum=(classId)=>{
    const cls=resolveClass(settings.classes,classId);
    if(!cls) return null;
    const m=String(cls.grade||formatClassDisplay(cls)||"").match(/\d{1,2}/);
    if(!m) return null;
    const n=parseInt(m[0],10);
    return Number.isNaN(n)?null:n;
  };
  const sectionClassOptions=(classId)=>{
    const g=classGradeNum(classId);
    if(g==null) return [];
    return (settings.classes||[]).filter(c=>classGradeNum(c.id)===g);
  };
  const changeStudentSection=(student,targetClassId)=>{
    if(!setStudents||!student?.id||!targetClassId) return;
    if(resolveClass(settings.classes,student.classId)?.id===resolveClass(settings.classes,targetClassId)?.id) return;
    setStudents(prev=>{
      const others=prev.filter(st=>st.id!==student.id);
      const nextRoll=maxRollInClass(others,settings.classes,targetClassId,settings.commonTeachers)+1;
      return prev.map(st=>st.id===student.id?{...st,classId:targetClassId,rollNo:String(nextRoll)}:st);
    });
  };
  const getNeighborClass=(classId,direction)=>{
    const cur=resolveClass(settings.classes,classId);
    if(!cur) return null;
    const curGrade=classGradeNum(cur.id);
    if(curGrade==null) return null;
    const targetGrade=direction==="up"?curGrade+1:curGrade-1;
    const targetPool=(settings.classes||[]).filter(c=>classGradeNum(c.id)===targetGrade);
    if(!targetPool.length) return null;
    const curSection=String(cur.section||"").trim().toUpperCase();
    const sameSection=curSection?targetPool.find(c=>String(c.section||"").trim().toUpperCase()===curSection):null;
    return sameSection||targetPool[0]||null;
  };
  const moveStudentClass=(student,direction)=>{
    const target=getNeighborClass(student?.classId,direction);
    if(!target){ alert(direction==="up"?"No upper class found.":"No lower class found."); return; }
    changeStudentSection(student,target.id);
  };
  const photosDirRef=useRef(null);
  const matchesClassFilter=(student,classFilter)=>{
    if(classFilter==="all") return true;
    const filterCls=resolveClass(settings.classes,classFilter);
    if(!filterCls) return false;
    const studentCls=resolveClass(settings.classes,student.classId);
    if(studentCls) return filterCls.id===studentCls.id;
    const sid=String(student.classId??"").trim();
    if(sid&&sid===String(filterCls.id).trim()) return true;
    const slabel=sid?String(getClassLabel(settings,sid)).trim().toLowerCase():"";
    const flabel=String(formatClassDisplay(filterCls)||"").trim().toLowerCase();
    if(slabel&&flabel&&slabel===flabel) return true;
    // Grade-only fallback (never parse UUID class ids — first digit was wrong and dropped valid students)
    const gradeFromClassObj=(cls)=>{
      if(!cls) return null;
      const g=String(cls.grade||"").match(/\d{1,2}/)?.[0];
      if(g) return parseInt(g,10);
      const n=String(cls.name||"").match(/\d{1,2}/)?.[0];
      if(n) return parseInt(n,10);
      return null;
    };
    const filterGrade=gradeFromClassObj(filterCls);
    const m=sid.match(/(?:class|grade|cls\.?)?\s*(\d{1,2})(?:\s*[-_ ]\s*([a-z]))?/i);
    const studentGrade=m?parseInt(m[1],10):NaN;
    if(filterGrade!=null&&!isNaN(studentGrade)&&studentGrade===filterGrade){
      if(m[2]){
        const sec=String(filterCls.section||"").trim().toLowerCase();
        return !sec||sec===m[2].toLowerCase();
      }
      return true;
    }
    return false;
  };
  const filtered=students
    .filter(s=>matchesClassFilter(s,filterCls)&&(!search||(String(s.name||"").toLowerCase().includes(search.toLowerCase())||(String(s.admissionNo||"")).includes(search))))
    .sort((a,b)=>{
      const byRoll=String(a.rollNo||"").localeCompare(String(b.rollNo||""),undefined,{numeric:true,sensitivity:"base"});
      if(byRoll!==0) return byRoll;
      return (getClassLabel(settings,a.classId)||"").localeCompare(getClassLabel(settings,b.classId)||"");
    });
  const formatDob=(v)=>{
    const digits=String(v||"").replace(/\D/g,"").slice(0,8);
    const len=digits.length;
    if(!len) return "";
    if(len<=2) return digits;
    if(len<=4) return `${digits.slice(0,2)}/${digits.slice(2)}`;
    return `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
  };
  const PERSONAL_INFO_FIELDS=["name","fatherName","whatsapp","bayForm","fatherCnic","dob"];
  const personalLabel=(field)=>{
    const labels={
      name:"Student Name",
      fatherName:"Father's Name",
      whatsapp:"WhatsApp",
      bayForm:"Form B",
      fatherCnic:"Father CNIC",
      dob:"Date of Birth",
    };
    return labels[field]||field;
  };
  const editingStudent=editingId?students.find(st=>st.id===editingId):null;
  const personalLocked=!!(editingStudent?.personalInfoLockSession&&editingStudent.personalInfoLockSession===currentSession);
  const isPromotedStudent=(st)=>!!(st?.personalInfoLockSession||st?.promotionInfo?.promotedAt);
  const openAdd=()=>{ setEditingId(null); setForm(emptyForm); photoFileRef.current=null; setShowAdd(true); };
  const openEdit=(s)=>{ setEditingId(s.id); setForm({admissionNo:s.admissionNo||"",rollNo:s.rollNo||"",name:toProperCase(s.name||""),fatherName:toProperCase(s.fatherName||""),classId:s.classId||"",dob:formatDob(s.dob||""),bayForm:s.bayForm||"",fatherCnic:s.fatherCnic||"",whatsapp:s.whatsapp||"",photo:s.photo||null}); photoFileRef.current=null; setShowAdd(true); };
  const handleStudentPhotoFile=async (f)=>{
    if(!f) return;
    setPhotoBusy(true);
    try{
      const data=await processStudentPhotoWithBackground(f);
      setForm(x=>({...x,photo:data}));
    }finally{
      setPhotoBusy(false);
    }
  };
  const save=async()=>{
    if(!(form.name||"").trim()){ alert("Please enter Student Name."); return; }
    let admissionNo=(form.admissionNo||"").trim();
    let rollNo=(form.rollNo||"").trim();
    if(!editingId){
      if(!admissionNo) admissionNo=nextAdmissionNo(students);
      if(!rollNo) rollNo=nextRollNoForClass(students,settings.classes,form.classId,settings.commonTeachers);
    }else{
      if(!admissionNo){ alert("Please enter Admission No."); return; }
    }
    const dupAdm=findStudentByAdmissionNo(students,admissionNo,editingId);
    if(dupAdm){
      alert("This admission number is already assigned to:\nClass: "+getClassLabel(settings,dupAdm.classId)+"\nRoll: "+(dupAdm.rollNo||"—")+"\nName: "+(dupAdm.name||"")+"\nFather: "+(dupAdm.fatherName||""));
      return;
    }
    const dupRoll=findStudentByRollInClass(students,settings.classes,form.classId,rollNo,editingId,settings.commonTeachers);
    if(dupRoll){
      alert("This roll number is already used in this class by:\nName: "+(dupRoll.name||"")+"\nFather: "+(dupRoll.fatherName||"")+"\nAdm#: "+(dupRoll.admissionNo||"—"));
      return;
    }
    const id=editingId||genId();
    const photoVal=form.photo||null;
    const name=toProperCase(form.name||"");
    const fatherName=toProperCase(form.fatherName||"");
    const payload={...form,name,fatherName,admissionNo,rollNo,id:editingId||id,photo:photoVal};
    if(editingId){
      const existing=students.find(st=>st.id===editingId);
      const normalizedCurrent={
        ...existing,
        name:toProperCase(existing?.name||""),
        fatherName:toProperCase(existing?.fatherName||""),
      };
      const changedFields=PERSONAL_INFO_FIELDS.reduce((acc,field)=>{
        const fromVal=String(normalizedCurrent?.[field]??"").trim();
        const toVal=String(payload?.[field]??"").trim();
        if(fromVal!==toVal) acc[field]={from:fromVal,to:toVal};
        return acc;
      },{});
      if(personalLocked&&Object.keys(changedFields).length){
        alert("Personal fields are locked for this session after promotion. Switch to next session to edit these fields.");
        return;
      }
      const existingHistory=Array.isArray(existing?.personalInfoHistory)?existing.personalInfoHistory:[];
      const nextHistory=Object.keys(changedFields).length
        ?[
          ...existingHistory,
          {
            session:currentSession||"",
            changedAt:new Date().toISOString(),
            changedBy:{email:String(currentUser?.email||currentUser?.name||"unknown"),userId:currentUser?.id||currentUser?.userId||undefined},
            changes:changedFields
          }
        ]
        :existingHistory;
      const nextPayload={
        ...payload,
        personalInfoLockSession:Object.keys(changedFields).length?(currentSession||null):(existing?.personalInfoLockSession??null),
        personalInfoHistory:nextHistory,
      };
      setStudents(s=>s.map(st=>st.id===editingId?nextPayload:st));
    }else{
      setStudents(s=>[...s,{...payload,personalInfoLockSession:null,personalInfoHistory:[]}]);
    }
    setForm(emptyForm);
    photoFileRef.current=null;
    setEditingId(null);
    setShowAdd(false);
  };
  const closeModal=()=>{ setShowAdd(false); setEditingId(null); setForm(emptyForm); photoFileRef.current=null; };
  const formatCnic=(v)=>{ const d=(v||"").replace(/\D/g,"").slice(0,13); if(d.length<=5)return d; if(d.length<=12)return d.slice(0,5)+"-"+d.slice(5); return d.slice(0,5)+"-"+d.slice(5,12)+"-"+d.slice(12); };
  const formatWhatsapp=(v)=>{ const d=(v||"").replace(/\D/g,"").slice(0,11); if(d.length<=4)return d; return d.slice(0,4)+"-"+d.slice(4); };
  const printSubtitle = embedded
    ? "Student Record" + (filterCls !== "all" ? " - " + (filterCls ? getClassLabel(settings, filterCls) : "") : " - All Classes")
    : "Student Record" + (filterCls !== "all" ? " - " + (filterCls ? getClassLabel(settings, filterCls) : "") : " - All Classes");
  const studentsTableRef=useRef(null);
  const doExportStudents=async(format)=>{
    if(format!=="pdf") return;
    if(!filtered.length){ alert("No data to export."); return; }
    const headers=["Photo","Adm#","Roll#","Student Name","Father's Name","Form B","Father CNIC","WhatsApp","Grade","DOB"];
    const rows=filtered.map(s=>{
      const gradeLabel=(getClassLabel(settings,s.classId)||"").replace(/-$/,"");
      return [
        "", // photo drawn manually
        s.admissionNo||"",
        s.rollNo||"",
        s.name||"",
        s.fatherName||"",
        s.bayForm?formatCnic(s.bayForm):"—",
        s.fatherCnic?formatCnic(s.fatherCnic):"—",
        s.whatsapp?formatWhatsapp(s.whatsapp):"—",
        gradeLabel,
        s.dob||""
      ];
    });
    const meta=getExportHeaderMeta(settings,currentSession,printSubtitle);
    const doc=new jsPDF({orientation:"landscape",unit:"mm",format:"a4"});
    const pageW=doc.internal.pageSize.getWidth();
    const yTop=10;
    const left=10;
    const right=pageW-10;
    const hdr=await addPdfBrandingLogoRow(doc, settings?.logo, left, yTop);
    doc.setFontSize(14);
    doc.setFont(undefined,"bold");
    doc.text(meta.schoolName,hdr.textX,yTop+10);
    doc.setFont(undefined,"normal");
    doc.setFontSize(10);
    doc.setTextColor(0,0,0);
    doc.text(meta.subtitle||meta.tableName,hdr.textX,yTop+18);
    doc.setFontSize(9);
    doc.text("Date: "+meta.dateStr,right,yTop+10,{align:"right"});
    doc.text("Time: "+meta.timeStr,right,yTop+18,{align:"right"});
    let y=hdr.tableStartY;

    autoTable(doc,{
      head:[headers],
      body:rows,
      startY:y,
      theme:"grid",
      headStyles:{
        fillColor:[26,58,107],
        textColor:[255,255,255],
        fontStyle:"bold",
        halign:"center",
        valign:"middle",
        cellPadding:4,
      },
      bodyStyles:{
        halign:"center",
        valign:"middle",
        cellPadding:4,
      },
      styles:{
        halign:"center",
        valign:"middle",
        lineWidth:0.2,
        lineColor:[0,0,0],
      },
      alternateRowStyles:{fillColor:[248,250,252]},
      margin:{left,right:10},
      columnStyles:{
        3:{halign:"left"}, // Name
        4:{halign:"left"}, // Father's Name
      },
      didDrawCell:(data)=>{
        if(data.section==="body" && data.column.index===0){
          const s=filtered[data.row.index];
          if(!s.photo) return;
          try{
            const cell=data.cell;
            const padding=1;
            const w=cell.width-2*padding;
            const h=cell.height-2*padding;
            doc.addImage(s.photo,"JPEG",cell.x+padding,cell.y+padding,w,h);
          }catch{}
        }
      }
    });
    const name="Students_Record"+(filterCls!=="all"?"_"+ getClassLabel(settings, filterCls).replace(/\s/g,"_"):"");
    doc.save(name+".pdf");
  };

  return <div>
    {embedded&&<div className="print-only" style={{display:"none",marginBottom:10}}><SchoolHeader settings={settings} subtitle={printSubtitle}/></div>}
    <div className="no-print" style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap",alignItems:"flex-end"}}>
      <Sel label="Filter by Class" value={filterCls} onChange={setFilterCls} options={settings.classes.map(c=>({value:c.id,label:formatClassDisplay(c)}))}/>
      <Inp label="Search" value={search} onChange={setSearch} placeholder="Name or Adm No…"/>
      <div style={{marginLeft:"auto",display:"flex",gap:8,flexWrap:"wrap"}}>
        <Btn onClick={openAdd}>+ Add Student</Btn>
        <Btn small outline onClick={()=>void doExportStudents("pdf").catch(()=>alert("PDF export failed."))}>📄 PDF</Btn>
        <Btn small outline onClick={()=>photosDirRef.current?.click()}>📷 Import photos (folder)</Btn>
        <input
          ref={photosDirRef}
          type="file"
          accept="image/*"
          style={{display:"none"}}
          multiple
          webkitdirectory=""
          onChange={async e=>{
            const files=Array.from(e.target.files||[]);
            e.target.value="";
            if(!files.length) return;
            const classMatch=(folder)=>{
              const f=String(folder||"").trim().toLowerCase();
              if(!f) return null;
              return (settings.classes||[]).find(c=>{
                const labels=[c.id,String(c.name||"").trim(),formatClassDisplay(c)];
                return labels.some(l=>l&&l.toLowerCase()===f);
              })||null;
            };
            const targets=[];
            for(const file of files){
              const rel=file.webkitRelativePath||file.name;
              const parts=rel.split(/[\\/]/);
              if(parts.length<2) continue;
              const folder=parts[parts.length-2];
              const namePart=parts[parts.length-1];
              const rollMatch=namePart.match(/(\d+)/);
              if(!rollMatch) continue;
              const rollStr=rollMatch[1].replace(/^0+/,"")||"0";
              const cls=classMatch(folder);
              if(!cls) continue;
              targets.push({file,classId:cls.id,roll:rollStr});
            }
            if(!targets.length){ alert("No matching class/roll photos found. Folder names must match class names (e.g. 1ST-A) and files be named with roll numbers."); return; }
            const photosMap={};
            await Promise.all(targets.map(async t=>{ photosMap[`${t.classId}|${t.roll}`]=await processStudentPhotoWithBackground(t.file); }));
            setStudents(prev=>prev.map(s=>{
              const key=`${s.classId}|${String(s.rollNo).replace(/^0+/,"")||"0"}`;
              return photosMap[key]?{...s,photo:photosMap[key]}:s;
            }));
            alert(`Imported photos for ${Object.keys(photosMap).length} student(s).`);
          }}
        />
      </div>
    </div>
    <div className="no-print" style={{fontSize:12,color:C.gray,marginBottom:8}}>Showing {filtered.length} of {students.length} students</div>
    <div ref={studentsTableRef} className="students-record-print" style={{overflowX:"auto",width:"100%"}}>
      <table style={{borderCollapse:"collapse",fontSize:13,minWidth:"100%"}}>
        <thead><tr style={{background:C.navy,color:"#fff"}}>{["Photo","Adm#","Roll#","Student Name","Father's Name","Form B","Father CNIC","WhatsApp","Class","DOB","Action"].map(h=><th key={h} style={{padding:"7px 10px",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>{filtered.map((s,i)=><tr key={s.id} style={{background:i%2===0?"#f9fafb":"#fff"}}>
          <td style={{padding:"5px 10px"}}><div style={{width:34,height:34,borderRadius:"50%",overflow:"hidden",border:"2px solid #d1d5db",background:"#e5e7eb",display:"flex",alignItems:"center",justifyContent:"center"}}>{s.photo?<img src={s.photo} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"👤"}</div></td>
          <td style={{padding:"5px 10px"}}>{s.admissionNo}</td><td style={{padding:"5px 10px",fontWeight:700}}>{s.rollNo}</td><td style={{padding:"5px 10px"}}>{s.name}</td><td style={{padding:"5px 10px"}}>{s.fatherName}</td>
          <td style={{padding:"5px 10px"}}>{s.bayForm?formatCnic(s.bayForm):"—"}</td><td style={{padding:"5px 10px"}}>{s.fatherCnic?formatCnic(s.fatherCnic):"—"}</td><td style={{padding:"5px 10px"}}>{s.whatsapp?formatWhatsapp(s.whatsapp):"—"}</td>
          <td style={{padding:"5px 10px"}}>
            <div>{getClassLabel(settings,s.classId)}</div>
            <div style={{display:"flex",gap:4,marginTop:4,alignItems:"center",flexWrap:"wrap"}}>
              <button type="button" onClick={()=>moveStudentClass(s,"up")} title="Move up class" style={{padding:"2px 6px",fontSize:11,border:"1px solid #cbd5e1",borderRadius:4,background:"#fff",cursor:"pointer"}}>↑</button>
              <button type="button" onClick={()=>moveStudentClass(s,"down")} title="Move down class" style={{padding:"2px 6px",fontSize:11,border:"1px solid #cbd5e1",borderRadius:4,background:"#fff",cursor:"pointer"}}>↓</button>
            </div>
            {sectionClassOptions(s.classId).length>1&&(
              <select
                value={resolveClass(settings.classes,s.classId)?.id||s.classId}
                onChange={e=>changeStudentSection(s,e.target.value)}
                style={{marginTop:4,padding:"2px 6px",fontSize:11,border:"1px solid #cbd5e1",borderRadius:4,background:"#fff",maxWidth:160}}
              >
                {sectionClassOptions(s.classId).map(c=><option key={c.id} value={c.id}>{formatClassDisplay(c)}</option>)}
              </select>
            )}
          </td><td style={{padding:"5px 10px"}}>{s.dob}</td>
          <td style={{padding:"5px 10px"}}><div style={{display:"flex",flexDirection:"column",gap:4}}><Btn small outline onClick={()=>openEdit(s)}>Edit</Btn><Btn small danger disabled={isPromotedStudent(s)} onClick={()=>{if(isPromotedStudent(s)) return; setStudents(x=>x.filter(st=>st.id!==s.id));}}>{isPromotedStudent(s)?"Promoted":"Remove"}</Btn></div></td>
        </tr>)}
        {filtered.length===0&&<tr><td colSpan={11} style={{padding:20,textAlign:"center",color:C.gray}}>No students found</td></tr>}
        </tbody>
      </table>
    </div>
    {showAdd&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:10,width:"100%",maxWidth:560,maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{background:C.navy,color:"#fff",padding:"12px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontWeight:700}}>{editingId?"Edit Student":"Add New Student"}</span>
          <button onClick={closeModal} style={{background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{padding:20}}>
          <div style={{display:"flex",gap:16,alignItems:"flex-start",marginBottom:14}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,flexShrink:0}}>
              <div style={{width:80,height:100,border:"2px dashed #d1d5db",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",background:"#fafafa"}}>
                {photoBusy?<span style={{fontSize:10,color:C.gray,textAlign:"center",padding:4}}>Processing…</span>:form.photo?<img src={form.photo} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:10,color:C.gray,textAlign:"center"}}>Photo</span>}
              </div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"center"}}>
                <Btn type="button" small outline onClick={()=>photoGalleryRef.current?.click()} disabled={photoBusy}>Gallery</Btn>
                <Btn type="button" small outline onClick={()=>photoCameraRef.current?.click()} disabled={photoBusy}>Camera</Btn>
              </div>
              <input ref={photoGalleryRef} type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];if(!f)return;e.target.value="";photoFileRef.current=f;await handleStudentPhotoFile(f);}}/>
              <input ref={photoCameraRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];if(!f)return;e.target.value="";photoFileRef.current=f;await handleStudentPhotoFile(f);}}/>
            </div>
            <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Inp label="Admission No" value={form.admissionNo} onChange={v=>setForm(x=>({...x,admissionNo:v}))} placeholder={editingId?"":("Next: "+suggestedFormAdm)}/>
              <Inp label="Roll No" value={form.rollNo} onChange={v=>setForm(x=>({...x,rollNo:v}))} placeholder={editingId?"":("Next in class: "+suggestedFormRoll)}/>
              <Inp label="Student Name" value={form.name} onChange={v=>setForm(x=>({...x,name:toProperCaseNameInput(v)}))} disabled={!!editingId&&personalLocked}/>
              <Inp label="Father's Name" value={form.fatherName} onChange={v=>setForm(x=>({...x,fatherName:toProperCaseNameInput(v)}))} disabled={!!editingId&&personalLocked}/>
              <Inp label="Bay Form" value={form.bayForm} onChange={v=>setForm(x=>({...x,bayForm:formatCnic(v)}))} placeholder="00000-0000000-0" disabled={!!editingId&&personalLocked}/>
              <Inp label="Father's CNIC" value={form.fatherCnic} onChange={v=>setForm(x=>({...x,fatherCnic:formatCnic(v)}))} placeholder="00000-0000000-0" disabled={!!editingId&&personalLocked}/>
              <Inp label="WhatsApp No" value={form.whatsapp} onChange={v=>setForm(x=>({...x,whatsapp:formatWhatsapp(v)}))} placeholder="0000-0000000" disabled={!!editingId&&personalLocked}/>
              <Sel label="Class" value={form.classId} onChange={v=>setForm(x=>({...x,classId:v}))} options={settings.classes.map(c=>({value:c.id,label:formatClassDisplay(c)}))}/>
              <Inp label="Date of Birth" value={form.dob} onChange={v=>setForm(x=>({...x,dob:formatDob(v)}))} placeholder="dd/mm/yyyy" disabled={!!editingId&&personalLocked}/>
            </div>
          </div>
          {editingId&&personalLocked&&(
            <div style={{marginBottom:10,padding:"8px 10px",background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:6,fontSize:12,color:"#9a3412"}}>
              Personal fields are locked in this session after promotion. Switch session to edit these fields.
            </div>
          )}
          {editingId&&(
            <div style={{marginBottom:12,padding:"10px 12px",border:"1px solid #e2e8f0",borderRadius:8,background:"#f8fafc"}}>
              <div style={{fontSize:12,fontWeight:700,color:C.navy,marginBottom:6}}>Change History</div>
              {(Array.isArray(editingStudent?.personalInfoHistory)&&editingStudent.personalInfoHistory.length>0)?(
                <div style={{display:"grid",gap:8,maxHeight:180,overflow:"auto"}}>
                  {editingStudent.personalInfoHistory.slice().reverse().map((entry,idx)=>(
                    <div key={`${entry.changedAt||idx}_${idx}`} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:6,padding:"8px 10px"}}>
                      <div style={{fontSize:11,color:C.gray,marginBottom:4}}>
                        Session: {entry.session||"—"} | {entry.changedAt?new Date(entry.changedAt).toLocaleString():"—"} | By: {entry.changedBy?.email||"unknown"}
                      </div>
                      <div style={{fontSize:12,color:"#0f172a"}}>
                        {Object.entries(entry.changes||{}).map(([field,val])=>(
                          <div key={field}>{personalLabel(field)}: {String(val?.from??"")} {"->"} {String(val?.to??"")}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ):<div style={{fontSize:12,color:C.gray}}>No personal-info changes recorded.</div>}
            </div>
          )}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn outline color={C.gray} onClick={closeModal}>Cancel</Btn><Btn onClick={save}>Save</Btn></div>
        </div>
      </div>
    </div>}
  </div>;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const DASHBOARD_EXAM_LS="sms_dashboard_exam";
function DashboardPage({settings,students,staffProfiles=[],exam_tm:examTmProp,exam_om:examOmProp,activeSchoolId}){
  const profileList=Array.isArray(staffProfiles)?staffProfiles:[];
  const hasProfileCategories=profileList.length>0;
  const teachingStaffCount=hasProfileCategories
    ? profileList.filter(p=>normalizeStaffCategory(p?.staffCategory)==="Teaching").length
    : (Array.isArray(settings.staff)?settings.staff:[]).filter(isTeachingStaffMember).length;
  const nonTeachingStaffCount=hasProfileCategories
    ? profileList.filter(p=>normalizeStaffCategory(p?.staffCategory)==="Non Teaching").length
    : Math.max(0,(Array.isArray(settings.staff)?settings.staff:[]).length-teachingStaffCount);
  const [feeRecords] = useState(() => {
    try {
      const raw = localStorage.getItem(feeCore.FEE_DATA_KEY);
      if (!raw) return [];
      const allSchools = JSON.parse(raw);
      return allSchools?.[activeSchoolId] || [];
    } catch {
      return [];
    }
  });

  const currentMonth = useMemo(() => {
    const d = new Date();
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  }, []);

  const feeStats = useMemo(() => {
    if (typeof dashboardService?.feeStats !== 'function') {
      return { totalExpected: 0, totalCollected: 0, totalPending: 0, pct: 0 };
    }
    return dashboardService.feeStats({
      feeRecords,
      classes: settings.classes,
      students,
      month: currentMonth.month,
      year: currentMonth.year,
      feeAmount: feeCore.FEE_AMOUNT
    });
  }, [feeRecords, settings.classes, students, currentMonth.month, currentMonth.year]);

  const stats=[
    {l:"Total Students",v:students.length,i:"👨‍🎓",c:C.navy},
    {l:`Fee Collections`,v:feeCore.formatCurrency(feeStats.totalCollected),i:"💰",c:"#16a34a"},
    {l:"Classes",v:settings.classes.length,i:"🏫",c:"#0d9488"},
    {l:"Teaching Staff",v:teachingStaffCount,i:"👩‍🏫",c:"#7c3aed"},
    {l:"Non-Teaching",v:nonTeachingStaffCount,i:"🧰",c:"#0f766e"}
  ];
  const passThreshold=Number(settings.passPercent)||50;
  const exams=["1st Term","Mid Term","Final Term","Annual"];
  const dashExamOptions=[{value:"overall",label:"Overall (All Terms)"},...exams.map(e=>({value:e,label:e}))];
  const allowedDashExam=new Set(dashExamOptions.map(o=>o.value));
  const [dashExam,setDashExam]=useState(()=>{
    try{
      const s=window.localStorage.getItem(DASHBOARD_EXAM_LS);
      if(s&&allowedDashExam.has(s)) return s;
    }catch{}
    return "1st Term";
  });
  useEffect(()=>{
    try{ window.localStorage.setItem(DASHBOARD_EXAM_LS,dashExam); }catch{}
  },[dashExam]);
  const [dashExamMobileUi,setDashExamMobileUi]=useState(false);
  useEffect(()=>{
    if(typeof window==="undefined"||typeof window.matchMedia!=="function") return;
    const mq=window.matchMedia("(max-width: 768px)");
    const apply=()=>setDashExamMobileUi(!!mq.matches);
    apply();
    const onChange=()=>apply();
    if(mq.addEventListener) mq.addEventListener("change",onChange);
    else mq.addListener(onChange);
    return ()=>{
      if(mq.removeEventListener) mq.removeEventListener("change",onChange);
      else mq.removeListener(onChange);
    };
  },[]);
  const TM=examTmProp&&typeof examTmProp==="object"?examTmProp:{};
  const OM=examOmProp&&typeof examOmProp==="object"?examOmProp:{};
  const gtm=(e,c,s)=>TM[`${e}_${c}_${s}`]||"";
  const gom=(e,c,id,s)=>OM[`${e}_${c}_${id}_${s}`]||"";
  /** Same aggregation as Result Card: per-subject then sum (overall = all exams per subject). */
  const subjectStatDash=(mode,classId,studentId,subj)=>{
    let tot=0,obt=0;
    if(mode==="overall"){
      exams.forEach(ex=>{
        const t=parseFloat(gtm(ex,classId,subj));
        const o=parseFloat(gom(ex,classId,studentId,subj));
        if(!isNaN(t)) tot+=t;
        if(!isNaN(o)) obt+=o;
      });
    }else{
      const t=parseFloat(gtm(mode,classId,subj));
      const o=parseFloat(gom(mode,classId,studentId,subj));
      if(!isNaN(t)) tot=t;
      if(!isNaN(o)) obt=o;
    }
    return {tot,obt};
  };
  const overallStatDash=(mode,classId,studentId)=>{
    let tot=0,obt=0;
    getClassSubjects(settings,classId,"exam").forEach(subj=>{
      const s=subjectStatDash(mode,classId,studentId,subj);
      tot+=s.tot;
      obt+=s.obt;
    });
    if(tot<=0) return {hasMarks:false,pct:null};
    const pct=(obt/tot)*100;
    return {hasMarks:true,pct};
  };
  const [dashView,setDashView]=useState("class"); // "class" | "subject"
  const [dashSubjClass,setDashSubjClass]=useState("all"); // "all" or classId
  const classStats=useMemo(()=>settings.classes.map(cls=>{
    const classStudents=students.filter(s=>resolveClass(settings.classes,s.classId)?.id===cls.id);
    const count=classStudents.length;
    let pass=0,fail=0;
    classStudents.forEach(st=>{
      const o=overallStatDash(dashExam,cls.id,st.id);
      if(!o.hasMarks) return;
      if(o.pct>=passThreshold) pass++; else fail++;
    });
    const displayName=formatClassDisplay(cls);
    const pending=Math.max(0,count-pass-fail);
    const passRatePct=count>0?Math.round((100*pass)/count*10)/10:0;
    const classFeeRecords = feeRecords.filter(rec => {
      const recordClass = resolveClass(settings.classes, rec.classId);
      return recordClass && String(recordClass.id) === String(cls.id) && rec.month === currentMonth.month && rec.year === currentMonth.year;
    });
    const feeInfo = {
      collectedAmount: classFeeRecords.reduce((sum, rec) => sum + (rec.amount || feeCore.FEE_AMOUNT), 0),
      expectedAmount: count * feeCore.FEE_AMOUNT
    };
    return {id:cls.id,name:displayName,grade:cls.grade,section:cls.section,count,pass,fail,pending,passRatePct, feeInfo};
  }),[settings.classes,settings.classSubjects,settings.classSubjectsExam,students,examTmProp,examOmProp,passThreshold,dashExam, feeRecords, currentMonth]);
  const subjectStats=useMemo(()=>{
    const subjMap={};
    const filteredClasses=dashSubjClass==="all"?settings.classes:settings.classes.filter(c=>c.id===dashSubjClass);
    filteredClasses.forEach(cls=>{
      const classStudents=students.filter(s=>resolveClass(settings.classes,s.classId)?.id===cls.id);
      getClassSubjects(settings,cls.id,"exam").forEach(subj=>{
        if(!subjMap[subj]) subjMap[subj]={name:subj,total:0,pass:0,fail:0};
        classStudents.forEach(st=>{
          const sd=subjectStatDash(dashExam,cls.id,st.id,subj);
          if(sd.tot<=0) return;
          subjMap[subj].total++;
          const pct=(sd.obt/sd.tot)*100;
          if(pct>=passThreshold) subjMap[subj].pass++; else subjMap[subj].fail++;
        });
      });
    });
    return Object.values(subjMap).sort((a,b)=>a.name.localeCompare(b.name));
  },[settings.classes,settings.classSubjects,settings.classSubjectsExam,students,examTmProp,examOmProp,passThreshold,dashExam,dashSubjClass]);
  const examHelp=dashExam==="overall"
    ?"Uses the same marks and pass rule as Result Card → Overall (all terms combined). Pass if overall % ≥ Pass %."
    :`Uses the same totals and pass rule as Enter Marks / Consolidated / Result Card for "${dashExam}". Pass if % ≥ ${passThreshold}%.`;
  return <div>
    <style>{`
      .dash-stat-card{ transition:transform 0.2s ease,box-shadow 0.2s ease,background 0.2s ease; }
      .dash-stat-card:hover{ transform:translateY(-2px); box-shadow:0 10px 26px rgba(15,23,42,0.18); background:linear-gradient(135deg,#ffffff,#eef2ff); }
      .dash-class-card{ transition:transform 0.2s ease,box-shadow 0.2s ease,background 0.2s ease; }
      .dash-class-card:hover{ transform:translateY(-1px); box-shadow:0 6px 16px rgba(15,23,42,0.14); background:#f3f4ff; }
      @media (max-width:768px){
        .dash-exam-row{ width:100%; max-width:100%; min-width:0; position:relative; z-index:6; flex:1 1 100%; }
        .dash-class-summary-panel{ position:relative; z-index:1; overflow:visible; }
      }
    `}</style>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16,marginBottom:22}}>
      {stats.map(s=><div key={s.l} className="dash-stat-card" style={{background:"#fff",borderRadius:14,padding:20,boxShadow:"0 4px 18px rgba(15,23,42,0.10)",border:"1px solid rgba(148,163,184,0.28)",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-36,top:-36,width:140,height:140,borderRadius:"50%",background:`radial-gradient(circle at 30% 30%, ${s.c}33, transparent 65%)`,opacity:0.9}}/>
        <div style={{fontSize:52,marginBottom:8,opacity:0.98,lineHeight:1}}>{s.i}</div>
        <div style={{fontSize:32,fontWeight:700,color:s.c,letterSpacing:"-0.02em",lineHeight:1.2}}>{s.v}</div>
        <div style={{fontSize:12,color:C.gray,marginTop:4,fontWeight:500,letterSpacing:0.2}}>{s.l}</div>
      </div>)}
    </div>

    {settings.classes.length>0&&(
      <div className="dash-class-summary-panel" style={{background:"#fff",borderRadius:14,padding:16,boxShadow:"0 4px 18px rgba(15,23,42,0.10)",marginBottom:18,border:"1px solid rgba(148,163,184,0.25)"}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
          <h3 style={{margin:0,fontSize:14,color:C.navy}}>{dashView==="class"?"Class-wise Summary":"Subject-wise Summary"}</h3>
          <div style={{display:"flex",gap:0,borderRadius:8,overflow:"hidden",border:`1.5px solid ${C.navy}`,flexShrink:0}}>
            {[{v:"class",l:"Class-wise"},{v:"subject",l:"Subject-wise"}].map(opt=>{
              const active=dashView===opt.v;
              return <button key={opt.v} onClick={()=>setDashView(opt.v)} style={{padding:"5px 13px",fontSize:12,fontWeight:600,border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:5,transition:"background 0.15s,color 0.15s",background:active?C.navy:"#fff",color:active?"#fff":C.navy}}>
                <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:15,height:15,borderRadius:"50%",border:`1.5px solid ${active?"rgba(255,255,255,0.6)":C.navy}`,flexShrink:0,transition:"background 0.15s",background:active?C.navy:"#fff"}}>
                  {active&&<span style={{display:"block",width:7,height:7,borderRadius:"50%",background:"#fff"}}/>}
                </span>
                {opt.l}
              </button>;
            })}
          </div>
        </div>
        <p style={{margin:"0 0 10px",fontSize:11,color:C.gray}}>{examHelp}{dashView==="class"?" Enrolled total is from the student list.":" Students with marks entered for the subject are counted."}</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"flex-end",marginBottom:12,width:"100%",maxWidth:"100%",minWidth:0}}>
          <div className="dash-exam-row">
            <Sel label="Exam" value={dashExam} onChange={setDashExam} options={dashExamOptions} width={dashExamMobileUi?"100%":200} touchFriendly={dashExamMobileUi}/>
          </div>
          {dashView==="subject"&&(
            <div className="dash-exam-row">
              <Sel label="Class" value={dashSubjClass} onChange={setDashSubjClass}
                options={[{value:"all",label:"All Classes"},...settings.classes.map(c=>({value:c.id,label:formatClassDisplay(c)}))]}
                width={dashExamMobileUi?"100%":200} touchFriendly={dashExamMobileUi}/>
            </div>
          )}
        </div>
        {dashView==="class"&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
            {classStats.map(row=>(
              <div key={row.id} style={{flex:"1 1 300px",maxWidth:380,minWidth:260}}>
                <div className="dash-class-card" style={{background:"#f3f4ff",borderRadius:12,padding:10,boxShadow:"0 1px 6px rgba(15,23,42,0.06)",border:"1px solid rgba(148,163,184,0.35)"}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{row.name}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:5}}>
                    <div style={{background:"#fff",borderRadius:9,padding:6,border:"1px solid rgba(148,163,184,0.35)"}}>
                      <div style={{fontSize:22,marginBottom:2,lineHeight:1}}>👨‍🎓</div>
                      <div style={{fontSize:15,fontWeight:700,color:C.navy}}>{row.count}</div>
                      <div style={{fontSize:9,color:C.gray,fontWeight:500}}>Total</div>
                    </div>
                    <div style={{background:"#fff",borderRadius:9,padding:6,border:"1px solid rgba(74,222,128,0.45)"}}>
                      <div style={{fontSize:22,marginBottom:2,lineHeight:1}}>✅</div>
                      <div style={{fontSize:15,fontWeight:700,color:C.green}}>{row.pass}</div>
                      <div style={{fontSize:9,color:C.gray,fontWeight:500}}>Pass</div>
                    </div>
                    <div style={{background:"#fff",borderRadius:9,padding:6,border:"1px solid rgba(248,113,113,0.55)"}}>
                      <div style={{fontSize:22,marginBottom:2,lineHeight:1}}>❌</div>
                      <div style={{fontSize:15,fontWeight:700,color:C.red}}>{row.fail}</div>
                      <div style={{fontSize:9,color:C.gray,fontWeight:500}}>Fail</div>
                    </div>
                    <div style={{background:"#fff",borderRadius:9,padding:6,border:`1.5px solid ${C.gold}`,boxShadow:"0 0 0 1px rgba(234,179,8,0.12)"}}>
                      <div style={{fontSize:18,marginBottom:2,lineHeight:1,fontWeight:800,color:C.gold}}>%</div>
                      <div style={{fontSize:15,fontWeight:700,color:C.navy}}>{row.count>0?`${row.passRatePct}%`:"—"}</div>
                      <div style={{fontSize:9,color:C.gray,fontWeight:500}}>Pass %</div>
                    </div>
                  </div>
                  <div style={{marginTop:8, paddingTop:8, borderTop:"1px dashed rgba(148,163,184,0.35)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                    <div style={{fontSize:11, color:C.gray, fontWeight:600}}>Fee ({feeCore.getMonthsList().find(m=>m.value===currentMonth.month)?.label.substring(0,3)})</div>
                    <div style={{fontSize:13, fontWeight:700, color:"#16a34a"}}>{feeCore.formatCurrency(row.feeInfo.collectedAmount)}<span style={{fontSize:10, color:C.gray, fontWeight:500, marginLeft:4}}>/ {feeCore.formatCurrency(row.feeInfo.expectedAmount)}</span></div>
                  </div>
                  {row.count>0&&row.pending>0&&(
                    <div style={{marginTop:6,fontSize:10,color:C.gray,textAlign:"center",lineHeight:1.35}}>
                      {row.pending} enrolled with no marks for this view
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {dashView==="subject"&&(
          subjectStats.length===0
            ?<div style={{textAlign:"center",padding:"28px 0",color:C.gray,fontSize:13}}>No subject marks data found for this exam term.</div>
            :<div style={{display:"flex",flexWrap:"wrap",gap:10}}>
              {subjectStats.map(row=>{
                const passRatePct=row.total>0?Math.round((100*row.pass)/row.total*10)/10:0;
                const noMark=row.total===0;
                return <div key={row.name} style={{flex:"1 1 240px",maxWidth:340,minWidth:220}}>
                  <div className="dash-class-card" style={{background:"#f0f9ff",borderRadius:12,padding:10,boxShadow:"0 1px 6px rgba(15,23,42,0.06)",border:"1px solid rgba(148,163,184,0.35)"}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#0369a1",marginBottom:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:16}}>📚</span>{row.name}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:5}}>
                      <div style={{background:"#fff",borderRadius:9,padding:6,border:"1px solid rgba(148,163,184,0.35)"}}>
                        <div style={{fontSize:18,marginBottom:2,lineHeight:1}}>✍️</div>
                        <div style={{fontSize:15,fontWeight:700,color:C.navy}}>{row.total||0}</div>
                        <div style={{fontSize:9,color:C.gray,fontWeight:500}}>Appeared</div>
                      </div>
                      <div style={{background:"#fff",borderRadius:9,padding:6,border:"1px solid rgba(74,222,128,0.45)"}}>
                        <div style={{fontSize:18,marginBottom:2,lineHeight:1}}>✅</div>
                        <div style={{fontSize:15,fontWeight:700,color:C.green}}>{row.pass}</div>
                        <div style={{fontSize:9,color:C.gray,fontWeight:500}}>Pass</div>
                      </div>
                      <div style={{background:"#fff",borderRadius:9,padding:6,border:"1px solid rgba(248,113,113,0.55)"}}>
                        <div style={{fontSize:18,marginBottom:2,lineHeight:1}}>❌</div>
                        <div style={{fontSize:15,fontWeight:700,color:C.red}}>{row.fail}</div>
                        <div style={{fontSize:9,color:C.gray,fontWeight:500}}>Fail</div>
                      </div>
                      <div style={{background:"#fff",borderRadius:9,padding:6,border:`1.5px solid ${C.gold}`,boxShadow:"0 0 0 1px rgba(234,179,8,0.12)"}}>
                        <div style={{fontSize:14,marginBottom:2,lineHeight:1,fontWeight:800,color:C.gold}}>%</div>
                        <div style={{fontSize:15,fontWeight:700,color:C.navy}}>{noMark?"—":`${passRatePct}%`}</div>
                        <div style={{fontSize:9,color:C.gray,fontWeight:500}}>Pass %</div>
                      </div>
                    </div>
                    {!noMark&&row.total>0&&(
                      <div style={{marginTop:7,height:5,borderRadius:4,background:"#e0f2fe",overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:4,width:`${passRatePct}%`,background:passRatePct>=80?"#22c55e":passRatePct>=50?"#eab308":"#ef4444",transition:"width 0.4s"}}/>
                      </div>
                    )}
                  </div>
                </div>;
              })}
            </div>
        )}
      </div>
    )}
  </div>;
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
  "@media (max-width:1199px){",
  "  .app-right-sidebar{display:none!important}",
  "}",
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
  "  .mobile-menu-backdrop{position:fixed;inset:0;background:rgba(15,23,42,0.45);z-index:10000;-webkit-tap-highlight-color:transparent}",
  "  .mobile-menu-panel{position:fixed;top:0;left:0;bottom:0;width:min(300px,88vw);max-width:100vw;background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);color:#f9fafb;z-index:10001;box-shadow:8px 0 32px rgba(0,0,0,0.35);display:flex;flex-direction:column;overflow:hidden;padding-bottom:env(safe-area-inset-bottom,0);animation:mobile-nav-drawer-in 0.22s ease-out}",
  "  @keyframes mobile-nav-drawer-in{from{transform:translateX(-100%);opacity:0.9}to{transform:translateX(0);opacity:1}}",
  "  .mobile-menu-panel .mobile-menu-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}",
  "  .mobile-menu-panel .mobile-menu-header{padding:14px 14px 12px;border-bottom:1px solid rgba(148,163,184,0.35);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0;background:rgba(15,23,42,0.6)}",
  "  .mobile-menu-panel nav{display:flex;flex-direction:column;padding:8px 0 12px}",
  "  .mobile-menu-panel nav button{width:100%;padding:14px 16px;background:transparent;border:none;color:#e5e7eb;cursor:pointer;text-align:left;font-size:15px;display:flex;align-items:center;gap:12px;border-left:4px solid transparent;-webkit-tap-highlight-color:transparent}",
  "  .mobile-menu-panel nav button.active{background:rgba(248,250,252,0.1);border-left-color:#fbbf24;color:#fff;font-weight:600}",
  "  .mobile-menu-panel .mobile-menu-footer{padding:12px 16px;border-top:1px solid rgba(148,163,184,0.35);font-size:11px;opacity:0.9;line-height:1.45;flex-shrink:0;background:rgba(15,23,42,0.5)}",
  "  .hide-on-mobile{display:none!important}",
  "}",
  "/* Timetable: hide sidebars + edge padding when width is tight; menu button stays available (769–1280). */",
  "@media (max-width:1400px){",
  "  .app-page-timetable .app-right-sidebar{display:none!important}",
  "}",
  "@media (max-width:1280px){",
  "  .app-page-timetable .app-sidebar{display:none!important}",
  "  .app-page-timetable .app-body-row{gap:4px!important}",
  "  .app-page-timetable .app-main{flex:1 1 auto!important;min-width:0!important;width:100%!important;max-width:100%!important}",
  "  .app-page-timetable #print-section{padding:8px max(4px, env(safe-area-inset-left)) 8px max(4px, env(safe-area-inset-right))!important;max-width:100%!important;box-sizing:border-box!important}",
  "  .app-page-timetable .mobile-menu-btn{display:flex!important;align-items:center!important;justify-content:center!important;width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;touch-action:manipulation!important}",
  "}"
].join("\n");

// ─── STAFF PROFILES PAGE ──────────────────────────────────────────────────────
const normalizeStaffCategory = (value) => {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "Teaching";
  if (v.includes("worker") || v.includes("non-teaching") || v.includes("non teaching") || v.includes("labour") || v.includes("labor") || v.includes("support") || v.includes("clerk") || v.includes("peon") || v.includes("naib") || v.includes("qasid") || v.includes("chowkidar") || v.includes("sweeper") || v.includes("driver") || v === "worker staff" || v === "non teaching") return "Non Teaching";
  if (v.includes("teacher") || v.includes("teaching") || v === "teacher staff") return "Teaching";
  return "Teaching";
};

const STAFF_PROFILE_FIELDS = [
  { id: "staffCategory", label: "Staff Category", type: "select", options: ["Teaching", "Non Teaching"] },
  { id: "cpn", label: "CPN (Computer Personal Number)", type: "text" },
  { id: "name", label: "Name Of Officer/Official", type: "text" },
  { id: "fname", label: "Father Name", type: "text" },
  { id: "cnic", label: "CNIC No", type: "text" },
  { id: "bps", label: "General Pay Scale (BPS)", type: "text" },
  { id: "designation", label: "Designation With Cadre", type: "text" },
  { id: "dob", label: "Date of Birth", type: "date" },
  { id: "domicile", label: "Domicile", type: "text" },
  { id: "aq", label: "Academic Qualification", type: "text" },
  { id: "subj", label: "Subject", type: "text" },
  { id: "pq", label: "Professional Qualification", type: "text" },
  { id: "doe", label: "Date Of Entry Into PSMS Services", type: "date" },
  { id: "dprs", label: "Date Of Award Regular Present Scale", type: "date" },
  { id: "dppp", label: "Date Of Posting At Present Place", type: "date" },
  { id: "daps", label: "Date Of Awarded Present Scale", type: "date" },
  { id: "contact", label: "Contact Number", type: "text" },
  { id: "email", label: "Email Address", type: "email" },
  { id: "bankName", label: "Bank Name", type: "text" },
  { id: "accNo", label: "Account Number", type: "text" },
  { id: "iban", label: "IBAN Number", type: "text" },
  { id: "bankCode", label: "Bank Code", type: "text" },
  { id: "branch", label: "Bank Branch Name", type: "text" },
  { id: "address", label: "Permanent Address", type: "textarea" },
  { id: "emergencyContact", label: "Emergency Contact", type: "text" },
  { id: "employeeStatus", label: "Employee Status", type: "select", options: ["Active", "Inactive", "On Leave", "Retired"] },
  { id: "department", label: "Department", type: "text" },
];

// Table header labels; form keeps STAFF_PROFILE_FIELDS labels
const STAFF_PROFILE_TABLE_HEADERS = [
  // Personal Information
  { id: "photo", label: "Photo" },
  { id: "name", label: "Full Name" },
  { id: "fname", label: "Father's Name" },
  { id: "cnic", label: "CNIC" },
  { id: "dob", label: "DOB" },
  { id: "domicile", label: "Domicile" },
  { id: "contact", label: "Contact Number" },
  { id: "email", label: "Email Address" },
  { id: "address", label: "Address" },
  { id: "emergencyContact", label: "Emergency Contact" },
  // Employment & Service Details
  { id: "cpn", label: "Personal#" },
  { id: "staffCategory", label: "Category" },
  { id: "designation", label: "Designation" },
  { id: "bps", label: "BPS" },
  { id: "doe", label: "Date of Employment" },
  { id: "dprs", label: "Date of Present Scale" },
  { id: "dppp", label: "Date of Promotion" },
  { id: "daps", label: "Date of Appointment" },
  // Qualifications
  { id: "aq", label: "Academic Qual" },
  { id: "subj", label: "Subject" },
  { id: "pq", label: "Professional Qual" },
  // Banking & Financial Information
  { id: "bankName", label: "Bank Name" },
  { id: "accNo", label: "Account No" },
  { id: "iban", label: "IBAN" },
  { id: "bankCode", label: "Bank Code" },
  { id: "branch", label: "Branch Name" },
  // System & Action Fields
  { id: "employeeStatus", label: "Status" },
  { id: "department", label: "Department" },
];

const STAFF_TABLE_GROUPS = [
  { title: "Personal Information", count: 10, fields: ["photo", "name", "fname", "cnic", "dob", "domicile", "contact", "email", "address", "emergencyContact"] },
  { title: "Employment & Service Details", count: 8, fields: ["cpn", "staffCategory", "designation", "bps", "doe", "dprs", "dppp", "daps"] },
  { title: "Qualifications", count: 3, fields: ["aq", "subj", "pq"] },
  { title: "Banking & Financial Information", count: 5, fields: ["bankName", "accNo", "iban", "bankCode", "branch"] },
  { title: "System & Action Fields", count: 2, fields: ["employeeStatus", "department"] },
];

const STAFF_PROFILE_HEADING_FIELDS = [
  { key: "schoolCode", label: "SCHOOL CODE" },
  { key: "ddoCode", label: "D.D.O CODE" },
  { key: "na", label: "N.A" },
  { key: "ppNo", label: "P.P.NO" },
  { key: "uc", label: "UC" },
  { key: "tehsil", label: "TEHSIL" },
  { key: "schoolPhoneNo", label: "SCHOOL PHONE NO" },
  { key: "forTheMonth", label: "FOR THE MONTH" },
];

function StaffProfilesPage({ settings = {}, schools = [], staffProfiles, setSchools, activeSchoolId, currentSession }) {
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formTab, setFormTab] = useState("Personal"); // NEW STATE
  const [showSensitive, setShowSensitive] = useState(false); // NEW STATE
  const [tableTab, setTableTab] = useState("Teaching"); // NEW STATE
  const [colTab, setColTab] = useState("All");
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferStaff, setTransferStaff] = useState(null);
  const [transferType, setTransferType] = useState("school");
  const [transferTargetSchoolId, setTransferTargetSchoolId] = useState("");
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const fileInputRef = useRef(null);
  const safeProfiles = Array.isArray(staffProfiles) ? staffProfiles : [];
  const targetSchools = (Array.isArray(schools) ? schools : []).filter((s) => s?.id && s.id !== activeSchoolId && s.status !== "deleted");
  useEffect(() => {
    if (!transferOpen) return;
    if (transferType !== "school") return;
    const stillValid = targetSchools.some((s) => s.id === transferTargetSchoolId);
    queueMicrotask(() => {
      if (!stillValid) setTransferTargetSchoolId(targetSchools[0]?.id || "");
      if (targetSchools.length === 0) setTransferType("retired");
    });
  }, [transferOpen, transferType, transferTargetSchoolId, targetSchools]);

  const handleOpenForm = (profile = null) => {
    if (profile) {
      const normalized = { ...profile };
      normalized.staffCategory = normalizeStaffCategory(normalized.staffCategory);
      ["dob", "doe", "dprs", "dppp", "daps"].forEach((k) => {
        if (normalized[k]) normalized[k] = staffDateToDDMMYYYY(normalized[k]);
      });
      if (normalized.cnic) normalized.cnic = staffFormatCNIC(normalized.cnic);
      if (normalized.contact) normalized.contact = staffFormatPhone(normalized.contact);
      setEditingId(profile.id);
      setFormData(normalized);
    } else {
      setEditingId(null);
      setFormData({ staffCategory: "Teaching", employeeStatus: "Active" });
    }
    setFormTab("Personal");
    setIsFormOpen(true);
  };

  const openTransferDialog = (profile) => {
    setTransferStaff(profile);
    const hasTargetSchool = targetSchools.length > 0;
    setTransferType(hasTargetSchool ? "school" : "retired");
    setTransferTargetSchoolId(hasTargetSchool ? (targetSchools[0]?.id || "") : "");
    setTransferDate(new Date().toISOString().slice(0, 10));
    setTransferOpen(true);
  };

  const handleTransfer = () => {
    if (!transferStaff) return;
    if (transferType === "school" && (!transferTargetSchoolId || !targetSchools.some((s) => s.id === transferTargetSchoolId))) {
      alert("Please select a target school.");
      return;
    }
    const nowIso = new Date().toISOString();
    const transferRecord = {
      id: genId(),
      transferType: transferType === "school" ? "School to School" : "Retired",
      transferDate: transferDate || nowIso.slice(0, 10),
      transferTime: nowIso,
      fromSchoolId: activeSchoolId,
      toSchoolId: transferType === "school" ? transferTargetSchoolId : null,
      staffId: transferStaff.id,
      staffSnapshot: { ...transferStaff, staffCategory: normalizeStaffCategory(transferStaff.staffCategory) },
    };
    setSchools((prev) =>
      prev.map((s) => {
        const isFrom = s.id === activeSchoolId;
        const isTo = transferType === "school" && s.id === transferTargetSchoolId;
        if (!isFrom && !isTo) return s;
        const next = { ...s };
        next.staffTransferHistory = [...(s.staffTransferHistory || []), transferRecord];
        if (isFrom) {
          next.staffProfiles = (s.staffProfiles || []).filter((p) => p.id !== transferStaff.id);
          if (transferType === "retired") {
            next.retiredStaff = [...(s.retiredStaff || []), { ...transferStaff, retiredAt: nowIso, retiredDate: transferDate || nowIso.slice(0, 10) }];
          }
        }
        if (isTo) {
          const moved = {
            ...transferStaff,
            transferInfo: {
              type: "School to School",
              fromSchoolId: activeSchoolId,
              toSchoolId: transferTargetSchoolId,
              transferDate: transferDate || nowIso.slice(0, 10),
              transferTime: nowIso,
            },
          };
          const existing = (s.staffProfiles || []).filter((p) => p.id !== transferStaff.id);
          next.staffProfiles = [...existing, moved];
        }
        return next;
      })
    );
    setTransferOpen(false);
    setTransferStaff(null);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.name) {
      alert("Name is required.");
      return;
    }
    const newId = editingId || genId();
    const payload = { ...formData, id: newId, staffCategory: normalizeStaffCategory(formData.staffCategory) };
    setSchools((prev) =>
      prev.map((s) => {
        if (s.id !== activeSchoolId) return s;
        let nextProfiles = [...(s.staffProfiles || [])];
        if (editingId) {
          nextProfiles = nextProfiles.map((p) => (p.id === editingId ? payload : p));
        } else {
          nextProfiles.push(payload);
        }
        return { ...s, staffProfiles: nextProfiles };
      })
    );
    setIsFormOpen(false);
  };

  const handleDelete = (id) => {
    if (!confirm("Are you sure you want to delete this staff profile?")) return;
    setSchools((prev) =>
      prev.map((s) => {
        if (s.id !== activeSchoolId) return s;
        return { ...s, staffProfiles: (s.staffProfiles || []).filter((p) => p.id !== id) };
      })
    );
  };
  const moveStaffWithinCategory = (id, direction) => {
    setSchools((prev) =>
      prev.map((s) => {
        if (s.id !== activeSchoolId) return s;
        const list = [...(s.staffProfiles || [])];
        const currentIdx = list.findIndex((p) => p.id === id);
        if (currentIdx < 0) return s;
        const currentCategory = normalizeStaffCategory(list[currentIdx].staffCategory);
        const sameCategoryIdxs = list
          .map((p, i) => ({ i, cat: normalizeStaffCategory(p.staffCategory) }))
          .filter((x) => x.cat === currentCategory)
          .map((x) => x.i);
        const posInCat = sameCategoryIdxs.indexOf(currentIdx);
        if (posInCat < 0) return s;
        const targetPos = direction === "up" ? posInCat - 1 : posInCat + 1;
        if (targetPos < 0 || targetPos >= sameCategoryIdxs.length) return s;
        const targetIdx = sameCategoryIdxs[targetPos];
        const temp = list[currentIdx];
        list[currentIdx] = list[targetIdx];
        list[targetIdx] = temp;
        return { ...s, staffProfiles: list };
      })
    );
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFormData((prev) => ({ ...prev, photo: ev.target.result, photoPosition: prev.photoPosition || "50% 50%" }));
      };
      reader.readAsDataURL(file);
    }
  };

  const PHOTO_POSITIONS = [
    { label: "↖", value: "0% 0%" },
    { label: "↑", value: "50% 0%" },
    { label: "↗", value: "100% 0%" },
    { label: "←", value: "0% 50%" },
    { label: "●", value: "50% 50%" },
    { label: "→", value: "100% 50%" },
    { label: "↙", value: "0% 100%" },
    { label: "↓", value: "50% 100%" },
    { label: "↘", value: "100% 100%" },
  ];
  const photoPosition = formData.photoPosition || "50% 50%";

  if (isFormOpen) {
    return (
      <>
        <div style={{ background: "#fff", padding: 24, borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: C.navy, fontSize: 20 }}>{editingId ? "Edit Staff Profile" : "Add Staff Profile"}</h2>
          <Btn outline color={C.gray} onClick={() => setIsFormOpen(false)}><X size={16} style={{ marginRight: 4 }} /> Cancel</Btn>
        </div>

        <form onSubmit={handleSave} style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 32 }}>
          {/* Photo Section */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 160, height: 160, borderRadius: 8, border: "2px dashed #d1d5db", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
              {formData.photo ? (
                <img
                  src={formData.photo}
                  alt="Staff"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: photoPosition,
                  }}
                />
              ) : (
                <div style={{ textAlign: "center", color: C.gray }}>
                  <Upload size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <div style={{ fontSize: 12 }}>Upload Photo</div>
                </div>
              )}
            </div>
            {formData.photo && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.gray }}>Adjust position</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                  {PHOTO_POSITIONS.map((pos) => (
                    <button
                      key={pos.value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, photoPosition: pos.value }))}
                      title={pos.value}
                      style={{
                        width: 28,
                        height: 28,
                        padding: 0,
                        border: photoPosition === pos.value ? "2px solid " + C.navy : "1px solid #d1d5db",
                        borderRadius: 4,
                        background: photoPosition === pos.value ? C.navyL : "#fff",
                        color: photoPosition === pos.value ? C.navy : C.gray,
                        cursor: "pointer",
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <input type="file" ref={fileInputRef} accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />
            <Btn small outline onClick={() => fileInputRef.current?.click()}>Choose Image...</Btn>
            {formData.photo && <Btn small danger style={{ marginTop: -4 }} onClick={() => setFormData({ ...formData, photo: null })}>Remove Photo</Btn>}
          </div>

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Tabs for fields */}
            <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #e5e7eb", paddingBottom: 8, overflowX: "auto" }}>
              {["Personal", "Employment", "Qualifications", "Banking", "System"].map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={(e) => { e.preventDefault(); setFormTab(tab); }}
                  style={{ padding: "6px 12px", borderRadius: 4, border: "none", background: formTab === tab ? C.navy : "#f3f4f6", color: formTab === tab ? "#fff" : C.gray, cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" }}>
            {STAFF_PROFILE_FIELDS.filter(field => {
              const personalFields = ["name", "fname", "cnic", "dob", "domicile", "contact", "email", "address", "emergencyContact"];
              const employmentFields = ["staffCategory", "cpn", "designation", "bps", "doe", "dprs", "dppp", "daps"];
              const qualFields = ["aq", "subj", "pq"];
              const bankingFields = ["bankName", "accNo", "iban", "bankCode", "branch"];
              const systemFields = ["employeeStatus", "department"];

              if (formTab === "Personal") return personalFields.includes(field.id);
              if (formTab === "Employment") return employmentFields.includes(field.id);
              if (formTab === "Qualifications") return qualFields.includes(field.id);
              if (formTab === "Banking") return bankingFields.includes(field.id);
              if (formTab === "System") return systemFields.includes(field.id);
              return true;
            }).map((field) => {
              const isDate = field.type === "date";
              const isTextProper = ["name", "fname", "designation", "domicile", "aq", "subj", "pq", "bankName", "branch", "address"].includes(field.id);
              const value = formData[field.id] || "";
              const handleChange = (e) => {
                let v = e.target.value;
                if (field.id === "iban") v = v.replace(/[\W_]+/g,"").toUpperCase().slice(0, 24); // IBAN structure formatting
                setFormData({ ...formData, [field.id]: v });
              };
              const handleBlur = (e) => {
                const v = e.target.value;
                if (field.id === "cnic") setFormData((prev) => ({ ...prev, [field.id]: staffFormatCNIC(v) }));
                else if (field.id === "contact") setFormData((prev) => ({ ...prev, [field.id]: staffFormatPhone(v) }));
                else if (isDate) setFormData((prev) => ({ ...prev, [field.id]: staffFormatDateInput(v) }));
                else if (isTextProper && field.type !== "email") setFormData((prev) => ({ ...prev, [field.id]: toProperCase(v) }));
              };
              const onChange = (e) => {
                let v = e.target.value;
                if (field.id === "cnic") setFormData({ ...formData, [field.id]: staffFormatCNIC(v) });
                else if (field.id === "contact") setFormData({ ...formData, [field.id]: staffFormatPhone(v) });
                else if (field.id === "iban") setFormData({ ...formData, [field.id]: v.replace(/[\W_]+/g,"").toUpperCase().slice(0, 24) });
                else if (isDate) setFormData({ ...formData, [field.id]: staffFormatDateInput(v) });
                else setFormData({ ...formData, [field.id]: v });
              };
              return (
              <div key={field.id} style={{ gridColumn: field.type === "textarea" ? "1 / span 2" : "auto" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.gray, marginBottom: 4 }}>
                  {field.label} {field.id === "name" && <span style={{ color: C.red }}>*</span>}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    value={value}
                    onChange={handleChange}
                    onBlur={(e) => isTextProper && setFormData((prev) => ({ ...prev, [field.id]: toProperCase(e.target.value) }))}
                    placeholder={`Enter ${field.label}`}
                    style={{ width: "100%", padding: "8px 12px", border: "1.5px solid #d1d5db", borderRadius: 6, fontSize: 13, minHeight: 80, boxSizing: "border-box", fontFamily: "inherit" }}
                  />
                ) : field.type === "select" ? (
                  <select
                    value={value || (field.options && field.options[0]) || ""}
                    onChange={handleChange}
                    style={{ width: "100%", padding: "8px 12px", border: "1.5px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box", background: "#fff" }}
                  >
                    {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    type={isDate ? "text" : field.type}
                    value={value}
                    onChange={onChange}
                    onBlur={handleBlur}
                    placeholder={isDate ? "dd/mm/yyyy" : field.type === "email" ? "" : undefined}
                    maxLength={field.id === "iban" ? 24 : isDate ? 10 : field.id === "cnic" ? 15 : field.id === "contact" ? 12 : undefined}
                    style={{ width: "100%", padding: "8px 12px", border: "1.5px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
                  />
                )}
              </div>
            );})}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 20 }}>
              <Btn outline color={C.gray} onClick={() => setIsFormOpen(false)}>Cancel</Btn>
              <Btn type="submit">Save Profile</Btn>
            </div>
          </div>
        </form>
        </div>
      </>
    );
  }


  const teacherProfiles = safeProfiles.filter((p) => normalizeStaffCategory(p.staffCategory) === "Teaching");
  const workerProfiles = safeProfiles.filter((p) => normalizeStaffCategory(p.staffCategory) === "Non Teaching");

  return (
    <div style={{ background: "#fff", padding: 20, borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", minHeight: "100%" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: safeProfiles.length > 0 ? 12 : 0, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", flex: 1, minWidth: 200 }}>
            {safeProfiles.length > 0 && [{ title: "Teaching", count: teacherProfiles.length }, { title: "Non Teaching", count: workerProfiles.length }].map(({ title, count }) => (
              <button
                key={title}
                type="button"
                onClick={() => setTableTab(title)}
                style={{ padding: "6px 12px", borderRadius: 4, border: "none", background: tableTab === title ? C.navy : "#f3f4f6", color: tableTab === title ? "#fff" : C.gray, cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}
              >
                {title} ({count})
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {safeProfiles.length > 0 && (
              <>
                <button
                  onClick={() => setShowSensitive(!showSensitive)}
                  style={{ background: "#f3f4f6", border: "1px solid #d1d5db", padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 6, color: C.navy }}
                >
                  {showSensitive ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showSensitive ? "Hide Sensitive Data" : "Show Sensitive Data"}
                </button>
                <Btn outline small onClick={() => { const headers = STAFF_PROFILE_TABLE_HEADERS.map((h) => h.label); const rows = safeProfiles.map((p) => STAFF_PROFILE_TABLE_HEADERS.map((h) => { const v = p[h.id]; if (h.id === "staffCategory") return normalizeStaffCategory(p.staffCategory); if (v == null || v === "") return "—"; const s = String(v).trim(); if (["dob", "doe", "dprs", "dppp", "daps"].includes(h.id)) return staffDateToDDMMYYYY(s) || "—"; if (h.id === "cnic") return staffFormatCNIC(s) || "—"; if (h.id === "contact") return staffFormatPhone(s) || "—"; if (["name", "fname", "designation", "domicile", "aq", "subj", "pq", "bankName", "branch", "address"].includes(h.id)) return toProperCase(s) || "—"; return h.id === "photo" ? (p.photo ? "Photo" : "—") : s; })); void exportTableToPdf(settings, currentSession, "Staff Profiles", headers, rows, "Staff_Profiles.pdf").catch(()=>alert("PDF export failed.")); }}>📄 PDF</Btn>
                <Btn outline small onClick={() => { const headers = STAFF_PROFILE_TABLE_HEADERS.map((h) => h.label); const rows = safeProfiles.map((p) => STAFF_PROFILE_TABLE_HEADERS.map((h) => { const v = p[h.id]; if (h.id === "staffCategory") return normalizeStaffCategory(p.staffCategory); if (v == null || v === "") return "—"; const s = String(v).trim(); if (["dob", "doe", "dprs", "dppp", "daps"].includes(h.id)) return staffDateToDDMMYYYY(s) || "—"; if (h.id === "cnic") return staffFormatCNIC(s) || "—"; if (h.id === "contact") return staffFormatPhone(s) || "—"; if (["name", "fname", "designation", "domicile", "aq", "subj", "pq", "bankName", "branch", "address"].includes(h.id)) return toProperCase(s) || "—"; return h.id === "photo" ? (p.photo ? "Photo" : "—") : s; })); void exportTableToExcel(settings, currentSession, "Staff Profiles", headers, rows, "Staff_Profiles.xlsx"); }}>📊 Excel</Btn>
              </>
            )}
            <Btn onClick={() => handleOpenForm()}><Plus size={16} style={{ marginRight: 6, verticalAlign: "middle" }} /> Add Profile</Btn>
          </div>
        </div>
        {safeProfiles.length > 0 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {["All", ...STAFF_TABLE_GROUPS.map(g => g.title)].map(group => (
              <button
                key={group}
                type="button"
                onClick={() => setColTab(group)}
                style={{ padding: "4px 10px", borderRadius: 16, border: "1px solid #cbd5e1", background: colTab === group ? "#e0e7ff" : "#fff", color: colTab === group ? C.navy : C.gray, cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}
              >
                {group}
              </button>
            ))}
          </div>
        )}
      </div>


      {transferOpen && (
        <div style={{ marginBottom: 16, padding: 14, border: "1px solid #cbd5e1", borderRadius: 8, background: "#f8fafc" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <strong style={{ color: C.navy }}>Transfer Staff</strong>
            <Btn small outline color={C.gray} onClick={() => setTransferOpen(false)}>Close</Btn>
          </div>
          <div style={{ fontSize: 12, color: C.gray, marginBottom: 10 }}>
            {transferStaff?.name ? `Staff: ${transferStaff.name}` : "Select transfer details."}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, alignItems: "end" }}>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: C.gray, fontWeight: 600 }}>Transfer Type</label>
              <select value={transferType} onChange={(e) => setTransferType(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 6 }}>
                <option value="school" disabled={targetSchools.length === 0}>School to School</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            {transferType === "school" && (
              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: C.gray, fontWeight: 600 }}>Target School</label>
                <select value={transferTargetSchoolId} onChange={(e) => setTransferTargetSchoolId(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 6 }}>
                  {targetSchools.length === 0 && <option value="">No active target school available</option>}
                  {targetSchools.map((s) => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: C.gray, fontWeight: 600 }}>Transfer Date</label>
              <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 6 }} />
            </div>
            <div>
              <Btn onClick={handleTransfer} disabled={transferType === "school" && targetSchools.length === 0}>Save Transfer</Btn>
            </div>
          </div>
        </div>
      )}
      {safeProfiles.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "#f9fafb", borderRadius: 8, border: "2px dashed #e5e7eb" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👨‍🏫</div>
          <h3 style={{ margin: "0 0 8px", color: C.navy }}>No Staff Profiles Found</h3>
          <p style={{ margin: 0, color: C.gray, fontSize: 13, maxWidth: 400, marginInline: "auto" }}>Get started by adding your first staff profile. You can record comprehensive details including CPN, qualifications, dates of entry, and banking info.</p>
          <br />
          <Btn onClick={() => handleOpenForm()}>Add First Profile</Btn>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 18 }}>

          {[{ title: "Teaching", rows: teacherProfiles }, { title: "Non Teaching", rows: workerProfiles }]
            .filter(section => section.title === tableTab)
            .map((section) => {
              const visibleHeaders = colTab === "All" ? STAFF_PROFILE_TABLE_HEADERS : STAFF_PROFILE_TABLE_HEADERS.filter(h => {
                const isSticky = h.id === "photo" || h.id === "name";
                if (isSticky) return true;
                const group = STAFF_TABLE_GROUPS.find(g => g.title === colTab);
                return group && group.fields.includes(h.id);
              });

              return (
            <div key={section.title} style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              {section.rows.length === 0 ? (
                <div style={{ padding: "14px 12px", color: C.gray, fontSize: 13 }}>No profiles in this category.</div>
              ) : (
                <div style={{ overflowX: "auto", maxHeight: "70vh" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: colTab === "All" ? 900 : 500 }}>
                    <thead>
                      {colTab === "All" && (
                      <tr style={{ background: C.navy, color: "#fff", borderBottom: `1px solid ${C.navyL}` }}>
                        {STAFF_TABLE_GROUPS.map((g, i) => (
                          <th key={g.title} colSpan={g.count} style={{ padding: "8px 12px", textAlign: "center", borderRight: i < STAFF_TABLE_GROUPS.length - 1 ? `1px solid rgba(255,255,255,0.2)` : undefined, fontSize: 13, fontWeight: 700, borderRadius: i === 0 ? "6px 0 0 0" : undefined, position: "sticky", top: 0, zIndex: 4, background: C.navy }}>{g.title}</th>
                        ))}
                        <th rowSpan={2} style={{ padding: "10px 12px", textAlign: "center", borderRadius: "0 6px 0 0", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 4, background: C.navy, verticalAlign: "middle" }}>Actions</th>
                      </tr>
                      )}
                      <tr style={{ background: C.navy, color: "#fff" }}>
                        {visibleHeaders.map((h, i) => {
                          let isBorder = false;
                          if (colTab === "All") {
                            let passed = 0;
                            for (let g of STAFF_TABLE_GROUPS) { passed += g.count; if (i === passed - 1) { isBorder = true; break; } }
                          }
                          return (
                          <th key={h.id} style={{ padding: "10px 12px", textAlign: "left", whiteSpace: "nowrap", borderRight: isBorder && i < visibleHeaders.length - 1 ? `1px solid rgba(255,255,255,0.2)` : undefined, position: "sticky", top: colTab === "All" ? 38 : 0, zIndex: 3, background: C.navy, borderRadius: colTab !== "All" && i === 0 ? "6px 0 0 0" : undefined }}>{h.label}</th>
                          );
                        })}
                        {colTab !== "All" && <th style={{ padding: "10px 12px", textAlign: "center", borderRadius: "0 6px 0 0", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 3, background: C.navy }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((p, i) => {
                        const cellVal = (id) => {
                          if (id === "staffCategory") return normalizeStaffCategory(p.staffCategory);
                          const v = p[id];
                          if (v == null || v === "") return "—";
                          if (typeof v === "object" || typeof v === "function") return "—";
                          const s = String(v).trim();
                          const sensitive = ["cnic", "contact", "accNo", "iban"];
                          if (!showSensitive && sensitive.includes(id)) {
                             if (id === "cnic" && s.length >= 13) return "•••••-•••••••-" + s.slice(-1);
                             if (id === "contact" && s.length >= 11) return s.slice(0, 4) + " ••••• " + s.slice(-2);
                             if ((id === "accNo" || id === "iban") && s.length > 6) return s.slice(0, 4) + "••••••••" + s.slice(-4);
                             return "••••••••";
                          }
                          if (["dob", "doe", "dprs", "dppp", "daps"].includes(id)) return staffDateToDDMMYYYY(s) || "—";
                          if (id === "cnic") return staffFormatCNIC(s) || "—";
                          if (id === "contact") return staffFormatPhone(s) || "—";
                          if (["name", "fname", "designation", "domicile", "aq", "subj", "pq", "bankName", "branch", "address"].includes(id)) return toProperCase(s) || "—";
                          return s;
                        };
                        return (
                        <tr key={p.id != null ? p.id : `row-${i}`} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#f9fafb" : "#fff" }}>
                          {visibleHeaders.map((h) => (
                            <td key={h.id} style={{ padding: "10px 12px", color: h.id === "name" ? C.navy : "inherit", fontWeight: h.id === "name" ? 600 : 400, maxWidth: 180, verticalAlign: h.id === "photo" ? "middle" : "top" }}>
                              {h.id === "photo" ? (
                                p.photo && typeof p.photo === "string" ? (
                                  <img src={p.photo} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", objectPosition: p.photoPosition || "50% 50%" }} />
                                ) : (
                                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#e5e7eb", color: C.gray, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                                    {(p.name && typeof p.name === "string" ? p.name.charAt(0) : "?")}
                                  </div>
                                )
                              ) : (
                                cellVal(h.id)
                              )}
                            </td>
                          ))}
                          <td style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              <button onClick={() => handleOpenForm(p)} style={{ background: "#dbeafe", color: "#1e40af", border: "none", padding: 6, borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center" }} title="Edit">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleDelete(p.id)} style={{ background: "#fee2e2", color: "#b91c1c", border: "none", padding: 6, borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center" }} title="Delete">
                                <Trash2 size={14} />
                              </button>
                              <button onClick={() => moveStaffWithinCategory(p.id, "up")} style={{ background: "#f8fafc", color: C.navy, border: "1px solid #cbd5e1", padding: "6px 8px", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", fontSize: 12, fontWeight: 700 }} title="Move Up">
                                ↑
                              </button>
                              <button onClick={() => moveStaffWithinCategory(p.id, "down")} style={{ background: "#f8fafc", color: C.navy, border: "1px solid #cbd5e1", padding: "6px 8px", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", fontSize: 12, fontWeight: 700 }} title="Move Down">
                                ↓
                              </button>
                              <button onClick={() => openTransferDialog(p)} style={{ background: "#ecfeff", color: "#155e75", border: "none", padding: "6px 8px", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", fontSize: 12, fontWeight: 700 }} title="Transfer">
                                Transfer
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
function IdCardStudentQRCode({ student, clsName, settings }) {
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
const StudentQRCode = IdCardStudentQRCode;

function IdCardStaffQRCode({ profile, settings }) {
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
const StaffQRCode = IdCardStaffQRCode;

// ─── STUDENT CARD GENERATOR (on demand: class + roll and/or admission #) ───────
function parseRollTokensToSet(input) {
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

function parseAdmissionTokens(input) {
  return String(input || "")
    .split(/[,،]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function StudentCardGeneratorPage({ settings, students, currentSession }) {
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
const STAFF_CARD_WIDTH_MM = 2.4 * 25.4;  // ≈ 60.96mm
const STAFF_CARD_HEIGHT_MM = 3.5 * 25.4; // ≈ 88.90mm

function StaffCardGeneratorPage({ settings = {}, staffProfiles = [] }) {
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
const CARD_TABS=[{id:"staff",label:"Staff Cards",i:"🪪"},{id:"student",label:"Student Cards",i:"💳"}];
function CardGeneratorPage({settings,students,currentSession,staffProfiles,setBarSubtitle}){
  const [cardTab,setCardTab]=useState("staff");
  useEffect(()=>{
    if(!setBarSubtitle) return;
    const t=CARD_TABS.find(x=>x.id===cardTab);
    setBarSubtitle(t?.label||"");
  },[cardTab,setBarSubtitle]);
  return <div>
    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      {CARD_TABS.map(t=><button key={t.id} onClick={()=>setCardTab(t.id)} style={{padding:"8px 14px",borderRadius:6,border:cardTab===t.id?"2px solid "+C.navy:"1px solid #d1d5db",background:cardTab===t.id?C.navyL:"#fff",color:cardTab===t.id?C.navy:"#374151",fontWeight:cardTab===t.id?700:500,fontSize:13,cursor:"pointer"}}><span style={{marginRight:6}}>{t.i}</span>{t.label}</button>)}
    </div>
    {cardTab==="student"&&<StudentCardGeneratorPage settings={settings} students={students} currentSession={currentSession}/>}
    {cardTab==="staff"&&<StaffCardGeneratorPage settings={settings} staffProfiles={staffProfiles}/>}
  </div>;
}

// ─── FEE COLLECTION MODULE ───────────────────────────────────────────────────────
function FeePage({ settings, students, activeSchoolId, setBarSubtitle }) {
  useEffect(() => {
    setBarSubtitle(`${feeCore.FEE_AMOUNT} Rs per student per month`);
    return () => setBarSubtitle("");
  }, [setBarSubtitle]);

  const classes = useMemo(() => (settings.classes || []), [settings.classes]);

  const [feeRecords, setFeeRecords] = useState(() => {
    return feeService.load(activeSchoolId || "");
  });

  useEffect(() => {
    if (activeSchoolId) {
      setFeeRecords(feeService.load(activeSchoolId));
    }
  }, [activeSchoolId]);

  useEffect(() => {
    if (activeSchoolId) {
      feeService.save(activeSchoolId, feeRecords);
    }
  }, [activeSchoolId, feeRecords]);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });

  const [viewMode, setViewMode] = useState('summary'); // 'summary' | 'class-detail'
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saving, setSaving] = useState(null); // studentId being saved

  const saveFeeRecords = (newRecords) => {
    setFeeRecords(newRecords);
  };

  const toggleFeePayment = (studentId, classId, studentName) => {
    setSaving(studentId);
    try {
      const feeStatus = feeService.studentStatus(feeRecords, { classId, studentId, month: selectedMonth.month, year: selectedMonth.year });

      let newRecords;
      if (feeStatus.paid) {
        // Remove payment (mark as unpaid)
        newRecords = feeService.remove(feeRecords, studentId, classId, selectedMonth.month, selectedMonth.year);
        alert(`Fee marked as UNPAID for ${studentName}`);
      } else {
        // Add payment (mark as paid)
        newRecords = feeService.markStudent(feeRecords, { studentId, classId, month: selectedMonth.month, year: selectedMonth.year });
        alert(`Fee marked as PAID for ${studentName} - Rs. ${feeCore.FEE_AMOUNT}`);
      }
      saveFeeRecords(newRecords);
    } finally {
      setSaving(null);
    }
  };

  const markAllClassPaid = (classId) => {
    const classObj = monthlySummary.find(c => String(c.classId) === String(classId));
    if (!classObj) return;
    
    if (confirm(`Mark all ${classObj.totalStudents} students in ${classObj.className} as PAID for ${getCurrentMonthName()} ${selectedMonth.year}?`)) {
      try {
        const newRecords = feeService.markAll(feeRecords, { classId, month: selectedMonth.month, year: selectedMonth.year, students, classes });
        saveFeeRecords(newRecords);
        alert(`All ${classObj.totalStudents} students marked as PAID - ${feeService.formatCurrency(classObj.expectedAmount)}`);
      } catch {
        alert('Failed to mark all as paid. Please try again.');
      }
    }
  };

  const monthlySummary = useMemo(() => {
    return feeService.summary(feeRecords, classes, selectedMonth.month, selectedMonth.year, students);
  }, [feeRecords, classes, students, selectedMonth.month, selectedMonth.year]);

  const totalCollection = useMemo(() => {
    return monthlySummary.reduce((sum, cls) => sum + cls.collectedAmount, 0);
  }, [monthlySummary]);

  const totalExpected = useMemo(() => {
    return monthlySummary.reduce((sum, cls) => sum + cls.expectedAmount, 0);
  }, [monthlySummary]);

  const handleMonthChange = (e) => {
    const [year, month] = e.target.value.split('-').map(Number);
    setSelectedMonth({ month, year });
  };

  const handleClassClick = (classId) => {
    setSelectedClassId(classId);
    setViewMode('class-detail');
  };

  const goBack = () => {
    setViewMode('summary');
    setSelectedClassId(null);
  };

  const getCurrentMonthName = () => {
    return feeService.months().find(m => m.value === selectedMonth.month)?.label || '';
  };

  const generateClassPdf = async (classObj) => {
    setPdfLoading(true);
    try {
      const classStudents = students.filter(s => s.classId === classObj.classId);
      const classRecords = feeRecords.filter(
        rec => rec.classId === classObj.classId && rec.month === selectedMonth.month && rec.year === selectedMonth.year
      );

      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(`Fee Collection Report - ${classObj.className}`, 14, 22);
      doc.setFontSize(12);
      doc.text(`Month: ${getCurrentMonthName()} ${selectedMonth.year}`, 14, 30);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 38);

      const tableData = classStudents.map(student => {
        const status = classRecords.find(r => r.studentId === student.id);
        return [
          student.rollNo || '-',
          student.admissionNo || '-',
          student.name || '',
          student.fatherName || '',
          status ? feeCore.formatCurrency(feeCore.FEE_AMOUNT) : '-',
          status ? 'Paid' : 'Pending'
        ];
      });

      autoTable(doc, {
        head: [['Roll No', 'Adm No', 'Name', 'Father Name', 'Amount', 'Status']],
        body: tableData,
        startY: 48,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        alternateRowStyles: { fillColor: [240, 240, 240] }
      });

      const finalY = doc.lastAutoTable.finalY + 10;
      doc.text(`Total Students: ${classStudents.length}`, 14, finalY);
      doc.text(`Paid: ${classRecords.length}`, 14, finalY + 8);
      doc.text(`Pending: ${classStudents.length - classRecords.length}`, 14, finalY + 16);
      doc.text(`Collected: ${feeCore.formatCurrency(classObj.collectedAmount)}`, 14, finalY + 24);

      doc.save(`Fee_Collection_${classObj.className}_${getCurrentMonthName()}_${selectedMonth.year}.pdf`);
      alert('PDF downloaded successfully!');
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  if (viewMode === 'class-detail' && selectedClassId) {
    const classObj = monthlySummary.find(c => String(c.classId) === String(selectedClassId));
    if (!classObj) return <div className="fees-page">Class not found</div>;

    return (
      <div className="fees-page">
        <button onClick={goBack} style={{ marginBottom: 16, padding: '8px 16px', cursor: 'pointer' }}>
          ← Back to Summary
        </button>
        <div className="fees-class-detail">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2>{classObj.className} - Fee Details</h2>
            <button
              onClick={() => generateClassPdf(classObj)}
              disabled={pdfLoading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: pdfLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <Download size={16} />
              {pdfLoading ? 'Generating...' : 'Export PDF'}
            </button>
          </div>

          <div style={{ marginBottom: 20, color: '#6b7280', fontSize: 14 }}>
            Month: {getCurrentMonthName()} {selectedMonth.year} • Total Students: {classObj.totalStudents} • Paid: {classObj.paidCount} • Pending: {classObj.pendingCount}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              onClick={() => markAllClassPaid(classObj.classId)}
              disabled={classObj.pendingCount === 0}
              style={{
                padding: '8px 16px',
                backgroundColor: classObj.pendingCount === 0 ? '#9ca3af' : '#16a34a',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: classObj.pendingCount === 0 ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              ✓ Mark All Paid ({classObj.pendingCount} pending)
            </button>
          </div>

          <div className="fees-students-table" style={{ overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f3f4f6' }}>
                <tr>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Roll No</th>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Admission No</th>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Father Name</th>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const classStudents = students.filter(s => {
                    const studentClass = resolveClass(settings.classes, s.classId);
                    return studentClass && String(studentClass.id) === String(classObj.classId);
                  });
                  if (classStudents.length === 0) {
                    return (
                      <tr>
                        <td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>
                          No students in this class
                        </td>
                      </tr>
                    );
                  }

                  return classStudents.map(student => {
                    const feeStatus = feeService.studentStatus(feeRecords, { classId: classObj.classId, studentId: student.id, month: selectedMonth.month, year: selectedMonth.year });
                    const feeRecord = feeStatus.record;
                    return (
                      <tr key={student.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: 12 }}>{student.rollNo || '-'}</td>
                        <td style={{ padding: 12 }}>{student.admissionNo || '-'}</td>
                        <td style={{ padding: 12 }}>{student.name || ''}</td>
                        <td style={{ padding: 12 }}>{student.fatherName || ''}</td>
                        <td style={{ padding: 12 }}>{feeRecord ? feeService.formatCurrency(feeCore.FEE_AMOUNT) : '-'}</td>
                        <td style={{ padding: 12 }}>
                          <span style={{
                            backgroundColor: feeStatus.paid ? '#dcfce7' : '#fee2e2',
                            color: feeStatus.paid ? '#16a34a' : '#dc2626',
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 500
                          }}>
                            {feeStatus.paid ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                        <td style={{ padding: 12 }}>
                          {feeRecord ? new Date(feeRecord.paidAt).toLocaleDateString() : '-'}
                        </td>
                        <td style={{ padding: 12, textAlign: 'center' }}>
                          <button
                            onClick={() => toggleFeePayment(student.id, classObj.classId, student.name)}
                            disabled={saving === student.id}
                            title={feeStatus.paid ? 'Mark as Unpaid' : 'Mark as Paid'}
                            style={{
                              padding: '6px 10px',
                              border: 'none',
                              borderRadius: 4,
                              backgroundColor: feeStatus.paid ? '#fef3c7' : '#dcfce7',
                              color: feeStatus.paid ? '#d97706' : '#16a34a',
                              cursor: saving === student.id ? 'wait' : 'pointer',
                              fontSize: 12,
                              fontWeight: 500,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              margin: '0 auto'
                            }}
                          >
                            {saving === student.id ? '...' : (feeStatus.paid ? '← Unmark' : '✓ Mark')}
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 20, fontSize: 14, color: '#374151' }}>
            <div>Total Students: <strong>{classObj.totalStudents}</strong></div>
            <div>Paid: <strong style={{ color: '#16a34a' }}>{classObj.paidCount}</strong></div>
            <div>Pending: <strong style={{ color: '#dc2626' }}>{classObj.pendingCount}</strong></div>
            <div>Collected: <strong>{feeCore.formatCurrency(classObj.collectedAmount)}</strong></div>
            <div>Pending Amount: <strong style={{ color: '#dc2626' }}>{feeCore.formatCurrency(classObj.pendingAmount)}</strong></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fees-page">
      <div className="fees-summary" style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827' }}>Fee Collection</h1>
          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: 14 }}>
            Monthly fee collection summary - {feeCore.formatCurrency(feeCore.FEE_AMOUNT)} per student
          </p>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: '#374151' }}>
              Select Month
            </label>
            <input
              type="month"
              value={`${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`}
              onChange={handleMonthChange}
              style={{
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                width: 180
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: 20,
            borderRadius: 12,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>Total Expected</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{feeCore.formatCurrency(totalExpected)}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{monthlySummary.length} Classes</div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
            color: 'white',
            padding: 20,
            borderRadius: 12,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>Total Collected</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{feeCore.formatCurrency(totalCollection)}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
              {totalExpected > 0 ? ((totalCollection / totalExpected) * 100).toFixed(1) : 0}% collection rate
            </div>
          </div>

          <div style={{
            background: totalCollection >= totalExpected
              ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
              : 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            color: 'white',
            padding: 20,
            borderRadius: 12,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>Pending Amount</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{feeCore.formatCurrency(totalExpected - totalCollection)}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
              {totalExpected - totalCollection > 0 ? `${((totalExpected - totalCollection) / feeCore.FEE_AMOUNT).toFixed(0)} students pending` : 'All collected!'}
            </div>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>
              Class-wise Collection Summary
            </h3>
          </div>

          {monthlySummary.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
              <p>No classes configured. Please add classes in Settings.</p>
            </div>
          ) : (
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f3f4f6' }}>
                  <tr>
                    <th style={{ padding: 14, textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>Class</th>
                    <th style={{ padding: 14, textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>Students</th>
                    <th style={{ padding: 14, textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>Paid</th>
                    <th style={{ padding: 14, textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>Pending</th>
                    <th style={{ padding: 14, textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>Expected</th>
                    <th style={{ padding: 14, textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>Collected</th>
                    <th style={{ padding: 14, textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>Pending Amt</th>
                    <th style={{ padding: 14, textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySummary.map(cls => (
                    <tr key={cls.classId} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background-color 0.15s' }} onClick={() => handleClassClick(cls.classId)} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: 14, fontWeight: 500, color: '#111827' }}>{cls.className}</td>
                      <td style={{ padding: 14, textAlign: 'center', color: '#6b7280' }}>{cls.totalStudents}</td>
                      <td style={{ padding: 14, textAlign: 'center' }}>
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>{cls.paidCount}</span>
                      </td>
                      <td style={{ padding: 14, textAlign: 'center' }}>
                        <span style={{ color: cls.pendingCount > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{cls.pendingCount}</span>
                      </td>
                      <td style={{ padding: 14, textAlign: 'right', color: '#6b7280' }}>{feeCore.formatCurrency(cls.expectedAmount)}</td>
                      <td style={{ padding: 14, textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>{feeCore.formatCurrency(cls.collectedAmount)}</td>
                      <td style={{ padding: 14, textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>{feeCore.formatCurrency(cls.pendingAmount)}</td>
                      <td style={{ padding: 14, textAlign: 'center' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleClassClick(cls.classId); }}
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: 6,
                            background: 'white',
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 500,
                            color: '#374151'
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ marginTop: 24, padding: 16, backgroundColor: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <AlertTriangle size={20} style={{ color: '#d97706', flexShrink: 0 }} />
            <div style={{ fontSize: 14, color: '#92400e' }}>
              <strong>Note:</strong> Each student pays {feeCore.formatCurrency(feeCore.FEE_AMOUNT)} per month. Click on any class row or "View Details" button to see individual student payment status and generate a PDF report for that class.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

const ATTENDANCE_DATA_KEY = "system_management_attendance";
function loadAttendanceFromLocal(schoolId) {
  try {
    if (typeof window === "undefined" || !schoolId) return {};
    const raw = window.localStorage.getItem(ATTENDANCE_DATA_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data[schoolId] && typeof data[schoolId] === "object" ? data[schoolId] : {};
  } catch { return {}; }
}
function saveAttendanceToLocal(schoolId, att) {
  try {
    if (typeof window === "undefined" || !schoolId) return;
    const raw = window.localStorage.getItem(ATTENDANCE_DATA_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[schoolId] = att && typeof att === "object" ? att : {};
    window.localStorage.setItem(ATTENDANCE_DATA_KEY, JSON.stringify(data));
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
    <div className={page==="timetable"?"app-layout app-page-timetable":"app-layout"} style={{display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden",fontFamily:UI.fontApp,background:UI.shellBg,padding:page==="timetable"?"0 max(6px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(6px, env(safe-area-inset-left))":"0 10px 10px",boxSizing:"border-box"}}>
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
          background:"linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(30,64,175,0.96) 55%, rgba(59,130,246,0.94) 100%)",
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
      <aside
        className="app-right-sidebar no-print"
        style={{
          width:272,
          flexShrink:0,
          height:"100%",
          minHeight:0,
          overflowY:"auto",
          overflowX:"hidden",
          background:"#fff",
          borderRadius:12,
          border:"1px solid #e2e8f0",
          boxShadow:"0 2px 12px rgba(15,23,42,0.06)",
          display:"flex",
          flexDirection:"column",
          gap:12,
          padding:14,
          boxSizing:"border-box",
        }}
      >
        <div>
          <div style={{fontFamily:UI.fontHeading,fontWeight:800,fontSize:12,color:C.navy,marginBottom:10,letterSpacing:"0.02em"}}>Updates and tips</div>
          <div style={{borderRadius:10,background:"linear-gradient(135deg,#eff6ff 0%,#f8fafc 100%)",border:"1px solid #bfdbfe",padding:12,marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:800,color:"#1d4ed8",marginBottom:4}}>Stay organised</div>
            <p style={{margin:0,fontSize:11,color:"#334155",lineHeight:1.45}}>Pin attendance and exam prep in your routine—consistency keeps records audit-ready.</p>
          </div>
          <div style={{borderRadius:10,background:"#f8fafc",border:"1px dashed #cbd5e1",padding:12}}>
            <div style={{fontSize:10,fontWeight:700,color:C.gray,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Community</div>
            <p style={{margin:0,fontSize:11,color:"#64748b",lineHeight:1.45}}>Follow your school board or publisher for exam schedules and resource drops—placeholder for social or promo links.</p>
          </div>
        </div>
      </aside>
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