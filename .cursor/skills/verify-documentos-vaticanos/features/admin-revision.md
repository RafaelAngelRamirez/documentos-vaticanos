# Revisión admin

The review queue is path `admin/revision`. One theme is `admin/revision/:id`. Both components send an anonymous visitor to `/cuenta`. A signed-in non-admin sees `Se requiere rol admin`. The queue itself (Pendientes, the link Revisión) requires an admin session.

## Sub-features

- `admin/revision` is the queue. Anonymous result is a redirect to `/cuenta`.
- `admin/revision/:id` is one theme. Anonymous result is the same redirect.
- `admin-queue` (Pendientes, Revisión) is reachable only when `auth.isAdmin` is true.

## How to get to it (user POV)

- Open `/admin/revision` while signed in as admin.
- Open a row to reach `/admin/revision/:id`.
- Signed-out, both URLs leave you on `/cuenta`.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Anonymous queue.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive admin-revision`. The result URL contains `/cuenta`. The attempted path was `/admin/revision`.
- **Anonymous detail.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive admin-revision-detalle`. The result URL contains `/cuenta`. The attempted path was `/admin/revision/verify-missing`.

## Gotchas

- Do not call the redirect a verified queue. The unmet prerequisite is an admin session (`auth.isAdmin` in `admin-revision.component.ts`).
- The helper has no login step. Reaching Pendientes needs `DV_VERIFY_BASE_URL` pointed at a stack with `DEV_AUTH_BYPASS` and a manual admin user. That is out of the anonymous drive.
