'use client';

import { motion, useDragControls, useMotionValue, useTransform, AnimatePresence, PanInfo } from 'framer-motion';
import { ReactNode, useEffect, useRef } from 'react';
import { springs } from '@/lib/animation-config';
import { X } from 'lucide-react';
import { Touchable } from './touchable';
import { useUIStore } from '@/store/use-ui-store';

let bodyScrollLockCount = 0;
let previousBodyOverflow = '';
let previousHtmlOverflow = '';

function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  if (bodyScrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
  bodyScrollLockCount += 1;
}

function unlockBodyScroll() {
  if (typeof document === 'undefined') return;
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;
  }
}

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  dismissible?: boolean;
  showCloseButton?: boolean;
}

export function BottomSheet({ 
  isOpen, 
  onClose, 
  children,
  title,
  dismissible = true,
  showCloseButton = true,
}: BottomSheetProps) {
  const dragControls = useDragControls();
  const dragY = useMotionValue(0);
  const { incrementSheets, decrementSheets } = useUIStore();
  const isRegisteredRef = useRef(false);

  const releaseSheet = () => {
    if (!isRegisteredRef.current) return;
    isRegisteredRef.current = false;
    decrementSheets();
    unlockBodyScroll();
  };

  // Manage global UI state for nav visibility
  useEffect(() => {
    if (!isOpen || isRegisteredRef.current) return;
    dragY.set(0);
    isRegisteredRef.current = true;
    incrementSheets();
    lockBodyScroll();
  }, [isOpen, dragY, incrementSheets]);

  useEffect(() => {
    return () => releaseSheet();
  }, []);

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

  const sheetVariants = {
    hidden: { 
      y: "100%", 
      transition: springs.quick 
    },
    visible: { 
      y: 0, 
      transition: springs.smooth 
    },
    exit: { 
      y: "100%", 
      transition: springs.quick
    }
  };

  return (
    <AnimatePresence
      mode="wait"
      onExitComplete={() => {
        dragY.set(0);
        releaseSheet();
      }}
    >
      {isOpen && (
        <div className="fixed inset-0 z-[100] overflow-hidden">
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
          
          {/* Fixed bottom rail: no external offset or safe-area gap. */}
          <motion.div
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-x-0 bottom-0 z-[101] mx-auto w-full max-w-lg pointer-events-auto"
          >
            <motion.div
              style={{ y: dragY }}
              drag={dismissible ? "y" : false}
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.08 }}
              onDragEnd={handleDragEnd}
              className="flex max-h-[calc(100dvh-24px)] flex-col overflow-hidden rounded-t-[40px] border-t border-border/40 bg-card shadow-[0_-12px_50px_rgba(0,0,0,0.3)]"
            >
              {/* Header / Drag handle */}
              <div
                className="relative flex flex-col items-center pt-4 pb-1 touch-none shrink-0"
                onPointerDown={(event) => dismissible && dragControls.start(event)}
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
              
              {/* Content area: safe area lives inside the sheet so the card stays flush. */}
              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-1 scrollbar-none"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
              >
                {children}
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
