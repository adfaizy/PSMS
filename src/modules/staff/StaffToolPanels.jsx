import React, { useEffect, useMemo, useState } from "react";
import { Btn, Sel, Inp } from "@/components/AppControls";
import { C } from "@/shared/theme";
import {
  STAFF_ATTENDANCE_LABELS,
  LEAVE_TYPES,
  LEAVE_STATUS,
  LEAVE_STATUS_LABELS,
  searchStaffProfiles,
  getStaffCategory,
  loadStaffAttendanceFromLocal,
  saveStaffAttendanceToLocal,
  markStaffAttendance,
  markAllStaffAttendance,
  summarizeStaffAttendanceDay,
  addStaffLeaveRecord,
  updateStaffLeaveStatus,
  removeStaffLeaveRecord,
  addStaffDocument,
  removeStaffDocument,
  buildStaffAssignments,
  restoreRetiredStaff,
} from "./staffCore.js";

const panel = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
};

function updateProfile(setSchools, activeSchoolId, staffId, updater) {
  setSchools((prev) =>
    prev.map((s) => {
      if (s.id !== activeSchoolId) return s;
      return {
        ...s,
        staffProfiles: (s.staffProfiles || []).map((p) => (p.id === staffId ? updater(p) : p)),
      };
    }),
  );
}

function StaffPicker({ profiles, value, onChange, category = "all", label = "Staff member" }) {
  const [query, setQuery] = useState("");
  const options = useMemo(
    () => searchStaffProfiles({ profiles, query, category, statusMode: "active" }),
    [profiles, query, category],
  );
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 14 }}>
      <Inp label="Search" value={query} onChange={setQuery} placeholder="Name, CNIC, CPN…" width={200} />
      <Sel
        label={label}
        value={value || ""}
        onChange={onChange}
        options={[
          { value: "", label: "Select staff…" },
          ...options.map((p) => ({
            value: p.id,
            label: `${p.name || "Staff"} · ${p.designation || getStaffCategory(p)}`,
          })),
        ]}
        width={300}
      />
    </div>
  );
}

export function StaffAttendancePanel({ staffProfiles, activeSchoolId }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [att, setAtt] = useState(() => loadStaffAttendanceFromLocal(activeSchoolId));

  useEffect(() => {
    setAtt(loadStaffAttendanceFromLocal(activeSchoolId));
  }, [activeSchoolId]);

  const list = useMemo(
    () => searchStaffProfiles({ profiles: staffProfiles, query, category, statusMode: "active" }),
    [staffProfiles, query, category],
  );
  const summary = summarizeStaffAttendanceDay(
    att,
    date,
    list.map((p) => p.id),
  );

  const persist = (next) => {
    setAtt(next);
    saveStaffAttendanceToLocal(activeSchoolId, next);
  };

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>Staff Attendance</div>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.gray }}>
          Mark daily presence for teaching and non-teaching staff.
        </p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12, alignItems: "flex-end" }}>
        <Inp label="Date" type="date" value={date} onChange={setDate} width={160} />
        <Sel
          label="Category"
          value={category}
          onChange={setCategory}
          options={[
            { value: "all", label: "All staff" },
            { value: "Teaching", label: "Teaching" },
            { value: "Non Teaching", label: "Non Teaching" },
          ]}
          width={160}
        />
        <Inp label="Search" value={query} onChange={setQuery} placeholder="Name…" width={180} />
        <Btn small onClick={() => persist(markAllStaffAttendance(att, date, list.map((p) => p.id), "P"))}>
          Mark all present
        </Btn>
        <Btn small outline onClick={() => persist(markAllStaffAttendance(att, date, list.map((p) => p.id), "A"))}>
          Mark all absent
        </Btn>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, fontSize: 12 }}>
        <span style={{ padding: "6px 10px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
          Present <strong>{summary.present}</strong>
        </span>
        <span style={{ padding: "6px 10px", background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca" }}>
          Absent <strong>{summary.absent}</strong>
        </span>
        <span style={{ padding: "6px 10px", background: "#fffbeb", borderRadius: 8, border: "1px solid #fde68a" }}>
          Leave <strong>{summary.leave}</strong>
        </span>
        <span style={{ padding: "6px 10px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          Unmarked <strong>{summary.unmarked}</strong>
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#0f766e", color: "#fff" }}>
              {["Name", "Category", "Designation", "Status"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 16, textAlign: "center", color: C.gray }}>No staff match this filter.</td>
              </tr>
            ) : (
              list.map((p, i) => {
                const status = att?.[date]?.[p.id] || "";
                return (
                  <tr key={p.id} style={{ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{p.name || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>{getStaffCategory(p)}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{p.designation || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <select
                        value={status}
                        onChange={(e) => persist(markStaffAttendance(att, date, p.id, e.target.value || null))}
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", minWidth: 120 }}
                      >
                        <option value="">Unmarked</option>
                        {Object.entries(STAFF_ATTENDANCE_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>{label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StaffLeavePanel({ staffProfiles, setSchools, activeSchoolId }) {
  const [staffId, setStaffId] = useState("");
  const [type, setType] = useState(LEAVE_TYPES[0]);
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const profile = staffProfiles.find((p) => p.id === staffId) || null;
  const records = Array.isArray(profile?.leaveRecords) ? profile.leaveRecords : [];

  const allLeaves = useMemo(() => {
    const rows = [];
    (staffProfiles || []).forEach((p) => {
      (Array.isArray(p.leaveRecords) ? p.leaveRecords : []).forEach((r) => {
        rows.push({ ...r, staffId: p.id, staffName: p.name || "Staff" });
      });
    });
    return rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }, [staffProfiles]);

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ fontWeight: 700, color: C.navy, fontSize: 15, marginBottom: 4 }}>Leave Management</div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: C.gray }}>Record leave applications and approve or reject them.</p>
      <StaffPicker profiles={staffProfiles} value={staffId} onChange={setStaffId} />
      {profile && (
        <>
          <div className="psms-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <Sel label="Leave type" value={type} onChange={setType} options={LEAVE_TYPES.map((t) => ({ value: t, label: t }))} width="100%" />
            <Inp label="Reason" value={reason} onChange={setReason} placeholder="Optional reason" width="100%" />
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
                updateProfile(setSchools, activeSchoolId, profile.id, (p) =>
                  addStaffLeaveRecord(p, { type, fromDate, toDate, reason, status: LEAVE_STATUS.PENDING }),
                );
                setReason("");
              }}
            >
              Submit Leave
            </Btn>
          </div>
          {records.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Leaves for {profile.name}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {records.map((r) => (
                  <li key={r.id} style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{r.type} · {LEAVE_STATUS_LABELS[r.status] || r.status}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{r.fromDate} → {r.toDate || r.fromDate}{r.reason ? ` · ${r.reason}` : ""}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {r.status === LEAVE_STATUS.PENDING && (
                        <>
                          <Btn small onClick={() => updateProfile(setSchools, activeSchoolId, profile.id, (p) => updateStaffLeaveStatus(p, r.id, LEAVE_STATUS.APPROVED))}>Approve</Btn>
                          <Btn small outline onClick={() => updateProfile(setSchools, activeSchoolId, profile.id, (p) => updateStaffLeaveStatus(p, r.id, LEAVE_STATUS.REJECTED))}>Reject</Btn>
                        </>
                      )}
                      <Btn small danger onClick={() => updateProfile(setSchools, activeSchoolId, profile.id, (p) => removeStaffLeaveRecord(p, r.id))}>Remove</Btn>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Recent leave across staff</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#0f172a", color: "#fff" }}>
              {["Staff", "Type", "Dates", "Status"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allLeaves.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: C.gray }}>No leave records yet.</td></tr>
            ) : (
              allLeaves.slice(0, 40).map((r, i) => (
                <tr key={`${r.staffId}_${r.id}`} style={{ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{r.staffName}</td>
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

export function StaffAssignmentsPanel({ staffProfiles, settings }) {
  const data = useMemo(
    () => buildStaffAssignments(staffProfiles, settings?.commonTeachers),
    [staffProfiles, settings?.commonTeachers],
  );

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ fontWeight: 700, color: C.navy, fontSize: 15, marginBottom: 4 }}>Teaching Assignments</div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: C.gray }}>
        Subjects from staff profiles and shared common-teacher mappings (configured in Settings).
      </p>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Teachers (from profiles)</div>
      <div style={{ overflowX: "auto", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#1B5E20", color: "#fff" }}>
              {["Name", "Subject", "Designation", "CPN"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.profileRows.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: C.gray }}>No teaching staff profiles yet.</td></tr>
            ) : (
              data.profileRows.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{r.name}</td>
                  <td style={{ padding: "8px 10px" }}>{r.subject}</td>
                  <td style={{ padding: "8px 10px", color: "#64748b" }}>{r.designation}</td>
                  <td style={{ padding: "8px 10px" }}>{r.cpn}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Common teachers by grade</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#0f766e", color: "#fff" }}>
              {["Grade", "Subject", "Teacher"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.commonRows.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: 16, textAlign: "center", color: C.gray }}>No common-teacher mappings. Add them under Settings → Common Teachers.</td></tr>
            ) : (
              data.commonRows.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{r.grade}</td>
                  <td style={{ padding: "8px 10px" }}>{r.subject}</td>
                  <td style={{ padding: "8px 10px" }}>{r.teacherName}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StaffTransfersPanel({ staffTransferHistory = [], schools = [], activeSchoolId }) {
  const schoolName = (id) => {
    const hit = (schools || []).find((s) => s.id === id);
    return hit?.name || hit?.settings?.schoolName || id || "—";
  };
  const list = Array.isArray(staffTransferHistory) ? [...staffTransferHistory].reverse() : [];

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ fontWeight: 700, color: C.navy, fontSize: 15, marginBottom: 4 }}>Transfer History</div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: C.gray }}>
        School-to-school moves and retirements. Start a transfer from the Directory tab on a staff row.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#0f172a", color: "#fff" }}>
              {["Date", "Staff", "Type", "From", "To"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: C.gray }}>No transfers recorded for this school.</td></tr>
            ) : (
              list.map((t, i) => (
                <tr key={t.id || i} style={{ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "8px 10px" }}>{t.transferDate || "—"}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{t.staffSnapshot?.name || t.staffId || "—"}</td>
                  <td style={{ padding: "8px 10px" }}>{t.transferType || "—"}</td>
                  <td style={{ padding: "8px 10px" }}>{schoolName(t.fromSchoolId || activeSchoolId)}</td>
                  <td style={{ padding: "8px 10px" }}>{t.toSchoolId ? schoolName(t.toSchoolId) : t.transferType === "Retired" ? "Retired" : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StaffRetiredPanel({ retiredStaff = [], staffProfiles, setSchools, activeSchoolId }) {
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = Array.isArray(retiredStaff) ? retiredStaff : [];
    if (!q) return rows;
    return rows.filter((p) =>
      [p.name, p.fname, p.cpn, p.designation, p.cnic]
        .map((v) => String(v || "").toLowerCase())
        .join(" ")
        .includes(q),
    );
  }, [retiredStaff, query]);

  const restore = (id) => {
    if (!confirm("Restore this staff member to the active directory?")) return;
    setSchools((prev) =>
      prev.map((s) => {
        if (s.id !== activeSchoolId) return s;
        const next = restoreRetiredStaff(s.retiredStaff, s.staffProfiles, id);
        return { ...s, ...next };
      }),
    );
  };

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>Retired Staff</div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.gray }}>{list.length} record(s) · Active directory: {(staffProfiles || []).length}</p>
        </div>
        <Inp label="Search" value={query} onChange={setQuery} placeholder="Name or CPN…" width={200} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#334155", color: "#fff" }}>
              {["Name", "Designation", "CPN", "Retired", "Actions"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: C.gray }}>No retired staff records.</td></tr>
            ) : (
              list.map((p, i) => (
                <tr key={p.id || i} style={{ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{p.name || "—"}</td>
                  <td style={{ padding: "8px 10px" }}>{p.designation || "—"}</td>
                  <td style={{ padding: "8px 10px" }}>{p.cpn || "—"}</td>
                  <td style={{ padding: "8px 10px", color: "#64748b" }}>{p.retiredDate || (p.retiredAt ? String(p.retiredAt).slice(0, 10) : "—")}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <Btn small outline onClick={() => restore(p.id)}>Restore Active</Btn>
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

export function StaffDocumentsPanel({ staffProfiles, setSchools, activeSchoolId }) {
  const [staffId, setStaffId] = useState("");
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("Appointment Letter");
  const profile = staffProfiles.find((p) => p.id === staffId) || null;
  const docs = Array.isArray(profile?.documents) ? profile.documents : [];

  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !profile) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      updateProfile(setSchools, activeSchoolId, profile.id, (p) =>
        addStaffDocument(p, { name: docName || f.name, docType, dataUrl, mime: f.type || "" }),
      );
      setDocName("");
    };
    reader.readAsDataURL(f);
  };

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ fontWeight: 700, color: C.navy, fontSize: 15, marginBottom: 4 }}>Staff Documents</div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: C.gray }}>Attach appointment letters, CNIC copies, and service records.</p>
      <StaffPicker profiles={staffProfiles} value={staffId} onChange={setStaffId} />
      {profile && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 14 }}>
            <Inp label="Document name" value={docName} onChange={setDocName} placeholder="e.g. CNIC copy" width={200} />
            <Sel
              label="Type"
              value={docType}
              onChange={setDocType}
              options={["Appointment Letter", "CNIC", "Degree", "Service Book", "Other"].map((t) => ({ value: t, label: t }))}
              width={180}
            />
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Upload file</span>
              <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={onFile} style={{ fontSize: 12 }} />
            </label>
          </div>
          {docs.length === 0 ? (
            <div style={{ padding: 16, color: C.gray, fontSize: 13, textAlign: "center", border: "1px dashed #cbd5e1", borderRadius: 8 }}>No documents attached yet.</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {docs.map((d) => (
                <li key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: C.gray }}>{d.docType} · {d.uploadedAt ? new Date(d.uploadedAt).toLocaleString() : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {d.dataUrl ? (
                      <a href={d.dataUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Open</a>
                    ) : null}
                    <Btn small danger onClick={() => updateProfile(setSchools, activeSchoolId, profile.id, (p) => removeStaffDocument(p, d.id))}>Remove</Btn>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
