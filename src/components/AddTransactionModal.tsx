'use client';

import { useState, useEffect } from "react";
import { useAccounts, useUserConfig } from "@/hooks/useFirestore";
import { db, auth } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { X, ChevronDown, TrendingUp, TrendingDown, Tag, AlertCircle, Calendar, Calculator, Percent } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { DEFAULT_CATEGORIES } from "@/lib/defaults";

export default function AddTransactionModal({ isOpen, onClose, defaultType = "gasto" }: { isOpen: boolean, onClose: () => void, defaultType?: "gasto" | "ingreso" }) {
  const { accounts } = useAccounts();
  const { config } = useUserConfig();
  const [type, setType] = useState<"gasto" | "ingreso">(defaultType);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expenseCategories = [...(config?.expenseCategories?.length ? config.expenseCategories : DEFAULT_CATEGORIES)].sort((a, b) => a.localeCompare(b, 'es'));
  const incomeCategories = [...(config?.incomeCategories?.length ? config.incomeCategories : ["Salario", "Inversion", "Regalo", "Otro"])].sort((a, b) => a.localeCompare(b, 'es'));
  const categories = type === "gasto" ? expenseCategories : incomeCategories;

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setDescription("");
      setType(defaultType);
      setAccountId("");
      setDate(new Date().toISOString().split('T')[0]);
      setError(null);
    }
  }, [isOpen, defaultType]);

  useEffect(() => {
    if (isOpen && categories.length > 0 && !category) {
      setCategory(categories[0]);
    }
  }, [isOpen, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert("Sesión expirada. Por favor, recarga la página.");
      return;
    }
    if (!amount || !accountId) return;

    const monto = parseFloat(amount);
    if (isNaN(monto) || monto <= 0) {
      setError("Ingresa un monto válido");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const mult = type === "ingreso" ? 1 : -1;
      
      await addDoc(collection(db, "transactions"), {
        userId: auth.currentUser.uid,
        monto,
        descripcion: description || category,
        categoria: category,
        accountId,
        tipo: type,
        timestamp: Timestamp.fromDate(new Date(date + "T12:00:00")),
        createdAt: serverTimestamp(),
        fuente: "web"
      });

      const accountRef = doc(db, "accounts", accountId);
      await updateDoc(accountRef, {
        saldo: increment(mult * monto)
      });

      setAmount("");
      setDescription("");
      setCategory("");
      setAccountId("");
      onClose();
    } catch (err) {
      console.error(err);
      setError("Error al guardar. Intenta de nuevo.");
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
        <div className="flex justify-between items-center mb-5">
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl gap-1">
            <button 
              onClick={() => { setType("gasto"); setError(null); }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${type === 'gasto' ? 'bg-red-500 text-white' : 'text-gray-500'}`}
            >
              <TrendingDown size={12} /> Gasto
            </button>
            <button 
              onClick={() => { setType("ingreso"); setError(null); }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${type === 'ingreso' ? 'bg-green-500 text-white' : 'text-gray-500'}`}
            >
              <TrendingUp size={12} /> Ingreso
            </button>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold ${type === 'gasto' ? 'text-red-400' : 'text-green-400'}`}>$</span>
            <input 
              type="number" 
              step="0.01"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(null); }}
              placeholder="0.00"
              className={`w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-3xl font-bold p-4 pl-10 rounded-xl text-center focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${type === 'gasto' ? 'text-red-500' : 'text-green-500'}`}
              required
            />
          </div>

          <div className="flex gap-2 mb-2">
             <button 
               type="button"
               onClick={() => {
                 const val = parseFloat(amount) || 0;
                 setAmount((val * 1.15).toFixed(2));
               }}
               className="flex-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-indigo-100 transition-colors"
             >
               <Percent size={10} /> +15% IVA
             </button>
             <button 
               type="button"
               onClick={() => {
                 const val = parseFloat(amount) || 0;
                 setAmount((val * 1.10).toFixed(2));
               }}
               className="flex-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-indigo-100 transition-colors"
             >
               <Percent size={10} /> +10% Prop
             </button>
             <button 
               type="button"
               onClick={() => {
                 const val = parseFloat(amount) || 0;
                 setAmount((val * 1.05).toFixed(2));
               }}
               className="flex-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-indigo-100 transition-colors"
             >
               <Percent size={10} /> +5% Int
             </button>
             <button 
               type="button"
               onClick={() => setAmount("")}
               className="px-3 bg-gray-50 dark:bg-gray-700 text-gray-400 py-2 rounded-lg text-[10px] font-bold hover:bg-gray-100 transition-colors"
             >
               AC
             </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1 flex items-center gap-1">
                  <Calendar size={10} /> Fecha
                </label>
                <input 
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  required
                />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1 flex items-center gap-1">
                  <Tag size={10} /> Detalle
                </label>
                <input 
                  type="text"
                  placeholder="Describe..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Categoría</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Cuenta</label>
              <select 
                value={accountId}
                onChange={(e) => { setAccountId(e.target.value); setError(null); }}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Seleccionar...</option>
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.nombre}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-950/30 p-3 rounded-xl">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading || !amount || !accountId}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed ${type === 'gasto' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </div>
    </div>
  );
}
