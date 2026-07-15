// Component to render 3D claymorphic icons for accounts to maintain visual coherence.

import React from "react";
import { getAccountIconPath } from "@/lib/categoryIcons";

interface AccountIconProps {
  nombre: string;
  className?: string;
}

export default function AccountIcon({ nombre, className = "w-10 h-10" }: AccountIconProps) {
  const nameLower = nombre.toLowerCase();
  let iconPath = "/categories/cat_inversiones.png"; // Default fallback (3D bank chart)

  if (nameLower.includes("efectivo") || nameLower.includes("cash") || nameLower.includes("billetera")) {
    iconPath = "/categories/cat_salario.png"; // 3D cash stack icon
  } else if (nameLower.includes("american") || nameLower.includes("amex") || nameLower.includes("tarjeta") || nameLower.includes("credito")) {
    iconPath = "/categories/cat_compras.png"; // 3D shopping bag (represents credit spending)
  } else if (
    nameLower.includes("produbanco") ||
    nameLower.includes("guayaquil") ||
    nameLower.includes("peigo") ||
    nameLower.includes("deuna") ||
    nameLower.includes("de una") ||
    nameLower.includes("banco") ||
    nameLower.includes("pichincha")
  ) {
    iconPath = "/categories/cat_inversiones.png"; // 3D bank/investment chart
  } else {
    // Fallback to helper
    iconPath = getAccountIconPath(nombre);
  }

  return (
    <div className={`rounded-2xl bg-white dark:bg-gray-800 flex items-center justify-center border border-border/45 shadow-sm p-1.5 ${className}`}>
      <img 
        src={iconPath} 
        alt={nombre} 
        className="w-full h-full object-contain"
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/categories/cat_otro.png";
        }}
      />
    </div>
  );
}
