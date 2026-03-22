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
          {/* Desktop Sidebar */}
          <aside className="hidden md:flex w-64 flex-col glass border-r border-border fixed h-full z-50">
            <div className="p-8">
              <h1 className="text-xl font-black italic tracking-tighter text-primary">GESTOR.AI</h1>
            </div>
            <nav className="flex-1 px-4 space-y-2">
              <DesktopNavItem href="/" label="Inicio" icon="Home" />
              <DesktopNavItem href="/transacciones" label="Gastos" icon="List" />
              <DesktopNavItem href="/cuentas" label="Cuentas" icon="Wallet" />
              <DesktopNavItem href="/ajustes" label="Ajustes" icon="Settings" />
            </nav>
            <div className="p-8 opacity-20 text-[10px] font-bold uppercase tracking-widest">
              v1.0.42
            </div>
          </aside>

          {/* Main Content Pane */}
          <main className="flex-1 md:ml-64 p-4 sm:p-6 lg:p-8 pb-32 md:pb-8 max-w-5xl mx-auto w-full">
            {children}
          </main>
        </div>
        
        {/* Mobile Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 glass border-t border-border flex justify-around p-4 md:hidden z-50">
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
      className="flex items-center gap-4 p-4 rounded-2xl text-sm font-bold text-foreground/50 hover:text-primary hover:bg-primary/5 transition-all group"
    >
      <Icon size={20} className="group-hover:scale-110 transition-transform" />
      <span>{label}</span>
    </a>
  );
}

function MobileNavItem({ href, label, icon }: { href: string, label: string, icon: string }) {
  const Icon = ICONS[icon];
  return (
    <a 
      href={href} 
      className="flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-tighter text-foreground/40 hover:text-primary transition-all active:scale-90"
    >
      <Icon size={20} />
      <span>{label}</span>
    </a>
  );
}
