import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  DATA_PARTITION,
  DEFAULT_PORT,
  FORBIDDEN_PORTS,
  MEMORY_MB,
  MIN_DISK_BYTES,
  MIN_MEM_MB,
  emulatorArgs,
  gateReasons,
  systemImageFile,
  judgeLector,
  kvmOpenable,
  memAvailableMb,
  patchAvdConfig,
  pickSocket,
  webviewSockets,
} from './dv-verify-android.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dv-verify-android.mjs');

test('usage exits 2', () => {
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stdout, /usage: dv-verify-android\.mjs launch\|doctor\|drive <lector>\|cleanup/);
});

test('memory parser', () => {
  assert.equal(memAvailableMb('MemAvailable:       5120000 kB\n'), 5000);
  assert.equal(memAvailableMb('MemFree: 1 kB\n'), null);
});

test('gates refuse a host that cannot run the emulator', () => {
  const reasons = gateReasons({
    kvm: { ok: false, reason: 'launch fail kvm permission' },
    memMb: 512,
    diskBytes: 1024,
    emulatorExists: false,
    adbExists: false,
    port: 5580,
  });
  assert.ok(reasons.includes('launch fail kvm permission'));
  assert.ok(reasons.includes('launch fail port reserved 5580'));
  assert.ok(reasons.some((reason) => reason.startsWith('launch fail memory')));
  assert.ok(reasons.includes('launch fail disk'));
  assert.ok(reasons.includes('launch fail sdk emulator'));
  assert.ok(reasons.includes('launch fail sdk adb'));
  assert.ok(MIN_MEM_MB >= 2048);
  assert.ok(MIN_DISK_BYTES >= 8 * 1024 * 1024 * 1024);
  assert.ok(FORBIDDEN_PORTS.has(5564));
  assert.ok(FORBIDDEN_PORTS.has(5580));
});

test('gates pass a host with kvm, memory, disk, and the sdk', () => {
  const reasons = gateReasons({
    kvm: { ok: true, reason: 'kvm ok' },
    memMb: MIN_MEM_MB,
    diskBytes: MIN_DISK_BYTES,
    emulatorExists: true,
    adbExists: true,
    port: DEFAULT_PORT,
  });
  assert.deepEqual(reasons, []);
});

test('emulator command does not wipe userdata', () => {
  const args = emulatorArgs({ avd: 'dv_verify', port: DEFAULT_PORT, memoryMb: MEMORY_MB });
  assert.equal(args.includes('-wipe-data'), false);
  assert.equal(args.includes('-no-window'), true);
  assert.deepEqual(args.slice(0, 4), ['-avd', 'dv_verify', '-port', String(DEFAULT_PORT)]);
  assert.equal(args.at(-1), '-no-metrics');
});

test('new avd config keeps a small ram and data partition', () => {
  const patched = patchAvdConfig('hw.ramSize=4096\nhw.keyboard=no\n', {
    ramMb: MEMORY_MB,
    dataPartition: DATA_PARTITION,
  });
  assert.match(patched, new RegExp(`hw.ramSize=${MEMORY_MB}`));
  assert.match(patched, new RegExp(`disk.dataPartition.size=${DATA_PARTITION}`));
  assert.match(patched, /hw.keyboard=yes/);
  assert.equal(patched.includes('-wipe-data'), false);
  assert.equal(patched.split('\n').filter((line) => line.startsWith('hw.ramSize=')).length, 1);
});

test('webview socket prefers the app pid', () => {
  const dump = [
    '00000000: 00000002 00000000 00010000 0001 01 1 @webview_devtools_remote_10',
    '00000000: 00000002 00000000 00010000 0001 01 2 @webview_devtools_remote_77',
  ].join('\n');
  const names = webviewSockets(dump);
  assert.deepEqual(pickSocket(names, '77'), 'webview_devtools_remote_77');
  assert.equal(pickSocket([], '77'), null);
});

test('lector proof is the cite url, the paper, and no bottom nav', () => {
  assert.deepEqual(
    judgeLector({
      href: 'https://localhost/leyendo/cic-es/u/2',
      lector: true,
      punto: true,
      bnav: 0,
    }),
    [],
  );
  assert.deepEqual(
    judgeLector({
      href: 'https://localhost/leyendo/cic-es/punto/2',
      lector: false,
      punto: false,
      bnav: 1,
    }),
    ['url', 'app-lector', 'app-punto', 'bnav'],
  );
});

test('system image path is the unpacked directory', () => {
  assert.equal(
    systemImageFile('/sdk'),
    '/sdk/system-images/android-34/default/x86_64/system.img',
  );
  assert.equal(systemImageFile('/sdk').includes(';'), false);
});

test('kvm device that is not there is a missing-device failure', () => {
  const result = kvmOpenable('/no/such/dev/kvm-dv-verify');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'launch fail kvm missing');
});
