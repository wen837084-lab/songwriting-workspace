import {
  PROJECT_STAGES,
  type ProjectStage,
} from "../../domain/project/project";

export interface JourneyStageDefinition {
  stage: ProjectStage;
  slug: string;
  label: string;
  purpose: string;
  laterPhaseMessage: string;
}

export const JOURNEY_STAGES: readonly JourneyStageDefinition[] = [
  { stage: "Idea", slug: "idea", label: "Idea / 想法", purpose: "留意你想探索的起点。", laterPhaseMessage: "Idea 工具将在后续阶段实现。" },
  { stage: "Explore", slug: "explore", label: "Explore / 探索", purpose: "在塑造之前，收集并观察你自己的原始素材。", laterPhaseMessage: "Explore 问题和 Material Library 将在后续阶段实现。" },
  { stage: "Define", slug: "define", label: "Define / 定义", purpose: "明确你希望这首歌承载或传达什么。", laterPhaseMessage: "Song Intent 工具将在后续阶段实现。" },
  { stage: "Lyrics", slug: "lyrics", label: "Lyrics / 歌词", purpose: "发展并整理由你写下的歌词。", laterPhaseMessage: "Lyrics Workspace 将在后续阶段实现。" },
  { stage: "Melody", slug: "melody", label: "Melody / 旋律", purpose: "探索并记录你自己的旋律想法。", laterPhaseMessage: "Melody 录音和 Take 管理将在后续阶段实现。" },
  { stage: "Rhythm", slug: "rhythm", label: "Rhythm / 节奏", purpose: "处理你选择的时值、律动和节奏感。", laterPhaseMessage: "Rhythm 工具将在后续阶段实现。" },
  { stage: "Harmony", slug: "harmony", label: "Harmony / 和声", purpose: "记录并探索你自己的和声决定。", laterPhaseMessage: "Harmony 工具将在后续阶段实现。" },
  { stage: "SongStructure", slug: "song-structure", label: "Song Structure / 歌曲结构", purpose: "塑造你选择的段落、顺序和小节数。", laterPhaseMessage: "Song Map 已可用于这个项目。" },
  { stage: "Arrangement", slug: "arrangement", label: "Arrangement / 编曲", purpose: "思考整首歌中的对比、空间、能量和质感。", laterPhaseMessage: "Arrangement Board 已可用于这个项目。" },
  { stage: "Review", slug: "review", label: "Review / 回顾", purpose: "退一步观察你接下来想重新处理什么。", laterPhaseMessage: "完整的 Song Overview 将在后续阶段实现。" },
];

export const CREATION_STAGES: readonly JourneyStageDefinition[] = JOURNEY_STAGES.filter(
  (item) => item.stage !== "Review",
);

if (JOURNEY_STAGES.length !== PROJECT_STAGES.length) {
  throw new Error("Every project stage must have a journey definition.");
}

export function getStageDefinition(stage: ProjectStage): JourneyStageDefinition {
  const definition = JOURNEY_STAGES.find((item) => item.stage === stage);
  if (!definition) throw new Error(`Missing journey definition for ${stage}.`);
  return definition;
}

export function getStageFromSlug(slug: string): ProjectStage | null {
  return JOURNEY_STAGES.find((item) => item.slug === slug)?.stage ?? null;
}

export function getAdjacentStages(stage: ProjectStage): {
  previous: JourneyStageDefinition | null;
  next: JourneyStageDefinition | null;
} {
  const index = JOURNEY_STAGES.findIndex((item) => item.stage === stage);
  return {
    previous: index > 0 ? JOURNEY_STAGES[index - 1] : null,
    next: index < JOURNEY_STAGES.length - 1 ? JOURNEY_STAGES[index + 1] : null,
  };
}

export function getAdjacentCreationStages(stage: ProjectStage): {
  previous: JourneyStageDefinition | null;
  next: JourneyStageDefinition | null;
} {
  const index = CREATION_STAGES.findIndex((item) => item.stage === stage);
  return {
    previous: index > 0 ? CREATION_STAGES[index - 1] : null,
    next: index >= 0 && index < CREATION_STAGES.length - 1 ? CREATION_STAGES[index + 1] : null,
  };
}
