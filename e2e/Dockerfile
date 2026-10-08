# Playwright e2e runner for web (Chromium). Local / CI.
# Image tag must equal the pinned @playwright/test version in package.json.
FROM mcr.microsoft.com/playwright:v1.64.0-jammy

WORKDIR /e2e
COPY package.json package-lock.json* ./
RUN npm install
COPY . .

# E2E_BASE_URL should point at the web service (e.g. http://web:4200)
ENV E2E_BASE_URL=http://web:4200
CMD ["npx", "playwright", "test"]
