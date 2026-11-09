#!/usr/bin/env node
/**
 * Launch, doctor, and drive the Documentos Vaticanos API.
 * Drive is the existing smoke: e2e/api-e2e.mjs (yarn test:api).
 * Does not sync or rewrite the corpus. Does not call scripts/dev.sh,
 * because that script copies documentos/corpus into frontend assets.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillDir = path.join(repoRoot, '.cursor/skills/verify-documentos-vaticanos-api');
const runDir = path.join(skillDir, '.run');
const evidenceDir = path.join(skillDir, 'evidence');
const statePath = path.join(runDir, 'state.json');
const smokePath = path.join(repoRoot, 'e2e/api-e2e.mjs');

const COMPOSE_FILE = 'docker-compose.dev.yml';
const PROJECT = 'documentos-vaticanos';

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeState(state) {
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function apiBase() {
  const fromEnv = process.env.E2E_API_URL || process.env.DV_VERIFY_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const state = readState();
  if (state?.base) return state.base;
  return 'http://127.0.0.1:3000';
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.setTimeout(8000, () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', reject);
  });
}

async function readHealth(base) {
  const url = `${base}/api/v1/health`;
  try {
    const res = await httpGet(url);
    let json = null;
    try {
      json = JSON.parse(res.body);
    } catch {
      json = null;
    }
    const ok = res.status === 200 && json?.ok === true && json?.service === 'documentos-vaticanos-backend';
    return { ok, status: res.status, json, url, error: null };
  } catch (err) {
    return { ok: false, status: 0, json: null, url, error: err.message };
  }
}

function compose(args) {
  return spawnSync('docker', ['compose', '-f', COMPOSE_FILE, '-p', PROJECT, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function composeStreaming(args) {
  return new Promise((resolve) => {
    const child = spawn('docker', ['compose', '-f', COMPOSE_FILE, '-p', PROJECT, ...args], {
      cwd: repoRoot,
    });
    const chunks = [];
    const onData = (buf) => {
      chunks.push(buf);
      process.stdout.write(buf);
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('error', (err) => {
      resolve({ code: 1, output: err.message });
    });
    child.on('close', (code) => {
      resolve({ code: code ?? 1, output: Buffer.concat(chunks).toString('utf8') });
    });
  });
}

function writeLaunchEvidence(message) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, 'launch.txt');
  fs.writeFileSync(evidencePath, `${message.replace(/\s+$/, '')}\n`);
  console.log(message);
  console.log(`evidence ${evidencePath}`);
}

function clearLaunchEvidence() {
  fs.rmSync(path.join(evidenceDir, 'launch.txt'), { force: true });
}

function dockerComposeAvailable() {
  const r = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
  if (r.error) return { ok: false, detail: r.error.message };
  if (r.status !== 0) return { ok: false, detail: (r.stderr || r.stdout || 'docker compose failed').trim() };
  return { ok: true, detail: (r.stdout || r.stderr || '').trim() };
}

function existingContainerIds() {
  const r = compose(['ps', '-aq']);
  if (r.error) return { error: r.error.message, ids: [] };
  if (r.status !== 0) return { error: (r.stderr || r.stdout || 'compose ps failed').trim(), ids: [] };
  const ids = (r.stdout || '').split('\n').map((line) => line.trim()).filter(Boolean);
  return { error: null, ids };
}

async function doctor() {
  const base = apiBase();
  const health = await readHealth(base);
  const state = readState();
  if (!health.ok) {
    console.log(`doctor fail base ${base}`);
    if (health.error) console.log(`health ${health.error}`);
    else console.log(`health status ${health.status} body ${health.json ? JSON.stringify(health.json) : 'not json'}`);
    process.exit(1);
  }
  if (state?.owned) {
    const ps = compose(['ps', '--services', '--status', 'running']);
    if (ps.error || ps.status !== 0) {
      console.log(`doctor fail base ${base}`);
      console.log(`compose ps ${ps.error ? ps.error.message : (ps.stderr || ps.stdout || '').trim()}`);
      process.exit(1);
    }
    const running = (ps.stdout || '').split('\n').map((line) => line.trim()).filter(Boolean);
    for (const name of ['postgres', 'api']) {
      if (!running.includes(name)) {
        console.log(`doctor fail base ${base}`);
        console.log(`service ${name} not running`);
        process.exit(1);
      }
    }
  }
  console.log('doctor ok');
  console.log(`base ${base}`);
  console.log(`health ${health.status} ok true service ${health.json.service}`);
  if (state) console.log(`owned ${Boolean(state.owned)} adopted ${Boolean(state.adopted)}`);
}

function failLaunch(message) {
  writeLaunchEvidence(message);
  process.exit(1);
}

async function launch() {
  const base = process.env.E2E_API_URL || process.env.DV_VERIFY_API_URL || 'http://127.0.0.1:3000';
  const normalized = base.replace(/\/$/, '');
  const healthy = await readHealth(normalized);
  if (healthy.ok) {
    const previous = readState();
    const sameBase = !previous?.base || previous.base === normalized;
    const owned = previous?.owned === true && sameBase;
    writeState({
      base: normalized,
      owned,
      adopted: !owned,
      project: previous?.project || PROJECT,
      composeFile: previous?.composeFile || COMPOSE_FILE,
    });
    await doctor();
    clearLaunchEvidence();
    if (owned) {
      console.log('launch ready');
      console.log('owned true');
    } else {
      console.log('launch adopted');
      console.log('launch ready');
    }
    return;
  }
  const docker = dockerComposeAvailable();
  if (!docker.ok) {
    failLaunch(`launch fail docker ${docker.detail}`);
  }
  const existing = existingContainerIds();
  if (existing.error) {
    failLaunch(`launch fail compose ps ${existing.error}`);
  }
  const previous = readState();
  const owned = existing.ids.length === 0 || previous?.owned === true;
  writeState({
    base: base.replace(/\/$/, ''),
    owned,
    adopted: false,
    project: PROJECT,
    composeFile: COMPOSE_FILE,
  });
  console.log(`launch compose up postgres api owned ${owned}`);
  const up = await composeStreaming(['up', '-d', 'postgres', 'api']);
  if (up.code !== 0) {
    const tail = up.output.trim().split('\n').slice(-40).join('\n');
    failLaunch(`launch fail compose up exit ${up.code}\n${tail}`);
  }
  const waitMs = Number(process.env.DV_VERIFY_API_WAIT_MS || 180000);
  const deadline = Date.now() + waitMs;
  let last = healthy.error || `status ${healthy.status}`;
  while (Date.now() < deadline) {
    const health = await readHealth(base.replace(/\/$/, ''));
    if (health.ok) {
      await doctor();
      clearLaunchEvidence();
      console.log('launch ready');
      console.log(`owned ${owned}`);
      return;
    }
    last = health.error || `status ${health.status}`;
    const exited = compose(['ps', '-a', '--status', 'exited', '--services']);
    const exitedNames = (exited.stdout || '').split('\n').map((line) => line.trim());
    if (exitedNames.includes('api') || exitedNames.includes('postgres')) {
      console.log(`launch retry compose up (${exitedNames.filter(Boolean).join(' ')})`);
      const again = await composeStreaming(['up', '-d', 'postgres', 'api']);
      if (again.code !== 0) {
        last = `compose up exit ${again.code}`;
      }
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  failLaunch(`launch fail health ${last}`);
}

async function cleanup() {
  const state = readState();
  if (state?.owned) {
    const down = await composeStreaming(['down']);
    if (down.code !== 0) {
      console.log(`cleanup fail compose down exit ${down.code}`);
      console.log(`cleanup state kept ${statePath}`);
      process.exit(1);
    }
    console.log('cleanup compose down');
  } else {
    console.log('cleanup no owned stack');
  }
  fs.rmSync(runDir, { recursive: true, force: true });
  const evidenceOk = fs.existsSync(evidenceDir);
  console.log(`cleanup evidence kept ${evidenceOk} ${evidenceDir}`);
}

function runSmoke(base) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [smokePath], {
      cwd: repoRoot,
      env: { ...process.env, E2E_API_URL: base },
    });
    const chunks = [];
    child.stdout.on('data', (buf) => {
      chunks.push(buf);
      process.stdout.write(buf);
    });
    child.stderr.on('data', (buf) => {
      chunks.push(buf);
      process.stderr.write(buf);
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      chunks.push(Buffer.from('\nerror timeout 120s\n'));
    }, 120000);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        signal,
        output: Buffer.concat(chunks).toString('utf8'),
      });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: 1, signal: null, output: `error ${err.message}\n` });
    });
  });
}

async function drive() {
  const base = apiBase();
  const header = [
    'feature api-smoke',
    'action node e2e/api-e2e.mjs',
    `action_url ${base}`,
  ];
  const result = await runSmoke(base);
  const done = result.output.includes('=== api e2e DONE ===');
  const lines = [
    ...header,
    `exit_code ${result.code}`,
    `result ${done ? 'api e2e DONE' : 'api e2e failed'}`,
    '--- output ---',
    result.output.replace(/\s+$/, ''),
  ];
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, 'api-smoke.txt');
  fs.writeFileSync(evidencePath, `${lines.join('\n')}\n`);
  console.log(`evidence ${evidencePath}`);
  if (result.code !== 0 || !done) process.exit(1);
}

const [cmd] = process.argv.slice(2);
if (cmd === 'launch') {
  await launch();
} else if (cmd === 'doctor') {
  await doctor();
} else if (cmd === 'drive') {
  await drive();
} else if (cmd === 'cleanup') {
  await cleanup();
} else {
  console.log('usage: dv-verify-api.mjs launch|doctor|drive|cleanup');
  process.exit(2);
}
