'use client';

import { useState, useEffect } from "react";
import { useAccounts, useUserConfig } from "@/hooks/useFirestore";
import { db, auth } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { X, ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
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
    if (categories.length > 0 && !categories.includes(category)) {
      setCategory(categories[0]);
    }
  }, [type, categories, category]);

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
        descripcion: description,
        categoria: category,
        accountId,
        tipo: type,
        timestamp: serverTimestamp(),
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
      <div className="glass w-full max-w-md rounded-[2rem] p-8 space-y-6 shadow-2xl animate-in fade-in slide-in-from-bottom-10 border-white/5">
        <div className="flex justify-between items-center">
          <div className="flex bg-foreground/5 p-1 rounded-2xl gap-1">
             <button 
               onClick={() => { setType("gasto"); }}
               className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${type === 'gasto' ? 'bg-white text-red-500 shadow-sm' : 'text-foreground/40'}`}
             >
               <TrendingDown size={14} /> GASTO
             </button>
             <button 
               onClick={() => { setType("ingreso"); }}
               className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${type === 'ingreso' ? 'bg-white text-green-500 shadow-sm' : 'text-foreground/40'}`}
             >
               <TrendingUp size={14} /> INGRESO
             </button>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-foreground/5 rounded-full"><X /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative group">
            <span className={`absolute left-6 top-1/2 -translate-y-1/2 text-4xl font-bold transition-colors ${type === 'gasto' ? 'text-red-500/20' : 'text-green-500/20'}`}>$</span>
            <input 
              type="number" 
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`w-full bg-foreground/[0.03] border-none text-5xl font-bold p-8 px-12 rounded-3xl focus:ring-4 transition-all text-center ${type === 'gasto' ? 'ring-red-500/10 text-red-500' : 'ring-green-500/10 text-green-500'}`}
              required
              autoFocus
            />
          </div>

          <input 
            type="text"
            placeholder={type === 'gasto' ? "¿En qué gastaste?" : "¿De dónde viene el dinero?"}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full glass border-none p-5 rounded-2xl focus:ring-2 ring-primary text-sm font-medium"
          />

          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider px-2 opacity-30">Categoría</label>
                <div className="relative">
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full glass border-none p-4 rounded-2xl text-sm font-medium focus:ring-2 ring-primary appearance-none cursor-pointer"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none" size={16} />
                </div>
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider px-2 opacity-30">Cuenta</label>
                <div className="relative">
                  <select 
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full glass border-none p-4 rounded-2xl text-sm font-medium focus:ring-2 ring-primary appearance-none cursor-pointer"
                    required
                  >
                    <option value="">Cuenta...</option>
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.nombre}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none" size={16} />
                </div>
             </div>
          </div>

          <button 
            disabled={loading}
            className={`w-full py-6 rounded-3xl font-bold text-2xl tracking-tighter shadow-2xl hover:scale-[1.03] active:scale-95 disabled:opacity-50 transition-all text-white ${type === 'gasto' ? 'bg-red-500' : 'bg-green-500'}`}
          >
            {loading ? "PROCESANDO..." : "LISTO"}
          </button>
        </form>
      </div>
    </div>
  );
}
