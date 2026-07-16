'use client';

import { useState, useEffect } from "react";
import { useUserConfig } from "@/hooks/useFirestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc 
} from "firebase/firestore";
import { 
  Plus, X, ChevronLeft, TrendingUp, AlertTriangle, AlertCircle, CheckCircle, Trash2, Edit2, Menu 
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import CategoryIcon from "@/components/CategoryIcon";

interface Budget {
  id: string;
  userId: string;
  categoria: string;
  monto: number;
}

interface SpentSum {
  [category: string]: number;
}

export default function PresupuestosPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spent, setSpent] = useState<SpentSum>({});
  const [loading, setLoading] = useState(true);
  const { config } = useUserConfig();
  const { openDrawer, formatAmount } = useApp();
  const router = useRouter();

  // Modal states
  const [isOpen, setIsOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let unsubscribeBudgets: (() => void) | null = null;
    let unsubscribeTransactions: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeBudgets) unsubscribeBudgets();
      if (unsubscribeTransactions) unsubscribeTransactions();

      if (!user) {
        setBudgets([]);
        setSpent({});
        setLoading(false);
        return;
      }

      // 1. Listen to budgets
      const qBudgets = query(
        collection(db, "budgets"),
        where("userId", "==", user.uid)
      );
      unsubscribeBudgets = onSnapshot(qBudgets, (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Budget));
        setBudgets(list);
      });

      // 2. Listen to transactions of current month to calculate spent amount
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const qTx = query(
        collection(db, "transactions"),
        where("userId", "==", user.uid),
        where("timestamp", ">=", startOfMonth),
        where("tipo", "==", "gasto")
      );
      
      unsubscribeTransactions = onSnapshot(qTx, (snap) => {
        const sums: SpentSum = {};
        snap.docs.forEach(doc => {
          const tx = doc.data();
          const cat = tx.categoria || "Otros";
          sums[cat] = (sums[cat] || 0) + Number(tx.monto || 0);
        });
        setSpent(sums);
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeBudgets) unsubscribeBudgets();
      if (unsubscribeTransactions) unsubscribeTransactions();
    };
  }, []);

  const expenseCategories = config?.expenseCategories || [];

  const handleOpenCreate = () => {
    setEditingBudget(null);
    setCategory(expenseCategories[0] || "");
    setLimit("");
    setError(null);
    setIsOpen(true);
  };

  const handleOpenEdit = (b: Budget) => {
    setEditingBudget(b);
    setCategory(b.categoria);
    setLimit(b.monto.toString());
    setError(null);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !category || !limit) return;
    const limitNum = parseFloat(limit);
    if (isNaN(limitNum) || limitNum <= 0) {
      setError("Ingresa un límite de presupuesto válido.");
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      if (editingBudget) {
        // Edit mode
        await updateDoc(doc(db, "budgets", editingBudget.id), {
          categoria: category,
          monto: limitNum
        });
      } else {
        // Create mode
        // Check if budget for this category already exists
        const exists = budgets.find(b => b.categoria.toLowerCase() === category.toLowerCase());
        if (exists) {
          setError("Ya tienes un presupuesto asignado a esta categoría.");
          setActionLoading(false);
          return;
        }

        await addDoc(collection(db, "budgets"), {
          userId: auth.currentUser.uid,
          categoria: category,
          monto: limitNum
        });
      }
      setIsOpen(false);
    } catch (err) {
      console.error(err);
      setError("Error al guardar el presupuesto.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Deseas eliminar este presupuesto mensual?")) return;
    try {
      await deleteDoc(doc(db, "budgets", id));
    } catch (err) {
      console.error(err);
      alert("Error al eliminar");
    }
  };

  return (
    <div className="space-y-6 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
      
      {/* Header */}
      <div className="flex items-center justify-between py-2 border-b border-border/20">
        <div className="flex items-center gap-3">
          <button 
            onClick={openDrawer}
            className="md:hidden p-2 hover:bg-accent/40 rounded-xl transition-colors cursor-pointer"
            title="Abrir Menú"
          >
            <Menu size={20} className="opacity-70 text-foreground" />
          </button>
          <button 
            onClick={() => router.push('/')}
            className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
          >
            <ChevronLeft size={18} className="opacity-50 text-foreground" />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500/80 dark:text-indigo-400">Límites mensuales</p>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Presupuestos</h1>
          </div>
        </div>
        <button 
          onClick={handleOpenCreate}
          title="Crear Presupuesto"
          className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/10 active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Main Budget Grid */}
      <div className="space-y-4">
        {budgets.map((b) => {
          const spentVal = spent[b.categoria] || 0;
          const pct = Math.min(100, Math.round((spentVal / b.monto) * 100));
          const isOver = spentVal > b.monto;
          const isWarning = spentVal > b.monto * 0.75 && spentVal <= b.monto;
          
          let colorClass = "bg-green-500";
          let progressGlow = "shadow-green-500/10";
          let statusText = "Bajo control";
          let StatusIcon = CheckCircle;
          let textStatusColor = "text-green-500";

          if (isOver) {
            colorClass = "bg-rose-500 animate-pulse";
            progressGlow = "shadow-rose-500/20";
            statusText = "Excedido";
            StatusIcon = AlertCircle;
            textStatusColor = "text-rose-500 dark:text-rose-400 font-extrabold";
          } else if (isWarning) {
            colorClass = "bg-amber-500";
            progressGlow = "shadow-amber-500/10";
            statusText = "Límite cercano (75%+)";
            StatusIcon = AlertTriangle;
            textStatusColor = "text-amber-500 dark:text-amber-400";
          }

          return (
            <div key={b.id} className="glass p-5 rounded-3xl border border-border shadow-sm flex flex-col space-y-4 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                    <CategoryIcon 
                      categoryName={b.categoria}
                      userIconsMap={config?.categoryIcons}
                      className="w-5 h-5"
                      size={14}
                    />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-foreground tracking-tight">{b.categoria}</h3>
                    <p className="text-[10px] text-foreground/45 flex items-center gap-1 mt-0.5">
                      <StatusIcon size={10} className={textStatusColor} />
                      <span className={textStatusColor}>{statusText}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleOpenEdit(b)}
                    className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button 
                    onClick={() => handleDelete(b.id)}
                    className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-rose-500 opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Progress and values */}
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/40">Gastado / Presupuesto</p>
                    <p className="text-base font-black text-foreground mt-0.5">
                      {formatAmount(spentVal)} <span className="text-xs font-semibold text-foreground/40">de {formatAmount(b.monto)}</span>
                    </p>
                  </div>
                  <span className={`text-xs font-black tracking-tight ${textStatusColor}`}>
                    {pct}%
                  </span>
                </div>

                {/* Progress bar background */}
                <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-border/10">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 shadow-sm ${colorClass} ${progressGlow}`} 
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {budgets.length === 0 && !loading && (
          <div className="py-16 text-center glass rounded-3xl border-dashed border-2 border-border flex flex-col items-center justify-center p-6 space-y-4">
             <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <TrendingUp size={24} />
             </div>
             <div className="max-w-xs">
                <p className="text-sm text-foreground/60 font-semibold">Sin presupuestos asignados</p>
                <p className="text-xs text-foreground/40 mt-1">
                  Establece presupuestos para tus categorías de gastos principales y mantén tu dinero bajo control.
                </p>
             </div>
             <button 
              onClick={handleOpenCreate}
              className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-md"
             >
                Asignar Primer Presupuesto
             </button>
          </div>
        )}
      </div>

      {/* MODAL: Crear/Editar Presupuesto */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-lg text-foreground">
                  {editingBudget ? "Editar Presupuesto" : "Crear Presupuesto"}
                </h3>
                <p className="text-[10px] text-foreground/45 mt-0.5">Define un tope de consumo mensual</p>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 dark:bg-red-950/20 border border-red-500/10 p-3.5 rounded-2xl font-bold">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Categoría de Gasto</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 text-foreground"
                  required
                >
                  {expenseCategories.map(catName => (
                    <option key={catName} value={catName}>{catName}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Límite Mensual ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="200.00"
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <button 
                type="submit"
                disabled={actionLoading || !category || !limit}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 py-3.5 rounded-2xl font-bold text-sm tracking-wide shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? "Guardando..." : "Guardar Presupuesto"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
