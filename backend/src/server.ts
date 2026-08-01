import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { aiRouter } from "./routes/ai.js";
import { developerRouter } from "./routes/developer.js";
import { healthRouter } from "./routes/health.js";
import { requestsRouter } from "./routes/requests.js";
import { templatesRouter } from "./routes/templates.js";

const app = express();

app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  next();
});

app.use(
  cors({
    origin: config.frontendOrigins.includes("*") ? true : config.frontendOrigins,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRouter);
app.use("/api/ai", aiRouter);
app.use("/api/developer", developerRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/requests", requestsRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`AccessLens backend running on port ${config.port}`);
});
