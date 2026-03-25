'use client';
// Force rebuild - System synced: 2026-03-25T09:22:00Z


import { useState } from "react";
import { useAccounts, useRecentTransactions, useUserConfig, Transaction } from "@/hooks/useFirestore";
import { Plus, ArrowRightLeft, TrendingDown, TrendingUp, Wallet, Settings, MessageCircle, ChevronRight, Loader2 } from "lucide-react";
import AddTransactionModal from "@/components/AddTransactionModal";
import TransferModal from "@/components/TransferModal";
import EditTransactionModal from "@/components/EditTransactionModal";
import CategoryChart from "@/components/CategoryChart";
import { auth, db } from "@/lib/firebase";
import { deleteDoc, doc, updateDoc, increment } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { accounts } = useAccounts();
  const { transactions } = useRecentTransactions(100);
  const { config } = useUserConfig();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const telegramLinked = !!config?.telegramId;

  const stats = useMemo(() => {
    if (!transactions || !accounts) return { income: 0, expense: 0, totalBalance: 0, calculatedBalances: {} };

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let income = 0, expense = 0;
    
    transactions.forEach(tx => {
      try {
        const ts = tx.timestamp;
        if (!ts) return; // Skip if timestamp is still pending (null)
        const txDate = 'toDate' in ts ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts as any));
        if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
          if (tx.tipo === 'ingreso') income += tx.monto;
          else if (tx.tipo === 'gasto') expense += tx.monto;
        }
      } catch (e) {
        console.error("Error processing tx:", e);
      }
    });
    
    const calculatedBalances: Record<string, number> = {};
    accounts.forEach(acc => calculatedBalances[acc.id] = 0);
    
    transactions.forEach(tx => {
      if (tx.tipo === 'ingreso' && tx.accountId) {
        calculatedBalances[tx.accountId] = (calculatedBalances[tx.accountId] || 0) + tx.monto;
      } else if (tx.tipo === 'gasto' && tx.accountId) {
        calculatedBalances[tx.accountId] = (calculatedBalances[tx.accountId] || 0) - tx.monto;
      } else if (tx.tipo === 'transferencia') {
        if (tx.fromId) {
          calculatedBalances[tx.fromId] = (calculatedBalances[tx.fromId] || 0) - tx.monto;
        }
        if (tx.toId) {
          calculatedBalances[tx.toId] = (calculatedBalances[tx.toId] || 0) + tx.monto;
        }
      }
    });
    
    const totalBalance = Object.values(calculatedBalances).reduce((acc, val) => acc + val, 0);
    
    return { income, expense, totalBalance, calculatedBalances };
  }, [transactions, accounts]);

  const recentTransactions = transactions;

  if (authLoading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 size={24} className="animate-spin text-indigo-500" />
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

  const getAccountBalance = (accountId: string) => {
    return stats.calculatedBalances[accountId] || 0;
  };

  return (
    <div className="space-y-5 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold opacity-40">Gestor de Gastos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-foreground text-background rounded-lg px-4 py-2 flex items-center justify-center gap-2 font-semibold text-xs"
          >
            <Plus size={14} /> Agregar
          </button>
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="w-9 h-9 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center"
          >
            <ArrowRightLeft size={14} />
          </button>
          <button 
            onClick={() => router.push('/ajustes')}
            className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
          >
            <Settings size={14} className="opacity-50" />
          </button>
        </div>
      </div>

      {!telegramLinked && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 text-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <MessageCircle size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">Conecta Telegram</h3>
              <p className="text-sm opacity-90 mb-4">
                Registra gastos con tu voz.
              </p>
              <button 
                onClick={() => router.push('/ajustes')}
                className="bg-white text-indigo-600 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2"
              >
                Configurar Bot
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      <CategoryChart onEdit={setEditingTx} onDelete={handleDeleteTx} />

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

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold tracking-tight">Cuentas</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {accounts.map((acc) => (
            <div key={acc.id} className="flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700 min-w-[140px]">
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-40 truncate">{acc.nombre}</p>
              <p className={`text-base font-bold ${getAccountBalance(acc.id) >= 0 ? '' : 'text-red-500'}`}>
                ${Math.abs(getAccountBalance(acc.id)).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold tracking-tight">Recientes</h2>
          <button onClick={() => router.push('/transacciones')} className="text-xs font-semibold opacity-40 hover:opacity-100">
            Ver todo →
          </button>
        </div>
        
        <div className="space-y-0">
          {recentTransactions.slice(0, 5).map((tx) => (
            <div key={tx.id} className="bg-white dark:bg-gray-800 rounded-lg p-2.5 flex items-center justify-between border border-gray-100 dark:border-gray-700 group">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  tx.tipo === 'ingreso' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  {tx.tipo === 'ingreso' ? (
                    <TrendingUp size={14} className="text-green-600" />
                  ) : (
                    <Wallet size={14} className="opacity-60" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{tx.descripcion || tx.categoria}</p>
                  <p className="text-[10px] opacity-40">{tx.categoria}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <p className={`text-sm font-bold ${tx.tipo === 'ingreso' ? 'text-green-600' : ''}`}>
                  {tx.tipo === 'ingreso' ? '+' : '-'}${tx.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </p>
                <button 
                  onClick={() => setEditingTx(tx)}
                  className="p-1 opacity-60 hover:opacity-100 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded"
                >
                  <Settings size={10} className="text-blue-500" />
                </button>
                <button 
                  onClick={() => handleDeleteTx(tx)}
                  className="p-1 opacity-60 hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                >
                  <TrendingDown size={10} className="text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>


      <AddTransactionModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      <TransferModal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} />
      {editingTx && editingTx.id ? (
        <EditTransactionModal 
          key={editingTx.id}
          isOpen={true} 
          onClose={() => setEditingTx(null)} 
          transaction={editingTx} 
        />
      ) : null}
    </div>
  );
}
