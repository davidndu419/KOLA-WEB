'use client';

import { WalletCards } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Touchable } from '@/components/touchable';
import { cn } from '@/lib/utils';
import { creditService, type CreditSourceType } from '@/services/credit.service';

export function CreditButton({
  sourceType,
  onPress,
}: {
  sourceType: CreditSourceType;
  onPress: () => void;
}) {
  const summary = useLiveQuery(
    () => sourceType === 'sale'
      ? creditService.getSalesCreditSummary()
      : creditService.getServiceCreditSummary(),
    [sourceType]
  );
  const pendingCount = summary?.pendingCount || 0;
  const overdueCount = summary?.overdueCount || 0;

  return (
    <Touchable
      onPress={onPress}
      className={cn(
        'relative h-12 px-3 rounded-2xl bg-secondary flex items-center justify-center gap-2 text-muted-foreground',
        overdueCount > 0 && 'text-red-600 bg-red-50',
        overdueCount === 0 && pendingCount > 0 && 'text-amber-600 bg-amber-50'
      )}
    >
      <WalletCards size={18} />
      <span className="text-[10px] font-black uppercase tracking-wide">Credit</span>
      {pendingCount > 0 && (
        <span
          className={cn(
            'absolute -top-1 -right-1 min-w-5 h-5 rounded-full px-1 flex items-center justify-center text-[10px] font-black text-white',
            overdueCount > 0 ? 'bg-red-500' : 'bg-amber-500'
          )}
        >
          {pendingCount}
        </span>
      )}
    </Touchable>
  );
}
