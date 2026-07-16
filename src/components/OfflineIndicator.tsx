'use client';

import { useState, useEffect } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      
      const handleOnline = () => {
        setIsOnline(true);
        setShowStatus(true);
        const timer = setTimeout(() => {
          setShowStatus(false);
        }, 3000);
        return () => clearTimeout(timer);
      };

      const handleOffline = () => {
        setIsOnline(false);
        setShowStatus(true);
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      if (!navigator.onLine) {
        setShowStatus(true);
      }

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  return (
    <AnimatePresence>
      {showStatus && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-sm pointer-events-none"
        >
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-lg transition-colors duration-500 ${
              isOnline
                ? "bg-emerald-500/90 text-white border-emerald-500/20"
                : "bg-amber-600/95 text-white border-amber-500/20"
            }`}
          >
            {isOnline ? (
              <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                <Wifi size={14} />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-lg bg-black/20 flex items-center justify-center flex-shrink-0">
                <WifiOff size={14} />
              </div>
            )}
            
            <div className="flex-1 text-xs font-semibold leading-tight">
              {isOnline ? (
                <>
                  <p className="font-bold">Conexión restablecida</p>
                  <p className="text-[10px] opacity-80">Sincronizando tus cambios con la nube...</p>
                </>
              ) : (
                <>
                  <p className="font-bold">Modo sin conexión</p>
                  <p className="text-[10px] opacity-80">Guardando datos localmente. Se sincronizarán al conectar.</p>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
