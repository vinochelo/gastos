'use client';

import { useState } from "react";
import { motion, Variants } from "framer-motion";
import { useAccounts, useRecentTransactions, Transaction } from "@/hooks/useFirestore";
import { Plus, ArrowRightLeft, TrendingDown, TrendingUp, User, LogOut, Trash2, Wallet, Sparkles } from "lucide-react";
import AddTransactionModal from "@/components/AddTransactionModal";
import TransferModal from "@/components/TransferModal";
import CategoryChart from "@/components/CategoryChart";
import MonthlySummary from "@/components/MonthlySummary";
import { auth, db } from "@/lib/firebase";
import { deleteDoc, doc, updateDoc, increment } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
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
        await updateDoc(doc(db, "accounts", tx.accountId), {
          saldo: increment(mult * tx.monto)
        });
      } else if (tx.tipo === 'transferencia' && tx.fromId && tx.toId) {
        await updateDoc(doc(db, "accounts", tx.fromId), { saldo: increment(tx.monto) });
        await updateDoc(doc(db, "accounts", tx.toId), { saldo: increment(-tx.monto) });
      }
      await deleteDoc(doc(db, "transactions", tx.id));
    } catch {
      alert("Error al eliminar.");
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-12 pb-28"
    >
      {/* Header */}
      <motion.header 
        variants={itemVariants}
        className="flex justify-between items-center py-6"
      >
        <div className="space-y-2">
          <motion.h1 
            className="text-5xl font-black italic tracking-tighter bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent"
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            SISTEMA CONTROL
          </motion.h1>
          <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.4em]">Ecosistema Financiero v2.5</p>
        </div>
        <div className="relative">
          <motion.button 
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="w-14 h-14 glass rounded-3xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-primary shadow-2xl relative group overflow-hidden"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="absolute inset-0 bg-primary/10 group-hover:bg-primary/20 transition-all" />
            <User size={28} className="relative z-10" />
          </motion.button>
          
          {isUserMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              className="absolute right-0 top-16 w-56 glass border-white/5 rounded-[2rem] p-4 shadow-2xl z-[150]"
            >
              <p className="text-[10px] font-black opacity-30 px-4 mb-2 uppercase italic tracking-widest">Cuenta Actual</p>
              <div className="p-4 rounded-2xl bg-foreground/5 mb-3">
                <p className="text-xs font-black italic">{auth.currentUser?.email}</p>
              </div>
              <button 
                onClick={() => logout()}
                className="w-full flex items-center justify-between p-4 rounded-[1.5rem] bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all group"
              >
                <span className="font-black italic text-xs">CERRAR SESIÓN</span>
                <LogOut size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          )}
        </div>
      </motion.header>

      {/* Resumen Mensual */}
      <motion.div variants={itemVariants}>
        <MonthlySummary />
      </motion.div>

      {/* Gráfico */}
      <motion.div variants={itemVariants}>
        <CategoryChart />
      </motion.div>

      {/* Cuentas */}
      <motion.section variants={itemVariants} className="space-y-6">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-xl font-black italic uppercase tracking-tight flex items-center gap-3">
             <motion.div 
               className="w-2 h-6 bg-gradient-to-b from-primary to-purple-500 rounded-full"
               animate={{ scaleY: [1, 1.2, 1] }}
               transition={{ duration: 2, repeat: Infinity }}
             />
             Tus Cuentas
           </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((acc, index) => (
            <motion.div
              key={acc.id}
              variants={itemVariants}
              custom={index}
              whileHover={{ scale: 1.03, y: -8, transition: { duration: 0.3 } }}
              className="glass group relative overflow-hidden p-8 rounded-[3rem] shadow-2xl border-white/5 bg-gradient-to-br from-transparent to-primary/5 cursor-pointer"
            >
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/5 blur-3xl rounded-full group-hover:bg-primary/15 transition-all animate-pulse" />
              <div className="space-y-2 relative">
                <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em] italic">{acc.tipo}</p>
                <h3 className="text-2xl font-black italic tracking-tighter uppercase">{acc.nombre}</h3>
                <p className="text-4xl font-black italic tracking-tighter bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent group-hover:drop-shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all">
                  ${acc.saldo.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <motion.div 
                className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                whileHover={{ rotate: 180 }}
              >
                <Wallet size={16} className="text-primary" />
              </motion.div>
            </motion.div>
          ))}
          <motion.button 
            onClick={() => setIsTransferModalOpen(true)}
            className="group flex flex-col items-center justify-center p-8 border-2 border-dashed border-primary/20 rounded-[3rem] hover:border-primary/40 hover:bg-primary/5 transition-all space-y-4"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <motion.div 
              className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary"
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.7, ease: "easeInOut" }}
            >
               <ArrowRightLeft size={32} />
            </motion.div>
            <span className="font-black italic text-xs opacity-40 uppercase tracking-widest">Realizar Transferencia</span>
          </motion.button>
        </div>
      </motion.section>

      {/* Acciones Rápidas */}
      <motion.div 
        className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 z-50"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <motion.button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gradient-to-r from-primary to-purple-600 text-white p-6 px-12 rounded-[2.5rem] shadow-[0_20px_50px_rgba(139,92,246,0.4)] flex items-center gap-4 hover:scale-110 active:scale-95 transition-all border border-white/20 group relative overflow-hidden"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-all" />
          <motion.div 
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
            animate={{ rotate: 0 }}
            whileHover={{ rotate: 90 }}
          >
             <Plus size={20} className="text-white" />
          </motion.div>
          <span className="font-black italic uppercase tracking-tighter text-lg relative z-10">REGISTRAR</span>
          <Sparkles size={20} className="opacity-50" />
        </motion.button>
      </motion.div>

      {/* Actividad Reciente */}
      <motion.section variants={itemVariants} className="space-y-6">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-xl font-black italic uppercase tracking-tight flex items-center gap-3">
             <motion.div 
               className="w-2 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"
               animate={{ scaleY: [1, 1.2, 1] }}
               transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
             />
             Actividad Reciente
           </h2>
        </div>
        <div className="space-y-4">
          {transactions.map((tx, index) => (
            <motion.div 
              key={tx.id} 
              className="glass p-6 rounded-3xl flex items-center justify-between border-white/5 hover:translate-x-4 transition-all cursor-pointer group"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ x: 8 }}
            >
              <div className="flex items-center gap-5">
                <motion.div 
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                    tx.tipo === 'ingreso' ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white' : 
                    tx.tipo === 'transferencia' ? 'bg-gradient-to-br from-indigo-400 to-purple-500 text-white' : 
                    'bg-gradient-to-br from-red-400 to-rose-500 text-white'
                  }`}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  {tx.tipo === 'ingreso' ? <TrendingUp size={24} /> : 
                   tx.tipo === 'transferencia' ? <ArrowRightLeft size={24} /> : 
                   <TrendingDown size={24} />}
                </motion.div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black p-1 px-2 rounded-lg bg-foreground/5 opacity-40 uppercase tracking-tighter italic">{tx.categoria}</span>
                    <span className="text-[10px] opacity-20 font-black italic">{tx.fuente}</span>
                  </div>
                  <h4 className="font-black italic uppercase text-lg tracking-tight leading-tight">{tx.descripcion || tx.categoria}</h4>
                </div>
              </div>
              <div className="text-right flex items-center gap-4">
                <div>
                  <p className={`text-2xl font-black italic tracking-tighter ${
                    tx.tipo === 'ingreso' ? 'text-green-500' : 'text-foreground'
                  }`}>
                    {tx.tipo === 'ingreso' ? '+' : '-'}${tx.monto.toFixed(2)}
                  </p>
                </div>
                <motion.button 
                  onClick={() => handleDeleteTx(tx)}
                  className="p-3 opacity-10 hover:opacity-100 hover:text-red-500 transition-all hover:bg-red-500/5 rounded-xl"
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.8 }}
                >
                  <Trash2 size={18} />
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <AddTransactionModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      <TransferModal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} />
    </motion.div>
  );
}
