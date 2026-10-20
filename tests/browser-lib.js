// Wspólne uruchamianie prototypu w Chromium z podmienionym CDN (PixiJS z node_modules).
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');

async function openPage(query, opts = {}) {
  const exe = fs.readdirSync('/opt/pw-browsers').filter((d) => /^chromium-/.test(d)).map((d) => path.join('/opt/pw-browsers', d, 'chrome-linux', 'chrome'))[0];
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: opts.w || 1400, height: opts.h || 850 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.route('**/cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.min.js', (r) => r.fulfill({ path: path.join(ROOT, 'node_modules/pixi.js/dist/pixi.min.js'), contentType: 'application/javascript' }));
  await page.goto('file://' + (process.env.P1_FILE || path.join(ROOT, 'prototypy', 'p1-bitwa.html')) + (query ? '?' + query : ''));
  return { browser, page, errors };
}
module.exports = { openPage, ROOT };
