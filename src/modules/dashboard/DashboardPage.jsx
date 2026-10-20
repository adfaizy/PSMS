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
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function KpiCard({ icon: IconCmp, label, value, hint, onClick }) {
  const inner = (
    <Card
      size="sm"
      className="h-full min-w-0 bg-card shadow-none transition-colors hover:bg-muted/40"
    >
      <CardHeader className="pb-0">
        <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground">
          {IconCmp ? <IconCmp className="size-4" aria-hidden /> : null}
        </div>
        {onClick ? (
          <CardAction>
            <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
          </CardAction>
        ) : null}
        <CardTitle className="mt-2 truncate text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
          {value}
        </CardTitle>
        <CardDescription className="truncate font-medium text-foreground">{label}</CardDescription>
      </CardHeader>
      {hint ? (
        <CardContent className="pt-0">
          <p className="m-0 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
  if (!onClick) return inner;
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className="block h-full min-w-0 w-full p-0 text-left hover:bg-transparent"
    >
      {inner}
    </Button>
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
      label: "Academic Setup",
      detail: "Classes, subjects, and sessions",
      icon: School,
      run: () => navigateTo(onNavigate, "academic", "classes"),
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
    <div className="psms-page dashboard-page mx-auto w-full min-w-0 max-w-[1600px] space-y-4 pb-8 md:space-y-6">
      <div className="min-w-0 space-y-1">
        <h2 className="m-0 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Dashboard</h2>
        <p className="m-0 text-xs text-muted-foreground sm:text-sm">
          School operations overview
          {currentSession ? ` · Session ${currentSession}` : ""}
          {" · "}
          {new Date().toLocaleDateString("en-PK", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          icon={Users}
          label="Total Students"
          value={students.length}
          hint={`${(settings.classes || []).length} classes · ${sectionCount} sections`}
          onClick={() => navigateTo(onNavigate, "students", "directory")}
        />
        <KpiCard
          icon={GraduationCap}
          label="Teaching Staff"
          value={teachingStaffCount}
          hint={`${nonTeachingStaffCount} non-teaching`}
          onClick={() => navigateTo(onNavigate, "staff", "directory")}
        />
        <KpiCard
          icon={School}
          label="Classes"
          value={(settings.classes || []).length}
          hint={`${sectionCount} class / section units`}
          onClick={() => navigateTo(onNavigate, "academic", "classes")}
        />
        <KpiCard
          icon={ClipboardList}
          label="Today's Attendance"
          value={`${attendanceToday.rate}%`}
          hint={`${attendanceToday.present} present · ${attendanceToday.absent} absent · ${attendanceToday.unmarked} unmarked`}
          onClick={() => navigateTo(onNavigate, "attendance", "overview")}
        />
        <KpiCard
          icon={Wallet}
          label={`Fee Collected (${monthLabel.slice(0, 3)})`}
          value={feeCore.formatCurrency(feeStats.totalCollected)}
          hint={`Pending ${feeCore.formatCurrency(feeStats.totalPending)} · ${feeStats.pct}% collected`}
          onClick={() => navigateTo(onNavigate, "fees", "overview")}
        />
        <KpiCard
          icon={Briefcase}
          label="Staff Directory"
          value={staffTotal}
          hint="Profiles for cards and timetables"
          onClick={() => navigateTo(onNavigate, "staff", "directory")}
        />
      </div>

      <Card size="sm" className="min-w-0 shadow-none">
        <CardHeader className="border-b">
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Jump into the most common daily tasks</CardDescription>
        </CardHeader>
        <CardContent className="pt-(--card-spacing)">
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.label}
                  type="button"
                  variant="outline"
                  onClick={action.run}
                  className="h-auto min-h-0 justify-start gap-3 whitespace-normal px-3 py-3 text-left"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{action.label}</span>
                    <span className="mt-0.5 block text-[11px] font-normal leading-snug text-muted-foreground">
                      {action.detail}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card size="sm" className="min-w-0 shadow-none">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-4" aria-hidden /> Notifications
            </CardTitle>
            <CardAction>
              <Badge variant="secondary">{reminders.length}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2 pt-(--card-spacing)">
            {reminders.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">No pending operational alerts.</p>
            ) : (
              reminders.map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-sm font-semibold text-foreground">{item.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.detail}</div>
                  {item.action?.page ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => navigateTo(onNavigate, item.action.page, item.action.tab)}
                    >
                      {item.action.label || "Open"}
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card size="sm" className="min-w-0 shadow-none">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-4" aria-hidden /> Upcoming Exams
            </CardTitle>
            <CardAction>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigateTo(onNavigate, "examination", "datesheet")}
              >
                Date Sheet
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2 pt-(--card-spacing)">
            {upcomingExams.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">
                No upcoming date-sheet entries. Add dates under Examination → Date Sheet.
              </p>
            ) : (
              upcomingExams.map((row) => (
                <div key={row.id || row.date} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                  <div className="text-sm font-semibold text-foreground">
                    {new Date(`${row.date}T00:00:00`).toLocaleDateString("en-PK", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {row.note || "Scheduled examination day"}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card size="sm" className="min-w-0 shadow-none md:col-span-2 xl:col-span-1">
          <CardHeader className="border-b">
            <CardTitle>Today&apos;s Attendance</CardTitle>
            <CardDescription>Live snapshot for the current day</CardDescription>
          </CardHeader>
          <CardContent className="pt-(--card-spacing)">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
              {[
                { l: "Present", v: attendanceToday.present },
                { l: "Absent", v: attendanceToday.absent },
                { l: "Late", v: attendanceToday.late },
                { l: "Unmarked", v: attendanceToday.unmarked },
              ].map((cell) => (
                <div key={cell.l} className="rounded-lg border border-border bg-background px-3 py-2.5">
                  <div className="text-lg font-bold tabular-nums text-foreground">{cell.v}</div>
                  <div className="text-[11px] font-medium text-muted-foreground">{cell.l}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {(settings.classes || []).length > 0 && (
        <Card size="sm" className="min-w-0 shadow-none">
          <CardHeader className="border-b">
            <CardTitle>
              {dashView === "class" ? "Academic Performance · Class-wise" : "Academic Performance · Subject-wise"}
            </CardTitle>
            <CardDescription>
              Pass threshold: {passThreshold}%. Same totals as Result Cards / Marks Entry.
            </CardDescription>
            <CardAction className="w-full sm:w-auto">
              <Tabs value={dashView} onValueChange={setDashView} className="w-full sm:w-auto">
                <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
                  <TabsTrigger value="class">Class-wise</TabsTrigger>
                  <TabsTrigger value="subject">Subject-wise</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4 pt-(--card-spacing)">
            <div className="grid grid-cols-1 gap-3 sm:max-w-xl sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="dash-exam">Exam</Label>
                <NativeSelect
                  id="dash-exam"
                  value={dashExam}
                  onChange={(e) => setDashExam(e.target.value)}
                  className="w-full"
                >
                  {dashExamOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </NativeSelect>
              </div>
              {dashView === "subject" && (
                <div className="space-y-1.5">
                  <Label htmlFor="dash-subj-class">Class</Label>
                  <NativeSelect
                    id="dash-subj-class"
                    value={dashSubjClass}
                    onChange={(e) => setDashSubjClass(e.target.value)}
                    className="w-full"
                  >
                    <option value="all">All Classes</option>
                    {(settings.classes || []).map((c) => (
                      <option key={c.id} value={c.id}>{formatClassDisplay(c)}</option>
                    ))}
                  </NativeSelect>
                </div>
              )}
            </div>

            {dashView === "class" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {classStats.map((row) => (
                  <div key={row.id} className="min-w-0 rounded-lg border border-border bg-muted/20 p-3">
                    <div className="mb-2 truncate text-sm font-semibold text-foreground">{row.name}</div>
                    <div className="grid grid-cols-2 gap-1.5 text-center sm:grid-cols-4">
                      {[
                        { l: "Enrolled", v: row.count },
                        { l: "Pass", v: row.pass },
                        { l: "Fail", v: row.fail },
                        { l: "Pass %", v: row.count ? `${row.passRatePct}%` : "—" },
                      ].map((cell) => (
                        <div key={cell.l} className="rounded-md border border-border bg-background px-1 py-2">
                          <div className="text-sm font-bold tabular-nums text-foreground">{cell.v}</div>
                          <div className="text-[9px] font-medium text-muted-foreground">{cell.l}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-dashed border-border pt-2 text-[11px]">
                      <span className="text-muted-foreground">Fee ({monthLabel.slice(0, 3)})</span>
                      <span className="font-semibold text-foreground">
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {subjectStats.map((row) => {
                    const passRatePct =
                      row.total > 0 ? Math.round(((100 * row.pass) / row.total) * 10) / 10 : 0;
                    return (
                      <div key={row.name} className="min-w-0 rounded-lg border border-border bg-muted/20 p-3">
                        <div className="mb-2 truncate text-sm font-semibold text-foreground">{row.name}</div>
                        <div className="grid grid-cols-2 gap-1.5 text-center sm:grid-cols-4">
                          {[
                            { l: "Appeared", v: row.total },
                            { l: "Pass", v: row.pass },
                            { l: "Fail", v: row.fail },
                            { l: "Pass %", v: row.total ? `${passRatePct}%` : "—" },
                          ].map((cell) => (
                            <div key={cell.l} className="rounded-md border border-border bg-background px-1 py-2">
                              <div className="text-sm font-bold tabular-nums text-foreground">{cell.v}</div>
                              <div className="text-[9px] font-medium text-muted-foreground">{cell.l}</div>
                            </div>
                          ))}
                        </div>
                        {row.total > 0 ? (
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-foreground/70"
                              style={{ width: `${passRatePct}%` }}
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
    </div>
  );
}
