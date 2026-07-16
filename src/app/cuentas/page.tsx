'use client';

import { useState } from "react";
import { useAccounts, Account } from "@/hooks/useFirestore";
import { Plus, Wallet, CreditCard, Banknote, MoreVertical, LucideIcon, PiggyBank, X, Trash2 } from "lucide-react";
import AccountIcon from "@/components/AccountIcon";
import { db, auth } from "@/lib/firebase";
import { addDoc, collection, doc, updateDoc, deleteDoc } from "firebase/firestore";

interface AccountConfig {
  icon: LucideIcon;
  color: string;
  glow: string;
}

const ACCOUNT_TYPES: Record<string, AccountConfig> = {
  "Produbanco": { icon: CreditCard, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", glow: "bg-emerald-500/5 dark:bg-emerald-500/2" },
  "Guayaquil": { icon: CreditCard, color: "bg-pink-500/10 text-pink-600 dark:text-pink-400", glow: "bg-pink-500/5 dark:bg-pink-500/2" },
  "DeUna": { icon: Wallet, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", glow: "bg-amber-500/5 dark:bg-amber-500/2" },
  "Peigo": { icon: Wallet, color: "bg-purple-500/10 text-purple-600 dark:text-purple-400", glow: "bg-purple-500/5 dark:bg-purple-500/2" },
  "American Express": { icon: CreditCard, color: "bg-sky-500/10 text-sky-600 dark:text-sky-400", glow: "bg-sky-500/5 dark:bg-sky-500/2" },
  "Efectivo": { icon: Banknote, color: "bg-slate-500/10 text-slate-600 dark:text-slate-400", glow: "bg-slate-500/5 dark:bg-slate-500/2" },
  "Ahorro": { icon: PiggyBank, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", glow: "bg-emerald-500/5 dark:bg-emerald-500/2" },
  "Default": { icon: Wallet, color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400", glow: "bg-indigo-500/5 dark:bg-indigo-500/2" }
};

export default function CuentasPage() {
  const { accounts, loading } = useAccounts();
  
  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  
  // Create account fields
  const [newName, setNewName] = useState("");
  const [newBalance, setNewBalance] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Edit account fields
  const [editName, setEditName] = useState("");
  const [editBalance, setEditBalance] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const getAccountConfig = (name: string): AccountConfig => {
    const clean = name.toLowerCase();
    if (clean.includes("produbanco")) return ACCOUNT_TYPES["Produbanco"];
    if (clean.includes("guayaquil")) return ACCOUNT_TYPES["Guayaquil"];
    if (clean.includes("deuna")) return ACCOUNT_TYPES["DeUna"];
    if (clean.includes("peigo")) return ACCOUNT_TYPES["Peigo"];
    if (clean.includes("express") || clean.includes("amex") || clean.includes("tarjeta") || clean.includes("crédito")) return ACCOUNT_TYPES["American Express"];
    if (clean.includes("efectivo") || clean.includes("cash")) return ACCOUNT_TYPES["Efectivo"];
    if (clean.includes("ahorro")) return ACCOUNT_TYPES["Ahorro"];
    return ACCOUNT_TYPES["Default"];
  };

  const handleInitAccounts = async () => {
    if (!auth.currentUser) return;
    const names = ["Produbanco", "Guayaquil", "DeUna", "Peigo", "American Express", "Efectivo", "Ahorro"];
    for (const name of names) {
      if (!accounts.find(a => a.nombre === name)) {
        await addDoc(collection(db, "accounts"), {
          userId: auth.currentUser.uid,
          nombre: name,
          saldo: 0,
          tipo: "bancaria"
        });
      }
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newName) return;
    setCreateLoading(true);
    try {
      await addDoc(collection(db, "accounts"), {
        userId: auth.currentUser.uid,
        nombre: newName,
        saldo: parseFloat(newBalance) || 0,
        tipo: "bancaria"
      });
      setNewName("");
      setNewBalance("");
      setIsCreateOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error al crear cuenta");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleStartEdit = (acc: Account) => {
    setEditingAccount(acc);
    setEditName(acc.nombre);
    setEditBalance(acc.saldo.toString());
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setEditLoading(true);
    try {
      await updateDoc(doc(db, "accounts", editingAccount.id), {
        nombre: editName,
        saldo: parseFloat(editBalance) || 0
      });
      setEditingAccount(null);
    } catch (err) {
      console.error(err);
      alert("Error al actualizar cuenta");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!editingAccount) return;
    if (!confirm(`¿Estás seguro de eliminar la cuenta "${editingAccount.nombre}"?\nEsto no borrará tus transacciones históricas, pero el balance de dinero disponible podría recalcularse.`)) return;
    setEditLoading(true);
    try {
      await deleteDoc(doc(db, "accounts", editingAccount.id));
      setEditingAccount(null);
    } catch (err) {
      console.error(err);
      alert("Error al eliminar cuenta");
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-center py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500/80 dark:text-indigo-400">Patrimonio</p>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Mis Cuentas</h1>
          <p className="text-xs text-foreground/50 mt-1 font-semibold">Administra tus saldos y fuentes de fondos</p>
        </div>
        <button 
          onClick={() => setIsCreateOpen(true)}
          title="Añadir Cuenta"
          className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/10 active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={22} />
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc) => {
          const Config = getAccountConfig(acc.nombre);
          
          return (
            <div key={acc.id} className="glass p-5 rounded-3xl flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-300 group relative overflow-hidden glass-glow">
              <div className={`absolute top-0 right-0 -mt-6 -mr-6 w-20 h-20 ${Config.glow} rounded-full blur-xl pointer-events-none`} />
              
              <div className="flex items-center gap-4 relative z-10">
                <AccountIcon nombre={acc.nombre} className="w-11 h-11" />
                <div>
                  <h3 className="font-extrabold text-lg text-foreground tracking-tight leading-tight">{acc.nombre}</h3>
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/45 mt-0.5">Saldo Disponible</p>
                </div>
              </div>
              
              <div className="flex flex-col items-end relative z-10">
                 <p className="text-xl font-black text-foreground tracking-tight">${(acc.saldo || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 })}</p>
                 <button 
                  onClick={() => handleStartEdit(acc)}
                  className="opacity-40 md:opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer text-foreground animate-in duration-200"
                 >
                    <MoreVertical size={14} />
                 </button>
              </div>
            </div>
          );
        })}

        {accounts.length === 0 && !loading && (
          <div className="col-span-full py-16 text-center glass rounded-3xl border-dashed border-2 border-border flex flex-col items-center justify-center p-6 space-y-4">
             <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <Wallet size={24} />
             </div>
             <div className="max-w-xs">
                <p className="text-sm text-foreground/60 font-semibold">No hay cuentas configuradas</p>
                <p className="text-xs text-foreground/40 mt-1">Crea tus cuentas para comenzar a organizar tus fondos.</p>
             </div>
             <button 
              onClick={handleInitAccounts}
              className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
             >
                Inicializar cuentas por defecto
             </button>
          </div>
        )}
      </div>

      {/* MODAL: Añadir Cuenta */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black tracking-tight text-foreground">Nueva Cuenta</h2>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-foreground cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Nombre de Cuenta</label>
                <input 
                  type="text"
                  placeholder="ej: Tarjeta Pacifico, Ahorro Viaje, Efectivo"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-border/40 p-4 rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder-foreground/30"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Saldo Inicial</label>
                <input 
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-border/40 p-4 rounded-xl text-base font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder-foreground/30"
                />
              </div>

              <button 
                type="submit"
                disabled={createLoading}
                className="w-full py-4 rounded-xl font-bold text-sm bg-foreground text-background hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
              >
                {createLoading ? "Creando..." : "Crear Cuenta"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Editar/Eliminar Cuenta */}
      {editingAccount && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black tracking-tight text-foreground">Editar Cuenta</h2>
              <button 
                onClick={() => setEditingAccount(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-foreground cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateAccount} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Nombre de Cuenta</label>
                <input 
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-border/40 p-4 rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Saldo Actual</label>
                <input 
                  type="number"
                  step="0.01"
                  value={editBalance}
                  onChange={(e) => setEditBalance(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-border/40 p-4 rounded-xl text-base font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-2">
                <button 
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={editLoading}
                  className="py-4 rounded-xl font-bold text-xs bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} /> Eliminar
                </button>
                
                <button 
                  type="submit"
                  disabled={editLoading}
                  className="py-4 rounded-xl font-bold text-xs bg-foreground text-background hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
                >
                  {editLoading ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
