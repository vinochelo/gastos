'use client';

import { useState, useEffect, useMemo } from "react";
import { useUserConfig } from "@/hooks/useFirestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc
} from "firebase/firestore";
import {
  Plus, X, ChevronLeft, TrendingUp, AlertTriangle, AlertCircle, CheckCircle, Trash2, Edit2, Menu, Calendar, Flame
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import CategoryIcon from "@/components/CategoryIcon";
import {
  evaluateBudgets,
  getBudgetStatusLabel,
  normalizeCategoryKey,
  BudgetStatus,
} from "@/lib/budgets";

interface Budget {
  id: string;
  userId: string;
  categoria: string;
  monto: number;
}

const STATUS_STYLES: Record<
  BudgetStatus,
  {
    bar: string;
    glow: string;
    text: string;
    pill: string;
  }
> = {
  ok: {
    bar: "bg-emerald-500",
    glow: "shadow-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-400",
    pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  warning: {
    bar: "bg-amber-500",
    glow: "shadow-amber-500/15",
    text: "text-amber-600 dark:text-amber-400",
    pill: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  exceeded: {
    bar: "bg-rose-500 animate-pulse",
    glow: "shadow-rose-500/20",
    text: "text-rose-600 dark:text-rose-400 font-extrabold",
    pill: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  },
};

export default function PresupuestosPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spentMap, setSpentMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const { config } = useUserConfig();
  const { openDrawer, formatAmount, showToast, confirmAction } = useApp();
  const router = useRouter();

  // Modal states
  const [isOpen, setIsOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const now = useMemo(() => new Date(), []);
  const currentMonthLabel = useMemo(
    () =>
      now.toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric",
      }),
    [now]
  );

  useEffect(() => {
    let unsubscribeBudgets: (() => void) | null = null;
    let unsubscribeTransactions: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeBudgets) unsubscribeBudgets();
      if (unsubscribeTransactions) unsubscribeTransactions();

      if (!user) {
        setBudgets([]);
        setSpentMap({});
        setLoading(false);
        return;
      }

      const qBudgets = query(
        collection(db, "budgets"),
        where("userId", "==", user.uid)
      );
      unsubscribeBudgets = onSnapshot(qBudgets, (snap) => {
        const list = snap.docs.map(
          (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Budget)
        );
        setBudgets(list);
      });

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const startOfNextMonth = new Date(
        startOfMonth.getFullYear(),
        startOfMonth.getMonth() + 1,
        1
      );

      const qTx = query(
        collection(db, "transactions"),
        where("userId", "==", user.uid),
        where("tipo", "==", "gasto"),
        where("timestamp", ">=", startOfMonth),
        where("timestamp", "<", startOfNextMonth)
      );

      unsubscribeTransactions = onSnapshot(qTx, (snap) => {
        const sums: Record<string, number> = {};
        snap.docs.forEach((docSnap) => {
          const tx = docSnap.data();
          const key = normalizeCategoryKey(tx.categoria);
          sums[key] = (sums[key] || 0) + Number(tx.monto || 0);
        });
        setSpentMap(sums);
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeBudgets) unsubscribeBudgets();
      if (unsubscribeTransactions) unsubscribeTransactions();
    };
  }, []);

  const evaluated = useMemo(
    () => evaluateBudgets(budgets, spentMap),
    [budgets, spentMap]
  );

  const expenseCategories = config?.expenseCategories || [];

  const handleOpenCreate = () => {
    setEditingBudget(null);
    setCategory(expenseCategories[0] || "");
    setLimit("");
    setError(null);
    setIsOpen(true);
  };

  const handleOpenEdit = (b: { id: string; categoria: string; limit: number }) => {
    setEditingBudget({
      id: b.id,
      userId: auth.currentUser?.uid || "",
      categoria: b.categoria,
      monto: b.limit,
    });
    setCategory(b.categoria);
    setLimit(b.limit.toString());
    setError(null);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !category || !limit) return;
    const limitNum = parseFloat(limit);
    if (isNaN(limitNum) || limitNum <= 0) {
      setError("Ingresa un límite de presupuesto válido.");
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const normalizedTarget = normalizeCategoryKey(category);
      if (editingBudget) {
        const conflict = budgets.find(
          (b) =>
            b.id !== editingBudget.id &&
            normalizeCategoryKey(b.categoria) === normalizedTarget
        );
        if (conflict) {
          setError("Ya tienes otro presupuesto asignado a esta categoría.");
          setActionLoading(false);
          return;
        }
        await updateDoc(doc(db, "budgets", editingBudget.id), {
          categoria: category,
          monto: limitNum,
        });
        showToast("Presupuesto actualizado", "success");
      } else {
        const exists = budgets.find(
          (b) => normalizeCategoryKey(b.categoria) === normalizedTarget
        );
        if (exists) {
          setError("Ya tienes un presupuesto asignado a esta categoría.");
          setActionLoading(false);
          return;
        }

        await addDoc(collection(db, "budgets"), {
          userId: auth.currentUser.uid,
          categoria: category,
          monto: limitNum,
        });
        showToast("Presupuesto creado", "success");
      }
      setIsOpen(false);
    } catch (err) {
      console.error(err);
      setError("Error al guardar el presupuesto.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmAction({
      title: "Eliminar presupuesto",
      message: "¿Deseas eliminar este presupuesto mensual?",
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, "budgets", id));
      showToast("Presupuesto eliminado", "success");
    } catch (err) {
      console.error(err);
      showToast("Error al eliminar", "error");
    }
  };

  const { summary, items } = evaluated;
  const globalStyle = STATUS_STYLES[summary.status];
  const GlobalStatusIcon =
    summary.status === "exceeded"
      ? AlertCircle
      : summary.status === "warning"
      ? AlertTriangle
      : CheckCircle;

  return (
    <div className="space-y-6 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-gradient-to-r from-[#0d9488] via-emerald-500 to-teal-400" />

      {/* Header */}
      <div className="flex items-center justify-between py-2 border-b border-border/20">
        <div className="flex items-center gap-3">
          <button
            onClick={openDrawer}
            className="md:hidden p-2 hover:bg-accent/40 rounded-xl transition-colors cursor-pointer"
            title="Abrir Menú"
          >
            <Menu size={20} className="opacity-70 text-foreground" />
          </button>
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronLeft size={18} className="opacity-50 text-foreground" />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary capitalize">
              {currentMonthLabel} · Día {summary.pace.dayOfMonth}/{summary.pace.daysInMonth}
            </p>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Presupuestos</h1>
          </div>
        </div>
        <button
          onClick={handleOpenCreate}
          title="Crear Presupuesto"
          className="bg-primary hover:bg-primary/90 text-white p-3 rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Global Budget Summary Indicator */}
      {budgets.length > 0 && (
        <div className="glass p-5 rounded-3xl border border-border shadow-sm space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/45">
                Indicador General del Mes
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-foreground">
                  {formatAmount(summary.totalSpent)}
                </span>
                <span className="text-xs font-semibold text-foreground/45">
                  de {formatAmount(summary.totalBudgeted)}
                </span>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold border ${globalStyle.pill}`}
            >
              <GlobalStatusIcon size={14} />
              {getBudgetStatusLabel(summary.status)} · {summary.pctRaw}%
            </span>
          </div>

          {/* Global Progress Bar with Calendar Pace Marker */}
          <div className="space-y-1.5">
            <div className="relative w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-border/10">
              <div
                className={`h-full rounded-full transition-all duration-500 shadow-sm ${globalStyle.bar} ${globalStyle.glow}`}
                style={{ width: `${summary.barPct}%` }}
              />
              {summary.pace.isCurrentMonth && (
                <div
                  title={`Ritmo esperado hoy: ${summary.pace.expectedPct}% del mes`}
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground/60 z-10"
                  style={{ left: `${summary.pace.expectedPct}%` }}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold">
              <span className={globalStyle.text}>
                {summary.remaining >= 0
                  ? `Disponible: ${formatAmount(summary.remaining)}`
                  : `Excedido por: ${formatAmount(Math.abs(summary.remaining))}`}
              </span>
              <span className="text-foreground/50 flex items-center gap-1">
                <Calendar size={11} />
                Ritmo del mes: {summary.pace.expectedPct}% ({summary.pace.daysRemaining} días restantes)
              </span>
            </div>
          </div>

          {/* Status Breakdown Pills */}
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              {summary.okCount} dentro del límite
            </span>
            {summary.warningCount > 0 && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
                {summary.warningCount} cerca del límite
              </span>
            )}
            {summary.exceededCount > 0 && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300">
                {summary.exceededCount} excedido(s)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Budget Grid */}
      <div className="space-y-4">
        {items.map((item) => {
          const style = STATUS_STYLES[item.status];
          const StatusIcon =
            item.status === "exceeded"
              ? AlertCircle
              : item.status === "warning"
              ? AlertTriangle
              : CheckCircle;

          return (
            <div
              key={item.id}
              className="glass p-5 rounded-3xl border border-border shadow-sm flex flex-col space-y-4 hover:shadow-md transition-all duration-300 relative overflow-hidden group"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <CategoryIcon
                      categoryName={item.categoria}
                      userIconsMap={config?.categoryIcons}
                      className="w-5 h-5"
                      size={14}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-sm text-foreground tracking-tight truncate">
                      {item.categoria}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.pill}`}
                      >
                        <StatusIcon size={10} />
                        {item.status === "warning"
                          ? "Cerca del límite (75%+)"
                          : getBudgetStatusLabel(item.status)}
                      </span>
                      {item.paceAhead && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300">
                          <Flame size={10} />
                          Ritmo rápido
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-2 hover:bg-primary/10 rounded-xl text-primary opacity-70 md:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Editar presupuesto"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-rose-500 opacity-70 md:opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Eliminar presupuesto"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Progress and values */}
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/40">
                      Gastado / Presupuesto
                    </p>
                    <p className="text-base font-black text-foreground mt-0.5">
                      {formatAmount(item.spent)}{" "}
                      <span className="text-xs font-semibold text-foreground/40">
                        de {formatAmount(item.limit)}
                      </span>
                    </p>
                  </div>
                  <span className={`text-sm font-black tracking-tight ${style.text}`}>
                    {item.pctRaw}%
                  </span>
                </div>

                {/* Progress bar with pace marker */}
                <div className="relative w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-border/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 shadow-sm ${style.bar} ${style.glow}`}
                    style={{ width: `${item.barPct}%` }}
                  />
                  {summary.pace.isCurrentMonth && (
                    <div
                      title={`Ritmo esperado hoy: ${summary.pace.expectedPct}%`}
                      className="absolute top-0 bottom-0 w-0.5 bg-foreground/50 z-10"
                      style={{ left: `${summary.pace.expectedPct}%` }}
                    />
                  )}
                </div>

                {/* Remaining / Daily allowance */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold pt-0.5">
                  <span className={style.text}>
                    {item.remaining >= 0
                      ? `Disponible: ${formatAmount(item.remaining)}`
                      : `Excedido por: ${formatAmount(Math.abs(item.remaining))}`}
                  </span>
                  {item.remaining > 0 && summary.pace.daysRemaining > 0 && (
                    <span className="text-foreground/45">
                      ~{formatAmount(item.dailyAllowance)}/día disponible
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {budgets.length === 0 && !loading && (
          <div className="py-16 text-center glass rounded-3xl border-dashed border-2 border-border flex flex-col items-center justify-center p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <div className="max-w-xs">
              <p className="text-sm text-foreground/60 font-semibold">Sin presupuestos asignados</p>
              <p className="text-xs text-foreground/40 mt-1">
                Establece presupuestos para tus categorías de gastos principales y mantén tu dinero bajo control.
              </p>
            </div>
            <button
              onClick={handleOpenCreate}
              className="bg-primary hover:bg-primary/90 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-md"
            >
              Asignar Primer Presupuesto
            </button>
          </div>
        )}
      </div>

      {/* MODAL: Crear/Editar Presupuesto */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-lg text-foreground">
                  {editingBudget ? "Editar Presupuesto" : "Crear Presupuesto"}
                </h3>
                <p className="text-[10px] text-foreground/45 mt-0.5">Define un tope de consumo mensual</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 dark:bg-red-950/20 border border-red-500/10 p-3.5 rounded-2xl font-bold">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">
                  Categoría de Gasto
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary text-foreground"
                  required
                >
                  {expenseCategories.map((catName) => (
                    <option key={catName} value={catName}>
                      {catName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">
                  Límite Mensual ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="200.00"
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading || !category || !limit}
                className="w-full bg-primary hover:bg-primary/90 text-white py-3.5 rounded-2xl font-bold text-sm tracking-wide shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? "Guardando..." : "Guardar Presupuesto"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
