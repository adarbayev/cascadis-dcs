import type {
  AssessmentRequest,
  AssessmentResponse,
  AssessmentResult,
  PolicyDocument,
  SourceStatus,
} from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { detail?: string | Array<{ msg?: string }> };
      if (typeof body.detail === "string") detail = body.detail;
      if (Array.isArray(body.detail)) {
        detail = body.detail.map((item) => item.msg).filter(Boolean).join("; ") || detail;
      }
    } catch {
      // Keep the HTTP status when the API does not return a JSON error body.
    }
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}

export async function createAssessment(payload: AssessmentRequest): Promise<AssessmentResponse> {
  const data = await requestJson<AssessmentResponse | AssessmentResult[]>("/assessments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return Array.isArray(data) ? { assessments: data } : data;
}

export async function getPortfolio(): Promise<AssessmentResult[]> {
  const data = await requestJson<
    | AssessmentResult[]
    | { assessments?: AssessmentResult[]; items?: AssessmentResult[]; results?: AssessmentResult[] }
  >("/portfolio?limit=1000");
  if (Array.isArray(data)) return data;
  return data.assessments ?? data.items ?? data.results ?? [];
}

export async function getPolicy(): Promise<PolicyDocument> {
  return requestJson<PolicyDocument>("/policy");
}

export async function getSourceStatus(): Promise<SourceStatus[]> {
  const data = await requestJson<
    SourceStatus[] | { checked_at?: string; sources?: SourceStatus[]; status?: SourceStatus[] | Record<string, SourceStatus> }
  >("/sources/status");
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.sources)) {
    return data.sources.map((source) => ({
      ...source,
      id: source.id ?? source.provider,
      label: source.label ?? source.provider,
      status:
        source.status ??
        (!source.enabled ? "disabled" : source.configured ? "configured" : "not_configured"),
      detail: source.detail ?? source.note,
      checked_at: source.checked_at ?? data.checked_at,
    }));
  }
  if (Array.isArray(data.status)) return data.status;
  if (data.status && typeof data.status === "object") {
    return Object.entries(data.status).map(([id, value]) => ({ id, ...value }));
  }
  return [];
}
