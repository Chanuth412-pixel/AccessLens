import { z } from "zod";

export const accessLensFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "password", "email", "tel", "number", "select", "textarea"]),
  selector: z.string().min(1),
  xpath: z.string().optional(),
  required: z.boolean().optional(),
  validationRule: z.string().optional(),
  options: z.array(z.string()).optional()
});

export const runnerInstructionSchema = z.object({
  type: z.enum([
    "fill",
    "click",
    "select",
    "waitForElement",
    "prompt_user",
    "review",
    "submit_after_confirm"
  ]),
  fieldId: z.string().optional(),
  selector: z.string().optional(),
  xpath: z.string().optional(),
  valueSource: z.string().optional(),
  waitMs: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const accessLensTemplateSchema = z.object({
  siteId: z.string().min(1),
  siteName: z.string().min(1),
  templateKey: z.string().min(1),
  templateName: z.string().min(1),
  version: z.string().min(1),
  urlPatterns: z.array(z.string().min(1)).min(1),
  fields: z.array(accessLensFieldSchema),
  instructions: z.array(runnerInstructionSchema)
});
