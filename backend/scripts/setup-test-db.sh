#!/usr/bin/env bash
#
# สร้าง/รีเซ็ต DB สำหรับเทสต์ (ai_resume_analyzer_test)
# สร้างตารางจาก database/migrations (แบบเดียวกับ CI) — ไม่แตะ DB dev
#
# ใช้: npm run test:db:setup
# รันซ้ำได้ทุกครั้งหลังเพิ่ม migration (ตารางในเทสต์ DB จะถูกสร้างใหม่)
#
set -euo pipefail

CONTAINER="${MYSQL_CONTAINER:-resume-mysql}"
ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root_password}"
TEST_DB="${TEST_DB:-ai_resume_analyzer_test}"
APP_USER="${DB_USER:-resume_user}"

case "$TEST_DB" in
  *_test) ;;
  *)
    echo "TEST_DB ต้องลงท้ายด้วย _test (ได้ '$TEST_DB')" >&2
    exit 1
    ;;
esac

mysql_root() {
  docker exec -i "$CONTAINER" mysql -uroot -p"$ROOT_PASSWORD" "$@"
}

echo "สร้าง $TEST_DB และให้สิทธิ์ $APP_USER"
mysql_root -e "
  DROP DATABASE IF EXISTS \`$TEST_DB\`;
  CREATE DATABASE \`$TEST_DB\`
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  GRANT ALL PRIVILEGES ON \`$TEST_DB\`.* TO '$APP_USER'@'%';
  FLUSH PRIVILEGES;
" 2>/dev/null

echo "สร้างตารางจาก migrations"
DB_HOST="${MYSQL_HOST:-127.0.0.1}" \
DB_PORT="${MYSQL_PORT:-3306}" \
DB_USER=root \
DB_PASSWORD="$ROOT_PASSWORD" \
DB_NAME="$TEST_DB" \
  node "$(dirname "$0")/create-schema.mjs" | tail -1

TABLES=$(mysql_root -N -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$TEST_DB'" 2>/dev/null)
echo "เสร็จ: $TEST_DB มี $TABLES ตาราง"

#
# ล้างสถานะเทสต์ใน Redis ด้วย — id ใน DB ใหม่เริ่มที่ 1 อีกครั้ง
# ถ้า job เก่า "analysis-<id>" ยังค้างในคิว BullMQ จะถูกมองว่าทำแล้ว (jobId ซ้ำ) → เทสต์ worker ค้าง
#
REDIS_CONTAINER="${REDIS_CONTAINER:-resume-redis}"
TEST_QUEUE="${TEST_QUEUE:-resume-analysis-test}"

CLEARED=$(docker exec "$REDIS_CONTAINER" sh -c "
  n=0
  for pattern in 'bull:$TEST_QUEUE:*' 'rate-limit:test:*' 'analysis:rate-limit:test:*'; do
    keys=\$(redis-cli --scan --pattern \"\$pattern\")
    if [ -n \"\$keys\" ]; then
      n=\$((n + \$(echo \"\$keys\" | xargs redis-cli del)))
    fi
  done
  echo \$n
")
echo "ล้าง Redis ของเทสต์: $CLEARED keys"
