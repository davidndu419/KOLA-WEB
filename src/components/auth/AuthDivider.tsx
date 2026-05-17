'use client';

import React from 'react';

export function AuthDivider({ text = 'or' }: { text?: string }) {
  return (
    <div className="relative flex items-center py-1">
      <div className="flex-1 h-px bg-border/60" />
      <span className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{text}</span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}
