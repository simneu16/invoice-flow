import jsPDF from "jspdf";
import type { InvoiceWithItems } from "@/hooks/use-invoices";
import type { CompanySettings } from "@/hooks/use-company-settings";
import { supabase } from "@/integrations/supabase/client";

const statusLabels: Record<string, string> = {
  draft: "Koncept",
  sent: "Odoslaná",
  paid: "Zaplatená",
  overdue: "Po splatnosti",
  cancelled: "Zrušená",
};

// App design tokens → RGB
const colors = {
  primary: [37, 99, 235] as [number, number, number],
  foreground: [20, 25, 32] as [number, number, number],
  muted: [100, 110, 130] as [number, number, number],
  border: [225, 228, 234] as [number, number, number],
  background: [243, 245, 248] as [number, number, number],
  card: [255, 255, 255] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("sk-SK");
}

function fmtCurrency(n: number, currency: string) {
  return Number(n).toLocaleString("sk-SK", { style: "currency", currency });
}

function drawCard(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(...colors.card);
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 3, 3, "FD");
}

function fillPageBg(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFillColor(...colors.background);
  doc.rect(0, 0, pw, ph, "F");
}

async function loadFontAsBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Load Montserrat Regular + Bold and register in jsPDF */
async function registerMontserrat(doc: jsPDF) {
  const [regularB64, boldB64] = await Promise.all([
    loadFontAsBase64("/fonts/Montserrat-Regular.ttf"),
    loadFontAsBase64("/fonts/Montserrat-Bold.ttf"),
  ]);

  doc.addFileToVFS("Montserrat-Regular.ttf", regularB64);
  doc.addFont("Montserrat-Regular.ttf", "Montserrat", "normal");

  doc.addFileToVFS("Montserrat-Bold.ttf", boldB64);
  doc.addFont("Montserrat-Bold.ttf", "Montserrat", "bold");
}

export async function generateInvoicePDF(
  invoice: InvoiceWithItems,
  company: CompanySettings | null
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Register & set Montserrat as default font
  await registerMontserrat(doc);
  doc.setFont("Montserrat", "normal");

  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 14;
  const cardPad = 6;
  const innerLeft = margin + cardPad;
  const cardW = pw - 2 * margin;
  const innerRight = margin + cardW - cardPad;
  let y = 14;

  fillPageBg(doc);

  // ──────────── HEADER CARD ────────────
  const headerCardY = y;
  let headerContentH = 0;
  const headerStartY = y + cardPad;
  let hy = headerStartY;

  let logoEndY = hy;
  let logoImg: HTMLImageElement | null = null;
  let logoW = 0;
  let logoH = 0;

  if (company?.logo_url) {
    try {
      logoImg = await loadImage(company.logo_url);
      const ratio = logoImg.width / logoImg.height;
      logoH = 9;
      logoW = Math.min(logoH * ratio, 28);
      logoEndY = hy + logoH + 4;
    } catch {
      // skip
    }
  }

  let companyTextY = logoImg ? logoEndY : hy;
  const companyLines: string[] = [];
  if (company?.company_name) companyLines.push(company.company_name);
  if (company?.address) companyLines.push(company.address);
  if (company?.postal_code || company?.city)
    companyLines.push([company?.postal_code, company?.city].filter(Boolean).join(" "));
  if (company?.ico) companyLines.push(`IČO: ${company.ico}`);
  if (company?.dic) companyLines.push(`DIČ: ${company.dic}`);
  if (company?.ic_dph) companyLines.push(`IČ DPH: ${company.ic_dph}`);

  const companyBlockH = companyLines.length * 3.8;
  const leftBlockH = (logoImg ? logoH + 2 : 0) + companyBlockH;
  const rightBlockH = 18;
  headerContentH = Math.max(leftBlockH, rightBlockH) + cardPad * 2;

  drawCard(doc, margin, headerCardY, cardW, headerContentH);

  if (logoImg) {
    doc.addImage(logoImg, "PNG", innerLeft, hy, logoW, logoH);
  }

  let cly = companyTextY;
  for (let i = 0; i < companyLines.length; i++) {
    if (i === 0) {
      doc.setFontSize(10);
      doc.setFont("Montserrat", "bold");
      doc.setTextColor(...colors.foreground);
    } else if (i === 1) {
      doc.setFontSize(7.5);
      doc.setFont("Montserrat", "normal");
      doc.setTextColor(...colors.muted);
    }
    doc.text(companyLines[i], innerLeft, cly);
    cly += i === 0 ? 4.5 : 3.5;
  }

  // Right: FAKTÚRA title + number
  doc.setFontSize(24);
  doc.setFont("Montserrat", "bold");
  doc.setTextColor(...colors.primary);
  doc.text("FAKTÚRA", innerRight, headerStartY + 5, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("Montserrat", "normal");
  doc.setTextColor(...colors.muted);
  doc.text(invoice.invoice_number, innerRight, headerStartY + 10, { align: "right" });


  y = headerCardY + headerContentH + 4;

  // ──────────── TWO-COLUMN CARDS ────────────
  const halfW = (cardW - 4) / 2;
  const leftCardX = margin;
  const rightCardX = margin + halfW + 4;

  const detailsData = [
    ["Dátum vystavenia", fmtDate(invoice.issue_date)],
    ["Dátum splatnosti", fmtDate(invoice.due_date)],
    ["Mena", invoice.currency],
  ];
  const detailCardH = 8 + detailsData.length * 5.5 + 4;

  const clientLines: string[] = [invoice.client_name];
  if (invoice.client_address) clientLines.push(invoice.client_address);
  if (invoice.client_ico) clientLines.push(`IČO: ${invoice.client_ico}`);
  if (invoice.client_dic) clientLines.push(`DIČ: ${invoice.client_dic}`);
  if (invoice.client_ic_dph) clientLines.push(`IČ DPH: ${invoice.client_ic_dph}`);
  if (invoice.client_email) clientLines.push(invoice.client_email);
  const clientCardH = 8 + clientLines.length * 4.2 + 4;

  const twoColH = Math.max(detailCardH, clientCardH);
  drawCard(doc, leftCardX, y, halfW, twoColH);
  drawCard(doc, rightCardX, y, halfW, twoColH);

  // Left card
  let dy = y + 6;
  doc.setFontSize(7);
  doc.setFont("Montserrat", "bold");
  doc.setTextColor(...colors.primary);
  doc.text("DETAILY FAKTÚRY", leftCardX + cardPad, dy);
  dy += 5.5;

  doc.setFontSize(8);
  doc.setFont("Montserrat", "normal");
  for (const [label, value] of detailsData) {
    doc.setTextColor(...colors.muted);
    doc.text(label, leftCardX + cardPad, dy);
    doc.setTextColor(...colors.foreground);
    doc.setFont("Montserrat", "bold");
    doc.text(value, leftCardX + cardPad + 35, dy);
    doc.setFont("Montserrat", "normal");
    dy += 5.5;
  }

  // Right card
  let cy = y + 6;
  doc.setFontSize(7);
  doc.setFont("Montserrat", "bold");
  doc.setTextColor(...colors.primary);
  doc.text("ODBERATEĽ", rightCardX + cardPad, cy);
  cy += 5.5;

  doc.setFontSize(8);
  for (let i = 0; i < clientLines.length; i++) {
    if (i === 0) {
      doc.setFont("Montserrat", "bold");
      doc.setTextColor(...colors.foreground);
    } else {
      doc.setFont("Montserrat", "normal");
      doc.setTextColor(...colors.muted);
    }
    doc.text(clientLines[i], rightCardX + cardPad, cy);
    cy += 4.2;
  }

  y += twoColH + 4;

  // ──────────── ITEMS CARD ────────────
  const colDesc = margin + cardPad + 2;
  const colQty = 115;
  const colPrice = 140;
  const colTotal = innerRight;

  const rowH = 6;
  const tableHeaderH = 8;
  const itemsContentH = tableHeaderH + invoice.invoice_items.length * rowH + 6;
  const totalsH = 14;
  const itemsCardH = 6 + itemsContentH + totalsH + 6;

  drawCard(doc, margin, y, cardW, itemsCardH);

  let iy = y + 6;
  doc.setFontSize(7);
  doc.setFont("Montserrat", "bold");
  doc.setTextColor(...colors.primary);
  doc.text("POLOŽKY", innerLeft, iy);
  iy += 5;

  // Table header
  doc.setFillColor(...colors.background);
  doc.roundedRect(innerLeft - 2, iy - 3.5, cardW - cardPad * 2 + 4, 7, 1.5, 1.5, "F");
  doc.setFontSize(7.5);
  doc.setFont("Montserrat", "bold");
  doc.setTextColor(...colors.muted);
  doc.text("Popis", colDesc, iy);
  doc.text("Mn.", colQty, iy);
  doc.text("Cena/ks", colPrice, iy);
  doc.text("Celkom", colTotal, iy, { align: "right" });
  iy += tableHeaderH;

  // Rows
  doc.setFont("Montserrat", "normal");
  for (let idx = 0; idx < invoice.invoice_items.length; idx++) {
    const item = invoice.invoice_items[idx];
    if (idx % 2 === 1) {
      doc.setFillColor(...colors.background);
      doc.rect(innerLeft - 2, iy - 3.5, cardW - cardPad * 2 + 4, rowH, "F");
    }
    doc.setFontSize(8);
    doc.setTextColor(...colors.foreground);
    doc.text(item.description.substring(0, 50), colDesc, iy);
    doc.setTextColor(...colors.muted);
    doc.text(String(item.quantity), colQty, iy);
    doc.text(fmtCurrency(item.unit_price, invoice.currency), colPrice, iy);
    doc.setTextColor(...colors.foreground);
    doc.setFont("Montserrat", "bold");
    doc.text(fmtCurrency(item.total, invoice.currency), colTotal, iy, { align: "right" });
    doc.setFont("Montserrat", "normal");
    iy += rowH;
  }

  // Separator
  iy += 3;
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.3);
  doc.line(innerLeft, iy, innerRight, iy);
  iy += 5;

  // Totals
  const totalsLabelX = innerRight - 50;

  // Total highlight
  doc.setFillColor(...colors.primary);
  doc.roundedRect(totalsLabelX - 4, iy - 4, innerRight - totalsLabelX + 8, 9, 2, 2, "F");
  doc.setFontSize(10);
  doc.setFont("Montserrat", "bold");
  doc.setTextColor(...colors.white);
  doc.text("Celkom:", totalsLabelX, iy + 1);
  doc.text(fmtCurrency(invoice.total, invoice.currency), innerRight, iy + 1, { align: "right" });

  y += itemsCardH + 4;

  // ──────────── BANK DETAILS CARD ────────────
  if (company?.iban) {
    const bankLines = 2 + (company.bank_name ? 1 : 0) + (company.swift ? 1 : 0);
    const qrSize = 35;
    const bankTextH = 8 + bankLines * 5 + 6;
    const bankCardH = Math.max(bankTextH, qrSize + 16);
    drawCard(doc, margin, y, cardW, bankCardH);

    let by = y + 6;
    doc.setFontSize(7);
    doc.setFont("Montserrat", "bold");
    doc.setTextColor(...colors.primary);
    doc.text("BANKOVÉ ÚDAJE", innerLeft, by);
    by += 5.5;

    doc.setFontSize(8);
    doc.setFont("Montserrat", "normal");

    if (company.bank_name) {
      doc.setTextColor(...colors.muted);
      doc.text("Banka:", innerLeft, by);
      doc.setTextColor(...colors.foreground);
      doc.text(company.bank_name, innerLeft + 20, by);
      by += 5;
    }

    doc.setTextColor(...colors.muted);
    doc.text("IBAN:", innerLeft, by);
    doc.setTextColor(...colors.foreground);
    doc.setFont("Montserrat", "bold");
    doc.text(company.iban, innerLeft + 20, by);
    doc.setFont("Montserrat", "normal");
    by += 5;

    if (company.swift) {
      doc.setTextColor(...colors.muted);
      doc.text("SWIFT:", innerLeft, by);
      doc.setTextColor(...colors.foreground);
      doc.text(company.swift, innerLeft + 20, by);
      by += 5;
    }

    const vs = invoice.invoice_number.replace(/\D/g, "");
    doc.setTextColor(...colors.muted);
    doc.text("VS:", innerLeft, by);
    doc.setTextColor(...colors.foreground);
    doc.text(vs, innerLeft + 20, by);

    // Pay by Square QR code via bysquare.com API
    try {
    const cleanIban = company.iban.replace(/\s/g, "").toUpperCase();
      const cleanBic = company.swift?.replace(/\s/g, "").toUpperCase();
      const vs10 = vs.substring(0, 10);
      const dueDate = invoice.due_date 
        ? new Date(invoice.due_date).toISOString().split('T')[0]
        : undefined;
      const amount = Number(invoice.total);
      const currencyCode = String(invoice.currency || "EUR").toUpperCase().slice(0, 3);

      const { data, error } = await supabase.functions.invoke("bysquare-qr", {
        body: {
          iban: cleanIban,
          ...(cleanBic && /^[A-Z0-9]{8,11}$/.test(cleanBic) ? { bic: cleanBic } : {}),
          amount: Number.isFinite(amount) ? amount : undefined,
          currencyCode,
          variableSymbol: vs10 || undefined,
          beneficiaryName: company.company_name || "Prijemca",
          paymentNote: `Faktura ${invoice.invoice_number}`,
          dueDate: dueDate || undefined,
        },
      });

      if (error) throw error;
      if (!data?.image) throw new Error("No image in response");

      const qrDataUrl = `data:image/png;base64,${data.image}`;
      const qrX = innerRight - qrSize;
      const qrY = y + (bankCardH - qrSize - 6) / 2 + 3;
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

      doc.setFontSize(5.5);
      doc.setTextColor(...colors.muted);
      doc.text("Pay by Square", qrX + qrSize / 2, qrY + qrSize + 3, { align: "center" });
    } catch (err) {
      console.error("[PDF] Pay by Square QR generation failed:", err);
    }

    y += bankCardH + 4;
  }

  // ──────────── NOTES CARD ────────────
  if (invoice.notes) {
    const noteLines = doc.splitTextToSize(invoice.notes, cardW - cardPad * 2);
    const notesCardH = 8 + noteLines.length * 3.5 + 6;
    drawCard(doc, margin, y, cardW, notesCardH);

    let ny = y + 6;
    doc.setFontSize(7);
    doc.setFont("Montserrat", "bold");
    doc.setTextColor(...colors.primary);
    doc.text("POZNÁMKY", innerLeft, ny);
    ny += 5;

    doc.setFontSize(7.5);
    doc.setFont("Montserrat", "normal");
    doc.setTextColor(...colors.muted);
    doc.text(noteLines, innerLeft, ny);
  }

  // ──────────── FOOTER ────────────
  doc.setFontSize(6.5);
  doc.setTextColor(...colors.muted);
  const footerParts: string[] = [];
  if (company?.company_name) footerParts.push(company.company_name);
  if (company?.email) footerParts.push(company.email);
  if (company?.phone) footerParts.push(company.phone);
  if (company?.website) footerParts.push(company.website);
  if (footerParts.length > 0) {
    doc.text(footerParts.join("  •  "), pw / 2, ph - 8, { align: "center" });
  }

  doc.save(`faktura-${invoice.invoice_number}.pdf`);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
