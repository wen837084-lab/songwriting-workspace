export interface AiCoachViewState {
  isOpen: boolean;
  status: "idle" | "loading" | "result" | "fallback";
}

export function createInitialAiCoachViewState(): AiCoachViewState {
  return { isOpen: false, status: "idle" };
}
