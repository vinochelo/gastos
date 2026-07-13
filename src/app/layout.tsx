import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DesktopNavigation, MobileNavigation } from "@/components/Navigation";
import LayoutWrapper from "@/components/LayoutWrapper";

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
            
            <DesktopNavigation />
            
            <div className="p-8 opacity-20 text-[10px] font-semibold uppercase tracking-widest">
              v2.0
            </div>
          </aside>

          <main className="flex-1 md:ml-64 p-4 sm:p-6 lg:p-8 pb-36 md:pb-8 max-w-3xl mx-auto w-full relative">
            <LayoutWrapper>
              {children}
            </LayoutWrapper>
          </main>
        </div>
        
        <MobileNavigation />
      </body>
    </html>
  );
}
