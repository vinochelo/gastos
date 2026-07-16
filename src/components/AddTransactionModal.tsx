'use client';

import { useState, useEffect } from "react";
import { useAccounts, useUserConfig } from "@/hooks/useFirestore";
import { db, auth } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { X, ChevronDown, TrendingUp, TrendingDown, Tag, AlertCircle, Calendar, Calculator, Percent, Mic, Square, Loader2 } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { DEFAULT_CATEGORIES } from "@/lib/defaults";
import { getApiUrl } from "@/lib/api";
import CategoryIcon from "@/components/CategoryIcon";

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: "gasto" | "ingreso";
  initialData?: {
    monto?: number;
    descripcion?: string;
    categoria?: string;
    cuenta?: string;
    tipo?: "gasto" | "ingreso";
  } | null;
}

export default function AddTransactionModal({ isOpen, onClose, defaultType = "gasto", initialData = null }: AddTransactionModalProps) {
  const { accounts } = useAccounts();
  const { config } = useUserConfig();
  const [type, setType] = useState<"gasto" | "ingreso">(defaultType);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recording voice states
  const [isRecording, setIsRecording] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [toastLocal, setToastLocal] = useState<string | null>(null);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const showToastLocal = (msg: string) => {
    setToastLocal(msg);
    setTimeout(() => setToastLocal(null), 3000);
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await handleVoiceUpload(audioBlob);
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error(err);
      alert("No se pudo acceder al micrófono. Por favor concede permisos.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setIsRecording(false);
  };

  const handleVoiceUpload = async (blob: Blob) => {
    if (!auth.currentUser) return;
    setVoiceLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", blob, "voice.webm");
      formData.append("userId", auth.currentUser.uid);

      const res = await fetch(getApiUrl("/api/voice-input"), {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      if (data.result) {
        const result = data.result;
        if (result.monto) setAmount(result.monto.toString());
        if (result.descripcion) setDescription(result.descripcion);
        if (result.tipo && (result.tipo === "gasto" || result.tipo === "ingreso")) setType(result.tipo);
        
        if (result.cuenta) {
          const matchedAcc = accounts.find(a => 
            a.nombre.toLowerCase().includes(result.cuenta!.toLowerCase()) ||
            result.cuenta!.toLowerCase().includes(a.nombre.toLowerCase())
          );
          if (matchedAcc) setAccountId(matchedAcc.id);
        }

        const targetCategories = (result.tipo || type) === "gasto" ? expenseCategories : incomeCategories;
        if (result.categoria) {
          const matchedCat = targetCategories.find(c => 
            c.toLowerCase().includes(result.categoria!.toLowerCase()) || 
            result.categoria!.toLowerCase().includes(c.toLowerCase())
          );
          if (matchedCat) setCategory(matchedCat);
        }
        
        showToastLocal("Campos completados por voz!");
      } else {
        setError("La IA no pudo clasificar este audio. Transcripción: \"" + data.text + "\"");
      }
    } catch (err: any) {
      console.error(err);
      setError("Error al procesar audio: " + (err.message || "intenta de nuevo"));
    } finally {
      setVoiceLoading(false);
    }
  };

  const expenseCategories = [...(config?.expenseCategories?.length ? config.expenseCategories : DEFAULT_CATEGORIES)].sort((a, b) => a.localeCompare(b, 'es'));
  const incomeCategories = [...(config?.incomeCategories?.length ? config.incomeCategories : ["Salario", "Inversion", "Regalo", "Otro"])].sort((a, b) => a.localeCompare(b, 'es'));
  const categories = type === "gasto" ? expenseCategories : incomeCategories;

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const targetType = initialData.tipo || defaultType;
        setType(targetType);
        setAmount(initialData.monto ? initialData.monto.toString() : "");
        setDescription(initialData.descripcion || "");
        
        // Mapear cuenta
        let finalAccountId = "";
        if (initialData.cuenta) {
          const matchedAcc = accounts.find(a => 
            a.nombre.toLowerCase().includes(initialData.cuenta!.toLowerCase()) ||
            initialData.cuenta!.toLowerCase().includes(a.nombre.toLowerCase())
          );
          if (matchedAcc) finalAccountId = matchedAcc.id;
        }
        if (!finalAccountId) {
          const efectivoAcc = accounts.find(a => a.nombre.toLowerCase() === "efectivo");
          if (efectivoAcc) finalAccountId = efectivoAcc.id;
        }
        setAccountId(finalAccountId);

        // Mapear categoría
        const targetCategories = targetType === "gasto" ? expenseCategories : incomeCategories;
        if (initialData.categoria) {
          const matchedCat = targetCategories.find(c => c.toLowerCase().includes(initialData.categoria!.toLowerCase()) || initialData.categoria!.toLowerCase().includes(c.toLowerCase()));
          setCategory(matchedCat || (targetCategories.length > 0 ? targetCategories[0] : ""));
        } else {
          setCategory(targetCategories.length > 0 ? targetCategories[0] : "");
        }
      } else {
        setAmount("");
        setDescription("");
        setType(defaultType);
        const efectivoAcc = accounts.find(a => a.nombre.toLowerCase() === "efectivo");
        setAccountId(efectivoAcc ? efectivoAcc.id : "");
        setCategory(categories.length > 0 ? categories[0] : "");
      }
      setDate(new Date().toISOString().split('T')[0]);
      setError(null);
      setIsCategoryDropdownOpen(false);
    }
  }, [isOpen, defaultType, initialData, accounts]);

  useEffect(() => {
    if (isOpen && categories.length > 0 && !category) {
      setCategory(categories[0]);
    }
  }, [isOpen, categories, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert("Sesión expirada. Por favor, recarga la página.");
      return;
    }
    if (!amount || !accountId) return;

    const monto = parseFloat(amount);
    if (isNaN(monto) || monto <= 0) {
      setError("Ingresa un monto válido");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const mult = type === "ingreso" ? 1 : -1;
      
      await addDoc(collection(db, "transactions"), {
        userId: auth.currentUser.uid,
        monto,
        descripcion: description || category,
        categoria: category,
        accountId,
        tipo: type,
        timestamp: Timestamp.fromDate(new Date(date + "T12:00:00")),
        createdAt: serverTimestamp(),
        fuente: "web"
      });

      const accountRef = doc(db, "accounts", accountId);
      await updateDoc(accountRef, {
        saldo: increment(mult * monto)
      });

      setAmount("");
      setDescription("");
      setCategory("");
      setAccountId("");
      onClose();
    } catch (err) {
      console.error(err);
      setError("Error al guardar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center mb-5">
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl gap-1">
            <button 
              onClick={() => { setType("gasto"); setError(null); setIsCategoryDropdownOpen(false); }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${type === 'gasto' ? 'bg-red-500 text-white' : 'text-gray-500'}`}
            >
              <TrendingDown size={12} /> Gasto
            </button>
            <button 
              onClick={() => { setType("ingreso"); setError(null); setIsCategoryDropdownOpen(false); }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${type === 'ingreso' ? 'bg-green-500 text-white' : 'text-gray-500'}`}
            >
              <TrendingUp size={12} /> Ingreso
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={voiceLoading}
              title="Llenar con voz"
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isRecording 
                  ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/20' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-foreground/50 hover:text-foreground'
              }`}
            >
              {voiceLoading ? (
                <Loader2 size={16} className="animate-spin text-indigo-500" />
              ) : isRecording ? (
                <Square size={16} className="fill-current" />
              ) : (
                <Mic size={16} />
              )}
            </button>
            <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors cursor-pointer text-foreground/50 hover:text-foreground">
              <X size={20} />
            </button>
          </div>
        </div>
        
        {toastLocal && (
          <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-center py-2 px-4 rounded-xl text-xs font-bold mb-3 animate-in fade-in duration-300">
            {toastLocal}
          </div>
        )}
        
        {isRecording && (
          <div className="bg-rose-500/10 border border-rose-500/10 text-rose-500 dark:text-rose-400 text-center py-3 px-4 rounded-xl text-[10px] font-bold mb-3 flex items-center justify-center gap-2 animate-in zoom-in-95 duration-200">
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
            Escuchando audio... Haz clic en el botón de detener para procesar
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold ${type === 'gasto' ? 'text-red-400' : 'text-green-400'}`}>$</span>
            <input 
              type="number" 
              step="0.01"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(null); }}
              placeholder="0.00"
              className={`w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-3xl font-bold p-4 pl-10 rounded-xl text-center focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${type === 'gasto' ? 'text-red-500' : 'text-green-500'}`}
              required
            />
          </div>

          <div className="flex gap-2 mb-2">
             <button 
               type="button"
               onClick={() => {
                 const val = parseFloat(amount) || 0;
                 setAmount((val * 1.15).toFixed(2));
               }}
               className="flex-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-indigo-100 transition-colors"
             >
               <Percent size={10} /> +15% IVA
             </button>
             <button 
               type="button"
               onClick={() => {
                 const val = parseFloat(amount) || 0;
                 setAmount((val * 1.10).toFixed(2));
               }}
               className="flex-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-indigo-100 transition-colors"
             >
               <Percent size={10} /> +10% Prop
             </button>
             <button 
               type="button"
               onClick={() => {
                 const val = parseFloat(amount) || 0;
                 setAmount((val * 1.05).toFixed(2));
               }}
               className="flex-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-indigo-100 transition-colors"
             >
               <Percent size={10} /> +5% Int
             </button>
             <button 
               type="button"
               onClick={() => setAmount("")}
               className="px-3 bg-gray-50 dark:bg-gray-700 text-gray-400 py-2 rounded-lg text-[10px] font-bold hover:bg-gray-100 transition-colors"
             >
               AC
             </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1 flex items-center gap-1">
                  <Calendar size={10} /> Fecha
                </label>
                <input 
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  required
                />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1 flex items-center gap-1">
                  <Tag size={10} /> Detalle
                </label>
                <input 
                  type="text"
                  placeholder="Describe..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 relative">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Categoría</label>
              <button
                type="button"
                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                className="w-full flex items-center justify-between bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 text-left text-foreground cursor-pointer animate-in fade-in duration-200"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CategoryIcon 
                    categoryName={category}
                    userIconsMap={config?.categoryIcons}
                    className="w-5 h-5"
                    size={14}
                  />
                  <span className="truncate">{category || "Seleccionar..."}</span>
                </div>
                <span className="text-[9px] text-foreground/45">▼</span>
              </button>
              
              {isCategoryDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-gray-800 border border-border shadow-xl rounded-2xl z-50 max-h-56 overflow-y-auto p-1.5 space-y-0.5 animate-in fade-in duration-100">
                  {categories.map((c) => {
                    const isSelected = c === category;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setCategory(c);
                          setIsCategoryDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-bold text-foreground hover:bg-gray-50 dark:hover:bg-gray-700/40 text-left transition-colors cursor-pointer ${
                          isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-500 dark:text-indigo-400' : ''
                        }`}
                      >
                        <CategoryIcon 
                          categoryName={c}
                          userIconsMap={config?.categoryIcons}
                          className="w-4 h-4"
                          size={12}
                        />
                        <span className="truncate">{c}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Cuenta</label>
              <select 
                value={accountId}
                onChange={(e) => { setAccountId(e.target.value); setError(null); }}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Seleccionar...</option>
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.nombre}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-950/30 p-3 rounded-xl">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading || !amount || !accountId}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed ${type === 'gasto' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </div>
    </div>
  );
}
