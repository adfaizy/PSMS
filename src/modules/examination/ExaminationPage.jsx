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
import { consumeNavIntent } from "@/lib/navIntent.js";
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
  processStudentPhotoWithBackground,
  preloadStudentPhotoAi,
  readStudentPhotoAsJpeg,
  isStudentPhotoFile,
  isDisplayablePhotoSrc,
  STUDENT_PHOTO_EXT_RE,
} = H;

const jsPDF =
  typeof jsPDFModule === "function"
    ? jsPDFModule
    : jsPDFModule?.jsPDF ?? jsPDFModule?.default;

const EXAM_TABS = [
  { id: "admission", l: "Admission" },
  { id: "record", l: "Student Records" },
  { id: "marks", l: "Marks Entry" },
  { id: "consolidated", l: "Consolidated Sheet" },
  { id: "card", l: "Result Cards" },
  { id: "datesheet", l: "Date Sheet" },
];

/** Optional decorative border image for result cards; empty = CSS borders only */
const RESULT_CARD_BORDER_URL = "";
const RC_SERIF = '"Times New Roman", Times, Georgia, serif';

function resultCardOrdinal(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 1) return "—";
  const j = num % 10;
  const k = num % 100;
  if (k >= 11 && k <= 13) return `${num}th`;
  if (j === 1) return `${num}st`;
  if (j === 2) return `${num}nd`;
  if (j === 3) return `${num}rd`;
  return `${num}th`;
}

function resultCardTeacherRemarks(pctStr, status, passThreshold = 50) {
  if (status === "FAIL") return "Needs improvement. Extra effort required.";
  const p = parseFloat(pctStr);
  if (Number.isNaN(p)) return "Keep working hard.";
  if (p >= 90) return "Outstanding performance. Keep it up!";
  if (p >= 80) return "Excellent work. Well done!";
  if (p >= 70) return "Very good performance. Keep improving.";
  if (p >= 60) return "Good effort. Aim higher next term.";
  if (p >= passThreshold) return "Satisfactory. Continue to work hard.";
  return "Needs improvement. Extra effort required.";
}

function studentPhotoInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "SP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Circular school stamp: logo in center, school name curved along the rim. */
function ResultCardSchoolStamp({ logoSrc, schoolName, size = 92 }) {
  const reactId = React.useId();
  const pathId = `seal-top-${String(reactId).replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const name = String(schoolName || "SCHOOL").trim().toUpperCase() || "SCHOOL";
  const fontSize = name.length > 32 ? 4.8 : name.length > 24 ? 5.4 : name.length > 16 ? 6 : 6.8;
  const letterSpacing = name.length > 28 ? 0.4 : name.length > 18 ? 0.8 : 1.2;
  return (
    <div
      className="result-card-school-stamp"
      style={{ width: size, height: size, margin: "0 auto", position: "relative", flexShrink: 0 }}
      title={name}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: "block", overflow: "visible" }}>
        <defs>
          {/* Upper arc (left → right over the top) for curved school name */}
          <path id={pathId} d="M 10,58 A 40,40 0 0,1 90,58" fill="none" />
        </defs>
        <circle cx="50" cy="50" r="49" fill="#fff" stroke="#111" strokeWidth="2.2" />
        <circle cx="50" cy="50" r="43" fill="none" stroke="#111" strokeWidth="0.9" />
        <image
          href={logoSrc}
          xlinkHref={logoSrc}
          x="26"
          y="30"
          width="48"
          height="48"
          preserveAspectRatio="xMidYMid meet"
        />
        <text
          fill="#111"
          fontSize={fontSize}
          fontWeight="800"
          fontFamily={RC_SERIF}
          letterSpacing={letterSpacing}
          style={{ textTransform: "uppercase" }}
        >
          <textPath href={`#${pathId}`} xlinkHref={`#${pathId}`} startOffset="50%" textAnchor="middle">
            {name}
          </textPath>
        </text>
      </svg>
    </div>
  );
}

/** Formal result-card header matching consolidated statement design; data from settings. */
export function ResultCardHeader({
  settings,
  sessionLabel,
  examLabel,
  className,
  photo,
  studentName,
}) {
  const schoolName = String(settings?.schoolName || "").trim() || "School Name";
  const motto =
    String(settings?.schoolMotto || settings?.institutionName || "").trim() ||
    "KNOWLEDGE · CHARACTER · EXCELLENCE";
  const initials = studentPhotoInitials(studentName);
  return (
    <div className="result-card-doc-header print-header-universal" style={{ marginBottom: 10 }}>
      <div
        className="result-card-header-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 68px) minmax(0, 1fr) minmax(0, 80px)",
          gap: 10,
          alignItems: "start",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          overflow: "visible",
        }}
      >
        <div className="result-card-header-logo" style={{ display: "flex", justifyContent: "center", paddingTop: 2, minWidth: 0, maxWidth: "100%" }}>
          <img
            src={schoolOrBrandLogo(settings?.logo)}
            alt=""
            style={{
              width: "100%",
              maxWidth: 64,
              aspectRatio: "1",
              height: "auto",
              objectFit: "contain",
              borderRadius: "50%",
              border: "1.5px solid #111",
              background: "#fff",
            }}
          />
        </div>
        <div style={{ textAlign: "center", minWidth: 0, maxWidth: "100%", overflow: "visible", fontFamily: RC_SERIF }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: "#222",
              textTransform: "uppercase",
              marginBottom: 4,
              lineHeight: 1.5,
            }}
          >
            {motto}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#000",
              lineHeight: 1.45,
              textTransform: "uppercase",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            }}
          >
            {schoolName}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              fontWeight: 600,
              color: "#222",
              textTransform: "uppercase",
              lineHeight: 1.5,
              overflowWrap: "anywhere",
            }}
          >
            {examLabel || "—"}
          </div>
          <div
            style={{
              marginTop: 8,
              background: "#111",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              padding: "8px 10px",
              textTransform: "uppercase",
              lineHeight: 1.5,
            }}
          >
            Consolidated Result Statement
          </div>
          <div
            className="result-card-class-name"
            style={{
              marginTop: 8,
              marginBottom: 4,
              fontSize: 13,
              fontWeight: 800,
              textTransform: "uppercase",
              lineHeight: 1.65,
              paddingTop: 6,
              paddingBottom: 10,
              overflow: "visible",
              display: "block",
              minHeight: "1.65em",
            }}
          >
            {className || "—"}
          </div>
        </div>
        <div
          className="result-card-header-photo"
          style={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            border: "2px solid #111",
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minHeight: 96,
            boxSizing: "border-box",
            aspectRatio: "4 / 5",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fafafa",
              minHeight: 0,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {isDisplayablePhotoSrc(photo) ? (
              <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ textAlign: "center", padding: 4, maxWidth: "100%", boxSizing: "border-box" }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#111",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto",
                    fontSize: 12,
                    fontWeight: 800,
                    fontFamily: RC_SERIF,
                  }}
                >
                  {initials}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


export function MarksInput({initialValue,onSave,rowIdx,colIdx,totalRows,totalCols,inputStyle}){
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
export function ExaminationPage({settings:settingsProp,setSettings,students:studentsProp,setStudents,timetable,exam_tm:exam_tmProp,exam_om:exam_omProp,setExamMarks,exam_datesheet:exam_datesheetProp,setDatesheet,currentSession,currentUser,activeSchoolId,setBarSubtitle}){
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
  useEffect(()=>{
    const intent=consumeNavIntent();
    if(!intent||intent.page&&intent.page!=="examination") return;
    const allowed=new Set(EXAM_TABS.map(t=>t.id));
    if(intent.tab&&allowed.has(intent.tab)) setTab(intent.tab);
  },[]);
  const admissionEmpty={admissionNo:"",rollNo:"",name:"",fatherName:"",classId:settings.classes[0]?.id||"",dob:"",bayForm:"",fatherCnic:"",whatsapp:"",photo:null};
  const [admissionForm,setAdmissionForm]=useState(admissionEmpty);
  const admissionPhotoGalleryRef=useRef(null);
  const admissionPhotoCameraRef=useRef(null);
  const [admissionPhotoBusy,setAdmissionPhotoBusy]=useState(false);
  const [admissionPhotoStatus,setAdmissionPhotoStatus]=useState("");
  const [admissionSaving,setAdmissionSaving]=useState(false);
  const admissionSaveLockRef=useRef(false);
  // Warm AI background-removal model while user is on Admission tab
  useEffect(()=>{
    if(tab!=="admission") return;
    void preloadStudentPhotoAi();
  },[tab]);
  const suggestedNextAdm=useMemo(()=>nextAdmissionNo(students),[students]);
  const suggestedNextRoll=useMemo(()=>nextRollNoForClass(students,settings.classes,admissionForm.classId,settings.commonTeachers),[students,settings.classes,admissionForm.classId,settings.commonTeachers]);
  const formatDobAf=(v)=>{ const d=String(v||"").replace(/\D/g,"").slice(0,8); if(d.length<=2) return d; if(d.length<=4) return d.slice(0,2)+"/"+d.slice(2); return d.slice(0,2)+"/"+d.slice(2,4)+"/"+d.slice(4); };
  const formatCnicAf=(v)=>{ const d=(v||"").replace(/\D/g,"").slice(0,13); if(d.length<=5) return d; if(d.length<=12) return d.slice(0,5)+"-"+d.slice(5); return d.slice(0,5)+"-"+d.slice(5,12)+"-"+d.slice(12); };
  const formatWhatsappAf=(v)=>{ const d=(v||"").replace(/\D/g,"").slice(0,11); if(d.length<=4) return d; return d.slice(0,4)+"-"+d.slice(4); };
  const toWorldwidePhoto=async (dataUrl, studentId)=>{
    if(!dataUrl||!isDisplayablePhotoSrc(dataUrl)) return dataUrl;
    if(/^https?:\/\//i.test(dataUrl)) return dataUrl;
    try{
      const { uploadDataUrlPhoto }=await import("../../lib/photoStorage.js");
      const prefix=`${activeSchoolId||"school"}/students/${studentId||"new"}`;
      return await uploadDataUrlPhoto(dataUrl, prefix);
    }catch(err){
      console.warn("Photo cloud upload skipped", err);
      return dataUrl;
    }
  };
  const handleAdmissionPhotoFile=async (f)=>{
    if(!f) return;
    if(!isStudentPhotoFile(f)){
      alert("Please choose an image file (any format: JPG, PNG, WEBP, HEIC, etc.).");
      return;
    }
    setAdmissionPhotoBusy(true);
    setAdmissionPhotoStatus("Preparing…");
    try{
      const data=await processStudentPhotoWithBackground(f,{
        onProgress:(msg)=>setAdmissionPhotoStatus(String(msg||"Processing…")),
      });
      if(!data){ alert("Could not process this photo. Try another image."); return; }
      setAdmissionPhotoStatus("Uploading…");
      const worldwide=await toWorldwidePhoto(data, admissionForm.id||"admission");
      setAdmissionForm(x=>({...x,photo:worldwide}));
    }catch(err){
      console.error("Admission photo failed",err);
      alert("Photo upload failed: "+(err?.message||String(err)));
    }finally{
      setAdmissionPhotoBusy(false);
      setAdmissionPhotoStatus("");
    }
  };
  const saveAdmission=async ()=>{
    if(admissionSaveLockRef.current||admissionSaving) return;
    if(!(admissionForm.name||"").trim()){ alert("Please enter Student Name."); return; }
    admissionSaveLockRef.current=true;
    setAdmissionSaving(true);
    try{
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
      let photo=admissionForm.photo||null;
      if(photo&&String(photo).startsWith("data:image")) photo=await toWorldwidePhoto(photo, id);
      const payload={
        ...admissionForm,
        name,
        fatherName,
        admissionNo,
        rollNo,
        id,
        photo,
        personalInfoLockSession: null,
        personalInfoHistory: [],
      };
      setStudents(s=>[...s,payload]);
      setAdmissionForm(admissionEmpty);
      alert("Student admitted successfully. Open Student Records to review the entry.");
    }catch(err){
      console.error("Admission save failed", err);
      alert("Could not admit student: "+(err?.message||String(err)));
    }finally{
      admissionSaveLockRef.current=false;
      setAdmissionSaving(false);
    }
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
  const resultCardH2cOpts={
    scale:RESULT_CARD_PDF_H2C_SCALE,
    backgroundColor:"#ffffff",
    useCORS:true,
    logging:false,
    foreignObjectRendering:false,
    // Prevent responsive/overflow rules from clipping text in the cloned DOM used for PDF.
    onclone:(clonedDoc)=>{
      clonedDoc.body?.classList?.add("result-card-capturing");
      clonedDoc.querySelectorAll(
        ".result-card-border-inner,.result-card-grade-cell,.result-card-grade-range,.result-card-grade-letter,.result-card-sign-name,.result-card-sign-title,.result-card-footer-sign,.result-card-sign-block,.result-card-header-grid,.result-card-class-name,.result-card-doc-header"
      ).forEach((node)=>{
        node.style.overflow="visible";
        node.style.textOverflow="clip";
        node.style.whiteSpace="normal";
        node.style.lineHeight="1.55";
      });
      clonedDoc.querySelectorAll(".result-card-class-name").forEach((node)=>{
        node.style.fontSize="13px";
        node.style.fontWeight="800";
        node.style.lineHeight="1.65";
        node.style.paddingTop="6px";
        node.style.paddingBottom="10px";
        node.style.overflow="visible";
        node.style.display="block";
        node.style.minHeight="1.65em";
      });
      const layout=clonedDoc.querySelector(".app-layout");
      if(layout){
        layout.style.zoom="1";
        layout.style.transform="none";
        layout.style.width="100vw";
        layout.style.maxWidth="100vw";
        layout.style.height="auto";
      }
      clonedDoc.querySelectorAll(".result-card-grade-range").forEach((node)=>{
        node.style.fontSize="9px";
        node.style.fontWeight="700";
      });
      clonedDoc.querySelectorAll(".result-card-grade-letter").forEach((node)=>{
        node.style.fontSize="12px";
      });
      clonedDoc.querySelectorAll(".result-card-sign-name").forEach((node)=>{
        node.style.fontSize="12px";
      });
      clonedDoc.querySelectorAll(".result-card-sign-title").forEach((node)=>{
        node.style.fontSize="9px";
      });
    },
  };
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
    const presentExams=presentExamsForCard(mode,classId,st.id);
    const examLabelRaw=mode==="overall"
      ?(presentExams.length?presentExams.join(" + "):"Overall")
      :String(mode||"—");
    const sessionLabel=String(currentSession||"").trim()||academicSession();
    const sessionYear=String(sessionLabel).match(/\d{4}/)?.[0]||"";
    const examLabel=mode==="overall"
      ?`OVERALL RESULT${sessionYear?` ${sessionYear}`:""}`
      :`${String(examLabelRaw).toUpperCase()}${sessionYear?` ${sessionYear}`:""}`;
    const promoBanner=settings.banner;
    const resultSigSrc=settings.resultCardSignature||signImg;
    const principalName=(String(settings.resultCardStampLine1||"").trim()||String(settings.principalName||"").trim()||"Principal");
    const principalTitle=(String(settings.principalDesignation||"").trim()||"PRINCIPAL").toUpperCase();
    const inchargeTitle="CLASS INCHARGE";
    const classStrength=cs(classId).length;
    const positionLabel=resultCardOrdinal(myPosition);
    const remarks=resultCardTeacherRemarks(o.pctStr,o.status,passThreshold);
    const subjectList=subjs(classId);
    const gradeScale=[
      { range: "80%-100%", grade: "A+" },
      { range: "70%-79%", grade: "A" },
      { range: "60%-69%", grade: "B" },
      { range: "50%-59%", grade: "C" },
      { range: "40%-49%", grade: "D" },
      { range: `Below ${passThreshold}%`, grade: "F" },
    ];
    const infoCell=(label,value)=>(
      <div
        style={{
          display:"flex",
          flexDirection:"column",
          justifyContent:"flex-end",
          minHeight:30,
          padding:"8px 0 6px",
          marginBottom:2,
          borderBottom:"1px dotted #555",
          boxSizing:"border-box",
          fontFamily:RC_SERIF,
        }}
      >
        <div style={{display:"flex",alignItems:"baseline",gap:8,minWidth:0,lineHeight:1.5}}>
          <span style={{fontSize:12,fontWeight:700,color:"#000",flexShrink:0,lineHeight:1.5}}>{label}:</span>
          <span style={{fontSize:12,fontWeight:700,color:"#000",lineHeight:1.5,wordBreak:"break-word"}}>{value||"—"}</span>
        </div>
      </div>
    );
    const summaryBox=(label,value)=>(
      <div className="result-card-summary-box" style={{flex:"1 1 0",minWidth:0,border:"1.5px solid #111",textAlign:"center",boxSizing:"border-box"}}>
        <div className="result-card-summary-label" style={{background:"#111",color:"#fff",fontSize:8,fontWeight:800,padding:"6px 2px",lineHeight:1.45,textTransform:"uppercase"}}>{label}</div>
        <div className="result-card-summary-value" style={{padding:"10px 2px",fontSize:13,fontWeight:800,fontFamily:RC_SERIF,lineHeight:1.45}}>{value}</div>
      </div>
    );
    return <div key={st.id} className="result-card-page-wrap" style={{maxWidth:736,margin:"0 auto 28px",padding:"0 10px",boxSizing:"border-box",pageBreakAfter:"always",page:"resultCard"}}>
      <div id={cardRef?"result-card":undefined} ref={cardRef} className="result-card-capture-root" style={{position:"relative",background:"transparent"}}>
      <div className="result-card-border-outer" style={{border:"3px solid #111",boxSizing:"border-box",width:"100%",background:"#fff",padding:5}}>
      <div className="result-card-border-inner" style={{position:"relative",padding:"16px 18px 20px",background:"#fff",border:"1.5px solid #111",boxSizing:"border-box",overflow:"visible",...(RESULT_CARD_BORDER_URL?{backgroundImage:`url(${RESULT_CARD_BORDER_URL})`,backgroundRepeat:"no-repeat",backgroundPosition:"center",backgroundSize:"contain"}:{}),...(promoBanner?{}:{minHeight:980})}}>
        <div aria-hidden style={{position:"absolute",top:6,left:6,width:14,height:14,borderTop:"2.5px solid #111",borderLeft:"2.5px solid #111",pointerEvents:"none"}}/>
        <div aria-hidden style={{position:"absolute",top:6,right:6,width:14,height:14,borderTop:"2.5px solid #111",borderRight:"2.5px solid #111",pointerEvents:"none"}}/>
        <div aria-hidden style={{position:"absolute",bottom:6,left:6,width:14,height:14,borderBottom:"2.5px solid #111",borderLeft:"2.5px solid #111",pointerEvents:"none"}}/>
        <div aria-hidden style={{position:"absolute",bottom:6,right:6,width:14,height:14,borderBottom:"2.5px solid #111",borderRight:"2.5px solid #111",pointerEvents:"none"}}/>
      <ResultCardHeader
        settings={settings}
        sessionLabel={sessionLabel}
        examLabel={examLabel}
        className={className}
        photo={st.photo}
        studentName={st.name}
      />
      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",columnGap:28,rowGap:0,marginBottom:14,alignItems:"stretch",width:"100%",minWidth:0}} className="result-card-info-grid">
        <div style={{display:"flex",flexDirection:"column",justifyContent:"center"}}>
          {infoCell("Student Name", st.name)}
          {infoCell("Father's Name", st.fatherName)}
          {infoCell("Admission No", st.admissionNo)}
        </div>
        <div style={{display:"flex",flexDirection:"column",justifyContent:"center"}}>
          {infoCell("Roll No.", st.rollNo)}
          {infoCell("Class Strength", classStrength)}
          {infoCell("Session", sessionLabel)}
        </div>
      </div>
      <div style={{textAlign:"center",fontFamily:RC_SERIF,fontWeight:800,fontSize:12,margin:"6px 0 10px",textTransform:"uppercase",lineHeight:1.4,paddingBottom:2}}>
        Statement of Marks
      </div>
      <table style={{borderCollapse:"collapse",fontSize:12,width:"100%",background:"#fff",fontFamily:RC_SERIF,border:"1.5px solid #111",lineHeight:1.4}}>
        <thead>
          <tr style={{background:"#111",color:"#fff"}}>
            {["SR.","SUBJECT","TOTAL","OBTAINED","%","GRADE"].map((h)=>(
              <th key={h} style={{padding:"8px 6px",textAlign:h==="SUBJECT"?"left":"center",fontWeight:800,fontSize:10,lineHeight:1.4,verticalAlign:"middle",borderRight:h==="GRADE"?"none":"1px solid #333"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subjectList.map((subj,i)=>{
            const s=subjectStat(mode,classId,st.id,subj);
            const cellPad={padding:"7px 6px",lineHeight:1.4,verticalAlign:"middle",borderTop:"1px solid #ccc"};
            return <tr key={subj} style={{background:"#fff"}}>
              <td style={{...cellPad,textAlign:"center",borderRight:"1px solid #ddd",fontWeight:600}}>{i+1}</td>
              <td style={{...cellPad,paddingLeft:8,textAlign:"left",borderRight:"1px solid #ddd",fontWeight:700}}>{subj}</td>
              <td style={{...cellPad,textAlign:"center",borderRight:"1px solid #ddd"}}>{s.tot>0?s.tot:"—"}</td>
              <td style={{...cellPad,textAlign:"center",borderRight:"1px solid #ddd"}}>{s.tot>0?s.obt:"—"}</td>
              <td style={{...cellPad,textAlign:"center",borderRight:"1px solid #ddd"}}>{s.pctStr==="—"?"—":`${s.pctStr}%`}</td>
              <td style={{...cellPad,textAlign:"center",fontWeight:700}}>{s.gradeStr}</td>
            </tr>;
          })}
          <tr style={{background:"#fff",fontWeight:800,borderTop:"2px solid #111"}}>
            <td style={{padding:"8px 6px",textAlign:"center",borderRight:"1px solid #ddd",lineHeight:1.4,verticalAlign:"middle"}} colSpan={2}>TOTAL</td>
            <td style={{padding:"8px 6px",textAlign:"center",borderRight:"1px solid #ddd",lineHeight:1.4,verticalAlign:"middle"}}>{o.tot>0?o.tot:"—"}</td>
            <td style={{padding:"8px 6px",textAlign:"center",borderRight:"1px solid #ddd",lineHeight:1.4,verticalAlign:"middle"}}>{o.tot>0?o.obt:"—"}</td>
            <td style={{padding:"8px 6px",textAlign:"center",borderRight:"1px solid #ddd",lineHeight:1.4,verticalAlign:"middle"}}>{o.pctStr==="—"?"—":`${o.pctStr}%`}</td>
            <td style={{padding:"8px 6px",textAlign:"center",lineHeight:1.4,verticalAlign:"middle"}}>{o.gradeStr}</td>
          </tr>
        </tbody>
      </table>
      <div className="result-card-summary-row" style={{display:"flex",flexWrap:"nowrap",gap:6,marginTop:10,width:"100%",minWidth:0,boxSizing:"border-box"}}>
        {summaryBox("Obtained", o.tot>0?`${o.obt} / ${o.tot}`:"—")}
        {summaryBox("Percentage", o.pctStr==="—"?"—":`${o.pctStr}%`)}
        {summaryBox("Grade", o.gradeStr)}
        {summaryBox("Position", positionLabel)}
        {summaryBox("Status", o.status)}
      </div>
      <div style={{marginTop:12,border:"1.5px solid #111"}}>
        <div style={{textAlign:"center",fontSize:9,fontWeight:800,padding:"6px 6px",borderBottom:"1px solid #111",textTransform:"uppercase",fontFamily:RC_SERIF,lineHeight:1.5}}>Grading Scale</div>
        <div className="result-card-grade-scale" style={{display:"grid",gridTemplateColumns:`repeat(${gradeScale.length},minmax(0,1fr))`,width:"100%",minWidth:0}}>
          {gradeScale.map((g,i)=>(
            <div key={g.grade} className="result-card-grade-cell" style={{borderRight:i===gradeScale.length-1?"none":"1px solid #ccc",textAlign:"center",padding:"8px 3px 9px",minWidth:0,overflow:"visible",boxSizing:"border-box"}}>
              <div className="result-card-grade-range" style={{fontSize:9,fontWeight:700,fontFamily:RC_SERIF,lineHeight:1.55,whiteSpace:"normal",overflow:"visible"}}>{g.range}</div>
              <div className="result-card-grade-letter" style={{fontSize:12,fontWeight:800,marginTop:4,fontFamily:RC_SERIF,lineHeight:1.45,overflow:"visible"}}>{g.grade}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{marginTop:12}}>
        <div style={{background:"#111",color:"#fff",textAlign:"center",fontSize:10,fontWeight:800,padding:"7px 8px",textTransform:"uppercase",lineHeight:1.4}}>Teacher Remarks</div>
        <div style={{border:"1.5px solid #111",borderTop:"none",padding:"12px 12px",fontFamily:RC_SERIF,fontStyle:"italic",fontSize:13,fontWeight:600,minHeight:40,lineHeight:1.45}}>
          {remarks}
        </div>
      </div>
      <div className="result-card-footer-sign" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto minmax(0,1fr)",gap:8,alignItems:"end",marginTop:28,paddingTop:8,paddingBottom:8,width:"100%",boxSizing:"border-box",minWidth:0,overflow:"visible"}}>
        <div className="result-card-sign-block" style={{textAlign:"center",fontFamily:RC_SERIF,minWidth:0,overflow:"visible"}}>
          <div style={{minHeight:44}}/>
          <div style={{borderTop:"1.5px solid #111",paddingTop:8,paddingBottom:4,margin:"0 auto",width:"90%",maxWidth:"100%",boxSizing:"border-box"}}>
            <div className="result-card-sign-name" style={{fontSize:12,fontWeight:800,lineHeight:1.45}}>{classTeacher||"—"}</div>
            <div className="result-card-sign-title" style={{fontSize:9,fontWeight:700,marginTop:4,lineHeight:1.45}}>{inchargeTitle}</div>
          </div>
        </div>
        <div className="result-card-sign-seal" style={{textAlign:"center",paddingBottom:8,flexShrink:0}}>
          <ResultCardSchoolStamp
            logoSrc={schoolOrBrandLogo(settings?.logo)}
            schoolName={String(settings?.schoolName||"").trim()||"School Seal"}
            size={96}
          />
        </div>
        <div className="result-card-sign-block" style={{textAlign:"center",fontFamily:RC_SERIF,position:"relative",minWidth:0,overflow:"visible"}}>
          <div style={{minHeight:44,position:"relative"}}>
            <img className="result-card-sign-img" src={resultSigSrc} alt="" style={{width:110,maxWidth:"100%",position:"absolute",left:"50%",bottom:2,transform:"translateX(-50%)",opacity:0.95}}/>
          </div>
          <div style={{borderTop:"1.5px solid #111",paddingTop:8,paddingBottom:4,margin:"0 auto",width:"90%",maxWidth:"100%",boxSizing:"border-box"}}>
            <div className="result-card-sign-name" style={{fontSize:12,fontWeight:800,lineHeight:1.45}}>{principalName}</div>
            <div className="result-card-sign-title" style={{fontSize:9,fontWeight:700,marginTop:4,lineHeight:1.45}}>{principalTitle}</div>
          </div>
        </div>
      </div>
      {promoBanner ? (
        <div
          className="result-card-promo-banner"
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid #ccc",
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
    document.body.classList.add("result-card-capturing");
    try{
      await new Promise((r)=>requestAnimationFrame(r));
      const canvas=await html2canvas(el,resultCardH2cOpts);
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
      document.body.classList.remove("result-card-capturing");
      setSinglePdfBusy(false);
    }
  };

  useEffect(()=>{
    if(!classPdfExportList?.length) return undefined;
    let cancelled=false;
    const run=async()=>{
      document.body.classList.add("result-card-capturing");
      await new Promise((r)=>requestAnimationFrame(r));
      if(cancelled) return;
      const container=classResultPdfContainerRef.current;
      if(!container){
        document.body.classList.remove("result-card-capturing");
        setClassPdfExportList(null);
        setClassPdfBusy(false);
        return;
      }
      const roots=container.querySelectorAll(".result-card-capture-root");
      if(!roots.length){
        document.body.classList.remove("result-card-capturing");
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
          const batch=await Promise.all(slice.map((node)=>html2canvas(node,resultCardH2cOpts)));
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
        document.body.classList.remove("result-card-capturing");
        if(!cancelled){
          setClassPdfExportList(null);
          setClassPdfBusy(false);
        }
      }
    };
    void run();
    return()=>{ cancelled=true; document.body.classList.remove("result-card-capturing"); };
    // Intentionally only classPdfExportList: avoid re-running when settings/rc* identity changes mid-export.
  },[classPdfExportList]);

  useEffect(()=>{
    if(!setBarSubtitle) return;
    const t=EXAM_TABS.find(x=>x.id===tab);
    setBarSubtitle(t?.l||"");
  },[tab,setBarSubtitle]);

  const ctrlW = 180;
  const panel = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
  };
  const toolbar = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 16px",
    marginBottom: 14,
  };
  const thBase = {
    padding: "9px 10px",
    whiteSpace: "nowrap",
    fontWeight: 700,
    fontSize: 12,
    color: "#fff",
    background: "#1B5E20",
    position: "sticky",
    top: 0,
    zIndex: 3,
  };

  return (
    <div className="psms-page" style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16, width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <div className="no-print psms-toolbar" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-start", gap: 10 }}>
        <div style={{ display: "inline-flex", flexWrap: "wrap", background: "#e8f5e9", borderRadius: 10, padding: 4, gap: 4, border: "1px solid #c8e6c9", maxWidth: "100%" }}>
          {EXAM_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                border: "none",
                cursor: "pointer",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
                background: tab === t.id ? "#1B5E20" : "transparent",
                color: tab === t.id ? "#fff" : "#1B5E20",
                whiteSpace: "nowrap",
              }}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {tab === "admission" && (
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <SchoolHeader settings={settings} subtitle="STUDENT ADMISSION" />
          <div style={{ ...panel, padding: 20, marginTop: 12 }}>
            <div className="psms-photo-form-row" style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div style={{ width: 80, height: 100, border: "2px dashed #d1d5db", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#fafafa" }}>
                  {admissionPhotoBusy ? (
                    <span style={{ fontSize: 10, color: C.gray, textAlign: "center", padding: 4, lineHeight: 1.3 }}>
                      {admissionPhotoStatus || "AI processing…"}
                    </span>
                  ) : isDisplayablePhotoSrc(admissionForm.photo) ? (
                    <img src={admissionForm.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 10, color: C.gray, textAlign: "center" }}>Photo</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
                  <Btn type="button" small outline onClick={() => admissionPhotoGalleryRef.current?.click()} disabled={admissionPhotoBusy}>
                    Select Image
                  </Btn>
                  <Btn type="button" small outline onClick={() => admissionPhotoCameraRef.current?.click()} disabled={admissionPhotoBusy}>
                    Capture Photo
                  </Btn>
                  {admissionForm.photo && !admissionPhotoBusy && (
                    <Btn type="button" small danger onClick={() => setAdmissionForm((x) => ({ ...x, photo: null }))}>
                      Clear Photo
                    </Btn>
                  )}
                </div>
                <input
                  ref={admissionPhotoGalleryRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    await handleAdmissionPhotoFile(f);
                  }}
                />
                <input
                  ref={admissionPhotoCameraRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    await handleAdmissionPhotoFile(f);
                  }}
                />
              </div>
              <div className="psms-grid-2" style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, minWidth: 0 }}>
                <Inp label="Admission No" value={admissionForm.admissionNo} onChange={(v) => setAdmissionForm((x) => ({ ...x, admissionNo: v }))} placeholder={"Next: " + suggestedNextAdm} width="100%" />
                <Inp label="Roll No" value={admissionForm.rollNo} onChange={(v) => setAdmissionForm((x) => ({ ...x, rollNo: v }))} placeholder={"Next in class: " + suggestedNextRoll} width="100%" />
                <Inp label="Student Name" value={admissionForm.name} onChange={(v) => setAdmissionForm((x) => ({ ...x, name: toProperCaseNameInput(v) }))} width="100%" />
                <Inp label="Father's Name" value={admissionForm.fatherName} onChange={(v) => setAdmissionForm((x) => ({ ...x, fatherName: toProperCaseNameInput(v) }))} width="100%" />
                <Inp label="Form B / Bay Form" value={admissionForm.bayForm} onChange={(v) => setAdmissionForm((x) => ({ ...x, bayForm: formatCnicAf(v) }))} placeholder="00000-0000000-0" width="100%" />
                <Inp label="Date of Birth" value={admissionForm.dob} onChange={(v) => setAdmissionForm((x) => ({ ...x, dob: formatDobAf(v) }))} placeholder="dd/mm/yyyy" width="100%" />
                <Inp label="WhatsApp No" value={admissionForm.whatsapp} onChange={(v) => setAdmissionForm((x) => ({ ...x, whatsapp: formatWhatsappAf(v) }))} placeholder="0000-0000000" width="100%" />
                <Sel label="Class" value={admissionForm.classId} onChange={(v) => setAdmissionForm((x) => ({ ...x, classId: v }))} options={settings.classes.map((c) => ({ value: c.id, label: formatClassDisplay(c) }))} width="100%" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn onClick={() => void saveAdmission()} disabled={admissionSaving || admissionPhotoBusy}>
                {admissionSaving ? "Processing…" : "Admit Student"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {tab === "record" && (
        <div style={{ ...panel, padding: 12 }}>
          <StudentsPage settings={settings} students={students} setStudents={setStudents} embedded currentSession={currentSession} currentUser={currentUser} activeSchoolId={activeSchoolId} />
        </div>
      )}

      {tab === "marks" && (
        <div>
          <div style={toolbar}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
              <Sel label="Exam" value={exam} onChange={setExam} options={exams} width={ctrlW} />
              <Sel label="Class" value={selCls} onChange={setSelCls} options={settings.classes.map((c) => ({ value: c.id, label: formatClassDisplay(c) }))} width={ctrlW} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Btn small outline onClick={() => void exportMarksTemplateExcel()}>
                Export Template
              </Btn>
              <Btn
                small
                outline
                onClick={() => {
                  const inp = document.createElement("input");
                  inp.type = "file";
                  inp.accept = ".xlsx,.xls";
                  inp.style.display = "none";
                  document.body.appendChild(inp);
                  inp.onchange = (ev) => {
                    importMarksFromExcel(ev);
                    document.body.removeChild(inp);
                  };
                  inp.click();
                }}
                disabled={!setExamMarks}
              >
                Import Marks
              </Btn>
              <Btn small outline onClick={() => exportMarksPdf().catch(() => alert("PDF export failed."))}>
                Export PDF
              </Btn>
            </div>
          </div>
          <div style={{ ...panel, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", background: "#f1f8f3", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700, color: "#1B5E20", fontSize: 15 }}>
                Enter Marks — {exam} · {getClassLabel(settings, selCls)}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>{cs(selCls).length} students · {subjs(selCls).length} subjects</div>
            </div>
            <div ref={marksTableRef} style={{ overflowX: "auto", maxHeight: "70vh" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
                <thead>
                  <tr>
                    {["Adm#", "Roll#", "Student Name", "Father's Name", ...subjs(selCls), "Total"].map((h, hi) => (
                      <th
                        key={h}
                        style={{
                          ...thBase,
                          textAlign: hi < 4 ? "left" : "center",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                  <tr style={{ background: "#e8f5e9" }}>
                    <th colSpan={4} style={{ padding: "5px 8px", fontWeight: 700, fontSize: 11, color: "#000", position: "sticky", top: 34, zIndex: 2, background: "#e8f5e9", textAlign: "right" }}>
                      Total Marks →
                    </th>
                    {subjs(selCls).map((s) => (
                      <td key={s} style={{ padding: "3px 3px", position: "sticky", top: 34, zIndex: 2, background: "#e8f5e9", textAlign: "center" }}>
                        <MarksInput initialValue={gtm(exam, selCls, s)} onSave={(v) => stm(exam, selCls, s, v)} rowIdx={-1} colIdx={-1} totalRows={0} totalCols={0} inputStyle={{ border: "1.5px solid #1B5E20", background: "#dcfce7" }} />
                      </td>
                    ))}
                    <td style={{ position: "sticky", top: 34, zIndex: 2, background: "#e8f5e9" }} />
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const students_ = cs(selCls)
                      .slice()
                      .sort((a, b) => {
                        const r = String(a.rollNo || "").localeCompare(String(b.rollNo || ""), undefined, { numeric: true, sensitivity: "base" });
                        return r !== 0 ? r : String(a.admissionNo || "").localeCompare(String(b.admissionNo || ""), undefined, { numeric: true, sensitivity: "base" });
                      });
                    const subjects_ = subjs(selCls);
                    const totalRows = students_.length;
                    const totalCols = subjects_.length;
                    return students_.map((s, i) => {
                      const { obt, tot } = calc(exam, selCls, s.id);
                      return (
                        <tr key={s.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                          <td style={{ padding: "5px 8px", fontVariantNumeric: "tabular-nums" }}>{s.admissionNo}</td>
                          <td style={{ padding: "5px 8px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{s.rollNo}</td>
                          <td style={{ padding: "5px 8px", fontWeight: 600 }}>{s.name}</td>
                          <td style={{ padding: "5px 8px", color: "#64748b" }}>{s.fatherName}</td>
                          {subjects_.map((subj, sIdx) => (
                            <td key={subj} style={{ padding: "3px 3px", textAlign: "center" }}>
                              <MarksInput initialValue={gom(exam, selCls, s.id, subj)} onSave={(v) => som(exam, selCls, s.id, subj, v)} rowIdx={i} colIdx={sIdx} totalRows={totalRows} totalCols={totalCols} />
                            </td>
                          ))}
                          <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                            {obt}/{tot || "—"}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "consolidated" && (
        <div>
          <div style={toolbar}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
              <Sel label="Exam" value={exam} onChange={setExam} options={exams} width={ctrlW} />
              <Sel label="Class" value={selCls} onChange={setSelCls} options={settings.classes.map((c) => ({ value: c.id, label: formatClassDisplay(c) }))} width={ctrlW} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Btn
                small
                outline
                onClick={() => {
                  const { headers, rows } = getTableDataFromElement(consolidatedTableRef.current);
                  if (!headers.length && !rows.length) {
                    alert("No data to export.");
                    return;
                  }
                  const clsName = getClassLabel(settings, selCls);
                  const safeCls = sanitizeMarksSheetName(clsName || "Class");
                  void exportConsolidatedSheetToPdf(settings, currentSession, exam, clsName, headers, rows, `Consolidated_${String(exam || "").replace(/\s/g, "_")}_${safeCls}.pdf`).catch(() => alert("PDF export failed."));
                }}
              >
                Export PDF
              </Btn>
            </div>
          </div>
          <div style={{ ...panel, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", background: "#f1f8f3" }}>
              <div style={{ fontWeight: 700, color: "#1B5E20", fontSize: 15 }}>
                Consolidated Sheet — {exam} · {getClassLabel(settings, selCls)}
              </div>
            </div>
            <div ref={consolidatedTableRef} style={{ overflowX: "auto", maxHeight: "70vh" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
                <thead>
                  <tr>
                    {["Photo", "Adm#", "Roll#", "Student Name", "Father's Name", ...subjs(selCls), "Total", "%", "Status", "Grade", "Position"].map((h, hi) => (
                      <th key={h} style={{ ...thBase, textAlign: hi < 5 ? (hi === 0 ? "center" : "left") : "center" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                  <tr style={{ background: "#e8f5e9" }}>
                    <th colSpan={5} style={{ padding: "5px 8px", fontWeight: 700, fontSize: 11, textAlign: "right", color: "#000", position: "sticky", top: 34, zIndex: 2, background: "#e8f5e9" }}>
                      Total Marks →
                    </th>
                    {subjs(selCls).map((s) => (
                      <td key={s} style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700, color: "#000", position: "sticky", top: 34, zIndex: 2, background: "#e8f5e9", fontVariantNumeric: "tabular-nums" }}>
                        {gtm(exam, selCls, s) || "—"}
                      </td>
                    ))}
                    <th colSpan={5} style={{ position: "sticky", top: 34, zIndex: 2, background: "#e8f5e9" }} />
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const sorted = cs(selCls)
                      .map((s) => ({ s, ...calc(exam, selCls, s.id) }))
                      .sort((a, b) => b.obt - a.obt);
                    let pos = 0;
                    return sorted.map((row, i) => {
                      if (i === 0 || row.obt !== sorted[i - 1].obt) pos++;
                      const { s, obt, tot, pct } = row;
                      const pctNum = parseFloat(pct);
                      const passFail = Number.isNaN(pctNum) ? "—" : pctNum >= passThreshold ? "Pass" : "Fail";
                      const passFailColor = Number.isNaN(pctNum) ? C.gray : pctNum >= passThreshold ? C.green : C.red;
                      return (
                        <tr key={s.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                          <td style={{ padding: 4, verticalAlign: "middle", textAlign: "center" }}>
                            <div style={{ width: 36, height: 44, border: "1px solid #d1d5db", borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#f3f4f6" }}>
                              {isDisplayablePhotoSrc(s.photo) ? <img src={s.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 9, color: C.gray }}>Photo</span>}
                            </div>
                          </td>
                          <td style={{ padding: "5px 8px", fontVariantNumeric: "tabular-nums" }}>{s.admissionNo}</td>
                          <td style={{ padding: "5px 8px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{s.rollNo}</td>
                          <td style={{ padding: "5px 8px", fontWeight: 600 }}>{s.name}</td>
                          <td style={{ padding: "5px 8px", color: "#64748b" }}>{s.fatherName}</td>
                          {subjs(selCls).map((subj) => (
                            <td key={subj} style={{ padding: "5px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                              {gom(exam, selCls, s.id, subj) || "—"}
                            </td>
                          ))}
                          <td style={{ padding: "5px 8px", fontWeight: 700, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                            {obt}/{tot || "—"}
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{pct}%</td>
                          <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700, color: passFailColor }}>{passFail}</td>
                          <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700, color: parseFloat(pct) >= passThreshold ? C.green : C.red }}>{grade(pct)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700 }}>
                            <div>{pos}</div>
                            {passFail === "Pass" && (
                              <div style={{ marginTop: 4, display: "grid", gap: 4, justifyItems: "center" }}>
                                {(() => {
                                  const options = getNextPromotionClassOptions(selCls);
                                  const selected = promotionTargetByStudent[s.id] || "";
                                  if (options.length > 1) {
                                    return (
                                      <select
                                        value={selected}
                                        onChange={(e) => setPromotionTargetByStudent((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                        style={{ padding: "2px 4px", fontSize: 11, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", minWidth: 120 }}
                                      >
                                        <option value="">Select section</option>
                                        {options.map((c) => (
                                          <option key={c.id} value={c.id}>
                                            {formatClassDisplay(c)}
                                          </option>
                                        ))}
                                      </select>
                                    );
                                  }
                                  return null;
                                })()}
                                <button
                                  type="button"
                                  onClick={() => promoteStudentToNextClass(s)}
                                  style={{ padding: "2px 7px", fontSize: 11, border: "1px solid #86efac", borderRadius: 4, background: "#f0fdf4", color: "#166534", cursor: "pointer", fontWeight: 700 }}
                                >
                                  Promote Student
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "card" && (
        <div>
          <div
            className="no-print result-card-toolbar"
            style={{
              ...panel,
              display: "flex",
              flexWrap: "nowrap",
              alignItems: "flex-end",
              gap: 10,
              padding: "12px 14px",
              marginBottom: 14,
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <Sel
              label="Class"
              value={rcCls}
              onChange={setRcCls}
              options={settings.classes.map((c) => ({ value: c.id, label: formatClassDisplay(c) }))}
              width={140}
              selectClassName="!h-9 !min-h-9 !py-1.5 !text-sm"
            />
            <Sel
              label="Exam"
              value={rcExam}
              onChange={setRcExam}
              options={[{ value: "overall", label: "Overall (All Terms)" }, ...exams.map((e) => ({ value: e, label: e }))]}
              width={140}
              selectClassName="!h-9 !min-h-9 !py-1.5 !text-sm"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 0.4 }}>Pass %</label>
              <div style={{ display: "flex", alignItems: "center", gap: 4, height: 36 }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.passPercent ?? 50}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!isNaN(v) && v >= 0 && v <= 100 && setSettings) setSettings((s) => ({ ...s, passPercent: v }));
                  }}
                  style={{
                    height: 36,
                    width: 72,
                    padding: "0 10px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 13,
                    background: "#fff",
                    boxSizing: "border-box",
                  }}
                />
                <span style={{ fontSize: 13, color: C.gray, fontWeight: 600 }}>%</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 0.4 }}>Roll No</label>
              <div style={{ display: "flex", alignItems: "center", gap: 4, height: 36 }}>
                <button
                  type="button"
                  aria-label="Previous roll"
                  onClick={() => {
                    const list = cs(rcCls);
                    const rolls = list
                      .map((s) => parseInt(s.rollNo, 10))
                      .filter((n) => !isNaN(n))
                      .sort((a, b) => a - b);
                    if (!rolls.length) {
                      setRcRoll("");
                      return;
                    }
                    const min = rolls[0];
                    const max = rolls[rolls.length - 1];
                    const cur = parseInt(rcRoll || "", 10);
                    if (isNaN(cur)) {
                      setRcRoll(String(max));
                      return;
                    }
                    setRcRoll(String(Math.max(min, cur - 1)));
                  }}
                  style={{
                    height: 36,
                    width: 36,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 14,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  ←
                </button>
                <input
                  type="text"
                  className="result-card-roll-input"
                  value={rcRoll}
                  onChange={(e) => setRcRoll(e.target.value)}
                  placeholder="#"
                  size={3}
                  inputMode="numeric"
                  style={{
                    height: 36,
                    padding: "0 2px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 13,
                    background: "#fff",
                    boxSizing: "border-box",
                    textAlign: "center",
                  }}
                />
                <button
                  type="button"
                  aria-label="Next roll"
                  onClick={() => {
                    const list = cs(rcCls);
                    const rolls = list
                      .map((s) => parseInt(s.rollNo, 10))
                      .filter((n) => !isNaN(n))
                      .sort((a, b) => a - b);
                    if (!rolls.length) {
                      setRcRoll("");
                      return;
                    }
                    const min = rolls[0];
                    const max = rolls[rolls.length - 1];
                    const cur = parseInt(rcRoll || "", 10);
                    if (isNaN(cur)) {
                      setRcRoll(String(min));
                      return;
                    }
                    setRcRoll(String(Math.min(max, cur + 1)));
                  }}
                  style={{
                    height: 36,
                    width: 36,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 14,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  →
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0, marginLeft: "auto" }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "transparent", textTransform: "uppercase", letterSpacing: 0.4, userSelect: "none" }}>Actions</label>
              <div style={{ display: "flex", alignItems: "center", gap: 6, height: 36 }}>
                <Btn
                  small
                  outline
                  disabled={singlePdfBusy || classPdfBusy || !String(rcRoll || "").trim()}
                  onClick={() => void exportSingleResultCardPdf()}
                  style={{ height: 36, minHeight: 36, padding: "0 12px", display: "inline-flex", alignItems: "center" }}
                >
                  {singlePdfBusy ? "Exporting…" : "Export PDF"}
                </Btn>
                <Btn
                  small
                  disabled={classPdfBusy || singlePdfBusy}
                  onClick={requestClassPdfExport}
                  style={{ height: 36, minHeight: 36, padding: "0 12px", display: "inline-flex", alignItems: "center" }}
                >
                  {classPdfBusy ? "Exporting…" : "Export Class PDF"}
                </Btn>
              </div>
            </div>
          </div>
          {rcRoll &&
            (() => {
              const st = cs(rcCls).find((s) => s.rollNo === rcRoll);
              if (!st) return <div style={{ color: C.red, padding: 16 }}>Student not found for Roll No: {rcRoll}</div>;
              return <div className="result-card-print-area">{renderResultCard(st, rcCls, rcExam, resultCardRef)}</div>;
            })()}
          {classPdfExportList?.length ? (
            <div ref={classResultPdfContainerRef} aria-hidden className="class-result-cards-pdf-source" style={{ position: "fixed", left: -99999, top: 0, width: 720, pointerEvents: "none" }}>
              {classPdfExportList.map((st) => renderResultCard(st, rcCls, rcExam))}
            </div>
          ) : null}
        </div>
      )}

      {tab === "datesheet" && (
        <div>
          <div className="no-print" style={toolbar}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
              <Sel label="Exam" value={exam} onChange={setExam} options={exams} width={ctrlW} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Btn onClick={() => setDsDates((rows) => [...rows, { id: genId(), date: new Date().toISOString().split("T")[0] }])}>Add Date</Btn>
              <Btn outline danger disabled={dsDates.length <= 1} onClick={() => setDsDates((rows) => (rows.length > 1 ? rows.slice(0, -1) : rows))}>
                Remove Date
              </Btn>
              <Btn outline onClick={() => setDsCols((cols) => [...cols, { id: genId(), classId: "" }])}>
                Add Class Column
              </Btn>
              <Btn outline danger disabled={dsCols.length <= 1} onClick={() => setDsCols((cols) => (cols.length > 1 ? cols.slice(0, -1) : cols))}>
                Remove Class Column
              </Btn>
            </div>
          </div>
          <div style={{ ...panel, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", background: "#f1f8f3" }}>
              <div style={{ fontWeight: 700, color: "#1B5E20", fontSize: 15 }}>Date Sheet — {exam}</div>
            </div>
            <div ref={datesheetTableRef} style={{ overflowX: "auto", maxHeight: "70vh", background: "#fff", padding: 12 }}>
              <table className="datesheet-table" style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 0, margin: "0 auto", width: "100%" }}>
                <thead>
                  <tr style={{ background: "#1B5E20", color: "#fff", textAlign: "center" }}>
                    <th style={{ padding: "8px 6px", border: "1px solid #14532d", minWidth: 90, textAlign: "center", position: "sticky", top: 0, zIndex: 3, background: "#1B5E20" }}>Date</th>
                    <th style={{ padding: "8px 6px", border: "1px solid #14532d", minWidth: 90, textAlign: "center", position: "sticky", top: 0, zIndex: 3, background: "#1B5E20" }}>Day</th>
                    {dsCols.map((col) => {
                      const usedIds = dsCols.filter((c) => c.id !== col.id).map((c) => c.classId).filter(Boolean);
                      return (
                        <th key={col.id} style={{ padding: "8px 6px", border: "1px solid #14532d", minWidth: 110, textAlign: "center", position: "sticky", top: 0, zIndex: 3, background: "#1B5E20" }}>
                          <select
                            value={col.classId}
                            onChange={(e) => {
                              const v = e.target.value;
                              setDsCols((cols) => cols.map((c) => (c.id === col.id ? { ...c, classId: v } : c)));
                            }}
                            style={{ width: "100%", padding: "4px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 11, textAlign: "center" }}
                          >
                            <option value="">— Select class —</option>
                            {settings.classes
                              .filter((cls) => !usedIds.includes(cls.id) || cls.id === col.classId)
                              .map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                  {formatClassDisplay(cls)}
                                </option>
                              ))}
                          </select>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {dsDates.map((row, ri) => {
                    const dObj = row.date ? new Date(row.date) : null;
                    const dayName = dObj && !isNaN(dObj) ? dObj.toLocaleDateString("en-PK", { weekday: "long" }) : "";
                    return (
                      <tr key={row.id} style={{ background: ri % 2 === 0 ? "#f8fafc" : "#fff" }}>
                        <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => setDsDates((rs) => rs.map((r) => (r.id === row.id ? { ...r, date: e.target.value } : r)))}
                            style={{ width: "100%", padding: "4px 3px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 11, boxSizing: "border-box", textAlign: "center" }}
                          />
                        </td>
                        <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", fontWeight: 700, textAlign: "center" }}>{dayName}</td>
                        {dsCols.map((col) => {
                          const cid = col.classId;
                          const key = `${row.id}_${col.id}`;
                          const current = dsSubs[key] || "";
                          const allSubs = cid ? getClassSubjects(settings, cid, "exam") : [];
                          const usedSubs = dsDates.map((r) => dsSubs[`${r.id}_${col.id}`]).filter((s) => s && s !== current);
                          const options = allSubs.filter((s) => !usedSubs.includes(s));
                          return (
                            <td key={key} style={{ padding: "6px 8px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                              <select
                                value={current}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setDsSubs((prev) => ({ ...prev, [key]: v }));
                                }}
                                disabled={!cid}
                                style={{ width: "100%", padding: "4px 3px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 11, background: cid ? "#fff" : "#f3f4f6", opacity: cid ? 1 : 0.7, textAlign: "center" }}
                              >
                                <option value="">---</option>
                                {options.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: 16, borderTop: "1px solid #e2e8f0" }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, display: "block", marginBottom: 4 }}>Note / Instructions</label>
              <textarea
                value={dsNote}
                onChange={(e) => setDsNote(e.target.value)}
                rows={3}
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 6, fontSize: 12, resize: "vertical", boxSizing: "border-box" }}
                placeholder="Write important instructions for students (e.g. reporting time, allowed materials, etc.)"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export function StudentsPage({settings:settingsProp,students:studentsProp,setStudents,embedded,currentSession,currentUser,activeSchoolId}){
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
  const studentsRef=useRef(students);
  useEffect(()=>{ studentsRef.current=students; },[students]);
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
  const [photoStatus,setPhotoStatus]=useState("");
  const [autoPhotoSyncStatus,setAutoPhotoSyncStatus]=useState("watching"); // watching | syncing | idle
  const photoFileSigRef=useRef({});
  const photosFolderSigRef=useRef("");
  const photosSyncInFlight=useRef(false);
  useEffect(()=>{
    if(!showAdd) return;
    void preloadStudentPhotoAi();
  },[showAdd]);
  const toWorldwidePhoto=useCallback(async (dataUrl, studentId)=>{
    if(!dataUrl||!isDisplayablePhotoSrc(dataUrl)) return dataUrl;
    if(/^https?:\/\//i.test(dataUrl)) return dataUrl;
    try{
      const { uploadDataUrlPhoto }=await import("../../lib/photoStorage.js");
      const prefix=`${activeSchoolId||"school"}/students/${studentId||"new"}`;
      return await uploadDataUrlPhoto(dataUrl, prefix);
    }catch(err){
      console.warn("Photo cloud upload skipped", err);
      return dataUrl;
    }
  },[activeSchoolId]);
  const runPhotosFolderSync=useCallback(async ({ silent=true, scope="filtered" }={})=>{
    if(photosSyncInFlight.current) return null;
    const classes=settings.classes||[];
    if(!classes.length) return null;
    const allStudents=studentsRef.current||[];
    const filterResolved=filterCls!=="all"?resolveClass(classes,filterCls):null;
    const list=scope==="all"||!filterResolved
      ? allStudents
      : allStudents.filter(s=>resolveClass(classes,s.classId)?.id===filterResolved.id);
    if(!list.length) return null;
    photosSyncInFlight.current=true;
    if(!silent) setAutoPhotoSyncStatus("syncing");
    try{
      const { syncStudentsFromPhotosFolder, uploadPendingPhotosWorldwide }=await import("../../lib/photosFolderSync.js");
      const result=await syncStudentsFromPhotosFolder({
        students:list,
        classes,
        schoolId:activeSchoolId,
        yieldToMain,
        fileSigByStudentRef:photoFileSigRef,
      });
      const { updates, pendingCloudUpload, folderSignature, stats }=result;
      photosFolderSigRef.current=folderSignature||photosFolderSigRef.current;
      const changed=Object.keys(updates).length>0;
      if(changed){
        setStudents(prev=>prev.map(s=>{
          if(s.id in updates){
            const next=updates[s.id];
            return next?{...s,photo:next}:{...s,photo:null};
          }
          if(s.photo&&!isDisplayablePhotoSrc(s.photo)) return {...s,photo:null};
          return s;
        }));
      }
      if(pendingCloudUpload?.length){
        void (async ()=>{
          const cloudUpdates=await uploadPendingPhotosWorldwide(pendingCloudUpload,{ yieldToMain });
          if(Object.keys(cloudUpdates).length){
            setStudents(prev=>prev.map(s=>cloudUpdates[s.id]?{...s,photo:cloudUpdates[s.id]}:s));
          }
        })();
      }
      if(!silent){
        alert(
          `Synced photos from Photos folder.\n\n`+
          `Updated: ${stats.applied}\n`+
          `Removed (file deleted from folder): ${stats.removed}\n`+
          `No file / already empty: ${stats.missing}\n`+
          (stats.unchanged?`Unchanged: ${stats.unchanged}\n`:"")+
          (stats.skippedNoFolder?`Skipped (no class folder): ${stats.skippedNoFolder}\n`:"")+
          (stats.failed?`Failed: ${stats.failed}\n`:"")+
          `\nAuto-sync stays ON — add/remove files under Photos/<Class>/ and they sync worldwide.`
        );
      }
      return stats;
    }catch(err){
      console.warn("Photos folder sync failed", err);
      if(!silent) alert("Photo sync failed: "+(err?.message||String(err)));
      return null;
    }finally{
      photosSyncInFlight.current=false;
      setAutoPhotoSyncStatus("watching");
    }
  },[settings.classes,filterCls,activeSchoolId,setStudents]);

  // Automatic watch: poll Photos folders on main PC only (Photos-api). Mobile uses file picker.
  useEffect(()=>{
    let cancelled=false;
    const poll=async ()=>{
      if(cancelled||photosSyncInFlight.current) return;
      try{
        const { isPhotosApiAvailable, folderNamesForClass, listPhotosFolder }=await import("../../lib/photosFolderSync.js");
        if(!(await isPhotosApiAvailable())){
          setAutoPhotoSyncStatus("picker");
          return;
        }
        setAutoPhotoSyncStatus((s)=>s==="syncing"?s:"watching");
        const classes=settings.classes||[];
        const names=new Set();
        classes.forEach(c=>folderNamesForClass(c).forEach(n=>names.add(n)));
        if(!names.size) return;
        const parts=[];
        for(const name of names){
          const listed=await listPhotosFolder(name);
          parts.push(`${name}=${listed.signature||""}`);
        }
        const sig=parts.sort().join("||");
        if(!sig) return;
        if(photosFolderSigRef.current&&photosFolderSigRef.current===sig) return;
        // First run: record signature then sync once so existing folder files load
        const first= !photosFolderSigRef.current;
        photosFolderSigRef.current=sig;
        if(first||sig){
          await runPhotosFolderSync({ silent:true, scope:"all" });
        }
      }catch(err){
        console.warn("Auto photo watch failed", err);
      }
    };
    poll();
    const id=setInterval(poll, 4000);
    return ()=>{ cancelled=true; clearInterval(id); };
  },[settings.classes,runPhotosFolderSync]);
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
    if(curGrade!=null){
      const targetGrade=direction==="up"?curGrade+1:curGrade-1;
      const targetPool=(settings.classes||[]).filter(c=>classGradeNum(c.id)===targetGrade);
      if(targetPool.length){
        const curSection=String(cur.section||"").trim().toUpperCase();
        const sameSection=curSection?targetPool.find(c=>String(c.section||"").trim().toUpperCase()===curSection):null;
        return sameSection||targetPool[0]||null;
      }
    }
    // Fallback when grade number is missing (e.g. ECE): use class list order
    const list=settings.classes||[];
    const idx=list.findIndex(c=>c.id===cur.id);
    if(idx<0) return null;
    const nextIdx=direction==="up"?idx+1:idx-1;
    return list[nextIdx]||null;
  };
  const moveStudentClass=(student,direction)=>{
    const target=getNeighborClass(student?.classId,direction);
    if(!target){ alert(direction==="up"?"No upper class found.":"No lower class found."); return; }
    changeStudentSection(student,target.id);
  };
  /** Swap roll numbers with the previous (up) or next (down) student in the same class. */
  const swapStudentRoll=(student,direction)=>{
    if(!setStudents||!student?.id) return;
    const resolved=resolveClass(settings.classes,student.classId);
    const classKey=resolved?.id||student.classId;
    const peers=students
      .filter(s=>{
        const c=resolveClass(settings.classes,s.classId);
        return (c?.id||s.classId)===classKey;
      })
      .sort((a,b)=>String(a.rollNo||"").localeCompare(String(b.rollNo||""),undefined,{numeric:true,sensitivity:"base"}));
    const idx=peers.findIndex(s=>s.id===student.id);
    if(idx<0) return;
    const swapIdx=direction==="up"?idx-1:idx+1;
    if(swapIdx<0||swapIdx>=peers.length){
      alert(direction==="up"?"Already first in roll order.":"Already last in roll order.");
      return;
    }
    const other=peers[swapIdx];
    const rollA=student.rollNo;
    const rollB=other.rollNo;
    setStudents(prev=>prev.map(st=>{
      if(st.id===student.id) return {...st,rollNo:rollB};
      if(st.id===other.id) return {...st,rollNo:rollA};
      return st;
    }));
  };
  const arrowBtnStyle={padding:"2px 6px",fontSize:11,border:"1px solid #cbd5e1",borderRadius:4,background:"#fff",cursor:"pointer",lineHeight:1.2,minWidth:22};
  const photosDirRef=useRef(null);
  const photosFilesRef=useRef(null);
  const isMobilePhotoDevice=()=>{
    if(typeof navigator==="undefined") return false;
    const ua=navigator.userAgent||"";
    if(/Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
    // iPadOS desktop UA still has touch
    if(navigator.maxTouchPoints>1&&/Mac/i.test(navigator.platform||"")) return true;
    return false;
  };
  const openPhotoPickerForSync=()=>{
    const mobile=isMobilePhotoDevice();
    if(mobile){
      if(filterCls==="all"){
        alert(
          "On mobile: choose a Class in the filter first, then pick photos named by roll number\n"+
          "(1.jpg, 2.png, (3).jpeg, …).\n\n"+
          "Photos upload to cloud so they show worldwide."
        );
      }
      photosFilesRef.current?.click();
      return;
    }
    // Desktop without Photos-api: pick the Photos folder (class subfolders)
    photosDirRef.current?.click();
  };
  const importPickedPhotoFiles=useCallback(async (filesInput)=>{
            const files=Array.from(filesInput||[]);
            if(!files.length) return;
            const normalizeRollKey=(v)=>{
              const digits=String(v??"").match(/\d+/);
              if(!digits) return "";
              return digits[0].replace(/^0+/,"")||"0";
            };
            const extractRollFromFilename=(filename)=>{
              const base=String(filename||"").replace(/\.[^.]+$/,"").trim();
              if(!base) return "";
              // Accept 1, 01, (1), (01)
              if(/^\d+$/.test(base)) return normalizeRollKey(base);
              const paren=base.match(/^\(\s*(\d+)\s*\)$/);
              if(paren) return normalizeRollKey(paren[1]);
              const lead=base.match(/^(\d{1,4})(?:[^\d].*)?$/);
              if(lead) return normalizeRollKey(lead[1]);
              const labeled=base.match(/(?:roll|r(?:no)?|no)[^\d]*(\d{1,4})/i);
              if(labeled) return normalizeRollKey(labeled[1]);
              const any=base.match(/(\d{1,4})/);
              return any?normalizeRollKey(any[1]):"";
            };
            const clean=(v)=>String(v||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"");
            const folderAliases=(folder)=>{
              const raw=String(folder||"").trim();
              if(!raw) return [];
              const aliases=new Set([raw]);
              aliases.add(raw.replace(/[_]+/g,"-"));
              aliases.add(raw.replace(/[-]+/g," "));
              // 1st-A / 2nd B → 1-A / 2-B
              const ord=raw.match(/^(\d{1,2})(?:st|nd|rd|th)?\s*[-_ ]\s*([a-zA-Z])$/i);
              if(ord){
                aliases.add(`${ord[1]}-${ord[2]}`);
                aliases.add(`${ord[1]}${ord[2]}`);
                aliases.add(`Class ${ord[1]}-${ord[2].toUpperCase()}`);
                aliases.add(`Class ${ord[1]}${ord[2].toUpperCase()}`);
              }
              const onlyNum=raw.match(/^(\d{1,2})$/);
              if(onlyNum){
                aliases.add(`Class ${onlyNum[1]}`);
                aliases.add(onlyNum[1]);
              }
              const classPref=raw.match(/^class\s*(.+)$/i);
              if(classPref) aliases.add(classPref[1].trim());
              return [...aliases];
            };
            const classMatch=(folder)=>{
              if(!folder) return null;
              // Try every alias through the same resolver used across PSMS
              for(const alias of folderAliases(folder)){
                const hit=resolveClass(settings.classes,alias);
                if(hit) return hit;
              }
              const f=clean(folder);
              if(!f) return null;
              return (settings.classes||[]).find(c=>{
                const labels=[
                  c.id,c.name,c.grade,c.section,
                  formatClassDisplay(c),
                  formatGradeLabel(c.grade),
                  `${c.grade||""}${c.section||""}`,
                  `${c.grade||""}-${c.section||""}`,
                  `Class ${c.grade||""}-${c.section||""}`,
                  `Class ${c.grade||""}${c.section||""}`,
                ];
                return labels.some(l=>l&&(clean(l)===f||clean(l).endsWith(f)||f.endsWith(clean(l))));
              })||null;
            };
            /** Walk path folders from nearest parent up; first class match wins. */
            const classFromPath=(parts)=>{
              // Skip common root folder names that are not classes
              const skip=new Set(["photos","photo","images","image","img","pics","pictures","psms"]);
              for(let i=parts.length-2;i>=0;i--){
                const seg=String(parts[i]||"").trim();
                if(!seg||skip.has(seg.toLowerCase())) continue;
                const hit=classMatch(seg);
                if(hit) return hit;
              }
              return null;
            };
            const filterResolved=filterCls!=="all"?resolveClass(settings.classes,filterCls):null;
            const imageFiles=files.filter(f=>{
              const name=f.name||"";
              if(/^\.gitkeep$/i.test(name)||/^readme/i.test(name)) return false;
              return isStudentPhotoFile(f)||STUDENT_PHOTO_EXT_RE.test(name);
            });
            if(!imageFiles.length){
              alert("No image files found. Any common image format is accepted (JPG, PNG, WEBP, HEIC, AVIF, TIFF, etc.).");
              return;
            }
            const targets=[];
            let skippedNoRoll=0;
            let skippedNoClass=0;
            const folderHints=new Set();
            for(const file of imageFiles){
              const rel=file.webkitRelativePath||file.name;
              const parts=rel.split(/[\\/]/).filter(Boolean);
              const namePart=parts[parts.length-1]||file.name;
              const roll=extractRollFromFilename(namePart);
              if(!roll){ skippedNoRoll++; continue; }
              // Class subfolders: Photos/ECE/1.jpg or Photos/Class 1/2.jpg
              let cls=classFromPath(parts);
              // Flat pick (mobile) or flat folder of rolls → use selected class filter
              if(!cls&&filterResolved) cls=filterResolved;
              if(!cls){
                skippedNoClass++;
                if(parts.length>=2) folderHints.add(parts[parts.length-2]);
                continue;
              }
              const resolved=resolveClass(settings.classes,cls.id)||cls;
              targets.push({file,classId:resolved.id,roll,cls:resolved});
            }
            if(!targets.length){
              const sampleFolders=[...folderHints].slice(0,8).join(", ");
              const sampleClasses=(settings.classes||[]).map(c=>formatClassDisplay(c)||c.name||c.grade).filter(Boolean).join(", ");
              alert(
                "No photos matched.\n\n"+
                "Mobile: select a Class filter, then pick images named by roll (1.jpg, 2.png).\n"+
                "PC: select the Photos folder with class subfolders:\n"+
                "  Photos / Class 1 / 1.jpg\n\n"+
                (sampleFolders?`Folders seen: ${sampleFolders}\n`:"")+
                (sampleClasses?`Classes in this login: ${sampleClasses}\n`:"")+
                `\nImages: ${imageFiles.length}`+
                (skippedNoRoll?` | no roll in name: ${skippedNoRoll}`:"")+
                (skippedNoClass?` | no class folder match: ${skippedNoClass}`:"")
              );
              return;
            }
            // Fast bulk import (no AI background removal — that was hanging on large folders)
            const photosMap={};
            let failed=0;
            const BATCH=8;
            for(let i=0;i<targets.length;i+=BATCH){
              const slice=targets.slice(i,i+BATCH);
              const results=await Promise.all(slice.map(async t=>{
                try{
                  const data=await readStudentPhotoAsJpeg(t.file);
                  return {t,data};
                }catch{
                  return {t,data:null};
                }
              }));
              for(const {t,data} of results){
                if(!data||!isDisplayablePhotoSrc(data)){ failed++; continue; }
                const worldwide=await toWorldwidePhoto(data, `${t.classId}_${t.roll}`);
                const keys=new Set([
                  `${t.classId}|${t.roll}`,
                  `${String(t.cls?.name||"").trim()}|${t.roll}`,
                  `${String(t.cls?.grade||"").trim()}|${t.roll}`,
                  `${formatClassDisplay(t.cls)}|${t.roll}`,
                ]);
                keys.forEach(k=>{ if(k&&!k.startsWith("|")) photosMap[k]=worldwide; });
              }
              await yieldToMain();
            }
            let applied=0;
            setStudents(prev=>prev.map(s=>{
              const sc=resolveClass(settings.classes,s.classId);
              const roll=normalizeRollKey(s.rollNo);
              if(!roll) return s;
              const tryKeys=[
                `${sc?.id||s.classId}|${roll}`,
                `${String(sc?.name||s.classId||"").trim()}|${roll}`,
                `${String(sc?.grade||"").trim()}|${roll}`,
                `${formatClassDisplay(sc)||""}|${roll}`,
                `${String(s.classId||"").trim()}|${roll}`,
              ];
              const photo=tryKeys.map(k=>photosMap[k]).find(Boolean);
              if(!photo) return s;
              applied++;
              return {...s,photo};
            }));
            const processed=targets.length-failed;
            const byClass={};
            targets.forEach(t=>{
              const label=formatClassDisplay(t.cls)||getClassLabel(settings,t.classId)||t.classId;
              byClass[label]=(byClass[label]||0)+1;
            });
            const classSummary=Object.entries(byClass).map(([k,v])=>`${k}: ${v}`).join("\n");
            alert(
              `Imported photos for ${applied} student(s).\n`+
              `Files processed: ${processed}`+
              (failed?` | failed: ${failed}`:"")+
              (classSummary?`\n\nBy class:\n${classSummary}`:"")+
              (processed>applied?`\n\n(${processed-applied} file(s) had no matching student roll.)`:"")
            );
  },[filterCls,settings,setStudents,toWorldwidePhoto]);
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
  const PERSONAL_INFO_FIELDS=["name","fatherName","whatsapp","bayForm","dob"];
  const personalLabel=(field)=>{
    const labels={
      name:"Student Name",
      fatherName:"Father's Name",
      whatsapp:"WhatsApp",
      bayForm:"Form B",
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
    if(!isStudentPhotoFile(f)){
      alert("Please choose an image file (any format: JPG, PNG, WEBP, HEIC, etc.).");
      return;
    }
    setPhotoBusy(true);
    setPhotoStatus("Preparing…");
    try{
      const data=await processStudentPhotoWithBackground(f,{
        onProgress:(msg)=>setPhotoStatus(String(msg||"Processing…")),
      });
      if(!data){ alert("Could not process this photo. Try another image."); return; }
      setPhotoStatus("Uploading…");
      const worldwide=await toWorldwidePhoto(data, editingId||form.id||"record");
      setForm(x=>({...x,photo:worldwide}));
    }catch(err){
      console.error("Student photo failed",err);
      alert("Photo upload failed: "+(err?.message||String(err)));
    }finally{
      setPhotoBusy(false);
      setPhotoStatus("");
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
    let photoVal=form.photo||null;
    if(photoVal&&String(photoVal).startsWith("data:image")){
      photoVal=await toWorldwidePhoto(photoVal, id);
    }
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
    const headers=["Photo","Adm#","Roll#","Student Name","Father's Name","Form B","DOB","WhatsApp","Grade"];
    const rows=filtered.map(s=>{
      const gradeLabel=(getClassLabel(settings,s.classId)||"").replace(/-$/,"");
      return [
        "", // photo drawn manually
        s.admissionNo||"",
        s.rollNo||"",
        s.name||"",
        s.fatherName||"",
        s.bayForm?formatCnic(s.bayForm):"—",
        s.dob||"",
        s.whatsapp?formatWhatsapp(s.whatsapp):"—",
        gradeLabel,
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
          if(!isDisplayablePhotoSrc(s.photo)) return;
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
    <div className="no-print students-record-toolbar" style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap",alignItems:"flex-end"}}>
      <Sel
        label="Filter by Class"
        value={filterCls}
        onChange={setFilterCls}
        options={[{value:"all",label:"All Classes"},...settings.classes.map(c=>({value:c.id,label:formatClassDisplay(c)}))]}
        selectClassName="!h-9 !min-h-9 !py-1.5 !text-sm"
        width={180}
      />
      <Inp
        label="Search"
        value={search}
        onChange={setSearch}
        placeholder="Name or Adm No…"
        width={200}
        className="students-record-search"
        inputClassName="!h-9 !min-h-9"
      />
      <div style={{marginLeft:"auto",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <Btn
          onClick={openAdd}
          className="!h-9 !min-h-9 !px-3 !text-sm"
          style={{ height: 36, minHeight: 36 }}
        >
          Add Student
        </Btn>
        <Btn
          outline
          onClick={()=>void doExportStudents("pdf").catch(()=>alert("PDF export failed."))}
          className="!h-9 !min-h-9 !px-3 !text-sm"
          style={{ height: 36, minHeight: 36 }}
        >
          Export PDF
        </Btn>
        <Btn
          outline
          onClick={async ()=>{
            const classes=settings.classes||[];
            if(!classes.length){ alert("No classes found for this school login."); return; }
            try{
              const { ensureClassPhotoFolders, preferredPhotoFolderName }=await import("../../lib/photosFolderSync.js");
              const result=await ensureClassPhotoFolders(classes);
              const names=classes.map(c=>preferredPhotoFolderName(c)).filter(Boolean);
              if(result.ok||result.created?.length||result.existing?.length){
                alert(
                  `Photo folders ready under PSMS/Photos:\n\n`+
                  names.join("\n")+
                  (result.created?.length?`\n\nNewly created: ${result.created.join(", ")}`:"")+
                  `\n\nName files by roll number (e.g. 1.jpg or (1).jpeg).`
                );
                return;
              }
            }catch(err){
              console.warn(err);
            }
            alert("Could not create folders automatically. Use the project Photos/ directory on the main PC.");
          }}
          className="!h-9 !min-h-9 !px-3 !text-sm"
          style={{ height: 36, minHeight: 36 }}
          title="Create Photos/<Class>/ folders on the local workstation"
        >
          Create Photo Folders
        </Btn>
        <Btn
          outline
          onClick={async ()=>{
            const classes=settings.classes||[];
            if(!classes.length){ alert("No classes found for this school login."); return; }
            const list=filterCls==="all"?students:filtered;
            if(!list.length){ alert("No students to sync photos for."); return; }
            try{
              const { isPhotosApiAvailable }=await import("../../lib/photosFolderSync.js");
              const apiOk=await isPhotosApiAvailable({ force:true });
              if(apiOk){
                if(filterCls==="all"){
                  const ok=confirm(
                    "Import photos for all classes from the Photos folder?\n\n"+
                    "• Matching roll files update student photos\n"+
                    "• Removed files clear photos in the system\n\n"+
                    "Automatic folder watch remains enabled on the workstation."
                  );
                  if(!ok) return;
                }
                await runPhotosFolderSync({ silent:false, scope:filterCls==="all"?"all":"filtered" });
                return;
              }
            }catch(err){
              console.warn("Photos-api check failed", err);
            }
            // Mobile / Vercel / no local Photos folder API → open device photo picker
            openPhotoPickerForSync();
          }}
          className="!h-9 !min-h-9 !px-3 !text-sm"
          style={{ height: 36, minHeight: 36 }}
          title="Import photos from Photos folder (PC) or select images (mobile)"
        >
          Import Photos
        </Btn>
        <span style={{fontSize:11,color:C.gray,whiteSpace:"nowrap"}} title="Workstation: watches Photos/<Class>/. Mobile: use Import Photos.">
          {autoPhotoSyncStatus==="syncing"?"Importing…":autoPhotoSyncStatus==="picker"?"Select images to import":"Folder watch active"}
        </span>
        <input
          ref={photosDirRef}
          type="file"
          accept="image/*,.jpg,.jpeg,.jpe,.jfif,.png,.webp,.bmp,.gif,.heic,.heif,.avif,.tif,.tiff,.ico,.svg"
          style={{display:"none"}}
          multiple
          webkitdirectory=""
          directory=""
          onChange={async e=>{
            const files=Array.from(e.target.files||[]);
            e.target.value="";
            if(!files.length) return;
            await importPickedPhotoFiles(files);
          }}
        />
        {/* Mobile: multi-select images (folder picker is unreliable on phones) */}
        <input
          ref={photosFilesRef}
          type="file"
          accept="image/*,.jpg,.jpeg,.jpe,.jfif,.png,.webp,.bmp,.gif,.heic,.heif,.avif,.tif,.tiff,.ico,.svg"
          style={{display:"none"}}
          multiple
          onChange={async e=>{
            const files=Array.from(e.target.files||[]);
            e.target.value="";
            if(!files.length) return;
            await importPickedPhotoFiles(files);
          }}
        />
      </div>
    </div>
    <div className="no-print" style={{fontSize:12,color:C.gray,marginBottom:8}}>Showing {filtered.length} of {students.length} students</div>
    <div ref={studentsTableRef} className="students-record-print" style={{overflowX:"auto",width:"100%"}}>
      <table style={{borderCollapse:"collapse",fontSize:13,minWidth:"100%"}}>
        <thead><tr style={{background:C.navy,color:"#fff"}}>{["Photo","Adm#","Roll#","Student Name","Father's Name","Form B","DOB","WhatsApp","Class","Action"].map(h=><th key={h} style={{padding:"7px 10px",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>{filtered.map((s,i)=><tr key={s.id} style={{background:i%2===0?"#f9fafb":"#fff"}}>
          <td style={{padding:"5px 10px"}}><div style={{width:34,height:34,borderRadius:"50%",overflow:"hidden",border:"2px solid #d1d5db",background:"#e5e7eb",display:"flex",alignItems:"center",justifyContent:"center"}}>{isDisplayablePhotoSrc(s.photo)?<img src={s.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"👤"}</div></td>
          <td style={{padding:"5px 10px"}}>{s.admissionNo}</td>
          <td style={{padding:"5px 10px"}}>
            <div style={{fontWeight:700}}>{s.rollNo}</div>
            <div style={{display:"flex",gap:4,marginTop:4,alignItems:"center"}}>
              <button type="button" onClick={()=>swapStudentRoll(s,"up")} title="Move roll up (swap with previous)" style={arrowBtnStyle}>↑</button>
              <button type="button" onClick={()=>swapStudentRoll(s,"down")} title="Move roll down (swap with next)" style={arrowBtnStyle}>↓</button>
            </div>
          </td>
          <td style={{padding:"5px 10px"}}>{s.name}</td><td style={{padding:"5px 10px"}}>{s.fatherName}</td>
          <td style={{padding:"5px 10px"}}>{s.bayForm?formatCnic(s.bayForm):"—"}</td>
          <td style={{padding:"5px 10px"}}>{s.dob||"—"}</td>
          <td style={{padding:"5px 10px"}}>{s.whatsapp?formatWhatsapp(s.whatsapp):"—"}</td>
          <td style={{padding:"5px 10px"}}>
            <div>{getClassLabel(settings,s.classId)}</div>
            <div style={{display:"flex",gap:4,marginTop:4,alignItems:"center",flexWrap:"wrap"}}>
              <button type="button" onClick={()=>moveStudentClass(s,"down")} title="Move to lower class" style={arrowBtnStyle}>←</button>
              <button type="button" onClick={()=>moveStudentClass(s,"up")} title="Move to upper class" style={arrowBtnStyle}>→</button>
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
          </td>
          <td style={{padding:"5px 10px"}}><div style={{display:"flex",flexDirection:"column",gap:4}}><Btn small outline onClick={()=>openEdit(s)}>Edit</Btn><Btn small danger disabled={isPromotedStudent(s)} onClick={()=>{if(isPromotedStudent(s)) return; if(!confirm("Delete this student record?")) return; setStudents(x=>x.filter(st=>st.id!==s.id));}}>{isPromotedStudent(s)?"Promoted":"Delete"}</Btn></div></td>
        </tr>)}
        {filtered.length===0&&<tr><td colSpan={10} style={{padding:20,textAlign:"center",color:C.gray}}>No students found</td></tr>}
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
          <div style={{display:"flex",gap:16,alignItems:"flex-start",marginBottom:14,flexWrap:"wrap"}} className="psms-photo-form-row">
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,flexShrink:0}}>
              <div style={{width:80,height:100,border:"2px dashed #d1d5db",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",background:"#fafafa"}}>
                {photoBusy?<span style={{fontSize:10,color:C.gray,textAlign:"center",padding:4,lineHeight:1.3}}>{photoStatus||"AI processing…"}</span>:isDisplayablePhotoSrc(form.photo)?<img src={form.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:10,color:C.gray,textAlign:"center"}}>Photo</span>}
              </div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"center"}}>
                <Btn type="button" small outline onClick={()=>photoGalleryRef.current?.click()} disabled={photoBusy}>Select Image</Btn>
                <Btn type="button" small outline onClick={()=>photoCameraRef.current?.click()} disabled={photoBusy}>Capture Photo</Btn>
                {form.photo&&!photoBusy&&(
                  <Btn type="button" small danger onClick={()=>setForm(x=>({...x,photo:null}))}>Clear Photo</Btn>
                )}
              </div>
              <input ref={photoGalleryRef} type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{const f=e.target.files?.[0];e.target.value="";if(!f)return;photoFileRef.current=f;await handleStudentPhotoFile(f);}}/>
              <input ref={photoCameraRef} type="file" accept="image/*" capture="user" style={{display:"none"}} onChange={async e=>{const f=e.target.files?.[0];e.target.value="";if(!f)return;photoFileRef.current=f;await handleStudentPhotoFile(f);}}/>
            </div>
            <div className="psms-grid-2" style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,minWidth:0}}>
              <Inp label="Admission No" value={form.admissionNo} onChange={v=>setForm(x=>({...x,admissionNo:v}))} placeholder={editingId?"":("Next: "+suggestedFormAdm)}/>
              <Inp label="Roll No" value={form.rollNo} onChange={v=>setForm(x=>({...x,rollNo:v}))} placeholder={editingId?"":("Next in class: "+suggestedFormRoll)}/>
              <Inp label="Student Name" value={form.name} onChange={v=>setForm(x=>({...x,name:toProperCaseNameInput(v)}))} disabled={!!editingId&&personalLocked}/>
              <Inp label="Father's Name" value={form.fatherName} onChange={v=>setForm(x=>({...x,fatherName:toProperCaseNameInput(v)}))} disabled={!!editingId&&personalLocked}/>
              <Inp label="Bay Form" value={form.bayForm} onChange={v=>setForm(x=>({...x,bayForm:formatCnic(v)}))} placeholder="00000-0000000-0" disabled={!!editingId&&personalLocked}/>
              <Inp label="Date of Birth" value={form.dob} onChange={v=>setForm(x=>({...x,dob:formatDob(v)}))} placeholder="dd/mm/yyyy" disabled={!!editingId&&personalLocked}/>
              <Inp label="WhatsApp No" value={form.whatsapp} onChange={v=>setForm(x=>({...x,whatsapp:formatWhatsapp(v)}))} placeholder="0000-0000000" disabled={!!editingId&&personalLocked}/>
              <Sel label="Class" value={form.classId} onChange={v=>setForm(x=>({...x,classId:v}))} options={settings.classes.map(c=>({value:c.id,label:formatClassDisplay(c)}))}/>
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
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn outline color={C.gray} onClick={closeModal}>Cancel</Btn><Btn onClick={save}>{editingId?"Update Student":"Save Student"}</Btn></div>
        </div>
      </div>
    </div>}
  </div>;
}

