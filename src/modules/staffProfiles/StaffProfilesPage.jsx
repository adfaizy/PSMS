import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, startTransition } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "@/xlsxClient.js";
import JSZip from "@/jszipClient.js";
import jsPDFModule from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { X, Plus, Edit2, Trash2, Upload, Download, Menu, Settings, AlertTriangle, Eye, EyeOff } from "lucide-react";
import * as feeCore from "@/modules/fee/feeCore";
import { feeService, systemSettingsService, dashboardService } from "@/services";
import { UI } from "@/uiTokens.js";
import signImg from "@/assets/sign.png";
import { yieldToMain } from "@/yieldToMain.js";
import { C, schoolOrBrandLogo, APP_BRAND_LOGO, genId } from "@/shared/theme";
import { Btn, Sel, Inp, SchoolHeader } from "@/components/AppControls";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import * as H from "@/shared/helpers";

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
  { title: "Personal Information", count: 10, fields: ["photo", "name", "fname", "cnic", "dob", "domicile", "contact", "email", "address", "emergencyContact"] },
  { title: "Employment & Service Details", count: 8, fields: ["cpn", "staffCategory", "designation", "bps", "doe", "dprs", "dppp", "daps"] },
  { title: "Qualifications", count: 3, fields: ["aq", "subj", "pq"] },
  { title: "Banking & Financial Information", count: 5, fields: ["bankName", "accNo", "iban", "bankCode", "branch"] },
  { title: "System & Action Fields", count: 2, fields: ["employeeStatus", "department"] },
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
      setFormData({ staffCategory: "Teaching", employeeStatus: "Active" });
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
    const payload = { ...formData, id: newId, staffCategory: normalizeStaffCategory(formData.staffCategory) };
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
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFormData((prev) => ({ ...prev, photo: ev.target.result, photoPosition: prev.photoPosition || "50% 50%" }));
      };
      reader.readAsDataURL(file);
    }
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

  if (isFormOpen) {
    return (
      <>
        <div style={{ background: "#fff", padding: 24, borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: C.navy, fontSize: 20 }}>{editingId ? "Edit Staff Profile" : "Add Staff Profile"}</h2>
          <Btn outline color={C.gray} onClick={() => setIsFormOpen(false)}><X size={16} style={{ marginRight: 4 }} /> Cancel</Btn>
        </div>

        <form onSubmit={handleSave} style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 32 }}>
          {/* Photo Section */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 160, height: 160, borderRadius: 8, border: "2px dashed #d1d5db", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
              {formData.photo ? (
                <img
                  src={formData.photo}
                  alt="Staff"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: photoPosition,
                  }}
                />
              ) : (
                <div style={{ textAlign: "center", color: C.gray }}>
                  <Upload size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <div style={{ fontSize: 12 }}>Upload Photo</div>
                </div>
              )}
            </div>
            {formData.photo && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.gray }}>Adjust position</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                  {PHOTO_POSITIONS.map((pos) => (
                    <button
                      key={pos.value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, photoPosition: pos.value }))}
                      title={pos.value}
                      style={{
                        width: 28,
                        height: 28,
                        padding: 0,
                        border: photoPosition === pos.value ? "2px solid " + C.navy : "1px solid #d1d5db",
                        borderRadius: 4,
                        background: photoPosition === pos.value ? C.navyL : "#fff",
                        color: photoPosition === pos.value ? C.navy : C.gray,
                        cursor: "pointer",
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <input type="file" ref={fileInputRef} accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />
            <Btn small outline onClick={() => fileInputRef.current?.click()}>Choose Image...</Btn>
            {formData.photo && <Btn small danger style={{ marginTop: -4 }} onClick={() => setFormData({ ...formData, photo: null })}>Remove Photo</Btn>}
          </div>

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Tabs for fields */}
            <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #e5e7eb", paddingBottom: 8, overflowX: "auto" }}>
              {["Personal", "Employment", "Qualifications", "Banking", "System"].map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={(e) => { e.preventDefault(); setFormTab(tab); }}
                  style={{ padding: "6px 12px", borderRadius: 4, border: "none", background: formTab === tab ? C.navy : "#f3f4f6", color: formTab === tab ? "#fff" : C.gray, cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" }}>
            {STAFF_PROFILE_FIELDS.filter(field => {
              const personalFields = ["name", "fname", "cnic", "dob", "domicile", "contact", "email", "address", "emergencyContact"];
              const employmentFields = ["staffCategory", "cpn", "designation", "bps", "doe", "dprs", "dppp", "daps"];
              const qualFields = ["aq", "subj", "pq"];
              const bankingFields = ["bankName", "accNo", "iban", "bankCode", "branch"];
              const systemFields = ["employeeStatus", "department"];

              if (formTab === "Personal") return personalFields.includes(field.id);
              if (formTab === "Employment") return employmentFields.includes(field.id);
              if (formTab === "Qualifications") return qualFields.includes(field.id);
              if (formTab === "Banking") return bankingFields.includes(field.id);
              if (formTab === "System") return systemFields.includes(field.id);
              return true;
            }).map((field) => {
              const isDate = field.type === "date";
              const isTextProper = ["name", "fname", "designation", "domicile", "aq", "subj", "pq", "bankName", "branch", "address"].includes(field.id);
              const value = formData[field.id] || "";
              const handleChange = (e) => {
                let v = e.target.value;
                if (field.id === "iban") v = v.replace(/[\W_]+/g,"").toUpperCase().slice(0, 24); // IBAN structure formatting
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
                else if (field.id === "iban") setFormData({ ...formData, [field.id]: v.replace(/[\W_]+/g,"").toUpperCase().slice(0, 24) });
                else if (isDate) setFormData({ ...formData, [field.id]: staffFormatDateInput(v) });
                else setFormData({ ...formData, [field.id]: v });
              };
              return (
              <div key={field.id} style={{ gridColumn: field.type === "textarea" ? "1 / span 2" : "auto" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.gray, marginBottom: 4 }}>
                  {field.label} {field.id === "name" && <span style={{ color: C.red }}>*</span>}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    value={value}
                    onChange={handleChange}
                    onBlur={(e) => isTextProper && setFormData((prev) => ({ ...prev, [field.id]: toProperCase(e.target.value) }))}
                    placeholder={`Enter ${field.label}`}
                    style={{ width: "100%", padding: "8px 12px", border: "1.5px solid #d1d5db", borderRadius: 6, fontSize: 13, minHeight: 80, boxSizing: "border-box", fontFamily: "inherit" }}
                  />
                ) : field.type === "select" ? (
                  <select
                    value={value || (field.options && field.options[0]) || ""}
                    onChange={handleChange}
                    style={{ width: "100%", padding: "8px 12px", border: "1.5px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box", background: "#fff" }}
                  >
                    {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    type={isDate ? "text" : field.type}
                    value={value}
                    onChange={onChange}
                    onBlur={handleBlur}
                    placeholder={isDate ? "dd/mm/yyyy" : field.type === "email" ? "" : undefined}
                    maxLength={field.id === "iban" ? 24 : isDate ? 10 : field.id === "cnic" ? 15 : field.id === "contact" ? 12 : undefined}
                    style={{ width: "100%", padding: "8px 12px", border: "1.5px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
                  />
                )}
              </div>
            );})}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 20 }}>
              <Btn outline color={C.gray} onClick={() => setIsFormOpen(false)}>Cancel</Btn>
              <Btn type="submit">Save Profile</Btn>
            </div>
          </div>
        </form>
        </div>
      </>
    );
  }


  const teacherProfiles = safeProfiles.filter((p) => normalizeStaffCategory(p.staffCategory) === "Teaching");
  const workerProfiles = safeProfiles.filter((p) => normalizeStaffCategory(p.staffCategory) === "Non Teaching");

  return (
    <Card className="min-h-full border-border/70 shadow-sm">
      <CardContent className="space-y-4 p-5">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-[200px] flex-1 overflow-x-auto">
            {safeProfiles.length > 0 && (
              <Tabs value={tableTab} onValueChange={setTableTab}>
                <TabsList className="h-auto">
                  <TabsTrigger value="Teaching">Teaching ({teacherProfiles.length})</TabsTrigger>
                  <TabsTrigger value="Non Teaching">Non Teaching ({workerProfiles.length})</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {safeProfiles.length > 0 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSensitive(!showSensitive)}
                  className="gap-1.5"
                >
                  {showSensitive ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showSensitive ? "Hide Sensitive Data" : "Show Sensitive Data"}
                </Button>
                <Btn outline small onClick={() => { const headers = STAFF_PROFILE_TABLE_HEADERS.map((h) => h.label); const rows = safeProfiles.map((p) => STAFF_PROFILE_TABLE_HEADERS.map((h) => { const v = p[h.id]; if (h.id === "staffCategory") return normalizeStaffCategory(p.staffCategory); if (v == null || v === "") return "—"; const s = String(v).trim(); if (["dob", "doe", "dprs", "dppp", "daps"].includes(h.id)) return staffDateToDDMMYYYY(s) || "—"; if (h.id === "cnic") return staffFormatCNIC(s) || "—"; if (h.id === "contact") return staffFormatPhone(s) || "—"; if (["name", "fname", "designation", "domicile", "aq", "subj", "pq", "bankName", "branch", "address"].includes(h.id)) return toProperCase(s) || "—"; return h.id === "photo" ? (p.photo ? "Photo" : "—") : s; })); void exportTableToPdf(settings, currentSession, "Staff Profiles", headers, rows, "Staff_Profiles.pdf").catch(()=>alert("PDF export failed.")); }}>📄 PDF</Btn>
                <Btn outline small onClick={() => { const headers = STAFF_PROFILE_TABLE_HEADERS.map((h) => h.label); const rows = safeProfiles.map((p) => STAFF_PROFILE_TABLE_HEADERS.map((h) => { const v = p[h.id]; if (h.id === "staffCategory") return normalizeStaffCategory(p.staffCategory); if (v == null || v === "") return "—"; const s = String(v).trim(); if (["dob", "doe", "dprs", "dppp", "daps"].includes(h.id)) return staffDateToDDMMYYYY(s) || "—"; if (h.id === "cnic") return staffFormatCNIC(s) || "—"; if (h.id === "contact") return staffFormatPhone(s) || "—"; if (["name", "fname", "designation", "domicile", "aq", "subj", "pq", "bankName", "branch", "address"].includes(h.id)) return toProperCase(s) || "—"; return h.id === "photo" ? (p.photo ? "Photo" : "—") : s; })); void exportTableToExcel(settings, currentSession, "Staff Profiles", headers, rows, "Staff_Profiles.xlsx"); }}>📊 Excel</Btn>
              </>
            )}
            <Btn onClick={() => handleOpenForm()}><Plus size={16} style={{ marginRight: 6, verticalAlign: "middle" }} /> Add Profile</Btn>
          </div>
        </div>
        {safeProfiles.length > 0 && (
          <Tabs value={colTab} onValueChange={setColTab}>
            <TabsList className="h-auto flex-wrap">
              {STAFF_TABLE_GROUPS.map((g) => (
                <TabsTrigger key={g.title} value={g.title}>{g.title}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>


      {transferOpen && (
        <div style={{ marginBottom: 16, padding: 14, border: "1px solid #cbd5e1", borderRadius: 8, background: "#f8fafc" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <strong style={{ color: C.navy }}>Transfer Staff</strong>
            <Btn small outline color={C.gray} onClick={() => setTransferOpen(false)}>Close</Btn>
          </div>
          <div style={{ fontSize: 12, color: C.gray, marginBottom: 10 }}>
            {transferStaff?.name ? `Staff: ${transferStaff.name}` : "Select transfer details."}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, alignItems: "end" }}>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: C.gray, fontWeight: 600 }}>Transfer Type</label>
              <select value={transferType} onChange={(e) => setTransferType(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 6 }}>
                <option value="school" disabled={targetSchools.length === 0}>School to School</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            {transferType === "school" && (
              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: C.gray, fontWeight: 600 }}>Target School</label>
                <select value={transferTargetSchoolId} onChange={(e) => setTransferTargetSchoolId(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 6 }}>
                  {targetSchools.length === 0 && <option value="">No active target school available</option>}
                  {targetSchools.map((s) => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: C.gray, fontWeight: 600 }}>Transfer Date</label>
              <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 6 }} />
            </div>
            <div>
              <Btn onClick={handleTransfer} disabled={transferType === "school" && targetSchools.length === 0}>Save Transfer</Btn>
            </div>
          </div>
        </div>
      )}
      {safeProfiles.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "#f9fafb", borderRadius: 8, border: "2px dashed #e5e7eb" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👨‍🏫</div>
          <h3 style={{ margin: "0 0 8px", color: C.navy }}>No Staff Profiles Found</h3>
          <p style={{ margin: 0, color: C.gray, fontSize: 13, maxWidth: 400, marginInline: "auto" }}>Get started by adding your first staff profile. You can record comprehensive details including CPN, qualifications, dates of entry, and banking info.</p>
          <br />
          <Btn onClick={() => handleOpenForm()}>Add First Profile</Btn>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 18 }}>

          {[{ title: "Teaching", rows: teacherProfiles }, { title: "Non Teaching", rows: workerProfiles }]
            .filter(section => section.title === tableTab)
            .map((section) => {
              const visibleHeaders = STAFF_PROFILE_TABLE_HEADERS.filter(h => {
                const isSticky = h.id === "photo" || h.id === "name";
                if (isSticky) return true;
                const group = STAFF_TABLE_GROUPS.find(g => g.title === colTab);
                return group && group.fields.includes(h.id);
              });
              const nowrapFields = new Set(["cnic", "dob", "contact", "email", "emergencyContact"]);

              return (
            <div key={section.title} style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              {section.rows.length === 0 ? (
                <div style={{ padding: "14px 12px", color: C.gray, fontSize: 13 }}>No profiles in this category.</div>
              ) : (
                <div style={{ overflowX: "auto", maxHeight: "70vh" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 500 }}>
                    <thead>
                      <tr style={{ background: C.navy, color: "#fff" }}>
                        {visibleHeaders.map((h, i) => (
                          <th key={h.id} style={{ padding: "10px 12px", textAlign: "left", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 3, background: C.navy, borderRadius: i === 0 ? "6px 0 0 0" : undefined }}>{h.label}</th>
                        ))}
                        <th style={{ padding: "10px 12px", textAlign: "center", borderRadius: "0 6px 0 0", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 3, background: C.navy }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((p, i) => {
                        const cellVal = (id) => {
                          if (id === "staffCategory") return normalizeStaffCategory(p.staffCategory);
                          const v = p[id];
                          if (v == null || v === "") return "—";
                          if (typeof v === "object" || typeof v === "function") return "—";
                          const s = String(v).trim();
                          const sensitive = ["cnic", "contact", "accNo", "iban"];
                          if (!showSensitive && sensitive.includes(id)) {
                             if (id === "cnic" && s.length >= 13) return "•••••-•••••••-" + s.slice(-1);
                             if (id === "contact" && s.length >= 11) return s.slice(0, 4) + " ••••• " + s.slice(-2);
                             if ((id === "accNo" || id === "iban") && s.length > 6) return s.slice(0, 4) + "••••••••" + s.slice(-4);
                             return "••••••••";
                          }
                          if (["dob", "doe", "dprs", "dppp", "daps"].includes(id)) return staffDateToDDMMYYYY(s) || "—";
                          if (id === "cnic") return staffFormatCNIC(s) || "—";
                          if (id === "contact" || id === "emergencyContact") return staffFormatPhone(s) || s || "—";
                          if (["name", "fname", "designation", "domicile", "aq", "subj", "pq", "bankName", "branch", "address"].includes(id)) return toProperCase(s) || "—";
                          return s;
                        };
                        return (
                        <tr key={p.id != null ? p.id : `row-${i}`} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#f9fafb" : "#fff" }}>
                          {visibleHeaders.map((h) => (
                            <td
                              key={h.id}
                              style={{
                                padding: "10px 12px",
                                color: h.id === "name" ? C.navy : "inherit",
                                fontWeight: h.id === "name" ? 600 : 400,
                                maxWidth: h.id === "address" ? 220 : nowrapFields.has(h.id) ? undefined : 180,
                                whiteSpace: nowrapFields.has(h.id) ? "nowrap" : h.id === "address" ? "normal" : "nowrap",
                                verticalAlign: "middle",
                              }}
                              title={nowrapFields.has(h.id) || h.id === "address" ? String(cellVal(h.id)) : undefined}
                            >
                              {h.id === "photo" ? (
                                p.photo && typeof p.photo === "string" ? (
                                  <img src={p.photo} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", objectPosition: p.photoPosition || "50% 50%" }} />
                                ) : (
                                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#e5e7eb", color: C.gray, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                                    {(p.name && typeof p.name === "string" ? p.name.charAt(0) : "?")}
                                  </div>
                                )
                              ) : (
                                cellVal(h.id)
                              )}
                            </td>
                          ))}
                          <td style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              <button onClick={() => handleOpenForm(p)} style={{ background: "#dbeafe", color: "#1e40af", border: "none", padding: 6, borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center" }} title="Edit">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleDelete(p.id)} style={{ background: "#fee2e2", color: "#b91c1c", border: "none", padding: 6, borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center" }} title="Delete">
                                <Trash2 size={14} />
                              </button>
                              <button onClick={() => moveStaffWithinCategory(p.id, "up")} style={{ background: "#f8fafc", color: C.navy, border: "1px solid #cbd5e1", padding: "6px 8px", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", fontSize: 12, fontWeight: 700 }} title="Move Up">
                                ↑
                              </button>
                              <button onClick={() => moveStaffWithinCategory(p.id, "down")} style={{ background: "#f8fafc", color: C.navy, border: "1px solid #cbd5e1", padding: "6px 8px", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", fontSize: 12, fontWeight: 700 }} title="Move Down">
                                ↓
                              </button>
                              <button onClick={() => openTransferDialog(p)} style={{ background: "#ecfeff", color: "#155e75", border: "none", padding: "6px 8px", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", fontSize: 12, fontWeight: 700 }} title="Transfer">
                                Transfer
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
      </CardContent>
    </Card>
  );
}
