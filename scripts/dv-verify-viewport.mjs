#!/usr/bin/env node
/**
 * Phone viewport (390×844) over the packaged web reader.
 * Launch, doctor, and cleanup delegate to verify-documentos-vaticanos.
 * Drive does not: that helper hardcodes a 1280×800 viewport.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webScript = path.join(
  repoRoot,
  '.cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs',
);
const webStatePath = path.join(
  repoRoot,
  '.cursor/skills/verify-documentos-vaticanos/.run/state.json',
);
const skillDir = path.join(repoRoot, '.cursor/skills/verify-documentos-vaticanos-viewport');
const evidenceDir = path.join(skillDir, 'evidence');

const VIEWPORT = { width: 390, height: 844 };

const FEATURES = {
  lector: {
    path: '/leyendo/cic-es/punto/2',
    selector: 'app-lector',
    urlIncludes: '/leyendo/cic-es/u/2',
    paper: true,
    bnav: 0,
  },
  biblioteca: {
    path: '/biblioteca',
    text: 'Biblioteca',
    textWithin: '.only-mobile',
    selector: 'app-bnav',
    mobileChrome: true,
  },
};

function delegate(cmd) {
  const result = spawnSync(process.execPath, [webScript, cmd], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) {
    console.log(`viewport fail ${cmd} ${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

function baseUrl() {
  if (process.env.DV_VERIFY_BASE_URL) {
    return process.env.DV_VERIFY_BASE_URL.replace(/\/$/, '');
  }
  try {
    const state = JSON.parse(fs.readFileSync(webStatePath, 'utf8'));
    if (state?.base) return state.base;
  } catch {
    /* launch has not written state yet */
  }
  const port = process.env.DV_VERIFY_PORT || '4219';
  return `http://127.0.0.1:${port}`;
}

function chromiumPath() {
  if (process.env.DV_VERIFY_CHROMIUM) return process.env.DV_VERIFY_CHROMIUM;
  if (fs.existsSync('/usr/bin/chromium')) return '/usr/bin/chromium';
  return null;
}

async function drive(name) {
  const feature = FEATURES[name];
  if (!feature) {
    console.log(`drive fail unknown feature ${name}`);
    console.log(`known ${Object.keys(FEATURES).join(' ')}`);
    process.exit(1);
  }
  const base = baseUrl();
  const lines = [
    `feature ${name}`,
    `viewport ${VIEWPORT.width}x${VIEWPORT.height}`,
    `action GET ${feature.path}`,
    `action_url ${base}${feature.path}`,
  ];
  let failed = false;
  let browser;
  try {
    const require = createRequire(path.join(repoRoot, 'e2e/package.json'));
    const { chromium } = require('playwright');
    const executablePath = chromiumPath();
    lines.push(`browser ${executablePath || 'playwright-chromium'}`);
    const launchOpts = {
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    };
    if (executablePath) launchOpts.executablePath = executablePath;
    browser = await chromium.launch(launchOpts);
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.addInitScript(() => {
      const prefs = {
        theme: 'mono',
        font: 'serif',
        fontSizePx: 18,
        lineHeight: 1.65,
        maxWidthCh: 65,
        keepAwake: false,
        contentLocale: 'es',
        uiLocale: 'es',
      };
      localStorage.setItem('reader.prefs.v1', JSON.stringify(prefs));
    });
    const action = `${base}${feature.path}`;
    await page.goto(action, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const size = page.viewportSize();
    lines.push(`viewport_actual ${size?.width}x${size?.height}`);
    if (!size || size.width !== VIEWPORT.width || size.height !== VIEWPORT.height) {
      lines.push(`viewport mismatch wanted ${VIEWPORT.width}x${VIEWPORT.height}`);
      failed = true;
    }
    const inner = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    lines.push(`inner ${inner.width}x${inner.height}`);
    if (inner.width >= 1024) {
      lines.push('inner width is desktop');
      failed = true;
    }
    if (feature.selector) {
      await page.locator(feature.selector.split(',')[0].trim()).first().waitFor({
        state: 'attached',
        timeout: 60000,
      });
    }
    if (feature.text) {
      const scope = feature.textWithin ? page.locator(feature.textWithin) : page;
      await scope.getByText(feature.text, { exact: false }).first().waitFor({
        state: 'visible',
        timeout: 60000,
      });
    }
    if (feature.paper) {
      await page.locator('app-punto').first().waitFor({ state: 'visible', timeout: 60000 });
      lines.push('app-punto visible');
    }
    if (feature.bnav !== undefined) {
      const count = await page.locator('.bnav').count();
      lines.push(`bnav ${count}`);
      if (count !== feature.bnav) failed = true;
    }
    if (feature.mobileChrome) {
      const chrome = await page.evaluate(() => {
        const host = document.querySelector('app-bnav');
        const bar = document.querySelector('app-bnav .bnav');
        const mobile = document.querySelector('.only-mobile');
        const desktop = document.querySelector('.only-desktop');
        const display = (el) => (el ? getComputedStyle(el).display : 'missing');
        const box = bar ? bar.getBoundingClientRect() : null;
        return {
          host: display(host),
          bar: display(bar),
          mobile: display(mobile),
          desktop: display(desktop),
          barHeight: box ? box.height : 0,
        };
      });
      lines.push(`app-bnav display ${chrome.host}`);
      lines.push(`bnav display ${chrome.bar}`);
      lines.push(`only-mobile display ${chrome.mobile}`);
      lines.push(`only-desktop display ${chrome.desktop}`);
      lines.push(`bnav height ${chrome.barHeight}`);
      if (
        chrome.host !== 'block' ||
        chrome.bar === 'none' ||
        chrome.mobile === 'none' ||
        chrome.desktop !== 'none' ||
        chrome.barHeight <= 0
      ) {
        failed = true;
      }
    }
    const url = page.url();
    lines.push(`result_url ${url}`);
    if (feature.urlIncludes && !url.includes(feature.urlIncludes)) {
      lines.push(`url mismatch wanted ${feature.urlIncludes}`);
      failed = true;
    }
    const excerpt = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim().slice(0, 280);
    lines.push(`excerpt ${excerpt}`);
  } catch (err) {
    failed = true;
    lines.push(`error ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, `${name}.txt`);
  fs.writeFileSync(evidencePath, `${lines.join('\n')}\n`);
  lines.push(`evidence ${evidencePath}`);
  console.log(lines.join('\n'));
  if (failed) process.exit(1);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'launch') {
  delegate('launch');
} else if (cmd === 'doctor') {
  delegate('doctor');
} else if (cmd === 'drive') {
  await drive(arg || 'lector');
} else if (cmd === 'cleanup') {
  delegate('cleanup');
} else {
  console.log('usage: dv-verify-viewport.mjs launch|doctor|drive <lector|biblioteca>|cleanup');
  process.exit(2);
}
