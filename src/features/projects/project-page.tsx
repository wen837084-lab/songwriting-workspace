"use client";

import { AppLink } from "../navigation/app-link";
import { FormEvent, useState } from "react";
import { createBrowserProjectRepository } from "../../infrastructure/persistence/browser-project-repository";
import { ArchiveMeta, MarginNote, StaffFragment, StripeMarker } from "../../components/archive/archive-markup";
import { getStageDefinition } from "../creation-journey/stages";
import { getCurrentProjectHref } from "../navigation/navigation";
import { projectReviewRoute, projectToolsRoute } from "../navigation/routes";
import { ProjectFrame } from "../navigation/project-frame";
import { formatLastEdited } from "./format-date";
import { ProjectRouteState } from "./project-route-state";
import { useProject } from "./use-project";

function reviewStatusLabel(status: "not-reviewed" | "in-review" | "reviewed") {
  if (status === "in-review") return "回顾中";
  if (status === "reviewed") return "已回顾";
  return "未回顾";
}

export function ProjectPage({ projectId }: { projectId: string }) {
  const { project, setProject, isLoading, error, setError } = useProject(projectId);
  const [titleDraft, setTitleDraft] = useState<{ projectId: string; value: string } | null>(null);
  const [noteDraft, setNoteDraft] = useState<{ projectId: string; value: string } | null>(null);

  if (!project) return <ProjectRouteState isLoading={isLoading} error={error} />;

  const title = titleDraft?.projectId === projectId ? titleDraft.value : project.title;
  const projectNote = noteDraft?.projectId === projectId ? noteDraft.value : project.projectNote;
  const currentStage = getStageDefinition(project.currentStage);
  const recentVersion = project.versions.at(-1) ?? null;

  function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const updated = createBrowserProjectRepository().update(projectId, { title, projectNote });
      setProject(updated);
      setTitleDraft(null);
      setNoteDraft(null);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "无法保存这个 Project。");
    }
  }

  return (
    <ProjectFrame project={project} current="overview" contextLabel="Song / Overview">
      {error ? <div className="error-message" role="alert">{error}</div> : null}
      <header className="page-header project-overview-heading dossier-heading">
        <div className="dossier-heading-markers">
          <ArchiveMeta>SONG DOSSIER / {project.projectId.slice(0, 4).toUpperCase()}</ArchiveMeta>
          <StaffFragment />
        </div>
        <p className="eyebrow">歌曲 / 概览</p>
        <h1>{project.title}</h1>
        <p className="lede">查看这个 Song Project 的事实信息，并清楚地回到创作。</p>
      </header>

      <section className="journey-entry dossier-current-stage" aria-labelledby="continue-creating-heading">
        <StripeMarker label="当前阶段" />
        <div>
          <p className="eyebrow">当前阶段 · {project.creationMode} 模式</p>
          <h2 id="continue-creating-heading">继续处理：{currentStage.label}</h2>
          <p>{currentStage.purpose}</p>
        </div>
        <AppLink className="primary-link" href={getCurrentProjectHref(project.projectId, project.currentStage)}>继续创作</AppLink>
      </section>

      <section className="overview-facts dossier-facts" aria-labelledby="project-facts-heading">
        <div className="section-heading">
          <div><p className="eyebrow">Project 事实</p><h2 id="project-facts-heading">当前歌曲上下文</h2></div>
          <MarginNote>更新于 {formatLastEdited(project.updatedAt)}<br />所有内容来自这个 Project。</MarginNote>
        </div>
        <dl className="overview-fact-grid">
          <div><dt>Song Intent</dt><dd>{project.songIntent.coreIdea || "未设置"}</dd></div>
          <div><dt>段落</dt><dd>{project.lyrics.sections.length}</dd></div>
          <div><dt>Rhythm / 节奏</dt><dd>{project.rhythm.bpm} BPM · {project.rhythm.timeSignature}</dd></div>
          <div><dt>Key / 调性</dt><dd>{project.harmony.key ?? "未设置"}</dd></div>
          <div><dt>Open Questions</dt><dd>{project.openQuestions.length}</dd></div>
          <div><dt>最近 Version</dt><dd>{recentVersion?.label ?? "尚未保存 Version"}</dd></div>
          <div><dt>回顾状态</dt><dd>{reviewStatusLabel(project.review.status)}</dd></div>
          <div><dt>Project ID</dt><dd className="project-id">{project.projectId}</dd></div>
        </dl>
      </section>

      <section className="overview-destinations dossier-destinations" aria-labelledby="overview-destinations-heading">
        <div className="section-heading"><div><p className="eyebrow">Project 区域</p><h2 id="overview-destinations-heading">处理这首歌</h2></div></div>
        <div className="overview-destination-grid">
          <AppLink href={getCurrentProjectHref(project.projectId, project.currentStage)}><strong>创作</strong><span>在所有可进入的创作阶段之间切换。</span></AppLink>
          <AppLink href={projectToolsRoute(project.projectId)}><strong>工具</strong><span>打开可选的学习、辅导、实验或 Versions。</span></AppLink>
          <AppLink href={projectReviewRoute(project.projectId)}><strong>回顾</strong><span>查看事实、问题和你自己的反思。</span></AppLink>
        </div>
      </section>

      <details className="project-details-editor">
        <summary>编辑 Project 标题和备注</summary>
        <section className="edit-panel" aria-labelledby="project-details-heading">
          <div><p className="eyebrow">Project 详情</p><h2 id="project-details-heading">保持基础信息最新</h2><p>这些详情不会改变歌曲的创作数据。</p></div>
          <form className="edit-form" onSubmit={saveProject}>
            <label>标题<input required maxLength={120} value={title} onChange={(event) => setTitleDraft({ projectId, value: event.target.value })} /></label>
            <label>Project 备注 <span className="optional">可选</span><textarea maxLength={500} rows={6} value={projectNote} onChange={(event) => setNoteDraft({ projectId, value: event.target.value })} placeholder="写下关于这个 Project 的私人备注。" /></label>
            <button className="primary-button" type="submit">保存修改</button>
          </form>
        </section>
      </details>
    </ProjectFrame>
  );
}
