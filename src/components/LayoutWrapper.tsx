'use client';

import { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, Menu, Moon, Settings, Sun } from 'lucide-react';
import OfflineIndicator from './OfflineIndicator';
import GlobalVoiceAssistant from './GlobalVoiceAssistant';
import { DesktopSidebar, MobileNavigation } from './Navigation';
import SidebarDrawer from './SidebarDrawer';
import { useApp } from '@/context/AppContext';

function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Resumen';
  if (pathname.startsWith('/transacciones')) return 'Movimientos';
  if (pathname.startsWith('/cuentas')) return 'Cuentas';
  if (pathname.startsWith('/presupuestos')) return 'Presupuestos';
  if (pathname.startsWith('/deudas')) return 'Deudas y Cobros';
  if (pathname.startsWith('/metas')) return 'Metas de Ahorro';
  if (pathname.startsWith('/ajustes')) return 'Ajustes y Bot';
  return 'Control de Gastos';
}

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    reduceMotion,
    openDrawer,
    hideAmounts,
    toggleHideAmounts,
    isDarkMode,
    toggleDarkMode,
  } = useApp();

  const isLogin = pathname.startsWith('/login');
  const sectionTitle = getPageTitle(pathname);

  return (
    <>
      <OfflineIndicator />

      <div className="flex min-h-screen">
        {!isLogin && <DesktopSidebar />}

        <main
          className={
            isLogin
              ? 'flex-1 px-4 sm:px-6 w-full'
              : 'flex-1 md:ml-64 px-4 sm:px-6 lg:px-8 pb-32 md:pb-10 max-w-4xl mx-auto w-full relative'
          }
        >
          {!isLogin && (
            <header className="md:hidden sticky top-0 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 mb-3 bg-background/90 backdrop-blur-xl border-b border-border/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={openDrawer}
                  className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-foreground/75 hover:text-foreground transition-colors cursor-pointer shrink-0"
                  title="Abrir menú"
                >
                  <Menu size={18} />
                </button>
                <div className="flex items-center gap-2 min-w-0">
                  <Image
                    src="/app_icon.png"
                    alt="Control de Gastos"
                    width={26}
                    height={26}
                    className="rounded-lg border border-border/50 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-primary leading-none">
                      GESTOR.AI
                    </p>
                    <p className="text-sm font-black tracking-tight text-foreground truncate leading-tight">
                      {sectionTitle}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={toggleHideAmounts}
                  title={hideAmounts ? 'Mostrar saldos' : 'Ocultar saldos'}
                  className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                >
                  {hideAmounts ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  title={isDarkMode ? 'Modo claro' : 'Modo oscuro'}
                  className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                >
                  {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/ajustes')}
                  title="Ajustes"
                  className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                >
                  <Settings size={16} />
                </button>
              </div>
            </header>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {!isLogin && (
        <>
          <MobileNavigation />
          <SidebarDrawer />
          <GlobalVoiceAssistant />
        </>
      )}
    </>
  );
}
