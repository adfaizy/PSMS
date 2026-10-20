import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
    <div className="flex flex-wrap gap-2.5 items-end mb-3.5">
      <FieldWrap label="Search">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, CNIC, CPN…" style={{ width: 200 }} />
      </FieldWrap>
      <FieldWrap label={label}>
        <NativeSelect value={value || ""} onChange={(e) => onChange(e.target.value)} style={{ width: 300 }}>
          <NativeSelectOption value="">Select staff…</NativeSelectOption>
          {options.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {`${p.name || "Staff"} · ${p.designation || getStaffCategory(p)}`}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FieldWrap>
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
    <Card size="sm" className="shadow-none">
      <CardHeader>
        <CardTitle>Staff Attendance</CardTitle>
        <CardDescription>Mark daily presence for teaching and non-teaching staff.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2.5 mb-3 items-end">
          <FieldWrap label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
          </FieldWrap>
          <FieldWrap label="Category">
            <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 160 }}>
              <NativeSelectOption value="all">All staff</NativeSelectOption>
              <NativeSelectOption value="Teaching">Teaching</NativeSelectOption>
              <NativeSelectOption value="Non Teaching">Non Teaching</NativeSelectOption>
            </NativeSelect>
          </FieldWrap>
          <FieldWrap label="Search">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name…" style={{ width: 180 }} />
          </FieldWrap>
          <Button size="sm" onClick={() => persist(markAllStaffAttendance(att, date, list.map((p) => p.id), "P"))}>
            Mark all present
          </Button>
          <Button size="sm" variant="outline" onClick={() => persist(markAllStaffAttendance(att, date, list.map((p) => p.id), "A"))}>
            Mark all absent
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mb-3.5">
          <Badge variant="secondary" className="bg-green-50 text-green-800 border border-green-200">Present <strong className="ml-1">{summary.present}</strong></Badge>
          <Badge variant="secondary" className="bg-red-50 text-red-800 border border-red-200">Absent <strong className="ml-1">{summary.absent}</strong></Badge>
          <Badge variant="secondary" className="bg-yellow-50 text-yellow-800 border border-yellow-200">Leave <strong className="ml-1">{summary.leave}</strong></Badge>
          <Badge variant="outline">Unmarked <strong className="ml-1">{summary.unmarked}</strong></Badge>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {["Name", "Category", "Designation", "Status"].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-4 text-center text-muted-foreground">No staff match this filter.</TableCell>
              </TableRow>
            ) : (
              list.map((p) => {
                const status = att?.[date]?.[p.id] || "";
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-semibold">{p.name || "—"}</TableCell>
                    <TableCell>{getStaffCategory(p)}</TableCell>
                    <TableCell className="text-muted-foreground">{p.designation || "—"}</TableCell>
                    <TableCell>
                      <NativeSelect
                        value={status}
                        onChange={(e) => persist(markStaffAttendance(att, date, p.id, e.target.value || null))}
                        style={{ minWidth: 120 }}
                      >
                        <NativeSelectOption value="">Unmarked</NativeSelectOption>
                        {Object.entries(STAFF_ATTENDANCE_LABELS).map(([k, label]) => (
                          <NativeSelectOption key={k} value={k}>{label}</NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
    <Card size="sm" className="shadow-none">
      <CardHeader>
        <CardTitle>Leave Management</CardTitle>
        <CardDescription>Record leave applications and approve or reject them.</CardDescription>
      </CardHeader>
      <CardContent>
        <StaffPicker profiles={staffProfiles} value={staffId} onChange={setStaffId} />
        {profile && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
              <FieldWrap label="Leave type">
                <NativeSelect value={type} onChange={(e) => setType(e.target.value)} className="w-full">
                  {LEAVE_TYPES.map((t) => (
                    <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </FieldWrap>
              <FieldWrap label="Reason">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional reason" className="w-full" />
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
                  updateProfile(setSchools, activeSchoolId, profile.id, (p) =>
                    addStaffLeaveRecord(p, { type, fromDate, toDate, reason, status: LEAVE_STATUS.PENDING }),
                  );
                  setReason("");
                }}
              >
                Submit Leave
              </Button>
            </div>
            {records.length > 0 && (
              <div className="mb-4">
                <div className="font-bold text-sm mb-2">Leaves for {profile.name}</div>
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
                            <Button size="xs" onClick={() => updateProfile(setSchools, activeSchoolId, profile.id, (p) => updateStaffLeaveStatus(p, r.id, LEAVE_STATUS.APPROVED))}>Approve</Button>
                            <Button size="xs" variant="outline" onClick={() => updateProfile(setSchools, activeSchoolId, profile.id, (p) => updateStaffLeaveStatus(p, r.id, LEAVE_STATUS.REJECTED))}>Reject</Button>
                          </>
                        )}
                        <Button size="xs" variant="destructive" onClick={() => updateProfile(setSchools, activeSchoolId, profile.id, (p) => removeStaffLeaveRecord(p, r.id))}>Remove</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        <div className="font-bold text-sm mb-2">Recent leave across staff</div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {["Staff", "Type", "Dates", "Status"].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {allLeaves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-4 text-center text-muted-foreground">No leave records yet.</TableCell>
              </TableRow>
            ) : (
              allLeaves.slice(0, 40).map((r) => (
                <TableRow key={`${r.staffId}_${r.id}`}>
                  <TableCell className="font-semibold">{r.staffName}</TableCell>
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

export function StaffAssignmentsPanel({ staffProfiles, settings }) {
  const data = useMemo(
    () => buildStaffAssignments(staffProfiles, settings?.commonTeachers),
    [staffProfiles, settings?.commonTeachers],
  );

  return (
    <Card size="sm" className="shadow-none">
      <CardHeader>
        <CardTitle>Teaching Assignments</CardTitle>
        <CardDescription>Subjects from staff profiles and shared common-teacher mappings (configured in Settings).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div>
          <div className="font-bold text-sm mb-2">Teachers (from profiles)</div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {["Name", "Subject", "Designation", "CPN"].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.profileRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-4 text-center text-muted-foreground">No teaching staff profiles yet.</TableCell>
                </TableRow>
              ) : (
                data.profileRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell>{r.subject}</TableCell>
                    <TableCell className="text-muted-foreground">{r.designation}</TableCell>
                    <TableCell>{r.cpn}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div>
          <div className="font-bold text-sm mb-2">Common teachers by grade</div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {["Grade", "Subject", "Teacher"].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.commonRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-4 text-center text-muted-foreground">No common-teacher mappings. Add them under Settings → Common Teachers.</TableCell>
                </TableRow>
              ) : (
                data.commonRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold">{r.grade}</TableCell>
                    <TableCell>{r.subject}</TableCell>
                    <TableCell>{r.teacherName}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function StaffTransfersPanel({ staffTransferHistory = [], schools = [], activeSchoolId }) {
  const schoolName = (id) => {
    const hit = (schools || []).find((s) => s.id === id);
    return hit?.name || hit?.settings?.schoolName || id || "—";
  };
  const list = Array.isArray(staffTransferHistory) ? [...staffTransferHistory].reverse() : [];

  return (
    <Card size="sm" className="shadow-none">
      <CardHeader>
        <CardTitle>Transfer History</CardTitle>
        <CardDescription>School-to-school moves and retirements. Start a transfer from the Directory tab on a staff row.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {["Date", "Staff", "Type", "From", "To"].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-4 text-center text-muted-foreground">No transfers recorded for this school.</TableCell>
              </TableRow>
            ) : (
              list.map((t, i) => (
                <TableRow key={t.id || i}>
                  <TableCell>{t.transferDate || "—"}</TableCell>
                  <TableCell className="font-semibold">{t.staffSnapshot?.name || t.staffId || "—"}</TableCell>
                  <TableCell>{t.transferType || "—"}</TableCell>
                  <TableCell>{schoolName(t.fromSchoolId || activeSchoolId)}</TableCell>
                  <TableCell>{t.toSchoolId ? schoolName(t.toSchoolId) : t.transferType === "Retired" ? "Retired" : "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
    <Card size="sm" className="shadow-none">
      <CardHeader>
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <CardTitle>Retired Staff</CardTitle>
            <CardDescription>{list.length} record(s) · Active directory: {(staffProfiles || []).length}</CardDescription>
          </div>
          <FieldWrap label="Search">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or CPN…" style={{ width: 200 }} />
          </FieldWrap>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {["Name", "Designation", "CPN", "Retired", "Actions"].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-4 text-center text-muted-foreground">No retired staff records.</TableCell>
              </TableRow>
            ) : (
              list.map((p, i) => (
                <TableRow key={p.id || i}>
                  <TableCell className="font-semibold">{p.name || "—"}</TableCell>
                  <TableCell>{p.designation || "—"}</TableCell>
                  <TableCell>{p.cpn || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.retiredDate || (p.retiredAt ? String(p.retiredAt).slice(0, 10) : "—")}</TableCell>
                  <TableCell>
                    <Button size="xs" variant="outline" onClick={() => restore(p.id)}>Restore Active</Button>
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

export function StaffDocumentsPanel({ staffProfiles, setSchools, activeSchoolId }) {
  const [staffId, setStaffId] = useState("");
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("Appointment Letter");
  const docFileRef = useRef(null);
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
    <Card size="sm" className="shadow-none">
      <CardHeader>
        <CardTitle>Staff Documents</CardTitle>
        <CardDescription>Attach appointment letters, CNIC copies, and service records.</CardDescription>
      </CardHeader>
      <CardContent>
        <StaffPicker profiles={staffProfiles} value={staffId} onChange={setStaffId} />
        {profile && (
          <>
            <div className="flex flex-wrap gap-2.5 items-end mb-3.5">
              <FieldWrap label="Document name">
                <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="e.g. CNIC copy" style={{ width: 200 }} />
              </FieldWrap>
              <FieldWrap label="Type">
                <NativeSelect value={docType} onChange={(e) => setDocType(e.target.value)} style={{ width: 180 }}>
                  {["Appointment Letter", "CNIC", "Degree", "Service Book", "Other"].map((t) => (
                    <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </FieldWrap>
              <FieldWrap label="Upload file">
                <input ref={docFileRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={onFile} />
                <Button type="button" size="sm" variant="outline" onClick={() => docFileRef.current?.click()}>
                  Choose file
                </Button>
              </FieldWrap>
            </div>
            {docs.length === 0 ? (
              <div className="p-4 text-muted-foreground text-sm text-center border border-dashed rounded-lg">No documents attached yet.</div>
            ) : (
              <ul className="m-0 p-0 list-none grid gap-2">
                {docs.map((d) => (
                  <li key={d.id} className="flex justify-between gap-2.5 items-center p-3 border rounded-lg">
                    <div>
                      <div className="font-bold text-sm">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.docType} · {d.uploadedAt ? new Date(d.uploadedAt).toLocaleString() : ""}</div>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      {d.dataUrl ? (
                        <Button asChild size="xs" variant="link" className="h-auto px-0 text-xs">
                          <a href={d.dataUrl} target="_blank" rel="noreferrer">Open</a>
                        </Button>
                      ) : null}
                      <Button size="xs" variant="destructive" onClick={() => updateProfile(setSchools, activeSchoolId, profile.id, (p) => removeStaffDocument(p, d.id))}>Remove</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
