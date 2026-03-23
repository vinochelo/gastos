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
      .slice(0, 6);
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
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
          <h3 className="text-lg font-bold tracking-tight">Distribución</h3>
        </div>
        
        <div className="flex bg-gray-100 dark:bg-gray-700 p-0.5 rounded-lg">
          <button 
            onClick={() => setActiveType('gasto')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeType === 'gasto' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''
            }`}
          >
            Gastos
          </button>
          <button 
            onClick={() => setActiveType('ingreso')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeType === 'ingreso' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''
            }`}
          >
            Ingresos
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="flex items-center gap-8">
        <div className="relative h-44 w-44 flex-shrink-0">
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <p className="text-xs font-medium opacity-40">Total</p>
            <p className="text-lg font-bold">${(total / 1000).toFixed(1)}k</p>
          </div>
          
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
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

        {/* Legend */}
        <div className="flex-1 space-y-0">
          {categoryData.map((entry, index: number) => {
            const percentage = ((entry.value / total) * 100).toFixed(0);
            
            return (
              <div 
                key={entry.name}
                className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-gray-700 last:border-0"
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
                  <span className="text-sm font-bold w-10 text-right">{percentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
