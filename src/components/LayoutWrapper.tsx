'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

const Scene3D = dynamic(() => import('./Scene3D'), { 
  ssr: false,
  loading: () => <div className="fixed inset-0 -z-10 bg-gradient-to-br from-violet-950/30 via-background to-pink-950/30" />
});

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <Scene3D />
      <AnimatePresence mode="wait">
        <motion.div
          key={usePathname()}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
