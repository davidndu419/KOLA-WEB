import { ReportsSnapshot } from './reportsService';

function money(value: number) {
  return `NGN ${value.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function transactionBalance(type: string, amount: number) {
  if (type === 'expense' || type === 'reversal') return -amount;
  return amount;
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

  printTransactionHistory(
    snapshot: ReportsSnapshot,
    options?: {
      businessName?: string;
      businessId?: string | null;
    }
  ) {
    const rows = snapshot.transactions.filter((item) => (
      !options?.businessId || item.transaction.business_id === options.businessId
    ));

    if (rows.length === 0) {
      throw new Error('No transactions in the selected period.');
    }

    const totalBalance = rows.reduce((total, item) => (
      total + transactionBalance(item.transaction.type, item.transaction.amount)
    ), 0);

    const popup = window.open('', '_blank', 'width=980,height=720');
    if (!popup) {
      throw new Error('Popup blocked. Please allow popups to print this report.');
    }

    const tableRows = rows.map((item) => {
      const transaction = item.transaction;
      const description = [
        item.title,
        transaction.customer_name,
        transaction.category_name,
        transaction.note,
      ].filter(Boolean).join(' | ');

      return `
        <tr>
          <td>${escapeHtml(transaction.created_at.toLocaleString('en-NG'))}</td>
          <td>${escapeHtml(transaction.type)}</td>
          <td>${escapeHtml(description || transaction.local_id)}</td>
          <td class="amount">${escapeHtml(money(transaction.amount))}</td>
          <td>${escapeHtml([transaction.payment_method, transaction.status].filter(Boolean).join(' / '))}</td>
        </tr>
      `;
    }).join('');

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Transaction History</title>
          <style>
            body { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; margin: 28px; }
            header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 18px; margin-bottom: 22px; }
            h1 { font-size: 26px; margin: 0 0 6px; }
            .business { font-size: 13px; color: #4b5563; font-weight: 700; }
            .muted { color: #6b7280; font-size: 12px; }
            .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 18px 0 24px; }
            .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
            .label { color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; font-weight: 800; }
            .value { font-size: 18px; font-weight: 900; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { text-align: left; border-bottom: 1px solid #e5e7eb; padding: 9px 6px; vertical-align: top; }
            th { color: #4b5563; text-transform: uppercase; font-size: 9px; letter-spacing: .08em; background: #f9fafb; }
            .amount { text-align: right; white-space: nowrap; font-weight: 800; }
            .actions { text-align: right; }
            button { border: 0; border-radius: 10px; background: #10b981; color: white; font-weight: 900; padding: 10px 14px; cursor: pointer; }
            @media print {
              body { margin: 12mm; }
              .actions { display: none; }
              header { break-after: avoid; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          <header>
            <div>
              <h1>Transaction History</h1>
              <div class="business">${escapeHtml(options?.businessName || 'Kola Business')}</div>
              <div class="muted">${escapeHtml(snapshot.range.label)} | Generated ${escapeHtml(new Date().toLocaleString('en-NG'))}</div>
            </div>
            <div class="actions">
              <button onclick="window.print()">Print / Save PDF</button>
            </div>
          </header>

          <section class="summary">
            <div class="card"><div class="label">Selected Range</div><div class="value">${escapeHtml(snapshot.range.label)}</div></div>
            <div class="card"><div class="label">Total Records</div><div class="value">${rows.length}</div></div>
            <div class="card"><div class="label">Total Balance</div><div class="value">${escapeHtml(money(totalBalance))}</div></div>
          </section>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description / Customer</th>
                <th class="amount">Amount</th>
                <th>Payment / Status</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>

          <script>
            window.onload = function () {
              setTimeout(function () {
                try {
                  window.focus();
                  window.print();
                } catch (error) {
                  document.body.insertAdjacentHTML('afterbegin', '<p style="color:#b91c1c;font-weight:800">Print failed. Use the Print / Save PDF button.</p>');
                }
              }, 120);
            };
          </script>
        </body>
      </html>
    `);
    popup.document.close();
    return true;
  },
};
