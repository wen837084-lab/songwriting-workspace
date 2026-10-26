"use client";

import { AppLink } from "../navigation/app-link";
import { projectRoute, WORKSPACE_ROUTES } from "../navigation/routes";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  sortProjects,
  type ProjectListItem,
  type ProjectSort,
  type ProjectStage,
  type ProjectStatus,
} from "../../domain/project/project";
import {
  createBrowserMelodyService,
  createBrowserProjectRepository,
} from "../../infrastructure/persistence/browser-project-repository";
import { ArchiveIndex, ArchiveMeta, MarginNote, StripeMarker } from "../../components/archive/archive-markup";
import { getStageDefinition } from "../creation-journey/stages";
import { WorkspaceNavigation } from "../navigation/workspace-navigation";
import { formatLastEdited } from "./format-date";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "读取本地项目数据时出现了一些问题。";
}

function formatProjectStage(stage: ProjectStage): string {
  return getStageDefinition(stage).label;
}

function statusLabel(status: ProjectStatus): string {
  return status === "active" ? "进行中" : "已归档";
}

export function ProjectsDashboard({ initialStatus = "active" }: { initialStatus?: ProjectStatus }) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const status = initialStatus;
  const [sortBy, setSortBy] = useState<ProjectSort>("updatedAt");
  const [title, setTitle] = useState("");
  const [projectNote, setProjectNote] = useState("");
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [pendingDeleteProjectId, setPendingDeleteProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(() => {
    try {
      setProjects(createBrowserProjectRepository().list());
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    queueMicrotask(() => {
      if (isCurrent) loadProjects();
    });
    return () => {
      isCurrent = false;
    };
  }, [loadProjects]);

  const visibleProjects = useMemo(
    () => sortProjects(projects.filter((project) => project.status === status), sortBy),
    [projects, sortBy, status],
  );

  const recentProjects = useMemo(
    () => sortProjects(projects.filter((project) => project.status === "active"), "updatedAt").slice(0, 3),
    [projects],
  );

  const projectCounts = useMemo(
    () => ({
      active: projects.filter((project) => project.status === "active").length,
      archived: projects.filter((project) => project.status === "archived").length,
    }),
    [projects],
  );

  function runMutation(mutation: () => void) {
    try {
      mutation();
      loadProjects();
    } catch (mutationError) {
      setError(errorMessage(mutationError));
    }
  }

  async function runAsyncMutation(mutation: () => Promise<void>) {
    try {
      await mutation();
      loadProjects();
    } catch (mutationError) {
      setError(errorMessage(mutationError));
    }
  }

  function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runMutation(() => {
      createBrowserProjectRepository().create({ title, projectNote });
      setTitle("");
      setProjectNote("");
    });
  }

  function renameProject(event: FormEvent<HTMLFormElement>, projectId: string) {
    event.preventDefault();
    runMutation(() => {
      createBrowserProjectRepository().rename(projectId, renameTitle);
      setRenamingProjectId(null);
      setRenameTitle("");
    });
  }

  async function deleteProject(projectId: string) {
    await runAsyncMutation(async () => {
      await createBrowserMelodyService().deleteProject(projectId);
      setPendingDeleteProjectId(null);
    });
  }

  return (
    <main className="shell workspace-dashboard">
      <WorkspaceNavigation current="projects" />

      <header className="page-header">
        <div className="archive-page-kicker">
          <ArchiveMeta>PROJECTS / {String(projects.length).padStart(2, "0")}</ArchiveMeta>
          <ArchiveMeta>LOCAL SONG INDEX</ArchiveMeta>
        </div>
        <p className="eyebrow">Songwriting Workspace</p>
        <h1>项目</h1>
        <p className="lede">看看你正在进行的工作，然后回到需要你继续创作的歌曲。</p>
      </header>

      {error ? <div className="error-message" role="alert">{error}</div> : null}

      <section className="create-panel" aria-labelledby="create-project-heading">
        <div>
          <p className="eyebrow">新歌曲</p>
          <h2 id="create-project-heading">新建项目</h2>
          <p className="panel-description">为一首新歌创建独立的工作区。</p>
        </div>
        <form className="create-form" onSubmit={createProject}>
          <label>
            标题
            <input
              required
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="未命名想法"
            />
          </label>
          <label>
            备注 <span className="optional">可选</span>
            <input
              maxLength={240}
              value={projectNote}
              onChange={(event) => setProjectNote(event.target.value)}
              placeholder="给自己的简短提醒"
            />
          </label>
          <button className="primary-button" type="submit">新建项目</button>
        </form>
      </section>

      {status === "active" && !isLoading && recentProjects.length > 0 ? (
        <section className="recent-projects" aria-labelledby="recent-projects-heading">
          <div className="archive-ruler" aria-hidden="true"><StripeMarker /><span>RECENTLY TOUCHED</span><StripeMarker /></div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">最近活动</p>
              <h2 id="recent-projects-heading">最近更新</h2>
            </div>
            <p>根据最近保存的项目更新显示。</p>
          </div>
          <ul className="recent-project-list">
            {recentProjects.map((project, index) => (
              <li key={project.projectId} className="recent-project-item">
                <ArchiveIndex number={index + 1} label="RECENT" />
                <AppLink href={projectRoute(project.projectId)}>{project.title}</AppLink>
                <span>
                  {formatProjectStage(project.currentStage)} · 更新于 {formatLastEdited(project.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="project-list-heading">
        <div className="archive-index-heading">
          <ArchiveMeta>PROJECT INDEX / {String(visibleProjects.length).padStart(2, "0")}</ArchiveMeta>
          <ArchiveMeta>ORDER / {sortBy === "updatedAt" ? "LAST TOUCHED" : sortBy === "createdAt" ? "CREATED" : "TITLE"}</ArchiveMeta>
        </div>
        <div className="list-toolbar">
          <nav className="tabs" aria-label="项目状态">
            {(["active", "archived"] as const).map((value) => (
              <AppLink
                className={status === value ? "tab active" : "tab"}
                key={value}
                href={value === "active" ? WORKSPACE_ROUTES.projects : WORKSPACE_ROUTES.archived}
                aria-current={status === value ? "page" : undefined}
                onClick={() => {
                  setPendingDeleteProjectId(null);
                  setRenamingProjectId(null);
                }}
              >
                {statusLabel(value)}项目 <span className="tab-count">{projectCounts[value]}</span>
              </AppLink>
            ))}
          </nav>
          <label className="sort-control">
            排序方式
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as ProjectSort)}
            >
              <option value="updatedAt">最近更新</option>
              <option value="createdAt">最近创建</option>
              <option value="title">标题</option>
            </select>
          </label>
        </div>

        <div className="section-heading project-list-heading">
          <div>
            <p className="eyebrow">你的歌曲</p>
            <h2 id="project-list-heading">{statusLabel(status)}项目</h2>
          </div>
          <p>{visibleProjects.length} 个项目</p>
        </div>

        {isLoading ? <p className="empty-state">正在加载本地项目…</p> : null}
        {!isLoading && visibleProjects.length === 0 ? (
          <div className="empty-state">
            <h3>{status === "active" ? "还没有进行中的项目" : "还没有已归档的项目"}</h3>
            <p>
              {status === "active"
                ? "使用上面的表单创建你的第一个 Song Project。"
                : "你归档的项目会显示在这里，数据不会丢失。"}
            </p>
          </div>
        ) : null}

        <div className="project-list">
          {visibleProjects.map((project, index) => (
            <article className="project-card archive-entry" key={project.projectId}>
              <ArchiveIndex number={index + 1} label={status === "active" ? "OPEN" : "FILED"} />
              <div className="project-main">
                <div className="project-card-title">
                  <div className="project-card-labels">
                    <p className="stage">{formatProjectStage(project.currentStage)}</p>
                    <span className={`status-pill ${project.status}`}>{statusLabel(project.status)}</span>
                  </div>
                  <h3 id={`project-title-${project.projectId}`}>{project.title}</h3>
                </div>
                <MarginNote>
                  {project.projectNote ? project.projectNote : "暂无项目备注"}
                </MarginNote>
              </div>

              <dl className="project-meta">
                <div>
                  <dt>更新于</dt>
                  <dd><time dateTime={project.updatedAt}>{formatLastEdited(project.updatedAt)}</time></dd>
                </div>
                <div>
                  <dt>创建于</dt>
                  <dd><time dateTime={project.createdAt}>{formatLastEdited(project.createdAt)}</time></dd>
                </div>
              </dl>

              <div className="project-actions archive-entry-actions">
                <AppLink className="primary-link" href={projectRoute(project.projectId)}>
                  继续 →
                </AppLink>
                <details
                  className="project-more-actions"
                  open={renamingProjectId === project.projectId || pendingDeleteProjectId === project.projectId}
                >
                  <summary>更多操作</summary>
                  <div className="project-actions-menu">
                    {renamingProjectId === project.projectId ? (
                      <form
                        className="inline-form"
                        onSubmit={(event) => renameProject(event, project.projectId)}
                      >
                        <label className="sr-only" htmlFor={`rename-${project.projectId}`}>
                          重命名 {project.title}
                        </label>
                        <input
                          id={`rename-${project.projectId}`}
                          required
                          maxLength={120}
                          value={renameTitle}
                          onChange={(event) => setRenameTitle(event.target.value)}
                        />
                        <button type="submit">保存名称</button>
                        <button type="button" onClick={() => setRenamingProjectId(null)}>
                          取消
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingProjectId(project.projectId);
                          setRenameTitle(project.title);
                          setPendingDeleteProjectId(null);
                        }}
                      >
                        重命名
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void runAsyncMutation(async () => {
                          await createBrowserMelodyService().duplicateProject(project.projectId);
                        })
                      }
                    >
                      复制
                    </button>
                    {project.status === "active" ? (
                      <button
                        type="button"
                        onClick={() =>
                          runMutation(() => {
                            createBrowserProjectRepository().archive(project.projectId);
                          })
                        }
                      >
                        归档
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          runMutation(() => {
                            createBrowserProjectRepository().unarchive(project.projectId);
                          })
                        }
                      >
                        取消归档
                      </button>
                    )}
                    {pendingDeleteProjectId === project.projectId ? (
                      <div className="delete-confirmation" role="group" aria-label={`Delete ${project.title}`}>
                        <span>这会永久删除该项目及其保存的数据。</span>
                        <button
                          className="danger-button"
                          type="button"
                          onClick={() => void deleteProject(project.projectId)}
                        >
                          确认删除
                        </button>
                        <button type="button" onClick={() => setPendingDeleteProjectId(null)}>
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => {
                          setPendingDeleteProjectId(project.projectId);
                          setRenamingProjectId(null);
                        }}
                      >
                        删除
                      </button>
                    )}
                  </div>
                </details>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
