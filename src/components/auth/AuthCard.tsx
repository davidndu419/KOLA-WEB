'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface AuthCardProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthCard({ children, title, subtitle }: AuthCardProps) {
  const [logoError, setLogoError] = React.useState(false);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-emerald-50 via-background to-background dark:from-emerald-950/20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[400px] bg-card border border-border/50 shadow-2xl shadow-emerald-500/5 rounded-[32px] p-8 glassmorphism"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center">
            {!logoError ? (
              <Image 
                src="/logo/kola-logo.png" 
                alt="Kola Logo" 
                width={64} 
                height={64} 
                className="object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-16 h-16 bg-emerald-500 rounded-[22px] flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <span className="text-white text-3xl font-black">K</span>
              </div>
            )}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-2 font-medium">{subtitle}</p>
          )}
        </div>
        
        {children}
      </motion.div>
    </div>
  );
}
