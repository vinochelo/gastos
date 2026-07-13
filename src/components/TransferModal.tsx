'use client';

import { useState, useEffect } from "react";
import { useAccounts } from "@/hooks/useFirestore";
import { db, auth } from "@/lib/firebase";
import { collection, serverTimestamp, doc, increment, writeBatch, Timestamp } from "firebase/firestore";
import { X, ArrowRight, Loader2, Calendar, Mic, Square } from "lucide-react";
import { getApiUrl } from "@/lib/api";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    monto?: number;
    fromId?: string;
    toId?: string;
    fromCuenta?: string;
    toCuenta?: string;
  } | null;
}

export default function TransferModal({ isOpen, onClose, initialData = null }: TransferModalProps) {
  const { accounts } = useAccounts();
  const [amount, setAmount] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recording voice states
  const [isRecording, setIsRecording] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [toastLocal, setToastLocal] = useState<string | null>(null);

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
        
        const originName = result.fromCuenta || result.cuentaAnterior || result.from;
        const destName = result.toCuenta || result.cuenta || result.to;

        if (originName) {
          const matchedAcc = accounts.find(a => 
            a.nombre.toLowerCase().includes(originName.toLowerCase()) ||
            originName.toLowerCase().includes(a.nombre.toLowerCase())
          );
          if (matchedAcc) setFromId(matchedAcc.id);
        }

        if (destName) {
          const matchedAcc = accounts.find(a => 
            a.nombre.toLowerCase().includes(destName.toLowerCase()) ||
            destName.toLowerCase().includes(a.nombre.toLowerCase())
          );
          if (matchedAcc) setToId(matchedAcc.id);
        }
        
        showToastLocal("Campos completados por voz!");
      } else {
        setError("La IA no pudo clasificar la transferencia.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Error al procesar audio: " + (err.message || "intenta de nuevo"));
    } finally {
      setVoiceLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setAmount(initialData.monto ? initialData.monto.toString() : "");
        
        // Mapear fromCuenta
        if (initialData.fromCuenta) {
          const matchedAcc = accounts.find(a => 
            a.nombre.toLowerCase().includes(initialData.fromCuenta!.toLowerCase()) ||
            initialData.fromCuenta!.toLowerCase().includes(a.nombre.toLowerCase())
          );
          setFromId(matchedAcc ? matchedAcc.id : "");
        } else if (initialData.fromId) {
          setFromId(initialData.fromId);
        } else {
          setFromId("");
        }

        // Mapear toCuenta
        if (initialData.toCuenta) {
          const matchedAcc = accounts.find(a => 
            a.nombre.toLowerCase().includes(initialData.toCuenta!.toLowerCase()) ||
            initialData.toCuenta!.toLowerCase().includes(a.nombre.toLowerCase())
          );
          setToId(matchedAcc ? matchedAcc.id : "");
        } else if (initialData.toId) {
          setToId(initialData.toId);
        } else {
          setToId("");
        }
      } else {
        setAmount("");
        setFromId("");
        setToId("");
      }
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, initialData, accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert("Sesión expirada. Por favor, recarga la página.");
      return;
    }
    if (!amount || !fromId || !toId || fromId === toId) return;

    setLoading(true);
    try {
      const monto = parseFloat(amount);
      const batch = writeBatch(db);

      const fromAccount = accounts.find(a => a.id === fromId);
      const toAccount = accounts.find(a => a.id === toId);

      const txRef = doc(collection(db, "transactions"));
      batch.set(txRef, {
        userId: auth.currentUser.uid,
        monto,
        tipo: "transferencia",
        fromId,
        toId,
        fromNombre: fromAccount?.nombre,
        toNombre: toAccount?.nombre,
        descripcion: `Transferencia: ${fromAccount?.nombre} → ${toAccount?.nombre}`,
        categoria: "Transferencia",
        timestamp: Timestamp.fromDate(new Date(date + "T12:00:00")),
        createdAt: serverTimestamp(),
        fuente: "web"
      });

      const fromRef = doc(db, "accounts", fromId);
      batch.update(fromRef, { saldo: increment(-monto) });

      const toRef = doc(db, "accounts", toId);
      batch.update(toRef, { saldo: increment(monto) });

      await batch.commit();
      setAmount("");
      setFromId("");
      setToId("");
      onClose();
    } catch (error) {
      console.error(error);
      alert("Error al procesar la transferencia");
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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold">Transferencia</h2>
            <p className="text-xs text-gray-400">Entre tus cuentas</p>
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
            <button 
              type="button"
              onClick={onClose} 
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors cursor-pointer text-foreground/50 hover:text-foreground"
            >
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

        {error && (
          <div className="bg-red-500/10 text-red-500 text-center py-2 px-4 rounded-xl text-xs font-bold mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">$</span>
            <input 
              type="number" 
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-3xl font-bold p-4 pl-10 rounded-xl text-center focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1">
              <Calendar size={12} /> Fecha de Transferencia
            </label>
            <input 
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase">Desde</label>
              <select 
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Seleccionar...</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.nombre}</option>
                ))}
              </select>
            </div>
            
            <ArrowRight className="mt-6 text-gray-300" size={20} />
            
            <div className="flex-1 space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase">Hacia</label>
              <select 
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Seleccionar...</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading || !amount || !fromId || !toId || fromId === toId}
            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Procesando...
              </>
            ) : (
              "Transferir"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
