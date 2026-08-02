/**
 * School Staff — timetable roster synced from Staff Profiles.
 * Auto-generation needs: name, qualification, designation→level, subjects for that level.
 */

export const SCHOOL_STAFF_LEVELS = [
  { id: "primary", label: "Primary", short: "P", designations: ["PST", "ESE"] },
  { id: "middle", label: "Middle", short: "M", designations: ["EST", "SESE", "OT"] },
  { id: "high", label: "High", short: "H", designations: ["SST", "SSE"] },
];

const LEVEL_BY_CODE = (() => {
  const map = new Map();
  for (const lvl of SCHOOL_STAFF_LEVELS) {
    for (const code of lvl.designations) map.set(code.toLowerCase(), lvl.id);
  }
  return map;
})();

const VALID_LEVEL_IDS = new Set(SCHOOL_STAFF_LEVELS.map((l) => l.id));

function normName(s) {
  return String(s || "").trim().toLowerCase();
}

/** Extract cadre codes from free-text designation (e.g. "SST (ARTS)", "PST-Math"). */
export function extractDesignationCodes(designation) {
  const raw = String(designation || "").toUpperCase();
  if (!raw.trim()) return [];
  const codes = [];
  for (const lvl of SCHOOL_STAFF_LEVELS) {
    for (const code of lvl.designations) {
      const re = new RegExp(`(?:^|[^A-Z0-9])${code}(?:[^A-Z0-9]|$)`, "i");
      if (re.test(raw)) codes.push(code);
    }
  }
  return codes;
}

/** All levels implied by designation codes (may be more than one). */
export function inferStaffLevelsFromDesignation(designation) {
  const codes = extractDesignationCodes(designation);
  const levels = [];
  for (const code of codes) {
    const level = LEVEL_BY_CODE.get(code.toLowerCase());
    if (level && !levels.includes(level)) levels.push(level);
  }
  return levels;
}

export function inferStaffLevelFromDesignation(designation) {
  return inferStaffLevelsFromDesignation(designation)[0] || "";
}

/** Normalize row.levels / legacy row.level into a clean id array. */
export function normalizeStaffLevels(rowOrLevels) {
  if (typeof rowOrLevels === "string") {
    return VALID_LEVEL_IDS.has(rowOrLevels) ? [rowOrLevels] : [];
  }
  if (Array.isArray(rowOrLevels)) {
    return [...new Set(rowOrLevels.filter((id) => VALID_LEVEL_IDS.has(id)))];
  }
  const row = rowOrLevels && typeof rowOrLevels === "object" ? rowOrLevels : {};
  if (Object.prototype.hasOwnProperty.call(row, "levels") && Array.isArray(row.levels)) {
    return [...new Set(row.levels.filter((id) => VALID_LEVEL_IDS.has(id)))];
  }
  if (row.level && VALID_LEVEL_IDS.has(row.level)) return [row.level];
  return inferStaffLevelsFromDesignation(row.designation);
}

/** Teacher can take a class level if they ticked that level (or have none set = all). */
export function teacherCoversClassLevel(teacherLevels, clsLevel) {
  if (!clsLevel) return true;
  const levels = normalizeStaffLevels(teacherLevels);
  if (!levels.length) return true;
  return levels.includes(clsLevel);
}

export function levelLabel(levelId) {
  return SCHOOL_STAFF_LEVELS.find((l) => l.id === levelId)?.label || "—";
}

export function levelShortLabels(levels) {
  const set = new Set(normalizeStaffLevels(levels));
  return SCHOOL_STAFF_LEVELS.filter((l) => set.has(l.id)).map((l) => l.short);
}

export function designationsForLevel(levelId) {
  return SCHOOL_STAFF_LEVELS.find((l) => l.id === levelId)?.designations || [];
}

export function designationsForLevels(levels) {
  const ids = normalizeStaffLevels(levels);
  const codes = [];
  for (const id of ids) {
    for (const code of designationsForLevel(id)) {
      if (!codes.includes(code)) codes.push(code);
    }
  }
  return codes;
}

export function formatStaffQualification(profile) {
  if (!profile || typeof profile !== "object") return "";
  const aq = String(profile.aq || "").trim();
  const pq = String(profile.pq || "").trim();
  if (aq && pq) return `${aq} / ${pq}`;
  return aq || pq || "";
}

export function isTeachingProfile(profile) {
  if (!profile) return false;
  const cat = String(profile.staffCategory || "").trim().toLowerCase();
  if (cat.includes("non teaching") || cat.includes("non-teaching") || cat.includes("worker")) return false;
  if (cat.includes("teaching") || cat.includes("teacher")) return true;
  const d = String(profile.designation || "").trim().toLowerCase();
  if (!d) return true;
  if (
    d.includes("clerk") ||
    d.includes("peon") ||
    d.includes("naib") ||
    d.includes("qasid") ||
    d.includes("chowkidar") ||
    d.includes("sweeper") ||
    d.includes("driver") ||
    d.includes("support") ||
    d.includes("non teaching") ||
    d.includes("non-teaching")
  ) {
    return false;
  }
  return true;
}

/** Class grade → primary / middle / high (for auto timetable matching). */
export function inferClassLevel(cls) {
  const g = String(cls?.grade || "").trim().toLowerCase();
  if (!g) return "";
  if (["nursery", "kg", "k", "prep", "play", "lkg", "ukg"].includes(g)) return "primary";
  const n = parseInt(g, 10);
  if (!Number.isNaN(n)) {
    if (n >= 1 && n <= 5) return "primary";
    if (n >= 6 && n <= 8) return "middle";
    if (n >= 9 && n <= 12) return "high";
  }
  return "";
}

function newStaffId() {
  return `ss-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptySchoolStaffRow(partial = {}) {
  const designation = partial.designation || "";
  const hasExplicitLevels = Object.prototype.hasOwnProperty.call(partial, "levels");
  const levels = normalizeStaffLevels(
    hasExplicitLevels || partial.level
      ? partial
      : { designation, levels: inferStaffLevelsFromDesignation(designation) },
  );
  const classSubjects = normalizeStaffClassSubjects(partial);
  const subjects =
    Object.keys(classSubjects).length > 0
      ? formatSubjectList(flattenStaffClassSubjects(classSubjects))
      : String(partial.subjects || "").trim();
  const inchargeClassIds = normalizeInchargeClassIds(partial);
  return {
    id: partial.id || newStaffId(),
    profileId: partial.profileId || null,
    name: partial.name || "",
    designation,
    qualification: partial.qualification || "",
    levels,
    level: levels[0] || "", // legacy single-level field
    classSubjects,
    subjects, // flat union for auto-gen / legacy
    inchargeClassIds,
    source: partial.source || (partial.profileId ? "profile" : "manual"),
  };
}

/**
 * Merge Staff Profiles (Teaching) into School Staff.
 * Profile fields (name, designation, qualification) update dynamically;
 * subjects and manually ticked levels are preserved when set.
 */
export function syncSchoolStaffFromProfiles(schoolStaff, staffProfiles) {
  const existing = Array.isArray(schoolStaff) ? schoolStaff : [];
  const profiles = (Array.isArray(staffProfiles) ? staffProfiles : []).filter(
    (p) => p && isTeachingProfile(p) && String(p.name || "").trim(),
  );

  const byProfileId = new Map();
  const byName = new Map();
  for (const row of existing) {
    if (row?.profileId) byProfileId.set(String(row.profileId), row);
    const key = normName(row?.name);
    if (key && !byName.has(key)) byName.set(key, row);
  }

  const next = [];
  const consumed = new Set();

  for (const p of profiles) {
    const prev = byProfileId.get(String(p.id)) || byName.get(normName(p.name));
    if (prev?.id) consumed.add(prev.id);
    const designation = String(p.designation || prev?.designation || "").trim();
    const inferredLevels = inferStaffLevelsFromDesignation(designation);
    const prevLevels = normalizeStaffLevels(prev || {});
    // Keep user-ticked levels if any; else use designation inference
    const levels = prevLevels.length ? prevLevels : inferredLevels;
    const subjects =
      String(prev?.subjects || "").trim() ||
      String(p.subj || "").trim() ||
      "";
    const classSubjects = normalizeStaffClassSubjects(prev || {});
    const inchargeClassIds = normalizeInchargeClassIds(prev || {});
    next.push(
      emptySchoolStaffRow({
        id: prev?.id || p.id || newStaffId(),
        profileId: p.id,
        name: String(p.name || "").trim(),
        designation,
        qualification: formatStaffQualification(p) || String(prev?.qualification || "").trim(),
        levels,
        classSubjects,
        subjects,
        inchargeClassIds,
        source: "profile",
      }),
    );
  }

  for (const row of existing) {
    if (!row || consumed.has(row.id)) continue;
    if (row.profileId) {
      const stillThere = profiles.some((p) => String(p.id) === String(row.profileId));
      if (!stillThere) {
        next.push({
          ...emptySchoolStaffRow(row),
          profileId: null,
          source: "manual",
        });
      }
      continue;
    }
    next.push(emptySchoolStaffRow(row));
  }

  return next;
}

export function schoolStaffEqual(a, b) {
  return JSON.stringify(a || []) === JSON.stringify(b || []);
}

/** Slim staff list for timetable UI / auto-gen (includes subj + levels). */
export function schoolStaffToTimetableStaff(schoolStaff, staffProfiles) {
  const photoById = new Map(
    (Array.isArray(staffProfiles) ? staffProfiles : [])
      .filter((p) => p?.id)
      .map((p) => [String(p.id), p.photo || null]),
  );
  const photoByName = new Map(
    (Array.isArray(staffProfiles) ? staffProfiles : [])
      .filter((p) => p?.name)
      .map((p) => [normName(p.name), p.photo || null]),
  );
  return (Array.isArray(schoolStaff) ? schoolStaff : [])
    .filter((s) => String(s?.name || "").trim())
    .map((s) => {
      const levels = normalizeStaffLevels(s);
      const classSubjects = normalizeStaffClassSubjects(s);
      const inchargeClassIds = normalizeInchargeClassIds(s);
      const subj =
        Object.keys(classSubjects).length > 0
          ? formatSubjectList(flattenStaffClassSubjects(classSubjects))
          : String(s.subjects || "").trim();
      return {
        id: s.id,
        name: String(s.name || "").trim(),
        designation: String(s.designation || "").trim(),
        qualification: String(s.qualification || "").trim(),
        levels,
        level: levels[0] || "",
        classSubjects,
        inchargeClassIds,
        subj,
        photo:
          (s.profileId && photoById.get(String(s.profileId))) ||
          photoByName.get(normName(s.name)) ||
          null,
        staffCategory: "Teaching",
      };
    });
}

export function parseSubjectList(subjects) {
  return String(subjects || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Format subject list back to stored string. */
export function formatSubjectList(list) {
  return (Array.isArray(list) ? list : [])
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join(", ");
}

/** Normalize per-class subject map: { [classId]: string[] }. */
export function normalizeStaffClassSubjects(rowOrMap) {
  if (!rowOrMap || typeof rowOrMap !== "object" || Array.isArray(rowOrMap)) return {};
  const looksLikeStaffRow =
    Object.prototype.hasOwnProperty.call(rowOrMap, "classSubjects") ||
    Object.prototype.hasOwnProperty.call(rowOrMap, "name") ||
    Object.prototype.hasOwnProperty.call(rowOrMap, "subjects") ||
    Object.prototype.hasOwnProperty.call(rowOrMap, "levels") ||
    Object.prototype.hasOwnProperty.call(rowOrMap, "designation");
  const map = looksLikeStaffRow
    ? rowOrMap.classSubjects && typeof rowOrMap.classSubjects === "object" && !Array.isArray(rowOrMap.classSubjects)
      ? rowOrMap.classSubjects
      : {}
    : rowOrMap;

  const out = {};
  for (const [cid, list] of Object.entries(map || {})) {
    const id = String(cid || "").trim();
    if (!id) continue;
    const arr = Array.isArray(list)
      ? list.map((s) => String(s || "").trim()).filter(Boolean)
      : parseSubjectList(list);
    if (!arr.length) continue;
    const seen = new Set();
    const cleaned = [];
    for (const s of arr) {
      const k = s.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      cleaned.push(s);
    }
    out[id] = cleaned;
  }
  return out;
}

export function flattenStaffClassSubjects(classSubjects) {
  const seen = new Map();
  for (const list of Object.values(normalizeStaffClassSubjects(classSubjects))) {
    for (const s of list) {
      const k = s.toLowerCase();
      if (!seen.has(k)) seen.set(k, s);
    }
  }
  return [...seen.values()];
}

export function subjectsForStaffClass(row, classId) {
  const map = normalizeStaffClassSubjects(row);
  return map[String(classId || "").trim()] || [];
}

/** Class ids this teacher is incharge of. */
export function normalizeInchargeClassIds(rowOrList) {
  const list = Array.isArray(rowOrList)
    ? rowOrList
    : Array.isArray(rowOrList?.inchargeClassIds)
      ? rowOrList.inchargeClassIds
      : [];
  return [...new Set(list.map((id) => String(id || "").trim()).filter(Boolean))];
}

export function isStaffClassIncharge(row, classId) {
  const cid = String(classId || "").trim();
  if (!cid) return false;
  return normalizeInchargeClassIds(row).includes(cid);
}

/**
 * Toggle incharge for one class. Only one teacher may be incharge per class —
 * returns patches for the toggled row and any other rows that must clear it.
 */
export function toggleStaffClassIncharge(rows, staffId, classId) {
  const cid = String(classId || "").trim();
  const id = String(staffId || "");
  if (!cid || !id) return [];
  const patches = [];
  const target = (rows || []).find((r) => String(r.id) === id);
  if (!target) return [];
  const currently = isStaffClassIncharge(target, cid);
  if (currently) {
    patches.push({
      id,
      inchargeClassIds: normalizeInchargeClassIds(target).filter((x) => x !== cid),
    });
    return patches;
  }
  patches.push({
    id,
    inchargeClassIds: [...normalizeInchargeClassIds(target).filter((x) => x !== cid), cid],
  });
  for (const row of rows || []) {
    if (String(row.id) === id) continue;
    if (!isStaffClassIncharge(row, cid)) continue;
    patches.push({
      id: row.id,
      inchargeClassIds: normalizeInchargeClassIds(row).filter((x) => x !== cid),
    });
  }
  return patches;
}

/** Map classId → incharge teacher name (first wins). */
export function buildInchargeTeacherByClass(rows) {
  const map = {};
  for (const row of rows || []) {
    const name = String(row?.name || "").trim();
    if (!name) continue;
    for (const cid of normalizeInchargeClassIds(row)) {
      if (!map[cid]) map[cid] = name;
    }
  }
  return map;
}

/** Whether subject is marked Common Teacher for this grade in settings. */
export function isCommonTeacherSubject(settings, grade, subject) {
  const map = settings?.commonTeachers?.[String(grade || "").trim()] || {};
  const target = String(subject || "").trim().toLowerCase();
  if (!target) return false;
  return Object.entries(map).some(([k, on]) => on && String(k).trim().toLowerCase() === target);
}

/** Class ids that share a common-teacher subject tick (same grade sections). */
export function commonSubjectClassIds(settings, grade, subject) {
  const g = String(grade || "").trim();
  if (!g || !isCommonTeacherSubject(settings, g, subject)) return [];
  return (settings?.classes || [])
    .filter((c) => String(c.grade || "").trim() === g)
    .map((c) => c.id)
    .filter(Boolean);
}

/**
 * Toggle a subject for a staff row on one class.
 * Common-teacher subjects apply to all sections of that grade.
 * Returns updated { classSubjects, subjects }.
 */
export function toggleStaffClassSubject(row, settings, classId, subject) {
  const label = String(subject || "").trim();
  const cid = String(classId || "").trim();
  if (!label || !cid) {
    return {
      classSubjects: normalizeStaffClassSubjects(row),
      subjects: String(row?.subjects || "").trim(),
    };
  }
  const cls = (settings?.classes || []).find((c) => String(c.id) === cid);
  const grade = cls?.grade;
  const targetIds = (() => {
    const shared = commonSubjectClassIds(settings, grade, label);
    return shared.length ? shared : [cid];
  })();

  const next = { ...normalizeStaffClassSubjects(row) };
  const key = label.toLowerCase();
  const currentlyOn = (next[cid] || []).some((s) => s.toLowerCase() === key);

  for (const id of targetIds) {
    const list = next[id] || [];
    if (currentlyOn) {
      const filtered = list.filter((s) => s.toLowerCase() !== key);
      if (filtered.length) next[id] = filtered;
      else delete next[id];
    } else {
      if (!list.some((s) => s.toLowerCase() === key)) next[id] = [...list, label];
    }
  }

  return {
    classSubjects: next,
    subjects: formatSubjectList(flattenStaffClassSubjects(next)),
  };
}

/**
 * Claim map for skipping subjects already taken by another teacher.
 * Keys: `class:{classId}:{subjectKey}` or `common:{grade}:{subjectKey}`
 * Value: staff row id
 */
export function buildSubjectClaimMap(rows, settings) {
  const claims = new Map();
  for (const row of rows || []) {
    const map = normalizeStaffClassSubjects(row);
    const entries = Object.entries(map);
    if (!entries.length) {
      // Legacy flat subjects: claim per selected level (whole level)
      const levels = normalizeStaffLevels(row);
      for (const s of parseSubjectList(row.subjects)) {
        const sk = s.toLowerCase();
        for (const level of levels) {
          const key = `level:${level}:${sk}`;
          if (!claims.has(key)) claims.set(key, row.id);
        }
      }
      continue;
    }
    for (const [classId, list] of entries) {
      const cls = (settings?.classes || []).find((c) => String(c.id) === String(classId));
      const grade = cls?.grade;
      for (const s of list) {
        const sk = s.toLowerCase();
        const claimKey = isCommonTeacherSubject(settings, grade, s)
          ? `common:${String(grade || "").trim()}:${sk}`
          : `class:${classId}:${sk}`;
        if (!claims.has(claimKey)) claims.set(claimKey, row.id);
      }
    }
  }
  return claims;
}

export function subjectClaimKey(settings, classId, grade, subject) {
  const sk = String(subject || "").trim().toLowerCase();
  if (!sk) return "";
  if (isCommonTeacherSubject(settings, grade, subject)) {
    return `common:${String(grade || "").trim()}:${sk}`;
  }
  return `class:${String(classId || "").trim()}:${sk}`;
}

/** Timetable subjects for a class id (falls back to exam / legacy maps). */
export function getClassSubjectsFromSettings(settings, classId, type = "timetable") {
  if (!classId) return [];
  const source =
    type === "timetable" ? settings?.classSubjectsTimetable : settings?.classSubjectsExam;
  if (source && Array.isArray(source[classId])) return source[classId];
  const legacy = settings?.classSubjects;
  if (legacy && Array.isArray(legacy[classId])) return legacy[classId];
  if (type === "timetable" && settings?.classSubjectsExam && Array.isArray(settings.classSubjectsExam[classId])) {
    return settings.classSubjectsExam[classId];
  }
  return [];
}

/**
 * Unique subject labels from classes whose grade falls in the given levels (P/M/H).
 * Prefer timetable subjects; dedupe case-insensitively.
 */
export function subjectsForStaffLevels(settings, levels) {
  const seen = new Map();
  for (const group of classSubjectsByStaffLevels(settings, levels)) {
    for (const s of group.subjects) {
      const k = s.toLowerCase();
      if (!seen.has(k)) seen.set(k, s);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Subjects grouped by class for the selected staff levels (P/M/H).
 * Each entry: { classId, label, level, grade, section, subjects[] }
 */
export function classSubjectsByStaffLevels(settings, levels) {
  const want = new Set(normalizeStaffLevels(levels));
  if (!want.size) return [];
  const groups = [];
  for (const cls of settings?.classes || []) {
    const level = inferClassLevel(cls);
    if (!want.has(level)) continue;
    const seen = new Set();
    const subjects = [];
    for (const s of getClassSubjectsFromSettings(settings, cls.id, "timetable")) {
      const t = String(s || "").trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      subjects.push(t);
    }
    if (!subjects.length) {
      // Still list the class so Incharge can be assigned
    } else {
      subjects.sort((a, b) => a.localeCompare(b));
    }
    const grade = String(cls.grade || "").trim();
    const section = String(cls.section || "").trim().toUpperCase();
    const label =
      String(cls.name || "").trim() ||
      (grade ? `Class ${grade}${section && section !== "-" ? `-${section}` : ""}` : cls.id);
    groups.push({
      classId: cls.id,
      label,
      level,
      grade,
      section,
      subjects,
    });
  }
  groups.sort((a, b) => {
    const na = parseInt(a.grade, 10);
    const nb = parseInt(b.grade, 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
    return String(a.label).localeCompare(String(b.label), undefined, { numeric: true });
  });
  return groups;
}
