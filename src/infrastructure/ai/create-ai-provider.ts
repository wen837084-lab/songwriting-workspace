import "server-only";

import type { AiProvider } from "../../application/ports/ai-provider";
import { OpenAiProvider } from "./openai-provider";

function providerTimeout(): number | undefined {
  const value = Number.parseInt(process.env.AI_PROVIDER_TIMEOUT_MS ?? "", 10);
  return Number.isSafeInteger(value) && value >= 1_000 && value <= 30_000 ? value : undefined;
}

export function createAiProviderFromEnvironment(): AiProvider | null {
  const providerName = process.env.AI_PROVIDER?.trim().toLowerCase() || "openai";
  if (providerName !== "openai") return null;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  return new OpenAiProvider({
    apiKey,
    model: process.env.OPENAI_MODEL?.trim() || undefined,
    timeoutMs: providerTimeout(),
  });
}
