'use client';

import { useRecentTransactions, Transaction } from "@/hooks/useFirestore";
import { TrendingDown, TrendingUp, Calendar, Filter, Trash2, ArrowRightLeft } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, deleteDoc, updateDoc, increment } from "firebase/firestore";

export default function TransaccionesPage() {
  const { transactions, loading } = useRecentTransactions(100);

  const handleDeleteTx = async (tx: Transaction) => {
    if (!confirm("¿Seguro que quieres eliminar esta transacción? Se revertirá el saldo.")) return;
    try {
      if (tx.tipo === "transferencia" && tx.fromId && tx.toId) {
        const fromRef = doc(db, "accounts", tx.fromId);
        const toRef = doc(db, "accounts", tx.toId);
        await updateDoc(fromRef, { saldo: increment(tx.monto) });
        await updateDoc(toRef, { saldo: increment(-tx.monto) });
      } else if (tx.accountId) {
        const accRef = doc(db, "accounts", tx.accountId);
        const mult = tx.tipo === "ingreso" ? -1 : 1;
        await updateDoc(accRef, { saldo: increment(mult * tx.monto) });
      }
      await deleteDoc(doc(db, "transactions", tx.id));
    } catch (e) {
      console.error(e);
      alert("Error al eliminar");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <header className="flex justify-between items-end py-4">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter">MOVIMIENTOS</h1>
          <p className="text-foreground/40 font-bold uppercase text-[10px] tracking-widest italic">Historial Completo de Actividad</p>
        </div>
        <button className="glass p-4 rounded-[1.5rem] hover:scale-105 transition-all text-primary border-white/10 shadow-lg">
          <Filter size={24} />
        </button>
      </header>

      <div className="space-y-4">
        {transactions.map((tx) => (
          <div key={tx.id} className="glass p-6 rounded-[2.5rem] flex items-center justify-between shadow-sm hover:shadow-xl transition-all border-white/5 relative group overflow-hidden">
            {/* Type indicator side bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-2 ${
                  tx.tipo === 'gasto' ? 'bg-red-500/50' : 
                  tx.tipo === 'ingreso' ? 'bg-green-500/50' : 
                  'bg-indigo-500/50'
                }`} />

            <div className="flex items-center gap-5 z-10">
              <div className={`p-4 rounded-3xl ${
                tx.tipo === 'gasto' ? 'bg-red-500/10 text-red-500 shadow-red-500/5' : 
                tx.tipo === 'ingreso' ? 'bg-green-500/10 text-green-500 shadow-green-500/5' : 
                'bg-indigo-500/10 text-indigo-500 shadow-indigo-500/5'
              }`}>
                {tx.tipo === 'gasto' ? <TrendingDown size={28} /> : 
                 tx.tipo === 'ingreso' ? <TrendingUp size={28} /> : 
                 <ArrowRightLeft size={28} />}
              </div>
              <div className="space-y-1">
                <p className="font-black text-xl italic uppercase tracking-tighter leading-none">{tx.descripcion || tx.categoria}</p>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-30 italic">
                  <span>{tx.categoria}</span>
                  <span className="opacity-50">•</span>
                  <div className="flex items-center gap-1">
                    <Calendar size={12} className="opacity-50" />
                    {(() => {
                      const ts = tx.timestamp;
                      const date = 'toDate' in ts ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
                      return date.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 z-10">
               <div className="text-right space-y-1">
                 <p className={`text-2xl font-black italic tracking-tighter ${
                   tx.tipo === 'gasto' ? 'text-red-500' : 
                   tx.tipo === 'ingreso' ? 'text-green-500' : 
                   'text-indigo-500'
                 }`}>
                   {tx.tipo === 'gasto' ? '-' : tx.tipo === 'ingreso' ? '+' : ''}${tx.monto.toLocaleString('es-EC', { minimumFractionDigits: 2 })}
                 </p>
                 <p className="text-[10px] uppercase font-black tracking-widest opacity-20 italic">vía {tx.fuente}</p>
               </div>
               
               <button 
                 onClick={() => handleDeleteTx(tx)}
                 className="p-3 text-red-500/20 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all"
               >
                 <Trash2 size={24} />
               </button>
            </div>
          </div>
        ))}

        {transactions.length === 0 && !loading && (
          <div className="py-24 text-center space-y-4 glass rounded-[3rem] border-dashed border-2 opacity-20">
             <TrendingDown size={64} className="mx-auto" />
             <div className="space-y-1">
               <p className="text-2xl font-black italic tracking-tighter uppercase">Sin movimientos</p>
               <p className="font-bold text-xs uppercase tracking-[0.3em]">Nada que mostrar por ahora</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
