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
  listWebsiteRequests,
  updateWebsiteRequestStatus
} from "../services/requestService.js";


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
    const template = await approveDeveloperTemplate(request.params.templateId, request.body?.note);

    if (!template) {
      response.status(404).json({ error: "Template not found" });
      return;
    }

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

