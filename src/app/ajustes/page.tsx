'use client';

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Plus, X, ChevronLeft, RefreshCw, LogOut, Copy, Check, MessageCircle, Smartphone, Monitor, ExternalLink, Loader2, Edit2, KeyRound } from "lucide-react";
import { UserConfig } from "@/hooks/useFirestore";
import { DEFAULT_CATEGORIES } from "@/lib/defaults";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/api";

const TELEGRAM_BOT_USERNAME = "controldegastosvvBot";

export default function AjustesPage() {
  const [telegramId, setTelegramId] = useState("");
  const [newCategories, setNewCategories] = useState("");
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [linkingCode, setLinkingCode] = useState<string | null>(null);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [userReady, setUserReady] = useState(false);
  
  // Mobile login code state
  const [mobileCode, setMobileCode] = useState<string | null>(null);
  const [mobileCodeLoading, setMobileCodeLoading] = useState(false);
  const [mobileCodeCountdown, setMobileCodeCountdown] = useState<number | null>(null);
  
  // Category management enhancements
  const [activeCategoryTab, setActiveCategoryTab] = useState<'gastos' | 'ingresos'>('gastos');
  const [editingCategory, setEditingCategory] = useState<{ originalName: string, newName: string } | null>(null);

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
          }
          
          if (data.incomeCategories?.length) {
            setIncomeCategories(data.incomeCategories);
          } else {
            setIncomeCategories(["Salario", "Inversion", "Regalo", "Otro"]);
          }

          if (!data.expenseCategories?.length || !data.incomeCategories?.length) {
            await updateDoc(doc(db, "users", user.uid), { 
              expenseCategories: data.expenseCategories?.length ? data.expenseCategories : DEFAULT_CATEGORIES,
              incomeCategories: data.incomeCategories?.length ? data.incomeCategories : ["Salario", "Inversion", "Regalo", "Otro"]
            });
          }
        } else {
          setExpenseCategories(DEFAULT_CATEGORIES);
          setIncomeCategories(["Salario", "Inversion", "Regalo", "Otro"]);
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

  const generateMobileAuthCode = async () => {
    if (!auth.currentUser || mobileCodeLoading) return;
    setMobileCodeLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/mobile-auth/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: auth.currentUser.uid })
      });
      const data = await res.json();
      if (data.code) {
        setMobileCode(data.code);
        const expiresAt = new Date(data.expiresAt);
        const secondsLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
        setMobileCodeCountdown(secondsLeft);
        showToast("Código móvil generado");
      } else {
        showToast("Error: " + (data.error || "desconocido"));
      }
    } catch (err) {
      console.error("Error generating mobile code:", err);
      showToast("Error de conexión");
    } finally {
      setMobileCodeLoading(false);
    }
  };

  useEffect(() => {
    if (mobileCodeCountdown !== null && mobileCodeCountdown > 0) {
      const timer = setTimeout(() => {
        setMobileCodeCountdown(prev => (prev !== null ? prev - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (mobileCodeCountdown === 0) {
      setMobileCode(null);
      setMobileCodeCountdown(null);
    }
  }, [mobileCodeCountdown]);

  const generateLinkingCode = async () => {
    if (!auth.currentUser || codeLoading) return;
    
    setCodeLoading(true);
    
    try {
      const res = await fetch(getApiUrl('/api/linking/generate'), {
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
    return `https://t.me/controldegastosvvBot`;
  };

  const addCategory = async () => {
    if (!newCategories.trim() || !auth.currentUser) return;
    const newCats = newCategories.split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0);
    if (newCats.length === 0) return;
    
    if (activeCategoryTab === 'gastos') {
      const updated = [...expenseCategories];
      for (const cat of newCats) {
        if (!updated.includes(cat)) updated.push(cat);
      }
      setExpenseCategories(updated);
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        expenseCategories: updated
      });
    } else {
      const updated = [...incomeCategories];
      for (const cat of newCats) {
        if (!updated.includes(cat)) updated.push(cat);
      }
      setIncomeCategories(updated);
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        incomeCategories: updated
      });
    }
    setNewCategories("");
    showToast("Categoría añadida");
  };

  const handleRemoveCategory = async (cat: string) => {
    if (!auth.currentUser) return;
    if (activeCategoryTab === 'gastos') {
      const updated = expenseCategories.filter(c => c !== cat);
      setExpenseCategories(updated);
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        expenseCategories: updated
      });
    } else {
      const updated = incomeCategories.filter(c => c !== cat);
      setIncomeCategories(updated);
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        incomeCategories: updated
      });
    }
    showToast("Categoría eliminada");
  };

  const handleRenameCategory = async (originalName: string, newName: string) => {
    if (!auth.currentUser || !newName.trim() || originalName === newName) {
      setEditingCategory(null);
      return;
    }
    const cleanName = newName.trim();
    if (activeCategoryTab === 'gastos') {
      if (expenseCategories.includes(cleanName) && cleanName.toLowerCase() !== originalName.toLowerCase()) {
        showToast("Esa categoría ya existe");
        return;
      }
      const updated = expenseCategories.map(c => c === originalName ? cleanName : c);
      setExpenseCategories(updated);
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        expenseCategories: updated
      });
    } else {
      if (incomeCategories.includes(cleanName) && cleanName.toLowerCase() !== originalName.toLowerCase()) {
        showToast("Esa categoría ya existe");
        return;
      }
      const updated = incomeCategories.map(c => c === originalName ? cleanName : c);
      setIncomeCategories(updated);
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        incomeCategories: updated
      });
    }
    setEditingCategory(null);
    showToast("Categoría renombrada");
  };

  const handleResetCategories = async () => {
    if (!auth.currentUser) return;
    if (!confirm(`¿Restablecer categorías de ${activeCategoryTab}?`)) return;
    
    if (activeCategoryTab === 'gastos') {
      setExpenseCategories(DEFAULT_CATEGORIES);
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        expenseCategories: DEFAULT_CATEGORIES
      });
    } else {
      const defaultIncome = ["Salario", "Inversion", "Regalo", "Otro"];
      setIncomeCategories(defaultIncome);
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        incomeCategories: defaultIncome
      });
    }
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

  const categoriesToDisplay = activeCategoryTab === 'gastos' ? expenseCategories : incomeCategories;

  return (
    <div className="space-y-6 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-indigo-900/90 text-white px-6 py-3 rounded-xl shadow-lg text-sm font-semibold border border-indigo-500/10 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button 
          onClick={() => router.push('/')}
          className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
        >
          <ChevronLeft size={18} className="opacity-50 text-foreground" />
        </button>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500/80 dark:text-indigo-400">Preferencias</p>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Configuración</h1>
        </div>
      </div>

      {!telegramLinked && (
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-3xl p-5 text-white shadow-xl shadow-indigo-500/10 border border-white/10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/10">
              <MessageCircle size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-extrabold text-base mb-1 tracking-tight">Conecta Telegram</h3>
              <p className="text-xs text-white/80 leading-relaxed">
                Registra transacciones hablando al bot. Di *"gasté 15 dólares en transporte hoy"* y se registrará automáticamente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Linker Card */}
      <div className="glass rounded-3xl p-5 border border-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-foreground">
            <MessageCircle size={18} className="opacity-60" />
            <h2 className="text-sm font-extrabold tracking-tight">Vincular Telegram</h2>
          </div>
        </div>
        
        {telegramLinked ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Check size={28} />
            </div>
            <p className="text-sm font-bold text-foreground mb-0.5">¡Telegram vinculado!</p>
            <p className="text-[10px] text-foreground/45 font-mono">ID: {telegramId}</p>
          </div>
        ) : linkingCode ? (
          <div className="space-y-4">
            <div className="bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500/70 mb-2">Comando de Vinculación</p>
              <div className="bg-gray-900/90 dark:bg-gray-950/80 rounded-xl px-4 py-3 inline-block select-all border border-indigo-500/10">
                <p className="text-emerald-400 font-mono text-base font-bold">/vincular {linkingCode}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={copyToClipboard}
                className="flex-1 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700/80 text-foreground py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-border shadow-sm"
              >
                <Copy size={14} />
                Copiar
              </button>
              <a 
                href={getTelegramLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors text-center cursor-pointer shadow-md shadow-indigo-600/10"
              >
                <ExternalLink size={14} />
                Ir al Bot
              </a>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl p-4 text-[10px] border border-amber-500/10">
              <p className="font-extrabold text-amber-700 dark:text-amber-400 mb-1">⏰ Expira en 5 minutos</p>
              <p className="text-foreground/60 leading-normal">Copia el comando de arriba y envíalo en un mensaje privado al bot de Telegram.</p>
            </div>

            <button 
              onClick={generateLinkingCode}
              disabled={codeLoading}
              className="w-full flex items-center justify-center gap-1.5 text-[10px] text-indigo-500 hover:text-indigo-600 font-extrabold uppercase tracking-wider py-1 disabled:opacity-50 cursor-pointer"
            >
              {codeLoading ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <RefreshCw size={12} />
                  Generar nuevo código
                </>
              )}
            </button>
          </div>
        ) : (
          <button 
            onClick={generateLinkingCode}
            disabled={codeLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-indigo-600/10"
          >
            {codeLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generando código...
              </>
            ) : (
              <>
                <MessageCircle size={16} />
                Generar código de vinculación
              </>
            )}
          </button>
        )}
      </div>

      {/* Acceso Móvil (Código Temporal) */}
      <div className="glass rounded-3xl p-5 border border-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-foreground">
            <Smartphone size={18} className="opacity-60 text-indigo-500" />
            <h2 className="text-sm font-extrabold tracking-tight">Acceso Móvil (Teléfono)</h2>
          </div>
        </div>

        {mobileCode ? (
          <div className="space-y-4">
            <div className="bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl p-4 text-center border border-indigo-500/10">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500/70 mb-2">Código de Acceso Temporal</p>
              <div className="bg-gray-900/90 dark:bg-gray-950/80 rounded-xl px-6 py-3 inline-block select-all border border-indigo-500/10">
                <p className="text-emerald-400 font-mono text-2xl font-black tracking-widest">{mobileCode}</p>
              </div>
              <p className="text-[10px] text-foreground/45 mt-2 font-semibold">Introduce este código de 6 dígitos en tu teléfono para ingresar.</p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl p-4 text-[10px] border border-amber-500/10 flex items-center justify-between">
              <div>
                <p className="font-extrabold text-amber-700 dark:text-amber-400 mb-0.5">⏰ El código expirará pronto</p>
                <p className="text-foreground/60 leading-normal">Válido únicamente para un solo inicio de sesión.</p>
              </div>
              <div className="text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg">
                {mobileCodeCountdown !== null ? `${Math.floor(mobileCodeCountdown / 60)}:${(mobileCodeCountdown % 60).toString().padStart(2, '0')}` : '0:00'}
              </div>
            </div>
            
            <button 
              onClick={generateMobileAuthCode}
              disabled={mobileCodeLoading}
              className="w-full flex items-center justify-center gap-1.5 text-[10px] text-indigo-500 hover:text-indigo-600 font-extrabold uppercase tracking-wider py-1 disabled:opacity-50 cursor-pointer"
            >
              {mobileCodeLoading ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <RefreshCw size={12} />
                  Generar otro código
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-foreground/60 leading-relaxed">
              ¿Quieres entrar desde tu teléfono y se queda la pantalla en blanco? Genera un código temporal aquí e ingrésalo en la pantalla de inicio de sesión de tu teléfono.
            </p>
            <button 
              onClick={generateMobileAuthCode}
              disabled={mobileCodeLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-indigo-600/10"
            >
              {mobileCodeLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generando código...
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  Generar código de acceso móvil
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Enhanced Category Editor Card */}
      <div className="glass rounded-3xl p-5 border border-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <h2 className="text-sm font-extrabold tracking-tight text-foreground">Gestión de Categorías</h2>
            <p className="text-[10px] text-foreground/45 mt-0.5">Define las clasificaciones de tu dinero</p>
          </div>
          <button 
            onClick={handleResetCategories}
            className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-500/80 hover:text-indigo-600 cursor-pointer"
          >
            <RefreshCw size={10} /> Restablecer
          </button>
        </div>

        {/* Tab switchers */}
        <div className="grid grid-cols-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-4">
          <button
            onClick={() => { setActiveCategoryTab('gastos'); setEditingCategory(null); }}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeCategoryTab === 'gastos' ? 'bg-white dark:bg-gray-700 text-rose-500 shadow-sm' : 'text-foreground/50'
            }`}
          >
            Gastos
          </button>
          <button
            onClick={() => { setActiveCategoryTab('ingresos'); setEditingCategory(null); }}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeCategoryTab === 'ingresos' ? 'bg-white dark:bg-gray-700 text-emerald-500 shadow-sm' : 'text-foreground/50'
            }`}
          >
            Ingresos
          </button>
        </div>
        
        {/* Add Input */}
        <div className="flex gap-2 mb-4">
          <input 
            value={newCategories}
            onChange={(e) => setNewCategories(e.target.value)}
            placeholder={`Nueva categoría de ${activeCategoryTab}...`}
            className="flex-1 bg-gray-50 dark:bg-gray-800 border border-border/40 px-4 py-2.5 rounded-xl text-xs text-foreground placeholder-foreground/30 focus:outline-none focus:border-indigo-500/50"
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          />
          <button 
            onClick={addCategory}
            className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 px-4 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
          >
            <Plus size={16} />
          </button>
        </div>
        
        {/* Category list */}
        <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1">
          {categoriesToDisplay.map((cat) => {
            const isEditingThis = editingCategory?.originalName === cat;

            return (
              <div 
                key={cat} 
                className="bg-gray-50 dark:bg-gray-800/40 border border-border/30 px-3 py-1.5 rounded-xl flex items-center gap-2 group animate-in fade-in duration-200"
              >
                {isEditingThis ? (
                  <input
                    autoFocus
                    value={editingCategory.newName}
                    onChange={(e) => setEditingCategory({ ...editingCategory, newName: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameCategory(cat, editingCategory.newName);
                      if (e.key === 'Escape') setEditingCategory(null);
                    }}
                    onBlur={() => handleRenameCategory(cat, editingCategory.newName)}
                    className="bg-white dark:bg-gray-900 border border-indigo-500/50 px-2 py-0.5 rounded text-xs text-foreground font-semibold focus:outline-none w-28"
                  />
                ) : (
                  <span className="text-xs font-semibold text-foreground">{cat}</span>
                )}

                <div className="flex items-center gap-1.5">
                  {!isEditingThis && (
                    <button
                      onClick={() => setEditingCategory({ originalName: cat, newName: cat })}
                      title="Renombrar"
                      className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity text-foreground"
                    >
                      <Edit2 size={12} />
                    </button>
                  )}
                  <button 
                    onClick={() => handleRemoveCategory(cat)} 
                    title="Eliminar"
                    className="opacity-40 hover:opacity-100 hover:text-rose-500 transition-all text-foreground"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            );
          })}

          {categoriesToDisplay.length === 0 && (
            <p className="text-xs opacity-40 text-center py-4 w-full font-medium">No hay categorías configuradas</p>
          )}
        </div>
      </div>

      {/* Bot command reference */}
      <div className="glass rounded-3xl p-5 border border-border shadow-sm">
        <h2 className="text-sm font-extrabold tracking-tight mb-3 text-foreground">Comandos del Asistente</h2>
        <div className="text-xs space-y-2 opacity-60 text-foreground leading-relaxed">
          <p>• <strong>"gasté 50 en comida"</strong> - Registrar gasto</p>
          <p>• <strong>"recibí 500"</strong> - Registrar ingreso</p>
          <p>• <strong>"mi saldo"</strong> - Ver saldos disponibles</p>
          <p>• <strong>"cuánto gasté en comida este mes"</strong> - Historial de categoría</p>
        </div>
      </div>

      {/* Account Info */}
      <div className="glass rounded-3xl p-5 border border-border shadow-sm flex flex-col space-y-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45 mb-1">Usuario</p>
          <p className="text-xs font-bold text-foreground">{auth.currentUser?.email}</p>
        </div>
        <button 
          onClick={handleLogout}
          className="w-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <LogOut size={14} /> Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
