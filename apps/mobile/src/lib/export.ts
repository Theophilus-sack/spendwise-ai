import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatCurrency, formatDate, getCategoryLabel } from '@spendwise/shared';
import type { Expense, Currency } from '@spendwise/shared';

function todayStamp(): string {
  return new Date().toISOString().split('T')[0];
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function shareFile(uri: string, mimeType: string, dialogTitle: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle });
  }
}

export async function exportExpensesCSV(expenses: Expense[], rangeLabel: string): Promise<void> {
  const header = ['Date', 'Category', 'Merchant/Description', 'Amount', 'Currency', 'Payment Method', 'Notes'];
  const rows = expenses.map(e => [
    e.date,
    getCategoryLabel(e.category as any),
    e.merchantName ?? e.description ?? '',
    e.amount.toFixed(2),
    e.currency,
    e.paymentMethod,
    e.notes ?? '',
  ]);
  const csv = [header, ...rows].map(row => row.map(v => csvEscape(String(v))).join(',')).join('\n');

  const file = new File(Paths.cache, `SpendWise-Expenses-${todayStamp()}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);

  await shareFile(file.uri, 'text/csv', `Export — ${rangeLabel}`);
}

export async function exportExpensesPDF(expenses: Expense[], currency: Currency, rangeLabel: string): Promise<void> {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const rows = expenses.map(e => `
    <tr>
      <td>${formatDate(e.date)}</td>
      <td>${escapeHtml(getCategoryLabel(e.category as any))}</td>
      <td>${escapeHtml(e.merchantName ?? e.description ?? '—')}</td>
      <td class="amt">${formatCurrency(e.amount, e.currency as any)}</td>
    </tr>`).join('');

  const html = `
  <html><head><meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, Helvetica, sans-serif; padding: 24px; color: #1A1A2E; }
    h1 { font-size: 20px; margin-bottom: 2px; }
    .sub { color: #6B7280; font-size: 12px; margin-bottom: 16px; }
    .total { font-size: 16px; font-weight: 700; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; border-bottom: 2px solid #1A1A2E; padding: 6px 8px; }
    td { border-bottom: 1px solid #E5E7EB; padding: 6px 8px; }
    .amt { text-align: right; }
  </style></head>
  <body>
    <h1>SpendWise AI — Expense Report</h1>
    <div class="sub">${escapeHtml(rangeLabel)} · Generated ${new Date().toLocaleDateString()}</div>
    <div class="total">Total: ${formatCurrency(total, currency)} across ${expenses.length} transaction${expenses.length === 1 ? '' : 's'}</div>
    <table>
      <thead><tr><th>Date</th><th>Category</th><th>Merchant / Description</th><th class="amt">Amount</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">No expenses in this range.</td></tr>'}</tbody>
    </table>
  </body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await shareFile(uri, 'application/pdf', `Export — ${rangeLabel}`);
}
