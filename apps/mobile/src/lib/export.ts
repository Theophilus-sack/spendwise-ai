import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatCurrency, formatDate, getCategoryLabel, groupBy, sumBy, CATEGORIES, PAYMENT_METHODS } from '@spendwise/shared';
import type { Expense, Currency, PaymentMethod } from '@spendwise/shared';

const PAYMENT_METHOD_COLORS: Record<PaymentMethod, string> = {
  mobile_money: '#F5A623',
  card:         '#45B7D1',
  cash:         '#2ECC71',
};

interface ChartSlice { label: string; value: number; color: string }

/** Same stacked-stroked-circle technique as the in-app DonutChart component,
 *  rendered as plain SVG markup so it can be embedded in the print-to-PDF
 *  HTML (which has no access to React Native's SVG renderer). */
function renderDonutSvg(data: ChartSlice[], size = 140, strokeWidth = 22): string {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = size / 2, cy = size / 2;

  if (total <= 0) {
    return `<svg width="${size}" height="${size}"><circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#E5E7EB" stroke-width="${strokeWidth}" /></svg>`;
  }

  let cumulative = 0;
  const circles = data.filter(d => d.value > 0).map(d => {
    const fraction = d.value / total;
    const dash = fraction * circumference;
    const offset = -cumulative * circumference;
    cumulative += fraction;
    return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${d.color}" stroke-width="${strokeWidth}"
      stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${offset}" stroke-linecap="butt" />`;
  }).join('');

  return `<svg width="${size}" height="${size}"><g transform="rotate(-90 ${cx} ${cy})">${circles}</g></svg>`;
}

function renderChartLegend(data: ChartSlice[], currency: Currency): string {
  const total = data.reduce((s, d) => s + d.value, 0);
  const sorted = [...data].filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  return sorted.map(d => `
    <div class="legend-row">
      <span class="swatch" style="background:${d.color}"></span>
      <span class="legend-label">${escapeHtml(d.label)}</span>
      <span class="legend-value">${escapeHtml(formatCurrency(d.value, currency))}</span>
      <span class="legend-pct">${total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
    </div>`).join('');
}

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
      <td>${escapeHtml(PAYMENT_METHODS[e.paymentMethod as PaymentMethod]?.label ?? e.paymentMethod)}</td>
      <td class="amt">${formatCurrency(e.amount, e.currency as any)}</td>
    </tr>`).join('');

  const byCategory: ChartSlice[] = Object.entries(groupBy(expenses, 'category')).map(([category, list]) => ({
    label: getCategoryLabel(category as any),
    value: sumBy(list as Expense[], 'amount'),
    color: CATEGORIES[category as keyof typeof CATEGORIES]?.color ?? '#BDC3C7',
  }));
  const byPaymentMethod: ChartSlice[] = Object.entries(groupBy(expenses, 'paymentMethod')).map(([method, list]) => ({
    label: PAYMENT_METHODS[method as PaymentMethod]?.label ?? method,
    value: sumBy(list as Expense[], 'amount'),
    color: PAYMENT_METHOD_COLORS[method as PaymentMethod] ?? '#BDC3C7',
  }));

  const chartsSection = expenses.length === 0 ? '' : `
    <div class="charts">
      <div class="chart-block">
        <div class="chart-title">Spending by Category</div>
        <div class="chart-row">${renderDonutSvg(byCategory)}<div class="legend">${renderChartLegend(byCategory, currency)}</div></div>
      </div>
      <div class="chart-block">
        <div class="chart-title">Spending by Payment Method</div>
        <div class="chart-row">${renderDonutSvg(byPaymentMethod)}<div class="legend">${renderChartLegend(byPaymentMethod, currency)}</div></div>
      </div>
    </div>`;

  const html = `
  <html><head><meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, Helvetica, sans-serif; padding: 24px; color: #1A1A2E; }
    h1 { font-size: 20px; margin-bottom: 2px; }
    .sub { color: #6B7280; font-size: 12px; margin-bottom: 16px; }
    .total { font-size: 16px; font-weight: 700; margin-bottom: 20px; }
    .charts { display: flex; gap: 24px; margin-bottom: 24px; flex-wrap: wrap; }
    .chart-block { flex: 1; min-width: 220px; }
    .chart-title { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
    .chart-row { display: flex; align-items: center; gap: 16px; }
    .legend { flex: 1; }
    .legend-row { display: flex; align-items: center; gap: 6px; font-size: 11px; margin-bottom: 4px; }
    .swatch { width: 9px; height: 9px; border-radius: 3px; display: inline-block; flex-shrink: 0; }
    .legend-label { flex: 1; color: #1A1A2E; }
    .legend-value { color: #6B7280; }
    .legend-pct { color: #9CA3AF; width: 32px; text-align: right; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; border-bottom: 2px solid #1A1A2E; padding: 6px 8px; }
    td { border-bottom: 1px solid #E5E7EB; padding: 6px 8px; }
    .amt { text-align: right; }
  </style></head>
  <body>
    <h1>SpendWise AI — Expense Report</h1>
    <div class="sub">${escapeHtml(rangeLabel)} · Generated ${new Date().toLocaleDateString()}</div>
    <div class="total">Total: ${formatCurrency(total, currency)} across ${expenses.length} transaction${expenses.length === 1 ? '' : 's'}</div>
    ${chartsSection}
    <table>
      <thead><tr><th>Date</th><th>Category</th><th>Merchant / Description</th><th>Payment Method</th><th class="amt">Amount</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No expenses in this range.</td></tr>'}</tbody>
    </table>
  </body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await shareFile(uri, 'application/pdf', `Export — ${rangeLabel}`);
}
