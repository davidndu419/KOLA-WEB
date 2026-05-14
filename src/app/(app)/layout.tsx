'use client';

import { ReactNode, useEffect, useState } from 'react';
import { BottomNavigation } from '@/components/bottom-navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { useSync } from '@/hooks/useSync';


export default function AppLayout({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  
  // Initialize background sync loop
  useSync();

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);


  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      {/* Safe Area Top */}
      <div className="h-safe-top bg-background flex-shrink-0 touch-none" />
      
      {/* Offline Indicator */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.9 }}
            className="fixed top-12 left-1/2 -translate-x-1/2 bg-amber-500/90 backdrop-blur-xl text-white py-2 px-6 rounded-full flex items-center gap-3 z-[100] text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-amber-500/40 border border-amber-400/50 touch-none"
          >
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Working Offline
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Main content */}
      <main className="flex-1 overflow-y-auto overscroll-y-none relative scrollbar-none">
        <div className="pb-40 pt-4">
          {children}
        </div>
      </main>
      
      {/* Bottom Navigation */}
      <div className="touch-none">
        <BottomNavigation />
      </div>
    </div>
  );
}
