'use client';

import { Search, X } from 'lucide-react';
import { Touchable } from '@/components/touchable';

export function TransactionSearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <section className="px-4">
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-secondary/50 rounded-[22px] p-4 pl-12 pr-12 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-transparent focus:border-primary/30"
        />
        {value.trim() && (
          <Touchable
            onPress={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-secondary text-muted-foreground flex items-center justify-center"
          >
            <X size={16} />
          </Touchable>
        )}
      </div>
    </section>
  );
}
