import type { AccessLensTemplate } from "../types/accessLensTemplate";

const apiBaseUrl = "http://localhost:4000/api";

export async function fetchTemplateForUrl(url: string): Promise<AccessLensTemplate | null> {
  const response = await fetch(
    `${apiBaseUrl}/templates/match?url=${encodeURIComponent(url)}`
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
