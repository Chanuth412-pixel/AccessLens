import "dotenv/config";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const aiProvider = process.env.AI_PROVIDER ?? (
  process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY?.startsWith("gsk_")
    ? "groq"
    : "openai"
);

export const config = {
  port: Number(process.env.PORT ?? 4000),
  frontendOrigins: (process.env.FRONTEND_ORIGIN ?? "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  ai: {
    provider: aiProvider,
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    groqApiKey: process.env.GROQ_API_KEY ?? (
      process.env.OPENAI_API_KEY?.startsWith("gsk_") ? process.env.OPENAI_API_KEY : ""
    ),
    groqBaseUrl: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
    model: process.env.AI_MODEL ?? (
      aiProvider === "groq"
        ? "openai/gpt-oss-20b"
        : "gpt-5-mini"
    )
  },
  database: {
    host: requiredEnv("DB_HOST"),
    port: Number(process.env.DB_PORT ?? 5432),
    database: requiredEnv("DB_NAME"),
    user: requiredEnv("DB_USER"),
    password: requiredEnv("DB_PASSWORD"),
    ssl: process.env.DB_SSL === "true"
  }
};
