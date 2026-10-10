import React, { useState } from "react";
import { Btn, Sel, Inp } from "@/components/AppControls";
import { C } from "@/shared/theme";
import {
  DEFAULT_LIBRARY_RULES,
  loadLibraryRules,
  saveLibraryRules,
  loadFinePayments,
  saveFinePayments,
  summarizeLibrary,
  listOverdue,
  listMembers,
  addFinePayment,
  removeFinePayment,
  buildCirculationReport,
} from "./libraryManageCore.js";

// formatCurrency helper inline to avoid fee dependency
function money(n) {
  return `Rs. ${Number(n || 0).toLocaleString("en-PK")}`;
}

const panel = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
};

export function LibraryOverviewPanel({ activeSchoolId, onGoTab }) {
  const rules = loadLibraryRules(activeSchoolId);
  const summary = summarizeLibrary(activeSchoolId, rules);

  const cards = [
    { label: "Titles", value: summary.bookCount, hint: `${summary.totalCopies} copies`, tab: "catalog", accent: "#1e3a5f" },
    { label: "Available", value: summary.availableCopies, hint: "Ready to issue", tab: "catalog", accent: "#15803d" },
    { label: "Issued now", value: summary.issuedCount, hint: `${summary.returnedCount} returned (history)`, tab: "catalog", accent: "#0f766e" },
    { label: "Overdue", value: summary.overdueCount, hint: money(summary.fineTotal) + " fines", tab: "overdue", accent: "#b91c1c" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...panel, padding: 16 }}>
        <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>Library Overview</div>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.gray }}>
          Loan period {rules.loanDays} days · Fine {money(rules.finePerDay)}/day · Max {rules.maxBooksPerStudent} books / student
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => onGoTab?.(c.tab)}
            style={{ ...panel, padding: 14, textAlign: "left", cursor: "pointer", borderTop: `3px solid ${c.accent}` }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: c.accent }}>{c.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{c.label}</div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{c.hint}</div>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Btn small onClick={() => onGoTab?.("catalog")}>Open Catalog</Btn>
        <Btn small outline onClick={() => onGoTab?.("overdue")}>Overdue list</Btn>
        <Btn small outline onClick={() => onGoTab?.("members")}>Active members</Btn>
        <Btn small outline onClick={() => onGoTab?.("fines")}>Fines & rules</Btn>
        <Btn small outline onClick={() => onGoTab?.("reports")}>Reports</Btn>
      </div>
      {summary.overdue.length > 0 && (
        <div style={{ ...panel, padding: 16 }}>
          <div style={{ fontWeight: 700, color: C.navy, marginBottom: 8 }}>Top overdue</div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6, fontSize: 12 }}>
            {summary.overdue.slice(0, 5).map((b) => (
              <li key={b.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span><strong>{b.borrowerDisplay}</strong> · {b.bookTitle}</span>
                <span style={{ color: "#b91c1c", fontWeight: 700 }}>{b.overdueDays}d · {money(b.fineAmount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function LibraryOverduePanel({ activeSchoolId }) {
  const rules = loadLibraryRules(activeSchoolId);
  const rows = listOverdue(activeSchoolId, rules);
  const total = rows.reduce((s, r) => s + r.fineAmount, 0);

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>Overdue Books</div>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.gray }}>
          {rows.length} overdue · estimated fines {money(total)} ({money(rules.finePerDay)}/day after {rules.loanDays} days)
        </p>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#b91c1c", color: "#fff" }}>
              {["Borrower", "Class", "Roll", "Book", "Due", "Days", "Fine"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 16, textAlign: "center", color: C.gray }}>No overdue borrowings.</td></tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 ? "#fff" : "#fef2f2", borderBottom: "1px solid #fecaca" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{r.borrowerDisplay}</td>
                  <td style={{ padding: "8px 10px" }}>{r.className || "—"}</td>
                  <td style={{ padding: "8px 10px" }}>{r.roll || "—"}</td>
                  <td style={{ padding: "8px 10px" }}>{r.bookTitle}</td>
                  <td style={{ padding: "8px 10px" }}>{r.dueDateIso || "—"}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 700 }}>{r.overdueDays}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 700 }}>{money(r.fineAmount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LibraryMembersPanel({ activeSchoolId }) {
  const rules = loadLibraryRules(activeSchoolId);
  const [query, setQuery] = useState("");
  const members = listMembers(activeSchoolId, rules);
  const q = query.trim().toLowerCase();
  const filtered = !q
    ? members
    : members.filter((m) =>
        [m.name, m.fatherName, m.roll, m.className, ...(m.books || [])]
          .map((v) => String(v || "").toLowerCase())
          .join(" ")
          .includes(q),
      );

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>Active Borrowers</div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.gray }}>
            {members.length} members with books out · limit {rules.maxBooksPerStudent} per student
          </p>
        </div>
        <Inp label="Search" value={query} onChange={setQuery} placeholder="Name or roll…" width={200} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#0f766e", color: "#fff" }}>
              {["Name", "Father", "Class", "Roll", "Out", "Overdue", "Fine", "Books"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 16, textAlign: "center", color: C.gray }}>No active borrowers.</td></tr>
            ) : (
              filtered.map((m, i) => (
                <tr key={m.id} style={{ background: i % 2 ? "#fff" : "#f0fdfa", borderBottom: "1px solid #99f6e4" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{m.name}</td>
                  <td style={{ padding: "8px 10px", color: "#64748b" }}>{m.fatherName || "—"}</td>
                  <td style={{ padding: "8px 10px" }}>{m.className || "—"}</td>
                  <td style={{ padding: "8px 10px" }}>{m.roll || "—"}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 700, color: m.activeCount > rules.maxBooksPerStudent ? "#b91c1c" : C.navy }}>{m.activeCount}</td>
                  <td style={{ padding: "8px 10px" }}>{m.overdueCount}</td>
                  <td style={{ padding: "8px 10px" }}>{money(m.fineAmount)}</td>
                  <td style={{ padding: "8px 10px", maxWidth: 220 }}>{m.books.join(", ")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LibraryFinesPanel({ activeSchoolId }) {
  const [rules, setRules] = useState(() => loadLibraryRules(activeSchoolId));
  const [payments, setPayments] = useState(() => loadFinePayments(activeSchoolId));
  const overdue = listOverdue(activeSchoolId, rules);
  const [borrowerName, setBorrowerName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pickOverdue, setPickOverdue] = useState("");

  const persistRules = (next) => {
    setRules(next);
    saveLibraryRules(activeSchoolId, next);
  };
  const persistPayments = (next) => {
    setPayments(next);
    saveFinePayments(activeSchoolId, next);
  };

  const paidTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const dueTotal = overdue.reduce((s, r) => s + r.fineAmount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...panel, padding: 16 }}>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 4 }}>Loan & fine rules</div>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: C.gray }}>
          Estimated overdue fines: {money(dueTotal)} · Collected: {money(paidTotal)}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <Inp
            label="Loan days"
            type="number"
            value={rules.loanDays}
            onChange={(v) => persistRules({ ...rules, loanDays: +v || DEFAULT_LIBRARY_RULES.loanDays })}
            width={120}
          />
          <Inp
            label="Fine / day (Rs)"
            type="number"
            value={rules.finePerDay}
            onChange={(v) => persistRules({ ...rules, finePerDay: v === "" ? 0 : +v })}
            width={140}
          />
          <Inp
            label="Max books / student"
            type="number"
            value={rules.maxBooksPerStudent}
            onChange={(v) => persistRules({ ...rules, maxBooksPerStudent: +v || DEFAULT_LIBRARY_RULES.maxBooksPerStudent })}
            width={150}
          />
        </div>
      </div>

      <div style={{ ...panel, padding: 16 }}>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 10 }}>Record fine payment</div>
        <div className="psms-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <Sel
            label="From overdue (optional)"
            value={pickOverdue}
            onChange={(id) => {
              setPickOverdue(id);
              const hit = overdue.find((r) => r.id === id);
              if (!hit) return;
              setBorrowerName(hit.borrowerDisplay);
              setAmount(String(hit.fineAmount));
              setNote(`${hit.bookTitle} · ${hit.overdueDays} days`);
            }}
            options={[{ value: "", label: "Select overdue…" }, ...overdue.map((r) => ({
              value: r.id,
              label: `${r.borrowerDisplay} · ${r.bookTitle} · ${money(r.fineAmount)}`,
            }))]}
            width="100%"
          />
          <Inp label="Borrower" value={borrowerName} onChange={setBorrowerName} placeholder="Name" width="100%" />
          <Inp label="Amount (Rs)" type="number" value={amount} onChange={setAmount} width="100%" />
          <Inp label="Note" value={note} onChange={setNote} placeholder="Optional" width="100%" />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn
            onClick={() => {
              if (!borrowerName.trim() || !amount) {
                alert("Borrower and amount are required.");
                return;
              }
              persistPayments(addFinePayment(payments, { borrowerName, amount, note }));
              setBorrowerName("");
              setAmount("");
              setNote("");
            }}
          >
            Record Payment
          </Btn>
        </div>
      </div>

      <div style={{ ...panel, padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Fine payments ({payments.length})</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#0f172a", color: "#fff" }}>
                {["Date", "Borrower", "Amount", "Note", ""].map((h) => (
                  <th key={h || "a"} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: C.gray }}>No fine payments recorded.</td></tr>
              ) : (
                payments.map((p, i) => (
                  <tr key={p.id} style={{ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "8px 10px" }}>{p.paidAt ? String(p.paidAt).slice(0, 10) : "—"}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{p.borrowerName}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 700 }}>{money(p.amount)}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{p.note || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <Btn small danger onClick={() => persistPayments(removeFinePayment(payments, p.id))}>Remove</Btn>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function LibraryReportsPanel({ activeSchoolId }) {
  const rules = loadLibraryRules(activeSchoolId);
  const report = buildCirculationReport(activeSchoolId, rules);
  const payments = loadFinePayments(activeSchoolId);
  const paidTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...panel, padding: 16 }}>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 8 }}>Circulation snapshot</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, fontSize: 13 }}>
          <div><div style={{ color: C.gray, fontSize: 11 }}>Titles</div><strong>{report.summary.bookCount}</strong></div>
          <div><div style={{ color: C.gray, fontSize: 11 }}>Issued</div><strong>{report.summary.issuedCount}</strong></div>
          <div><div style={{ color: C.gray, fontSize: 11 }}>Overdue</div><strong>{report.summary.overdueCount}</strong></div>
          <div><div style={{ color: C.gray, fontSize: 11 }}>Est. fines</div><strong>{money(report.summary.fineTotal)}</strong></div>
          <div><div style={{ color: C.gray, fontSize: 11 }}>Fines collected</div><strong>{money(paidTotal)}</strong></div>
        </div>
      </div>
      <div style={{ ...panel, padding: 16 }}>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 8 }}>Most issued titles</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#1e3a5f", color: "#fff" }}>
                {["Title", "Author", "Issued", "Out now", "Available"].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.topIssued.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: C.gray }}>No circulation yet.</td></tr>
              ) : (
                report.topIssued.map((b, i) => (
                  <tr key={b.id} style={{ background: i % 2 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{b.title}</td>
                    <td style={{ padding: "8px 10px" }}>{b.author || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>{b.timesIssued}</td>
                    <td style={{ padding: "8px 10px" }}>{b.currentlyOut}</td>
                    <td style={{ padding: "8px 10px" }}>{b.available}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ ...panel, padding: 16 }}>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 8 }}>Out of stock ({report.lowStock.length})</div>
        {report.lowStock.length === 0 ? (
          <div style={{ fontSize: 13, color: C.gray }}>All titles have at least one copy available.</div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6, fontSize: 12 }}>
            {report.lowStock.slice(0, 20).map((b) => (
              <li key={b.id}><strong>{b.title}</strong>{b.author ? ` · ${b.author}` : ""} · {b.currentlyOut} out</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
