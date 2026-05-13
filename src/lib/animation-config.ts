// src/lib/animation-config.ts

// Core spring presets from UI Engineering Spec
export const springs = {
  // Snappy interactions (buttons, toggles)
  snappy: {
    type: 'spring',
    damping: 25,
    stiffness: 400,
    mass: 0.5,
  },
  
  // Default transitions (cards, modals)
  default: {
    type: 'spring',
    damping: 20,
    stiffness: 300,
    mass: 0.8,
  },
  
  // Gentle movements (page transitions)
  gentle: {
    type: 'spring',
    damping: 30,
    stiffness: 200,
    mass: 1,
  },
  
  // Bouncy feedback (success states)
  bouncy: {
    type: 'spring',
    damping: 12,
    stiffness: 400,
    mass: 0.5,
  },
  
  // Slow and smooth (sheet drag)
  smooth: {
    type: 'spring',
    damping: 40,
    stiffness: 150,
    mass: 1,
  },
  
  // Quick settle (keyboard, dropdowns)
  quick: {
    type: 'spring',
    damping: 30,
    stiffness: 500,
    mass: 0.3,
  },
} as const;

// Timing-based for specific cases
export const timings = {
  // Instant feedback
  instant: { duration: 0.1, ease: 'easeOut' },
  
  // Quick transitions
  fast: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
  
  // Standard transitions
  normal: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
  
  // Slow reveals
  slow: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
};
