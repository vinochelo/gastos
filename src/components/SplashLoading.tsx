'use client';

import Image from "next/image";
import { motion } from "framer-motion";

export default function SplashLoading() {
  return (
    <div className="fixed inset-0 bg-[#051618] z-[9999] flex flex-col items-center justify-center gap-6">
      <div className="relative">
        {/* Glow effect behind the logo */}
        <div className="absolute inset-0 bg-teal-500/20 rounded-full blur-2xl transform scale-125 animate-pulse" />
        
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            rotate: [0, 1, 0, -1, 0]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="relative"
        >
          <Image 
            src="/app_icon.png" 
            alt="Logo Gestor.AI" 
            width={120} 
            height={120} 
            className="rounded-[2.5rem] shadow-2xl border border-white/5 relative z-10"
            priority
          />
        </motion.div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <h2 className="text-2xl font-black tracking-widest bg-gradient-to-r from-teal-400 via-[#0f969c] to-emerald-400 bg-clip-text text-transparent animate-pulse">
          GESTOR.AI
        </h2>
        <p className="text-[9px] font-extrabold uppercase tracking-widest text-teal-400/50">
          Iniciando sistema...
        </p>
      </div>

      {/* Modern line loading indicator */}
      <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden relative mt-2">
        <motion.div 
          initial={{ left: "-100%" }}
          animate={{ left: "100%" }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-teal-400 to-transparent"
        />
      </div>
    </div>
  );
}
