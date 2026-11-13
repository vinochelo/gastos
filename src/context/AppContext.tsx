'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

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

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const newVal = !prev;
      localStorage.setItem('darkMode', String(newVal));
      document.documentElement.setAttribute('data-theme', newVal ? 'dark' : 'light');
      return newVal;
    });
  };

  const toggleHideAmounts = () => {
    setHideAmounts(prev => {
      const newVal = !prev;
      localStorage.setItem('hideAmounts', String(newVal));
      return newVal;
    });
  };

  const toggleReduceMotion = () => {
    setReduceMotion(prev => {
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

  return (
    <AppContext.Provider value={{
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
      confirmAction
    }}>
      {children}

      {/* Global Toast */}
      {toast && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-sm z-[250] animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-auto">
          <div className={`glass rounded-2xl px-4 py-3 shadow-2xl border flex items-center gap-3 ${
            toast.type === 'error'
              ? 'border-rose-500/40 bg-rose-50/95 dark:bg-rose-950/90 text-rose-700 dark:text-rose-200'
              : toast.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-50/95 dark:bg-emerald-950/90 text-emerald-700 dark:text-emerald-200'
              : 'border-indigo-500/30 bg-white/95 dark:bg-gray-900/95 text-foreground'
          }`}>
            {toast.type === 'error' ? (
              <AlertCircle size={18} className="shrink-0" />
            ) : toast.type === 'success' ? (
              <CheckCircle2 size={18} className="shrink-0" />
            ) : (
              <Info size={18} className="shrink-0 text-indigo-500" />
            )}
            <p className="text-xs font-bold flex-1 leading-snug">{toast.message}</p>
            <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 p-1 cursor-pointer">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Global Confirm Modal */}
      {confirmState && (
        <div className="fixed inset-0 z-[260] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-sm w-full border border-border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-foreground">{confirmState.title}</h3>
              <p className="text-xs text-foreground/65 leading-relaxed whitespace-pre-line">{confirmState.message}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleConfirmChoice(false)}
                className="py-3 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-700 text-foreground hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              >
                {confirmState.cancelText || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmChoice(true)}
                className={`py-3 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer ${
                  confirmState.destructive
                    ? 'bg-rose-500 hover:bg-rose-600'
                    : 'bg-indigo-600 hover:bg-indigo-700'
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
