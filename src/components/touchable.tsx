'use client';

import { motion, useAnimation } from 'framer-motion';
import { ReactNode, useCallback } from 'react';
import { springs } from '@/lib/animation-config';
import { cn } from '@/lib/utils';

interface TouchableProps {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
  haptic?: 'light' | 'medium' | 'heavy';
}

export function Touchable({ 
  children, 
  onPress, 
  disabled,
  className,
  haptic = 'light'
}: TouchableProps) {
  const controls = useAnimation();
  
  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const patterns = {
        light: 5,
        medium: 10,
        heavy: 20,
      };
      navigator.vibrate(patterns[haptic]);
    }
  }, [haptic]);

  const handleTapStart = () => {
    if (disabled) return;
    controls.start({ scale: 0.97 });
    triggerHaptic();
  };

  const handleTapEnd = () => {
    if (disabled) return;
    controls.start({ scale: 1 });
  };

  const handleTap = () => {
    if (disabled) return;
    // Let the spring handle the bounce naturally
    controls.start({
      scale: 1,
      transition: springs.bouncy,
    });
    onPress?.();
  };

  return (
    <motion.button
      animate={controls}
      onTapStart={handleTapStart}
      onTap={handleTap}
      onTapCancel={handleTapEnd}
      transition={springs.snappy}
      className={cn("outline-none select-none", className)}
      disabled={disabled}
      style={{ 
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    >
      {children}
    </motion.button>
  );
}
