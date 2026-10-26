import "server-only";

import { AiProviderError, type AiProvider } from "../../application/ports/ai-provider";
import {
  parseAiCoachGuidance,
  type AiCoachGuidance,
  type AiCoachRequest,
} from "../../domain/ai-coach/ai-coach";
import { SKILL_IDS } from "../../domain/workspace/skill-map";

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "bottleneckType",
    "reasoningSummary",
    "suggestedSkill",
    "reflectionQuestions",
    "exercise",
    "returnToCreationPrompt",
  ],
  properties: {
    bottleneckType: {
      type: "string",
      enum: ["Lyrics", "Melody", "Rhythm", "Harmony", "Arrangement", "Process", "LearningDirection"],
    },
    reasoningSummary: { type: "string", maxLength: 500 },
    suggestedSkill: { type: "string", enum: [...SKILL_IDS] },
    reflectionQuestions: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string", maxLength: 300 },
    },
    exercise: {
      type: "object",
      additionalProperties: false,
      required: ["title", "purpose", "steps"],
      properties: {
        title: { type: "string", maxLength: 120 },
        purpose: { type: "string", maxLength: 300 },
        steps: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: { type: "string", maxLength: 300 },
        },
      },
    },
    returnToCreationPrompt: { type: "string", maxLength: 300 },
  },
} as const;

interface OpenAiProviderOptions {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  fetchImplementation?: typeof fetch;
}

interface OpenAiResponseBody {
  output_text?: unknown;
  output?: unknown;
}

function extractOutputText(body: OpenAiResponseBody): string | null {
  if (typeof body.output_text === "string" && body.output_text.trim()) return body.output_text;
  if (!Array.isArray(body.output)) return null;
  for (const item of body.output) {
    if (typeof item !== "object" || item === null || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (typeof content === "object" && content !== null && "text" in content && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  return null;
}

function mapHttpError(status: number): AiProviderError {
  if (status === 401 || status === 403) return new AiProviderError("authentication", "The AI provider rejected its credentials.");
  if (status === 429) return new AiProviderError("rate-limit", "The AI provider rate limit was reached.");
  return new AiProviderError("unavailable", `The AI provider returned HTTP ${status}.`);
}

export class OpenAiProvider implements AiProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: OpenAiProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "gpt-5-mini";
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  async requestCoaching(request: AiCoachRequest, systemPrompt: string): Promise<AiCoachGuidance> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImplementation("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          store: false,
          instructions: systemPrompt,
          input: JSON.stringify({
            task: "Diagnose the creator's process bottleneck and return coaching only.",
            allowedSkills: SKILL_IDS,
            context: {
              stage: request.stage,
              stuckDescription: request.stuckDescription,
              ...(request.sharedSongIntent ? { userSharedSongIntent: request.sharedSongIntent } : {}),
            },
          }),
          text: {
            format: {
              type: "json_schema",
              name: "songwriting_coach_response",
              description: "Process coaching that contains no song-ready creative material.",
              strict: true,
              schema: RESPONSE_SCHEMA,
            },
          },
        }),
      });

      if (!response.ok) throw mapHttpError(response.status);
      let body: OpenAiResponseBody;
      try {
        body = await response.json() as OpenAiResponseBody;
      } catch {
        throw new AiProviderError("invalid-response", "The AI provider returned invalid JSON.");
      }
      const outputText = extractOutputText(body);
      if (!outputText) throw new AiProviderError("invalid-response", "The AI provider returned no structured output.");

      let parsed: unknown;
      try {
        parsed = JSON.parse(outputText);
      } catch {
        throw new AiProviderError("invalid-response", "The AI provider output could not be parsed.");
      }
      const guidance = parseAiCoachGuidance(parsed);
      if (!guidance) throw new AiProviderError("invalid-response", "The AI provider output crossed the coach boundary.");
      return guidance;
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      if (controller.signal.aborted) throw new AiProviderError("timeout", "The AI provider request timed out.");
      throw new AiProviderError("unavailable", "The AI provider request failed.");
    } finally {
      clearTimeout(timeout);
    }
  }
}
