import dotenv from "dotenv";

dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }

  return value;
}

function getNumberEnv(name: string, defaultValue: number): number {
  const value = process.env[name];

  if (!value) {
    return defaultValue;
  }

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }

  return numberValue;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: getNumberEnv("PORT", 5000),

  database: {
    host: getRequiredEnv("DB_HOST"),
    port: getNumberEnv("DB_PORT", 3306),
    user: getRequiredEnv("DB_USER"),
    password: process.env.DB_PASSWORD ?? "",
    name: getRequiredEnv("DB_NAME"),
  },

  jwt: {
    secret: getRequiredEnv("JWT_SECRET"),
    expiresIn: process.env.JWT_EXPIRES_IN ?? "1d",
  },
};