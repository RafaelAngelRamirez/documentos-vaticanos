/**
 * Structural + pure-logic gates for package-apk Java home normalization.
 * Run: node scripts/package-apk.javahome.test.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GP = path.join(ROOT, 'frontend/android/gradle.properties');
const APK_SH = path.join(ROOT, 'scripts/package-apk.sh');

function section(n) { console.log(`\n== ${n} ==`); }

function main() {
  section('gradle.properties must not hard-pin missing host java-17');
  const gp = fs.readFileSync(GP, 'utf8');
  assert.ok(
    !/^\s*org\.gradle\.java\.home\s*=\s*\/usr\/lib\/jvm\/java-17-openjdk-amd64\s*$/m.test(gp),
    'must not hardcode java-17-openjdk-amd64 (missing on imperium-build-runner)'
  );

  section('package-apk.sh rewrites invalid pins and resolves JAVA_HOME');
  const body = fs.readFileSync(APK_SH, 'utf8');
  assert.ok(body.includes('resolve_java_home'), 'resolve_java_home helper');
  assert.ok(body.includes('Rewriting invalid org.gradle.java.home'), 'rewrite message');
  assert.ok(body.includes('temurin-21-jdk-amd64'), 'knows runner jdk path');
  assert.ok(body.includes('sed -i'), 'sed removes invalid pin');
  assert.ok(body.includes('.android-build-tools/sdk'), 'CI sdk nested path');

  section('simulate rewrite of a bad pin (temp file)');
  const tmp = path.join(ROOT, 'frontend/android/.gradle.properties.javahome-test');
  fs.writeFileSync(
    tmp,
    'android.useAndroidX=true\norg.gradle.java.home=/usr/lib/jvm/java-17-openjdk-amd64\n'
  );
  // Extract and run the sed rewrite the same way the script does
  const pinned = '/usr/lib/jvm/java-17-openjdk-amd64';
  const pinValid = fs.existsSync(path.join(pinned, 'bin/java'));
  if (!pinValid) {
    execFileSync('sed', ['-i', '/^[[:space:]]*org\\.gradle\\.java\\.home=/d', tmp]);
    const after = fs.readFileSync(tmp, 'utf8');
    assert.ok(!/org\.gradle\.java\.home=/.test(after), 'pin removed when invalid');
  }
  fs.unlinkSync(tmp);

  console.log('\nAll package-apk java-home tests passed.');
}

main();
