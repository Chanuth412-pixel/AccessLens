import { Router } from "express";
import { z, ZodError } from "zod";
import { simplifyInstructionWithAi } from "../services/aiInstructionSupportService.js";
import {
  findActiveInstructionForAiSupport,
  findFirstWorkflowInstruction,
  parseSupportedUrl,
  resolveInstruction
} from "../services/instructionService.js";

export const instructionsRouter = Router();

const aiSupportRequestSchema = z.object({
  question: z.string().trim().min(1).max(500)
});

const aiSupportHistory = new Map<string, number[]>();
const aiSupportWindowMs = 10 * 60 * 1000;
const maxAiSupportRequestsPerWindow = 20;

function isAiSupportRateLimited(clientId: string) {
  const now = Date.now();
  const recentRequests = (aiSupportHistory.get(clientId) ?? [])
    .filter((timestamp) => now - timestamp < aiSupportWindowMs);

  if (recentRequests.length >= maxAiSupportRequestsPerWindow) {
    aiSupportHistory.set(clientId, recentRequests);
    return true;
  }

  recentRequests.push(now);
  aiSupportHistory.set(clientId, recentRequests);
  return false;
}

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

instructionsRouter.post("/:instructionId/ai-support", async (request, response, next) => {
  try {
    const instructionId = z.string().uuid().parse(request.params.instructionId);
    const { question } = aiSupportRequestSchema.parse(request.body);
    const instruction = await findActiveInstructionForAiSupport(instructionId);

    if (!instruction) {
      response.status(404).json({ error: "No active instruction found" });
      return;
    }

    const clientId = request.ip || request.socket.remoteAddress || "local";
    if (isAiSupportRateLimited(clientId)) {
      response.status(429).json({
        error: "AI support limit reached. Try again in a few minutes."
      });
      return;
    }

    const explanation = await simplifyInstructionWithAi(instruction, question);
    response.json({ explanation });
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ error: "Enter a short description of what is confusing." });
      return;
    }

    const status = typeof error === "object" && error && "status" in error
      ? Number(error.status)
      : 0;

    if (status === 401) {
      response.status(503).json({ error: "AI support is not configured correctly." });
      return;
    }

    if (status === 429) {
      response.status(503).json({ error: "AI support is busy. Try again shortly." });
      return;
    }

    next(error);
  }
});
