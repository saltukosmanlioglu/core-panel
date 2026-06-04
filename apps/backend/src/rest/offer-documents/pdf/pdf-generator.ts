import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import puppeteer from 'puppeteer';
import type { OfferDocument } from '../offer-documents.repo';
import { page1Html } from './page1.template';
import { page2Html } from './page2.template';
import { page3Html } from './page3.template';

async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

async function appendPdf(target: PDFDocument, sourceBytes: Buffer): Promise<void> {
  const source = await PDFDocument.load(sourceBytes);
  const pages = await target.copyPages(source, source.getPageIndices());
  pages.forEach((page) => target.addPage(page));
}

function optionalStaticPagesPath(): string {
  const localPath = path.resolve(__dirname, 'assets/pages-4-5.pdf');
  if (fs.existsSync(localPath)) return localPath;

  return path.resolve(process.cwd(), 'src/rest/offer-documents/pdf/assets/pages-4-5.pdf');
}

export async function generateOfferPDF(offerDocument: OfferDocument): Promise<Buffer> {
  const merged = await PDFDocument.create();
  const generatedPages = await Promise.all([
    renderHtmlToPdf(page1Html(offerDocument)),
    renderHtmlToPdf(page2Html(offerDocument)),
    renderHtmlToPdf(page3Html(offerDocument)),
  ]);

  for (const page of generatedPages) {
    await appendPdf(merged, page);
  }

  const staticPagesPath = optionalStaticPagesPath();
  if (fs.existsSync(staticPagesPath)) {
    await appendPdf(merged, await fs.promises.readFile(staticPagesPath));
  } else {
    console.warn(
      `[offer-documents] Static pages file missing: ${staticPagesPath}. Generating pages 1-3 only.`,
    );
  }

  return Buffer.from(await merged.save());
}
