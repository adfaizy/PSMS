import { systemSettingsService } from "@/services";
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

export function getPeriodLabel(idx,settings){
  const n=idx+1;
  const prefix=settings&&settings.periodLabelPrefix!=null?settings.periodLabelPrefix:"P-";
  return `${prefix}${n}`;
}
/**
 * Two-line period + time for timetable `<th>` cells.
 * jspdf-autotable `parseCellContent` strips literal `\n` from innerHTML; only `<br>` survives as a PDF line break.
 */
export function timetablePdfPeriodCell(label, timeRange) {
  return (
    <>
      {String(label)}
      <br />
      {String(timeRange)}
    </>
  );
}

export function formatGradeLabel(grade) { return systemSettingsService?.formatGradeLabel?.(grade) || ""; }
export function formatClassDisplay(cls) { return systemSettingsService?.formatClassDisplay?.(cls) || ""; }
export function resolveClass(classes, classId) { return systemSettingsService?.resolveClass?.(classes, classId) || null; }
export function getClassLabel(settingsOrClasses, classId) { return systemSettingsService?.getClassLabel?.(settingsOrClasses, classId) || String(classId || ""); }
export function normKey(x) { return systemSettingsService?.normKey?.(x) || String(x || "").trim().toLowerCase(); }

export function getClassSubjects(settings,classId,type="exam"){
  if(!classId) return [];
  const source=type==="timetable" ? settings?.classSubjectsTimetable : settings?.classSubjectsExam;
  if(source&&Array.isArray(source[classId])) return source[classId];
  const legacy=settings?.classSubjects;
  if(legacy&&Array.isArray(legacy[classId])) return legacy[classId];
  return [];
}
export function isTeachingStaffMember(staff){
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
export function teachingStaffList(settings,staffProfiles){
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
export function normalizeRollNo(roll){
  const s=normKey(roll);
  if(/^\d+$/.test(s)){
    const n=parseInt(s,10);
    return Number.isNaN(n)?s:String(n);
  }
  return s;
}
export function findStudentByAdmissionNo(students,admissionNo,excludeId){
  const k=normKey(admissionNo);
  if(!k) return null;
  for(const s of students||[]){
    if(excludeId&&s.id===excludeId) continue;
    if(normKey(s.admissionNo)===k) return s;
  }
  return null;
}
export function getRollNumberScopeClassIds(classes,classId,commonTeachers){
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
export function findStudentByRollInClass(students,classes,classId,rollNo,excludeId,commonTeachers){
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
export function maxNumericFromAdmissionStrings(students){
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
export function nextAdmissionNo(students){
  return String(maxNumericFromAdmissionStrings(students)+1);
}
export function maxRollInClass(students,classes,classId,commonTeachers){
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
export function nextRollNoForClass(students,classes,classId,commonTeachers){
  return String(maxRollInClass(students,classes,classId,commonTeachers)+1);
}
/**
 * Excel import: strip Adm# when it duplicates another person (within file or vs DB). Keeps row data.
 */
export function stripDuplicateAdmissionsForImport(importedStudents,merged,allClasses){
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
export const IMGLY_BACKGROUND_REMOVAL_DATA_VER ="1.7.0";
export const IMGLY_BG_MODEL_BASE_URL =`https://staticimgly.com/@imgly/background-removal-data/${IMGLY_BACKGROUND_REMOVAL_DATA_VER}/dist/`;

export async function processStudentPhotoWithBackground(file){
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
export function dedupeStudentsByIdentity(students,classes){
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

export function fmtMin(m){
  if(m===undefined||m===null) return "--";
  const h=Math.floor(m/60), mm=m%60;
  const sfx=h>=12?"PM":"AM", hh=h>12?h-12:h===0?12:h;
  return `${hh}:${String(mm).padStart(2,"0")} ${sfx}`;
}
export function academicSession(d=new Date()){
  const y=d.getFullYear();
  const m=d.getMonth(); // 0-indexed
  // Session changes in April: e.g. Apr 2025 -> 2025-2026, Jan 2025 -> 2024-2025
  if(m>=3) return `${y}-${y+1}`;
  return `${y-1}-${y}`;
}

export function calcTimes(settings, day){
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

export function getTT(tt,cls,day,pi){ return tt?.[cls]?.[day]?.[pi]||{subject:"",teacher:""}; }
export function setTT(setFn,cls,day,pi,val){ setFn(p=>{ const c=p[cls]||{}, n={...c}; ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].forEach(d=>n[d]={...(c[d]||{}),[pi]:val}); return {...p,[cls]:n}; }); }
/** Update one weekday only (Class Planner); `setTT` mirrors the same slot to all days (Classes grid). */
export function setTTSingleDay(setFn,cls,day,pi,val){ setFn(p=>{ const c=p[cls]||{}, n={...c}; n[day]={...(c[day]||{}),[pi]:val}; return {...p,[cls]:n}; }); }
export function parseABVariantSubject(subject){
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
export function isABCounterpartSubject(a,b){
  const pa=parseABVariantSubject(a);
  const pb=parseABVariantSubject(b);
  if(!pa||!pb) return false;
  return pa.base===pb.base&&pa.variant!==pb.variant;
}

export function getClassesByPortion(classes,portion){
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
export function getStaffInPortion(settings,timetable,portion,staffProfiles){
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
export const DEFAULT_PRINT_PORTION_MASK ={primary:true,middle:true,high:true};
export function isPortionMaskFull(mask){
  return !!(mask&&mask.primary&&mask.middle&&mask.high);
}
export function formatPortionMaskLabel(mask){
  if(isPortionMaskFull(mask)) return "Full";
  const parts=[];
  if(mask.primary) parts.push("Primary");
  if(mask.middle) parts.push("Middle");
  if(mask.high) parts.push("High");
  return parts.join(" + ")||"—";
}
/** Union of classes in every selected portion (Primary / Middle / High). All three = full list. */
export function getClassesByPortionMask(classes,mask){
  if(!Array.isArray(classes)) return [];
  if(!mask||isPortionMaskFull(mask)) return classes;
  const map=new Map();
  if(mask.primary) getClassesByPortion(classes,"primary").forEach(c=>map.set(c.id,c));
  if(mask.middle) getClassesByPortion(classes,"middle").forEach(c=>map.set(c.id,c));
  if(mask.high) getClassesByPortion(classes,"high").forEach(c=>map.set(c.id,c));
  return Array.from(map.values());
}
export function getStaffInPortionMask(settings,timetable,mask,staffProfiles){
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


export async function downloadExcel(wb, filename) {
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

export function pdfDataUrlFormat(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return "PNG";
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) return "JPEG";
  return "PNG";
}
export async function brandingLogoDataUrlForPdf(settingsLogo) {
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
export const PDF_HEADER_LOGO_MM = 14;
export async function addPdfBrandingLogoRow(doc, settingsLogo, left, yTop) {
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
export function getExportHeaderMeta(settings, session, tableName){
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
export function sanitizePdfFilenamePart(raw) {
  const s = String(raw || "export")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return (s || "export").slice(0, 72);
}
export async function exportTableToExcel(settings, session, tableName, columnHeaders, dataRows, filename) {
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
export function sanitizePdfCell(val) {
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
export function sanitizePdfTableRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => (Array.isArray(row) ? row.map(sanitizePdfCell) : []));
}

/** Same summary blocks as `ByTeacherView` footer — for teacher planner PDF only (not Faculty / TEACHERS). */
export function teacherPlannerFooterColumns(settings) {
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

export function drawTeacherPlannerFooterColumn(doc, x, colW, y0, col) {
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
export function appendTeacherPlannerScheduleFooterPdf(doc, settings, tableEndY) {
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

export function isTeacherPlannerTimetablePdfTitle(tableName) {
  return /\bTEACHER\s+TIMETABLE\b/i.test(String(tableName || ""));
}

/**
 * Appends branding header + one table to the current page of `doc` (used by single-file export and multi-section timetable batch PDF).
 * @param {HTMLTableElement} [htmlTableEl] — when set for timetable exports, use autotable `html` mode (fixes colspan/rowspan vs manual matrix).
 * @param {{ subtitleOverride?: string }} [exportPdfOptions] — optional PDF header subtitle (e.g. class-first attendance titles).
 */
export async function appendExportTablePdfSection(doc, settings, session, tableName, columnHeaders, dataRows, htmlTableEl, exportPdfOptions) {
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
  /** Timetable PDFs (Classes / Faculty / Class planner / Teacher planner): green header, solid borders. */
  const timetablePdfTable = isTimetableGridExport
    ? {
        headStyles: {
          fillColor: [21, 128, 61],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
          cellPadding: 2,
          fontSize: 7,
          overflow: "linebreak",
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
export async function exportTimetableBatchPlannerPdf(settings, session, sections, filename) {
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
export async function exportTableToPdf(settings, session, tableName, columnHeaders, dataRows, filename, htmlTableEl, exportPdfOptions) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await appendExportTablePdfSection(doc, settings, session, tableName, columnHeaders, dataRows, htmlTableEl, exportPdfOptions);
  doc.save(filename || "export.pdf");
}

/** Consolidated marks PDF: logo + school, session, exam, sheet title, class, counts, date/time on every page. */
export async function exportConsolidatedSheetToPdf(settings, session, exam, className, columnHeaders, dataRows, filename) {
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

export function getTableDataFromElement(containerEl) {
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
export function parseMarksImportCell(raw){
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
export function excelDateToDDMMYYYY(v){
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
export function staffDateToDDMMYYYY(val) {
  if (val == null || val === "") return "";
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  return s;
}
export function staffFormatCNIC(val) {
  if (val == null) return "";
  const digits = String(val).replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return digits.slice(0, 5) + "-" + digits.slice(5);
  return digits.slice(0, 5) + "-" + digits.slice(5, 12) + "-" + digits.slice(12, 13);
}
export function staffFormatPhone(val) {
  if (val == null) return "";
  const digits = String(val).replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  return digits.slice(0, 4) + " " + digits.slice(4);
}
export function toProperCase(str) {
  if (str == null || typeof str !== "string") return "";
  return str.trim().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, " ");
}
/** Title-case while typing: normalizes internal spaces but keeps trailing spaces so gaps between words can be entered. */
export function toProperCaseNameInput(str) {
  if (str == null || typeof str !== "string") return "";
  const trailing = str.match(/\s*$/)[0];
  const head = str.slice(0, str.length - trailing.length);
  const collapsed = head.replace(/^\s+/, "").replace(/\s+/g, " ");
  if (!collapsed && !trailing) return "";
  const titled = collapsed.replace(/\b\w/g, (c) => c.toUpperCase());
  return titled + trailing;
}
export function staffFormatDateInput(val) {
  if (val == null || val === "") return "";
  const s = String(val).trim();
  const digits = s.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4, 8);
}
/** Map result-card class labels (One, Nine Arts, …) to grade/section. */
export function parseResultCardClassLabel(label) {
  const raw = String(label || "").trim();
  if (!raw) return null;
  const WORD_GRADE = {
    ece: "ECE", nursery: "Nursery", kg: "Nursery", prep: "Nursery",
    one: "1", two: "2", three: "3", four: "4", five: "5",
    six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  };
  const m = raw.match(/^(ece|nursery|kg|prep|one|two|three|four|five|six|seven|eight|nine|ten)\b(?:\s+(.+))?$/i);
  if (m) {
    return {
      grade: WORD_GRADE[m[1].toLowerCase()],
      section: (m[2] || "").trim(),
      name: raw,
    };
  }
  const num = raw.match(/^(?:class|grade)?\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-_ ]\s*(.+))?$/i);
  if (num) {
    return {
      grade: String(parseInt(num[1], 10)),
      section: (num[2] || "").trim(),
      name: raw,
    };
  }
  return { grade: raw, section: "", name: raw };
}

export function mapResultCardExamName(examStr) {
  const s = String(examStr || "").toLowerCase();
  if (/\bmid\b/.test(s)) return "Mid Term";
  if (/\bfinal\b/.test(s)) return "Final Term";
  if (/\bannual\b/.test(s)) return "Annual";
  if (/\b(1st|first)\b/.test(s) || /\bterm\s*1\b/.test(s)) return "1st Term";
  return "1st Term";
}

/**
 * Parse a Result Card "Source" sheet:
 * - SCHOOL SETTINGS (School Name, Exam, Principal, …)
 * - CLASSES AND CLASS TEACHER INCHARGE (Class | Class Teacher Incharge | Sheet Name)
 * - CLASS SUBJECTS AND TOTAL MARKS (Class | Subject | Total Marks)
 */
export function parseResultCardSource(rows) {
  const empty = { meta: {}, classes: [], subjectsByClassId: {}, totals: [], examKey: "1st Term" };
  if (!Array.isArray(rows) || !rows.length) return empty;
  const cell = (r, i) => String(r?.[i] ?? "").trim();
  const meta = {};
  for (const row of rows) {
    const k = cell(row, 0);
    const v = cell(row, 1);
    if (!k || !v) continue;
    const kl = k.toLowerCase();
    if (kl === "school name") meta.schoolName = v;
    else if (kl === "exam") meta.exam = v;
    else if (kl === "principal") meta.principalName = v;
    else if (kl === "principal title") meta.principalDesignation = v;
    else if (kl === "teacher title") meta.teacherTitle = v;
    else if (kl === "session") meta.session = v;
  }

  let classHeaderIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const a = cell(rows[i], 0).toLowerCase();
    const b = cell(rows[i], 1).toLowerCase();
    if (a === "class" && b.includes("teacher")) {
      classHeaderIdx = i;
      break;
    }
  }

  const classes = [];
  const aliasToId = {};
  if (classHeaderIdx >= 0) {
    for (let j = classHeaderIdx + 1; j < rows.length; j++) {
      const classLabel = cell(rows[j], 0);
      if (!classLabel) {
        if (classes.length) break;
        continue;
      }
      const lower = classLabel.toLowerCase();
      if (lower === "class" && cell(rows[j], 1).toLowerCase() === "subject") break;
      if (/^(class subjects|school settings|classes and)/i.test(classLabel)) break;
      const teacher = cell(rows[j], 1);
      const sheetName = cell(rows[j], 2) || classLabel;
      const parsed = parseResultCardClassLabel(classLabel);
      const id = sheetName || classLabel;
      classes.push({
        id,
        name: parsed?.name || classLabel,
        grade: parsed?.grade || classLabel,
        section: parsed?.section || "",
        teacher,
        sheetName,
      });
      aliasToId[sheetName.toLowerCase()] = id;
      aliasToId[classLabel.toLowerCase()] = id;
    }
  }

  let subjHeaderIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (cell(rows[i], 0).toLowerCase() === "class" && cell(rows[i], 1).toLowerCase() === "subject") {
      subjHeaderIdx = i;
      break;
    }
  }

  const subjectsByClassId = {};
  const totals = [];
  if (subjHeaderIdx >= 0) {
    for (let j = subjHeaderIdx + 1; j < rows.length; j++) {
      const classLabel = cell(rows[j], 0);
      const subject = cell(rows[j], 1);
      const total = cell(rows[j], 2);
      if (!subject) continue;
      if (!classLabel) continue;
      const id = aliasToId[classLabel.toLowerCase()] || classLabel;
      if (!subjectsByClassId[id]) subjectsByClassId[id] = [];
      if (!subjectsByClassId[id].includes(subject)) subjectsByClassId[id].push(subject);
      if (total !== "" && !Number.isNaN(Number(total))) {
        totals.push({ classId: id, subject, totalMarks: String(total) });
      }
    }
  }

  if (!classes.length && Object.keys(subjectsByClassId).length) {
    for (const id of Object.keys(subjectsByClassId)) {
      const parsed = parseResultCardClassLabel(id);
      classes.push({
        id,
        name: parsed?.name || id,
        grade: parsed?.grade || id,
        section: parsed?.section || "",
        teacher: "",
        sheetName: id,
      });
    }
  }

  return {
    meta,
    classes,
    subjectsByClassId,
    totals,
    examKey: mapResultCardExamName(meta.exam),
  };
}

/** Subject columns on a class sheet (skip identity columns). */
export function subjectsFromClassSheetHeader(headerRow) {
  const skip = new Set([
    "roll no", "roll#", "roll", "adm#", "admission no", "admission", "adm",
    "name", "student name", "father's name", "father name", "fname", "father",
    "date of birth", "dob", "birthdate", "form b", "bay form", "bay", "cnic",
    "father cnic", "whatsapp", "mobile", "phone", "contact", "class", "class id",
  ]);
  return (Array.isArray(headerRow) ? headerRow : [])
    .map((h) => String(h || "").trim())
    .filter((h) => {
      if (!h) return false;
      const n = h.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
      return Boolean(n) && !skip.has(n);
    });
}

export function parseWorkbook(file, cb){
  const r = new FileReader();
  r.onerror = () => cb(new Error("Could not read file. Make sure it is a valid .xlsx or .xls file."), null);
  r.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: "array" });
      const getSheet = (name) => {
        const sh = wb.Sheets[name];
        return sh ? XLSX.utils.sheet_to_json(sh, { header: 1, defval: "" }) : null;
      };
      const findSheet = (wanted) => {
        const target = String(wanted || "").trim().toLowerCase();
        const hit = (Array.isArray(wb.SheetNames) ? wb.SheetNames : []).find(
          (n) => String(n || "").trim().toLowerCase() === target
        );
        return hit ? getSheet(hit) : null;
      };
      const sheetNames = Array.isArray(wb.SheetNames) ? wb.SheetNames : [];
      const reserved = new Set([
        "general",
        "classes & subjects",
        "classes",
        "class",
        "staff profiles",
        "staff profile",
        "staff",
        "student records",
        "students",
        "source",
      ]);
      const classSheets = sheetNames
        .filter((n) => !reserved.has(String(n || "").trim().toLowerCase()))
        .map((name) => ({ name, rows: getSheet(name) }))
        .filter((s) => Array.isArray(s.rows) && s.rows.length >= 2);
      cb(null, {
        General: findSheet("General"),
        Classes: findSheet("Classes & Subjects") || findSheet("Classes") || findSheet("Class"),
        Staff: findSheet("Staff Profiles") || findSheet("Staff Profile") || findSheet("Staff"),
        Students: findSheet("Student Records") || findSheet("Students"),
        Source: findSheet("Source"),
        ClassSheets: classSheets,
        SheetNames: sheetNames,
      });
    } catch (err) {
      cb(err, null);
    }
  };
  r.readAsArrayBuffer(file);
}

export function getTeachersWithAssignments(settings,timetable){
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

export const normalizeStaffCategory = (value) => {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "Teaching";
  if (v.includes("worker") || v.includes("non-teaching") || v.includes("non teaching") || v.includes("labour") || v.includes("labor") || v.includes("support") || v.includes("clerk") || v.includes("peon") || v.includes("naib") || v.includes("qasid") || v.includes("chowkidar") || v.includes("sweeper") || v.includes("driver") || v === "worker staff" || v === "non teaching") return "Non Teaching";
  if (v.includes("teacher") || v.includes("teaching") || v === "teacher staff") return "Teaching";
  return "Teaching";
};
