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
import { ModulePageShell } from "@/components/ModulePageShell";

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
    <ModulePageShell
      title="Fee & Financial Management"
      description={`Monthly fee ${formatCurrency(feeAmount)} · Collection, dues, receipts, concessions & expenses`}
      tabs={FEE_FINANCE_TABS}
      tab={tab}
      onTabChange={setTab}
    >
      {tab === "overview" && (
        <FeeOverviewPanel
          settings={settings}
          students={students}
          activeSchoolId={activeSchoolId}
          onGoTab={setTab}
        />
      )}

      {tab === "collection" && (
        <FeePage
          settings={settings}
          students={students}
          activeSchoolId={activeSchoolId}
          setBarSubtitle={null}
        />
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
    </ModulePageShell>
  );
}
