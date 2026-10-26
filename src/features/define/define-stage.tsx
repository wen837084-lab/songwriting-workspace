"use client";

import { AppLink } from "../navigation/app-link";
import { projectCreateRoute } from "../navigation/routes";
import { FormEvent, useState } from "react";
import type {
  SongIntentTextField,
  SongProject,
} from "../../domain/project/project";
import { createBrowserProjectRepository } from "../../infrastructure/persistence/browser-project-repository";
import {
  IDEA_STARTING_POINT_LABELS,
  MATERIAL_TYPE_LABELS,
} from "../idea-explore/prompts";

interface DefineStageProps {
  project: SongProject;
  onProjectChange: (project: SongProject) => void;
  onError: (message: string | null) => void;
}

interface IntentQuestion {
  field: SongIntentTextField | "selectedMaterialIds";
  prompt: string;
  guidance: string;
}

export const DEFINE_QUESTIONS: readonly IntentQuestion[] = [
  {
    field: "coreIdea",
    prompt: "这首歌其实是在讲什么？",
    guidance: "用你自己的话记下现在的想法。它可以不完整，也可以以后改变。",
  },
  {
    field: "desiredFeeling",
    prompt: "你最想让别人听完以后感受到什么？",
    guidance: "这里没有标准答案，只保存你此刻想传达的感受。",
  },
  {
    field: "coreImage",
    prompt: "如果只能留下一个画面，你留下什么？",
    guidance: "写下你自己的画面，不需要把它改成歌词。",
  },
  {
    field: "centralConflict",
    prompt: "这件事情最矛盾的地方是什么？",
    guidance: "可以留白、跳过，或写下仍然不确定的地方。",
  },
  {
    field: "selectedMaterialIds",
    prompt: "哪些素材是你目前最舍不得删掉的？",
    guidance: "请手动选择最多三个。少于三个或暂时不选都可以。",
  },
];

function IntentMaterialSelector({
  project,
  onProjectChange,
  onError,
}: DefineStageProps) {
  const selectedIds = project.songIntent.selectedMaterialIds;

  function toggle(materialId: string) {
    const nextIds = selectedIds.includes(materialId)
      ? selectedIds.filter((selectedId) => selectedId !== materialId)
      : [...selectedIds, materialId];
    try {
      onProjectChange(
        createBrowserProjectRepository().updateSongIntent(project.projectId, {
          selectedMaterialIds: nextIds,
        }),
      );
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not update selected materials.");
    }
  }

  if (project.materials.length === 0) {
    return (
      <div className="intent-empty-materials">
        <p>Material Library 目前是空的。这里不会自动创建或选择素材。</p>
        <AppLink href={projectCreateRoute(project.projectId, "explore")}>返回 Explore / 探索收集素材</AppLink>
      </div>
    );
  }

  return (
    <div className="intent-material-list" role="group" aria-label="最多选择三个素材">
      {project.materials.map((material) => {
        const selected = selectedIds.includes(material.materialId);
        const selectionLimitReached = selectedIds.length >= 3 && !selected;
        return (
          <label className={selected ? "intent-material selected" : "intent-material"} key={material.materialId}>
            <input
              type="checkbox"
              checked={selected}
              disabled={selectionLimitReached}
              onChange={() => toggle(material.materialId)}
            />
            <span>
              <span className="material-type">{MATERIAL_TYPE_LABELS[material.type]}</span>
              <span className="material-content">{material.content}</span>
              {material.note ? <span className="material-note">备注：{material.note}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function CreatorContext({ project }: { project: SongProject }) {
  const answeredResponses = project.explore.responses.filter(
    (response) => response.status === "answered",
  );
  return (
    <details className="creator-context">
      <summary>查看我之前记录的内容</summary>
      <div>
        <p className="context-label">Idea 起点</p>
        <p>
          {project.idea.startingPoint
            ? IDEA_STARTING_POINT_LABELS[project.idea.startingPoint]
            : "尚未选择"}
        </p>
        <p className="context-label">Explore 回答</p>
        {answeredResponses.length ? (
          <ul>
            {answeredResponses.map((response) => (
              <li key={response.responseId}>{response.content}</li>
            ))}
          </ul>
        ) : <p>尚无已回答的 Explore 问题。</p>}
        <p className="context-label">Material Library / 素材库</p>
        {project.materials.length ? (
          <ul>
            {project.materials.map((material) => (
              <li key={material.materialId}>
                <span>{MATERIAL_TYPE_LABELS[material.type]} · {material.content}</span>
                {material.note ? <small>备注：{material.note}</small> : null}
              </li>
            ))}
          </ul>
        ) : <p>尚无已保存素材。</p>}
      </div>
    </details>
  );
}

function GuidedDefineStage(props: DefineStageProps) {
  const { project, onProjectChange, onError } = props;
  const [questionIndex, setQuestionIndex] = useState(0);
  const question = DEFINE_QUESTIONS[questionIndex];
  const isMaterialQuestion = question.field === "selectedMaterialIds";
  const field: SongIntentTextField | null = question.field === "selectedMaterialIds"
    ? null
    : question.field;
  const [drafts, setDrafts] = useState<Record<SongIntentTextField, string>>(() => ({
    coreIdea: project.songIntent.coreIdea,
    desiredFeeling: project.songIntent.desiredFeeling,
    coreImage: project.songIntent.coreImage,
    centralConflict: project.songIntent.centralConflict,
  }));

  function saveAndNext() {
    if (!field) {
      setQuestionIndex((current) => Math.min(current + 1, DEFINE_QUESTIONS.length - 1));
      return;
    }
    try {
      const updated = createBrowserProjectRepository().updateSongIntent(project.projectId, {
        [field]: drafts[field],
      });
      onProjectChange(updated);
      setQuestionIndex((current) => Math.min(current + 1, DEFINE_QUESTIONS.length - 1));
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save this answer.");
    }
  }

  return (
    <div className="define-stage">
      <p className="eyebrow">Define / 定义 · 一次一个问题</p>
      <h2 id="current-stage-heading">{question.prompt}</h2>
      <p className="task-purpose">{question.guidance}</p>

      {field ? (
        <label className="intent-guided-input">
          你的回答 <span className="optional">可选</span>
          <textarea
            rows={8}
            maxLength={4000}
            value={drafts[field]}
            onChange={(event) => setDrafts((current) => ({
              ...current,
              [field]: event.target.value,
            }))}
            placeholder="保留你自己的措辞。"
          />
        </label>
      ) : <IntentMaterialSelector {...props} />}

      <div className="define-actions">
        <button
          type="button"
          disabled={questionIndex === 0}
          onClick={() => setQuestionIndex((current) => Math.max(0, current - 1))}
        >
          返回
        </button>
        <button
          type="button"
          onClick={() => setQuestionIndex((current) => Math.min(current + 1, DEFINE_QUESTIONS.length - 1))}
        >
          跳过
        </button>
        <button className="primary-button" type="button" onClick={saveAndNext}>
          {isMaterialQuestion ? "保留选择" : "保存并继续"}
        </button>
      </div>
      <CreatorContext project={project} />
    </div>
  );
}

function FreeDefineStage(props: DefineStageProps) {
  const { project, onProjectChange, onError } = props;
  const [drafts, setDrafts] = useState<Record<SongIntentTextField, string>>(() => ({
    coreIdea: project.songIntent.coreIdea,
    desiredFeeling: project.songIntent.desiredFeeling,
    coreImage: project.songIntent.coreImage,
    centralConflict: project.songIntent.centralConflict,
  }));

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      onProjectChange(
        createBrowserProjectRepository().updateSongIntent(project.projectId, drafts),
      );
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save Song Intent.");
    }
  }

  return (
    <div className="define-stage">
      <p className="eyebrow">Define / 定义 · Free 模式</p>
      <h2 id="current-stage-heading">Song Intent / 歌曲意图</h2>
      <p className="task-purpose">直接整理你当前的方向。每一项都可以留白、修改或清除。</p>
      <form className="intent-free-form" onSubmit={save}>
        {DEFINE_QUESTIONS.slice(0, 4).map((question) => {
          const field = question.field as SongIntentTextField;
          return (
            <label key={field}>
              {question.prompt} <span className="optional">可选</span>
              <textarea
                rows={4}
                maxLength={4000}
                value={drafts[field]}
                onChange={(event) => setDrafts((current) => ({
                  ...current,
                  [field]: event.target.value,
                }))}
              />
            </label>
          );
        })}
        <button className="primary-button" type="submit">保存 Song Intent</button>
      </form>
      <section className="free-material-selection" aria-labelledby="selected-materials-heading">
        <h3 id="selected-materials-heading">已选素材</h3>
        <p>请选择最多三个你目前最舍不得删掉的素材。少选或不选都可以。</p>
        <IntentMaterialSelector {...props} />
      </section>
      <CreatorContext project={project} />
    </div>
  );
}

export function DefineStage(props: DefineStageProps) {
  return props.project.creationMode === "Guided"
    ? <GuidedDefineStage {...props} />
    : <FreeDefineStage {...props} />;
}
