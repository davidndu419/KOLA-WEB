// src/components/sales/receipt-sheet.tsx
'use client';

import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import { FileText, Share2, CheckCircle2 } from 'lucide-react';
import type { TransactionWithItems } from '@/db/schema';
import { useStore } from '@/store/use-store';
import { exportService } from '@/services/exportService';

export function ReceiptSheet({ 
  transaction,
  isOpen, 
  onClose 
}: { 
  transaction: TransactionWithItems | null;
  isOpen: boolean; 
  onClose: () => void; 
}) {
  const { business } = useStore();

  if (!transaction) return null;

  const showExportError = () => {
    window.dispatchEvent(new CustomEvent('kola:toast', { detail: { message: 'Export failed' } }));
  };

  const businessInfo = {
    businessName: business?.name || 'Kola Business',
    businessAddress: business?.address,
  };

  const handlePdf = () => {
    try {
      exportService.downloadReceiptPdf(transaction, businessInfo);
    } catch {
      showExportError();
    }
  };

  const handleShare = async () => {
    try {
      await exportService.shareReceiptImage(transaction, businessInfo);
    } catch {
      showExportError();
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Transaction Receipt">
      <div className="space-y-8 py-6 pb-2 px-2">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-2xl font-black tracking-tighter">Transaction Successful</h2>
          <p className="text-sm text-muted-foreground font-medium">Receipt for {transaction.local_id.slice(0, 8).toUpperCase()}</p>
        </div>

        <div className="bg-secondary/50 rounded-[32px] p-8 border-2 border-dashed border-border/50 relative overflow-hidden">
          {/* Decorative receipt holes */}
          <div className="absolute -top-1 left-0 right-0 flex justify-around px-4">
             {[...Array(8)].map((_, i) => <div key={i} className="w-2 h-2 rounded-full bg-card" />)}
          </div>

          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h3 className="font-black text-lg uppercase tracking-tight">{business?.name || 'KOLA BUSINESS'}</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{business?.address || 'Nigeria'}</p>
              <p className="text-[10px] font-bold text-muted-foreground">{new Date(transaction.created_at).toLocaleString()}</p>
            </div>

            <div className="border-y border-border/50 py-4 space-y-3">
              {transaction.items?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-sm font-bold">
                   <span>{item.quantity}x Product</span>
                   <span className="tabular-nums">₦{(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
              {(!transaction.items || transaction.items.length === 0) && (
                <div className="flex justify-between items-center text-sm font-bold">
                   <span>{transaction.note || transaction.type}</span>
                   <span className="tabular-nums">₦{transaction.amount.toLocaleString()}</span>
                </div>
              )}
            </div>


            <div className="flex justify-between items-center">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Amount</p>
              <p className="text-2xl font-black tracking-tight">₦{transaction.amount.toLocaleString()}</p>
            </div>

            <div className="pt-4 text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest italic">Thank you for your business!</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Touchable
            onPress={handlePdf}
            className="w-full bg-secondary p-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm"
          >
            <FileText size={18} /> PDF
          </Touchable>
          <Touchable
            onPress={handleShare}
            className="w-full bg-primary text-white p-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm"
          >
            <Share2 size={18} /> Share
          </Touchable>
        </div>
      </div>
    </BottomSheet>
  );
}
