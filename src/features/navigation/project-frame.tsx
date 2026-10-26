import { AppLink } from "./app-link";
import type { ReactNode } from "react";
import type { SongProject } from "../../domain/project/project";
import { getStageDefinition } from "../creation-journey/stages";
import {
  getProjectNavigation,
  type ProjectNavigationId,
} from "./navigation";

interface ProjectFrameProps {
  project: SongProject;
  current: ProjectNavigationId;
  contextLabel: string;
  children: ReactNode;
}

export function ProjectFrame({ project, current, contextLabel, children }: ProjectFrameProps) {
  const projectNavigation = getProjectNavigation(project.projectId, project.currentStage);
  const stageLabel = getStageDefinition(project.currentStage).label;

  return (
    <main className="shell project-shell">
      <header className="project-context-header">
        <AppLink className="back-link project-workspace-link" href="/">← 返回 Workspace / 项目</AppLink>
        <div className="project-context-identity">
          <div>
            <p className="eyebrow">当前 Project</p>
            <p className="project-context-title">{project.title}</p>
          </div>
          <dl>
            <div><dt>当前阶段</dt><dd>{stageLabel}</dd></div>
            <div><dt>当前上下文</dt><dd>{contextLabel}</dd></div>
          </dl>
        </div>

        <nav className="project-nav project-nav-desktop" aria-label="Project 导航">
          {projectNavigation.map((item) => (
            <AppLink
              key={item.id}
              href={item.href}
              className={item.id === current ? "project-nav-link active" : "project-nav-link"}
              aria-current={item.id === current ? "page" : undefined}
            >
              {item.label}
            </AppLink>
          ))}
        </nav>

        <details className="project-nav-mobile">
          <summary>Project 菜单 · {projectNavigation.find((item) => item.id === current)?.label}</summary>
          <nav aria-label="Project 移动端导航">
            {projectNavigation.map((item) => (
              <AppLink
                key={item.id}
                href={item.href}
                className={item.id === current ? "project-nav-link active" : "project-nav-link"}
                aria-current={item.id === current ? "page" : undefined}
              >
                {item.label}
              </AppLink>
            ))}
          </nav>
        </details>
      </header>

      {children}
    </main>
  );
}
