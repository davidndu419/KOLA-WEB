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

function cleanUnicodeForPdf(text: unknown): string {
  if (text === null || text === undefined) return '';
  let str = String(text);
  
  // Replace Naira symbol
  str = str.replace(/₦/g, 'NGN ');
  
  // Replace Unicode dashes (em dash, en dash, figure dash, horizontal bar)
  str = str.replace(/[\u2014\u2013\u2012\u2015]/g, '-');
  
  // Replace smart/curly quotes
  str = str.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  
  // Replace other common unicode signs
  str = str.replace(/✓/g, '');
  
  // Strip Accents and Accented character mappings
  let cleanStr = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      cleanStr += str[i];
    } else if (code === 10 || code === 13) {
      cleanStr += str[i];
    } else {
      const char = str[i];
      if ('áàâäãå'.includes(char)) cleanStr += 'a';
      else if ('éèêë'.includes(char)) cleanStr += 'e';
      else if ('íìîï'.includes(char)) cleanStr += 'i';
      else if ('óòôöõ'.includes(char)) cleanStr += 'o';
      else if ('úùûü'.includes(char)) cleanStr += 'u';
      else if ('ç'.includes(char)) cleanStr += 'c';
      else if ('ñ'.includes(char)) cleanStr += 'n';
      else cleanStr += ' ';
    }
  }
  
  return cleanStr.replace(/\s+/g, ' ').trim();
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 13) {
  const clean = cleanUnicodeForPdf(text);
  const lines = doc.splitTextToSize(clean || '-', maxWidth) as string[];
  lines.forEach((line, index) => {
    doc.text(line, x, y + index * lineHeight);
  });
  return y + Math.max(lines.length - 1, 0) * lineHeight;
}

// ─── BRANDED EXPORT HELPERS ──────────────────────────────────────────────

async function getLogoImage(): Promise<HTMLImageElement | null> {
  if (typeof window === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.src = '/logo/kola-logo.png';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
}

function drawPdfBrandedHeader(
  doc: jsPDF,
  title: string,
  businessName: string,
  subtitle: string,
  logoImg: HTMLImageElement | null
) {
  const startY = PAGE.margin;

  // Draw Logo (30x30)
  if (logoImg) {
    try {
      doc.addImage(logoImg, 'PNG', PAGE.margin, startY, 30, 30);
    } catch {
      drawFallbackLogo(doc, PAGE.margin, startY);
    }
  } else {
    drawFallbackLogo(doc, PAGE.margin, startY);
  }

  // Brand Name
  doc.setTextColor(17, 24, 39); // Charcoal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('KOLA', PAGE.margin + 40, startY + 12);

  // Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128); // Gray
  doc.text('OFFLINE-FIRST BUSINESS MANAGER', PAGE.margin + 40, startY + 25);

  // Business Name (Right aligned)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(17, 24, 39);
  doc.text(cleanUnicodeForPdf(businessName), PAGE.width - PAGE.margin, startY + 12, { align: 'right' });

  // Subtitle (Right aligned)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(cleanUnicodeForPdf(subtitle), PAGE.width - PAGE.margin, startY + 25, { align: 'right' });

  // Branded Green Accent Line
  doc.setDrawColor(16, 185, 129); // KOLA green
  doc.setLineWidth(2);
  doc.line(PAGE.margin, startY + 40, PAGE.width - PAGE.margin, startY + 40);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(17, 24, 39);
  doc.text(title, PAGE.margin, startY + 64);

  return startY + 76;
}

function drawFallbackLogo(doc: jsPDF, x: number, y: number) {
  doc.setFillColor(16, 185, 129); // KOLA green
  doc.roundedRect(x, y, 30, 30, 6, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('K', x + 10, y + 20);
}

function drawPdfFooter(doc: jsPDF, pageNum?: number) {
  const y = PAGE.height - 35;
  
  // Thin footer border
  doc.setDrawColor(243, 244, 246);
  doc.setLineWidth(1);
  doc.line(PAGE.margin, y - 10, PAGE.width - PAGE.margin, y - 10);

  // Footer text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175); // gray-400
  doc.text('Powered by KOLA', PAGE.margin, y);
  doc.text('Offline-First Financial & Inventory Management System', PAGE.margin, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(16, 185, 129); // KOLA green
  doc.text('SELL. TRACK. GROW.', PAGE.width - PAGE.margin, y, { align: 'right' });

  if (pageNum !== undefined) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Page ${pageNum}`, PAGE.width - PAGE.margin, y + 10, { align: 'right' });
  }
}

function getBannerStyles(type: string) {
  const t = type?.toLowerCase();
  if (t === 'expense') {
    return { bg: [254, 242, 242], text: [220, 38, 38], border: [252, 165, 165], label: 'EXPENSE RECORDED' };
  }
  if (t === 'reversal') {
    return { bg: [254, 243, 199], text: [217, 119, 6], border: [252, 211, 77], label: 'TRANSACTION REVERSED' };
  }
  if (t === 'correction' || t === 'adjustment') {
    return { bg: [254, 243, 199], text: [217, 119, 6], border: [252, 211, 77], label: 'TRANSACTION CORRECTED' };
  }
  if (t === 'restock') {
    return { bg: [239, 246, 255], text: [37, 99, 235], border: [147, 197, 253], label: 'INVENTORY RESTOCKED' };
  }
  if (t === 'service') {
    return { bg: [240, 253, 250], text: [4, 120, 87], border: [110, 231, 183], label: 'SERVICE RECORDED' };
  }
  return { bg: [240, 253, 250], text: [4, 120, 87], border: [110, 231, 183], label: 'TRANSACTION SUCCESSFUL' };
}

function drawCanvasRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCanvasFallbackLogo(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#10b981';
  drawCanvasRoundedRect(ctx, x, y, 32, 32, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('K', x + 11, y + 21);
}

// ─── RECEIPT DATA BUILDER ────────────────────────────────────────────────

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
  const isRestock = transaction.source_type === 'restock';
  const type = isRestock ? 'restock' : transaction.type;
  
  let title = 'Transaction Receipt';
  let successLabel = 'Transaction Successful';
  let details: ExportDetail[] = [
    { label: 'Receipt No.', value: transaction.local_id },
    { label: 'Date & Time', value: displayDate(transaction.created_at) },
  ];

  if (transaction.payment_method) {
    details.push({ label: 'Payment Method', value: transaction.payment_method.toUpperCase() });
  }
  if (transaction.customer_name) {
    details.push({ label: 'Customer', value: transaction.customer_name });
  }

  let items: ExportLineItem[] = [];

  switch (type) {
    case 'sale':
      title = 'Sales Receipt';
      successLabel = 'Sale Recorded Successfully';
      items = (transaction.items || []).map((item: any) => ({
        name: getItemName(item),
        quantity: getItemQuantity(item),
        unitPrice: getItemUnitPrice(item),
        total: getItemTotal(item),
      }));
      if (items.length === 0) {
        items = [{
          name: transaction.note || 'Items Purchase',
          quantity: 1,
          unitPrice: transaction.amount,
          total: transaction.amount,
        }];
      }
      break;

    case 'service':
      title = 'Service Receipt';
      successLabel = 'Service Recorded Successfully';
      if (transaction.category_name) {
        details.push({ label: 'Category', value: transaction.category_name });
      }
      items = [{
        name: transaction.service_name || transaction.display_title || 'Service Rendered',
        quantity: 1,
        unitPrice: transaction.amount,
        total: transaction.amount,
      }];
      break;

    case 'expense':
      title = 'Expense Receipt';
      successLabel = 'Expense Recorded Successfully';
      if (transaction.category_name) {
        details.push({ label: 'Category', value: transaction.category_name });
      }
      items = [{
        name: transaction.note || 'Business Expense',
        quantity: 1,
        unitPrice: transaction.amount,
        total: transaction.amount,
      }];
      break;

    case 'restock':
      title = 'Restock Confirmation';
      successLabel = 'Inventory Restocked Successfully';
      items = [{
        name: transaction.note || 'Inventory Restock',
        quantity: 1,
        unitPrice: transaction.amount,
        total: transaction.amount,
      }];
      break;

    case 'reversal':
      title = 'Reversal Confirmation';
      successLabel = 'Transaction Reversed';
      items = [{
        name: transaction.note || 'Reversal Adjustment',
        quantity: 1,
        unitPrice: transaction.amount,
        total: transaction.amount,
      }];
      break;

    case 'adjustment':
      title = 'Correction Confirmation';
      successLabel = 'Transaction Corrected';
      items = [{
        name: transaction.note || 'Correction Adjustment',
        quantity: 1,
        unitPrice: transaction.amount,
        total: transaction.amount,
      }];
      break;

    default:
      items = [{
        name: transaction.display_title || transaction.note || 'Transaction',
        quantity: 1,
        unitPrice: transaction.amount,
        total: transaction.amount,
      }];
      break;
  }

  return {
    title,
    businessName: business?.businessName || 'Kola Business',
    businessAddress: business?.businessAddress,
    reference: transaction.local_id,
    date: new Date(transaction.created_at),
    customer: transaction.customer_name,
    transactionType: type,
    paymentMethod: transaction.payment_method,
    total: transaction.amount,
    details,
    items,
    note: transaction.note,
    footer: successLabel,
  };
}

// ─── PREMIUM RECEIPT LAYOUT ──────────────────────────────────────────────

function drawTransactionDocumentPdf(doc: jsPDF, data: TransactionExportDocument, logoImg: HTMLImageElement | null) {
  let y = drawPdfBrandedHeader(
    doc,
    data.title,
    data.businessName,
    `${displayDate(data.date)} | Generated ${displayDate(new Date())}`,
    logoImg
  );

  const addReceiptPageIfNeeded = (currentY: number, needed: number) => {
    if (currentY + needed <= PAGE.height - PAGE.margin - 40) return currentY;
    drawPdfFooter(doc);
    doc.addPage();
    return drawPdfBrandedHeader(
      doc,
      data.title,
      data.businessName,
      `${displayDate(data.date)} | Generated ${displayDate(new Date())}`,
      logoImg
    );
  };

  // Success status badge
  const banner = getBannerStyles(data.transactionType);
  y = addReceiptPageIfNeeded(y, 35);
  doc.setFillColor(banner.bg[0], banner.bg[1], banner.bg[2]);
  doc.setDrawColor(banner.border[0], banner.border[1], banner.border[2]);
  doc.setLineWidth(1);
  doc.roundedRect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, 28, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(banner.text[0], banner.text[1], banner.text[2]);
  doc.text(banner.label, PAGE.margin + 12, y + 17);
  y += 42;

  // GRAND TOTAL CARD (Subtle gray fill with borders)
  y = addReceiptPageIfNeeded(y, 65);
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(243, 244, 246);
  doc.roundedRect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, 54, 8, 8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(107, 114, 128); // gray-500
  doc.setFontSize(8);
  doc.text('GRAND TOTAL', PAGE.margin + 16, y + 18);

  doc.setTextColor(16, 185, 129); // KOLA Green
  doc.setFontSize(22);
  doc.text(money(data.total), PAGE.margin + 16, y + 42);
  y += 68;

  // DETAILS CARD
  if (data.details && data.details.length > 0) {
    const detailsHeight = 16 + data.details.length * 22;
    y = addReceiptPageIfNeeded(y, detailsHeight + 20);
    
    // Draw Details Card Box
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(243, 244, 246);
    doc.roundedRect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, detailsHeight, 8, 8, 'FD');

    // Section title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text('TRANSACTION DETAILS', PAGE.margin + 16, y + 16);

    let detailY = y + 34;
    data.details.forEach((detail) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(detail.label.toUpperCase(), PAGE.margin + 16, detailY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(17, 24, 39);
      doc.text(cleanUnicodeForPdf(detail.value), PAGE.width - PAGE.margin - 16, detailY, { align: 'right' });
      detailY += 22;
    });
    y += detailsHeight + 14;
  }

  // LINE ITEMS
  if (data.items && data.items.length > 0) {
    const itemsHeaderHeight = 24;
    const itemsRowHeight = 28;
    const itemsTotalHeight = itemsHeaderHeight + data.items.length * itemsRowHeight + 10;
    
    y = addReceiptPageIfNeeded(y, itemsTotalHeight + 20);

    // Section Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(data.transactionType === 'sale' ? 'ITEMS SOLD' : 'TRANSACTION ITEMS', PAGE.margin + 6, y);
    y += 10;

    // Table Header Background
    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(243, 244, 246);
    doc.roundedRect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, itemsTotalHeight, 8, 8, 'FD');

    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);
    doc.text('ITEM', PAGE.margin + 12, y + 16);
    doc.text('QTY', 310, y + 16, { align: 'center' });
    doc.text('UNIT PRICE', 390, y + 16, { align: 'right' });
    doc.text('TOTAL', PAGE.width - PAGE.margin - 12, y + 16, { align: 'right' });
    
    let itemY = y + 36;
    data.items.forEach((item) => {
      // Draw horizontal line separator
      doc.setDrawColor(243, 244, 246);
      doc.setLineWidth(1);
      doc.line(PAGE.margin + 12, itemY - 10, PAGE.width - PAGE.margin - 12, itemY - 10);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(17, 24, 39);
      
      const itemNameLines = doc.splitTextToSize(cleanUnicodeForPdf(item.name), 230) as string[];
      doc.text(itemNameLines[0], PAGE.margin + 12, itemY);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(String(item.quantity), 310, itemY, { align: 'center' });
      doc.text(money(item.unitPrice), 390, itemY, { align: 'right' });
      
      doc.setFont('helvetica', 'bold');
      doc.text(money(item.total), PAGE.width - PAGE.margin - 12, itemY, { align: 'right' });
      
      itemY += itemsRowHeight;
    });
    y += itemsTotalHeight + 14;
  }

  // NOTE CARD
  if (data.note) {
    y = addReceiptPageIfNeeded(y, 46);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(243, 244, 246);
    doc.roundedRect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, 42, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(156, 163, 175);
    doc.text('TRANSACTION NOTE', PAGE.margin + 12, y + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    doc.text(cleanUnicodeForPdf(data.note), PAGE.margin + 12, y + 30);
    y += 56;
  }

  // Draw Footer
  drawPdfFooter(doc);
}

// ─── SHARING CANVAS DRAWER ────────────────────────────────────────────────

function drawTransactionCanvas(data: TransactionExportDocument, logoImg: HTMLImageElement | null) {
  const width = 600;
  const scale = 2; // high resolution scaling
  
  // Calculate dynamic height
  let height = 140; // header padding
  
  // Success banner height
  height += 56;
  
  // Grand total card height
  height += 100;
  
  // Details card height
  const detailsHeight = data.details.length > 0 ? 20 + data.details.length * 24 : 0;
  if (detailsHeight > 0) height += detailsHeight + 20;
  
  // Items card height
  const itemsHeight = data.items.length > 0 ? 30 + data.items.length * 36 : 0;
  if (itemsHeight > 0) height += itemsHeight + 24;
  
  // Note height
  if (data.note) height += 80;
  
  // Footer height
  height += 70;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not found');
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Draw border outline
  ctx.strokeStyle = '#f3f4f6';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(6, 6, width - 12, height - 12);

  // 1. Draw Branded Header
  let y = 36;
  if (logoImg) {
    try {
      ctx.drawImage(logoImg, 32, y, 32, 32);
    } catch {
      drawCanvasFallbackLogo(ctx, 32, y);
    }
  } else {
    drawCanvasFallbackLogo(ctx, 32, y);
  }

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('KOLA', 76, y + 15);
  ctx.fillStyle = '#6b7280';
  ctx.font = '500 8.5px sans-serif';
  ctx.fillText('OFFLINE-FIRST BUSINESS MANAGER', 76, y + 27);

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(data.businessName, width - 32, y + 14);
  ctx.fillStyle = '#6b7280';
  ctx.font = '500 8.5px sans-serif';
  ctx.fillText(displayDate(data.date), width - 32, y + 26);
  ctx.textAlign = 'left';

  // Green line
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(32, y + 42);
  ctx.lineTo(width - 32, y + 42);
  ctx.stroke();

  // Document Title
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(data.title, 32, y + 68);
  y += 82;

  // 2. Success Banner
  const banner = getBannerStyles(data.transactionType);
  ctx.fillStyle = `rgb(${banner.bg.join(',')})`;
  ctx.strokeStyle = `rgb(${banner.border.join(',')})`;
  ctx.lineWidth = 1;
  drawCanvasRoundedRect(ctx, 32, y, width - 64, 30, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = `rgb(${banner.text.join(',')})`;
  ctx.font = 'bold 9px sans-serif';
  ctx.fillText(banner.label, 44, y + 18);
  y += 46;

  // 3. Grand Total Card
  ctx.fillStyle = '#fafafa';
  ctx.strokeStyle = '#f3f4f6';
  ctx.lineWidth = 1;
  drawCanvasRoundedRect(ctx, 32, y, width - 64, 58, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#6b7280';
  ctx.font = 'bold 8.5px sans-serif';
  ctx.fillText('GRAND TOTAL', 48, y + 20);

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(money(data.total), 48, y + 46);
  y += 76;

  // 4. Details Card
  if (detailsHeight > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    drawCanvasRoundedRect(ctx, 32, y, width - 64, detailsHeight, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#9ca3af';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('TRANSACTION DETAILS', 48, y + 16);

    let detailY = y + 36;
    data.details.forEach((detail) => {
      ctx.fillStyle = '#6b7280';
      ctx.font = 'bold 8.5px sans-serif';
      ctx.fillText(detail.label.toUpperCase(), 48, detailY);

      ctx.fillStyle = '#111827';
      ctx.font = 'bold 9.5px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(detail.value, width - 48, detailY);
      ctx.textAlign = 'left';
      detailY += 24;
    });
    y += detailsHeight + 20;
  }

  // 5. Line Items Card
  if (itemsHeight > 0) {
    ctx.fillStyle = '#9ca3af';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText(data.transactionType === 'sale' ? 'ITEMS SOLD' : 'TRANSACTION ITEMS', 38, y);
    y += 10;

    ctx.fillStyle = '#fafafa';
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    drawCanvasRoundedRect(ctx, 32, y, width - 64, itemsHeight, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#6b7280';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('ITEM', 44, y + 18);
    ctx.textAlign = 'center';
    ctx.fillText('QTY', 310, y + 18);
    ctx.textAlign = 'right';
    ctx.fillText('UNIT PRICE', 420, y + 18);
    ctx.fillText('TOTAL', width - 44, y + 18);
    ctx.textAlign = 'left';

    let itemY = y + 42;
    data.items.forEach((item) => {
      ctx.strokeStyle = '#f3f4f6';
      ctx.beginPath();
      ctx.moveTo(44, itemY - 14);
      ctx.lineTo(width - 44, itemY - 14);
      ctx.stroke();

      ctx.fillStyle = '#111827';
      ctx.font = 'bold 9.5px sans-serif';
      ctx.fillText(item.name, 44, itemY);

      ctx.font = '500 9.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(item.quantity), 310, itemY);

      ctx.textAlign = 'right';
      ctx.fillText(money(item.unitPrice), 420, itemY);
      
      ctx.font = 'bold 9.5px sans-serif';
      ctx.fillText(money(item.total), width - 44, itemY);
      ctx.textAlign = 'left';

      itemY += 36;
    });
    y += itemsHeight + 20;
  }

  // 6. Note Card
  if (data.note) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    drawCanvasRoundedRect(ctx, 32, y, width - 64, 46, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#9ca3af';
    ctx.font = 'bold 7.5px sans-serif';
    ctx.fillText('TRANSACTION NOTE', 44, y + 15);

    ctx.fillStyle = '#4b5563';
    ctx.font = '500 9px sans-serif';
    ctx.fillText(data.note, 44, y + 30);
    y += 62;
  }

  // 7. Footer
  ctx.strokeStyle = '#f3f4f6';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, y);
  ctx.lineTo(width - 32, y);
  ctx.stroke();

  ctx.fillStyle = '#9ca3af';
  ctx.font = '500 8.5px sans-serif';
  ctx.fillText('Powered by KOLA', 32, y + 18);
  ctx.fillText('Offline-First Financial & Inventory Management System', 32, y + 30);

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 8.5px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('SELL. TRACK. GROW.', width - 32, y + 18);
  ctx.textAlign = 'left';

  return canvas;
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.96));
  if (!blob) throw new Error('Unable to create receipt image.');
  return blob;
}

async function shareDocumentImage(data: TransactionExportDocument, fileName: string): Promise<ShareResult> {
  const logoImg = await getLogoImage();
  const canvas = drawTransactionCanvas(data, logoImg);
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

// ─── EXPORT SERVICE API ──────────────────────────────────────────────────

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

  async downloadTransactionHistoryPdf(
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

    const logoImg = await getLogoImage();
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    
    let y = drawPdfBrandedHeader(
      doc,
      'Transaction History',
      options?.businessName || 'Kola Business',
      `${rangeText} | Generated ${displayDate(new Date())}`,
      logoImg
    );

    let pageNum = 1;
    const addHistoryPageIfNeeded = (currentY: number, needed: number) => {
      if (currentY + needed <= PAGE.height - PAGE.margin - 40) return currentY;
      drawPdfFooter(doc, pageNum);
      doc.addPage();
      pageNum += 1;
      return drawPdfBrandedHeader(
        doc,
        'Transaction History',
        options?.businessName || 'Kola Business',
        `${rangeText} | Generated ${displayDate(new Date())}`,
        logoImg
      );
    };

    // ── SUMMARY CARDS ──
    y = addHistoryPageIfNeeded(y, 60);
    const cardWidth = (PAGE.width - PAGE.margin * 2 - 24) / 3;
    const cardHeight = 46;

    // Card 1: Selected Date Range
    let x = PAGE.margin;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(x, y, cardWidth, cardHeight, 6, 6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text('DATE RANGE', x + 10, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(17, 24, 39);
    addWrappedText(doc, snapshot.range.label, x + 10, y + 31, cardWidth - 20, 10);

    // Card 2: Total Transactions
    x = PAGE.margin + cardWidth + 12;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(x, y, cardWidth, cardHeight, 6, 6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text('TOTAL TRANSACTIONS', x + 10, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);
    doc.text(String(rows.length), x + 10, y + 33);

    // Card 3: Total Balance
    x = PAGE.margin + (cardWidth + 12) * 2;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(x, y, cardWidth, cardHeight, 6, 6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text('TOTAL BALANCE', x + 10, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(16, 185, 129); // Green
    doc.text(money(totalBalance), x + 10, y + 33);

    y += cardHeight + 24;

    // ── TRANSACTION TABLE ──
    y = addHistoryPageIfNeeded(y, 44);

    // Styled Table Header
    doc.setFillColor(16, 185, 129); // KOLA Green
    doc.roundedRect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, 24, 6, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255); // White Text
    doc.text('DATE', PAGE.margin + 12, y + 15);
    doc.text('TYPE', 150, y + 15);
    doc.text('DESCRIPTION', 230, y + 15);
    doc.text('AMOUNT', 438, y + 15, { align: 'right' });
    doc.text('PAYMENT', PAGE.width - PAGE.margin - 12, y + 15, { align: 'right' });
    y += 32;

    const badgeColors: Record<string, { bg: number[]; text: number[] }> = {
      sale: { bg: [240, 253, 250], text: [13, 148, 136] }, // teal
      service: { bg: [238, 242, 255], text: [79, 70, 229] }, // indigo
      expense: { bg: [254, 242, 242], text: [220, 38, 38] }, // red
      restock: { bg: [239, 246, 255], text: [37, 99, 235] }, // blue
      reversal: { bg: [254, 243, 199], text: [217, 119, 6] }, // amber
      correction: { bg: [254, 243, 199], text: [217, 119, 6] }, // amber
    };

    rows.forEach((item) => {
      const transaction = item.transaction;
      const description = [
        item.title,
        transaction.customer_name,
        transaction.category_name,
        transaction.note,
      ].filter(Boolean).join(' | ') || transaction.local_id;

      y = addHistoryPageIfNeeded(y, 40);

      // Render Date
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(75, 85, 99);
      doc.text(displayDate(transaction.created_at).split(',')[0], PAGE.margin + 12, y);

      // Render Type Colored Badge
      const txType = (transaction.type || 'sale').toLowerCase();
      const badge = badgeColors[txType] || badgeColors.sale;
      doc.setFillColor(badge.bg[0], badge.bg[1], badge.bg[2]);
      doc.roundedRect(138, y - 9, 52, 13, 4, 4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(badge.text[0], badge.text[1], badge.text[2]);
      doc.text(txType.toUpperCase(), 164, y, { align: 'center' });

      // Render Description (with wrapping)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(17, 24, 39);
      const descEnd = addWrappedText(doc, description, 230, y, 160, 10);

      // Render Amount (Color coded)
      let amtColor = [17, 24, 39];
      if (txType === 'sale' || txType === 'service') {
        amtColor = [16, 185, 129];
      } else if (txType === 'expense' || transaction.source_type === 'restock') {
        amtColor = [220, 38, 38];
      } else if (txType === 'reversal' || txType === 'correction') {
        amtColor = [217, 119, 6];
      }
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(amtColor[0], amtColor[1], amtColor[2]);
      doc.text(money(transaction.amount), 438, y, { align: 'right' });

      // Render Payment method
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(75, 85, 99);
      doc.text((transaction.payment_method || '-').toUpperCase(), PAGE.width - PAGE.margin - 12, y, { align: 'right' });

      y = Math.max(descEnd, y + 14);
      doc.setDrawColor(243, 244, 246);
      doc.line(PAGE.margin + 12, y, PAGE.width - PAGE.margin - 12, y);
      y += 14;
    });

    drawPdfFooter(doc, pageNum);
    doc.save(`kola-transaction-history-${plainDate(new Date())}.pdf`);
    showToast('PDF downloaded');
  },

  printTransactionHistory(snapshot: ReportsSnapshot, options?: BusinessExportInfo) {
    this.downloadTransactionHistoryPdf(snapshot, options);
    return true;
  },

  async downloadReceiptPdf(transaction: TransactionWithItems, business?: BusinessExportInfo) {
    const data = buildReceiptDocument(transaction, business);
    const logoImg = await getLogoImage();
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    drawTransactionDocumentPdf(doc, data, logoImg);
    doc.save(`kola-receipt-${safeFilename(data.reference)}.pdf`);
    showToast('PDF downloaded');
  },

  async shareReceiptImage(transaction: TransactionWithItems, business?: BusinessExportInfo) {
    const data = buildReceiptDocument(transaction, business);
    return shareDocumentImage(data, `kola-receipt-${safeFilename(data.reference)}.png`);
  },

  downloadTransactionDetailPdf(transaction: Transaction, business?: BusinessExportInfo) {
    this.downloadReceiptPdf(transaction as TransactionWithItems, business);
  },

  async shareTransactionDetailImage(transaction: Transaction, business?: BusinessExportInfo) {
    return this.shareReceiptImage(transaction as TransactionWithItems, business);
  },
};
