'use client';

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { Send, Bot, Trash2, Tag, Plus, X, TrendingDown, TrendingUp } from "lucide-react";

const DEFAULT_EXPENSES = ["Comida", "Transporte", "Ocio", "Salud", "Hogar", "Otros"];
const DEFAULT_INCOMES = ["Salario", "Venta", "Inversión", "Regalo"];

export default function AjustesPage() {
  const [telegramId, setTelegramId] = useState("");
  const [newExpCat, setNewExpCat] = useState("");
  const [newIncCat, setNewIncCat] = useState("");
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [userDoc, setUserDoc] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setUserDoc(data);
          setTelegramId(data.telegramId || "");
          // Migración o carga de datos
          setExpenseCategories(data.expenseCategories || data.categories || DEFAULT_EXPENSES);
          setIncomeCategories(data.incomeCategories || DEFAULT_INCOMES);
        } else {
          setExpenseCategories(DEFAULT_EXPENSES);
          setIncomeCategories(DEFAULT_INCOMES);
        }
      } else {
        setUserDoc(null);
        setTelegramId("");
        setExpenseCategories([]);
        setIncomeCategories([]);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const saveTelegramId = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        telegramId: telegramId
      });
      alert("✅ ¡Telegram ID guardado!");
    } catch (e) {
      alert("❌ Error al guardar.");
    } finally {
      setLoading(false);
    }
  };

  const addCategory = async (type: 'expense' | 'income', val: string) => {
    if (!val.trim() || !auth.currentUser) return;
    const field = type === 'expense' ? 'expenseCategories' : 'incomeCategories';
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        [field]: arrayUnion(val.trim())
      });
      if (type === 'expense') {
        setExpenseCategories(prev => [...prev, val.trim()]);
        setNewExpCat("");
      } else {
        setIncomeCategories(prev => [...prev, val.trim()]);
        setNewIncCat("");
      }
    } catch (e) { console.error(e); }
  };

  const removeCategory = async (type: 'expense' | 'income', cat: string) => {
    if (!auth.currentUser) return;
    const field = type === 'expense' ? 'expenseCategories' : 'incomeCategories';
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        [field]: arrayRemove(cat)
      });
      if (type === 'expense') setExpenseCategories(prev => prev.filter(c => c !== cat));
      else setIncomeCategories(prev => prev.filter(c => c !== cat));
    } catch (e) { console.error(e); }
  };

  if (authLoading) return (
    <div className="flex h-[50vh] items-center justify-center">
      <Bot size={48} className="text-primary animate-bounce opacity-20" />
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 pb-20">
      <header className="py-4">
        <h1 className="text-4xl font-black italic tracking-tighter">AJUSTES</h1>
        <p className="text-foreground/40 font-bold uppercase text-[10px] tracking-[0.3em]">Configura tu ecosistema financiero</p>
      </header>

      {/* Telegram ID */}
      <section className="glass p-8 rounded-[3rem] space-y-6 shadow-2xl relative overflow-hidden group border-white/5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full" />
        <div className="flex items-center gap-4 text-primary relative">
          <Bot size={32} />
          <h2 className="text-xl font-black italic uppercase tracking-tight">Conexión Telegram</h2>
        </div>
        <div className="bg-primary/5 p-5 rounded-3xl border border-primary/10 relative">
          <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-1">Tu ID en la nube</p>
          <p className="text-2xl font-mono font-black italic">{userDoc?.telegramId || "SIN VINCULAR"}</p>
        </div>
        <div className="flex gap-2 relative">
          <input 
            type="text"
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
            placeholder="Introduce tu ID..."
            className="flex-1 glass border-none p-5 rounded-2xl focus:ring-4 ring-primary/20 font-bold italic"
          />
          <button onClick={saveTelegramId} disabled={loading} className="bg-primary text-white p-5 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all">
            <Send size={24} />
          </button>
        </div>
      </section>

      {/* Categorías Gastos */}
      <section className="glass p-8 rounded-[3rem] space-y-6 border-red-500/10 hover:border-red-500/20 transition-colors shadow-2xl">
        <div className="flex items-center gap-4 text-red-500">
          <TrendingDown size={32} />
          <h2 className="text-xl font-black italic uppercase tracking-tight">Categorías de Gasto</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {expenseCategories.map((cat) => (
            <div key={cat} className="bg-red-500/5 p-3 px-5 rounded-2xl flex items-center gap-3 group border border-transparent hover:border-red-500/30 transition-all">
              <span className="text-xs font-black uppercase tracking-tight italic opacity-60 group-hover:opacity-100">{cat}</span>
              <button onClick={() => removeCategory('expense', cat)} className="opacity-20 group-hover:opacity-100 hover:text-red-500 transition-all"><X size={14}/></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input 
            value={newExpCat}
            onChange={(e) => setNewExpCat(e.target.value)}
            placeholder="Nuevo Gasto..."
            className="flex-1 glass border-none p-5 rounded-2xl focus:ring-4 ring-red-500/10 font-bold italic"
          />
          <button onClick={() => addCategory('expense', newExpCat)} className="bg-red-500 text-white p-5 rounded-2xl shadow-lg hover:scale-105 transition-all">
            <Plus size={24} />
          </button>
        </div>
      </section>

      {/* Categorías Ingresos */}
      <section className="glass p-8 rounded-[3rem] space-y-6 border-green-500/10 hover:border-green-500/20 transition-colors shadow-2xl">
        <div className="flex items-center gap-4 text-green-500">
          <TrendingUp size={32} />
          <h2 className="text-xl font-black italic uppercase tracking-tight">Categorías de Ingreso</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {incomeCategories.map((cat) => (
            <div key={cat} className="bg-green-500/5 p-3 px-5 rounded-2xl flex items-center gap-3 group border border-transparent hover:border-green-500/30 transition-all">
              <span className="text-xs font-black uppercase tracking-tight italic opacity-60 group-hover:opacity-100">{cat}</span>
              <button onClick={() => removeCategory('income', cat)} className="opacity-20 group-hover:opacity-100 hover:text-green-500 transition-all"><X size={14}/></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input 
            value={newIncCat}
            onChange={(e) => setNewIncCat(e.target.value)}
            placeholder="Nuevo Ingreso..."
            className="flex-1 glass border-none p-5 rounded-2xl focus:ring-4 ring-green-500/10 font-bold italic"
          />
          <button onClick={() => addCategory('income', newIncCat)} className="bg-green-500 text-white p-5 rounded-2xl shadow-lg hover:scale-105 transition-all">
            <Plus size={24} />
          </button>
        </div>
      </section>

      {/* Zona Peligrosa */}
      <section className="glass p-8 rounded-[3rem] space-y-4 opacity-50 hover:opacity-100 transition-all border-dashed border-2 border-red-500/10">
        <div className="flex items-center gap-4 text-red-500">
           <Trash2 size={24} />
           <h2 className="text-md font-black italic uppercase tracking-tighter">Zona Crítica</h2>
        </div>
        <button className="w-full bg-red-500/5 text-red-500 py-4 rounded-3xl font-black italic hover:bg-red-500 hover:text-white transition-all">
          Cerrar Cuenta Definitivamente
        </button>
      </section>
    </div>
  );
}
