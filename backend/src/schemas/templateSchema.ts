import { z } from "zod";

export const accessLensFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "password", "email", "tel", "number", "date", "select", "textarea"]),
  selector: z.string().min(1),
  xpath: z.string().optional(),
  required: z.boolean().optional(),
  validationRule: z.string().optional(),
  validationPattern: z.string().optional(),
  validationMessage: z.string().optional(),
  options: z.array(z.string()).optional(),
  originalLabel: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  events: z.array(z.enum(["input", "change"])).optional(),
  temporary: z.boolean().optional()
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
  source: z.enum(["approved", "manually-approved", "ai-runtime-generated"]).optional(),
  siteId: z.string().min(1),
  siteName: z.string().min(1),
  templateKey: z.string().min(1),
  templateName: z.string().min(1),
  pageHeading: z.string().min(1).max(300).optional(),
  pageDetection: z.object({
    headingText: z.string().min(1).max(300),
    requiredSelectors: z.array(z.string().min(1).max(500))
  }).optional(),
  workflow: z.object({
    workflowKey: z.string().min(1).max(200),
    pageKey: z.string().min(1).max(200),
    pageOrder: z.number().int().positive(),
    totalPages: z.number().int().positive(),
    nextPageKey: z.string().min(1).max(200).nullable()
  }).optional(),
  version: z.string().min(1),
  urlPatterns: z.array(z.string().min(1)).min(1),
  fields: z.array(accessLensFieldSchema),
  instructions: z.array(runnerInstructionSchema),
  policies: z.object({
    storePersonalData: z.literal(false),
    autoSubmit: z.literal(false),
    manualReviewRequired: z.literal(true)
  }).optional()
});
