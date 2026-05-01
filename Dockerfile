# ── Stage 1: build frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: build backend ────────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# ── Stage 3: production image ─────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Backend runtime deps only
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Compiled backend
COPY --from=backend-builder /app/backend/dist ./backend/dist

# Built frontend (served as static files by Express)
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=8080
# DB_PATH is set in fly.toml to the mounted volume
EXPOSE 8080

CMD ["node", "backend/dist/index.js"]
