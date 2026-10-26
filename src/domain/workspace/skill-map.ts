export const SKILL_IDS = [
  "Lyrics",
  "Melody",
  "Rhythm",
  "Harmony",
  "Arrangement",
] as const;

export type SkillId = (typeof SKILL_IDS)[number];

export const SKILL_STATES = ["Seen", "Practiced", "WantToRevisit"] as const;

export type SkillState = (typeof SKILL_STATES)[number];

export interface SkillProgress {
  skillId: SkillId;
  state: SkillState;
}

export interface SkillDefinition {
  skillId: SkillId;
  label: string;
  description: string;
}

export const SKILL_DEFINITIONS: readonly SkillDefinition[] = [
  {
    skillId: "Lyrics",
    label: "Lyrics",
    description: "探索文字、画面、场景和 Section 的作用。",
  },
  {
    skillId: "Melody",
    label: "Melody",
    description: "记录你自己的旋律实验和聆听。",
  },
  {
    skillId: "Rhythm",
    label: "Rhythm",
    description: "观察律动、时值、空间和节奏选择。",
  },
  {
    skillId: "Harmony",
    label: "Harmony",
    description: "建立用于聆听声音关系的词汇。",
  },
  {
    skillId: "Arrangement",
    label: "Arrangement",
    description: "思考对比、空间、密度和能量。",
  },
];

export const SKILL_STATE_LABELS: Record<SkillState, string> = {
  Seen: "我看过这个。",
  Practiced: "我练习过这个。",
  WantToRevisit: "我想再复习这个。",
};

export const SKILL_STATE_HELP: Record<SkillState, string> = {
  Seen: "表示你接触过这个概念。",
  Practiced: "表示你已经实际练习过这个概念。",
  WantToRevisit: "我想接下来学习这个。",
};

export function isSkillId(value: unknown): value is SkillId {
  return typeof value === "string" && SKILL_IDS.includes(value as SkillId);
}

export function isSkillState(value: unknown): value is SkillState {
  return typeof value === "string" && SKILL_STATES.includes(value as SkillState);
}
