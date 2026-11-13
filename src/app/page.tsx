'use client';
// Force rebuild - System reverted: 2026-03-25T09:33:00Z



import { useState, useEffect, useMemo } from "react";
import {
  useAccounts,
  useMonthTransactions,
  useUserConfig,
  useBudgets,
  useDebts,
  useGoals,
  Transaction,
} from "@/hooks/useFirestore";
import { Plus, ArrowRightLeft, Settings, MessageCircle, ChevronRight, Loader2, Mic, Square, Sparkles, X, Menu, Send, TrendingUp, DollarSign, Target, CheckCircle, AlertTriangle, AlertCircle } from "lucide-react";
import AddTransactionModal from "@/components/AddTransactionModal";
import TransferModal from "@/components/TransferModal";
import EditTransactionModal from "@/components/EditTransactionModal";
import CategoryChart from "@/components/CategoryChart";
import TransactionItem from "@/components/TransactionItem";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import { deleteTransactionAtomic } from "@/lib/transactions";
import { evaluateBudgets, getBudgetStatusLabel, normalizeCategoryKey } from "@/lib/budgets";
import { useApp } from "@/context/AppContext";
import SplashLoading from "@/components/SplashLoading";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { openDrawer, formatAmount, showToast, confirmAction } = useApp();
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const { accounts } = useAccounts();
  const { transactions } = useMonthTransactions(selectedMonth, selectedYear);
  const { config } = useUserConfig();
  const { budgets } = useBudgets();
  const { debts } = useDebts();
  const { goals } = useGoals();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Voice recording state variables
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [initialVoiceData, setInitialVoiceData] = useState<any>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [timerInterval, setTimerInterval] = useState<any>(null);

  // Quick natural-language input state
  const [quickText, setQuickText] = useState("");
  const [isQuickTextLoading, setIsQuickTextLoading] = useState(false);
  
  // AI analysis states
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);

  const fetchAiAnalysis = async () => {
    if (!user) return;
    setIsAiLoading(true);
    setAiAnalysis(null);
    try {
      const res = await authFetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          month: selectedMonth,
          year: selectedYear
        })
      });
      const data = await res.json();
      if (data.analysis) {
        setAiAnalysis(data.analysis);
        setIsAnalysisModalOpen(true);
      } else {
        showToast(data.error || "No se pudo generar el análisis", "error");
      }
    } catch (err) {
      console.error("Error fetching AI analysis:", err);
      showToast("Error de conexión al generar el análisis.", "error");
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [timerInterval]);

  const startRecording = async () => {
    setRecordingDuration(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        
        // Turn off recording light on device
        stream.getTracks().forEach(track => track.stop());

        await handleVoiceUpload(audioBlob);
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);

      const interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      setTimerInterval(interval);

    } catch (err: any) {
      console.error(err);
      showToast("No se pudo acceder al micrófono. Concede los permisos correspondientes.", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  };

  const openParsedResult = (result: any, sourceText: string) => {
    if (!result) {
      showToast(`No pude clasificar "${sourceText}". Intenta incluir monto y detalle.`, "info");
      return;
    }
    if (result.tipo === "transferencia") {
      setInitialVoiceData(result);
      setIsTransferModalOpen(true);
    } else if (result.tipo === "gasto" || result.tipo === "ingreso") {
      setInitialVoiceData(result);
      setIsAddModalOpen(true);
    } else {
      showToast(`Detectado: ${result.tipo}. Usa un gasto, ingreso o transferencia.`, "info");
    }
  };

  const handleVoiceUpload = async (blob: Blob) => {
    if (!user) return;
    setIsVoiceLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, "voice.webm");

      const res = await authFetch("/api/voice-input", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      openParsedResult(data.result, data.text);
    } catch (err: any) {
      console.error(err);
      showToast("Error de procesamiento de voz: " + (err.message || "Intenta de nuevo."), "error");
    } finally {
      setIsVoiceLoading(false);
    }
  };

  const handleQuickTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !quickText.trim() || isQuickTextLoading) return;
    setIsQuickTextLoading(true);
    try {
      const res = await authFetch("/api/text-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: quickText.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setQuickText("");
      openParsedResult(data.result, data.text);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Error al interpretar el texto.", "error");
    } finally {
      setIsQuickTextLoading(false);
    }
  };

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        month: d.getMonth(),
        year: d.getFullYear(),
        label: d.toLocaleString('es-ES', { month: 'long', year: 'numeric' })
      });
    }
    return options;
  }, []);

  const telegramLinked = !!config?.telegramId;

  const stats = useMemo(() => {
    if (!transactions || !accounts) return { income: 0, expense: 0, totalBalance: 0 };

    let income = 0, expense = 0;

    transactions.forEach(tx => {
      if (tx.tipo === 'ingreso') income += Number(tx.monto || 0);
      else if (tx.tipo === 'gasto') expense += Number(tx.monto || 0);
    });

    const totalBalance = accounts
      .filter(a => !a.nombre.toLowerCase().includes("ahorro"))
      .reduce((acc, a) => acc + Number(a.saldo || 0), 0);

    return { income, expense, totalBalance };
  }, [transactions, accounts]);

  const budgetEvaluation = useMemo(() => {
    const spentMap: Record<string, number> = {};
    transactions.forEach(tx => {
      if (tx.tipo === 'gasto') {
        const key = normalizeCategoryKey(tx.categoria);
        spentMap[key] = (spentMap[key] || 0) + Number(tx.monto || 0);
      }
    });
    return evaluateBudgets(budgets, spentMap, selectedYear, selectedMonth);
  }, [budgets, transactions, selectedYear, selectedMonth]);

  const moduleSummary = useMemo(() => {
    const activeBudgets = budgets.length;
    const pendingDebt = debts
      .filter(d => !d.pagado && d.tipo === "debo")
      .reduce((sum, d) => sum + Number(d.monto || 0), 0);
    const pendingCollect = debts
      .filter(d => !d.pagado && d.tipo === "me_deben")
      .reduce((sum, d) => sum + Number(d.monto || 0), 0);
    const activeGoals = goals.length;
    const totalSaved = goals.reduce((sum, g) => sum + Number(g.montoActual || 0), 0);
    return { activeBudgets, pendingDebt, pendingCollect, activeGoals, totalSaved };
  }, [budgets, debts, goals]);

  if (authLoading) return <SplashLoading />;
  
  if (!user) {
    router.push("/login");
    return null;
  }

  const handleDeleteTx = async (tx: Transaction) => {
    const confirmed = await confirmAction({
      title: "Eliminar transacción",
      message: `¿Deseas eliminar "${tx.descripcion || tx.categoria}" por ${formatAmount(tx.monto)}? Se revertirá el saldo en la cuenta.`,
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await deleteTransactionAtomic(tx);
      showToast("Transacción eliminada", "success");
    } catch {
      showToast("Error al eliminar transacción", "error");
    }
  };

  const getAccountBalance = (accountId: string) => {
    const acc = accounts.find(a => a.id === accountId);
    return acc ? acc.saldo : 0;
  };

  return (
    <div className="space-y-6 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-row items-center justify-between gap-3 py-2 border-b border-border/20">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={openDrawer}
            className="md:hidden p-2 hover:bg-accent/40 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Abrir Menú"
          >
            <Menu size={20} className="opacity-70 text-foreground" />
          </button>
          <div className="flex flex-col min-w-0">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-500/80 dark:text-indigo-400">Panel de Control</p>
            <select
              value={`${selectedMonth}-${selectedYear}`}
              onChange={(e) => {
                const [m, y] = e.target.value.split('-').map(Number);
                setSelectedMonth(m);
                setSelectedYear(y);
              }}
              className="text-xl sm:text-2xl font-black bg-transparent border-none p-0 pr-8 m-0 focus:ring-0 text-foreground cursor-pointer capitalize font-sans tracking-tight focus:outline-none hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
            >
              {monthOptions.map(opt => (
                <option key={`${opt.month}-${opt.year}`} value={`${opt.month}-${opt.year}`} className="bg-white dark:bg-gray-800 text-foreground text-sm">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mic Button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isVoiceLoading}
            title="Ingreso por voz"
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-sm shrink-0 ${
              isRecording 
                ? 'bg-rose-500 text-white shadow-rose-500/20 shadow-lg' 
                : 'bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/30'
            }`}
          >
            {isVoiceLoading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : isRecording ? (
              <Square size={13} className="fill-current animate-pulse" />
            ) : (
              <Mic size={15} />
            )}
          </button>

          {/* Add Transaction Button */}
          <button
            onClick={() => { setInitialVoiceData(null); setIsAddModalOpen(true); }}
            title="Agregar Movimiento"
            className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-xl h-9 w-9 sm:h-10 sm:w-auto sm:px-4 flex items-center justify-center gap-1.5 font-bold text-xs shadow-md shadow-indigo-600/10 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Agregar Movimiento</span>
          </button>

          {/* Transfer Button */}
          <button
            onClick={() => { setInitialVoiceData(null); setIsTransferModalOpen(true); }}
            title="Transferir"
            className="w-9 h-9 sm:w-10 sm:h-10 bg-white dark:bg-gray-800 border border-border rounded-xl flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 cursor-pointer shadow-sm text-foreground/70 hover:text-foreground shrink-0"
          >
            <ArrowRightLeft size={15} />
          </button>

          {/* Settings Button */}
          <button 
            onClick={() => router.push('/ajustes')}
            title="Ajustes"
            className="w-9 h-9 sm:w-10 sm:h-10 bg-white dark:bg-gray-800 border border-border rounded-xl flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 cursor-pointer shadow-sm text-foreground/70 hover:text-foreground shrink-0"
          >
            <Settings size={15} className="opacity-80" />
          </button>
        </div>
      </div>

      {/* Voice Recording Feedback Panel */}
      {(isRecording || isVoiceLoading) && (
        <div className="glass rounded-3xl p-6 border border-indigo-500/30 shadow-xl shadow-indigo-500/10 animate-in zoom-in-95 duration-200 flex flex-col items-center justify-center space-y-4 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse" />
          
          {isRecording ? (
            <>
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-rose-500 flex items-center justify-center text-white border border-rose-600 shadow-lg shadow-rose-500/30 animate-pulse relative z-10">
                  <Mic size={24} />
                </div>
                <span className="absolute -inset-1 rounded-full bg-rose-500/20 animate-ping z-0"></span>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-black tracking-tight text-foreground">Asistente de Voz Activo</p>
                <p className="text-[10px] text-foreground/50 max-w-[280px] leading-relaxed mx-auto">
                  Habla con naturalidad, ej: <span className="italic font-bold text-indigo-500 dark:text-indigo-400">"Almuerzo ejecutivo $12.50 pagado con Efectivo"</span> o <span className="italic font-bold text-indigo-500 dark:text-indigo-400">"Transferencia de Banco a Efectivo por $50"</span>
                </p>
              </div>

              {/* Waveform Visualization */}
              <div className="flex items-center gap-1.5 justify-center py-2 h-8">
                <span className="wave-bar"></span>
                <span className="wave-bar"></span>
                <span className="wave-bar"></span>
                <span className="wave-bar"></span>
                <span className="wave-bar"></span>
                <span className="wave-bar"></span>
                <span className="wave-bar"></span>
                <span className="wave-bar"></span>
              </div>

              <div className="flex items-center justify-between gap-6 bg-gray-50 dark:bg-gray-900/65 border border-border/40 px-4 py-2 rounded-2xl w-full max-w-[280px] mx-auto">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" /> Grabando
                </span>
                <span className="text-sm font-mono font-black text-foreground">
                  {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                </span>
              </div>

              <button 
                onClick={stopRecording}
                className="w-full max-w-[280px] bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer shadow-lg shadow-rose-500/20 border border-rose-600 mx-auto"
              >
                <Square size={12} className="fill-current" /> Terminar y Procesar
              </button>
            </>
          ) : (
            <>
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center animate-spin">
                  <Loader2 size={28} />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black tracking-tight text-foreground">Analizando tu voz con IA...</p>
                <p className="text-[10px] text-foreground/45 uppercase tracking-wider font-extrabold">Groq Whisper & GPT-OSS 120B</p>
                <p className="text-[10px] text-indigo-500 dark:text-indigo-400 italic max-w-[250px] mx-auto mt-2 leading-relaxed font-semibold">
                  Extrayendo montos, categorías, cuentas e intenciones de la transacción...
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Quick Natural-Language Entry */}
      <form onSubmit={handleQuickTextSubmit} className="glass rounded-2xl p-2 border border-border shadow-sm flex items-center gap-2">
        <input
          type="text"
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
          placeholder='Registro rápido con IA: ej. "Gasté 12.50 en almuerzo con Produbanco"'
          className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-foreground placeholder-foreground/40 focus:outline-none font-medium min-w-0"
        />
        <button
          type="submit"
          disabled={!quickText.trim() || isQuickTextLoading}
          title="Interpretar con IA"
          className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
        >
          {isQuickTextLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          <span className="hidden sm:inline">Registrar</span>
        </button>
      </form>

      {/* Telegram Link Promo */}
      {!telegramLinked && (
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-teal-700 rounded-3xl p-5 text-white shadow-xl shadow-indigo-500/10 border border-white/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700" />
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-12 h-12 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/10">
              <MessageCircle size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-extrabold text-lg mb-1 tracking-tight">Activar Asistente de Voz</h3>
              <p className="text-xs text-white/80 mb-4 leading-relaxed max-w-md">
                Registra gastos al instante enviando notas de voz o textos por Telegram. Nuestro parser de IA inteligente se encargará de clasificarlos.
              </p>
              <button 
                onClick={() => router.push('/ajustes')}
                className="bg-white text-indigo-700 hover:bg-gray-50 px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer shadow-md"
              >
                Vincular Telegram
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <CategoryChart onEdit={setEditingTx} onDelete={handleDeleteTx} selectedMonth={selectedMonth} selectedYear={selectedYear} />

      {/* Cards Statistics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 dark:from-indigo-950/50 dark:to-indigo-900/30 rounded-3xl p-5 text-white border border-indigo-500/10 shadow-lg shadow-indigo-500/10 relative overflow-hidden glass-glow">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-20 h-20 bg-white/5 rounded-full blur-xl" />
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-200 dark:text-indigo-400 mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Dinero Disponible
          </p>
          <p className="text-2xl font-black tracking-tight leading-none">{formatAmount(stats.totalBalance)}</p>
        </div>
        
        <div className="glass rounded-3xl p-5 shadow-sm border border-border relative overflow-hidden glass-glow">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-20 h-20 bg-rose-500/5 dark:bg-rose-500/2 rounded-full blur-xl pointer-events-none" />
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-foreground/45 mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Gastado este mes
          </p>
          <p className="text-2xl font-black tracking-tight leading-none text-rose-500 dark:text-rose-400">{formatAmount(stats.expense)}</p>
        </div>
      </div>

      {/* AI Financial Advisor Promo Card */}
      <div className="glass rounded-3xl p-5 border border-indigo-500/10 dark:border-indigo-500/20 shadow-sm relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-emerald-500/5 dark:from-indigo-500/5 dark:to-emerald-500/5 pointer-events-none" />
        
        <div className="flex items-start gap-4 relative z-10">
          <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-emerald-500 text-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
            <Sparkles size={22} className="animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-sm mb-1 tracking-tight text-foreground flex items-center gap-1.5">
              Asesor Financiero IA
              <span className="text-[8px] bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 font-extrabold uppercase px-1.5 py-0.5 rounded-full tracking-wider">Premium</span>
            </h3>
            <p className="text-[11px] text-foreground/60 leading-relaxed mb-3">
              Obtén un diagnóstico financiero personalizado del mes, identifica fugas de dinero y recibe consejos de ahorro de Gestor.AI.
            </p>
            
            <button 
              onClick={fetchAiAnalysis}
              disabled={isAiLoading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer disabled:pointer-events-none shadow-md shadow-indigo-600/10"
            >
              {isAiLoading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Analizando finanzas...
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  Analizar mis finanzas
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Planning Modules Quick Strip */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => router.push('/presupuestos')}
          className="glass rounded-2xl p-3.5 border border-border text-left hover:border-primary/40 transition-all cursor-pointer glass-glow"
        >
          <div className="flex items-center justify-between mb-1.5">
            <TrendingUp
              size={15}
              className={
                moduleSummary.activeBudgets === 0
                  ? "text-primary"
                  : budgetEvaluation.summary.status === "exceeded"
                  ? "text-rose-500"
                  : budgetEvaluation.summary.status === "warning"
                  ? "text-amber-500"
                  : "text-emerald-500"
              }
            />
            <ChevronRight size={13} className="opacity-35" />
          </div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/45">Presupuestos</p>
          <p
            className={`text-sm font-black mt-0.5 truncate ${
              moduleSummary.activeBudgets === 0
                ? "text-foreground"
                : budgetEvaluation.summary.status === "exceeded"
                ? "text-rose-500"
                : budgetEvaluation.summary.status === "warning"
                ? "text-amber-500"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {moduleSummary.activeBudgets === 0
              ? "Sin definir"
              : budgetEvaluation.summary.exceededCount > 0
              ? `${budgetEvaluation.summary.exceededCount} excedido(s)`
              : budgetEvaluation.summary.warningCount > 0
              ? `${budgetEvaluation.summary.warningCount} cerca límite`
              : `Dentro · ${budgetEvaluation.summary.pctRaw}%`}
          </p>
        </button>

        <button
          onClick={() => router.push('/deudas')}
          className="glass rounded-2xl p-3.5 border border-border text-left hover:border-primary/40 transition-all cursor-pointer glass-glow"
        >
          <div className="flex items-center justify-between mb-1.5">
            <DollarSign size={15} className="text-rose-500" />
            <ChevronRight size={13} className="opacity-35" />
          </div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/45">Por pagar</p>
          <p className="text-sm font-black text-foreground mt-0.5 truncate">{formatAmount(moduleSummary.pendingDebt)}</p>
        </button>

        <button
          onClick={() => router.push('/metas')}
          className="glass rounded-2xl p-3.5 border border-border text-left hover:border-primary/40 transition-all cursor-pointer glass-glow"
        >
          <div className="flex items-center justify-between mb-1.5">
            <Target size={15} className="text-emerald-500" />
            <ChevronRight size={13} className="opacity-35" />
          </div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/45">Metas ({moduleSummary.activeGoals})</p>
          <p className="text-sm font-black text-foreground mt-0.5 truncate">{formatAmount(moduleSummary.totalSaved)}</p>
        </button>
      </div>

      {/* Budget Health Indicator Card */}
      {budgets.length > 0 && (() => {
        const s = budgetEvaluation.summary;
        const StatusIcon =
          s.status === "exceeded"
            ? AlertCircle
            : s.status === "warning"
            ? AlertTriangle
            : CheckCircle;
        const barColor =
          s.status === "exceeded"
            ? "bg-rose-500"
            : s.status === "warning"
            ? "bg-amber-500"
            : "bg-emerald-500";
        const badgeStyle =
          s.status === "exceeded"
            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
            : s.status === "warning"
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";

        return (
          <button
            onClick={() => router.push('/presupuestos')}
            className="w-full text-left glass rounded-2xl p-4 border border-border hover:border-primary/40 transition-all cursor-pointer space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${badgeStyle}`}>
                  <StatusIcon size={12} />
                  {getBudgetStatusLabel(s.status)}
                </span>
                <span className="text-xs font-bold text-foreground/60 truncate">
                  {formatAmount(s.totalSpent)} / {formatAmount(s.totalBudgeted)}
                </span>
              </div>
              <span className="text-xs font-black text-foreground/75 shrink-0">{s.pctRaw}%</span>
            </div>

            <div className="relative w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${s.barPct}%` }}
              />
              {s.pace.isCurrentMonth && (
                <div
                  title={`Ritmo del mes: ${s.pace.expectedPct}%`}
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground/50 z-10"
                  style={{ left: `${s.pace.expectedPct}%` }}
                />
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] font-semibold text-foreground/55">
              <span>
                {s.remaining >= 0
                  ? `Te quedan ${formatAmount(s.remaining)} dentro del presupuesto`
                  : `Excedido por ${formatAmount(Math.abs(s.remaining))}`}
              </span>
              <span className="text-primary font-bold">Ver detalle →</span>
            </div>
          </button>
        );
      })()}

      {/* Cuentas Section */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground/60">Tus Cuentas</h2>
          <button onClick={() => router.push('/cuentas')} className="text-xs font-bold text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400">
            Ver detalles
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
          {accounts.map((acc) => {
            const balance = getAccountBalance(acc.id);
            return (
              <div 
                key={acc.id} 
                className="flex-shrink-0 glass rounded-2xl p-4 border border-border min-w-[150px] shadow-sm hover:scale-[1.02] hover:shadow-md transition-all duration-300"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 truncate mb-1">{acc.nombre}</p>
                <p className={`text-base font-black tracking-tight ${balance >= 0 ? 'text-foreground' : 'text-rose-500 dark:text-rose-400'}`}>
                  {formatAmount(balance)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground/60">Actividad Reciente</h2>
          <button onClick={() => router.push('/transacciones')} className="text-xs font-bold text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400">
            Ver todas →
          </button>
        </div>
        
        <div className="space-y-2.5">
          {transactions.slice(0, 5).map((tx) => (
            <TransactionItem
              key={tx.id}
              tx={tx}
              accounts={accounts}
              categoryIcons={config?.categoryIcons}
              formatAmount={formatAmount}
              onEdit={setEditingTx}
              onDelete={handleDeleteTx}
            />
          ))}

          {transactions.length === 0 && (
            <div className="py-8 text-center glass rounded-2xl border border-dashed border-border">
              <p className="text-sm text-foreground/40 font-medium">Sin transacciones registradas este mes</p>
            </div>
          )}
        </div>
      </div>

      <AddTransactionModal 
        isOpen={isAddModalOpen} 
        onClose={() => { setIsAddModalOpen(false); setInitialVoiceData(null); }} 
        initialData={initialVoiceData}
      />
      <TransferModal 
        isOpen={isTransferModalOpen} 
        onClose={() => { setIsTransferModalOpen(false); setInitialVoiceData(null); }} 
        initialData={initialVoiceData}
      />
      
      {editingTx && editingTx.id ? (
        <EditTransactionModal 
          key={editingTx.id}
          isOpen={true} 
          onClose={() => setEditingTx(null)} 
          transaction={editingTx}
        />
      ) : null}

      {/* AI Analysis Modal */}
      {isAnalysisModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-lg w-full border border-border shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between mb-4 border-b border-border/25 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-500 rounded-xl flex items-center justify-center">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-foreground leading-none">Diagnóstico de Gestor.AI</h3>
                  <p className="text-[9px] uppercase tracking-wider text-foreground/45 mt-1 font-bold">Asesor Financiero Personal</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAnalysisModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1 py-1 scrollbar-thin">
              {aiAnalysis ? <MarkdownRenderer content={aiAnalysis} /> : null}
            </div>
            
            <div className="mt-4 pt-3 border-t border-border/25 flex justify-end">
              <button 
                onClick={() => setIsAnalysisModalOpen(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 px-5 py-2.5 rounded-xl font-bold text-xs active:scale-95 transition-all cursor-pointer shadow-md"
              >
                Cerrar diagnóstico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
