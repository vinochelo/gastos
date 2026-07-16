'use client';

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc 
} from "firebase/firestore";
import { 
  Plus, X, ChevronLeft, DollarSign, Trash2, Menu, AlertCircle, Calendar, User, Check, RefreshCw 
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";

interface Debt {
  id: string;
  userId: string;
  nombre: string;
  monto: number;
  tipo: "debo" | "me_deben";
  descripcion?: string;
  fecha: string;
  pagado: boolean;
}

export default function DeudasPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const { openDrawer, formatAmount } = useApp();
  const router = useRouter();

  // Modal states
  const [isOpen, setIsOpen] = useState(false);
  const [tipo, setTipo] = useState<"debo" | "me_deben">("debo");
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let unsubscribeDebts: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeDebts) unsubscribeDebts();

      if (!user) {
        setDebts([]);
        setLoading(false);
        return;
      }

      // Listen to debts
      const qDebts = query(
        collection(db, "debts"),
        where("userId", "==", user.uid)
      );
      
      unsubscribeDebts = onSnapshot(qDebts, (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt));
        // Sort by date (newest first)
        list.sort((a, b) => b.fecha.localeCompare(a.fecha));
        setDebts(list);
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDebts) unsubscribeDebts();
    };
  }, []);

  // Calculate totals
  const totals = debts.reduce((acc, d) => {
    if (d.pagado) return acc;
    if (d.tipo === "debo") {
      acc.porPagar += d.monto;
    } else {
      acc.porCobrar += d.monto;
    }
    return acc;
  }, { porPagar: 0, porCobrar: 0 });

  const handleOpenCreate = (selectedType: "debo" | "me_deben") => {
    setTipo(selectedType);
    setNombre("");
    setMonto("");
    setDescripcion("");
    setFecha(new Date().toISOString().split('T')[0]);
    setError(null);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !nombre || !monto) return;
    
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      setError("Ingresa un monto de deuda válido.");
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      await addDoc(collection(db, "debts"), {
        userId: auth.currentUser.uid,
        nombre: nombre.trim(),
        monto: montoNum,
        tipo,
        descripcion: descripcion.trim() || "",
        fecha,
        pagado: false
      });
      setIsOpen(false);
    } catch (err) {
      console.error(err);
      setError("Error al guardar la deuda.");
    } finally {
      setActionLoading(false);
    }
  };

  const togglePagado = async (id: string, currentVal: boolean) => {
    try {
      await updateDoc(doc(db, "debts", id), {
        pagado: !currentVal
      });
    } catch (err) {
      console.error(err);
      alert("Error al actualizar estado");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este registro de deuda?")) return;
    try {
      await deleteDoc(doc(db, "debts", id));
    } catch (err) {
      console.error(err);
      alert("Error al eliminar");
    }
  };

  return (
    <div className="space-y-6 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500" />
      
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
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-500/80">Flujo de Préstamos</p>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Deudas</h1>
          </div>
        </div>
      </div>

      {/* Totals Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-red-500 to-rose-600 dark:from-red-950/40 dark:to-rose-900/20 text-white rounded-3xl p-5 border border-red-500/10 shadow-lg shadow-red-500/10 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-16 h-16 bg-white/5 rounded-full blur-lg" />
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-red-100/70">Debo (Por Pagar)</p>
            <p className="text-2xl font-black tracking-tight mt-1">{formatAmount(totals.porPagar)}</p>
          </div>
          <button 
            onClick={() => handleOpenCreate("debo")}
            className="mt-4 bg-white/15 hover:bg-white/20 active:scale-95 transition-all text-xs font-bold py-2 rounded-xl text-center border border-white/10"
          >
            + Añadir lo que debo
          </button>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-950/40 dark:to-teal-900/20 text-white rounded-3xl p-5 border border-emerald-500/10 shadow-lg shadow-emerald-500/10 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-16 h-16 bg-white/5 rounded-full blur-lg" />
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-100/70">Me deben (Por Cobrar)</p>
            <p className="text-2xl font-black tracking-tight mt-1">{formatAmount(totals.porCobrar)}</p>
          </div>
          <button 
            onClick={() => handleOpenCreate("me_deben")}
            className="mt-4 bg-white/15 hover:bg-white/20 active:scale-95 transition-all text-xs font-bold py-2 rounded-xl text-center border border-white/10"
          >
            + Añadir prestado
          </button>
        </div>
      </div>

      {/* Debts list */}
      <div className="space-y-3">
        {debts.map((d) => {
          const isDebo = d.tipo === "debo";
          return (
            <div 
              key={d.id} 
              className={`glass p-4 rounded-3xl border border-border shadow-sm flex items-center justify-between hover:shadow-md transition-all duration-300 relative overflow-hidden group ${
                d.pagado ? "opacity-50" : ""
              }`}
            >
              {/* Left indicator glow */}
              <span className={`absolute top-0 bottom-0 left-0 w-1.5 ${
                d.pagado ? "bg-slate-400" : isDebo ? "bg-red-500 animate-pulse" : "bg-emerald-500"
              }`} />

              <div className="flex items-center gap-3.5 min-w-0 pl-1.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  d.pagado ? "bg-slate-500/10 text-slate-500" :
                  isDebo ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
                }`}>
                  <User size={16} />
                </div>

                <div className="min-w-0">
                  <h3 className={`font-extrabold text-sm text-foreground tracking-tight truncate ${d.pagado ? "line-through opacity-60" : ""}`}>
                    {d.nombre}
                  </h3>
                  <p className="text-[10px] text-foreground/45 flex items-center gap-1.5 mt-0.5">
                    <span className="font-semibold">{isDebo ? "Debo a" : "Le presté"}</span>
                    {d.descripcion && <span>• {d.descripcion}</span>}
                    <span>• {d.fecha}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className={`text-sm font-black tracking-tight ${
                    d.pagado ? "text-slate-400 line-through" : isDebo ? "text-red-500" : "text-emerald-500"
                  }`}>
                    {formatAmount(d.monto)}
                  </p>
                  <p className="text-[8px] font-extrabold uppercase tracking-widest mt-0.5">
                    {d.pagado ? "Pagado" : "Pendiente"}
                  </p>
                </div>

                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => togglePagado(d.id, d.pagado)}
                    title={d.pagado ? "Marcar Pendiente" : "Marcar Pagado"}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      d.pagado 
                        ? "bg-slate-100 hover:bg-slate-200 dark:bg-gray-700 text-slate-500" 
                        : "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
                    }`}
                  >
                    {d.pagado ? <RefreshCw size={13} /> : <Check size={13} />}
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    title="Eliminar"
                    className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-xl cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {debts.length === 0 && !loading && (
          <div className="py-16 text-center glass rounded-3xl border-dashed border-2 border-border flex flex-col items-center justify-center p-6 space-y-4">
             <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <DollarSign size={24} />
             </div>
             <div className="max-w-xs">
                <p className="text-sm text-foreground/60 font-semibold">Sin deudas ni préstamos</p>
                <p className="text-xs text-foreground/40 mt-1">
                  Lleva un control de a quién le debes dinero o quién te debe a ti.
                </p>
             </div>
             <div className="flex gap-2">
               <button 
                onClick={() => handleOpenCreate("debo")}
                className="bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-md"
               >
                  Debo dinero
               </button>
               <button 
                onClick={() => handleOpenCreate("me_deben")}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-md"
               >
                  Presté dinero
               </button>
             </div>
          </div>
        )}
      </div>

      {/* MODAL: Crear Deuda */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-lg text-foreground">
                  {tipo === "debo" ? "Nueva Deuda (Debo)" : "Nuevo Préstamo (Me Deben)"}
                </h3>
                <p className="text-[10px] text-foreground/45 mt-0.5">Introduce los datos de la deuda</p>
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
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Nombre del contacto</label>
                <input 
                  type="text" 
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Juan Pérez..."
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Monto ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="100.00"
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Fecha</label>
                  <input 
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Descripción / Notas (Opcional)</label>
                <input 
                  type="text" 
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Detalle..."
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button 
                type="submit"
                disabled={actionLoading || !nombre || !monto}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 py-3.5 rounded-2xl font-bold text-sm tracking-wide shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? "Guardando..." : "Guardar Deuda"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
