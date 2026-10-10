import React, { useEffect, useMemo, useRef, useState } from "react";
import { Btn, Sel, Inp, SchoolHeader } from "@/components/AppControls";
import { C, genId } from "@/shared/theme";
import * as H from "@/shared/helpers";
import { STUDENT_STATUS } from "./studentsCore.js";

const {
  formatClassDisplay,
  nextAdmissionNo,
  nextRollNoForClass,
  findStudentByAdmissionNo,
  findStudentByRollInClass,
  getClassLabel,
  toProperCase,
  toProperCaseNameInput,
  processStudentPhotoWithBackground,
  preloadStudentPhotoAi,
  isStudentPhotoFile,
  isDisplayablePhotoSrc,
} = H;

const panel = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" };

export function AdmissionPanel({ settings, students, setStudents, activeSchoolId }) {
  const admissionEmpty = {
    admissionNo: "",
    rollNo: "",
    name: "",
    fatherName: "",
    classId: settings.classes?.[0]?.id || "",
    dob: "",
    bayForm: "",
    fatherCnic: "",
    whatsapp: "",
    photo: null,
  };
  const [form, setForm] = useState(admissionEmpty);
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoStatus, setPhotoStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);

  useEffect(() => {
    void preloadStudentPhotoAi();
  }, []);

  const suggestedNextAdm = useMemo(() => nextAdmissionNo(students), [students]);
  const suggestedNextRoll = useMemo(
    () => nextRollNoForClass(students, settings.classes, form.classId, settings.commonTeachers),
    [students, settings.classes, form.classId, settings.commonTeachers],
  );

  const formatDob = (v) => {
    const d = String(v || "").replace(/\D/g, "").slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  };
  const formatCnic = (v) => {
    const d = (v || "").replace(/\D/g, "").slice(0, 13);
    if (d.length <= 5) return d;
    if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
  };
  const formatWhatsapp = (v) => {
    const d = (v || "").replace(/\D/g, "").slice(0, 11);
    if (d.length <= 4) return d;
    return `${d.slice(0, 4)}-${d.slice(4)}`;
  };

  const toWorldwidePhoto = async (dataUrl, studentId) => {
    if (!dataUrl || !isDisplayablePhotoSrc(dataUrl)) return dataUrl;
    if (/^https?:\/\//i.test(dataUrl)) return dataUrl;
    try {
      const { uploadDataUrlPhoto } = await import("../../lib/photoStorage.js");
      const prefix = `${activeSchoolId || "school"}/students/${studentId || "new"}`;
      return await uploadDataUrlPhoto(dataUrl, prefix);
    } catch (err) {
      console.warn("Photo cloud upload skipped", err);
      return dataUrl;
    }
  };

  const handlePhoto = async (f) => {
    if (!f) return;
    if (!isStudentPhotoFile(f)) {
      alert("Please choose an image file (JPG, PNG, WEBP, HEIC, etc.).");
      return;
    }
    setPhotoBusy(true);
    setPhotoStatus("Preparing…");
    try {
      const data = await processStudentPhotoWithBackground(f, {
        onProgress: (msg) => setPhotoStatus(String(msg || "Processing…")),
      });
      if (!data) {
        alert("Could not process this photo. Try another image.");
        return;
      }
      setPhotoStatus("Uploading…");
      const worldwide = await toWorldwidePhoto(data, "admission");
      setForm((x) => ({ ...x, photo: worldwide }));
    } catch (err) {
      alert("Photo upload failed: " + (err?.message || String(err)));
    } finally {
      setPhotoBusy(false);
      setPhotoStatus("");
    }
  };

  const saveAdmission = async () => {
    if (saveLock.current || saving) return;
    if (!(form.name || "").trim()) {
      alert("Please enter Student Name.");
      return;
    }
    saveLock.current = true;
    setSaving(true);
    try {
      const name = toProperCase(form.name || "");
      const fatherName = toProperCase(form.fatherName || "");
      let admissionNo = (form.admissionNo || "").trim();
      let rollNo = (form.rollNo || "").trim();
      if (!admissionNo) admissionNo = nextAdmissionNo(students);
      if (!rollNo) rollNo = nextRollNoForClass(students, settings.classes, form.classId, settings.commonTeachers);
      const dupAdm = findStudentByAdmissionNo(students, admissionNo, null);
      if (dupAdm) {
        alert(
          "This admission number is already assigned to:\nClass: " +
            getClassLabel(settings, dupAdm.classId) +
            "\nRoll: " +
            (dupAdm.rollNo || "—") +
            "\nName: " +
            (dupAdm.name || ""),
        );
        return;
      }
      const dupRoll = findStudentByRollInClass(
        students,
        settings.classes,
        form.classId,
        rollNo,
        null,
        settings.commonTeachers,
      );
      if (dupRoll) {
        alert(
          "This roll number is already used in this class by:\nName: " +
            (dupRoll.name || "") +
            "\nAdm#: " +
            (dupRoll.admissionNo || "—"),
        );
        return;
      }
      const id = genId();
      let photo = form.photo || null;
      if (photo && String(photo).startsWith("data:image")) photo = await toWorldwidePhoto(photo, id);
      const payload = {
        ...form,
        name,
        fatherName,
        admissionNo,
        rollNo,
        id,
        photo,
        studentStatus: STUDENT_STATUS.ACTIVE,
        personalInfoLockSession: null,
        personalInfoHistory: [],
        healthNotes: [],
        disciplineRecords: [],
        documents: [],
      };
      setStudents((s) => [...s, payload]);
      setForm({ ...admissionEmpty, classId: settings.classes?.[0]?.id || "" });
      alert("Student admitted successfully. Open Student Directory to review the record.");
    } catch (err) {
      alert("Could not admit student: " + (err?.message || String(err)));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <SchoolHeader settings={settings} subtitle="STUDENT ADMISSION" />
      <div style={{ ...panel, padding: 20, marginTop: 12 }}>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: C.gray }}>
          Enroll a new student with class, roll number, guardian details, and optional photo.
        </p>
        <div className="psms-photo-form-row" style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <div
              style={{
                width: 80,
                height: 100,
                border: "2px dashed #d1d5db",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                background: "#fafafa",
              }}
            >
              {photoBusy ? (
                <span style={{ fontSize: 10, color: C.gray, textAlign: "center", padding: 4 }}>{photoStatus || "AI processing…"}</span>
              ) : isDisplayablePhotoSrc(form.photo) ? (
                <img src={form.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 10, color: C.gray }}>Photo</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
              <Btn type="button" small outline disabled={photoBusy} onClick={() => galleryRef.current?.click()}>
                Select Image
              </Btn>
              <Btn type="button" small outline disabled={photoBusy} onClick={() => cameraRef.current?.click()}>
                Capture Photo
              </Btn>
              {form.photo && !photoBusy && (
                <Btn type="button" small danger onClick={() => setForm((x) => ({ ...x, photo: null }))}>
                  Clear Photo
                </Btn>
              )}
            </div>
            <input ref={galleryRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await handlePhoto(f); }} />
            <input ref={cameraRef} type="file" accept="image/*" capture="user" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await handlePhoto(f); }} />
          </div>
          <div className="psms-grid-2" style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, minWidth: 0 }}>
            <Inp label="Admission No" value={form.admissionNo} onChange={(v) => setForm((x) => ({ ...x, admissionNo: v }))} placeholder={"Next: " + suggestedNextAdm} width="100%" />
            <Inp label="Roll No" value={form.rollNo} onChange={(v) => setForm((x) => ({ ...x, rollNo: v }))} placeholder={"Next in class: " + suggestedNextRoll} width="100%" />
            <Inp label="Student Name" value={form.name} onChange={(v) => setForm((x) => ({ ...x, name: toProperCaseNameInput(v) }))} width="100%" />
            <Inp label="Father's Name" value={form.fatherName} onChange={(v) => setForm((x) => ({ ...x, fatherName: toProperCaseNameInput(v) }))} width="100%" />
            <Inp label="Form B / Bay Form" value={form.bayForm} onChange={(v) => setForm((x) => ({ ...x, bayForm: formatCnic(v) }))} placeholder="00000-0000000-0" width="100%" />
            <Inp label="Date of Birth" value={form.dob} onChange={(v) => setForm((x) => ({ ...x, dob: formatDob(v) }))} placeholder="dd/mm/yyyy" width="100%" />
            <Inp label="WhatsApp No" value={form.whatsapp} onChange={(v) => setForm((x) => ({ ...x, whatsapp: formatWhatsapp(v) }))} placeholder="0000-0000000" width="100%" />
            <Sel label="Class" value={form.classId} onChange={(v) => setForm((x) => ({ ...x, classId: v }))} options={(settings.classes || []).map((c) => ({ value: c.id, label: formatClassDisplay(c) }))} width="100%" />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn onClick={() => void saveAdmission()} disabled={saving || photoBusy}>
            {saving ? "Processing…" : "Admit Student"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
