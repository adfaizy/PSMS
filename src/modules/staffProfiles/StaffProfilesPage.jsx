import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, startTransition } from "react";
import jsPDFModule from "jspdf";
import autoTable from "jspdf-autotable";
import { X, Plus, Edit2, Trash2, Upload, Download, Menu, Settings, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { yieldToMain } from "@/yieldToMain.js";
import { genId } from "@/shared/theme";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import * as H from "@/shared/helpers";

function FieldWrap({ label, htmlFor, required, children, className }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}

const STAFF_FORM_TABS = ["Personal", "Employment", "Qualifications", "Banking", "System"];

function staffFieldsForFormTab(tab) {
  const personalFields = ["name", "fname", "cnic", "dob", "domicile", "contact", "email", "address", "emergencyContact"];
  const employmentFields = ["staffCategory", "cpn", "designation", "bps", "doe", "dprs", "dppp", "daps"];
  const qualFields = ["aq", "subj", "pq"];
  const bankingFields = ["bankName", "accNo", "iban", "bankCode", "branch"];
  const systemFields = ["employeeStatus", "department"];
  if (tab === "Personal") return personalFields;
  if (tab === "Employment") return employmentFields;
  if (tab === "Qualifications") return qualFields;
  if (tab === "Banking") return bankingFields;
  if (tab === "System") return systemFields;
  return null;
}

const {
  formatGradeLabel, formatClassDisplay, resolveClass, getClassLabel, normKey,
  getClassSubjects, isTeachingStaffMember, teachingStaffList, normalizeRollNo,
  findStudentByAdmissionNo, getRollNumberScopeClassIds, findStudentByRollInClass,
  maxNumericFromAdmissionStrings, nextAdmissionNo, maxRollInClass, nextRollNoForClass,
  stripDuplicateAdmissionsForImport, dedupeStudentsByIdentity, fmtMin, academicSession,
  calcTimes, getTT, setTT, setTTSingleDay, parseABVariantSubject, isABCounterpartSubject,
  getPeriodLabel, timetablePdfPeriodCell, getClassesByPortion, getStaffInPortion,
  isPortionMaskFull, formatPortionMaskLabel, getClassesByPortionMask, getStaffInPortionMask,
  normalizeStaffCategory, toProperCase, toProperCaseNameInput, staffDateToDDMMYYYY,
  staffFormatCNIC, staffFormatPhone, staffFormatDateInput, excelDateToDDMMYYYY,
  parseMarksImportCell, parseWorkbook, getExportHeaderMeta, sanitizePdfFilenamePart,
  sanitizePdfCell, sanitizePdfTableRows, pdfDataUrlFormat, getTeachersWithAssignments,
  DASHBOARD_EXAM_LS, exportTableToPdf, exportTableToExcel, exportTimetableBatchPlannerPdf,
  exportConsolidatedSheetToPdf, getTableDataFromElement, teacherPlannerFooterColumns,
  drawTeacherPlannerFooterColumn, appendTeacherPlannerScheduleFooterPdf,
  isTeacherPlannerTimetablePdfTitle, downloadExcel, brandingLogoDataUrlForPdf,
} = H;

const jsPDF =
  typeof jsPDFModule === "function"
    ? jsPDFModule
    : jsPDFModule?.jsPDF ?? jsPDFModule?.default;


export const STAFF_PROFILE_FIELDS = [
  { id: "staffCategory", label: "Staff Category", type: "select", options: ["Teaching", "Non Teaching"] },
  { id: "cpn", label: "CPN (Computer Personal Number)", type: "text" },
  { id: "name", label: "Name Of Officer/Official", type: "text" },
  { id: "fname", label: "Father Name", type: "text" },
  { id: "cnic", label: "CNIC No", type: "text" },
  { id: "bps", label: "General Pay Scale (BPS)", type: "text" },
  { id: "designation", label: "Designation With Cadre", type: "text" },
  { id: "dob", label: "Date of Birth", type: "date" },
  { id: "domicile", label: "Domicile", type: "text" },
  { id: "aq", label: "Academic Qualification", type: "text" },
  { id: "subj", label: "Subject", type: "text" },
  { id: "pq", label: "Professional Qualification", type: "text" },
  { id: "doe", label: "Date Of Entry Into PSMS Services", type: "date" },
  { id: "dprs", label: "Date Of Award Regular Present Scale", type: "date" },
  { id: "dppp", label: "Date Of Posting At Present Place", type: "date" },
  { id: "daps", label: "Date Of Awarded Present Scale", type: "date" },
  { id: "contact", label: "Contact Number", type: "text" },
  { id: "email", label: "Email Address", type: "email" },
  { id: "bankName", label: "Bank Name", type: "text" },
  { id: "accNo", label: "Account Number", type: "text" },
  { id: "iban", label: "IBAN Number", type: "text" },
  { id: "bankCode", label: "Bank Code", type: "text" },
  { id: "branch", label: "Bank Branch Name", type: "text" },
  { id: "address", label: "Permanent Address", type: "textarea" },
  { id: "emergencyContact", label: "Emergency Contact", type: "text" },
  { id: "employeeStatus", label: "Employee Status", type: "select", options: ["Active", "Inactive", "On Leave", "Retired"] },
  { id: "department", label: "Department", type: "text" },
];

// Table header labels; form keeps STAFF_PROFILE_FIELDS labels
export const STAFF_PROFILE_TABLE_HEADERS = [
  // Personal Information
  { id: "photo", label: "Photo" },
  { id: "name", label: "Full Name" },
  { id: "fname", label: "Father's Name" },
  { id: "cnic", label: "CNIC" },
  { id: "dob", label: "DOB" },
  { id: "domicile", label: "Domicile" },
  { id: "contact", label: "Contact Number" },
  { id: "email", label: "Email Address" },
  { id: "address", label: "Address" },
  { id: "emergencyContact", label: "Emergency Contact" },
  // Employment & Service Details
  { id: "cpn", label: "Personal#" },
  { id: "staffCategory", label: "Category" },
  { id: "designation", label: "Designation" },
  { id: "bps", label: "BPS" },
  { id: "doe", label: "Date of Employment" },
  { id: "dprs", label: "Date of Present Scale" },
  { id: "dppp", label: "Date of Promotion" },
  { id: "daps", label: "Date of Appointment" },
  // Qualifications
  { id: "aq", label: "Academic Qual" },
  { id: "subj", label: "Subject" },
  { id: "pq", label: "Professional Qual" },
  // Banking & Financial Information
  { id: "bankName", label: "Bank Name" },
  { id: "accNo", label: "Account No" },
  { id: "iban", label: "IBAN" },
  { id: "bankCode", label: "Bank Code" },
  { id: "branch", label: "Branch Name" },
  // System & Action Fields
  { id: "employeeStatus", label: "Status" },
  { id: "department", label: "Department" },
];

export const STAFF_TABLE_GROUPS = [
  { title: "Personal Information", short: "Personal", count: 10, fields: ["photo", "name", "fname", "cnic", "dob", "domicile", "contact", "email", "address", "emergencyContact"] },
  { title: "Employment & Service Details", short: "Employment", count: 8, fields: ["cpn", "staffCategory", "designation", "bps", "doe", "dprs", "dppp", "daps"] },
  { title: "Qualifications", short: "Qualifications", count: 3, fields: ["aq", "subj", "pq"] },
  { title: "Banking & Financial Information", short: "Banking", count: 5, fields: ["bankName", "accNo", "iban", "bankCode", "branch"] },
  { title: "System & Action Fields", short: "System", count: 2, fields: ["employeeStatus", "department"] },
];

export const STAFF_PROFILE_HEADING_FIELDS = [
  { key: "schoolCode", label: "SCHOOL CODE" },
  { key: "ddoCode", label: "D.D.O CODE" },
  { key: "na", label: "N.A" },
  { key: "ppNo", label: "P.P.NO" },
  { key: "uc", label: "UC" },
  { key: "tehsil", label: "TEHSIL" },
  { key: "schoolPhoneNo", label: "SCHOOL PHONE NO" },
  { key: "forTheMonth", label: "FOR THE MONTH" },
];

export function StaffProfilesPage({ settings = {}, schools = [], staffProfiles, setSchools, activeSchoolId, currentSession }) {
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formTab, setFormTab] = useState("Personal"); // NEW STATE
  const [showSensitive, setShowSensitive] = useState(false); // NEW STATE
  const [tableTab, setTableTab] = useState("Teaching"); // NEW STATE
  const [colTab, setColTab] = useState("Personal Information");
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferStaff, setTransferStaff] = useState(null);
  const [transferType, setTransferType] = useState("school");
  const [transferTargetSchoolId, setTransferTargetSchoolId] = useState("");
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const fileInputRef = useRef(null);
  const safeProfiles = Array.isArray(staffProfiles) ? staffProfiles : [];
  const targetSchools = (Array.isArray(schools) ? schools : []).filter((s) => s?.id && s.id !== activeSchoolId && s.status !== "deleted");
  useEffect(() => {
    if (!transferOpen) return;
    if (transferType !== "school") return;
    const stillValid = targetSchools.some((s) => s.id === transferTargetSchoolId);
    queueMicrotask(() => {
      if (!stillValid) setTransferTargetSchoolId(targetSchools[0]?.id || "");
      if (targetSchools.length === 0) setTransferType("retired");
    });
  }, [transferOpen, transferType, transferTargetSchoolId, targetSchools]);

  const handleOpenForm = (profile = null) => {
    if (profile) {
      const normalized = { ...profile };
      normalized.staffCategory = normalizeStaffCategory(normalized.staffCategory);
      ["dob", "doe", "dprs", "dppp", "daps"].forEach((k) => {
        if (normalized[k]) normalized[k] = staffDateToDDMMYYYY(normalized[k]);
      });
      if (normalized.cnic) normalized.cnic = staffFormatCNIC(normalized.cnic);
      if (normalized.contact) normalized.contact = staffFormatPhone(normalized.contact);
      setEditingId(profile.id);
      setFormData(normalized);
    } else {
      setEditingId(null);
      // Match the open tab — otherwise Non Teaching adds were saved as Teaching by default.
      const defaultCategory = tableTab === "Non Teaching" ? "Non Teaching" : "Teaching";
      setFormData({ staffCategory: defaultCategory, employeeStatus: "Active" });
    }
    setFormTab("Personal");
    setIsFormOpen(true);
  };

  const openTransferDialog = (profile) => {
    setTransferStaff(profile);
    const hasTargetSchool = targetSchools.length > 0;
    setTransferType(hasTargetSchool ? "school" : "retired");
    setTransferTargetSchoolId(hasTargetSchool ? (targetSchools[0]?.id || "") : "");
    setTransferDate(new Date().toISOString().slice(0, 10));
    setTransferOpen(true);
  };

  const handleTransfer = () => {
    if (!transferStaff) return;
    if (transferType === "school" && (!transferTargetSchoolId || !targetSchools.some((s) => s.id === transferTargetSchoolId))) {
      alert("Please select a target school.");
      return;
    }
    const nowIso = new Date().toISOString();
    const transferRecord = {
      id: genId(),
      transferType: transferType === "school" ? "School to School" : "Retired",
      transferDate: transferDate || nowIso.slice(0, 10),
      transferTime: nowIso,
      fromSchoolId: activeSchoolId,
      toSchoolId: transferType === "school" ? transferTargetSchoolId : null,
      staffId: transferStaff.id,
      staffSnapshot: { ...transferStaff, staffCategory: normalizeStaffCategory(transferStaff.staffCategory) },
    };
    setSchools((prev) =>
      prev.map((s) => {
        const isFrom = s.id === activeSchoolId;
        const isTo = transferType === "school" && s.id === transferTargetSchoolId;
        if (!isFrom && !isTo) return s;
        const next = { ...s };
        next.staffTransferHistory = [...(s.staffTransferHistory || []), transferRecord];
        if (isFrom) {
          next.staffProfiles = (s.staffProfiles || []).filter((p) => p.id !== transferStaff.id);
          if (transferType === "retired") {
            next.retiredStaff = [...(s.retiredStaff || []), { ...transferStaff, retiredAt: nowIso, retiredDate: transferDate || nowIso.slice(0, 10) }];
          }
        }
        if (isTo) {
          const moved = {
            ...transferStaff,
            transferInfo: {
              type: "School to School",
              fromSchoolId: activeSchoolId,
              toSchoolId: transferTargetSchoolId,
              transferDate: transferDate || nowIso.slice(0, 10),
              transferTime: nowIso,
            },
          };
          const existing = (s.staffProfiles || []).filter((p) => p.id !== transferStaff.id);
          next.staffProfiles = [...existing, moved];
        }
        return next;
      })
    );
    setTransferOpen(false);
    setTransferStaff(null);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.name) {
      alert("Name is required.");
      return;
    }
    const newId = editingId || genId();
    const category = normalizeStaffCategory(formData.staffCategory);
    const payload = { ...formData, id: newId, staffCategory: category };
    setSchools((prev) =>
      prev.map((s) => {
        if (s.id !== activeSchoolId) return s;
        let nextProfiles = [...(s.staffProfiles || [])];
        if (editingId) {
          nextProfiles = nextProfiles.map((p) => (p.id === editingId ? payload : p));
        } else {
          nextProfiles.push(payload);
        }
        return { ...s, staffProfiles: nextProfiles };
      })
    );
    setTableTab(category);
    setIsFormOpen(false);
  };

  const handleDelete = (id) => {
    if (!confirm("Are you sure you want to delete this staff profile?")) return;
    setSchools((prev) =>
      prev.map((s) => {
        if (s.id !== activeSchoolId) return s;
        return { ...s, staffProfiles: (s.staffProfiles || []).filter((p) => p.id !== id) };
      })
    );
  };
  const moveStaffWithinCategory = (id, direction) => {
    setSchools((prev) =>
      prev.map((s) => {
        if (s.id !== activeSchoolId) return s;
        const list = [...(s.staffProfiles || [])];
        const currentIdx = list.findIndex((p) => p.id === id);
        if (currentIdx < 0) return s;
        const currentCategory = normalizeStaffCategory(list[currentIdx].staffCategory);
        const sameCategoryIdxs = list
          .map((p, i) => ({ i, cat: normalizeStaffCategory(p.staffCategory) }))
          .filter((x) => x.cat === currentCategory)
          .map((x) => x.i);
        const posInCat = sameCategoryIdxs.indexOf(currentIdx);
        if (posInCat < 0) return s;
        const targetPos = direction === "up" ? posInCat - 1 : posInCat + 1;
        if (targetPos < 0 || targetPos >= sameCategoryIdxs.length) return s;
        const targetIdx = sameCategoryIdxs[targetPos];
        const temp = list[currentIdx];
        list[currentIdx] = list[targetIdx];
        list[targetIdx] = temp;
        return { ...s, staffProfiles: list };
      })
    );
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      let photo = ev.target.result;
      try {
        if (typeof photo === "string" && photo.startsWith("data:image")) {
          const { uploadDataUrlPhoto } = await import("../../lib/photoStorage.js");
          photo = await uploadDataUrlPhoto(photo, `${activeSchoolId || "school"}/staff/${editingId || "new"}`);
        }
      } catch (err) {
        console.warn("Staff photo cloud upload skipped", err);
      }
      setFormData((prev) => ({ ...prev, photo, photoPosition: prev.photoPosition || "50% 50%" }));
    };
    reader.readAsDataURL(file);
  };

  const PHOTO_POSITIONS = [
    { label: "↖", value: "0% 0%" },
    { label: "↑", value: "50% 0%" },
    { label: "↗", value: "100% 0%" },
    { label: "←", value: "0% 50%" },
    { label: "●", value: "50% 50%" },
    { label: "→", value: "100% 50%" },
    { label: "↙", value: "0% 100%" },
    { label: "↓", value: "50% 100%" },
    { label: "↘", value: "100% 100%" },
  ];
  const photoPosition = formData.photoPosition || "50% 50%";

  const activeFormFieldIds = staffFieldsForFormTab(formTab);

  if (isFormOpen) {
    return (
      <Card className="min-h-full border-border/70 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg text-primary">{editingId ? "Edit Staff Profile" : "Add Staff Profile"}</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setIsFormOpen(false)}>
            <X className="mr-1" />
            Cancel
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="grid gap-8 lg:grid-cols-[200px_1fr]">
            <div className="flex flex-col items-center gap-3">
              <div className="relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/20">
                {formData.photo ? (
                  <img
                    src={formData.photo}
                    alt="Staff"
                    className="h-full w-full object-cover"
                    style={{ objectPosition: photoPosition }}
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Upload className="mx-auto mb-2 opacity-50" size={32} />
                    <div className="text-xs">Upload Photo</div>
                  </div>
                )}
              </div>
              {formData.photo && (
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground">Adjust position</span>
                  <div className="grid grid-cols-3 gap-1">
                    {PHOTO_POSITIONS.map((pos) => (
                      <Button
                        key={pos.value}
                        type="button"
                        variant={photoPosition === pos.value ? "default" : "outline"}
                        size="icon-xs"
                        onClick={() => setFormData((prev) => ({ ...prev, photoPosition: pos.value }))}
                        title={pos.value}
                        className="text-xs"
                      >
                        {pos.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                Select Image
              </Button>
              {formData.photo && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setFormData({ ...formData, photo: null })}
                >
                  Clear Photo
                </Button>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <Tabs value={formTab} onValueChange={setFormTab}>
                <TabsList className="h-auto w-full flex-wrap justify-start">
                  {STAFF_FORM_TABS.map((tab) => (
                    <TabsTrigger key={tab} value={tab}>
                      {tab}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {STAFF_PROFILE_FIELDS.filter((field) => activeFormFieldIds?.includes(field.id)).map((field) => {
                  const isDate = field.type === "date";
                  const isTextProper = ["name", "fname", "designation", "domicile", "aq", "subj", "pq", "bankName", "branch", "address"].includes(field.id);
                  const value = formData[field.id] || "";
                  const inputId = `staff-field-${field.id}`;
                  const handleChange = (e) => {
                    let v = e.target.value;
                    if (field.id === "iban") v = v.replace(/[\W_]+/g, "").toUpperCase().slice(0, 24);
                    setFormData({ ...formData, [field.id]: v });
                  };
                  const handleBlur = (e) => {
                    const v = e.target.value;
                    if (field.id === "cnic") setFormData((prev) => ({ ...prev, [field.id]: staffFormatCNIC(v) }));
                    else if (field.id === "contact") setFormData((prev) => ({ ...prev, [field.id]: staffFormatPhone(v) }));
                    else if (isDate) setFormData((prev) => ({ ...prev, [field.id]: staffFormatDateInput(v) }));
                    else if (isTextProper && field.type !== "email") setFormData((prev) => ({ ...prev, [field.id]: toProperCase(v) }));
                  };
                  const onChange = (e) => {
                    let v = e.target.value;
                    if (field.id === "cnic") setFormData({ ...formData, [field.id]: staffFormatCNIC(v) });
                    else if (field.id === "contact") setFormData({ ...formData, [field.id]: staffFormatPhone(v) });
                    else if (field.id === "iban") setFormData({ ...formData, [field.id]: v.replace(/[\W_]+/g, "").toUpperCase().slice(0, 24) });
                    else if (isDate) setFormData({ ...formData, [field.id]: staffFormatDateInput(v) });
                    else setFormData({ ...formData, [field.id]: v });
                  };
                  return (
                    <FieldWrap
                      key={field.id}
                      label={field.label}
                      htmlFor={inputId}
                      required={field.id === "name"}
                      className={field.type === "textarea" ? "sm:col-span-2" : undefined}
                    >
                      {field.type === "textarea" ? (
                        <Textarea
                          id={inputId}
                          value={value}
                          onChange={handleChange}
                          onBlur={(e) => isTextProper && setFormData((prev) => ({ ...prev, [field.id]: toProperCase(e.target.value) }))}
                          placeholder={`Enter ${field.label}`}
                          className="min-h-[80px]"
                        />
                      ) : field.type === "select" ? (
                        <NativeSelect id={inputId} value={value || (field.options && field.options[0]) || ""} onChange={handleChange} className="w-full">
                          {(field.options || []).map((opt) => (
                            <NativeSelectOption key={opt} value={opt}>
                              {opt}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      ) : (
                        <Input
                          id={inputId}
                          type={isDate ? "text" : field.type}
                          value={value}
                          onChange={onChange}
                          onBlur={handleBlur}
                          placeholder={isDate ? "dd/mm/yyyy" : field.type === "email" ? "" : undefined}
                          maxLength={field.id === "iban" ? 24 : isDate ? 10 : field.id === "cnic" ? 15 : field.id === "contact" ? 12 : undefined}
                          className="w-full"
                        />
                      )}
                    </FieldWrap>
                  );
                })}
              </div>

              <Separator />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Profile</Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }


  const teacherProfiles = safeProfiles.filter((p) => normalizeStaffCategory(p.staffCategory) === "Teaching");
  const workerProfiles = safeProfiles.filter((p) => normalizeStaffCategory(p.staffCategory) === "Non Teaching");
  const activeRows = tableTab === "Non Teaching" ? workerProfiles : teacherProfiles;
  const activeGroup = STAFF_TABLE_GROUPS.find((g) => g.title === colTab) || STAFF_TABLE_GROUPS[0];
  const visibleHeaders = STAFF_PROFILE_TABLE_HEADERS.filter((h) => {
    if (h.id === "photo" || h.id === "name") return true;
    return activeGroup.fields.includes(h.id);
  });
  const nowrapFields = new Set(["cnic", "dob", "contact", "email", "emergencyContact"]);

  const buildExportRows = () => {
    const headers = STAFF_PROFILE_TABLE_HEADERS.map((h) => h.label);
    const rows = safeProfiles.map((p) =>
      STAFF_PROFILE_TABLE_HEADERS.map((h) => {
        const v = p[h.id];
        if (h.id === "staffCategory") return normalizeStaffCategory(p.staffCategory);
        if (v == null || v === "") return "—";
        const s = String(v).trim();
        if (["dob", "doe", "dprs", "dppp", "daps"].includes(h.id)) return staffDateToDDMMYYYY(s) || "—";
        if (h.id === "cnic") return staffFormatCNIC(s) || "—";
        if (h.id === "contact") return staffFormatPhone(s) || "—";
        if (["name", "fname", "designation", "domicile", "aq", "subj", "pq", "bankName", "branch", "address"].includes(h.id)) {
          return toProperCase(s) || "—";
        }
        return h.id === "photo" ? (p.photo ? "Photo" : "—") : s;
      }),
    );
    return { headers, rows };
  };

  const cellVal = (p, id) => {
    if (id === "staffCategory") return normalizeStaffCategory(p.staffCategory);
    const v = p[id];
    if (v == null || v === "") return "—";
    if (typeof v === "object" || typeof v === "function") return "—";
    const s = String(v).trim();
    const sensitive = ["cnic", "contact", "accNo", "iban"];
    if (!showSensitive && sensitive.includes(id)) {
      if (id === "cnic" && s.length >= 13) return `•••••-•••••••-${s.slice(-1)}`;
      if (id === "contact" && s.length >= 11) return `${s.slice(0, 4)} ••••• ${s.slice(-2)}`;
      if ((id === "accNo" || id === "iban") && s.length > 6) return `${s.slice(0, 4)}••••••••${s.slice(-4)}`;
      return "••••••••";
    }
    if (["dob", "doe", "dprs", "dppp", "daps"].includes(id)) return staffDateToDDMMYYYY(s) || "—";
    if (id === "cnic") return staffFormatCNIC(s) || "—";
    if (id === "contact" || id === "emergencyContact") return staffFormatPhone(s) || s || "—";
    if (["name", "fname", "designation", "domicile", "aq", "subj", "pq", "bankName", "branch", "address"].includes(id)) {
      return toProperCase(s) || "—";
    }
    return s;
  };

  return (
    <div className="flex flex-col gap-3">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="gap-3 space-y-0 pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base">Staff directory</CardTitle>
                <CardDescription>
                  {safeProfiles.length} profile{safeProfiles.length === 1 ? "" : "s"} · {activeGroup.short || activeGroup.title} columns
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {safeProfiles.length > 0 && (
                  <>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowSensitive(!showSensitive)}>
                      {showSensitive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      {showSensitive ? "Hide Sensitive" : "Show Sensitive"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const { headers, rows } = buildExportRows();
                        void exportTableToPdf(settings, currentSession, "Staff Profiles", headers, rows, "Staff_Profiles.pdf").catch(() =>
                          alert("PDF export failed."),
                        );
                      }}
                    >
                      Export PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const { headers, rows } = buildExportRows();
                        void exportTableToExcel(settings, currentSession, "Staff Profiles", headers, rows, "Staff_Profiles.xlsx");
                      }}
                    >
                      Export Excel
                    </Button>
                  </>
                )}
                <Button size="sm" onClick={() => handleOpenForm()}>
                  <Plus className="size-4" />
                  Add Profile
                </Button>
              </div>
            </div>

            {safeProfiles.length > 0 && (
              <div className="flex flex-col gap-2">
                <Tabs value={tableTab} onValueChange={setTableTab}>
                  <TabsList>
                    <TabsTrigger value="Teaching">Teaching ({teacherProfiles.length})</TabsTrigger>
                    <TabsTrigger value="Non Teaching">Non Teaching ({workerProfiles.length})</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Tabs value={colTab} onValueChange={setColTab}>
                  <div className="overflow-x-auto">
                    <TabsList className="h-9 w-max max-w-none">
                      {STAFF_TABLE_GROUPS.map((g) => (
                        <TabsTrigger key={g.title} value={g.title} className="shrink-0">
                          {g.short || g.title}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                </Tabs>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {safeProfiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 px-6 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Plus className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold">No staff profiles yet</h3>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  Add your first profile to record CPN, qualifications, service dates, and banking details.
                </p>
              </div>
              <Button onClick={() => handleOpenForm()}>Add First Profile</Button>
            </div>
          ) : activeRows.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
              No profiles in this category.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    {visibleHeaders.map((h) => (
                      <TableHead key={h.id} className="whitespace-nowrap font-semibold">
                        {h.label}
                      </TableHead>
                    ))}
                    <TableHead className="whitespace-nowrap text-center font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeRows.map((p, i) => (
                    <TableRow key={p.id != null ? p.id : `row-${i}`}>
                      {visibleHeaders.map((h) => {
                        const value = cellVal(p, h.id);
                        return (
                          <TableCell
                            key={h.id}
                            className={cn(
                              "align-middle",
                              h.id === "name" && "font-semibold text-primary",
                              nowrapFields.has(h.id) && "whitespace-nowrap",
                              h.id === "address" && "max-w-[220px] whitespace-normal",
                            )}
                            title={nowrapFields.has(h.id) || h.id === "address" ? String(value) : undefined}
                          >
                            {h.id === "photo" ? (
                              <Avatar size="sm">
                                {p.photo && typeof p.photo === "string" ? (
                                  <AvatarImage src={p.photo} alt="" style={{ objectPosition: p.photoPosition || "50% 50%" }} />
                                ) : null}
                                <AvatarFallback>
                                  {p.name && typeof p.name === "string" ? p.name.charAt(0).toUpperCase() : "?"}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              value
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="align-middle">
                        <div className="flex flex-nowrap items-center justify-center gap-1">
                          <Button type="button" variant="outline" size="icon-sm" onClick={() => handleOpenForm(p)} title="Edit">
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button type="button" variant="destructive" size="icon-sm" onClick={() => handleDelete(p.id)} title="Delete">
                            <Trash2 className="size-3.5" />
                          </Button>
                          <Button type="button" variant="outline" size="icon-sm" onClick={() => moveStaffWithinCategory(p.id, "up")} title="Move Up">
                            ↑
                          </Button>
                          <Button type="button" variant="outline" size="icon-sm" onClick={() => moveStaffWithinCategory(p.id, "down")} title="Move Down">
                            ↓
                          </Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => openTransferDialog(p)} title="Transfer">
                            Transfer
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer Staff</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {transferStaff?.name ? `Staff: ${transferStaff.name}` : "Select transfer details."}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldWrap label="Transfer Type" htmlFor="staff-transfer-type">
              <NativeSelect id="staff-transfer-type" value={transferType} onChange={(e) => setTransferType(e.target.value)} className="w-full">
                <NativeSelectOption value="school" disabled={targetSchools.length === 0}>
                  School to School
                </NativeSelectOption>
                <NativeSelectOption value="retired">Retired</NativeSelectOption>
              </NativeSelect>
            </FieldWrap>
            {transferType === "school" && (
              <FieldWrap label="Target School" htmlFor="staff-transfer-target">
                <NativeSelect
                  id="staff-transfer-target"
                  value={transferTargetSchoolId}
                  onChange={(e) => setTransferTargetSchoolId(e.target.value)}
                  className="w-full"
                >
                  {targetSchools.length === 0 && (
                    <NativeSelectOption value="">No active target school available</NativeSelectOption>
                  )}
                  {targetSchools.map((s) => (
                    <NativeSelectOption key={s.id} value={s.id}>
                      {s.name || s.id}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FieldWrap>
            )}
            <FieldWrap label="Transfer Date" htmlFor="staff-transfer-date" className={transferType === "school" ? undefined : "sm:col-span-2"}>
              <Input
                id="staff-transfer-date"
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full"
              />
            </FieldWrap>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={handleTransfer} disabled={transferType === "school" && targetSchools.length === 0}>
              Save Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
