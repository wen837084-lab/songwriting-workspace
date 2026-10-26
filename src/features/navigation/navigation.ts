import type { ProjectStage } from "../../domain/project/project";
import { getStageDefinition } from "../creation-journey/stages";
import {
  projectCreateRoute,
  projectReviewRoute,
  projectRoute,
  projectToolsRoute,
  WORKSPACE_ROUTES,
} from "./routes";

export const WORKSPACE_NAV_ITEMS = [
  { id: "projects", label: "项目", href: WORKSPACE_ROUTES.projects },
  { id: "learning", label: "学习资料库", href: WORKSPACE_ROUTES.learning },
  { id: "skills", label: "Skill Map", href: WORKSPACE_ROUTES.skills },
  { id: "settings", label: "设置", href: WORKSPACE_ROUTES.settings },
] as const;

export type WorkspaceNavigationId = (typeof WORKSPACE_NAV_ITEMS)[number]["id"];
export type ProjectNavigationId = "overview" | "create" | "tools" | "review";

export const PROJECT_TOOL_DEFINITIONS = [
  {
    slug: "learning",
    label: "学习辅助",
    description: "需要时再打开与当前阶段相关的学习内容。",
  },
  {
    slug: "ai-coach",
    label: "AI Coach",
    description: "获取创作流程指导，但不会让系统替你创作歌曲素材。",
  },
  {
    slug: "garageband",
    label: "GarageBand 练习",
    description: "规划一次外部聆听实验，然后回来记录你的发现。",
  },
  {
    slug: "experiments",
    label: "实验记录",
    description: "查看并记录这个 Project 的 GarageBand 实验。",
  },
  {
    slug: "versions",
    label: "Versions / 版本",
    description: "保存、查看、对比和恢复 Project 的事实快照。",
  },
] as const;

export type ProjectToolSlug = (typeof PROJECT_TOOL_DEFINITIONS)[number]["slug"];

export function getProjectToolDefinition(slug: string) {
  return PROJECT_TOOL_DEFINITIONS.find((tool) => tool.slug === slug) ?? null;
}

export function getCurrentProjectHref(projectId: string, stage: ProjectStage): string {
  if (stage === "Review") return projectReviewRoute(projectId);
  return projectCreateRoute(projectId, getStageDefinition(stage).slug);
}

export function getProjectNavigation(
  projectId: string,
  currentStage: ProjectStage,
): readonly { id: ProjectNavigationId; label: string; href: string }[] {
  const createHref = currentStage === "Review"
    ? projectCreateRoute(projectId, "idea")
    : getCurrentProjectHref(projectId, currentStage);
  return [
    { id: "overview", label: "歌曲 / 概览", href: projectRoute(projectId) },
    { id: "create", label: "创作", href: createHref },
    { id: "tools", label: "工具", href: projectToolsRoute(projectId) },
    { id: "review", label: "回顾", href: projectReviewRoute(projectId) },
  ];
}
