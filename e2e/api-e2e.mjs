/**
 * API smoke e2e (local docker or host API).
 * Requires API at E2E_API_URL (default http://127.0.0.1:3000)
 * and DEV_AUTH_BYPASS=true on the server.
 */
const API = process.env.E2E_API_URL || 'http://127.0.0.1:3000';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log('OK:', msg);
}

async function main() {
  console.log('=== api e2e ===', API);

  // health
  {
    const r = await fetch(`${API}/api/v1/health`);
    assert(r.ok, `health ${r.status}`);
    const j = await r.json();
    assert(j.ok === true || j.status === 'ok' || j.status === 'healthy', 'health body');
  }

  // dev login
  {
    const r = await fetch(`${API}/api/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: 'dev:e2e-user@example.com|E2E User',
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`auth failed ${r.status}: ${t}`);
    }
    const j = await r.json();
    assert(j.accessToken, 'accessToken present');
    assert(j.user?.email, 'user email');
    globalThis.__token = j.accessToken;
    globalThis.__user = j.user;
  }

  // me
  {
    const r = await fetch(`${API}/api/v1/me`, {
      headers: { Authorization: `Bearer ${globalThis.__token}` },
    });
    assert(r.ok, `me ${r.status}`);
    const j = await r.json();
    assert(j.email || j.user?.email, 'me email');
  }

  // upgrade teacher (mounted at /api/v1/upgrade-teacher)
  {
    const r = await fetch(`${API}/api/v1/upgrade-teacher`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${globalThis.__token}` },
    });
    assert(r.ok, `upgrade ${r.status}`);
    const j = await r.json();
    const role = j.role || j.user?.role;
    assert(role === 'teacher', `role teacher got ${role}`);
  }

  console.log('=== api e2e DONE ===');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
