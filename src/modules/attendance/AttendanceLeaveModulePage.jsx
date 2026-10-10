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
import { C } from "@/shared/theme";

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
    <div
      className="psms-page"
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        className="no-print"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.navy }}>Attendance & Leave</div>
          <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
            Students {snap.students.present}/{snap.students.total} present
            {canManageStaff
              ? ` · Staff ${snap.staff.present}/${snap.staff.total}`
              : ""}
            {" · "}
            {snap.leave.pendingStudent + (canManageStaff ? snap.leave.pendingStaff : 0)} leave pending
          </div>
        </div>
        <div
          style={{
            display: "inline-flex",
            flexWrap: "wrap",
            background: "#ecfdf5",
            borderRadius: 10,
            padding: 4,
            gap: 4,
            border: "1px solid #a7f3d0",
            maxWidth: "100%",
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                border: "none",
                cursor: "pointer",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
                background: tab === t.id ? "#15803d" : "transparent",
                color: tab === t.id ? "#fff" : "#15803d",
                whiteSpace: "nowrap",
              }}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

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
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
            padding: 12,
          }}
        >
          <AttendancePage
            settings={settings}
            students={students}
            currentSession={currentSession}
            activeSchoolId={activeSchoolId}
            setBarSubtitle={null}
          />
        </div>
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
    </div>
  );
}
