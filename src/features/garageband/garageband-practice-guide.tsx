"use client";

import { useState } from "react";
import type { ProjectStage, SongProject } from "../../domain/project/project";
import {
  getGarageBandPracticeGuide,
  getGarageBandPracticeStage,
} from "./garageband-practice";

function GuideSection({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <section className="garageband-guide-section" aria-labelledby={`garageband-${title.toLowerCase().replaceAll(" ", "-")}`}>
      <h3 id={`garageband-${title.toLowerCase().replaceAll(" ", "-")}`}>{title}</h3>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

export function GarageBandPracticeGuide({
  project,
  stage,
  onOpenExperimentLog,
  defaultOpen = false,
}: {
  project: SongProject;
  stage: ProjectStage;
  onOpenExperimentLog?: (sectionId: string | null) => void;
  defaultOpen?: boolean;
}) {
  const practiceStage = getGarageBandPracticeStage(stage);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [sectionId, setSectionId] = useState(project.lyrics.sections[0]?.sectionId ?? "");
  const [experimentQuestion, setExperimentQuestion] = useState("");

  if (!practiceStage) return null;

  const guide = getGarageBandPracticeGuide(practiceStage);
  const selectedSection = project.lyrics.sections.find((section) => section.sectionId === sectionId)
    ?? project.lyrics.sections[0]
    ?? null;

  return (
    <section className="garageband-practice" aria-labelledby="garageband-practice-heading">
      {!isOpen ? (
        <div className="garageband-practice-entry">
          <div>
            <p className="eyebrow">外部练习</p>
            <h2 id="garageband-practice-heading">GarageBand 练习指南</h2>
            <p>先在这里定义一个问题，然后由你自己打开并操作 GarageBand。</p>
          </div>
          <button type="button" onClick={() => setIsOpen(true)}>打开指南</button>
        </div>
      ) : (
        <div className="garageband-practice-panel">
          <header className="garageband-practice-header">
            <div>
              <p className="eyebrow">{guide.label}</p>
              <h2 id="garageband-practice-heading">{guide.title}</h2>
              <p>{guide.intro}</p>
            </div>
            <button
              className="learning-close-button"
              type="button"
              onClick={() => setIsOpen(false)}
            >
              Close guide
            </button>
          </header>

          <div className="garageband-practice-flow" aria-label="练习流程">
            <span>Workspace</span>
            <span aria-hidden="true">→</span>
            <span>定义问题</span>
            <span aria-hidden="true">→</span>
            <span>自己打开 GarageBand</span>
            <span aria-hidden="true">→</span>
            <span>聆听</span>
            <span aria-hidden="true">→</span>
            <span>回到 Workspace</span>
          </div>

          <p className="garageband-boundary-note">
            GarageBand 位于 Workspace 之外。由你自己打开、设置测试、进行实验并聆听。
          </p>

          <section className="garageband-context" aria-labelledby="garageband-context-heading">
            <div className="garageband-context-heading">
              <div>
                <p className="eyebrow">当前上下文</p>
                <h3 id="garageband-context-heading">让问题始终和这个 Project 关联</h3>
              </div>
              <span className="garageband-stage-badge">{guide.stage}</span>
            </div>
            <dl className="garageband-context-grid">
              <div><dt>当前歌曲</dt><dd>{project.title}</dd></div>
              <div><dt>当前 BPM</dt><dd>{project.rhythm.bpm}</dd></div>
              <div><dt>拍号</dt><dd>{project.rhythm.timeSignature}</dd></div>
              <div><dt>当前 Key</dt><dd>{project.harmony.key ?? "未设置"}</dd></div>
              <div><dt>已保存 Section</dt><dd>{project.lyrics.sections.length}</dd></div>
              <div><dt>Arrangement 轨道</dt><dd>{project.arrangement.tracks.length}</dd></div>
            </dl>

            <label className="garageband-context-field">
              当前 Section
              <select
                value={selectedSection?.sectionId ?? ""}
                onChange={(event) => setSectionId(event.target.value)}
                disabled={project.lyrics.sections.length === 0}
              >
                {project.lyrics.sections.length === 0 ? <option value="">尚未保存 Section</option> : null}
                {project.lyrics.sections.map((section) => (
                  <option key={section.sectionId} value={section.sectionId}>{section.name}</option>
                ))}
              </select>
            </label>

            <div className="garageband-lyrics-context">
              <p className="context-label">当前 Lyrics</p>
              <p>{selectedSection?.userLyrics.trim() || "这个 Section 还没有保存 Lyrics。"}</p>
            </div>

            <label className="garageband-context-field">
              当前实验问题
              <textarea
                rows={3}
                value={experimentQuestion}
                onChange={(event) => setExperimentQuestion(event.target.value)}
                placeholder={guide.questionPrompt}
              />
            </label>
            <p className="garageband-temporary-note">这个问题只暂存在打开的指南中。这里不会保存实验结果。</p>
          </section>

          <div className="garageband-guide-sections">
            <GuideSection title="打开 GarageBand 前" items={guide.beforeOpen} />
            <GuideSection title="在 GarageBand 中" items={guide.inGarageBand} />
            <GuideSection title="尝试" items={guide.trySteps} />
            <GuideSection title="注意听" items={guide.listenFor} />
            <GuideSection title="回到 Workspace" items={guide.returnToWorkspace} />
          </div>

          <div className="garageband-return-action">
            <p>回来后，用你自己的话写下实验记录。上面的临时问题不会自动保存。</p>
            <div className="garageband-return-actions">
              <button type="button" onClick={() => setIsOpen(false)}>
                回到 Workspace
              </button>
              {onOpenExperimentLog ? (
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenExperimentLog(selectedSection?.sectionId ?? null);
                  }}
                >
                  返回并记录实验
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
