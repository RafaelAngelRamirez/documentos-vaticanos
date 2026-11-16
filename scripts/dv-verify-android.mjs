#!/usr/bin/env node
/**
 * Android emulator verification for the Capacitor reader.
 * Launch, doctor, drive lector, cleanup.
 * Does not download a system image, does not wipe data, and does not chmod /dev/kvm.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillDir = path.join(repoRoot, '.cursor/skills/verify-documentos-vaticanos-android');
const evidenceDir = path.join(skillDir, 'evidence');
const runDir = path.join(skillDir, '.run');
const statePath = path.join(runDir, 'state.json');

export const DEFAULT_PORT = 5574;
export const FORBIDDEN_PORTS = new Set([5564, 5580]);
export const DEFAULT_AVD = 'dv_verify';
export const SYSTEM_IMAGE = 'system-images;android-34;default;x86_64';

export function systemImageFile(sdk) {
  return path.join(sdk, 'system-images', 'android-34', 'default', 'x86_64', 'system.img');
}
export const APP_ID = 'digital.documentosvaticanos.app';
export const ACTIVITY = `${APP_ID}/.MainActivity`;
export const MIN_MEM_MB = 2800;
export const MIN_DISK_BYTES = 8 * 1024 * 1024 * 1024;
export const MEMORY_MB = 1536;
export const DATA_PARTITION = '2048M';
export const LECTOR_URL_PART = '/leyendo/cic-es/u/2';
export const LECTOR_NAV = 'https://localhost/leyendo/cic-es/punto/2';

const PREFS = {
  theme: 'mono',
  font: 'serif',
  fontSizePx: 18,
  lineHeight: 1.65,
  maxWidthCh: 65,
  keepAwake: false,
  contentLocale: 'es',
  uiLocale: 'es',
};

export function kvmOpenable(device = '/dev/kvm') {
  try {
    const fd = fs.openSync(device, 'r+');
    fs.closeSync(fd);
    return { ok: true, reason: 'kvm ok' };
  } catch (err) {
    if (err.code === 'ENOENT') return { ok: false, reason: 'launch fail kvm missing' };
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      return { ok: false, reason: 'launch fail kvm permission' };
    }
    return { ok: false, reason: `launch fail kvm ${err.code || err.message}` };
  }
}

export function memAvailableMb(meminfo) {
  const match = String(meminfo).match(/^MemAvailable:\s+(\d+)\s+kB/m);
  if (!match) return null;
  return Math.floor(Number(match[1]) / 1024);
}

export function diskFreeBytes(target) {
  const stat = fs.statfsSync(target);
  return Number(stat.bavail) * Number(stat.bsize);
}

export function gateReasons({ kvm, memMb, diskBytes, emulatorExists, adbExists, port }) {
  const reasons = [];
  if (!kvm?.ok) reasons.push(kvm?.reason || 'launch fail kvm');
  if (FORBIDDEN_PORTS.has(port)) reasons.push(`launch fail port reserved ${port}`);
  if (!Number.isInteger(port) || port < 5554 || port > 5682 || port % 2 !== 0) {
    reasons.push(`launch fail port ${port}`);
  }
  if (memMb == null || memMb < MIN_MEM_MB) reasons.push(`launch fail memory ${memMb ?? 'unknown'}`);
  if (!(diskBytes >= MIN_DISK_BYTES)) reasons.push('launch fail disk');
  if (!emulatorExists) reasons.push('launch fail sdk emulator');
  if (!adbExists) reasons.push('launch fail sdk adb');
  return reasons;
}

export function emulatorArgs({ avd, port, memoryMb }) {
  return [
    '-avd',
    avd,
    '-port',
    String(port),
    '-no-window',
    '-no-audio',
    '-no-boot-anim',
    '-gpu',
    'swiftshader_indirect',
    '-accel',
    'on',
    '-memory',
    String(memoryMb),
    '-no-metrics',
  ];
}

export function patchAvdConfig(text, { ramMb, dataPartition }) {
  const want = {
    'hw.ramSize': String(ramMb),
    'vm.heapSize': '256',
    'disk.dataPartition.size': dataPartition,
    'hw.keyboard': 'yes',
    'hw.gpu.enabled': 'yes',
    'hw.gpu.mode': 'swiftshader_indirect',
  };
  const seen = new Set();
  const lines = String(text).split('\n').filter((line, index, all) => {
    if (index === all.length - 1 && line === '') return false;
    return true;
  });
  const next = [];
  for (const line of lines) {
    const eq = line.indexOf('=');
    if (eq === -1) {
      next.push(line);
      continue;
    }
    const key = line.slice(0, eq).trim();
    if (Object.prototype.hasOwnProperty.call(want, key)) {
      next.push(`${key}=${want[key]}`);
      seen.add(key);
      continue;
    }
    next.push(line);
  }
  for (const [key, value] of Object.entries(want)) {
    if (!seen.has(key)) next.push(`${key}=${value}`);
  }
  return `${next.join('\n')}\n`;
}

export function webviewSockets(dump) {
  return [...new Set(String(dump).match(/webview_devtools_remote_\d+/g) || [])];
}

export function pickSocket(names, pid) {
  if (pid) {
    const exact = names.find((name) => name.endsWith(`_${pid}`));
    if (exact) return exact;
  }
  return names[0] || null;
}

export function judgeLector(snapshot) {
  const problems = [];
  if (!String(snapshot?.href || '').includes(LECTOR_URL_PART)) problems.push('url');
  if (!snapshot?.lector) problems.push('app-lector');
  if (!snapshot?.punto) problems.push('app-punto');
  if (snapshot?.bnav !== 0) problems.push('bnav');
  return problems;
}

function sdkRoot() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), 'Android', 'Sdk'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'emulator', 'emulator'))) return candidate;
  }
  return candidates[0] || path.join(os.homedir(), 'Android', 'Sdk');
}

function avdHome() {
  return process.env.ANDROID_AVD_HOME || path.join(os.homedir(), '.android', 'avd');
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeState(state) {
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function adbBin(sdk) {
  return path.join(sdk, 'platform-tools', 'adb');
}

function adb(sdk, args, timeout = 20000) {
  return spawnSync(adbBin(sdk), args, { encoding: 'utf8', timeout });
}

function serialFor(port) {
  return `emulator-${port}`;
}

function bootCompleted(sdk, serial) {
  const result = adb(sdk, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], 15000);
  return (result.stdout || '').replace(/\r/g, '').trim() === '1';
}

function writeEvidence(name, lines) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, `${name}.txt`);
  fs.writeFileSync(evidencePath, `${lines.join('\n')}\n`);
  return evidencePath;
}

function tailFile(file, count = 25) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(-count);
  } catch {
    return [];
  }
}

function chosenPort() {
  const raw = process.env.DV_VERIFY_ANDROID_PORT || String(DEFAULT_PORT);
  const port = Number(raw);
  return Number.isInteger(port) ? port : NaN;
}

function chosenAvd() {
  return process.env.DV_VERIFY_ANDROID_AVD || DEFAULT_AVD;
}

function imageInstalled(sdk) {
  return fs.existsSync(systemImageFile(sdk));
}

function avdIni(avd) {
  return path.join(avdHome(), `${avd}.ini`);
}

function ensureAvd(sdk, avd) {
  if (fs.existsSync(avdIni(avd))) return { created: false };
  if (!imageInstalled(sdk)) return { created: false, error: 'launch fail image' };
  const avdmanager = path.join(sdk, 'cmdline-tools', 'latest', 'bin', 'avdmanager');
  if (!fs.existsSync(avdmanager)) return { created: false, error: 'launch fail avdmanager' };
  const result = spawnSync(
    avdmanager,
    ['create', 'avd', '-n', avd, '-k', SYSTEM_IMAGE, '-d', 'medium_phone', '--force'],
    {
      input: 'no\n',
      encoding: 'utf8',
      env: { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk },
    },
  );
  if (result.status !== 0 || !fs.existsSync(avdIni(avd))) {
    const detail = `${result.stderr || ''}\n${result.stdout || ''}`.trim().split('\n').slice(-8);
    return { created: false, error: 'launch fail avd', detail };
  }
  const configPath = path.join(avdHome(), `${avd}.avd`, 'config.ini');
  const patched = patchAvdConfig(fs.readFileSync(configPath, 'utf8'), {
    ramMb: MEMORY_MB,
    dataPartition: DATA_PARTITION,
  });
  if (patched.includes('-wipe-data')) return { created: false, error: 'launch fail avd config' };
  fs.writeFileSync(configPath, patched);
  return { created: true };
}

function gatherGates(sdk, port) {
  const kvm = kvmOpenable();
  let memMb = null;
  try {
    memMb = memAvailableMb(fs.readFileSync('/proc/meminfo', 'utf8'));
  } catch {
    memMb = null;
  }
  let diskBytes = 0;
  try {
    const target = fs.existsSync(avdHome()) ? avdHome() : os.homedir();
    diskBytes = diskFreeBytes(target);
  } catch {
    diskBytes = 0;
  }
  const reasons = gateReasons({
    kvm,
    memMb,
    diskBytes,
    emulatorExists: fs.existsSync(path.join(sdk, 'emulator', 'emulator')),
    adbExists: fs.existsSync(adbBin(sdk)),
    port,
  });
  return { kvm, memMb, diskBytes, reasons };
}

async function waitForBoot(sdk, serial, waitMs) {
  const started = Date.now();
  adb(sdk, ['start-server'], 15000);
  while (Date.now() - started < waitMs) {
    if (bootCompleted(sdk, serial)) return Date.now() - started;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return null;
}

async function launch() {
  const sdk = sdkRoot();
  const port = chosenPort();
  const avd = chosenAvd();
  const serial = serialFor(port);
  const lines = [`sdk ${sdk}`, `avd ${avd}`, `port ${port}`];
  const gates = gatherGates(sdk, port);
  lines.push(gates.kvm.reason);
  lines.push(`mem_available_mb ${gates.memMb ?? 'unknown'}`);
  lines.push(`disk_free_gb ${(gates.diskBytes / (1024 ** 3)).toFixed(1)}`);
  if (gates.reasons.length) {
    lines.push(...gates.reasons);
    const evidencePath = writeEvidence('launch', lines);
    console.log([...lines, `evidence ${evidencePath}`].join('\n'));
    process.exit(1);
  }

  const previous = readState();
  if (bootCompleted(sdk, serial)) {
    const owned = Boolean(previous?.owned && previous.serial === serial && pidAlive(previous.pid));
    writeState({
      sdk,
      avd,
      port,
      serial,
      pid: owned ? previous.pid : null,
      owned,
      adopted: !owned,
    });
    lines.push(owned ? 'launch reuse' : 'launch adopted');
    lines.push('boot_completed 1');
    lines.push('launch ready');
    const doctorLines = doctorLinesFor(sdk, readState());
    lines.push(...doctorLines);
    const evidencePath = writeEvidence('launch', lines);
    console.log([...lines, `evidence ${evidencePath}`].join('\n'));
    if (doctorLines.at(-1) !== 'doctor ok') process.exit(1);
    return;
  }

  const created = ensureAvd(sdk, avd);
  if (created.error) {
    lines.push(created.error);
    if (created.detail) lines.push(...created.detail);
    const evidencePath = writeEvidence('launch', lines);
    console.log([...lines, `evidence ${evidencePath}`].join('\n'));
    process.exit(1);
  }
  lines.push(created.created ? `avd created ${avd}` : `avd present ${avd}`);

  fs.mkdirSync(runDir, { recursive: true });
  const logPath = path.join(runDir, 'emulator.log');
  const logFd = fs.openSync(logPath, 'a');
  const args = emulatorArgs({ avd, port, memoryMb: MEMORY_MB });
  if (args.includes('-wipe-data')) {
    lines.push('launch fail wipe-data');
    fs.closeSync(logFd);
    const evidencePath = writeEvidence('launch', lines);
    console.log([...lines, `evidence ${evidencePath}`].join('\n'));
    process.exit(1);
  }
  const child = spawn(path.join(sdk, 'emulator', 'emulator'), args, {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk },
  });
  child.unref();
  fs.closeSync(logFd);
  lines.push(`emulator pid ${child.pid}`);
  writeState({ sdk, avd, port, serial, pid: child.pid, owned: true, adopted: false });

  const waitMs = Number(process.env.DV_VERIFY_ANDROID_WAIT_MS || 180000);
  const elapsed = await waitForBoot(sdk, serial, waitMs);
  if (elapsed == null) {
    lines.push('launch fail timeout');
    lines.push(...tailFile(logPath).map((line) => `log ${line}`));
    try {
      process.kill(child.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
    const evidencePath = writeEvidence('launch', lines);
    console.log([...lines, `evidence ${evidencePath}`].join('\n'));
    process.exit(1);
  }
  lines.push('boot_completed 1');
  lines.push(`elapsed_ms ${elapsed}`);
  lines.push('launch ready');
  const doctorLines = doctorLinesFor(sdk, readState());
  lines.push(...doctorLines);
  const evidencePath = writeEvidence('launch', lines);
  console.log([...lines, `evidence ${evidencePath}`].join('\n'));
  if (doctorLines.at(-1) !== 'doctor ok') process.exit(1);
}

function doctorLinesFor(sdk, state) {
  const lines = [];
  if (!state?.serial) {
    lines.push('doctor fail state');
    return lines;
  }
  if (!bootCompleted(sdk, state.serial)) {
    lines.push('doctor fail boot');
    return lines;
  }
  lines.push(`serial ${state.serial}`);
  lines.push('boot_completed 1');
  if (state.owned) {
    lines.push(pidAlive(state.pid) ? `pid ${state.pid} alive` : 'doctor fail pid');
    if (!pidAlive(state.pid)) return lines;
  }
  lines.push('doctor ok');
  return lines;
}

function doctor() {
  const sdk = sdkRoot();
  const state = readState();
  const lines = doctorLinesFor(sdk, state);
  console.log(lines.join('\n'));
  if (lines.at(-1) !== 'doctor ok') process.exit(1);
}

function apkCandidates() {
  const listed = [];
  if (process.env.DV_VERIFY_ANDROID_APK) listed.push(process.env.DV_VERIFY_ANDROID_APK);
  listed.push(path.join(repoRoot, 'dist', 'documentos-vaticanos-debug.apk'));
  listed.push(
    path.join(repoRoot, 'frontend/android/app/build/outputs/apk/debug/app-debug.apk'),
  );
  return listed;
}

function installed(sdk, serial) {
  const result = adb(sdk, ['-s', serial, 'shell', 'pm', 'path', APP_ID], 20000);
  return (result.stdout || '').includes('package:');
}

function appPid(sdk, serial) {
  const result = adb(sdk, ['-s', serial, 'shell', 'pidof', APP_ID], 15000);
  const pid = (result.stdout || '').replace(/\r/g, '').trim().split(/\s+/)[0];
  return pid || null;
}

async function waitForSocket(sdk, serial, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const pid = appPid(sdk, serial);
    const dump = adb(sdk, ['-s', serial, 'shell', 'cat', '/proc/net/unix'], 15000);
    const socket = pickSocket(webviewSockets(`${dump.stdout || ''}\n${dump.stderr || ''}`), pid);
    if (socket) return { socket, pid };
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}

function cdpEvaluateExpression() {
  return `(() => {
    const punto = document.querySelector('app-punto');
    const lector = document.querySelector('app-lector');
    const visible = (el) => {
      if (!el) return false;
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.height > 0 && box.width > 0;
    };
    const text = (document.body && document.body.innerText ? document.body.innerText : '')
      .replace(/\\s+/g, ' ')
      .trim()
      .slice(0, 280);
    return { href: location.href, lector: !!lector, punto: visible(punto), bnav: document.querySelectorAll('.bnav').length, excerpt: text };
  })()`;
}

function openCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject, timer } = pending.get(message.id);
    clearTimeout(timer);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message || 'cdp error'));
    else resolve(message.result);
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve(), { once: true });
    ws.addEventListener('error', () => reject(new Error('cdp socket')), { once: true });
  });
  return {
    ws,
    ready,
    call(method, params, timeoutMs = 20000) {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`cdp timeout ${method}`));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function readLector(wsUrl) {
  const client = openCdp(wsUrl);
  await client.ready;
  try {
    await client.call('Runtime.enable', {});
    await client.call('Page.enable', {});
    const prefs = JSON.stringify(PREFS).replace(/</g, '\\u003c');
    await client.call('Runtime.evaluate', {
      expression: `localStorage.setItem('reader.prefs.v1', ${JSON.stringify(prefs)})`,
      returnByValue: true,
    });
    await client.call('Page.navigate', { url: LECTOR_NAV });
    const expression = cdpEvaluateExpression();
    const started = Date.now();
    let last = null;
    while (Date.now() - started < 60000) {
      const evaluated = await client.call('Runtime.evaluate', {
        expression,
        returnByValue: true,
      });
      last = evaluated?.result?.value || null;
      if (last && judgeLector(last).length === 0) return last;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return last || { href: '', lector: false, punto: false, bnav: -1, excerpt: '' };
  } finally {
    client.ws.close();
  }
}

async function drive(name) {
  const lines = [`feature ${name || ''}`];
  if (name !== 'lector') {
    lines.push(`drive fail unknown feature ${name || ''}`);
    lines.push('known lector');
    const evidencePath = writeEvidence(name || 'drive', lines);
    console.log([...lines, `evidence ${evidencePath}`].join('\n'));
    process.exit(1);
  }
  const sdk = sdkRoot();
  const state = readState();
  if (!state?.serial || !bootCompleted(sdk, state.serial)) {
    lines.push('drive fail emulator');
    const evidencePath = writeEvidence('lector', lines);
    console.log([...lines, `evidence ${evidencePath}`].join('\n'));
    process.exit(1);
  }
  lines.push(`serial ${state.serial}`);
  const apk = apkCandidates().find((candidate) => fs.existsSync(candidate));
  const haveApp = installed(sdk, state.serial);
  if (!haveApp && !apk) {
    lines.push('drive fail apk');
    const evidencePath = writeEvidence('lector', lines);
    console.log([...lines, `evidence ${evidencePath}`].join('\n'));
    process.exit(1);
  }
  if (!haveApp || process.env.DV_VERIFY_ANDROID_REINSTALL === '1') {
    lines.push(`install ${apk}`);
    const installedApk = adb(sdk, ['-s', state.serial, 'install', '-r', apk], 180000);
    if (installedApk.status !== 0 || !installed(sdk, state.serial)) {
      lines.push('drive fail install');
      lines.push(...`${installedApk.stdout || ''}\n${installedApk.stderr || ''}`.trim().split('\n').slice(-12));
      const evidencePath = writeEvidence('lector', lines);
      console.log([...lines, `evidence ${evidencePath}`].join('\n'));
      process.exit(1);
    }
  } else {
    lines.push('install present');
  }
  adb(sdk, ['-s', state.serial, 'shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'], 10000);
  adb(sdk, ['-s', state.serial, 'shell', 'wm', 'dismiss-keyguard'], 10000);
  const started = adb(
    sdk,
    ['-s', state.serial, 'shell', 'am', 'start', '-n', ACTIVITY],
    20000,
  );
  if (started.status !== 0) {
    lines.push('drive fail start');
    const evidencePath = writeEvidence('lector', lines);
    console.log([...lines, `evidence ${evidencePath}`].join('\n'));
    process.exit(1);
  }
  lines.push(`action start ${ACTIVITY}`);
  lines.push(`action navigate ${LECTOR_NAV}`);
  const found = await waitForSocket(sdk, state.serial, 30000);
  if (!found) {
    lines.push('drive fail webview');
    const evidencePath = writeEvidence('lector', lines);
    console.log([...lines, `evidence ${evidencePath}`].join('\n'));
    process.exit(1);
  }
  lines.push(`webview ${found.socket}`);
  const cdpPort = Number(process.env.DV_VERIFY_ANDROID_CDP_PORT || 9222);
  adb(sdk, ['-s', state.serial, 'forward', '--remove', `tcp:${cdpPort}`], 10000);
  const forwarded = adb(
    sdk,
    ['-s', state.serial, 'forward', `tcp:${cdpPort}`, `localabstract:${found.socket}`],
    10000,
  );
  if (forwarded.status !== 0) {
    lines.push('drive fail forward');
    const evidencePath = writeEvidence('lector', lines);
    console.log([...lines, `evidence ${evidencePath}`].join('\n'));
    process.exit(1);
  }
  let snapshot;
  try {
    const list = await fetch(`http://127.0.0.1:${cdpPort}/json/list`).then((response) => response.json());
    const page = (Array.isArray(list) ? list : []).find((target) => target.type === 'page' && target.webSocketDebuggerUrl)
      || (Array.isArray(list) ? list : []).find((target) => target.webSocketDebuggerUrl);
    if (!page?.webSocketDebuggerUrl) throw new Error('cdp list empty');
    snapshot = await readLector(page.webSocketDebuggerUrl);
  } catch (err) {
    lines.push(`error ${err.message}`);
    const evidencePath = writeEvidence('lector', lines);
    console.log([...lines, `evidence ${evidencePath}`].join('\n'));
    process.exit(1);
  }
  lines.push(`app-lector ${snapshot.lector ? 'attached' : 'missing'}`);
  lines.push(`app-punto ${snapshot.punto ? 'visible' : 'missing'}`);
  lines.push(`bnav ${snapshot.bnav}`);
  lines.push(`result_url ${snapshot.href}`);
  lines.push(`excerpt ${snapshot.excerpt || ''}`);
  const problems = judgeLector(snapshot);
  if (problems.length) lines.push(`drive fail ${problems.join(' ')}`);
  const evidencePath = writeEvidence('lector', lines);
  console.log([...lines, `evidence ${evidencePath}`].join('\n'));
  if (problems.length) process.exit(1);
}

function cleanup() {
  const state = readState();
  const sdk = state?.sdk || sdkRoot();
  if (state?.owned && state.pid && pidAlive(state.pid)) {
    try {
      process.kill(state.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
  if (state?.owned && state.serial && fs.existsSync(adbBin(sdk))) {
    adb(sdk, ['-s', state.serial, 'emu', 'kill'], 15000);
  }
  if (state?.serial && fs.existsSync(adbBin(sdk))) {
    const cdpPort = Number(process.env.DV_VERIFY_ANDROID_CDP_PORT || 9222);
    adb(sdk, ['-s', state.serial, 'forward', '--remove', `tcp:${cdpPort}`], 10000);
  }
  fs.rmSync(runDir, { recursive: true, force: true });
  console.log('cleanup ok');
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'launch') await launch();
  else if (cmd === 'doctor') doctor();
  else if (cmd === 'drive') await drive(arg || 'lector');
  else if (cmd === 'cleanup') cleanup();
  else {
    console.log('usage: dv-verify-android.mjs launch|doctor|drive <lector>|cleanup');
    process.exit(2);
  }
}

if (invokedDirectly()) {
  main().catch((err) => {
    console.log(`android fail ${err.message}`);
    process.exit(1);
  });
}
