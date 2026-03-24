'use client';

import { useState } from "react";
import { useAccounts } from "@/hooks/useFirestore";
import { db, auth } from "@/lib/firebase";
import { collection, serverTimestamp, doc, increment, writeBatch } from "firebase/firestore";
import { X, ArrowRight, Loader2 } from "lucide-react";

export default function TransferModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { accounts } = useAccounts();
  const [amount, setAmount] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert("Sesión expirada. Por favor, recarga la página.");
      return;
    }
    if (!amount || !fromId || !toId || fromId === toId) return;

    setLoading(true);
    try {
      const monto = parseFloat(amount);
      const batch = writeBatch(db);

      const fromAccount = accounts.find(a => a.id === fromId);
      const toAccount = accounts.find(a => a.id === toId);

      const txRef = doc(collection(db, "transactions"));
      batch.set(txRef, {
        userId: auth.currentUser.uid,
        monto,
        tipo: "transferencia",
        fromId,
        toId,
        fromNombre: fromAccount?.nombre,
        toNombre: toAccount?.nombre,
        descripcion: `Transferencia: ${fromAccount?.nombre} → ${toAccount?.nombre}`,
        categoria: "Transferencia",
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        fuente: "web"
      });

      const fromRef = doc(db, "accounts", fromId);
      batch.update(fromRef, { saldo: increment(-monto) });

      const toRef = doc(db, "accounts", toId);
      batch.update(toRef, { saldo: increment(monto) });

      await batch.commit();
      setAmount("");
      setFromId("");
      setToId("");
      onClose();
    } catch (error) {
      console.error(error);
      alert("Error al procesar la transferencia");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold">Transferencia</h2>
            <p className="text-xs text-gray-400">Entre tus cuentas</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">$</span>
            <input 
              type="number" 
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-3xl font-bold p-4 pl-10 rounded-xl text-center focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              required
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase">Desde</label>
              <select 
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Seleccionar...</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.nombre}</option>
                ))}
              </select>
            </div>
            
            <ArrowRight className="mt-6 text-gray-300" size={20} />
            
            <div className="flex-1 space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase">Hacia</label>
              <select 
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Seleccionar...</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading || !amount || !fromId || !toId || fromId === toId}
            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Procesando...
              </>
            ) : (
              "Transferir"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
