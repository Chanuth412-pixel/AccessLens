import { Router } from "express";
import { z } from "zod";
import { listCompletedGuidesForUrl } from "../services/recordingService.js";

export const guidesRouter = Router();

const guideUrlSchema = z.string().url().max(2000).refine(
  (value) => ["http:", "https:"].includes(new URL(value).protocol),
  "Only HTTP and HTTPS URLs are supported"
);

guidesRouter.get("/", async (request, response, next) => {
  try {
    const parsedUrl = guideUrlSchema.safeParse(request.query.url);
    if (!parsedUrl.success) {
      response.status(400).json({ error: "A valid website URL is required" });
      return;
    }

    response.json({ guides: await listCompletedGuidesForUrl(parsedUrl.data) });
  } catch (error) {
    next(error);
  }
});
