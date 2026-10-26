"use client";

import { AppLink } from "../navigation/app-link";
import { projectReviewRoute, projectToolsRoute, WORKSPACE_ROUTES } from "../navigation/routes";
import { useState, type FormEvent } from "react";
import {
  createInitialAiCoachViewState,
  type AiCoachViewState,
} from "../../application/ai-coach/ai-coach-view-state";
import {
  type AiCoachResponse,
} from "../../domain/ai-coach/ai-coach";
import type { ProjectStage, SongProject } from "../../domain/project/project";
import { getAiCoachEndpoint } from "../../infrastructure/ai/ai-coach-endpoint";
import { RemoteAiCoachClient } from "../../infrastructure/ai/remote-ai-coach-client";

function hasSongIntent(project: SongProject): boolean {
  const intent = project.songIntent;
  return Boolean(intent.coreIdea || intent.desiredFeeling || intent.coreImage || intent.centralConflict);
}

function CoachFallback({ projectId }: { projectId: string }) {
  return (
    <div className="ai-coach-fallback" role="status">
      <h3>没有 AI 也可以继续创作</h3>
      <p>AI Coach 当前不可用。你的项目没有改变。</p>
      <div className="ai-coach-fallback-links">
        <AppLink href={projectToolsRoute(projectId, "learning")}>打开学习辅助</AppLink>
        <AppLink href={WORKSPACE_ROUTES.skills}>查看 Skill Map</AppLink>
        <AppLink href={projectReviewRoute(projectId)}>使用回顾和反思</AppLink>
      </div>
    </div>
  );
}

function CoachResponse({ response }: { response: AiCoachResponse }) {
  return (
    <div className="ai-coach-response" aria-live="polite">
      <div className="ai-coach-response-heading">
        <p className="eyebrow">可能的卡点</p>
        <h3>{response.bottleneckType}</h3>
        <p>{response.reasoningSummary}</p>
      </div>

      <section>
        <p className="ai-coach-label">建议关注的 Skill</p>
        <h4>{response.suggestedSkill}</h4>
        <p>你可以在学习辅助或 Skill Map 中查看已有的 {response.suggestedSkill} Skill。</p>
      </section>

      <section>
        <p className="ai-coach-label">反思问题</p>
        <ul>{response.reflectionQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
      </section>

      <section>
        <p className="ai-coach-label">脱离歌曲的练习</p>
        <h4>{response.exercise.title}</h4>
        <p>{response.exercise.purpose}</p>
        <ol>{response.exercise.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      </section>

      <p className="ai-coach-return">{response.returnToCreationPrompt}</p>
      <p className="ai-coach-boundary">这份回应只提供指导，不能应用到或插入你的歌曲。</p>
    </div>
  );
}

export function AiCoach({ project, stage, defaultOpen = false }: { project: SongProject; stage: ProjectStage; defaultOpen?: boolean }) {
  const initialState = createInitialAiCoachViewState();
  const [isOpen, setIsOpen] = useState(defaultOpen || initialState.isOpen);
  const [status, setStatus] = useState<AiCoachViewState["status"]>(initialState.status);
  const [stuckDescription, setStuckDescription] = useState("");
  const [shareSongIntent, setShareSongIntent] = useState(false);
  const [response, setResponse] = useState<AiCoachResponse | null>(null);
  const canShareSongIntent = hasSongIntent(project);

  async function requestCoaching(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stuckDescription.trim()) return;
    setStatus("loading");
    setResponse(null);

    try {
      const result = await new RemoteAiCoachClient({ endpoint: getAiCoachEndpoint() }).requestCoaching({
          projectId: project.projectId,
          stage,
          stuckDescription: stuckDescription.trim(),
          ...(shareSongIntent && canShareSongIntent
            ? {
                sharedSongIntent: {
                  coreIdea: project.songIntent.coreIdea,
                  desiredFeeling: project.songIntent.desiredFeeling,
                  coreImage: project.songIntent.coreImage,
                  centralConflict: project.songIntent.centralConflict,
                },
              }
            : {}),
      });
      if (result.status !== "available") {
        setStatus("fallback");
        return;
      }
      setResponse(result.response);
      setStatus("result");
    } catch {
      setStatus("fallback");
    }
  }

  if (!isOpen) {
    return (
        <section className="ai-coach-entry" aria-label="可选的 AI Coach">
        <div>
          <p className="eyebrow">可选的流程辅助</p>
          <h2>AI Coach</h2>
          <p>请求帮助，判断创作流程中可能的卡点。Coach 不会替你写歌或修改歌曲。</p>
        </div>
        <button type="button" onClick={() => setIsOpen(true)}>打开 AI Coach</button>
      </section>
    );
  }

  return (
    <section className="ai-coach-panel" aria-labelledby="ai-coach-heading">
      <div className="ai-coach-panel-header">
        <div>
          <p className="eyebrow">可选的流程辅助</p>
          <h2 id="ai-coach-heading">你卡在哪里？</h2>
          <p>只分享必要的信息。Coach 会帮助诊断、解释、提问或建议练习。</p>
        </div>
        <button type="button" onClick={() => setIsOpen(false)}>关闭</button>
      </div>

      <form className="ai-coach-form" onSubmit={requestCoaching}>
        <label>
          描述流程问题
          <textarea
            required
            maxLength={1000}
            rows={4}
            value={stuckDescription}
            onChange={(event) => setStuckDescription(event.target.value)}
            placeholder="例如：我能听出这一段感觉很静态，但不知道该观察哪个维度。"
          />
        </label>
        {canShareSongIntent ? (
          <label className="ai-coach-share-intent">
            <input
              type="checkbox"
              checked={shareSongIntent}
              onChange={(event) => setShareSongIntent(event.target.checked)}
            />
            在这次请求中分享我的 Song Intent
          </label>
        ) : null}
        <p className="ai-coach-context-note">将发送：这个 Project ID、当前阶段、你的描述，以及仅在你选择同意时发送的 Song Intent。不会发送 Lyrics、录音、素材、Versions 或历史记录。</p>
        <button className="primary-button" type="submit" disabled={status === "loading" || !stuckDescription.trim()}>
          {status === "loading" ? "正在请求 Coach…" : "帮助我诊断这个问题"}
        </button>
      </form>

      {status === "fallback" ? <CoachFallback projectId={project.projectId} /> : null}
      {status === "result" && response ? <CoachResponse response={response} /> : null}
    </section>
  );
}
