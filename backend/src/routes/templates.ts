import { Router } from "express";
import {
  findApprovedTemplateByUrl,
  listApprovedTemplates,
  resolveApprovedTemplateForPage,
  TemplateResolutionError
} from "../services/templateService.js";

export const templatesRouter = Router();

templatesRouter.get("/", async (_request, response, next) => {
  try {
    const templates = await listApprovedTemplates();
    response.json({ templates });
  } catch (error) {
    next(error);
  }
});

templatesRouter.get("/match", async (request, response, next) => {
  try {
    const url = String(request.query.url ?? "");
    const heading = String(request.query.heading ?? "").trim() || undefined;

    if (!url) {
      response.status(400).json({ error: "Missing required query parameter: url" });
      return;
    }

    const template = await findApprovedTemplateByUrl(url, heading);

    if (!template) {
      response.status(404).json({ error: "No approved template found for this URL" });
      return;
    }

    response.json({ template });
  } catch (error) {
    next(error);
  }
});

templatesRouter.get("/resolve", async (request, response, next) => {
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

    const template = await resolveApprovedTemplateForPage(url, heading);
    response.json({ template });
  } catch (error) {
    if (error instanceof TemplateResolutionError) {
      response.status(error.status).json({ error: error.message, code: error.code });
      return;
    }

    next(error);
  }
});
