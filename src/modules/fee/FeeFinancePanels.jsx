import React, { useEffect, useMemo, useState } from "react";
import { Btn, Sel, Inp } from "@/components/AppControls";
import { C } from "@/shared/theme";
import { feeService } from "@/services";
import * as H from "@/shared/helpers";
import { searchStudents } from "@/modules/students/studentsCore.js";
import {
  getEffectiveFeeAmount,
  getMonthsList,
  formatCurrency,
  loadConcessions,
  saveConcessions,
  loadExpenses,
  saveExpenses,
  addConcession,
  removeConcession,
  addExpense,
  removeExpense,
  buildDuesList,
  buildReceiptsList,
  summarizeFeeFinance,
  buildYearlyFeeTrend,
  expenseTotalsByCategory,
  CONCESSION_TYPES,
  EXPENSE_CATEGORIES,
} from "./feeFinanceCore.js";

const { formatClassDisplay } = H;

const panel = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
};

function useFeeMonth() {
  return useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });
}

function useHydratedFees(activeSchoolId) {
  const [feeRecords, setFeeRecords] = useState(() => feeService.load(activeSchoolId || "") || []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const records = feeService.hydrate
        ? await feeService.hydrate(activeSchoolId || "")
        : feeService.load(activeSchoolId || "");
      if (!cancelled) setFeeRecords(Array.isArray(records) ? records : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSchoolId]);
  return feeRecords;
}

export function FeeOverviewPanel({
  settings,
  students,
  activeSchoolId,
  onGoTab,
}) {
  const [period, setPeriod] = useFeeMonth();
  const feeRecords = useHydratedFees(activeSchoolId);
  const [concessions, setConcessions] = useState(() => loadConcessions(activeSchoolId));
  const [expenses, setExpenses] = useState(() => loadExpenses(activeSchoolId));
  const feeAmount = getEffectiveFeeAmount(settings);

  useEffect(() => {
    setConcessions(loadConcessions(activeSchoolId));
    setExpenses(loadExpenses(activeSchoolId));
  }, [activeSchoolId]);

  const summary = useMemo(
    () =>
      summarizeFeeFinance({
        feeRecords,
        students,
        classes: settings.classes,
        month: period.month,
        year: period.year,
        expenses,
        concessions,
        feeAmount,
      }),
    [feeRecords, students, settings.classes, period, expenses, concessions, feeAmount],
  );

  const monthValue = `${period.year}-${String(period.month).padStart(2, "0")}`;

  const cards = [
    { label: "Expected", value: formatCurrency(summary.expected), hint: `${summary.totalStudents} students × ${feeAmount}`, tab: "collection", accent: C.navy },
    { label: "Collected", value: formatCurrency(summary.collected), hint: `${summary.rate}% · ${summary.paidCount} paid`, tab: "receipts", accent: "#15803d" },
    { label: "Outstanding dues", value: formatCurrency(summary.pending), hint: `${summary.duesCount} students`, tab: "dues", accent: "#b91c1c" },
    { label: "Expenses (month)", value: formatCurrency(summary.expenseTotal), hint: `Net ${formatCurrency(summary.net)}`, tab: "expenses", accent: "#b45309" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...panel, padding: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>Fee & Finance Overview</div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.gray }}>
            Monthly fee {formatCurrency(feeAmount)} per student · {summary.concessionCount} concessions active
          </p>
        </div>
        <Inp
          label="Month"
          type="month"
          value={monthValue}
          onChange={(v) => {
            const [year, month] = String(v).split("-").map(Number);
            if (year && month) setPeriod({ year, month });
          }}
          width={160}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => onGoTab?.(c.tab)}
            style={{ ...panel, padding: 14, textAlign: "left", cursor: "pointer", borderTop: `3px solid ${c.accent}` }}
          >
            <div style={{ fontSize: 20, fontWeight: 800, color: c.accent }}>{c.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{c.label}</div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{c.hint}</div>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Btn small onClick={() => onGoTab?.("collection")}>Open Collection</Btn>
        <Btn small outline onClick={() => onGoTab?.("dues")}>View Dues</Btn>
        <Btn small outline onClick={() => onGoTab?.("receipts")}>Receipts</Btn>
        <Btn small outline onClick={() => onGoTab?.("concessions")}>Concessions</Btn>
        <Btn small outline onClick={() => onGoTab?.("expenses")}>Expenses</Btn>
        <Btn small outline onClick={() => onGoTab?.("reports")}>Reports</Btn>
      </div>
    </div>
  );
}

export function FeeDuesPanel({ settings, students, activeSchoolId }) {
  const [period, setPeriod] = useFeeMonth();
  const feeRecords = useHydratedFees(activeSchoolId);
  const [concessions, setConcessions] = useState(() => loadConcessions(activeSchoolId));
  const [classId, setClassId] = useState("all");
  const feeAmount = getEffectiveFeeAmount(settings);

  useEffect(() => {
    setConcessions(loadConcessions(activeSchoolId));
  }, [activeSchoolId]);

  const dues = useMemo(() => {
    const all = buildDuesList({
      feeRecords,
      students,
      classes: settings.classes,
      month: period.month,
      year: period.year,
      concessions,
      feeAmount,
    });
    if (classId === "all") return all;
    return all.filter((d) => String(d.classId) === String(classId));
  }, [feeRecords, students, settings.classes, period, concessions, feeAmount, classId]);

  const totalDue = dues.reduce((s, d) => s + d.dueAmount, 0);
  const monthValue = `${period.year}-${String(period.month).padStart(2, "0")}`;

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>Outstanding Dues</div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.gray }}>
            {dues.length} unpaid · {formatCurrency(totalDue)} (after concessions)
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Sel
            label="Class"
            value={classId}
            onChange={setClassId}
            options={[{ value: "all", label: "All classes" }, ...(settings.classes || []).map((c) => ({ value: c.id, label: formatClassDisplay(c) }))]}
            width={160}
          />
          <Inp
            label="Month"
            type="month"
            value={monthValue}
            onChange={(v) => {
              const [year, month] = String(v).split("-").map(Number);
              if (year && month) setPeriod({ year, month });
            }}
            width={150}
          />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#b91c1c", color: "#fff" }}>
              {["Class", "Roll", "Name", "Father", "Due", "Concession"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dues.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 16, textAlign: "center", color: C.gray }}>No outstanding dues for this filter.</td></tr>
            ) : (
              dues.map((d, i) => (
                <tr key={d.studentId} style={{ background: i % 2 ? "#fff" : "#fef2f2", borderBottom: "1px solid #fecaca" }}>
                  <td style={{ padding: "8px 10px" }}>{d.classLabel}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 700 }}>{d.rollNo || "—"}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{d.name}</td>
                  <td style={{ padding: "8px 10px", color: "#64748b" }}>{d.fatherName || "—"}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 700 }}>{formatCurrency(d.dueAmount)}</td>
                  <td style={{ padding: "8px 10px", fontSize: 11 }}>{d.concession ? d.concession.type : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FeeReceiptsPanel({ settings, students, activeSchoolId }) {
  const [period, setPeriod] = useFeeMonth();
  const feeRecords = useHydratedFees(activeSchoolId);
  const [query, setQuery] = useState("");
  const receipts = useMemo(() => {
    const list = buildReceiptsList({
      feeRecords,
      students,
      classes: settings.classes,
      month: period.month,
      year: period.year,
    });
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.name, r.rollNo, r.classLabel, r.receiptNo].map((v) => String(v || "").toLowerCase()).join(" ").includes(q),
    );
  }, [feeRecords, students, settings.classes, period, query]);

  const total = receipts.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const monthValue = `${period.year}-${String(period.month).padStart(2, "0")}`;

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>Payment Receipts</div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.gray }}>{receipts.length} receipts · {formatCurrency(total)}</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Inp label="Search" value={query} onChange={setQuery} placeholder="Name or receipt…" width={180} />
          <Inp
            label="Month"
            type="month"
            value={monthValue}
            onChange={(v) => {
              const [year, month] = String(v).split("-").map(Number);
              if (year && month) setPeriod({ year, month });
            }}
            width={150}
          />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#15803d", color: "#fff" }}>
              {["Receipt", "Date", "Student", "Class", "Roll", "Amount"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 16, textAlign: "center", color: C.gray }}>No payments recorded for this month.</td></tr>
            ) : (
              receipts.map((r, i) => (
                <tr key={r.id || i} style={{ background: i % 2 ? "#fff" : "#f0fdf4", borderBottom: "1px solid #bbf7d0" }}>
                  <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 11 }}>{r.receiptNo}</td>
                  <td style={{ padding: "8px 10px" }}>{r.paidAt ? String(r.paidAt).slice(0, 10) : "—"}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{r.name}</td>
                  <td style={{ padding: "8px 10px" }}>{r.classLabel}</td>
                  <td style={{ padding: "8px 10px" }}>{r.rollNo || "—"}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 700 }}>{formatCurrency(r.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FeeConcessionsPanel({ settings, students, setSettings, activeSchoolId }) {
  const [list, setList] = useState(() => loadConcessions(activeSchoolId));
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState(CONCESSION_TYPES[0]);
  const [mode, setMode] = useState("percent");
  const [value, setValue] = useState("50");
  const [reason, setReason] = useState("");
  const [query, setQuery] = useState("");
  const feeAmount = getEffectiveFeeAmount(settings);

  useEffect(() => {
    setList(loadConcessions(activeSchoolId));
  }, [activeSchoolId]);

  const persist = (next) => {
    setList(next);
    saveConcessions(activeSchoolId, next);
  };

  const options = useMemo(
    () => searchStudents({ students, classes: settings.classes, query, classId: "all", statusMode: "active" }),
    [students, settings.classes, query],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...panel, padding: 16 }}>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 4 }}>Fee structure & concessions</div>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: C.gray }}>
          Set the default monthly fee and grant discounts/waivers to individual students.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 16 }}>
          <Inp
            label="Monthly fee (Rs)"
            type="number"
            value={settings.feeAmount ?? feeAmount}
            onChange={(v) => setSettings?.((s) => ({ ...s, feeAmount: v === "" ? feeAmount : Number(v) }))}
            width={140}
          />
          <span style={{ fontSize: 12, color: C.gray, paddingBottom: 6 }}>Applies to dues calculations in this module.</span>
        </div>
        <div className="psms-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <Inp label="Search student" value={query} onChange={setQuery} placeholder="Name…" width="100%" />
          <Sel
            label="Student"
            value={studentId}
            onChange={setStudentId}
            options={[{ value: "", label: "Select…" }, ...options.map((s) => ({ value: s.id, label: `${s.name} · Roll ${s.rollNo || "—"}` }))]}
            width="100%"
          />
          <Sel label="Type" value={type} onChange={setType} options={CONCESSION_TYPES.map((t) => ({ value: t, label: t }))} width="100%" />
          <Sel
            label="Mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "percent", label: "Percent off" },
              { value: "amount", label: "Fixed amount off" },
            ]}
            width="100%"
          />
          <Inp label={mode === "percent" ? "Percent" : "Amount (Rs)"} type="number" value={value} onChange={setValue} width="100%" />
          <Inp label="Reason" value={reason} onChange={setReason} placeholder="Optional" width="100%" />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn
            onClick={() => {
              if (!studentId) {
                alert("Select a student.");
                return;
              }
              persist(addConcession(list.filter((c) => String(c.studentId) !== String(studentId)), { studentId, type, mode, value, reason }));
              setReason("");
            }}
          >
            Save Concession
          </Btn>
        </div>
      </div>
      <div style={{ ...panel, padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Active concessions ({list.length})</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#0f172a", color: "#fff" }}>
                {["Student", "Type", "Discount", "Reason", ""].map((h) => (
                  <th key={h || "a"} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: C.gray }}>No concessions yet.</td></tr>
              ) : (
                list.map((c, i) => {
                  const st = students.find((s) => String(s.id) === String(c.studentId));
                  return (
                    <tr key={c.id} style={{ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600 }}>{st?.name || c.studentId}</td>
                      <td style={{ padding: "8px 10px" }}>{c.type}</td>
                      <td style={{ padding: "8px 10px" }}>{c.mode === "percent" ? `${c.value}%` : formatCurrency(c.value)}</td>
                      <td style={{ padding: "8px 10px", color: "#64748b" }}>{c.reason || "—"}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <Btn small danger onClick={() => persist(removeConcession(list, c.id))}>Remove</Btn>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function FeeExpensesPanel({ activeSchoolId }) {
  const [list, setList] = useState(() => loadExpenses(activeSchoolId));
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [period, setPeriod] = useFeeMonth();

  useEffect(() => {
    setList(loadExpenses(activeSchoolId));
  }, [activeSchoolId]);

  const persist = (next) => {
    setList(next);
    saveExpenses(activeSchoolId, next);
  };

  const monthList = list.filter((e) => {
    const [y, m] = String(e.date || "").split("-").map(Number);
    return y === period.year && m === period.month;
  });
  const total = monthList.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const monthValue = `${period.year}-${String(period.month).padStart(2, "0")}`;

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ fontWeight: 700, color: C.navy, fontSize: 15, marginBottom: 4 }}>School Expenses</div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: C.gray }}>
        Track operating costs against fee collection. This month: {formatCurrency(total)}.
      </p>
      <div className="psms-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <Inp label="Title" value={title} onChange={setTitle} placeholder="e.g. Electricity bill" width="100%" />
        <Sel label="Category" value={category} onChange={setCategory} options={EXPENSE_CATEGORIES.map((t) => ({ value: t, label: t }))} width="100%" />
        <Inp label="Amount (Rs)" type="number" value={amount} onChange={setAmount} width="100%" />
        <Inp label="Date" type="date" value={date} onChange={setDate} width="100%" />
        <Inp label="Notes" value={notes} onChange={setNotes} placeholder="Optional" width="100%" />
        <Inp
          label="Filter month"
          type="month"
          value={monthValue}
          onChange={(v) => {
            const [year, month] = String(v).split("-").map(Number);
            if (year && month) setPeriod({ year, month });
          }}
          width="100%"
        />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Btn
          onClick={() => {
            if (!title.trim() || !amount) {
              alert("Title and amount are required.");
              return;
            }
            persist(addExpense(list, { title, category, amount, date, notes }));
            setTitle("");
            setAmount("");
            setNotes("");
          }}
        >
          Add Expense
        </Btn>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#b45309", color: "#fff" }}>
              {["Date", "Title", "Category", "Amount", "Notes", ""].map((h) => (
                <th key={h || "a"} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthList.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 16, textAlign: "center", color: C.gray }}>No expenses in this month.</td></tr>
            ) : (
              monthList.map((e, i) => (
                <tr key={e.id} style={{ background: i % 2 ? "#fff" : "#fffbeb", borderBottom: "1px solid #fde68a" }}>
                  <td style={{ padding: "8px 10px" }}>{e.date}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{e.title}</td>
                  <td style={{ padding: "8px 10px" }}>{e.category}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 700 }}>{formatCurrency(e.amount)}</td>
                  <td style={{ padding: "8px 10px", color: "#64748b" }}>{e.notes || "—"}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <Btn small danger onClick={() => persist(removeExpense(list, e.id))}>Remove</Btn>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FeeReportsPanel({ settings, students, activeSchoolId }) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [period, setPeriod] = useFeeMonth();
  const feeRecords = useHydratedFees(activeSchoolId);
  const expenses = loadExpenses(activeSchoolId);
  const feeAmount = getEffectiveFeeAmount(settings);
  const trend = useMemo(
    () => buildYearlyFeeTrend(feeRecords, { year, students, classes: settings.classes, feeAmount }),
    [feeRecords, year, students, settings.classes, feeAmount],
  );
  const byCat = expenseTotalsByCategory(expenses, { month: period.month, year: period.year });
  const monthValue = `${period.year}-${String(period.month).padStart(2, "0")}`;
  const yearCollected = trend.reduce((s, m) => s + m.collected, 0);
  const yearExpected = trend.reduce((s, m) => s + m.expected, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...panel, padding: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, color: C.navy }}>Yearly collection trend</div>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: C.gray }}>
              {year}: {formatCurrency(yearCollected)} collected of {formatCurrency(yearExpected)} expected
            </p>
          </div>
          <Inp label="Year" type="number" value={year} onChange={(v) => setYear(+v || year)} width={100} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 6, alignItems: "end", minHeight: 120 }}>
          {trend.map((m) => {
            const max = Math.max(...trend.map((t) => t.expected), 1);
            const h = Math.round((m.collected / max) * 100);
            return (
              <div key={m.month} style={{ textAlign: "center" }} title={`${m.label}: ${formatCurrency(m.collected)}`}>
                <div style={{ height: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                  <div style={{ width: "70%", height: `${Math.max(h, m.collected ? 4 : 0)}%`, background: "#15803d", borderRadius: "4px 4px 0 0" }} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4 }}>{m.label}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ ...panel, padding: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: C.navy }}>Expenses by category</div>
          <Inp
            label="Month"
            type="month"
            value={monthValue}
            onChange={(v) => {
              const [y, month] = String(v).split("-").map(Number);
              if (y && month) setPeriod({ year: y, month });
            }}
            width={150}
          />
        </div>
        {byCat.length === 0 ? (
          <div style={{ fontSize: 13, color: C.gray }}>No expenses recorded for this month.</div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
            {byCat.map((row) => (
              <li key={row.category} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "#f8fafc", borderRadius: 8, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{row.category}</span>
                <span style={{ fontWeight: 700 }}>{formatCurrency(row.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ ...panel, padding: 16, fontSize: 12, color: C.gray }}>
        Tip: use Collection to mark payments, Dues for follow-up lists, and Expenses to see net against fees.
        Months: {getMonthsList().map((m) => m.label.slice(0, 3)).join(", ")}.
      </div>
    </div>
  );
}
