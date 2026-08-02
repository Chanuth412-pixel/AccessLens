import { Router } from "express";
import { ZodError } from "zod";
import { generateTemplateRequestSchema } from "../schemas/domSnapshotSchema.js";
import { generateTemplateWithAi } from "../services/aiTemplateService.js";
import {
  findReviewDraftTemplateByUrl,
  saveGeneratedTemplateDraft
} from "../services/templateService.js";

export const aiRouter = Router();

const requestHistory = new Map<string, number[]>();
const rateLimitWindowMs = 10 * 60 * 1000;
const maxGenerationsPerWindow = 5;

function toTemporaryManifest(template: Awaited<ReturnType<typeof generateTemplateWithAi>>) {
  return {
    source: "ai-runtime-generated",
    site: {
      url: template.urlPatterns[0],
      name: template.siteName
    },
    fields: template.fields.map((field) => ({
      key: field.id,
      label: field.label,
      type: field.type,
      required: field.required ?? false,
      selector: field.selector,
      originalLabel: field.originalLabel ?? field.label,
      confidence: field.confidence ?? 0.5,
      events: field.events ?? ["input", "change"]
    })),
    policies: template.policies ?? {
      storePersonalData: false,
      autoSubmit: false,
      manualReviewRequired: true
    }
  };
}

function isRateLimited(clientId: string) {
  const now = Date.now();
  const recentRequests = (requestHistory.get(clientId) ?? [])
    .filter((timestamp) => now - timestamp < rateLimitWindowMs);

  if (recentRequests.length >= maxGenerationsPerWindow) {
    requestHistory.set(clientId, recentRequests);
    return true;
  }

  recentRequests.push(now);
  requestHistory.set(clientId, recentRequests);
  return false;
}

aiRouter.post("/generate-template", async (request, response, next) => {
  try {
    const payload = generateTemplateRequestSchema.parse(request.body);
    const allowedSelectors = new Set(
      payload.elements.flatMap((element) => [element.selector, ...element.selectorCandidates])
    );
    const existingDraft = await findReviewDraftTemplateByUrl(payload.url, allowedSelectors);

    if (existingDraft) {
      response.json({
        template: existingDraft,
        temporaryManifest: toTemporaryManifest(existingDraft),
        source: "database_draft",
        status: "pending_review",
        saved: true
      });
      return;
    }

    const clientId = request.ip || request.socket.remoteAddress || "local";
    if (isRateLimited(clientId)) {
      response.status(429).json({
        error: "AI template generation limit reached. Try again in a few minutes."
      });
      return;
    }

    const template = await generateTemplateWithAi(payload);
    let saved = false;

    try {
      saved = await saveGeneratedTemplateDraft(template);
    } catch (databaseError) {
      console.error("Could not save AI template draft", databaseError);
    }

    response.status(201).json({
      template,
      temporaryManifest: toTemporaryManifest(template),
      source: "ai",
      status: "pending_review",
      saved
    });
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: "Invalid DOM snapshot",
        details: error.flatten()
      });
      return;
    }

    const status = typeof error === "object" && error && "status" in error
      ? Number(error.status)
      : 0;

    if (status === 401) {
      response.status(503).json({
        error: "The AI provider rejected the API key. Check OPENAI_API_KEY or GROQ_API_KEY in backend/.env."
      });
      return;
    }

    if (status === 429) {
      response.status(503).json({
        error: "The AI provider quota is unavailable. Check credits, usage limits, or free-tier rate limits."
      });
      return;
    }

    next(error);
  }
});
