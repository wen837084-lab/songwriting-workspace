"use client";

import { AppLink } from "../navigation/app-link";
import { projectCreateRoute, projectToolsRoute } from "../navigation/routes";
import { useState } from "react";
import { AiCoach } from "../ai-coach/ai-coach";
import { GarageBandExperimentLog } from "../garageband/garageband-experiment-log";
import { GarageBandPracticeGuide } from "../garageband/garageband-practice-guide";
import { getGarageBandPracticeStage } from "../garageband/garageband-practice";
import { LearningSupport } from "../learning/learning-support";
import {
  getProjectToolDefinition,
  PROJECT_TOOL_DEFINITIONS,
  type ProjectToolSlug,
} from "../navigation/navigation";
import { ProjectFrame } from "../navigation/project-frame";
import { VersionWorkspace } from "../versions/version-workspace";
import { ProjectRouteState } from "./project-route-state";
import { useProject } from "./use-project";

export function ProjectToolsPage({ projectId, tool }: { projectId: string; tool?: ProjectToolSlug }) {
  const { project, setProject, isLoading, error, setError } = useProject(projectId);
  const [isExperimentLogOpen, setIsExperimentLogOpen] = useState(true);

  if (!project) return <ProjectRouteState isLoading={isLoading} error={error} />;

  const definition = tool ? getProjectToolDefinition(tool) : null;

  return (
    <ProjectFrame project={project} current="tools" contextLabel={definition ? `工具 / ${definition.label}` : "工具"}>
      {error ? <div className="error-message" role="alert">{error}</div> : null}
      <header className="page-header project-area-heading">
        <p className="eyebrow">Project 工具</p>
        <h1>{definition?.label ?? "工具"}</h1>
        <p className="lede">
          {definition?.description ?? "这个 Project 的可选辅助和记录工具。它们都不是必经的 Creation Journey 阶段。"}
        </p>
        {definition ? <AppLink className="back-to-area" href={projectToolsRoute(project.projectId)}>← 所有 Project 工具</AppLink> : null}
      </header>

      {!tool ? (
        <section className="tool-directory" aria-labelledby="tool-directory-heading">
          <h2 id="tool-directory-heading" className="sr-only">可用的 Project 工具</h2>
          {PROJECT_TOOL_DEFINITIONS.map((item) => (
            <AppLink key={item.slug} href={projectToolsRoute(project.projectId, item.slug)}>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </AppLink>
          ))}
        </section>
      ) : tool === "learning" ? (
        <LearningSupport key={`${project.projectId}:${project.currentStage}:learning`} stage={project.currentStage} defaultOpen />
      ) : tool === "ai-coach" ? (
        <AiCoach key={`${project.projectId}:${project.currentStage}:coach`} project={project} stage={project.currentStage} defaultOpen />
      ) : tool === "garageband" ? (
        <>
          {getGarageBandPracticeStage(project.currentStage) ? (
            <GarageBandPracticeGuide key={`${project.projectId}:${project.currentStage}:garageband`} project={project} stage={project.currentStage} defaultOpen />
          ) : (
            <section className="empty-state">
              <h2>请先选择实验上下文</h2>
              <p>GarageBand 练习可从 Melody、Rhythm、Harmony、Arrangement 和 Review 进入。</p>
              <AppLink className="quiet-link" href={projectCreateRoute(project.projectId, "melody")}>打开 Melody</AppLink>
            </section>
          )}
          <p className="tool-follow-up"><AppLink className="primary-link" href={projectToolsRoute(project.projectId, "experiments")}>返回并打开实验记录</AppLink></p>
        </>
      ) : tool === "experiments" ? (
        <GarageBandExperimentLog
          key={`${project.projectId}:experiment-log`}
          project={project}
          isOpen={isExperimentLogOpen}
          initialSectionId={null}
          onOpenChange={setIsExperimentLogOpen}
          onProjectChange={setProject}
          onError={setError}
        />
      ) : (
        <VersionWorkspace key={`${project.projectId}:versions`} project={project} onProjectChange={setProject} onError={setError} />
      )}
    </ProjectFrame>
  );
}
