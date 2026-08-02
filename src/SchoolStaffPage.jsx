import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { UI } from "./uiTokens.js";
import { Button } from "./components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card.jsx";
import {
  SCHOOL_STAFF_LEVELS,
  buildSubjectClaimMap,
  classSubjectsByStaffLevels,
  designationsForLevels,
  emptySchoolStaffRow,
  inferStaffLevelsFromDesignation,
  isCommonTeacherSubject,
  isStaffClassIncharge,
  levelLabel,
  normalizeStaffClassSubjects,
  normalizeStaffLevels,
  parseSubjectList,
  schoolStaffEqual,
  subjectClaimKey,
  subjectsForStaffClass,
  syncSchoolStaffFromProfiles,
  toggleStaffClassIncharge,
  toggleStaffClassSubject,
  normalizeInchargeClassIds,
} from "./modules/schoolStaff/schoolStaffCore.js";

const C = {
  navy: UI.navy,
  gray: UI.gray,
};

const FS = { body: UI.fontBody, small: UI.fontSmall };

const inputStyle = {
  width: "100%",
  padding: "7px 10px",
  border: "1.5px solid #d1d5db",
  borderRadius: 6,
  fontSize: FS.body,
  boxSizing: "border-box",
  fontFamily: "inherit",
  background: "#fff",
};

/**
 * School Staff — name, qualification, designation/level, subjects for timetable auto-gen.
 * Linked rows sync name/designation/qualification from Staff Profiles; subjects stay editable here.
 */
export default function SchoolStaffPage({
  staffProfiles = [],
  schoolStaff = [],
  settings = null,
  setSchools,
  activeSchoolId,
  setBarSubtitle,
}) {
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (setBarSubtitle) queueMicrotask(() => setBarSubtitle("Timetable roster"));
  }, [setBarSubtitle]);

  const persist = (next) => {
    const cleaned = (Array.isArray(next) ? next : []).map((r) => emptySchoolStaffRow(r));
    setSchools((prev) =>
      prev.map((s) => (s.id === activeSchoolId ? { ...s, schoolStaff: cleaned } : s)),
    );
  };

  // When Staff Profiles change, refresh linked School Staff fields (keep subjects).
  useEffect(() => {
    setSchools((prev) =>
      prev.map((s) => {
        if (s.id !== activeSchoolId) return s;
        const current = Array.isArray(s.schoolStaff) ? s.schoolStaff : [];
        const profiles = Array.isArray(s.staffProfiles) ? s.staffProfiles : staffProfiles;
        const merged = syncSchoolStaffFromProfiles(current, profiles);
        if (schoolStaffEqual(merged, current)) return s;
        return { ...s, schoolStaff: merged };
      }),
    );
  }, [staffProfiles, activeSchoolId, setSchools]);

  const rows = Array.isArray(schoolStaff) ? schoolStaff : [];

  const teachingProfileCount = useMemo(
    () =>
      (Array.isArray(staffProfiles) ? staffProfiles : []).filter((p) => {
        const cat = String(p?.staffCategory || "").toLowerCase();
        if (cat.includes("non")) return false;
        return !!String(p?.name || "").trim();
      }).length,
    [staffProfiles],
  );

  const syncFromProfiles = () => {
    const merged = syncSchoolStaffFromProfiles(rows, staffProfiles);
    persist(merged);
    setMsg(
      `Synced ${merged.filter((r) => r.source === "profile").length} teaching profile(s). Subjects you set here were kept.`,
    );
  };

  const patchRow = (id, patch) => {
    persist(
      rows.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (Object.prototype.hasOwnProperty.call(patch, "designation") && patch.levels === undefined) {
          const inferred = inferStaffLevelsFromDesignation(next.designation);
          if (inferred.length && !normalizeStaffLevels(next).length) {
            next.levels = inferred;
          }
        }
        if (Array.isArray(next.levels)) {
          next.level = next.levels[0] || "";
        }
        return next;
      }),
    );
  };

  const toggleLevel = (id, levelId) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const current = normalizeStaffLevels(row);
    const next = current.includes(levelId)
      ? current.filter((x) => x !== levelId)
      : [...current, levelId];
    patchRow(id, { levels: next, level: next[0] || "" });
  };

  const toggleSubject = (id, classId, subject) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const label = String(subject || "").trim();
    const cid = String(classId || "").trim();
    if (!label || !cid) return;

    const selected = subjectsForStaffClass(row, cid);
    const key = label.toLowerCase();
    const has = selected.some((s) => s.toLowerCase() === key);
    if (!has) {
      const cls = (settings?.classes || []).find((c) => String(c.id) === cid);
      const claimKey = subjectClaimKey(settings, cid, cls?.grade, label);
      const owner = subjectClaims.get(claimKey);
      if (owner && owner !== id) return;
    }

    const patched = toggleStaffClassSubject(row, settings, cid, label);
    patchRow(id, patched);
  };

  const toggleIncharge = (id, classId) => {
    const cid = String(classId || "").trim();
    const owner = inchargeOwnerByClass.get(cid);
    // Locked for everyone except the current incharge (who may untick)
    if (owner && owner.id !== id) return;
    const patches = toggleStaffClassIncharge(rows, id, classId);
    if (!patches.length) return;
    const byId = new Map(patches.map((p) => [String(p.id), p]));
    persist(
      rows.map((r) => {
        const p = byId.get(String(r.id));
        return p ? { ...r, inchargeClassIds: p.inchargeClassIds } : r;
      }),
    );
  };

  const classSubjectsByLevel = useMemo(() => {
    const map = {};
    for (const l of SCHOOL_STAFF_LEVELS) {
      map[l.id] = classSubjectsByStaffLevels(settings, [l.id]);
    }
    return map;
  }, [settings]);

  const subjectClaims = useMemo(
    () => buildSubjectClaimMap(rows, settings),
    [rows, settings],
  );

  /** classId → { id, name } of the teacher who is incharge (first wins). */
  const inchargeOwnerByClass = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const name = String(row?.name || "").trim() || "Teacher";
      for (const cid of normalizeInchargeClassIds(row)) {
        if (!map.has(cid)) map.set(cid, { id: row.id, name });
      }
    }
    return map;
  }, [rows]);

  const groupsForLevels = (levelIds) => {
    const ids = normalizeStaffLevels(levelIds);
    if (!ids.length) return [];
    const out = [];
    const seenClass = new Set();
    for (const id of ids) {
      for (const g of classSubjectsByLevel[id] || []) {
        if (seenClass.has(g.classId)) continue;
        seenClass.add(g.classId);
        out.push(g);
      }
    }
    out.sort((a, b) => {
      const na = parseInt(a.grade, 10);
      const nb = parseInt(b.grade, 10);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
      return String(a.label).localeCompare(String(b.label), undefined, { numeric: true });
    });
    return out;
  };

  const subjectAvailableForRow = (rowId, classId, grade, subject, selectedKeys) => {
    const key = String(subject || "").trim().toLowerCase();
    if (!key) return false;
    if (selectedKeys.has(key)) return true;
    const claimKey = subjectClaimKey(settings, classId, grade, subject);
    const owner = subjectClaims.get(claimKey);
    return !owner || owner === rowId;
  };

  const addManual = () => {
    persist([...rows, emptySchoolStaffRow({ source: "manual" })]);
    setMsg("Added a blank teacher row — fill name, designation, and subjects.");
  };

  const removeRow = (id) => {
    if (!confirm("Remove this teacher from Teachers? (Staff Profiles are not deleted.)")) return;
    persist(rows.filter((r) => r.id !== id));
  };

  return (
    <Card className="min-h-full border-border shadow-sm" style={{ fontFamily: UI.fontApp, fontSize: FS.body }}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <CardTitle style={UI.pageTitle(0)}>Teachers</CardTitle>
          <CardDescription className="max-w-xl text-xs leading-relaxed">
            Timetable auto-generation uses <strong>name</strong> and subjects ticked <strong>per class</strong>.
            Tick <strong>Incharge</strong> on a class so that teacher gets the first and last periods (and can take
            other periods). Common-teacher subjects apply to all sections of that grade.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={syncFromProfiles}>
            <RefreshCw size={14} /> Sync from Staff Profiles ({teachingProfileCount})
          </Button>
          <Button type="button" size="sm" onClick={addManual}>
            <Plus size={14} /> Add Staff
          </Button>
        </div>
      </CardHeader>
      <CardContent>

      {msg ? (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 6,
            background: "#ecfdf5",
            color: "#065f46",
            fontSize: FS.small,
          }}
        >
          {msg}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 20px",
            background: "#f9fafb",
            borderRadius: 8,
            border: "2px dashed #e5e7eb",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 10 }}>👩‍🏫</div>
          <h3 style={{ margin: "0 0 8px", color: C.navy, fontSize: 16 }}>No Teachers yet</h3>
          <p
            style={{
              margin: "0 0 14px",
              color: C.gray,
              fontSize: FS.body,
              maxWidth: 420,
              marginInline: "auto",
            }}
          >
            Add teaching staff in <strong>Staff Profiles</strong>, then sync — or add a row here manually for
            timetable generation.
          </p>
          <Button type="button" size="sm" onClick={syncFromProfiles}>
            Sync from Staff Profiles
          </Button>
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: FS.body, minWidth: 1100 }}>
            <thead>
              <tr style={{ background: C.navy, color: "#fff" }}>
                {["Name", "Level", "Subjects (by class)", ""].map(
                  (h) => (
                    <th
                      key={h || "actions"}
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        fontSize: FS.small,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const fromProfile = row.source === "profile" && row.profileId;
                const rowLevels = normalizeStaffLevels(row);
                const levelCodes = designationsForLevels(rowLevels);
                const rowClassSubjects = normalizeStaffClassSubjects(row);
                const allLevelGroups = groupsForLevels(rowLevels);
                const classGroups = allLevelGroups.map((group) => {
                  const selectedKeys = new Set(
                    subjectsForStaffClass(row, group.classId).map((s) => s.toLowerCase()),
                  );
                  return {
                    ...group,
                    selectedKeys,
                    subjects: group.subjects.filter((subj) =>
                      subjectAvailableForRow(
                        row.id,
                        group.classId,
                        group.grade,
                        subj,
                        selectedKeys,
                      ),
                    ),
                    isIncharge: isStaffClassIncharge(row, group.classId),
                    inchargeOwner: inchargeOwnerByClass.get(String(group.classId)) || null,
                  };
                });
                // Legacy flat subjects not yet mapped per class
                const flatLegacy = Object.keys(rowClassSubjects).length
                  ? []
                  : parseSubjectList(row.subjects);
                const poolKeys = new Set(
                  allLevelGroups.flatMap((g) => g.subjects.map((s) => s.toLowerCase())),
                );
                const orphanSubjects = flatLegacy.filter((s) => !poolKeys.has(s.toLowerCase()));
                return (
                  <tr
                    key={row.id}
                    style={{
                      background: i % 2 === 0 ? "#f9fafb" : "#fff",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <td style={{ padding: 8, minWidth: 140 }}>
                      <input
                        value={row.name || ""}
                        onChange={(e) => patchRow(row.id, { name: e.target.value })}
                        placeholder="Full name"
                        disabled={!!fromProfile}
                        title={fromProfile ? "Name comes from Staff Profiles" : undefined}
                        style={{ ...inputStyle, background: fromProfile ? "#f1f5f9" : "#fff" }}
                      />
                    </td>
                    <td style={{ padding: 8, minWidth: 120 }}>
                      <div
                        style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-start" }}
                        title="Tick levels this teacher can take (P=Primary, M=Middle, H=High)"
                      >
                        {SCHOOL_STAFF_LEVELS.map((l) => {
                          const checked = rowLevels.includes(l.id);
                          return (
                            <label
                              key={l.id}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                cursor: "pointer",
                                fontSize: FS.small,
                                fontWeight: 700,
                                color: checked ? C.navy : "#64748b",
                                userSelect: "none",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleLevel(row.id, l.id)}
                                style={{ width: 14, height: 14, accentColor: "#15803d", cursor: "pointer" }}
                              />
                              {l.short}
                            </label>
                          );
                        })}
                      </div>
                      {levelCodes.length ? (
                        <div style={{ fontSize: 10, color: C.gray, marginTop: 4 }}>
                          {levelCodes.join(", ")}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: 8, minWidth: 480, width: "55%", verticalAlign: "top" }}>
                      {!rowLevels.length ? (
                        <div style={{ fontSize: FS.small, color: C.gray }}>
                          Tick P / M / H to list class subjects
                        </div>
                      ) : !classGroups.length && !orphanSubjects.length ? (
                        <div style={{ fontSize: FS.small, color: C.gray }}>
                          {`No classes/subjects for ${rowLevels.map(levelLabel).join(" / ")}. Add them in Settings → Classes.`}
                        </div>
                      ) : (
                        <div
                          style={{ display: "flex", flexDirection: "column", gap: 4 }}
                          title={`Subjects by class (${rowLevels.map(levelLabel).join(" / ")})`}
                        >
                          {classGroups.map((group) => {
                            const inchargeLocked =
                              group.inchargeOwner &&
                              group.inchargeOwner.id !== row.id &&
                              !group.isIncharge;
                            return (
                            <div
                              key={group.classId}
                              style={{
                                display: "flex",
                                flexWrap: "nowrap",
                                alignItems: "center",
                                gap: 10,
                                minWidth: 0,
                                overflowX: "auto",
                                whiteSpace: "nowrap",
                                paddingBottom: 2,
                              }}
                            >
                                <label
                                  title={
                                    inchargeLocked
                                      ? `Incharge locked — ${group.inchargeOwner.name}`
                                      : "Class incharge — gets first & last period in auto-generate"
                                  }
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    cursor: inchargeLocked ? "not-allowed" : "pointer",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: inchargeLocked ? "#94a3b8" : C.navy,
                                    letterSpacing: 0.2,
                                    userSelect: "none",
                                    opacity: inchargeLocked ? 0.75 : 1,
                                    flex: "0 0 auto",
                                    whiteSpace: "nowrap",
                                    minWidth: 110,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!group.isIncharge}
                                    disabled={!!inchargeLocked}
                                    onChange={() => toggleIncharge(row.id, group.classId)}
                                    style={{
                                      width: 13,
                                      height: 13,
                                      accentColor: "#b45309",
                                      cursor: inchargeLocked ? "not-allowed" : "pointer",
                                      flexShrink: 0,
                                    }}
                                  />
                                  {group.label}
                                  {group.isIncharge ? (
                                    <span style={{ fontSize: 9, color: "#b45309", fontWeight: 700 }}>
                                      (incharge)
                                    </span>
                                  ) : inchargeLocked ? (
                                    <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>
                                      (locked · {group.inchargeOwner.name})
                                    </span>
                                  ) : null}
                                </label>
                                <div
                                  style={{
                                    display: "inline-flex",
                                    flexWrap: "nowrap",
                                    gap: "4px 12px",
                                    alignItems: "center",
                                    flex: "1 1 auto",
                                    minWidth: 0,
                                  }}
                                >
                                {!group.subjects.length ? (
                                  <span style={{ fontSize: 11, color: C.gray, whiteSpace: "nowrap" }}>
                                    No free subjects for this class
                                  </span>
                                ) : null}
                                {group.subjects.map((subj) => {
                                  const checked = group.selectedKeys.has(subj.toLowerCase());
                                  const isCommon = isCommonTeacherSubject(
                                    settings,
                                    group.grade,
                                    subj,
                                  );
                                  return (
                                    <label
                                      key={`${group.classId}-${subj}`}
                                      title={
                                        isCommon
                                          ? "Common teacher — applies to all sections of this grade"
                                          : undefined
                                      }
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4,
                                        cursor: "pointer",
                                        fontSize: FS.small,
                                        fontWeight: checked ? 700 : 500,
                                        color: checked ? C.navy : "#475569",
                                        userSelect: "none",
                                        whiteSpace: "nowrap",
                                        flex: "0 0 auto",
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleSubject(row.id, group.classId, subj)}
                                        style={{
                                          width: 13,
                                          height: 13,
                                          accentColor: "#15803d",
                                          cursor: "pointer",
                                          flexShrink: 0,
                                        }}
                                      />
                                      {subj}
                                      {isCommon ? (
                                        <span style={{ fontSize: 9, color: "#64748b", fontWeight: 600 }}>
                                          (common)
                                        </span>
                                      ) : null}
                                    </label>
                                  );
                                })}
                                </div>
                            </div>
                            );
                          })}
                          {orphanSubjects.length ? (
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "nowrap",
                                alignItems: "center",
                                gap: 10,
                                overflowX: "auto",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: "#64748b",
                                  flex: "0 0 auto",
                                  minWidth: 110,
                                }}
                              >
                                Other (old)
                              </div>
                              <div
                                style={{
                                  display: "inline-flex",
                                  flexWrap: "nowrap",
                                  gap: "4px 12px",
                                  alignItems: "center",
                                }}
                              >
                                {orphanSubjects.map((subj) => (
                                  <label
                                    key={`orphan-${subj}`}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                      cursor: "pointer",
                                      fontSize: FS.small,
                                      fontWeight: 700,
                                      color: C.navy,
                                      userSelect: "none",
                                      whiteSpace: "nowrap",
                                      flex: "0 0 auto",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked
                                      onChange={() => {
                                        const next = parseSubjectList(row.subjects).filter(
                                          (s) => s.toLowerCase() !== subj.toLowerCase(),
                                        );
                                        patchRow(row.id, {
                                          subjects: next.join(", "),
                                          classSubjects: normalizeStaffClassSubjects(row),
                                        });
                                      }}
                                      style={{
                                        width: 13,
                                        height: 13,
                                        accentColor: "#15803d",
                                        cursor: "pointer",
                                        flexShrink: 0,
                                      }}
                                    />
                                    {subj}
                                  </label>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeRow(row.id)}
                        title="Remove from Teachers"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </CardContent>
    </Card>
  );
}
