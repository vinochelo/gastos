'use client';

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, increment 
} from "firebase/firestore";
import { 
  Plus, X, ChevronLeft, Target, Trash2, Menu, AlertCircle, Calendar,
  Car, Home, Palmtree, GraduationCap, ShieldAlert, Heart, Wine, Baby
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";

interface Goal {
  id: string;
  userId: string;
  nombre: string;
  montoObjetivo: number;
  montoActual: number;
  categoriaIcono: string;
  fechaLimite: string;
}

interface TemplateOption {
  key: string;
  name: string;
  icon: any;
  color: string;
  bg: string;
}

const TEMPLATES: Record<string, TemplateOption> = {
  "coche": { key: "coche", name: "Vehículo Nuevo", icon: Car, color: "text-sky-500", bg: "bg-sky-500/10" },
  "casa": { key: "casa", name: "Casa Nueva", icon: Home, color: "text-amber-500", bg: "bg-amber-500/10" },
  "viaje": { key: "viaje", name: "Viaje de Vacaciones", icon: Palmtree, color: "text-green-500", bg: "bg-green-500/10" },
  "educacion": { key: "educacion", name: "Educación", icon: GraduationCap, color: "text-indigo-500", bg: "bg-indigo-500/10" },
  "emergencia": { key: "emergencia", name: "Fondo de Emergencia", icon: ShieldAlert, color: "text-purple-500", bg: "bg-purple-500/10" },
  "salud": { key: "salud", name: "Cuidado de Salud", icon: Heart, color: "text-rose-500", bg: "bg-rose-500/10" },
  "fiesta": { key: "fiesta", name: "Fiesta / Evento", icon: Wine, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  "ninos": { key: "ninos", name: "Mimos para los Niños", icon: Baby, color: "text-pink-500", bg: "bg-pink-500/10" },
};

export default function MetasPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const { openDrawer, formatAmount } = useApp();
  const router = useRouter();

  // Create Goal modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [montoObjetivo, setMontoObjetivo] = useState("");
  const [montoActual, setMontoActual] = useState("");
  const [categoriaIcono, setCategoriaIcono] = useState("emergencia");
  const [fechaLimite, setFechaLimite] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Add funds modal state
  const [savingGoal, setSavingGoal] = useState<Goal | null>(null);
  const [fundAmount, setFundAmount] = useState("");
  const [fundLoading, setFundLoading] = useState(false);

  useEffect(() => {
    let unsubscribeGoals: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeGoals) unsubscribeGoals();

      if (!user) {
        setGoals([]);
        setLoading(false);
        return;
      }

      // Listen to goals
      const qGoals = query(
        collection(db, "goals"),
        where("userId", "==", user.uid)
      );
      
      unsubscribeGoals = onSnapshot(qGoals, (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal));
        setGoals(list);
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeGoals) unsubscribeGoals();
    };
  }, []);

  const handleOpenCreate = () => {
    setNombre("");
    setMontoObjetivo("");
    setMontoActual("0");
    setCategoriaIcono("emergencia");
    setFechaLimite(new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate()).toISOString().split('T')[0]);
    setError(null);
    setIsCreateOpen(true);
  };

  const handleApplyTemplate = (tpl: TemplateOption) => {
    setNombre(tpl.name);
    setCategoriaIcono(tpl.key);
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !nombre || !montoObjetivo) return;

    const targetNum = parseFloat(montoObjetivo);
    const initialNum = parseFloat(montoActual) || 0;

    if (isNaN(targetNum) || targetNum <= 0) {
      setError("Ingresa un monto objetivo válido.");
      return;
    }

    setCreateLoading(true);
    setError(null);

    try {
      await addDoc(collection(db, "goals"), {
        userId: auth.currentUser.uid,
        nombre: nombre.trim(),
        montoObjetivo: targetNum,
        montoActual: initialNum,
        categoriaIcono,
        fechaLimite
      });
      setIsCreateOpen(false);
    } catch (err) {
      console.error(err);
      setError("Error al crear la meta.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savingGoal || !fundAmount) return;

    const amountNum = parseFloat(fundAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Monto inválido");
      return;
    }

    setFundLoading(true);

    try {
      await updateDoc(doc(db, "goals", savingGoal.id), {
        montoActual: increment(amountNum)
      });
      setSavingGoal(null);
      setFundAmount("");
    } catch (err) {
      console.error(err);
      alert("Error al añadir fondos");
    } finally {
      setFundLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta meta de ahorro?")) return;
    try {
      await deleteDoc(doc(db, "goals", id));
    } catch (err) {
      console.error(err);
      alert("Error al eliminar");
    }
  };

  return (
    <div className="space-y-6 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />
      
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
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500/80 dark:text-emerald-400">Objetivos de Ahorro</p>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Metas</h1>
          </div>
        </div>
        <button 
          onClick={handleOpenCreate}
          title="Crear Meta"
          className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/10 active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Goals grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map((g) => {
          const tpl = TEMPLATES[g.categoriaIcono] || TEMPLATES["emergencia"];
          const Icon = tpl.icon;
          const pct = Math.min(100, Math.round((g.montoActual / g.montoObjetivo) * 100));

          return (
            <div key={g.id} className="glass p-5 rounded-3xl border border-border shadow-sm flex flex-col space-y-4 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl ${tpl.bg} ${tpl.color} flex items-center justify-center`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-foreground tracking-tight leading-tight">{g.nombre}</h3>
                    <p className="text-[9px] text-foreground/45 mt-1 font-semibold">Vence: {g.fechaLimite}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setSavingGoal(g)}
                    title="Añadir Ahorro"
                    className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold px-3 py-2 rounded-xl text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    + Ahorrar
                  </button>
                  <button 
                    onClick={() => handleDelete(g.id)}
                    className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-rose-500 cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/40">Ahorrado</p>
                    <p className="text-base font-black text-foreground mt-0.5">
                      {formatAmount(g.montoActual)} <span className="text-xs font-semibold text-foreground/40">de {formatAmount(g.montoObjetivo)}</span>
                    </p>
                  </div>
                  <span className="text-xs font-black tracking-tight text-indigo-500 dark:text-indigo-400">
                    {pct}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-border/10">
                  <div 
                    className="h-full rounded-full transition-all duration-500 shadow-sm bg-gradient-to-r from-emerald-400 to-indigo-500" 
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {goals.length === 0 && !loading && (
          <div className="col-span-full py-16 text-center glass rounded-3xl border-dashed border-2 border-border flex flex-col items-center justify-center p-6 space-y-4">
             <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <Target size={24} />
             </div>
             <div className="max-w-xs">
                <p className="text-sm text-foreground/60 font-semibold">Sin objetivos de ahorro</p>
                <p className="text-xs text-foreground/40 mt-1">
                  Crea metas específicas para tus planes (comprar un auto, vacaciones, fondos de emergencia) y añade tus ahorros progresivamente.
                </p>
             </div>
             <button 
              onClick={handleOpenCreate}
              className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-md"
             >
                Crear Mi Primer Objetivo
             </button>
          </div>
        )}
      </div>

      {/* MODAL: Crear Meta */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl p-6 space-y-5 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-lg text-foreground">¿Para qué estás ahorrando?</h3>
                <p className="text-[10px] text-foreground/45 mt-0.5">Ingresa los datos del objetivo</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
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

            {/* Template options (from screenshot!) */}
            <div className="space-y-2">
              <label className="text-[9px] font-extrabold uppercase tracking-widest text-foreground/40 block">Plantillas sugeridas</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.values(TEMPLATES).map((tpl) => {
                  const TplIcon = tpl.icon;
                  const isSelected = categoriaIcono === tpl.key;
                  return (
                    <button
                      key={tpl.key}
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className={`flex flex-col items-center justify-center p-2 rounded-2xl border transition-all hover:scale-[1.03] cursor-pointer ${
                        isSelected 
                          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20" 
                          : "border-border/30 bg-gray-50/30 dark:bg-gray-900/10"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl ${tpl.bg} ${tpl.color} flex items-center justify-center mb-1`}>
                        <TplIcon size={16} />
                      </div>
                      <span className="text-[7px] font-bold text-foreground/75 text-center leading-none truncate w-full">{tpl.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Nombre del Objetivo</label>
                <input 
                  type="text" 
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Vehículo nuevo, Casa nueva..."
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Monto Objetivo ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={montoObjetivo}
                    onChange={(e) => setMontoObjetivo(e.target.value)}
                    placeholder="10000.00"
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Ahorro Inicial ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={montoActual}
                    onChange={(e) => setMontoActual(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Fecha Límite</label>
                <input 
                  type="date"
                  value={fechaLimite}
                  onChange={(e) => setFechaLimite(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <button 
                type="submit"
                disabled={createLoading || !nombre || !montoObjetivo}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 py-3.5 rounded-2xl font-bold text-sm tracking-wide shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer animate-in duration-200"
              >
                {createLoading ? "Creando objetivo..." : "Crear Objetivo"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Añadir Fondos (Ahorrar) */}
      {savingGoal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 space-y-5 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-base text-foreground">Añadir Ahorros</h3>
                <p className="text-[10px] text-foreground/45 mt-0.5">Meta: <span className="font-bold text-indigo-500">{savingGoal.nombre}</span></p>
              </div>
              <button 
                onClick={() => setSavingGoal(null)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddFunds} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">¿Cuánto deseas aportar?</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="50.00"
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 text-center text-xl font-bold"
                  autoFocus
                  required
                />
              </div>

              <button 
                type="submit"
                disabled={fundLoading || !fundAmount}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 py-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {fundLoading ? "Aportando..." : "Confirmar Aporte"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
