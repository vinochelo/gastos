'use client';

import { useState, useMemo } from "react";
import { Transaction, useUserConfig, useAccounts, useMonthTransactions } from "@/hooks/useFirestore";
import { Search, Plus, Mic, Square, Loader2 } from "lucide-react";
import EditTransactionModal from "@/components/EditTransactionModal";
import AddTransactionModal from "@/components/AddTransactionModal";
import TransactionItem from "@/components/TransactionItem";
import { useApp } from "@/context/AppContext";
import { deleteTransactionAtomic } from "@/lib/transactions";

export default function TransaccionesPage() {
  const {
    formatAmount,
    showToast,
    confirmAction,
    isGlobalRecording,
    isGlobalVoiceLoading,
    startGlobalVoiceRecording,
    stopGlobalVoiceRecording,
  } = useApp();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [typeFilter, setTypeFilter] = useState<"todos" | "gasto" | "ingreso" | "transferencia">("todos");
  const [accountFilter, setAccountFilter] = useState<string>("todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { transactions, loading } = useMonthTransactions(selectedMonth, selectedYear);
  const { accounts } = useAccounts();
  const { config } = useUserConfig();

  const monthOptions = useMemo(() => {
    const options = [];
    const base = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      options.push({
        month: d.getMonth(),
        year: d.getFullYear(),
        label: d.toLocaleString("es-ES", { month: "long", year: "numeric" }),
      });
    }
    return options;
  }, []);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return transactions.filter((tx) => {
      if (typeFilter !== "todos" && tx.tipo !== typeFilter) return false;
      if (accountFilter !== "todas") {
        const matchesAcc =
          tx.accountId === accountFilter ||
          tx.fromId === accountFilter ||
          tx.toId === accountFilter;
        if (!matchesAcc) return false;
      }
      if (!q) return true;
      return (
        tx.descripcion?.toLowerCase().includes(q) ||
        tx.categoria?.toLowerCase().includes(q) ||
        tx.subcategoria?.toLowerCase().includes(q) ||
        tx.monto.toString().includes(q)
      );
    });
  }, [transactions, typeFilter, accountFilter, searchQuery]);

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
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
            Historial Financiero
          </p>
          <select
            value={`${selectedMonth}-${selectedYear}`}
            onChange={(e) => {
              const [m, y] = e.target.value.split("-").map(Number);
              setSelectedMonth(m);
              setSelectedYear(y);
            }}
            className="text-xl sm:text-2xl font-black tracking-tight text-foreground bg-transparent border-none p-0 pr-6 capitalize cursor-pointer focus:outline-none hover:text-primary"
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
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={isGlobalRecording ? stopGlobalVoiceRecording : startGlobalVoiceRecording}
            disabled={isGlobalVoiceLoading}
            title="Dictar movimiento por voz"
            className={`hidden sm:flex h-10 px-3.5 rounded-xl border text-xs font-bold items-center gap-1.5 transition-all cursor-pointer ${
              isGlobalRecording
                ? "bg-rose-500 text-white border-rose-500"
                : "bg-card border-border text-foreground hover:border-primary/40"
            }`}
          >
            {isGlobalVoiceLoading ? (
              <Loader2 size={14} className="animate-spin text-primary" />
            ) : isGlobalRecording ? (
              <Square size={12} className="fill-current" />
            ) : (
              <Mic size={14} className="text-primary" />
            )}
            <span>{isGlobalRecording ? "Detener" : "Voz IA"}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            title="Nuevo movimiento"
            className="h-10 px-4 rounded-xl bg-primary hover:opacity-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-primary/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Nuevo</span>
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 text-foreground" />
          <input
            type="text"
            placeholder="Buscar por descripción, categoría o monto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border p-3.5 pl-11 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all shadow-sm text-foreground placeholder-foreground/35 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {(
              [
                { id: "todos", label: "Todos" },
                { id: "gasto", label: "Gastos" },
                { id: "ingreso", label: "Ingresos" },
                { id: "transferencia", label: "Transferencias" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  typeFilter === tab.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "glass text-foreground/60 hover:text-foreground border border-border"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="glass border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground cursor-pointer focus:outline-none"
          >
            <option value="todas" className="bg-white dark:bg-gray-800">Todas las cuentas</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id} className="bg-white dark:bg-gray-800">
                {acc.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions */}
      <div className="space-y-2.5">
        {filteredTransactions.map((tx) => (
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

        {filteredTransactions.length === 0 && !loading && (
          <div className="py-16 text-center glass rounded-2xl border border-dashed border-border">
            <p className="text-sm opacity-45">No hay transacciones con estos filtros</p>
          </div>
        )}
      </div>

      <AddTransactionModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />

      {editingTx && (
        <EditTransactionModal
          key={editingTx.id}
          isOpen={!!editingTx}
          onClose={() => setEditingTx(null)}
          transaction={editingTx}
        />
      )}
    </div>
  );
}
