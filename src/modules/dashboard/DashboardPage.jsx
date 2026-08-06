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
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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

export function DashboardPage({settings,students,staffProfiles=[],exam_tm:examTmProp,exam_om:examOmProp,activeSchoolId}){
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
  return <div className="space-y-5">
    <style>{`
      .dash-stat-card{ transition:transform 0.2s ease,box-shadow 0.2s ease; }
      .dash-stat-card:hover{ transform:translateY(-2px); box-shadow:0 10px 26px rgba(15,23,42,0.14); }
      .dash-class-card{ transition:transform 0.2s ease,box-shadow 0.2s ease; }
      .dash-class-card:hover{ transform:translateY(-1px); box-shadow:0 6px 16px rgba(15,23,42,0.12); }
      @media (max-width:768px){
        .dash-exam-row{ width:100%; max-width:100%; min-width:0; position:relative; z-index:6; flex:1 1 100%; }
        .dash-class-summary-panel{ position:relative; z-index:1; overflow:visible; }
      }
    `}</style>
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
      {stats.map((s) => (
        <Card key={s.l} className="dash-stat-card relative overflow-hidden border-border/70 shadow-sm">
          <CardContent className="p-5">
            <div
              className="pointer-events-none absolute -right-9 -top-9 h-36 w-36 rounded-full opacity-90"
              style={{ background: `radial-gradient(circle at 30% 30%, ${s.c}33, transparent 65%)` }}
            />
            <div className="mb-2 text-5xl leading-none">{s.i}</div>
            <div className="text-3xl font-bold tracking-tight" style={{ color: s.c }}>{s.v}</div>
            <div className="mt-1 text-xs font-medium text-muted-foreground">{s.l}</div>
          </CardContent>
        </Card>
      ))}
    </div>

    {settings.classes.length>0&&(
      <Card className="dash-class-summary-panel border-border/70 shadow-sm">
        <CardContent className="space-y-3 p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2.5">
          <h3 className="m-0 text-sm font-semibold text-primary">{dashView==="class"?"Class-wise Summary":"Subject-wise Summary"}</h3>
          <Tabs value={dashView} onValueChange={setDashView}>
            <TabsList>
              <TabsTrigger value="class">Class-wise</TabsTrigger>
              <TabsTrigger value="subject">Subject-wise</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Separator />
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
        </CardContent>
      </Card>
    )}
  </div>;
}
