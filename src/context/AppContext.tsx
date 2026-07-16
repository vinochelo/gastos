'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AppContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  hideAmounts: boolean;
  toggleHideAmounts: () => void;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  formatAmount: (amount: number) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [hideAmounts, setHideAmounts] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Initialize from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDark = localStorage.getItem('darkMode') === 'true';
      const savedHide = localStorage.getItem('hideAmounts') === 'true';
      
      setIsDarkMode(savedDark);
      setHideAmounts(savedHide);
      
      document.documentElement.setAttribute('data-theme', savedDark ? 'dark' : 'light');
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const newVal = !prev;
      localStorage.setItem('darkMode', String(newVal));
      document.documentElement.setAttribute('data-theme', newVal ? 'dark' : 'light');
      return newVal;
    });
  };

  const toggleHideAmounts = () => {
    setHideAmounts(prev => {
      const newVal = !prev;
      localStorage.setItem('hideAmounts', String(newVal));
      return newVal;
    });
  };

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);

  const formatAmount = (amount: number) => {
    if (hideAmounts) {
      return '$ ••••';
    }
    const absVal = Math.abs(amount).toLocaleString('es-ES', { minimumFractionDigits: 2 });
    return amount < 0 ? `-$${absVal}` : `$${absVal}`;
  };

  return (
    <AppContext.Provider value={{
      isDarkMode,
      toggleDarkMode,
      hideAmounts,
      toggleHideAmounts,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      formatAmount
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
