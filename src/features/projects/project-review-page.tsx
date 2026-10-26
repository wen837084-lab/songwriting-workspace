"use client";

import { ProjectFrame } from "../navigation/project-frame";
import { ReflectionWorkspace } from "../reflection/reflection-workspace";
import { ReviewWorkspace } from "../review/review-workspace";
import { ProjectRouteState } from "./project-route-state";
import { useProject } from "./use-project";

export function ProjectReviewPage({ projectId }: { projectId: string }) {
  const { project, setProject, isLoading, error, setError } = useProject(projectId, "Review");

  if (!project) return <ProjectRouteState isLoading={isLoading} error={error} />;

  return (
      <ProjectFrame project={project} current="review" contextLabel="回顾">
      {error ? <div className="error-message" role="alert">{error}</div> : null}
      <header className="page-header project-area-heading">
        <p className="eyebrow">Project 回顾</p>
        <h1>歌曲回顾</h1>
        <p className="lede">查看歌曲当前的事实，保留 Open Questions，并写下你自己的观察，不进行评分或评判。</p>
      </header>
      <ReviewWorkspace key={`${project.projectId}:review:${project.updatedAt}`} project={project} onProjectChange={setProject} onError={setError} />
      <ReflectionWorkspace key={`${project.projectId}:reflection`} project={project} onProjectChange={setProject} onError={setError} showIntentCheck={false} />
    </ProjectFrame>
  );
}
