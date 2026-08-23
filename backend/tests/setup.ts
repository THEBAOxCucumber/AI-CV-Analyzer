import { afterAll } from "vitest";

import {
  database,
} from "../src/config/database.js";

import {
  redisConnection,
} from "../src/config/redis.js";

afterAll(async () => {
  await database.end();
  await redisConnection.quit();
});