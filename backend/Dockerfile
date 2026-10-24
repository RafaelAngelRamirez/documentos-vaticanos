FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY prisma ./prisma

RUN npm install \
  && npx prisma generate

COPY tsconfig.json ./
COPY src ./src

# Compile for production image; docker-compose.dev overrides with tsx
RUN npm run build \
  && mkdir -p uploads

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/index.js"]
