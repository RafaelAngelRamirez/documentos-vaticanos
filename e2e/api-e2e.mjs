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
        idToken: 'dev:e2e-user@example.com:E2E User',
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

  // personal reference
  {
    const r = await fetch(`${API}/api/v1/me/references`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${globalThis.__token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentId: 'cic-es',
        unitIndex: 100,
        unitLabel: 'CIC test',
      }),
    });
    assert(r.ok, `ref create ${r.status}`);
    const j = await r.json();
    assert(j.item?.id, 'ref id');
    globalThis.__refId = j.item.id;
  }

  {
    const r = await fetch(`${API}/api/v1/me/references`, {
      headers: { Authorization: `Bearer ${globalThis.__token}` },
    });
    assert(r.ok, `ref list ${r.status}`);
    const j = await r.json();
    assert(Array.isArray(j.items) && j.items.length >= 1, 'ref list non-empty');
  }

  // theme
  {
    const r = await fetch(`${API}/api/v1/me/themes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${globalThis.__token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Tema e2e', description: 'test' }),
    });
    assert(r.ok, `theme create ${r.status}`);
    const j = await r.json();
    assert(j.item?.id, 'theme id');
    globalThis.__themeId = j.item.id;
  }

  {
    const r = await fetch(
      `${API}/api/v1/me/themes/${globalThis.__themeId}/steps`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${globalThis.__token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          steps: [
            {
              documentId: 'cic-es',
              unitIndex: 100,
              unitLabel: 'CIC test',
              userComment: 'nota',
            },
          ],
        }),
      }
    );
    assert(r.ok, `theme steps ${r.status}`);
    const j = await r.json();
    assert(j.item?.steps?.length === 1, 'theme has 1 step');
  }

  // study as teacher
  {
    const r = await fetch(`${API}/api/v1/studies`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${globalThis.__token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Estudio e2e', description: 'demo' }),
    });
    assert(r.ok, `study create ${r.status}`);
    const j = await r.json();
    assert(j.item?.id, 'study id');
    globalThis.__studyId = j.item.id;
  }

  {
    const r = await fetch(`${API}/api/v1/studies/${globalThis.__studyId}/steps`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${globalThis.__token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        steps: [
          {
            documentId: 'cic-es',
            unitIndex: 100,
            unitLabel: 'CIC test',
            teacherNote: 'lee esto',
          },
        ],
      }),
    });
    assert(r.ok, `study steps ${r.status}`);
  }

  {
    const r = await fetch(
      `${API}/api/v1/studies/${globalThis.__studyId}/publish`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${globalThis.__token}` },
      }
    );
    assert(r.ok, `study publish ${r.status}`);
    const j = await r.json();
    assert(j.item?.status === 'published', 'published status');
  }

  {
    const r = await fetch(`${API}/api/v1/studies`);
    assert(r.ok, `studies list ${r.status}`);
    const j = await r.json();
    assert(Array.isArray(j.items), 'studies array');
  }

  // second student enrolls
  {
    const login = await fetch(`${API}/api/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'dev:alumno@example.com:Alumno E2E' }),
    });
    assert(login.ok, 'student login');
    const { accessToken } = await login.json();
    const r = await fetch(
      `${API}/api/v1/studies/${globalThis.__studyId}/enroll`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    assert(r.ok, `enroll ${r.status}`);
  }

  console.log('=== api e2e DONE ===');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
