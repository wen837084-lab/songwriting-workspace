"use client";

import { AppLink } from "../navigation/app-link";
import type {
  ProjectCreationMode,
  ProjectStage,
} from "../../domain/project/project";
import { createBrowserProjectRepository } from "../../infrastructure/persistence/browser-project-repository";
import { DefineStage } from "../define/define-stage";
import { ExploreStage, IdeaStage } from "../idea-explore/idea-explore-stage";
import { LyricsContext, LyricsWorkspace } from "../lyrics/lyrics-workspace";
import { MelodyContext, MelodyWorkspace } from "../melody/melody-workspace";
import { formatLastEdited } from "../projects/format-date";
import { RhythmContext, RhythmWorkspace } from "../rhythm/rhythm-workspace";
import { HarmonyContext, HarmonyWorkspace } from "../harmony/harmony-workspace";
import { ArrangementContext, ArrangementWorkspace } from "../arrangement/arrangement-workspace";
import { getGarageBandPracticeStage } from "../garageband/garageband-practice";
import { ProjectFrame } from "../navigation/project-frame";
import { projectCreateRoute, projectToolsRoute } from "../navigation/routes";
import { SongMapContext, SongMapWorkspace } from "../song-map/song-map-workspace";
import { ProjectRouteState } from "../projects/project-route-state";
import { useProject } from "../projects/use-project";
import {
  CREATION_STAGES,
  getAdjacentCreationStages,
  getStageDefinition,
} from "./stages";

export function JourneyPage({
  projectId,
  stage,
}: {
  projectId: string;
  stage: ProjectStage;
}) {
  const { project, setProject, isLoading, error, setError } = useProject(projectId, stage);
  const definition = getStageDefinition(stage);
  const adjacent = getAdjacentCreationStages(stage);

  function setMode(mode: ProjectCreationMode) {
    try {
      const updated = createBrowserProjectRepository().setCreationMode(projectId, mode);
      setProject(updated);
      setError(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not change mode.");
    }
  }

  if (!project) return <ProjectRouteState isLoading={isLoading} error={error} />;

  return (
    <ProjectFrame project={project} current="create" contextLabel={`Create / ${definition.label}`}>
      {error ? <div className="error-message" role="alert">{error}</div> : null}
          <header className="journey-header">
            <div>
              <p className="eyebrow">创作 · {definition.label}</p>
              <h1>Creation Journey / 创作旅程</h1>
              <p className="lede">选择你想关注的地方。每个创作阶段都可以进入。</p>
            </div>
            <div className="mode-control" aria-label="创作模式">
              <span>模式</span>
              {(["Guided", "Free"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={project.creationMode === mode}
                  className={project.creationMode === mode ? "mode-button active" : "mode-button"}
                  onClick={() => setMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </header>

          <div className="journey-layout">
            <nav className="journey-nav journey-nav-desktop" aria-label="Creation Journey 阶段">
              <p className="eyebrow">Journey / 旅程</p>
              <div className="journey-stage-list">
                {CREATION_STAGES.map((item) => (
                  <AppLink
                    key={item.stage}
                    href={projectCreateRoute(projectId, item.slug)}
                    aria-current={item.stage === stage ? "step" : undefined}
                    className={item.stage === stage ? "journey-stage active" : "journey-stage"}
                  >
                    {item.label}
                  </AppLink>
                ))}
                {project.creationMode === "Free" ? (
                  <AppLink
                    href={`${projectCreateRoute(projectId, "idea")}#material-library`}
                    className="journey-stage"
                  >
                    Material Library / 素材库
                  </AppLink>
                ) : null}
              </div>
            </nav>

            <details className="journey-nav-mobile">
              <summary>阶段菜单 · {definition.label}</summary>
              <nav aria-label="Creation Journey 移动端阶段">
                {CREATION_STAGES.map((item) => (
                  <AppLink
                    key={item.stage}
                    href={projectCreateRoute(projectId, item.slug)}
                    aria-current={item.stage === stage ? "step" : undefined}
                    className={item.stage === stage ? "journey-stage active" : "journey-stage"}
                  >
                    {item.label}
                  </AppLink>
                ))}
              </nav>
            </details>

            <section className="current-task" aria-labelledby="current-stage-heading">
              <nav className="contextual-tool-links" aria-label="当前阶段的可选工具">
                <span>需要辅助？</span>
                <AppLink href={projectToolsRoute(project.projectId, "learning")}>学习辅助</AppLink>
                <AppLink href={projectToolsRoute(project.projectId, "ai-coach")}>AI Coach</AppLink>
                {getGarageBandPracticeStage(stage) ? <AppLink href={projectToolsRoute(project.projectId, "garageband")}>GarageBand 练习</AppLink> : null}
              </nav>
              {stage === "Idea" ? (
                <IdeaStage key={project.projectId} project={project} onProjectChange={setProject} onError={setError} />
              ) : stage === "Explore" ? (
                <ExploreStage key={project.projectId} project={project} onProjectChange={setProject} onError={setError} />
              ) : stage === "Define" ? (
                <DefineStage key={project.projectId} project={project} onProjectChange={setProject} onError={setError} />
              ) : stage === "Lyrics" ? (
                <LyricsWorkspace key={project.projectId} project={project} onProjectChange={setProject} onError={setError} />
              ) : stage === "Melody" ? (
                <MelodyWorkspace key={project.projectId} project={project} onProjectChange={setProject} onError={setError} />
              ) : stage === "Rhythm" ? (
                <RhythmWorkspace key={project.projectId} project={project} onProjectChange={setProject} onError={setError} />
              ) : stage === "Harmony" ? (
                <HarmonyWorkspace key={project.projectId} project={project} onProjectChange={setProject} onError={setError} />
              ) : stage === "SongStructure" ? (
                <SongMapWorkspace key={project.projectId} project={project} onProjectChange={setProject} onError={setError} />
              ) : stage === "Arrangement" ? (
                <ArrangementWorkspace key={project.projectId} project={project} onProjectChange={setProject} onError={setError} />
              ) : (
                <>
                  <p className="eyebrow">当前阶段</p>
                  <h2 id="current-stage-heading">{definition.label}</h2>
                  <p className="task-purpose">{definition.purpose}</p>
                  <div className="placeholder-notice">
                    <p>{definition.laterPhaseMessage}</p>
                    <p>此页面只用于确定工作流位置。这个阶段尚未实现。</p>
                  </div>
                </>
              )}

              {stage !== "Idea" && stage !== "Explore" && stage !== "Define" && stage !== "Lyrics" && project.creationMode === "Guided" ? (
                <div className="guided-navigation" aria-label="Guided 导航">
                  <p>你可以一次移动一个阶段，也可以从 Journey 中选择任意阶段。</p>
                  <div>
                    {adjacent.previous ? (
                      <AppLink href={projectCreateRoute(projectId, adjacent.previous.slug)}>
                        ← 上一步：{adjacent.previous.label}
                      </AppLink>
                    ) : <span />}
                    {adjacent.next ? (
                      <AppLink href={projectCreateRoute(projectId, adjacent.next.slug)}>
                        下一步：{adjacent.next.label} →
                      </AppLink>
                    ) : null}
                  </div>
                </div>
              ) : stage !== "Idea" && stage !== "Explore" && stage !== "Define" && stage !== "Lyrics" ? (
                <p className="free-mode-note">Free 模式：你可以随时直接进入任意阶段。</p>
              ) : null}
            </section>

            <aside className="context-panel" aria-labelledby="context-heading">
              <p className="eyebrow">上下文</p>
              <h2 id="context-heading">Project 上下文</h2>
              <dl>
                <div><dt>模式</dt><dd>{project.creationMode}</dd></div>
                <div><dt>当前关注</dt><dd>{definition.label}</dd></div>
                {(stage === "Idea" || stage === "Explore" || stage === "Define") ? (
                  <div><dt>已保存素材</dt><dd>{project.materials.length}</dd></div>
                ) : null}
                {stage === "Define" ? (
                  <div><dt>已选素材</dt><dd>{project.songIntent.selectedMaterialIds.length}</dd></div>
                ) : null}
                {stage === "Lyrics" ? (
                  <div><dt>歌曲段落</dt><dd>{project.lyrics.sections.length}</dd></div>
                ) : null}
                {stage === "Melody" ? (
                  <div><dt>已录制 Takes</dt><dd>{project.melody.takes.length}</dd></div>
                ) : null}
                {stage === "Rhythm" ? (
                  <><div><dt>BPM</dt><dd>{project.rhythm.bpm}</dd></div><div><dt>拍号</dt><dd>{project.rhythm.timeSignature}</dd></div></>
                ) : null}
                {stage === "Harmony" ? (
                  <><div><dt>Key</dt><dd>{project.harmony.key ?? "未设置"}</dd></div><div><dt>和弦进行</dt><dd>{project.harmony.progressions.length}</dd></div></>
                ) : null}
                {stage === "SongStructure" ? (
                  <div><dt>Song sections</dt><dd>{project.lyrics.sections.length}</dd></div>
                ) : null}
                {stage === "Arrangement" ? (
                  <><div><dt>Arrangement 轨道</dt><dd>{project.arrangement.tracks.length}</dd></div><div><dt>已保存单元格</dt><dd>{project.arrangement.cells.length}</dd></div></>
                ) : null}
                {getGarageBandPracticeStage(stage) ? (
                  <div><dt>实验</dt><dd>{project.garageBandExperiments.length}</dd></div>
                ) : null}
                <div><dt>最后编辑</dt><dd>{formatLastEdited(project.updatedAt)}</dd></div>
              </dl>
              {(stage === "Idea" || stage === "Explore") ? (
                <p><a className="quiet-link" href="#material-library">打开 Material Library / 素材库</a></p>
              ) : stage === "Define" ? (
                <p>这里只保存你自己的回答和明确选择。</p>
              ) : stage === "Lyrics" ? (
                <LyricsContext project={project} />
              ) : stage === "Melody" ? (
                <MelodyContext project={project} />
              ) : stage === "Rhythm" ? (
                <RhythmContext project={project} />
              ) : stage === "Harmony" ? (
                <HarmonyContext project={project} />
              ) : stage === "SongStructure" ? (
                <SongMapContext project={project} />
              ) : stage === "Arrangement" ? (
                <ArrangementContext project={project} />
              ) : <p>当前任务需要时，这里会显示对应阶段的上下文。</p>}
            </aside>
          </div>
    </ProjectFrame>
  );
}
