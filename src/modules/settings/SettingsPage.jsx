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
import { schoolOrBrandLogo, genId } from "@/shared/theme";
import { StaffProfilesPage } from "@/modules/staffProfiles/StaffProfilesPage";
import { loadAuthUsers, saveAuthUsers } from "@/modules/auth/authCore";
import { hashPassword } from "@/cloudSync.js";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import * as H from "@/shared/helpers";

const selectClassName = "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm";

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
  parseMarksImportCell, parseWorkbook, parseResultCardSource, subjectsFromClassSheetHeader,
  getExportHeaderMeta, sanitizePdfFilenamePart,
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


export function ClassSubjCard({cls,examSubjects,timetableSubjects,onAddExam,onRemoveExam,onAddTimetable,onRemoveTimetable,onRemoveClass}){
  const [examNs,setExamNs]=useState("");
  const [ttNs,setTtNs]=useState("");
  return (
    <Card className="h-full border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-bold text-primary">{formatClassDisplay(cls)}</CardTitle>
        <Button type="button" variant="destructive" size="sm" className="h-7 w-7 p-0" onClick={onRemoveClass}>×</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Subjects for Examination</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {examSubjects.map(s=>(
              <Badge key={`exam_${s}`} variant="secondary" className="gap-1 bg-blue-100 text-blue-800 hover:bg-blue-100">
                {s}
                <button type="button" onClick={()=>onRemoveExam(s)} className="ml-0.5 font-bold leading-none">×</button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={examNs}
              onChange={e=>setExamNs(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){onAddExam(examNs);setExamNs("");}}}
              placeholder="Add exam subject..."
              className="h-8 flex-1 text-xs"
            />
            <Button type="button" size="sm" className="h-8 px-3" onClick={()=>{onAddExam(examNs);setExamNs("");}}>+</Button>
          </div>
        </div>
        <Separator />
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Subjects for Timetable</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {timetableSubjects.map(s=>(
              <Badge key={`tt_${s}`} className="gap-1 bg-green-100 text-green-800 hover:bg-green-100">
                {s}
                <button type="button" onClick={()=>onRemoveTimetable(s)} className="ml-0.5 font-bold leading-none">×</button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={ttNs}
              onChange={e=>setTtNs(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){onAddTimetable(ttNs);setTtNs("");}}}
              placeholder="Add timetable subject..."
              className="h-8 flex-1 text-xs"
            />
            <Button type="button" size="sm" className="h-8 px-3" onClick={()=>{onAddTimetable(ttNs);setTtNs("");}}>+</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CommonTeachersEditor({settings,setSettings}){
  // Only consider classes that have a section (i.e. multiple sections per grade)
  const classes=Array.isArray(settings?.classes)?settings.classes:[];
  const grades=[...new Set(classes.filter(c=>c.section).map(c=>c.grade))];
  const getC=(g,s)=>settings.commonTeachers?.[g]?.[s]||false;
  const setC=(g,s,t)=>setSettings(prev=>({...prev,commonTeachers:{...prev.commonTeachers,[g]:{...(prev.commonTeachers?.[g]||{}),[s]:t}}}));
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base text-primary">Common Teachers</CardTitle>
        <CardDescription>
          Assign a common teacher for a subject shared across all sections of the same grade. Auto-fills other sections when you assign in the timetable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {grades.map(grade=>{
          const gClasses=classes.filter(c=>c.grade===grade && c.section);
          if(gClasses.length<1) return null;
          // All subjects from classes that have a section (no duplicate filtering by sections now)
          const allSubjs=[...new Set(
            gClasses.flatMap(cls=>getClassSubjects(settings,cls.id,"timetable").map(s=>(s||"").trim()).filter(Boolean))
          )];
          return (
            <Card key={grade} className="border-border/60 bg-muted/30 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-primary">Grade {grade} — Sections: {gClasses.map(c=>c.name).join(", ")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {allSubjs.map(subj=>{
                    const isCommon=!!getC(grade,subj);
                    return (
                      <label key={subj} className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Checkbox checked={isCommon} onCheckedChange={(v)=>setC(grade,subj,!!v)} />
                        {subj}
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function SettingsPage({settings,setSettings,setSchools,students,setStudents,schools,activeSchoolId,timetable,exam_tm,exam_om,setExamMarks,currentSession,sessions,setCurrentSession,addSession,staffProfiles,setBarSubtitle,session}){
  const isPrincipal = !session || session.userType==="principal"||session.userType==="school"||session.userType==="admin-created"||session.userType==="local";
  const staffList=Array.isArray(staffProfiles)?staffProfiles:[];
  const teachingStaffCount=staffList.filter(isTeachingStaffMember).length;
  const nonTeachingStaffCount=Math.max(0,staffList.length-teachingStaffCount);
  const [tab,setTab]=useState("general");
  const [schoolSection,setSchoolSection]=useState("basic");
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
      // Result Card Source sheet (classes + subjects + teachers) when no Classes template sheet
      const sourceParsed = (!sheets.Classes || sheets.Classes.length < 2)
        ? parseResultCardSource(sheets.Source || [])
        : { classes: [], subjectsByClassId: {}, totals: [], meta: {}, examKey: "1st Term" };
      let classTeachersMap = {};
      if (sourceParsed.classes.length) {
        const classSubjectsExam = {};
        const classSubjectsTimetable = {};
        const classes = sourceParsed.classes.map(({ teacher, sheetName, ...rest }) => {
          if (teacher) classTeachersMap[rest.id] = teacher;
          const subs = sourceParsed.subjectsByClassId[rest.id] || sourceParsed.subjectsByClassId[rest.name] || [];
          classSubjectsExam[rest.id] = [...subs];
          classSubjectsTimetable[rest.id] = [...subs];
          return rest;
        });
        // Fill subjects from class sheet headers when Source subjects table is empty
        if (sheets.ClassSheets) {
          sheets.ClassSheets.forEach((sh) => {
            const hdr = (sh.rows && sh.rows[0]) || [];
            const subs = subjectsFromClassSheetHeader(hdr);
            if (!subs.length) return;
            const cls = classes.find((c) => String(c.id).toLowerCase() === String(sh.name).toLowerCase() || String(c.name).toLowerCase() === String(sh.name).toLowerCase());
            if (!cls) return;
            if (!classSubjectsExam[cls.id]?.length) {
              classSubjectsExam[cls.id] = [...subs];
              classSubjectsTimetable[cls.id] = [...subs];
            }
          });
        }
        importedClasses = classes;
        setSettings((s) => {
          const next = {
            ...s,
            classes: [...s.classes.filter((c) => !classes.find((n) => n.id === c.id)), ...classes],
            classSubjects: { ...s.classSubjects, ...classSubjectsExam },
            classSubjectsExam: { ...(s.classSubjectsExam || {}), ...classSubjectsExam },
            classSubjectsTimetable: { ...(s.classSubjectsTimetable || {}), ...classSubjectsTimetable },
          };
          if (sourceParsed.meta.schoolName) next.schoolName = sourceParsed.meta.schoolName;
          if (sourceParsed.meta.principalName) next.principalName = sourceParsed.meta.principalName;
          if (sourceParsed.meta.principalDesignation) next.principalDesignation = sourceParsed.meta.principalDesignation;
          return next;
        });
        msg.push(classes.length + " class(es) from Source");
        if (Object.keys(classTeachersMap).length) msg.push(Object.keys(classTeachersMap).length + " class teacher(s)");
        if (sourceParsed.totals.length && setExamMarks) {
          const examKey = sourceParsed.examKey || "1st Term";
          setExamMarks((prevTM) => {
            const next = { ...(prevTM || {}) };
            sourceParsed.totals.forEach(({ classId, subject, totalMarks }) => {
              next[`${examKey}_${classId}_${subject}`] = totalMarks;
            });
            return next;
          }, null);
          msg.push(sourceParsed.totals.length + " total mark(s)");
        }
      }
      if (sheets.Classes && sheets.Classes.length >= 2) {
        const [, ...dataRows] = sheets.Classes;
        const classSubjectsExam = {};
        const classSubjectsTimetable = {};
        const conflicts = [];
        const byId = {};
        classTeachersMap = {};
        dataRows.forEach(row => {
          const id = String(row[0] || "").trim();
          const name = String(row[1] || "").trim();
          const grade = String(row[2] || "").trim();
          const section = String(row[3] || "").trim();
          const examSubjsStr = String(row[4] || "").trim();
          const ttSubjsStr = String(row[5] || "").trim();
          const classTeacherStr = String(row[6] || "").trim();
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
          if(classTeacherStr) classTeachersMap[cid]=classTeacherStr;
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
        if(classes.length) {
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
      // Apply class teachers from Source / Classes sheet to timetable
      if (Object.keys(classTeachersMap || {}).length > 0 && setSchools && activeSchoolId) {
        setSchools(prev => prev.map(s => {
          if (s.id !== activeSchoolId) return s;
          const nextTimetable = { ...(s.timetable || {}) };
          Object.entries(classTeachersMap).forEach(([cid, teacher]) => {
            if (teacher) {
              if (!nextTimetable[cid]) nextTimetable[cid] = {};
              ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].forEach(day => {
                if (!nextTimetable[cid][day]) nextTimetable[cid][day] = {};
                nextTimetable[cid][day][0] = { subject: "", teacher };
              });
            }
          });
          return { ...s, timetable: nextTimetable };
        }));
        if (!msg.some((m) => String(m).includes("class teacher"))) {
          msg.push(Object.keys(classTeachersMap).length + " class teacher(s)");
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
      ["Class ID","Class Name","Grade","Section","Subjects for Examination","Subjects for Timetable","Class Teacher"],
      ...(settings.classes||[]).map(c => [
        c.id,
        formatClassDisplay(c),
        c.grade,
        c.section,
        getClassSubjects(settings,c.id,"exam").join(", "),
        getClassSubjects(settings,c.id,"timetable").join(", "),
        ((timetable||{})[c.id]?.["Monday"]?.[0]?.teacher)||""
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

        // Result Card Source sheet → classes, subjects, class teachers, total marks
        const sourceParsed=parseResultCardSource(sheets.Source||[]);
        let sourceSubjects={...(sourceParsed.subjectsByClassId||{})};
        // Fallback: subject columns on each class sheet header
        classSheets.forEach(sh=>{
          const headerRowIdx=(()=>{
            const rows=sh.rows||[];
            const scanLimit=Math.min(rows.length,10);
            for(let i=0;i<scanLimit;i++){
              const hdr=Array.isArray(rows[i])?rows[i]:[];
              const joined=hdr.map(h=>String(h||"").toLowerCase()).join(" ");
              if(joined.includes("name")||joined.includes("roll")) return i;
            }
            return 0;
          })();
          const hdrSubs=subjectsFromClassSheetHeader((sh.rows||[])[headerRowIdx]||[]);
          if(!hdrSubs.length) return;
          const key=String(sh.name||"").trim();
          if(!key) return;
          if(!sourceSubjects[key]?.length) sourceSubjects[key]=hdrSubs;
        });
        const sourceExtra=[];
        let importedClassesList=[];
        let classTeachersMap={};
        if(sourceParsed.classes.length){
          importedClassesList=sourceParsed.classes.map(({teacher,sheetName,...rest})=>({...rest}));
          classTeachersMap=Object.fromEntries(
            sourceParsed.classes.filter(c=>c.teacher).map(c=>[c.id,c.teacher])
          );
          const classSubjectsExam={};
          const classSubjectsTimetable={};
          importedClassesList.forEach(c=>{
            const subs=sourceSubjects[c.id]||sourceSubjects[c.name]||[];
            classSubjectsExam[c.id]=[...subs];
            classSubjectsTimetable[c.id]=[...subs];
          });
          setSettings(s=>{
            const next={
              ...s,
              classes:[
                ...s.classes.filter(c=>!importedClassesList.find(n=>n.id===c.id)),
                ...importedClassesList,
              ],
              classSubjects:{...s.classSubjects,...classSubjectsExam},
              classSubjectsExam:{...(s.classSubjectsExam||{}),...classSubjectsExam},
              classSubjectsTimetable:{...(s.classSubjectsTimetable||{}),...classSubjectsTimetable},
            };
            if(sourceParsed.meta.schoolName) next.schoolName=sourceParsed.meta.schoolName;
            if(sourceParsed.meta.principalName) next.principalName=sourceParsed.meta.principalName;
            if(sourceParsed.meta.principalDesignation) next.principalDesignation=sourceParsed.meta.principalDesignation;
            return next;
          });
          sourceExtra.push(importedClassesList.length+" class(es)");
          const subjCount=Object.values(classSubjectsExam).reduce((n,a)=>n+a.length,0);
          if(subjCount) sourceExtra.push(subjCount+" subject assignment(s)");
          if(Object.keys(classTeachersMap).length){
            sourceExtra.push(Object.keys(classTeachersMap).length+" class teacher(s)");
            if(setSchools&&activeSchoolId){
              setSchools(prev=>prev.map(s=>{
                if(s.id!==activeSchoolId) return s;
                const nextTimetable={...(s.timetable||{})};
                Object.entries(classTeachersMap).forEach(([cid,teacher])=>{
                  if(!teacher) return;
                  if(!nextTimetable[cid]) nextTimetable[cid]={};
                  ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].forEach(day=>{
                    if(!nextTimetable[cid][day]) nextTimetable[cid][day]={};
                    nextTimetable[cid][day][0]={subject:"",teacher};
                  });
                });
                return {...s,timetable:nextTimetable};
              }));
            }
          }
          if(sourceParsed.totals.length&&setExamMarks){
            const examKey=sourceParsed.examKey||"1st Term";
            setExamMarks(prevTM=>{
              const next={...(prevTM||{})};
              sourceParsed.totals.forEach(({classId,subject,totalMarks})=>{
                next[`${examKey}_${classId}_${subject}`]=totalMarks;
              });
              return next;
            },null);
            sourceExtra.push(sourceParsed.totals.length+" total mark(s) → "+examKey);
          }
        }

        const allClasses=importedClassesList.length
          ? [...(settings.classes||[]).filter(c=>!importedClassesList.find(n=>n.id===c.id)),...importedClassesList]
          : (settings.classes||[]);
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
          +(sourceExtra.length?"\nAlso from Source: "+sourceExtra.join(", ")+".":"")
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
        const sheetsClasses=getSheet("Class")||getSheet("Classes")||getSheet("Classes & Subjects");
        const sheetsStaff=getSheet("Teacher")||getSheet("Teachers")||getSheet("Staff")||getSheet("Staff Profiles");
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
            const classTeacherName=String(row[6]||"").trim();
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
            if(!prev) byId[cid]={...norm,classTeacher:classTeacherName};
            else if(classTeacherName) byId[cid].classTeacher=classTeacherName;
            const examSubjs=examSubjsStr?examSubjsStr.split(",").map(s=>s.trim()).filter(Boolean):[];
            const ttSubjs=ttSubjsStr?ttSubjsStr.split(",").map(s=>s.trim()).filter(Boolean):examSubjs;
            if(!classSubjectsExam[cid]) classSubjectsExam[cid]=[];
            if(!classSubjectsTimetable[cid]) classSubjectsTimetable[cid]=[];
            examSubjs.forEach(s=>{ if(!classSubjectsExam[cid].includes(s)) classSubjectsExam[cid].push(s); });
            ttSubjs.forEach(s=>{ if(!classSubjectsTimetable[cid].includes(s)) classSubjectsTimetable[cid].push(s); });
          });
          const classes=Object.entries(byId).map(([id,norm])=>{
            const {classTeacher,...rest}=norm;
            return {id,...rest};
          });
          const classTeachersMap=Object.fromEntries(Object.entries(byId).filter(([_,v])=>v.classTeacher).map(([k,v])=>[k,v.classTeacher]));
          if(classes.length){
            nextClasses=[...settings.classes.filter(c=>!classes.find(n=>n.id===c.id)),...classes];
            nextClassSubjectsExam={...(settings.classSubjectsExam||settings.classSubjects||{}),...classSubjectsExam};
            nextClassSubjectsTimetable={...(settings.classSubjectsTimetable||settings.classSubjects||{}),...classSubjectsTimetable};
            msg.push(classes.length+" class(es)");
            if(Object.keys(classTeachersMap).length) msg.push(Object.keys(classTeachersMap).length+" class teacher(s)");
          }
          if(conflicts.length) msg.push("Skipped duplicate class IDs: "+[...new Set(conflicts)].join(", "));
        }
        let nextTimetable={...timetable};
        if(sheetsClasses&&sheetsClasses.length>=2){
          const [,...dataRows]=sheetsClasses;
          dataRows.forEach(row=>{
            const cid=String(row[0]||"").trim()||(String(row[2]||"").trim()?`${String(row[2]||"").trim()}-${String(row[3]||"").trim()||String(row[1]||"").trim()}`:null);
            const classTeacherName=String(row[6]||"").trim();
            if(!cid||!classTeacherName) return;
            if(!nextTimetable[cid]) nextTimetable[cid]={};
            ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].forEach(day=>{
              if(!nextTimetable[cid][day]) nextTimetable[cid][day]={};
              nextTimetable[cid][day][0]={subject:"",teacher:classTeacherName};
            });
          });
        }
        if(sheetsStaff&&sheetsStaff.length>=2){
          const [,...dataRows]=sheetsStaff;
          newStaffProfiles=dataRows.map((row,i)=>{ const name=String(row[0]||"").trim(); const designation=String(row[1]||"").trim(); const subj=String(row[2]||"").trim(); if(!name) return null; return {id:genId(),staffCategory:normalizeStaffCategory(designation),name:name||"Staff "+(i+1),designation:designation||"",subj:subj||"",photo:null}; }).filter(Boolean);
          if(newStaffProfiles.length) msg.push(newStaffProfiles.length+" staff profile(s)");
        }
        if(msg.length){
          setSettings(s=>({...s,classes:nextClasses,classSubjects:nextClassSubjectsExam,classSubjectsExam:nextClassSubjectsExam,classSubjectsTimetable:nextClassSubjectsTimetable}));
          if(newStaffProfiles.length) setSchools(prev=>prev.map(s=>s.id===activeSchoolId?{...s,staffProfiles:[...(s.staffProfiles||[]),...newStaffProfiles]}:s));
          if(Object.keys(nextTimetable).length>0) setSchools(prev=>prev.map(s=>s.id===activeSchoolId?{...s,timetable:nextTimetable}:s));
        }
        if(!msg.length) alert("No class or staff sheet with data found.\n\nExpected one of: Class, Classes, Classes & Subjects — and one of: Teacher, Staff, Staff Profiles.");
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
  return (
  <div className="psms-page mx-auto max-w-[1100px] space-y-5 w-full min-w-0">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="m-0 text-2xl font-bold tracking-tight text-primary">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tabs.find(t=>t.id===tab)?.label}</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
    <input ref={settingsExcelRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={importFromExcel}/>
    <input ref={studentImportRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={importStudentsFromExcel}/>

    {tab==="general"&&(
      <div className="space-y-4">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary">Session</CardTitle>
            <CardDescription>Exam marks and date sheet are saved per session. Switch session to view or edit that year&apos;s data.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label>Current session</Label>
                <select value={currentSession||""} onChange={e=>setCurrentSession(e.target.value)} className={cn(selectClassName,"w-[180px]")}>
                  {(sessions||[]).map(ses=><option key={ses} value={ses}>{ses}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Add session</Label>
                <Input ref={sessionInputRef} type="text" placeholder="e.g. 2025-2026" className="w-[140px]" onKeyDown={e=>{if(e.key==="Enter"){const v=e.target.value.trim();if(v&&addSession){addSession(v);e.target.value="";}}}} />
              </div>
              <Button type="button" onClick={()=>{const v=sessionInputRef.current?.value?.trim();if(v&&addSession){addSession(v);if(sessionInputRef.current)sessionInputRef.current.value="";}}}>Add</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary">Data Workbook</CardTitle>
            <CardDescription>
              <strong>Export Data</strong> backs up all data (classes, teachers with subjects, class teachers, students). <strong>Import Data</strong> restores from previously exported file. <strong>Template</strong> downloads a blank Excel with Class and Teacher sheets for quick data entry. Teacher subjects are used for auto-generate timetable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={()=>settingsExcelRef.current?.click()}>Import Data</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void exportData()}>Export Data</Button>
              <Button type="button" variant="outline" size="sm" onClick={async()=>{
                const wb=XLSX.utils.book_new();
                const classesSheet=XLSX.utils.aoa_to_sheet([["ID","Name","Grade","Section","Exam Subjects","Timetable Subjects","Class Teacher"],["1","Class 1-A","1","A","Math, Urdu","Math, Urdu",""],["2","Class 2-A","2","A","English, Math","English, Math",""]]);
                XLSX.utils.book_append_sheet(wb,classesSheet,"Class");
                const staffSheet=XLSX.utils.aoa_to_sheet([["Name","Designation","Subject"],["Ali Khan","Teaching","Mathematics, Physics"],["Sara","Teaching","English, Urdu"]]);
                XLSX.utils.book_append_sheet(wb,staffSheet,"Teacher");
                await downloadExcel(wb,"Class_Teacher_Template.xlsx");
              }}>Template</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/70 shadow-sm">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Students</p>
              <p className="text-2xl font-bold text-primary">{(students||[]).length}</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-sm">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Classes</p>
              <p className="text-2xl font-bold text-primary">{(settings.classes||[]).length}</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-sm">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Teaching staff</p>
              <p className="text-2xl font-bold text-primary">{teachingStaffCount}</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-sm">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Non-teaching staff</p>
              <p className="text-2xl font-bold text-primary">{nonTeachingStaffCount}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )}

    {tab==="teachers"&&isPrincipal&&(
      <div className="space-y-4">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary">Create Operator Account</CardTitle>
            <CardDescription>Operator can <strong>edit and delete marks, students, and staff</strong> but cannot create new schools or manage accounts.</CardDescription>
          </CardHeader>
          <CardContent className="max-w-md space-y-3">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input type="text" value={opName} onChange={e=>setOpName(e.target.value)} placeholder="e.g. School Operator"/>
            </div>
            <div className="space-y-1.5">
              <Label>Login Email</Label>
              <Input type="email" value={opEmail} onChange={e=>setOpEmail(e.target.value)} placeholder="operator@school.edu"/>
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={opPassword} onChange={e=>setOpPassword(e.target.value)} placeholder="Min 4 characters"/>
            </div>
            {opError&&<div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{opError}</div>}
            {opSuccess&&<div className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">{opSuccess}</div>}
            <Button type="button" onClick={async()=>{
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
            }}>Create Operator Account</Button>
          </CardContent>
        </Card>

        {opList.length>0&&(
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-primary">Operators ({opList.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {opList.map(op=>(
                <div key={op.id} className={cn("flex flex-wrap items-center gap-2 rounded-lg border p-3", op.blocked ? "border-destructive/30 bg-destructive/5" : "border-border/70 bg-muted/20")}>
                  <div className="min-w-0 flex-1 basis-[180px]">
                    <div className="flex flex-wrap items-center gap-1.5 truncate text-sm font-semibold">
                      {op.name||"—"}
                      <Badge variant="secondary">Operator</Badge>
                      {op.blocked&&<Badge variant="destructive">Blocked</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{op.email}</div>
                  </div>
                  <div className="flex flex-shrink-0 flex-wrap gap-1.5">
                    <Button type="button" size="sm" variant={op.blocked?"outline":"destructive"} onClick={()=>{const n=loadAuthUsers().map(u=>u.id===op.id?{...u,blocked:!op.blocked}:u);saveAuthUsers(n);refreshOp();}}>
                      {op.blocked?"Unblock":"Block"}
                    </Button>
                    {opEditId===op.id?(
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Input type="password" value={opEditPw} onChange={e=>setOpEditPw(e.target.value)} placeholder="New password" className="h-8 w-[120px]"/>
                        {opEditPwErr&&<span className="text-[10px] text-destructive">{opEditPwErr}</span>}
                        <Button type="button" size="sm" onClick={async()=>{
                          if(!opEditPw.trim()||opEditPw.length<4){setOpEditPwErr("Min 4 chars");return;}
                          const h=await hashPassword(opEditPw.trim());
                          saveAuthUsers(loadAuthUsers().map(u=>u.id===op.id?{...u,password:h}:u));
                          setOpEditId(null);setOpEditPw("");setOpEditPwErr("");refreshOp();
                        }}>Save</Button>
                        <Button type="button" size="sm" variant="outline" onClick={()=>{setOpEditId(null);setOpEditPw("");setOpEditPwErr("");}}>Cancel</Button>
                      </div>
                    ):(
                      <Button type="button" size="sm" variant="outline" onClick={()=>{setOpEditId(op.id);setOpEditPw("");setOpEditPwErr("");}}>Reset PW</Button>
                    )}
                    <Button type="button" size="sm" variant="destructive" onClick={()=>{if(!confirm(`Remove operator "${op.name}"?`))return;saveAuthUsers(loadAuthUsers().filter(u=>u.id!==op.id));refreshOp();}}>Remove</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary">Create Teacher Account</CardTitle>
            <CardDescription>Teachers can log in on any device and access Dashboard, Timetable, Attendance, Examination, Paper & Card generators.</CardDescription>
          </CardHeader>
          <CardContent className="max-w-md space-y-3">
            <div className="space-y-1.5">
              <Label>Select Staff Member</Label>
              {(staffProfiles||[]).length===0
                ? <p className="m-0 text-xs text-muted-foreground">No staff profiles found. Add staff in the <strong>Staff Profiles</strong> tab first.</p>
                : <select value={tcStaffId} onChange={e=>{
                    const id=e.target.value;
                    setTcStaffId(id);
                    const sp=(staffProfiles||[]).find(p=>p.id===id);
                    if(sp){setTcName(sp.name||"");setTcEmail(sp.email||"");}
                    else{setTcName("");setTcEmail("");}
                  }} className={selectClassName}>
                  <option value="">— Select staff member —</option>
                  {(staffProfiles||[]).filter(p=>p.name).map(p=><option key={p.id} value={p.id}>{p.name}{p.designation?` (${p.designation})`:""}</option>)}
                </select>
              }
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={tcEmail} onChange={e=>setTcEmail(e.target.value)} placeholder="teacher@school.edu"/>
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={tcPassword} onChange={e=>setTcPassword(e.target.value)} placeholder="Min 4 characters"/>
            </div>
            {tcError&&<div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{tcError}</div>}
            {tcSuccess&&<div className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">{tcSuccess}</div>}
            <Button type="button" onClick={async()=>{
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
            }}>Create Teacher Account</Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary">Teachers ({tcList.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tcList.length===0&&<p className="m-0 text-sm text-muted-foreground">No teacher accounts yet. Create one above.</p>}
            {tcList.map(tc=>(
              <div key={tc.id} className={cn("flex flex-wrap items-center gap-2 rounded-lg border p-3", tc.blocked ? "border-destructive/30 bg-destructive/5" : "border-border/70 bg-muted/20")}>
                <div className="min-w-0 flex-1 basis-[180px]">
                  <div className="flex flex-wrap items-center gap-1.5 truncate text-sm font-semibold">
                    {tc.name||"—"}
                    {tc.blocked&&<Badge variant="destructive">Blocked</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{tc.email}</div>
                </div>
                <div className="flex flex-shrink-0 flex-wrap gap-1.5">
                  <Button type="button" size="sm" variant={tc.blocked?"outline":"destructive"} onClick={()=>{const n=loadAuthUsers().map(u=>u.id===tc.id?{...u,blocked:!u.blocked}:u);saveAuthUsers(n);refreshTc();}}>
                    {tc.blocked?"Unblock":"Block"}
                  </Button>
                  {tcEditId===tc.id?(
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Input type="password" value={tcEditPw} onChange={e=>setTcEditPw(e.target.value)} placeholder="New password" className="h-8 w-[120px]"/>
                      {tcEditPwErr&&<span className="text-[10px] text-destructive">{tcEditPwErr}</span>}
                      <Button type="button" size="sm" onClick={async()=>{
                        if(!tcEditPw.trim()||tcEditPw.length<4){setTcEditPwErr("Min 4 chars");return;}
                        const h=await hashPassword(tcEditPw.trim());
                        saveAuthUsers(loadAuthUsers().map(u=>u.id===tc.id?{...u,password:h}:u));
                        setTcEditId(null);setTcEditPw("");setTcEditPwErr("");refreshTc();
                      }}>Save</Button>
                      <Button type="button" size="sm" variant="outline" onClick={()=>{setTcEditId(null);setTcEditPw("");setTcEditPwErr("");}}>Cancel</Button>
                    </div>
                  ):(
                    <Button type="button" size="sm" variant="outline" onClick={()=>{setTcEditId(tc.id);setTcEditPw("");setTcEditPwErr("");}}>Reset PW</Button>
                  )}
                  <Button type="button" size="sm" variant="destructive" onClick={()=>{if(!confirm(`Remove teacher "${tc.name}"?`))return;saveAuthUsers(loadAuthUsers().filter(u=>u.id!==tc.id));refreshTc();}}>Remove</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )}


    {tab==="school"&&(
      <div className="space-y-4">
        <Card className="border-border/70 shadow-sm">
          <CardContent className="flex flex-wrap items-center gap-4 pt-6">
            <img src={schoolOrBrandLogo(settings.logo)} alt="" className="h-36 w-36 rounded-full border-2 border-border object-cover shadow-md"/>
            <div className="min-w-0 flex-1 space-y-2">
              <CardTitle className="text-base text-primary">School Logo / Emblem</CardTitle>
              <CardDescription>Upload your school&apos;s official logo (PNG, JPG – max 2MB) to replace the default emblem on ID cards and printouts.</CardDescription>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={()=>fileRef.current.click()}>Upload Logo</Button>
                {settings.logo&&<Button type="button" size="sm" variant="destructive" onClick={()=>setSettings(s=>({...s,logo:null}))}>Remove</Button>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setSettings(s=>({...s,logo:ev.target.result}));r.readAsDataURL(f);}}/>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardContent className="flex flex-wrap items-center gap-4 pt-6">
            <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted">
              {settings.banner ? <img src={settings.banner} alt="" className="h-full w-full object-cover"/> : <span className="px-1 text-center text-[10px] text-muted-foreground">No Banner</span>}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <CardTitle className="text-base text-primary">Promotion Banner (Result Card)</CardTitle>
              <CardDescription>Upload a promotional banner (e.g. Admission Campaign) to display at the bottom of student result cards.</CardDescription>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={()=>bannerUploadRef.current.click()}>Upload Banner</Button>
                {settings.banner&&<Button type="button" size="sm" variant="destructive" onClick={()=>setSettings(s=>({...s,banner:null}))}>Remove</Button>}
              </div>
              <input ref={bannerUploadRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setSettings(s=>({...s,banner:ev.target.result}));r.readAsDataURL(f);}}/>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardContent className="flex flex-wrap items-start gap-4 pt-6">
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted">
              <img src={settings.resultCardSignature||signImg} alt="" className="max-h-full max-w-full object-contain"/>
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <CardTitle className="text-base text-primary">Result card — signature and stamp</CardTitle>
                <CardDescription className="mt-1">Upload a signature image for the headmaster block on printed result cards. Optional text lines override the stamp; if left blank, Principal name and School name from Administration are used.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={()=>resultCardSignatureUploadRef.current.click()}>Upload signature</Button>
                {settings.resultCardSignature&&<Button type="button" size="sm" variant="destructive" onClick={()=>setSettings(s=>({...s,resultCardSignature:null}))}>Use default sign</Button>}
              </div>
              <input ref={resultCardSignatureUploadRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setSettings(s=>({...s,resultCardSignature:ev.target.result}));r.readAsDataURL(f);}}/>
              <div className="grid max-w-xl gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Stamp line 1 (headmaster / title)</Label>
                  <Input
                    value={settings.resultCardStampLine1||""}
                    onChange={e=>setSettings(s=>({...s,resultCardStampLine1:e.target.value}))}
                    placeholder={`Optional — defaults to Principal name (${(settings.principalName||"").trim()||"—"})`}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Stamp line 2 (school line)</Label>
                  <Input
                    value={settings.resultCardStampLine2||""}
                    onChange={e=>setSettings(s=>({...s,resultCardStampLine2:e.target.value}))}
                    placeholder={`Optional — defaults to school name (${(settings.schoolName||"").trim()||"—"})`}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary">School Details</CardTitle>
            <CardDescription>Official identity, location, and administration.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={schoolSection} onValueChange={setSchoolSection}>
              <TabsList className="mb-4 h-auto flex-wrap">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="location">Location</TabsTrigger>
                <TabsTrigger value="admin">Administration</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="mt-0 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-primary">Basic School Information</h3>
                  <p className="mt-1 border-b border-dashed border-border pb-2 text-sm text-muted-foreground">Official identity and core administrative details of the school.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>School Name (Official)</Label>
                    <Input value={settings.schoolName||""} onChange={e=>setSettings(s=>({...s,schoolName:e.target.value}))} placeholder="e.g. PSMS Ladheke-Unchay Rainwind Road, Lahore"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>School Code (EMIS)</Label>
                    <Input value={settings.schoolCode||""} onChange={e=>setSettings(s=>({...s,schoolCode:e.target.value}))} placeholder="8-digit EMIS code"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>D.D.O Code</Label>
                    <Input value={settings.ddoCode||""} onChange={e=>setSettings(s=>({...s,ddoCode:e.target.value}))} placeholder="DDO code"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>School Type</Label>
                    <select value={settings.schoolType||""} onChange={e=>setSettings(s=>({...s,schoolType:e.target.value}))} className={selectClassName}>
                      <option value="">Select type</option>
                      <option value="Government">Government</option>
                      <option value="Semi-Government">Semi-Government</option>
                      <option value="Private">Private</option>
                      <option value="Model School">Model School</option>
                      <option value="Special Education">Special Education</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>School Level</Label>
                    <select value={settings.schoolLevel||""} onChange={e=>setSettings(s=>({...s,schoolLevel:e.target.value}))} className={selectClassName}>
                      <option value="">Select level</option>
                      <option value="Primary (I–V)">Primary (I–V)</option>
                      <option value="Middle (I–VIII)">Middle (I–VIII)</option>
                      <option value="High (I–X)">High (I–X)</option>
                      <option value="Higher Secondary (I–XII)">Higher Secondary (I–XII)</option>
                      <option value="Elementary">Elementary</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gender Category</Label>
                    <select value={settings.genderCategory||""} onChange={e=>setSettings(s=>({...s,genderCategory:e.target.value}))} className={selectClassName}>
                      <option value="">Select</option>
                      <option value="Boys">Boys</option>
                      <option value="Girls">Girls</option>
                      <option value="Co-Education">Co-Education</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>School Shift</Label>
                    <select value={settings.schoolShift||""} onChange={e=>setSettings(s=>({...s,schoolShift:e.target.value}))} className={selectClassName}>
                      <option value="">Select shift</option>
                      <option value="Morning">Morning</option>
                      <option value="Evening">Evening</option>
                      <option value="Both">Both</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>School Phone No</Label>
                    <Input value={settings.schoolPhoneNo||""} onChange={e=>setSettings(s=>({...s,schoolPhoneNo:e.target.value}))} placeholder="+92-XX-XXXXXXX"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>School Email Address</Label>
                    <Input value={settings.schoolEmail||""} onChange={e=>setSettings(s=>({...s,schoolEmail:e.target.value}))} placeholder="school@edu.punjab.gov.pk"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date of Establishment</Label>
                    <Input type="date" value={settings.estDate||""} onChange={e=>setSettings(s=>({...s,estDate:e.target.value}))}/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>For The Month</Label>
                    <Input value={settings.forTheMonth||""} onChange={e=>setSettings(s=>({...s,forTheMonth:e.target.value}))} placeholder="e.g. March 2025"/>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="location" className="mt-0 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-primary">Location & Geographic Details</h3>
                  <p className="mt-1 border-b border-dashed border-border pb-2 text-sm text-muted-foreground">Administrative and physical location of the school.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Full School Address</Label>
                    <Textarea value={settings.institutionAddress||""} onChange={e=>setSettings(s=>({...s,institutionAddress:e.target.value}))} placeholder="Street / Mohallah / Village, Tehsil, District, Province" className="min-h-[70px]"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Province</Label>
                    <select value={settings.province||""} onChange={e=>setSettings(s=>({...s,province:e.target.value}))} className={selectClassName}>
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
                  <div className="space-y-1.5">
                    <Label>District</Label>
                    <Input value={settings.district||""} onChange={e=>setSettings(s=>({...s,district:e.target.value}))} placeholder="e.g. Lahore"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tehsil</Label>
                    <Input value={settings.tehsil||""} onChange={e=>setSettings(s=>({...s,tehsil:e.target.value}))} placeholder="Tehsil name"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Union Council (UC)</Label>
                    <Input value={settings.uc||""} onChange={e=>setSettings(s=>({...s,uc:e.target.value}))} placeholder="UC number / name"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>N.A Constituency</Label>
                    <Input value={settings.na||""} onChange={e=>setSettings(s=>({...s,na:e.target.value}))} placeholder="e.g. NA-120"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>P.P Constituency</Label>
                    <Input value={settings.ppNo||""} onChange={e=>setSettings(s=>({...s,ppNo:e.target.value}))} placeholder="e.g. PP-145"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ward No.</Label>
                    <Input value={settings.ward||""} onChange={e=>setSettings(s=>({...s,ward:e.target.value}))} placeholder="Ward number"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mauza / Village</Label>
                    <Input value={settings.mauza||""} onChange={e=>setSettings(s=>({...s,mauza:e.target.value}))} placeholder="Mauza or village name"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>GPS Latitude</Label>
                    <Input value={settings.lat||""} onChange={e=>setSettings(s=>({...s,lat:e.target.value}))} placeholder="e.g. 31.5204"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>GPS Longitude</Label>
                    <Input value={settings.lng||""} onChange={e=>setSettings(s=>({...s,lng:e.target.value}))} placeholder="e.g. 74.3587"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rural / Urban</Label>
                    <select value={settings.ruralUrban||""} onChange={e=>setSettings(s=>({...s,ruralUrban:e.target.value}))} className={selectClassName}>
                      <option value="">Select</option>
                      <option value="Urban">Urban</option>
                      <option value="Rural">Rural</option>
                      <option value="Peri-Urban">Peri-Urban</option>
                    </select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="admin" className="mt-0 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-primary">Administration & Head of Institution</h3>
                  <p className="mt-1 border-b border-dashed border-border pb-2 text-sm text-muted-foreground">Principal details and key administrative contacts.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Principal / Headmaster Name</Label>
                    <Input value={settings.principalName||""} onChange={e=>setSettings(s=>({...s,principalName:e.target.value}))} placeholder="Full name"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Designation</Label>
                    <select value={settings.principalDesignation||""} onChange={e=>setSettings(s=>({...s,principalDesignation:e.target.value}))} className={selectClassName}>
                      <option value="">Select</option>
                      <option value="Principal">Principal</option>
                      <option value="Headmaster">Headmaster</option>
                      <option value="Headmistress">Headmistress</option>
                      <option value="In-Charge">In-Charge</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mobile No.</Label>
                    <Input value={settings.principalMobile||""} onChange={e=>setSettings(s=>({...s,principalMobile:e.target.value}))} placeholder="03XX-XXXXXXX"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email Address</Label>
                    <Input value={settings.principalEmail||""} onChange={e=>setSettings(s=>({...s,principalEmail:e.target.value}))} placeholder="principal@email.com"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Qualification</Label>
                    <Input value={settings.principalQualification||""} onChange={e=>setSettings(s=>({...s,principalQualification:e.target.value}))} placeholder="e.g. M.Ed, M.A"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date of Joining</Label>
                    <Input type="date" value={settings.principalJoinDate||""} onChange={e=>setSettings(s=>({...s,principalJoinDate:e.target.value}))}/>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            <div className="mt-4">
              <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">Changes saved automatically</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {tab==="classes"&&(
      <div className="space-y-4">
        <Card className="border-border/70 shadow-sm">
          <CardContent className="flex flex-wrap items-end gap-3 pt-6">
            <div className="w-[100px] space-y-1.5">
              <Label>Grade</Label>
              <Input value={newCls.grade} onChange={e=>setNewCls(x=>({...x,grade:e.target.value}))} className="w-[100px]"/>
            </div>
            <div className="w-[100px] space-y-1.5">
              <Label>Section</Label>
              <Input value={newCls.section} onChange={e=>setNewCls(x=>({...x,section:e.target.value}))} className="w-[100px]"/>
            </div>
            <Button type="button" onClick={addClass}>+ Add Class</Button>
          </CardContent>
        </Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(settings.classes || []).map(cls=><ClassSubjCard
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
      </div>
    )}

    {tab==="staffProfiles"&&(
      <div className="rounded-xl border border-border/70 bg-card p-2 shadow-sm">
        <StaffProfilesPage settings={settings} schools={schools||[]} staffProfiles={staffProfiles||[]} setSchools={setSchools} activeSchoolId={activeSchoolId} currentSession={currentSession}/>
      </div>
    )}

    {tab==="common"&&<CommonTeachersEditor settings={settings} setSettings={setSettings}/>}

    {tab==="time"&&(
      <div className="space-y-4">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary">School Hours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[{key:"mondayToThursday",label:"Monday – Thursday"},{key:"friday",label:"Friday"},{key:"saturday",label:"Saturday"}].map(({key,label})=>(
              <div key={key} className="grid items-end gap-3 sm:grid-cols-[160px_1fr_1fr]">
                <span className="text-sm font-semibold">{label}</span>
                <div className="space-y-1.5">
                  <Label>Start</Label>
                  <Input type="time" value={settings.schoolHours?.[key]?.start || ""} onChange={e=>setSettings(s=>({...s,schoolHours:{...s.schoolHours,[key]:{...(s.schoolHours?.[key]||{}),start:e.target.value}}}))}/>
                </div>
                <div className="space-y-1.5">
                  <Label>End</Label>
                  <Input type="time" value={settings.schoolHours?.[key]?.end || ""} onChange={e=>setSettings(s=>({...s,schoolHours:{...s.schoolHours,[key]:{...(s.schoolHours?.[key]||{}),end:e.target.value}}}))}/>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary">Period lengths</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {[["assemblyTime","Assembly Time (min)"],["firstPeriodTime","P-1 (min)"],["otherPeriodTime","Other Periods (min)"],["periodsPerDay","Periods Per Day"]].map(([key,label])=>(
                <div key={key} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input type="number" value={settings[key]} onChange={e=>setSettings(s=>({...s,[key]:+e.target.value}))}/>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary">Break Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <Checkbox checked={!!settings.breakRequired} onCheckedChange={(v)=>setSettings(s=>({...s,breakRequired:!!v}))}/>
              Break Required (Mon–Thu / Sat)
            </label>
            {settings.breakRequired&&(
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Break After Period #</Label>
                  <Input type="number" value={settings.breakAfterPeriod} onChange={e=>setSettings(s=>({...s,breakAfterPeriod:+e.target.value}))}/>
                </div>
                <div className="space-y-1.5">
                  <Label>Break Duration (min)</Label>
                  <Input type="number" value={settings.breakDuration} onChange={e=>setSettings(s=>({...s,breakDuration:+e.target.value}))}/>
                </div>
              </div>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <Checkbox checked={!!settings.fridayBreak} onCheckedChange={(v)=>setSettings(s=>({...s,fridayBreak:!!v}))}/>
              Friday Break Required
            </label>
            {settings.fridayBreak&&(
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Friday Break After Period #</Label>
                  <Input type="number" value={settings.fridayBreakAfter} onChange={e=>setSettings(s=>({...s,fridayBreakAfter:+e.target.value}))}/>
                </div>
                <div className="space-y-1.5">
                  <Label>Friday Break Duration (min)</Label>
                  <Input type="number" value={settings.fridayBreakDuration} onChange={e=>setSettings(s=>({...s,fridayBreakDuration:+e.target.value}))}/>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )}

    {tab==="awardList"&&(
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-primary">Award List</CardTitle>
          <CardDescription>Export a list of students per class for teachers with timetable assignments, then import after filling marks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Exam</Label>
              <select value={awardListExam} onChange={e=>setAwardListExam(e.target.value)} className={selectClassName}>
                {AWARD_LIST_EXAMS.map(ex=><option key={ex} value={ex}>{ex}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Teacher name</Label>
              <select value={awardListTeacher} onChange={e=>setAwardListTeacher(e.target.value)} className={selectClassName}>
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
          {teachersWithAssignments.length===0&&(
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              No teachers with timetable assignments. Assign teachers to classes in Timetable first.
            </div>
          )}
          <div className="grid max-w-md gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={() => void exportAwardListTeacher()} disabled={!selectedTeacherData?.classes?.length}>Export List (Teacher Name)</Button>
            <Button type="button" variant="outline" onClick={()=>void exportAwardListAllTeachersZip()} disabled={!teachersWithAssignments?.length}>Export All Teachers (ZIP)</Button>
            <Button type="button" variant="outline" onClick={()=>awardListExcelRef.current?.click()} disabled={!setExamMarks}>Import Award List (Teacher)</Button>
            <input ref={awardListExcelRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={importAwardListTeacher}/>
          </div>
        </CardContent>
      </Card>
    )}

  </div>
  );
}
