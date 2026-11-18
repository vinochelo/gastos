'use client';

import { useAuth } from '@/hooks/useAuth';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Capacitor } from '@capacitor/core';
import { authFetch } from '@/lib/api';
import SplashLoading from '@/components/SplashLoading';

function GoogleLogo({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const {
    loginWithGoogle,
    loginWithGoogleBrowser,
    loginWithCustomToken,
    loginWithEmail,
    signUpWithEmail,
    loading,
    error: authError,
    clearError,
    user,
  } = useAuth();

  const router = useRouter();

  const [isNative, setIsNative] = useState(false);
  const [mobileSessionParam, setMobileSessionParam] = useState<string | null>(null);
  const [generatedMobileCode, setGeneratedMobileCode] = useState<string | null>(null);
  const [generatingMobileCode, setGeneratingMobileCode] = useState(false);

  // Android waiting for browser auth
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(false);

  // Email/password form
  const [emailMode, setEmailMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 6-digit code manual fallback
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);

  const [localLoading, setLocalLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handshakeDoneRef = useRef<string | null>(null);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ms = params.get('mobile_session');
      if (ms && ms.trim().length >= 8) {
        setMobileSessionParam(ms.trim());
      }
      const deepCode = params.get('code');
      if (deepCode && /^\d{6}$/.test(deepCode.trim())) {
        setManualCode(deepCode.trim());
        setShowCodeEntry(true);
      }
    }
  }, []);

  // Redirect normally only when NOT completing a browser->APK handshake
  useEffect(() => {
    if (user && !mobileSessionParam) {
      router.push('/');
    }
  }, [user, mobileSessionParam, router]);

  // Browser side: once user logs in with ?mobile_session=XYZ, mint mobile auth code and deep-link back to APK
  const completeBrowserMobileHandshake = useCallback(async (sessionId: string) => {
    if (handshakeDoneRef.current === sessionId) return;
    handshakeDoneRef.current = sessionId;
    setGeneratingMobileCode(true);
    setLocalError(null);
    try {
      const res = await authFetch('/api/mobile-auth/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok || !data.code) {
        throw new Error(data.error || 'No se pudo autorizar la sesión móvil.');
      }
      setGeneratedMobileCode(data.code);
      if (typeof window !== 'undefined') {
        window.location.href = `com.gestordegastos.app://auth?code=${encodeURIComponent(data.code)}`;
      }
    } catch (err: unknown) {
      handshakeDoneRef.current = null;
      const msg = err instanceof Error ? err.message : 'Error al vincular con la app.';
      setLocalError(msg);
    } finally {
      setGeneratingMobileCode(false);
    }
  }, []);

  useEffect(() => {
    if (user && mobileSessionParam && !generatedMobileCode) {
      void completeBrowserMobileHandshake(mobileSessionParam);
    }
  }, [user, mobileSessionParam, generatedMobileCode, completeBrowserMobileHandshake]);

  // Android side: poll /api/mobile-auth/verify with pendingSessionId while browser is open
  const verifyPendingSession = useCallback(
    async (sessionId: string) => {
      setCheckingSession(true);
      try {
        const res = await authFetch('/api/mobile-auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (data.valid && data.customToken) {
          setPendingSessionId(null);
          await loginWithCustomToken(data.customToken);
          router.push('/');
        } else if (!data.pending && data.error) {
          setPendingSessionId(null);
          setLocalError(data.error);
        }
      } catch {
        // Keep polling silently while user is completing browser login
      } finally {
        setCheckingSession(false);
      }
    },
    [loginWithCustomToken, router]
  );

  useEffect(() => {
    if (!pendingSessionId) return;

    const interval = setInterval(() => {
      void verifyPendingSession(pendingSessionId);
    }, 2500);

    const handleReturnToApp = () => {
      if (document.visibilityState === 'visible') {
        void verifyPendingSession(pendingSessionId);
      }
    };

    window.addEventListener('focus', handleReturnToApp);
    document.addEventListener('visibilitychange', handleReturnToApp);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleReturnToApp);
      document.removeEventListener('visibilitychange', handleReturnToApp);
    };
  }, [pendingSessionId, verifyPendingSession]);

  const handleGoogleLogin = async () => {
    setLocalError(null);
    clearError();
    setGoogleLoading(true);
    try {
      const sessionId = await loginWithGoogle();
      if (sessionId) {
        setPendingSessionId(sessionId);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleBrowserGoogleLogin = async () => {
    setLocalError(null);
    clearError();
    setGoogleLoading(true);
    try {
      const sessionId = await loginWithGoogleBrowser();
      if (sessionId) {
        setPendingSessionId(sessionId);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    const cleanName = name.trim();

    if (!cleanEmail || !cleanPassword) {
      setLocalError('Por favor ingresa tu correo y contraseña.');
      return;
    }

    if (emailMode === 'signup' && !cleanName) {
      setLocalError('Por favor ingresa tu nombre.');
      return;
    }

    setLocalLoading(true);
    setLocalError(null);
    clearError();

    try {
      if (emailMode === 'signin') {
        await loginWithEmail(cleanEmail, cleanPassword);
      } else {
        await signUpWithEmail(cleanEmail, cleanPassword, cleanName);
      }
      router.push('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      setLocalError(message || 'No se pudo iniciar sesión. Verifica tus datos.');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleManualCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = manualCode.trim();
    if (cleanCode.length < 6) {
      setLocalError('Ingresa el código de 6 dígitos.');
      return;
    }
    setCodeLoading(true);
    setLocalError(null);
    clearError();
    try {
      const res = await authFetch('/api/mobile-auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode }),
      });
      const data = await res.json();
      if (!data.valid || !data.customToken) {
        throw new Error(data.error || 'Código inválido o expirado.');
      }
      await loginWithCustomToken(data.customToken);
      router.push('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al validar código.';
      setLocalError(msg);
    } finally {
      setCodeLoading(false);
    }
  };

  const displayedError = localError || authError;

  if (loading || localLoading) return <SplashLoading />;
  if (user && !mobileSessionParam) return <SplashLoading />;

  // Browser Handshake Mode (?mobile_session=...)
  if (mobileSessionParam) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-card border border-border shadow-md p-1.5 flex items-center justify-center">
              <Image
                src="/app_icon.png"
                alt="Control de Gastos"
                width={52}
                height={52}
                className="rounded-xl"
                priority
              />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Conectar con la App Android
              </h1>
              <p className="text-xs text-foreground/60 mt-1 max-w-xs mx-auto">
                Usa la cuenta de Google ya abierta en tu navegador para acceder en tu teléfono.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-[2rem] p-6 sm:p-7 shadow-xl space-y-5">
            {displayedError && (
              <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400 text-center">
                {displayedError}
              </div>
            )}

            {user ? (
              <div className="space-y-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                  {generatingMobileCode ? (
                    <Loader2 size={26} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={28} />
                  )}
                </div>

                <div>
                  <h2 className="text-lg font-black text-foreground">
                    {generatingMobileCode ? 'Autorizando acceso...' : '¡Cuenta lista!'}
                  </h2>
                  <p className="text-xs text-foreground/60 mt-1">
                    Sesión iniciada como{' '}
                    <span className="font-bold text-foreground">
                      {user.email || user.displayName}
                    </span>
                  </p>
                </div>

                {generatedMobileCode && (
                  <>
                    <a
                      href={`com.gestordegastos.app://auth?code=${encodeURIComponent(
                        generatedMobileCode
                      )}`}
                      className="w-full py-3.5 px-4 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:opacity-95 transition-opacity"
                    >
                      <ExternalLink size={16} />
                      Volver a Control de Gastos
                    </a>

                    <div className="rounded-2xl bg-accent/70 border border-border p-4 space-y-1">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/50">
                        Código de respaldo (si no vuelve solo)
                      </p>
                      <p className="text-2xl font-mono font-black tracking-[0.25em] text-primary">
                        {generatedMobileCode}
                      </p>
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="text-xs font-bold text-foreground/55 hover:text-foreground transition-colors cursor-pointer"
                >
                  Continuar aquí en el navegador →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleBrowserGoogleLogin}
                  disabled={googleLoading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-card hover:bg-accent border border-border text-foreground font-bold text-sm flex items-center justify-center gap-3 shadow-sm transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60"
                >
                  {googleLoading ? (
                    <Loader2 size={20} className="animate-spin text-primary" />
                  ) : (
                    <GoogleLogo />
                  )}
                  <span>
                    {googleLoading
                      ? 'Abriendo cuentas de Google...'
                      : 'Elegir mi cuenta de Google'}
                  </span>
                </button>
                <p className="text-[11px] text-foreground/55 text-center leading-relaxed">
                  Al seleccionar tu cuenta volverás automáticamente a la aplicación instalada.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Organic Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative">
            <div className="absolute -inset-2 rounded-3xl bg-primary/15 blur-xl pointer-events-none" />
            <Image
              src="/app_icon.png"
              alt="Control de Gastos"
              width={68}
              height={68}
              className="relative rounded-2xl shadow-lg border border-border"
              priority
            />
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-extrabold uppercase tracking-wider">
              <Sparkles size={12} />
              GESTOR.AI
            </div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              Control de Gastos
            </h1>
            <p className="text-xs sm:text-sm text-foreground/60 max-w-xs mx-auto leading-relaxed">
              Registra tus movimientos por voz, texto o Telegram en segundos.
            </p>
          </div>
        </div>

        {/* Main Organic Auth Card */}
        <div className="bg-card border border-border rounded-[2rem] p-6 sm:p-8 shadow-xl space-y-5">
          {pendingSessionId ? (
            <div className="py-4 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Loader2 size={26} className="animate-spin" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-black text-foreground">
                  Completa el ingreso en tu navegador
                </h2>
                <p className="text-xs text-foreground/60 leading-relaxed max-w-xs mx-auto">
                  Elige una de las cuentas de Google abiertas en tu navegador. Esta pantalla se
                  actualizará automáticamente al terminar.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => void verifyPendingSession(pendingSessionId)}
                  disabled={checkingSession}
                  className="w-full py-3 rounded-2xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-primary/20 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw size={14} className={checkingSession ? 'animate-spin' : ''} />
                  {checkingSession ? 'Verificando...' : 'Ya inicié sesión en el navegador'}
                </button>

                <button
                  type="button"
                  onClick={() => setPendingSessionId(null)}
                  className="w-full py-2.5 rounded-2xl bg-accent text-foreground/75 hover:text-foreground text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  Volver a opciones de ingreso
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-xl font-black tracking-tight text-foreground">
                  {emailMode === 'signin' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
                </h2>
                <p className="text-xs text-foreground/55">
                  {emailMode === 'signin'
                    ? 'Elige cómo prefieres acceder a tu panel financiero'
                    : 'Comienza a controlar tus cuentas, presupuestos y metas'}
                </p>
              </div>

              {displayedError && (
                <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400">
                  {displayedError}
                </div>
              )}

              {/* Primary Google Sign-In */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-background hover:bg-accent border border-border text-foreground font-bold text-sm flex items-center justify-center gap-3 shadow-sm transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60"
                >
                  {googleLoading ? (
                    <Loader2 size={20} className="animate-spin text-primary" />
                  ) : (
                    <GoogleLogo />
                  )}
                  <span>
                    {googleLoading ? 'Conectando con Google...' : 'Continuar con Google'}
                  </span>
                </button>

                {isNative && (
                  <button
                    type="button"
                    onClick={handleBrowserGoogleLogin}
                    disabled={googleLoading}
                    className="w-full py-2.5 px-3 rounded-xl bg-primary/8 hover:bg-primary/14 text-primary text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ExternalLink size={13} />
                    <span>Usar cuentas de Google abiertas en el navegador</span>
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-border" />
                <span className="px-3 text-[11px] font-semibold text-foreground/45">
                  o con tu correo
                </span>
                <div className="flex-grow border-t border-border" />
              </div>

              {/* Direct Email / Password Form */}
              <form onSubmit={handleEmailSubmit} className="space-y-3.5">
                {emailMode === 'signup' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground/65 px-1 block">
                      Nombre
                    </label>
                    <div className="relative">
                      <UserIcon
                        size={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40"
                      />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Tu nombre"
                        className="w-full bg-background border border-border py-3 pl-10 pr-3.5 rounded-2xl text-sm text-foreground placeholder-foreground/35 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground/65 px-1 block">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      autoComplete="email"
                      className="w-full bg-background border border-border py-3 pl-10 pr-3.5 rounded-2xl text-sm text-foreground placeholder-foreground/35 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground/65 px-1 block">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40"
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete={emailMode === 'signin' ? 'current-password' : 'new-password'}
                      className="w-full bg-background border border-border py-3 pl-10 pr-11 rounded-2xl text-sm text-foreground placeholder-foreground/35 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-foreground/45 hover:text-foreground cursor-pointer"
                      title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-primary hover:opacity-95 text-white font-bold text-sm shadow-lg shadow-primary/20 transition-all active:scale-[0.99] cursor-pointer mt-1"
                >
                  {emailMode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta gratis'}
                </button>
              </form>

              <div className="pt-1 flex flex-col items-center gap-2.5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
                    setLocalError(null);
                    clearError();
                  }}
                  className="text-xs font-bold text-foreground/65 hover:text-primary transition-colors cursor-pointer"
                >
                  {emailMode === 'signin'
                    ? '¿No tienes cuenta? Regístrate aquí'
                    : '¿Ya tienes cuenta? Inicia sesión'}
                </button>

                {/* Manual 6-digit mobile auth code fallback */}
                <button
                  type="button"
                  onClick={() => setShowCodeEntry((prev) => !prev)}
                  className="text-[11px] font-semibold text-foreground/45 hover:text-foreground inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <KeyRound size={12} />
                  {showCodeEntry ? 'Ocultar código temporal' : 'Ingresar con código de 6 dígitos'}
                </button>

                {showCodeEntry && (
                  <form
                    onSubmit={handleManualCodeSubmit}
                    className="w-full flex items-center gap-2 pt-1 animate-in fade-in duration-200"
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Código (6 dígitos)"
                      className="flex-1 bg-background border border-border px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-center tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <button
                      type="submit"
                      disabled={codeLoading || manualCode.length < 6}
                      className="px-4 py-2.5 rounded-xl bg-foreground text-background text-xs font-bold cursor-pointer disabled:opacity-45"
                    >
                      {codeLoading ? <Loader2 size={14} className="animate-spin" /> : 'Entrar'}
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>

        <p className="text-[11px] text-foreground/40 text-center flex items-center justify-center gap-1.5">
          <ShieldCheck size={13} className="text-primary" />
          Sesión segura sincronizada con Firebase y Telegram
        </p>
      </div>
    </div>
  );
}
