import { PROJECT_STAGES, type ProjectStage } from "../project/project";
import { isSkillId, type SkillId } from "../workspace/skill-map";

export const AI_COACH_BOTTLENECK_TYPES = [
  "Lyrics",
  "Melody",
  "Rhythm",
  "Harmony",
  "Arrangement",
  "Process",
  "LearningDirection",
] as const;

export type AiCoachBottleneckType = (typeof AI_COACH_BOTTLENECK_TYPES)[number];

export interface AiCoachRequest {
  projectId: string;
  stage: ProjectStage;
  stuckDescription: string;
  sharedSongIntent?: {
    coreIdea: string;
    desiredFeeling: string;
    coreImage: string;
    centralConflict: string;
  };
}

export interface AiCoachExercise {
  title: string;
  purpose: string;
  steps: string[];
}

export interface AiCoachGuidance {
  bottleneckType: AiCoachBottleneckType;
  reasoningSummary: string;
  suggestedSkill: SkillId;
  reflectionQuestions: string[];
  exercise: AiCoachExercise;
  returnToCreationPrompt: string;
}

export interface AiCoachResponse extends AiCoachGuidance {
  projectId: string;
}

export const AI_PROVIDER_ERROR_CODES = [
  "unavailable",
  "timeout",
  "rate-limit",
  "authentication",
  "invalid-response",
] as const;

export type AiProviderErrorCode = (typeof AI_PROVIDER_ERROR_CODES)[number];

export interface AiCoachSuccessResult {
  status: "available";
  response: AiCoachResponse;
}

export interface AiCoachUnavailableResult {
  status: "unavailable";
  reason: AiProviderErrorCode;
  message: string;
}

export type AiCoachResult = AiCoachSuccessResult | AiCoachUnavailableResult;

const GUIDANCE_KEYS = [
  "bottleneckType",
  "reasoningSummary",
  "suggestedSkill",
  "reflectionQuestions",
  "exercise",
  "returnToCreationPrompt",
] as const;

const EXERCISE_KEYS = ["title", "purpose", "steps"] as const;

const FORBIDDEN_RESPONSE_KEYS = new Set([
  "lyrics",
  "lyric",
  "nextLine",
  "hook",
  "songTitle",
  "titleSuggestion",
  "melody",
  "melodicPhrase",
  "midiMelody",
  "chordProgression",
  "chords",
  "arrangement",
  "arrangementChoice",
  "bestTake",
  "score",
  "rating",
  "ranking",
  "chainOfThought",
  "reasoningTrace",
]);

const DIRECT_CREATIVE_CONTENT_PATTERNS = [
  /(?:^|\n)\s*(?:lyrics?|hook|song title|melody|melodic phrase|chord progression|arrangement choice)\s*:/i,
  /(?:^|\n)\s*(?:歌词|下一句|副歌钩子|歌曲标题|旋律|和弦进行|编曲选择)\s*[：:]/,
  /\b(?:use|insert|sing|copy)\s+(?:this|these)\s+(?:line|lyric|hook|title|melody|chord|progression)s?\b/i,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function hasForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, nested]) => FORBIDDEN_RESPONSE_KEYS.has(key) || hasForbiddenKey(nested));
}

function containsDirectCreativeContent(value: unknown): boolean {
  if (typeof value === "string") {
    return DIRECT_CREATIVE_CONTENT_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) return value.some(containsDirectCreativeContent);
  if (!isRecord(value)) return false;
  return Object.values(value).some(containsDirectCreativeContent);
}

export function parseAiCoachRequest(value: unknown): AiCoachRequest | null {
  if (!isRecord(value)) return null;
  const allowedKeys = ["projectId", "stage", "stuckDescription", "sharedSongIntent"];
  if (Object.keys(value).some((key) => !allowedKeys.includes(key))) return null;
  if (!isNonEmptyString(value.projectId, 160)) return null;
  if (!PROJECT_STAGES.includes(value.stage as ProjectStage)) return null;
  if (!isNonEmptyString(value.stuckDescription, 1_000)) return null;

  let sharedSongIntent: AiCoachRequest["sharedSongIntent"];
  if (value.sharedSongIntent !== undefined) {
    if (!isRecord(value.sharedSongIntent)) return null;
    const intent = value.sharedSongIntent;
    const intentKeys = ["coreIdea", "desiredFeeling", "coreImage", "centralConflict"];
    if (!hasExactKeys(intent, intentKeys)) return null;
    if (!intentKeys.every((key) => typeof intent[key] === "string" && intent[key].length <= 500)) {
      return null;
    }
    sharedSongIntent = {
      coreIdea: intent.coreIdea as string,
      desiredFeeling: intent.desiredFeeling as string,
      coreImage: intent.coreImage as string,
      centralConflict: intent.centralConflict as string,
    };
  }

  return {
    projectId: value.projectId.trim(),
    stage: value.stage as ProjectStage,
    stuckDescription: value.stuckDescription.trim(),
    ...(sharedSongIntent ? { sharedSongIntent } : {}),
  };
}

export function parseAiCoachGuidance(value: unknown): AiCoachGuidance | null {
  if (!isRecord(value) || !hasExactKeys(value, GUIDANCE_KEYS)) return null;
  if (hasForbiddenKey(value) || containsDirectCreativeContent(value)) return null;
  if (!AI_COACH_BOTTLENECK_TYPES.includes(value.bottleneckType as AiCoachBottleneckType)) return null;
  if (!isNonEmptyString(value.reasoningSummary, 500)) return null;
  if (!isSkillId(value.suggestedSkill)) return null;
  if (!Array.isArray(value.reflectionQuestions) || value.reflectionQuestions.length < 1 || value.reflectionQuestions.length > 4) return null;
  if (!value.reflectionQuestions.every((item) => isNonEmptyString(item, 300))) return null;
  if (!isRecord(value.exercise) || !hasExactKeys(value.exercise, EXERCISE_KEYS)) return null;
  if (!isNonEmptyString(value.exercise.title, 120) || !isNonEmptyString(value.exercise.purpose, 300)) return null;
  if (!Array.isArray(value.exercise.steps) || value.exercise.steps.length < 1 || value.exercise.steps.length > 5) return null;
  if (!value.exercise.steps.every((item) => isNonEmptyString(item, 300))) return null;
  if (!isNonEmptyString(value.returnToCreationPrompt, 300)) return null;

  return {
    bottleneckType: value.bottleneckType as AiCoachBottleneckType,
    reasoningSummary: value.reasoningSummary,
    suggestedSkill: value.suggestedSkill,
    reflectionQuestions: [...value.reflectionQuestions] as string[],
    exercise: {
      title: value.exercise.title,
      purpose: value.exercise.purpose,
      steps: [...value.exercise.steps] as string[],
    },
    returnToCreationPrompt: value.returnToCreationPrompt,
  };
}
