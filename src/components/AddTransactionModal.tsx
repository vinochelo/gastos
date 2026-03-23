'use client';

import { useState, useEffect } from "react";
import { useAccounts, useUserConfig } from "@/hooks/useFirestore";
import { db, auth } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { X, ChevronDown, TrendingUp, TrendingDown, Tag } from "lucide-react";
import { DEFAULT_CATEGORIES } from "@/lib/defaults";

export default function AddTransactionModal({ isOpen, onClose, defaultType = "gasto" }: { isOpen: boolean, onClose: () => void, defaultType?: "gasto" | "ingreso" }) {
  const { accounts } = useAccounts();
  const { config } = useUserConfig();
  const [type, setType] = useState<"gasto" | "ingreso">(defaultType);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(false);

  const expenseCategories = (config?.expenseCategories?.length ? config.expenseCategories : DEFAULT_CATEGORIES).sort((a, b) => a.localeCompare(b, 'es'));
  const incomeCategories = (config?.incomeCategories?.length ? config.incomeCategories : ["Salario", "Inversion", "Regalo", "Otro"]).sort((a, b) => a.localeCompare(b, 'es'));
  const categories = type === "gasto" ? expenseCategories : incomeCategories;

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setDescription("");
      setType(defaultType);
      setAccountId("");
    }
  }, [isOpen, defaultType]);

  useEffect(() => {
    if (categories.length > 0 && !category) {
      setCategory(categories[0]);
    }
  }, [categories, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !amount || !accountId) return;

    setLoading(true);
    try {
      const monto = parseFloat(amount);
      const mult = type === "ingreso" ? 1 : -1;
      
      await addDoc(collection(db, "transactions"), {
        userId: auth.currentUser.uid,
        monto,
        descripcion: description || category,
        categoria: category,
        accountId,
        tipo: type,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        fuente: "web"
      });

      const accountRef = doc(db, "accounts", accountId);
      await updateDoc(accountRef, {
        saldo: increment(mult * monto)
      });

      setAmount("");
      setDescription("");
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
      <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-2xl gap-1">
            <button 
              onClick={() => setType("gasto")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${type === 'gasto' ? 'bg-red-500 text-white' : 'text-gray-500'}`}
            >
              <TrendingDown size={14} /> Gasto
            </button>
            <button 
              onClick={() => setType("ingreso")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${type === 'ingreso' ? 'bg-green-500 text-white' : 'text-gray-500'}`}
            >
              <TrendingUp size={14} /> Ingreso
            </button>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-bold ${type === 'gasto' ? 'text-red-400' : 'text-green-400'}`}>$</span>
            <input 
              type="number" 
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`w-full bg-gray-50 dark:bg-gray-900 border-none text-4xl font-bold p-6 pl-12 rounded-2xl text-center ${type === 'gasto' ? 'text-red-500' : 'text-green-500'}`}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1 flex items-center gap-1">
              <Tag size={10} /> Detalle (ej: viaje a la iglesia)
            </label>
            <input 
              type="text"
              placeholder="Describe el gasto..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-900 border-none p-4 rounded-xl text-sm font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Categoría</label>
              <div className="relative">
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border-none p-4 rounded-xl text-sm font-medium appearance-none cursor-pointer"
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" size={16} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Cuenta</label>
              <div className="relative">
                <select 
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border-none p-4 rounded-xl text-sm font-medium appearance-none cursor-pointer"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.nombre}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" size={16} />
              </div>
            </div>
          </div>

          <button 
            disabled={loading || !amount || !accountId}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all disabled:opacity-50 ${type === 'gasto' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </div>
    </div>
  );
}
