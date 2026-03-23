'use client';

import { useState, useEffect, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Send, Bot, Plus, X, ChevronLeft, RefreshCw, LogOut, Copy, ExternalLink, Check, Link, HelpCircle, MessageCircle } from "lucide-react";
import { UserConfig } from "@/hooks/useFirestore";
import { DEFAULT_CATEGORIES } from "@/lib/defaults";
import { useRouter } from "next/navigation";

const TELEGRAM_BOT_USERNAME = "controldegastosvvBot";
const TELEGRAM_BOT_LINK = `https://t.me/${TELEGRAM_BOT_USERNAME}`;

export default function AjustesPage() {
  const [telegramId, setTelegramId] = useState("");
  const [newCategories, setNewCategories] = useState("");
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [linkingCode, setLinkingCode] = useState<string | null>(null);
  const [linkingExpires, setLinkingExpires] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data() as UserConfig;
          setTelegramId(data.telegramId || "");
          setTelegramLinked(!!data.telegramId);
          
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

  const generateLinkingCode = useCallback(async () => {
    try {
      const res = await fetch('/api/linking/generate');
      const data = await res.json();
      if (data.code) {
        setLinkingCode(data.code);
        setLinkingExpires(data.expiresAt);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (!telegramLinked && auth.currentUser) {
      generateLinkingCode();
    }
  }, [telegramLinked, auth.currentUser, generateLinkingCode]);

  useEffect(() => {
    if (!linkCopied) return;
    const timer = setTimeout(() => setLinkCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [linkCopied]);

  const copyToClipboard = async () => {
    if (!linkingCode) return;
    const text = `/vincular ${linkingCode}`;
    await navigator.clipboard.writeText(text);
    setLinkCopied(true);
  };

  const openTelegram = () => {
    if (!linkingCode) return;
    const url = `https://t.me/${TELEGRAM_BOT_USERNAME}?text=/vincular%20${linkingCode}`;
    window.open(url, '_blank');
  };

  useEffect(() => {
    if (!telegramId && auth.currentUser) {
      const interval = setInterval(async () => {
        const snap = await getDoc(doc(db, "users", auth.currentUser!.uid));
        if (snap.exists()) {
          const data = snap.data() as UserConfig;
          if (data.telegramId) {
            setTelegramId(data.telegramId);
            setTelegramLinked(true);
            setLinkingCode(null);
          }
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [telegramId, auth.currentUser]);

  useEffect(() => {
    if (!telegramLinked) {
      setShowHelp(true);
    }
  }, [telegramLinked]);

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

      {/* Help Banner - Primera vez */}
      {!telegramLinked && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 text-white">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <MessageCircle size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-base mb-1">Conecta Telegram</h3>
              <p className="text-sm opacity-90 mb-3">
                Registra gastos con la voz desde tu teléfono. Solo di "gasté 50 en comida" y el bot lo guarda.
              </p>
              <div className="flex gap-2">
                <a 
                  href={TELEGRAM_BOT_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-white text-indigo-600 px-4 py-2.5 rounded-xl font-semibold text-sm text-center flex items-center justify-center gap-2"
                >
                  <ExternalLink size={14} />
                  Abrir Bot
                </a>
                <button 
                  onClick={() => setShowHelp(!showHelp)}
                  className="px-4 py-2.5 bg-white/20 rounded-xl font-medium text-sm"
                >
                  <HelpCircle size={16} />
                </button>
              </div>
            </div>
          </div>
          
          {showHelp && (
            <div className="mt-4 pt-4 border-t border-white/20 text-sm space-y-2">
              <p className="font-semibold">Cómo configurar:</p>
              <ol className="space-y-1 opacity-90">
                <li>1. Presiona "Abrir Bot" para ir a Telegram</li>
                <li>2. Envía cualquier mensaje al bot</li>
                <li>3. Regresa aquí y genera tu código de vinculación</li>
                <li>4. Escribe <span className="font-mono bg-white/20 px-1 rounded">/vincular [código]</span> en el bot</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Telegram Bot */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Bot size={18} className="opacity-50" />
          <h2 className="text-base font-semibold">Conectar Telegram</h2>
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
            <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-xl p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-2">Tu código de vinculación</p>
              <p className="text-4xl font-bold font-mono tracking-widest text-indigo-600 dark:text-indigo-400">{linkingCode}</p>
              <p className="text-xs opacity-40 mt-2">⏰ Expira en 5 minutos</p>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={copyToClipboard}
                className="flex-1 bg-gray-100 dark:bg-gray-700 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
              >
                {linkCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                {linkCopied ? "Copiado" : "Copiar código"}
              </button>
              <button 
                onClick={openTelegram}
                className="flex-1 bg-indigo-500 text-white py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
              >
                <ExternalLink size={16} />
                Abrir Telegram
              </button>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 text-xs opacity-70 space-y-1">
              <p className="font-semibold opacity-100">Cómo vincular:</p>
              <p>1. Copia el código o presiona "Abrir Telegram"</p>
              <p>2. En el bot, escribe: <span className="font-mono font-semibold">/vincular {linkingCode}</span></p>
              <p>3. ¡Listo! La página se actualizará automáticamente</p>
            </div>
            
            <button 
              onClick={generateLinkingCode}
              className="w-full text-xs text-blue-500 hover:text-blue-600 font-medium"
            >
              ↻ Generar nuevo código
            </button>
          </div>
        ) : (
          <div className="text-center py-4">
            <button 
              onClick={generateLinkingCode}
              className="bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium text-sm"
            >
              Generar código de vinculación
            </button>
          </div>
        )}
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
