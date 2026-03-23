'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useRecentTransactions } from '@/hooks/useFirestore';
import { useState, useMemo } from "react";
import { Wallet } from "lucide-react";
import { motion } from "framer-motion";

interface CategoryData {
  name: string;
  value: number;
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd',
  '#818cf8', '#667eea', '#7c3aed', '#6d28d9',
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
      .slice(0, 6);
  }, [transactions, activeType]);

  const total = categoryData.reduce((sum, item) => sum + item.value, 0);

  if (transactions.length === 0 || categoryData.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-3xl p-8 text-center border border-gray-100 dark:border-gray-700"
      >
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
          <Wallet size={24} className="opacity-30" />
        </div>
        <p className="font-medium opacity-40">Sin datos de {activeType}s este mes</p>
        <p className="text-sm opacity-30 mt-1">Agrega transacciones para ver la distribución</p>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-700"
    >
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold tracking-tight">Distribución</h3>
            <p className="text-sm opacity-40">{activeType === 'gasto' ? 'Gastos por categoría' : 'Ingresos por categoría'}</p>
          </div>
          
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl gap-1">
            <button 
              onClick={() => setActiveType('gasto')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeType === 'gasto' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'hover:bg-white/50 dark:hover:bg-gray-600/50'
              }`}
            >
              Gastos
            </button>
            <button 
              onClick={() => setActiveType('ingreso')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeType === 'ingreso' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'hover:bg-white/50 dark:hover:bg-gray-600/50'
              }`}
            >
              Ingresos
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="relative h-52 w-52">
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-40">Total</p>
              <p className="text-xl font-bold">${total.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</p>
            </div>
            
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={800}
                  animationEasing="ease-out"
                >
                  {categoryData.map((_, index: number) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]}
                      stroke="transparent"
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    background: 'white', 
                    border: 'none', 
                    borderRadius: '12px', 
                    fontSize: '12px', 
                    fontWeight: '600',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 w-full space-y-2">
            {categoryData.map((entry, index: number) => {
              const percentage = ((entry.value / total) * 100).toFixed(0);
              
              return (
                <div 
                  key={entry.name}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm font-medium">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold opacity-60">${entry.value.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</span>
                    <span className="text-xs font-bold opacity-40 w-10 text-right">{percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
