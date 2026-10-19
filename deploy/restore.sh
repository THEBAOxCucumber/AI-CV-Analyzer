#!/usr/bin/env bash
#
# กู้คืนข้อมูลจาก backup.sh — รันบน VPS ในโฟลเดอร์แอป
#
#   cd ~/ai-cv-analyzer
#   ls backups/                       # ดูชุดที่มี เช่น db-20261020-200000.sql.gz
#   bash restore.sh 20261020-200000   # ใส่วันเวลาของชุดที่ต้องการ
#
# ⚠ เขียนทับข้อมูลปัจจุบันทั้งหมด (ฐานข้อมูล + ไฟล์ PDF + vector) ด้วยข้อมูลของชุดนั้น
#   ข้อมูลที่เกิดหลังเวลา backup จะหายไป → สคริปต์ backup สถานะปัจจุบันให้อีกชุดก่อนกู้คืน
set -euo pipefail

cd "$(dirname "$0")"

BACKUP_DIR="${BACKUP_DIR:-backups}"
STAMP="${1:-}"

if [ -z "$STAMP" ]; then
  echo "ใช้: bash restore.sh <วันเวลา>   เช่น bash restore.sh 20261020-200000" >&2
  echo "ชุดที่มี:" >&2
  ls "$BACKUP_DIR" 2>/dev/null | sed -n 's/^db-\(.*\)\.sql\.gz$/  \1/p' >&2
  exit 1
fi

DB_FILE="$BACKUP_DIR/db-$STAMP.sql.gz"
UPLOADS_FILE="$BACKUP_DIR/uploads-$STAMP.tar.gz"
QDRANT_FILE="$BACKUP_DIR/qdrant-$STAMP.snapshot"

[ -f "$DB_FILE" ] || { echo "ไม่พบ $DB_FILE" >&2; exit 1; }
gzip -t "$DB_FILE"
[ ! -f "$UPLOADS_FILE" ] || gzip -t "$UPLOADS_FILE"

echo "จะกู้คืนข้อมูลชุด $STAMP ทับข้อมูลปัจจุบัน:"
echo "  $DB_FILE"
[ -f "$UPLOADS_FILE" ] && echo "  $UPLOADS_FILE"
[ -f "$QDRANT_FILE" ] && echo "  $QDRANT_FILE"

if [ "${CONFIRM:-}" != "restore" ]; then
  read -r -p 'พิมพ์ restore เพื่อยืนยัน: ' answer
  [ "$answer" = "restore" ] || { echo "ยกเลิก"; exit 1; }
fi

# กันพลาด: เก็บสถานะปัจจุบันไว้ก่อน (ย้อนกลับได้ถ้าเลือกชุดผิด)
echo "สำรองสถานะปัจจุบันก่อนกู้คืน..."
bash ./backup.sh

# 1) MySQL — dump มี DROP TABLE IF EXISTS ทุกตาราง
echo "กู้คืนฐานข้อมูล..."
zcat "$DB_FILE" | docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --default-character-set=utf8mb4 "$MYSQL_DATABASE"'

# 2) ไฟล์ PDF — ล้างของเดิมแล้วแตกไฟล์ของชุดนั้น
if [ -f "$UPLOADS_FILE" ]; then
  echo "กู้คืนไฟล์ PDF..."
  docker compose exec -T app sh -c 'rm -rf /app/uploads/resumes && tar xzf - -C /app' < "$UPLOADS_FILE"
fi

# 3) Qdrant — อัปโหลด snapshot ทับ collection เดิม
if [ -f "$QDRANT_FILE" ]; then
  echo "กู้คืน vector..."
  docker compose exec -T app node -e '
    const base = process.env.QDRANT_URL;
    const collection = encodeURIComponent(process.env.QDRANT_COLLECTION);
    (async () => {
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      const form = new FormData();
      form.append("snapshot", new Blob([Buffer.concat(chunks)]), "restore.snapshot");
      const response = await fetch(`${base}/collections/${collection}/snapshots/upload?priority=snapshot&wait=true`, { method: "POST", body: form });
      if (!response.ok) throw new Error(`upload snapshot: HTTP ${response.status} ${await response.text()}`);
    })().catch((error) => { console.error(error.message); process.exit(1); });
  ' < "$QDRANT_FILE"
fi

echo "กู้คืนชุด $STAMP เสร็จ"
docker compose ps
