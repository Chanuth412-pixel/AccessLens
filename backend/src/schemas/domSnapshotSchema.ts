import { z } from "zod";

export const domElementSnapshotSchema = z.object({
  tag: z.enum(["input", "select", "textarea"]),
  selector: z.string().min(1).max(500),
  selectorCandidates: z.array(z.string().min(1).max(500)).min(1).max(8),
  label: z.string().min(1).max(200),
  id: z.string().max(200).optional(),
  name: z.string().max(200).optional(),
  placeholder: z.string().max(200).optional(),
  ariaLabel: z.string().max(200).optional(),
  inputType: z.string().max(40),
  required: z.boolean(),
  options: z.array(z.string().max(200)).max(100),
  formContext: z.string().max(200)
});

export const generateTemplateRequestSchema = z.object({
  url: z
    .string()
    .url()
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
      message: "Only HTTP and HTTPS pages are supported"
    }),
  title: z.string().max(300),
  language: z.string().max(30),
  elements: z.array(domElementSnapshotSchema).min(1).max(100)
});

export type GenerateTemplateRequest = z.infer<typeof generateTemplateRequestSchema>;
export type DomElementSnapshot = z.infer<typeof domElementSnapshotSchema>;
