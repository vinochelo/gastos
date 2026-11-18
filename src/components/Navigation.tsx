'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { signOutAll } from '@/hooks/useAuth';
import { useApp } from '@/context/AppContext';
import { APP_VERSION } from '@/lib/version';
import {
  ArrowDownUp,
  Eye,
  EyeOff,
  HandCoins,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Mic,
  Moon,
  PieChart,
  SlidersHorizontal,
  Square,
  Sun,
  Target,
  Wallet,
} from 'lucide-react';

interface NavGroup {
  title: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { href: '/', label: 'Resumen', icon: LayoutDashboard },
      { href: '/transacciones', label: 'Movimientos', icon: ArrowDownUp },
      { href: '/cuentas', label: 'Cuentas', icon: Wallet },
    ],
  },
  {
    title: 'Planificación',
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

export function DesktopSidebar() {
  const pathname = usePathname();
  if (pathname.startsWith('/login')) return null;

  return (
    <aside className="hidden md:flex w-64 flex-col fixed h-full z-50 border-r border-border bg-card">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-border mb-4">
        <Image
          src="/app_icon.png"
          alt="Control de Gastos"
          width={38}
          height={38}
          className="rounded-xl shadow-sm border border-border shrink-0"
        />
        <div className="min-w-0">
          <h1 className="text-sm font-black tracking-tight leading-tight text-foreground truncate">
            Control de Gastos
          </h1>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-primary mt-0.5">
            GESTOR.AI
          </p>
        </div>
      </div>

      <DesktopNavigation />
    </aside>
  );
}

export function DesktopNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    isDarkMode,
    toggleDarkMode,
    hideAmounts,
    toggleHideAmounts,
    confirmAction,
    isGlobalRecording,
    isGlobalVoiceLoading,
    recordingDuration,
    startGlobalVoiceRecording,
    stopGlobalVoiceRecording,
  } = useApp();

  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
    return () => unsub();
  }, []);

  if (pathname.startsWith('/login')) return null;

  const handleLogout = async () => {
    const confirmed = await confirmAction({
      title: 'Cerrar sesión',
      message: '¿Seguro que deseas salir de tu cuenta en este dispositivo?',
      confirmText: 'Cerrar sesión',
      destructive: true,
    });
    if (confirmed) {
      await signOutAll();
      router.push('/login');
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between overflow-y-auto px-3.5 pb-4">
      <div className="space-y-5">
        {/* Global Voice CTA */}
        <button
          type="button"
          onClick={isGlobalRecording ? stopGlobalVoiceRecording : startGlobalVoiceRecording}
          disabled={isGlobalVoiceLoading}
          className={`w-full rounded-2xl px-3.5 py-3 flex items-center justify-between gap-2 text-xs font-extrabold transition-all cursor-pointer shadow-sm ${
            isGlobalRecording
              ? 'bg-rose-500 text-white shadow-rose-500/25'
              : 'bg-primary text-white hover:opacity-95 shadow-primary/20'
          } disabled:opacity-60`}
        >
          <span className="flex items-center gap-2.5">
            {isGlobalVoiceLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isGlobalRecording ? (
              <Square size={14} className="fill-current animate-pulse" />
            ) : (
              <Mic size={16} />
            )}
            <span>
              {isGlobalVoiceLoading
                ? 'Procesando audio...'
                : isGlobalRecording
                ? 'Detener y registrar'
                : 'Registrar con Voz IA'}
            </span>
          </span>
          {isGlobalRecording && (
            <span className="font-mono text-[11px] bg-white/20 px-2 py-0.5 rounded-lg">
              {Math.floor(recordingDuration / 60)}:
              {(recordingDuration % 60).toString().padStart(2, '0')}
            </span>
          )}
        </button>

        {/* Grouped Navigation */}
        <nav className="space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-foreground/40">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-bold transition-all relative ${
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground/65 hover:text-foreground hover:bg-accent'
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full" />
                      )}
                      <Icon size={17} className={active ? 'text-primary' : 'opacity-70'} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Controls & User Card */}
      <div className="pt-4 mt-4 border-t border-border space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={toggleHideAmounts}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-accent/70 hover:bg-accent text-[11px] font-bold text-foreground/75 hover:text-foreground transition-colors cursor-pointer"
            title={hideAmounts ? 'Mostrar saldos' : 'Ocultar saldos'}
          >
            {hideAmounts ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{hideAmounts ? 'Oculto' : 'Saldos'}</span>
          </button>

          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-accent/70 hover:bg-accent text-[11px] font-bold text-foreground/75 hover:text-foreground transition-colors cursor-pointer"
            title={isDarkMode ? 'Modo claro' : 'Modo oscuro'}
          >
            {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
            <span>{isDarkMode ? 'Claro' : 'Oscuro'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-accent/50 border border-border/60">
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-foreground truncate">
              {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Usuario'}
            </p>
            <p className="text-[10px] text-foreground/45 truncate">
              {currentUser?.email || `v${APP_VERSION}`}
            </p>
          </div>
          {currentUser && (
            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              className="p-2 rounded-xl hover:bg-rose-500/10 text-foreground/50 hover:text-rose-500 transition-colors cursor-pointer shrink-0"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>

        <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-foreground/30">
          Control de Gastos · v{APP_VERSION}
        </p>
      </div>
    </div>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();
  const {
    openDrawer,
    isGlobalRecording,
    isGlobalVoiceLoading,
    recordingDuration,
    startGlobalVoiceRecording,
    stopGlobalVoiceRecording,
  } = useApp();

  if (pathname.startsWith('/login')) return null;

  const isMenuRouteActive =
    pathname.startsWith('/presupuestos') ||
    pathname.startsWith('/deudas') ||
    pathname.startsWith('/metas') ||
    pathname.startsWith('/ajustes');

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border md:hidden z-[60] safe-area-bottom shadow-[0_-8px_30px_rgba(15,23,42,0.06)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.4)]">
      <div className="grid grid-cols-5 items-end px-2 pt-2 pb-1">
        <MobileNavItem
          href="/"
          label="Inicio"
          icon={LayoutDashboard}
          active={pathname === '/'}
        />
        <MobileNavItem
          href="/transacciones"
          label="Movimientos"
          icon={ArrowDownUp}
          active={pathname.startsWith('/transacciones')}
        />

        {/* Central Elevated Voice IA Button */}
        <div className="flex flex-col items-center justify-end -mt-5 pb-1">
          <button
            type="button"
            onClick={isGlobalRecording ? stopGlobalVoiceRecording : startGlobalVoiceRecording}
            disabled={isGlobalVoiceLoading}
            title={isGlobalRecording ? 'Detener y registrar' : 'Dictar movimiento por voz'}
            className={`w-13 h-13 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all active:scale-95 cursor-pointer border-4 border-background ${
              isGlobalRecording
                ? 'bg-rose-500 shadow-rose-500/35 animate-pulse'
                : 'bg-primary shadow-primary/30'
            } disabled:opacity-70`}
          >
            {isGlobalVoiceLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : isGlobalRecording ? (
              <Square size={17} className="fill-current" />
            ) : (
              <Mic size={21} />
            )}
          </button>
          <span
            className={`text-[10px] font-extrabold mt-1 leading-none ${
              isGlobalRecording ? 'text-rose-500' : 'text-primary'
            }`}
          >
            {isGlobalRecording
              ? `${Math.floor(recordingDuration / 60)}:${(recordingDuration % 60)
                  .toString()
                  .padStart(2, '0')}`
              : isGlobalVoiceLoading
              ? 'IA...'
              : 'Voz IA'}
          </span>
        </div>

        <MobileNavItem
          href="/cuentas"
          label="Cuentas"
          icon={Wallet}
          active={pathname.startsWith('/cuentas')}
        />

        <button
          type="button"
          onClick={openDrawer}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold py-1.5 px-1 rounded-xl transition-colors cursor-pointer ${
            isMenuRouteActive ? 'text-primary' : 'text-foreground/50 hover:text-foreground'
          }`}
        >
          <Menu size={19} />
          <span>Menú</span>
        </button>
      </div>
    </nav>
  );
}

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
}

function MobileNavItem({ href, label, icon: Icon, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors py-1.5 px-1 rounded-xl ${
        active ? 'text-primary' : 'text-foreground/50 hover:text-foreground'
      }`}
    >
      <Icon size={19} className={active ? 'text-primary' : ''} />
      <span className="truncate max-w-full">{label}</span>
    </Link>
  );
}
