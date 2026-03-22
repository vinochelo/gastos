'use client';

import { useAccounts } from "@/hooks/useFirestore";
import { Plus, Wallet, CreditCard, Banknote, MoreVertical, LucideIcon } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { addDoc, collection } from "firebase/firestore";

interface AccountConfig {
  icon: LucideIcon;
  color: string;
}

const ACCOUNT_TYPES: Record<string, AccountConfig> = {
  "Produbanco": { icon: CreditCard, color: "bg-green-500/10 text-green-600" },
  "Guayaquil": { icon: CreditCard, color: "bg-pink-500/10 text-pink-600" },
  "DeUna": { icon: Wallet, color: "bg-yellow-500/10 text-yellow-600" },
  "Peigo": { icon: Wallet, color: "bg-purple-500/10 text-purple-600" },
  "American Express": { icon: CreditCard, color: "bg-blue-500/10 text-blue-600" },
  "Efectivo": { icon: Banknote, color: "bg-gray-500/10 text-gray-600" },
  "Default": { icon: Wallet, color: "bg-foreground/5 text-foreground/50" }
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <header className="flex justify-between items-center py-4">
        <div>
          <h1 className="text-3xl font-black italic">MIS CUENTAS</h1>
          <p className="text-foreground/50">Gestiona tus fuentes de dinero</p>
        </div>
        <button className="bg-primary text-white p-3 rounded-2xl shadow-lg" onClick={handleInitAccounts}>
          <Plus size={24} />
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc) => {
          const Config = ACCOUNT_TYPES[acc.nombre] || ACCOUNT_TYPES["Default"];
          const Icon = Config.icon;
          
          return (
            <div key={acc.id} className="glass p-6 rounded-[2rem] flex items-center justify-between shadow-sm group">
              <div className="flex items-center gap-5">
                <div className={`p-4 rounded-2xl ${Config.color}`}>
                   <Icon size={28} />
                </div>
                <div>
                  <h3 className="font-black text-xl leading-none">{acc.nombre}</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-30 mt-1">Cuenta Activa</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                 <p className="text-2xl font-black">${(acc.saldo || 0).toLocaleString('es-EC')}</p>
                 <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2">
                    <MoreVertical size={16} />
                 </button>
              </div>
            </div>
          );
        })}

        {accounts.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center glass rounded-[2.5rem] space-y-4 border-dashed border-2">
             <p className="text-foreground/40 font-medium">No hay cuentas configuradas</p>
             <button 
              onClick={handleInitAccounts}
              className="text-primary font-black uppercase text-xs tracking-widest"
             >
                Inicializar cuentas por defecto
             </button>
          </div>
        )}
      </div>
    </div>
  );
}
