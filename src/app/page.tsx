'use client';

import { useState } from "react";
import { motion, Variants } from "framer-motion";
import { useAccounts, useRecentTransactions, Transaction } from "@/hooks/useFirestore";
import { Plus, ArrowRightLeft, TrendingDown, TrendingUp, User, LogOut, Trash2, Wallet, Sparkles, Zap, Receipt } from "lucide-react";
import AddTransactionModal from "@/components/AddTransactionModal";
import TransferModal from "@/components/TransferModal";
import CategoryChart from "@/components/CategoryChart";
import MonthlySummary from "@/components/MonthlySummary";
import { auth, db } from "@/lib/firebase";
import { deleteDoc, doc, updateDoc, increment } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: "easeOut" }
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
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full"
      />
    </div>
  );
  
  if (!user) {
    router.push("/login");
    return null;
  }

  const handleDeleteTx = async (tx: Transaction) => {
    if (!confirm("¿Eliminar transacción y revertir saldo?")) return;
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
      {/* Hero Section */}
      <motion.header variants={itemVariants} className="relative">
        <div className="relative z-10">
          <motion.div
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="flex items-center gap-3 mb-2"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-primary/30">
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Gestor.AI</span>
          </motion.div>
          
          <motion.h1 
            className="text-6xl md:text-7xl font-black italic tracking-tighter leading-none"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <span className="bg-gradient-to-r from-foreground via-foreground/90 to-foreground/60 bg-clip-text text-transparent">
              TU DINERO
            </span>
            <br />
            <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              BAJO CONTROL
            </span>
          </motion.h1>
        </div>
        
        {/* Decorative elements */}
        <motion.div 
          className="absolute -right-10 top-0 w-40 h-40 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div 
          className="absolute -right-5 top-20 w-20 h-20 bg-gradient-to-br from-pink-500/30 to-pink-500/10 rounded-full blur-2xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, delay: 1 }}
        />
      </motion.header>

      {/* Main Balance Card */}
      <motion.div variants={itemVariants} className="relative">
        <div className="relative overflow-hidden rounded-[2.5rem] p-8 md:p-10">
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-purple-600 to-pink-600" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
          
          {/* Content */}
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Wallet size={24} className="text-white" />
                </div>
                <div>
                  <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Balance Total</p>
                  <p className="text-white/40 text-xs font-bold">{new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
              <motion.button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <User size={20} className="text-white" />
              </motion.button>
            </div>
            
            <motion.p 
              className="text-5xl md:text-7xl font-black italic text-white tracking-tighter mb-8"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              ${stats.totalBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </motion.p>
            
            <div className="grid grid-cols-2 gap-4">
              <motion.div 
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-4"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-green-500/30 flex items-center justify-center">
                    <TrendingUp size={16} className="text-green-300" />
                  </div>
                  <span className="text-white/60 text-[10px] font-bold uppercase">Ingresos</span>
                </div>
                <p className="text-2xl font-black italic text-green-300">+${stats.income.toFixed(2)}</p>
              </motion.div>
              
              <motion.div 
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-4"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-red-500/30 flex items-center justify-center">
                    <TrendingDown size={16} className="text-red-300" />
                  </div>
                  <span className="text-white/60 text-[10px] font-bold uppercase">Gastos</span>
                </div>
                <p className="text-2xl font-black italic text-red-300">-${stats.expense.toFixed(2)}</p>
              </motion.div>
            </div>
          </div>
        </div>
        
        {isUserMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-0 top-full mt-4 w-64 glass rounded-[2rem] p-5 shadow-2xl z-50"
          >
            <p className="text-[10px] font-black opacity-30 px-3 mb-3 uppercase italic tracking-widest">Cuenta</p>
            <div className="p-4 rounded-2xl bg-foreground/5 mb-4">
              <p className="text-xs font-black italic">{auth.currentUser?.email}</p>
            </div>
            <button 
              onClick={() => logout()}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all font-black italic text-xs uppercase"
            >
              Cerrar Sesión <LogOut size={16} />
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4">
        {[
          { icon: Plus, label: 'Registro', color: 'from-primary to-purple-600', shadow: 'shadow-primary/30', delay: 0 },
          { icon: ArrowRightLeft, label: 'Transferir', color: 'from-indigo-500 to-purple-600', shadow: 'shadow-indigo-500/30', delay: 1 },
          { icon: Receipt, label: 'Historial', color: 'from-pink-500 to-rose-600', shadow: 'shadow-pink-500/30', delay: 2 },
        ].map((action, i) => (
          <motion.button
            key={action.label}
            onClick={() => i === 0 ? setIsAddModalOpen(true) : i === 1 ? setIsTransferModalOpen(true) : router.push('/transacciones')}
            className={`bg-gradient-to-br ${action.color} rounded-[2rem] p-6 flex flex-col items-center gap-3 shadow-xl ${action.shadow} relative overflow-hidden group`}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 + i * 0.1 }}
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all" />
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center relative z-10">
              <action.icon size={24} className="text-white" />
            </div>
            <span className="text-white font-black italic text-xs uppercase tracking-wider relative z-10">{action.label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Chart Section */}
      <motion.div variants={itemVariants}>
        <CategoryChart />
      </motion.div>

      {/* Accounts Grid */}
      <motion.section variants={itemVariants} className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-primary to-purple-500 rounded-full" />
          <h2 className="text-2xl font-black italic tracking-tight">Tus Cuentas</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((acc, index) => (
            <motion.div
              key={acc.id}
              className="group relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 rounded-[2rem] p-6 shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden cursor-pointer"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
            >
              {/* Top gradient bar */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
                index % 3 === 0 ? 'from-blue-500 to-cyan-500' :
                index % 3 === 1 ? 'from-purple-500 to-pink-500' :
                'from-green-500 to-emerald-500'
              }`} />
              
              {/* Background glow */}
              <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-20 blur-2xl ${
                index % 3 === 0 ? 'bg-blue-500' :
                index % 3 === 1 ? 'bg-purple-500' :
                'bg-green-500'
              } group-hover:opacity-40 transition-opacity`} />
              
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{acc.tipo}</span>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    index % 3 === 0 ? 'bg-blue-50 dark:bg-blue-950 text-blue-500' :
                    index % 3 === 1 ? 'bg-purple-50 dark:bg-purple-950 text-purple-500' :
                    'bg-green-50 dark:bg-green-950 text-green-500'
                  }`}>
                    <Wallet size={18} />
                  </div>
                </div>
                
                <h3 className="text-xl font-black italic uppercase tracking-tight mb-1">{acc.nombre}</h3>
                
                <p className={`text-3xl font-black italic tracking-tight ${
                  acc.saldo >= 0 ? 'text-foreground' : 'text-red-500'
                }`}>
                  ${Math.abs(acc.saldo).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Recent Transactions */}
      <motion.section variants={itemVariants} className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full" />
            <h2 className="text-2xl font-black italic tracking-tight">Actividad Reciente</h2>
          </div>
          <button 
            onClick={() => router.push('/transacciones')}
            className="text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
          >
            Ver todo →
          </button>
        </div>
        
        <div className="space-y-4">
          {transactions.length === 0 ? (
            <motion.div 
              className="glass rounded-[2rem] p-12 flex flex-col items-center justify-center text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="w-20 h-20 rounded-full bg-foreground/5 flex items-center justify-center mb-4">
                <Receipt size={32} className="opacity-20" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-30">Sin transacciones aún</p>
              <p className="text-[10px] opacity-20 mt-1">Comienza agregando tu primer gasto</p>
            </motion.div>
          ) : (
            transactions.map((tx, index) => (
              <motion.div 
                key={tx.id} 
                className="group relative bg-white dark:bg-gray-900 rounded-[1.5rem] p-5 shadow-lg border border-gray-100 dark:border-gray-800 flex items-center justify-between cursor-pointer overflow-hidden"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                whileHover={{ x: 8, scale: 1.01 }}
              >
                {/* Left accent */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  tx.tipo === 'ingreso' ? 'bg-gradient-to-b from-green-400 to-emerald-500' :
                  tx.tipo === 'transferencia' ? 'bg-gradient-to-b from-indigo-400 to-purple-500' :
                  'bg-gradient-to-b from-red-400 to-rose-500'
                }`} />
                
                <div className="flex items-center gap-4 pl-3">
                  <motion.div 
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                      tx.tipo === 'ingreso' ? 'bg-gradient-to-br from-green-400 to-emerald-500' :
                      tx.tipo === 'transferencia' ? 'bg-gradient-to-br from-indigo-400 to-purple-500' :
                      'bg-gradient-to-br from-red-400 to-rose-500'
                    }`}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                  >
                    {tx.tipo === 'ingreso' ? <TrendingUp size={24} className="text-white" /> : 
                     tx.tipo === 'transferencia' ? <ArrowRightLeft size={24} className="text-white" /> : 
                     <TrendingDown size={24} className="text-white" />}
                  </motion.div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black p-1.5 px-3 rounded-xl bg-gray-100 dark:bg-gray-800 opacity-60 uppercase tracking-tighter">{tx.categoria}</span>
                      <span className="text-[9px] opacity-30 font-bold uppercase">{tx.fuente}</span>
                    </div>
                    <h4 className="font-black italic uppercase text-base tracking-tight leading-tight">{tx.descripcion || tx.categoria}</h4>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <p className={`text-2xl font-black italic tracking-tighter ${
                    tx.tipo === 'ingreso' ? 'text-green-500' : 'text-foreground'
                  }`}>
                    {tx.tipo === 'ingreso' ? '+' : '-'}${tx.monto.toFixed(2)}
                  </p>
                  <motion.button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteTx(tx); }}
                    className="p-3 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-all rounded-xl"
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.8 }}
                  >
                    <Trash2 size={18} />
                  </motion.button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.section>

      <AddTransactionModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      <TransferModal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} />
    </motion.div>
  );
}
