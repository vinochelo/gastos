'use client';

import { useState } from "react";
import { useRecentTransactions, Transaction, useUserConfig } from "@/hooks/useFirestore";
import { Search, Trash2, Plus, Minus, Repeat, Settings } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, deleteDoc, updateDoc, increment } from "firebase/firestore";
import { useRouter } from "next/navigation";
import EditTransactionModal from "@/components/EditTransactionModal";
import { getCategoryIconPath } from "@/lib/categoryIcons";

export default function TransaccionesPage() {
  const { transactions, loading } = useRecentTransactions(100);
  const { config } = useUserConfig();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const router = useRouter();

  const filteredTransactions = transactions.filter(tx => {
    const query = searchQuery.toLowerCase();
    return (
      tx.descripcion?.toLowerCase().includes(query) ||
      tx.categoria?.toLowerCase().includes(query) ||
      tx.monto.toString().includes(query)
    );
  });

  const handleDeleteTx = async (tx: Transaction) => {
    if (!confirm("¿Eliminar?")) return;
    try {
      if (tx.tipo === 'transferencia') {
        if (tx.fromId) {
          await updateDoc(doc(db, "accounts", tx.fromId), { saldo: increment(tx.monto) });
        }
        if (tx.toId) {
          await updateDoc(doc(db, "accounts", tx.toId), { saldo: increment(-tx.monto) });
        }
      } else if (tx.accountId) {
        const mult = tx.tipo === 'ingreso' ? -1 : 1;
        await updateDoc(doc(db, "accounts", tx.accountId), { saldo: increment(mult * tx.monto) });
      }
      await deleteDoc(doc(db, "transactions", tx.id));
    } catch { alert("Error al eliminar"); }
  };

  return (
    <div className="space-y-6 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500/80 dark:text-indigo-400">Historial Financiero</p>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Transacciones</h1>
        </div>
        <button 
          onClick={() => router.push('/ajustes')}
          title="Ajustes"
          className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-border flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 cursor-pointer shadow-sm text-foreground/75"
        >
          <Settings size={18} className="opacity-80" />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 text-foreground" />
        <input 
          type="text"
          placeholder="Buscar por descripción, categoría o monto..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white dark:bg-gray-800 border border-border/80 p-3.5 pl-11 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all shadow-sm text-foreground placeholder-foreground/30 font-medium"
        />
      </div>

      {/* Transactions */}
      <div className="space-y-2.5">
        {filteredTransactions.map((tx) => {
          const iconPath = getCategoryIconPath(tx.categoria, config?.categoryIcons);
          return (
            <div key={tx.id} className="glass rounded-2xl p-4 flex items-center justify-between border border-border shadow-sm hover:bg-white dark:hover:bg-gray-800/80 transition-all duration-300 group glass-glow">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  tx.tipo === 'ingreso' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 
                  tx.tipo === 'transferencia' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' :
                  'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}>
                  {tx.tipo === 'transferencia' ? (
                    <Repeat size={18} />
                  ) : (
                    <img 
                      src={iconPath} 
                      alt={tx.categoria || "Categoría"} 
                      className="w-7 h-7 object-contain rounded-lg" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/categories/cat_otro.png";
                      }}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate text-foreground">{tx.descripcion || tx.categoria}</p>
                  <p className="text-[10px] font-semibold text-foreground/35 uppercase tracking-wider mt-0.5">{tx.categoria}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className={`text-sm font-black ${
                  tx.tipo === 'ingreso' ? 'text-emerald-500' : 
                  tx.tipo === 'transferencia' ? 'text-indigo-500 dark:text-indigo-400' : 'text-foreground'
                }`}>
                  {tx.tipo === 'ingreso' ? '+' : '-'}${tx.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </p>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-250">
                  <button 
                    onClick={() => setEditingTx(tx)}
                    title="Editar"
                    className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg text-indigo-500 transition-colors cursor-pointer"
                  >
                    <Settings size={14} />
                  </button>
                  <button 
                    onClick={() => handleDeleteTx(tx)}
                    title="Eliminar"
                    className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-rose-500 transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredTransactions.length === 0 && !loading && (
          <div className="py-16 text-center">
            <p className="text-sm opacity-40">No hay transacciones</p>
          </div>
        )}
      </div>

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
