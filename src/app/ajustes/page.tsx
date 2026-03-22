'use client';

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { Send, Bot, Trash2, Plus, X, TrendingDown, TrendingUp, Instagram } from "lucide-react";
import { UserConfig } from "@/hooks/useFirestore";

const DEFAULT_EXPENSES = ["Comida", "Transporte", "Ocio", "Salud", "Hogar", "Otros"];
const DEFAULT_INCOMES = ["Salario", "Venta", "Inversión", "Regalo"];

export default function AjustesPage() {
  const [telegramId, setTelegramId] = useState("");
  const [newExpCat, setNewExpCat] = useState("");
  const [newIncCat, setNewIncCat] = useState("");
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [userDoc, setUserDoc] = useState<UserConfig | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data() as UserConfig;
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
    } catch {
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

  const deleteAccount = async () => {
    if (!confirm("¿Estás seguro de eliminar tu cuenta?")) return;
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

      {/* Instagram */}
      <section className="glass p-8 rounded-[3rem] space-y-6 shadow-2xl relative overflow-hidden group border-pink-500/10 hover:border-pink-500/20 transition-colors">
        <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 blur-3xl rounded-full" />
        <div className="flex items-center gap-4 text-pink-500 relative">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
          <h2 className="text-xl font-black italic uppercase tracking-tight">Conexión Instagram</h2>
        </div>
        <p className="text-sm text-foreground/60">Conecta tu Instagram para compartir tus logros financieros con tus seguidores.</p>
        
        {/* Instrucciones simplificadas */}
        <div className="bg-pink-500/5 p-5 rounded-3xl border border-pink-500/10 space-y-4">
          <p className="text-[10px] font-black text-pink-500/50 uppercase tracking-widest">Cómo conectar:</p>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3 items-start">
              <span className="bg-pink-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <span>Ve a <a href="https://developers.facebook.com" target="_blank" className="text-pink-500 underline">developers.facebook.com</a></span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="bg-pink-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <span>Crea una cuenta de desarrollador (solo email)</span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="bg-pink-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <span>Crea una nueva App → tipo "Consumer"</span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="bg-pink-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">4</span>
              <span>En "Productos" busca Instagram y agrega "Instagram Graph API"</span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="bg-pink-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">5</span>
              <span>Copia el <span className="font-mono bg-white/50 px-1 rounded">Access Token</span> y pégalo aquí:</span>
            </li>
          </ol>
          
          <div className="flex gap-2 pt-2">
            <input 
              type="text"
              placeholder="Peg aquí tu Access Token de Instagram..."
              className="flex-1 glass border-none p-4 rounded-2xl focus:ring-4 ring-pink-500/20 font-mono text-sm"
            />
            <button className="bg-pink-500 text-white p-4 rounded-2xl shadow-lg hover:scale-105 transition-all">
              <Send size={20} />
            </button>
          </div>
        </div>
        
        <div className="text-center">
          <span className="text-[10px] font-black text-pink-500/30 uppercase tracking-widest bg-pink-500/5 px-4 py-2 rounded-full">
            Próximamente: publicación automática de gastos
          </span>
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
        <button onClick={deleteAccount} className="w-full bg-red-500/5 text-red-500 py-4 rounded-3xl font-black italic hover:bg-red-500 hover:text-white transition-all">
          Cerrar Cuenta Definitivamente
        </button>
      </section>
    </div>
  );
}
