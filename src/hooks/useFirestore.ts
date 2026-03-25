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
  createdAt?: { toDate: () => Date } | Date;
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

  const getTimestampValue = (ts: unknown): number => {
    if (!ts) return 0;
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === 'object' && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
      return (ts as { toDate: () => Date }).toDate().getTime();
    }
    if (typeof ts === 'object' && ts !== null) {
      const tsObj = ts as { seconds?: number; nanoseconds?: number };
      if (tsObj.seconds) {
        return tsObj.seconds * 1000 + (tsObj.nanoseconds || 0) / 1000000;
      }
    }
    return 0;
  };

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
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );
      unsubscribeFirestore = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => {
          const tx = doc.data() as Transaction;
          tx.id = doc.id;
          return tx;
        });
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
