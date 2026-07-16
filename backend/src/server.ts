import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";
import { templatesRouter } from "./routes/templates.js";

const app = express();

app.use(
  cors({
    origin: config.frontendOrigin === "*" ? true : config.frontendOrigin
  })
);
app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRouter);
app.use("/api/templates", templatesRouter);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`AccessLens backend running on port ${config.port}`);
});
