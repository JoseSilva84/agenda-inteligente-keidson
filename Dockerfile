# Multi-stage Dockerfile otimizado para deploy no Coolify (VPS)
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
RUN apk add --no-cache openssl
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npx prisma generate && npm run build

FROM node:20-alpine AS production
WORKDIR /app/backend
RUN apk add --no-cache openssl curl
ENV NODE_ENV=production
ENV PORT=3333

COPY --from=backend-builder /app/backend/package*.json ./
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3333/api/health || exit 1

CMD ["sh", "-c", "npx prisma db push --skip-generate || true && node dist/index.js"]
