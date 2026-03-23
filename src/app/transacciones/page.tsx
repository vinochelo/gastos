'use client';

import { useState } from "react";
import { useRecentTransactions, Transaction } from "@/hooks/useFirestore";
import { Search, Trash2, Plus, Minus, Repeat, Settings, ShoppingBag, Utensils, Car, Home, Heart, Film, Gift, Smartphone, Plane, Coffee, Building } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, deleteDoc, updateDoc, increment } from "firebase/firestore";
import { useRouter } from "next/navigation";
import EditTransactionModal from "@/components/EditTransactionModal";

const CATEGORY_ICONS: Record<string, typeof ShoppingBag> = {
  'Comida': Utensils,
  'Transporte': Car,
  'Casa': Home,
  'Salud': Heart,
  'Cine': Film,
  'Regalos': Gift,
  'Tecnología': Smartphone,
  'Viajes': Plane,
  'Restaurantes': Coffee,
  'Compras Ecommerce': ShoppingBag,
  'Deportes': Plus,
  'Entretenimiento': Film,
  'Streaming': Smartphone,
  'Taxi/Uber': Car,
  'default': ShoppingBag,
};

function getCategoryIcon(categoria?: string) {
  if (!categoria) return ShoppingBag;
  const catLower = categoria.toLowerCase();
  for (const [key, Icon] of Object.entries(CATEGORY_ICONS)) {
    if (catLower.includes(key.toLowerCase())) return Icon;
  }
  return ShoppingBag;
}

export default function TransaccionesPage() {
  const { transactions, loading } = useRecentTransactions(100);
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
      if (tx.accountId) {
        const mult = tx.tipo === 'ingreso' ? -1 : 1;
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
          <h1 className="text-2xl font-bold tracking-tight">Transacciones</h1>
        </div>
        <button 
          onClick={() => router.push('/ajustes')}
          className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
        >
          <Settings size={16} className="opacity-50" />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" />
        <input 
          type="text"
          placeholder="Buscar por descripción, categoría o monto..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 pl-10 rounded-xl text-sm"
        />
      </div>

      {/* Transactions */}
      <div className="space-y-2">
        {filteredTransactions.map((tx) => {
          const Icon = getCategoryIcon(tx.categoria);
          return (
            <div key={tx.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between border border-gray-100 dark:border-gray-700 group">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  tx.tipo === 'ingreso' ? 'bg-green-100 dark:bg-green-900/30' : 
                  tx.tipo === 'transferencia' ? 'bg-blue-100 dark:bg-blue-900/30' :
                  'bg-purple-100 dark:bg-purple-900/30'
                }`}>
                  {tx.tipo === 'ingreso' ? (
                    <Plus size={18} className="text-green-600" />
                  ) : tx.tipo === 'transferencia' ? (
                    <Repeat size={18} className="text-blue-600" />
                  ) : (
                    <Icon size={18} className="text-purple-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{tx.descripcion || tx.categoria}</p>
                  <p className="text-xs opacity-40">{tx.categoria}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className={`text-sm font-bold ${tx.tipo === 'ingreso' ? 'text-green-600' : ''}`}>
                  {tx.tipo === 'ingreso' ? '+' : '-'}${tx.monto.toFixed(2)}
                </p>
                <button 
                  onClick={() => setEditingTx(tx)}
                  className="p-1.5 opacity-60 hover:opacity-100 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg"
                >
                  <Settings size={14} className="text-blue-500" />
                </button>
                <button 
                  onClick={() => handleDeleteTx(tx)}
                  className="p-1.5 opacity-60 hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                >
                  <Trash2 size={14} className="text-red-500" />
                </button>
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
