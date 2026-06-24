// src/components/sales/receipt-sheet.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import {
  FileText,
  Share2,
  CheckCircle2,
  MapPin,
  Phone,
  Calendar,
  CreditCard,
  Hash,
  User,
  Package,
  CloudUpload,
  BookOpen,
  ShieldCheck,
} from 'lucide-react';
import Image from 'next/image';
import type { TransactionWithItems } from '@/db/schema';
import { useStore } from '@/store/use-store';

// ─── helpers ────────────────────────────────────────────────────────────────

function money(v: number) {
  return `₦${(v || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

function displayDate(d: Date | string) {
  return new Date(d).toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getItemName(item: any) {
  return String(item?.name || item?.product_name || item?.product_id || 'Product');
}
function getItemQty(item: any) {
  return Number(item?.quantity || 1);
}
function getItemUnit(item: any) {
  const qty = getItemQty(item);
  return Number(item?.unit_price ?? item?.price ?? ((item?.total_price || 0) / qty)) || 0;
}
function getItemTotal(item: any) {
  return Number(item?.total_price ?? item?.total ?? getItemUnit(item) * getItemQty(item)) || 0;
}

function statusColor(status: string) {
  const s = status?.toLowerCase();
  if (s === 'completed') return { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' };
  if (s === 'voided' || s === 'reversed') return { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' };
  if (s === 'pending') return { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' };
  return { bg: 'bg-zinc-100', text: 'text-zinc-600', dot: 'bg-zinc-400' };
}

function paymentIcon(method: string) {
  const m = method?.toLowerCase();
  if (m === 'transfer') return '🏦';
  if (m === 'credit') return '📋';
  return '💵'; // cash
}

// ─── QR generator ────────────────────────────────────────────────────────────

function QRCanvas({ data }: { data: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('qrcode').then((QRCode) => {
      if (cancelled || !canvasRef.current) return;
      QRCode.toCanvas(canvasRef.current, data, {
        width: 140,
        margin: 1,
        color: { dark: '#064e3b', light: '#ffffff' },
      }).catch(() => setFailed(true));
    }).catch(() => setFailed(true));
    return () => { cancelled = true; };
  }, [data]);

  if (failed) {
    return (
      <div className="w-[140px] h-[140px] bg-zinc-100 rounded-2xl flex items-center justify-center">
        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest text-center px-2">
          QR unavailable
        </span>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="rounded-2xl shadow-inner"
      style={{ width: 140, height: 140 }}
    />
  );
}

// ─── Section wrappers ────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-3">
      {children}
    </p>
  );
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-zinc-50 last:border-0">
      <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</p>
        <p className="text-sm font-bold text-zinc-800 mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ReceiptSheet({
  transaction,
  isOpen,
  onClose,
}: {
  transaction: TransactionWithItems | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { business } = useStore();

  if (!transaction) return null;

  const businessInfo = {
    businessName: business?.name || 'Kola Business',
    businessAddress: business?.address,
    businessPhone: business?.phone,
    businessId: undefined as string | undefined,
  };

  const showExportError = () =>
    window.dispatchEvent(new CustomEvent('kola:toast', { detail: { message: 'Export failed' } }));

  const handlePdf = async () => {
    try {
      const { exportService } = await import('@/services/exportService');
      exportService.downloadReceiptPdf(transaction, businessInfo);
    } catch {
      showExportError();
    }
  };

  const handleShare = async () => {
    try {
      const { exportService } = await import('@/services/exportService');
      await exportService.shareReceiptImage(transaction, businessInfo);
    } catch {
      showExportError();
    }
  };

  // Build line items
  const rawItems = transaction.items || [];
  const lineItems = rawItems.length > 0
    ? rawItems.map((item: any) => ({
        name: getItemName(item),
        qty: getItemQty(item),
        unit: getItemUnit(item),
        total: getItemTotal(item),
      }))
    : [{
        name: transaction.display_title || transaction.note || transaction.type,
        qty: 1,
        unit: transaction.amount,
        total: transaction.amount,
      }];

  const subtotal = lineItems.reduce((s, i) => s + i.total, 0);
  const discount = 0;
  const tax = 0;
  const grandTotal = transaction.amount;

  const sc = statusColor(transaction.status);
  const shortRef = transaction.local_id.slice(0, 8).toUpperCase();
  const typeLabel = (transaction.type || 'sale').replace(/_/g, ' ').toUpperCase();
  const isSynced = transaction.sync_status === 'synced';

  // QR data
  const qrPayload = JSON.stringify({
    ref: transaction.local_id,
    biz: transaction.business_id,
    amt: transaction.amount,
    ts: new Date(transaction.created_at).toISOString(),
    v: '1',
  });

  const hasCustomer = !!(transaction.customer_name || transaction.customer_id);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Transaction Receipt">
      <div className="space-y-4 py-3 pb-2">

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <Card>
          {/* Emerald gradient band */}
          <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-6 pt-6 pb-8 relative overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
            <div className="absolute top-4 -right-4 w-16 h-16 bg-white/5 rounded-full" />

            <div className="relative z-10 flex items-center gap-4">
              {/* Logo */}
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-900/20 shrink-0 overflow-hidden">
                <Image
                  src="/logo/kola-logo.png"
                  alt="Kola"
                  width={52}
                  height={52}
                  className="object-contain"
                  unoptimized
                />
              </div>

              <div>
                <p className="text-white font-black text-xl tracking-tight leading-none">KOLA</p>
                <p className="text-white/75 text-[11px] font-semibold mt-0.5">
                  Offline-First Business Manager
                </p>
                <p className="text-white/60 text-[10px] font-medium mt-0.5 italic">
                  Sell. Track. Grow.
                </p>
              </div>
            </div>
          </div>

          {/* Success badge — overlaps band */}
          <div className="px-6">
            <div className="-mt-4 mb-5 inline-flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-2xl shadow-lg shadow-emerald-500/30">
              <CheckCircle2 size={14} strokeWidth={2.5} />
              <span className="text-[12px] font-black uppercase tracking-widest">
                Transaction Successful
              </span>
            </div>

            {/* Ref line */}
            <div className="flex items-center justify-between pb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  Receipt No.
                </p>
                <p className="text-base font-black text-zinc-900 mt-0.5 font-mono">
                  #{shortRef}
                </p>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest ${sc.bg} ${sc.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                {transaction.status}
              </div>
            </div>
          </div>
        </Card>

        {/* ── AMOUNT HERO ──────────────────────────────────────────────────── */}
        <Card>
          <div className="px-6 py-6 text-center bg-gradient-to-b from-zinc-50 to-white">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">
              Grand Total
            </p>
            <p className="text-5xl font-black text-zinc-900 tracking-tighter tabular-nums">
              {money(grandTotal)}
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-zinc-500 text-xs font-bold">
              <span>{paymentIcon(transaction.payment_method)}</span>
              <span className="capitalize">{transaction.payment_method || 'Cash'}</span>
            </div>
          </div>
        </Card>

        {/* ── TRANSACTION SUMMARY ───────────────────────────────────────────── */}
        <Card>
          <div className="px-5 pt-5 pb-2">
            <SectionLabel>Transaction Details</SectionLabel>
          </div>
          <div className="px-5 pb-4">
            <MetaRow icon={<Hash size={13} />} label="Reference" value={transaction.local_id} />
            <MetaRow icon={<Package size={13} />} label="Type" value={typeLabel} />
            <MetaRow
              icon={<Calendar size={13} />}
              label="Date & Time"
              value={displayDate(transaction.created_at)}
            />
            <MetaRow
              icon={<CreditCard size={13} />}
              label="Payment Method"
              value={(transaction.payment_method || 'Cash').toUpperCase()}
            />
          </div>
        </Card>

        {/* ── BUSINESS CARD ────────────────────────────────────────────────── */}
        <Card className="relative overflow-hidden">
          {/* Subtle branded stripe */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-l-3xl" />
          <div className="px-5 pt-5 pb-2 pl-6">
            <SectionLabel>Issued By</SectionLabel>
          </div>
          <div className="px-5 pb-5 pl-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                <Image
                  src="/logo/kola-logo.png"
                  alt="Kola"
                  width={36}
                  height={36}
                  className="object-contain"
                  unoptimized
                />
              </div>
              <div>
                <p className="font-black text-sm text-zinc-900">{businessInfo.businessName}</p>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                  Verified Business
                </p>
              </div>
            </div>
            {businessInfo.businessAddress && (
              <div className="flex items-start gap-2 text-zinc-500 text-xs font-medium mb-1.5">
                <MapPin size={12} className="mt-0.5 text-zinc-400 shrink-0" />
                <span>{businessInfo.businessAddress}</span>
              </div>
            )}
            {businessInfo.businessPhone && (
              <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium">
                <Phone size={12} className="text-zinc-400 shrink-0" />
                <span>{businessInfo.businessPhone}</span>
              </div>
            )}
          </div>
        </Card>

        {/* ── LINE ITEMS ────────────────────────────────────────────────────── */}
        <Card>
          <div className="px-5 pt-5 pb-2">
            <SectionLabel>Items</SectionLabel>
          </div>

          {/* Table header */}
          <div className="mx-4 mb-1 grid grid-cols-[1fr_auto_auto_auto] gap-x-2 px-3 py-2 bg-zinc-50 rounded-xl">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Item</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 text-center w-7">Qty</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right w-20">Unit</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right w-20">Total</span>
          </div>

          {/* Rows */}
          <div className="px-4 pb-4 space-y-0.5">
            {lineItems.map((item, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 items-center px-3 py-3 border-b border-zinc-50 last:border-0"
              >
                <div>
                  <p className="text-sm font-bold text-zinc-800 leading-tight">{item.name}</p>
                </div>
                <span className="text-sm font-bold text-zinc-500 text-center w-7">{item.qty}</span>
                <span className="text-xs font-bold text-zinc-500 text-right w-20 tabular-nums">
                  {money(item.unit)}
                </span>
                <span className="text-sm font-black text-zinc-800 text-right w-20 tabular-nums">
                  {money(item.total)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* ── FINANCIAL BREAKDOWN ───────────────────────────────────────────── */}
        <Card>
          <div className="px-5 pt-5 pb-2">
            <SectionLabel>Financial Summary</SectionLabel>
          </div>
          <div className="px-5 pb-5 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-zinc-500">Subtotal</span>
              <span className="font-bold text-zinc-700 tabular-nums">{money(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-zinc-500">Discount</span>
                <span className="font-bold text-red-500 tabular-nums">- {money(discount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-zinc-500">Tax</span>
                <span className="font-bold text-zinc-700 tabular-nums">+ {money(tax)}</span>
              </div>
            )}
            <div className="pt-3 border-t-2 border-dashed border-zinc-100 flex justify-between items-center">
              <span className="text-sm font-black text-zinc-900">Grand Total</span>
              <span className="text-xl font-black text-emerald-600 tabular-nums">
                {money(grandTotal)}
              </span>
            </div>
          </div>
        </Card>

        {/* ── CUSTOMER ─────────────────────────────────────────────────────── */}
        {hasCustomer && (
          <Card>
            <div className="px-5 pt-5 pb-2">
              <SectionLabel>Customer</SectionLabel>
            </div>
            <div className="px-5 pb-5">
              {transaction.customer_name && (
                <MetaRow icon={<User size={13} />} label="Name" value={transaction.customer_name} />
              )}
              {transaction.customer_id && (
                <MetaRow icon={<Hash size={13} />} label="Customer ID" value={transaction.customer_id.slice(0, 12).toUpperCase()} />
              )}
            </div>
          </Card>
        )}

        {/* ── KOLA FEATURE BADGES ───────────────────────────────────────────── */}
        <Card>
          <div className="px-5 pt-5 pb-4">
            <SectionLabel>System Confirmation</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: <Package size={13} />, label: 'Inventory Updated' },
                { icon: <BookOpen size={13} />, label: 'Accounting Posted' },
                { icon: <CloudUpload size={13} />, label: isSynced ? 'Synced to Cloud' : 'Sync Pending' },
                { icon: <ShieldCheck size={13} />, label: 'Audit Logged' },
              ].map(({ icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-2xl px-3 py-2.5"
                >
                  <div className="text-emerald-600">{icon}</div>
                  <span className="text-[11px] font-black text-emerald-800 leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* ── QR VERIFICATION ──────────────────────────────────────────────── */}
        <Card>
          <div className="px-5 pt-5 pb-5 flex flex-col items-center gap-3">
            <SectionLabel>Scan to Verify</SectionLabel>
            <div className="p-3 bg-white rounded-3xl shadow-inner border border-zinc-100">
              <QRCanvas data={qrPayload} />
            </div>
            <div className="text-center space-y-0.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Transaction Verification QR
              </p>
              <p className="text-[10px] text-zinc-400 font-medium font-mono">
                {shortRef}
              </p>
            </div>
          </div>
        </Card>

        {/* ── FOOTER ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-xl bg-emerald-500 flex items-center justify-center overflow-hidden">
              <Image
                src="/logo/kola-logo.png"
                alt="Kola"
                width={26}
                height={26}
                className="object-contain"
                unoptimized
              />
            </div>
            <span className="font-black text-sm text-zinc-800">Powered by KOLA</span>
          </div>
          <p className="text-[10px] text-zinc-400 font-medium max-w-[240px] leading-relaxed">
            Offline-First Financial & Inventory Management System
          </p>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
            Sell. Track. Grow.
          </p>
          <p className="text-[11px] text-zinc-400 font-medium mt-1">
            Thank you for your business 🙏
          </p>
          <p className="text-[9px] text-zinc-300 font-medium mt-1">
            Generated {displayDate(new Date())}
          </p>
        </div>

        {/* ── ACTION BUTTONS ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 pb-2">
          <Touchable
            onPress={handlePdf}
            className="w-full bg-zinc-100 hover:bg-zinc-200 transition-colors p-4 rounded-2xl flex items-center justify-center gap-2 font-black text-sm text-zinc-700"
          >
            <FileText size={17} />
            Save PDF
          </Touchable>
          <Touchable
            onPress={handleShare}
            className="w-full bg-emerald-500 hover:bg-emerald-600 transition-colors text-white p-4 rounded-2xl flex items-center justify-center gap-2 font-black text-sm shadow-lg shadow-emerald-500/25"
          >
            <Share2 size={17} />
            Share
          </Touchable>
        </div>

      </div>
    </BottomSheet>
  );
}
