'use client';
// Force rebuild - System reverted: 2026-03-25T09:33:00Z



import { useState, useEffect } from "react";
import { useAccounts, useRecentTransactions, useUserConfig, Transaction } from "@/hooks/useFirestore";
import { Plus, ArrowRightLeft, TrendingDown, TrendingUp, Wallet, Settings, MessageCircle, ChevronRight, Loader2, Mic, Square, AlertCircle, Sparkles, X } from "lucide-react";
import AddTransactionModal from "@/components/AddTransactionModal";
import TransferModal from "@/components/TransferModal";
import EditTransactionModal from "@/components/EditTransactionModal";
import CategoryChart from "@/components/CategoryChart";
import { auth, db } from "@/lib/firebase";
import { deleteDoc, doc, updateDoc, increment } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { getApiUrl } from "@/lib/api";
import CategoryIcon from "@/components/CategoryIcon";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { accounts } = useAccounts();
  const { transactions } = useRecentTransactions(100);
  const { config } = useUserConfig();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Voice recording state variables
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [initialVoiceData, setInitialVoiceData] = useState<any>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [timerInterval, setTimerInterval] = useState<any>(null);
  
  // AI analysis states
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);

  const fetchAiAnalysis = async () => {
    if (!user) return;
    setIsAiLoading(true);
    setAiAnalysis(null);
    try {
      const res = await fetch(getApiUrl("/api/analysis"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid })
      });
      const data = await res.json();
      if (data.analysis) {
        setAiAnalysis(data.analysis);
        setIsAnalysisModalOpen(true);
      } else {
        alert("Error: " + (data.error || "No se pudo generar el análisis"));
      }
    } catch (err) {
      console.error("Error fetching AI analysis:", err);
      alert("Error de conexión al generar el análisis.");
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
    setVoiceError(null);
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
      alert("No se pudo acceder al micrófono. Por favor, concede los permisos correspondientes.");
      setVoiceError("Permiso de micrófono denegado.");
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

  const handleVoiceUpload = async (blob: Blob) => {
    if (!user) return;
    setIsVoiceLoading(true);
    setVoiceError(null);
    try {
      const formData = new FormData();
      formData.append("file", blob, "voice.webm");
      formData.append("userId", user.uid);

      const res = await fetch(getApiUrl("/api/voice-input"), {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.result) {
        const result = data.result;
        if (result.tipo === "transferencia") {
          setInitialVoiceData(result);
          setIsTransferModalOpen(true);
        } else if (result.tipo === "gasto" || result.tipo === "ingreso") {
          setInitialVoiceData(result);
          setIsAddModalOpen(true);
        } else {
          alert(`Comando de voz detectado: ${result.tipo}. Mensaje: "${data.text}"`);
        }
      } else {
        alert(`Trascripción: "${data.text}". No pude clasificar esta transacción.`);
      }
    } catch (err: any) {
      console.error(err);
      setVoiceError(err.message || "Error al procesar la voz");
      alert("Error de procesamiento de voz: " + (err.message || "Intenta de nuevo."));
    } finally {
      setIsVoiceLoading(false);
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
      try {
        const ts = tx.timestamp;
        if (!ts) return; // Skip if timestamp is still pending (null)
        const txDate = 'toDate' in ts ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts as any));
        if (txDate.getMonth() === selectedMonth && txDate.getFullYear() === selectedYear) {
          if (tx.tipo === 'ingreso') income += Number(tx.monto || 0);
          else if (tx.tipo === 'gasto') expense += Number(tx.monto || 0);
        }
      } catch (e) {
        console.error("Error processing tx:", e);
      }
    });
    
    const totalBalance = accounts
      .filter(a => !a.nombre.toLowerCase().includes("ahorro"))
      .reduce((acc, a) => acc + Number(a.saldo || 0), 0);
    
    return { income, expense, totalBalance };
  }, [transactions, accounts, selectedMonth, selectedYear]);

  const recentTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const ts = tx.timestamp;
      if (!ts) return true; // Show pending
      const txDate = 'toDate' in ts ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts as any));
      return txDate.getMonth() === selectedMonth && txDate.getFullYear() === selectedYear;
    });
  }, [transactions, selectedMonth, selectedYear]);

  if (authLoading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 size={24} className="animate-spin text-indigo-500" />
    </div>
  );
  
  if (!user) {
    router.push("/login");
    return null;
  }

  const handleDeleteTx = async (tx: Transaction) => {
    if (!confirm("¿Eliminar?")) return;
    try {
      if (tx.tipo === 'transferencia') {
        if (tx.fromId) {
          await updateDoc(doc(db, "accounts", tx.fromId), { saldo: increment(tx.monto) });
        }
        if (tx.toId) {
          await updateDoc(doc(db, "accounts", tx.toId), { saldo: increment(-tx.monto) });
        }
      } else if (tx.accountId) {
        const mult = tx.tipo === 'ingreso' ? -1 : 1;
        await updateDoc(doc(db, "accounts", tx.accountId), { saldo: increment(mult * tx.monto) });
      }
      await deleteDoc(doc(db, "transactions", tx.id));
    } catch { alert("Error al eliminar"); }
  };

  const getAccountBalance = (accountId: string) => {
    const acc = accounts.find(a => a.id === accountId);
    return acc ? acc.saldo : 0;
  };

  return (
    <div className="space-y-6 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-row items-center justify-between gap-3 py-2 border-b border-border/20">
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
                <p className="text-[10px] text-foreground/45 uppercase tracking-wider font-extrabold">Groq Whisper & Llama 3</p>
                <p className="text-[10px] text-indigo-500 dark:text-indigo-400 italic max-w-[250px] mx-auto mt-2 leading-relaxed font-semibold">
                  Extrayendo montos, categorías, cuentas e intenciones de la transacción...
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Telegram Link Promo */}
      {!telegramLinked && (
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-3xl p-5 text-white shadow-xl shadow-indigo-500/10 border border-white/10 relative overflow-hidden group">
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
          <p className="text-2xl font-black tracking-tight leading-none">${stats.totalBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
        </div>
        
        <div className="glass rounded-3xl p-5 shadow-sm border border-border relative overflow-hidden glass-glow">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-20 h-20 bg-rose-500/5 dark:bg-rose-500/2 rounded-full blur-xl pointer-events-none" />
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-foreground/45 mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Gastado este mes
          </p>
          <p className="text-2xl font-black tracking-tight leading-none text-rose-500 dark:text-rose-400">${stats.expense.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* AI Financial Advisor Promo Card */}
      <div className="glass rounded-3xl p-5 border border-indigo-500/10 dark:border-indigo-500/20 shadow-sm relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/2 dark:to-purple-500/2 pointer-events-none" />
        
        <div className="flex items-start gap-4 relative z-10">
          <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-purple-500 text-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
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
                  ${Math.abs(balance).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
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
          {recentTransactions.slice(0, 5).map((tx) => {
            return (
              <div 
                key={tx.id} 
                className="glass rounded-2xl p-3.5 flex items-center justify-between border border-border shadow-sm hover:bg-white dark:hover:bg-gray-800/80 transition-all duration-300 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    tx.tipo === 'ingreso' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 
                    tx.tipo === 'transferencia' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' :
                    'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  }`}>
                    {tx.tipo === 'transferencia' ? (
                      <ArrowRightLeft size={16} />
                    ) : (
                      <CategoryIcon 
                        categoryName={tx.categoria}
                        userIconsMap={config?.categoryIcons}
                        className="w-6 h-6"
                        size={16}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate text-foreground">{tx.descripcion || tx.categoria}</p>
                    <p className="text-[10px] font-semibold text-foreground/35 uppercase tracking-wider">{tx.categoria}</p>
                  </div>
                </div>
              
              <div className="flex items-center gap-2">
                <p className={`text-sm font-black ${tx.tipo === 'ingreso' ? 'text-emerald-500' : 'text-foreground'}`}>
                  {tx.tipo === 'ingreso' ? '+' : '-'}${tx.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </p>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button 
                    onClick={() => setEditingTx(tx)}
                    title="Editar"
                    className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg text-indigo-500 transition-colors"
                  >
                    <Settings size={13} />
                  </button>
                  <button 
                    onClick={() => handleDeleteTx(tx)}
                    title="Eliminar"
                    className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-rose-500 transition-colors"
                  >
                    <TrendingDown size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

          {recentTransactions.length === 0 && (
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
            
            <div className="flex-1 overflow-y-auto pr-1 py-1 text-xs text-foreground/80 leading-relaxed font-sans space-y-3 whitespace-pre-line scrollbar-thin">
              {aiAnalysis}
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
