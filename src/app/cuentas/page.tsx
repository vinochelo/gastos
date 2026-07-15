'use client';

import { useAccounts } from "@/hooks/useFirestore";
import { Plus, Wallet, CreditCard, Banknote, MoreVertical, LucideIcon } from "lucide-react";
import AccountIcon from "@/components/AccountIcon";
import { db, auth } from "@/lib/firebase";
import { addDoc, collection } from "firebase/firestore";

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
  "Default": { icon: Wallet, color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400", glow: "bg-indigo-500/5 dark:bg-indigo-500/2" }
};

export default function CuentasPage() {
  const { accounts, loading } = useAccounts();

  const handleInitAccounts = async () => {
    if (!auth.currentUser) return;
    const names = ["Produbanco", "Guayaquil", "DeUna", "Peigo", "American Express", "Efectivo"];
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

  return (
    <div className="space-y-6 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-center py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500/80 dark:text-indigo-400">Patrimonio</p>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Mis Cuentas</h1>
          <p className="text-xs text-foreground/50 mt-1 font-semibold">Administra tus saldos y fuentes de fondos</p>
        </div>
        <button 
          onClick={handleInitAccounts}
          title="Inicializar Cuentas"
          className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/10 active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={22} />
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc) => {
          const Config = ACCOUNT_TYPES[acc.nombre] || ACCOUNT_TYPES["Default"];
          
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
                 <button className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity p-1 text-foreground cursor-pointer">
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
    </div>
  );
}
