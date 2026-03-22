'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, CellProps } from 'recharts';
import { useRecentTransactions } from '@/hooks/useFirestore';
import { useState } from 'react';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#4ade80', '#fb7185', '#2dd4bf'];

export default function CategoryChart() {
  const { transactions } = useRecentTransactions(100);
  const [activeType, setActiveType] = useState<'gasto' | 'ingreso'>('gasto');

  // Agrupar por categoría
  const categoryData = transactions
    .filter(tx => tx.tipo === activeType)
    .reduce((acc: any[], tx) => {
      const existing = acc.find((item: any) => item.name === tx.categoria);
      if (existing) {
        existing.value += Math.abs(tx.monto);
      } else {
        acc.push({ name: tx.categoria || 'Otros', value: Math.abs(tx.monto) });
      }
      return acc;
    }, [])
    .sort((a, b) => b.value - a.value);

  const total = categoryData.reduce((sum, item) => sum + item.value, 0);

  if (transactions.length === 0) {
    return (
      <div className="glass p-12 rounded-[3rem] flex flex-col items-center justify-center opacity-30 space-y-2">
         <Wallet size={32} />
         <p className="text-[10px] font-black uppercase tracking-widest">Esperando Datos...</p>
      </div>
    );
  }

  return (
    <div className="glass p-8 rounded-[3rem] space-y-6 shadow-2xl transition-all hover:shadow-primary/5 border-white/5 relative overflow-hidden">
      {/* Background decoration */}
      <div className={`absolute -top-12 -right-12 w-48 h-48 blur-3xl opacity-10 rounded-full transition-colors ${activeType === 'gasto' ? 'bg-red-500' : 'bg-green-500'}`} />

      <div className="flex justify-between items-center relative z-10">
        <div>
          <h3 className="font-black italic text-xl uppercase tracking-tighter">DISTRIBUCIÓN</h3>
          <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-[0.2em]">{activeType === 'gasto' ? 'Adónde va tu dinero' : 'De dónde viene tu dinero'}</p>
        </div>
        <div className="flex bg-foreground/5 p-1 rounded-2xl gap-1">
           <button 
             onClick={() => setActiveType('gasto')}
             className={`p-2 rounded-xl transition-all ${activeType === 'gasto' ? 'bg-white text-red-500 shadow-xl scale-110' : 'text-foreground/20 hover:text-foreground/40'}`}
           >
             <TrendingDown size={18} />
           </button>
           <button 
             onClick={() => setActiveType('ingreso')}
             className={`p-2 rounded-xl transition-all ${activeType === 'ingreso' ? 'bg-white text-green-500 shadow-xl scale-110' : 'text-foreground/20 hover:text-foreground/40'}`}
           >
             <TrendingUp size={18} />
           </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
        <div className="h-64 w-full md:w-3/5">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                innerRadius={65}
                outerRadius={85}
                paddingAngle={8}
                dataKey="value"
                animationBegin={0}
                animationDuration={1500}
                stroke="transparent"
              >
                {categoryData.map((_, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ background: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: '24px', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }}
                itemStyle={{ color: '#000' }}
                formatter={(value: number) => [`$${value.toLocaleString('es-EC', { minimumFractionDigits: 2 })}`, 'Importe']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="w-full md:w-2/5 space-y-3">
          {categoryData.slice(0, 5).map((entry: any, index: number) => (
            <div key={entry.name} className="flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-[11px] font-black uppercase tracking-tighter opacity-50 group-hover:opacity-100 transition-all">{entry.name}</span>
              </div>
              <span className="text-sm font-black italic">
                {((entry.value / total) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
          {categoryData.length > 5 && (
            <p className="text-[9px] font-bold text-center opacity-20 uppercase tracking-widest pt-2">... y {categoryData.length - 5} más</p>
          )}
        </div>
      </div>
    </div>
  );
}
