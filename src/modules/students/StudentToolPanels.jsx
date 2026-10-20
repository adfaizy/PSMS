import React, { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const { formatClassDisplay, resolveClass, maxRollInClass, isDisplayablePhotoSrc } = H;

function FieldWrap({ label, children, className }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

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
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, admission, roll…" style={{ width: 200 }} />
      </FieldWrap>
      <FieldWrap label={label}>
        <NativeSelect value={value || ""} onChange={(e) => onChange(e.target.value)} style={{ width: 280 }}>
          <NativeSelectOption value="">Select student…</NativeSelectOption>
          {options.map((s) => (
            <NativeSelectOption key={s.id} value={s.id}>
              {`${s.name || "Student"} · Adm ${s.admissionNo || "—"} · Roll ${s.rollNo || "—"}`}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FieldWrap>
    </div>
  );
}

function SelectedStudentCard({ student, settings }) {
  if (!student) return null;
  const cls = resolveClass(settings.classes, student.classId);
  const status = getStudentStatus(student);
  return (
    <div className="flex gap-3 items-center p-3 bg-muted/30 rounded-lg border mb-3.5">
      <div className="w-12 h-16 rounded border overflow-hidden bg-white flex items-center justify-center shrink-0">
        {isDisplayablePhotoSrc(student.photo) ? (
          <img src={student.photo} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px] text-muted-foreground">Photo</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="font-bold text-foreground">{student.name || "Student"}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {formatClassDisplay(cls) || "—"} · Adm {student.admissionNo || "—"} · Roll {student.rollNo || "—"} · {STUDENT_STATUS_LABELS[status] || status}
        </div>
        {student.fatherName ? <div className="text-xs text-slate-500 mt-0.5">S/O {student.fatherName}</div> : null}
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
    <Card size="sm" className="shadow-none">
      <CardHeader>
        <CardTitle>Class Promotion</CardTitle>
        <CardDescription>Move students to the next grade/section or mark retention for the current session.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2.5 mb-3.5">
          <FieldWrap label="Class">
            <NativeSelect value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 180 }}>
              {(settings.classes || []).map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>{formatClassDisplay(c)}</NativeSelectOption>
              ))}
            </NativeSelect>
          </FieldWrap>
          <FieldWrap label="Search">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or admission…" style={{ width: 200 }} />
          </FieldWrap>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {["Roll", "Adm#", "Name", "Father", "Next class", "Actions"].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-4 text-center text-muted-foreground">No active students in this filter.</TableCell>
              </TableRow>
            ) : (
              list.map((s) => {
                const options = getNextGradeClassOptions(settings.classes, s.classId);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-bold">{s.rollNo || "—"}</TableCell>
                    <TableCell>{s.admissionNo || "—"}</TableCell>
                    <TableCell className="font-semibold">{s.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{s.fatherName || "—"}</TableCell>
                    <TableCell>
                      {options.length > 1 ? (
                        <NativeSelect
                          value={targets[s.id] || ""}
                          onChange={(e) => setTargets((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          style={{ minWidth: 140 }}
                        >
                          <NativeSelectOption value="">Select section</NativeSelectOption>
                          {options.map((c) => (
                            <NativeSelectOption key={c.id} value={c.id}>{formatClassDisplay(c)}</NativeSelectOption>
                          ))}
                        </NativeSelect>
                      ) : options.length === 1 ? (
                        <span className="font-semibold">{formatClassDisplay(options[0])}</span>
                      ) : (
                        <span className="text-muted-foreground">No next grade</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5 flex-wrap">
                        <Button size="xs" onClick={() => promote(s)} disabled={!options.length}>Promote</Button>
                        <Button size="xs" variant="outline" onClick={() => retain(s)}>Retain</Button>
                      </div>
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

export function DocumentsPanel({ settings, students, setStudents }) {
  const [studentId, setStudentId] = useState("");
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("Birth Certificate");
  const docFileRef = useRef(null);
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
    <Card size="sm" className="shadow-none">
      <CardHeader>
        <CardTitle>Student Documents</CardTitle>
        <CardDescription>Attach Form-B, certificates, and other records to a student profile.</CardDescription>
      </CardHeader>
      <CardContent>
        <StudentPicker settings={settings} students={students} value={studentId} onChange={setStudentId} />
        <SelectedStudentCard student={student} settings={settings} />
        {student && (
          <>
            <div className="flex flex-wrap gap-2.5 items-end mb-3.5">
              <FieldWrap label="Document name">
                <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="e.g. Form B copy" style={{ width: 200 }} />
              </FieldWrap>
              <FieldWrap label="Type">
                <NativeSelect value={docType} onChange={(e) => setDocType(e.target.value)} style={{ width: 180 }}>
                  {["Birth Certificate", "Form B / Bay Form", "Transfer Certificate", "Medical Report", "Other"].map((t) => (
                    <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </FieldWrap>
              <FieldWrap label="Upload file">
                <input ref={docFileRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={(e) => void onFile(e)} />
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
                      <Button size="xs" variant="destructive" onClick={() => setStudents((prev) => prev.map((st) => (st.id === student.id ? removeStudentDocument(st, d.id) : st)))}>
                        Remove
                      </Button>
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

export function HealthPanel({ settings, students, setStudents }) {
  const [studentId, setStudentId] = useState("");
  const [note, setNote] = useState("");
  const student = students.find((s) => s.id === studentId) || null;
  const notes = Array.isArray(student?.healthNotes) ? student.healthNotes : [];

  return (
    <Card size="sm" className="shadow-none">
      <CardHeader>
        <CardTitle>Health Records</CardTitle>
        <CardDescription>Log allergies, medical conditions, and care notes for staff awareness.</CardDescription>
      </CardHeader>
      <CardContent>
        <StudentPicker settings={settings} students={students} value={studentId} onChange={setStudentId} />
        <SelectedStudentCard student={student} settings={settings} />
        {student && (
          <>
            <div className="flex gap-2.5 items-end flex-wrap mb-3.5">
              <FieldWrap label="Health note">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Allergy to peanuts" style={{ width: 320 }} />
              </FieldWrap>
              <Button
                onClick={() => {
                  if (!note.trim()) return;
                  setStudents((prev) => prev.map((st) => (st.id === student.id ? addHealthNote(st, note) : st)));
                  setNote("");
                }}
              >
                Add Note
              </Button>
            </div>
            {notes.length === 0 ? (
              <div className="p-4 text-muted-foreground text-sm text-center border border-dashed rounded-lg">No health notes yet.</div>
            ) : (
              <ul className="m-0 p-0 list-none grid gap-2">
                {notes.map((n) => (
                  <li key={n.id} className="flex justify-between gap-2.5 p-3 border rounded-lg">
                    <div>
                      <div className="text-sm">{n.note}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</div>
                    </div>
                    <Button size="xs" variant="destructive" onClick={() => setStudents((prev) => prev.map((st) => (st.id === student.id ? removeHealthNote(st, n.id) : st)))}>
                      Remove
                    </Button>
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

export function DisciplinePanel({ settings, students, setStudents }) {
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState(DISCIPLINE_TYPES[0]);
  const [detail, setDetail] = useState("");
  const [action, setAction] = useState("");
  const [followUp, setFollowUp] = useState("");
  const student = students.find((s) => s.id === studentId) || null;
  const records = Array.isArray(student?.disciplineRecords) ? student.disciplineRecords : [];

  return (
    <Card size="sm" className="shadow-none">
      <CardHeader>
        <CardTitle>Discipline Tracking</CardTitle>
        <CardDescription>Record incidents, warnings, and follow-up actions.</CardDescription>
      </CardHeader>
      <CardContent>
        <StudentPicker settings={settings} students={students} value={studentId} onChange={setStudentId} />
        <SelectedStudentCard student={student} settings={settings} />
        {student && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
              <FieldWrap label="Type">
                <NativeSelect value={type} onChange={(e) => setType(e.target.value)} className="w-full">
                  {DISCIPLINE_TYPES.map((t) => (
                    <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </FieldWrap>
              <FieldWrap label="Follow-up">
                <Input value={followUp} onChange={(e) => setFollowUp(e.target.value)} placeholder="Optional follow-up date/note" className="w-full" />
              </FieldWrap>
              <FieldWrap label="Detail">
                <Input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="What happened?" className="w-full" />
              </FieldWrap>
              <FieldWrap label="Action taken">
                <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Counseling, warning…" className="w-full" />
              </FieldWrap>
            </div>
            <div className="flex justify-end mb-3.5">
              <Button
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
              </Button>
            </div>
            {records.length === 0 ? (
              <div className="p-4 text-muted-foreground text-sm text-center border border-dashed rounded-lg">No discipline records yet.</div>
            ) : (
              <ul className="m-0 p-0 list-none grid gap-2">
                {records.map((r) => (
                  <li key={r.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between gap-2.5">
                      <div>
                        <div className="font-bold text-sm">{r.type}</div>
                        <div className="text-xs mt-1">{r.detail}</div>
                        {r.action ? <div className="text-xs text-slate-500 mt-1">Action: {r.action}</div> : null}
                        {r.followUp ? <div className="text-xs text-slate-500">Follow-up: {r.followUp}</div> : null}
                        <div className="text-xs text-muted-foreground mt-1">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</div>
                      </div>
                      <Button size="xs" variant="destructive" onClick={() => setStudents((prev) => prev.map((st) => (st.id === student.id ? removeDisciplineRecord(st, r.id) : st)))}>
                        Remove
                      </Button>
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

export function LeavingPanel({ settings, students, setStudents }) {
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState(LEAVING_CERTIFICATE_TYPES[0]);
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [nextStatus, setNextStatus] = useState(STUDENT_STATUS.WITHDRAWN);
  const student = students.find((s) => s.id === studentId) || null;

  return (
    <Card size="sm" className="shadow-none">
      <CardHeader>
        <CardTitle>Leaving & Certificates</CardTitle>
        <CardDescription>Issue school leaving / transfer certificates and update the student lifecycle status.</CardDescription>
      </CardHeader>
      <CardContent>
        <StudentPicker settings={settings} students={students} value={studentId} onChange={setStudentId} statusMode="active" />
        <SelectedStudentCard student={student} settings={settings} />
        {student && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
              <FieldWrap label="Certificate type">
                <NativeSelect value={type} onChange={(e) => setType(e.target.value)} className="w-full">
                  {LEAVING_CERTIFICATE_TYPES.map((t) => (
                    <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </FieldWrap>
              <FieldWrap label="Issue date">
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full" />
              </FieldWrap>
              <FieldWrap label="Reason">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Transfer, withdrawal…" className="w-full" />
              </FieldWrap>
              <FieldWrap label="New status">
                <NativeSelect value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className="w-full">
                  <NativeSelectOption value={STUDENT_STATUS.WITHDRAWN}>Withdrawn</NativeSelectOption>
                  <NativeSelectOption value={STUDENT_STATUS.TRANSFERRED}>Transferred</NativeSelectOption>
                  <NativeSelectOption value={STUDENT_STATUS.GRADUATED}>Graduated</NativeSelectOption>
                  <NativeSelectOption value={STUDENT_STATUS.ALUMNI}>Alumni</NativeSelectOption>
                </NativeSelect>
              </FieldWrap>
              <FieldWrap label="Remarks">
                <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional remarks" className="w-full" />
              </FieldWrap>
            </div>
            <div className="flex justify-end gap-2">
              <Button
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
              </Button>
            </div>
            {student.leavingInfo ? (
              <div className="mt-3.5 p-3 bg-muted/30 rounded-lg border text-xs">
                <div className="font-bold">Existing leaving record</div>
                <div className="mt-1 text-muted-foreground">
                  {student.leavingInfo.type} · {student.leavingInfo.issueDate || "—"} · {student.leavingInfo.reason || "—"}
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
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
    <Card size="sm" className="shadow-none">
      <CardHeader>
        <CardTitle>Alumni & Former Students</CardTitle>
        <CardDescription>Withdrawn, transferred, graduated, and alumni records ({summary.alumni} total).</CardDescription>
        <CardAction>
          <div className="flex gap-2">
            <Badge variant="secondary"><strong>{summary.active}</strong>&nbsp;active</Badge>
            <Badge variant="outline"><strong>{summary.alumni}</strong>&nbsp;former</Badge>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2.5 mb-3.5">
          <FieldWrap label="Class (last)">
            <NativeSelect value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 180 }}>
              <NativeSelectOption value="all">All classes</NativeSelectOption>
              {(settings.classes || []).map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>{formatClassDisplay(c)}</NativeSelectOption>
              ))}
            </NativeSelect>
          </FieldWrap>
          <FieldWrap label="Search">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or admission…" style={{ width: 220 }} />
          </FieldWrap>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {["Name", "Father", "Adm#", "Last class", "Status", "Leaving", "Actions"].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-4 text-center text-muted-foreground">No alumni / former students match this filter.</TableCell>
              </TableRow>
            ) : (
              list.map((s) => {
                const cls = resolveClass(settings.classes, s.classId);
                const status = getStudentStatus(s);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-semibold">{s.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{s.fatherName || "—"}</TableCell>
                    <TableCell>{s.admissionNo || "—"}</TableCell>
                    <TableCell>{formatClassDisplay(cls) || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{STUDENT_STATUS_LABELS[status] || status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.leavingInfo?.type || "—"}
                      {s.leavingInfo?.issueDate ? ` · ${s.leavingInfo.issueDate}` : ""}
                    </TableCell>
                    <TableCell>
                      {!isActiveStudent(s) ? (
                        <Button size="xs" variant="outline" onClick={() => restore(s)}>Restore Active</Button>
                      ) : null}
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
