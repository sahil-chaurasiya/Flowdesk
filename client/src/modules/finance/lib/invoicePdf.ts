import { CompanySettings } from '../types';
import { QR_BASE64, LOGO_BASE64, FOOTER_BANNER_BASE64 } from './invoiceAssets';

// ─── Shared invoice PDF generator ───────────────────────────────────────────
// Single source of truth for the invoice design. Used by:
//   • the Invoice page (manual invoices)
//   • the Client page (one-click "Invoice" download for any month)
// Change the design here and both stay in sync.

export const defaultCompany: CompanySettings = {
  companyName: 'To Fly Media',
  address: 'MANYA ARCADE, ISBT, Narmadapuram Rd, behind Nexa Showroom, Habib Ganj, Bhopal, Madhya Pradesh 462024',
  tagline: "We\'ve got a PERFECT match for your needs #360marketingsolution",
  phone1: '6260154125',
  phone2: '9752523894',
  accountHolder: 'Aman Bhardwaj',
  accountType: 'Current Account',
  accountNumber: '50200077089748',
  ifsc: 'HDFC0003662',
  branch: 'GULMOHOR, BHOPAL',
  upi: '9752523894',
};

export interface InvoiceLineItem {
  name: string;
  description?: string;
  price: number;
  quantity: number;
}

export interface InvoicePdfOptions {
  company: CompanySettings;
  billToName: string;
  invoiceNumber: string;
  invoiceDate: string | Date;
  lineItems: InvoiceLineItem[];
  notes?: string;
  pendingAmount?: number;
}

function loadJsPDF(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).jspdf) { resolve((window as any).jspdf.jsPDF); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => resolve((window as any).jspdf.jsPDF);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/** Builds the invoice PDF and triggers a browser download (Invoice-<number>.pdf). */
export async function generateInvoicePdf(opts: InvoicePdfOptions): Promise<void> {
  const { company, billToName, invoiceNumber, invoiceDate, lineItems } = opts;
  const notes = opts.notes ?? '';
  const pendingAmount = opts.pendingAmount ?? 0;

  const subtotal = lineItems.reduce((s, li) => s + li.price * li.quantity, 0);
  const grandTotal = subtotal + pendingAmount;
  const fmtINR = (n: number) => `Rs.${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const margin = 14;

  // ── Brand palette (pulled straight from the To Fly Media logo) ────
  const BLACK: [number, number, number] = [10, 10, 10];
  const GOLD: [number, number, number] = [212, 175, 35];
  const GOLD_LIGHT: [number, number, number] = [250, 244, 222];
  const INK: [number, number, number] = [20, 20, 20];
  const SLATE: [number, number, number] = [90, 90, 90];
  const HAIRLINE: [number, number, number] = [225, 220, 200];

  // Footer banner keeps its native aspect ratio, full bleed width
  const FOOTER_RATIO = 195 / 787;
  const FOOTER_H = Math.round(W * FOOTER_RATIO * 100) / 100; // ≈ 52mm

  // Draws the footer banner on whichever page is currently active — called
  // whenever a page is finished (either because content overflowed onto a
  // new page, or because we've reached the end of the invoice).
  const drawFooter = () => {
    try {
      doc.addImage(FOOTER_BANNER_BASE64, 'JPEG', 0, H - FOOTER_H, W, FOOTER_H);
    } catch (e) {
      // fall back to a plain dark bar if the banner image fails to load
      doc.setFillColor(...BLACK);
      doc.rect(0, H - 10, W, 10, 'F');
      doc.setFontSize(7);
      doc.setTextColor(...GOLD);
      doc.text(`${company.companyName} — Generated via Tofly Accountant`, margin, H - 4);
    }
  };

  // ── Header bar ──────────────────────────────────────────────────
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, W, 42, 'F');
  // thin gold baseline under the header for a premium edge
  doc.setFillColor(...GOLD);
  doc.rect(0, 42, W, 0.8, 'F');

  // Logo (native aspect ratio, dark background blends into header)
  const logoW = 30;
  const logoH = logoW * (450 / 786);
  try {
    doc.addImage(LOGO_BASE64, 'JPEG', margin, (42 - logoH) / 2, logoW, logoH);
  } catch (e) {
    // silently skip logo if it fails
  }

  // Company name & details (after logo)
  const textX = margin + logoW + 8;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(company.companyName, textX, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(205, 205, 205);
  // Split address if long
  const addrLines = doc.splitTextToSize(company.address, 86);
  addrLines.forEach((line: string, i: number) => {
    doc.text(line, textX, 20 + i * 4);
  });
  const taglY = 20 + addrLines.length * 4;
  doc.setTextColor(...GOLD);
  doc.text(company.tagline, textX, taglY);
  doc.setTextColor(205, 205, 205);
  doc.text(`Ph: ${company.phone1}  |  Office: ${company.phone2}`, textX, taglY + 4);

  // INVOICE label top-right, in gold for a premium accent
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...GOLD);
  doc.text('INVOICE', W - margin, 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(190, 190, 190);
  doc.text('#360marketingsolution', W - margin, 26, { align: 'right' });

  // ── Bill To / Invoice Info ───────────────────────────────────────
  const infoY = 54;
  // small gold accent bars beside section labels (matches brand motif)
  doc.setFillColor(...GOLD);
  doc.rect(margin, infoY - 3, 4, 1, 'F');
  doc.setTextColor(...SLATE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('BILL TO', margin + 6, infoY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(billToName, margin, infoY + 6);

  const col2 = W - margin;
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text('Invoice #', col2 - 40, infoY);
  doc.text('Date', col2 - 40, infoY + 6);
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceNumber, col2, infoY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  const dateObj = new Date(invoiceDate);
  const formattedDate = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(formattedDate, col2, infoY + 6, { align: 'right' });

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(margin, infoY + 14, W - margin, infoY + 14);
  doc.setLineWidth(0.2);

  // ── Table Header ─────────────────────────────────────────────────
  const tableY = infoY + 20;
  doc.setFillColor(...GOLD_LIGHT);
  doc.rect(margin, tableY, W - margin * 2, 9, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(margin, tableY + 9, W - margin, tableY + 9);
  doc.setLineWidth(0.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text('Item', margin + 2, tableY + 6);
  doc.text('Qty', W - margin - 60, tableY + 6, { align: 'right' });
  doc.text('Price', W - margin - 28, tableY + 6, { align: 'right' });
  doc.text('Amount', W - margin, tableY + 6, { align: 'right' });

  // ── Table Rows ────────────────────────────────────────────────────
  let rowY = tableY + 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const descLineH = 3.6;
  const descMaxWidth = (W - margin) - (margin + 2); // full width available for wrapped description text
  // redraws the column header — used when a table continues onto a new page
  const drawTableHeader = (y: number) => {
    doc.setFillColor(...GOLD_LIGHT);
    doc.rect(margin, y, W - margin * 2, 9, 'F');
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(margin, y + 9, W - margin, y + 9);
    doc.setLineWidth(0.2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text('Item', margin + 2, y + 6);
    doc.text('Qty', W - margin - 60, y + 6, { align: 'right' });
    doc.text('Price', W - margin - 28, y + 6, { align: 'right' });
    doc.text('Amount', W - margin, y + 6, { align: 'right' });
  };

  lineItems.forEach((li, idx) => {
    // Break the description into bullet points (one per line the user entered),
    // then wrap each bullet to the available width so nothing gets cut off.
    const descBullets = (li.description || '')
      .split(/\r?\n/)
      .map(line => line.replace(/^[-•]\s*/, '').trim())
      .filter(Boolean);

    const wrappedDescLines: string[] = [];
    descBullets.forEach(bullet => {
      const wrapped = doc.splitTextToSize(`•  ${bullet}`, descMaxWidth);
      wrappedDescLines.push(...wrapped);
    });

    const rowH = wrappedDescLines.length > 0
      ? 9 + wrappedDescLines.length * descLineH
      : 9;

    // If this row would run past the space reserved for totals/payment/footer,
    // continue the table on a fresh page rather than truncating content.
    const bottomLimit = H - FOOTER_H - 55;
    if (rowY + rowH > bottomLimit) {
      doc.addPage();
      rowY = margin;
      drawTableHeader(rowY);
      rowY += 9;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
    }

    const isEven = idx % 2 === 1;
    if (isEven) {
      doc.setFillColor(250, 248, 240);
      doc.rect(margin, rowY, W - margin * 2, rowH, 'F');
    }
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(li.name, margin + 2, rowY + 6);
    if (wrappedDescLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      wrappedDescLines.forEach((line, i) => {
        doc.text(line, margin + 2, rowY + 11 + i * descLineH);
      });
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(String(li.quantity), W - margin - 60, rowY + 6, { align: 'right' });
    doc.text(fmtINR(li.price), W - margin - 28, rowY + 6, { align: 'right' });
    doc.text(fmtINR(li.price * li.quantity), W - margin, rowY + 6, { align: 'right' });
    rowY += rowH;
  });

  doc.setDrawColor(...HAIRLINE);
  doc.line(margin, rowY, W - margin, rowY);
  rowY += 6;

  // ── Totals ────────────────────────────────────────────────────────
  const totalsBlockH = 7 + (pendingAmount > 0 ? 7 : 0) + 4 + 16 + 24; // subtotal → amount-due box
  if (rowY + totalsBlockH > H - 10) {
    doc.addPage();
    rowY = margin;
  }

  const totX = W - margin - 50;
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  doc.text('Subtotal', totX, rowY);
  doc.setTextColor(...INK);
  doc.text(fmtINR(subtotal), W - margin, rowY, { align: 'right' });
  rowY += 7;

  if (pendingAmount > 0) {
    doc.setTextColor(...SLATE);
    doc.text('Pending Amount', totX, rowY);
    doc.setTextColor(...INK);
    doc.text(fmtINR(pendingAmount), W - margin, rowY, { align: 'right' });
    rowY += 7;
  }

  doc.setDrawColor(...HAIRLINE);
  doc.line(totX, rowY, W - margin, rowY);
  rowY += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.text('Total', totX, rowY + 5);
  doc.setTextColor(...INK);
  doc.text(fmtINR(grandTotal), W - margin, rowY + 5, { align: 'right' });
  rowY += 16;

  // Amount Due box — black with a gold frame, gold figure
  doc.setFillColor(...BLACK);
  doc.roundedRect(totX - 4, rowY, W - margin - totX + 8, 16, 2, 2, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.roundedRect(totX - 4, rowY, W - margin - totX + 8, 16, 2, 2, 'S');
  doc.setLineWidth(0.2);
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('AMOUNT DUE', totX, rowY + 5.5);
  doc.setTextColor(...GOLD);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtINR(grandTotal), W - margin - 2, rowY + 11.5, { align: 'right' });
  rowY += 24;

  // ── Notes ─────────────────────────────────────────────────────────
  if (notes.trim()) {
    const noteLines = doc.splitTextToSize(notes, W - margin * 2);
    const noteBlockH = 10 + noteLines.length * 4;
    if (rowY + noteBlockH > H - 10) {
      doc.addPage();
      rowY = margin;
    }
    doc.setTextColor(...SLATE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Notes', margin, rowY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(noteLines, margin, rowY + 5);
    rowY += 10 + noteLines.length * 4;
  }

  // ── Payment Instructions ───────────────────────────────────────────
  // This is always the last section before the footer, so it's the one place
  // that needs to reserve room for the footer banner. Anchor it to sit just
  // above the footer for a full-page look — but only when it fits on the
  // current page without a break; if it had to jump to a fresh page, let it
  // sit naturally right below whatever came before instead of leaving a big
  // empty gap.
  const paymentBlockH = 34;
  if (rowY + paymentBlockH > H - FOOTER_H) {
    doc.addPage();
    rowY = margin;
  } else {
    rowY = Math.max(rowY, H - FOOTER_H - paymentBlockH);
  }
  doc.setDrawColor(...HAIRLINE);
  doc.line(margin, rowY, W - margin, rowY);
  rowY += 7;

  // QR code (scan-to-pay) sits on the left; the text block below is
  // shifted right just enough to clear it, so nothing else moves.
  const qrSize = 24;
  try {
    doc.addImage(QR_BASE64, 'JPEG', margin, rowY - 4, qrSize, qrSize);
  } catch (e) {
    // silently skip QR if it fails to load
  }
  const payTextX = margin + qrSize + 6;

  doc.setFillColor(...GOLD);
  doc.rect(payTextX, rowY - 3.2, 4, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text('Payment Instructions', payTextX + 6, rowY);
  rowY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  const payLines = [
    `${company.companyName} Bank Details`,
    `Account Holder: ${company.accountHolder}  |  Account Type: ${company.accountType}`,
    `Account Number: ${company.accountNumber}  |  IFSC: ${company.ifsc}`,
    `Branch: ${company.branch}  |  UPI: ${company.upi}`,
  ];
  payLines.forEach(line => { doc.text(line, payTextX, rowY); rowY += 4.5; });

  // ── Footer — full-bleed brand banner strip ───────────────────────
  drawFooter();

  doc.save(`Invoice-${invoiceNumber}.pdf`);
}