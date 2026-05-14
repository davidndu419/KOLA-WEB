'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function AuthInput({ label, error, className, type, ...props }: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="space-y-1.5 w-full">
      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 px-1">
        {label}
      </label>
      <div className="relative group">
        <input
          type={inputType}
          className={cn(
            "w-full h-14 bg-secondary/50 border border-border/50 rounded-2xl px-4 text-sm font-medium transition-all duration-200 outline-none",
            "focus:bg-secondary focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5",
            error ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/5" : "",
            className
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && (
        <p className="text-[11px] font-bold text-red-500 px-1 animate-in fade-in slide-in-from-top-1">
          {error}
        </p>
      )}
    </div>
  );
}
