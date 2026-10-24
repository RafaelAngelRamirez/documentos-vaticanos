#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function argValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return '';
  return argv[index + 1] || '';
}

function forcedMissing(name) {
  return (process.env.DV_FORCE_MISSING || '')
    .split(/[,\s]+/)
    .filter(Boolean)
    .includes(name);
}

function commandExists(bin) {
  if (!/^[A-Za-z0-9._+-]+$/.test(bin)) return false;
  const found = spawnSync('sh', ['-c', 'command -v "$1"', 'sh', bin], {
    encoding: 'utf8',
  });
  return found.status === 0 && found.stdout.trim() !== '';
}

function aaptPresent() {
  const home = process.env.ANDROID_HOME || '';
  const tools = path.join(home, 'build-tools');
  if (!home || !fs.existsSync(tools)) return false;
  const found = spawnSync('find', [tools, '-type', 'f', '-name', 'aapt'], {
    encoding: 'utf8',
  });
  if (found.status !== 0) return false;
  return found.stdout.split('\n').some((line) => line.trim() !== '');
}

function inputPresent(name) {
  if (forcedMissing(name)) return false;
  if (name === 'aapt') return aaptPresent();
  return commandExists(name);
}

function finish(code, line) {
  if (!line) {
    process.exit(code);
  }
  process.stdout.write(`${line}\n`, () => process.exit(code));
}

function decide(name) {
  if (inputPresent(name)) return { code: 0, line: '' };
  if (process.env.DV_CI === '1') return { code: 1, line: `fail: ${name}` };
  return { code: 0, line: `skip: ${name}` };
}

function selfTest() {
  const script = __filename;
  const base = { ...process.env };
  delete base.DV_CI;
  const cases = [
    {
      env: { ...base, DV_FORCE_MISSING: 'docker' },
      code: 0,
      line: 'skip: docker',
    },
    {
      env: { ...base, DV_CI: '1', DV_FORCE_MISSING: 'docker' },
      code: 1,
      line: 'fail: docker',
    },
  ];
  for (const item of cases) {
    const run = spawnSync(process.execPath, [script, '--need', 'docker'], {
      env: item.env,
      encoding: 'utf8',
    });
    const out = (run.stdout || '').trim();
    if (run.status !== item.code || out !== item.line) {
      process.stderr.write(
        `self-test failed: status=${run.status} out=${JSON.stringify(out)} expected ${item.code} ${item.line}\n`,
      );
      process.exit(1);
    }
  }
  const present = spawnSync(process.execPath, [script, '--need', 'node'], {
    env: base,
    encoding: 'utf8',
  });
  const presentOut = present.stdout || '';
  if (present.status !== 0 || presentOut.includes('skip:') || presentOut.includes('fail:')) {
    process.stderr.write(
      `self-test failed: present tool status=${present.status} out=${JSON.stringify(presentOut)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write('OK ci-skip\n');
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) {
    selfTest();
    return;
  }
  const name = argValue(argv, '--need');
  if (!name || name.startsWith('--')) {
    process.stderr.write('usage: node scripts/ci-skip.js --need <name>\n');
    process.exit(2);
  }
  const result = decide(name);
  finish(result.code, result.line);
}

main();
