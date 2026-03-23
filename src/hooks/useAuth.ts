'use client';

import { auth, db } from "@/lib/firebase";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc, serverTimestamp, getDoc, writeBatch, collection, addDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { DEFAULT_CATEGORIES, DEFAULT_ACCOUNTS } from "@/lib/defaults";

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

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      // Crear/actualizar documento de usuario en Firestore si no existe
      const userRef = doc(db, "users", firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // Primera vez: crear el documento con campos básicos
        await setDoc(userRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
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
        // Ya existe: solo actualizar timestamp
        await setDoc(userRef, {
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      
      // Forzar actualización del estado user
      // El onAuthStateChanged debería actualizarlo, pero aseguramos redirección
      setUser(firebaseUser);
    } catch (error: unknown) {
      console.error("Error en login con Google:", error);
      const err = error as { code?: string; message?: string };
      let errorMessage = "Error al iniciar sesión";
      
      if (err.code === "auth/popup-closed-by-user") {
        errorMessage = "Ventana cerrada. Intenta de nuevo.";
      } else if (err.code === "auth/unauthorized-domain") {
        errorMessage = "Dominio no autorizado. Contacta al administrador.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return { user, loading, loginWithGoogle, logout, error };
}
