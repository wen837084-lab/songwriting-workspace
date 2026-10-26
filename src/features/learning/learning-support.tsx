"use client";

import { AppLink } from "../navigation/app-link";
import { WORKSPACE_ROUTES } from "../navigation/routes";
import { useState } from "react";
import {
  getLearningStageContent,
  LEARNING_TABS,
  type LearningEntryPoint,
  type LearningTab,
} from "../../domain/learning/learning";
import type { ProjectStage } from "../../domain/project/project";

const TAB_LABELS: Record<LearningTab, string> = {
  "quick-understanding": "快速理解",
  practice: "练习",
  "deeper-learning": "深入学习",
};

export function LearningSupport({ stage, defaultOpen = false }: { stage: ProjectStage; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [entryPoint, setEntryPoint] = useState<LearningEntryPoint>("need-to-learn");
  const [activeTab, setActiveTab] = useState<LearningTab>("quick-understanding");
  const content = getLearningStageContent(stage);
  const activeLayer = content[
    activeTab === "quick-understanding"
      ? "quickUnderstanding"
      : activeTab === "deeper-learning"
        ? "deeperLearning"
        : "practice"
  ];

  function openLearning(nextEntryPoint: LearningEntryPoint) {
    setEntryPoint(nextEntryPoint);
    setActiveTab("quick-understanding");
    setIsOpen(true);
  }

  return (
    <section className="learning-support" aria-labelledby="learning-support-heading">
      <div className="learning-support-header">
        <div>
          <p className="eyebrow">可选辅助</p>
          <h2 id="learning-support-heading">需要时再学习</h2>
          <p>先继续创作。需要时，再打开一份与当前阶段相关的简短指南。</p>
          <AppLink className="learning-skill-map-link" href={WORKSPACE_ROUTES.skills}>
            查看 Skill Map
          </AppLink>
        </div>
        <div className="learning-entry-actions">
          <button type="button" onClick={() => openLearning("stuck")}>
            我卡住了
          </button>
          <button type="button" onClick={() => openLearning("need-to-learn")}>
            我现在需要学什么？
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="learning-panel" aria-label={`${content.stageLabel} Learning Support`}>
          <div className="learning-panel-header">
            <div>
              <p className="eyebrow">{entryPoint === "stuck" ? "当你感到卡住时" : "当前阶段的路径"}</p>
              <h3>{content.stageLabel}: {content.focus}</h3>
            </div>
            <button
              className="learning-close-button"
              type="button"
              aria-label="关闭学习辅助"
              onClick={() => setIsOpen(false)}
            >
              关闭
            </button>
          </div>

          <p className="learning-panel-intro">
            {entryPoint === "stuck" ? content.stuckIntro : content.needToLearnIntro}
          </p>

          <div className="learning-tabs" role="tablist" aria-label="学习深度">
            {LEARNING_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={activeTab === tab ? "learning-tab active" : "learning-tab"}
                onClick={() => setActiveTab(tab)}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          <article className="learning-layer" role="tabpanel">
            <p className="learning-layer-label">{TAB_LABELS[activeTab]}</p>
            <h4>{activeLayer.title}</h4>
            <p>{activeLayer.summary}</p>
            <ul>
              {activeLayer.points.map((point) => <li key={point}>{point}</li>)}
            </ul>
          </article>

          <div className="learning-panel-footer">
            <p>这里不会改变你的歌曲。想回到 {content.stageLabel} 时，随时关闭这个面板。</p>
            <button type="button" onClick={() => setIsOpen(false)}>回到创作</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
