'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Mic,
  Pencil,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Transaction } from '@/hooks/useFirestore';
import AddTransactionModal from '@/components/AddTransactionModal';
import TransferModal from '@/components/TransferModal';
import EditTransactionModal from '@/components/EditTransactionModal';

export default function GlobalVoiceAssistant() {
  const {
    isGlobalRecording,
    isGlobalVoiceLoading,
    recordingDuration,
    lastVoiceReport,
    clearVoiceReport,
    voiceModalState,
    closeVoiceModal,
    stopGlobalVoiceRecording,
    cancelGlobalVoiceRecording,
    undoLastVoiceReport,
  } = useApp();

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [undoLoading, setUndoLoading] = useState(false);

  const handleUndo = async () => {
    setUndoLoading(true);
    try {
      await undoLastVoiceReport();
    } finally {
      setUndoLoading(false);
    }
  };

  const handleEditTx = (tx: Transaction) => {
    clearVoiceReport();
    setEditingTx(tx);
  };

  return (
    <>
      {/* Recording / Processing Floating Panel */}
      {(isGlobalRecording || isGlobalVoiceLoading) && (
        <div className="fixed bottom-24 inset-x-4 md:inset-x-auto md:bottom-6 md:right-6 md:w-96 z-[140] animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="bg-card/95 backdrop-blur-xl rounded-3xl p-5 border border-primary/30 shadow-2xl space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" />

            {isGlobalRecording ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/25 relative z-10">
                        <Mic size={20} />
                      </div>
                      <span className="absolute -inset-1 rounded-2xl bg-rose-500/25 animate-ping z-0" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground">Escuchando tu voz...</p>
                      <p className="text-[11px] font-medium text-foreground/55">
                        Dicta el gasto, ingreso o transferencia
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-mono font-black px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-500">
                    {Math.floor(recordingDuration / 60)}:
                    {(recordingDuration % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-1.5 py-1 h-7">
                  <span className="wave-bar" />
                  <span className="wave-bar" />
                  <span className="wave-bar" />
                  <span className="wave-bar" />
                  <span className="wave-bar" />
                  <span className="wave-bar" />
                  <span className="wave-bar" />
                  <span className="wave-bar" />
                </div>

                <p className="text-[11px] text-foreground/55 text-center leading-relaxed bg-accent/60 rounded-2xl px-3 py-2">
                  Ej: <span className="font-semibold text-foreground">&ldquo;Gasté 12.50 en almuerzo con Produbanco&rdquo;</span>
                </p>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={cancelGlobalVoiceRecording}
                    className="py-2.5 rounded-xl text-xs font-bold bg-accent text-foreground/75 hover:text-foreground transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={stopGlobalVoiceRecording}
                    className="py-2.5 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/20 transition-all cursor-pointer"
                  >
                    <Square size={12} className="fill-current" />
                    Registrar ahora
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3.5 py-2">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Loader2 size={22} className="animate-spin" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground">Procesando con IA...</p>
                  <p className="text-[11px] text-foreground/55 leading-snug mt-0.5">
                    Transcribiendo audio y registrando tu movimiento en tiempo real.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Report Card */}
      {lastVoiceReport && !isGlobalRecording && !isGlobalVoiceLoading && (
        <div className="fixed bottom-24 inset-x-4 md:inset-x-auto md:bottom-6 md:right-6 md:w-[400px] z-[135] animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="bg-card/95 backdrop-blur-xl rounded-3xl p-4 sm:p-5 border border-emerald-500/30 shadow-2xl space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                  {lastVoiceReport.fuente === 'web_voice' ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <Sparkles size={18} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-foreground">
                    {lastVoiceReport.fuente === 'web_voice'
                      ? 'Registrado por Voz IA'
                      : 'Procesado con IA'}
                  </p>
                  {lastVoiceReport.text && (
                    <p className="text-[11px] text-foreground/55 italic truncate">
                      &ldquo;{lastVoiceReport.text}&rdquo;
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={clearVoiceReport}
                className="p-1.5 rounded-xl hover:bg-accent text-foreground/50 hover:text-foreground transition-colors cursor-pointer shrink-0"
                title="Cerrar"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-1.5 bg-accent/55 rounded-2xl p-3">
              {lastVoiceReport.summaryLines.map((line, idx) => {
                const tx = lastVoiceReport.createdTransactions[idx];
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 text-xs font-semibold text-foreground"
                  >
                    <span className="leading-snug flex-1">{line}</span>
                    {tx && lastVoiceReport.createdTransactions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleEditTx(tx)}
                        className="p-1 rounded-lg hover:bg-card text-primary cursor-pointer shrink-0"
                        title="Editar movimiento"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {lastVoiceReport.budgetNotes.length > 0 && (
              <div className="space-y-1">
                {lastVoiceReport.budgetNotes.map((note, idx) => (
                  <p
                    key={idx}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                  >
                    {note}
                  </p>
                ))}
              </div>
            )}

            {lastVoiceReport.createdTransactions.length > 0 && (
              <div className="flex items-center gap-2 pt-0.5">
                {lastVoiceReport.createdTransactions.length === 1 && (
                  <button
                    type="button"
                    onClick={() => handleEditTx(lastVoiceReport.createdTransactions[0])}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-accent hover:opacity-85 text-foreground flex items-center justify-center gap-1.5 transition-opacity cursor-pointer"
                  >
                    <Pencil size={13} />
                    Editar
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoLoading}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {undoLoading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <RotateCcw size={13} />
                  )}
                  Deshacer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fallback Modals for incomplete parsed items */}
      <AddTransactionModal
        isOpen={voiceModalState?.type === 'transaction'}
        onClose={closeVoiceModal}
        defaultType={voiceModalState?.initialData.tipo === 'ingreso' ? 'ingreso' : 'gasto'}
        initialData={
          voiceModalState?.type === 'transaction'
            ? {
                monto: voiceModalState.initialData.monto,
                descripcion: voiceModalState.initialData.descripcion,
                categoria: voiceModalState.initialData.categoria,
                subcategoria: voiceModalState.initialData.subcategoria,
                cuenta: voiceModalState.initialData.cuenta,
                fecha: voiceModalState.initialData.fecha,
                tipo: voiceModalState.initialData.tipo === 'ingreso' ? 'ingreso' : 'gasto',
              }
            : null
        }
      />

      <TransferModal
        isOpen={voiceModalState?.type === 'transfer'}
        onClose={closeVoiceModal}
        initialData={
          voiceModalState?.type === 'transfer'
            ? {
                monto: voiceModalState.initialData.monto,
                fromCuenta:
                  voiceModalState.initialData.fromCuenta ||
                  voiceModalState.initialData.cuentaAnterior,
                toCuenta:
                  voiceModalState.initialData.toCuenta || voiceModalState.initialData.cuenta,
                fecha: voiceModalState.initialData.fecha,
              }
            : null
        }
      />

      {editingTx && (
        <EditTransactionModal
          key={editingTx.id}
          isOpen={true}
          onClose={() => setEditingTx(null)}
          transaction={editingTx}
        />
      )}
    </>
  );
}
