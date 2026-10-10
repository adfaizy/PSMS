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
import { C } from "@/shared/theme";

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
          <div style={{ fontWeight: 800, fontSize: 18, color: C.navy }}>Teacher & Staff Management</div>
          <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
            {summary.teaching} teaching · {summary.nonTeaching} non-teaching · {summary.retired} retired
            {summary.onLeave ? ` · ${summary.onLeave} on leave` : ""}
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
          {STAFF_TABS.map((t) => (
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
                background: tab === t.id ? "#0f766e" : "transparent",
                color: tab === t.id ? "#fff" : "#0f766e",
                whiteSpace: "nowrap",
              }}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {tab === "directory" && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
            padding: 12,
          }}
        >
          <StaffProfilesPage
            settings={settings}
            schools={schools || []}
            staffProfiles={staffProfiles || []}
            setSchools={setSchools}
            activeSchoolId={activeSchoolId}
            currentSession={currentSession}
          />
        </div>
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
    </div>
  );
}
