'use client';

import { Account, Transaction } from "@/hooks/useFirestore";
import CategoryIcon from "@/components/CategoryIcon";
import { ArrowRightLeft, Pencil, Trash2 } from "lucide-react";

interface TransactionItemProps {
  tx: Transaction;
  accounts: Account[];
  categoryIcons?: Record<string, string>;
  formatAmount: (amount: number) => string;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  showDate?: boolean;
}

export default function TransactionItem({
  tx,
  accounts,
  categoryIcons,
  formatAmount,
  onEdit,
  onDelete,
  showDate = false,
}: TransactionItemProps) {
  const ts = tx.timestamp;
  const dateObj = ts
    ? "toDate" in ts
      ? ts.toDate()
      : ts instanceof Date
      ? ts
      : new Date(ts as string | number)
    : null;

  const accountLabel =
    tx.tipo === "transferencia"
      ? `${accounts.find((a) => a.id === tx.fromId)?.nombre || "Origen"} ➔ ${accounts.find((a) => a.id === tx.toId)?.nombre || "Destino"}`
      : tx.accountId
      ? accounts.find((a) => a.id === tx.accountId)?.nombre || "Cuenta"
      : "";

  return (
    <div className="glass rounded-2xl p-3.5 flex items-center justify-between gap-2 border border-border shadow-sm hover:bg-white dark:hover:bg-gray-800/80 transition-all duration-300 group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            tx.tipo === "ingreso"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : tx.tipo === "transferencia"
              ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
          }`}
        >
          {tx.tipo === "transferencia" ? (
            <ArrowRightLeft size={16} />
          ) : (
            <CategoryIcon
              categoryName={tx.categoria}
              userIconsMap={categoryIcons}
              className="w-6 h-6"
              size={16}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate text-foreground">
            {tx.descripcion || tx.categoria}
          </p>
          <p className="text-[10px] font-semibold text-foreground/45 uppercase tracking-wider mt-0.5 truncate">
            {tx.categoria}
            {tx.subcategoria ? ` ➔ ${tx.subcategoria}` : ""}
            {accountLabel ? ` • ${accountLabel}` : ""}
            {showDate && dateObj
              ? ` • ${dateObj.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`
              : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <p
          className={`text-sm font-black ${
            tx.tipo === "ingreso"
              ? "text-emerald-500"
              : tx.tipo === "transferencia"
              ? "text-indigo-500 dark:text-indigo-400"
              : "text-foreground"
          }`}
        >
          {tx.tipo === "ingreso" ? "+" : "-"}
          {formatAmount(tx.monto)}
        </p>

        {/* Visible cleanly on mobile touch devices, subtle fade on desktop hover */}
        <div className="flex items-center gap-1 opacity-85 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
          <button
            type="button"
            onClick={() => onEdit(tx)}
            title="Editar"
            className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg text-indigo-500 transition-colors cursor-pointer"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(tx)}
            title="Eliminar"
            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-rose-500 transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
