import { ReportsSnapshot } from './reportsService';

function money(value: number) {
  return `NGN ${value.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function filename(snapshot: ReportsSnapshot, extension: string) {
  const date = new Date().toISOString().slice(0, 10);
  const label = snapshot.range.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `kola-report-${label || 'business'}-${date}.${extension}`;
}

export const exportService = {
  toCsv(snapshot: ReportsSnapshot) {
    const rows: unknown[][] = [
      ['Kola Business Report'],
      ['Period', snapshot.range.label],
      ['Generated', new Date().toLocaleString('en-NG')],
      [],
      ['Summary'],
      ['Metric', 'Value'],
      ['Total revenue', snapshot.summary.totalRevenue],
      ['Total sales', snapshot.summary.totalSales],
      ['Service income', snapshot.summary.totalServiceIncome],
      ['Expenses', snapshot.summary.totalExpenses],
      ['Gross profit', snapshot.summary.grossProfit],
      ['Net profit', snapshot.summary.netProfit],
      ['Inventory value', snapshot.summary.inventoryValue],
      ['Receivables', snapshot.summary.totalReceivables],
      ['Transactions', snapshot.summary.totalTransactions],
      ['Average transaction', snapshot.summary.averageTransactionValue],
      [],
      ['Transactions'],
      ['Date', 'ID', 'Type', 'Title', 'Payment', 'Customer', 'Amount', 'Status', 'Ledger debit', 'Ledger credit'],
      ...snapshot.transactions.map((item) => [
        item.transaction.created_at.toLocaleString('en-NG'),
        item.transaction.local_id,
        item.transaction.type,
        item.title,
        item.transaction.payment_method,
        item.transaction.customer_name || '',
        item.transaction.amount,
        item.transaction.status,
        item.ledgerImpact.debits,
        item.ledgerImpact.credits,
      ]),

    ];

    downloadText(
      filename(snapshot, 'csv'),
      rows.map((row) => row.map(csvEscape).join(',')).join('\n'),
      'text/csv;charset=utf-8'
    );
  },

  print(snapshot: ReportsSnapshot) {
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=420,height=740');
    if (!popup) return;

    const topProducts = snapshot.topSellingProducts
      .map((item) => `<li><strong>${item.name}</strong><span>${item.quantity} sold | ${money(item.revenue)}</span></li>`)
      .join('');
    const transactions = snapshot.transactions
      .slice(0, 80)
      .map(
        (item) => `
          <tr>
            <td>${item.transaction.created_at.toLocaleDateString('en-NG')}</td>
            <td>${item.title}</td>
            <td>${item.transaction.payment_method}</td>
            <td>${money(item.transaction.amount)}</td>
          </tr>
        `
      )
      .join('');

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Kola Business Report</title>
          <style>
            body { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; margin: 24px; }
            h1 { font-size: 24px; margin: 0 0 4px; }
            h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .12em; margin-top: 28px; color: #6b7280; }
            .muted { color: #6b7280; font-size: 12px; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
            .card { border: 1px solid #e5e7eb; border-radius: 16px; padding: 14px; }
            .label { color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: .1em; font-weight: 800; }
            .value { font-size: 20px; font-weight: 800; margin-top: 4px; }
            ul { list-style: none; padding: 0; margin: 0; }
            li { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { text-align: left; border-bottom: 1px solid #f3f4f6; padding: 8px 4px; }
            th { color: #6b7280; text-transform: uppercase; font-size: 10px; letter-spacing: .08em; }
            @media print { button { display: none; } body { margin: 12mm; } }
          </style>
        </head>
        <body>
          <button onclick="window.print()" style="float:right;padding:10px 14px;border-radius:12px;border:0;background:#10b981;color:white;font-weight:800;">Save as PDF</button>
          <h1>Kola Business Report</h1>
          <p class="muted">${snapshot.range.label} | Generated ${new Date().toLocaleString('en-NG')}</p>
          <section class="grid">
            <div class="card"><div class="label">Revenue</div><div class="value">${money(snapshot.summary.totalRevenue)}</div></div>
            <div class="card"><div class="label">Net Profit</div><div class="value">${money(snapshot.summary.netProfit)}</div></div>
            <div class="card"><div class="label">Expenses</div><div class="value">${money(snapshot.summary.totalExpenses)}</div></div>
            <div class="card"><div class="label">Receivables</div><div class="value">${money(snapshot.summary.totalReceivables)}</div></div>
          </section>
          <h2>Top Products</h2>
          <ul>${topProducts || '<li>No product sales in this period</li>'}</ul>
          <h2>Transactions</h2>
          <table>
            <thead><tr><th>Date</th><th>Activity</th><th>Payment</th><th>Amount</th></tr></thead>
            <tbody>${transactions || '<tr><td colspan="4">No transactions in this period</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `);
    popup.document.close();
  },

  toPdf(snapshot: ReportsSnapshot) {
    this.print(snapshot);
  },
};
