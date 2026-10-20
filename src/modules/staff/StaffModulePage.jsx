import React, { useEffect, useState } from "react";
import { consumeNavIntent } from "@/lib/navIntent.js";
import { StaffProfilesPage } from "@/modules/staffProfiles/StaffProfilesPage";
import {
  StaffAttendancePanel,
  StaffLeavePanel,
  StaffAssignmentsPanel,
  StaffTransfersPanel,
  StaffRetiredPanel,
  StaffDocumentsPanel,
} from "./StaffToolPanels.jsx";
import { STAFF_TABS, summarizeStaffDirectory } from "./staffCore.js";
import { ModulePageShell } from "@/components/ModulePageShell";

function initialStaffTab() {
  const intent = consumeNavIntent();
  if (!intent || (intent.page && intent.page !== "staff")) return "directory";
  const allowed = new Set(STAFF_TABS.map((t) => t.id));
  const alias = intent.tab === "staffProfiles" ? "directory" : intent.tab;
  if (alias && allowed.has(alias)) return alias;
  return "directory";
}

export function StaffModulePage({
  settings,
  schools,
  setSchools,
  staffProfiles,
  staffTransferHistory = [],
  retiredStaff = [],
  activeSchoolId,
  currentSession,
  setBarSubtitle,
}) {
  const [tab, setTab] = useState(initialStaffTab);
  const summary = summarizeStaffDirectory(staffProfiles, retiredStaff);

  useEffect(() => {
    if (!setBarSubtitle) return;
    const t = STAFF_TABS.find((x) => x.id === tab);
    setBarSubtitle(t?.l || "Staff Management");
    return () => setBarSubtitle?.("");
  }, [tab, setBarSubtitle]);

  return (
    <ModulePageShell
      title="Teacher & Staff Management"
      description={`${summary.teaching} teaching · ${summary.nonTeaching} non-teaching · ${summary.retired} retired${summary.onLeave ? ` · ${summary.onLeave} on leave` : ""}`}
      tabs={STAFF_TABS}
      tab={tab}
      onTabChange={setTab}
    >
      {tab === "directory" && (
        <StaffProfilesPage
          settings={settings}
          schools={schools || []}
          staffProfiles={staffProfiles || []}
          setSchools={setSchools}
          activeSchoolId={activeSchoolId}
          currentSession={currentSession}
        />
      )}

      {tab === "attendance" && (
        <StaffAttendancePanel staffProfiles={staffProfiles || []} activeSchoolId={activeSchoolId} />
      )}

      {tab === "leave" && (
        <StaffLeavePanel
          staffProfiles={staffProfiles || []}
          setSchools={setSchools}
          activeSchoolId={activeSchoolId}
        />
      )}

      {tab === "assignments" && (
        <StaffAssignmentsPanel staffProfiles={staffProfiles || []} settings={settings} />
      )}

      {tab === "transfers" && (
        <StaffTransfersPanel
          staffTransferHistory={staffTransferHistory}
          schools={schools}
          activeSchoolId={activeSchoolId}
        />
      )}

      {tab === "retired" && (
        <StaffRetiredPanel
          retiredStaff={retiredStaff}
          staffProfiles={staffProfiles || []}
          setSchools={setSchools}
          activeSchoolId={activeSchoolId}
        />
      )}

      {tab === "documents" && (
        <StaffDocumentsPanel
          staffProfiles={staffProfiles || []}
          setSchools={setSchools}
          activeSchoolId={activeSchoolId}
        />
      )}
    </ModulePageShell>
  );
}
