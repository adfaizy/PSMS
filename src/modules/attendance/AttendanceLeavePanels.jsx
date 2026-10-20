import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const { formatClassDisplay, resolveClass } = H;

function FieldWrap({ label, children, className }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

const leaveStatusVariant = (status) => {
  if (status === LEAVE_STATUS.APPROVED) return "default";
  if (status === LEAVE_STATUS.REJECTED) return "destructive";
  return "secondary";
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
    <div className="flex flex-col gap-3.5">
      <Card size="sm" className="shadow-none">
        <CardContent className="flex flex-wrap gap-3 items-end justify-between py-3">
          <div>
            <div className="font-bold text-foreground text-[15px]">Attendance &amp; Leave Overview</div>
            <p className="text-sm text-muted-foreground mt-0.5">Daily snapshot for students and staff.</p>
          </div>
          <FieldWrap label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
          </FieldWrap>
        </CardContent>
      </Card>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => onGoTab?.(c.tab)}
            className="text-left cursor-pointer rounded-xl bg-card p-3.5 ring-1 ring-foreground/10 hover:bg-muted/30 transition-colors"
            style={{ borderTop: `3px solid ${c.accent}` }}
          >
            <div className="text-2xl font-extrabold" style={{ color: c.accent }}>{c.value}</div>
            <div className="text-xs font-bold mt-1">{c.label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{c.hint}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onGoTab?.("students")}>Mark Student Attendance</Button>
        {canManageStaff ? (
          <Button size="sm" variant="outline" onClick={() => onGoTab?.("staff")}>Mark Staff Attendance</Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => onGoTab?.("studentLeave")}>Student Leave</Button>
        {canManageStaff ? (
          <Button size="sm" variant="outline" onClick={() => onGoTab?.("staffLeave")}>Staff Leave</Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => onGoTab?.("reports")}>Reports</Button>
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
    <div className="flex flex-wrap gap-2.5 items-end mb-3.5">
      <FieldWrap label="Class">
        <NativeSelect value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 160 }}>
          <NativeSelectOption value="all">All classes</NativeSelectOption>
          {(settings.classes || []).map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>{formatClassDisplay(c)}</NativeSelectOption>
          ))}
        </NativeSelect>
      </FieldWrap>
      <FieldWrap label="Search">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, admission…" style={{ width: 200 }} />
      </FieldWrap>
      <FieldWrap label="Student">
        <NativeSelect value={value || ""} onChange={(e) => onChange(e.target.value)} style={{ width: 300 }}>
          <NativeSelectOption value="">Select student…</NativeSelectOption>
          {options.map((s) => (
            <NativeSelectOption key={s.id} value={s.id}>
              {`${s.name || "Student"} · Roll ${s.rollNo || "—"} · ${formatClassDisplay(resolveClass(settings.classes, s.classId)) || "—"}`}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FieldWrap>
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
    <Card size="sm" className="shadow-none">
      <CardHeader>
        <CardTitle>Student Leave</CardTitle>
        <CardDescription>Record leave applications and approve or reject them. Approved leave helps explain absences.</CardDescription>
      </CardHeader>
      <CardContent>
        <StudentPicker settings={settings} students={students} value={studentId} onChange={setStudentId} />
        {student && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
              <FieldWrap label="Leave type">
                <NativeSelect value={type} onChange={(e) => setType(e.target.value)} className="w-full">
                  {STUDENT_LEAVE_TYPES.map((t) => (
                    <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </FieldWrap>
              <FieldWrap label="Reason">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" className="w-full" />
              </FieldWrap>
              <FieldWrap label="From">
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full" />
              </FieldWrap>
              <FieldWrap label="To">
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full" />
              </FieldWrap>
            </div>
            <div className="flex justify-end mb-4">
              <Button
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
              </Button>
            </div>
            {records.length > 0 && (
              <div className="mb-4">
                <div className="font-bold text-sm mb-2">Leaves for {student.name}</div>
                <ul className="m-0 p-0 list-none grid gap-2">
                  {records.map((r) => (
                    <li key={r.id} className="p-3 border rounded-lg flex justify-between gap-2.5">
                      <div>
                        <div className="font-bold text-sm flex items-center gap-2">
                          {r.type}
                          <Badge variant={leaveStatusVariant(r.status)}>{LEAVE_STATUS_LABELS[r.status] || r.status}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {r.fromDate} → {r.toDate || r.fromDate}{r.reason ? ` · ${r.reason}` : ""}
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {r.status === LEAVE_STATUS.PENDING && (
                          <>
                            <Button size="xs" onClick={() => patch((st) => updateStudentLeaveStatus(st, r.id, LEAVE_STATUS.APPROVED))}>Approve</Button>
                            <Button size="xs" variant="outline" onClick={() => patch((st) => updateStudentLeaveStatus(st, r.id, LEAVE_STATUS.REJECTED))}>Reject</Button>
                          </>
                        )}
                        <Button size="xs" variant="destructive" onClick={() => patch((st) => removeStudentLeaveRecord(st, r.id))}>Remove</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        <div className="font-bold text-sm mb-2">Recent student leave</div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {["Student", "Class", "Type", "Dates", "Status"].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {allLeaves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-4 text-center text-muted-foreground">No student leave records yet.</TableCell>
              </TableRow>
            ) : (
              allLeaves.slice(0, 40).map((r) => (
                <TableRow key={`${r.studentId}_${r.id}`}>
                  <TableCell className="font-semibold">{r.studentName}</TableCell>
                  <TableCell>{formatClassDisplay(resolveClass(settings.classes, r.classId)) || "—"}</TableCell>
                  <TableCell>{r.type}</TableCell>
                  <TableCell>{r.fromDate} → {r.toDate || r.fromDate}</TableCell>
                  <TableCell>
                    <Badge variant={leaveStatusVariant(r.status)}>{LEAVE_STATUS_LABELS[r.status] || r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
    <div className="flex flex-col gap-3.5">
      {/* Daily absentees */}
      <Card size="sm" className="shadow-none">
        <CardHeader>
          <CardTitle>Daily absentees &amp; late</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2.5 mb-3">
            <FieldWrap label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
            </FieldWrap>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {["Class", "Roll", "Name", "Status"].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {absentees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-4 text-center text-muted-foreground">No absentees or late marks for this date.</TableCell>
                </TableRow>
              ) : (
                absentees.map((r, i) => (
                  <TableRow key={`${r.id}_${i}`}>
                    <TableCell>{r.classLabel}</TableCell>
                    <TableCell className="font-bold">{r.rollNo || "—"}</TableCell>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "L" ? "secondary" : "destructive"}>{r.status === "L" ? "Late" : "Absent"}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Monthly rates */}
      <Card size="sm" className="shadow-none">
        <CardHeader>
          <CardTitle>Monthly attendance rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2.5 mb-3">
            <FieldWrap label="Class">
              <NativeSelect value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 180 }}>
                {(settings.classes || []).map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>{formatClassDisplay(c)}</NativeSelectOption>
                ))}
              </NativeSelect>
            </FieldWrap>
            <FieldWrap label="Month">
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 160 }} />
            </FieldWrap>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {["Roll", "Name", "Present", "Absent", "Late", "Rate %"].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-4 text-center text-muted-foreground">No marked attendance in this month for the class.</TableCell>
                </TableRow>
              ) : (
                rates.map((r) => (
                  <TableRow key={r.studentId}>
                    <TableCell className="font-bold">{r.rollNo || "—"}</TableCell>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell>{r.present}</TableCell>
                    <TableCell>{r.absent}</TableCell>
                    <TableCell>{r.late}</TableCell>
                    <TableCell className={cn("font-bold", r.rate < 75 ? "text-destructive" : "text-green-700")}>{r.rate}%</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Leave summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Card size="sm" className="shadow-none">
          <CardHeader>
            <CardTitle>Pending student leave ({studentLeaves.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {studentLeaves.length === 0 ? (
              <div className="text-sm text-muted-foreground">None pending.</div>
            ) : (
              <ul className="m-0 p-0 list-none grid gap-1.5 text-sm">
                {studentLeaves.slice(0, 10).map((r) => (
                  <li key={r.id}><strong>{r.studentName}</strong> · {r.type} · {r.fromDate}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card size="sm" className="shadow-none">
          <CardHeader>
            <CardTitle>Recent staff leave</CardTitle>
          </CardHeader>
          <CardContent>
            {staffLeaves.length === 0 ? (
              <div className="text-sm text-muted-foreground">No staff leave records.</div>
            ) : (
              <ul className="m-0 p-0 list-none grid gap-1.5 text-sm">
                {staffLeaves.map((r) => (
                  <li key={r.id}>
                    <strong>{r.staffName}</strong> · {r.type} ·{" "}
                    <Badge variant={leaveStatusVariant(r.status)} className="text-[10px]">{LEAVE_STATUS_LABELS[r.status] || r.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
