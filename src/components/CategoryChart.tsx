'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useRecentTransactions, Transaction } from '@/hooks/useFirestore';
import { useState, useMemo, useCallback } from "react";
import { ChevronLeft } from "lucide-react";

interface CategoryData {
  name: string;
  value: number;
}

const COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', 
  '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16',
  '#f97316', '#14b8a6', '#a855f7', '#3b82f6',
];

const getTimestamp = (tx: Transaction): number => {
  const ts = tx.timestamp;
  if (!ts) return Date.now(); // Fallback for pending sync
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as any).toDate === 'function') {
    return (ts as any).toDate().getTime();
  }
  return 0;
};

export default function CategoryChart() {
  const { transactions } = useRecentTransactions(100);
  const [activeType, setActiveType] = useState<'gasto' | 'ingreso'>('gasto');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
      .sort((a, b) => b.value - a.value);
  }, [transactions, activeType]);

  const total = categoryData.reduce((sum, item) => sum + item.value, 0);

  const categoryTransactions = useMemo(() => {
    if (!selectedCategory) return [];
    return transactions
      .filter(tx => {
        const ts = tx.timestamp;
        if (!ts) return false; // Hide from detail until saved
        return tx.categoria === selectedCategory && tx.tipo === activeType;
      })
      .sort((a, b) => getTimestamp(b) - getTimestamp(a));
  }, [selectedCategory, transactions, activeType]);

  const categoryTotal = categoryTransactions.reduce((sum, tx) => sum + tx.monto, 0);

  const handleCategoryClick = useCallback((categoryName: string) => {
    setSelectedCategory(categoryName);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  if (selectedCategory) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <button 
            onClick={handleBack}
            className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h3 className="text-lg font-bold">{selectedCategory}</h3>
            <p className="text-sm opacity-40">{categoryTransactions.length} transacciones • ${categoryTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {categoryTransactions.map((tx) => {
            const ts = tx.timestamp;
            if (!ts) return null;
            const date = 'toDate' in ts ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts as any));
            return (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                <div>
                  <p className="text-sm font-medium">{tx.descripcion || tx.categoria}</p>
                  <p className="text-xs opacity-40">{date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <p className={`text-sm font-bold ${tx.tipo === 'ingreso' ? 'text-green-600' : ''}`}>
                  {tx.tipo === 'ingreso' ? '+' : '-'}${tx.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </p>
              </div>
            );
          })}
          
          {categoryTransactions.length === 0 && (
            <p className="text-center py-8 opacity-40">Sin transacciones</p>
          )}
        </div>
      </div>
    );
  }

  if (transactions.length === 0 || categoryData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border border-gray-100 dark:border-gray-700">
        <p className="text-base opacity-40">Sin datos de {activeType}s</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 bg-indigo-500 rounded-full" />
          <h3 className="text-xl font-bold tracking-tight">Distribución</h3>
        </div>
        
        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
          <button 
            onClick={() => setActiveType('gasto')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeType === 'gasto' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''
            }`}
          >
            Gastos
          </button>
          <button 
            onClick={() => setActiveType('ingreso')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeType === 'ingreso' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''
            }`}
          >
            Ingresos
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-8">
        <div className="relative h-64 w-64 flex-shrink-0">
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-40 mb-1">Total</p>
            <p className="text-2xl font-bold">${total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
          </div>
          
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                innerRadius={55}
                outerRadius={100}
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

        <div className="flex-1 w-full space-y-0">
          {categoryData.map((entry, index: number) => {
            const percentage = ((entry.value / total) * 100).toFixed(1);
            
            return (
              <button
                key={entry.name}
                onClick={() => handleCategoryClick(entry.name)}
                className="w-full flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg px-2 -mx-2 transition-colors active:bg-gray-100 dark:active:bg-gray-600"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full shadow-sm"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm font-medium">{entry.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium opacity-60">${entry.value.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                  <span className="text-base font-bold w-12 text-right">{percentage}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
