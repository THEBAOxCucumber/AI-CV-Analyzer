// รัน migration ที่ยังไม่เคยรัน (ใช้ใน Docker: service migrate รันแล้วจบ)
//
// ใช้: DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=... node scripts/migrate.mjs
//
// - จดไฟล์ที่รันแล้วในตาราง schema_migrations → รันซ้ำได้ (ไม่มีไฟล์ใหม่ = จบเฉยๆ exit 0)
// - DB มีตารางอยู่แล้วแต่ไม่มีบันทึก (สร้างด้วย create-schema / มือ) → หยุด ไม่รันทับ
//   ถ้าแน่ใจว่า DB ตรงกับ migration ล่าสุดแล้ว: MIGRATE_BASELINE=1 = จดว่ารันครบโดยไม่รัน SQL
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import mysql from "mysql2/promise";

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../database/migrations",
);

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, MIGRATE_BASELINE } = process.env;

if (!DB_HOST || !DB_USER || !DB_NAME) {
  console.error("ต้องตั้ง DB_HOST, DB_USER, DB_NAME (และ DB_PASSWORD ถ้ามี)");
  process.exit(1);
}

async function connect() {
  for (let attempt = 1; ; attempt++) {
    try {
      return await mysql.createConnection({
        host: DB_HOST,
        port: Number(DB_PORT ?? 3306),
        user: DB_USER,
        password: DB_PASSWORD ?? "",
        database: DB_NAME,
        multipleStatements: true,
      });
    } catch (error) {
      if (attempt >= 10) throw error;
      console.log(`รอ MySQL (${attempt}/10): ${error.code ?? error.message}`);
      await sleep(3000);
    }
  }
}

const connection = await connect();

try {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await connection.query("SELECT filename FROM schema_migrations");
  const applied = new Set(rows.map((row) => row.filename));

  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (applied.size === 0) {
    const [tables] = await connection.query(
      "SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> 'schema_migrations'",
      [DB_NAME],
    );

    if (Number(tables[0].total) > 0) {
      if (MIGRATE_BASELINE !== "1") {
        console.error(
          `${DB_NAME} มีตารางอยู่แล้วแต่ไม่มีบันทึกใน schema_migrations — ไม่รันทับ\n` +
          "ถ้า DB ตรงกับ migration ล่าสุดแล้ว ให้รันอีกครั้งด้วย MIGRATE_BASELINE=1",
        );
        process.exit(1);
      }

      for (const file of files) {
        await connection.query("INSERT INTO schema_migrations (filename) VALUES (?)", [file]);
      }

      console.log(`baseline: จดว่า ${files.length} migrations รันแล้ว (ไม่ได้รัน SQL)`);
      process.exit(0);
    }
  }

  const pending = files.filter((file) => !applied.has(file));

  for (const file of pending) {
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    await connection.query(sql);
    await connection.query("INSERT INTO schema_migrations (filename) VALUES (?)", [file]);
    console.log(`applied ${file}`);
  }

  console.log(
    pending.length === 0
      ? `ไม่มี migration ใหม่ (${files.length} ไฟล์รันครบแล้ว)`
      : `เสร็จ: รัน ${pending.length} migrations`,
  );
} finally {
  await connection.end();
}
