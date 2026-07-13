'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useRecentTransactions, Transaction } from '@/hooks/useFirestore';
import { useState, useMemo, useCallback } from "react";
import { ChevronLeft, Settings, Trash2 } from "lucide-react";

interface CategoryData {
  name: string;
  value: number;
}

interface CategoryChartProps {
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
  selectedMonth?: number;
  selectedYear?: number;
}

const COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', 
  '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16',
  '#f97316', '#14b8a6', '#a855f7', '#3b82f6',
];

const getTimestamp = (tx: Transaction): number => {
  const ts = tx.createdAt || tx.timestamp; // Preferred createdAt for ordering detail
  if (!ts) return Date.now();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as any).toDate === 'function') {
    return (ts as any).toDate().getTime();
  }
  return 0;
};

export default function CategoryChart({ onEdit, onDelete, selectedMonth, selectedYear }: CategoryChartProps) {
  const { transactions } = useRecentTransactions(100);
  const [activeType, setActiveType] = useState<'gasto' | 'ingreso'>('gasto');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [period, setPeriod] = useState<'mes' | '30dias' | 'todo'>('mes');
  const [hoveredCategory, setHoveredCategory] = useState<CategoryData | null>(null);

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const activeMonth = selectedMonth !== undefined ? selectedMonth : now.getMonth();
    const activeYear = selectedYear !== undefined ? selectedYear : now.getFullYear();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return transactions.filter(tx => {
      const ts = tx.timestamp || tx.createdAt;
      const txDate = ts ? ('toDate' in ts ? (ts as any).toDate() : (ts instanceof Date ? ts : new Date(ts as any))) : new Date();
      
      if (period === 'mes') {
        return txDate.getMonth() === activeMonth && txDate.getFullYear() === activeYear;
      }
      if (period === '30dias') {
        return txDate >= thirtyDaysAgo;
      }
      return true; // 'todo'
    });
  }, [transactions, period, selectedMonth, selectedYear]);

  const categoryData = useMemo(() => {
    return filteredTransactions
      .filter(tx => tx.tipo === activeType)
      .reduce((acc: CategoryData[], tx) => {
        const existing = acc.find((item) => item.name === tx.categoria);
        if (existing) {
          existing.value += Math.abs(Number(tx.monto || 0));
        } else {
          acc.push({ name: tx.categoria || 'Otros', value: Math.abs(Number(tx.monto || 0)) });
        }
        return acc;
      }, [])
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions, activeType]);

  const total = categoryData.reduce((sum, item) => sum + item.value, 0);

  const categoryTransactions = useMemo(() => {
    if (!selectedCategory) return [];
    return filteredTransactions
      .filter(tx => {
        return tx.categoria === selectedCategory && tx.tipo === activeType;
      })
      .sort((a, b) => getTimestamp(b) - getTimestamp(a));
  }, [selectedCategory, filteredTransactions, activeType]);

  const categoryTotal = categoryTransactions.reduce((sum, tx) => sum + Number(tx.monto || 0), 0);

  const handleCategoryClick = useCallback((categoryName: string) => {
    setSelectedCategory(categoryName);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  if (selectedCategory) {
    return (
      <div className="glass rounded-3xl p-6 border border-border shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <button 
            onClick={handleBack}
            className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h3 className="text-lg font-bold">{selectedCategory}</h3>
            <p className="text-sm opacity-40">{categoryTransactions.length} transacciones • ${categoryTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {categoryTransactions.map((tx) => {
            const ts = tx.timestamp;
            const date = ts ? ('toDate' in ts ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts as any))) : new Date();
            return (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-border/20 group">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-bold truncate">{tx.descripcion || tx.categoria}</p>
                  <p className="text-[10px] opacity-40">{date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-black ${tx.tipo === 'ingreso' ? 'text-emerald-500' : ''}`}>
                    {tx.tipo === 'ingreso' ? '+' : '-'}${tx.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onEdit?.(tx)}
                      className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg shrink-0 text-indigo-500"
                    >
                      <Settings size={14} />
                    </button>
                    <button 
                      onClick={() => onDelete?.(tx)}
                      className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg shrink-0 text-rose-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          
          {categoryTransactions.length === 0 && (
            <p className="text-center py-8 opacity-40 text-sm">Sin transacciones</p>
          )}
        </div>
      </div>
    );
  }

  if (transactions.length === 0 || categoryData.length === 0) {
    return (
      <div className="glass rounded-3xl p-8 text-center border border-border shadow-sm animate-in fade-in">
        <p className="text-sm opacity-40">Sin datos de {activeType}s</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl p-6 border border-border shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-indigo-500 rounded-full animate-pulse" />
          <div>
            <h3 className="text-lg font-black tracking-tight">Distribución</h3>
            <div className="flex gap-2 mt-1">
              <button 
                type="button"
                onClick={() => setPeriod('mes')}
                className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded transition-all cursor-pointer ${period === 'mes' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' : 'opacity-45 hover:opacity-100'}`}
              >
                Este Mes
              </button>
              <button 
                type="button"
                onClick={() => setPeriod('30dias')}
                className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded transition-all cursor-pointer ${period === '30dias' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' : 'opacity-45 hover:opacity-100'}`}
              >
                30 Días
              </button>
              <button 
                type="button"
                onClick={() => setPeriod('todo')}
                className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded transition-all cursor-pointer ${period === 'todo' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' : 'opacity-45 hover:opacity-100'}`}
              >
                Todo
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <button 
            type="button"
            onClick={() => { setActiveType('gasto'); setHoveredCategory(null); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeType === 'gasto' ? 'bg-white dark:bg-gray-700 text-rose-500 shadow-sm' : 'text-foreground/50'
            }`}
          >
            Gastos
          </button>
          <button 
            type="button"
            onClick={() => { setActiveType('ingreso'); setHoveredCategory(null); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeType === 'ingreso' ? 'bg-white dark:bg-gray-700 text-emerald-500 shadow-sm' : 'text-foreground/50'
            }`}
          >
            Ingresos
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-8">
        <div className="relative h-56 w-56 flex-shrink-0 mx-auto">
          {/* Central Donut text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none p-4 text-center">
            {hoveredCategory ? (
              <div className="animate-in fade-in zoom-in-95 duration-200">
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-500/80 truncate w-32">{hoveredCategory.name}</p>
                <p className="text-xl font-black text-foreground mt-0.5 leading-none">${hoveredCategory.value.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
                <p className="text-[10px] font-bold text-foreground/45 mt-1">{((hoveredCategory.value / total) * 100).toFixed(1)}%</p>
              </div>
            ) : (
              <div className="animate-in fade-in duration-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 leading-none">Total</p>
                <p className="text-2xl font-black text-foreground mt-1 tracking-tight leading-none">${total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
              </div>
            )}
          </div>
          
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                innerRadius={65}
                outerRadius={95}
                paddingAngle={3}
                dataKey="value"
                onMouseEnter={(_, index) => setHoveredCategory(categoryData[index])}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                {categoryData.map((_, index: number) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    stroke="transparent"
                    className="outline-none cursor-pointer hover:opacity-85 transition-opacity duration-200"
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 w-full space-y-1">
          {categoryData.map((entry, index: number) => {
            const percentage = ((entry.value / total) * 100).toFixed(1);
            const color = COLORS[index % COLORS.length];
            
            return (
              <button
                key={entry.name}
                onClick={() => handleCategoryClick(entry.name)}
                onMouseEnter={() => setHoveredCategory(entry)}
                onMouseLeave={() => setHoveredCategory(null)}
                className="w-full text-left rounded-xl p-2 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-bold text-foreground truncate">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-foreground/50">${entry.value.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                    <span className="text-xs font-extrabold text-foreground w-8 text-right">{percentage}%</span>
                  </div>
                </div>
                {/* Visual Progress Bar */}
                <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500" 
                    style={{ width: `${percentage}%`, backgroundColor: color }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
