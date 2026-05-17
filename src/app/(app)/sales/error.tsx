'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Touchable } from '@/components/touchable';

export default function SalesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Sales] Route failed to render', error);
  }, [error]);

  const showStack = process.env.NODE_ENV !== 'production' && error.stack;

  return (
    <div className="px-6 py-12 min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center">
          <RefreshCw size={24} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black tracking-tight">Sales could not load</h2>
          <p className="text-sm font-medium text-muted-foreground">
            Refresh this screen to reconnect to the latest app files.
          </p>
        </div>
        <div className="text-left rounded-2xl bg-secondary/60 border border-border p-3 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Error</p>
          <p className="text-xs font-bold break-words">{error.message || 'Unknown sales route error'}</p>
          {error.digest && (
            <p className="text-[10px] font-mono text-muted-foreground break-all">Digest: {error.digest}</p>
          )}
          {showStack && (
            <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words text-[10px] text-muted-foreground">
              {error.stack}
            </pre>
          )}
        </div>
        <Touchable
          onPress={reset}
          className="w-full bg-primary text-white p-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold"
        >
          <RefreshCw size={18} /> Retry
        </Touchable>
      </div>
    </div>
  );
}
