'use client';

import { useRecentTransactions, useAccounts } from "@/hooks/useFirestore";
import { TrendingUp, TrendingDown, ArrowRightLeft, Wallet, Calendar } from "lucide-react";
import { useMemo } from "react";

export default function MonthlySummary() {
  const { transactions } = useRecentTransactions(100); // Tomamos suficientes para el mes
  const { accounts } = useAccounts();

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let income = 0;
    let expense = 0;

    transactions.forEach(tx => {
      const txDate = tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date(tx.timestamp);
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        if (tx.tipo === 'ingreso') income += tx.monto;
        else if (tx.tipo === 'gasto') expense += tx.monto;
      }
    });

    const totalBalance = accounts.reduce((acc, a) => acc + (a.saldo || 0), 0);
    const prevMonthBalance = totalBalance - income + expense;

    return { income, expense, totalBalance, prevMonthBalance };
  }, [transactions, accounts]);

  const monthName = new Date().toLocaleDateString('es-ES', { month: 'long' }).toUpperCase();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4">
      {/* Saldo Inicial (Traslado) */}
      <div className="glass p-6 rounded-[2rem] border-white/5 relative overflow-hidden group">
        <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform">
          <Calendar size={120} />
        </div>
        <div className="space-y-1 relative">
          <p className="text-[10px] font-black opacity-40 uppercase tracking-widest italic flex items-center gap-2">
            <ArrowRightLeft size={12} /> TRASLADO MES ANTERIOR
          </p>
          <p className="text-3xl font-black italic tracking-tighter text-foreground/80">
            ${stats.prevMonthBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Saldo Actual */}
      <div className="glass p-6 rounded-[2rem] border-primary/20 bg-primary/5 relative overflow-hidden group shadow-2xl shadow-primary/10">
        <div className="absolute -right-4 -top-4 opacity-10 group-hover:rotate-12 transition-transform text-primary">
          <Wallet size={120} />
        </div>
        <div className="space-y-1 relative">
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] italic flex items-center gap-2">
            DISPONIBLE TOTAL <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
          </p>
          <p className="text-4xl font-black italic tracking-tighter text-primary drop-shadow-sm">
            ${stats.totalBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Ingresos vs Gastos del Mes */}
      <div className="md:col-span-2 flex gap-4">
        <div className="flex-1 glass p-5 rounded-3xl border-green-500/10 flex items-center gap-4">
           <div className="bg-green-500/20 p-3 rounded-2xl text-green-500">
             <TrendingUp size={24} />
           </div>
           <div>
             <p className="text-[9px] font-black opacity-40 uppercase italic tracking-tighter">INGRESOS {monthName}</p>
             <p className="text-xl font-black italic text-green-500">+${stats.income.toFixed(2)}</p>
           </div>
        </div>
        <div className="flex-1 glass p-5 rounded-3xl border-red-500/10 flex items-center gap-4">
           <div className="bg-red-500/20 p-3 rounded-2xl text-red-500">
             <TrendingDown size={24} />
           </div>
           <div>
             <p className="text-[9px] font-black opacity-40 uppercase italic tracking-tighter">GASTOS {monthName}</p>
             <p className="text-xl font-black italic text-red-500">-${stats.expense.toFixed(2)}</p>
           </div>
        </div>
      </div>
    </div>
  );
}
