# syntax=docker/dockerfile:1
#
# AI CV Analyzer — 1 image ให้ทั้งหน้าเว็บ React + API + worker วิเคราะห์
#
#   docker build -t ai-cv-analyzer .                      → runtime (stage สุดท้าย)
#   docker build --target migrator -t ai-cv-migrator .    → รัน migration แล้วจบ
#
# build ไม่ต่อ DB และไม่ใช้ความลับ — config ทั้งหมดอ่านจาก env ตอนรัน

ARG NODE_IMAGE=node:22-slim

# ---------- 1) build หน้าเว็บ React ----------
FROM ${NODE_IMAGE} AS web-build
WORKDIR /web

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public ./public
COPY src ./src

# ฝังตอน build — ว่าง = เรียก /api บนโดเมนเดียวกัน (แนะนำ)
# ค่าว่าง (deploy.yml ส่งมาเมื่อไม่ได้ตั้ง Variable) → /api
# ต้องไม่ปล่อยเป็น "" เพราะ api.ts ใช้ ?? ซึ่งไม่แทนค่า string ว่าง
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL:-/api}

# typecheck ทำใน CI แล้ว → ที่นี่ build อย่างเดียว
RUN npx vite build

# ---------- 2) build backend (TypeScript → dist) ----------
FROM ${NODE_IMAGE} AS api-build
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ---------- 3) dependencies สำหรับรันจริง (ไม่มี devDependencies) ----------
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ---------- 4) migrator: รัน migration ที่ยังไม่เคยรัน แล้วจบ ----------
FROM ${NODE_IMAGE} AS migrator
WORKDIR /app
ENV NODE_ENV=production

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node backend/package.json ./
COPY --chown=node:node backend/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --chown=node:node backend/database/migrations ./database/migrations

USER node
CMD ["node", "scripts/migrate.mjs"]

# ---------- 5) runtime ----------
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5000 \
    PUBLIC_WEB_DIR=/app/web \
    UPLOAD_DIR=uploads/resumes

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node backend/package.json ./
COPY --from=api-build --chown=node:node /app/dist ./dist
COPY --chown=node:node backend/public ./public
COPY --from=web-build --chown=node:node /web/dist ./web

# โฟลเดอร์ไฟล์ PDF ต้องเป็นของ user node ก่อน mount volume (volume ใหม่จะได้สิทธิ์ตามนี้)
RUN mkdir -p uploads/resumes && chown -R node:node uploads

USER node
EXPOSE 5000

# /api/health ตรวจ DB จริง: 200 = พร้อม, 503 = DB ล่ม (image ไม่มี curl → ใช้ fetch ของ node)
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "dist/server.js"]
