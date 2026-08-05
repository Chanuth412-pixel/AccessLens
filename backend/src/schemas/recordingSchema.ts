import { z } from "zod";

const httpUrl = z.string().url().max(2000).refine(
  (value) => ["http:", "https:"].includes(new URL(value).protocol),
  "Only HTTP and HTTPS URLs are supported"
);

export const recordingSessionIdSchema = z.string().uuid();

export const createRecordingSessionSchema = z.object({
  websiteRequestId: z.string().uuid(),
  category: z.string().trim().min(1).max(100)
});

export const saveRecordingStepSchema = z.object({
  pageUrl: httpUrl,
  pageTitle: z.string().trim().max(300).default(""),
  actionType: z.enum(["click", "input", "select", "change"]),
  selector: z.string().trim().min(1).max(1000),
  xpath: z.string().trim().max(2000).nullable().optional(),
  elementLabel: z.string().trim().min(1).max(300),
  instructionTitle: z.string().trim().min(1).max(300),
  instructionText: z.string().trim().min(1).max(2000),
  elementMetadata: z.record(z.unknown()).default({})
});

export const updateRecordingSessionSchema = z.object({
  status: z.enum(["completed", "cancelled"])
});

export const suggestRecordingInstructionSchema = z.object({
  category: z.string().trim().min(1).max(100),
  siteName: z.string().trim().max(300).default(""),
  pageTitle: z.string().trim().max(300).default(""),
  pageUrl: httpUrl,
  actionType: z.enum(["click", "input", "select", "change"]),
  elementLabel: z.string().trim().min(1).max(300),
  elementMetadata: z.record(z.unknown()).default({})
});

export type SaveRecordingStepInput = z.infer<typeof saveRecordingStepSchema>;
export type SuggestRecordingInstructionInput = z.infer<typeof suggestRecordingInstructionSchema>;
