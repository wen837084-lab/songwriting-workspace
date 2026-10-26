"use client";

import { AppLink } from "../navigation/app-link";
import { projectCreateRoute } from "../navigation/routes";
import { useState } from "react";
import {
  IDEA_STARTING_POINTS,
  MATERIAL_TYPES,
  type MaterialType,
  type SongProject,
} from "../../domain/project/project";
import { createBrowserProjectRepository } from "../../infrastructure/persistence/browser-project-repository";
import { MaterialLibrary } from "./material-library";
import {
  EXPLORE_PROMPTS,
  IDEA_STARTING_POINT_LABELS,
  MATERIAL_TYPE_LABELS,
} from "./prompts";

interface StageProps {
  project: SongProject;
  onProjectChange: (project: SongProject) => void;
  onError: (message: string | null) => void;
}

export function IdeaStage({ project, onProjectChange, onError }: StageProps) {
  function choose(startingPoint: (typeof IDEA_STARTING_POINTS)[number]) {
    try {
      onProjectChange(createBrowserProjectRepository().setIdeaStartingPoint(project.projectId, startingPoint));
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save this starting point.");
    }
  }

  return (
    <>
      <div className="idea-task">
        <p className="eyebrow">先收集，再创作</p>
        <h2 id="current-stage-heading">你现在已经有什么？</h2>
        <p className="task-purpose">选择最接近你当前起点的一项。这只记录你已有的素材，不会生成任何歌曲内容。</p>
        <div className="starting-point-grid" role="group" aria-label="Idea 起点">
          {IDEA_STARTING_POINTS.map((startingPoint) => (
            <button
              key={startingPoint}
              type="button"
              aria-pressed={project.idea.startingPoint === startingPoint}
              className={project.idea.startingPoint === startingPoint ? "starting-point active" : "starting-point"}
              onClick={() => choose(startingPoint)}
            >
              {IDEA_STARTING_POINT_LABELS[startingPoint]}
            </button>
          ))}
        </div>
        {project.idea.startingPoint ? (
          <div className="saved-choice" role="status">
            已记录：你当前从“{IDEA_STARTING_POINT_LABELS[project.idea.startingPoint]}”开始。
            <AppLink href={projectCreateRoute(project.projectId, "explore")}>进入 Explore / 探索 →</AppLink>
          </div>
        ) : null}
      </div>
      <MaterialLibrary project={project} onProjectChange={onProjectChange} onError={onError} />
    </>
  );
}

export function ExploreStage({ project, onProjectChange, onError }: StageProps) {
  const rawIndex = project.explore.currentPromptIndex;
  const isAtEnd = rawIndex >= EXPLORE_PROMPTS.length;
  const index = Math.min(rawIndex, EXPLORE_PROMPTS.length - 1);
  const prompt = EXPLORE_PROMPTS[index];
  const response = project.explore.responses.find((item) => item.promptId === prompt.promptId);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      project.explore.responses
        .filter((item) => item.status === "answered")
        .map((item) => [item.promptId, item.content]),
    ),
  );
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [materialType, setMaterialType] = useState<MaterialType>("other");
  const [addNoteOpen, setAddNoteOpen] = useState(false);

  const draft = drafts[prompt.promptId] ?? (response?.status === "answered" ? response.content : "");

  function answer() {
    try {
      const updated = createBrowserProjectRepository().answerExplore(project.projectId, {
        promptId: prompt.promptId,
        promptIndex: index,
        content: draft,
        saveAsMaterial: saveToLibrary ? materialType : undefined,
      });
      onProjectChange(updated);
      setSaveToLibrary(false);
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save this answer.");
    }
  }

  function skip() {
    try {
      onProjectChange(createBrowserProjectRepository().skipExplore(project.projectId, prompt.promptId, index));
      setSaveToLibrary(false);
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not skip this question.");
    }
  }

  function moveTo(nextIndex: number) {
    try {
      onProjectChange(createBrowserProjectRepository().setExplorePromptIndex(project.projectId, nextIndex));
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not move to that question.");
    }
  }

  return (
    <>
      <div className="explore-task">
        <p className="eyebrow">Explore / 探索 · 一次一个问题</p>
        {isAtEnd ? (
          <div className="explore-end">
            <h2 id="current-stage-heading">先停在这里也可以。</h2>
            <p className="task-purpose">这些问题不是清单，也没有完成百分比。你可以回看、继续保存自己的素材，或随时离开。</p>
            <button type="button" onClick={() => moveTo(EXPLORE_PROMPTS.length - 1)}>← 返回</button>
          </div>
        ) : (
          <>
            <h2 id="current-stage-heading">{prompt.text}</h2>
            {response?.status === "skipped" ? <p className="response-state">你之前跳过了这个问题。现在仍然可以回答。</p> : null}
            <label className="explore-input">
              你的回答
              <textarea
                rows={8}
                maxLength={4000}
                value={draft}
                onChange={(event) => setDrafts((current) => ({ ...current, [prompt.promptId]: event.target.value }))}
                placeholder="只写下你自己的观察、记忆或素材。"
              />
            </label>
            <label className="save-answer-choice">
              <input type="checkbox" checked={saveToLibrary} onChange={(event) => setSaveToLibrary(event.target.checked)} />
              同时把这次回答保存到 Material Library
            </label>
            {saveToLibrary ? (
              <label>
                素材类型
                <select value={materialType} onChange={(event) => setMaterialType(event.target.value as MaterialType)}>
                  {MATERIAL_TYPES.map((value) => <option key={value} value={value}>{MATERIAL_TYPE_LABELS[value]}</option>)}
                </select>
              </label>
            ) : null}
            <div className="explore-actions">
              <button className="primary-button" type="button" onClick={answer}>回答</button>
              <button type="button" onClick={skip}>跳过</button>
              <button type="button" disabled={index === 0} onClick={() => moveTo(index - 1)}>返回</button>
              <button type="button" onClick={() => setAddNoteOpen(true)}>添加备注</button>
            </div>
          </>
        )}
      </div>
      <MaterialLibrary
        project={project}
        onProjectChange={onProjectChange}
        onError={onError}
        addFormOpen={addNoteOpen}
        onAddFormOpenChange={setAddNoteOpen}
      />
    </>
  );
}
