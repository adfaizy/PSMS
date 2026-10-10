import React, { useMemo, useState } from "react";
import { Btn, Sel, Inp } from "@/components/AppControls";
import { C } from "@/shared/theme";
import * as H from "@/shared/helpers";
import {
  STUDENT_STATUS,
  STUDENT_STATUS_LABELS,
  DISCIPLINE_TYPES,
  LEAVING_CERTIFICATE_TYPES,
  searchStudents,
  getStudentStatus,
  addHealthNote,
  removeHealthNote,
  addDisciplineRecord,
  removeDisciplineRecord,
  addStudentDocument,
  removeStudentDocument,
  setLeavingInfo,
  setStudentLifecycleStatus,
  getNextGradeClassOptions,
  summarizeStudentDirectory,
  isActiveStudent,
} from "./studentsCore.js";

const { formatClassDisplay, resolveClass, maxRollInClass, isDisplayablePhotoSrc } = H;

const panel = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
};

function StudentPicker({ settings, students, value, onChange, statusMode = "active", label = "Student" }) {
  const [classId, setClassId] = useState("all");
  const [query, setQuery] = useState("");
  const options = useMemo(
    () =>
      searchStudents({
        students,
        classes: settings.classes,
        query,
        classId,
        statusMode,
      }),
    [students, settings.classes, query, classId, statusMode],
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
      <Inp label="Search" value={query} onChange={setQuery} placeholder="Name, admission, roll…" width={200} />
      <Sel
        label={label}
        value={value || ""}
        onChange={onChange}
        options={[{ value: "", label: "Select student…" }, ...options.map((s) => ({
          value: s.id,
          label: `${s.name || "Student"} · Adm ${s.admissionNo || "—"} · Roll ${s.rollNo || "—"}`,
        }))]}
        width={280}
      />
    </div>
  );
}

function SelectedStudentCard({ student, settings }) {
  if (!student) return null;
  const cls = resolveClass(settings.classes, student.classId);
  const status = getStudentStatus(student);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: 14 }}>
      <div style={{ width: 48, height: 60, borderRadius: 6, border: "1px solid #d1d5db", overflow: "hidden", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {isDisplayablePhotoSrc(student.photo) ? (
          <img src={student.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 10, color: C.gray }}>Photo</span>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: C.navy }}>{student.name || "Student"}</div>
        <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
          {formatClassDisplay(cls) || "—"} · Adm {student.admissionNo || "—"} · Roll {student.rollNo || "—"} · {STUDENT_STATUS_LABELS[status] || status}
        </div>
        {student.fatherName ? <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>S/O {student.fatherName}</div> : null}
      </div>
    </div>
  );
}

export function PromotionPanel({ settings, students, setStudents, currentSession }) {
  const [classId, setClassId] = useState(settings.classes?.[0]?.id || "");
  const [query, setQuery] = useState("");
  const [targets, setTargets] = useState({});

  const list = useMemo(
    () =>
      searchStudents({
        students,
        classes: settings.classes,
        query,
        classId: classId || "all",
        statusMode: "active",
      }),
    [students, settings.classes, query, classId],
  );

  const promote = (student) => {
    const options = getNextGradeClassOptions(settings.classes, student.classId);
    if (!options.length) {
      alert("Next class not found. Add the next grade/section in Settings first.");
      return;
    }
    const selectedId = targets[student.id];
    let nextClass = selectedId ? options.find((c) => c.id === selectedId) : null;
    if (!nextClass) {
      if (options.length === 1) nextClass = options[0];
      else {
        alert("Please select a target section before promotion.");
        return;
      }
    }
    if (!confirm(`Promote ${student.name || "student"} to ${formatClassDisplay(nextClass)}?`)) return;
    setStudents((prev) => {
      let nextRoll = maxRollInClass(prev, settings.classes, nextClass.id, settings.commonTeachers);
      return prev.map((st) => {
        if (st.id !== student.id) return st;
        nextRoll += 1;
        return {
          ...st,
          classId: nextClass.id,
          rollNo: String(nextRoll),
          studentStatus: STUDENT_STATUS.PROMOTED,
          personalInfoLockSession: currentSession || null,
          personalInfoHistory: Array.isArray(st.personalInfoHistory) ? st.personalInfoHistory : [],
          promotionInfo: {
            promotedAt: new Date().toISOString(),
            fromClassId: student.classId,
            toClassId: nextClass.id,
          },
        };
      });
    });
    alert(`${student.name || "Student"} promoted to ${formatClassDisplay(nextClass)}.`);
  };

  const retain = (student) => {
    if (!confirm(`Mark ${student.name || "student"} as retained in the same class?`)) return;
    setStudents((prev) =>
      prev.map((st) =>
        st.id === student.id
          ? setStudentLifecycleStatus(st, STUDENT_STATUS.RETAINED, {
              retentionInfo: { retainedAt: new Date().toISOString(), classId: st.classId },
            })
          : st,
      ),
    );
  };

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>Class Promotion</div>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.gray }}>
          Move students to the next grade/section or mark retention for the current session.
        </p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <Sel
          label="Class"
          value={classId}
          onChange={setClassId}
          options={(settings.classes || []).map((c) => ({ value: c.id, label: formatClassDisplay(c) }))}
          width={180}
        />
        <Inp label="Search" value={query} onChange={setQuery} placeholder="Name or admission…" width={200} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#1B5E20", color: "#fff" }}>
              {["Roll", "Adm#", "Name", "Father", "Next class", "Actions"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: C.gray, textAlign: "center" }}>No active students in this filter.</td>
              </tr>
            ) : (
              list.map((s, i) => {
                const options = getNextGradeClassOptions(settings.classes, s.classId);
                return (
                  <tr key={s.id} style={{ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 700 }}>{s.rollNo || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>{s.admissionNo || "—"}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{s.name || "—"}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{s.fatherName || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      {options.length > 1 ? (
                        <select
                          value={targets[s.id] || ""}
                          onChange={(e) => setTargets((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          style={{ padding: "4px 6px", fontSize: 11, border: "1px solid #cbd5e1", borderRadius: 4, minWidth: 140 }}
                        >
                          <option value="">Select section</option>
                          {options.map((c) => (
                            <option key={c.id} value={c.id}>{formatClassDisplay(c)}</option>
                          ))}
                        </select>
                      ) : options.length === 1 ? (
                        <span style={{ fontWeight: 600 }}>{formatClassDisplay(options[0])}</span>
                      ) : (
                        <span style={{ color: C.gray }}>No next grade</span>
                      )}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Btn small onClick={() => promote(s)} disabled={!options.length}>Promote</Btn>
                        <Btn small outline onClick={() => retain(s)}>Retain</Btn>
                      </div>
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

export function DocumentsPanel({ settings, students, setStudents }) {
  const [studentId, setStudentId] = useState("");
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("Birth Certificate");
  const student = students.find((s) => s.id === studentId) || null;
  const docs = Array.isArray(student?.documents) ? student.documents : [];

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !student) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      setStudents((prev) =>
        prev.map((st) =>
          st.id === student.id
            ? addStudentDocument(st, {
                name: docName || f.name,
                docType,
                dataUrl,
                mime: f.type || "",
              })
            : st,
        ),
      );
      setDocName("");
    };
    reader.readAsDataURL(f);
  };

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ fontWeight: 700, color: C.navy, fontSize: 15, marginBottom: 4 }}>Student Documents</div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: C.gray }}>Attach Form-B, certificates, and other records to a student profile.</p>
      <StudentPicker settings={settings} students={students} value={studentId} onChange={setStudentId} />
      <SelectedStudentCard student={student} settings={settings} />
      {student && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 14 }}>
            <Inp label="Document name" value={docName} onChange={setDocName} placeholder="e.g. Form B copy" width={200} />
            <Sel
              label="Type"
              value={docType}
              onChange={setDocType}
              options={["Birth Certificate", "Form B / Bay Form", "Transfer Certificate", "Medical Report", "Other"].map((t) => ({ value: t, label: t }))}
              width={180}
            />
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Upload file</span>
              <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={(e) => void onFile(e)} style={{ fontSize: 12 }} />
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
                      <a href={d.dataUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>
                        Open
                      </a>
                    ) : null}
                    <Btn small danger onClick={() => setStudents((prev) => prev.map((st) => (st.id === student.id ? removeStudentDocument(st, d.id) : st)))}>
                      Remove
                    </Btn>
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

export function HealthPanel({ settings, students, setStudents }) {
  const [studentId, setStudentId] = useState("");
  const [note, setNote] = useState("");
  const student = students.find((s) => s.id === studentId) || null;
  const notes = Array.isArray(student?.healthNotes) ? student.healthNotes : [];

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ fontWeight: 700, color: C.navy, fontSize: 15, marginBottom: 4 }}>Health Records</div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: C.gray }}>Log allergies, medical conditions, and care notes for staff awareness.</p>
      <StudentPicker settings={settings} students={students} value={studentId} onChange={setStudentId} />
      <SelectedStudentCard student={student} settings={settings} />
      {student && (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
            <Inp label="Health note" value={note} onChange={setNote} placeholder="e.g. Allergy to peanuts" width={320} />
            <Btn
              onClick={() => {
                if (!note.trim()) return;
                setStudents((prev) => prev.map((st) => (st.id === student.id ? addHealthNote(st, note) : st)));
                setNote("");
              }}
            >
              Add Note
            </Btn>
          </div>
          {notes.length === 0 ? (
            <div style={{ padding: 16, color: C.gray, fontSize: 13, textAlign: "center", border: "1px dashed #cbd5e1", borderRadius: 8 }}>No health notes yet.</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {notes.map((n) => (
                <li key={n.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 13 }}>{n.note}</div>
                    <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</div>
                  </div>
                  <Btn small danger onClick={() => setStudents((prev) => prev.map((st) => (st.id === student.id ? removeHealthNote(st, n.id) : st)))}>
                    Remove
                  </Btn>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function DisciplinePanel({ settings, students, setStudents }) {
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState(DISCIPLINE_TYPES[0]);
  const [detail, setDetail] = useState("");
  const [action, setAction] = useState("");
  const [followUp, setFollowUp] = useState("");
  const student = students.find((s) => s.id === studentId) || null;
  const records = Array.isArray(student?.disciplineRecords) ? student.disciplineRecords : [];

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ fontWeight: 700, color: C.navy, fontSize: 15, marginBottom: 4 }}>Discipline Tracking</div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: C.gray }}>Record incidents, warnings, and follow-up actions.</p>
      <StudentPicker settings={settings} students={students} value={studentId} onChange={setStudentId} />
      <SelectedStudentCard student={student} settings={settings} />
      {student && (
        <>
          <div className="psms-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <Sel label="Type" value={type} onChange={setType} options={DISCIPLINE_TYPES.map((t) => ({ value: t, label: t }))} width="100%" />
            <Inp label="Follow-up" value={followUp} onChange={setFollowUp} placeholder="Optional follow-up date/note" width="100%" />
            <Inp label="Detail" value={detail} onChange={setDetail} placeholder="What happened?" width="100%" />
            <Inp label="Action taken" value={action} onChange={setAction} placeholder="Counseling, warning…" width="100%" />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <Btn
              onClick={() => {
                if (!detail.trim()) {
                  alert("Please enter incident detail.");
                  return;
                }
                setStudents((prev) =>
                  prev.map((st) => (st.id === student.id ? addDisciplineRecord(st, { type, detail, action, followUp }) : st)),
                );
                setDetail("");
                setAction("");
                setFollowUp("");
              }}
            >
              Add Record
            </Btn>
          </div>
          {records.length === 0 ? (
            <div style={{ padding: 16, color: C.gray, fontSize: 13, textAlign: "center", border: "1px dashed #cbd5e1", borderRadius: 8 }}>No discipline records yet.</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {records.map((r) => (
                <li key={r.id} style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{r.type}</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>{r.detail}</div>
                      {r.action ? <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Action: {r.action}</div> : null}
                      {r.followUp ? <div style={{ fontSize: 12, color: "#64748b" }}>Follow-up: {r.followUp}</div> : null}
                      <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</div>
                    </div>
                    <Btn small danger onClick={() => setStudents((prev) => prev.map((st) => (st.id === student.id ? removeDisciplineRecord(st, r.id) : st)))}>
                      Remove
                    </Btn>
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

export function LeavingPanel({ settings, students, setStudents }) {
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState(LEAVING_CERTIFICATE_TYPES[0]);
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [nextStatus, setNextStatus] = useState(STUDENT_STATUS.WITHDRAWN);
  const student = students.find((s) => s.id === studentId) || null;

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ fontWeight: 700, color: C.navy, fontSize: 15, marginBottom: 4 }}>Leaving & Certificates</div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: C.gray }}>
        Issue school leaving / transfer certificates and update the student lifecycle status.
      </p>
      <StudentPicker settings={settings} students={students} value={studentId} onChange={setStudentId} statusMode="active" />
      <SelectedStudentCard student={student} settings={settings} />
      {student && (
        <>
          <div className="psms-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <Sel label="Certificate type" value={type} onChange={setType} options={LEAVING_CERTIFICATE_TYPES.map((t) => ({ value: t, label: t }))} width="100%" />
            <Inp label="Issue date" value={issueDate} onChange={setIssueDate} type="date" width="100%" />
            <Inp label="Reason" value={reason} onChange={setReason} placeholder="Transfer, withdrawal…" width="100%" />
            <Sel
              label="New status"
              value={nextStatus}
              onChange={setNextStatus}
              options={[
                { value: STUDENT_STATUS.WITHDRAWN, label: "Withdrawn" },
                { value: STUDENT_STATUS.TRANSFERRED, label: "Transferred" },
                { value: STUDENT_STATUS.GRADUATED, label: "Graduated" },
                { value: STUDENT_STATUS.ALUMNI, label: "Alumni" },
              ]}
              width="100%"
            />
            <Inp label="Remarks" value={remarks} onChange={setRemarks} placeholder="Optional remarks" width="100%" />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn
              onClick={() => {
                if (!confirm(`Issue ${type} for ${student.name || "student"} and mark as ${STUDENT_STATUS_LABELS[nextStatus]}?`)) return;
                setStudents((prev) =>
                  prev.map((st) =>
                    st.id === student.id ? setLeavingInfo(st, { type, issueDate, reason, remarks, nextStatus }) : st,
                  ),
                );
                alert("Leaving information saved. Student moved out of the active directory.");
                setStudentId("");
              }}
            >
              Issue & Update Status
            </Btn>
          </div>
          {student.leavingInfo ? (
            <div style={{ marginTop: 14, padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}>
              <div style={{ fontWeight: 700 }}>Existing leaving record</div>
              <div style={{ marginTop: 4, color: "#64748b" }}>
                {student.leavingInfo.type} · {student.leavingInfo.issueDate || "—"} · {student.leavingInfo.reason || "—"}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function AlumniPanel({ settings, students, setStudents }) {
  const [query, setQuery] = useState("");
  const [classId, setClassId] = useState("all");
  const summary = useMemo(() => summarizeStudentDirectory(students, settings.classes), [students, settings.classes]);
  const list = useMemo(
    () =>
      searchStudents({
        students,
        classes: settings.classes,
        query,
        classId,
        statusMode: "alumni",
      }),
    [students, settings.classes, query, classId],
  );

  const restore = (student) => {
    if (!confirm(`Restore ${student.name || "student"} to active enrollment?`)) return;
    setStudents((prev) =>
      prev.map((st) =>
        st.id === student.id
          ? setStudentLifecycleStatus(st, STUDENT_STATUS.ACTIVE, { leavingInfo: null, restoredAt: new Date().toISOString() })
          : st,
      ),
    );
  };

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>Alumni & Former Students</div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.gray }}>
            Withdrawn, transferred, graduated, and alumni records ({summary.alumni} total).
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ padding: "8px 12px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", fontSize: 12 }}>
            <strong>{summary.active}</strong> active
          </div>
          <div style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}>
            <strong>{summary.alumni}</strong> former
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <Sel
          label="Class (last)"
          value={classId}
          onChange={setClassId}
          options={[{ value: "all", label: "All classes" }, ...(settings.classes || []).map((c) => ({ value: c.id, label: formatClassDisplay(c) }))]}
          width={180}
        />
        <Inp label="Search" value={query} onChange={setQuery} placeholder="Name or admission…" width={220} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#0f172a", color: "#fff" }}>
              {["Name", "Father", "Adm#", "Last class", "Status", "Leaving", "Actions"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 16, color: C.gray, textAlign: "center" }}>No alumni / former students match this filter.</td>
              </tr>
            ) : (
              list.map((s, i) => {
                const cls = resolveClass(settings.classes, s.classId);
                const status = getStudentStatus(s);
                return (
                  <tr key={s.id} style={{ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{s.name || "—"}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{s.fatherName || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>{s.admissionNo || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>{formatClassDisplay(cls) || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>{STUDENT_STATUS_LABELS[status] || status}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>
                      {s.leavingInfo?.type || "—"}
                      {s.leavingInfo?.issueDate ? ` · ${s.leavingInfo.issueDate}` : ""}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      {!isActiveStudent(s) ? (
                        <Btn small outline onClick={() => restore(s)}>Restore Active</Btn>
                      ) : null}
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
