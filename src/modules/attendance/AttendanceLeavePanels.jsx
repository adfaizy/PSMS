import React, { useEffect, useMemo, useState } from "react";
import { Btn, Sel, Inp } from "@/components/AppControls";
import { C } from "@/shared/theme";
import * as H from "@/shared/helpers";
import {
  loadAttendanceFromLocal,
  hydrateAttendanceFromCloud,
} from "./attendanceCore";
import {
  STUDENT_LEAVE_TYPES,
  LEAVE_STATUS,
  LEAVE_STATUS_LABELS,
  addStudentLeaveRecord,
  updateStudentLeaveStatus,
  removeStudentLeaveRecord,
  listAllStudentLeaves,
  listAllStaffLeaves,
  summarizeTodayAttendanceLeave,
  buildAbsenteeList,
  computeMonthlyStudentRates,
} from "./attendanceLeaveCore.js";
import { searchStudents } from "@/modules/students/studentsCore.js";

const { formatClassDisplay, resolveClass } = H;

const panel = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
};

export function AttendanceOverviewPanel({
  settings,
  students,
  staffProfiles,
  activeSchoolId,
  onGoTab,
  canManageStaff = true,
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const summary = useMemo(
    () =>
      summarizeTodayAttendanceLeave({
        activeSchoolId,
        classes: settings?.classes,
        students,
        staffProfiles,
        date,
      }),
    [activeSchoolId, settings?.classes, students, staffProfiles, date],
  );

  const cards = [
    {
      label: "Students present",
      value: `${summary.students.present}/${summary.students.total}`,
      hint: `${summary.students.attendanceRate}% · ${summary.students.unmarked} unmarked`,
      tab: "students",
      accent: "#15803d",
    },
    {
      label: "Students absent / late",
      value: `${summary.students.absent} / ${summary.students.late}`,
      hint: "Needs follow-up",
      tab: "reports",
      accent: "#b91c1c",
    },
    ...(canManageStaff
      ? [
          {
            label: "Staff present",
            value: `${summary.staff.present}/${summary.staff.total}`,
            hint: `${summary.staff.unmarked} unmarked`,
            tab: "staff",
            accent: "#0f766e",
          },
        ]
      : []),
    {
      label: "Pending leave",
      value: summary.leave.pendingStudent + (canManageStaff ? summary.leave.pendingStaff : 0),
      hint: canManageStaff
        ? `${summary.leave.pendingStudent} student · ${summary.leave.pendingStaff} staff`
        : `${summary.leave.pendingStudent} student`,
      tab: "studentLeave",
      accent: "#b45309",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...panel, padding: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>Attendance & Leave Overview</div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.gray }}>Daily snapshot for students and staff.</p>
        </div>
        <Inp label="Date" type="date" value={date} onChange={setDate} width={160} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => onGoTab?.(c.tab)}
            style={{ ...panel, padding: 14, textAlign: "left", cursor: "pointer", borderTop: `3px solid ${c.accent}` }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: c.accent }}>{c.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{c.label}</div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{c.hint}</div>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Btn small onClick={() => onGoTab?.("students")}>Mark Student Attendance</Btn>
        {canManageStaff ? (
          <Btn small outline onClick={() => onGoTab?.("staff")}>Mark Staff Attendance</Btn>
        ) : null}
        <Btn small outline onClick={() => onGoTab?.("studentLeave")}>Student Leave</Btn>
        {canManageStaff ? (
          <Btn small outline onClick={() => onGoTab?.("staffLeave")}>Staff Leave</Btn>
        ) : null}
        <Btn small outline onClick={() => onGoTab?.("reports")}>Reports</Btn>
      </div>
    </div>
  );
}

function StudentPicker({ settings, students, value, onChange }) {
  const [classId, setClassId] = useState("all");
  const [query, setQuery] = useState("");
  const options = useMemo(
    () => searchStudents({ students, classes: settings.classes, query, classId, statusMode: "active" }),
    [students, settings.classes, query, classId],
  );
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 14 }}>
      <Sel
        label="Class"
        value={classId}
        onChange={setClassId}
        options={[{ value: "all", label: "All classes" }, ...(settings.classes || []).map((c) => ({ value: c.id, label: formatClassDisplay(c) }))]}
        width={160}
      />
      <Inp label="Search" value={query} onChange={setQuery} placeholder="Name, admission…" width={200} />
      <Sel
        label="Student"
        value={value || ""}
        onChange={onChange}
        options={[
          { value: "", label: "Select student…" },
          ...options.map((s) => ({
            value: s.id,
            label: `${s.name || "Student"} · Roll ${s.rollNo || "—"} · ${formatClassDisplay(resolveClass(settings.classes, s.classId)) || "—"}`,
          })),
        ]}
        width={300}
      />
    </div>
  );
}

export function StudentLeavePanel({ settings, students, setStudents }) {
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState(STUDENT_LEAVE_TYPES[0]);
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const student = students.find((s) => s.id === studentId) || null;
  const records = Array.isArray(student?.leaveRecords) ? student.leaveRecords : [];
  const allLeaves = useMemo(() => listAllStudentLeaves(students), [students]);

  const patch = (updater) => {
    if (!student) return;
    setStudents((prev) => prev.map((st) => (st.id === student.id ? updater(st) : st)));
  };

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ fontWeight: 700, color: C.navy, fontSize: 15, marginBottom: 4 }}>Student Leave</div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: C.gray }}>
        Record leave applications and approve or reject them. Approved leave helps explain absences.
      </p>
      <StudentPicker settings={settings} students={students} value={studentId} onChange={setStudentId} />
      {student && (
        <>
          <div className="psms-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <Sel label="Leave type" value={type} onChange={setType} options={STUDENT_LEAVE_TYPES.map((t) => ({ value: t, label: t }))} width="100%" />
            <Inp label="Reason" value={reason} onChange={setReason} placeholder="Optional" width="100%" />
            <Inp label="From" type="date" value={fromDate} onChange={setFromDate} width="100%" />
            <Inp label="To" type="date" value={toDate} onChange={setToDate} width="100%" />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <Btn
              onClick={() => {
                if (!fromDate) {
                  alert("Please select a from date.");
                  return;
                }
                patch((st) => addStudentLeaveRecord(st, { type, fromDate, toDate, reason, status: LEAVE_STATUS.PENDING }));
                setReason("");
              }}
            >
              Submit Leave
            </Btn>
          </div>
          {records.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Leaves for {student.name}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {records.map((r) => (
                  <li key={r.id} style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{r.type} · {LEAVE_STATUS_LABELS[r.status] || r.status}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        {r.fromDate} → {r.toDate || r.fromDate}{r.reason ? ` · ${r.reason}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {r.status === LEAVE_STATUS.PENDING && (
                        <>
                          <Btn small onClick={() => patch((st) => updateStudentLeaveStatus(st, r.id, LEAVE_STATUS.APPROVED))}>Approve</Btn>
                          <Btn small outline onClick={() => patch((st) => updateStudentLeaveStatus(st, r.id, LEAVE_STATUS.REJECTED))}>Reject</Btn>
                        </>
                      )}
                      <Btn small danger onClick={() => patch((st) => removeStudentLeaveRecord(st, r.id))}>Remove</Btn>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Recent student leave</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#0f172a", color: "#fff" }}>
              {["Student", "Class", "Type", "Dates", "Status"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allLeaves.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: C.gray }}>No student leave records yet.</td></tr>
            ) : (
              allLeaves.slice(0, 40).map((r, i) => (
                <tr key={`${r.studentId}_${r.id}`} style={{ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{r.studentName}</td>
                  <td style={{ padding: "8px 10px" }}>{formatClassDisplay(resolveClass(settings.classes, r.classId)) || "—"}</td>
                  <td style={{ padding: "8px 10px" }}>{r.type}</td>
                  <td style={{ padding: "8px 10px" }}>{r.fromDate} → {r.toDate || r.fromDate}</td>
                  <td style={{ padding: "8px 10px" }}>{LEAVE_STATUS_LABELS[r.status] || r.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AttendanceReportsPanel({ settings, students, staffProfiles, activeSchoolId }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [classId, setClassId] = useState(settings.classes?.[0]?.id || "all");
  const [att, setAtt] = useState(() => loadAttendanceFromLocal(activeSchoolId || ""));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await hydrateAttendanceFromCloud(activeSchoolId || "");
      if (!cancelled) setAtt(data || {});
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSchoolId]);

  const absentees = useMemo(
    () => buildAbsenteeList(att, { classes: settings.classes, students, date }),
    [att, settings.classes, students, date],
  );
  const rates = useMemo(() => {
    const scoped =
      classId === "all"
        ? students
        : students.filter((s) => resolveClass(settings.classes, s.classId)?.id === classId);
    return computeMonthlyStudentRates(att, {
      classId: classId === "all" ? "all" : classId,
      month,
      students: scoped,
    }).sort((a, b) => a.rate - b.rate);
  }, [att, classId, month, students, settings.classes]);
  const staffLeaves = useMemo(() => listAllStaffLeaves(staffProfiles).slice(0, 15), [staffProfiles]);
  const studentLeaves = useMemo(() => listAllStudentLeaves(students).filter((r) => r.status === LEAVE_STATUS.PENDING), [students]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...panel, padding: 16 }}>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 10 }}>Daily absentees & late</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <Inp label="Date" type="date" value={date} onChange={setDate} width={160} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#b91c1c", color: "#fff" }}>
                {["Class", "Roll", "Name", "Status"].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {absentees.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: C.gray }}>No absentees or late marks for this date.</td></tr>
              ) : (
                absentees.map((r, i) => (
                  <tr key={`${r.id}_${i}`} style={{ background: i % 2 ? "#fff" : "#fef2f2", borderBottom: "1px solid #fecaca" }}>
                    <td style={{ padding: "8px 10px" }}>{r.classLabel}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 700 }}>{r.rollNo || "—"}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{r.name}</td>
                    <td style={{ padding: "8px 10px" }}>{r.status === "L" ? "Late" : "Absent"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ ...panel, padding: 16 }}>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 10 }}>Monthly attendance rates</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <Sel
            label="Class"
            value={classId}
            onChange={setClassId}
            options={[
              ...(settings.classes || []).map((c) => ({ value: c.id, label: formatClassDisplay(c) })),
            ]}
            width={180}
          />
          <Inp label="Month" type="month" value={month} onChange={setMonth} width={160} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#1e3a5f", color: "#fff" }}>
                {["Roll", "Name", "Present", "Absent", "Late", "Rate %"].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 16, textAlign: "center", color: C.gray }}>No marked attendance in this month for the class.</td></tr>
              ) : (
                rates.map((r, i) => (
                  <tr key={r.studentId} style={{ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 700 }}>{r.rollNo || "—"}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{r.name}</td>
                    <td style={{ padding: "8px 10px" }}>{r.present}</td>
                    <td style={{ padding: "8px 10px" }}>{r.absent}</td>
                    <td style={{ padding: "8px 10px" }}>{r.late}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 700, color: r.rate < 75 ? "#b91c1c" : "#15803d" }}>{r.rate}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ ...panel, padding: 16 }}>
          <div style={{ fontWeight: 700, color: C.navy, marginBottom: 8 }}>Pending student leave ({studentLeaves.length})</div>
          {studentLeaves.length === 0 ? (
            <div style={{ fontSize: 13, color: C.gray }}>None pending.</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6, fontSize: 12 }}>
              {studentLeaves.slice(0, 10).map((r) => (
                <li key={r.id}><strong>{r.studentName}</strong> · {r.type} · {r.fromDate}</li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ ...panel, padding: 16 }}>
          <div style={{ fontWeight: 700, color: C.navy, marginBottom: 8 }}>Recent staff leave</div>
          {staffLeaves.length === 0 ? (
            <div style={{ fontSize: 13, color: C.gray }}>No staff leave records.</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6, fontSize: 12 }}>
              {staffLeaves.map((r) => (
                <li key={r.id}>
                  <strong>{r.staffName}</strong> · {r.type} · {LEAVE_STATUS_LABELS[r.status] || r.status}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
