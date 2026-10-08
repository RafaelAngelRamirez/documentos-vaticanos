# E2E tests (local / Docker)

## Scrape scripts (offline, no browser)

```bash
# from repo root
node e2e/scrape-e2e.mjs
```

Uses fixtures under `scripts-descarga/fixtures/**` only.

## API (requires backend with DEV_AUTH_BYPASS)

```bash
# docker compose -f docker-compose.dev.yml up -d postgres api
E2E_API_URL=http://127.0.0.1:3000 node e2e/api-e2e.mjs
```

## Web UI (Playwright)

```bash
cd e2e && npm install && npx playwright install chromium
# with frontend already on :4200
E2E_BASE_URL=http://127.0.0.1:4200 npx playwright test
# or auto-start ng serve
E2E_START_WEB=1 npx playwright test
```

## Docker Compose profile

The Playwright image tag must equal the pinned `@playwright/test` version in `e2e/package.json` (exact `x.y.z`, no caret or tilde). `e2e/Dockerfile` is `mcr.microsoft.com/playwright:v1.64.0-jammy` for pin `1.64.0`. `run-dist-smoke.sh` reads that pin for its default image (`PLAYWRIGHT_IMAGE` still overrides).

```bash
docker compose -f docker-compose.dev.yml --profile e2e up --build --abort-on-container-exit e2e
```

## Android

Full Android UI e2e in Docker needs KVM + emulator images (heavy).  
For local APK smoke (host):

```bash
cd frontend && npm run build:cap
cd android && ./gradlew assembleDebug
# adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Documented as host-side; not part of the default `e2e` Compose service.
