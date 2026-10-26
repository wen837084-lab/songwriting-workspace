import {
  parseAiCoachGuidance,
  parseAiCoachRequest,
  type AiCoachRequest,
  type AiCoachResult,
} from "../../domain/ai-coach/ai-coach";

const FALLBACK_MESSAGE = "AI Coach is currently unavailable. You can keep creating with Learning Support, your Skill Map, and Reflection.";

interface RemoteAiCoachClientOptions {
  endpoint: string | null;
  timeoutMs?: number;
  fetchImplementation?: typeof fetch;
}

function unavailable(reason: "unavailable" | "timeout" | "rate-limit" | "invalid-response"): AiCoachResult {
  return { status: "unavailable", reason, message: FALLBACK_MESSAGE };
}

function parseRemoteResult(value: unknown, expectedProjectId: string): AiCoachResult | null {
  if (typeof value !== "object" || value === null || !("status" in value)) return null;
  if (value.status === "unavailable") {
    if (!("reason" in value) || !["unavailable", "timeout", "rate-limit", "authentication", "invalid-response"].includes(String(value.reason))) {
      return null;
    }
    return unavailable(value.reason === "authentication" ? "unavailable" : value.reason as "unavailable" | "timeout" | "rate-limit" | "invalid-response");
  }
  if (value.status !== "available" || !("response" in value) || typeof value.response !== "object" || value.response === null) return null;
  const { projectId, ...candidateGuidance } = value.response as Record<string, unknown>;
  if (projectId !== expectedProjectId) return null;
  const guidance = parseAiCoachGuidance(candidateGuidance);
  return guidance ? { status: "available", response: { projectId: expectedProjectId, ...guidance } } : null;
}

export class RemoteAiCoachClient {
  private readonly timeoutMs: number;
  private readonly fetchImplementation: typeof fetch;

  constructor(private readonly options: RemoteAiCoachClientOptions) {
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  async requestCoaching(input: unknown): Promise<AiCoachResult> {
    const request = parseAiCoachRequest(input);
    if (!request) return unavailable("invalid-response");
    if (!this.options.endpoint) return unavailable("unavailable");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImplementation(this.options.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request satisfies AiCoachRequest),
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.status === 429) return unavailable("rate-limit");
      if (!response.ok) return unavailable("unavailable");
      const parsed = parseRemoteResult(await response.json(), request.projectId);
      return parsed ?? unavailable("invalid-response");
    } catch {
      return unavailable(controller.signal.aborted ? "timeout" : "unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }
}
