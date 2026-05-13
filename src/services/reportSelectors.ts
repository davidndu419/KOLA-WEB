import { Transaction } from '@/db/schema';

export type ReportRange =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'allTime'
  | 'custom';

export interface ResolvedReportRange {
  id: ReportRange;
  label: string;
  startDate: Date;
  endDate: Date;
  previousStartDate: Date;
  previousEndDate: Date;
}

export interface ReportFilters {
  category?: string;
  productId?: string;
  customerId?: string;
  paymentMethod?: Transaction['paymentMethod'] | 'all';
  type?: Transaction['type'] | 'all';
  search?: string;
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfWeek(date: Date) {
  const base = startOfDay(date);
  const day = base.getDay();
  const offset = day === 0 ? 6 : day - 1;
  base.setDate(base.getDate() - offset);
  return base;
}

function endOfWeek(date: Date) {
  const base = startOfWeek(date);
  base.setDate(base.getDate() + 6);
  return endOfDay(base);
}

function rangeLabel(id: ReportRange, startDate: Date, endDate: Date) {
  const simpleLabels: Record<Exclude<ReportRange, 'custom'>, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    thisWeek: 'This Week',
    lastWeek: 'Last Week',
    last7days: 'Last 7 Days',
    last30days: 'Last 30 Days',
    thisMonth: 'This Month',
    lastMonth: 'Last Month',
    thisYear: 'This Year',
    allTime: 'All Time',
  };

  if (id !== 'custom') return simpleLabels[id];
  const sameDay = startDate.toDateString() === endDate.toDateString();
  const formatter = new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric' });
  return sameDay ? formatter.format(startDate) : `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

export function resolveReportDateRange(
  id: ReportRange,
  customStartDate = new Date(),
  customEndDate = customStartDate
): ResolvedReportRange {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  let startDate = todayStart;
  let endDate = todayEnd;

  if (id === 'yesterday') {
    startDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    endDate = endOfDay(startDate);
  }

  if (id === 'thisWeek') {
    startDate = startOfWeek(now);
    endDate = todayEnd;
  }

  if (id === 'lastWeek') {
    const lastWeekAnchor = new Date(now);
    lastWeekAnchor.setDate(now.getDate() - 7);
    startDate = startOfWeek(lastWeekAnchor);
    endDate = endOfWeek(lastWeekAnchor);
  }

  if (id === 'last7days') {
    startDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    endDate = todayEnd;
  }

  if (id === 'last30days') {
    startDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
    endDate = todayEnd;
  }

  if (id === 'thisMonth') {
    startDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    endDate = todayEnd;
  }

  if (id === 'lastMonth') {
    startDate = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    endDate = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
  }

  if (id === 'thisYear') {
    startDate = startOfDay(new Date(now.getFullYear(), 0, 1));
    endDate = todayEnd;
  }

  if (id === 'allTime') {
    startDate = new Date(0);
    endDate = todayEnd;
  }

  if (id === 'custom') {
    const start = startOfDay(customStartDate);
    const end = endOfDay(customEndDate);
    startDate = start <= end ? start : startOfDay(customEndDate);
    endDate = start <= end ? end : endOfDay(customStartDate);
  }

  const duration = Math.max(1, endDate.getTime() - startDate.getTime());
  const previousEndDate = new Date(startDate.getTime() - 1);
  const previousStartDate = new Date(previousEndDate.getTime() - duration);

  return {
    id,
    label: rangeLabel(id, startDate, endDate),
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
  };
}

export function isActiveTransaction(transaction: Transaction) {
  return !transaction.deletedAt && transaction.status !== 'voided' && transaction.status !== 'reversed';
}

export function transactionMatchesFilters(transaction: Transaction, filters: ReportFilters = {}) {
  if (!isActiveTransaction(transaction)) return false;
  if (filters.type && filters.type !== 'all' && transaction.type !== filters.type) return false;
  if (filters.paymentMethod && filters.paymentMethod !== 'all' && transaction.paymentMethod !== filters.paymentMethod) return false;
  if (filters.category && transaction.category !== filters.category) return false;
  if (filters.productId && !transaction.items?.some((item) => item.productId === filters.productId)) return false;
  if (filters.customerId && transaction.customerId !== filters.customerId) return false;

  if (filters.search?.trim()) {
    const needle = filters.search.trim().toLowerCase();
    const haystack = [
      transaction.localId,
      transaction.type,
      transaction.paymentMethod,
      transaction.category,
      transaction.customer,
      transaction.customerId,
      transaction.note,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  }

  return true;
}

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return roundCurrency(((current - previous) / Math.abs(previous)) * 100);
}

export function safeDivide(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function compareDesc<T>(selector: (item: T) => number) {
  return (a: T, b: T) => selector(b) - selector(a);
}

export function fingerprintRange(range: ResolvedReportRange, filters?: ReportFilters) {
  return JSON.stringify({
    id: range.id,
    startDate: range.startDate.getTime(),
    endDate: range.endDate.getTime(),
    filters,
  });
}
