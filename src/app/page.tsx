'use client';

import { useState } from "react";
import { useAccounts, useRecentTransactions, Transaction } from "@/hooks/useFirestore";
import { Plus, ArrowRightLeft, TrendingDown, TrendingUp, Wallet, Settings } from "lucide-react";
import AddTransactionModal from "@/components/AddTransactionModal";
import TransferModal from "@/components/TransferModal";
import EditTransactionModal from "@/components/EditTransactionModal";
import CategoryChart from "@/components/CategoryChart";
import { auth, db } from "@/lib/firebase";
import { deleteDoc, doc, updateDoc, increment } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

const getCreatedAt = (tx: Transaction): number => {
  const ts = tx.createdAt;
  if (!ts) return 0;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function') {
    return ts.toDate().getTime();
  }
  return 0;
};

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { accounts } = useAccounts();
  const { transactions } = useRecentTransactions(10);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let income = 0, expense = 0;
    transactions.forEach(tx => {
      const ts = tx.timestamp;
      const txDate = 'toDate' in ts ? ts.toDate() : (ts instanceof Date ? ts : new Date());
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        if (tx.tipo === 'ingreso') income += tx.monto;
        else if (tx.tipo === 'gasto') expense += tx.monto;
      }
    });
    const totalBalance = accounts.reduce((acc, a) => acc + (a.saldo || 0), 0);
    return { income, expense, totalBalance };
  }, [transactions, accounts]);

  const recentTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => getCreatedAt(b) - getCreatedAt(a));
  }, [transactions]);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="w-6 h-6 rounded-full bg-gray-200 animate-pulse" />
    </div>
  );
  
  if (!user) {
    router.push("/login");
    return null;
  }

  const handleDeleteTx = async (tx: Transaction) => {
    if (!confirm("¿Eliminar?")) return;
    try {
      const mult = tx.tipo === 'ingreso' ? -1 : 1;
      if (tx.accountId) {
        await updateDoc(doc(db, "accounts", tx.accountId), { saldo: increment(mult * tx.monto) });
      }
      await deleteDoc(doc(db, "transactions", tx.id));
    } catch { alert("Error"); }
  };

  return (
    <div className="space-y-5 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold opacity-40">Gestor de Gastos</p>
        </div>
        <button 
          onClick={() => router.push('/ajustes')}
          className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
        >
          <Settings size={16} className="opacity-50" />
        </button>
      </div>

      {/* Chart */}
      <CategoryChart />

      {/* Balance */}
      <div className="flex gap-3">
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider opacity-40 mb-1">Total</p>
          <p className="text-xl font-bold tracking-tight">${stats.totalBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider opacity-40 mb-1">Gastos del mes</p>
          <p className="text-xl font-bold tracking-tight text-red-500">${stats.expense.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Accounts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold tracking-tight">Cuentas</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {accounts.map((acc) => (
            <div key={acc.id} className="flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700 min-w-[140px]">
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-40 truncate">{acc.nombre}</p>
              <p className={`text-base font-bold ${acc.saldo >= 0 ? '' : 'text-red-500'}`}>
                ${Math.abs(acc.saldo).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold tracking-tight">Recientes</h2>
          <button onClick={() => router.push('/transacciones')} className="text-xs font-semibold opacity-40 hover:opacity-100">
            Ver todo →
          </button>
        </div>
        
        <div className="space-y-1">
          {recentTransactions.slice(0, 5).map((tx) => (
            <div key={tx.id} className="bg-white dark:bg-gray-800 rounded-xl p-3 flex items-center justify-between border border-gray-100 dark:border-gray-700 group">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  tx.tipo === 'ingreso' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  {tx.tipo === 'ingreso' ? (
                    <TrendingUp size={18} className="text-green-600" />
                  ) : (
                    <Wallet size={18} className="opacity-60" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{tx.descripcion || tx.categoria}</p>
                  <p className="text-xs opacity-40">{tx.categoria}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className={`text-sm font-bold ${tx.tipo === 'ingreso' ? 'text-green-600' : ''}`}>
                  {tx.tipo === 'ingreso' ? '+' : '-'}${tx.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </p>
                <button 
                  onClick={() => setEditingTx(tx)}
                  className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg"
                >
                  <Settings size={12} className="text-blue-500" />
                </button>
                <button 
                  onClick={() => handleDeleteTx(tx)}
                  className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                >
                  <TrendingDown size={12} className="text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex-1 bg-foreground text-background rounded-xl py-3.5 flex items-center justify-center gap-2 font-semibold text-sm"
        >
          <Plus size={16} /> Agregar
        </button>
        <button
          onClick={() => setIsTransferModalOpen(true)}
          className="w-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center"
        >
          <ArrowRightLeft size={16} />
        </button>
      </div>

      <AddTransactionModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      <TransferModal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} />
      {editingTx && (
        <EditTransactionModal 
          isOpen={!!editingTx} 
          onClose={() => setEditingTx(null)} 
          transaction={editingTx} 
        />
      )}
    </div>
  );
}
