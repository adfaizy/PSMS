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


export const ATTENDANCE_DATA_KEY = "system_management_attendance";
export function loadAttendanceFromLocal(schoolId) {
  try {
    if (typeof window === "undefined" || !schoolId) return {};
    const raw = window.localStorage.getItem(ATTENDANCE_DATA_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data[schoolId] && typeof data[schoolId] === "object" ? data[schoolId] : {};
  } catch { return {}; }
}
export function saveAttendanceToLocal(schoolId, att) {
  try {
    if (typeof window === "undefined" || !schoolId) return;
    const raw = window.localStorage.getItem(ATTENDANCE_DATA_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[schoolId] = att && typeof att === "object" ? att : {};
    window.localStorage.setItem(ATTENDANCE_DATA_KEY, JSON.stringify(data));
  } catch {}
}

export function AttendancePage({settings,students,currentSession,activeSchoolId,setBarSubtitle}){
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
  const late=cs.filter(s=>classAtt[s.id]==="L").length;
  const unmarked=cs.length-present-absent-late;
  const attendanceRate=cs.length>0?Math.round((present/cs.length)*100):0;
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

  const stColor = (st) =>
    st === "P" ? "#15803d" : st === "A" ? "#dc2626" : st === "L" ? "#d97706" : "#9ca3af";

  const thStyle = (align = "left") => ({
    padding: "10px 12px",
    textAlign: align,
    whiteSpace: "nowrap",
    fontWeight: 700,
    fontSize: 12,
    color: "#fff",
    background: "#1B5E20",
    letterSpacing: "0.02em",
  });

  const tdStyle = (align = "left", extra = {}) => ({
    padding: "9px 12px",
    textAlign: align,
    verticalAlign: "middle",
    whiteSpace: "nowrap",
    ...extra,
  });

  return (
    <div className="psms-page" style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18, width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#1B5E20", letterSpacing: "-0.02em" }}>Attendance</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280" }}>
            {attView === "mark"
              ? `Daily marking · ${getClassLabel(settings, selCls)} · ${date}`
              : `Month register · P Present · A Absent · L Late`}
          </p>
        </div>
        <div style={{ display: "inline-flex", background: "#e8f5e9", borderRadius: 10, padding: 4, gap: 4, border: "1px solid #c8e6c9" }}>
          {[
            { id: "mark", label: "Mark Attendance" },
            { id: "register", label: "Register (Date-wise)" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setAttView(t.id)}
              style={{
                border: "none",
                cursor: "pointer",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 700,
                background: attView === t.id ? "#1B5E20" : "transparent",
                color: attView === t.id ? "#fff" : "#1B5E20",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {attView === "mark" && (
        <>
          {/* Toolbar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 12,
              padding: "14px 16px",
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
              <Sel label="Class" value={selCls} onChange={setSelCls} width={180} options={settings.classes.map((c) => ({ value: c.id, label: formatClassDisplay(c) }))} />
              <Inp label="Date" type="date" value={date} onChange={setDate} width={180} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Btn small color={C.green} onClick={() => markAll("P")}>✔ All Present</Btn>
              <Btn small color={C.red} onClick={() => markAll("A")}>✘ All Absent</Btn>
              {cs.length > 0 && (
                <Btn small outline onClick={doExportAttendance}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Download size={14} /> PDF
                  </span>
                </Btn>
              )}
            </div>
          </div>

          {/* KPI strip — filled cards like Fees */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            {[
              { l: "Total", v: cs.length, bg: "linear-gradient(135deg,#1B5E20 0%,#2e7d32 100%)", sub: `${attendanceRate}% present rate` },
              { l: "Present", v: present, bg: "linear-gradient(135deg,#15803d 0%,#22c55e 100%)", sub: "Marked P" },
              { l: "Absent", v: absent, bg: "linear-gradient(135deg,#b91c1c 0%,#ef4444 100%)", sub: "Marked A" },
              { l: "Late", v: late, bg: "linear-gradient(135deg,#b45309 0%,#eab308 100%)", sub: "Marked L" },
              { l: "Unmarked", v: unmarked, bg: "linear-gradient(135deg,#475569 0%,#94a3b8 100%)", sub: "Not marked yet" },
            ].map((s) => (
              <div key={s.l} style={{ borderRadius: 12, padding: "16px 14px", color: "#fff", background: s.bg, boxShadow: "0 4px 14px rgba(15,23,42,0.12)" }}>
                <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 600 }}>{s.l}</div>
                <div style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1.15, marginTop: 4 }}>{s.v}</div>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Student table */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", background: "#f1f8f3", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700, color: "#1B5E20", fontSize: 15 }}>
                {getClassLabel(settings, selCls)} — {date}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
                {present} present · {absent} absent · {late} late · {unmarked} unmarked
              </div>
            </div>
            {cs.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "#6b7280", fontSize: 14 }}>No students in this class.</div>
            ) : (
              <div ref={attendanceTableRef} style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={thStyle("left")}>Roll No</th>
                      <th style={thStyle("left")}>Name</th>
                      <th style={thStyle("left")}>Father&apos;s Name</th>
                      <th style={thStyle("center")}>Status</th>
                      <th style={thStyle("center")}>Mark</th>
                      <th style={thStyle("center")}>Application</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cs.map((s, i) => {
                      const st = classAtt[s.id] || "";
                      return (
                        <tr key={s.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                          <td style={tdStyle("left", { fontWeight: 700, fontVariantNumeric: "tabular-nums" })}>{s.rollNo || "—"}</td>
                          <td style={tdStyle("left", { fontWeight: 600 })}>{s.name || "—"}</td>
                          <td style={tdStyle("left", { color: "#64748b" })}>{s.fatherName || "—"}</td>
                          <td style={tdStyle("center", { fontWeight: 800, color: stColor(st || "—"), fontVariantNumeric: "tabular-nums" })}>
                            {st || "—"}
                          </td>
                          <td style={tdStyle("center")}>
                            <div style={{ display: "inline-flex", justifyContent: "center", gap: 6 }}>
                              <Btn small color={st === "P" ? C.green : undefined} outline={st !== "P"} onClick={() => toggle(s.id, "P")}>P</Btn>
                              <Btn small color={st === "A" ? C.red : undefined} outline={st !== "A"} danger={st === "A"} onClick={() => toggle(s.id, "A")}>A</Btn>
                              <Btn small color={st === "L" ? C.gold : undefined} outline={st !== "L"} onClick={() => toggle(s.id, "L")}>L</Btn>
                            </div>
                          </td>
                          <td style={tdStyle("center")}>
                            {classApps[s.id] ? (
                              <Btn small outline onClick={() => setViewApp(classApps[s.id])}>View</Btn>
                            ) : (
                              <Btn small outline onClick={() => openUpload(s.id)}>Upload</Btn>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {attView === "register" && (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 12,
              padding: "14px 16px",
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
              <Sel label="Class" value={selCls} onChange={setSelCls} width={180} options={settings.classes.map((c) => ({ value: c.id, label: formatClassDisplay(c) }))} />
              <Inp label="Month" type="month" value={registerMonth} onChange={setRegisterMonth} width={180} />
            </div>
            {cs.length > 0 && (
              <Btn small outline onClick={() => doExportRegister("pdf")}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Download size={14} /> PDF
                </span>
              </Btn>
            )}
          </div>

          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
            Day columns are centered (P / A / L). Mark attendance in the Mark Attendance tab first.
          </p>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", background: "#f1f8f3" }}>
              <div style={{ fontWeight: 700, color: "#1B5E20", fontSize: 15 }}>{registerTitle()}</div>
            </div>
            {cs.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "#6b7280", fontSize: 14 }}>No students in this class.</div>
            ) : (
              <div ref={registerTableRef} style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 480 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle("left"), position: "sticky", left: 0, zIndex: 2 }}>Roll No</th>
                      <th style={{ ...thStyle("left"), position: "sticky", left: 72, zIndex: 2, minWidth: 110 }}>Name</th>
                      <th style={{ ...thStyle("left"), minWidth: 110 }}>Father&apos;s Name</th>
                      {registerDates.map((d) => (
                        <th key={d} title={d} style={{ ...thStyle("center"), padding: "8px 6px", minWidth: 28, fontSize: 11 }}>
                          {d.slice(8)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cs.map((s, i) => (
                      <tr key={s.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                        <td style={{ ...tdStyle("left", { fontWeight: 700, fontVariantNumeric: "tabular-nums", position: "sticky", left: 0, background: i % 2 === 0 ? "#f8fafc" : "#fff", zIndex: 1 }) }}>
                          {s.rollNo || "—"}
                        </td>
                        <td style={{ ...tdStyle("left", { fontWeight: 600, position: "sticky", left: 72, background: i % 2 === 0 ? "#f8fafc" : "#fff", zIndex: 1 }) }}>
                          {s.name || "—"}
                        </td>
                        <td style={tdStyle("left", { color: "#64748b" })}>{s.fatherName || "—"}</td>
                        {registerDates.map((d) => {
                          const st = getStatusForDate(s.id, d);
                          return (
                            <td key={d} style={tdStyle("center", { fontWeight: 700, color: stColor(st), padding: "6px 4px", fontVariantNumeric: "tabular-nums" })}>
                              {st}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {viewApp && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setViewApp(null)}
        >
          <div
            style={{ background: "#fff", borderRadius: 12, maxWidth: "90vw", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #e5e7eb" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{viewApp.name || "Application"}</span>
              <button type="button" onClick={() => setViewApp(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: 16, minHeight: 200 }}>
              {isImage(viewApp.mime) && <img src={viewApp.data} alt="Application" style={{ maxWidth: "100%", height: "auto", display: "block" }} />}
              {isPdf(viewApp.mime) && <embed src={viewApp.data} type="application/pdf" style={{ width: "100%", minHeight: "70vh" }} />}
              {viewApp.mime && !isImage(viewApp.mime) && !isPdf(viewApp.mime) && (
                <div style={{ textAlign: "center", padding: 24 }}>
                  <p style={{ marginBottom: 12 }}>Word/document file — open in new tab to view.</p>
                  <a href={viewApp.data} download={viewApp.name || "application.doc"} target="_blank" rel="noopener noreferrer" style={{ color: "#1B5E20", fontWeight: 600 }}>
                    Open / Download
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

