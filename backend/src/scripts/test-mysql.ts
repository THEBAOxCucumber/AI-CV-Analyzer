import "dotenv/config";
import mysql from "mysql2/promise";

const host = process.env.DB_HOST;
const port = Number(process.env.DB_PORT ?? 3306);
const user = process.env.DB_USER;
const password = process.env.DB_PASSWORD;
const database = process.env.DB_NAME;

console.log({
  host,
  port,
  user,
  database,
  hasPassword: Boolean(password),
});

async function main(): Promise<void> {
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    connectTimeout: 10_000,
  });

  const [rows] = await connection.query(
    "SELECT VERSION() AS version, DATABASE() AS databaseName",
  );

  console.log(rows);

  await connection.end();
}

main().catch((error: unknown) => {
  console.dir(error, { depth: null });
  process.exit(1);
});