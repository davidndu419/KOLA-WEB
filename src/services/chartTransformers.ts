import { Transaction } from '@/db/schema';
import { ResolvedReportRange, roundCurrency } from './reportSelectors';

export interface ChartPoint {
  key: string;
  label: string;
  value: number;
  secondaryValue?: number;
  date: Date;
}

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  percentage: number;
  colorClass: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function weekKey(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return dayKey(start);
}

function bucketLabel(date: Date, unit: 'day' | 'week' | 'month') {
  if (unit === 'month') return date.toLocaleDateString('en-NG', { month: 'short' });
  if (unit === 'week') return date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
  return date.toLocaleDateString('en-NG', { weekday: 'short' });
}

function chooseUnit(range: ResolvedReportRange): 'day' | 'week' | 'month' {
  const days = Math.max(1, Math.ceil((range.endDate.getTime() - range.startDate.getTime()) / DAY_MS));
  if (days > 180) return 'month';
  if (days > 45) return 'week';
  return 'day';
}

export function transactionsToRevenueSeries(
  transactions: Transaction[],
  range: ResolvedReportRange
): ChartPoint[] {
  const unit = chooseUnit(range);
  const buckets = new Map<string, ChartPoint>();
  const cursor = new Date(range.startDate);

  while (cursor <= range.endDate) {
    const key = unit === 'month' ? monthKey(cursor) : unit === 'week' ? weekKey(cursor) : dayKey(cursor);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: bucketLabel(cursor, unit),
        value: 0,
        secondaryValue: 0,
        date: new Date(cursor),
      });
    }

    if (unit === 'month') cursor.setMonth(cursor.getMonth() + 1);
    else if (unit === 'week') cursor.setDate(cursor.getDate() + 7);
    else cursor.setDate(cursor.getDate() + 1);
  }

  for (const transaction of transactions) {
    const created_at = new Date(transaction.created_at);
    const key = unit === 'month' ? monthKey(created_at) : unit === 'week' ? weekKey(created_at) : dayKey(created_at);
    const bucket = buckets.get(key);
    if (!bucket) continue;

    if (transaction.type === 'sale' || transaction.type === 'service') {
      bucket.value += transaction.amount;
    }

    if (transaction.type === 'expense') {
      bucket.secondaryValue = (bucket.secondaryValue || 0) + transaction.amount;
    }
  }

  return Array.from(buckets.values()).map((point) => ({
    ...point,
    value: roundCurrency(point.value),
    secondaryValue: roundCurrency(point.secondaryValue || 0),
  }));
}

export function valuesToCompactSeries(values: number[], labels?: string[]): ChartPoint[] {
  return values.map((value, index) => ({
    key: String(index),
    label: labels?.[index] || String(index + 1),
    value,
    date: new Date(),
  }));
}

export function toDonutSegments(
  values: { key: string; label: string; value: number; colorClass: string }[]
): DonutSegment[] {
  const total = values.reduce((sum, item) => sum + item.value, 0);
  return values
    .filter((item) => item.value > 0)
    .map((item) => ({
      ...item,
      percentage: total > 0 ? roundCurrency((item.value / total) * 100) : 0,
    }));
}

export function movingAverage(points: ChartPoint[], windowSize = 3): ChartPoint[] {
  return points.map((point, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const window = points.slice(start, index + 1);
    const average = window.reduce((total, item) => total + item.value, 0) / window.length;
    return { ...point, secondaryValue: roundCurrency(average) };
  });
}
