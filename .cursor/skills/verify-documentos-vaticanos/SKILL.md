---
name: verify-documentos-vaticanos
description: "Drive the Documentos Vaticanos web reader (Angular SPA, offline corpus) with dv-verify. Use to launch the packaged web app, doctor it, and prove a route the way a reader would."
---

# Verify Documentos Vaticanos

The primary surface is the web app. The same SPA is packaged for Electron and for the Android WebView. This skill drives the web build. One server per run. Drives are serial. Each drive opens a new browser context.

Anonymous reading does not need the API. Account, studies, and the admin queue do. Those routes record the anonymous end state when no session exists.

## Launch

From the repo root:

```bash
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs launch
```

The command serves the packaged SPA with `node e2e/spa-static.js` (the same static server as `e2e/run-dist-smoke.sh`). It picks `frontend/dist/documentos-vaticanos` when `index.html` is there, otherwise `dist/web`. The default URL is `http://127.0.0.1:4219`. Override the port with `DV_VERIFY_PORT` and the tree with `DV_VERIFY_DIST`.

Ready when stdout contains `launch ready` and `doctor ok`. The pid is stored in `.cursor/skills/verify-documentos-vaticanos/.run/state.json`.

A second `launch` while that pid is alive reuses it. `DV_VERIFY_FORCE_SERVE=1` stops the owned pid and starts a new one.

To doctor a server you already started, set `DV_VERIFY_BASE_URL` (for example `http://127.0.0.1:4200` after `bash scripts/dev.sh`). Launch then records `adopted: true` and does not spawn `spa-static`. Cleanup will not kill that process.

`bash scripts/dev.sh` is the full Docker stack (Postgres, API, `ng serve` on port 4200). Use it only when the feature needs login or sync. Do not start it on 4219. Do not start a second server on a port that already answers.

## Doctor

```bash
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs doctor
```

Run this before the first drive, after any failed drive, and whenever the page looks wedged. The check is read-only.

- `GET /` returns 200 and the body contains `<app-root`.
- `GET /assets/corpus/manifest.json` returns JSON whose `documents` array has at least two entries and includes `cic-es`.
- If `state.json` has a pid and `adopted` is false, that pid is alive.

Stdout `doctor ok` is the pass. Anything else is a fail. Exit code is non-zero on fail.

## Drive

```bash
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive lector
```

Replace `lector` with a feature id from `features/`. The script launches Playwright from `e2e/node_modules/playwright` against Chromium at `/usr/bin/chromium` (`DV_VERIFY_CHROMIUM` overrides the binary). Viewport is 1280×800. The context is anonymous. Before the app boots, the helper writes `reader.prefs.v1` with `uiLocale` and `contentLocale` set to `es`. A fresh context would otherwise follow `navigator.language` (`ReaderPreferencesService.load`).

The reader proof is `drive lector`.

- Action. `GET /leyendo/cic-es/punto/2`.
- Result. The URL contains `/leyendo/cic-es/punto/2`. `app-lector` is attached. `app-punto` is visible. `.bnav` count is 0.

`drive lector-doc` opens `/leyendo/cic-es` and expects the same shell without the bottom nav.

Other ids and the exact URL each one opens are in the feature files. A drive that cannot see its text or selector exits non-zero and still writes the evidence file.

Do not drive two browsers against one mutation at the same time. This app's anonymous reader does not mutate the server. Local storage from a drive dies with the browser context.

## Evidence

Each drive writes `.cursor/skills/verify-documentos-vaticanos/evidence/<feature>.txt`.

The file contains the action URL, the result URL, selector results, and a short text excerpt. That is the proof. A screenshot is not required.

Standards:

- The browser performs the navigation. Do not call a service method or a test-only endpoint.
- Record the action and the resulting state. An exit code alone is not proof.
- The corpus manifest is the production asset. Do not stub it.
- `lector` does not write an account row. The visible `app-punto` text is the side effect that matters.
- Routes that need an admin session say so in the feature file. An anonymous redirect to `/cuenta` is the anonymous result, not a pass of the admin queue.

## Cleanup

```bash
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs cleanup
```

Sends `SIGTERM` only to the pid in `state.json` when `adopted` is not true. Deletes `.run/`. Does not delete `evidence/`.

After a failed drive, run doctor. If doctor passes, the server is healthy and the failure is the page. If doctor fails, run cleanup and launch again. Do not kill a process by name.

## Helpers

`scripts/dv-verify.mjs` drives the app. `scripts/check-map.mjs` checks the map. Both are executable.

```bash
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs launch
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs doctor
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive lector
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs cleanup
```

`scripts/check-map.mjs` checks that `features/README.md` lists exactly the sibling feature files, that each file has the four H2 sections in order, and that every `path:` from `frontend/src/app/pages/pages-routing.module.ts` appears in the map.

```bash
node .cursor/skills/verify-documentos-vaticanos/scripts/check-map.mjs
```

## Feature map

Read `features/README.md`, then the feature file for the route under test. Maintenance of this map is `/maintain-verification-skill`.
