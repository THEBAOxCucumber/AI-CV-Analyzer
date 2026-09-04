import { Redis } from "ioredis";

import { env } from "./env.js";

export function createRedisConnection(): Redis {
  return new Redis({
    host: env.redis.host,
    port: env.redis.port,
    maxRetriesPerRequest: null,
  });
}

export const redisConnection =
  createRedisConnection();

redisConnection.on("connect", () => {
  console.log("Redis connected");
});

redisConnection.on("ready", () => {
  console.log("Redis ready");
});

redisConnection.on("error", (error) => {
  console.error(
    "Redis connection error:",
    error,
  );
});