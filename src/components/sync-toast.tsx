'use client';

import { useEffect, useState } from 'react';

export function SyncToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      if (!detail?.message) return;

      setMessage(detail.message);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 3200);
    };

    window.addEventListener('kola:toast', handleToast);

    return () => {
      window.removeEventListener('kola:toast', handleToast);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!message) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[120] rounded-2xl bg-foreground text-background px-4 py-3 text-xs font-bold shadow-2xl">
      {message}
    </div>
  );
}
