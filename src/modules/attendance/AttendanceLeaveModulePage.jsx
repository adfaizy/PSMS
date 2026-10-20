import React, { useEffect, useState } from "react";
import { consumeNavIntent } from "@/lib/navIntent.js";
import { AttendancePage } from "./AttendancePage";
import {
  StaffAttendancePanel,
  StaffLeavePanel,
} from "@/modules/staff/StaffToolPanels.jsx";
import {
  AttendanceOverviewPanel,
  StudentLeavePanel,
  AttendanceReportsPanel,
} from "./AttendanceLeavePanels.jsx";
import { ATTENDANCE_LEAVE_TABS, summarizeTodayAttendanceLeave } from "./attendanceLeaveCore.js";
import { ModulePageShell } from "@/components/ModulePageShell";

function initialAttendanceTab() {
  const intent = consumeNavIntent();
  if (!intent || (intent.page && intent.page !== "attendance")) return "overview";
  const allowed = new Set(ATTENDANCE_LEAVE_TABS.map((t) => t.id));
  const alias =
    intent.tab === "mark" || intent.tab === "register"
      ? "students"
      : intent.tab === "leave"
        ? "studentLeave"
        : intent.tab;
  if (alias && allowed.has(alias)) return alias;
  return "overview";
}

export function AttendanceLeaveModulePage({
  settings,
  students,
  setStudents,
  staffProfiles = [],
  setSchools,
  activeSchoolId,
  currentSession,
  setBarSubtitle,
  canManageStaff = true,
}) {
  const tabs = canManageStaff
    ? ATTENDANCE_LEAVE_TABS
    : ATTENDANCE_LEAVE_TABS.filter((t) => t.id !== "staff" && t.id !== "staffLeave");
  const [tab, setTab] = useState(() => {
    const initial = initialAttendanceTab();
    if (!canManageStaff && (initial === "staff" || initial === "staffLeave")) return "overview";
    return initial;
  });
  const snap = summarizeTodayAttendanceLeave({
    activeSchoolId,
    classes: settings?.classes,
    students,
    staffProfiles,
  });

  useEffect(() => {
    if (!setBarSubtitle) return;
    const t = ATTENDANCE_LEAVE_TABS.find((x) => x.id === tab);
    setBarSubtitle(t?.l || "Attendance & Leave");
    return () => setBarSubtitle?.("");
  }, [tab, setBarSubtitle]);

  return (
    <ModulePageShell
      title="Attendance & Leave"
      description={`Students ${snap.students.present}/${snap.students.total} present${
        canManageStaff ? ` · Staff ${snap.staff.present}/${snap.staff.total}` : ""
      } · ${snap.leave.pendingStudent + (canManageStaff ? snap.leave.pendingStaff : 0)} leave pending`}
      tabs={tabs}
      tab={tab}
      onTabChange={setTab}
    >
      {tab === "overview" && (
        <AttendanceOverviewPanel
          settings={settings}
          students={students}
          staffProfiles={staffProfiles}
          activeSchoolId={activeSchoolId}
          onGoTab={setTab}
          canManageStaff={canManageStaff}
        />
      )}

      {tab === "students" && (
        <AttendancePage
          settings={settings}
          students={students}
          currentSession={currentSession}
          activeSchoolId={activeSchoolId}
          setBarSubtitle={null}
          embedded={true}
        />
      )}

      {tab === "studentLeave" && (
        <StudentLeavePanel settings={settings} students={students} setStudents={setStudents} />
      )}

      {tab === "staff" && (
        <StaffAttendancePanel staffProfiles={staffProfiles} activeSchoolId={activeSchoolId} />
      )}

      {tab === "staffLeave" && (
        <StaffLeavePanel
          staffProfiles={staffProfiles}
          setSchools={setSchools}
          activeSchoolId={activeSchoolId}
        />
      )}

      {tab === "reports" && (
        <AttendanceReportsPanel
          settings={settings}
          students={students}
          staffProfiles={staffProfiles}
          activeSchoolId={activeSchoolId}
        />
      )}
    </ModulePageShell>
  );
}
