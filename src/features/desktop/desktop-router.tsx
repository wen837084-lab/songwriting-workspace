"use client";

import { useSyncExternalStore } from "react";
import { JourneyPage } from "../creation-journey/journey-page";
import { getStageFromSlug } from "../creation-journey/stages";
import { getProjectToolDefinition } from "../navigation/navigation";
import { DESKTOP_NAVIGATION_EVENT } from "../navigation/app-link";
import { parseAppRoute, type AppRoute } from "../navigation/routes";
import {
  LearningWorkspacePage,
  SettingsWorkspacePage,
  SkillsWorkspacePage,
} from "../navigation/workspace-pages";
import { ProjectPage } from "../projects/project-page";
import { ProjectReviewPage } from "../projects/project-review-page";
import { ProjectRouteState } from "../projects/project-route-state";
import { ProjectToolsPage } from "../projects/project-tools-page";
import { ProjectsDashboard } from "../projects/projects-dashboard";

function subscribeToDesktopNavigation(onStoreChange: () => void): () => void {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(DESKTOP_NAVIGATION_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(DESKTOP_NAVIGATION_EVENT, onStoreChange);
  };
}

export function DesktopRouter() {
  const pathname = useSyncExternalStore(
    subscribeToDesktopNavigation,
    () => window.location.pathname,
    () => "",
  );
  let route: AppRoute | null = null;
  if (pathname) {
    try {
      route = parseAppRoute(pathname);
    } catch {
      route = { kind: "not-found" };
    }
  }

  if (!route) return <ProjectRouteState isLoading error={null} />;
  if (route.kind === "dashboard") return <ProjectsDashboard initialStatus={route.status} />;
  if (route.kind === "learning") return <LearningWorkspacePage />;
  if (route.kind === "skills") return <SkillsWorkspacePage />;
  if (route.kind === "settings") return <SettingsWorkspacePage />;
  if (route.kind === "project") return <ProjectPage projectId={route.projectId} />;
  if (route.kind === "review") return <ProjectReviewPage projectId={route.projectId} />;
  if (route.kind === "create") {
    const stage = getStageFromSlug(route.stageSlug);
    if (!stage) return <ProjectRouteState isLoading={false} error="无法识别这个创作阶段。" />;
    if (stage === "Review") return <ProjectReviewPage projectId={route.projectId} />;
    return <JourneyPage projectId={route.projectId} stage={stage} />;
  }
  if (route.kind === "tools") {
    const tool = route.toolSlug ? getProjectToolDefinition(route.toolSlug) : null;
    if (route.toolSlug && !tool) return <ProjectRouteState isLoading={false} error="无法识别这个 Project 工具。" />;
    return <ProjectToolsPage projectId={route.projectId} tool={tool?.slug} />;
  }
  return <ProjectRouteState isLoading={false} error="找不到这个页面。" />;
}
