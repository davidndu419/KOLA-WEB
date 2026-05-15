'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Touchable } from '@/components/touchable';

import { usePWAInstall } from '@/hooks/usePWAInstall';

export function PWAInstallPrompt() {
  const {isInstalled, canInstall, installApp } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const shouldShowPrompt = !isInstalled && canInstall && !dismissed
  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      setDismissed(true);
    }
  };

  if (!canInstall || dismissed) return null;

  return (
    <AnimatePresence>
      {shouldShowPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 z-[100]"
        >
          <div className="bg-primary text-white p-4 rounded-[24px] shadow-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Download size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest">Install Kola</p>
                <p className="text-[10px] opacity-80 font-medium">Add to home screen for offline access</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Touchable 
                onPress={handleInstall}
                className="bg-white text-primary px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider"
              >
                Install
              </Touchable>
              <button 
                onClick={() => setDismissed(true)}
                className="w-8 h-8 flex items-center justify-center text-white/60"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
