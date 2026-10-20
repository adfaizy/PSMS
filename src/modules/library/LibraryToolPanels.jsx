import React, { useState } from "react";
import { cn } from "@/lib/utils";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// formatCurrency helper inline to avoid fee dependency
function money(n) {
  return `Rs. ${Number(n || 0).toLocaleString("en-PK")}`;
}

function FieldWrap({ label, children, className }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

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
    <div className="flex flex-col gap-3.5">
      <Card size="sm" className="shadow-none">
        <CardHeader>
          <CardTitle>Library Overview</CardTitle>
          <CardDescription>
            Loan period {rules.loanDays} days · Fine {money(rules.finePerDay)}/day · Max {rules.maxBooksPerStudent} books / student
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
        {cards.map((c) => (
          <Button
            key={c.label}
            type="button"
            variant="outline"
            onClick={() => onGoTab?.(c.tab)}
            className="h-auto w-full flex-col items-start gap-0.5 rounded-xl border-t-[3px] p-3.5 text-left font-normal shadow-none ring-1 ring-foreground/10 hover:bg-muted/30"
            style={{ borderTopColor: c.accent }}
          >
            <div className="text-2xl font-extrabold" style={{ color: c.accent }}>{c.value}</div>
            <div className="text-xs font-bold mt-1">{c.label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{c.hint}</div>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onGoTab?.("catalog")}>Open Catalog</Button>
        <Button size="sm" variant="outline" onClick={() => onGoTab?.("overdue")}>Overdue list</Button>
        <Button size="sm" variant="outline" onClick={() => onGoTab?.("members")}>Active members</Button>
        <Button size="sm" variant="outline" onClick={() => onGoTab?.("fines")}>Fines &amp; rules</Button>
        <Button size="sm" variant="outline" onClick={() => onGoTab?.("reports")}>Reports</Button>
      </div>

      {summary.overdue.length > 0 && (
        <Card size="sm" className="shadow-none">
          <CardHeader>
            <CardTitle>Top overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="m-0 p-0 list-none grid gap-1.5 text-sm">
              {summary.overdue.slice(0, 5).map((b) => (
                <li key={b.id} className="flex justify-between gap-2">
                  <span><strong>{b.borrowerDisplay}</strong> · {b.bookTitle}</span>
                  <span className="text-destructive font-bold shrink-0">{b.overdueDays}d · {money(b.fineAmount)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function LibraryOverduePanel({ activeSchoolId }) {
  const rules = loadLibraryRules(activeSchoolId);
  const rows = listOverdue(activeSchoolId, rules);
  const total = rows.reduce((s, r) => s + r.fineAmount, 0);

  return (
    <Card size="sm" className="shadow-none">
      <CardHeader>
        <CardTitle>Overdue Books</CardTitle>
        <CardDescription>
          {rows.length} overdue · estimated fines {money(total)} ({money(rules.finePerDay)}/day after {rules.loanDays} days)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {["Borrower", "Class", "Roll", "Book", "Due", "Days", "Fine"].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-4 text-center text-muted-foreground">No overdue borrowings.</TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-semibold">{r.borrowerDisplay}</TableCell>
                  <TableCell>{r.className || "—"}</TableCell>
                  <TableCell>{r.roll || "—"}</TableCell>
                  <TableCell>{r.bookTitle}</TableCell>
                  <TableCell>{r.dueDateIso || "—"}</TableCell>
                  <TableCell className="font-bold">{r.overdueDays}</TableCell>
                  <TableCell className="font-bold text-destructive">{money(r.fineAmount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
    <Card size="sm" className="shadow-none">
      <CardHeader>
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <CardTitle>Active Borrowers</CardTitle>
            <CardDescription>
              {members.length} members with books out · limit {rules.maxBooksPerStudent} per student
            </CardDescription>
          </div>
          <FieldWrap label="Search">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or roll…" style={{ width: 200 }} />
          </FieldWrap>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {["Name", "Father", "Class", "Roll", "Out", "Overdue", "Fine", "Books"].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-4 text-center text-muted-foreground">No active borrowers.</TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-semibold">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.fatherName || "—"}</TableCell>
                  <TableCell>{m.className || "—"}</TableCell>
                  <TableCell>{m.roll || "—"}</TableCell>
                  <TableCell className={cn("font-bold", m.activeCount > rules.maxBooksPerStudent ? "text-destructive" : "text-foreground")}>{m.activeCount}</TableCell>
                  <TableCell>{m.overdueCount}</TableCell>
                  <TableCell>{money(m.fineAmount)}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{m.books.join(", ")}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
    <div className="flex flex-col gap-3.5">
      {/* Rules */}
      <Card size="sm" className="shadow-none">
        <CardHeader>
          <CardTitle>Loan &amp; fine rules</CardTitle>
          <CardDescription>
            Estimated overdue fines: {money(dueTotal)} · Collected: {money(paidTotal)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2.5 items-end">
            <FieldWrap label="Loan days">
              <Input
                type="number"
                value={rules.loanDays}
                onChange={(e) => persistRules({ ...rules, loanDays: +e.target.value || DEFAULT_LIBRARY_RULES.loanDays })}
                style={{ width: 120 }}
              />
            </FieldWrap>
            <FieldWrap label="Fine / day (Rs)">
              <Input
                type="number"
                value={rules.finePerDay}
                onChange={(e) => persistRules({ ...rules, finePerDay: e.target.value === "" ? 0 : +e.target.value })}
                style={{ width: 140 }}
              />
            </FieldWrap>
            <FieldWrap label="Max books / student">
              <Input
                type="number"
                value={rules.maxBooksPerStudent}
                onChange={(e) => persistRules({ ...rules, maxBooksPerStudent: +e.target.value || DEFAULT_LIBRARY_RULES.maxBooksPerStudent })}
                style={{ width: 150 }}
              />
            </FieldWrap>
          </div>
        </CardContent>
      </Card>

      {/* Record payment */}
      <Card size="sm" className="shadow-none">
        <CardHeader>
          <CardTitle>Record fine payment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
            <FieldWrap label="From overdue (optional)">
              <NativeSelect
                value={pickOverdue}
                onChange={(e) => {
                  const id = e.target.value;
                  setPickOverdue(id);
                  const hit = overdue.find((r) => r.id === id);
                  if (!hit) return;
                  setBorrowerName(hit.borrowerDisplay);
                  setAmount(String(hit.fineAmount));
                  setNote(`${hit.bookTitle} · ${hit.overdueDays} days`);
                }}
                className="w-full"
              >
                <NativeSelectOption value="">Select overdue…</NativeSelectOption>
                {overdue.map((r) => (
                  <NativeSelectOption key={r.id} value={r.id}>
                    {`${r.borrowerDisplay} · ${r.bookTitle} · ${money(r.fineAmount)}`}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FieldWrap>
            <FieldWrap label="Borrower">
              <Input value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} placeholder="Name" className="w-full" />
            </FieldWrap>
            <FieldWrap label="Amount (Rs)">
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full" />
            </FieldWrap>
            <FieldWrap label="Note">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className="w-full" />
            </FieldWrap>
          </div>
          <div className="flex justify-end">
            <Button
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
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payments table */}
      <Card size="sm" className="shadow-none">
        <CardHeader>
          <CardTitle>Fine payments ({payments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {["Date", "Borrower", "Amount", "Note", ""].map((h, i) => (
                  <TableHead key={h || `_${i}`}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-4 text-center text-muted-foreground">No fine payments recorded.</TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.paidAt ? String(p.paidAt).slice(0, 10) : "—"}</TableCell>
                    <TableCell className="font-semibold">{p.borrowerName}</TableCell>
                    <TableCell className="font-bold">{money(p.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">{p.note || "—"}</TableCell>
                    <TableCell>
                      <Button size="xs" variant="destructive" onClick={() => persistPayments(removeFinePayment(payments, p.id))}>Remove</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function LibraryReportsPanel({ activeSchoolId }) {
  const rules = loadLibraryRules(activeSchoolId);
  const report = buildCirculationReport(activeSchoolId, rules);
  const payments = loadFinePayments(activeSchoolId);
  const paidTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  return (
    <div className="flex flex-col gap-3.5">
      {/* Snapshot */}
      <Card size="sm" className="shadow-none">
        <CardHeader>
          <CardTitle>Circulation snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2.5 text-sm" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
            <div><div className="text-xs text-muted-foreground">Titles</div><strong>{report.summary.bookCount}</strong></div>
            <div><div className="text-xs text-muted-foreground">Issued</div><strong>{report.summary.issuedCount}</strong></div>
            <div><div className="text-xs text-muted-foreground">Overdue</div><strong>{report.summary.overdueCount}</strong></div>
            <div><div className="text-xs text-muted-foreground">Est. fines</div><strong>{money(report.summary.fineTotal)}</strong></div>
            <div><div className="text-xs text-muted-foreground">Fines collected</div><strong>{money(paidTotal)}</strong></div>
          </div>
        </CardContent>
      </Card>

      {/* Most issued */}
      <Card size="sm" className="shadow-none">
        <CardHeader>
          <CardTitle>Most issued titles</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {["Title", "Author", "Issued", "Out now", "Available"].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.topIssued.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-4 text-center text-muted-foreground">No circulation yet.</TableCell>
                </TableRow>
              ) : (
                report.topIssued.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-semibold">{b.title}</TableCell>
                    <TableCell>{b.author || "—"}</TableCell>
                    <TableCell>{b.timesIssued}</TableCell>
                    <TableCell>{b.currentlyOut}</TableCell>
                    <TableCell>{b.available}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Out of stock */}
      <Card size="sm" className="shadow-none">
        <CardHeader>
          <CardTitle>Out of stock ({report.lowStock.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {report.lowStock.length === 0 ? (
            <div className="text-sm text-muted-foreground">All titles have at least one copy available.</div>
          ) : (
            <ul className="m-0 p-0 list-none grid gap-1.5 text-sm">
              {report.lowStock.slice(0, 20).map((b) => (
                <li key={b.id}><strong>{b.title}</strong>{b.author ? ` · ${b.author}` : ""} · {b.currentlyOut} out</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
