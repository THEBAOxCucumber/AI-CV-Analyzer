// สร้างตารางทั้งหมดจาก database/migrations ลงใน DB ว่าง (CI / เครื่องใหม่)
//
// ใช้: DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=... node scripts/create-schema.mjs
//
// migration ไม่มีตารางบันทึกว่ารันไปแล้ว และบางไฟล์รันซ้ำไม่ได้ (เช่น 014 DROP INDEX)
// → ยอมรันเฉพาะ DB ที่ยังไม่มีตาราง
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import mysql from "mysql2/promise";

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../database/migrations",
);

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

if (!DB_HOST || !DB_USER || !DB_NAME) {
  console.error("ต้องตั้ง DB_HOST, DB_USER, DB_NAME (และ DB_PASSWORD ถ้ามี)");
  process.exit(1);
}

const connection = await mysql.createConnection({
  host: DB_HOST,
  port: Number(DB_PORT ?? 3306),
  user: DB_USER,
  password: DB_PASSWORD ?? "",
  database: DB_NAME,
  multipleStatements: true,
});

try {
  const [tables] = await connection.query(
    "SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
    [DB_NAME],
  );

  if (Number(tables[0].total) > 0) {
    console.error(`${DB_NAME} มีตารางอยู่แล้ว — สคริปต์นี้ใช้กับ DB ว่างเท่านั้น`);
    process.exit(1);
  }

  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    await connection.query(sql);
    console.log(`applied ${file}`);
  }

  const [after] = await connection.query(
    "SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
    [DB_NAME],
  );

  console.log(`เสร็จ: ${DB_NAME} มี ${after[0].total} ตาราง (${files.length} migrations)`);
} finally {
  await connection.end();
}
