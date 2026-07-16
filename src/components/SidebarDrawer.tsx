'use client';

import { useApp } from "@/context/AppContext";
import { auth } from "@/lib/firebase";
import { usePathname, useRouter } from "next/navigation";
import { 
  Home, List, Wallet, Settings, TrendingUp, DollarSign, Target, 
  Moon, Eye, EyeOff, LogOut, X, User
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function SidebarDrawer() {
  const { 
    isDrawerOpen, 
    closeDrawer, 
    isDarkMode, 
    toggleDarkMode, 
    hideAmounts, 
    toggleHideAmounts 
  } = useApp();
  
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    if (confirm("¿Cerrar sesión?")) {
      closeDrawer();
      await auth.signOut();
      router.push('/login');
    }
  };

  const navItems = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/transacciones", label: "Transacciones", icon: List },
    { href: "/cuentas", label: "Cuentas", icon: Wallet },
    { href: "/presupuestos", label: "Presupuestos", icon: TrendingUp },
    { href: "/deudas", label: "Deudas", icon: DollarSign },
    { href: "/metas", label: "Metas / Objetivos", icon: Target },
    { href: "/ajustes", label: "Configuración", icon: Settings },
  ];

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={closeDrawer}
            className="fixed inset-0 bg-black z-[100] md:hidden"
          />

          {/* Drawer content */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 bottom-0 left-0 w-72 bg-card border-r border-border z-[101] md:hidden flex flex-col p-6 shadow-2xl overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center border border-indigo-600/5">
                  <User size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm text-foreground truncate">GESTOR.AI</h3>
                  <p className="text-[10px] text-foreground/40 font-semibold truncate max-w-[150px]">
                    {auth.currentUser?.email || "Usuario"}
                  </p>
                </div>
              </div>
              <button 
                onClick={closeDrawer}
                className="p-1.5 hover:bg-accent/40 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} className="opacity-50 text-foreground" />
              </button>
            </div>

            {/* Navigation links */}
            <div className="flex-1 space-y-1.5">
              {navItems.map((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeDrawer}
                    className={`flex items-center gap-3.5 p-3.5 rounded-2xl text-xs font-black tracking-tight transition-all ${
                      isActive 
                        ? "bg-indigo-600 text-white dark:bg-indigo-500 shadow-md shadow-indigo-600/15" 
                        : "text-foreground/60 hover:text-foreground hover:bg-accent/30"
                    }`}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Toggles and Settings */}
            <div className="pt-6 border-t border-border/10 space-y-4">
              {/* Dark Mode Toggle */}
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3 text-foreground/60">
                  <Moon size={16} />
                  <span className="text-xs font-extrabold tracking-tight">Modo oscuro</span>
                </div>
                <button
                  onClick={toggleDarkMode}
                  className={`w-11 h-6 rounded-full transition-all relative ${
                    isDarkMode ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                >
                  <span 
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow-sm ${
                      isDarkMode ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {/* Hide Amounts Toggle */}
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3 text-foreground/60">
                  {hideAmounts ? <EyeOff size={16} /> : <Eye size={16} />}
                  <span className="text-xs font-extrabold tracking-tight">Ocultar cantidades</span>
                </div>
                <button
                  onClick={toggleHideAmounts}
                  className={`w-11 h-6 rounded-full transition-all relative ${
                    hideAmounts ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                >
                  <span 
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow-sm ${
                      hideAmounts ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full mt-4 flex items-center justify-center gap-2 p-3.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-extrabold tracking-tight transition-colors cursor-pointer"
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
