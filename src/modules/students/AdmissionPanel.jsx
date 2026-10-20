import React, { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Trash2, UserPlus } from "lucide-react";
import { SchoolHeader } from "@/components/AppControls";
import { genId } from "@/shared/theme";
import * as H from "@/shared/helpers";
import { STUDENT_STATUS } from "./studentsCore.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
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

function FieldWrap({ label, children, className, hint }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
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
  const photoDataRef = useRef(null);
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

  const selectedClass = classes.find((c) => c.id === form.classId);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <SchoolHeader settings={settings} subtitle="STUDENT ADMISSION" />

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">New admission</CardTitle>
              <CardDescription className="mt-1">
                Choose class first. Admission and roll numbers are assigned automatically.
              </CardDescription>
            </div>
            {selectedClass ? (
              <Badge variant="secondary">{formatClassDisplay(selectedClass)}</Badge>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="mx-auto flex w-[7.5rem] shrink-0 flex-col items-stretch gap-2 sm:mx-0">
              <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/30">
                {photoBusy ? (
                  <div className="flex flex-col items-center gap-2 px-2 text-center">
                    <Spinner className="size-5" />
                    <span className="text-[10px] text-muted-foreground">{photoStatus || "Processing…"}</span>
                  </div>
                ) : isDisplayablePhotoSrc(form.photo) ? (
                  <img src={form.photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="px-2 text-center text-[11px] text-muted-foreground">Student photo</span>
                )}
              </div>
              <Button type="button" size="sm" variant="outline" disabled={photoBusy} onClick={() => galleryRef.current?.click()}>
                <ImagePlus className="size-3.5" />
                Select Image
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={photoBusy} onClick={() => cameraRef.current?.click()}>
                <Camera className="size-3.5" />
                Capture Photo
              </Button>
              {form.photo && !photoBusy ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    photoFileRef.current = null;
                    photoDataRef.current = null;
                    setForm((x) => ({ ...x, photo: null }));
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Clear
                </Button>
              ) : null}
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

            <div className="min-w-0 flex-1 space-y-4">
              <FieldWrap label="Class" hint={classes.length === 0 ? "Add classes in Settings first." : undefined}>
                <NativeSelect
                  value={form.classId}
                  onChange={(e) => onClassChange(e.target.value)}
                  className="w-full"
                  disabled={!classes.length}
                >
                  {classes.length === 0 && <NativeSelectOption value="">No classes</NativeSelectOption>}
                  {classes.map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>{formatClassDisplay(c)}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </FieldWrap>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldWrap label="Admission No">
                  <Input value={form.admissionNo || suggestedNextAdm} readOnly className="bg-muted/40 font-medium tabular-nums" />
                </FieldWrap>
                <FieldWrap label="Roll No">
                  <Input value={form.rollNo || suggestedNextRoll} readOnly className="bg-muted/40 font-medium tabular-nums" />
                </FieldWrap>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldWrap label="Student Name" className="sm:col-span-2">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((x) => ({ ...x, name: toProperCaseNameInput(e.target.value) }))}
                    placeholder="Full name"
                    autoComplete="name"
                  />
                </FieldWrap>
                <FieldWrap label="Father's Name" className="sm:col-span-2">
                  <Input
                    value={form.fatherName}
                    onChange={(e) => setForm((x) => ({ ...x, fatherName: toProperCaseNameInput(e.target.value) }))}
                    placeholder="Father's full name"
                  />
                </FieldWrap>
                <FieldWrap label="Form B / Bay Form">
                  <Input
                    value={form.bayForm}
                    onChange={(e) => setForm((x) => ({ ...x, bayForm: formatCnic(e.target.value) }))}
                    placeholder="00000-0000000-0"
                    inputMode="numeric"
                  />
                </FieldWrap>
                <FieldWrap label="Date of Birth">
                  <Input
                    value={form.dob}
                    onChange={(e) => setForm((x) => ({ ...x, dob: formatDob(e.target.value) }))}
                    placeholder="dd/mm/yyyy"
                    inputMode="numeric"
                  />
                </FieldWrap>
                <FieldWrap label="WhatsApp No" className="sm:col-span-2">
                  <Input
                    value={form.whatsapp}
                    onChange={(e) => setForm((x) => ({ ...x, whatsapp: formatWhatsapp(e.target.value) }))}
                    placeholder="0000-0000000"
                    inputMode="tel"
                  />
                </FieldWrap>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 py-3">
          <p className="text-xs text-muted-foreground">Required: class and student name.</p>
          <Button onClick={() => void saveAdmission()} disabled={saving || photoBusy || !form.classId || !classes.length}>
            {saving ? (
              <>
                <Spinner className="size-3.5" />
                Saving…
              </>
            ) : (
              <>
                <UserPlus className="size-3.5" />
                Admit Student
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
