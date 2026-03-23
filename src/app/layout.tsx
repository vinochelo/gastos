import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Home, List, Wallet, Settings, LucideIcon } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gestor de Gastos | Inteligencia en tus Finanzas",
  description: "Controla tus gastos con el bot de Telegram y Groq AI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const ICONS: Record<string, LucideIcon> = { Home, List, Wallet, Settings };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body 
        className={`${inter.className} min-h-screen bg-background text-foreground`}
        suppressHydrationWarning
      >
        <div className="flex min-h-screen">
          <aside className="hidden md:flex w-64 flex-col fixed h-full z-50 border-r border-border bg-card">
            <div className="p-8">
              <h1 className="text-lg font-bold tracking-tight">GESTOR.AI</h1>
              <p className="text-[10px] font-semibold uppercase tracking-widest opacity-30 mt-1">Finanzas</p>
            </div>
            <nav className="flex-1 px-4 space-y-1">
              <DesktopNavItem href="/" label="Inicio" icon="Home" />
              <DesktopNavItem href="/transacciones" label="Transacciones" icon="List" />
              <DesktopNavItem href="/cuentas" label="Cuentas" icon="Wallet" />
              <DesktopNavItem href="/ajustes" label="Ajustes" icon="Settings" />
            </nav>
            <div className="p-8 opacity-20 text-[10px] font-semibold uppercase tracking-widest">
              v2.0
            </div>
          </aside>

          <main className="flex-1 md:ml-64 p-4 sm:p-6 lg:p-8 pb-36 md:pb-8 max-w-3xl mx-auto w-full">
            {children}
          </main>
        </div>
        
        <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border flex justify-around p-4 pb-6 md:hidden z-[60] safe-area-bottom">
          <MobileNavItem href="/" label="Inicio" icon="Home" />
          <MobileNavItem href="/transacciones" label="Gastos" icon="List" />
          <MobileNavItem href="/cuentas" label="Cuentas" icon="Wallet" />
          <MobileNavItem href="/ajustes" label="Ajustes" icon="Settings" />
        </nav>
      </body>
    </html>
  );
}

function DesktopNavItem({ href, label, icon }: { href: string, label: string, icon: string }) {
  const Icon = ICONS[icon];
  return (
    <a 
      href={href} 
      className="flex items-center gap-3 p-3 rounded-xl text-sm font-medium text-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
    >
      <Icon size={18} />
      <span>{label}</span>
    </a>
  );
}

function MobileNavItem({ href, label, icon }: { href: string, label: string, icon: string }) {
  const Icon = ICONS[icon];
  return (
    <a 
      href={href} 
      className="flex flex-col items-center gap-1 text-[10px] font-semibold text-foreground/40 hover:text-foreground transition-colors"
    >
      <Icon size={20} />
      <span>{label}</span>
    </a>
  );
}
