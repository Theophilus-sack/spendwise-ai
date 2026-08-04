import { CURRENCIES, CATEGORIES } from './constants';
import type { Currency, ExpenseCategory } from './types';

// ─── Currency ─────────────────────────────────────────────────────────────────

export function formatCurrency(amount: number, currency: Currency = 'GHS'): string {
  const { symbol } = CURRENCIES[currency];
  const formatted = amount.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

export function formatCompact(amount: number, currency: Currency = 'GHS'): string {
  const { symbol } = CURRENCIES[currency];
  if (amount >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${symbol}${(amount / 1_000).toFixed(1)}K`;
  return `${symbol}${amount.toFixed(0)}`;
}

// ─── IDs ──────────────────────────────────────────────────────────────────────

/**
 * Generates a client-side v4 UUID. Every user-content table's `id` column is
 * `UUID PRIMARY KEY` — anything else (e.g. a `exp_${Date.now()}_...` string)
 * fails the Postgres insert with "invalid input syntax for type uuid",
 * silently if the caller doesn't check the upsert's `error` field.
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Dates ────────────────────────────────────────────────────────────────────

export function toISODate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toISODate(d);
}

export function startOfMonthISO(date: Date = new Date()): string {
  return toISODate(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function startOfWeekISO(date: Date = new Date()): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return toISODate(d);
}

export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.round(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = todayISO();
  const yesterday = yesterdayISO();
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return date.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });
}

export function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getCurrentMonthDays(): { current: number; total: number } {
  const now = new Date();
  return {
    current: now.getDate(),
    total: getDaysInMonth(now.getFullYear(), now.getMonth() + 1),
  };
}

// ─── Categories ───────────────────────────────────────────────────────────────

export function getCategoryLabel(category: ExpenseCategory): string {
  return CATEGORIES[category]?.label ?? category;
}

export function getCategoryEmoji(category: ExpenseCategory): string {
  return CATEGORIES[category]?.emoji ?? '✨';
}

export function getCategoryColor(category: ExpenseCategory): string {
  return CATEGORIES[category]?.color ?? '#BDC3C7';
}

// ─── Numbers ──────────────────────────────────────────────────────────────────

export function pct(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 10) / 10;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Strings ──────────────────────────────────────────────────────────────────

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, maxLength: number): string {
  return str.length <= maxLength ? str : str.slice(0, maxLength - 1) + '…';
}

// ─── Group & Aggregate ────────────────────────────────────────────────────────

export function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const k = String(item[key]);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function sumBy<T>(items: T[], key: keyof T): number {
  return items.reduce((s, item) => s + (Number(item[key]) || 0), 0);
}

export function sortDesc<T>(items: T[], key: keyof T): T[] {
  return [...items].sort((a, b) => Number(b[key]) - Number(a[key]));
}
