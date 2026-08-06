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

const EXAM_TABS = [
  { id: "admission", l: "Admission Form" },
  { id: "record", l: "Student Record" },
  { id: "marks", l: "Enter Marks" },
  { id: "consolidated", l: "Consolidated Sheet" },
  { id: "card", l: "Result Card" },
  { id: "datesheet", l: "Date Sheet" },
];


export function ResultCardHeader({ settings, sessionLabel, examLabel, className }) {
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
export function ExaminationPage({settings:settingsProp,setSettings,students:studentsProp,setStudents,timetable,exam_tm:exam_tmProp,exam_om:exam_omProp,setExamMarks,exam_datesheet:exam_datesheetProp,setDatesheet,currentSession,currentUser,setBarSubtitle}){
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

  const ctrlW = 180;
  const panel = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
  };
  const toolbar = {
    ...panel,
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
    <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="no-print" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#1B5E20", letterSpacing: "-0.02em" }}>Examination</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280" }}>
            {EXAM_TABS.find((x) => x.id === tab)?.l || "Exams"} · session {currentSession || "—"}
          </p>
        </div>
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
        <div>
          <div style={{ ...toolbar }}>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0, maxWidth: 560 }}>
              Fill the form to admit a new student. After saving, they appear in Student Record.
            </p>
            <Btn
              small
              outline
              onClick={() => {
                const el = document.getElementById("admission-form-print");
                if (!el) {
                  alert("Print area not found.");
                  return;
                }
                const printWindow = window.open("", "", "width=800,height=600");
                if (!printWindow) {
                  alert("Please allow pop-ups to print.");
                  return;
                }
                const style = "body{font-family:'Segoe UI',sans-serif;margin:12px;padding:0}";
                printWindow.document.write("<html><head><title>Admission Form</title><style>" + style + "</style></head><body>");
                printWindow.document.write(el.innerHTML);
                printWindow.document.write("</body></html>");
                printWindow.document.close();
                printWindow.focus();
                printWindow.print();
                printWindow.onafterprint = () => printWindow.close();
              }}
            >
              Print
            </Btn>
          </div>
          <div id="admission-form-print" style={{ maxWidth: 720, margin: "0 auto" }}>
            <SchoolHeader settings={settings} subtitle="ADMISSION FORM" />
            <div style={{ ...panel, padding: 20, marginTop: 12 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <div style={{ width: 80, height: 100, border: "2px dashed #d1d5db", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#fafafa" }}>
                    {admissionPhotoBusy ? (
                      <span style={{ fontSize: 10, color: C.gray, textAlign: "center", padding: 4 }}>Processing…</span>
                    ) : admissionForm.photo ? (
                      <img src={admissionForm.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 10, color: C.gray, textAlign: "center" }}>Photo</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
                    <Btn type="button" small outline onClick={() => admissionPhotoGalleryRef.current?.click()} disabled={admissionPhotoBusy}>
                      Gallery
                    </Btn>
                    <Btn type="button" small outline onClick={() => admissionPhotoCameraRef.current?.click()} disabled={admissionPhotoBusy}>
                      Camera
                    </Btn>
                  </div>
                  <input
                    ref={admissionPhotoGalleryRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const f = e.target.files[0];
                      if (!f) return;
                      e.target.value = "";
                      await handleAdmissionPhotoFile(f);
                    }}
                  />
                  <input
                    ref={admissionPhotoCameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const f = e.target.files[0];
                      if (!f) return;
                      e.target.value = "";
                      await handleAdmissionPhotoFile(f);
                    }}
                  />
                </div>
                <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Inp label="Admission No" value={admissionForm.admissionNo} onChange={(v) => setAdmissionForm((x) => ({ ...x, admissionNo: v }))} placeholder={"Next: " + suggestedNextAdm} width="100%" />
                  <Inp label="Roll No" value={admissionForm.rollNo} onChange={(v) => setAdmissionForm((x) => ({ ...x, rollNo: v }))} placeholder={"Next in class: " + suggestedNextRoll} width="100%" />
                  <Inp label="Student Name" value={admissionForm.name} onChange={(v) => setAdmissionForm((x) => ({ ...x, name: toProperCaseNameInput(v) }))} width="100%" />
                  <Inp label="Father's Name" value={admissionForm.fatherName} onChange={(v) => setAdmissionForm((x) => ({ ...x, fatherName: toProperCaseNameInput(v) }))} width="100%" />
                  <Inp label="Form B / Bay Form" value={admissionForm.bayForm} onChange={(v) => setAdmissionForm((x) => ({ ...x, bayForm: formatCnicAf(v) }))} placeholder="00000-0000000-0" width="100%" />
                  <Inp label="Father's CNIC" value={admissionForm.fatherCnic} onChange={(v) => setAdmissionForm((x) => ({ ...x, fatherCnic: formatCnicAf(v) }))} placeholder="00000-0000000-0" width="100%" />
                  <Inp label="WhatsApp No" value={admissionForm.whatsapp} onChange={(v) => setAdmissionForm((x) => ({ ...x, whatsapp: formatWhatsappAf(v) }))} placeholder="0000-0000000" width="100%" />
                  <Sel label="Class" value={admissionForm.classId} onChange={(v) => setAdmissionForm((x) => ({ ...x, classId: v }))} options={settings.classes.map((c) => ({ value: c.id, label: formatClassDisplay(c) }))} width="100%" />
                  <Inp label="Date of Birth" value={admissionForm.dob} onChange={(v) => setAdmissionForm((x) => ({ ...x, dob: formatDobAf(v) }))} placeholder="dd/mm/yyyy" width="100%" />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Btn onClick={saveAdmission}>Save & Admit Student</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "record" && (
        <div style={{ ...panel, padding: 12 }}>
          <StudentsPage settings={settings} students={students} setStudents={setStudents} embedded currentSession={currentSession} currentUser={currentUser} />
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
                📊 Export Excel
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
                📥 Import Excel
              </Btn>
              <Btn small outline onClick={() => exportMarksPdf().catch(() => alert("PDF export failed."))}>
                📄 PDF
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
                📄 PDF
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
                              {s.photo ? <img src={s.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 9, color: C.gray }}>Photo</span>}
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
                                  Promote
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
          <div className="no-print" style={toolbar}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
              <Sel label="Class" value={rcCls} onChange={setRcCls} options={settings.classes.map((c) => ({ value: c.id, label: formatClassDisplay(c) }))} width={ctrlW} />
              <Sel label="Exam" value={rcExam} onChange={setRcExam} options={[{ value: "overall", label: "Overall (All Terms)" }, ...exams.map((e) => ({ value: e, label: e }))]} width={ctrlW} />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 0.4 }}>Pass %</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
                    style={{ padding: "6px 10px", border: "1.5px solid #d1d5db", borderRadius: 5, fontSize: 13, background: "#fff", width: ctrlW, boxSizing: "border-box" }}
                  />
                  <span style={{ fontSize: 13, color: C.gray, fontWeight: 600 }}>%</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                <button
                  type="button"
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
                    const next = Math.max(min, cur - 1);
                    setRcRoll(String(next));
                  }}
                  style={{ border: "1px solid #d1d5db", background: "#fff", borderRadius: 4, padding: "6px 8px", cursor: "pointer", fontSize: 13 }}
                >
                  ←
                </button>
                <Inp label="Roll No" value={rcRoll} onChange={setRcRoll} placeholder="Enter Roll No" width={ctrlW} />
                <button
                  type="button"
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
                    const next = Math.min(max, cur + 1);
                    setRcRoll(String(next));
                  }}
                  style={{ border: "1px solid #d1d5db", background: "#fff", borderRadius: 4, padding: "6px 8px", cursor: "pointer", fontSize: 13 }}
                >
                  →
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Btn small outline disabled={singlePdfBusy || classPdfBusy || !String(rcRoll || "").trim()} onClick={() => void exportSingleResultCardPdf()}>
                {singlePdfBusy ? "⏳ PDF…" : "📄 PDF"}
              </Btn>
              <Btn small disabled={classPdfBusy || singlePdfBusy} onClick={requestClassPdfExport}>
                {classPdfBusy ? "⏳ Class PDF…" : "📄 Class PDF"}
              </Btn>
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
              <Btn onClick={() => setDsDates((rows) => [...rows, { id: genId(), date: new Date().toISOString().split("T")[0] }])}>+ Add Date</Btn>
              <Btn outline danger disabled={dsDates.length <= 1} onClick={() => setDsDates((rows) => (rows.length > 1 ? rows.slice(0, -1) : rows))}>
                Remove Date
              </Btn>
              <Btn outline onClick={() => setDsCols((cols) => [...cols, { id: genId(), classId: "" }])}>
                + Add Class Column
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


export function StudentsPage({settings:settingsProp,students:studentsProp,setStudents,embedded,currentSession,currentUser}){
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

