import fs from 'fs';
import path from 'path';
import { PDFDocument, PDFFont, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { chromium } from 'playwright';
import type { OfferDocument } from '../offer-documents.repo';
import { page3Html } from './page3.template';

const PAGE_H = 842.25;
const NAVY = rgb(27 / 255, 58 / 255, 75 / 255);

// ── Asset resolution ──────────────────────────────────────────────────────────

function resolveAsset(filename: string): string {
  const local = path.resolve(__dirname, 'assets', filename);
  if (fs.existsSync(local)) return local;
  return path.resolve(process.cwd(), 'src/rest/offer-documents/pdf/assets', filename);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  return `${day}.${month}.${year}`;
}

function wrapBodyHtml(html: string): string {
  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 530px; font-family: Helvetica, Arial, sans-serif; font-size: 9.5px; line-height: 1.5; color: #222; overflow: hidden; }
  p { margin-bottom: 4px; }
  ul, ol { padding-left: 16px; margin-bottom: 4px; }
  strong, b { font-weight: bold; }
  h1, h2, h3 { font-size: 11px; font-weight: bold; margin-bottom: 4px; }
</style></head>
<body>${html}</body></html>`;
}

// ── Font loader ───────────────────────────────────────────────────────────────

async function loadFonts(pdfDoc: PDFDocument): Promise<{ regular: PDFFont; bold: PDFFont }> {
  pdfDoc.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    fs.promises.readFile(resolveAsset('Montserrat-Regular.ttf')),
    fs.promises.readFile(resolveAsset('Montserrat-Bold.ttf')),
  ]);
  const [regular, bold] = await Promise.all([
    pdfDoc.embedFont(regularBytes),
    pdfDoc.embedFont(boldBytes),
  ]);
  return { regular, bold };
}

// ── Playwright renderer ───────────────────────────────────────────────────────

async function renderHtmlToPng(
  html: string,
  viewportW: number,
  viewportH: number,
  dpr = 1,
): Promise<Buffer> {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const ctx = await browser.newContext({
      viewport: { width: viewportW, height: viewportH },
      deviceScaleFactor: dpr,
    });
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const buffer = await page.screenshot({ type: 'png' });
    return Buffer.from(buffer);
  } finally {
    await browser.close();
  }
}

// ── Public input type ─────────────────────────────────────────────────────────

export interface CustomPdfInput {
  parcelLine1: string;
  parcelLine2?: string;
  date: string;
  p2Header?: string;
  bodyHtml: string;
  p3Header?: string;
  p3Subtitle?: string;
  floorPlanImage: Buffer;
  floorPlanMimetype: string;
}

// ── Core generator (coordinate-map overlay on template) ───────────────────────

export async function generateCustomPDF(input: CustomPdfInput): Promise<Buffer> {
  const templatePath = resolveAsset('template.pdf');
  if (!fs.existsSync(templatePath)) throw new Error(`Template PDF not found: ${templatePath}`);

  // Render page-2 body HTML and load template in parallel
  const [templateBytes, bodyPng] = await Promise.all([
    fs.promises.readFile(templatePath),
    renderHtmlToPng(wrapBodyHtml(input.bodyHtml), 530, 568, 2),
  ]);

  const pdfDoc = await PDFDocument.load(templateBytes);
  const { regular, bold } = await loadFonts(pdfDoc);
  const pages = pdfDoc.getPages();

  // ── Page 1: text overlays ─────────────────────────────────────────────────
  const p1 = pages[0];
  if (p1) {
    if (input.parcelLine1) {
      p1.drawText(input.parcelLine1, {
        x: 328.2, y: PAGE_H - 125.7,
        size: 16.9, font: regular, color: NAVY,
      });
    }
    if (input.parcelLine2) {
      p1.drawText(input.parcelLine2, {
        x: 367.5, y: PAGE_H - 144.5,
        size: 16.9, font: regular, color: NAVY,
      });
    }
    p1.drawText(formatDate(input.date), {
      x: 491.5, y: PAGE_H - 227.7,
      size: 10.2, font: regular, color: NAVY,
    });
  }

  // ── Page 2: header text + clear body region + embed HTML render ───────────
  const p2 = pages[1];
  if (p2) {
    if (input.p2Header) {
      p2.drawText(input.p2Header, {
        x: 183.6, y: PAGE_H - 59.2,
        size: 10, font: bold, color: NAVY,
      });
    }
    // pdfY = PAGE_H - yTop - height = 842.25 - 79 - 568 = 195.25
    const bodyY = PAGE_H - 79 - 568;
    p2.drawRectangle({ x: 33.6, y: bodyY, width: 529.4, height: 568, color: rgb(1, 1, 1), borderWidth: 0 });
    const bodyImg = await pdfDoc.embedPng(bodyPng);
    p2.drawImage(bodyImg, { x: 33.6, y: bodyY, width: 529.4, height: 568 });
  }

  // ── Page 3: header/subtitle text + clear diagram region + embed image ─────
  const p3 = pages[2];
  if (p3) {
    if (input.p3Header) {
      p3.drawText(input.p3Header, {
        x: 148.4, y: PAGE_H - 14.7,
        size: 13, font: bold, color: NAVY,
      });
    }
    if (input.p3Subtitle) {
      p3.drawText(input.p3Subtitle, {
        x: 186.1, y: PAGE_H - 34.9,
        size: 13, font: regular, color: NAVY,
      });
    }
    // pdfY = PAGE_H - yTop - height = 842.25 - 100 - 650 = 92.25
    const diagramY = PAGE_H - 100 - 650;
    p3.drawRectangle({ x: 30, y: diagramY, width: 530, height: 650, color: rgb(1, 1, 1), borderWidth: 0 });
    const isJpeg = input.floorPlanMimetype === 'image/jpeg' || input.floorPlanMimetype === 'image/jpg';
    const floorImg = isJpeg
      ? await pdfDoc.embedJpg(input.floorPlanImage)
      : await pdfDoc.embedPng(input.floorPlanImage);
    p3.drawImage(floorImg, { x: 30, y: diagramY, width: 530, height: 650 });
  }

  // Pages 4-5 are already in the template — untouched.

  return Buffer.from(await pdfDoc.save());
}

// ── Adapter for existing OfferDocument-based generation ───────────────────────

export async function generateOfferPDF(offerDocument: OfferDocument): Promise<Buffer> {
  // Render building diagram from HTML template at A4 width, capturing full content height
  const diagramPng = await renderHtmlToPng(page3Html(offerDocument), 795, 1000);

  return generateCustomPDF({
    parcelLine1: offerDocument.parcelTitle,
    date: offerDocument.offerDate,
    p2Header: offerDocument.companyName,
    bodyHtml: offerDocument.page2Content,
    p3Header: offerDocument.parcelTitle,
    p3Subtitle: 'KAT MALİKLERİ PAYLAŞIM KROKİSİ',
    floorPlanImage: diagramPng,
    floorPlanMimetype: 'image/png',
  });
}
