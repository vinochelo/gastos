'use client';

import { auth, db } from "@/lib/firebase";
import { 
  signInWithPopup, 
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

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Inicializar o sincronizar el registro del usuario en Firestore
  const initializeUserRecord = async (firebaseUser: User) => {
    const userRef = doc(db, "users", firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Primera vez: crear el documento con campos básicos
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

      // Crear cuentas por defecto
      for (const acc of DEFAULT_ACCOUNTS) {
        await addDoc(collection(db, "accounts"), {
          userId: firebaseUser.uid,
          nombre: acc.nombre,
          saldo: acc.saldo,
          tipo: "bancaria"
        });
      }
    } else {
      // Ya existe: solo asegurar que tiene los campos esenciales
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

  const loginWithGoogle = async () => {
    setError(null);
    try {
      const isNative = Capacitor.isNativePlatform();
      
      if (isNative) {
        // En dispositivo móvil nativo, usamos el SDK nativo de Google Auth
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        
        // Obtener el Web Client ID de la configuración del entorno
        const webClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        
        if (!webClientId) {
          throw new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID no está configurado en .env.local. Por favor configura tu Web Client ID.");
        }

        try {
          GoogleAuth.initialize({
            clientId: webClientId,
            scopes: ['profile', 'email'],
            grantOfflineAccess: true,
          });
        } catch (e) {
          // Si ya está inicializado, ignorar
        }

        const googleUser = await GoogleAuth.signIn();
        const idToken = googleUser.authentication.idToken;
        
        if (!idToken) {
          throw new Error("No se recibió ID Token del inicio de sesión de Google.");
        }

        const credential = GoogleAuthProvider.credential(idToken);
        const result = await signInWithCredential(auth, credential);
        await initializeUserRecord(result.user);
        setUser(result.user);
      } else {
        // En la web, usamos el flujo normal de popup de Firebase Auth
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        await initializeUserRecord(result.user);
        setUser(result.user);
      }
    } catch (error: any) {
      console.error("Error en login con Google:", error);
      let errorMessage = "Error al iniciar sesión con Google";
      
      if (error.code === "auth/popup-closed-by-user" || error.message?.includes("closed")) {
        errorMessage = "Ventana cerrada. Intenta de nuevo.";
      } else if (error.code === "auth/unauthorized-domain") {
        errorMessage = "Dominio no autorizado. Contacta al administrador.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
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
    } catch (err: any) {
      console.error("Error en login con custom token:", err);
      let errMsg = "Código de acceso incorrecto o expirado.";
      if (err.code === "auth/invalid-custom-token") {
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
    } catch (err: any) {
      console.error("Error en login con correo:", err);
      let errMsg = "Error al iniciar sesión.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        errMsg = "Correo o contraseña incorrectos.";
      } else if (err.code === "auth/invalid-email") {
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
    } catch (err: any) {
      console.error("Error en registro con correo:", err);
      let errMsg = "Error al crear la cuenta.";
      if (err.code === "auth/email-already-in-use") {
        errMsg = "Este correo electrónico ya está registrado.";
      } else if (err.code === "auth/weak-password") {
        errMsg = "La contraseña debe tener al menos 6 caracteres.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "El correo electrónico no es válido.";
      }
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return { 
    user, 
    loading, 
    loginWithGoogle, 
    loginWithCustomToken, 
    loginWithEmail, 
    signUpWithEmail, 
    logout, 
    error 
  };
}
