import { Router } from "express";
import { z, ZodError } from "zod";
import {
  simplifyInstructionWithAi,
  supportRecordedGuideWithAi,
  type RecordedGuideForSupport
} from "../services/aiInstructionSupportService.js";
import {
  findActiveInstructionForAiSupport,
  findFirstWorkflowInstruction,
  parseSupportedUrl,
  resolveInstruction
} from "../services/instructionService.js";
import {
  getCompletedRecordingGuide,
  listCompletedRecordingGuides
} from "../services/recordingService.js";

export const instructionsRouter = Router();

const aiSupportRequestSchema = z.object({
  question: z.string().trim().min(1).max(500)
});

const recordedGuideAiSupportRequestSchema = aiSupportRequestSchema.extend({
  url: z.string().trim().url().max(2048),
  sessionId: z.string().uuid().optional(),
  stepId: z.string().uuid().optional()
}).refine((value) => !value.stepId || value.sessionId, {
  message: "A selected step requires a selected guide."
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

instructionsRouter.get("/guides", async (request, response, next) => {
  try {
    const url = String(request.query.url ?? "").trim();
    if (!url) {
      response.status(400).json({ error: "Missing required query parameter: url" });
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

    const categories = await listCompletedRecordingGuides(url);
    response.json({ categories });
  } catch (error) {
    next(error);
  }
});

instructionsRouter.get("/guides/:sessionId", async (request, response, next) => {
  try {
    const sessionId = z.string().uuid().safeParse(request.params.sessionId);
    if (!sessionId.success) {
      response.status(400).json({ error: "Invalid guide ID" });
      return;
    }

    const guide = await getCompletedRecordingGuide(sessionId.data);
    if (!guide) {
      response.status(404).json({ error: "Completed guide not found" });
      return;
    }

    response.json({ guide });
  } catch (error) {
    next(error);
  }
});

instructionsRouter.post("/guides/ai-support", async (request, response, next) => {
  try {
    const { question, url, sessionId, stepId } = recordedGuideAiSupportRequestSchema.parse(request.body);

    try {
      parseSupportedUrl(url);
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? error.message : "Invalid page URL"
      });
      return;
    }

    const clientId = request.ip || request.socket.remoteAddress || "local";
    if (isAiSupportRateLimited(clientId)) {
      response.status(429).json({
        error: "AI support limit reached. Try again in a few minutes."
      });
      return;
    }

    const categorySummaries = (await listCompletedRecordingGuides(url)).slice(0, 25);
    const loadedGuides = await Promise.all(
      categorySummaries.map((category) => getCompletedRecordingGuide(category.id))
    );
    const guides: RecordedGuideForSupport[] = loadedGuides
      .filter((guide): guide is NonNullable<typeof guide> => Boolean(guide))
      .map((guide) => {
        const contextSteps = guide.steps.slice(0, 12);
        const selectedStep = guide.id === sessionId
          ? guide.steps.find((step) => step.id === stepId)
          : undefined;
        if (selectedStep && !contextSteps.some((step) => step.id === selectedStep.id)) {
          contextSteps.push(selectedStep);
        }

        return {
          id: guide.id,
          category: guide.category.slice(0, 150),
          steps: contextSteps.map((step) => ({
            id: step.id,
            instruction_title: step.instruction_title.slice(0, 180),
            instruction_text: step.instruction_text.slice(0, 600)
          }))
        };
      });

    if (guides.length === 0) {
      response.status(404).json({ error: "No completed support categories are available for this website." });
      return;
    }

    const result = await supportRecordedGuideWithAi({
      guides,
      selectedGuideId: sessionId,
      selectedStepId: stepId
    }, question);
    response.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ error: "Describe your problem in 500 characters or fewer." });
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

    if (error instanceof Error && error.message.startsWith("The AI model")) {
      response.status(503).json({ error: "AI support could not create guidance. Try again shortly." });
      return;
    }

    next(error);
  }
});

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
