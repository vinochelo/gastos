'use client';

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Plus, X, ChevronLeft, RefreshCw, LogOut, Copy, Check, MessageCircle, Smartphone, Monitor, ExternalLink, Loader2 } from "lucide-react";
import { UserConfig } from "@/hooks/useFirestore";
import { DEFAULT_CATEGORIES } from "@/lib/defaults";
import { useRouter } from "next/navigation";

const TELEGRAM_BOT_USERNAME = "controldegastosvvBot";

export default function AjustesPage() {
  const [telegramId, setTelegramId] = useState("");
  const [newCategories, setNewCategories] = useState("");
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [linkingCode, setLinkingCode] = useState<string | null>(null);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [userReady, setUserReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    setIsMobile(checkMobile);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data() as UserConfig;
          setTelegramId(data.telegramId || "");
          setTelegramLinked(!!data.telegramId);
          
          if (data.expenseCategories?.length) {
            setExpenseCategories(data.expenseCategories);
          } else {
            setExpenseCategories(DEFAULT_CATEGORIES);
            await updateDoc(doc(db, "users", user.uid), { 
              expenseCategories: DEFAULT_CATEGORIES,
              incomeCategories: ["Salario", "Inversion", "Regalo", "Otro"]
            });
          }
        } else {
          setExpenseCategories(DEFAULT_CATEGORIES);
        }
        setUserReady(true);
      } else {
        router.push('/login');
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const generateLinkingCode = async () => {
    if (!auth.currentUser || codeLoading) return;
    
    setCodeLoading(true);
    
    try {
      const res = await fetch('/api/linking/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: auth.currentUser.uid })
      });
      const data = await res.json();
      
      if (data.code) {
        setLinkingCode(data.code);
        showToast("Código generado");
      } else {
        showToast("Error: " + (data.error || "desconocido"));
      }
    } catch (err) {
      console.error("Error:", err);
      showToast("Error de conexión");
    } finally {
      setCodeLoading(false);
    }
  };

  useEffect(() => {
    if (!telegramLinked && auth.currentUser && userReady) {
      const interval = setInterval(async () => {
        try {
          const snap = await getDoc(doc(db, "users", auth.currentUser!.uid));
          if (snap.exists()) {
            const data = snap.data() as UserConfig;
            if (data.telegramId) {
              setTelegramId(data.telegramId);
              setTelegramLinked(true);
              setLinkingCode(null);
              showToast("¡Telegram vinculado!");
            }
          }
        } catch (err) {
          console.error("Error checking:", err);
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [telegramLinked, userReady]);

  const copyToClipboard = async () => {
    if (!linkingCode) return;
    const text = `/vincular ${linkingCode}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Código copiado");
    } catch {
      showToast("Error al copiar");
    }
  };

  const getTelegramLink = () => {
    return `https://t.me/${TELEGRAM_BOT_USERNAME}`;
  };

  const addCategories = async () => {
    if (!newCategories.trim() || !auth.currentUser) return;
    const newCats = newCategories.split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0);
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
    showToast("Categoría añadida");
  };

  const removeCategory = async (cat: string) => {
    if (!auth.currentUser) return;
    const updated = expenseCategories.filter(c => c !== cat);
    setExpenseCategories(updated);
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      expenseCategories: updated
    });
    showToast("Categoría eliminada");
  };

  const resetCategories = async () => {
    if (!auth.currentUser) return;
    if (!confirm("¿Restablecer categorías?")) return;
    
    setExpenseCategories(DEFAULT_CATEGORIES);
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      expenseCategories: DEFAULT_CATEGORIES
    });
    showToast("Categorías restablecidas");
  };

  const handleLogout = async () => {
    if (!confirm("¿Cerrar sesión?")) return;
    await auth.signOut();
    router.push('/login');
  };

  if (authLoading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 size={24} className="animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="space-y-6 pb-28">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-gray-900 text-white px-6 py-3 rounded-xl shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

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

      {!telegramLinked && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 text-white">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <MessageCircle size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-base mb-1">Conecta Telegram</h3>
              <p className="text-sm opacity-90">
                Registra gastos con tu voz. Di "gasté 50 en comida" y el bot lo guarda.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="opacity-50" />
            <h2 className="text-base font-semibold">Vincular Telegram</h2>
          </div>
        </div>
        
        {telegramLinked ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check size={32} className="text-green-500" />
            </div>
            <p className="text-sm font-medium mb-1">¡Telegram vinculado!</p>
            <p className="text-xs opacity-50 font-mono">{telegramId}</p>
          </div>
        ) : linkingCode ? (
          <div className="space-y-4">
            <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-xl p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-2">Comando listo</p>
              <div className="bg-gray-900 dark:bg-gray-800 rounded-lg px-4 py-3 inline-block">
                <p className="text-green-400 font-mono text-lg">/vincular {linkingCode}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={copyToClipboard}
                className="flex-1 bg-gray-100 dark:bg-gray-700 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Copy size={16} />
                Copiar
              </button>
              <a 
                href={getTelegramLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors text-center"
              >
                <ExternalLink size={16} />
                Ir al Bot
              </a>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 text-xs">
              <p className="font-semibold mb-2 text-blue-700 dark:text-blue-400">⏰ Expira en 5 minutos</p>
              <p className="opacity-70">1. Copia el código<br/>2. Abre el bot y pégalo</p>
            </div>

            <button 
              onClick={generateLinkingCode}
              disabled={codeLoading}
              className="w-full flex items-center justify-center gap-2 text-xs text-indigo-500 hover:text-indigo-600 font-medium py-2 disabled:opacity-50"
            >
              {codeLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  Generar nuevo código
                </>
              )}
            </button>
          </div>
        ) : (
          <button 
            onClick={generateLinkingCode}
            disabled={codeLoading}
            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300 text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-colors"
          >
            {codeLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Generando código...
              </>
            ) : (
              <>
                <MessageCircle size={20} />
                Generar código de vinculación
              </>
            )}
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Categorías de Gastos</h2>
          <button 
            onClick={resetCategories}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
          >
            <RefreshCw size={12} /> Restablecer
          </button>
        </div>
        
        <div className="flex gap-2 mb-4">
          <input 
            value={newCategories}
            onChange={(e) => setNewCategories(e.target.value)}
            placeholder="Nueva categoría..."
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

      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
        <h2 className="text-base font-semibold mb-4">Qué puede hacer el bot</h2>
        <div className="text-sm space-y-2 opacity-70">
          <p>• <strong>"gasté 50 en comida"</strong> - Registrar gasto</p>
          <p>• <strong>"recibí 500"</strong> - Registrar ingreso</p>
          <p>• <strong>"mi saldo"</strong> - Ver saldos</p>
          <p>• <strong>"cuánto gasté en taxi"</strong> - Gastos por categoría</p>
        </div>
      </div>

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
