import { db } from "@/lib/firebase";
import { Transaction } from "@/hooks/useFirestore";
import { doc, increment, writeBatch } from "firebase/firestore";

/**
 * Atomically deletes a transaction and reverts its balance impact on the affected account(s).
 */
export async function deleteTransactionAtomic(tx: Transaction): Promise<void> {
  const batch = writeBatch(db);

  if (tx.tipo === "transferencia") {
    if (tx.fromId) {
      batch.update(doc(db, "accounts", tx.fromId), { saldo: increment(tx.monto) });
    }
    if (tx.toId) {
      batch.update(doc(db, "accounts", tx.toId), { saldo: increment(-tx.monto) });
    }
  } else if (tx.accountId) {
    const mult = tx.tipo === "ingreso" ? -1 : 1;
    batch.update(doc(db, "accounts", tx.accountId), { saldo: increment(mult * tx.monto) });
  }

  batch.delete(doc(db, "transactions", tx.id));
  await batch.commit();
}
