'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useRecentTransactions } from '@/hooks/useFirestore';
import { useState, useMemo } from "react";

interface CategoryData {
  name: string;
  value: number;
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#818cf8', 
  '#c4b5fd', '#7c3aed', '#6d28d9', '#5b21b6',
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
      .slice(0, 5);
  }, [transactions, activeType]);

  const total = categoryData.reduce((sum, item) => sum + item.value, 0);

  if (transactions.length === 0 || categoryData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 text-center border border-gray-100 dark:border-gray-700">
        <p className="text-sm opacity-40">Sin datos de {activeType}s</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-5 bg-indigo-500 rounded-full" />
          <h3 className="text-base font-bold tracking-tight">Distribución</h3>
        </div>
        
        <div className="flex bg-gray-100 dark:bg-gray-700 p-0.5 rounded-lg">
          <button 
            onClick={() => setActiveType('gasto')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeType === 'gasto' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''
            }`}
          >
            Gastos
          </button>
          <button 
            onClick={() => setActiveType('ingreso')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeType === 'ingreso' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''
            }`}
          >
            Ingresos
          </button>
        </div>
      </div>

      {/* Chart compact */}
      <div className="flex items-center gap-6">
        <div className="relative h-32 w-32 flex-shrink-0">
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <p className="text-[10px] font-medium opacity-40">Total</p>
            <p className="text-base font-bold">${(total / 1000).toFixed(1)}k</p>
          </div>
          
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                innerRadius={40}
                outerRadius={60}
                paddingAngle={2}
                dataKey="value"
              >
                {categoryData.map((_, index: number) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    stroke="transparent"
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend compact */}
        <div className="flex-1 space-y-1.5">
          {categoryData.map((entry, index: number) => {
            const percentage = ((entry.value / total) * 100).toFixed(0);
            
            return (
              <div 
                key={entry.name}
                className="flex items-center justify-between py-1"
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-xs font-medium truncate max-w-[100px]">{entry.name}</span>
                </div>
                <span className="text-xs font-semibold">{percentage}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
