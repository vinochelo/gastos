'use client';

import { useState } from "react";
import { useAccounts } from "@/hooks/useFirestore";
import { db, auth } from "@/lib/firebase";
import { collection, serverTimestamp, doc, increment, writeBatch } from "firebase/firestore";
import { X, ArrowRight } from "lucide-react";

export default function TransferModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { accounts } = useAccounts();
  const [amount, setAmount] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !amount || !fromId || !toId || fromId === toId) return;

    setLoading(true);
    try {
      const monto = parseFloat(amount);
      const batch = writeBatch(db);

      const fromAccount = accounts.find(a => a.id === fromId);
      const toAccount = accounts.find(a => a.id === toId);

      // 1. Crear transacción de transferencia
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

      // 2. Descontar de la cuenta origen
      const fromRef = doc(db, "accounts", fromId);
      batch.update(fromRef, { saldo: increment(-monto) });

      // 3. Sumar a la cuenta destino
      const toRef = doc(db, "accounts", toId);
      batch.update(toRef, { saldo: increment(monto) });

      await batch.commit();
      setAmount("");
      onClose();
    } catch (error) {
      console.error(error);
      alert("❌ Error al procesar la transferencia: " + (error instanceof Error ? error.message : "Desconocido"));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="glass w-full max-w-md rounded-[2.5rem] p-8 space-y-6 shadow-2xl animate-in fade-in slide-in-from-bottom-10 border-indigo-500/20">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <h2 className="text-2xl font-black italic text-indigo-500">TRANSFERENCIA</h2>
            <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest">Entre tus cuentas</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-foreground/5 rounded-full"><X /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-4xl font-black text-indigo-500/20">$</span>
            <input 
              type="number" 
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-indigo-500/5 border-none text-5xl font-black p-8 px-12 rounded-3xl focus:ring-2 ring-indigo-500/50 transition-all text-center"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest px-2 opacity-40">Origen</label>
              <select 
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="w-full glass border-none p-4 rounded-2xl text-sm font-medium focus:ring-2 ring-indigo-500 appearance-none bg-indigo-500/5"
                required
              >
                <option value="">Seleccionar...</option>
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.nombre}</option>)}
              </select>
            </div>
            <ArrowRight className="mt-6 opacity-20 text-indigo-500" size={20} />
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest px-2 opacity-40">Destino</label>
              <select 
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="w-full glass border-none p-4 rounded-2xl text-sm font-medium focus:ring-2 ring-indigo-500 appearance-none bg-indigo-500/5"
                required
              >
                <option value="">Seleccionar...</option>
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.nombre}</option>)}
              </select>
            </div>
          </div>

          <button 
            disabled={loading}
            className="w-full bg-indigo-500 text-white py-5 rounded-3xl font-black text-xl shadow-xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all shadow-indigo-500/20"
          >
            {loading ? "TRANSFERIENDO..." : "EJECUTAR TRANSFERENCIA"}
          </button>
        </form>
      </div>
    </div>
  );
}
