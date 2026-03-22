'use client';

import { useState } from "react";
import { useAccounts, useRecentTransactions, Transaction } from "@/hooks/useFirestore";
import { Plus, ArrowRightLeft, TrendingDown, TrendingUp, User, LogOut, Trash2 } from "lucide-react";
import AddTransactionModal from "@/components/AddTransactionModal";
import TransferModal from "@/components/TransferModal";
import CategoryChart from "@/components/CategoryChart";
import MonthlySummary from "@/components/MonthlySummary";
import { auth, db } from "@/lib/firebase";
import { deleteDoc, doc, updateDoc, increment } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { accounts } = useAccounts();
  const { transactions } = useRecentTransactions(10);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  if (loading) return <div className="flex h-screen items-center justify-center font-bold italic opacity-30">Cargando...</div>;
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
    <div className="space-y-10 pb-24">
      {/* Header & User Menu */}
      <header className="flex justify-between items-center py-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black italic tracking-tighter">SISTEMA CONTROL</h1>
          <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.4em]">Ecosistema Financiero v2.5</p>
        </div>
        <div className="relative">
          <button 
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="w-14 h-14 glass rounded-3xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-primary shadow-2xl relative group overflow-hidden"
          >
            <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/20 transition-all"></div>
            <User size={28} className="relative z-10" />
          </button>
          
          {isUserMenuOpen && (
            <div className="absolute right-0 top-16 w-56 glass border-white/5 rounded-[2rem] p-4 shadow-2xl animate-in fade-in zoom-in z-[150]">
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
            </div>
          )}
        </div>
      </header>

      {/* Resumen Mensual (Traslado de Saldo) */}
      <MonthlySummary />

      {/* Gráfico de Distribución */}
      <CategoryChart />

      {/* Cuentas & Balances */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-xl font-black italic uppercase tracking-tight flex items-center gap-3">
             <div className="w-2 h-6 bg-primary rounded-full" />
             Tus Cuentas
           </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((acc) => (
            <div key={acc.id} className="glass group relative overflow-hidden p-8 rounded-[3rem] shadow-2xl hover:scale-[1.02] transition-all border-white/5 bg-gradient-to-br from-transparent to-primary/5">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/5 blur-3xl rounded-full group-hover:bg-primary/10 transition-all" />
              <div className="space-y-1 relative">
                <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em] italic">{acc.tipo}</p>
                <h3 className="text-2xl font-black italic tracking-tighter uppercase">{acc.nombre}</h3>
                <p className="text-4xl font-black italic tracking-tighter text-primary group-hover:drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all">
                  ${acc.saldo.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          ))}
          <button 
            onClick={() => setIsTransferModalOpen(true)}
            className="group flex flex-col items-center justify-center p-8 border-2 border-dashed border-primary/20 rounded-[3rem] hover:border-primary/40 hover:bg-primary/5 transition-all space-y-4"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:rotate-180 transition-transform duration-700">
               <ArrowRightLeft size={32} />
            </div>
            <span className="font-black italic text-xs opacity-40 uppercase tracking-widest">Realizar Transferencia</span>
          </button>
        </div>
      </section>

      {/* Acciones Rápidas Flotantes (Más Pro) */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 z-50">
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-black text-white p-6 px-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-4 hover:scale-110 active:scale-95 transition-all border border-white/10 group"
        >
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center group-hover:rotate-90 transition-transform">
             <Plus size={20} className="text-white" />
          </div>
          <span className="font-black italic uppercase tracking-tighter text-lg">REGISTRAR</span>
        </button>
      </div>

      {/* Actividad Reciente */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-xl font-black italic uppercase tracking-tight flex items-center gap-3">
             <div className="w-2 h-6 bg-indigo-500 rounded-full" />
             Actividad Reciente
           </h2>
        </div>
        <div className="space-y-4">
          {transactions.map((tx) => (
            <div key={tx.id} className="glass p-6 rounded-3xl flex items-center justify-between border-white/5 hover:translate-x-2 transition-transform duration-300">
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                  tx.tipo === 'ingreso' ? 'bg-green-500/10 text-green-500 shadow-green-500/20' : 
                  tx.tipo === 'transferencia' ? 'bg-indigo-500/10 text-indigo-500 shadow-indigo-500/20' : 
                  'bg-red-500/10 text-red-500 shadow-red-500/20'
                }`}>
                  {tx.tipo === 'ingreso' ? <TrendingUp size={24} /> : 
                   tx.tipo === 'transferencia' ? <ArrowRightLeft size={24} /> : 
                   <TrendingDown size={24} />}
                </div>
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
                <button 
                  onClick={() => handleDeleteTx(tx)}
                  className="p-3 opacity-10 hover:opacity-100 hover:text-red-500 transition-all hover:bg-red-500/5 rounded-xl"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <AddTransactionModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      <TransferModal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} />
    </div>
  );
}
