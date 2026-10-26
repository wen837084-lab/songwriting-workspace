import type {
  AiCoachGuidance,
  AiCoachRequest,
  AiProviderErrorCode,
} from "../../domain/ai-coach/ai-coach";

export interface AiProvider {
  requestCoaching(request: AiCoachRequest, systemPrompt: string): Promise<AiCoachGuidance>;
}

export class AiProviderError extends Error {
  constructor(
    public readonly code: AiProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
