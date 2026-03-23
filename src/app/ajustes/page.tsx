'use client';

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { Send, Bot, LogOut, Plus, X, TrendingDown, TrendingUp, ChevronLeft } from "lucide-react";
import { UserConfig } from "@/hooks/useFirestore";
import { DEFAULT_CATEGORIES } from "@/lib/defaults";
import { useRouter } from "next/navigation";

export default function AjustesPage() {
  const [telegramId, setTelegramId] = useState("");
  const [newExpCat, setNewExpCat] = useState("");
  const [newIncCat, setNewIncCat] = useState("");
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [userDoc, setUserDoc] = useState<UserConfig | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data() as UserConfig;
          setUserDoc(data);
          setTelegramId(data.telegramId || "");
          setExpenseCategories(data.expenseCategories || DEFAULT_CATEGORIES);
          setIncomeCategories(data.incomeCategories || ["Salario", "Inversion", "Regalo", "Otro"]);
        } else {
          setExpenseCategories(DEFAULT_CATEGORIES);
          setIncomeCategories(["Salario", "Inversion", "Regalo", "Otro"]);
        }
      } else {
        setUserDoc(null);
        router.push('/login');
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const saveTelegramId = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        telegramId: telegramId
      });
      alert("¡Telegram ID guardado!");
    } catch {
      alert("Error al guardar.");
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

  const handleLogout = async () => {
    if (!confirm("¿Cerrar sesión?")) return;
    await auth.signOut();
    router.push('/login');
  };

  if (authLoading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="w-6 h-6 rounded-full bg-gray-200 animate-pulse" />
    </div>
  );

  return (
    <div className="space-y-6 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => router.push('/')}
          className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
        >
          <ChevronLeft size={18} className="opacity-50" />
        </button>
        <div>
          <p className="text-xs font-semibold opacity-40">Gestor de Gastos</p>
          <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
        </div>
      </div>

      {/* Telegram */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Bot size={18} className="opacity-50" />
          <h2 className="text-base font-semibold">Telegram</h2>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl mb-4">
          <p className="text-xs font-medium opacity-60 mb-2">Tu Telegram ID:</p>
          <p className="text-lg font-bold font-mono">{userDoc?.telegramId || "No vinculado"}</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="text"
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
            placeholder="Ingresa tu Telegram ID..."
            className="flex-1 bg-gray-100 dark:bg-gray-700 border-none p-3 rounded-xl text-sm"
          />
          <button 
            onClick={saveTelegramId} 
            disabled={loading} 
            className="bg-foreground text-background px-4 rounded-xl font-medium text-sm"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-xs opacity-40 mt-2">Busca @userinfobot en Telegram para obtener tu ID</p>
      </div>

      {/* Categories */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
        <h2 className="text-base font-semibold mb-4">Categorías de Gastos</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {expenseCategories.map((cat) => (
            <div key={cat} className="bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="text-sm font-medium">{cat}</span>
              <button onClick={() => removeCategory('expense', cat)} className="opacity-40 hover:opacity-100">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input 
            value={newExpCat}
            onChange={(e) => setNewExpCat(e.target.value)}
            placeholder="Nueva categoría..."
            className="flex-1 bg-gray-100 dark:bg-gray-700 border-none p-3 rounded-xl text-sm"
          />
          <button 
            onClick={() => addCategory('expense', newExpCat)} 
            className="bg-gray-100 dark:bg-gray-700 px-4 rounded-xl"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
        <h2 className="text-base font-semibold mb-4">Categorías de Ingresos</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {incomeCategories.map((cat) => (
            <div key={cat} className="bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="text-sm font-medium">{cat}</span>
              <button onClick={() => removeCategory('income', cat)} className="opacity-40 hover:opacity-100">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input 
            value={newIncCat}
            onChange={(e) => setNewIncCat(e.target.value)}
            placeholder="Nueva categoría..."
            className="flex-1 bg-gray-100 dark:bg-gray-700 border-none p-3 rounded-xl text-sm"
          />
          <button 
            onClick={() => addCategory('income', newIncCat)} 
            className="bg-gray-100 dark:bg-gray-700 px-4 rounded-xl"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Logout */}
      <button 
        onClick={handleLogout}
        className="w-full bg-red-50 dark:bg-red-950/30 text-red-500 py-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
      >
        <LogOut size={16} /> Cerrar Sesión
      </button>
    </div>
  );
}
