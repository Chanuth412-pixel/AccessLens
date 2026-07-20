import type {
  DeveloperFieldMapping,
  DeveloperStats,
  DeveloperTemplateDetail,
  DeveloperTemplateSummary,
  DeveloperValidationResult
} from "../types/developer";

const apiBaseUrl = "http://localhost:4000/api";

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers
    },
    ...options
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error ?? "Developer API request failed.");
  }

  return response.json() as Promise<T>;
}

export async function fetchDeveloperStats() {
  return requestJson<DeveloperStats>("/developer/stats");
}

export async function fetchPendingDeveloperTemplates() {
  const data = await requestJson<{ templates: DeveloperTemplateSummary[] }>("/developer/templates/pending");
  return data.templates;
}

export async function fetchDeveloperTemplate(templateId: string) {
  const data = await requestJson<{ template: DeveloperTemplateDetail }>(`/developer/templates/${templateId}`);
  return data.template;
}

export async function saveDeveloperTemplate(
  templateId: string,
  payload: {
    template_name: string;
    url_patterns: string[];
    field_mappings: DeveloperFieldMapping[];
  }
) {
  const data = await requestJson<{ template: DeveloperTemplateDetail }>(
    `/developer/templates/${templateId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    }
  );

  return data.template;
}

export async function approveDeveloperTemplate(templateId: string, note?: string) {
  const data = await requestJson<{ template: DeveloperTemplateDetail }>(
    `/developer/templates/${templateId}/approve`,
    {
      method: "POST",
      body: JSON.stringify({ note })
    }
  );

  return data.template;
}

export async function rejectDeveloperTemplate(templateId: string, reason: string) {
  const data = await requestJson<{ template: DeveloperTemplateDetail }>(
    `/developer/templates/${templateId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ reason })
    }
  );

  return data.template;
}

export async function validateDeveloperTemplate(templateId: string) {
  return requestJson<DeveloperValidationResult>(`/developer/templates/${templateId}/validate`, {
    method: "POST"
  });
}
