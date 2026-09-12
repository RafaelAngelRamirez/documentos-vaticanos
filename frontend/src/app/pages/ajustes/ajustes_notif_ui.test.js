/**
 * Structural wiring: Ajustes notification toggles.
 * Run: node src/app/pages/ajustes/ajustes_notif_ui.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const FE = path.resolve(__dirname, '../..');

function read(rel) {
  const p = path.join(FE, rel);
  assert.ok(fs.existsSync(p), `missing ${rel}`);
  return fs.readFileSync(p, 'utf8');
}

function main() {
  const html = read('pages/ajustes/ajustes.component.html');
  const ts = read('pages/ajustes/ajustes.component.ts');
  const backup = read('services/backup.service.ts');

  assert.ok(/data-testid=["']ajustes-notif-enable["']/.test(html));
  assert.ok(/data-testid=["']ajustes-notif-saint["']/.test(html));
  assert.ok(/data-testid=["']ajustes-notif-reading["']/.test(html));
  assert.ok(/data-testid=["']ajustes-notif-reflection["']/.test(html));
  assert.ok(/data-testid=["']ajustes-notif-time["']/.test(html));
  assert.ok(/toggleNotifChannel/.test(ts));
  assert.ok(/NotificationPrefsService/.test(ts));
  assert.ok(/dv\.notif\.prefs\.v1/.test(backup));
  assert.ok(/BACKUP_VERSION = 3/.test(backup));
  console.log('ok ajustes-notif-ui');
}

main();
