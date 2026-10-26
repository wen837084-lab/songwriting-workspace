import type { IdeaStartingPoint, MaterialType } from "../../domain/project/project";

export interface ExplorePrompt {
  promptId: string;
  text: string;
}

export const EXPLORE_PROMPTS: readonly ExplorePrompt[] = [
  { promptId: "recurring-thought", text: "最近有什么东西一直在你脑子里？" },
  { promptId: "person", text: "有没有一个人？" },
  { promptId: "event", text: "有没有一件事情？" },
  { promptId: "scene", text: "有没有一个画面？" },
  { promptId: "memory", text: "有没有一个记忆？" },
  { promptId: "action", text: "有没有一个动作？" },
  { promptId: "sound", text: "有没有一个声音？" },
  { promptId: "object", text: "有没有一个物件？" },
  { promptId: "remembered-words", text: "有没有一句一直记得的话？" },
  { promptId: "unclear-feeling", text: "有没有一个你说不清楚的感觉？" },
  { promptId: "then-and-now", text: "当时和现在有什么不同？" },
];

export const IDEA_STARTING_POINT_LABELS: Record<IdeaStartingPoint, string> = {
  idea: "一个想法",
  story: "一个故事",
  phrase: "一句话",
  scene: "一个画面",
  emotion: "一种情绪",
  melody: "一段旋律",
  rhythm: "一个节奏",
  harmony: "一组和弦",
  sound: "一个声音",
  nothing: "什么都没有",
};

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  scene: "Scene",
  emotion: "Emotion",
  phrase: "Phrase",
  memory: "Memory",
  sound: "Sound",
  person: "Person",
  object: "Object",
  event: "Event",
  dialogue: "Dialogue",
  "melody-idea": "Melody Idea",
  "rhythm-idea": "Rhythm Idea",
  "harmony-idea": "Harmony Idea",
  other: "Other",
};
