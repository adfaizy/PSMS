import React, { useEffect, useState } from "react";
import { consumeNavIntent } from "@/lib/navIntent.js";
import { FeePage } from "./FeePage";
import {
  FeeOverviewPanel,
  FeeDuesPanel,
  FeeReceiptsPanel,
  FeeConcessionsPanel,
  FeeExpensesPanel,
  FeeReportsPanel,
} from "./FeeFinancePanels.jsx";
import { FEE_FINANCE_TABS, getEffectiveFeeAmount, formatCurrency } from "./feeFinanceCore.js";
import { C } from "@/shared/theme";

function initialFeeTab() {
  const intent = consumeNavIntent();
  if (!intent || (intent.page && intent.page !== "fees")) return "overview";
  const allowed = new Set(FEE_FINANCE_TABS.map((t) => t.id));
  const alias = intent.tab === "summary" || intent.tab === "class-detail" ? "collection" : intent.tab;
  if (alias && allowed.has(alias)) return alias;
  return "overview";
}

export function FeeFinanceModulePage({
  settings,
  setSettings,
  students,
  activeSchoolId,
  setBarSubtitle,
}) {
  const [tab, setTab] = useState(initialFeeTab);
  const feeAmount = getEffectiveFeeAmount(settings);

  useEffect(() => {
    if (!setBarSubtitle) return;
    const t = FEE_FINANCE_TABS.find((x) => x.id === tab);
    setBarSubtitle(t?.l || `Fee ${formatCurrency(feeAmount)}/month`);
    return () => setBarSubtitle?.("");
  }, [tab, setBarSubtitle, feeAmount]);

  return (
    <div
      className="psms-page"
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        className="no-print"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.navy }}>Fee & Financial Management</div>
          <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
            Monthly fee {formatCurrency(feeAmount)} · Collection, dues, receipts, concessions & expenses
          </div>
        </div>
        <div
          style={{
            display: "inline-flex",
            flexWrap: "wrap",
            background: "#ecfdf5",
            borderRadius: 10,
            padding: 4,
            gap: 4,
            border: "1px solid #bbf7d0",
            maxWidth: "100%",
          }}
        >
          {FEE_FINANCE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                border: "none",
                cursor: "pointer",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
                background: tab === t.id ? "#15803d" : "transparent",
                color: tab === t.id ? "#fff" : "#15803d",
                whiteSpace: "nowrap",
              }}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <FeeOverviewPanel
          settings={settings}
          students={students}
          activeSchoolId={activeSchoolId}
          onGoTab={setTab}
        />
      )}

      {tab === "collection" && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
            padding: 12,
          }}
        >
          <FeePage
            settings={settings}
            students={students}
            activeSchoolId={activeSchoolId}
            setBarSubtitle={null}
          />
        </div>
      )}

      {tab === "dues" && (
        <FeeDuesPanel settings={settings} students={students} activeSchoolId={activeSchoolId} />
      )}

      {tab === "receipts" && (
        <FeeReceiptsPanel settings={settings} students={students} activeSchoolId={activeSchoolId} />
      )}

      {tab === "concessions" && (
        <FeeConcessionsPanel
          settings={settings}
          students={students}
          setSettings={setSettings}
          activeSchoolId={activeSchoolId}
        />
      )}

      {tab === "expenses" && <FeeExpensesPanel activeSchoolId={activeSchoolId} />}

      {tab === "reports" && (
        <FeeReportsPanel settings={settings} students={students} activeSchoolId={activeSchoolId} />
      )}
    </div>
  );
}
