#!/usr/bin/env bash
#
# สำรองข้อมูล AI CV Analyzer — รันบน VPS ในโฟลเดอร์แอป (ไม่ต้องหยุดเว็บ)
#
#   cd ~/ai-cv-analyzer
#   bash backup.sh
#
# ได้ 3 ไฟล์ต่อรอบใน backups/ (ชื่อมีวันเวลา UTC):
#   db-*.sql.gz          MySQL ทั้งฐาน (บัญชี, Resume, ผลวิเคราะห์, audit log)
#   uploads-*.tar.gz     ไฟล์ PDF ที่ผู้ใช้อัปโหลด
#   qdrant-*.snapshot    vector ของ collection ที่ใช้อยู่ (ค้นหาใน Resume)
# Redis (คิวงาน) ไม่ต้องสำรอง — เป็นข้อมูลชั่วคราว
#
# เก็บ KEEP_DAYS วัน (ค่าเริ่มต้น 14) แล้วลบชุดเก่าทิ้ง
# ไฟล์มีข้อมูลส่วนตัวของผู้ใช้ → โฟลเดอร์ backups/ ตั้งสิทธิ์ 700
# ขั้นไหนล้ม → ลบไฟล์ของรอบนี้ทั้งหมด ไม่เหลือ backup ครึ่งๆ กลางๆ
set -euo pipefail

cd "$(dirname "$0")"

KEEP_DAYS="${KEEP_DAYS:-14}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"

DB_FILE="$BACKUP_DIR/db-$STAMP.sql.gz"
UPLOADS_FILE="$BACKUP_DIR/uploads-$STAMP.tar.gz"
QDRANT_FILE="$BACKUP_DIR/qdrant-$STAMP.snapshot"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
umask 077

cleanup_on_error() {
  echo "$(date -u +%FT%TZ) backup ล้มเหลว — ลบไฟล์ของรอบนี้" >&2
  rm -f "$DB_FILE" "$UPLOADS_FILE" "$QDRANT_FILE"
}
trap cleanup_on_error ERR

echo "$(date -u +%FT%TZ) เริ่ม backup $STAMP"

# 1) MySQL — single-transaction = snapshot ที่สอดคล้องกันโดยไม่ล็อกตาราง
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --triggers --no-tablespaces --default-character-set=utf8mb4 "$MYSQL_DATABASE"' \
  | gzip > "$DB_FILE"
gzip -t "$DB_FILE"
zcat "$DB_FILE" | tail -n 1 | grep -q "Dump completed" || { echo "dump ไม่สมบูรณ์" >&2; false; }
echo "  db       $(du -h "$DB_FILE" | cut -f1)"

# 2) ไฟล์ PDF — tar จากใน container (image มี tar)
docker compose exec -T app tar czf - -C /app uploads > "$UPLOADS_FILE"
gzip -t "$UPLOADS_FILE"
echo "  uploads  $(du -h "$UPLOADS_FILE" | cut -f1)"

# 3) Qdrant — snapshot ของ collection ผ่าน API (image qdrant ไม่มี curl → ใช้ node ใน app)
docker compose exec -T app node -e '
  const base = process.env.QDRANT_URL;
  const collection = encodeURIComponent(process.env.QDRANT_COLLECTION);
  (async () => {
    const exists = await fetch(`${base}/collections/${collection}`);
    if (exists.status === 404) { console.error("ยังไม่มี collection — ข้าม"); return; }
    const created = await fetch(`${base}/collections/${collection}/snapshots?wait=true`, { method: "POST" });
    if (!created.ok) throw new Error(`create snapshot: HTTP ${created.status}`);
    const name = encodeURIComponent((await created.json()).result.name);
    const file = await fetch(`${base}/collections/${collection}/snapshots/${name}`);
    if (!file.ok) throw new Error(`download snapshot: HTTP ${file.status}`);
    process.stdout.write(Buffer.from(await file.arrayBuffer()));
    await fetch(`${base}/collections/${collection}/snapshots/${name}`, { method: "DELETE" });
  })().catch((error) => { console.error(error.message); process.exit(1); });
' > "$QDRANT_FILE"
if [ -s "$QDRANT_FILE" ]; then
  echo "  qdrant   $(du -h "$QDRANT_FILE" | cut -f1)"
else
  rm -f "$QDRANT_FILE"
fi

trap - ERR

# ลบชุดที่เก่ากว่า KEEP_DAYS วัน
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*' -o -name 'uploads-*' -o -name 'qdrant-*' \) -mtime +"$KEEP_DAYS" -delete

echo "$(date -u +%FT%TZ) เสร็จ — เก็บไว้ $(ls "$BACKUP_DIR" | grep -c '^db-') ชุด ใน $BACKUP_DIR/"
