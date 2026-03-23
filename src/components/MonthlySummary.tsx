'use client';

import { motion } from "framer-motion";
import { useRecentTransactions, useAccounts } from "@/hooks/useFirestore";
import { TrendingUp, TrendingDown, ArrowRightLeft, Wallet, PiggyBank, Target, Sparkles } from "lucide-react";
import { useMemo } from "react";

export default function MonthlySummary() {
  const { transactions } = useRecentTransactions(100); 
  const { accounts } = useAccounts();

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let income = 0;
    let expense = 0;

    transactions.forEach(tx => {
      const ts = tx.timestamp;
      const txDate = 'toDate' in ts ? ts.toDate() : (ts instanceof Date ? ts : new Date());
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        if (tx.tipo === 'ingreso') income += tx.monto;
        else if (tx.tipo === 'gasto') expense += tx.monto;
      }
    });

    const totalBalance = accounts.reduce((acc, a) => acc + (a.saldo || 0), 0);
    const prevMonthBalance = totalBalance - income + expense;
    const savings = income - expense;

    return { income, expense, totalBalance, prevMonthBalance, savings };
  }, [transactions, accounts]);

  const monthName = new Date().toLocaleDateString('es-ES', { month: 'long' }).toUpperCase();

  const cards = [
    {
      title: 'Traslado Mes',
      value: stats.prevMonthBalance,
      icon: ArrowRightLeft,
      gradient: 'from-gray-500 to-slate-600',
      delay: 0,
      color: 'text-gray-400'
    },
    {
      title: 'Total Disponible',
      value: stats.totalBalance,
      icon: Wallet,
      gradient: 'from-primary via-purple-500 to-pink-500',
      delay: 0.1,
      color: 'text-primary',
      glow: true
    },
    {
      title: 'Ahorro del Mes',
      value: stats.savings,
      icon: PiggyBank,
      gradient: stats.savings >= 0 ? 'from-green-500 to-emerald-600' : 'from-red-500 to-rose-600',
      delay: 0.2,
      color: stats.savings >= 0 ? 'text-green-500' : 'text-red-500'
    },
    {
      title: 'Meta Diaria',
      value: (stats.savings / 30).toFixed(2),
      icon: Target,
      gradient: 'from-amber-500 to-orange-600',
      delay: 0.3,
      color: 'text-amber-500',
      prefix: '$',
      suffix: '/día'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: card.delay, duration: 0.5 }}
          whileHover={{ y: -5, scale: 1.02 }}
          className={`relative overflow-hidden rounded-[1.5rem] p-5 ${
            card.glow 
              ? 'bg-gradient-to-br ' + card.gradient + ' shadow-2xl shadow-primary/30' 
              : 'bg-gradient-to-br ' + card.gradient
          }`}
        >
          {/* Background effects */}
          <div className="absolute inset-0 bg-black/5" />
          <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl ${
            card.glow ? 'bg-white' : 'bg-white/30'
          }`} />
          
          {/* Animated border for main card */}
          {card.glow && (
            <motion.div 
              className="absolute inset-0 border-2 border-white/20 rounded-[1.5rem]"
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
          )}
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${card.glow ? 'bg-white/20' : 'bg-white/10'} flex items-center justify-center`}>
                <card.icon size={18} className={card.glow ? 'text-white' : card.color} />
              </div>
              {card.glow && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="w-6 h-6"
                >
                  <Sparkles size={24} className="text-white/50" />
                </motion.div>
              )}
            </div>
            
            <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${card.glow ? 'text-white/60' : 'opacity-60'}`}>
              {card.title}
            </p>
            
            <p className={`text-2xl font-black italic tracking-tight ${card.glow ? 'text-white' : ''}`}>
              {card.prefix || ''}${Math.abs(Number(card.value)).toLocaleString('es-ES', { minimumFractionDigits: 2 })}{card.suffix || ''}
            </p>
            
            <p className={`text-[9px] font-bold mt-1 ${card.glow ? 'text-white/40' : 'opacity-40'}`}>
              {monthName}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
