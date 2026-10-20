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
import signImg from "@/assets/sign.png";
import { yieldToMain } from "@/yieldToMain.js";
import { C, schoolOrBrandLogo, APP_BRAND_LOGO, genId } from "@/shared/theme";
import { SchoolHeader } from "@/components/AppControls";
import { ModulePageShell } from "@/components/ModulePageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

const PAPER_TYPES = [
  { id: "regular", l: "Regular", label: "Regular Paper" },
  { id: "english", l: "English Medium", label: "English Medium Paper" },
  { id: "urdu", l: "Urdu Medium", label: "Urdu Medium Paper" },
  { id: "englishLang", l: "English Lang", label: "English Language Paper" },
  { id: "urduLang", l: "Urdu Lang", label: "Urdu Language Paper" },
  { id: "autoPaper", l: "Auto Paper", label: "Auto Paper Generator" },
];

export function PaperGeneratorPage({settings,questionBank,setQuestionBank,setBarSubtitle}){
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
  return (
    <ModulePageShell
      title="Paper Generator"
      description={PAPER_TYPES.find((t) => t.id === paperType)?.label || "Build and print exam papers"}
      tabs={PAPER_TYPES}
      tab={paperType}
      onTabChange={setPaperType}
      bareContent
      actions={
        paperType !== "autoPaper" ? (
          <Button variant="outline" onClick={() => setPreview(true)}>Preview Paper</Button>
        ) : null
      }
    >
    {printPaperMode&&<div className={`paper-print-only${(paperType==="urdu"||paperType==="urduLang")?"":" font-heading"}`} style={{position:"absolute",left:"-9999px",top:0,width:"100%",padding:20,fontFamily:(paperType==="urdu"||paperType==="urduLang")?"'Jameel Noori Nastaliq Regular','Jameel Noori Nastaliq',serif":undefined,direction:(paperType==="urdu"||paperType==="urduLang")?"rtl":"ltr",textAlign:(paperType==="urdu"||paperType==="urduLang")?"right":"left",fontSize:(paperType==="urdu"||paperType==="urduLang")?14:undefined,boxSizing:"border-box"}}>{paperContent}</div>}
    {paperType==="autoPaper" ? (
      <Card size="sm" className="shadow-none">
        <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Question Bank & Auto Paper</CardTitle>
            <CardDescription>Manage questions chapter-wise and generate papers using smart selection.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={autoPaperSubPage==="dashboard"?"default":"outline"} onClick={() => setAutoPaperSubPage("dashboard")}>Dashboard</Button>
            <Button type="button" size="sm" variant={autoPaperSubPage==="upload"?"default":"outline"} onClick={() => setAutoPaperSubPage("upload")}>Import</Button>
            <Button type="button" size="sm" variant={autoPaperSubPage==="planning"?"default":"outline"} onClick={() => setAutoPaperSubPage("planning")}>Planning</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-(--card-spacing)">

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12,marginBottom:20,padding:16,background:"#fff",borderRadius:8,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-muted-foreground">Class</Label>
            <NativeSelect size="sm" className="w-full" value={selCls} onChange={e=>setSelCls(e.target.value)}>
              {settings.classes.map(c=><NativeSelectOption key={c.id} value={c.id}>{formatClassDisplay(c)}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-muted-foreground">Subject</Label>
            <NativeSelect size="sm" className="w-full" value={subj} onChange={e=>setSubj(e.target.value)}>
              {subs.map(s=><NativeSelectOption key={s} value={s}>{s}</NativeSelectOption>)}
            </NativeSelect>
          </div>
        </div>

        {!subj ? (
          <div style={{textAlign:"center",padding:40,color:C.gray}}>Select a class and subject to access the bank.</div>
          ) : autoPaperSubPage === "upload" ? (
          <div style={{background:"#fff",padding:24,borderRadius:8,border:"1px solid #e5e7eb"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h4 style={{margin:0,color:C.navy}}>Import from Excel</h4>
              <Button type="button" variant="outline" size="sm" onClick={() => void handleDownloadTemplate()}>⬇️ Download Template</Button>
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
                  <Button onClick={()=>{ setBankForCurrent([...bankForCurrent, ...excelPreview.mcqs, ...excelPreview.short, ...excelPreview.long]); setExcelPreview(null); alert("Questions imported to question bank."); setAutoPaperSubPage("dashboard"); }}>Save to Question Bank</Button>
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
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold text-muted-foreground">Chapter</Label>
                <NativeSelect size="sm" className="w-full" value={genChapter} onChange={e=>setGenChapter(e.target.value)}>
                  <NativeSelectOption value="all">All Chapters</NativeSelectOption>
                  {chapters.map(c=><NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>)}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold text-muted-foreground">Topic</Label>
                <NativeSelect size="sm" className="w-full" value={genTopic} onChange={e=>setGenTopic(e.target.value)}>
                  <NativeSelectOption value="all">All Topics</NativeSelectOption>
                  {genTopics.map(t=><NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>)}
                </NativeSelect>
              </div>
            </div>
              <div style={{display:"flex",gap:16,alignItems:"flex-end",padding:20,background:"#f1f5f9",borderRadius:12,marginBottom:24,flexWrap:"wrap"}}>
              <div className="flex flex-col gap-1"><Label className="text-xs font-semibold text-muted-foreground">MCQs (%)</Label><Input type="number" className="w-[70px]" value={genPercentMcq} onChange={e=>setGenPercentMcq(e.target.value)} placeholder="All"/></div>
              <div className="flex flex-col gap-1"><Label className="text-xs font-semibold text-muted-foreground">Short (%)</Label><Input type="number" className="w-[70px]" value={genPercentShort} onChange={e=>setGenPercentShort(e.target.value)} placeholder="All"/></div>
              <div className="flex flex-col gap-1"><Label className="text-xs font-semibold text-muted-foreground">Long (%)</Label><Input type="number" className="w-[70px]" value={genPercentLong} onChange={e=>setGenPercentLong(e.target.value)} placeholder="All"/></div>
              <Button onClick={advancedGenerateFromBank}>Generate Random Paper</Button>
            </div>
            {preview && <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><h5 style={{margin:0}}>Preview</h5><Button variant="outline" onClick={()=>{setPrintPaperMode(true); setTimeout(()=>window.print(),50);}}>Print Paper</Button></div><div className="font-heading" style={{padding:24,background:"#fff",border:"2px solid #e2e8f0",borderRadius:8}}>{paperContent}</div></div>}
          </div>
        ) : (
          <div style={{background:"#fff",padding:20,borderRadius:8,border:"1px solid #e5e7eb"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}}>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold text-muted-foreground">Search</Label>
                <Input value={qbSearch} onChange={e=>{setQbSearch(e.target.value); setQbPage(1);}} placeholder="Keyword..."/>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold text-muted-foreground">Type</Label>
                <NativeSelect size="sm" className="w-full" value={qbFilterType} onChange={e=>{setQbFilterType(e.target.value); setQbPage(1);}}>
                  <NativeSelectOption value="all">All Types</NativeSelectOption>
                  <NativeSelectOption value="MCQs">MCQs</NativeSelectOption>
                  <NativeSelectOption value="Short">Short</NativeSelectOption>
                  <NativeSelectOption value="Long">Long</NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold text-muted-foreground">Difficulty</Label>
                <NativeSelect size="sm" className="w-full" value={qbFilterDifficulty} onChange={e=>{setQbFilterDifficulty(e.target.value); setQbPage(1);}}>
                  <NativeSelectOption value="all">All</NativeSelectOption>
                  <NativeSelectOption value="Easy">Easy</NativeSelectOption>
                  <NativeSelectOption value="Medium">Medium</NativeSelectOption>
                  <NativeSelectOption value="Hard">Hard</NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold text-muted-foreground">Chapter</Label>
                <NativeSelect size="sm" className="w-full" value={qbFilterChapter} onChange={e=>{setQbFilterChapter(e.target.value); setQbPage(1);}}>
                  <NativeSelectOption value="all">All Chapters</NativeSelectOption>
                  {chapters.map(c=><NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>)}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-semibold text-muted-foreground">Topic</Label>
                <NativeSelect size="sm" className="w-full" value={qbFilterTopic} onChange={e=>{setQbFilterTopic(e.target.value); setQbPage(1);}}>
                  <NativeSelectOption value="all">All Topics</NativeSelectOption>
                  {topics.map(t=><NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>)}
                </NativeSelect>
              </div>
            </div>
            <div style={{marginBottom:16,display:"flex",gap:8,flexWrap:"wrap"}}>
              <Button variant="outline" onClick={()=>setBankForCurrent([...bankForCurrent, {id:genId(),type:"MCQs",text:"",options:["","","",""],correct:0,chapter:"",topic:"",difficulty:"Medium"}])}>Add MCQ</Button>
              <Button variant="outline" onClick={()=>setBankForCurrent([...bankForCurrent, {id:genId(),type:"Short",text:"",chapter:"",topic:"",difficulty:"Medium"}])}>Add Short</Button>
              <Button variant="outline" onClick={()=>setBankForCurrent([...bankForCurrent, {id:genId(),type:"Long",text:"",chapter:"",topic:"",difficulty:"Medium"}])}>Add Long</Button>
              <Button type="button" variant="outline" className="ml-auto gap-1.5" onClick={() => void handleExportExcel()}><Download size={14}/> Export Excel</Button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
              {paginatedQb.length===0?<div style={{textAlign:"center",padding:40,color:C.gray}}>No questions found.</div>:paginatedQb.map(q=>(
                <div key={q.id} style={{padding:15,background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <div style={{display:"flex",gap:4}}>
                      <span style={{fontSize:10,fontWeight:700,background:C.navy,color:"#fff",padding:"2px 6px",borderRadius:4}}>{q.type}</span>
                      <span style={{fontSize:10,fontWeight:700,background:q.difficulty==="Hard"?"#ef4444":q.difficulty==="Medium"?"#f59e0b":"#10b981",color:"#fff",padding:"2px 6px",borderRadius:4}}>{q.difficulty || "Medium"}</span>
                    </div>
                    <Button type="button" variant="link" className="h-auto p-0 text-[11px] text-destructive" onClick={()=>setBankForCurrent(bankForCurrent.filter(x=>x.id!==q.id))}>Delete</Button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
                    <Textarea value={q.text} onChange={e=>setBankForCurrent(bankForCurrent.map(x=>x.id===q.id?{...x,text:e.target.value}:x))} placeholder="Question text..." className="min-h-[60px] text-xs"/>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      <div className="grid gap-1.5">
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs font-semibold text-muted-foreground">Chapter</Label>
                          <Input value={q.chapter} onChange={e=>setBankForCurrent(bankForCurrent.map(x=>x.id===q.id?{...x,chapter:e.target.value}:x))}/>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs font-semibold text-muted-foreground">Topic</Label>
                          <Input value={q.topic} onChange={e=>setBankForCurrent(bankForCurrent.map(x=>x.id===q.id?{...x,topic:e.target.value}:x))}/>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs font-semibold text-muted-foreground">Difficulty</Label>
                        <NativeSelect size="sm" className="w-full" value={q.difficulty||"Medium"} onChange={e=>setBankForCurrent(bankForCurrent.map(x=>x.id===q.id?{...x,difficulty:e.target.value}:x))}>
                          <NativeSelectOption value="Easy">Easy</NativeSelectOption>
                          <NativeSelectOption value="Medium">Medium</NativeSelectOption>
                          <NativeSelectOption value="Hard">Hard</NativeSelectOption>
                        </NativeSelect>
                      </div>
                    </div>
                  </div>
                  {q.type==="MCQs"&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>{(q.options||["","","",""]).map((o,oi)=><Input key={oi} className="h-8 text-[11px]" value={o} onChange={e=>{const op=[...(q.options||["","","",""])];op[oi]=e.target.value;setBankForCurrent(bankForCurrent.map(x=>x.id===q.id?{...x,options:op}:x));}} placeholder={`Opt ${String.fromCharCode(65+oi)}`}/>)}</div>}
                </div>
              ))}
            </div>
            {totalQbPages > 1 && <div className="mt-5 flex justify-center gap-2">{Array.from({length:totalQbPages},(_,i)=>i+1).map(p=><Button key={p} type="button" size="sm" variant={qbPage===p?"default":"outline"} onClick={()=>setQbPage(p)}>{p}</Button>)}</div>}
          </div>
        )}
        </CardContent>
      </Card>
    ) : (
    <>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10,marginBottom:12}}>
      <div className="flex flex-col gap-1">
        <Label className="text-xs font-semibold text-muted-foreground">Class</Label>
        <NativeSelect size="sm" className="w-full" value={selCls} onChange={e=>setSelCls(e.target.value)}>
          {settings.classes.map(c=><NativeSelectOption key={c.id} value={c.id}>{formatClassDisplay(c)}</NativeSelectOption>)}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs font-semibold text-muted-foreground">Subject</Label>
        <NativeSelect size="sm" className="w-full" value={subj} onChange={e=>setSubj(e.target.value)}>
          {subs.map(s=><NativeSelectOption key={s} value={s}>{s}</NativeSelectOption>)}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs font-semibold text-muted-foreground">Exam</Label>
        <NativeSelect size="sm" className="w-full" value={exam} onChange={e=>setExam(e.target.value)}>
          {["1st Term","Mid Term","Final Term","Annual"].map(o=><NativeSelectOption key={o} value={o}>{o}</NativeSelectOption>)}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs font-semibold text-muted-foreground">Time (min)</Label>
        <Input type="number" value={time} onChange={e=>setTime(+e.target.value)}/>
      </div>
    </div>
    <div style={{padding:"6px 12px",background:"#fef3c7",borderRadius:5,fontSize:12,color:"#92400e",fontWeight:700,marginBottom:12,marginTop:6}}>Total Marks: {total}</div>
    {sections.map(sec=><div key={sec.id} style={{border:"1.5px solid #e5e7eb",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
      <div style={{background:C.navy,color:"#fff",padding:"8px 12px",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <Input value={sec.title} onChange={e=>setSections(s=>s.map(x=>x.id===sec.id?{...x,title:e.target.value}:x))} className="h-auto flex-1 border-none bg-transparent px-0 py-0 text-[13px] font-bold text-white shadow-none focus-visible:ring-0"/>
        <Input type="number" value={sec.marks} onChange={e=>setSections(s=>s.map(x=>x.id===sec.id?{...x,marks:+e.target.value}:x))} className="h-7 w-14 border-none bg-white/95 text-center text-xs shadow-none"/>
        <span style={{fontSize:11}}>marks</span>
      </div>
      <div style={{padding:10}}>
        <Input value={sec.instructions} onChange={e=>setSections(s=>s.map(x=>x.id===sec.id?{...x,instructions:e.target.value}:x))} placeholder="Instructions…" className="mb-2 text-xs"/>
        {sec.questions.map((q,qi)=><div key={q.id} style={{background:"#f9fafb",borderRadius:6,padding:8,marginBottom:6}}>
          <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>
            <span style={{fontWeight:700,color:C.navy,minWidth:22,paddingTop:6,fontSize:12}}>Q{qi+1}.</span>
            <Textarea value={q.text} onChange={e=>upQ(sec.id,q.id,"text",e.target.value)} placeholder="Question…" className="min-h-11 flex-1 text-xs"/>
            <Button size="sm" variant="destructive" onClick={()=>rmQ(sec.id,q.id)}>×</Button>
          </div>
          {sec.type==="MCQs"&&(
            <RadioGroup
              value={String(q.correct ?? 0)}
              onValueChange={(v)=>upQ(sec.id,q.id,"correct",Number(v))}
              className="mt-1 ml-7 grid grid-cols-2 gap-1"
            >
              {q.options.map((opt,oi)=>(
                <div key={oi} className="flex items-center gap-1">
                  <RadioGroupItem value={String(oi)} id={`cr_${q.id}_${oi}`} />
                  <Input className="h-8 flex-1 text-[11px]" value={opt} onChange={e=>{const opts=[...q.options];opts[oi]=e.target.value;upQ(sec.id,q.id,"options",opts);}} placeholder={`Opt ${String.fromCharCode(65+oi)}`}/>
                </div>
              ))}
            </RadioGroup>
          )}
        </div>)}
        <Button size="sm" variant="outline" onClick={()=>addQ(sec.id)}>Add Question</Button>
      </div>
    </div>)}
    </>
    )}
    <Dialog open={preview} onOpenChange={setPreview}>
      <DialogContent className="max-w-[780px] max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Paper Preview</DialogTitle>
        </DialogHeader>
        <div
          className={(paperType==="urdu"||paperType==="urduLang")?undefined:"font-heading"}
          style={{fontFamily:(paperType==="urdu"||paperType==="urduLang")?"'Jameel Noori Nastaliq Regular','Jameel Noori Nastaliq',serif":undefined,direction:(paperType==="urdu"||paperType==="urduLang")?"rtl":"ltr",textAlign:(paperType==="urdu"||paperType==="urduLang")?"right":"left",fontSize:(paperType==="urdu"||paperType==="urduLang")?14:undefined}}
        >{paperContent}</div>
      </DialogContent>
    </Dialog>
    </ModulePageShell>
  );
}

