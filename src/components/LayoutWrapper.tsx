'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import OfflineIndicator from './OfflineIndicator';
import { useApp } from '@/context/AppContext';

const Scene3D = dynamic(() => import('./Scene3D'), { 
  ssr: false,
  loading: () => <div className="fixed inset-0 -z-10 bg-gradient-to-br from-teal-950/30 via-background to-emerald-950/30" />
});

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { reduceMotion } = useApp();

  return (
    <>
      {reduceMotion ? (
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-teal-950/15 via-transparent to-emerald-950/15 pointer-events-none" />
      ) : (
        <Scene3D />
      )}
      <OfflineIndicator />
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeInOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
