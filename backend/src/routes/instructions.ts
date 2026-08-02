import { Router } from "express";
import {
  findFirstWorkflowInstruction,
  parseSupportedUrl,
  resolveInstruction
} from "../services/instructionService.js";

export const instructionsRouter = Router();

instructionsRouter.get("/resolve", async (request, response, next) => {
  try {
    const url = String(request.query.url ?? "").trim();
    const heading = String(request.query.heading ?? "").trim();

    if (!url) {
      response.status(400).json({ error: "Missing required query parameter: url" });
      return;
    }

    if (!heading) {
      response.status(400).json({ error: "Missing required query parameter: heading" });
      return;
    }

    try {
      parseSupportedUrl(url);
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? error.message : "Invalid page URL"
      });
      return;
    }

    const instruction = await resolveInstruction(url, heading);

    if (!instruction) {
      response.status(404).json({ error: "No active instruction found for this page and heading" });
      return;
    }

    response.json({ instruction });
  } catch (error) {
    next(error);
  }
});

instructionsRouter.get("/workflows/:workflowKey/first", async (request, response, next) => {
  try {
    const workflowKey = request.params.workflowKey.trim();

    if (!workflowKey || workflowKey.length > 200) {
      response.status(400).json({ error: "Invalid workflow key" });
      return;
    }

    const instruction = await findFirstWorkflowInstruction(workflowKey);

    if (!instruction) {
      response.status(404).json({ error: "No active workflow found for this key" });
      return;
    }

    response.json({ instruction });
  } catch (error) {
    next(error);
  }
});
