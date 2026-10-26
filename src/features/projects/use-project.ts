"use client";

import { useEffect, useState } from "react";
import type { ProjectStage, SongProject } from "../../domain/project/project";
import { createBrowserProjectRepository } from "../../infrastructure/persistence/browser-project-repository";

export function useProject(projectId: string, stage?: ProjectStage) {
  const [project, setProject] = useState<SongProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    queueMicrotask(() => {
      if (!isCurrent) return;
      try {
        const repository = createBrowserProjectRepository();
        const loaded = repository.get(projectId);
        const current = loaded && stage && loaded.currentStage !== stage
          ? repository.setCurrentStage(projectId, stage)
          : loaded;
        setProject(current);
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "无法加载这个项目。");
      } finally {
        setIsLoading(false);
        setLoadedProjectId(projectId);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [projectId, stage]);

  const isCurrentProject = project?.projectId === projectId;
  return {
    project: isCurrentProject ? project : null,
    setProject,
    isLoading: isLoading || loadedProjectId !== projectId,
    error: loadedProjectId === projectId ? error : null,
    setError,
  };
}
