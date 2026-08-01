import { Router } from "express";
import {
  checkWebsiteRequestStatus,
  submitWebsiteRequest
} from "../services/requestService.js";

export const requestsRouter = Router();

requestsRouter.post("/", async (request, response, next) => {
  try {
    const { url, siteName, userNote } = request.body as {
      url?: string;
      siteName?: string;
      userNote?: string;
    };

    if (!url || typeof url !== "string") {
      response.status(400).json({ error: "Missing required string parameter: url" });
      return;
    }

    const requestRecord = await submitWebsiteRequest(url, siteName, userNote);
    response.status(201).json({ ok: true, request: requestRecord });
  } catch (error) {
    next(error);
  }
});

requestsRouter.get("/check", async (request, response, next) => {
  try {
    const url = String(request.query.url ?? "");

    if (!url) {
      response.status(400).json({ error: "Missing required query parameter: url" });
      return;
    }

    const requestRecord = await checkWebsiteRequestStatus(url);
    response.json({ requested: !!requestRecord, request: requestRecord });
  } catch (error) {
    next(error);
  }
});
