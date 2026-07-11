# Root-level backend image (context: repo root)
# Prefer `docker compose -f docker-compose.dev.yml build api` which uses backend/Dockerfile.
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/package-lock.json* ./
RUN npm install

COPY backend/prisma ./prisma
RUN npx prisma generate || true

COPY backend/tsconfig.json ./
COPY backend/src ./src

ENV NODE_ENV=development
ENV PORT=3000
EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
