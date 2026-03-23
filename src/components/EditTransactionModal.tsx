'use client';

import { useState, useEffect } from "react";
import { useAccounts, useUserConfig } from "@/hooks/useFirestore";
import { db, auth } from "@/lib/firebase";
import { updateDoc, doc, increment } from "firebase/firestore";
import { X } from "lucide-react";
import { Transaction } from "@/hooks/useFirestore";
import { DEFAULT_CATEGORIES } from "@/lib/defaults";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction;
}

export default function EditTransactionModal({ isOpen, onClose, transaction }: Props) {
  const { accounts } = useAccounts();
  const { config } = useUserConfig();
  const [amount, setAmount] = useState(transaction.monto.toString());
  const [description, setDescription] = useState(transaction.descripcion || "");
  const [category, setCategory] = useState(transaction.categoria);
  const [accountId, setAccountId] = useState(transaction.accountId || "");
  const [loading, setLoading] = useState(false);

  const expenseCategories = (config?.expenseCategories?.length ? config.expenseCategories : DEFAULT_CATEGORIES).sort((a, b) => a.localeCompare(b, 'es'));
  const incomeCategories = (config?.incomeCategories?.length ? config.incomeCategories : ["Salario", "Inversion", "Regalo", "Otro"]).sort((a, b) => a.localeCompare(b, 'es'));
  const categories = transaction.tipo === "gasto" ? expenseCategories : incomeCategories;

  useEffect(() => {
    setAmount(transaction.monto.toString());
    setDescription(transaction.descripcion || "");
    setCategory(transaction.categoria);
    setAccountId(transaction.accountId || "");
  }, [transaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      const newMonto = parseFloat(amount);
      const oldMonto = transaction.monto;
      const diff = newMonto - oldMonto;
      
      const updates: Record<string, unknown> = {
        monto: newMonto,
        descripcion: description,
        categoria: category,
      };
      
      if (accountId !== transaction.accountId) {
        updates.accountId = accountId;
      }

      await updateDoc(doc(db, "transactions", transaction.id), updates);

      if (accountId && diff !== 0) {
        const mult = transaction.tipo === 'ingreso' ? 1 : -1;
        if (transaction.accountId) {
          await updateDoc(doc(db, "accounts", transaction.accountId), { saldo: increment(-mult * oldMonto) });
        }
        await updateDoc(doc(db, "accounts", accountId), { saldo: increment(mult * newMonto) });
      } else if (accountId && diff !== 0) {
        const mult = transaction.tipo === 'ingreso' ? 1 : -1;
        await updateDoc(doc(db, "accounts", accountId), { saldo: increment(mult * diff) });
      }

      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="glass w-full max-w-md rounded-[2rem] p-8 space-y-6 shadow-2xl animate-in fade-in slide-in-from-bottom-10 border-white/5">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Editar Transacción</h2>
          <button onClick={onClose} className="p-2 hover:bg-foreground/5 rounded-full"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-xs font-semibold opacity-40 uppercase tracking-wider">Monto</label>
            <input 
              type="number" 
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-700 border-none p-4 rounded-xl text-lg font-bold mt-1"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold opacity-40 uppercase tracking-wider">Descripción</label>
            <input 
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-700 border-none p-4 rounded-xl text-sm mt-1"
              placeholder="Descripción..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold opacity-40 uppercase tracking-wider">Categoría</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-700 border-none p-4 rounded-xl text-sm mt-1"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold opacity-40 uppercase tracking-wider">Cuenta</label>
              <select 
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-700 border-none p-4 rounded-xl text-sm mt-1"
              >
                <option value="">Seleccionar...</option>
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.nombre}</option>)}
              </select>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl font-bold text-sm bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            {loading ? "Guardando..." : "Guardar Cambios"}
          </button>
        </form>
      </div>
    </div>
  );
}
