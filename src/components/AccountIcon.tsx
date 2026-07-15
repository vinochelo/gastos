// Component to render highly stylized, branded vector/image badges for bank accounts and cards.

import React from "react";
import { getAccountIconPath } from "@/lib/categoryIcons";

interface AccountIconProps {
  nombre: string;
  className?: string;
}

export default function AccountIcon({ nombre, className = "w-10 h-10" }: AccountIconProps) {
  const nameLower = nombre.toLowerCase();

  // Branded Produbanco logo (Green)
  if (nameLower.includes("produbanco")) {
    return (
      <div className={`rounded-2xl bg-[#008A4B] text-white flex flex-col items-center justify-center font-black shadow-inner border border-emerald-400/20 ${className}`}>
        <span className="leading-none tracking-tighter text-xs">P</span>
        <span className="text-[5px] tracking-widest uppercase opacity-85 mt-0.5 font-bold">PRODU</span>
      </div>
    );
  }

  // Branded Banco Guayaquil logo (Magenta)
  if (nameLower.includes("guayaquil")) {
    return (
      <div className={`rounded-2xl bg-[#E30052] text-white flex flex-col items-center justify-center font-black shadow-inner border border-pink-400/20 relative overflow-hidden ${className}`}>
        <span className="leading-none text-sm italic font-serif">G</span>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white/10 blur-xs" />
      </div>
    );
  }

  // Branded American Express card (AMEX Blue Card)
  if (nameLower.includes("american") || nameLower.includes("amex")) {
    return (
      <div className={`rounded-2xl bg-gradient-to-br from-[#007cc2] to-[#004b87] text-white flex flex-col items-center justify-center font-extrabold shadow-md border border-cyan-400/30 relative overflow-hidden ${className}`}>
        <span className="text-[7px] tracking-widest font-black">AMEX</span>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-white/0 via-white/10 to-white/0 pointer-events-none" />
      </div>
    );
  }

  // Branded DeUna (Banco Pichincha payment app - Yellow/Black logo)
  if (nameLower.includes("deuna") || nameLower.includes("de una")) {
    return (
      <div className={`rounded-2xl bg-[#FFDD00] text-black flex flex-col items-center justify-center font-black shadow-sm relative overflow-hidden border border-yellow-300 ${className}`}>
        <span className="text-[8px] font-black tracking-tight leading-none">deuna!</span>
        <div className="absolute -bottom-2 -left-2 w-5 h-5 rounded-full bg-black/5" />
      </div>
    );
  }

  // Branded Peigo (Mobile digital wallet - Purple/Violet card)
  if (nameLower.includes("peigo")) {
    return (
      <div className={`rounded-2xl bg-gradient-to-br from-[#7B2CBF] to-[#5A189A] text-white flex flex-col items-center justify-center font-bold shadow-md relative overflow-hidden border border-purple-500/20 ${className}`}>
        <span className="text-[8px] font-black tracking-tighter leading-none">peigo</span>
        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#39FF14]" />
      </div>
    );
  }

  // Cash / Efectivo (Use our beautiful 3D cash PNG, but wrap it beautifully)
  if (nameLower.includes("efectivo") || nameLower.includes("cash") || nameLower.includes("billetera")) {
    return (
      <div className={`rounded-2xl bg-[#139D57]/5 flex items-center justify-center border border-[#139D57]/15 ${className}`}>
        <img 
          src="/categories/cat_salario.png" 
          alt="Efectivo" 
          className="w-7 h-7 object-contain" 
        />
      </div>
    );
  }

  // Default fallback (Use our investments/bank 3D PNG for generic bank accounts, else star)
  const iconPath = getAccountIconPath(nombre);
  return (
    <div className={`rounded-2xl bg-white dark:bg-gray-800 flex items-center justify-center border border-border/40 shadow-sm ${className}`}>
      <img 
        src={iconPath} 
        alt={nombre} 
        className="w-7 h-7 object-contain rounded-lg"
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/categories/cat_otro.png";
        }}
      />
    </div>
  );
}
