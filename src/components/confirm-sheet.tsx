'use client';

import { AlertTriangle } from 'lucide-react';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import { cn } from '@/lib/utils';

type ConfirmSheetProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isSubmitting?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export function ConfirmSheet({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  isSubmitting = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      dismissible={!isSubmitting}
    >
      <div className="space-y-5 py-5 pb-2">
        <div className={cn(
          "rounded-[28px] p-5 border flex gap-4",
          destructive ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20"
        )}>
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
            destructive ? "bg-red-500/15 text-red-600" : "bg-amber-500/15 text-amber-600"
          )}>
            <AlertTriangle size={24} />
          </div>
          <p className={cn(
            "text-sm font-bold leading-relaxed",
            destructive ? "text-red-600" : "text-amber-700"
          )}>
            {message}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Touchable
            onPress={onCancel}
            disabled={isSubmitting}
            className="h-14 rounded-2xl bg-secondary text-foreground font-bold flex items-center justify-center"
          >
            {cancelLabel}
          </Touchable>
          <Touchable
            onPress={onConfirm}
            disabled={isSubmitting}
            className={cn(
              "h-14 rounded-2xl text-white font-bold flex items-center justify-center shadow-lg",
              destructive ? "bg-red-500 shadow-red-500/20" : "bg-primary shadow-primary/20"
            )}
          >
            {isSubmitting ? 'Working...' : confirmLabel}
          </Touchable>
        </div>
      </div>
    </BottomSheet>
  );
}
