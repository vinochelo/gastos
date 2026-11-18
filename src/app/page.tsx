'use client';

import { useState, useMemo, useEffect } from "react";
import {
  useAccounts,
  useMonthTransactions,
  useUserConfig,
  useBudgets,
  useDebts,
  useGoals,
  Transaction,
} from "@/hooks/useFirestore";
import {
  Plus,
  ArrowRightLeft,
  MessageCircle,
  ChevronRight,
  Loader2,
  Mic,
  Square,
  Sparkles,
  X,
  Send,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Wallet,
} from "lucide-react";
import AddTransactionModal from "@/components/AddTransactionModal";
import TransferModal from "@/components/TransferModal";
import EditTransactionModal from "@/components/EditTransactionModal";
import CategoryChart from "@/components/CategoryChart";
import TransactionItem from "@/components/TransactionItem";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import AccountIcon from "@/components/AccountIcon";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import { deleteTransactionAtomic } from "@/lib/transactions";
import { evaluateBudgets, getBudgetStatusLabel, normalizeCategoryKey } from "@/lib/budgets";
import { useApp } from "@/context/AppContext";
import SplashLoading from "@/components/SplashLoading";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const {
    formatAmount,
    showToast,
    confirmAction,
    isGlobalRecording,
    isGlobalVoiceLoading,
    startGlobalVoiceRecording,
    stopGlobalVoiceRecording,
    processParsedVoiceOrText,
  } = useApp();
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const { accounts } = useAccounts();
  const { transactions } = useMonthTransactions(selectedMonth, selectedYear);
  const { config } = useUserConfig();
  const { budgets } = useBudgets();
  const { debts } = useDebts();
  const { goals } = useGoals();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Quick natural-language input state
  const [quickText, setQuickText] = useState("");
  const [isQuickTextLoading, setIsQuickTextLoading] = useState(false);

  // AI analysis states
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const fetchAiAnalysis = async () => {
    if (!user) return;
    setIsAiLoading(true);
    setAiAnalysis(null);
    try {
      const res = await authFetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
        }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAiAnalysis(data.analysis);
        setIsAnalysisModalOpen(true);
      } else {
        showToast(data.error || "No se pudo generar el análisis", "error");
      }
    } catch (err) {
      console.error("Error fetching AI analysis:", err);
      showToast("Error de conexión al generar el análisis.", "error");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleQuickTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !quickText.trim() || isQuickTextLoading) return;
    setIsQuickTextLoading(true);
    try {
      const res = await authFetch("/api/text-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: quickText.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Error al interpretar el texto.");
      setQuickText("");
      await processParsedVoiceOrText(data, "web_text", transactions);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Error al interpretar el texto.";
      showToast(msg, "error");
    } finally {
      setIsQuickTextLoading(false);
    }
  };

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        month: d.getMonth(),
        year: d.getFullYear(),
        label: d.toLocaleString("es-ES", { month: "long", year: "numeric" }),
      });
    }
    return options;
  }, []);

  const telegramLinked = !!config?.telegramId;

  const stats = useMemo(() => {
    if (!transactions || !accounts) return { income: 0, expense: 0, totalBalance: 0 };

    let income = 0;
    let expense = 0;

    transactions.forEach((tx) => {
      if (tx.tipo === "ingreso") income += Number(tx.monto || 0);
      else if (tx.tipo === "gasto") expense += Number(tx.monto || 0);
    });

    const totalBalance = accounts
      .filter((a) => !a.nombre.toLowerCase().includes("ahorro"))
      .reduce((acc, a) => acc + Number(a.saldo || 0), 0);

    return { income, expense, totalBalance };
  }, [transactions, accounts]);

  const budgetEvaluation = useMemo(() => {
    const spentMap: Record<string, number> = {};
    transactions.forEach((tx) => {
      if (tx.tipo === "gasto") {
        const key = normalizeCategoryKey(tx.categoria);
        spentMap[key] = (spentMap[key] || 0) + Number(tx.monto || 0);
      }
    });
    return evaluateBudgets(budgets, spentMap, selectedYear, selectedMonth);
  }, [budgets, transactions, selectedYear, selectedMonth]);

  const moduleSummary = useMemo(() => {
    const activeBudgets = budgets.length;
    const pendingDebt = debts
      .filter((d) => !d.pagado && d.tipo === "debo")
      .reduce((sum, d) => sum + Number(d.monto || 0), 0);
    const activeGoals = goals.length;
    const totalSaved = goals.reduce((sum, g) => sum + Number(g.montoActual || 0), 0);
    return { activeBudgets, pendingDebt, activeGoals, totalSaved };
  }, [budgets, debts, goals]);

  if (authLoading || !user) return <SplashLoading />;

  const handleDeleteTx = async (tx: Transaction) => {
    const confirmed = await confirmAction({
      title: "Eliminar transacción",
      message: `¿Deseas eliminar "${tx.descripcion || tx.categoria}" por ${formatAmount(tx.monto)}? Se revertirá el saldo en la cuenta.`,
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await deleteTransactionAtomic(tx);
      showToast("Transacción eliminada", "success");
    } catch {
      showToast("Error al eliminar transacción", "error");
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Section Header & Period Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
            Resumen Financiero
          </p>
          <select
            value={`${selectedMonth}-${selectedYear}`}
            onChange={(e) => {
              const [m, y] = e.target.value.split("-").map(Number);
              setSelectedMonth(m);
              setSelectedYear(y);
            }}
            className="text-xl sm:text-2xl font-black bg-transparent border-none p-0 pr-6 m-0 focus:ring-0 text-foreground cursor-pointer capitalize tracking-tight focus:outline-none hover:text-primary transition-colors"
          >
            {monthOptions.map((opt) => (
              <option
                key={`${opt.month}-${opt.year}`}
                value={`${opt.month}-${opt.year}`}
                className="bg-card text-foreground text-sm"
              >
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            onClick={isGlobalRecording ? stopGlobalVoiceRecording : startGlobalVoiceRecording}
            disabled={isGlobalVoiceLoading}
            className={`h-10 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer border ${
              isGlobalRecording
                ? "bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/20"
                : "bg-card text-foreground border-border hover:border-primary/40"
            }`}
          >
            {isGlobalVoiceLoading ? (
              <Loader2 size={15} className="animate-spin text-primary" />
            ) : isGlobalRecording ? (
              <Square size={13} className="fill-current animate-pulse" />
            ) : (
              <Mic size={15} className="text-primary" />
            )}
            <span>{isGlobalRecording ? "Detener y registrar" : "Voz IA"}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsTransferModalOpen(true)}
            className="h-10 px-3.5 rounded-xl bg-card border border-border hover:border-primary/40 text-foreground/80 hover:text-foreground font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <ArrowRightLeft size={15} />
            <span>Transferir</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="h-10 px-4 rounded-xl bg-primary hover:opacity-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-primary/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Movimiento</span>
          </button>
        </div>
      </div>

      {/* Hero Financiero */}
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 text-white p-5 sm:p-6 shadow-xl border border-white/10 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-teal-300/85 flex items-center gap-1.5">
              <Wallet size={13} />
              Saldo Disponible Total
            </p>
            <p className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
              {formatAmount(stats.totalBalance)}
            </p>
          </div>

          <button
            type="button"
            onClick={fetchAiAnalysis}
            disabled={isAiLoading}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
          >
            {isAiLoading ? (
              <>
                <Loader2 size={14} className="animate-spin text-teal-300" />
                Analizando...
              </>
            ) : (
              <>
                <Sparkles size={14} className="text-teal-300" />
                Diagnóstico IA
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/8 border border-white/10 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/80 flex items-center gap-1">
              <TrendingUp size={12} />
              Ingresos del mes
            </p>
            <p className="text-lg sm:text-xl font-black text-emerald-300 mt-0.5">
              +{formatAmount(stats.income)}
            </p>
          </div>

          <div className="rounded-2xl bg-white/8 border border-white/10 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300/80 flex items-center gap-1">
              <TrendingDown size={12} />
              Gastos del mes
            </p>
            <p className="text-lg sm:text-xl font-black text-rose-300 mt-0.5">
              -{formatAmount(stats.expense)}
            </p>
          </div>
        </div>

        {/* Mobile Quick Actions Strip */}
        <div className="grid grid-cols-3 gap-2 sm:hidden pt-1">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="py-2.5 px-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus size={14} />
            Movimiento
          </button>

          <button
            type="button"
            onClick={isGlobalRecording ? stopGlobalVoiceRecording : startGlobalVoiceRecording}
            disabled={isGlobalVoiceLoading}
            className={`py-2.5 px-2 rounded-xl font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
              isGlobalRecording
                ? "bg-rose-500 text-white border-rose-400"
                : "bg-white/10 hover:bg-white/15 text-white border-white/10"
            }`}
          >
            {isGlobalVoiceLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isGlobalRecording ? (
              <Square size={12} className="fill-current" />
            ) : (
              <Mic size={14} />
            )}
            {isGlobalRecording ? "Detener" : "Dictar"}
          </button>

          <button
            type="button"
            onClick={() => setIsTransferModalOpen(true)}
            className="py-2.5 px-2 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/10 font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowRightLeft size={14} />
            Transferir
          </button>
        </div>
      </section>

      {/* Quick Natural-Language Entry + Voice Trigger */}
      <form
        onSubmit={handleQuickTextSubmit}
        className="glass rounded-2xl p-2 flex items-center gap-2"
      >
        <button
          type="button"
          onClick={isGlobalRecording ? stopGlobalVoiceRecording : startGlobalVoiceRecording}
          disabled={isGlobalVoiceLoading}
          title={isGlobalRecording ? "Detener y registrar por voz" : "Dictar movimiento por voz"}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
            isGlobalRecording
              ? "bg-rose-500 text-white animate-pulse"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          }`}
        >
          {isGlobalVoiceLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isGlobalRecording ? (
            <Square size={14} className="fill-current" />
          ) : (
            <Mic size={16} />
          )}
        </button>

        <input
          type="text"
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
          placeholder='Escribe o dicta: "Gasté 12.50 en almuerzo con Produbanco"'
          className="flex-1 bg-transparent px-2 py-2 text-xs sm:text-sm text-foreground placeholder-foreground/40 focus:outline-none font-medium min-w-0"
        />

        <button
          type="submit"
          disabled={!quickText.trim() || isQuickTextLoading}
          title="Registrar con IA"
          className="h-10 px-3.5 rounded-xl bg-primary hover:opacity-95 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
        >
          {isQuickTextLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          <span className="hidden sm:inline">Registrar</span>
        </button>
      </form>

      {/* Telegram Link Promo */}
      {!telegramLinked && (
        <div className="glass rounded-3xl p-4 sm:p-5 border border-primary/25 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <MessageCircle size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm text-foreground">
                Conecta tu Bot de Telegram
              </h3>
              <p className="text-xs text-foreground/60 leading-snug mt-0.5">
                También puedes enviar audios y fotos de facturas desde Telegram.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/ajustes")}
            className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1 shrink-0 hover:opacity-95 transition-opacity cursor-pointer"
          >
            Vincular
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Planning Modules Quick Strip */}
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => router.push("/presupuestos")}
          className="glass rounded-2xl p-3.5 text-left hover:border-primary/40 transition-all cursor-pointer glass-glow"
        >
          <div className="flex items-center justify-between mb-1.5">
            <TrendingUp
              size={15}
              className={
                moduleSummary.activeBudgets === 0
                  ? "text-primary"
                  : budgetEvaluation.summary.status === "exceeded"
                  ? "text-rose-500"
                  : budgetEvaluation.summary.status === "warning"
                  ? "text-amber-500"
                  : "text-emerald-500"
              }
            />
            <ChevronRight size={13} className="opacity-35" />
          </div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/45">
            Presupuestos
          </p>
          <p
            className={`text-xs sm:text-sm font-black mt-0.5 truncate ${
              moduleSummary.activeBudgets === 0
                ? "text-foreground"
                : budgetEvaluation.summary.status === "exceeded"
                ? "text-rose-500"
                : budgetEvaluation.summary.status === "warning"
                ? "text-amber-500"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {moduleSummary.activeBudgets === 0
              ? "Sin definir"
              : budgetEvaluation.summary.exceededCount > 0
              ? `${budgetEvaluation.summary.exceededCount} excedido(s)`
              : budgetEvaluation.summary.warningCount > 0
              ? `${budgetEvaluation.summary.warningCount} cerca límite`
              : `Dentro · ${budgetEvaluation.summary.pctRaw}%`}
          </p>
        </button>

        <button
          type="button"
          onClick={() => router.push("/deudas")}
          className="glass rounded-2xl p-3.5 text-left hover:border-primary/40 transition-all cursor-pointer glass-glow"
        >
          <div className="flex items-center justify-between mb-1.5">
            <DollarSign size={15} className="text-rose-500" />
            <ChevronRight size={13} className="opacity-35" />
          </div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/45">
            Por pagar
          </p>
          <p className="text-xs sm:text-sm font-black text-foreground mt-0.5 truncate">
            {formatAmount(moduleSummary.pendingDebt)}
          </p>
        </button>

        <button
          type="button"
          onClick={() => router.push("/metas")}
          className="glass rounded-2xl p-3.5 text-left hover:border-primary/40 transition-all cursor-pointer glass-glow"
        >
          <div className="flex items-center justify-between mb-1.5">
            <Target size={15} className="text-emerald-500" />
            <ChevronRight size={13} className="opacity-35" />
          </div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/45">
            Metas ({moduleSummary.activeGoals})
          </p>
          <p className="text-xs sm:text-sm font-black text-foreground mt-0.5 truncate">
            {formatAmount(moduleSummary.totalSaved)}
          </p>
        </button>
      </div>

      {/* Budget Health Indicator Card */}
      {budgets.length > 0 &&
        (() => {
          const s = budgetEvaluation.summary;
          const StatusIcon =
            s.status === "exceeded"
              ? AlertCircle
              : s.status === "warning"
              ? AlertTriangle
              : CheckCircle;
          const barColor =
            s.status === "exceeded"
              ? "bg-rose-500"
              : s.status === "warning"
              ? "bg-amber-500"
              : "bg-emerald-500";
          const badgeStyle =
            s.status === "exceeded"
              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
              : s.status === "warning"
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";

          return (
            <button
              type="button"
              onClick={() => router.push("/presupuestos")}
              className="w-full text-left glass rounded-2xl p-4 hover:border-primary/40 transition-all cursor-pointer space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${badgeStyle}`}
                  >
                    <StatusIcon size={12} />
                    {getBudgetStatusLabel(s.status)}
                  </span>
                  <span className="text-xs font-bold text-foreground/60 truncate">
                    {formatAmount(s.totalSpent)} / {formatAmount(s.totalBudgeted)}
                  </span>
                </div>
                <span className="text-xs font-black text-foreground/75 shrink-0">
                  {s.pctRaw}%
                </span>
              </div>

              <div className="relative w-full h-2 bg-accent rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${s.barPct}%` }}
                />
                {s.pace.isCurrentMonth && (
                  <div
                    title={`Ritmo del mes: ${s.pace.expectedPct}%`}
                    className="absolute top-0 bottom-0 w-0.5 bg-foreground/50 z-10"
                    style={{ left: `${s.pace.expectedPct}%` }}
                  />
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] font-semibold text-foreground/55">
                <span>
                  {s.remaining >= 0
                    ? `Te quedan ${formatAmount(s.remaining)} dentro del presupuesto`
                    : `Excedido por ${formatAmount(Math.abs(s.remaining))}`}
                </span>
                <span className="text-primary font-bold">Ver detalle →</span>
              </div>
            </button>
          );
        })()}

      {/* Chart */}
      <CategoryChart
        onEdit={setEditingTx}
        onDelete={handleDeleteTx}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      {/* Cuentas Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-foreground/55">
            Tus Cuentas
          </h2>
          <button
            type="button"
            onClick={() => router.push("/cuentas")}
            className="text-xs font-bold text-primary hover:opacity-80 cursor-pointer"
          >
            Administrar →
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
          {accounts.map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => router.push("/cuentas")}
              className="flex-shrink-0 glass rounded-2xl p-3.5 min-w-[165px] text-left glass-glow cursor-pointer flex items-center gap-3"
            >
              <AccountIcon nombre={acc.nombre} className="w-9 h-9 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-foreground/55 truncate">
                  {acc.nombre}
                </p>
                <p
                  className={`text-sm font-black tracking-tight ${
                    acc.saldo >= 0 ? "text-foreground" : "text-rose-500 dark:text-rose-400"
                  }`}
                >
                  {formatAmount(acc.saldo || 0)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-foreground/55">
            Actividad Reciente
          </h2>
          <button
            type="button"
            onClick={() => router.push("/transacciones")}
            className="text-xs font-bold text-primary hover:opacity-80 cursor-pointer"
          >
            Ver todas →
          </button>
        </div>

        <div className="space-y-2.5">
          {transactions.slice(0, 6).map((tx) => (
            <TransactionItem
              key={tx.id}
              tx={tx}
              accounts={accounts}
              categoryIcons={config?.categoryIcons}
              formatAmount={formatAmount}
              onEdit={setEditingTx}
              onDelete={handleDeleteTx}
              showDate
            />
          ))}

          {transactions.length === 0 && (
            <div className="py-10 text-center glass rounded-2xl border border-dashed border-border">
              <p className="text-sm text-foreground/45 font-medium">
                Sin transacciones registradas este mes
              </p>
            </div>
          )}
        </div>
      </div>

      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
      />

      {editingTx && editingTx.id ? (
        <EditTransactionModal
          key={editingTx.id}
          isOpen={true}
          onClose={() => setEditingTx(null)}
          transaction={editingTx}
        />
      ) : null}

      {/* AI Analysis Modal */}
      {isAnalysisModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card rounded-3xl p-6 max-w-lg w-full border border-border shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                  <Sparkles size={17} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-foreground leading-none">
                    Diagnóstico de Gestor.AI
                  </h3>
                  <p className="text-[10px] uppercase tracking-wider text-foreground/45 mt-1 font-bold">
                    Asesor Financiero Personal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAnalysisModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 py-1">
              {aiAnalysis ? <MarkdownRenderer content={aiAnalysis} /> : null}
            </div>

            <div className="mt-4 pt-3 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setIsAnalysisModalOpen(false)}
                className="bg-primary hover:opacity-95 text-white px-5 py-2.5 rounded-xl font-bold text-xs active:scale-95 transition-all cursor-pointer shadow-md"
              >
                Cerrar diagnóstico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
