import { collection, query, where, onSnapshot, orderBy, limit, doc, Timestamp, Query, QueryConstraint } from "firebase/firestore";
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
  subcategoria?: string;
  descripcion?: string;
  accountId?: string;
  fromId?: string;
  toId?: string;
  timestamp: { toDate: () => Date } | Date;
  createdAt?: { toDate: () => Date } | Date;
  fuente: string;
}

export interface BudgetSummary {
  id: string;
  categoria: string;
  monto: number;
}

export interface DebtSummary {
  id: string;
  monto: number;
  tipo: "debo" | "me_deben";
  pagado: boolean;
}

export interface GoalSummary {
  id: string;
  nombre: string;
  montoObjetivo: number;
  montoActual: number;
}

function useUserCollection<T>(
  collectionName: string,
  buildConstraints: (uid: string) => QueryConstraint[],
  deps: unknown[],
  transform?: (items: T[]) => T[]
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }
      if (!user) {
        setItems([]);
        setLoading(false);
        return;
      }

      const q: Query = query(collection(db, collectionName), ...buildConstraints(user.uid));
      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          const mapped = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as T));
          setItems(transform ? transform(mapped) : mapped);
          setLoading(false);
        },
        (error) => {
          console.error(`Error listening to ${collectionName}:`, error);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { items, loading };
}

export function useAccounts() {
  const { items: accounts, loading } = useUserCollection<Account>(
    "accounts",
    (uid) => [where("userId", "==", uid)],
    [],
    (data) =>
      [...data].sort((a, b) => {
        const orderA = (a as any).orden ?? 0;
        const orderB = (b as any).orden ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.nombre.localeCompare(b.nombre, "es");
      })
  );
  return { accounts, loading };
}

export function useRecentTransactions(limitCount = 10) {
  const { items: transactions, loading } = useUserCollection<Transaction>(
    "transactions",
    (uid) => [
      where("userId", "==", uid),
      orderBy("timestamp", "desc"),
      limit(limitCount),
    ],
    [limitCount]
  );
  return { transactions, loading };
}

export function useMonthTransactions(month: number, year: number) {
  const { items: transactions, loading } = useUserCollection<Transaction>(
    "transactions",
    (uid) => {
      const start = new Date(year, month, 1, 0, 0, 0, 0);
      const end = new Date(year, month + 1, 1, 0, 0, 0, 0);
      return [
        where("userId", "==", uid),
        where("timestamp", ">=", Timestamp.fromDate(start)),
        where("timestamp", "<", Timestamp.fromDate(end)),
        orderBy("timestamp", "desc"),
      ];
    },
    [month, year]
  );
  return { transactions, loading };
}

export function useTransactionsPeriod(
  period: "mes" | "30dias" | "todo",
  month: number,
  year: number
) {
  const { items: transactions, loading } = useUserCollection<Transaction>(
    "transactions",
    (uid) => {
      if (period === "mes") {
        const start = new Date(year, month, 1, 0, 0, 0, 0);
        const end = new Date(year, month + 1, 1, 0, 0, 0, 0);
        return [
          where("userId", "==", uid),
          where("timestamp", ">=", Timestamp.fromDate(start)),
          where("timestamp", "<", Timestamp.fromDate(end)),
          orderBy("timestamp", "desc"),
        ];
      }
      if (period === "30dias") {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        return [
          where("userId", "==", uid),
          where("timestamp", ">=", Timestamp.fromDate(thirtyDaysAgo)),
          orderBy("timestamp", "desc"),
        ];
      }
      return [
        where("userId", "==", uid),
        orderBy("timestamp", "desc"),
        limit(500),
      ];
    },
    [period, month, year]
  );
  return { transactions, loading };
}

export function useBudgets() {
  const { items: budgets, loading } = useUserCollection<BudgetSummary>(
    "budgets",
    (uid) => [where("userId", "==", uid)],
    []
  );
  return { budgets, loading };
}

export function useDebts() {
  const { items: debts, loading } = useUserCollection<DebtSummary>(
    "debts",
    (uid) => [where("userId", "==", uid)],
    []
  );
  return { debts, loading };
}

export function useGoals() {
  const { items: goals, loading } = useUserCollection<GoalSummary>(
    "goals",
    (uid) => [where("userId", "==", uid)],
    []
  );
  return { goals, loading };
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
  categoryIcons?: Record<string, string>;
  subcategories?: Record<string, string[]>;
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
