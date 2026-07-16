import { Router } from "express";
import { query } from "../db.js";

export const healthRouter = Router();

healthRouter.get("/", async (_request, response, next) => {
  try {
    await query("select 1");
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
