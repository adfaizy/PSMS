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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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


export function FeePage({ settings, students, activeSchoolId, setBarSubtitle }) {
  useEffect(() => {
    setBarSubtitle(`${feeCore.FEE_AMOUNT} Rs per student per month`);
    return () => setBarSubtitle("");
  }, [setBarSubtitle]);

  const classes = useMemo(() => (settings.classes || []), [settings.classes]);

  const [feeRecords, setFeeRecords] = useState(() => {
    return feeService.load(activeSchoolId || "");
  });

  useEffect(() => {
    if (activeSchoolId) {
      setFeeRecords(feeService.load(activeSchoolId));
    }
  }, [activeSchoolId]);

  useEffect(() => {
    if (activeSchoolId) {
      feeService.save(activeSchoolId, feeRecords);
    }
  }, [activeSchoolId, feeRecords]);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });

  const [viewMode, setViewMode] = useState('summary'); // 'summary' | 'class-detail'
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saving, setSaving] = useState(null); // studentId being saved

  const saveFeeRecords = (newRecords) => {
    setFeeRecords(newRecords);
  };

  const toggleFeePayment = (studentId, classId, studentName) => {
    setSaving(studentId);
    try {
      const feeStatus = feeService.studentStatus(feeRecords, { classId, studentId, month: selectedMonth.month, year: selectedMonth.year });

      let newRecords;
      if (feeStatus.paid) {
        // Remove payment (mark as unpaid)
        newRecords = feeService.remove(feeRecords, studentId, classId, selectedMonth.month, selectedMonth.year);
        alert(`Fee marked as UNPAID for ${studentName}`);
      } else {
        // Add payment (mark as paid)
        newRecords = feeService.markStudent(feeRecords, { studentId, classId, month: selectedMonth.month, year: selectedMonth.year });
        alert(`Fee marked as PAID for ${studentName} - Rs. ${feeCore.FEE_AMOUNT}`);
      }
      saveFeeRecords(newRecords);
    } finally {
      setSaving(null);
    }
  };

  const markAllClassPaid = (classId) => {
    const classObj = monthlySummary.find(c => String(c.classId) === String(classId));
    if (!classObj) return;
    
    if (confirm(`Mark all ${classObj.totalStudents} students in ${classObj.className} as PAID for ${getCurrentMonthName()} ${selectedMonth.year}?`)) {
      try {
        const newRecords = feeService.markAll(feeRecords, { classId, month: selectedMonth.month, year: selectedMonth.year, students, classes });
        saveFeeRecords(newRecords);
        alert(`All ${classObj.totalStudents} students marked as PAID - ${feeService.formatCurrency(classObj.expectedAmount)}`);
      } catch {
        alert('Failed to mark all as paid. Please try again.');
      }
    }
  };

  const monthlySummary = useMemo(() => {
    return feeService.summary(feeRecords, classes, selectedMonth.month, selectedMonth.year, students);
  }, [feeRecords, classes, students, selectedMonth.month, selectedMonth.year]);

  const totalCollection = useMemo(() => {
    return monthlySummary.reduce((sum, cls) => sum + cls.collectedAmount, 0);
  }, [monthlySummary]);

  const totalExpected = useMemo(() => {
    return monthlySummary.reduce((sum, cls) => sum + cls.expectedAmount, 0);
  }, [monthlySummary]);

  const handleMonthChange = (e) => {
    const [year, month] = e.target.value.split('-').map(Number);
    setSelectedMonth({ month, year });
  };

  const handleClassClick = (classId) => {
    setSelectedClassId(classId);
    setViewMode('class-detail');
  };

  const goBack = () => {
    setViewMode('summary');
    setSelectedClassId(null);
  };

  const getCurrentMonthName = () => {
    return feeService.months().find(m => m.value === selectedMonth.month)?.label || '';
  };

  const generateClassPdf = async (classObj) => {
    setPdfLoading(true);
    try {
      const classStudents = students.filter(s => s.classId === classObj.classId);
      const classRecords = feeRecords.filter(
        rec => rec.classId === classObj.classId && rec.month === selectedMonth.month && rec.year === selectedMonth.year
      );

      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(`Fee Collection Report - ${classObj.className}`, 14, 22);
      doc.setFontSize(12);
      doc.text(`Month: ${getCurrentMonthName()} ${selectedMonth.year}`, 14, 30);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 38);

      const tableData = classStudents.map(student => {
        const status = classRecords.find(r => r.studentId === student.id);
        return [
          student.rollNo || '-',
          student.admissionNo || '-',
          student.name || '',
          student.fatherName || '',
          status ? feeCore.formatCurrency(feeCore.FEE_AMOUNT) : '-',
          status ? 'Paid' : 'Pending'
        ];
      });

      autoTable(doc, {
        head: [['Roll No', 'Adm No', 'Name', 'Father Name', 'Amount', 'Status']],
        body: tableData,
        startY: 48,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        alternateRowStyles: { fillColor: [240, 240, 240] }
      });

      const finalY = doc.lastAutoTable.finalY + 10;
      doc.text(`Total Students: ${classStudents.length}`, 14, finalY);
      doc.text(`Paid: ${classRecords.length}`, 14, finalY + 8);
      doc.text(`Pending: ${classStudents.length - classRecords.length}`, 14, finalY + 16);
      doc.text(`Collected: ${feeCore.formatCurrency(classObj.collectedAmount)}`, 14, finalY + 24);

      doc.save(`Fee_Collection_${classObj.className}_${getCurrentMonthName()}_${selectedMonth.year}.pdf`);
      alert('PDF downloaded successfully!');
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  if (viewMode === 'class-detail' && selectedClassId) {
    const classObj = monthlySummary.find(c => String(c.classId) === String(selectedClassId));
    if (!classObj) return <div className="fees-page p-6 text-muted-foreground">Class not found</div>;

    const classStudents = students.filter(s => {
      const studentClass = resolveClass(settings.classes, s.classId);
      return studentClass && String(studentClass.id) === String(classObj.classId);
    });

    return (
      <div className="fees-page mx-auto max-w-[1200px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <Button type="button" variant="outline" size="sm" onClick={goBack}>← Back to Summary</Button>
            <h2 className="m-0 truncate text-xl font-bold text-primary">{classObj.className} — Fee Details</h2>
            <p className="m-0 text-sm text-muted-foreground">
              {getCurrentMonthName()} {selectedMonth.year} · {classObj.totalStudents} students · Paid {classObj.paidCount} · Pending {classObj.pendingCount}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={classObj.pendingCount === 0}
              onClick={() => markAllClassPaid(classObj.classId)}
              className="bg-green-700 hover:bg-green-800"
            >
              ✓ Mark All Paid ({classObj.pendingCount})
            </Button>
            <Button type="button" size="sm" onClick={() => generateClassPdf(classObj)} disabled={pdfLoading}>
              <Download size={16} className="mr-1.5" />
              {pdfLoading ? "Generating…" : "Export PDF"}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
          {[
            { l: "Students", v: classObj.totalStudents, c: "text-foreground" },
            { l: "Paid", v: classObj.paidCount, c: "text-green-700" },
            { l: "Pending", v: classObj.pendingCount, c: "text-red-600" },
            { l: "Collected", v: feeCore.formatCurrency(classObj.collectedAmount), c: "text-green-700" },
            { l: "Pending Amt", v: feeCore.formatCurrency(classObj.pendingAmount), c: "text-red-600" },
          ].map((s) => (
            <Card key={s.l} className="border-border/70 shadow-sm">
              <CardContent className="p-3 text-center">
                <div className={`text-lg font-bold tabular-nums ${s.c}`}>{s.v}</div>
                <div className="text-[11px] font-medium text-muted-foreground">{s.l}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden border-border/70 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary hover:bg-primary">
                    <TableHead className="whitespace-nowrap text-primary-foreground">Roll No</TableHead>
                    <TableHead className="whitespace-nowrap text-primary-foreground">Admission No</TableHead>
                    <TableHead className="whitespace-nowrap text-primary-foreground">Name</TableHead>
                    <TableHead className="whitespace-nowrap text-primary-foreground">Father Name</TableHead>
                    <TableHead className="whitespace-nowrap text-right text-primary-foreground">Amount</TableHead>
                    <TableHead className="whitespace-nowrap text-center text-primary-foreground">Status</TableHead>
                    <TableHead className="whitespace-nowrap text-center text-primary-foreground">Date</TableHead>
                    <TableHead className="whitespace-nowrap text-center text-primary-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No students in this class</TableCell>
                    </TableRow>
                  ) : (
                    classStudents.map((student, i) => {
                      const feeStatus = feeService.studentStatus(feeRecords, { classId: classObj.classId, studentId: student.id, month: selectedMonth.month, year: selectedMonth.year });
                      const feeRecord = feeStatus.record;
                      return (
                        <TableRow key={student.id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                          <TableCell className="whitespace-nowrap font-semibold tabular-nums">{student.rollNo || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums">{student.admissionNo || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap font-medium">{student.name || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{student.fatherName || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">
                            {feeRecord ? feeService.formatCurrency(feeCore.FEE_AMOUNT) : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={feeStatus.paid ? "default" : "destructive"} className={feeStatus.paid ? "bg-green-700" : ""}>
                              {feeStatus.paid ? "Paid" : "Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-center tabular-nums text-muted-foreground">
                            {feeRecord ? new Date(feeRecord.paidAt).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={saving === student.id}
                              onClick={() => toggleFeePayment(student.id, classObj.classId, student.name)}
                              className={feeStatus.paid ? "border-amber-300 text-amber-700" : "border-green-300 text-green-700"}
                            >
                              {saving === student.id ? "…" : (feeStatus.paid ? "← Unmark" : "✓ Mark")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fees-page mx-auto max-w-[1200px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-bold tracking-tight text-primary">Fee Collection</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monthly summary · {feeCore.formatCurrency(feeCore.FEE_AMOUNT)} per student
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fee-month">Select Month</Label>
          <Input
            id="fee-month"
            type="month"
            className="w-[180px]"
            value={`${selectedMonth.year}-${String(selectedMonth.month).padStart(2, "0")}`}
            onChange={handleMonthChange}
          />
        </div>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <Card className="border-0 bg-primary text-primary-foreground shadow-md">
          <CardContent className="p-5">
            <div className="mb-1 text-sm opacity-90">Total Expected</div>
            <div className="text-3xl font-bold tabular-nums">{feeCore.formatCurrency(totalExpected)}</div>
            <div className="mt-1 text-xs opacity-80">{monthlySummary.length} classes</div>
          </CardContent>
        </Card>
        <Card className="border-0 text-white shadow-md" style={{ background: "linear-gradient(135deg, #15803d 0%, #22c55e 100%)" }}>
          <CardContent className="p-5">
            <div className="mb-1 text-sm opacity-90">Total Collected</div>
            <div className="text-3xl font-bold tabular-nums">{feeCore.formatCurrency(totalCollection)}</div>
            <div className="mt-1 text-xs opacity-80">
              {totalExpected > 0 ? ((totalCollection / totalExpected) * 100).toFixed(1) : 0}% collection rate
            </div>
          </CardContent>
        </Card>
        <Card
          className="border-0 text-white shadow-md"
          style={{
            background:
              totalCollection >= totalExpected
                ? "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)"
                : "linear-gradient(135deg, #b45309 0%, #eab308 100%)",
          }}
        >
          <CardContent className="p-5">
            <div className="mb-1 text-sm opacity-90">Pending Amount</div>
            <div className="text-3xl font-bold tabular-nums">{feeCore.formatCurrency(totalExpected - totalCollection)}</div>
            <div className="mt-1 text-xs opacity-80">
              {totalExpected - totalCollection > 0
                ? `${((totalExpected - totalCollection) / feeCore.FEE_AMOUNT).toFixed(0)} students pending`
                : "All collected!"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b bg-muted/40 px-4 py-3">
          <CardTitle className="text-base text-primary">Class-wise Collection Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {monthlySummary.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No classes configured. Please add classes in Settings.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary hover:bg-primary">
                    <TableHead className="whitespace-nowrap text-primary-foreground">Class</TableHead>
                    <TableHead className="whitespace-nowrap text-center text-primary-foreground">Students</TableHead>
                    <TableHead className="whitespace-nowrap text-center text-primary-foreground">Paid</TableHead>
                    <TableHead className="whitespace-nowrap text-center text-primary-foreground">Pending</TableHead>
                    <TableHead className="whitespace-nowrap text-right text-primary-foreground">Expected</TableHead>
                    <TableHead className="whitespace-nowrap text-right text-primary-foreground">Collected</TableHead>
                    <TableHead className="whitespace-nowrap text-right text-primary-foreground">Pending Amt</TableHead>
                    <TableHead className="whitespace-nowrap text-center text-primary-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlySummary.map((cls, i) => (
                    <TableRow
                      key={cls.classId}
                      className={`cursor-pointer ${i % 2 === 0 ? "bg-muted/30" : ""}`}
                      onClick={() => handleClassClick(cls.classId)}
                    >
                      <TableCell className="whitespace-nowrap font-semibold text-foreground">{cls.className}</TableCell>
                      <TableCell className="whitespace-nowrap text-center tabular-nums text-muted-foreground">{cls.totalStudents}</TableCell>
                      <TableCell className="whitespace-nowrap text-center tabular-nums font-semibold text-green-700">{cls.paidCount}</TableCell>
                      <TableCell className={`whitespace-nowrap text-center tabular-nums font-semibold ${cls.pendingCount > 0 ? "text-red-600" : "text-green-700"}`}>
                        {cls.pendingCount}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                        {feeCore.formatCurrency(cls.expectedAmount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums font-semibold text-green-700">
                        {feeCore.formatCurrency(cls.collectedAmount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums font-semibold text-red-600">
                        {feeCore.formatCurrency(cls.pendingAmount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClassClick(cls.classId);
                          }}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <p className="m-0 leading-relaxed">
          <strong>Note:</strong> Each student pays {feeCore.formatCurrency(feeCore.FEE_AMOUNT)} per month. Open a class row or View Details to mark payments and export a PDF.
        </p>
      </div>
    </div>
  );
}

