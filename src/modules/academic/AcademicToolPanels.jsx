import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { ClassSubjCard, CommonTeachersEditor } from "@/modules/settings/SettingsPage";
import { setNavIntent } from "@/lib/navIntent.js";
import {
  summarizeAcademicStructure,
  buildClassSubjectMatrix,
  addAcademicClass,
  removeAcademicClass,
  addClassSubject,
  removeClassSubject,
  normalizeSessionList,
  validateSessionLabel,
  addCalendarEvent,
  removeCalendarEvent,
  upcomingCalendarEvents,
  addSchemeUnit,
  removeSchemeUnit,
  getSchemeUnits,
  CALENDAR_EVENT_TYPES,
  formatClassDisplay,
} from "./academicCore.js";

function navigate(onNavigate, page, tab) {
  if (tab) setNavIntent({ page, tab });
  onNavigate?.(page);
}

export function AcademicOverviewPanel({
  settings,
  sessions,
  currentSession,
  students = [],
  exam_datesheet,
  onNavigate,
  onGoTab,
}) {
  const summary = summarizeAcademicStructure(settings, sessions, currentSession);
  const upcoming = upcomingCalendarEvents(settings?.academicCalendar);
  const datesheetCount = Array.isArray(exam_datesheet?.dates) ? exam_datesheet.dates.length : 0;
  const enrolled = Array.isArray(students) ? students.length : 0;

  const cards = [
    { label: "Classes", value: summary.classCount, hint: `${summary.gradeCount} grades`, tab: "classes" },
    { label: "Subjects", value: summary.uniqueSubjects, hint: `${summary.examSubjectSlots} exam slots`, tab: "subjects" },
    { label: "Session", value: summary.currentSession, hint: `${summary.sessionCount} sessions`, tab: "sessions" },
    { label: "Calendar", value: summary.calendarEvents, hint: "Holidays & events", tab: "calendar" },
    { label: "Periods / day", value: summary.periodsPerDay || "—", hint: "Bell schedule", tab: "periods" },
    { label: "Students", value: enrolled, hint: "Active enrollment", page: "students", pageTab: "directory" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
        {cards.map((c) => (
          <Button
            key={c.label}
            type="button"
            variant="outline"
            onClick={() => {
              if (c.page) navigate(onNavigate, c.page, c.pageTab);
              else onGoTab?.(c.tab);
            }}
            className="h-auto w-full flex-col items-start gap-0.5 rounded-xl p-3.5 text-left font-normal shadow-none hover:bg-accent/50"
          >
            <div className="text-[22px] font-extrabold text-primary">{c.value}</div>
            <div className="text-xs font-bold mt-1">{c.label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{c.hint}</div>
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3.5">
        <Card className="shadow-none">
          <CardContent className="p-4">
            <CardTitle className="mb-2">Related tools</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate(onNavigate, "timetable")}>Open Timetable</Button>
              <Button size="sm" variant="outline" onClick={() => navigate(onNavigate, "examination", "datesheet")}>
                Date Sheet ({datesheetCount})
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate(onNavigate, "examination", "marks")}>Marks Entry</Button>
              <Button size="sm" variant="outline" onClick={() => onGoTab?.("scheme")}>Scheme of Studies</Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Academic structure drives roll numbers, timetable generation, exams, and ID cards.
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <CardTitle className="mb-2">Upcoming calendar</CardTitle>
            {upcoming.length === 0 ? (
              <div className="text-sm text-muted-foreground">No upcoming events. Add holidays on the Calendar tab.</div>
            ) : (
              <ul className="m-0 p-0 list-none grid gap-2">
                {upcoming.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2 text-xs">
                    <span className="font-semibold">{e.title}</span>
                    <span className="text-muted-foreground">{e.date} · {e.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function AcademicClassesPanel({ settings, setSettings }) {
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");

  const addClass = () => {
    const result = addAcademicClass(settings, { grade, section });
    if (result.error) {
      alert(result.error);
      return;
    }
    setSettings(result.settings);
    setGrade("");
    setSection("");
    if (result.newClass) {
      void import("../../lib/photosFolderSync.js")
        .then((m) => m.ensureClassPhotoFolders?.([result.newClass]))
        .catch(() => {});
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="shadow-none">
        <CardContent className="p-4">
          <CardTitle className="mb-1">Classes & Sections</CardTitle>
          <CardDescription className="mb-3">
            Add grades/sections and manage examination & timetable subjects for each class.
          </CardDescription>
          <div className="flex flex-wrap gap-2.5 items-end">
            <div className="flex flex-col gap-1.5">
              <Label>Grade</Label>
              <Input
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="e.g. 5 or Nursery"
                className="w-36"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Section</Label>
              <Input
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g. A"
                className="w-28"
              />
            </div>
            <Button size="sm" onClick={addClass}>Add Class</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
        {(settings.classes || []).map((cls) => (
          <ClassSubjCard
            key={cls.id}
            cls={cls}
            examSubjects={(settings.classSubjectsExam || settings.classSubjects || {})[cls.id] || []}
            timetableSubjects={(settings.classSubjectsTimetable || settings.classSubjects || {})[cls.id] || []}
            onAddExam={(s) => setSettings((prev) => addClassSubject(prev, cls.id, s, "exam"))}
            onRemoveExam={(s) => setSettings((prev) => removeClassSubject(prev, cls.id, s, "exam"))}
            onAddTimetable={(s) => setSettings((prev) => addClassSubject(prev, cls.id, s, "timetable"))}
            onRemoveTimetable={(s) => setSettings((prev) => removeClassSubject(prev, cls.id, s, "timetable"))}
            onRemoveClass={() => {
              if (!confirm(`Remove ${formatClassDisplay(cls)}?`)) return;
              setSettings((prev) => removeAcademicClass(prev, cls.id));
            }}
          />
        ))}
      </div>

      {(settings.classes || []).length === 0 && (
        <Card className="shadow-none">
          <CardContent className="p-6 text-center text-muted-foreground">
            No classes yet. Add the first grade/section above.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function AcademicSubjectsPanel({ settings, setSettings }) {
  const matrix = useMemo(() => buildClassSubjectMatrix(settings), [settings]);
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkTarget, setBulkTarget] = useState("exam");

  const applyBulk = () => {
    const name = bulkSubject.trim();
    if (!name) return;
    if (!confirm(`Add "${name}" to ${bulkTarget} subjects for all classes?`)) return;
    setSettings((prev) => {
      let next = prev;
      ;(prev.classes || []).forEach((c) => {
        next = addClassSubject(next, c.id, name, bulkTarget === "timetable" ? "timetable" : "exam");
      });
      return next;
    });
    setBulkSubject("");
  };

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="shadow-none">
        <CardContent className="p-4">
          <CardTitle className="mb-1">Subject Matrix</CardTitle>
          <CardDescription className="mb-3">
            {matrix.allSubjects.length} unique subjects across {matrix.rows.length} classes.
          </CardDescription>
          <div className="flex flex-wrap gap-2.5 items-end">
            <div className="flex flex-col gap-1.5">
              <Label>Add subject to all classes</Label>
              <Input
                value={bulkSubject}
                onChange={(e) => setBulkSubject(e.target.value)}
                placeholder="e.g. Mathematics"
                className="w-56"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Apply to</Label>
              <NativeSelect value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value)} size="sm" className="w-36">
                <NativeSelectOption value="exam">Examination</NativeSelectOption>
                <NativeSelectOption value="timetable">Timetable</NativeSelectOption>
              </NativeSelect>
            </div>
            <Button size="sm" onClick={applyBulk}>Apply</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {["Class", "Exam subjects", "Timetable subjects"].map((h) => (
                  <TableHead key={h} className="bg-muted text-foreground">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-5">
                    No classes configured.
                  </TableCell>
                </TableRow>
              ) : (
                matrix.rows.map((r, i) => (
                  <TableRow key={r.classId} className={i % 2 !== 0 ? "" : "bg-muted/20"}>
                    <TableCell className="font-bold">{r.label}</TableCell>
                    <TableCell>{r.exam.join(", ") || "—"}</TableCell>
                    <TableCell>{r.timetable.join(", ") || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <CommonTeachersEditor settings={settings} setSettings={setSettings} />
    </div>
  );
}

export function AcademicSessionsPanel({
  sessions,
  currentSession,
  setCurrentSession,
  addSession,
}) {
  const [newSession, setNewSession] = useState("");
  const list = normalizeSessionList(sessions, currentSession);

  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <CardTitle className="text-base mb-1">Academic Sessions</CardTitle>
        <CardDescription className="mb-3.5">
          Exam marks and date sheets are stored per session. Switch the active year to view that data.
        </CardDescription>
        <div className="flex flex-wrap gap-2.5 items-end mb-4">
          <div className="flex flex-col gap-1.5">
            <Label>Current session</Label>
            <NativeSelect
              value={currentSession || list[0] || ""}
              onChange={(e) => setCurrentSession?.(e.target.value)}
              size="sm"
              className="w-44"
            >
              {list.map((s) => (
                <NativeSelectOption key={s} value={s}>{s}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Add session</Label>
            <Input
              value={newSession}
              onChange={(e) => setNewSession(e.target.value)}
              placeholder="2025-2026"
              className="w-36"
            />
          </div>
          <Button
            size="sm"
            onClick={() => {
              const check = validateSessionLabel(newSession);
              if (!check.ok) {
                alert(check.error);
                return;
              }
              addSession?.(check.session);
              setNewSession("");
            }}
          >
            Add Session
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {list.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={s === currentSession ? "secondary" : "outline"}
              className={cn(
                "text-xs font-bold",
                s === currentSession && "border-2 border-primary bg-primary/10 text-primary",
              )}
              onClick={() => setCurrentSession?.(s)}
            >
              {s}{s === currentSession ? " · Active" : ""}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AcademicCalendarPanel({ settings, setSettings }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState("Holiday");
  const [notes, setNotes] = useState("");
  const calendar = Array.isArray(settings?.academicCalendar) ? settings.academicCalendar : [];

  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <CardTitle className="text-base mb-1">Academic Calendar</CardTitle>
        <CardDescription className="mb-3.5">
          Holidays, school events, and exam windows for planning attendance and date sheets.
        </CardDescription>
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <div className="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Summer vacation" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <NativeSelect value={type} onChange={(e) => setType(e.target.value)} size="sm" className="w-full">
              {CALENDAR_EVENT_TYPES.map((t) => (
                <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Start date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>End date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 col-span-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div className="flex justify-end mb-4">
          <Button
            size="sm"
            onClick={() => {
              if (!title.trim() || !date) {
                alert("Title and start date are required.");
                return;
              }
              setSettings((prev) => ({
                ...prev,
                academicCalendar: addCalendarEvent(prev.academicCalendar, { title, date, endDate, type, notes }),
              }));
              setTitle("");
              setNotes("");
              setEndDate("");
            }}
          >
            Add Event
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {["Date", "Title", "Type", "Notes", ""].map((h) => (
                  <TableHead key={h || "action"} className="bg-muted text-foreground">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {calendar.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                    No calendar entries yet.
                  </TableCell>
                </TableRow>
              ) : (
                calendar.map((e, i) => (
                  <TableRow key={e.id} className={i % 2 !== 0 ? "" : "bg-muted/20"}>
                    <TableCell className="whitespace-nowrap">
                      {e.date}{e.endDate && e.endDate !== e.date ? ` → ${e.endDate}` : ""}
                    </TableCell>
                    <TableCell className="font-semibold">{e.title}</TableCell>
                    <TableCell>{e.type}</TableCell>
                    <TableCell className="text-muted-foreground">{e.notes || "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            academicCalendar: removeCalendarEvent(prev.academicCalendar, e.id),
                          }))
                        }
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function AcademicPeriodsPanel({ settings, setSettings }) {
  const setHour = (key, field, value) => {
    setSettings((s) => ({
      ...s,
      schoolHours: {
        ...(s.schoolHours || {}),
        [key]: { ...(s.schoolHours?.[key] || {}), [field]: value },
      },
    }));
  };

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="shadow-none">
        <CardContent className="p-4">
          <CardTitle className="mb-3">School Hours</CardTitle>
          {[
            { key: "mondayToThursday", label: "Monday – Thursday" },
            { key: "friday", label: "Friday" },
            { key: "saturday", label: "Saturday" },
          ].map(({ key, label }) => (
            <div key={key} className="grid grid-cols-[160px_1fr_1fr] gap-2.5 mb-2.5 items-end">
              <div className="text-sm font-semibold">{label}</div>
              <div className="flex flex-col gap-1.5">
                <Label>Start</Label>
                <Input
                  type="time"
                  value={settings.schoolHours?.[key]?.start || ""}
                  onChange={(e) => setHour(key, "start", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>End</Label>
                <Input
                  type="time"
                  value={settings.schoolHours?.[key]?.end || ""}
                  onChange={(e) => setHour(key, "end", e.target.value)}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardContent className="p-4">
          <CardTitle className="mb-3">Period lengths</CardTitle>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              ["assemblyTime", "Assembly (min)"],
              ["firstPeriodTime", "Period 1 (min)"],
              ["otherPeriodTime", "Other periods (min)"],
              ["periodsPerDay", "Periods per day"],
            ].map(([key, label]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label>{label}</Label>
                <Input
                  type="number"
                  value={settings[key] ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value === "" ? "" : +e.target.value }))}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardContent className="p-4">
          <CardTitle className="mb-3">Breaks</CardTitle>
          <label className="flex items-center gap-2 text-sm font-semibold mb-2.5 cursor-pointer">
            <Checkbox
              checked={!!settings.breakRequired}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, breakRequired: !!v }))}
            />
            Break required (Mon–Thu / Sat)
          </label>
          {settings.breakRequired && (
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div className="flex flex-col gap-1.5">
                <Label>After period #</Label>
                <Input
                  type="number"
                  value={settings.breakAfterPeriod ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, breakAfterPeriod: +e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  value={settings.breakDuration ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, breakDuration: +e.target.value }))}
                />
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm font-semibold mb-2.5 cursor-pointer">
            <Checkbox
              checked={!!settings.fridayBreak}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, fridayBreak: !!v }))}
            />
            Friday break required
          </label>
          {settings.fridayBreak && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1.5">
                <Label>Friday after period #</Label>
                <Input
                  type="number"
                  value={settings.fridayBreakAfter ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, fridayBreakAfter: +e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Friday duration (min)</Label>
                <Input
                  type="number"
                  value={settings.fridayBreakDuration ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, fridayBreakDuration: +e.target.value }))}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AcademicSchemePanel({ settings, setSettings }) {
  const classes = settings.classes || [];
  const [classId, setClassId] = useState(classes[0]?.id || "");
  const subjects = (settings.classSubjectsExam || settings.classSubjects || {})[classId] || [];
  const [subject, setSubject] = useState(subjects[0] || "");
  const [unit, setUnit] = useState("");
  const [topics, setTopics] = useState("");
  const [periods, setPeriods] = useState("");
  const units = getSchemeUnits(settings.schemeOfStudies, classId, subject);

  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <CardTitle className="text-base mb-1">Scheme of Studies</CardTitle>
        <CardDescription className="mb-3.5">
          Outline units and topics for each class subject (foundation for lesson planning).
        </CardDescription>
        <div className="flex flex-wrap gap-2.5 mb-3.5">
          <div className="flex flex-col gap-1.5">
            <Label>Class</Label>
            <NativeSelect
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                const nextSubs = (settings.classSubjectsExam || settings.classSubjects || {})[e.target.value] || [];
                setSubject(nextSubs[0] || "");
              }}
              size="sm"
              className="w-44"
            >
              {classes.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>{formatClassDisplay(c)}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Subject</Label>
            <NativeSelect value={subject} onChange={(e) => setSubject(e.target.value)} size="sm" className="w-44">
              {subjects.map((s) => (
                <NativeSelectOption key={s} value={s}>{s}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
        {classId && subject ? (
          <>
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div className="flex flex-col gap-1.5">
                <Label>Unit / chapter</Label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. Unit 1 — Algebra" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Periods</Label>
                <Input type="number" value={periods} onChange={(e) => setPeriods(e.target.value)} placeholder="e.g. 8" />
              </div>
              <div className="flex flex-col gap-1.5 col-span-2">
                <Label>Topics</Label>
                <Input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="Short topic list" />
              </div>
            </div>
            <div className="flex justify-end mb-3.5">
              <Button
                size="sm"
                onClick={() => {
                  if (!unit.trim()) {
                    alert("Enter a unit title.");
                    return;
                  }
                  setSettings((prev) => ({
                    ...prev,
                    schemeOfStudies: addSchemeUnit(prev.schemeOfStudies, classId, subject, { unit, topics, periods }),
                  }));
                  setUnit("");
                  setTopics("");
                  setPeriods("");
                }}
              >
                Add Unit
              </Button>
            </div>
            {units.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground border border-dashed border-border rounded-lg">
                No units for this subject yet.
              </div>
            ) : (
              <ul className="m-0 p-0 list-none grid gap-2">
                {units.map((u) => (
                  <li key={u.id} className="p-3 border border-border rounded-lg flex justify-between gap-2.5">
                    <div>
                      <div className="font-bold text-sm">{u.unit}</div>
                      {u.topics ? <div className="text-xs text-muted-foreground mt-0.5">{u.topics}</div> : null}
                      {u.periods ? <div className="text-[11px] text-muted-foreground mt-0.5">{u.periods} periods</div> : null}
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          schemeOfStudies: removeSchemeUnit(prev.schemeOfStudies, classId, subject, u.id),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="p-4 text-center text-muted-foreground">
            Select a class with exam subjects first.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
