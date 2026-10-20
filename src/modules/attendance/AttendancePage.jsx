import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import jsPDFModule from "jspdf";
import autoTable from "jspdf-autotable";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import * as H from "@/shared/helpers";

const {
  formatClassDisplay, resolveClass, getClassLabel,
  sanitizePdfFilenamePart, exportTableToPdf, getTableDataFromElement,
} = H;

// jsPDF is used by exportTableToPdf via helpers, kept for compat
const jsPDF =
  typeof jsPDFModule === "function"
    ? jsPDFModule
    : jsPDFModule?.jsPDF ?? jsPDFModule?.default;
void jsPDF; void autoTable; // suppress unused lint


// ─── Exported local-storage helpers ───────────────────────────────────────────
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
  if (schoolId) {
    import("../../supabaseSync.js")
      .then((m) => m.isSupabaseConfigured && m.saveAttendanceToCloud(schoolId, att))
      .catch(() => {});
  }
}

export async function hydrateAttendanceFromCloud(schoolId) {
  try {
    const m = await import("../../supabaseSync.js");
    if (!m.isSupabaseConfigured || !schoolId) return loadAttendanceFromLocal(schoolId);
    const cloud = await m.loadAttendanceFromCloud(schoolId);
    if (!cloud || !Object.keys(cloud).length) return loadAttendanceFromLocal(schoolId);
    try {
      const raw = window.localStorage.getItem(ATTENDANCE_DATA_KEY);
      const data = raw ? JSON.parse(raw) : {};
      data[schoolId] = cloud;
      window.localStorage.setItem(ATTENDANCE_DATA_KEY, JSON.stringify(data));
    } catch {}
    return cloud;
  } catch {
    return loadAttendanceFromLocal(schoolId);
  }
}


// ─── AttendancePage ────────────────────────────────────────────────────────────
/**
 * @param {boolean} embedded – when true (embedded under AttendanceLeaveModulePage / ModulePageShell),
 *   the outer h1 is hidden and the tab bar uses shadcn Tabs (not the standalone green pills).
 */
export function AttendancePage({
  settings,
  students,
  currentSession,
  activeSchoolId,
  setBarSubtitle,
  embedded = false,
}) {
  const [selCls, setSelCls] = useState(settings.classes[0]?.id || "");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [att, setAtt] = useState(() => loadAttendanceFromLocal(activeSchoolId || ""));
  const [applications, setApplications] = useState({});
  const [viewApp, setViewApp] = useState(null);
  const [attView, setAttView] = useState("mark"); // "mark" | "register"
  const [registerMonth, setRegisterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const attendanceTableRef = useRef(null);
  const registerTableRef = useRef(null);

  // Hydrate from cloud on mount / school change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await hydrateAttendanceFromCloud(activeSchoolId || "");
      if (!cancelled) setAtt(data || {});
    })();
    return () => { cancelled = true; };
  }, [activeSchoolId]);

  // Persist to local storage whenever attendance changes
  useEffect(() => {
    if (activeSchoolId) saveAttendanceToLocal(activeSchoolId, att);
  }, [activeSchoolId, att]);

  // Derived data
  const key = `${selCls}_${date}`;
  const classAtt = att[key] || {};
  const classApps = applications[key] || {};
  const cs = students.filter((s) => {
    if (selCls === "all") return true;
    const filterCls = resolveClass(settings.classes, selCls);
    const studentCls = resolveClass(settings.classes, s.classId);
    return filterCls && studentCls && filterCls.id === studentCls.id;
  });

  const toggle = (id, status) => setAtt((a) => ({ ...a, [key]: { ...classAtt, [id]: status } }));
  const markAll = (status) => {
    const v = {};
    cs.forEach((s) => { v[s.id] = status; });
    setAtt((a) => ({ ...a, [key]: v }));
  };

  const present = cs.filter((s) => classAtt[s.id] === "P").length;
  const absent = cs.filter((s) => classAtt[s.id] === "A").length;
  const late = cs.filter((s) => classAtt[s.id] === "L").length;
  const unmarked = cs.length - present - absent - late;
  const attendanceRate = cs.length > 0 ? Math.round((present / cs.length) * 100) : 0;

  // Application upload helpers
  const handleUpload = (sid, e) => {
    const f = e?.target?.files?.[0];
    if (!f) return;
    if (
      !f.type.match(/^image\//) &&
      f.type !== "application/pdf" &&
      f.type !== "application/msword" &&
      f.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) return;
    const r = new FileReader();
    r.onload = (ev) => {
      setApplications((a) => ({
        ...a,
        [key]: { ...classApps, [sid]: { data: ev.target.result, mime: f.type, name: f.name } },
      }));
    };
    r.readAsDataURL(f);
  };
  const openUpload = (sid) => {
    const el = document.createElement("input");
    el.type = "file";
    el.accept = "image/*,.pdf,.doc,.docx";
    el.onchange = (e) => handleUpload(sid, e);
    el.click();
  };
  const isImage = (m) => m && m.startsWith("image/");
  const isPdf = (m) => m === "application/pdf";

  // ── Export: Mark Attendance PDF ──
  const tableTitle = () => `${getClassLabel(settings, selCls)} — Attendance — ${date}`;
  const attendancePdfSubtitle = () =>
    [getClassLabel(settings, selCls), currentSession, `Attendance — ${date}`].filter(Boolean).join(" — ");
  const doExportAttendance = () => {
    const { headers, rows } = getTableDataFromElement(attendanceTableRef.current);
    if (!headers.length) { alert("No data to export. Select a class with students."); return; }
    const markExportCols = Math.min(4, headers.length);
    const h = headers.slice(0, markExportCols);
    const r = rows.map((row) => row.slice(0, markExportCols));
    const name = `${sanitizePdfFilenamePart(getClassLabel(settings, selCls))}_Attendance_${date}`;
    void exportTableToPdf(settings, currentSession, tableTitle(), h, r, name + ".pdf", undefined, {
      subtitleOverride: attendancePdfSubtitle(),
    }).catch(() => alert("PDF export failed."));
  };

  // ── Register (date-wise) helpers ──
  const [y, m] = registerMonth.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const registerDates = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });
  const getStatusForDate = (studentId, dateStr) => {
    const k = `${selCls}_${dateStr}`;
    return (att[k] || {})[studentId] || "—";
  };
  const registerTitle = () => {
    const monthName = new Date(y, m - 1, 1).toLocaleString("en-PK", { month: "long", year: "numeric" });
    return `${getClassLabel(settings, selCls)} — Attendance Register — ${monthName}`;
  };
  const registerPdfSubtitle = () => {
    const monthName = new Date(y, m - 1, 1).toLocaleString("en-PK", { month: "long", year: "numeric" });
    return [getClassLabel(settings, selCls), currentSession, `Attendance Register — ${monthName}`].filter(Boolean).join(" — ");
  };
  const doExportRegister = (format) => {
    const monthName = new Date(y, m - 1, 1).toLocaleString("en-PK", { month: "long", year: "numeric" });
    const concatHdr = `P/A/L (${monthName}, days 1–${registerDates.length}; – = unmarked)`;
    const name = `${sanitizePdfFilenamePart(getClassLabel(settings, selCls))}_Attendance_Register_${registerMonth}`;
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

  // Update top-bar subtitle when view changes (parent may pass null when embedded)
  useEffect(() => {
    if (!setBarSubtitle) return;
    setBarSubtitle(attView === "mark" ? "Mark Attendance" : "Register (Date-wise)");
  }, [attView, setBarSubtitle]);

  // Status color for register table cells (kept as inline for print compat)
  const stColor = (st) =>
    st === "P" ? "#15803d" : st === "A" ? "#dc2626" : st === "L" ? "#d97706" : "#9ca3af";

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 w-full min-w-0 box-border" style={{ maxWidth: 1200, margin: "0 auto" }}>

      {/* Standalone page header — hidden when embedded under ModulePageShell */}
      {!embedded && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-extrabold tracking-tight text-foreground">Attendance</h1>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {attView === "mark"
                ? `Daily marking · ${getClassLabel(settings, selCls)} · ${date}`
                : `Month register · P Present · A Absent · L Late`}
            </p>
          </div>
        </div>
      )}

      <Tabs value={attView} onValueChange={setAttView} className="w-full">
        <TabsList>
          <TabsTrigger value="mark">Mark Attendance</TabsTrigger>
          <TabsTrigger value="register">Register (Date-wise)</TabsTrigger>
        </TabsList>

        {/* ── Mark Attendance tab ────────────────────────────────────────── */}
        <TabsContent value="mark" className="mt-4 flex flex-col gap-4">
          {/* Toolbar */}
          <Card size="sm" className="shadow-none">
            <CardContent className="py-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Class</Label>
                    <NativeSelect size="sm" value={selCls} onChange={(e) => setSelCls(e.target.value)} className="w-44">
                      {settings.classes.map((c) => (
                        <NativeSelectOption key={c.id} value={c.id}>{formatClassDisplay(c)}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</Label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-7 w-44" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => markAll("P")}>Mark All Present</Button>
                  <Button size="sm" variant="destructive" onClick={() => markAll("A")}>Mark All Absent</Button>
                  {cs.length > 0 && (
                    <Button size="sm" variant="outline" onClick={doExportAttendance}>
                      <Download size={14} /> Export PDF
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { l: "Total", v: cs.length, sub: `${attendanceRate}% present rate` },
              { l: "Present", v: present, sub: "Marked P" },
              { l: "Absent", v: absent, sub: "Marked A" },
              { l: "Late", v: late, sub: "Marked L" },
              { l: "Unmarked", v: unmarked, sub: "Not marked yet" },
            ].map((s) => (
              <Card key={s.l} size="sm" className="shadow-none">
                <CardContent className="space-y-1 p-3">
                  <div className="text-xs font-semibold text-muted-foreground">{s.l}</div>
                  <div className="text-2xl font-bold tabular-nums tracking-tight">{s.v}</div>
                  <div className="text-[11px] text-muted-foreground">{s.sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Student table */}
          <Card size="sm" className="shadow-none overflow-hidden">
            <div className="px-4 py-3 border-b flex justify-between items-center gap-2 flex-wrap bg-muted/30">
              <div className="font-semibold text-sm">{getClassLabel(settings, selCls)} — {date}</div>
              <div className="text-xs text-muted-foreground font-medium">
                {present} present · {absent} absent · {late} late · {unmarked} unmarked
              </div>
            </div>
            {cs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No students in this class.</div>
            ) : (
              <div ref={attendanceTableRef} className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="bg-muted">Roll No</TableHead>
                      <TableHead className="bg-muted">Name</TableHead>
                      <TableHead className="bg-muted">Father&apos;s Name</TableHead>
                      <TableHead className="bg-muted text-center">Status</TableHead>
                      <TableHead className="bg-muted text-center">Mark</TableHead>
                      <TableHead className="bg-muted text-center">Application</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cs.map((s) => {
                      const st = classAtt[s.id] || "";
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-bold tabular-nums">{s.rollNo || "—"}</TableCell>
                          <TableCell className="font-semibold">{s.name || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{s.fatherName || "—"}</TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={
                                st === "P" ? "default" :
                                st === "A" ? "destructive" :
                                st === "L" ? "outline" : "secondary"
                              }
                            >
                              {st || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex justify-center gap-1.5">
                              <Button size="sm" variant={st === "P" ? "default" : "ghost"} onClick={() => toggle(s.id, "P")}>P</Button>
                              <Button size="sm" variant={st === "A" ? "destructive" : "ghost"} onClick={() => toggle(s.id, "A")}>A</Button>
                              <Button size="sm" variant={st === "L" ? "secondary" : "ghost"} onClick={() => toggle(s.id, "L")}>L</Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {classApps[s.id] ? (
                              <Button size="sm" variant="outline" onClick={() => setViewApp(classApps[s.id])}>View Application</Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => openUpload(s.id)}>Upload Application</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── Register (Date-wise) tab ───────────────────────────────────── */}
        <TabsContent value="register" className="mt-4 flex flex-col gap-4">
          {/* Toolbar */}
          <Card size="sm" className="shadow-none">
            <CardContent className="py-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Class</Label>
                    <NativeSelect size="sm" value={selCls} onChange={(e) => setSelCls(e.target.value)} className="w-44">
                      {settings.classes.map((c) => (
                        <NativeSelectOption key={c.id} value={c.id}>{formatClassDisplay(c)}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Month</Label>
                    <Input type="month" value={registerMonth} onChange={(e) => setRegisterMonth(e.target.value)} className="h-7 w-44" />
                  </div>
                </div>
                {cs.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => doExportRegister("pdf")}>
                    <Download size={14} /> Export Register
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <p className="m-0 text-xs text-muted-foreground">
            Day columns are centered (P / A / L). Mark attendance in the Mark Attendance tab first.
          </p>

          {/* Register table — plain div wrapper (no overflow-hidden) for sticky columns */}
          <div className="rounded-xl ring-1 ring-foreground/10 bg-card text-sm">
            <div className="px-4 py-3 border-b bg-muted/30">
              <div className="font-semibold text-sm">{registerTitle()}</div>
            </div>
            {cs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No students in this class.</div>
            ) : (
              <div ref={registerTableRef} className="overflow-x-auto">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 480 }}>
                  <thead>
                    <tr>
                      <th className="bg-muted h-9 px-2 text-left align-middle text-xs font-semibold whitespace-nowrap text-foreground sticky left-0 z-[2]">
                        Roll No
                      </th>
                      <th className="bg-muted h-9 px-2 text-left align-middle text-xs font-semibold whitespace-nowrap text-foreground sticky z-[2]"
                          style={{ left: 72, minWidth: 110 }}>
                        Name
                      </th>
                      <th className="bg-muted h-9 px-2 text-left align-middle text-xs font-semibold whitespace-nowrap text-foreground"
                          style={{ minWidth: 110 }}>
                        Father&apos;s Name
                      </th>
                      {registerDates.map((d) => (
                        <th key={d} title={d}
                            className="bg-muted text-center align-middle text-xs font-semibold whitespace-nowrap text-foreground"
                            style={{ padding: "8px 6px", minWidth: 28 }}>
                          {d.slice(8)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cs.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                        <td className="p-2 font-bold tabular-nums whitespace-nowrap sticky left-0 z-[1] bg-card">
                          {s.rollNo || "—"}
                        </td>
                        <td className="p-2 font-semibold whitespace-nowrap sticky z-[1] bg-card" style={{ left: 72 }}>
                          {s.name || "—"}
                        </td>
                        <td className="p-2 text-muted-foreground whitespace-nowrap">{s.fatherName || "—"}</td>
                        {registerDates.map((d) => {
                          const st = getStatusForDate(s.id, d);
                          return (
                            <td key={d} className="text-center font-bold tabular-nums whitespace-nowrap"
                                style={{ padding: "6px 4px", color: stColor(st) }}>
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
        </TabsContent>
      </Tabs>

      {/* Application viewer modal */}
      {viewApp && createPortal(
        <div
          className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4"
          onClick={() => setViewApp(null)}
        >
          <div
            className="bg-background rounded-xl max-w-[90vw] max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-4 py-3 border-b">
              <span className="font-bold text-sm">{viewApp.name || "Application"}</span>
              <Button size="icon-sm" variant="ghost" onClick={() => setViewApp(null)}>
                <X />
              </Button>
            </div>
            <div className="p-4 min-h-[200px]">
              {isImage(viewApp.mime) && (
                <img src={viewApp.data} alt="Application" className="max-w-full h-auto block" />
              )}
              {isPdf(viewApp.mime) && (
                <embed src={viewApp.data} type="application/pdf" style={{ width: "100%", minHeight: "70vh" }} />
              )}
              {viewApp.mime && !isImage(viewApp.mime) && !isPdf(viewApp.mime) && (
                <div className="text-center p-6">
                  <p className="mb-3">Word/document file — open in new tab to view.</p>
                  <a
                    href={viewApp.data}
                    download={viewApp.name || "application.doc"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline"
                  >
                    Open / Download
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
