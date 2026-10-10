import React, { useMemo, useState } from "react";
import { Btn, Sel, Inp } from "@/components/AppControls";
import { ClassSubjCard, CommonTeachersEditor } from "@/modules/settings/SettingsPage";
import { setNavIntent } from "@/lib/navIntent.js";
import { C } from "@/shared/theme";
import {
  summarizeAcademicStructure,
  buildClassSubjectMatrix,
  addAcademicClass,
  removeAcademicClass,
  addClassSubject,
  removeClassSubject,
  normalizeSessionList,
  validateSessionLabel,
  addCalendarEvent,
  removeCalendarEvent,
  upcomingCalendarEvents,
  addSchemeUnit,
  removeSchemeUnit,
  getSchemeUnits,
  CALENDAR_EVENT_TYPES,
  formatClassDisplay,
} from "./academicCore.js";

const panel = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
};

function navigate(onNavigate, page, tab) {
  if (tab) setNavIntent({ page, tab });
  onNavigate?.(page);
}

export function AcademicOverviewPanel({
  settings,
  sessions,
  currentSession,
  students = [],
  exam_datesheet,
  onNavigate,
  onGoTab,
}) {
  const summary = summarizeAcademicStructure(settings, sessions, currentSession);
  const upcoming = upcomingCalendarEvents(settings?.academicCalendar);
  const datesheetCount = Array.isArray(exam_datesheet?.dates) ? exam_datesheet.dates.length : 0;
  const enrolled = Array.isArray(students) ? students.length : 0;

  const cards = [
    { label: "Classes", value: summary.classCount, hint: `${summary.gradeCount} grades`, tab: "classes" },
    { label: "Subjects", value: summary.uniqueSubjects, hint: `${summary.examSubjectSlots} exam slots`, tab: "subjects" },
    { label: "Session", value: summary.currentSession, hint: `${summary.sessionCount} sessions`, tab: "sessions" },
    { label: "Calendar", value: summary.calendarEvents, hint: "Holidays & events", tab: "calendar" },
    { label: "Periods / day", value: summary.periodsPerDay || "—", hint: "Bell schedule", tab: "periods" },
    { label: "Students", value: enrolled, hint: "Active enrollment", page: "students", pageTab: "directory" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => {
              if (c.page) navigate(onNavigate, c.page, c.pageTab);
              else onGoTab?.(c.tab);
            }}
            style={{
              ...panel,
              padding: 14,
              textAlign: "left",
              cursor: "pointer",
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>{c.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{c.label}</div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{c.hint}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", gap: 14 }}>
        <div style={{ ...panel, padding: 16 }}>
          <div style={{ fontWeight: 700, color: C.navy, marginBottom: 8 }}>Related tools</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Btn small outline onClick={() => navigate(onNavigate, "timetable")}>Open Timetable</Btn>
            <Btn small outline onClick={() => navigate(onNavigate, "examination", "datesheet")}>
              Date Sheet ({datesheetCount})
            </Btn>
            <Btn small outline onClick={() => navigate(onNavigate, "examination", "marks")}>Marks Entry</Btn>
            <Btn small outline onClick={() => onGoTab?.("scheme")}>Scheme of Studies</Btn>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: C.gray }}>
            Academic structure drives roll numbers, timetable generation, exams, and ID cards.
          </p>
        </div>
        <div style={{ ...panel, padding: 16 }}>
          <div style={{ fontWeight: 700, color: C.navy, marginBottom: 8 }}>Upcoming calendar</div>
          {upcoming.length === 0 ? (
            <div style={{ fontSize: 13, color: C.gray }}>No upcoming events. Add holidays on the Calendar tab.</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {upcoming.map((e) => (
                <li key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>{e.title}</span>
                  <span style={{ color: C.gray }}>{e.date} · {e.type}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function AcademicClassesPanel({ settings, setSettings }) {
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");

  const addClass = () => {
    const result = addAcademicClass(settings, { grade, section });
    if (result.error) {
      alert(result.error);
      return;
    }
    setSettings(result.settings);
    setGrade("");
    setSection("");
    if (result.newClass) {
      void import("../../lib/photosFolderSync.js")
        .then((m) => m.ensureClassPhotoFolders?.([result.newClass]))
        .catch(() => {});
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...panel, padding: 16 }}>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 4 }}>Classes & Sections</div>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: C.gray }}>
          Add grades/sections and manage examination & timetable subjects for each class.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <Inp label="Grade" value={grade} onChange={setGrade} placeholder="e.g. 5 or Nursery" width={140} />
          <Inp label="Section" value={section} onChange={setSection} placeholder="e.g. A" width={120} />
          <Btn onClick={addClass}>Add Class</Btn>
        </div>
      </div>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {(settings.classes || []).map((cls) => (
          <ClassSubjCard
            key={cls.id}
            cls={cls}
            examSubjects={(settings.classSubjectsExam || settings.classSubjects || {})[cls.id] || []}
            timetableSubjects={(settings.classSubjectsTimetable || settings.classSubjects || {})[cls.id] || []}
            onAddExam={(s) => setSettings((prev) => addClassSubject(prev, cls.id, s, "exam"))}
            onRemoveExam={(s) => setSettings((prev) => removeClassSubject(prev, cls.id, s, "exam"))}
            onAddTimetable={(s) => setSettings((prev) => addClassSubject(prev, cls.id, s, "timetable"))}
            onRemoveTimetable={(s) => setSettings((prev) => removeClassSubject(prev, cls.id, s, "timetable"))}
            onRemoveClass={() => {
              if (!confirm(`Remove ${formatClassDisplay(cls)}?`)) return;
              setSettings((prev) => removeAcademicClass(prev, cls.id));
            }}
          />
        ))}
      </div>
      {(settings.classes || []).length === 0 && (
        <div style={{ ...panel, padding: 24, textAlign: "center", color: C.gray }}>No classes yet. Add the first grade/section above.</div>
      )}
    </div>
  );
}

export function AcademicSubjectsPanel({ settings, setSettings }) {
  const matrix = useMemo(() => buildClassSubjectMatrix(settings), [settings]);
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkTarget, setBulkTarget] = useState("exam");

  const applyBulk = () => {
    const name = bulkSubject.trim();
    if (!name) return;
    if (!confirm(`Add "${name}" to ${bulkTarget} subjects for all classes?`)) return;
    setSettings((prev) => {
      let next = prev;
      ;(prev.classes || []).forEach((c) => {
        next = addClassSubject(next, c.id, name, bulkTarget === "timetable" ? "timetable" : "exam");
      });
      return next;
    });
    setBulkSubject("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...panel, padding: 16 }}>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 4 }}>Subject Matrix</div>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: C.gray }}>
          {matrix.allSubjects.length} unique subjects across {matrix.rows.length} classes.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <Inp label="Add subject to all classes" value={bulkSubject} onChange={setBulkSubject} placeholder="e.g. Mathematics" width={220} />
          <Sel
            label="Apply to"
            value={bulkTarget}
            onChange={setBulkTarget}
            options={[
              { value: "exam", label: "Examination" },
              { value: "timetable", label: "Timetable" },
            ]}
            width={150}
          />
          <Btn onClick={applyBulk}>Apply</Btn>
        </div>
      </div>
      <div style={{ ...panel, padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#1e3a5f", color: "#fff" }}>
                {["Class", "Exam subjects", "Timetable subjects"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: 20, textAlign: "center", color: C.gray }}>No classes configured.</td>
                </tr>
              ) : (
                matrix.rows.map((r, i) => (
                  <tr key={r.classId} style={{ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>{r.label}</td>
                    <td style={{ padding: "10px 12px" }}>{r.exam.join(", ") || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{r.timetable.join(", ") || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <CommonTeachersEditor settings={settings} setSettings={setSettings} />
    </div>
  );
}

export function AcademicSessionsPanel({
  sessions,
  currentSession,
  setCurrentSession,
  addSession,
}) {
  const [newSession, setNewSession] = useState("");
  const list = normalizeSessionList(sessions, currentSession);

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ fontWeight: 700, color: C.navy, fontSize: 15, marginBottom: 4 }}>Academic Sessions</div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: C.gray }}>
        Exam marks and date sheets are stored per session. Switch the active year to view that data.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 16 }}>
        <Sel
          label="Current session"
          value={currentSession || list[0] || ""}
          onChange={(v) => setCurrentSession?.(v)}
          options={list.map((s) => ({ value: s, label: s }))}
          width={180}
        />
        <Inp label="Add session" value={newSession} onChange={setNewSession} placeholder="2025-2026" width={140} />
        <Btn
          onClick={() => {
            const check = validateSessionLabel(newSession);
            if (!check.ok) {
              alert(check.error);
              return;
            }
            addSession?.(check.session);
            setNewSession("");
          }}
        >
          Add Session
        </Btn>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {list.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setCurrentSession?.(s)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: s === currentSession ? "2px solid #1e3a5f" : "1px solid #e2e8f0",
              background: s === currentSession ? "#eff6ff" : "#fff",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              color: C.navy,
            }}
          >
            {s}
            {s === currentSession ? " · Active" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AcademicCalendarPanel({ settings, setSettings }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState("Holiday");
  const [notes, setNotes] = useState("");
  const calendar = Array.isArray(settings?.academicCalendar) ? settings.academicCalendar : [];

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ fontWeight: 700, color: C.navy, fontSize: 15, marginBottom: 4 }}>Academic Calendar</div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: C.gray }}>
        Holidays, school events, and exam windows for planning attendance and date sheets.
      </p>
      <div className="psms-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <Inp label="Title" value={title} onChange={setTitle} placeholder="e.g. Summer vacation" width="100%" />
        <Sel label="Type" value={type} onChange={setType} options={CALENDAR_EVENT_TYPES.map((t) => ({ value: t, label: t }))} width="100%" />
        <Inp label="Start date" type="date" value={date} onChange={setDate} width="100%" />
        <Inp label="End date" type="date" value={endDate} onChange={setEndDate} width="100%" />
        <Inp label="Notes" value={notes} onChange={setNotes} placeholder="Optional" width="100%" />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Btn
          onClick={() => {
            if (!title.trim() || !date) {
              alert("Title and start date are required.");
              return;
            }
            setSettings((prev) => ({
              ...prev,
              academicCalendar: addCalendarEvent(prev.academicCalendar, { title, date, endDate, type, notes }),
            }));
            setTitle("");
            setNotes("");
            setEndDate("");
          }}
        >
          Add Event
        </Btn>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#1e3a5f", color: "#fff" }}>
              {["Date", "Title", "Type", "Notes", ""].map((h) => (
                <th key={h || "a"} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calendar.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 16, textAlign: "center", color: C.gray }}>No calendar entries yet.</td>
              </tr>
            ) : (
              calendar.map((e, i) => (
                <tr key={e.id} style={{ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                    {e.date}{e.endDate && e.endDate !== e.date ? ` → ${e.endDate}` : ""}
                  </td>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{e.title}</td>
                  <td style={{ padding: "8px 10px" }}>{e.type}</td>
                  <td style={{ padding: "8px 10px", color: "#64748b" }}>{e.notes || "—"}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <Btn
                      small
                      danger
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          academicCalendar: removeCalendarEvent(prev.academicCalendar, e.id),
                        }))
                      }
                    >
                      Remove
                    </Btn>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AcademicPeriodsPanel({ settings, setSettings }) {
  const setHour = (key, field, value) => {
    setSettings((s) => ({
      ...s,
      schoolHours: {
        ...(s.schoolHours || {}),
        [key]: { ...(s.schoolHours?.[key] || {}), [field]: value },
      },
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...panel, padding: 16 }}>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 12 }}>School Hours</div>
        {[
          { key: "mondayToThursday", label: "Monday – Thursday" },
          { key: "friday", label: "Friday" },
          { key: "saturday", label: "Saturday" },
        ].map(({ key, label }) => (
          <div key={key} style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr", gap: 10, marginBottom: 10, alignItems: "end" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
            <Inp
              label="Start"
              type="time"
              value={settings.schoolHours?.[key]?.start || ""}
              onChange={(v) => setHour(key, "start", v)}
              width="100%"
            />
            <Inp
              label="End"
              type="time"
              value={settings.schoolHours?.[key]?.end || ""}
              onChange={(v) => setHour(key, "end", v)}
              width="100%"
            />
          </div>
        ))}
      </div>
      <div style={{ ...panel, padding: 16 }}>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 12 }}>Period lengths</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            ["assemblyTime", "Assembly (min)"],
            ["firstPeriodTime", "Period 1 (min)"],
            ["otherPeriodTime", "Other periods (min)"],
            ["periodsPerDay", "Periods per day"],
          ].map(([key, label]) => (
            <Inp
              key={key}
              label={label}
              type="number"
              value={settings[key] ?? ""}
              onChange={(v) => setSettings((s) => ({ ...s, [key]: v === "" ? "" : +v }))}
              width="100%"
            />
          ))}
        </div>
      </div>
      <div style={{ ...panel, padding: 16 }}>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 12 }}>Breaks</div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={!!settings.breakRequired}
            onChange={(e) => setSettings((s) => ({ ...s, breakRequired: e.target.checked }))}
          />
          Break required (Mon–Thu / Sat)
        </label>
        {settings.breakRequired && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <Inp label="After period #" type="number" value={settings.breakAfterPeriod ?? ""} onChange={(v) => setSettings((s) => ({ ...s, breakAfterPeriod: +v }))} width="100%" />
            <Inp label="Duration (min)" type="number" value={settings.breakDuration ?? ""} onChange={(v) => setSettings((s) => ({ ...s, breakDuration: +v }))} width="100%" />
          </div>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={!!settings.fridayBreak}
            onChange={(e) => setSettings((s) => ({ ...s, fridayBreak: e.target.checked }))}
          />
          Friday break required
        </label>
        {settings.fridayBreak && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Inp label="Friday after period #" type="number" value={settings.fridayBreakAfter ?? ""} onChange={(v) => setSettings((s) => ({ ...s, fridayBreakAfter: +v }))} width="100%" />
            <Inp label="Friday duration (min)" type="number" value={settings.fridayBreakDuration ?? ""} onChange={(v) => setSettings((s) => ({ ...s, fridayBreakDuration: +v }))} width="100%" />
          </div>
        )}
      </div>
    </div>
  );
}

export function AcademicSchemePanel({ settings, setSettings }) {
  const classes = settings.classes || [];
  const [classId, setClassId] = useState(classes[0]?.id || "");
  const subjects = (settings.classSubjectsExam || settings.classSubjects || {})[classId] || [];
  const [subject, setSubject] = useState(subjects[0] || "");
  const [unit, setUnit] = useState("");
  const [topics, setTopics] = useState("");
  const [periods, setPeriods] = useState("");
  const units = getSchemeUnits(settings.schemeOfStudies, classId, subject);

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ fontWeight: 700, color: C.navy, fontSize: 15, marginBottom: 4 }}>Scheme of Studies</div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: C.gray }}>
        Outline units and topics for each class subject (foundation for lesson planning).
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <Sel
          label="Class"
          value={classId}
          onChange={(v) => {
            setClassId(v);
            const nextSubs = (settings.classSubjectsExam || settings.classSubjects || {})[v] || [];
            setSubject(nextSubs[0] || "");
          }}
          options={classes.map((c) => ({ value: c.id, label: formatClassDisplay(c) }))}
          width={180}
        />
        <Sel
          label="Subject"
          value={subject}
          onChange={setSubject}
          options={subjects.map((s) => ({ value: s, label: s }))}
          width={180}
        />
      </div>
      {classId && subject ? (
        <>
          <div className="psms-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <Inp label="Unit / chapter" value={unit} onChange={setUnit} placeholder="e.g. Unit 1 — Algebra" width="100%" />
            <Inp label="Periods" type="number" value={periods} onChange={setPeriods} placeholder="e.g. 8" width="100%" />
            <Inp label="Topics" value={topics} onChange={setTopics} placeholder="Short topic list" width="100%" />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <Btn
              onClick={() => {
                if (!unit.trim()) {
                  alert("Enter a unit title.");
                  return;
                }
                setSettings((prev) => ({
                  ...prev,
                  schemeOfStudies: addSchemeUnit(prev.schemeOfStudies, classId, subject, { unit, topics, periods }),
                }));
                setUnit("");
                setTopics("");
                setPeriods("");
              }}
            >
              Add Unit
            </Btn>
          </div>
          {units.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: C.gray, border: "1px dashed #cbd5e1", borderRadius: 8 }}>
              No units for this subject yet.
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {units.map((u) => (
                <li key={u.id} style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{u.unit}</div>
                    {u.topics ? <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{u.topics}</div> : null}
                    {u.periods ? <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{u.periods} periods</div> : null}
                  </div>
                  <Btn
                    small
                    danger
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        schemeOfStudies: removeSchemeUnit(prev.schemeOfStudies, classId, subject, u.id),
                      }))
                    }
                  >
                    Remove
                  </Btn>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div style={{ padding: 16, textAlign: "center", color: C.gray }}>Select a class with exam subjects first.</div>
      )}
    </div>
  );
}
