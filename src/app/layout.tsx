import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DesktopNavigation, MobileNavigation } from "@/components/Navigation";
import LayoutWrapper from "@/components/LayoutWrapper";
import { APP_VERSION } from "@/lib/version";
import { AppProvider } from "@/context/AppContext";
import SidebarDrawer from "@/components/SidebarDrawer";

import Image from "next/image";

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
        <AppProvider>
          <div className="flex min-h-screen">
            <aside className="hidden md:flex w-64 flex-col fixed h-full z-50 border-r border-border bg-card">
              <div className="p-6 flex items-center gap-3 border-b border-border/10 mb-4">
                <Image 
                  src="/app_icon.png" 
                  alt="Logo" 
                  width={36} 
                  height={36} 
                  className="rounded-xl shadow-md border border-border/10"
                />
                <div>
                  <h1 className="text-xs font-black tracking-tight leading-none text-foreground">GESTOR.AI</h1>
                  <p className="text-[8px] font-extrabold uppercase tracking-widest opacity-35 mt-1.5">Finanzas</p>
                </div>
              </div>
              
              <DesktopNavigation />
              
              <div className="p-8 opacity-20 text-[10px] font-semibold uppercase tracking-widest">
                v{APP_VERSION}
              </div>
            </aside>

            <main className="flex-1 md:ml-64 p-4 sm:p-6 lg:p-8 pb-36 md:pb-8 max-w-3xl mx-auto w-full relative">
              <LayoutWrapper>
                {children}
              </LayoutWrapper>
            </main>
          </div>
          
          <MobileNavigation />
          <SidebarDrawer />
        </AppProvider>
      </body>
    </html>
  );
}
