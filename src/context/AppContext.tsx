'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { authFetch } from '@/lib/api';
import {
  useAccounts,
  useBudgets,
  useUserConfig,
  Transaction,
} from '@/hooks/useFirestore';
import { DEFAULT_CATEGORIES } from '@/lib/defaults';
import { deleteTransactionAtomic } from '@/lib/transactions';
import {
  executeParsedItems,
  getSupportedAudioMimeType,
  ParsedVoiceItem,
} from '@/lib/voiceExecutor';

type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  id: number;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export interface VoiceReportState {
  id: number;
  text: string;
  fuente: string;
  summaryLines: string[];
  budgetNotes: string[];
  createdTransactions: Transaction[];
}

export interface VoiceModalState {
  type: 'transaction' | 'transfer';
  initialData: ParsedVoiceItem;
}

interface ParsedApiPayload {
  text?: string;
  items?: ParsedVoiceItem[];
  result?: ParsedVoiceItem | null;
}

interface AppContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  hideAmounts: boolean;
  toggleHideAmounts: () => void;
  reduceMotion: boolean;
  toggleReduceMotion: () => void;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  formatAmount: (amount: number) => string;
  showToast: (message: string, type?: ToastType) => void;
  confirmAction: (options: ConfirmOptions) => Promise<boolean>;
  // Global Voice Assistant
  isGlobalRecording: boolean;
  isGlobalVoiceLoading: boolean;
  recordingDuration: number;
  lastVoiceReport: VoiceReportState | null;
  clearVoiceReport: () => void;
  voiceModalState: VoiceModalState | null;
  closeVoiceModal: () => void;
  startGlobalVoiceRecording: () => Promise<void>;
  stopGlobalVoiceRecording: () => void;
  cancelGlobalVoiceRecording: () => void;
  processParsedVoiceOrText: (
    data: ParsedApiPayload,
    fuente?: string,
    monthTransactions?: Transaction[]
  ) => Promise<void>;
  undoLastVoiceReport: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [hideAmounts, setHideAmounts] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global Voice state
  const { accounts } = useAccounts();
  const { config } = useUserConfig();
  const { budgets } = useBudgets();

  const [isGlobalRecording, setIsGlobalRecording] = useState(false);
  const [isGlobalVoiceLoading, setIsGlobalVoiceLoading] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [lastVoiceReport, setLastVoiceReport] = useState<VoiceReportState | null>(null);
  const [voiceModalState, setVoiceModalState] = useState<VoiceModalState | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRecordingRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDark = localStorage.getItem('darkMode') === 'true';
      const savedHide = localStorage.getItem('hideAmounts') === 'true';
      const savedReduce = localStorage.getItem('reduceMotion');
      const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      setIsDarkMode(savedDark);
      setHideAmounts(savedHide);
      setReduceMotion(savedReduce !== null ? savedReduce === 'true' : Boolean(prefersReduced));

      document.documentElement.setAttribute('data-theme', savedDark ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const newVal = !prev;
      localStorage.setItem('darkMode', String(newVal));
      document.documentElement.setAttribute('data-theme', newVal ? 'dark' : 'light');
      return newVal;
    });
  };

  const toggleHideAmounts = () => {
    setHideAmounts((prev) => {
      const newVal = !prev;
      localStorage.setItem('hideAmounts', String(newVal));
      return newVal;
    });
  };

  const toggleReduceMotion = () => {
    setReduceMotion((prev) => {
      const newVal = !prev;
      localStorage.setItem('reduceMotion', String(newVal));
      return newVal;
    });
  };

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);

  const formatAmount = (amount: number) => {
    if (hideAmounts) {
      return '$ ••••';
    }
    const absVal = Math.abs(amount).toLocaleString('es-ES', { minimumFractionDigits: 2 });
    return amount < 0 ? `-$${absVal}` : `$${absVal}`;
  };

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const confirmAction = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmState(options);
    });
  }, []);

  const handleConfirmChoice = (accepted: boolean) => {
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setConfirmState(null);
    resolver?.(accepted);
  };

  const clearVoiceReport = useCallback(() => setLastVoiceReport(null), []);
  const closeVoiceModal = useCallback(() => setVoiceModalState(null), []);

  const processParsedVoiceOrText = useCallback(
    async (
      data: ParsedApiPayload,
      fuente = 'web_voice',
      monthTransactions?: Transaction[]
    ) => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        showToast('Inicia sesión para registrar movimientos.', 'error');
        return;
      }

      const sourceText = (data.text || '').trim();
      const items: ParsedVoiceItem[] =
        Array.isArray(data.items) && data.items.length > 0
          ? data.items
          : data.result
          ? [data.result]
          : [];

      if (items.length === 0 || (items.length === 1 && items[0].tipo === 'ayuda')) {
        showToast(
          sourceText
            ? `No pude clasificar "${sourceText}". Intenta incluir monto y detalle.`
            : 'No pude interpretar el mensaje. Intenta incluir monto y detalle.',
          'info'
        );
        return;
      }

      const expenseCategories = config?.expenseCategories?.length
        ? config.expenseCategories
        : DEFAULT_CATEGORIES;
      const incomeCategories = config?.incomeCategories?.length
        ? config.incomeCategories
        : ['Salario', 'Inversion', 'Regalo', 'Otro'];

      const execution = await executeParsedItems({
        userId: currentUser.uid,
        items,
        sourceText,
        fuente,
        accounts,
        expenseCategories,
        incomeCategories,
        budgets,
        monthTransactions,
      });

      if (execution.needsModal && execution.modalType && execution.modalInitialData) {
        setVoiceModalState({
          type: execution.modalType,
          initialData: execution.modalInitialData,
        });
        return;
      }

      if (execution.executed) {
        setLastVoiceReport({
          id: Date.now(),
          text: sourceText,
          fuente,
          summaryLines: execution.summaryLines,
          budgetNotes: execution.budgetNotes,
          createdTransactions: execution.createdTransactions,
        });
        if (execution.createdTransactions.length > 0) {
          showToast(
            execution.createdTransactions.length > 1
              ? `${execution.createdTransactions.length} movimientos registrados`
              : 'Movimiento registrado',
            'success'
          );
        }
      } else {
        showToast(
          sourceText
            ? `No pude ejecutar "${sourceText}".`
            : 'No se pudo completar la operación.',
          'info'
        );
      }
    },
    [accounts, budgets, config, showToast]
  );

  const uploadVoiceBlob = useCallback(
    async (blob: Blob, extension: string) => {
      if (!auth.currentUser) return;
      setIsGlobalVoiceLoading(true);
      try {
        const formData = new FormData();
        formData.append('file', blob, `voice.${extension}`);

        const res = await authFetch('/api/voice-input', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Error al procesar el audio');
        }
        await processParsedVoiceOrText(data, 'web_voice');
      } catch (err: unknown) {
        console.error('Error en voice upload:', err);
        const message = err instanceof Error ? err.message : 'Intenta de nuevo.';
        showToast(`Error de voz: ${message}`, 'error');
      } finally {
        setIsGlobalVoiceLoading(false);
      }
    },
    [processParsedVoiceOrText, showToast]
  );

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const startGlobalVoiceRecording = useCallback(async () => {
    if (!auth.currentUser) {
      showToast('Inicia sesión para dictar un movimiento.', 'info');
      return;
    }
    if (isGlobalRecording || isGlobalVoiceLoading) return;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      showToast('Tu navegador no soporta grabación de micrófono.', 'error');
      return;
    }

    setRecordingDuration(0);
    cancelRecordingRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { mimeType, extension } = getSupportedAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        stopRecordingTimer();

        if (cancelRecordingRef.current) {
          cancelRecordingRef.current = false;
          return;
        }

        const finalMime = mimeType || recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(chunks, { type: finalMime });
        if (audioBlob.size === 0) {
          showToast('No se capturó audio. Intenta de nuevo.', 'info');
          return;
        }
        await uploadVoiceBlob(audioBlob, extension);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsGlobalRecording(true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
      showToast(
        'No se pudo acceder al micrófono. Concede el permiso en el dispositivo.',
        'error'
      );
    }
  }, [isGlobalRecording, isGlobalVoiceLoading, showToast, uploadVoiceBlob]);

  const stopGlobalVoiceRecording = useCallback(() => {
    stopRecordingTimer();
    setIsGlobalRecording(false);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

  const cancelGlobalVoiceRecording = useCallback(() => {
    cancelRecordingRef.current = true;
    stopRecordingTimer();
    setIsGlobalRecording(false);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

  const undoLastVoiceReport = useCallback(async () => {
    if (!lastVoiceReport || lastVoiceReport.createdTransactions.length === 0) return;
    try {
      for (const tx of lastVoiceReport.createdTransactions) {
        await deleteTransactionAtomic(tx);
      }
      setLastVoiceReport(null);
      showToast('Registro por voz revertido', 'info');
    } catch (err) {
      console.error('Error undoing voice transactions:', err);
      showToast('No se pudo revertir el movimiento.', 'error');
    }
  }, [lastVoiceReport, showToast]);

  return (
    <AppContext.Provider
      value={{
        isDarkMode,
        toggleDarkMode,
        hideAmounts,
        toggleHideAmounts,
        reduceMotion,
        toggleReduceMotion,
        isDrawerOpen,
        openDrawer,
        closeDrawer,
        formatAmount,
        showToast,
        confirmAction,
        isGlobalRecording,
        isGlobalVoiceLoading,
        recordingDuration,
        lastVoiceReport,
        clearVoiceReport,
        voiceModalState,
        closeVoiceModal,
        startGlobalVoiceRecording,
        stopGlobalVoiceRecording,
        cancelGlobalVoiceRecording,
        processParsedVoiceOrText,
        undoLastVoiceReport,
      }}
    >
      {children}

      {/* Global Toast */}
      {toast && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-sm z-[250] animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-auto">
          <div
            className={`rounded-2xl px-4 py-3 shadow-2xl border backdrop-blur-xl flex items-center gap-3 ${
              toast.type === 'error'
                ? 'border-rose-500/40 bg-rose-50/95 dark:bg-rose-950/95 text-rose-700 dark:text-rose-200'
                : toast.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-50/95 dark:bg-emerald-950/95 text-emerald-700 dark:text-emerald-200'
                : 'border-border bg-card/95 text-foreground'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle size={18} className="shrink-0" />
            ) : toast.type === 'success' ? (
              <CheckCircle2 size={18} className="shrink-0" />
            ) : (
              <Info size={18} className="shrink-0 text-primary" />
            )}
            <p className="text-xs font-bold flex-1 leading-snug">{toast.message}</p>
            <button
              onClick={() => setToast(null)}
              className="opacity-60 hover:opacity-100 p-1 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Global Confirm Modal */}
      {confirmState && (
        <div className="fixed inset-0 z-[260] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card rounded-3xl p-6 max-w-sm w-full border border-border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-foreground">{confirmState.title}</h3>
              <p className="text-xs text-foreground/65 leading-relaxed whitespace-pre-line">
                {confirmState.message}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleConfirmChoice(false)}
                className="py-3 rounded-xl text-xs font-bold bg-accent text-foreground hover:opacity-85 transition-opacity cursor-pointer"
              >
                {confirmState.cancelText || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmChoice(true)}
                className={`py-3 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer ${
                  confirmState.destructive
                    ? 'bg-rose-500 hover:bg-rose-600'
                    : 'bg-primary hover:opacity-90'
                }`}
              >
                {confirmState.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
