import mysql from "mysql2/promise";

import { env } from "./env.js";

console.log("MySQL runtime config:", {
  host: env.database.host,
  port: env.database.port,
  user: env.database.user,
  database: env.database.name,
  hasPassword: Boolean(env.database.password),
});

export const database = mysql.createPool({
  host: env.database.host,
  port: env.database.port,
  user: env.database.user,
  password: env.database.password,
  database: env.database.name,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  charset: "utf8mb4",

  timezone: "Z",
});

export async function testDatabaseConnection(): Promise<void> {
  const connection = await database.getConnection();

  try {
    await connection.ping();
    console.log("Database connected successfully");
  } finally {
    connection.release();
  }
}