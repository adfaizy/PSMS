import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
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

export function FeeOverviewPanel({ settings, students, activeSchoolId, onGoTab }) {
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
    { label: "Expected", value: formatCurrency(summary.expected), hint: `${summary.totalStudents} students × ${feeAmount}`, tab: "collection", accentClass: "border-t-primary" },
    { label: "Collected", value: formatCurrency(summary.collected), hint: `${summary.rate}% · ${summary.paidCount} paid`, tab: "receipts", accentClass: "border-t-green-700" },
    { label: "Outstanding dues", value: formatCurrency(summary.pending), hint: `${summary.duesCount} students`, tab: "dues", accentClass: "border-t-red-700" },
    { label: "Expenses (month)", value: formatCurrency(summary.expenseTotal), hint: `Net ${formatCurrency(summary.net)}`, tab: "expenses", accentClass: "border-t-amber-600" },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="shadow-none">
        <CardContent className="p-4 flex flex-wrap gap-3 items-end justify-between">
          <div>
            <CardTitle className="text-base">Fee & Finance Overview</CardTitle>
            <CardDescription className="mt-1">
              Monthly fee {formatCurrency(feeAmount)} per student · {summary.concessionCount} concessions active
            </CardDescription>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Month</Label>
            <Input
              type="month"
              value={monthValue}
              onChange={(e) => {
                const [year, month] = String(e.target.value).split("-").map(Number);
                if (year && month) setPeriod({ year, month });
              }}
              className="w-40"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {cards.map((c) => (
          <Button
            key={c.label}
            type="button"
            variant="outline"
            onClick={() => onGoTab?.(c.tab)}
            className={cn(
              "h-auto w-full flex-col items-start gap-0.5 rounded-xl border-t-4 p-3.5 text-left font-normal shadow-none hover:bg-accent/50",
              c.accentClass,
            )}
          >
            <div className="text-xl font-extrabold">{c.value}</div>
            <div className="text-xs font-bold mt-1">{c.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{c.hint}</div>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onGoTab?.("collection")}>Open Collection</Button>
        <Button size="sm" variant="outline" onClick={() => onGoTab?.("dues")}>View Dues</Button>
        <Button size="sm" variant="outline" onClick={() => onGoTab?.("receipts")}>Receipts</Button>
        <Button size="sm" variant="outline" onClick={() => onGoTab?.("concessions")}>Concessions</Button>
        <Button size="sm" variant="outline" onClick={() => onGoTab?.("expenses")}>Expenses</Button>
        <Button size="sm" variant="outline" onClick={() => onGoTab?.("reports")}>Reports</Button>
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
    <Card className="shadow-none">
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-3 justify-between mb-3.5">
          <div>
            <CardTitle className="text-base">Outstanding Dues</CardTitle>
            <CardDescription className="mt-1">
              {dues.length} unpaid · {formatCurrency(totalDue)} (after concessions)
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <div className="flex flex-col gap-1.5">
              <Label>Class</Label>
              <NativeSelect
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                size="sm"
                className="w-40"
              >
                <NativeSelectOption value="all">All classes</NativeSelectOption>
                {(settings.classes || []).map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>{formatClassDisplay(c)}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Month</Label>
              <Input
                type="month"
                value={monthValue}
                onChange={(e) => {
                  const [year, month] = String(e.target.value).split("-").map(Number);
                  if (year && month) setPeriod({ year, month });
                }}
                className="w-36"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {["Class", "Roll", "Name", "Father", "Due", "Concession"].map((h) => (
                  <TableHead key={h} className="bg-muted text-foreground">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dues.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                    No outstanding dues for this filter.
                  </TableCell>
                </TableRow>
              ) : (
                dues.map((d, i) => (
                  <TableRow key={d.studentId} className={i % 2 !== 0 ? "" : "bg-muted/20"}>
                    <TableCell>{d.classLabel}</TableCell>
                    <TableCell className="font-bold">{d.rollNo || "—"}</TableCell>
                    <TableCell className="font-semibold">{d.name}</TableCell>
                    <TableCell className="text-muted-foreground">{d.fatherName || "—"}</TableCell>
                    <TableCell className="font-bold">{formatCurrency(d.dueAmount)}</TableCell>
                    <TableCell className="text-xs">{d.concession ? d.concession.type : "—"}</TableCell>
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
    <Card className="shadow-none">
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-3 justify-between mb-3.5">
          <div>
            <CardTitle className="text-base">Payment Receipts</CardTitle>
            <CardDescription className="mt-1">{receipts.length} receipts · {formatCurrency(total)}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <div className="flex flex-col gap-1.5">
              <Label>Search</Label>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name or receipt…"
                className="w-44"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Month</Label>
              <Input
                type="month"
                value={monthValue}
                onChange={(e) => {
                  const [year, month] = String(e.target.value).split("-").map(Number);
                  if (year && month) setPeriod({ year, month });
                }}
                className="w-36"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {["Receipt", "Date", "Student", "Class", "Roll", "Amount"].map((h) => (
                  <TableHead key={h} className="bg-muted text-foreground">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                    No payments recorded for this month.
                  </TableCell>
                </TableRow>
              ) : (
                receipts.map((r, i) => (
                  <TableRow key={r.id || i} className={i % 2 !== 0 ? "" : "bg-muted/20"}>
                    <TableCell className="font-mono text-xs">{r.receiptNo}</TableCell>
                    <TableCell>{r.paidAt ? String(r.paidAt).slice(0, 10) : "—"}</TableCell>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell>{r.classLabel}</TableCell>
                    <TableCell>{r.rollNo || "—"}</TableCell>
                    <TableCell className="font-bold">{formatCurrency(r.amount)}</TableCell>
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
    <div className="flex flex-col gap-3.5">
      <Card className="shadow-none">
        <CardContent className="p-4">
          <CardTitle className="mb-1">Fee structure & concessions</CardTitle>
          <CardDescription className="mb-3">
            Set the default monthly fee and grant discounts/waivers to individual students.
          </CardDescription>
          <div className="flex flex-wrap gap-2.5 items-end mb-4">
            <div className="flex flex-col gap-1.5">
              <Label>Monthly fee (Rs)</Label>
              <Input
                type="number"
                value={settings.feeAmount ?? feeAmount}
                onChange={(e) =>
                  setSettings?.((s) => ({ ...s, feeAmount: e.target.value === "" ? feeAmount : Number(e.target.value) }))
                }
                className="w-36"
              />
            </div>
            <span className="text-xs text-muted-foreground pb-1.5">Applies to dues calculations in this module.</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <div className="flex flex-col gap-1.5">
              <Label>Search student</Label>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name…" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Student</Label>
              <NativeSelect value={studentId} onChange={(e) => setStudentId(e.target.value)} size="sm" className="w-full">
                <NativeSelectOption value="">Select…</NativeSelectOption>
                {options.map((s) => (
                  <NativeSelectOption key={s.id} value={s.id}>{s.name} · Roll {s.rollNo || "—"}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <NativeSelect value={type} onChange={(e) => setType(e.target.value)} size="sm" className="w-full">
                {CONCESSION_TYPES.map((t) => (
                  <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Mode</Label>
              <NativeSelect value={mode} onChange={(e) => setMode(e.target.value)} size="sm" className="w-full">
                <NativeSelectOption value="percent">Percent off</NativeSelectOption>
                <NativeSelectOption value="amount">Fixed amount off</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{mode === "percent" ? "Percent" : "Amount (Rs)"}</Label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                if (!studentId) {
                  alert("Select a student.");
                  return;
                }
                persist(
                  addConcession(
                    list.filter((c) => String(c.studentId) !== String(studentId)),
                    { studentId, type, mode, value, reason },
                  ),
                );
                setReason("");
              }}
            >
              Save Concession
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardContent className="p-4">
          <div className="font-bold text-sm mb-2">Active concessions ({list.length})</div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Student", "Type", "Discount", "Reason", ""].map((h) => (
                    <TableHead key={h || "action"} className="bg-muted text-foreground">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                      No concessions yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((c, i) => {
                    const st = students.find((s) => String(s.id) === String(c.studentId));
                    return (
                      <TableRow key={c.id} className={i % 2 !== 0 ? "" : "bg-muted/20"}>
                        <TableCell className="font-semibold">{st?.name || c.studentId}</TableCell>
                        <TableCell>{c.type}</TableCell>
                        <TableCell>{c.mode === "percent" ? `${c.value}%` : formatCurrency(c.value)}</TableCell>
                        <TableCell className="text-muted-foreground">{c.reason || "—"}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="destructive" onClick={() => persist(removeConcession(list, c.id))}>
                            Remove
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
    <Card className="shadow-none">
      <CardContent className="p-4">
        <CardTitle className="text-base mb-1">School Expenses</CardTitle>
        <CardDescription className="mb-3">
          Track operating costs against fee collection. This month: {formatCurrency(total)}.
        </CardDescription>
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <div className="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Electricity bill" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)} size="sm" className="w-full">
              {EXPENSE_CATEGORIES.map((t) => (
                <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Amount (Rs)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Filter month</Label>
            <Input
              type="month"
              value={monthValue}
              onChange={(e) => {
                const [year, month] = String(e.target.value).split("-").map(Number);
                if (year && month) setPeriod({ year, month });
              }}
            />
          </div>
        </div>
        <div className="flex justify-end mb-4">
          <Button
            size="sm"
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
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {["Date", "Title", "Category", "Amount", "Notes", ""].map((h) => (
                  <TableHead key={h || "action"} className="bg-muted text-foreground">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                    No expenses in this month.
                  </TableCell>
                </TableRow>
              ) : (
                monthList.map((e, i) => (
                  <TableRow key={e.id} className={i % 2 !== 0 ? "" : "bg-muted/20"}>
                    <TableCell>{e.date}</TableCell>
                    <TableCell className="font-semibold">{e.title}</TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell className="font-bold">{formatCurrency(e.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">{e.notes || "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="destructive" onClick={() => persist(removeExpense(list, e.id))}>
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
    <div className="flex flex-col gap-3.5">
      <Card className="shadow-none">
        <CardContent className="p-4">
          <div className="flex flex-wrap justify-between gap-3 mb-3">
            <div>
              <CardTitle>Yearly collection trend</CardTitle>
              <CardDescription className="mt-1">
                {year}: {formatCurrency(yearCollected)} collected of {formatCurrency(yearExpected)} expected
              </CardDescription>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Year</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(+e.target.value || year)}
                className="w-24"
              />
            </div>
          </div>
          <div className="grid grid-cols-12 gap-1.5 items-end min-h-[120px]">
            {trend.map((m) => {
              const max = Math.max(...trend.map((t) => t.expected), 1);
              const h = Math.round((m.collected / max) * 100);
              return (
                <div key={m.month} className="text-center" title={`${m.label}: ${formatCurrency(m.collected)}`}>
                  <div className="h-24 flex items-end justify-center">
                    <div
                      style={{ height: `${Math.max(h, m.collected ? 4 : 0)}%` }}
                      className="w-[70%] bg-green-700 rounded-t"
                    />
                  </div>
                  <div className="text-[10px] font-bold mt-1">{m.label}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardContent className="p-4">
          <div className="flex flex-wrap justify-between gap-3 mb-3">
            <CardTitle>Expenses by category</CardTitle>
            <div className="flex flex-col gap-1.5">
              <Label>Month</Label>
              <Input
                type="month"
                value={monthValue}
                onChange={(e) => {
                  const [y, month] = String(e.target.value).split("-").map(Number);
                  if (y && month) setPeriod({ year: y, month });
                }}
                className="w-36"
              />
            </div>
          </div>
          {byCat.length === 0 ? (
            <div className="text-sm text-muted-foreground">No expenses recorded for this month.</div>
          ) : (
            <ul className="m-0 p-0 list-none grid gap-2">
              {byCat.map((row) => (
                <li key={row.category} className="flex justify-between px-2.5 py-2 bg-muted/30 rounded-lg text-sm">
                  <span className="font-semibold">{row.category}</span>
                  <span className="font-bold">{formatCurrency(row.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardContent className="p-4 text-xs text-muted-foreground">
          Tip: use Collection to mark payments, Dues for follow-up lists, and Expenses to see net against fees.
          Months: {getMonthsList().map((m) => m.label.slice(0, 3)).join(", ")}.
        </CardContent>
      </Card>
    </div>
  );
}
