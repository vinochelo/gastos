'use client';

import { useAuth } from "@/hooks/useAuth";
import { LogIn, KeyRound, Mail, User, Lock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Image from "next/image";

export default function LoginPage() {
  const { 
    loginWithGoogle, 
    loginWithEmail, 
    signUpWithEmail, 
    loading, 
    error: authError, 
    user 
  } = useAuth();
  
  const router = useRouter();
  
  // Tabs: 'google' | 'email'
  const [activeTab, setActiveTab] = useState<'google' | 'email'>('google');
  // Email mode: 'signin' | 'signup'
  const [emailMode, setEmailMode] = useState<'signin' | 'signup'>('signin');
  
  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handleGoogleLogin = async () => {
    await loginWithGoogle();
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    const cleanName = name.trim();

    if (!cleanEmail || !cleanPassword) {
      setLocalError("Por favor rellena todos los campos obligatorios.");
      return;
    }

    if (emailMode === 'signup' && !cleanName) {
      setLocalError("Por favor ingresa tu nombre.");
      return;
    }

    setLocalLoading(true);
    setLocalError(null);

    try {
      if (emailMode === 'signin') {
        await loginWithEmail(cleanEmail, cleanPassword);
      } else {
        await signUpWithEmail(cleanEmail, cleanPassword, cleanName);
      }
      router.push("/");
    } catch (err: any) {
      console.error(err);
      setLocalError(err.message || "Error al autenticar. Verifica tus credenciales.");
    } finally {
      setLocalLoading(false);
    }
  };

  const displayedError = localError || authError;

  if (loading || localLoading) return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <Loader2 size={32} className="animate-spin text-primary" />
      <span className="font-bold text-sm tracking-wide animate-pulse">Procesando solicitud...</span>
    </div>
  );

  if (user) {
    router.push("/");
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] gap-8 p-6 text-center">
      <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-700 flex flex-col items-center">
        <Image 
          src="/app_icon.png" 
          alt="Gestor.AI Icon" 
          width={80} 
          height={80} 
          className="rounded-3xl shadow-xl border border-border/10 mb-2 hover:scale-105 transition-transform duration-300"
          priority
        />
        <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">GESTOR.AI</h1>
        <p className="text-xs font-semibold text-foreground/60 max-w-xs mx-auto">Tus finanzas controladas en tiempo real, impulsadas con Inteligencia Artificial.</p>
      </div>
      
      <div className="glass p-8 rounded-[2.5rem] shadow-2xl space-y-6 w-full max-w-sm border border-white/20 dark:border-white/5 relative overflow-hidden animate-in zoom-in-95 duration-500">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-28 h-28 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-28 h-28 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-inner border border-primary/5">
           <LogIn className="text-primary" size={30} />
        </div>
        
        <div>
          <h2 className="text-2xl font-black tracking-tight text-foreground">Ingreso al Sistema</h2>
          <p className="text-xs text-foreground/45 mt-1 font-semibold">Inicia sesión o crea tu cuenta nativa</p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <button
            onClick={() => { setActiveTab('email'); setLocalError(null); }}
            className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'email' ? 'bg-white dark:bg-gray-700 text-foreground shadow-sm' : 'text-foreground/40'
            }`}
          >
            <Mail size={14} />
            Correo
          </button>
          <button
            onClick={() => { setActiveTab('google'); setLocalError(null); }}
            className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'google' ? 'bg-white dark:bg-gray-700 text-foreground shadow-sm' : 'text-foreground/40'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            </svg>
            Google
          </button>
        </div>

        {displayedError && (
          <p className="text-red-500 text-xs bg-red-50 dark:bg-red-950/20 border border-red-500/10 p-3.5 rounded-2xl font-bold animate-in shake duration-300">
            {displayedError}
          </p>
        )}

        {activeTab === 'google' ? (
          <div className="space-y-4">
            <button 
              onClick={handleGoogleLogin}
              className="w-full bg-foreground text-background dark:bg-white dark:text-black py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-lg hover:shadow-xl cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar con Google
            </button>
            <p className="text-[10px] text-foreground/45 leading-normal">
              Nota: Google Sign-In requiere abrir el navegador del dispositivo, lo cual puede presentar problemas en algunas marcas de teléfonos.
            </p>
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} className="space-y-4 text-left">
            {/* Email Inner Sub-Toggle */}
            <div className="flex gap-4 border-b border-border/60 pb-2 mb-2 justify-center">
              <button
                type="button"
                onClick={() => { setEmailMode('signin'); setLocalError(null); }}
                className={`text-xs font-bold transition-all cursor-pointer pb-1 px-2 ${
                  emailMode === 'signin' 
                    ? 'text-primary border-b-2 border-primary font-black' 
                    : 'text-foreground/40'
                }`}
              >
                Tengo Cuenta
              </button>
              <button
                type="button"
                onClick={() => { setEmailMode('signup'); setLocalError(null); }}
                className={`text-xs font-bold transition-all cursor-pointer pb-1 px-2 ${
                  emailMode === 'signup' 
                    ? 'text-primary border-b-2 border-primary font-black' 
                    : 'text-foreground/40'
                }`}
              >
                Nuevo Registro
              </button>
            </div>

            {emailMode === 'signup' && (
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/45 px-1 block">Tu Nombre</label>
                <div className="relative">
                  <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/35" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Mathew..."
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 pl-10 rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    required={emailMode === 'signup'}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/45 px-1 block">Correo Electrónico</label>
              <div className="relative">
                <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/35" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 pl-10 rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/45 px-1 block">Contraseña</label>
              <div className="relative">
                <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/35" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 pl-10 rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-md shadow-indigo-600/10 cursor-pointer mt-4"
            >
              {emailMode === 'signin' ? (
                <>
                  <LogIn size={16} /> Iniciar Sesión
                </>
              ) : (
                <>
                  <KeyRound size={16} /> Crear Cuenta y Acceder
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
