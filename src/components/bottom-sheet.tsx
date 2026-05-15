'use client';

import { motion, useDragControls, useMotionValue, useTransform, AnimatePresence, PanInfo } from 'framer-motion';
import { ReactNode, useRef, useEffect, useState } from 'react';
import { springs } from '@/lib/animation-config';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Touchable } from './touchable';
import { useUIStore } from '@/store/use-ui-store';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  bottomOffset?: number;
  dismissible?: boolean;
  showCloseButton?: boolean;
}

export function BottomSheet({ 
  isOpen, 
  onClose, 
  children,
  title,
  bottomOffset = 0,
  dismissible = true,
  showCloseButton = true,
}: BottomSheetProps) {
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const dragY = useMotionValue(0);
  const { incrementSheets, decrementSheets } = useUIStore();

  // Manage global UI state for nav visibility
  useEffect(() => {
    if (isOpen) {
      incrementSheets();
      return () => decrementSheets();
    }
  }, [isOpen, incrementSheets, decrementSheets]);

  // Backdrop opacity based on drag distance (0 to 200px)
  const backdropOpacity = useTransform(
    dragY,
    [0, 200],
    [1, 0]
  );

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (!dismissible) {
      dragY.set(0);
      return;
    }
    // Faster swipe or significant distance triggers close
    if (info.velocity.y > 300 || info.offset.y > 150) {
      onClose();
    } else {
      dragY.set(0);
    }
  };

  const handleBackdropClick = () => {
    if (dismissible) {
      onClose();
    }
  };

  // Variants for clean entry/exit
  const sheetVariants = {
    hidden: { 
      y: "100%", 
      transition: springs.default 
    },
    visible: { 
      y: 0, 
      transition: springs.default 
    },
    exit: { 
      y: "100%", 
      transition: { 
        type: 'spring' as const, 
        stiffness: 450, 
        damping: 45, 
        mass: 1 
      } 
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ opacity: backdropOpacity }}
            onClick={handleBackdropClick}
            className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"
          />
          
          {/* Sheet Container */}
          <motion.div
            ref={constraintsRef}
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            drag={dismissible ? "y" : false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.05}
            onDragEnd={handleDragEnd}
            style={{ 
              y: dragY,
              bottom: bottomOffset,
              maxHeight: `calc(100vh - ${bottomOffset}px - 20px)`,
            }}
            className="relative w-full max-w-lg mx-auto z-[101] flex flex-col pointer-events-auto shadow-[0_-12px_50px_rgba(0,0,0,0.3)]"
          >
            <div className="bg-card rounded-t-[40px] overflow-hidden flex flex-col border-t border-border/40 pb-safe">
              {/* Header / Drag handle */}
              <div 
                className="flex flex-col items-center pt-4 pb-1 relative touch-none"
                onPointerDown={(e) => dismissible && dragControls.start(e)}
              >
                <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mb-3" />
                
                {title && (
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 select-none">
                    {title}
                  </h3>
                )}

                {showCloseButton && (
                  <div className="absolute right-6 top-5">
                    <Touchable 
                      onPress={onClose}
                      className="w-8 h-8 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
                    >
                      <X size={16} strokeWidth={3} />
                    </Touchable>
                  </div>
                )}
              </div>
              
              {/* Content area */}
              <div className="overflow-y-auto overscroll-contain px-6 pb-6 scrollbar-none">
                {children}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
