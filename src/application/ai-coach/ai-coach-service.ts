import type { AiProvider } from "../ports/ai-provider";
import { AiProviderError } from "../ports/ai-provider";
import {
  parseAiCoachGuidance,
  parseAiCoachRequest,
  type AiCoachRequest,
  type AiCoachResult,
} from "../../domain/ai-coach/ai-coach";
import { AI_COACH_SYSTEM_PROMPT } from "./coach-policy";

const FALLBACK_MESSAGE = "AI Coach is currently unavailable. You can keep creating with Learning Support, your Skill Map, and Reflection.";

export class AiCoachService {
  constructor(private readonly provider: AiProvider | null) {}

  async requestCoaching(input: unknown): Promise<AiCoachResult> {
    const request = parseAiCoachRequest(input);
    if (!request) {
      return { status: "unavailable", reason: "invalid-response", message: FALLBACK_MESSAGE };
    }
    if (!this.provider) {
      return { status: "unavailable", reason: "unavailable", message: FALLBACK_MESSAGE };
    }

    try {
      const providerGuidance = await this.provider.requestCoaching(request, AI_COACH_SYSTEM_PROMPT);
      const guidance = parseAiCoachGuidance(providerGuidance);
      if (!guidance) {
        return { status: "unavailable", reason: "invalid-response", message: FALLBACK_MESSAGE };
      }
      return {
        status: "available",
        response: {
          projectId: request.projectId,
          ...guidance,
        },
      };
    } catch (error) {
      const reason = error instanceof AiProviderError ? error.code : "unavailable";
      return { status: "unavailable", reason, message: FALLBACK_MESSAGE };
    }
  }
}

export function createUnavailableAiCoachService(): AiCoachService {
  return new AiCoachService(null);
}

export type { AiCoachRequest };
