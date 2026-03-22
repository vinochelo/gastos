import { collection, query, where, onSnapshot, orderBy, limit, doc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";


export interface Account {
  id: string;
  userId: string;
  nombre: string;
  saldo: number;
  tipo: string;
}

export interface Transaction {
  id: string;
  userId: string;
  monto: number;
  tipo: "gasto" | "ingreso" | "transferencia";
  categoria: string;
  descripcion?: string;
  accountId?: string;
  fromId?: string;
  toId?: string;
  timestamp: { toDate: () => Date } | Date;
  fuente: string;
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }
      if (!user) {
        setAccounts([]);
        setLoading(false);
        return;
      }
      const q = query(
        collection(db, "accounts"),
        where("userId", "==", user.uid)
      );
      unsubscribeFirestore = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
        setAccounts(data);
        setLoading(false);
      });
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);
  return { accounts, loading };
}

export function useRecentTransactions(limitCount = 10) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }
      if (!user) {
        setTransactions([]);
        setLoading(false);
        return;
      }
      const q = query(
        collection(db, "transactions"),
        where("userId", "==", user.uid),
        orderBy("timestamp", "desc"),
        limit(limitCount)
      );
      unsubscribeFirestore = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        setTransactions(data);
        setLoading(false);
      });
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [limitCount]);
  return { transactions, loading };
}

export interface UserConfig {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  telegramId: string;
  expenseCategories?: string[];
  incomeCategories?: string[];
  categories?: string[];
}

export function useUserConfig() {
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }
      if (!user) {
        setConfig(null);
        setLoading(false);
        return;
      }
      const userRef = doc(db, "users", user.uid);
      unsubscribeFirestore = onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
          setConfig(snapshot.data() as UserConfig);
        }
        setLoading(false);
      });
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  return { config, loading };
}
