import React, { useEffect, useMemo, useRef, useState } from "react";
import { SchoolHeader } from "@/components/AppControls";
import { genId } from "@/shared/theme";
import * as H from "@/shared/helpers";
import { STUDENT_STATUS } from "./studentsCore.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
  normalizeStudentPhotoFile,
  readStudentPhotoAsJpeg,
} = H;

function FieldWrap({ label, children, className }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

async function uploadPhotoOrKeep(dataUrl, activeSchoolId, studentId) {
  if (!dataUrl || !isDisplayablePhotoSrc(dataUrl)) return dataUrl || null;
  if (/^https?:\/\//i.test(dataUrl)) return dataUrl;
  try {
    const { uploadDataUrlPhoto } = await import("../../lib/photoStorage.js");
    const prefix = `${activeSchoolId || "school"}/students/${studentId || "new"}`;
    const url = await uploadDataUrlPhoto(dataUrl, prefix);
    return url || dataUrl;
  } catch (err) {
    console.warn("Photo cloud upload skipped", err);
    return dataUrl;
  }
}

export function AdmissionPanel({ settings, students, setStudents, activeSchoolId }) {
  const classes = settings.classes || [];
  const defaultClassId = classes[0]?.id || "";

  const admissionEmpty = {
    admissionNo: "",
    rollNo: "",
    name: "",
    fatherName: "",
    classId: defaultClassId,
    dob: "",
    bayForm: "",
    fatherCnic: "",
    whatsapp: "",
    photo: null,
  };
  const [form, setForm] = useState(admissionEmpty);
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const photoFileRef = useRef(null);
  const photoDataRef = useRef(null); // always keep latest processed JPEG data URL
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

  useEffect(() => {
    if (!form.classId) return;
    setForm((x) => {
      if (x.admissionNo === suggestedNextAdm && x.rollNo === suggestedNextRoll) return x;
      return { ...x, admissionNo: suggestedNextAdm, rollNo: suggestedNextRoll };
    });
  }, [form.classId, suggestedNextAdm, suggestedNextRoll]);

  const onClassChange = (classId) => {
    const roll = nextRollNoForClass(students, settings.classes, classId, settings.commonTeachers);
    const adm = nextAdmissionNo(students);
    setForm((x) => ({ ...x, classId, admissionNo: adm, rollNo: roll }));
  };

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

  const setPhotoOnForm = (dataUrl) => {
    photoDataRef.current = dataUrl;
    setForm((x) => ({ ...x, photo: dataUrl }));
  };

  const handlePhoto = async (rawFile) => {
    if (!rawFile) return;
    const f = normalizeStudentPhotoFile(rawFile) || rawFile;
    if (!isStudentPhotoFile(f)) {
      alert("Please choose an image file (JPG, PNG, WEBP, HEIC, etc.).");
      return;
    }
    photoFileRef.current = f;
    setPhotoBusy(true);
    setPhotoStatus("Preparing…");
    try {
      let data = null;
      try {
        data = await processStudentPhotoWithBackground(f, {
          onProgress: (msg) => setPhotoStatus(String(msg || "Processing…")),
        });
      } catch (err) {
        console.warn("AI photo failed, using plain JPEG", err);
        setPhotoStatus("Saving photo…");
        data = await readStudentPhotoAsJpeg(f);
      }
      if (!data || !isDisplayablePhotoSrc(data)) {
        alert("Could not process this camera photo. Try Select Image, or retake as JPG.");
        return;
      }
      // Keep data URL for save reliability; upload to cloud on Admit
      setPhotoOnForm(data);
    } catch (err) {
      alert("Photo failed: " + (err?.message || String(err)));
    } finally {
      setPhotoBusy(false);
      setPhotoStatus("");
    }
  };

  const onPhotoInputChange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) await handlePhoto(f);
  };

  const resolvePhotoForSave = async (studentId) => {
    let photo = photoDataRef.current || form.photo || null;
    if (!isDisplayablePhotoSrc(photo) && photoFileRef.current) {
      try {
        photo = await processStudentPhotoWithBackground(photoFileRef.current);
      } catch {
        photo = await readStudentPhotoAsJpeg(photoFileRef.current);
      }
    }
    if (!isDisplayablePhotoSrc(photo) && !/^https?:\/\//i.test(String(photo || ""))) {
      return null;
    }
    // Prefer HTTPS for directory + cloud (data URLs get stripped on cloud sync)
    if (String(photo).startsWith("data:image")) {
      const uploaded = await uploadPhotoOrKeep(photo, activeSchoolId, studentId);
      return uploaded || photo;
    }
    return photo;
  };

  const saveAdmission = async () => {
    if (saveLock.current || saving) return;
    if (!form.classId) {
      alert("Please select a class first.");
      return;
    }
    if (!(form.name || "").trim()) {
      alert("Please enter Student Name.");
      return;
    }
    saveLock.current = true;
    setSaving(true);
    try {
      const name = toProperCase(form.name || "");
      const fatherName = toProperCase(form.fatherName || "");
      const admissionNo = nextAdmissionNo(students);
      const rollNo = nextRollNoForClass(students, settings.classes, form.classId, settings.commonTeachers);
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
      const photo = await resolvePhotoForSave(id);
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
      photoFileRef.current = null;
      photoDataRef.current = null;
      const nextClass = form.classId || defaultClassId;
      setForm({
        ...admissionEmpty,
        classId: nextClass,
        admissionNo: nextAdmissionNo([...students, payload]),
        rollNo: nextRollNoForClass([...students, payload], settings.classes, nextClass, settings.commonTeachers),
        photo: null,
      });
      alert(
        photo
          ? "Student admitted with photo. Open Student Directory to review."
          : "Student admitted (no photo). Open Student Directory to review.",
      );
    } catch (err) {
      alert("Could not admit student: " + (err?.message || String(err)));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <SchoolHeader settings={settings} subtitle="STUDENT ADMISSION" />
      <Card size="sm" className="mt-3 shadow-none">
        <CardContent className="pt-4">
          <p className="mb-3.5 text-sm text-muted-foreground">
            Select class first — admission and roll numbers are assigned automatically.
          </p>
          <div className="mb-3.5 flex flex-wrap items-start gap-4">
            <div className="flex shrink-0 flex-col items-center gap-1.5">
              <div className="flex h-[100px] w-20 items-center justify-center overflow-hidden rounded border-2 border-dashed bg-muted/20">
                {photoBusy ? (
                  <span className="px-1 text-center text-[10px] text-muted-foreground">{photoStatus || "AI processing…"}</span>
                ) : isDisplayablePhotoSrc(form.photo) ? (
                  <img src={form.photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">Photo</span>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-1">
                <Button type="button" size="xs" variant="outline" disabled={photoBusy} onClick={() => galleryRef.current?.click()}>
                  Select Image
                </Button>
                <Button type="button" size="xs" variant="outline" disabled={photoBusy} onClick={() => cameraRef.current?.click()}>
                  Capture Photo
                </Button>
                {form.photo && !photoBusy && (
                  <Button
                    type="button"
                    size="xs"
                    variant="destructive"
                    onClick={() => {
                      photoFileRef.current = null;
                      photoDataRef.current = null;
                      setForm((x) => ({ ...x, photo: null }));
                    }}
                  >
                    Clear Photo
                  </Button>
                )}
              </div>
              <input
                ref={galleryRef}
                type="file"
                accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
                className="hidden"
                onChange={onPhotoInputChange}
              />
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onPhotoInputChange}
              />
            </div>

            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2.5 sm:grid-cols-2">
              <FieldWrap label="Class" className="sm:col-span-2">
                <NativeSelect value={form.classId} onChange={(e) => onClassChange(e.target.value)} className="w-full">
                  {classes.length === 0 && <NativeSelectOption value="">No classes</NativeSelectOption>}
                  {classes.map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>{formatClassDisplay(c)}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </FieldWrap>
              <FieldWrap label="Admission No (auto)">
                <Input value={form.admissionNo || suggestedNextAdm} readOnly className="w-full bg-muted/40" />
              </FieldWrap>
              <FieldWrap label="Roll No (auto)">
                <Input value={form.rollNo || suggestedNextRoll} readOnly className="w-full bg-muted/40" />
              </FieldWrap>
              <FieldWrap label="Student Name">
                <Input value={form.name} onChange={(e) => setForm((x) => ({ ...x, name: toProperCaseNameInput(e.target.value) }))} className="w-full" />
              </FieldWrap>
              <FieldWrap label="Father's Name">
                <Input value={form.fatherName} onChange={(e) => setForm((x) => ({ ...x, fatherName: toProperCaseNameInput(e.target.value) }))} className="w-full" />
              </FieldWrap>
              <FieldWrap label="Form B / Bay Form">
                <Input value={form.bayForm} onChange={(e) => setForm((x) => ({ ...x, bayForm: formatCnic(e.target.value) }))} placeholder="00000-0000000-0" className="w-full" />
              </FieldWrap>
              <FieldWrap label="Date of Birth">
                <Input value={form.dob} onChange={(e) => setForm((x) => ({ ...x, dob: formatDob(e.target.value) }))} placeholder="dd/mm/yyyy" className="w-full" />
              </FieldWrap>
              <FieldWrap label="WhatsApp No" className="sm:col-span-2">
                <Input value={form.whatsapp} onChange={(e) => setForm((x) => ({ ...x, whatsapp: formatWhatsapp(e.target.value) }))} placeholder="0000-0000000" className="w-full" />
              </FieldWrap>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void saveAdmission()} disabled={saving || photoBusy || !form.classId}>
              {saving ? "Processing…" : "Admit Student"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
