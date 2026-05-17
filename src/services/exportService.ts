import jsPDF from 'jspdf';
import type { Transaction, TransactionWithItems } from '@/db/schema';
import type { ReportsSnapshot } from './reportsService';

type BusinessExportInfo = {
  businessName?: string;
  businessAddress?: string;
  businessId?: string | null;
};

type ShareResult = {
  shared: boolean;
  downloaded: boolean;
};

type ExportLineItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type ExportDetail = {
  label: string;
  value: string;
};

type TransactionExportDocument = {
  title: string;
  businessName: string;
  businessAddress?: string;
  reference: string;
  date: Date;
  customer?: string;
  transactionType: string;
  paymentMethod?: string;
  total: number;
  details: ExportDetail[];
  items: ExportLineItem[];
  note?: string;
  footer?: string;
};

const PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 40,
};

function money(value: number) {
  return `NGN ${(value || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

function plainDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function displayDate(value: Date | string) {
  return new Date(value).toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function safeText(value: unknown, fallback = '') {
  return String(value ?? fallback);
}

function safeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || 'transaction';
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

function showToast(message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('kola:toast', { detail: { message } }));
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadText(filename: string, content: string, type: string) {
  downloadBlob(filename, new Blob([content], { type }));
}

function filename(snapshot: ReportsSnapshot, extension: string) {
  const date = plainDate(new Date());
  const label = snapshot.range.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `kola-report-${label || 'business'}-${date}.${extension}`;
}

function addPageIfNeeded(doc: jsPDF, y: number, needed = 28) {
  if (y + needed <= PAGE.height - PAGE.margin) return y;
  doc.addPage();
  return PAGE.margin;
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 13) {
  const lines = doc.splitTextToSize(text || '-', maxWidth) as string[];
  lines.forEach((line, index) => {
    doc.text(line, x, y + index * lineHeight);
  });
  return y + Math.max(lines.length, 1) * lineHeight;
}

function drawPdfHeader(doc: jsPDF, title: string, businessName: string, subtitle?: string) {
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text(title, PAGE.margin, PAGE.margin);

  doc.setFontSize(11);
  doc.text(businessName, PAGE.margin, PAGE.margin + 20);

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(subtitle, PAGE.margin, PAGE.margin + 36);
  }

  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(1.4);
  doc.line(PAGE.margin, PAGE.margin + 50, PAGE.width - PAGE.margin, PAGE.margin + 50);
  return PAGE.margin + 76;
}

function drawLabelValue(doc: jsPDF, label: string, value: string, x: number, y: number, width: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(label.toUpperCase(), x, y);
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  return addWrappedText(doc, value, x, y + 15, width, 13);
}

function drawTransactionDocumentPdf(doc: jsPDF, data: TransactionExportDocument) {
  let y = drawPdfHeader(
    doc,
    data.title,
    data.businessName,
    `${displayDate(data.date)} | Generated ${displayDate(new Date())}`
  );

  const colWidth = (PAGE.width - PAGE.margin * 2 - 16) / 2;
  y = Math.max(
    drawLabelValue(doc, 'Reference', data.reference, PAGE.margin, y, colWidth),
    drawLabelValue(doc, 'Payment', data.paymentMethod || '-', PAGE.margin + colWidth + 16, y, colWidth)
  ) + 10;

  if (data.customer || data.businessAddress) {
    y = Math.max(
      drawLabelValue(doc, 'Customer', data.customer || '-', PAGE.margin, y, colWidth),
      drawLabelValue(doc, 'Business address', data.businessAddress || '-', PAGE.margin + colWidth + 16, y, colWidth)
    ) + 10;
  }

  doc.setFillColor(249, 250, 251);
  doc.roundedRect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, 50, 6, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(8);
  doc.text('GRAND TOTAL', PAGE.margin + 14, y + 18);
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(22);
  doc.text(money(data.total), PAGE.margin + 14, y + 40);
  y += 74;

  if (data.details.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Details', PAGE.margin, y);
    y += 18;
    data.details.forEach((detail) => {
      y = addPageIfNeeded(doc, y, 32);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(detail.label.toUpperCase(), PAGE.margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(17, 24, 39);
      y = addWrappedText(doc, detail.value, PAGE.margin + 120, y, PAGE.width - PAGE.margin * 2 - 120, 12) + 8;
    });
  }

  if (data.items.length > 0) {
    y = addPageIfNeeded(doc, y + 8, 44);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.text(data.transactionType === 'sale' ? 'Items Sold' : 'Line Items', PAGE.margin, y);
    y += 18;

    doc.setFillColor(249, 250, 251);
    doc.rect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, 22, 'F');
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text('ITEM', PAGE.margin + 8, y + 14);
    doc.text('QTY', 310, y + 14);
    doc.text('UNIT PRICE', 360, y + 14);
    doc.text('TOTAL', 480, y + 14);
    y += 28;

    data.items.forEach((item) => {
      y = addPageIfNeeded(doc, y, 34);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(17, 24, 39);
      const nextY = addWrappedText(doc, item.name, PAGE.margin + 8, y, 245, 12);
      doc.text(String(item.quantity), 310, y);
      doc.text(money(item.unitPrice), 360, y);
      doc.text(money(item.total), 480, y);
      doc.setDrawColor(229, 231, 235);
      y = Math.max(nextY, y + 18);
      doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
      y += 9;
    });
  }

  if (data.note) {
    y = addPageIfNeeded(doc, y + 8, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('NOTE', PAGE.margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    y = addWrappedText(doc, data.note, PAGE.margin, y + 14, PAGE.width - PAGE.margin * 2, 12);
  }

  if (data.footer) {
    y = addPageIfNeeded(doc, y + 20, 24);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(data.footer, PAGE.margin, y);
  }
}

function getItemQuantity(item: any) {
  return Number(item?.quantity || 0) || 1;
}

function getItemUnitPrice(item: any) {
  const quantity = getItemQuantity(item);
  return Number(item?.unit_price ?? item?.price ?? ((item?.total_price || 0) / quantity)) || 0;
}

function getItemTotal(item: any) {
  const quantity = getItemQuantity(item);
  const unitPrice = getItemUnitPrice(item);
  return Number(item?.total_price ?? item?.total ?? unitPrice * quantity) || 0;
}

function getItemName(item: any) {
  return safeText(item?.name || item?.product_name || item?.product_id, 'Product');
}

function buildReceiptDocument(transaction: TransactionWithItems, business?: BusinessExportInfo): TransactionExportDocument {
  const items = (transaction.items || []).map((item: any) => ({
    name: getItemName(item),
    quantity: getItemQuantity(item),
    unitPrice: getItemUnitPrice(item),
    total: getItemTotal(item),
  }));

  return {
    title: 'Sales Receipt',
    businessName: business?.businessName || 'Kola Business',
    businessAddress: business?.businessAddress,
    reference: transaction.local_id,
    date: new Date(transaction.created_at),
    customer: transaction.customer_name,
    transactionType: 'sale',
    paymentMethod: transaction.payment_method,
    total: transaction.amount,
    details: [
      { label: 'Receipt number', value: transaction.local_id },
      { label: 'Date/time', value: displayDate(transaction.created_at) },
      { label: 'Payment method', value: transaction.payment_method },
    ],
    items: items.length > 0
      ? items
      : [{ name: transaction.note || 'Sale', quantity: 1, unitPrice: transaction.amount, total: transaction.amount }],
    note: transaction.note,
    footer: 'Thank you for your business.',
  };
}

function buildTransactionDetailDocument(transaction: TransactionWithItems, business?: BusinessExportInfo): TransactionExportDocument {
  const isRestock = transaction.source_type === 'restock';
  const typeLabel = isRestock ? 'restock' : transaction.type;
  const details: ExportDetail[] = [
    { label: 'Type', value: typeLabel },
    { label: 'Status', value: transaction.status },
    { label: 'Date/time', value: displayDate(transaction.created_at) },
    { label: 'Payment method', value: transaction.payment_method },
  ];

  if (transaction.customer_name) details.push({ label: 'Customer', value: transaction.customer_name });
  if (isRestock) details.push({ label: 'Category', value: 'Inventory Purchase' });
  if (!isRestock && transaction.category_name) details.push({ label: 'Category', value: transaction.category_name });
  if (transaction.service_name) details.push({ label: 'Service', value: transaction.service_name });
  if (transaction.note) details.push({ label: 'Details', value: transaction.note });

  const saleItems = transaction.type === 'sale'
    ? (transaction.items || []).map((item: any) => ({
      name: getItemName(item),
      quantity: getItemQuantity(item),
      unitPrice: getItemUnitPrice(item),
      total: getItemTotal(item),
    }))
    : [];

  const fallbackName = transaction.service_name
    || transaction.category_name
    || (isRestock ? 'Inventory Purchase' : transaction.display_title)
    || typeLabel;

  return {
    title: 'Transaction Detail',
    businessName: business?.businessName || 'Kola Business',
    businessAddress: business?.businessAddress,
    reference: transaction.local_id,
    date: new Date(transaction.created_at),
    customer: transaction.customer_name,
    transactionType: typeLabel,
    paymentMethod: transaction.payment_method,
    total: transaction.amount,
    details,
    items: saleItems.length > 0
      ? saleItems
      : [{ name: fallbackName, quantity: 1, unitPrice: transaction.amount, total: transaction.amount }],
    note: transaction.note,
  };
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  });

  if (current) lines.push(current);
  return lines.length > 0 ? lines : ['-'];
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.96));
  if (!blob) throw new Error('Unable to create receipt image.');
  return blob;
}

function drawTransactionCanvas(data: TransactionExportDocument) {
  const width = 900;
  const scale = 2;
  const rowHeight = 68;
  const detailHeight = data.details.reduce((total, detail) => total + 44 + Math.max(0, Math.ceil(detail.value.length / 42) - 1) * 24, 0);
  const height = Math.max(940, 500 + detailHeight + data.items.length * rowHeight + (data.note ? 90 : 0));
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available.');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(46, 42, width - 92, height - 84);
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 2;
  ctx.strokeRect(46, 42, width - 92, height - 84);

  let y = 100;
  ctx.fillStyle = '#111827';
  ctx.font = '700 34px Arial';
  ctx.fillText(data.businessName, 84, y);
  y += 34;
  if (data.businessAddress) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '700 18px Arial';
    wrapCanvasText(ctx, data.businessAddress, width - 168).forEach((line) => {
      ctx.fillText(line, 84, y);
      y += 24;
    });
  }

  y += 18;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(84, y);
  ctx.lineTo(width - 84, y);
  ctx.stroke();
  y += 52;

  ctx.fillStyle = '#111827';
  ctx.font = '700 42px Arial';
  ctx.fillText(data.title, 84, y);
  y += 34;
  ctx.fillStyle = '#6b7280';
  ctx.font = '700 18px Arial';
  ctx.fillText(`Ref: ${data.reference}`, 84, y);
  y += 28;
  ctx.fillText(displayDate(data.date), 84, y);
  y += 46;

  ctx.fillStyle = '#ecfdf5';
  ctx.fillRect(84, y, width - 168, 100);
  ctx.fillStyle = '#047857';
  ctx.font = '700 18px Arial';
  ctx.fillText('GRAND TOTAL', 112, y + 34);
  ctx.fillStyle = '#064e3b';
  ctx.font = '700 42px Arial';
  ctx.fillText(money(data.total), 112, y + 78);
  y += 138;

  ctx.fillStyle = '#111827';
  ctx.font = '700 22px Arial';
  ctx.fillText('Details', 84, y);
  y += 34;

  data.details.forEach((detail) => {
    ctx.fillStyle = '#6b7280';
    ctx.font = '700 15px Arial';
    ctx.fillText(detail.label.toUpperCase(), 84, y);
    ctx.fillStyle = '#111827';
    ctx.font = '700 20px Arial';
    const lines = wrapCanvasText(ctx, detail.value, width - 360);
    lines.forEach((line, index) => {
      ctx.fillText(line, 310, y + index * 24);
    });
    y += Math.max(44, lines.length * 24 + 14);
  });

  y += 16;
  ctx.fillStyle = '#111827';
  ctx.font = '700 22px Arial';
  ctx.fillText(data.transactionType === 'sale' ? 'Items Sold' : 'Line Items', 84, y);
  y += 32;

  data.items.forEach((item) => {
    ctx.strokeStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.moveTo(84, y - 12);
    ctx.lineTo(width - 84, y - 12);
    ctx.stroke();

    ctx.fillStyle = '#111827';
    ctx.font = '700 20px Arial';
    const lines = wrapCanvasText(ctx, item.name, 330);
    ctx.fillText(lines[0], 84, y + 12);
    ctx.fillStyle = '#6b7280';
    ctx.font = '700 16px Arial';
    ctx.fillText(`${item.quantity} x ${money(item.unitPrice)}`, 84, y + 38);
    ctx.fillStyle = '#111827';
    ctx.font = '700 21px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(money(item.total), width - 84, y + 24);
    ctx.textAlign = 'left';
    y += rowHeight + Math.max(0, lines.length - 1) * 22;
  });

  if (data.note) {
    y += 12;
    ctx.fillStyle = '#6b7280';
    ctx.font = '700 15px Arial';
    ctx.fillText('NOTE', 84, y);
    y += 26;
    ctx.fillStyle = '#111827';
    ctx.font = '600 18px Arial';
    wrapCanvasText(ctx, data.note, width - 168).forEach((line) => {
      ctx.fillText(line, 84, y);
      y += 24;
    });
  }

  ctx.fillStyle = '#6b7280';
  ctx.font = '600 16px Arial';
  ctx.fillText(`Generated ${displayDate(new Date())}`, 84, height - 72);
  return canvas;
}

async function shareDocumentImage(data: TransactionExportDocument, fileName: string): Promise<ShareResult> {
  const canvas = drawTransactionCanvas(data);
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], fileName, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };

  if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
    await nav.share({
      title: data.title,
      text: `${data.title} ${data.reference}`,
      files: [file],
    });
    return { shared: true, downloaded: false };
  }

  downloadBlob(fileName, blob);
  showToast('Share not supported, image downloaded instead');
  return { shared: false, downloaded: true };
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
            .muted { color: #6b7280; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 18px; }
            th, td { text-align: left; border-bottom: 1px solid #f3f4f6; padding: 8px 4px; }
            th { color: #6b7280; text-transform: uppercase; font-size: 10px; letter-spacing: .08em; }
            @media print { button { display: none; } body { margin: 12mm; } }
          </style>
        </head>
        <body>
          <button onclick="window.print()" style="float:right;padding:10px 14px;border-radius:12px;border:0;background:#10b981;color:white;font-weight:800;">Print</button>
          <h1>Kola Business Report</h1>
          <p class="muted">${snapshot.range.label} | Generated ${new Date().toLocaleString('en-NG')}</p>
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
    this.downloadTransactionHistoryPdf(snapshot);
  },

  downloadTransactionHistoryPdf(
    snapshot: ReportsSnapshot,
    options?: BusinessExportInfo
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
    const rangeText = `${snapshot.range.label} (${snapshot.range.startDate.toLocaleDateString('en-NG')} - ${snapshot.range.endDate.toLocaleDateString('en-NG')})`;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = drawPdfHeader(
      doc,
      'Transaction History',
      options?.businessName || 'Kola Business',
      `${rangeText} | Generated ${displayDate(new Date())}`
    );

    const cardWidth = (PAGE.width - PAGE.margin * 2 - 24) / 3;
    [
      ['Selected Range', rangeText],
      ['Total Records', String(rows.length)],
      ['Total Balance', money(totalBalance)],
    ].forEach(([label, value], index) => {
      const x = PAGE.margin + index * (cardWidth + 12);
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(x, y, cardWidth, 50, 6, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(107, 114, 128);
      doc.text(label.toUpperCase(), x + 10, y + 17);
      doc.setFontSize(11);
      doc.setTextColor(17, 24, 39);
      addWrappedText(doc, value, x + 10, y + 35, cardWidth - 20, 11);
    });
    y += 78;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.setFillColor(249, 250, 251);
    doc.rect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, 22, 'F');
    doc.text('DATE', PAGE.margin + 6, y + 14);
    doc.text('TYPE', 145, y + 14);
    doc.text('DESCRIPTION', 220, y + 14);
    doc.text('AMOUNT', 438, y + 14);
    doc.text('PAYMENT', 510, y + 14);
    y += 30;

    rows.forEach((item) => {
      const transaction = item.transaction;
      const description = [
        item.title,
        transaction.customer_name,
        transaction.category_name,
        transaction.note,
      ].filter(Boolean).join(' | ') || transaction.local_id;

      y = addPageIfNeeded(doc, y, 46);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(17, 24, 39);
      doc.text(displayDate(transaction.created_at), PAGE.margin + 6, y);
      doc.text(transaction.type, 145, y);
      const descEnd = addWrappedText(doc, description, 220, y, 205, 10);
      doc.text(money(transaction.amount), 438, y);
      doc.text(transaction.payment_method || '-', 510, y);
      y = Math.max(descEnd, y + 16);
      doc.setDrawColor(229, 231, 235);
      doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
      y += 9;
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated ${displayDate(new Date())}`, PAGE.margin, PAGE.height - 24);
    doc.save(`kola-transaction-history-${plainDate(new Date())}.pdf`);
    showToast('PDF downloaded');
  },

  printTransactionHistory(snapshot: ReportsSnapshot, options?: BusinessExportInfo) {
    this.downloadTransactionHistoryPdf(snapshot, options);
    return true;
  },

  downloadReceiptPdf(transaction: TransactionWithItems, business?: BusinessExportInfo) {
    const data = buildReceiptDocument(transaction, business);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    drawTransactionDocumentPdf(doc, data);
    doc.save(`kola-receipt-${safeFilename(data.reference)}.pdf`);
    showToast('PDF downloaded');
  },

  async shareReceiptImage(transaction: TransactionWithItems, business?: BusinessExportInfo) {
    const data = buildReceiptDocument(transaction, business);
    return shareDocumentImage(data, `kola-receipt-${safeFilename(data.reference)}.png`);
  },

  downloadTransactionDetailPdf(transaction: Transaction, business?: BusinessExportInfo) {
    const data = buildTransactionDetailDocument(transaction as TransactionWithItems, business);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    drawTransactionDocumentPdf(doc, data);
    doc.save(`kola-transaction-${safeFilename(data.reference)}.pdf`);
    showToast('PDF downloaded');
  },

  async shareTransactionDetailImage(transaction: Transaction, business?: BusinessExportInfo) {
    const data = buildTransactionDetailDocument(transaction as TransactionWithItems, business);
    return shareDocumentImage(data, `kola-transaction-${safeFilename(data.reference)}.png`);
  },
};
