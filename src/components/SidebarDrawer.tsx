'use client';

import { useApp } from '@/context/AppContext';
import { auth } from '@/lib/firebase';
import { signOutAll } from '@/hooks/useAuth';
import { APP_VERSION } from '@/lib/version';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowDownUp,
  Eye,
  EyeOff,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Mic,
  Moon,
  PieChart,
  SlidersHorizontal,
  Sun,
  Target,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

const DRAWER_GROUPS = [
  {
    title: 'Principal',
    items: [
      { href: '/', label: 'Resumen', icon: LayoutDashboard },
      { href: '/transacciones', label: 'Movimientos', icon: ArrowDownUp },
      { href: '/cuentas', label: 'Cuentas', icon: Wallet },
    ],
  },
  {
    title: 'Planificación Financiera',
    items: [
      { href: '/presupuestos', label: 'Presupuestos', icon: PieChart },
      { href: '/deudas', label: 'Deudas y Cobros', icon: HandCoins },
      { href: '/metas', label: 'Metas de Ahorro', icon: Target },
    ],
  },
  {
    title: 'Sistema',
    items: [{ href: '/ajustes', label: 'Ajustes y Bot', icon: SlidersHorizontal }],
  },
];

export default function SidebarDrawer() {
  const {
    isDrawerOpen,
    closeDrawer,
    isDarkMode,
    toggleDarkMode,
    hideAmounts,
    toggleHideAmounts,
    confirmAction,
    startGlobalVoiceRecording,
  } = useApp();

  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const confirmed = await confirmAction({
      title: 'Cerrar sesión',
      message: '¿Seguro que deseas salir de tu cuenta en este dispositivo?',
      confirmText: 'Cerrar sesión',
      destructive: true,
    });
    if (confirmed) {
      closeDrawer();
      await signOutAll();
      router.push('/login');
    }
  };

  const handleVoiceShortcut = () => {
    closeDrawer();
    void startGlobalVoiceRecording();
  };

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            onClick={closeDrawer}
            className="fixed inset-0 bg-black z-[100] md:hidden"
          />

          {/* Drawer content */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed top-0 bottom-0 left-0 w-76 max-w-[85vw] bg-card border-r border-border z-[101] md:hidden flex flex-col p-5 shadow-2xl overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                <Image
                  src="/app_icon.png"
                  alt="Control de Gastos"
                  width={40}
                  height={40}
                  className="rounded-xl shadow-sm border border-border shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="font-black text-sm text-foreground truncate leading-tight">
                    Control de Gastos
                  </h3>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                    GESTOR.AI
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="p-2 hover:bg-accent rounded-xl transition-colors cursor-pointer text-foreground/60"
                title="Cerrar menú"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Voice Button */}
            <button
              type="button"
              onClick={handleVoiceShortcut}
              className="w-full mb-5 rounded-2xl px-4 py-3 bg-primary text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Mic size={16} />
              Dictar Movimiento por Voz
            </button>

            {/* Grouped Navigation links */}
            <div className="flex-1 space-y-5">
              {DRAWER_GROUPS.map((group) => (
                <div key={group.title} className="space-y-1">
                  <p className="px-2.5 text-[10px] font-extrabold uppercase tracking-widest text-foreground/40">
                    {group.title}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isActive =
                        item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeDrawer}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            isActive
                              ? 'bg-primary text-white shadow-sm shadow-primary/20'
                              : 'text-foreground/70 hover:text-foreground hover:bg-accent'
                          }`}
                        >
                          <Icon size={16} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Toggles and User Card */}
            <div className="pt-4 mt-5 border-t border-border space-y-3.5">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2.5 text-foreground/75">
                  {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                  <span className="text-xs font-bold">Modo oscuro</span>
                </div>
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  className={`w-11 h-6 rounded-full transition-all relative cursor-pointer ${
                    isDarkMode ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow-sm ${
                      isDarkMode ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2.5 text-foreground/75">
                  {hideAmounts ? <EyeOff size={16} /> : <Eye size={16} />}
                  <span className="text-xs font-bold">Ocultar cantidades</span>
                </div>
                <button
                  type="button"
                  onClick={toggleHideAmounts}
                  className={`w-11 h-6 rounded-full transition-all relative cursor-pointer ${
                    hideAmounts ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow-sm ${
                      hideAmounts ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-accent/60 border border-border/70">
                <p className="text-xs font-extrabold text-foreground truncate">
                  {auth.currentUser?.displayName || 'Cuenta activa'}
                </p>
                <p className="text-[10px] text-foreground/50 truncate">
                  {auth.currentUser?.email || 'Sin correo'} · v{APP_VERSION}
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3 bg-rose-500/10 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-extrabold transition-colors cursor-pointer"
              >
                <LogOut size={15} />
                Cerrar Sesión
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
