import "dotenv/config";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "*",
  database: {
    host: requiredEnv("DB_HOST"),
    port: Number(process.env.DB_PORT ?? 5432),
    database: requiredEnv("DB_NAME"),
    user: requiredEnv("DB_USER"),
    password: requiredEnv("DB_PASSWORD"),
    ssl: process.env.DB_SSL === "true"
  }
};
