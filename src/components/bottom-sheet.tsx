'use client';

import { motion, useDragControls, useMotionValue, useTransform, AnimatePresence, PanInfo } from 'framer-motion';
import { ReactNode, useRef, useEffect, useState } from 'react';
import { springs } from '@/lib/animation-config';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  snapPoints?: number[]; // Not used for fit-content, but kept for compatibility
  initialSnap?: number;
  title?: string;
  bottomOffset?: number;
}

export function BottomSheet({ 
  isOpen, 
  onClose, 
  children,
  title,
  bottomOffset = 0,
}: BottomSheetProps) {
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const y = useMotionValue(0);
  const [windowHeight, setWindowHeight] = useState(0);

  useEffect(() => {
    setWindowHeight(window.innerHeight);
    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const backdropOpacity = useTransform(
    y,
    [100, 0],
    [0, 0.5]
  );

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.velocity.y > 300 || info.offset.y > 100) {
      onClose();
    } else {
      y.set(0);
    }
  };

  useEffect(() => {
    if (isOpen) {
      y.set(0);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } else {
      y.set(windowHeight);
    }
  }, [isOpen, y, windowHeight]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ opacity: backdropOpacity }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55]"
          />
          
          <motion.div
            ref={constraintsRef}
            initial={{ y: 500 }}
            animate={{ y: 0 }}
            exit={{ y: 500 }}
            transition={springs.smooth}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 500 }}
            dragElastic={0.05}
            onDragEnd={handleDragEnd}
            className="fixed inset-x-0 z-[56] touch-none flex flex-col"
            style={{ 
              bottom: bottomOffset, 
              y,
              maxHeight: `calc(100vh - ${bottomOffset}px - 20px)`,
              height: 'fit-content'
            }}
          >
            <div className="bg-card rounded-t-[32px] overflow-hidden shadow-2xl flex flex-col border-t border-border/50">
              {/* Drag handle */}
              <div 
                className="flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-10 h-1.5 bg-muted-foreground/20 rounded-full mb-1" />
                {title && (
                  <h3 className="text-sm font-bold tracking-tight text-center">{title}</h3>
                )}
              </div>
              
              {/* Content area - NO EXTRA PADDING AT BOTTOM */}
              <div className="overflow-y-auto overscroll-contain px-6 pb-2">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
