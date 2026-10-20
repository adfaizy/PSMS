/** Daily Quick Test Register — data helpers & local persistence. */

export const DAY_SLOTS = 20;
export const MARK_MAX = 10;

export const PERFORMANCE_BANDS = [
  { id: "best", label: "Best", min: 9, max: 10, range: "9–10" },
  { id: "better", label: "Better", min: 7.5, max: 8.9, range: "7.5–8.9" },
  { id: "good", label: "Good", min: 6, max: 7.4, range: "6–7.4" },
  { id: "normal", label: "Normal", min: 4, max: 5.9, range: "4–5.9" },
  { id: "weak", label: "Weak", min: 0, max: 3.99, range: "below 4" },
];

export const STORAGE_KEY = "psms_daily_quick_register";

export function monthKeyFromDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function formatMonthLabel(monthKey) {
  const [y, m] = String(monthKey || "").split("-");
  if (!y || !m) return String(monthKey || "");
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(d.getTime())) return String(monthKey);
  return d.toLocaleString("en-GB", { month: "long", year: "numeric" });
}

/** Academic months Apr→Mar excluding Jun, Jul, Aug (summer break). */
export const SESSION_MONTH_ORDER = [4, 5, 9, 10, 11, 12, 1, 2, 3]

export function parseSessionYears(session) {
  const m = String(session || '').trim().match(/^(\d{4})\s*[-/]\s*(\d{4})$/)
  if (m) return { startYear: Number(m[1]), endYear: Number(m[2]) }
  const y = new Date().getFullYear()
  const mo = new Date().getMonth() // 0-based
  // Apr–Dec → session y-(y+1); Jan–Mar → (y-1)-y
  if (mo >= 3) return { startYear: y, endYear: y + 1 }
  return { startYear: y - 1, endYear: y }
}

/** Month keys for one academic session (April–March, no Jun/Jul/Aug). */
export function listSessionMonthOptions(session) {
  const { startYear, endYear } = parseSessionYears(session)
  return SESSION_MONTH_ORDER.map((month) => {
    const year = month >= 4 ? startYear : endYear
    return `${year}-${String(month).padStart(2, '0')}`
  })
}

/** Prefer current calendar month if it is a session teaching month; else first session month. */
export function defaultSessionMonthKey(session) {
  const options = listSessionMonthOptions(session)
  const now = monthKeyFromDate()
  if (options.includes(now)) return now
  return options[0] || now
}

/** Mon–Fri calendar days for the month (ISO date + day-of-month label). */
export function workingDaysForMonth(monthKey) {
  const [y, m] = String(monthKey || "").split("-").map(Number);
  const days = [];
  if (!y || !m) return days;
  const last = new Date(y, m, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const dt = new Date(y, m - 1, d);
    const wd = dt.getDay(); // 0=Sun … 6=Sat
    if (wd === 0 || wd === 6) continue; // weekends off
    days.push({
      dayNum: String(d).padStart(2, "0"),
      date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }
  return days;
}

export function defaultDayMeta(monthKey) {
  const working = workingDaysForMonth(monthKey);
  const days = working.slice(0, DAY_SLOTS).map((w) => ({
    dayNum: w.dayNum,
    date: w.date,
    subject: "",
    topic: "",
  }));
  while (days.length < DAY_SLOTS) {
    days.push({ dayNum: "", date: "", subject: "", topic: "" });
  }
  return days;
}

/** Refresh date / dayNum from month’s working days; keep subject & topic. */
export function syncDayMetaToWorkingDays(monthKey, existing = []) {
  const fresh = defaultDayMeta(monthKey);
  const prev = Array.isArray(existing) ? existing : [];
  return fresh.map((slot, i) => ({
    ...slot,
    subject: String(prev[i]?.subject || ""),
    topic: String(prev[i]?.topic || ""),
  }));
}

export function emptyStudentRow(partial = {}) {
  return {
    id: partial.id || `dr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    studentId: partial.studentId || null,
    roll: String(partial.roll ?? partial.rollNo ?? "").trim(),
    name: String(partial.name || "").trim(),
    father: String(partial.father ?? partial.fatherName ?? "").trim(),
    marks: Array.isArray(partial.marks)
      ? Array.from({ length: DAY_SLOTS }, (_, i) => {
          const v = partial.marks[i];
          if (v === "" || v == null) return "";
          const n = Number(v);
          return Number.isFinite(n) ? n : "";
        })
      : Array.from({ length: DAY_SLOTS }, () => ""),
    sba: partial.sba ?? "",
    remarks: String(partial.remarks || ""),
  };
}

export function seedStudentsFromRoster(roster = []) {
  return (Array.isArray(roster) ? roster : [])
    .slice()
    .sort((a, b) => {
      const ra = Number(a.rollNo) || 0;
      const rb = Number(b.rollNo) || 0;
      if (ra !== rb) return ra - rb;
      return String(a.name || "").localeCompare(String(b.name || ""));
    })
    .map((s) =>
      emptyStudentRow({
        studentId: s.id,
        roll: s.rollNo,
        name: s.name,
        father: s.fatherName,
      }),
    );
}

export function blankSheet(monthKey, roster = []) {
  return {
    monthKey,
    dayMeta: defaultDayMeta(monthKey),
    students: seedStudentsFromRoster(roster),
    updatedAt: new Date().toISOString(),
  };
}

function storageRoot() {
  try {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function writeStorageRoot(root) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  } catch {
    /* ignore */
  }
}

export function sheetStorageId(schoolId, classId, monthKey) {
  return `${schoolId || "school"}__${classId || "class"}__${monthKey || "month"}`;
}

export function loadSheet(schoolId, classId, monthKey, roster = []) {
  const root = storageRoot();
  const id = sheetStorageId(schoolId, classId, monthKey);
  const saved = root[id];
  if (!saved || typeof saved !== "object") return blankSheet(monthKey, roster);
  const savedStudents = Array.isArray(saved.students)
    ? saved.students.map((s) => emptyStudentRow(s))
    : [];
  const students = savedStudents.length ? savedStudents : seedStudentsFromRoster(roster);
  return {
    monthKey,
    dayMeta: syncDayMetaToWorkingDays(monthKey, saved.dayMeta),
    students,
    updatedAt: saved.updatedAt || null,
  };
}

export function saveSheet(schoolId, classId, monthKey, sheet) {
  const root = storageRoot();
  const id = sheetStorageId(schoolId, classId, monthKey);
  root[id] = {
    monthKey,
    dayMeta: sheet.dayMeta,
    students: sheet.students,
    updatedAt: new Date().toISOString(),
  };
  writeStorageRoot(root);
  if (schoolId) {
    const prefix = `${schoolId}__`;
    const schoolSheets = {};
    for (const [k, v] of Object.entries(root)) {
      if (k.startsWith(prefix)) schoolSheets[k] = v;
    }
    import("../../lib/moduleLocalsSync.js")
      .then((m) => m.pushOneModuleLocal(schoolId, m.MODULE_KEYS.DAILY_REGISTER, schoolSheets))
      .catch(() => {});
  }
  return root[id].updatedAt;
}

export function parseMark(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > MARK_MAX) return MARK_MAX;
  return n;
}

export function studentTotals(student) {
  const marks = (student?.marks || [])
    .map(parseMark)
    .filter((n) => n != null);
  const total = marks.reduce((s, n) => s + n, 0);
  const avg = marks.length ? total / marks.length : 0;
  return {
    total,
    avg,
    count: marks.length,
    avgDisplay: marks.length ? avg.toFixed(1) : "—",
    totalDisplay: marks.length ? String(total) : "—",
  };
}

export function dayIsActive(dayMeta, index) {
  const d = dayMeta?.[index];
  if (!d) return false;
  return Boolean(String(d.date || "").trim() || String(d.subject || "").trim() || String(d.topic || "").trim());
}

export function daySummary(students, dayMeta, index) {
  const active = dayIsActive(dayMeta, index);
  let present = 0;
  let absent = 0;
  let sum = 0;
  let marked = 0;
  (students || []).forEach((s) => {
    const m = parseMark(s.marks?.[index]);
    if (m != null) {
      present += 1;
      sum += m;
      marked += 1;
    } else if (active) {
      absent += 1;
    }
  });
  return {
    present,
    absent,
    average: marked ? (sum / marked).toFixed(1) : "—",
  };
}

export function bandForAverage(avg) {
  if (!Number.isFinite(avg)) return null;
  if (avg >= 9) return PERFORMANCE_BANDS[0];
  if (avg >= 7.5) return PERFORMANCE_BANDS[1];
  if (avg >= 6) return PERFORMANCE_BANDS[2];
  if (avg >= 4) return PERFORMANCE_BANDS[3];
  return PERFORMANCE_BANDS[4];
}

export function buildReport(sheet, { schoolName, schoolCode, classLabel, monthKey } = {}) {
  const students = (sheet?.students || []).map((s) => {
    const t = studentTotals(s);
    return { ...s, ...t, band: bandForAverage(t.count ? t.avg : NaN) };
  });

  const overall = {};
  PERFORMANCE_BANDS.forEach((b) => {
    overall[b.id] = students
      .filter((s) => s.band?.id === b.id)
      .sort((a, b) => b.avg - a.avg || String(a.roll).localeCompare(String(b.roll), undefined, { numeric: true }));
  });

  const subjects = [];
  const seen = new Set();
  (sheet?.dayMeta || []).forEach((d) => {
    const sub = String(d.subject || "").trim();
    if (!sub || seen.has(sub.toLowerCase())) return;
    seen.add(sub.toLowerCase());
    subjects.push({ subject: sub, indices: [] });
  });
  (sheet?.dayMeta || []).forEach((d, idx) => {
    const sub = String(d.subject || "").trim().toLowerCase();
    const hit = subjects.find((s) => s.subject.toLowerCase() === sub);
    if (hit) hit.indices.push(idx);
  });

  const bySubject = subjects.map(({ subject, indices }) => {
    const rows = (sheet?.students || [])
      .map((s) => {
        const marks = indices.map((i) => parseMark(s.marks?.[i])).filter((n) => n != null);
        if (!marks.length) return null;
        const total = marks.reduce((a, b) => a + b, 0);
        const avg = total / marks.length;
        return {
          id: s.id,
          roll: s.roll,
          name: s.name,
          father: s.father,
          avg,
          avgDisplay: avg.toFixed(1),
          count: marks.length,
          band: bandForAverage(avg),
        };
      })
      .filter(Boolean);

    const bands = {};
    PERFORMANCE_BANDS.forEach((b) => {
      bands[b.id] = rows
        .filter((r) => r.band?.id === b.id)
        .sort((a, b) => b.avg - a.avg || String(a.roll).localeCompare(String(b.roll), undefined, { numeric: true }));
    });
    return { subject, bands, total: rows.length };
  });

  return {
    schoolName: schoolName || "School",
    schoolCode: schoolCode || "—",
    classLabel: classLabel || "—",
    monthLabel: formatMonthLabel(monthKey || sheet?.monthKey),
    onRoll: students.length,
    overall,
    bySubject,
    students,
  };
}

export function uniqueGrades(classes = []) {
  const set = new Set();
  (classes || []).forEach((c) => {
    const g = String(c.grade || c.name || "").trim();
    if (g) set.add(g);
  });
  return [...set];
}

export function sectionsForGrade(classes = [], grade) {
  return (classes || []).filter((c) => String(c.grade || c.name || "").trim() === String(grade || "").trim());
}

export function resolveClassId(classes = [], grade, sectionIdOrName) {
  const list = sectionsForGrade(classes, grade);
  if (!list.length) return "";
  const byId = list.find((c) => c.id === sectionIdOrName);
  if (byId) return byId.id;
  const bySec = list.find((c) => String(c.section || "").trim() === String(sectionIdOrName || "").trim());
  if (bySec) return bySec.id;
  return list[0].id;
}
