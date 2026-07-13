'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, List, Wallet, Settings } from "lucide-react";

export function DesktopNavigation() {
  const pathname = usePathname();
  
  return (
    <nav className="flex-1 px-4 space-y-1">
      <DesktopNavItem href="/" label="Inicio" icon={Home} active={pathname === "/"} />
      <DesktopNavItem href="/transacciones" label="Transacciones" icon={List} active={pathname.startsWith("/transacciones")} />
      <DesktopNavItem href="/cuentas" label="Cuentas" icon={Wallet} active={pathname.startsWith("/cuentas")} />
      <DesktopNavItem href="/ajustes" label="Ajustes" icon={Settings} active={pathname.startsWith("/ajustes")} />
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border flex justify-around p-4 pb-6 md:hidden z-[60] safe-area-bottom shadow-[0_-8px_30px_rgb(0,0,0,0.03)] dark:shadow-[0_-8px_30px_rgb(0,0,0,0.2)]">
      <MobileNavItem href="/" label="Inicio" icon={Home} active={pathname === "/"} />
      <MobileNavItem href="/transacciones" label="Gastos" icon={List} active={pathname.startsWith("/transacciones")} />
      <MobileNavItem href="/cuentas" label="Cuentas" icon={Wallet} active={pathname.startsWith("/cuentas")} />
      <MobileNavItem href="/ajustes" label="Ajustes" icon={Settings} active={pathname.startsWith("/ajustes")} />
    </nav>
  );
}

interface NavItemProps {
  href: string;
  label: string;
  icon: any;
  active: boolean;
}

function DesktopNavItem({ href, label, icon: Icon, active }: NavItemProps) {
  return (
    <Link 
      href={href} 
      className={`flex items-center gap-3 p-3 rounded-xl text-sm font-semibold transition-all relative group ${
        active 
          ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20' 
          : 'text-foreground/60 hover:text-foreground hover:bg-accent/40'
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-indigo-500 rounded-r-full" />
      )}
      <Icon size={18} className={`transition-transform duration-200 group-hover:scale-110 ${active ? 'text-indigo-500 dark:text-indigo-400' : 'opacity-70'}`} />
      <span>{label}</span>
    </Link>
  );
}

function MobileNavItem({ href, label, icon: Icon, active }: NavItemProps) {
  return (
    <Link 
      href={href} 
      className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-all relative py-1 px-3 rounded-xl ${
        active 
          ? 'text-indigo-600 dark:text-indigo-400' 
          : 'text-foreground/40 hover:text-foreground'
      }`}
    >
      <Icon size={20} className={`transition-transform duration-200 ${active ? 'scale-110 text-indigo-500' : 'opacity-70'}`} />
      <span>{label}</span>
      {active && (
        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-0.5" />
      )}
    </Link>
  );
}
