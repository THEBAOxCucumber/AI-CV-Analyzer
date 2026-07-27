import mysql from "mysql2/promise";

import { env } from "./env.js";

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