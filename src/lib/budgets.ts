export type BudgetStatus = "ok" | "warning" | "exceeded";

export interface BudgetInput {
  id: string;
  categoria: string;
  monto: number;
}

export interface MonthPaceInfo {
  dayOfMonth: number;
  daysInMonth: number;
  daysRemaining: number;
  expectedPct: number;
  isCurrentMonth: boolean;
}

export interface EvaluatedBudgetItem {
  id: string;
  categoria: string;
  limit: number;
  spent: number;
  remaining: number;
  pctRaw: number;
  barPct: number;
  status: BudgetStatus;
  paceAhead: boolean;
  dailyAllowance: number;
}

export interface BudgetGlobalSummary {
  totalBudgeted: number;
  totalSpent: number;
  remaining: number;
  pctRaw: number;
  barPct: number;
  status: BudgetStatus;
  okCount: number;
  warningCount: number;
  exceededCount: number;
  pace: MonthPaceInfo;
}

export interface EvaluatedBudgetsResult {
  items: EvaluatedBudgetItem[];
  summary: BudgetGlobalSummary;
}

export function normalizeCategoryKey(category: string | undefined | null): string {
  return (category || "Otros")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getMonthPace(year?: number, month?: number): MonthPaceInfo {
  const now = new Date();
  const targetYear = year ?? now.getFullYear();
  const targetMonth = month ?? now.getMonth();
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

  const isCurrentMonth =
    targetYear === now.getFullYear() && targetMonth === now.getMonth();

  if (isCurrentMonth) {
    const dayOfMonth = now.getDate();
    const daysRemaining = Math.max(1, daysInMonth - dayOfMonth + 1);
    const expectedPct = Math.round((dayOfMonth / daysInMonth) * 100);
    return { dayOfMonth, daysInMonth, daysRemaining, expectedPct, isCurrentMonth };
  }

  const isPastMonth =
    targetYear < now.getFullYear() ||
    (targetYear === now.getFullYear() && targetMonth < now.getMonth());

  return {
    dayOfMonth: isPastMonth ? daysInMonth : 0,
    daysInMonth,
    daysRemaining: isPastMonth ? 0 : daysInMonth,
    expectedPct: isPastMonth ? 100 : 0,
    isCurrentMonth: false,
  };
}

export function getBudgetStatus(spent: number, limit: number): BudgetStatus {
  if (limit <= 0) return spent > 0 ? "exceeded" : "ok";
  if (spent > limit) return "exceeded";
  if (spent >= limit * 0.75) return "warning";
  return "ok";
}

export function getBudgetStatusLabel(status: BudgetStatus): string {
  if (status === "exceeded") return "Excedido";
  if (status === "warning") return "Cerca del límite";
  return "Dentro del presupuesto";
}

export function evaluateBudgets(
  budgets: BudgetInput[],
  spentByNormalizedCategory: Record<string, number>,
  year?: number,
  month?: number
): EvaluatedBudgetsResult {
  const pace = getMonthPace(year, month);

  let totalBudgeted = 0;
  let totalSpent = 0;
  let okCount = 0;
  let warningCount = 0;
  let exceededCount = 0;

  const items: EvaluatedBudgetItem[] = budgets.map((b) => {
    const limit = Number(b.monto || 0);
    const key = normalizeCategoryKey(b.categoria);
    const spent = Number(spentByNormalizedCategory[key] || 0);
    const remaining = limit - spent;
    const pctRaw = limit > 0 ? Math.round((spent / limit) * 100) : spent > 0 ? 100 : 0;
    const barPct = Math.min(100, Math.max(0, pctRaw));
    const status = getBudgetStatus(spent, limit);
    const paceAhead =
      pace.isCurrentMonth && status === "ok" && pctRaw > pace.expectedPct + 12;
    const dailyAllowance =
      remaining > 0 && pace.daysRemaining > 0 ? remaining / pace.daysRemaining : 0;

    totalBudgeted += limit;
    totalSpent += spent;
    if (status === "exceeded") exceededCount++;
    else if (status === "warning") warningCount++;
    else okCount++;

    return {
      id: b.id,
      categoria: b.categoria,
      limit,
      spent,
      remaining,
      pctRaw,
      barPct,
      status,
      paceAhead,
      dailyAllowance,
    };
  });

  // Sort exceeded & near-limit items first
  items.sort((a, b) => b.pctRaw - a.pctRaw);

  const remaining = totalBudgeted - totalSpent;
  const pctRaw =
    totalBudgeted > 0
      ? Math.round((totalSpent / totalBudgeted) * 100)
      : totalSpent > 0
      ? 100
      : 0;
  const barPct = Math.min(100, Math.max(0, pctRaw));

  let globalStatus: BudgetStatus = "ok";
  if (exceededCount > 0 || totalSpent > totalBudgeted) {
    globalStatus = totalSpent > totalBudgeted ? "exceeded" : "warning";
  } else if (warningCount > 0 || getBudgetStatus(totalSpent, totalBudgeted) === "warning") {
    globalStatus = "warning";
  }

  return {
    items,
    summary: {
      totalBudgeted,
      totalSpent,
      remaining,
      pctRaw,
      barPct,
      status: budgets.length === 0 ? "ok" : globalStatus,
      okCount,
      warningCount,
      exceededCount,
      pace,
    },
  };
}
