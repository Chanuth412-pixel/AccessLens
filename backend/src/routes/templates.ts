import { Router } from "express";
import { findApprovedTemplateByUrl, listApprovedTemplates } from "../services/templateService.js";

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

    if (!url) {
      response.status(400).json({ error: "Missing required query parameter: url" });
      return;
    }

    const template = await findApprovedTemplateByUrl(url);

    if (!template) {
      response.status(404).json({ error: "No approved template found for this URL" });
      return;
    }

    response.json({ template });
  } catch (error) {
    next(error);
  }
});
