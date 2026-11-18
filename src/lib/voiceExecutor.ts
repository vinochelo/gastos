import { db } from "@/lib/firebase";
import { Account, BudgetSummary, Transaction } from "@/hooks/useFirestore";
import { evaluateBudgets, getBudgetStatusLabel, normalizeCategoryKey } from "@/lib/budgets";
import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";

export interface ParsedVoiceItem {
  tipo: string;
  monto?: number;
  montoAnterior?: number;
  categoria?: string;
  subcategoria?: string;
  categoriaAnterior?: string;
  cuenta?: string;
  cuentaAnterior?: string;
  fromCuenta?: string;
  toCuenta?: string;
  descripcion?: string;
  fecha?: string;
  nuevoTipo?: "gasto" | "ingreso";
  periodo?: "hoy" | "ayer" | "semana" | "mes" | "ultimos";
  persona?: string;
  deudaTipo?: "debo" | "me_deben";
  metaNombre?: string;
}

export interface ExecuteParsedItemsOptions {
  userId: string;
  items: ParsedVoiceItem[];
  sourceText: string;
  fuente?: string;
  accounts: Account[];
  expenseCategories: string[];
  incomeCategories: string[];
  budgets: BudgetSummary[];
  monthTransactions?: Transaction[];
}

export interface ExecuteParsedItemsResult {
  executed: boolean;
  summaryLines: string[];
  budgetNotes: string[];
  createdTransactions: Transaction[];
  needsModal: boolean;
  modalType?: "transaction" | "transfer";
  modalInitialData?: ParsedVoiceItem | null;
}

export function getSupportedAudioMimeType(): { mimeType: string; extension: string } {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return { mimeType: "", extension: "webm" };
  }

  const candidates: Array<{ mimeType: string; extension: string }> = [
    { mimeType: "audio/webm;codecs=opus", extension: "webm" },
    { mimeType: "audio/webm", extension: "webm" },
    { mimeType: "audio/mp4", extension: "mp4" },
    { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
  ];

  if (typeof MediaRecorder.isTypeSupported !== "function") {
    return { mimeType: "", extension: "webm" };
  }

  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
        return candidate;
      }
    } catch {
      // Ignore browser quirks on isTypeSupported
    }
  }

  return { mimeType: "", extension: "webm" };
}

function cleanTextForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix = Array.from({ length: len1 + 1 }, () => new Array<number>(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

export function findAccountClient(
  accountQuery: string | undefined,
  accounts: Account[]
): Account | null {
  if (!accountQuery || accounts.length === 0) return null;
  const cleanQuery = cleanTextForMatch(accountQuery);
  if (!cleanQuery) return null;

  const exact = accounts.find((a) => cleanTextForMatch(a.nombre) === cleanQuery);
  if (exact) return exact;

  const partial = accounts.find((a) => {
    const cleanName = cleanTextForMatch(a.nombre);
    return cleanName.includes(cleanQuery) || cleanQuery.includes(cleanName);
  });
  if (partial) return partial;

  let minDist = Infinity;
  let candidate: Account | null = null;
  for (const acc of accounts) {
    const cleanName = cleanTextForMatch(acc.nombre);
    if (Math.abs(cleanName.length - cleanQuery.length) <= 3) {
      const dist = levenshteinDistance(cleanName, cleanQuery);
      if (dist < minDist) {
        minDist = dist;
        candidate = acc;
      }
    }
  }

  if (candidate) {
    const cleanName = cleanTextForMatch(candidate.nombre);
    const maxAllowed = Math.max(1, Math.floor(cleanName.length * 0.3));
    if (minDist <= maxAllowed) return candidate;
  }

  return null;
}

export function findCategoryClient(
  categoryQuery: string | undefined,
  categories: string[]
): string | null {
  if (!categoryQuery || categories.length === 0) return null;
  const cleanQuery = cleanTextForMatch(categoryQuery);
  if (!cleanQuery) return null;

  const exact = categories.find((c) => cleanTextForMatch(c) === cleanQuery);
  if (exact) return exact;

  const partial = categories.find((c) => {
    const cleanCat = cleanTextForMatch(c);
    return cleanCat.includes(cleanQuery) || cleanQuery.includes(cleanCat);
  });
  if (partial) return partial;

  let minDist = Infinity;
  let candidate: string | null = null;
  for (const cat of categories) {
    const cleanCat = cleanTextForMatch(cat);
    if (Math.abs(cleanCat.length - cleanQuery.length) <= 3) {
      const dist = levenshteinDistance(cleanCat, cleanQuery);
      if (dist < minDist) {
        minDist = dist;
        candidate = cat;
      }
    }
  }

  if (candidate) {
    const cleanCat = cleanTextForMatch(candidate);
    const maxAllowed = Math.max(1, Math.floor(cleanCat.length * 0.3));
    if (minDist <= maxAllowed) return candidate;
  }

  return null;
}

function parseItemDate(fecha?: string): Date {
  if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())) {
    const parsed = new Date(`${fecha.trim()}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

function getLocalTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function executeParsedItems(
  options: ExecuteParsedItemsOptions
): Promise<ExecuteParsedItemsResult> {
  const {
    userId,
    items,
    sourceText,
    fuente = "web_voice",
    accounts,
    expenseCategories,
    incomeCategories,
    budgets,
    monthTransactions,
  } = options;

  if (!items || items.length === 0) {
    return {
      executed: false,
      summaryLines: [],
      budgetNotes: [],
      createdTransactions: [],
      needsModal: false,
    };
  }

  // Single incomplete transaction or transfer opens the modal pre-filled
  if (items.length === 1) {
    const single = items[0];
    if ((single.tipo === "gasto" || single.tipo === "ingreso") && (!single.monto || single.monto <= 0)) {
      return {
        executed: false,
        summaryLines: [],
        budgetNotes: [],
        createdTransactions: [],
        needsModal: true,
        modalType: "transaction",
        modalInitialData: single,
      };
    }
    if (single.tipo === "transferencia") {
      const fromAcc = findAccountClient(single.fromCuenta || single.cuentaAnterior, accounts);
      const toAcc = findAccountClient(single.toCuenta || single.cuenta, accounts);
      if (!single.monto || single.monto <= 0 || !fromAcc || !toAcc || fromAcc.id === toAcc.id) {
        return {
          executed: false,
          summaryLines: [],
          budgetNotes: [],
          createdTransactions: [],
          needsModal: true,
          modalType: "transfer",
          modalInitialData: single,
        };
      }
    }
  }

  const batch = writeBatch(db);
  const summaryLines: string[] = [];
  const createdTransactions: Transaction[] = [];
  const addedExpensesByCat: Record<string, number> = {};
  let hasBatchWrites = false;

  // Lazy-loaded recent transactions for reverso / reclasificar / editar
  let recentDocsCache: Awaited<ReturnType<typeof getDocs>>["docs"] | null = null;
  const getRecentTransactionDocs = async () => {
    if (recentDocsCache) return recentDocsCache;
    const recentSnap = await getDocs(
      query(
        collection(db, "transactions"),
        where("userId", "==", userId),
        orderBy("timestamp", "desc"),
        limit(30)
      )
    );
    recentDocsCache = recentSnap.docs;
    return recentDocsCache;
  };

  for (const item of items) {
    const tipo = (item.tipo || "").toLowerCase();
    const monto = item.monto ? Math.abs(Number(item.monto)) : 0;

    if (tipo === "gasto" || tipo === "ingreso") {
      if (!monto || Number.isNaN(monto) || monto <= 0) {
        return {
          executed: false,
          summaryLines: [],
          budgetNotes: [],
          createdTransactions: [],
          needsModal: true,
          modalType: "transaction",
          modalInitialData: item,
        };
      }

      let account = findAccountClient(item.cuenta, accounts);
      if (!account) {
        account = accounts.find((a) => a.nombre.toLowerCase().includes("efectivo")) || accounts[0] || null;
      }

      if (!account) {
        summaryLines.push("No tienes cuentas registradas. Crea una cuenta primero.");
        continue;
      }

      const targetCategories = tipo === "ingreso" ? incomeCategories : expenseCategories;
      const resolvedCategory =
        findCategoryClient(item.categoria, targetCategories) ||
        item.categoria ||
        targetCategories[0] ||
        "Varios";

      const descripcion = item.descripcion?.trim() || resolvedCategory || sourceText;
      const txDate = parseItemDate(item.fecha);
      const txRef = doc(collection(db, "transactions"));
      const mult = tipo === "ingreso" ? 1 : -1;

      batch.set(txRef, {
        userId,
        monto,
        tipo,
        accountId: account.id,
        categoria: resolvedCategory,
        subcategoria: item.subcategoria || "",
        descripcion,
        timestamp: Timestamp.fromDate(txDate),
        createdAt: serverTimestamp(),
        fuente,
      });

      batch.update(doc(db, "accounts", account.id), {
        saldo: increment(mult * monto),
      });

      hasBatchWrites = true;

      createdTransactions.push({
        id: txRef.id,
        userId,
        monto,
        tipo,
        accountId: account.id,
        categoria: resolvedCategory,
        subcategoria: item.subcategoria || "",
        descripcion,
        timestamp: txDate,
        fuente,
      });

      if (tipo === "gasto") {
        const catKey = normalizeCategoryKey(resolvedCategory);
        addedExpensesByCat[catKey] = (addedExpensesByCat[catKey] || 0) + monto;
      }

      const dateTag = item.fecha ? ` [${item.fecha}]` : "";
      const descTag = descripcion && descripcion.toLowerCase() !== resolvedCategory.toLowerCase() ? ` · ${descripcion}` : "";
      summaryLines.push(
        `${tipo === "ingreso" ? "Ingreso" : "Gasto"}${dateTag}: $${monto.toFixed(2)} en ${resolvedCategory}${descTag} (${account.nombre})`
      );
    } else if (tipo === "transferencia") {
      const fromAcc = findAccountClient(item.fromCuenta || item.cuentaAnterior, accounts);
      const toAcc = findAccountClient(item.toCuenta || item.cuenta, accounts);

      if (!monto || !fromAcc || !toAcc || fromAcc.id === toAcc.id) {
        if (items.length === 1) {
          return {
            executed: false,
            summaryLines: [],
            budgetNotes: [],
            createdTransactions: [],
            needsModal: true,
            modalType: "transfer",
            modalInitialData: item,
          };
        }
        summaryLines.push("No se pudieron identificar cuentas válidas de origen y destino para una transferencia.");
        continue;
      }

      const txDate = parseItemDate(item.fecha);
      const txRef = doc(collection(db, "transactions"));
      const descripcion = item.descripcion?.trim() || `Transferencia: ${fromAcc.nombre} → ${toAcc.nombre}`;

      batch.set(txRef, {
        userId,
        monto,
        tipo: "transferencia",
        fromId: fromAcc.id,
        toId: toAcc.id,
        fromNombre: fromAcc.nombre,
        toNombre: toAcc.nombre,
        categoria: "Transferencia",
        descripcion,
        timestamp: Timestamp.fromDate(txDate),
        createdAt: serverTimestamp(),
        fuente,
      });

      batch.update(doc(db, "accounts", fromAcc.id), { saldo: increment(-monto) });
      batch.update(doc(db, "accounts", toAcc.id), { saldo: increment(monto) });
      hasBatchWrites = true;

      createdTransactions.push({
        id: txRef.id,
        userId,
        monto,
        tipo: "transferencia",
        fromId: fromAcc.id,
        toId: toAcc.id,
        categoria: "Transferencia",
        descripcion,
        timestamp: txDate,
        fuente,
      });

      summaryLines.push(`Transferencia: $${monto.toFixed(2)} de ${fromAcc.nombre} a ${toAcc.nombre}`);
    } else if (tipo === "reverso") {
      const docs = await getRecentTransactionDocs();
      const matchedAcc = item.cuenta ? findAccountClient(item.cuenta, accounts) : null;
      const targetDoc = docs.find((d) => {
        const data = d.data() as Record<string, unknown>;
        const txMonto = Math.abs(Number(data.monto || 0));
        const matchMonto = !monto || Math.abs(txMonto - monto) < 0.01;
        const matchCuenta = !item.cuenta || (matchedAcc && data.accountId === matchedAcc.id);
        return matchMonto && Boolean(matchCuenta);
      });

      if (!targetDoc) {
        summaryLines.push(
          monto ? `No encontré transacción reciente de $${monto.toFixed(2)} para revertir.` : "No encontré una transacción reciente para revertir."
        );
        continue;
      }

      const data = targetDoc.data() as Record<string, unknown>;
      const txMonto = Math.abs(Number(data.monto || 0));

      if (data.tipo === "transferencia") {
        if (typeof data.fromId === "string" && data.fromId) {
          batch.update(doc(db, "accounts", data.fromId), { saldo: increment(txMonto) });
        }
        if (typeof data.toId === "string" && data.toId) {
          batch.update(doc(db, "accounts", data.toId), { saldo: increment(-txMonto) });
        }
      } else if (typeof data.accountId === "string" && data.accountId) {
        const multReverso = data.tipo === "ingreso" ? -1 : 1;
        batch.update(doc(db, "accounts", data.accountId), { saldo: increment(multReverso * txMonto) });
      }

      batch.delete(doc(db, "transactions", targetDoc.id));
      hasBatchWrites = true;
      summaryLines.push(`Revertido: $${txMonto.toFixed(2)} (${String(data.descripcion || data.categoria || "movimiento")})`);
    } else if (tipo === "reclasificar") {
      const docs = await getRecentTransactionDocs();
      const catPrevLower = item.categoriaAnterior?.toLowerCase();

      let matchDoc = docs.find((d) => {
        const data = d.data() as Record<string, unknown>;
        const matchMonto = !monto || Math.abs(Number(data.monto || 0) - monto) < 0.01;
        const matchCat = catPrevLower ? String(data.categoria || "").toLowerCase() === catPrevLower : false;
        return matchMonto && matchCat;
      });

      if (!matchDoc && catPrevLower) {
        matchDoc = docs.find((d) => String((d.data() as Record<string, unknown>).categoria || "").toLowerCase() === catPrevLower);
      }
      if (!matchDoc && monto > 0) {
        matchDoc = docs.find((d) => Math.abs(Number((d.data() as Record<string, unknown>).monto || 0) - monto) < 0.01);
      }
      if (!matchDoc && docs.length > 0) {
        matchDoc = docs[0];
      }

      if (!matchDoc) {
        summaryLines.push("No encontré ninguna transacción reciente para reclasificar.");
        continue;
      }

      const oldData = matchDoc.data() as Record<string, unknown>;
      const allCats = oldData.tipo === "ingreso" ? incomeCategories : expenseCategories;
      const newCategory = findCategoryClient(item.categoria, allCats) || item.categoria || String(oldData.categoria || "Otros");

      batch.update(matchDoc.ref, { categoria: newCategory });
      hasBatchWrites = true;
      summaryLines.push(
        `Reclasificado: $${Math.abs(Number(oldData.monto || 0)).toFixed(2)} de "${String(oldData.categoria || "Otros")}" a "${newCategory}"`
      );
    } else if (tipo === "editar") {
      const docs = await getRecentTransactionDocs();
      const buscarMonto = item.montoAnterior ? Math.abs(Number(item.montoAnterior)) : monto || null;
      const buscarCuenta = item.cuentaAnterior?.toLowerCase();
      const buscarCat = item.categoriaAnterior?.toLowerCase();

      let matchDoc = docs.find((d) => {
        const data = d.data() as Record<string, unknown>;
        const matchM = buscarMonto ? Math.abs(Math.abs(Number(data.monto || 0)) - buscarMonto) < 0.01 : true;
        let matchAc = true;
        if (buscarCuenta && typeof data.accountId === "string") {
          const accMatch = findAccountClient(buscarCuenta, accounts);
          matchAc = accMatch ? accMatch.id === data.accountId : false;
        }
        const matchC = buscarCat ? String(data.categoria || "").toLowerCase() === buscarCat : true;
        return matchM && matchAc && matchC;
      });

      if (!matchDoc && monto > 0) {
        matchDoc = docs.find((d) => Math.abs(Math.abs(Number((d.data() as Record<string, unknown>).monto || 0)) - monto) < 0.01);
      }
      if (!matchDoc && docs.length > 0) {
        matchDoc = docs[0];
      }

      if (!matchDoc) {
        summaryLines.push("No encontré ninguna transacción reciente para editar.");
        continue;
      }

      const data = matchDoc.data() as Record<string, unknown>;
      const oldTipo = String(data.tipo || "gasto");
      const oldMonto = Math.abs(Number(data.monto || 0));
      const oldAccountId = typeof data.accountId === "string" ? data.accountId : "";
      const isTransfer = oldTipo === "transferencia";

      const finalMonto = monto > 0 ? monto : oldMonto;
      const finalTipo = item.nuevoTipo || (oldTipo as "gasto" | "ingreso" | "transferencia");
      const targetCats = finalTipo === "ingreso" ? incomeCategories : expenseCategories;
      const finalCategoria = item.categoria
        ? findCategoryClient(item.categoria, targetCats) || item.categoria
        : String(data.categoria || "Varios");

      let newAccountId = oldAccountId;
      if (item.cuenta) {
        const newAcc = findAccountClient(item.cuenta, accounts);
        if (newAcc) newAccountId = newAcc.id;
      }

      if (isTransfer) {
        if (typeof data.fromId === "string" && data.fromId) {
          batch.update(doc(db, "accounts", data.fromId), { saldo: increment(oldMonto) });
        }
        if (typeof data.toId === "string" && data.toId) {
          batch.update(doc(db, "accounts", data.toId), { saldo: increment(-oldMonto) });
        }
      } else if (oldAccountId) {
        const multReverso = oldTipo === "gasto" ? 1 : -1;
        batch.update(doc(db, "accounts", oldAccountId), { saldo: increment(multReverso * oldMonto) });
      }

      if (finalTipo === "transferencia") {
        if (typeof data.fromId === "string" && data.fromId) {
          batch.update(doc(db, "accounts", data.fromId), { saldo: increment(-finalMonto) });
        }
        if (typeof data.toId === "string" && data.toId) {
          batch.update(doc(db, "accounts", data.toId), { saldo: increment(finalMonto) });
        }
      } else if (newAccountId) {
        const multNuevo = finalTipo === "ingreso" ? 1 : -1;
        batch.update(doc(db, "accounts", newAccountId), { saldo: increment(multNuevo * finalMonto) });
      }

      const updates: Record<string, unknown> = {
        monto: finalMonto,
        tipo: finalTipo,
        categoria: finalCategoria,
        fuente: `${fuente}_edit`,
      };
      if (newAccountId) updates.accountId = newAccountId;
      if (item.descripcion) updates.descripcion = item.descripcion;

      batch.update(matchDoc.ref, updates);
      hasBatchWrites = true;
      summaryLines.push(
        `Editado: $${oldMonto.toFixed(2)} (${oldTipo}) → $${finalMonto.toFixed(2)} (${finalTipo}) en ${finalCategoria}`
      );
    } else if (tipo === "nueva_deuda") {
      if (!monto || !item.persona) {
        summaryLines.push("Indica el monto y el nombre de la persona para registrar la deuda.");
        continue;
      }
      const deudaTipo = item.deudaTipo === "me_deben" ? "me_deben" : "debo";
      const debtRef = doc(collection(db, "debts"));
      batch.set(debtRef, {
        userId,
        nombre: item.persona.trim(),
        monto,
        tipo: deudaTipo,
        descripcion: item.descripcion || "",
        fecha: getLocalTodayIso(),
        pagado: false,
      });
      hasBatchWrites = true;
      summaryLines.push(
        deudaTipo === "me_deben"
          ? `Deuda registrada: ${item.persona.trim()} te debe $${monto.toFixed(2)}`
          : `Deuda registrada: le debes $${monto.toFixed(2)} a ${item.persona.trim()}`
      );
    } else if (tipo === "pagar_deuda") {
      const targetPersona = normalizeCategoryKey(item.persona);
      const debtsSnap = await getDocs(query(collection(db, "debts"), where("userId", "==", userId)));
      const matchDebt = debtsSnap.docs.find((d) => {
        const data = d.data() as Record<string, unknown>;
        if (data.pagado) return false;
        const nameNorm = normalizeCategoryKey(String(data.nombre || ""));
        const nameOk = targetPersona
          ? nameNorm.includes(targetPersona) || targetPersona.includes(nameNorm)
          : true;
        const montoOk = !monto || Math.abs(Number(data.monto || 0) - monto) < 0.01;
        return nameOk && montoOk;
      });

      if (matchDebt) {
        const debtData = matchDebt.data() as Record<string, unknown>;
        batch.update(matchDebt.ref, { pagado: true });
        hasBatchWrites = true;
        summaryLines.push(
          `Deuda saldada: ${String(debtData.nombre || "")} ($${Number(debtData.monto || 0).toFixed(2)})`
        );
      } else {
        summaryLines.push(
          item.persona
            ? `No encontré ninguna deuda pendiente con "${item.persona}".`
            : "No encontré deudas pendientes que coincidan."
        );
      }
    } else if (tipo === "abonar_meta") {
      if (!monto) {
        summaryLines.push("Indica cuánto deseas abonar a tu meta.");
        continue;
      }
      const goalsSnap = await getDocs(query(collection(db, "goals"), where("userId", "==", userId)));
      const targetMeta = normalizeCategoryKey(item.metaNombre || item.descripcion || item.categoria);
      let matchGoal = goalsSnap.docs.find((d) => {
        const goalNorm = normalizeCategoryKey(String((d.data() as Record<string, unknown>).nombre || ""));
        return Boolean(targetMeta && (goalNorm.includes(targetMeta) || targetMeta.includes(goalNorm)));
      });
      if (!matchGoal && goalsSnap.docs.length === 1) {
        matchGoal = goalsSnap.docs[0];
      }

      if (matchGoal) {
        const g = matchGoal.data() as Record<string, unknown>;
        const nuevoActual = Number(g.montoActual || 0) + monto;
        const objetivo = Number(g.montoObjetivo || 0);
        const pct = objetivo > 0 ? Math.min(100, Math.round((nuevoActual / objetivo) * 100)) : 0;
        batch.update(matchGoal.ref, { montoActual: increment(monto) });
        hasBatchWrites = true;
        summaryLines.push(
          `Abono a "${String(g.nombre || "Meta")}": +$${monto.toFixed(2)} ($${nuevoActual.toFixed(2)}/$${objetivo.toFixed(2)} · ${pct}%)`
        );
      } else {
        summaryLines.push("No encontré esa meta de ahorro. Revisa el nombre en Metas.");
      }
    } else if (tipo === "consulta_saldo") {
      const totalAvail = accounts
        .filter((a) => !a.nombre.toLowerCase().includes("ahorro"))
        .reduce((sum, a) => sum + Number(a.saldo || 0), 0);
      if (item.cuenta && item.cuenta.toLowerCase() !== "todas") {
        const matched = findAccountClient(item.cuenta, accounts);
        summaryLines.push(
          matched
            ? `Saldo en ${matched.nombre}: $${Number(matched.saldo || 0).toFixed(2)}`
            : `No encontré la cuenta "${item.cuenta}".`
        );
      } else {
        summaryLines.push(`Saldo disponible total: $${totalAvail.toFixed(2)}`);
      }
    } else {
      summaryLines.push(`No pude ejecutar automáticamente "${sourceText}". Prueba dictando monto, detalle y cuenta.`);
    }
  }

  const budgetNotes: string[] = [];
  const expenseKeys = Object.keys(addedExpensesByCat);
  if (expenseKeys.length > 0 && budgets.length > 0) {
    const spentMap: Record<string, number> = { ...addedExpensesByCat };
    if (monthTransactions) {
      for (const tx of monthTransactions) {
        if (tx.tipo === "gasto") {
          const k = normalizeCategoryKey(tx.categoria);
          spentMap[k] = (spentMap[k] || 0) + Number(tx.monto || 0);
        }
      }
    } else {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
      try {
        const monthSnap = await getDocs(
          query(
            collection(db, "transactions"),
            where("userId", "==", userId),
            where("tipo", "==", "gasto"),
            where("timestamp", ">=", Timestamp.fromDate(startOfMonth)),
            where("timestamp", "<", Timestamp.fromDate(startOfNextMonth))
          )
        );
        for (const d of monthSnap.docs) {
          const txData = d.data() as Record<string, unknown>;
          const k = normalizeCategoryKey(String(txData.categoria || "Otros"));
          spentMap[k] = (spentMap[k] || 0) + Number(txData.monto || 0);
        }
      } catch {
        // Fallback silently if offline/index unavailable
      }
    }
    const evaluated = evaluateBudgets(budgets, spentMap);
    for (const b of evaluated.items) {
      if (expenseKeys.includes(normalizeCategoryKey(b.categoria))) {
        budgetNotes.push(
          `Presupuesto ${b.categoria}: $${b.spent.toFixed(2)}/$${b.limit.toFixed(2)} (${b.pctRaw}% · ${getBudgetStatusLabel(b.status)})`
        );
      }
    }
  }

  if (hasBatchWrites) {
    await batch.commit();
  }

  return {
    executed: hasBatchWrites || summaryLines.length > 0,
    summaryLines,
    budgetNotes,
    createdTransactions,
    needsModal: false,
  };
}
