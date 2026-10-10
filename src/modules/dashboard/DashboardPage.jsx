import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  GraduationCap,
  School,
  Briefcase,
  Wallet,
  ClipboardList,
  CalendarDays,
  Bell,
  ArrowRight,
  UserPlus,
  FileSpreadsheet,
  IdCard,
} from "lucide-react";
import * as feeCore from "@/modules/fee/feeCore";
import { feeService, dashboardService } from "@/services";
import { loadAttendanceFromLocal, hydrateAttendanceFromCloud } from "@/modules/attendance/AttendancePage";
import { C } from "@/shared/theme";
import { Btn, Sel } from "@/components/AppControls";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { setNavIntent } from "@/lib/navIntent.js";
import * as H from "@/shared/helpers";

const {
  formatClassDisplay,
  resolveClass,
  getClassSubjects,
  normalizeStaffCategory,
  isTeachingStaffMember,
  DASHBOARD_EXAM_LS,
} = H;

function navigateTo(onNavigate, page, tab) {
  if (tab) setNavIntent({ page, tab });
  onNavigate?.(page);
}

function KpiCard({ icon, label, value, hint, accent = C.navy, onClick }) {
  const IconCmp = icon;
  const body = (
    <CardContent className="p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ background: `${accent}18`, color: accent }}
        >
          {IconCmp ? <IconCmp size={18} aria-hidden /> : null}
        </div>
        {onClick ? <ArrowRight size={14} className="mt-1 text-muted-foreground" aria-hidden /> : null}
      </div>
      <div className="text-2xl font-bold tracking-tight tabular-nums" style={{ color: accent }}>
        {value}
      </div>
      <div className="mt-1 text-xs font-semibold text-foreground">{label}</div>
      {hint ? <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div> : null}
    </CardContent>
  );
  if (!onClick) {
    return <Card className="border-border/70 shadow-sm">{body}</Card>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="m-0 block w-full cursor-pointer border-0 bg-transparent p-0 text-left"
    >
      <Card className="border-border/70 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">{body}</Card>
    </button>
  );
}

export function DashboardPage({
  settings,
  students,
  staffProfiles = [],
  exam_tm: examTmProp,
  exam_om: examOmProp,
  exam_datesheet: examDatesheetProp,
  activeSchoolId,
  currentSession,
  onNavigate,
  setBarSubtitle,
}) {
  useEffect(() => {
    setBarSubtitle?.(currentSession ? `Session ${currentSession}` : "Operations overview");
    return () => setBarSubtitle?.("");
  }, [setBarSubtitle, currentSession]);

  const profileList = Array.isArray(staffProfiles) ? staffProfiles : [];
  const hasProfileCategories = profileList.length > 0;
  const teachingStaffCount = hasProfileCategories
    ? profileList.filter((p) => normalizeStaffCategory(p?.staffCategory) === "Teaching").length
    : (Array.isArray(settings.staff) ? settings.staff : []).filter(isTeachingStaffMember).length;
  const nonTeachingStaffCount = hasProfileCategories
    ? profileList.filter((p) => normalizeStaffCategory(p?.staffCategory) === "Non Teaching").length
    : Math.max(0, (Array.isArray(settings.staff) ? settings.staff : []).length - teachingStaffCount);
  const staffTotal = teachingStaffCount + nonTeachingStaffCount;
  const sectionCount = dashboardService.countSections?.(settings.classes) ?? (settings.classes || []).length;

  const [feeRecords, setFeeRecords] = useState(() => feeService.load(activeSchoolId || "") || []);
  const [attendance, setAttendance] = useState(() => loadAttendanceFromLocal(activeSchoolId || "") || {});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fees = feeService.hydrate
        ? await feeService.hydrate(activeSchoolId || "")
        : feeService.load(activeSchoolId || "");
      if (!cancelled) setFeeRecords(Array.isArray(fees) ? fees : []);
      const att = await hydrateAttendanceFromCloud(activeSchoolId || "");
      if (!cancelled) setAttendance(att && typeof att === "object" ? att : {});
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSchoolId]);

  const currentMonth = useMemo(() => {
    const d = new Date();
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  }, []);

  const feeStats = useMemo(() => {
    return dashboardService.feeStats({
      feeRecords,
      classes: settings.classes,
      students,
      month: currentMonth.month,
      year: currentMonth.year,
      feeAmount: feeCore.FEE_AMOUNT,
    });
  }, [feeRecords, settings.classes, students, currentMonth.month, currentMonth.year]);

  const attendanceToday = useMemo(
    () =>
      dashboardService.todayAttendance({
        attendance,
        students,
        classes: settings.classes,
      }),
    [attendance, students, settings.classes],
  );

  const upcomingExams = useMemo(
    () =>
      dashboardService.upcomingExams({
        datesheet: examDatesheetProp,
        limit: 6,
      }),
    [examDatesheetProp],
  );

  const reminders = useMemo(
    () =>
      dashboardService.reminders({
        students,
        classes: settings.classes,
        feeStats,
        attendanceToday,
        upcomingExams,
        staffCount: staffTotal,
      }),
    [students, settings.classes, feeStats, attendanceToday, upcomingExams, staffTotal],
  );

  const passThreshold = Number(settings.passPercent) || 50;
  const exams = ["1st Term", "Mid Term", "Final Term", "Annual"];
  const dashExamOptions = [
    { value: "overall", label: "Overall (All Terms)" },
    ...exams.map((e) => ({ value: e, label: e })),
  ];
  const allowedDashExam = new Set(dashExamOptions.map((o) => o.value));
  const [dashExam, setDashExam] = useState(() => {
    try {
      const s = window.localStorage.getItem(DASHBOARD_EXAM_LS);
      if (s && allowedDashExam.has(s)) return s;
    } catch {
      /* ignore */
    }
    return "1st Term";
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(DASHBOARD_EXAM_LS, dashExam);
    } catch {
      /* ignore */
    }
  }, [dashExam]);

  const [dashView, setDashView] = useState("class");
  const [dashSubjClass, setDashSubjClass] = useState("all");
  const TM = examTmProp && typeof examTmProp === "object" ? examTmProp : {};
  const OM = examOmProp && typeof examOmProp === "object" ? examOmProp : {};
  const gtm = (e, c, s) => TM[`${e}_${c}_${s}`] || "";
  const gom = (e, c, id, s) => OM[`${e}_${c}_${id}_${s}`] || "";

  const subjectStatDash = (mode, classId, studentId, subj) => {
    let tot = 0;
    let obt = 0;
    if (mode === "overall") {
      exams.forEach((ex) => {
        const t = parseFloat(gtm(ex, classId, subj));
        const o = parseFloat(gom(ex, classId, studentId, subj));
        if (!Number.isNaN(t)) tot += t;
        if (!Number.isNaN(o)) obt += o;
      });
    } else {
      const t = parseFloat(gtm(mode, classId, subj));
      const o = parseFloat(gom(mode, classId, studentId, subj));
      if (!Number.isNaN(t)) tot = t;
      if (!Number.isNaN(o)) obt = o;
    }
    return { tot, obt };
  };
  const overallStatDash = (mode, classId, studentId) => {
    let tot = 0;
    let obt = 0;
    getClassSubjects(settings, classId, "exam").forEach((subj) => {
      const s = subjectStatDash(mode, classId, studentId, subj);
      tot += s.tot;
      obt += s.obt;
    });
    if (tot <= 0) return { hasMarks: false, pct: null };
    return { hasMarks: true, pct: (obt / tot) * 100 };
  };

  const classStats = (settings.classes || []).map((cls) => {
    const classStudents = students.filter((s) => resolveClass(settings.classes, s.classId)?.id === cls.id);
    const count = classStudents.length;
    let pass = 0;
    let fail = 0;
    classStudents.forEach((st) => {
      const o = overallStatDash(dashExam, cls.id, st.id);
      if (!o.hasMarks) return;
      if (o.pct >= passThreshold) pass += 1;
      else fail += 1;
    });
    const pending = Math.max(0, count - pass - fail);
    const passRatePct = count > 0 ? Math.round(((100 * pass) / count) * 10) / 10 : 0;
    const classFeeRecords = feeRecords.filter((rec) => {
      const recordClass = resolveClass(settings.classes, rec.classId);
      return (
        recordClass &&
        String(recordClass.id) === String(cls.id) &&
        rec.month === currentMonth.month &&
        rec.year === currentMonth.year
      );
    });
    return {
      id: cls.id,
      name: formatClassDisplay(cls),
      count,
      pass,
      fail,
      pending,
      passRatePct,
      feeCollected: classFeeRecords.reduce((sum, rec) => sum + (rec.amount || feeCore.FEE_AMOUNT), 0),
      feeExpected: count * feeCore.FEE_AMOUNT,
    };
  });

  const subjectStats = (() => {
    const subjMap = {};
    const filteredClasses =
      dashSubjClass === "all" ? settings.classes || [] : (settings.classes || []).filter((c) => c.id === dashSubjClass);
    filteredClasses.forEach((cls) => {
      const classStudents = students.filter((s) => resolveClass(settings.classes, s.classId)?.id === cls.id);
      getClassSubjects(settings, cls.id, "exam").forEach((subj) => {
        if (!subjMap[subj]) subjMap[subj] = { name: subj, total: 0, pass: 0, fail: 0 };
        classStudents.forEach((st) => {
          const sd = subjectStatDash(dashExam, cls.id, st.id, subj);
          if (sd.tot <= 0) return;
          subjMap[subj].total += 1;
          const pct = (sd.obt / sd.tot) * 100;
          if (pct >= passThreshold) subjMap[subj].pass += 1;
          else subjMap[subj].fail += 1;
        });
      });
    });
    return Object.values(subjMap).sort((a, b) => a.name.localeCompare(b.name));
  })();

  const monthLabel =
    feeCore.getMonthsList?.()?.find((m) => m.value === currentMonth.month)?.label ||
    new Date(currentMonth.year, currentMonth.month - 1, 1).toLocaleString("en-PK", { month: "long" });

  const quickActions = [
    {
      label: "Admit Student",
      detail: "Create a new admission record",
      icon: UserPlus,
      run: () => navigateTo(onNavigate, "students", "admission"),
    },
    {
      label: "Staff Directory",
      detail: "Manage teachers and non-teaching staff",
      icon: Briefcase,
      run: () => navigateTo(onNavigate, "staff", "directory"),
    },
    {
      label: "Mark Attendance",
      detail: "Record today's present / absent / late",
      icon: ClipboardList,
      run: () => navigateTo(onNavigate, "attendance", "students"),
    },
    {
      label: "Fee Collection",
      detail: "Update monthly fee payments",
      icon: Wallet,
      run: () => navigateTo(onNavigate, "fees", "collection"),
    },
    {
      label: "Marks Entry",
      detail: "Enter or import examination marks",
      icon: FileSpreadsheet,
      run: () => navigateTo(onNavigate, "examination", "marks"),
    },
    {
      label: "Result Cards",
      detail: "Generate student result cards",
      icon: GraduationCap,
      run: () => navigateTo(onNavigate, "examination", "card"),
    },
    {
      label: "ID Cards",
      detail: "Print student or staff identity cards",
      icon: IdCard,
      run: () => navigateTo(onNavigate, "card"),
    },
  ];

  return (
    <div className="psms-page space-y-5" style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="m-0 text-xl font-bold text-primary">Dashboard</h2>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            School operations overview
            {currentSession ? ` · Academic session ${currentSession}` : ""}
            {" · "}
            {new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        <KpiCard
          icon={Users}
          label="Total Students"
          value={students.length}
          hint={`${(settings.classes || []).length} classes · ${sectionCount} sections`}
          accent={C.navy}
          onClick={() => navigateTo(onNavigate, "students", "directory")}
        />
        <KpiCard
          icon={GraduationCap}
          label="Teaching Staff"
          value={teachingStaffCount}
          hint={`${nonTeachingStaffCount} non-teaching`}
          accent="#7c3aed"
          onClick={() => navigateTo(onNavigate, "staff", "directory")}
        />
        <KpiCard
          icon={School}
          label="Classes"
          value={(settings.classes || []).length}
          hint={`${sectionCount} class / section units`}
          accent="#0d9488"
          onClick={() => navigateTo(onNavigate, "academic", "classes")}
        />
        <KpiCard
          icon={ClipboardList}
          label="Today's Attendance"
          value={`${attendanceToday.rate}%`}
          hint={`${attendanceToday.present} present · ${attendanceToday.absent} absent · ${attendanceToday.unmarked} unmarked`}
          accent="#15803d"
          onClick={() => navigateTo(onNavigate, "attendance", "overview")}
        />
        <KpiCard
          icon={Wallet}
          label={`Fee Collected (${monthLabel.slice(0, 3)})`}
          value={feeCore.formatCurrency(feeStats.totalCollected)}
          hint={`Pending ${feeCore.formatCurrency(feeStats.totalPending)} · ${feeStats.pct}% collected`}
          accent="#16a34a"
          onClick={() => navigateTo(onNavigate, "fees", "overview")}
        />
        <KpiCard
          icon={Briefcase}
          label="Staff Directory"
          value={staffTotal}
          hint="Profiles for cards and timetables"
          accent="#0f766e"
          onClick={() => navigateTo(onNavigate, "staff", "directory")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
        {/* Quick actions */}
        <Card className="border-border/70 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="m-0 text-sm font-semibold text-primary">Quick Actions</h3>
              <span className="text-[11px] font-medium text-muted-foreground">Common daily tasks</span>
            </div>
            <Separator />
            <div className="grid gap-2 sm:grid-cols-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.run}
                    className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 text-left transition hover:border-primary/40 hover:bg-muted/40"
                  >
                    <span
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${C.navy}12`, color: C.navy }}
                    >
                      <Icon size={16} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-foreground">{action.label}</span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">{action.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Notifications / reminders */}
        <Card className="border-border/70 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-primary">
                <Bell size={15} aria-hidden /> Notifications
              </h3>
              <Badge variant="secondary">{reminders.length}</Badge>
            </div>
            <Separator />
            {reminders.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">No pending operational alerts.</p>
            ) : (
              <div className="space-y-2">
                {reminders.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border/70 p-3"
                    style={{
                      background: item.level === "warning" ? "#fffbeb" : "#f8fafc",
                      borderColor: item.level === "warning" ? "#fde68a" : undefined,
                    }}
                  >
                    <div className="text-sm font-bold text-foreground">{item.title}</div>
                    <div className="mt-1 text-[12px] text-muted-foreground">{item.detail}</div>
                    {item.action?.page ? (
                      <div className="mt-2">
                        <Btn
                          small
                          outline
                          onClick={() => navigateTo(onNavigate, item.action.page, item.action.tab)}
                        >
                          {item.action.label || "Open"}
                        </Btn>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)]">
        {/* Academic performance */}
        {(settings.classes || []).length > 0 && (
          <Card className="border-border/70 shadow-sm">
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="m-0 text-sm font-semibold text-primary">
                  {dashView === "class" ? "Academic Performance · Class-wise" : "Academic Performance · Subject-wise"}
                </h3>
                <Tabs value={dashView} onValueChange={setDashView}>
                  <TabsList>
                    <TabsTrigger value="class">Class-wise</TabsTrigger>
                    <TabsTrigger value="subject">Subject-wise</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <Separator />
              <div className="flex flex-wrap items-end gap-3">
                <Sel label="Exam" value={dashExam} onChange={setDashExam} options={dashExamOptions} width={200} />
                {dashView === "subject" && (
                  <Sel
                    label="Class"
                    value={dashSubjClass}
                    onChange={setDashSubjClass}
                    options={[
                      { value: "all", label: "All Classes" },
                      ...(settings.classes || []).map((c) => ({ value: c.id, label: formatClassDisplay(c) })),
                    ]}
                    width={200}
                  />
                )}
              </div>
              <p className="m-0 text-[11px] text-muted-foreground">
                Pass threshold: {passThreshold}%. Uses the same totals as Result Cards / Marks Entry.
              </p>

              {dashView === "class" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {classStats.map((row) => (
                    <div key={row.id} className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <div className="mb-2 truncate text-sm font-bold text-primary">{row.name}</div>
                      <div className="grid grid-cols-4 gap-1.5 text-center">
                        {[
                          { l: "Enrolled", v: row.count, c: C.navy },
                          { l: "Pass", v: row.pass, c: C.green },
                          { l: "Fail", v: row.fail, c: C.red },
                          { l: "Pass %", v: row.count ? `${row.passRatePct}%` : "—", c: C.navy },
                        ].map((cell) => (
                          <div key={cell.l} className="rounded-lg border border-border/60 bg-white px-1 py-2">
                            <div className="text-sm font-bold tabular-nums" style={{ color: cell.c }}>
                              {cell.v}
                            </div>
                            <div className="text-[9px] font-medium text-muted-foreground">{cell.l}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-dashed border-border/70 pt-2 text-[11px]">
                        <span className="text-muted-foreground">Fee ({monthLabel.slice(0, 3)})</span>
                        <span className="font-bold text-green-700">
                          {feeCore.formatCurrency(row.feeCollected)}
                          <span className="ml-1 font-medium text-muted-foreground">
                            / {feeCore.formatCurrency(row.feeExpected)}
                          </span>
                        </span>
                      </div>
                      {row.pending > 0 ? (
                        <div className="mt-1 text-center text-[10px] text-muted-foreground">
                          {row.pending} student{row.pending === 1 ? "" : "s"} without marks in this view
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {dashView === "subject" &&
                (subjectStats.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No subject marks found for this exam selection.
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {subjectStats.map((row) => {
                      const passRatePct = row.total > 0 ? Math.round(((100 * row.pass) / row.total) * 10) / 10 : 0;
                      return (
                        <div key={row.name} className="rounded-xl border border-border/70 bg-sky-50/60 p-3">
                          <div className="mb-2 truncate text-sm font-bold text-sky-800">{row.name}</div>
                          <div className="grid grid-cols-4 gap-1.5 text-center">
                            {[
                              { l: "Appeared", v: row.total, c: C.navy },
                              { l: "Pass", v: row.pass, c: C.green },
                              { l: "Fail", v: row.fail, c: C.red },
                              { l: "Pass %", v: row.total ? `${passRatePct}%` : "—", c: C.navy },
                            ].map((cell) => (
                              <div key={cell.l} className="rounded-lg border border-border/60 bg-white px-1 py-2">
                                <div className="text-sm font-bold tabular-nums" style={{ color: cell.c }}>
                                  {cell.v}
                                </div>
                                <div className="text-[9px] font-medium text-muted-foreground">{cell.l}</div>
                              </div>
                            ))}
                          </div>
                          {row.total > 0 ? (
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-100">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${passRatePct}%`,
                                  background:
                                    passRatePct >= 80 ? "#22c55e" : passRatePct >= 50 ? "#eab308" : "#ef4444",
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        {/* Upcoming exams / calendar */}
        <Card className="border-border/70 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-primary">
                <CalendarDays size={15} aria-hidden /> Upcoming Exams
              </h3>
              <Btn small outline onClick={() => navigateTo(onNavigate, "examination", "datesheet")}>
                Date Sheet
              </Btn>
            </div>
            <Separator />
            {upcomingExams.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">
                No upcoming date-sheet entries. Add dates under Examination → Date Sheet.
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingExams.map((row) => (
                  <div key={row.id || row.date} className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
                    <div className="text-sm font-bold text-foreground">
                      {new Date(`${row.date}T00:00:00`).toLocaleDateString("en-PK", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{row.note || "Scheduled examination day"}</div>
                  </div>
                ))}
              </div>
            )}

            <Separator />
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Today&apos;s attendance snapshot
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { l: "Present", v: attendanceToday.present, c: "#15803d" },
                  { l: "Absent", v: attendanceToday.absent, c: "#b91c1c" },
                  { l: "Late", v: attendanceToday.late, c: "#b45309" },
                  { l: "Unmarked", v: attendanceToday.unmarked, c: "#475569" },
                ].map((cell) => (
                  <div key={cell.l} className="rounded-lg border border-border/70 bg-white px-3 py-2">
                    <div className="text-lg font-bold tabular-nums" style={{ color: cell.c }}>
                      {cell.v}
                    </div>
                    <div className="text-[11px] font-medium text-muted-foreground">{cell.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
