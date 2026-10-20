import React, { useEffect, useState } from "react";
import { getClassLabel, getClassSubjects, resolveClass } from "@/shared/helpers";
import {
  DAY_SLOTS,
  MARK_MAX,
  PERFORMANCE_BANDS,
  blankSheet,
  buildReport,
  daySummary,
  defaultSessionMonthKey,
  formatMonthLabel,
  listSessionMonthOptions,
  loadSheet,
  resolveClassId,
  saveSheet,
  sectionsForGrade,
  studentTotals,
  uniqueGrades,
} from "./dailyRegisterCore.js";
import "./dailyRegister.css";

const TABS = [
  { id: "student", l: "Student Record" },
  { id: "summary", l: "Summary" },
  { id: "report", l: "Report" },
];

function BandTable({ bands }) {
  return (
    <table className="report-band-table">
      <thead>
        <tr>
          {PERFORMANCE_BANDS.map((b) => (
            <th key={b.id} className={b.id}>
              {b.label}
              <span className="rng">{b.range}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {PERFORMANCE_BANDS.map((b) => {
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
  const report = buildReport(sheet, { schoolName, schoolCode, classLabel, monthKey });

  const persist = (next, msg = "Saved") => {
    setSheet(next);
    if (!activeSchoolId || !classId) return;
    const at = saveSheet(activeSchoolId, classId, monthKey, next);
    setStatus(`${msg} · ${new Date(at).toLocaleTimeString()}`);
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
      nextVal = Math.max(0, Math.min(MARK_MAX, n));
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
    <div className="card">
      <div className="info">
        <div className="field">
          <label>School Name</label>
          <div className="val">{schoolName}</div>
        </div>
        <div className="field">
          <label>EMIS Code</label>
          <div className="val">{schoolCode}</div>
        </div>
        <div className="field">
          <label>Class</label>
          <select aria-label="Class" value={grade} onChange={(e) => onGradeChange(e.target.value)}>
            {grades.length === 0 && <option value="">No classes</option>}
            {grades.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Section</label>
          <select aria-label="Section" value={classId} onChange={(e) => onClassChange(e.target.value)}>
            {sectionOptions.length === 0 && <option value="">—</option>}
            {sectionOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.section || c.name || "—"}
              </option>
            ))}
          </select>
        </div>
            <div className="field">
              <label>On Roll</label>
              <div className="val">{sheet.students.length}</div>
            </div>
            <div className="field field-month">
              <label htmlFor="dr-month">Month</label>
              <select
                id="dr-month"
                className="month-select"
                aria-label="Month"
                value={monthKey}
                onChange={(e) => onMonthChange(e.target.value)}
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{formatMonthLabel(m)}</option>
                ))}
              </select>
            </div>
          </div>

      <div className="toolbar">
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab${tab === t.id ? " active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.l}
            </button>
          ))}
        </div>
        <div className="actions">
          <span id="status">{status}</span>
          <button className="btn primary" type="button" onClick={() => persist(sheet, "Saved")}>Save</button>
          <button className="btn" type="button" onClick={resetMonth}>Reset month</button>
          {tab === "report" && (
            <button className="btn primary" type="button" onClick={printReport}>Print report</button>
          )}
        </div>
      </div>

      {tab === "student" && (
        <div className="panel active panel-student">
          <div className="table-scroll">
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
                    const t = studentTotals(s);
                    return (
                      <tr key={s.id}>
                        <td className="roll-cell">
                          <input className="roll" value={s.roll} onChange={(e) => updateStudent(s.id, { roll: e.target.value })} />
                        </td>
                        <td className="name-cell">
                          <input
                            className="name"
                            type="text"
                            value={s.name}
                            onChange={(e) => updateStudent(s.id, { name: e.target.value })}
                          />
                        </td>
                        <td className="father-cell">
                          <input
                            className="father"
                            type="text"
                            value={s.father}
                            onChange={(e) => updateStudent(s.id, { father: e.target.value })}
                          />
                        </td>
                        {Array.from({ length: DAY_SLOTS }, (_, i) => (
                          <td key={i} className="mark-cell">
                            <input
                              className="mark"
                              type="number"
                              min={0}
                              max={MARK_MAX}
                              step={0.5}
                              value={s.marks?.[i] ?? ""}
                              onChange={(e) => updateMark(s.id, i, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="total c">{t.totalDisplay}</td>
                        <td className="avg c">{t.avgDisplay}</td>
                        <td className="sba-cell">
                          <input className="sba" value={s.sba} onChange={(e) => updateStudent(s.id, { sba: e.target.value })} />
                        </td>
                        <td className="remarks-cell">
                          <input className="remarks" value={s.remarks} onChange={(e) => updateStudent(s.id, { remarks: e.target.value })} />
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
            Enter marks (0–{MARK_MAX}); Total / Average calculate automatically.
            Headers show working days (Mon–Fri) as day-of-month for the selected month. Set Subject / Topic on Summary.
            Students come from the Students module for this class.
          </p>
        </div>
      )}

      {tab === "summary" && (
        <div className="panel active panel-summary">
          <div className="table-scroll">
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
                  const sum = daySummary(sheet.students, sheet.dayMeta, i);
                  return (
                    <tr key={i}>
                      <td className="c">{i + 1}</td>
                      <td className="date-cell">
                        <input
                          className="day-date"
                          type="date"
                          value={d.date || ""}
                          onChange={(e) => updateDayMeta(i, { date: e.target.value })}
                        />
                      </td>
                      <td className="subject-cell">
                        <select
                          className="day-subject"
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
                        </select>
                      </td>
                      <td className="topic-cell">
                        <input
                          className="day-topic"
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
            Enter the date, choose subject from the list, and type the topic for each working day.
            Present / Absent / Average update from marks on Student Record.
          </p>
        </div>
      )}

      {tab === "report" && (
        <div className="panel active panel-report">
          <div className="report-toolbar no-print">
            <button className="btn primary" type="button" onClick={printReport}>
              Print / Save as PDF
            </button>
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
              </div>
            </div>

            <div className="report-legend">
              {PERFORMANCE_BANDS.map((b) => (
                <span key={b.id} className={`chip ${b.id}`}>{b.label} {b.range}</span>
              ))}
            </div>

            <div className="report-section">
              <h3 className="report-section-title">
                Overall
                <span>All tests this month</span>
              </h3>
              <BandTable bands={report.overall} />
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
                  <BandTable bands={block.bands} />
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
    <div className="daily-register psms-page">
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
    </div>
  );
}
