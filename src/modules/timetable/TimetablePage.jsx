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
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
  DEFAULT_PRINT_PORTION_MASK,
} = H;

const jsPDF =
  typeof jsPDFModule === "function"
    ? jsPDFModule
    : jsPDFModule?.jsPDF ?? jsPDFModule?.default;


export function TTCell(props){
  const {subject,teacher,onOpen,busy}=props;
  const hasAssign=!!(subject||teacher);
  return <div
    onClick={onOpen}
    role="button"
    tabIndex={0}
    onKeyDown={e=>e.key==="Enter"&&onOpen?.()}
    className="tt-cell"
    style={{
      padding:"4px 3px",
      minHeight:44,
      height:"100%",
      display:"flex",
      alignItems:"center",
      justifyContent:"center",
      cursor:"pointer",
      boxSizing:"border-box",
      background: busy ? "rgba(239,68,68,0.08)" : "transparent",
    }}
  >
    {hasAssign
      ? (
        <div className="tt-cell-stack" style={{textAlign:"center",width:"100%",lineHeight:1.2,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:12,color:"#0f172a",lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={subject||""}>{subject}</div>
          {String(teacher || "").trim() ? (
            <div style={{fontSize:10,color:"#334155",fontWeight:500,lineHeight:1.2,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={teacher}>{teacher}</div>
          ) : null}
        </div>
      )
      : (
        <div className="tt-empty-plus" style={{fontWeight:700,fontSize:16,color:"#94a3b8",lineHeight:1}}>+</div>
      )}
  </div>;
}

// Portion filter for All Classes print: primary = nursery + 1–5, middle 6–8, high 9–12, full = all

// ─── ALL CLASSES VIEW ─────────────────────────────────────────────────────────
export function AllClassesView({settings,staffProfiles,timetable,setTimetable,day,classes:classesOverride}){
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

  return <div style={{overflowX:"auto",border:"1px solid #e2e8f0",borderRadius:10,background:"#fff"}}>
    <table className="timetable-pdf-export tt-grid" style={{borderCollapse:"collapse",fontSize:11,minWidth:900,width:"100%",tableLayout:"fixed"}}>
      <thead>
        <tr>
          <th style={{background:"#15803d",color:"#fff",padding:"8px 8px",width:100,minWidth:100,position:"sticky",left:0,zIndex:2,fontSize:12,textAlign:"center",verticalAlign:"middle"}}>Class</th>
          {pRows.map((p,i)=>[
            <th key={`ph${i}`} style={{background:"#15803d",color:"#fff",padding:"6px 4px",minWidth:92,textAlign:"center",verticalAlign:"middle",whiteSpace:"pre-line",fontWeight:700,lineHeight:1.25}}>
              {timetablePdfPeriodCell(getPeriodLabel(i, settings), `${fmtMin(p.start)}–${fmtMin(p.end)}`)}
            </th>,
            i===brAfterIdx&&brRow&&<th key={`bh${i}`} className="timetable-pdf-break-th" style={{background:C.breakC,color:"#78350f",padding:"6px 4px",width:56,minWidth:56,textAlign:"center",verticalAlign:"middle",fontWeight:700,fontSize:10,whiteSpace:"pre-line",lineHeight:1.25}}>{timetablePdfPeriodCell("Break", `${fmtMin(brRow.start)}–${fmtMin(brRow.end)}`)}</th>
          ])}
        </tr>
      </thead>
      <tbody>
        {classes.map((cls,ri)=>{
          const gradeCommon=settings.commonTeachers?.[cls.grade]||{};
          return <tr key={cls.id} style={{background:ri%2===0?"#f8fafc":"#fff"}}>
            <td style={{padding:"6px 8px",fontWeight:700,color:"#0f172a",background:ri%2===0?"#ecfdf5":"#f0fdf4",position:"sticky",left:0,zIndex:1,fontSize:12,whiteSpace:"nowrap",textAlign:"center",verticalAlign:"middle"}}>{formatClassDisplay(cls)}</td>
            {pRows.map((p,pi)=>{
              const cell=getTT(timetable,cls.id,day,pi);
              const busy=teacherBusy(cell.teacher,pi,cls.id);
              const isCommon=!!(cell.subject&&gradeCommon[cell.subject]);
              return [
                <td key={`c${pi}`} style={{padding:0,minWidth:92,border:"1px solid #cbd5e1",verticalAlign:"middle",height:52}}>
                  <TTCell subject={cell.subject} teacher={cell.teacher}
                    isCommon={isCommon} busy={busy}
                    onOpen={()=>openEditor(cls.id,pi)}/>
                </td>,
                pi===brAfterIdx&&<td key={`b${pi}`} style={{background:C.breakL,textAlign:"center",verticalAlign:"middle",fontWeight:700,fontSize:10,color:"#92400e",padding:"4px 2px",width:56,minWidth:56}}>BREAK</td>
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
export function AllClassesAllDaysView({settings,staffProfiles,timetable,setTimetable}){
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
          <th style={{background:"#15803d",color:"#fff",padding:"6px 8px",minWidth:88,position:"sticky",left:0,zIndex:2,fontSize:12}}>Class</th>
          {pRows.map((p,i)=>[
            <th key={`ph${i}`} style={{background:"#15803d",color:"#fff",padding:"4px 5px",minWidth:88,textAlign:"center",whiteSpace:"pre-line",fontWeight:700}}>
              {timetablePdfPeriodCell(getPeriodLabel(i, settings), `${fmtMin(p.start)}–${fmtMin(p.end)}`)}
            </th>,
            i===brAfterIdx&&brRow&&<th key={`bh${i}`} className="timetable-pdf-break-th" style={{background:C.breakC,color:"#78350f",padding:"4px 5px",minWidth:58,textAlign:"center",fontWeight:700,fontSize:10,whiteSpace:"pre-line"}}>{timetablePdfPeriodCell("Break", `${fmtMin(brRow.start)}–${fmtMin(brRow.end)}`)}</th>
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
export function TeachersView({settings,timetable,day,staff:staffOverride,printSubtitle,suppressPrintHeader}){
  const staffList=staffOverride!=null&&Array.isArray(staffOverride)?staffOverride:settings.staff;
  const {rows} = calcTimes(settings,day);
  const pRows = rows.filter(r=>!r.isBreak);
  const brRow = rows.find((r) => r.isBreak);
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

  return <div style={{overflowX:"auto",border:"1px solid #e2e8f0",borderRadius:10,background:"#fff"}}>
    {!suppressPrintHeader&&<div className="print-only" style={{display:"none",marginBottom:8}}>
      <SchoolHeader settings={settings} subtitle={printSubtitle||"TEACHERS TIMETABLE"}/>
    </div>}
    <table className="timetable-pdf-export tt-grid" style={{borderCollapse:"collapse",fontSize:11,minWidth:800,width:"100%",tableLayout:"fixed"}}>
      <thead>
        <tr>
          <th style={{background:"#15803d",color:"#fff",padding:"8px 6px",width:120,minWidth:120,position:"sticky",left:0,zIndex:2,fontSize:11,textAlign:"center",verticalAlign:"middle"}}>Teacher</th>
          {pRows.map((p,i)=>[
            <th key={`th${i}`} style={{background:"#15803d",color:"#fff",padding:"6px 4px",minWidth:88,textAlign:"center",verticalAlign:"middle",fontSize:11,whiteSpace:"pre-line",fontWeight:700,lineHeight:1.25}}>
              {timetablePdfPeriodCell(getPeriodLabel(i, settings), `${fmtMin(p.start)}–${fmtMin(p.end)}`)}
            </th>,
            i===brAfterIdx&&brRow&&<th key={`tbh${i}`} className="timetable-pdf-break-th" style={{background:C.breakC,color:"#78350f",padding:"6px 4px",width:56,minWidth:56,textAlign:"center",verticalAlign:"middle",fontWeight:700,fontSize:10,whiteSpace:"pre-line",lineHeight:1.25}}>{timetablePdfPeriodCell("Break", `${fmtMin(brRow.start)}–${fmtMin(brRow.end)}`)}</th>
          ])}
          <th style={{background:"#15803d",color:"#fff",padding:"8px 6px",width:72,minWidth:72,textAlign:"center",verticalAlign:"middle",fontSize:11}}>Periods</th>
        </tr>
      </thead>
      <tbody>
        {staffList.map((teacher,ri)=>{
          const count=countPeriods(teacher.name);
          return <tr key={teacher.id} style={{background:ri%2===0?"#f8fafc":"#fff"}}>
            <td style={{padding:"6px 6px",fontWeight:700,color:"#0f172a",background:ri%2===0?"#ecfdf5":"#f0fdf4",position:"sticky",left:0,zIndex:1,whiteSpace:"nowrap",fontSize:11,textAlign:"center",verticalAlign:"middle"}}>
              <div style={{overflow:"hidden",textOverflow:"ellipsis"}} title={teacher.name}>{teacher.name}</div>
              {teacher.designation ? <div style={{fontSize:9,color:"#64748b",fontWeight:500,marginTop:2}}>{teacher.designation}</div> : null}
            </td>
            {pRows.map((_,pi)=>{
              const assigned=getAssignment(teacher.name,pi);
              return [
                <td key={`tc${pi}`} style={{padding:0,border:"1px solid #cbd5e1",textAlign:"center",minWidth:88,verticalAlign:"middle",height:52}}>
                  {assigned?(<div style={{padding:"4px 3px",textAlign:"center",lineHeight:1.2}}>
                    <div style={{fontWeight:700,color:"#0f172a",fontSize:11,lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={assigned.subject}>{assigned.subject}</div>
                    <div style={{fontSize:10,color:"#334155",fontWeight:500,lineHeight:1.2,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={assigned.className}>{assigned.className}</div>
                  </div>):<span style={{color:"#cbd5e1",fontSize:10}}>Free</span>}
                </td>,
                pi===brAfterIdx&&<td key={`tb${pi}`} style={{background:C.breakL,textAlign:"center",verticalAlign:"middle",fontWeight:700,fontSize:10,color:"#92400e",padding:2,width:56}}>BREAK</td>
              ];
            })}
            <td style={{textAlign:"center",verticalAlign:"middle",fontWeight:700,fontSize:13,color:count>0?C.navy:C.gray}}>{count||"—"}</td>
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}

// ─── BY CLASS VIEW ────────────────────────────────────────────────────────────
export function ByClassView({settings,staffProfiles,timetable,setTimetable,selCls,suppressPrintHeader}){
  const {rows:monRows} = calcTimes(settings,"Monday");
  const pRows = monRows.filter(r=>!r.isBreak);
  const brRow = monRows.find(r=>r.isBreak);
  const brAfterIdx = settings.breakRequired ? settings.breakAfterPeriod-1 : -1;
  const cls=settings.classes.find(c=>c.id===selCls);
  const classes=settings.classes||[];
  const editable=typeof setTimetable==="function";

  const [editCell,setEditCell]=useState(null);
  const [editSubject,setEditSubject]=useState("");
  const [editTeacher,setEditTeacher]=useState("");

  function teacherBusy(teacher,day,pi,excludeCls){
    if(!teacher) return false;
    return classes.some(c=>c.id!==excludeCls&&getTT(timetable,c.id,day,pi).teacher===teacher);
  }
  function subjectUsed(cid,day,subj,excludePi){
    if(!subj) return false;
    return pRows.some((_,i)=>i!==excludePi&&getTT(timetable,cid,day,i).subject===subj);
  }
  function applyCommon(cid,day,pi,subject,teacher){
    const rowCls=classes.find(c=>c.id===cid); if(!rowCls) return;
    const common=settings.commonTeachers?.[rowCls.grade]||{};
    const normSubj=(subject||"").trim();
    if(!normSubj||!common[normSubj]||!teacher) return;
    classes.filter(c=>c.grade===rowCls.grade&&c.id!==cid).forEach(sc=>{
      if(getClassSubjects(settings,sc.id,"timetable").some(s=>(s||"").trim()===normSubj)){
        const existing=getTT(timetable,sc.id,day,pi);
        if(!existing.subject && !existing.teacher){
          setTTSingleDay(setTimetable,sc.id,day,pi,{subject:normSubj,teacher,isCommon:true});
        }
      }
    });
  }
  const openEditor=(day,pi)=>{
    if(!editable) return;
    const cell=getTT(timetable,selCls,day,pi);
    setEditCell({day,pi});
    setEditSubject(cell.subject||"");
    setEditTeacher(cell.teacher||"");
  };
  const closeEditor=()=>{ setEditCell(null); };
  const saveEditor=()=>{
    if(!editCell||!editable) return;
    if(!editSubject){ alert("Please select a subject before saving this period."); return; }
    if(!editTeacher){ alert("Please select a teacher before saving this period."); return; }
    const {day,pi}=editCell;
    if(teacherBusy(editTeacher,day,pi,selCls)){
      alert("This teacher is already assigned in the same period for another class. Please select a different teacher.");
      return;
    }
    const counterpartMismatches=[];
    pRows.forEach((_,i)=>{
      if(i===pi) return;
      const cell=getTT(timetable,selCls,day,i);
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
    const next={subject:editSubject,teacher:editTeacher};
    setTTSingleDay(setTimetable,selCls,day,pi,next);
    pRows.forEach((_,i)=>{
      if(i===pi) return;
      const cell=getTT(timetable,selCls,day,i);
      if(isABCounterpartSubject(cell.subject,editSubject)){
        setTTSingleDay(setTimetable,selCls,day,i,{...cell,teacher:editTeacher});
      }
    });
    applyCommon(selCls,day,pi,next.subject,next.teacher);
    setEditCell(null);
  };

  const renderModal=()=>{
    if(!editCell||!editable) return null;
    const {day,pi}=editCell;
    const subjects=getClassSubjects(settings,selCls,"timetable");
    const {rows}=calcTimes(settings,day);
    const dp=rows.filter(r=>!r.isBreak);
    const period=dp[pi];
    const currentCell=getTT(timetable,selCls,day,pi);
    const subjectOptions=subjects.filter(s=>!subjectUsed(selCls,day,s,pi)||s===currentCell.subject);
    const gradeCommon=settings.commonTeachers?.[cls?.grade]||{};
    const teacherOptions=teachingStaffList(settings,staffProfiles).filter(st=>{
      const isCurrent=st.name===currentCell.teacher;
      if(isCurrent) return true;
      return !teacherBusy(st.name,day,pi,selCls);
    });
    return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={closeEditor}>
      <div style={{background:"#fff",borderRadius:10,width:"100%",maxWidth:420,maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:C.navy,color:"#fff",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontWeight:700,fontSize:14}}>Assign Period</span>
          <button type="button" onClick={closeEditor} style={{background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{padding:16,fontSize:14}}>
          <div style={{marginBottom:8,color:"#000"}}>
            <div><strong>Class:</strong> {cls?formatClassDisplay(cls):""}</div>
            <div><strong>Day:</strong> {day}</div>
            <div><strong>Period:</strong> {getPeriodLabel(pi,settings)} ({period?`${fmtMin(period.start)}–${fmtMin(period.end)}`:""})</div>
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
              type="button"
              onClick={()=>{
                if(!editCell) return;
                const {day,pi}=editCell;
                setEditSubject("");
                setEditTeacher("");
                setTTSingleDay(setTimetable,selCls,day,pi,{subject:"",teacher:""});
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

  return <div>
    {!suppressPrintHeader&&<div className="print-only" style={{display:"none",marginBottom:8}}>
      <SchoolHeader settings={settings} subtitle={`${cls?.name||""} — CLASS TIMETABLE`}/>
    </div>}
    <div style={{overflowX:"auto",border:"1px solid #e2e8f0",borderRadius:10,background:"#fff"}}>
      <table className="timetable-pdf-export tt-grid" style={{borderCollapse:"collapse",fontSize:11,width:"100%",tableLayout:"fixed",minWidth:720}}>
          <thead>
            <tr>
              <th style={{background:"#15803d",color:"#fff",padding:"8px 8px",width:100,minWidth:100,whiteSpace:"pre-line",textAlign:"center",verticalAlign:"middle",fontWeight:700,lineHeight:1.25}}>{timetablePdfPeriodCell("Day", "Time")}</th>
              {pRows.map((p, i) => [
                <th key={`bch${i}`} style={{background:"#15803d",color:"#fff",padding:"6px 4px",minWidth:88,textAlign:"center",verticalAlign:"middle",whiteSpace:"pre-line",fontWeight:700,lineHeight:1.25}}>
                  {timetablePdfPeriodCell(getPeriodLabel(i, settings), `${fmtMin(p.start)}–${fmtMin(p.end)}`)}
                </th>,
                i === brAfterIdx && (
                  <th key={`bcbh${i}`} className="timetable-pdf-break-th" style={{background:C.breakC,color:"#78350f",padding:"6px 4px",width:56,minWidth:56,fontWeight:700,fontSize:10,textAlign:"center",verticalAlign:"middle",whiteSpace:"pre-line",lineHeight:1.25}}>
                    {timetablePdfPeriodCell("Break", brRow ? `${fmtMin(brRow.start)}–${fmtMin(brRow.end)}` : "—")}
                  </th>
                ),
              ])}
            </tr>
          </thead>
          <tbody>
            {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((day,di)=>{
              const {rows} = calcTimes(settings,day);
              const dp = rows.filter(r=>!r.isBreak);
              return <tr key={day} style={{background:di%2===0?"#f8fafc":"#fff"}}>
                <td style={{padding:"6px 8px",fontWeight:700,color:"#0f172a",background:di%2===0?"#ecfdf5":"#f0fdf4",textAlign:"center",verticalAlign:"middle"}}>{day}</td>
                {dp.map((_,pi)=>{
                  const cell=getTT(timetable,selCls,day,pi);
                  const gradeCommon=settings.commonTeachers?.[cls?.grade]||{};
                  const isCommon=!!(cell.subject&&gradeCommon[cell.subject]);
                  const busy=teacherBusy(cell.teacher,day,pi,selCls);
                  return [
                    <td key={`byc${pi}`} style={{padding:0,border:"1px solid #cbd5e1",textAlign:"center",minWidth:88,verticalAlign:"middle",height:52}}>
                      {editable
                        ? <TTCell subject={cell.subject} teacher={cell.teacher} isCommon={isCommon} busy={busy} onOpen={()=>openEditor(day,pi)}/>
                        : (cell.subject?(
                          <div style={{textAlign:"center",padding:"4px 3px",lineHeight:1.2}}>
                            <div style={{fontWeight:700,color:"#0f172a",fontSize:12,lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cell.subject}</div>
                            {String(cell.teacher || "").trim() ? (
                              <div style={{fontSize:10,color:"#334155",fontWeight:500,lineHeight:1.2,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cell.teacher}</div>
                            ) : null}
                          </div>
                        ):(<span style={{color:"#cbd5e1",fontSize:10}}>—</span>))}
                    </td>,
                    pi===brAfterIdx&&<td key={`bycb${pi}`} style={{background:C.breakL,textAlign:"center",verticalAlign:"middle",fontWeight:700,fontSize:10,color:"#92400e",padding:2,width:56}}>BREAK</td>
                  ];
                })}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    {renderModal()}
  </div>;
}

// ─── BY TEACHER VIEW ──────────────────────────────────────────────────────────
export function ByTeacherView({settings,timetable,selT,suppressPrintHeader}){
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
            <tr style={{background:"#15803d",color:"#fff"}}>
              <th style={{padding:"5px 8px",textAlign:"left",minWidth:70}}>Periods</th>
              <th colSpan={2} style={{padding:"5px 8px",textAlign:"center",borderLeft:"1px solid #86efac"}}>MONDAY TO THURSDAY</th>
              <th colSpan={2} style={{padding:"5px 8px",textAlign:"center",borderLeft:"1px solid #86efac"}}>FRIDAY</th>
              <th style={{padding:"5px 8px",textAlign:"center",borderLeft:"1px solid #86efac",minWidth:120}}>CLASS–SUBJECT</th>
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
                    {monAssign?(<div style={{background:"#f3f4ff",borderRadius:6,padding:"3px 9px",display:"inline-block",minWidth:120,textAlign:"center",lineHeight:1.15}}>
                      <div style={{fontWeight:700,color:"#000",fontSize:11,lineHeight:1.15}}>{monAssign.subject}</div>
                      <br />
                      <div style={{fontSize:10,color:"#000",fontWeight:400,lineHeight:1.15}}>{monAssign.className}</div>
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
export function TimetablePage({settings,staffProfiles,timetable,setTimetable,currentSession,setBarSubtitle}){
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

  const teachersWithSubjects = useMemo(() => {
    return teachingStaff.filter(st => {
      const subj = String(st.subj || "").trim();
      return subj.length > 0;
    }).map(st => ({
      name: st.name,
      subjects: (String(st.subj || "")).split(/[,;]/).map(s => s.trim().toLowerCase()).filter(Boolean)
    }));
  }, [teachingStaff]);

  const autoGenerateTimetable = () => {
    if (!settings?.classes?.length || !teachersWithSubjects.length) {
      alert("No classes or teachers with subject qualifications found.");
      return;
    }
    if (!confirm("This will replace the current timetable. Continue?")) return;

    const newTimetable = {};
    const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const { rows: periodRows } = calcTimes(settings, "Monday");
    const teachingPeriods = periodRows.filter(r => !r.isBreak);
    const subjectNorm = (s) => String(s || "").trim().toLowerCase();

    for (const cls of settings.classes) {
      const classSubjects = getClassSubjects(settings, cls.id, "timetable").map(subjectNorm).filter(Boolean);
      if (!classSubjects.length) continue;

      newTimetable[cls.id] = {};

      for (const day of weekdays) {
        newTimetable[cls.id][day] = {};

        const usedTeachers = new Set();

        for (let pi = 0; pi < teachingPeriods.length; pi++) {
          let assignedSubject = "";
          let assignedTeacher = "";

          for (const subjNorm of classSubjects) {
            const originalSubject = getClassSubjects(settings, cls.id, "timetable").find(cs => subjectNorm(cs) === subjNorm) || "";

            const candidates = teachersWithSubjects.filter(t =>
              t.subjects.some(ts => ts === subjNorm || ts.includes(subjNorm) || subjNorm.includes(ts)) &&
              !usedTeachers.has(t.name)
            );

            if (candidates.length > 0) {
              assignedSubject = originalSubject;
              assignedTeacher = candidates[0].name;
              usedTeachers.add(assignedTeacher);
              break;
            }
          }

          if (assignedSubject && assignedTeacher) {
            newTimetable[cls.id][day][pi] = { subject: assignedSubject, teacher: assignedTeacher };
          }
        }
      }
    }

    setTimetable(newTimetable);
    alert("Timetable auto-generated successfully!");
  };

  return <div className="timetable-page timetable-print-area space-y-3" style={{width:"100%",maxWidth:"100%",minWidth:0,boxSizing:"border-box"}}>
    <Card className="no-print timetable-toolbar border-border/70 shadow-sm">
      <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Tabs value={view} onValueChange={setView} className="min-w-0">
          <TabsList className="h-auto flex-wrap">
            {views.map((v) => (
              <TabsTrigger key={v.id} value={v.id} className="text-xs">
                {v.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:justify-end">
          {(view==="allClasses"||view==="teachers")&&(
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Portion</span>
              {[
                { key: "primary", label: "Primary" },
                { key: "middle", label: "Middle" },
                { key: "high", label: "High" },
              ].map(({ key, label }) => (
                <label key={key} className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-primary">
                  <Checkbox
                    checked={!!printPortionMask[key]}
                    onCheckedChange={() => togglePrintPortion(key)}
                  />
                  {label}
                </label>
              ))}
              {portionFilterActive&&(
                <button type="button" className="no-print text-[11px] font-semibold text-primary underline" onClick={()=>setPrintPortionMask({...DEFAULT_PRINT_PORTION_MASK})}>
                  All portions
                </button>
              )}
            </div>
          )}
          {view==="byClass"&&<Sel value={byClassCls} onChange={setByClassCls} options={[{value:"__all_classes__",label:"All classes"},...settings.classes.map(c=>({value:c.id,label:formatClassDisplay(c)}))]}/>}
          {view==="byTeacher"&&<Sel value={byTeacherName} onChange={setByTeacherName} options={[{value:"__all_staff__",label:"All staff"},...teachingStaff.map(st=>({value:st.name,label:st.name}))]}/>}
          <Separator orientation="vertical" className="hidden h-6 sm:block" />
          <Btn small onClick={autoGenerateTimetable}>Auto Generate</Btn>
          <Btn small outline onClick={handleTimetablePdf}>Export PDF</Btn>
        </div>
      </CardContent>
    </Card>

    <div className="timetable-main-content" ref={timetableTableRef} style={{width:"100%",maxWidth:"100%",minWidth:0,boxSizing:"border-box"}}>
    {view==="allClasses"&&(classesForView.length>0?<AllClassesView settings={settings} staffProfiles={staffProfiles} timetable={timetable} setTimetable={setTimetable} day="Monday" classes={classesForView}/>:<div className="no-print" style={{padding:20,textAlign:"center",color:C.gray,fontSize:13}}>No classes for <strong>{portionLabel}</strong>. Tick another portion or use &quot;All portions&quot;.</div>)}
    {view==="teachers"&&(staffForView.length>0?<TeachersView settings={settings} timetable={timetable} day="Monday" staff={staffForView} suppressPrintHeader/>:<div className="no-print" style={{padding:20,textAlign:"center",color:C.gray,fontSize:13}}>No teachers for <strong>{portionLabel}</strong>. Tick another portion or use &quot;All portions&quot;.</div>)}
    {view==="byClass"&&byClassCls!=="__all_classes__"&&<div className="by-class-single"><ByClassView settings={settings} staffProfiles={staffProfiles} timetable={timetable} setTimetable={setTimetable} selCls={byClassCls} suppressPrintHeader/></div>}
    {view==="byClass"&&byClassCls==="__all_classes__"&&<div className="all-classes-batch-print">
      {classesForView.map((c, i) => (
        <div key={c.id} style={{ pageBreakAfter: i < classesForView.length - 1 ? 'always' : 'auto', breakAfter: i < classesForView.length - 1 ? 'page' : 'auto', marginBottom: i < classesForView.length - 1 ? 40 : 0 }}>
          <ByClassView settings={settings} staffProfiles={staffProfiles} timetable={timetable} setTimetable={setTimetable} selCls={c.id} suppressPrintHeader={false}/>
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

