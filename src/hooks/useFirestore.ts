import { collection, query, where, onSnapshot, orderBy, limit, doc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export function useAccounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
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
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
  const [transactions, setTransactions] = useState<any[]>([]);
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
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

export function useUserConfig() {
  const [config, setConfig] = useState<any>(null);
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
          setConfig(snapshot.data());
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
