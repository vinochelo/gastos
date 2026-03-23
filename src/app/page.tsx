'use client';

import { useState } from "react";
import { motion, Variants } from "framer-motion";
import { useAccounts, useRecentTransactions, Transaction } from "@/hooks/useFirestore";
import { Plus, ArrowRightLeft, TrendingDown, TrendingUp, User, LogOut, Trash2, Wallet, Receipt, ChevronRight } from "lucide-react";
import AddTransactionModal from "@/components/AddTransactionModal";
import TransferModal from "@/components/TransferModal";
import CategoryChart from "@/components/CategoryChart";
import { auth, db } from "@/lib/firebase";
import { deleteDoc, doc, updateDoc, increment } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" }
  }
};

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { accounts } = useAccounts();
  const { transactions } = useRecentTransactions(10);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

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
    return { income, expense, totalBalance, savings: income - expense };
  }, [transactions, accounts]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <motion.div
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="w-8 h-8 rounded-full bg-primary/20"
      />
    </div>
  );
  
  if (!user) {
    router.push("/login");
    return null;
  }

  const handleDeleteTx = async (tx: Transaction) => {
    if (!confirm("¿Eliminar transacción?")) return;
    try {
      const mult = tx.tipo === 'ingreso' ? -1 : 1;
      if (tx.accountId) {
        await updateDoc(doc(db, "accounts", tx.accountId), { saldo: increment(mult * tx.monto) });
      } else if (tx.tipo === 'transferencia' && tx.fromId && tx.toId) {
        await updateDoc(doc(db, "accounts", tx.fromId), { saldo: increment(tx.monto) });
        await updateDoc(doc(db, "accounts", tx.toId), { saldo: increment(-tx.monto) });
      }
      await deleteDoc(doc(db, "transactions", tx.id));
    } catch { alert("Error al eliminar."); }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 pb-32"
    >
      {/* Header */}
      <motion.header variants={itemVariants} className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 mb-1">Gestor de Gastos</p>
          <h1 className="text-3xl font-black italic tracking-tight text-foreground">Buenos días</h1>
        </div>
        <div className="relative">
          <button 
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center hover:bg-foreground/10 transition-colors"
          >
            <User size={18} className="opacity-60" />
          </button>
          
          {isUserMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute right-0 top-12 w-52 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-xl border border-gray-100 dark:border-gray-700 z-50"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-2">{auth.currentUser?.email}</p>
              <button 
                onClick={() => logout()}
                className="w-full flex items-center justify-between p-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 text-sm font-medium transition-colors"
              >
                Cerrar sesión <LogOut size={14} />
              </button>
            </motion.div>
          )}
        </div>
      </motion.header>

      {/* Balance Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <Wallet size={14} className="opacity-50" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-40">Total</span>
          </div>
          <p className="text-2xl font-black italic tracking-tight">${stats.totalBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
              <TrendingDown size={14} className="text-red-500" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-40">Gastos</span>
          </div>
          <p className="text-2xl font-black italic tracking-tight text-red-500">$${stats.expense.toFixed(2)}</p>
        </div>
      </motion.div>

      {/* Chart - MAIN ELEMENT */}
      <motion.div variants={itemVariants}>
        <CategoryChart />
      </motion.div>

      {/* Accounts Section */}
      <motion.section variants={itemVariants} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Cuentas</h2>
          <button className="text-[10px] font-bold uppercase tracking-wider opacity-40 hover:opacity-100 transition-opacity">
            Ver todas
          </button>
        </div>
        
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
          {accounts.map((acc, index) => (
            <motion.div
              key={acc.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex-shrink-0 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 min-w-[160px]"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-1">{acc.nombre}</p>
              <p className={`text-lg font-bold tracking-tight ${acc.saldo >= 0 ? '' : 'text-red-500'}`}>
                ${Math.abs(acc.saldo).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Recent Transactions */}
      <motion.section variants={itemVariants} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Recientes</h2>
          <button 
            onClick={() => router.push('/transacciones')}
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider opacity-40 hover:opacity-100 transition-opacity"
          >
            Ver todas <ChevronRight size={12} />
          </button>
        </div>
        
        <div className="space-y-2">
          {transactions.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border border-gray-100 dark:border-gray-700">
              <Wallet size={24} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm font-medium opacity-30">Sin transacciones</p>
            </div>
          ) : (
            transactions.slice(0, 5).map((tx, index) => (
              <motion.div 
                key={tx.id} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm border border-gray-100 dark:border-gray-700 group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    tx.tipo === 'ingreso' ? 'bg-green-50 dark:bg-green-950/30' :
                    tx.tipo === 'transferencia' ? 'bg-blue-50 dark:bg-blue-950/30' :
                    'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    {tx.tipo === 'ingreso' ? <TrendingUp size={16} className="text-green-600" /> : 
                     tx.tipo === 'transferencia' ? <ArrowRightLeft size={16} className="text-blue-600" /> : 
                     <TrendingDown size={16} className="text-gray-600 dark:text-gray-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{tx.descripcion || tx.categoria}</p>
                    <p className="text-[10px] opacity-40">{tx.categoria}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className={`text-sm font-bold ${tx.tipo === 'ingreso' ? 'text-green-600' : ''}`}>
                    {tx.tipo === 'ingreso' ? '+' : '-'}${tx.monto.toFixed(2)}
                  </p>
                  <button 
                    onClick={() => handleDeleteTx(tx)}
                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.section>

      {/* Quick Actions */}
      <motion.div variants={itemVariants} className="flex gap-3">
        <motion.button
          onClick={() => setIsAddModalOpen(true)}
          className="flex-1 bg-foreground text-background rounded-2xl p-4 flex items-center justify-center gap-3 font-bold text-sm hover:opacity-90 transition-opacity"
          whileTap={{ scale: 0.98 }}
        >
          <Plus size={18} /> Agregar gasto
        </motion.button>
        
        <motion.button
          onClick={() => setIsTransferModalOpen(true)}
          className="w-14 bg-foreground/5 rounded-2xl flex items-center justify-center hover:bg-foreground/10 transition-colors"
          whileTap={{ scale: 0.98 }}
        >
          <ArrowRightLeft size={18} />
        </motion.button>
      </motion.div>

      <AddTransactionModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      <TransferModal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} />
    </motion.div>
  );
}
