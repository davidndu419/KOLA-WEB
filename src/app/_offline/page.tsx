import Link from 'next/link';
import { WifiOff } from 'lucide-react';

export default function OfflineFallbackPage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-secondary mx-auto flex items-center justify-center text-muted-foreground">
          <WifiOff size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-black tracking-tight">Offline</h1>
          <p className="text-sm text-muted-foreground font-medium">
            This page is not cached yet. Open Kola again from the app icon or return to your dashboard.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex h-12 px-6 items-center justify-center rounded-2xl bg-primary text-white text-sm font-bold"
        >
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
}
