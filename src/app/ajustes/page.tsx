'use client';

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Send, Bot, Plus, X, ChevronLeft, RefreshCw, LogOut } from "lucide-react";
import { UserConfig } from "@/hooks/useFirestore";
import { DEFAULT_CATEGORIES } from "@/lib/defaults";
import { useRouter } from "next/navigation";

export default function AjustesPage() {
  const [telegramId, setTelegramId] = useState("");
  const [newCategories, setNewCategories] = useState("");
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data() as UserConfig;
          setTelegramId(data.telegramId || "");
          
          // Load expense categories
          if (data.expenseCategories && data.expenseCategories.length > 0) {
            setExpenseCategories(data.expenseCategories);
          } else {
            // Set default categories if none exist
            setExpenseCategories(DEFAULT_CATEGORIES);
            await updateDoc(doc(db, "users", user.uid), { 
              expenseCategories: DEFAULT_CATEGORIES,
              incomeCategories: ["Salario", "Inversion", "Regalo", "Otro"]
            });
          }
          
          // Load income categories
          if (data.incomeCategories && data.incomeCategories.length > 0) {
            setIncomeCategories(data.incomeCategories);
          } else {
            setIncomeCategories(["Salario", "Inversion", "Regalo", "Otro"]);
          }
        } else {
          setExpenseCategories(DEFAULT_CATEGORIES);
          setIncomeCategories(["Salario", "Inversion", "Regalo", "Otro"]);
        }
      } else {
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
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert("Error al guardar.");
    } finally {
      setLoading(false);
    }
  };

  const addCategories = async () => {
    if (!newCategories.trim() || !auth.currentUser) return;
    const newCats = newCategories.split(',').map(c => c.trim()).filter(c => c.length > 0);
    if (newCats.length === 0) return;
    
    const updated = [...expenseCategories];
    for (const cat of newCats) {
      if (!updated.includes(cat)) {
        updated.push(cat);
      }
    }
    
    setExpenseCategories(updated);
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      expenseCategories: updated
    });
    setNewCategories("");
  };

  const removeCategory = async (cat: string) => {
    if (!auth.currentUser) return;
    const updated = expenseCategories.filter(c => c !== cat);
    setExpenseCategories(updated);
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      expenseCategories: updated
    });
  };

  const resetCategories = async () => {
    if (!auth.currentUser) return;
    if (!confirm("¿Estás seguro de restablecer las categorías a las base? Se perderán las categorías personalizadas.")) return;
    if (!confirm("¿Confirmas? Esta acción no se puede deshacer.")) return;
    
    setExpenseCategories(DEFAULT_CATEGORIES);
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      expenseCategories: DEFAULT_CATEGORIES
    });
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
          <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        </div>
      </div>

      {/* Telegram Bot */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Bot size={18} className="opacity-50" />
          <h2 className="text-base font-semibold">Conectar Telegram</h2>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl mb-4">
          <p className="text-xs font-semibold opacity-60 mb-2">Tu Telegram ID:</p>
          <p className="text-lg font-bold font-mono">{telegramId || "No vinculado"}</p>
        </div>
        
        <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-xl mb-4 text-sm">
          <p className="font-semibold mb-2">Cómo conectar:</p>
          <ol className="text-xs opacity-70 space-y-1 list-decimal list-inside">
            <li>Abre Telegram y busca <span className="font-bold">@controldegastosvvBot</span></li>
            <li>Envía cualquier mensaje al bot</li>
            <li>Busca @userinfobot y copia tu ID</li>
            <li>Pega tu ID abajo y guarda</li>
          </ol>
        </div>
        
        <div className="flex gap-2">
          <input 
            type="text"
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
            placeholder="Tu Telegram ID..."
            className="flex-1 bg-gray-100 dark:bg-gray-700 border-none p-3 rounded-xl text-sm"
          />
          <button 
            onClick={saveTelegramId} 
            disabled={loading} 
            className="bg-foreground text-background px-4 rounded-xl font-medium text-sm flex items-center gap-2"
          >
            {saved ? "✓" : <Send size={16} />}
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Categorías de Gastos</h2>
          <button 
            onClick={resetCategories}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
          >
            <RefreshCw size={12} /> Restablecer base
          </button>
        </div>
        
        <div className="flex gap-2 mb-4">
          <input 
            value={newCategories}
            onChange={(e) => setNewCategories(e.target.value)}
            placeholder="Nueva categoría (separadas por coma)..."
            className="flex-1 bg-gray-100 dark:bg-gray-700 border-none p-3 rounded-xl text-sm"
            onKeyDown={(e) => e.key === 'Enter' && addCategories()}
          />
          <button 
            onClick={addCategories}
            className="bg-foreground text-background px-4 rounded-xl flex items-center gap-2 text-sm font-medium"
          >
            <Plus size={16} />
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {expenseCategories.map((cat) => (
            <div key={cat} className="bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="text-sm font-medium">{cat}</span>
              <button 
                onClick={() => removeCategory(cat)} 
                className="opacity-40 hover:opacity-100 hover:text-red-500 transition-all"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Bot Instructions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
        <h2 className="text-base font-semibold mb-4">Qué puede hacer el bot</h2>
        <div className="text-sm space-y-2 opacity-70">
          <p>• <strong>"gasté 50 en comida"</strong> - Registrar gasto</p>
          <p>• <strong>"recibí 500"</strong> - Registrar ingreso</p>
          <p>• <strong>"mi saldo"</strong> - Ver saldos</p>
          <p>• <strong>"cuánto gasté en taxi"</strong> - Gastos por categoría</p>
          <p>• <strong>"borra el gasto de 100"</strong> - Eliminar transacción</p>
          <p>• <strong>"ayer gasté 30"</strong> - Con fecha específica</p>
        </div>
      </div>

      {/* User Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
        <p className="text-xs opacity-40 mb-2">Cuenta</p>
        <p className="text-sm font-medium mb-3">{auth.currentUser?.email}</p>
        <button 
          onClick={handleLogout}
          className="w-full bg-red-50 dark:bg-red-950/30 text-red-500 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
        >
          <LogOut size={16} /> Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
