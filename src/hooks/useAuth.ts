'use client';

import { auth, db } from "@/lib/firebase";
import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged, 
  User, 
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signInWithCredential
} from "firebase/auth";
import { doc, setDoc, serverTimestamp, getDoc, collection, addDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { DEFAULT_CATEGORIES, DEFAULT_ACCOUNTS } from "@/lib/defaults";
import { Capacitor } from "@capacitor/core";

const DEFAULT_GOOGLE_WEB_CLIENT_ID =
  "505851925373-rn8c8fnrjnht0qllfsldrnlnjoihijpf.apps.googleusercontent.com";
const PROD_LOGIN_URL = "https://gastos-delta-pearl.vercel.app/login";

export async function signOutAll() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
      const webClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_WEB_CLIENT_ID;
      await GoogleAuth.initialize({
        clientId: webClientId,
        scopes: ['profile', 'email'],
        grantOfflineAccess: false,
      });
      await GoogleAuth.signOut();
    } catch {
      // Ignorar si no había sesión de Google activa en el dispositivo
    }
  }
  await signOut(auth);
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!Capacitor.isNativePlatform()) {
      getRedirectResult(auth)
        .then(async (result) => {
          if (active && result?.user) {
            await initializeUserRecord(result.user);
            setUser(result.user);
          }
        })
        .catch((err: unknown) => {
          const code = (err as { code?: string })?.code;
          if (active && code && code !== "auth/popup-closed-by-user") {
            setError("No se pudo completar el inicio de sesión con Google.");
          }
        });
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!active) return;
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Inicializar o sincronizar el registro del usuario en Firestore
  const initializeUserRecord = async (firebaseUser: User) => {
    const userRef = doc(db, "users", firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "Usuario",
        photoURL: firebaseUser.photoURL || "",
        telegramId: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        expenseCategories: DEFAULT_CATEGORIES,
        incomeCategories: ["Salario", "Inversion", "Regalo", "Otro"]
      });

      for (const acc of DEFAULT_ACCOUNTS) {
        await addDoc(collection(db, "accounts"), {
          userId: firebaseUser.uid,
          nombre: acc.nombre,
          saldo: acc.saldo,
          tipo: "bancaria"
        });
      }
    } else {
      const existingData = userSnap.data();
      const updates: Record<string, unknown> = {
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || existingData?.displayName || firebaseUser.email?.split('@')[0],
        photoURL: firebaseUser.photoURL || existingData?.photoURL || "",
        updatedAt: serverTimestamp(),
      };
      
      if (!existingData?.expenseCategories && !existingData?.categories) {
        updates.expenseCategories = DEFAULT_CATEGORIES;
        updates.incomeCategories = ["Salario", "Inversion", "Regalo", "Otro"];
      }
      
      await setDoc(userRef, updates, { merge: true });
    }
  };

  /**
   * Inicia sesión con Google usando el navegador del dispositivo o del navegador web.
   * En Android nativo devuelve un sessionId para hacer polling automático hasta que el navegador complete el login.
   */
  const loginWithGoogleBrowser = async (): Promise<string | null> => {
    setError(null);
    if (Capacitor.isNativePlatform()) {
      const sessionId = `mob_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const browserUrl = `${PROD_LOGIN_URL}?mobile_session=${encodeURIComponent(sessionId)}`;
      try {
        const opened = window.open(browserUrl, '_system');
        if (!opened) {
          const anchor = document.createElement('a');
          anchor.href = browserUrl;
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
        }
      } catch {
        window.location.href = browserUrl;
      }
      return sessionId;
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      provider.setCustomParameters({ prompt: 'select_account' });

      try {
        const result = await signInWithPopup(auth, provider);
        await initializeUserRecord(result.user);
        setUser(result.user);
      } catch (popupErr: unknown) {
        const code = (popupErr as { code?: string })?.code;
        if (
          code === 'auth/popup-blocked' ||
          code === 'auth/operation-not-supported-in-this-environment'
        ) {
          await signInWithRedirect(auth, provider);
          return null;
        }
        throw popupErr;
      }
    } catch (err: unknown) {
      console.error("Error en login con Google (web):", err);
      const errObj = err as { code?: string; message?: string };
      const code = String(errObj?.code || "");
      const msg = String(errObj?.message || "");
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request" || msg.includes("closed")) {
        setError("Ventana cerrada. Intenta de nuevo.");
      } else if (code === "auth/unauthorized-domain") {
        setError("Dominio no autorizado. Contacta al administrador.");
      } else if (code === "auth/network-request-failed") {
        setError("Error de red al conectar con Google.");
      } else {
        setError(msg || "Error al iniciar sesión con Google.");
      }
    }
    return null;
  };

  /**
   * En Android intenta primero el selector nativo de Google y si falla técnicamente (p.ej. SHA-1 / Play Services)
   * abre automáticamente el flujo por navegador con las cuentas ya iniciadas en el teléfono.
   */
  const loginWithGoogle = async (): Promise<string | null> => {
    setError(null);
    if (!Capacitor.isNativePlatform()) {
      return await loginWithGoogleBrowser();
    }

    try {
      const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
      const webClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_WEB_CLIENT_ID;

      await GoogleAuth.initialize({
        clientId: webClientId,
        scopes: ['profile', 'email'],
        grantOfflineAccess: false,
      });

      const googleUser = await GoogleAuth.signIn();
      const idToken = googleUser.authentication?.idToken;

      if (!idToken) {
        throw new Error("No se recibió ID Token del inicio de sesión de Google.");
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      await initializeUserRecord(result.user);
      setUser(result.user);
      return null;
    } catch (err: unknown) {
      console.warn("GoogleAuth nativo falló, verificando cancelación o usando navegador:", err);
      const errObj = err as { code?: string; message?: string };
      const code = String(errObj?.code || "");
      const msg = String(errObj?.message || "");

      if (code === "12501" || msg.includes("12501") || msg.toLowerCase().includes("cancel")) {
        setError("Inicio de sesión cancelado.");
        return null;
      }

      // Fallback transparente al navegador donde ya están abiertas las cuentas Google
      return await loginWithGoogleBrowser();
    }
  };

  const loginWithCustomToken = async (customToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithCustomToken(auth, customToken);
      await initializeUserRecord(result.user);
      setUser(result.user);
      return result.user;
    } catch (err: unknown) {
      console.error("Error en login con custom token:", err);
      const code = (err as { code?: string })?.code;
      let errMsg = "Código de acceso incorrecto o expirado.";
      if (code === "auth/invalid-custom-token") {
        errMsg = "El código de acceso no es válido.";
      }
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      await initializeUserRecord(result.user);
      setUser(result.user);
      return result.user;
    } catch (err: unknown) {
      console.error("Error en login con correo:", err);
      const code = (err as { code?: string })?.code;
      let errMsg = "Error al iniciar sesión.";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        errMsg = "Correo o contraseña incorrectos.";
      } else if (code === "auth/invalid-email") {
        errMsg = "El correo electrónico no es válido.";
      }
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(result.user, { displayName: name });
      
      const updatedUser = auth.currentUser || result.user;
      await initializeUserRecord(updatedUser);
      setUser(updatedUser);
      return updatedUser;
    } catch (err: unknown) {
      console.error("Error en registro con correo:", err);
      const code = (err as { code?: string })?.code;
      let errMsg = "Error al crear la cuenta.";
      if (code === "auth/email-already-in-use") {
        errMsg = "Este correo electrónico ya está registrado.";
      } else if (code === "auth/weak-password") {
        errMsg = "La contraseña debe tener al menos 6 caracteres.";
      } else if (code === "auth/invalid-email") {
        errMsg = "El correo electrónico no es válido.";
      }
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOutAll();
  };

  return { 
    user, 
    loading, 
    loginWithGoogle,
    loginWithGoogleBrowser,
    loginWithCustomToken, 
    loginWithEmail, 
    signUpWithEmail, 
    logout, 
    error,
    clearError: () => setError(null),
  };
}
