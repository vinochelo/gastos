'use client';

import { useAuth } from "@/hooks/useAuth";
import { LogIn } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { loginWithGoogle, loading, error, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  if (loading) return <div className="flex h-screen items-center justify-center font-bold italic opacity-30">Cargando...</div>;

  if (loading) return <div className="flex h-screen items-center justify-center font-bold italic opacity-30">Cargando...</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-5xl font-black tracking-tighter text-primary">GESTOR.</h1>
        <p className="text-lg font-medium text-foreground/60">Tus finanzas, simplificadas con IA.</p>
      </div>
      
      <div className="glass p-8 rounded-[2.5rem] shadow-2xl space-y-6 w-full max-w-sm">
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-pulse">
           <LogIn className="text-primary" size={40} />
        </div>
        <h2 className="text-2xl font-bold">Bienvenido</h2>
        <p className="text-sm text-foreground/50">Inicia sesión para sincronizar tus gastos con tu bot de Telegram.</p>
        {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
        <button 
          onClick={loginWithGoogle}
          className="w-full bg-foreground text-background py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
        >
          <Image src="https://www.google.com/favicon.ico" width={20} height={20} alt="google" />
          Continuar con Google
        </button>
      </div>
    </div>
  );
}
