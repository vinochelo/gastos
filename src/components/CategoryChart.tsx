'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useRecentTransactions } from '@/hooks/useFirestore';
import { useState, useMemo } from "react";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

interface CategoryData {
  name: string;
  value: number;
}

const COLORS = [
  { fill: '#6366f1', gradient: ['#6366f1', '#8b5cf6'] },
  { fill: '#ec4899', gradient: ['#ec4899', '#f472b6'] },
  { fill: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'] },
  { fill: '#10b981', gradient: ['#10b981', '#34d399'] },
  { fill: '#ef4444', gradient: ['#ef4444', '#f87171'] },
  { fill: '#8b5cf6', gradient: ['#8b5cf6', '#a78bfa'] },
  { fill: '#06b6d4', gradient: ['#06b6d4', '#22d3ee'] },
  { fill: '#4ade80', gradient: ['#4ade80', '#86efac'] },
];

export default function CategoryChart() {
  const { transactions } = useRecentTransactions(100);
  const [activeType, setActiveType] = useState<'gasto' | 'ingreso'>('gasto');

  const categoryData = useMemo(() => {
    return transactions
      .filter(tx => tx.tipo === activeType)
      .reduce((acc: CategoryData[], tx) => {
        const existing = acc.find((item) => item.name === tx.categoria);
        if (existing) {
          existing.value += Math.abs(tx.monto);
        } else {
          acc.push({ name: tx.categoria || 'Otros', value: Math.abs(tx.monto) });
        }
        return acc;
      }, [])
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [transactions, activeType]);

  const total = categoryData.reduce((sum, item) => sum + item.value, 0);

  if (transactions.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass p-16 rounded-[3rem] flex flex-col items-center justify-center space-y-4 border-2 border-dashed border-foreground/10"
      >
        <motion.div 
          className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Wallet size={40} className="text-primary/40" />
        </motion.div>
        <div className="text-center">
          <p className="text-sm font-black italic uppercase tracking-widest opacity-30">Sin datos disponibles</p>
          <p className="text-[10px] opacity-20 mt-1">Agrega transacciones para ver tu distribución</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 shadow-2xl border border-gray-100 dark:border-gray-700"
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${
        activeType === 'gasto' ? 'from-red-500 via-rose-500 to-pink-500' : 'from-green-500 via-emerald-500 to-teal-500'
      }`} />
      
      <div className="p-8">
        <div className="flex flex-col md:flex-col lg:flex-row md:items-start lg:items-center justify-between gap-6 mb-8">
          <div>
            <motion.h3 
              key={activeType}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="text-3xl font-black italic tracking-tight"
            >
              {activeType === 'gasto' ? (
                <span className="bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">GASTOS</span>
              ) : (
                <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">INGRESOS</span>
              )}
            </motion.h3>
            <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-[0.2em]">
              {activeType === 'gasto' ? 'Adónde va tu dinero' : 'De dónde viene'}
            </p>
          </div>
          
          <div className="flex bg-foreground/5 p-1.5 rounded-2xl gap-1">
            <button 
              onClick={() => setActiveType('gasto')}
              className={`relative px-5 py-3 rounded-xl transition-all flex items-center gap-2 ${
                activeType === 'gasto' ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg' : 'text-foreground/40 hover:text-foreground/70'
              }`}
            >
              <span className="text-xs font-black italic uppercase tracking-wider">
                <TrendingDown size={14} className="inline mr-1" />
                Gastos
              </span>
            </button>
            
            <button 
              onClick={() => setActiveType('ingreso')}
              className={`relative px-5 py-3 rounded-xl transition-all flex items-center gap-2 ${
                activeType === 'ingreso' ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg' : 'text-foreground/40 hover:text-foreground/70'
              }`}
            >
              <span className="text-xs font-black italic uppercase tracking-wider">
                <TrendingUp size={14} className="inline mr-1" />
                Ingresos
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-10">
          <div className="relative h-72 w-full max-w-sm">
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-30">Total</p>
              <motion.p 
                key={total}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-3xl font-black italic"
              >
                ${total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </motion.p>
            </div>
            
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={1200}
                  animationEasing="ease-out"
                >
                  {categoryData.map((_, index: number) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length].fill}
                      stroke="transparent"
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(255,255,255,0.98)', 
                    border: 'none', 
                    borderRadius: '20px', 
                    fontSize: '12px', 
                    fontWeight: 'bold', 
                    boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
                    padding: '12px 16px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 w-full space-y-3">
            {categoryData.slice(0, 6).map((entry, index: number) => {
              const color = COLORS[index % COLORS.length];
              const percentage = ((entry.value / total) * 100).toFixed(0);
              
              return (
                <motion.div 
                  key={entry.name}
                  className="relative flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all hover:bg-gray-50/50 dark:hover:bg-gray-800/50"
                  whileHover={{ x: 4 }}
                >
                  <div className="absolute inset-0 rounded-2xl overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-primary/5 to-purple-500/5"
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.8, delay: index * 0.1 }}
                    />
                  </div>
                  
                  <div className="flex items-center gap-4 relative z-10">
                    <div 
                      className="w-4 h-4 rounded-full shadow-md"
                      style={{ backgroundColor: color.fill }}
                    />
                    <div>
                      <span className="text-xs font-black uppercase tracking-tight opacity-70">
                        {entry.name}
                      </span>
                      <p className="text-[9px] opacity-40 font-bold uppercase">
                        ${entry.value.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  
                  <span className="text-lg font-black italic relative z-10">
                    {percentage}%
                  </span>
                </motion.div>
              );
            })}
            
            {categoryData.length > 6 && (
              <p className="text-[9px] font-bold text-center opacity-30 uppercase tracking-widest pt-2">
                ... y {categoryData.length - 6} categorías más
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
