import type { AccessLensTemplate } from "../types/accessLensTemplate";

const apiBaseUrl = "http://localhost:4000/api";

export async function fetchTemplateForUrl(url: string, heading?: string): Promise<AccessLensTemplate | null> {
  const endpoint = heading ? "resolve" : "match";
  const response = await fetch(
    `${apiBaseUrl}/templates/${endpoint}?url=${encodeURIComponent(url)}${heading ? `&heading=${encodeURIComponent(heading)}` : ""}`
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to load AccessLens template");
  }

  const data = (await response.json()) as { template: AccessLensTemplate };
  return data.template;
}
