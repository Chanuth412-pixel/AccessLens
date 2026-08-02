import { Router } from "express";
import {
  approveDeveloperTemplate,
  getDeveloperStats,
  getDeveloperTemplateDetail,
  listPendingDeveloperTemplates,
  rejectDeveloperTemplate,
  updateDeveloperTemplate,
  validateDeveloperTemplateDetail
} from "../services/developerService.js";
import {
  deleteWebsiteRequest,
  getWebsiteRequest,
  listWebsiteRequests,
  updateWebsiteRequestStatus
} from "../services/requestService.js";
import { generateTemplateWithAi } from "../services/aiTemplateService.js";
import {
  findReviewDraftTemplateByUrl,
  findTemplateIdByKey,
  saveGeneratedTemplateDraft
} from "../services/templateService.js";
import {
  createWebsiteDomSnapshot,
  WebsiteSnapshotError
} from "../services/websiteSnapshotService.js";


export const developerRouter = Router();

// Placeholder guard: replace with real developer/admin authentication before production use.
developerRouter.use((_request, _response, next) => {
  next();
});

developerRouter.get("/stats", async (_request, response, next) => {
  try {
    response.json(await getDeveloperStats());
  } catch (error) {
    next(error);
  }
});

developerRouter.get("/templates/pending", async (_request, response, next) => {
  try {
    response.json({ templates: await listPendingDeveloperTemplates() });
  } catch (error) {
    next(error);
  }
});

developerRouter.get("/templates/:templateId", async (request, response, next) => {
  try {
    const template = await getDeveloperTemplateDetail(request.params.templateId);

    if (!template) {
      response.status(404).json({ error: "Template not found" });
      return;
    }

    response.json({ template });
  } catch (error) {
    next(error);
  }
});

developerRouter.patch("/templates/:templateId", async (request, response, next) => {
  try {
    const template = await updateDeveloperTemplate(request.params.templateId, request.body);

    if (!template) {
      response.status(404).json({ error: "Template not found" });
      return;
    }

    response.json({ template });
  } catch (error) {
    next(error);
  }
});

developerRouter.post("/templates/:templateId/approve", async (request, response, next) => {
  try {
    const detail = await getDeveloperTemplateDetail(request.params.templateId);
    if (!detail) {
      response.status(404).json({ error: "Template not found" });
      return;
    }

    const validation = validateDeveloperTemplateDetail(detail);
    if (!validation.valid) {
      response.status(422).json({
        error: "Template validation failed. Fix the field mappings before approval.",
        validation
      });
      return;
    }

    const template = await approveDeveloperTemplate(request.params.templateId, request.body?.note);

    response.json({ template });
  } catch (error) {
    next(error);
  }
});

developerRouter.post("/templates/:templateId/reject", async (request, response, next) => {
  try {
    const template = await rejectDeveloperTemplate(request.params.templateId, request.body?.reason);

    if (!template) {
      response.status(404).json({ error: "Template not found" });
      return;
    }

    response.json({ template });
  } catch (error) {
    next(error);
  }
});

developerRouter.post("/templates/:templateId/validate", async (request, response, next) => {
  try {
    const template = await getDeveloperTemplateDetail(request.params.templateId);

    if (!template) {
      response.status(404).json({ error: "Template not found" });
      return;
    }

    response.json(validateDeveloperTemplateDetail(template));
  } catch (error) {
    next(error);
  }
});

developerRouter.get("/website-requests", async (_request, response, next) => {
  try {
    const requests = await listWebsiteRequests();
    response.json({ requests });
  } catch (error) {
    next(error);
  }
});

developerRouter.post("/website-requests/:id/generate-template", async (request, response, next) => {
  try {
    const websiteRequest = await getWebsiteRequest(request.params.id);
    if (!websiteRequest) {
      response.status(404).json({ error: "Website request not found" });
      return;
    }

    const existingDraft = await findReviewDraftTemplateByUrl(websiteRequest.url);
    if (existingDraft) {
      const existingId = await findTemplateIdByKey(existingDraft.templateKey);
      const detail = existingId ? await getDeveloperTemplateDetail(existingId) : null;
      if (detail) {
        await updateWebsiteRequestStatus(websiteRequest.id, "in_review");
        response.json({ template: detail, reused: true });
        return;
      }
    }

    const snapshot = await createWebsiteDomSnapshot(websiteRequest.url);
    const generatedTemplate = await generateTemplateWithAi(snapshot);
    const saved = await saveGeneratedTemplateDraft(generatedTemplate);
    if (!saved) {
      response.status(409).json({
        error: "An approved template already exists for this page and was not overwritten."
      });
      return;
    }

    const templateId = await findTemplateIdByKey(generatedTemplate.templateKey);
    const detail = templateId ? await getDeveloperTemplateDetail(templateId) : null;
    if (!detail) {
      throw new Error("The generated template could not be loaded after it was saved.");
    }

    await updateWebsiteRequestStatus(websiteRequest.id, "in_review");
    response.status(201).json({ template: detail, reused: false });
  } catch (error) {
    if (error instanceof WebsiteSnapshotError) {
      response.status(error.status).json({ error: error.message });
      return;
    }

    const providerStatus = typeof error === "object" && error && "status" in error
      ? Number(error.status)
      : 0;
    if (providerStatus === 401 || providerStatus === 429) {
      response.status(503).json({
        error: providerStatus === 401
          ? "The configured AI provider rejected the API key. Check backend/.env."
          : "The configured AI model is temporarily rate limited. Try again shortly."
      });
      return;
    }

    if (error instanceof Error && error.message.includes("is not configured in backend/.env")) {
      response.status(503).json({ error: error.message });
      return;
    }

    if (error instanceof Error && (
      error.message.includes("AI model did not return")
      || error.message.includes("AI response did not contain")
      || error.message.includes("Groq model did not return")
    )) {
      response.status(422).json({
        error: "The AI model could not produce a valid template from this page. Review the page and try again."
      });
      return;
    }

    next(error);
  }
});

developerRouter.patch("/website-requests/:id", async (request, response, next) => {
  try {
    const { status } = request.body as { status?: string };

    if (!status) {
      response.status(400).json({ error: "Missing required parameter: status" });
      return;
    }

    const updated = await updateWebsiteRequestStatus(request.params.id, status);

    if (!updated) {
      response.status(404).json({ error: "Website request not found" });
      return;
    }

    response.json({ request: updated });
  } catch (error) {
    next(error);
  }
});

developerRouter.delete("/website-requests/:id", async (request, response, next) => {
  try {
    const deleted = await deleteWebsiteRequest(request.params.id);

    if (!deleted) {
      response.status(404).json({ error: "Website request not found" });
      return;
    }

    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

