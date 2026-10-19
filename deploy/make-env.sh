#!/usr/bin/env bash
#
# สร้าง .env สำหรับ VPS — สุ่มรหัสผ่าน DB และ JWT_SECRET ให้ ไม่ต้องพิมพ์ความลับเอง
#
# ใช้ (บน VPS ในโฟลเดอร์แอป):
#   cd ~/ai-cv-analyzer
#   bash make-env.sh cv.example.com            # โดเมนของแอป
#   bash make-env.sh cv.example.com --ai       # เปิด Ollama ด้วย (RAM ว่าง ≥ 6 GB)
#
# ไม่เขียนทับ .env เดิม (รหัส DB เปลี่ยนแล้วจะเข้า volume เดิมไม่ได้)
# API key ภายนอก (SMTP / Careerjet / Google / Gemini) เว้นว่างไว้ → เปิด .env ใส่เองภายหลัง
set -euo pipefail

DOMAIN="${1:-}"
AI="${2:-}"

if [ -z "$DOMAIN" ]; then
  echo "ใช้: bash make-env.sh <โดเมน> [--ai]" >&2
  exit 1
fi

if [ -e .env ]; then
  echo ".env มีอยู่แล้ว — ไม่เขียนทับ (ถ้าจะสร้างใหม่ให้ย้ายไฟล์เดิมออกก่อน)" >&2
  exit 1
fi

OWNER_REPO="${OWNER_REPO:-thebaoxcucumber/ai-cv-analyzer}"
APP_PORT="${APP_PORT:-3310}"

rand() { openssl rand -hex "$1"; }

if [ "$AI" = "--ai" ]; then
  PROFILES="ai"
  EMBEDDING="EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=qwen3-embedding:0.6b
EMBEDDING_DIMENSIONS=1024
QDRANT_COLLECTION=resume_chunks_ollama_qwen3_1024"
else
  PROFILES=""
  EMBEDDING="# ไม่มี Ollama → embedding ใช้ Gemini (ใส่ GEMINI_API_KEY ด้านล่าง)
EMBEDDING_PROVIDER=gemini
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=1536
QDRANT_COLLECTION=resume_chunks_gemini_1536"
fi

umask 077
cat > .env <<EOF
# สร้างโดย make-env.sh เมื่อ $(date -u +%Y-%m-%dT%H:%M:%SZ) — ห้าม commit / ห้ามแชร์

APP_IMAGE=ghcr.io/${OWNER_REPO}:latest
MIGRATOR_IMAGE=ghcr.io/${OWNER_REPO}-migrator:latest
APP_PORT=${APP_PORT}
# "ai" = เริ่ม Ollama ด้วยทุกครั้งที่ docker compose up
COMPOSE_PROFILES=${PROFILES}

DB_NAME=ai_resume_analyzer
DB_USER=resume_user
DB_PASSWORD=$(rand 24)
MYSQL_ROOT_PASSWORD=$(rand 24)

NODE_ENV=production
JWT_SECRET=$(rand 48)
JWT_EXPIRES_IN=15m

CORS_ORIGIN=https://${DOMAIN}
FRONTEND_URL=https://${DOMAIN}
OAUTH_PUBLIC_BASE_URL=https://${DOMAIN}

OLLAMA_MODEL=qwen3:4b-instruct
${EMBEDDING}
GEMINI_API_KEY=

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASSWORD=
CAREERJET_API_KEY=unset
JOOBLE_API_KEY=unused
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
EOF

echo "สร้าง .env แล้ว (สิทธิ์ 600) — โดเมน ${DOMAIN}, port 127.0.0.1:${APP_PORT}, profile: ${PROFILES:-ไม่มี}"
echo "ขั้นต่อไป: nano .env ใส่ API key ที่มี แล้ว docker compose pull && docker compose up -d"
