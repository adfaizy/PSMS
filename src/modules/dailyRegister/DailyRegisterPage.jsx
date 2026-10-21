import React, { useEffect, useState } from "react";
import { formatGradeLabel, getClassLabel, getClassSubjects, resolveClass } from "@/shared/helpers";
import {
  DAY_SLOTS,
  DEFAULT_MARK_MAX,
  PERFORMANCE_BANDS,
  blankSheet,
  buildReport,
  daySummary,
  defaultSessionMonthKey,
  formatMonthLabel,
  listSessionMonthOptions,
  loadSheet,
  normalizeMarkMax,
  performanceBandsForMax,
  resolveClassId,
  saveSheet,
  sectionDisplayLabel,
  sectionsForGrade,
  studentTotals,
  uniqueGrades,
} from "./dailyRegisterCore.js";
import { ModulePageShell } from "@/components/ModulePageShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import "./dailyRegister.css";

const TABS = [
  { id: "student", l: "Student Record" },
  { id: "summary", l: "Summary" },
  { id: "report", l: "Report" },
];

/** Flat grid cell inputs — shadcn defaults overridden to match .daily-register table CSS */
const GRID_INPUT =
  "h-auto min-h-[1.7em] rounded-none border-0 bg-transparent shadow-none focus-visible:border-0 focus-visible:ring-0 px-1 py-1 text-[0.68rem] leading-snug";

/** Read-only date from month working days (e.g. 06/04/2026). */
function formatSummaryDate(isoDate, dayNum) {
  const iso = String(isoDate || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  const n = String(dayNum || "").padStart(2, "0").slice(-2);
  return n && n !== "00" ? n : "—";
}

function BandTable({ bands, bandDefs = PERFORMANCE_BANDS }) {
  return (
    <table className="report-band-table">
      <thead>
        <tr>
          {bandDefs.map((b) => (
            <th key={b.id} className={b.id}>
              {b.label}
              <span className="rng">{b.range}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {bandDefs.map((b) => {
            const list = bands?.[b.id] || [];
            return (
              <td key={b.id}>
                {list.length === 0 ? (
                  <div className="report-empty">—</div>
                ) : (
                  <ol>
                    {list.map((s) => (
                      <li key={s.id}>
                        <span className="avg">{s.avgDisplay}</span>
                        {s.roll ? `${s.roll}. ` : ""}
                        {s.name || "—"}
                      </li>
                    ))}
                  </ol>
                )}
              </td>
            );
          })}
        </tr>
      </tbody>
    </table>
  );
}

function DailyRegisterSheet({
  settings,
  students,
  activeSchoolId,
  classId,
  monthKey,
  monthOptions,
  grade,
  grades,
  sectionOptions,
  onGradeChange,
  onClassChange,
  onMonthChange,
}) {
  const classes = settings?.classes || [];
  const roster = (students || []).filter((s) => resolveClass(classes, s.classId)?.id === classId);
  const [tab, setTab] = useState("student");
  const [status, setStatus] = useState("");
  const [sheet, setSheet] = useState(() =>
    activeSchoolId && classId
      ? loadSheet(activeSchoolId, classId, monthKey, roster)
      : blankSheet(monthKey, roster),
  );

  const subjects = getClassSubjects(settings, classId, "exam") || [];
  const classLabel = classId ? getClassLabel(settings, classId) : "—";
  const schoolName = settings?.schoolName || "School";
  const schoolCode = settings?.schoolCode || "—";
  const markMax = normalizeMarkMax(sheet.markMax ?? DEFAULT_MARK_MAX);
  const bandDefs = performanceBandsForMax(markMax);
  const report = buildReport(sheet, { schoolName, schoolCode, classLabel, monthKey });

  const persist = (next, msg = "Saved") => {
    setSheet(next);
    if (!activeSchoolId || !classId) return;
    const at = saveSheet(activeSchoolId, classId, monthKey, next);
    setStatus(`${msg} · ${new Date(at).toLocaleTimeString()}`);
  };

  const setMarkMax = (raw) => {
    const next = normalizeMarkMax(raw);
    persist({ ...sheet, markMax: next }, `Max marks set to ${next}`);
  };

  const updateStudent = (id, patch) => {
    persist(
      {
        ...sheet,
        students: sheet.students.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      },
      "Updated",
    );
  };

  const updateMark = (id, dayIndex, value) => {
    const raw = String(value ?? "").trim();
    let nextVal = "";
    if (raw !== "") {
      const n = Number(raw);
      if (!Number.isFinite(n)) return;
      nextVal = Math.max(0, Math.min(markMax, n));
    }
    persist(
      {
        ...sheet,
        students: sheet.students.map((s) => {
          if (s.id !== id) return s;
          const marks = [...(s.marks || [])];
          while (marks.length < DAY_SLOTS) marks.push("");
          marks[dayIndex] = nextVal;
          return { ...s, marks };
        }),
      },
      "Marks updated",
    );
  };

  const updateDayMeta = (index, patch) => {
    const dayMeta = sheet.dayMeta.map((d, i) => (i === index ? { ...d, ...patch } : d));
    persist({ ...sheet, dayMeta }, "Day updated");
  };

  const resetMonth = () => {
    if (!window.confirm("Reset this month? Marks and day details will be cleared and roster reloaded.")) return;
    persist(blankSheet(monthKey, roster), "Month reset");
  };

  const printReport = () => {
    setTab("report");
    document.body.classList.add("printing-daily-register");
    window.setTimeout(() => {
      window.print();
      document.body.classList.remove("printing-daily-register");
    }, 80);
  };

  return (
    <div className="card space-y-3">
      <Card size="sm" className="no-print shadow-none">
        <CardContent className="dr-meta flex flex-nowrap items-end gap-3 overflow-x-auto pt-(--card-spacing) pb-0.5">
          <div className="flex min-w-[9rem] shrink-0 flex-col gap-1.5">
            <Label className="text-xs">School Name</Label>
            <div className="dr-val flex h-8 items-center text-sm font-medium whitespace-nowrap">{schoolName}</div>
          </div>
          <div className="flex min-w-[5.5rem] shrink-0 flex-col gap-1.5">
            <Label className="text-xs">EMIS Code</Label>
            <div className="dr-val flex h-8 items-center text-sm font-medium tabular-nums">{schoolCode}</div>
          </div>
          <div className="flex w-[8.5rem] shrink-0 flex-col gap-1.5">
            <Label htmlFor="dr-grade" className="text-xs">Class</Label>
            <NativeSelect
              id="dr-grade"
              aria-label="Class"
              size="sm"
              value={grade}
              onChange={(e) => onGradeChange(e.target.value)}
              className="w-full"
            >
              {grades.length === 0 && <NativeSelectOption value="">No classes</NativeSelectOption>}
              {grades.map((g) => (
                <NativeSelectOption key={g} value={g}>
                  {formatGradeLabel(g) || g}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex w-[5.5rem] shrink-0 flex-col gap-1.5">
            <Label htmlFor="dr-section" className="text-xs">Section</Label>
            <NativeSelect
              id="dr-section"
              aria-label="Section"
              size="sm"
              value={classId}
              onChange={(e) => onClassChange(e.target.value)}
              className="w-full"
              disabled={!sectionOptions.length}
            >
              {sectionOptions.length === 0 && <NativeSelectOption value="">—</NativeSelectOption>}
              {sectionOptions.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {sectionDisplayLabel(c)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex w-[4.5rem] shrink-0 flex-col gap-1.5">
            <Label className="text-xs">On Roll</Label>
            <div className="dr-val flex h-8 items-center text-sm font-medium tabular-nums">{sheet.students.length}</div>
          </div>
          <div className="flex w-[10.5rem] shrink-0 flex-col gap-1.5">
            <Label htmlFor="dr-month" className="text-xs">Month</Label>
            <NativeSelect
              id="dr-month"
              aria-label="Month"
              size="sm"
              className={cn("w-full", "month-select")}
              value={monthKey}
              onChange={(e) => onMonthChange(e.target.value)}
            >
              {monthOptions.map((m) => (
                <NativeSelectOption key={m} value={m}>{formatMonthLabel(m)}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex w-[5.5rem] shrink-0 flex-col gap-1.5">
            <Label htmlFor="dr-mark-max" className="text-xs">Max Marks</Label>
            <Input
              id="dr-mark-max"
              type="number"
              min={1}
              max={100}
              step={0.5}
              className="h-8"
              value={markMax}
              onChange={(e) => setMarkMax(e.target.value)}
              title="Maximum marks for each daily test"
            />
          </div>
        </CardContent>
      </Card>

      <div className="no-print flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={setTab} className="dr-tabs min-w-0">
          <TabsList className="h-auto flex-wrap">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="text-xs sm:text-sm">
                {t.l}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="dr-actions flex flex-wrap items-center gap-2">
          <span id="status" className="text-xs text-muted-foreground">{status}</span>
          <Button type="button" size="sm" onClick={() => persist(sheet, "Saved")}>Save</Button>
          <Button type="button" size="sm" variant="outline" onClick={resetMonth}>Reset month</Button>
          {tab === "report" && (
            <Button type="button" size="sm" onClick={printReport}>Print report</Button>
          )}
        </div>
      </div>

      {tab === "student" && (
        <div className="panel active panel-student">
          <div className="table-scroll" tabIndex={0} aria-label="Student daily marks grid">
            <table className="sr">
              <thead>
                <tr>
                  <th className="th-roll">Roll</th>
                  <th className="th-name">Name</th>
                  <th className="th-father">Father</th>
                  {Array.from({ length: DAY_SLOTS }, (_, i) => {
                    const meta = sheet.dayMeta[i] || {};
                    const dayLabel = String(meta.dayNum || "").padStart(2, "0").slice(-2);
                    const show = meta.date || meta.dayNum ? (dayLabel === "00" ? "" : dayLabel) : "";
                    return (
                      <th key={i} className="th-date th-marks" title={meta.date || undefined}>
                        <span className="day-num day-num--label">{show}</span>
                      </th>
                    );
                  })}
                  <th className="th-total">Total</th>
                  <th className="th-avg">Avg</th>
                  <th className="th-sba">SBA</th>
                  <th className="th-remarks">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {sheet.students.length === 0 ? (
                  <tr>
                    <td colSpan={DAY_SLOTS + 6} className="empty">
                      No students in this class. Add them under Students first.
                    </td>
                  </tr>
                ) : (
                  sheet.students.map((s) => {
                    const t = studentTotals(s, markMax);
                    return (
                      <tr key={s.id}>
                        <td className="roll-cell">
                          <Input className={cn("roll", GRID_INPUT, "text-left")} value={s.roll} onChange={(e) => updateStudent(s.id, { roll: e.target.value })} />
                        </td>
                        <td className="name-cell">
                          <Input
                            className={cn("name", GRID_INPUT, "text-left")}
                            type="text"
                            value={s.name}
                            onChange={(e) => updateStudent(s.id, { name: e.target.value })}
                          />
                        </td>
                        <td className="father-cell">
                          <Input
                            className={cn("father", GRID_INPUT, "text-left")}
                            type="text"
                            value={s.father}
                            onChange={(e) => updateStudent(s.id, { father: e.target.value })}
                          />
                        </td>
                        {Array.from({ length: DAY_SLOTS }, (_, i) => (
                          <td key={i} className="mark-cell">
                            <Input
                              className={cn("mark", GRID_INPUT, "text-center")}
                              type="number"
                              min={0}
                              max={markMax}
                              step={0.5}
                              value={s.marks?.[i] ?? ""}
                              onChange={(e) => updateMark(s.id, i, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="total c">{t.totalDisplay}</td>
                        <td className="avg c">{t.avgDisplay}</td>
                        <td className="sba-cell">
                          <Input className={cn("sba", GRID_INPUT, "text-center")} value={s.sba} onChange={(e) => updateStudent(s.id, { sba: e.target.value })} />
                        </td>
                        <td className="remarks-cell">
                          <Input className={cn("remarks", GRID_INPUT, "text-left")} value={s.remarks} onChange={(e) => updateStudent(s.id, { remarks: e.target.value })} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="note">
            Select <strong>Class</strong>, <strong>Section</strong> and <strong>Month</strong> above.
            Enter marks (0–{markMax}); Total / Average calculate automatically.
            Headers show working days (Mon–Fri) as day-of-month for the selected month. Set Subject / Topic on Summary.
            Students come from the Students module for this class.
          </p>
        </div>
      )}

      {tab === "summary" && (
        <div className="panel active panel-summary">
          <div className="table-scroll" tabIndex={0} aria-label="Daily summary grid">
            <table className="sr" id="summaryTable">
                  <thead>
                <tr>
                  <th className="th-id">#</th>
                  <th className="calc-head">Date</th>
                  <th className="calc-head">Subject</th>
                  <th className="calc-head">Topic</th>
                  <th className="th-total">Present</th>
                  <th className="th-avg">Absent</th>
                  <th className="th-sba">Average</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: DAY_SLOTS }, (_, i) => {
                  const d = sheet.dayMeta[i] || {};
                  const sum = daySummary(sheet.students, sheet.dayMeta, i, markMax);
                  const dateShow = formatSummaryDate(d.date, d.dayNum);
                  return (
                    <tr key={i}>
                      <td className="c">{i + 1}</td>
                      <td className="date-cell c whitespace-nowrap font-bold" title={d.date || undefined}>
                        {dateShow}
                      </td>
                      <td className="subject-cell">
                        <NativeSelect
                          className="day-subject w-full max-w-[7.5rem] h-auto min-w-0 [&_[data-slot=native-select]]:h-auto [&_[data-slot=native-select]]:border-0 [&_[data-slot=native-select]]:bg-transparent [&_[data-slot=native-select]]:py-0.5 [&_[data-slot=native-select]]:pl-0 [&_[data-slot=native-select]]:pr-6 [&_[data-slot=native-select]]:font-bold [&_[data-slot=native-select]]:shadow-none [&_[data-slot=native-select]]:focus-visible:ring-0"
                          value={d.subject || ""}
                          onChange={(e) => updateDayMeta(i, { subject: e.target.value })}
                        >
                          <option value="">Subject…</option>
                          {subjects.map((sub) => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                          {d.subject && !subjects.includes(d.subject) && (
                            <option value={d.subject}>{d.subject}</option>
                          )}
                        </NativeSelect>
                      </td>
                      <td className="topic-cell">
                        <Input
                          className={cn("day-topic", GRID_INPUT, "min-w-[9rem] text-left w-full")}
                          value={d.topic || ""}
                          onChange={(e) => updateDayMeta(i, { topic: e.target.value })}
                          placeholder="Topic"
                        />
                      </td>
                      <td className="c total">{sum.present}</td>
                      <td className="c avg">{sum.absent}</td>
                      <td className="c">{sum.average}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note">
            Days follow the selected month (Mon–Fri). Choose subject and type the topic for each working day.
            Present / Absent / Average update from marks on Student Record.
          </p>
        </div>
      )}

      {tab === "report" && (
        <div className="panel active panel-report">
          <div className="report-toolbar no-print">
            <Button type="button" onClick={printReport}>
              Print / Save as PDF
            </Button>
          </div>
          <div className="report-sheet">
            <div className="report-doc-head">
              <p className="report-school">{report.schoolName}</p>
              <h2>Daily Quick Test — Performance Report</h2>
              <p className="sub">Monthly student grouping by average marks</p>
              <div className="report-meta">
                <div className="m"><label>EMIS</label><strong>{report.schoolCode}</strong></div>
                <div className="m"><label>Class</label><strong>{report.classLabel}</strong></div>
                <div className="m"><label>Month</label><strong>{report.monthLabel}</strong></div>
                <div className="m"><label>On Roll</label><strong>{report.onRoll}</strong></div>
                <div className="m"><label>With averages</label><strong>{report.students.filter((s) => s.count > 0).length}</strong></div>
                <div className="m"><label>Subjects set</label><strong>{report.bySubject.length}</strong></div>
                <div className="m"><label>Max marks</label><strong>{report.markMax ?? markMax}</strong></div>
              </div>
            </div>

            <div className="report-legend">
              {(report.bands || bandDefs).map((b) => (
                <span key={b.id} className={`chip ${b.id}`}>{b.label} {b.range}</span>
              ))}
            </div>

            <div className="report-section">
              <h3 className="report-section-title">
                Overall
                <span>All tests this month · max {report.markMax ?? markMax}</span>
              </h3>
              <BandTable bands={report.overall} bandDefs={report.bands || bandDefs} />
            </div>

            {report.bySubject.length === 0 ? (
              <p className="note">Set subjects on the Summary page to unlock subject-wise report pages.</p>
            ) : (
              report.bySubject.map((block) => (
                <div key={block.subject} className="report-section">
                  <h3 className="report-section-title">
                    {block.subject}
                    <span>{block.total} students with marks</span>
                  </h3>
                  <BandTable bands={block.bands} bandDefs={report.bands || bandDefs} />
                </div>
              ))
            )}

            <div className="report-sign">
              <div className="sig"><div className="line" />Class Teacher</div>
              <div className="sig"><div className="line" />Head Teacher</div>
              <div className="sig"><div className="line" />Date</div>
            </div>
          </div>
          <p className="note no-print">
            Printable performance sheet: overall and subject-wise groups
            (Best 9–10 · Better 7.5–8.9 · Good 6–7.4 · Normal 4–5.9 · Weak below 4).
            Set subjects on Summary first for subject pages.
          </p>
        </div>
      )}
    </div>
  );
}

export function DailyRegisterPage({
  settings,
  students = [],
  activeSchoolId,
  currentSession,
  setBarSubtitle,
}) {
  const classes = settings?.classes || [];
  const grades = uniqueGrades(classes);
  const [gradePick, setGradePick] = useState("");
  const [classPick, setClassPick] = useState("");
  const monthOptions = listSessionMonthOptions(currentSession);
  const [monthPick, setMonthPick] = useState("");
  const monthKey = monthOptions.includes(monthPick)
    ? monthPick
    : defaultSessionMonthKey(currentSession);

  const grade = grades.includes(gradePick) ? gradePick : (grades[0] || "");
  const sectionOptions = sectionsForGrade(classes, grade);
  const classId = sectionOptions.some((c) => c.id === classPick)
    ? classPick
    : (sectionOptions[0]?.id || "");

  useEffect(() => {
    if (!setBarSubtitle) return;
    setBarSubtitle("Daily Quick Test Register");
    return () => setBarSubtitle("");
  }, [setBarSubtitle]);

  return (
    <ModulePageShell
      title="Daily Quick Test Register"
      description="Marks entry, day summary, and printable performance report"
      bareContent
      className="daily-register"
      maxWidthClassName="max-w-[1600px]"
    >
      <div className="wrap">
        <DailyRegisterSheet
          key={`${activeSchoolId || ""}|${classId}|${monthKey}`}
          settings={settings}
          students={students}
          activeSchoolId={activeSchoolId}
          classId={classId}
          monthKey={monthKey}
          monthOptions={monthOptions}
          grade={grade}
          grades={grades}
          sectionOptions={sectionOptions}
          onGradeChange={(g) => {
            setGradePick(g);
            setClassPick(resolveClassId(classes, g, ""));
          }}
          onClassChange={setClassPick}
          onMonthChange={setMonthPick}
        />
      </div>
    </ModulePageShell>
  );
}
