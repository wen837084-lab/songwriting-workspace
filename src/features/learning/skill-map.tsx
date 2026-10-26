"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SKILL_DEFINITIONS,
  SKILL_STATE_HELP,
  SKILL_STATE_LABELS,
  SKILL_STATES,
  type SkillId,
  type SkillProgress,
  type SkillState,
} from "../../domain/workspace/skill-map";
import { createBrowserWorkspaceRepository } from "../../infrastructure/persistence/browser-project-repository";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "读取 Skill Map 时出现了一些问题。";
}

export function SkillMap() {
  const [progress, setProgress] = useState<SkillProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    queueMicrotask(() => {
      if (!isCurrent) return;
      try {
        setProgress(createBrowserWorkspaceRepository().getSkillProgress());
        setError(null);
      } catch (loadError) {
        setError(errorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  const stateBySkill = useMemo(
    () => new Map(progress.map((item) => [item.skillId, item.state])),
    [progress],
  );

  function updateSkill(skillId: SkillId, state: SkillState) {
    try {
      setProgress(createBrowserWorkspaceRepository().updateSkillProgress(skillId, state));
      setError(null);
    } catch (updateError) {
      setError(errorMessage(updateError));
    }
  }

  return (
    <section className="skill-map" id="skill-map" aria-labelledby="skill-map-heading">
      <div className="skill-map-header">
        <div>
          <p className="eyebrow">Workspace 学习轨迹</p>
          <h2 id="skill-map-heading">Skill Map</h2>
          <p>
            简单记录你在不同歌曲中看过、练习过或想再复习的内容。
          </p>
        </div>
        <p className="skill-map-boundary">这是个人地图，不是评分。</p>
      </div>

      {error ? <div className="error-message" role="alert">{error}</div> : null}
      {isLoading ? <p className="skill-map-empty">正在加载 Skill Map…</p> : null}

      <div className="skill-map-grid">
        {SKILL_DEFINITIONS.map((skill) => {
          const selectedState = stateBySkill.get(skill.skillId);
          return (
            <article className="skill-card" key={skill.skillId}>
              <div>
                <p className="skill-card-category">{skill.label}</p>
                <h3>{skill.description}</h3>
              </div>
              <p className="skill-card-state">
                {selectedState ? SKILL_STATE_LABELS[selectedState] : "尚未设置状态。"}
              </p>
              <div className="skill-state-options" role="group" aria-label={`${skill.label} status`}>
                {SKILL_STATES.map((state) => (
                  <button
                    key={state}
                    type="button"
                    aria-pressed={selectedState === state}
                    className={selectedState === state ? "skill-state-button active" : "skill-state-button"}
                    onClick={() => updateSkill(skill.skillId, state)}
                  >
                    {SKILL_STATE_LABELS[state]}
                  </button>
                ))}
              </div>
              {selectedState ? <p className="skill-card-help">{SKILL_STATE_HELP[selectedState]}</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
