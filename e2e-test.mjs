import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:8000';
const EMAIL = 'admin@milainsaat.com';
const PASSWORD = 'Bayburt1/';

const errors = [];
const warnings = [];
const networkLog = [];

const log  = (msg) => console.log(`[LOG] ${msg}`);
const warn = (msg) => { console.warn(`[WARN] ${msg}`); warnings.push(msg); };
const err  = (msg) => { console.error(`[ERR] ${msg}`); errors.push(msg); };

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  // ── Capture browser console errors ──────────────────────────────────────────
  page.on('console', (msg) => {
    if (msg.type() === 'error') err(`CONSOLE: ${msg.text().slice(0, 300)}`);
  });
  page.on('pageerror', (ex) => {
    const text = ex.message;
    // Skip noise: hydration errors from MUI/Emotion are pre-existing dev-mode issues
    if (text.includes('Hydration') || text.includes('hydration')) {
      warn(`HYDRATION (pre-existing dev noise): ${text.slice(0, 120)}`);
    } else {
      err(`PAGE EXCEPTION: ${text.slice(0, 400)}`);
    }
  });

  // ── Capture API calls ────────────────────────────────────────────────────────
  page.on('response', async (res) => {
    const url = res.url();
    if (!url.includes('/api/')) return;
    const status = res.status();
    let body = '';
    try { body = await res.text(); } catch {}
    networkLog.push({ status, url: url.replace(BASE_URL, ''), body: body.slice(0, 600) });
    if (status >= 400) {
      err(`API ${status} ${url.replace(BASE_URL, '')} → ${body.slice(0, 300)}`);
    }
  });
  page.on('requestfailed', (req) => {
    err(`REQUEST FAILED: ${req.url()} — ${req.failure()?.errorText}`);
  });

  // ── STEP: LOGIN ──────────────────────────────────────────────────────────────
  log('--- LOGIN ---');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.screenshot({ path: '/tmp/ss01-login.png' });

  const emailField = await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
  await emailField.fill(EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  try {
    await page.waitForURL((u) => !u.includes('/login') && !u.includes('/mfa'), { timeout: 20000 });
    log(`Logged in OK. URL: ${page.url()}`);
  } catch {
    err(`Login did not redirect away from /login. Current URL: ${page.url()}`);
    await page.screenshot({ path: '/tmp/ss01b-login-fail.png' });
    const bodyText = await page.textContent('body').catch(() => '');
    log(`Page text: ${bodyText.slice(0, 300)}`);
    await browser.close();
    printSummary();
    return;
  }
  await page.screenshot({ path: '/tmp/ss02-after-login.png' });

  // ── STEP: FIND A PROJECT ─────────────────────────────────────────────────────
  log('--- FIND PROJECT ---');
  // Navigate to workspace/projects list
  const workspaceUrl = `${BASE_URL}/workspace`;
  await page.goto(workspaceUrl, { waitUntil: 'networkidle', timeout: 20000 });
  await page.screenshot({ path: '/tmp/ss03-workspace.png' });

  let projectId = null;
  // Try href-based detection first
  const hrefs = await page.$$eval('a[href]', (links) => links.map((l) => l.href));
  const projectHref = hrefs.find((h) => /\/workspace\/projects\/[a-f0-9-]{36}/.test(h));
  if (projectHref) {
    projectId = projectHref.match(/projects\/([a-f0-9-]{36})/)?.[1] ?? null;
  }

  if (!projectId) {
    // Try clicking first project card/button
    const projectBtn = await page.$('[data-testid*="project"], .project-card, a[href*="project"]');
    if (projectBtn) {
      await projectBtn.click();
      await page.waitForURL(/projects\/[a-f0-9-]{36}/, { timeout: 10000 });
      projectId = page.url().match(/projects\/([a-f0-9-]{36})/)?.[1] ?? null;
    }
  }

  if (!projectId) {
    err('Could not find any project ID from the workspace page');
    log(`All hrefs: ${JSON.stringify(hrefs.filter((h) => h.includes('project')).slice(0, 5))}`);
    await browser.close();
    printSummary();
    return;
  }
  log(`Project ID: ${projectId}`);

  // ════════════════════════════════════════════════════════════════════════════
  // TEST 1 — PARCEL CALCULATION
  // ════════════════════════════════════════════════════════════════════════════
  log('\n--- TEST 1: PARCEL CALCULATION ---');
  const parcelUrl = `${BASE_URL}/workspace/projects/${projectId}/parcel-calculation`;
  await page.goto(parcelUrl, { waitUntil: 'networkidle', timeout: 20000 });
  await page.screenshot({ path: '/tmp/ss04-parcel-page.png' });
  log(`Parcel page loaded: ${page.url()}`);

  // ── 1a. Check what's already saved (API) ────────────────────────────────────
  log('Checking existing parcel calculations via API...');
  const calcApiResp = await page.evaluate(async (url) => {
    const r = await fetch(url, { credentials: 'include' });
    return { status: r.status, body: await r.text() };
  }, `http://localhost:4000/api/projects/${projectId}/parcel-calculations`);
  log(`GET /parcel-calculations → ${calcApiResp.status}: ${calcApiResp.body.slice(0, 400)}`);

  let existingCalcs = [];
  try { existingCalcs = JSON.parse(calcApiResp.body)?.calculations ?? []; } catch {}
  log(`Existing saved calculations: ${existingCalcs.length}`);
  if (existingCalcs.length > 0) {
    const c = existingCalcs[0];
    log(`  [0] id=${c.id} footprintArea=${c.footprintArea} parcelArea=${c.parcelArea} floorCount=${c.floorCount}`);
    log(`  [0] overhangs=${JSON.stringify(c.overhangs)}`);
  }

  // ── 1b. Check parcel-area endpoint ──────────────────────────────────────────
  log('Checking parcel-area endpoint...');
  const parcelAreaResp = await page.evaluate(async (url) => {
    const r = await fetch(url, { credentials: 'include' });
    return { status: r.status, body: await r.text() };
  }, `http://localhost:4000/api/projects/${projectId}/offer-documents/parcel-area`);
  log(`GET /offer-documents/parcel-area → ${parcelAreaResp.status}: ${parcelAreaResp.body.slice(0, 500)}`);

  // ── 1c. Inspect the page UI ──────────────────────────────────────────────────
  const pageText = await page.textContent('body');
  log(`Page has "Parsel Sorgula": ${pageText.includes('Parsel Sorgula')}`);
  log(`Page has "İl": ${pageText.includes('İl')}`);
  log(`Page has "Geçmiş hesaplamalar": ${pageText.includes('Geçmiş') || pageText.includes('geçmiş')}`);

  const alerts = await page.$$eval('[role="alert"]', (els) => els.map((e) => e.textContent?.trim()));
  if (alerts.length) log(`Page alerts: ${JSON.stringify(alerts)}`);

  // ── 1d. If there is an existing calc, load it and check the Result step ──────
  if (existingCalcs.length > 0) {
    log('Loading existing calculation to inspect Result step...');

    // Click the history item / saved calculation
    const historyBtn = await page.$('[class*="ListItemButton"], [class*="list-item"], button:has-text("Hesaplama")');
    if (historyBtn) {
      await historyBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/ss05-calc-loaded.png' });
    }

    // Navigate directly to result step if stepper is visible
    // Find the "Sonuç" or last step in the Stepper
    const steps = await page.$$eval('[class*="StepLabel"], [class*="step-label"]', (els) =>
      els.map((e) => e.textContent?.trim())
    );
    log(`Stepper steps found: ${JSON.stringify(steps)}`);

    // Try clicking the Sonuç/Result step or the İleri button repeatedly
    for (let i = 0; i < 4; i++) {
      const nextBtn = await page.$('button:has-text("İleri"), button:has-text("Hesapla")');
      if (nextBtn) {
        const btnText = await nextBtn.textContent();
        log(`Clicking: ${btnText?.trim()}`);
        await nextBtn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `/tmp/ss05-step${i + 1}.png` });
      } else break;
    }

    // Check if Result step with Hesaplama Detayları is visible
    const resultText = await page.textContent('body');
    log(`Result has "Hesaplama Detayları": ${resultText.includes('Hesaplama Detayları')}`);
    log(`Result has "Taban Oturum Alanı": ${resultText.includes('Taban Oturum Alanı')}`);
    log(`Result has "Çıkma Miktarları": ${resultText.includes('Çıkma Miktarları')}`);
    log(`Result has "Zemin Kat Sonrası Kat Alanı": ${resultText.includes('Zemin Kat Sonrası Kat Alanı')}`);
    log(`Result has "Kaydet": ${resultText.includes('Kaydet')}`);
    log(`Result has "Kaydedilen hesaplama bu proje için güncellenecektir": ${resultText.includes('güncellenecektir')}`);

    await page.screenshot({ path: '/tmp/ss06-result-step.png' });

    // ── 1e. Try saving to test upsert ──────────────────────────────────────────
    log('Attempting save (upsert test)...');
    const saveBtn = await page.$('button:has-text("Kaydet"):not(:disabled)');
    if (saveBtn) {
      // Record calc count before save
      const beforeSave = await page.evaluate(async (url) => {
        const r = await fetch(url, { credentials: 'include' });
        return JSON.parse(await r.text())?.calculations?.length ?? 0;
      }, `http://localhost:4000/api/projects/${projectId}/parcel-calculations`);
      log(`Calc count before save: ${beforeSave}`);

      await saveBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/ss07-after-save.png' });

      // Check calc count after save
      const afterSaveResp = await page.evaluate(async (url) => {
        const r = await fetch(url, { credentials: 'include' });
        return await r.text();
      }, `http://localhost:4000/api/projects/${projectId}/parcel-calculations`);
      let afterCalcs = [];
      try { afterCalcs = JSON.parse(afterSaveResp)?.calculations ?? []; } catch {}
      const afterCount = afterCalcs.length;
      log(`Calc count after save: ${afterCount}`);

      if (beforeSave > 0 && afterCount === 1) {
        log('✅ UPSERT CONFIRMED: count stayed at 1 (not incremented)');
      } else if (beforeSave === 0 && afterCount === 1) {
        log('✅ INSERT CONFIRMED: new record created');
      } else if (afterCount > beforeSave) {
        err(`❌ UPSERT FAILED: count went from ${beforeSave} to ${afterCount} (should stay same or go to 1)`);
      } else {
        log(`Calc count: before=${beforeSave}, after=${afterCount}`);
      }

      // Check snackbar / success message
      const afterSaveText = await page.textContent('body');
      log(`After save has "Hesaplama kaydedildi": ${afterSaveText.includes('kaydedildi')}`);
      const saveAlerts = await page.$$eval('[role="alert"]', (els) => els.map((e) => e.textContent?.trim()));
      if (saveAlerts.length) log(`Alerts after save: ${JSON.stringify(saveAlerts)}`);
    } else {
      warn('Kaydet button not found or disabled on Result step');
      const disabledBtn = await page.$('button:has-text("Kaydet")');
      if (disabledBtn) {
        const isDisabled = await disabledBtn.getAttribute('disabled');
        log(`Save button disabled attribute: ${isDisabled}`);
        const btnText = await disabledBtn.textContent();
        log(`Save button text: ${btnText}`);
      }
    }
  } else {
    warn('No existing parcel calculations found — skipping result step inspection and upsert test');
    log('(To test the full flow, a parcel calculation must already be saved for this project)');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TEST 2 — OFFER DOCUMENTS
  // ════════════════════════════════════════════════════════════════════════════
  log('\n--- TEST 2: OFFER DOCUMENTS ---');
  const offerUrl = `${BASE_URL}/workspace/projects/${projectId}/offer-documents`;
  await page.goto(offerUrl, { waitUntil: 'networkidle', timeout: 20000 });
  await page.screenshot({ path: '/tmp/ss08-offer-list.png' });
  log(`Offer page loaded: ${page.url()}`);

  const offerListText = await page.textContent('body');
  log(`Offer list has "Teklif Oluştur": ${offerListText.includes('Teklif Oluştur')}`);

  // ── 2a. Click "Yeni Teklif Oluştur" ──────────────────────────────────────────
  const newBtn = await page.$('button:has-text("Yeni Teklif Oluştur")');
  if (!newBtn) {
    err('"Yeni Teklif Oluştur" button not found');
    await browser.close();
    printSummary();
    return;
  }
  await newBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/ss09-offer-step0.png' });

  // ── 2b. Step 0: Genel Bilgiler — check parcel data panel ──────────────────────
  log('--- Step 0: Genel Bilgiler ---');
  const step0Text = await page.textContent('body');
  const hasParcelPanel = step0Text.includes('Parsel Hesaplama Verileri');
  const hasNotFound   = step0Text.includes('kayıtlı parsel hesaplama bulunamadı');
  const hasFootprint  = step0Text.includes('Taban Oturum Alanı');
  const hasFloorArea  = step0Text.includes('Zemin Kat Sonrası');
  const hasFloorCount = step0Text.includes('Kat Sayısı');

  log(`Parcel data panel visible: ${hasParcelPanel}`);
  log(`"Bulunamadı" warning shown: ${hasNotFound}`);
  log(`Shows Taban Oturum Alanı: ${hasFootprint}`);
  log(`Shows Zemin Kat Sonrası: ${hasFloorArea}`);
  log(`Shows Kat Sayısı: ${hasFloorCount}`);

  if (!hasParcelPanel && !hasNotFound) {
    err('Neither parcel data panel nor "not found" warning is shown in Step 0');
  }
  if (hasNotFound) {
    warn('Step 0: No parcel calculation data found for this project — parcel panel shows warning');
  }

  // ── 2c. Fill required Step 0 fields ──────────────────────────────────────────
  // Fill Parsel başlığı
  const inputs = await page.$$('input[type="text"], input:not([type="date"]):not([type="checkbox"])');
  log(`Inputs on step 0: ${inputs.length}`);
  // Find parcel title input (first visible text input that's not the date field)
  for (const input of inputs) {
    const label = await input.evaluate((el) => {
      const id = el.id;
      const label = id ? document.querySelector(`label[for="${id}"]`)?.textContent : null;
      return label ?? el.placeholder ?? el.name ?? '';
    });
    log(`  Input label/placeholder: "${label}"`);
  }

  // The parcel title TextField has label "Parsel başlığı"
  await page.fill('input[id*="parcel"], input[id*="Parsel"]', 'Test Parseli').catch(async () => {
    // Fallback: fill by label proximity
    const titleLabel = await page.$('label:has-text("Parsel başlığı")');
    if (titleLabel) {
      const inputId = await titleLabel.getAttribute('for');
      if (inputId) await page.fill(`#${inputId}`, 'Test Parseli');
    } else {
      // Just fill the first non-date input
      await inputs[0]?.fill('Test Parseli').catch(() => {});
    }
  });

  await page.screenshot({ path: '/tmp/ss09b-step0-filled.png' });

  // ── 2d. Advance to Step 1 (Teklif İçeriği) ────────────────────────────────────
  let nextBtn = await page.$('button:has-text("İleri")');
  if (nextBtn) {
    await nextBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/ss10-offer-step1.png' });
    log('Advanced to Step 1 (Teklif İçeriği)');
  }

  // ── 2e. Advance to Step 2 (Bina Yapısı) ──────────────────────────────────────
  nextBtn = await page.$('button:has-text("İleri")');
  if (nextBtn) {
    await nextBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/ss11-offer-step2.png' });
    log('Advanced to Step 2 (Bina Yapısı)');
  }

  const step2Text = await page.textContent('body');
  log(`Step 2 has "Alternatif 1": ${step2Text.includes('Alternatif 1')}`);
  log(`Step 2 has "Normal Kat Ekle": ${step2Text.includes('Normal Kat Ekle')}`);
  log(`Step 2 has "Zemin Kat": ${step2Text.includes('Zemin Kat')}`);

  // ── 2f. Add a second alternative ─────────────────────────────────────────────
  log('Looking for "Yeni alternatif ekle" button...');
  // The button has Tooltip title="Yeni alternatif ekle" — find via title attribute on parent or SVG button
  const addAltBtn = await page.$('[title="Yeni alternatif ekle"] button, button[aria-label="Yeni alternatif ekle"]');
  if (addAltBtn) {
    log('Found add-alternative button, clicking...');
    await addAltBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: '/tmp/ss12-two-alts.png' });
    const afterAddText = await page.textContent('body');
    log(`After adding alt: has "Alternatif 2": ${afterAddText.includes('Alternatif 2')}`);
  } else {
    // Try hovering over the area near the Tabs to reveal tooltip button
    warn('"Yeni alternatif ekle" Tooltip button not found by title selector — trying nearby buttons');
    await page.screenshot({ path: '/tmp/ss12b-no-add-btn.png' });

    // Find all icon buttons (small) near the Tabs
    const iconBtns = await page.$$('button.MuiIconButton-sizeSmall, button[class*="IconButton"]');
    log(`Small icon buttons count: ${iconBtns.length}`);
    for (const btn of iconBtns) {
      const html = await btn.evaluate((el) => el.outerHTML.slice(0, 200));
      log(`  IconButton: ${html}`);
    }
  }

  // ── 2g. Advance to Step 3 (Önizleme) ─────────────────────────────────────────
  nextBtn = await page.$('button:has-text("İleri")');
  if (nextBtn) {
    await nextBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/ss13-offer-step3.png' });
    log('Advanced to Step 3 (Önizleme)');
  }

  const step3Text = await page.textContent('body');
  log(`Step 3 has "PDF Oluştur": ${step3Text.includes('PDF Oluştur')}`);
  log(`Step 3 has "(2 alternatif)": ${step3Text.includes('2 alternatif')}`);
  log(`Step 3 preview tabs: Alternatif 1=${step3Text.includes('Alternatif 1')}, Alternatif 2=${step3Text.includes('Alternatif 2')}`);

  // ── 2h. Save first, then generate PDF ─────────────────────────────────────────
  log('Saving offer document...');
  // Save button is in the bottom navigation bar
  const saveOfferBtn = await page.$('button:has-text("Kaydet"):not(:disabled)');
  if (saveOfferBtn) {
    await saveOfferBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/ss14-offer-saved.png' });
    const afterSaveText = await page.textContent('body');
    log(`Save result text (snackbar): ${step3Text.includes('kaydedildi') ? 'kaydedildi shown' : 'checking...'}`);
    // Look for success snackbar
    const snackbars = await page.$$eval('[class*="Snackbar"], [role="status"]', (els) =>
      els.map((e) => e.textContent?.trim())
    );
    log(`Snackbars: ${JSON.stringify(snackbars)}`);
    const saveAlerts = await page.$$eval('[role="alert"]', (els) => els.map((e) => e.textContent?.trim()));
    if (saveAlerts.length) log(`Alerts after offer save: ${JSON.stringify(saveAlerts)}`);
  } else {
    warn('Save button not found or disabled before PDF generation');
    const anyBtn = await page.$$eval('button', (bs) => bs.map((b) => b.textContent?.trim() + ' [disabled=' + b.disabled + ']'));
    log(`All buttons: ${JSON.stringify(anyBtn)}`);
  }

  // ── 2i. Click PDF Oluştur ─────────────────────────────────────────────────────
  log('Attempting PDF generation...');
  const pdfBtn = await page.$('button:has-text("PDF Oluştur"):not(:disabled)');
  if (!pdfBtn) {
    warn('"PDF Oluştur" button not found or disabled');
    const allBtns = await page.$$eval('button', (bs) => bs.map((b) => `"${b.textContent?.trim()}" disabled=${b.disabled}`));
    log(`Buttons on step 3: ${JSON.stringify(allBtns)}`);
  } else {
    log('Clicking PDF Oluştur...');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 90000 }).catch((e) => { warn(`Download event timeout: ${e.message}`); return null; }),
      pdfBtn.click(),
    ]);

    // Wait for server-side PDF generation (Playwright + Chromium rendering on server)
    await page.waitForTimeout(30000);
    await page.screenshot({ path: '/tmp/ss15-after-pdf.png' });

    if (download) {
      const fname = download.suggestedFilename();
      log(`✅ PDF downloaded: ${fname}`);
      const savePath = '/tmp/generated-offer.pdf';
      await download.saveAs(savePath);
      log(`PDF saved to ${savePath}`);
      // Check file size
      const { statSync } = await import('fs');
      const stat = statSync(savePath);
      log(`PDF size: ${stat.size} bytes`);
      if (stat.size < 1000) err(`PDF is suspiciously small: ${stat.size} bytes`);
    } else {
      warn('No download event — PDF may have opened in a new tab or failed silently');
    }

    // Check for error alerts
    const pdfAlerts = await page.$$eval('[role="alert"]', (els) => els.map((e) => e.textContent?.trim()));
    if (pdfAlerts.length) log(`Alerts after PDF click: ${JSON.stringify(pdfAlerts)}`);
  }

  // ── Backend log tail ──────────────────────────────────────────────────────────
  log('\n--- BACKEND LOG (last 30 lines) ---');
  const { execSync } = await import('child_process');
  try {
    const backendLog = execSync('tail -30 /tmp/backend.log 2>/dev/null').toString();
    log(backendLog);
  } catch {}

  await browser.close();
  printSummary();
}

function printSummary() {
  console.log('\n' + '='.repeat(70));
  console.log('RUNTIME TEST SUMMARY');
  console.log('='.repeat(70));

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ No errors or warnings');
  } else {
    if (errors.length > 0) {
      console.log(`\n❌ ERRORS (${errors.length}):`);
      errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }
    if (warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
      warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
    }
  }

  console.log('\n--- API CALLS ---');
  for (const r of networkLog) {
    const icon = r.status >= 400 ? '❌' : '✅';
    console.log(`  ${icon} ${r.status} ${r.url}`);
    if (r.status >= 400) console.log(`      BODY: ${r.body}`);
  }
}

run().catch((e) => {
  console.error('FATAL:', e.message, e.stack);
  process.exit(1);
});
