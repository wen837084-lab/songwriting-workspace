"use client";

import { AppLink } from "../navigation/app-link";
import { projectCreateRoute, projectToolsRoute } from "../navigation/routes";
import { type FormEvent, useState } from "react";
import {
  REVIEW_CATEGORIES,
  REVIEW_STATUSES,
  SONG_INTENT_CHECK_OPTIONS,
  type ReviewCategory,
  type ReviewStatus,
  type SongIntentCheckOption,
  type SongProject,
} from "../../domain/project/project";
import { createBrowserProjectRepository } from "../../infrastructure/persistence/browser-project-repository";
import { ArchiveMeta, MarginNote, StaffFragment } from "../../components/archive/archive-markup";

interface ReviewWorkspaceProps {
  project: SongProject;
  onProjectChange: (project: SongProject) => void;
  onError: (message: string | null) => void;
}

interface ReviewCategoryDefinition {
  category: ReviewCategory;
  label: string;
  prompt: string;
}

const REVIEW_CATEGORY_DEFINITIONS: readonly ReviewCategoryDefinition[] = [
  { category: "song-intent", label: "Song Intent", prompt: "这仍然符合你的 Song Intent 吗？" },
  { category: "lyrics", label: "Lyrics / 歌词", prompt: "歌词中哪些地方现在比较明确？哪些地方想再看看？" },
  { category: "melody", label: "Melody / 旋律", prompt: "你注意到了已录制或记录的旋律素材中的什么？" },
  { category: "rhythm", label: "Rhythm / 节奏", prompt: "节奏发生了什么变化？接下来想测试什么？" },
  { category: "harmony", label: "Harmony / 和声", prompt: "到目前为止，你想记住哪些和声选择？" },
  { category: "song-structure", label: "Song Structure / 歌曲结构", prompt: "段落或段落顺序中，哪些地方想再看看？" },
  { category: "arrangement", label: "Arrangement / 编曲", prompt: "从编曲备注中，你注意到了空间、密度或对比的什么？" },
  { category: "garageband-experiments", label: "GarageBand 实验", prompt: "你想从记录的实验中延续什么？" },
  { category: "open-questions", label: "Open Questions", prompt: "还有哪些问题没有解决？" },
  { category: "version-history", label: "Version 历史", prompt: "与上一个 Version 相比，发生了什么变化？" },
];

const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  "not-reviewed": "未回顾",
  "in-review": "回顾中",
  reviewed: "已回顾",
};

const INTENT_CHECK_LABELS: Record<SongIntentCheckOption, string> = {
  yes: "是",
  partly: "部分符合",
  no: "不是",
  "not-sure": "不确定",
};

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : "无法保存这次回顾。";
}

function formatVersionDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function sectionNames(project: SongProject): string {
  return project.lyrics.sections.map((section) => section.name).join(" · ") || "尚未保存 Section";
}

function textOrPlaceholder(value: string, placeholder = "尚未填写"): string {
  return value.trim() || placeholder;
}

function ReviewContextCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="review-context-card">
      <p className="review-context-label">{label}</p>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function CategoryReflectionField({
  project,
  definition,
  ordinal,
  onProjectChange,
  onError,
}: ReviewWorkspaceProps & { definition: ReviewCategoryDefinition; ordinal: number }) {
  const initial = project.review.categoryReflections.find(
    (reflection) => reflection.category === definition.category,
  )?.content ?? "";
  const [value, setValue] = useState(initial);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const existing = project.review.categoryReflections
        .filter((reflection) => reflection.category !== definition.category)
        .map((reflection) => ({ category: reflection.category, content: reflection.content }));
      const updated = createBrowserProjectRepository().updateReview(project.projectId, {
        categoryReflections: [
          ...existing,
          { category: definition.category, content: value },
        ],
      });
      onProjectChange(updated);
      setValue(updated.review.categoryReflections.find(
        (reflection) => reflection.category === definition.category,
      )?.content ?? "");
      onError(null);
    } catch (error) {
      onError(readableError(error));
    }
  }

  return (
    <form className="review-category-field" onSubmit={save}>
      <div>
        <ArchiveMeta>NOTE {String(ordinal).padStart(2, "0")}</ArchiveMeta>
        <h3>{definition.label}</h3>
        <p>{definition.prompt}</p>
      </div>
      <textarea
        rows={3}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="写下你自己的观察"
      />
      <button type="submit">保存备注</button>
    </form>
  );
}

export function ReviewWorkspace({ project, onProjectChange, onError }: ReviewWorkspaceProps) {
  const [userReflection, setUserReflection] = useState(project.review.userReflection);
  const [workOnNext, setWorkOnNext] = useState(project.review.nextFocus.workOnNext);
  const [testNext, setTestNext] = useState(project.review.nextFocus.testNext);
  const [leaveAloneForNow, setLeaveAloneForNow] = useState(project.review.nextFocus.leaveAloneForNow);
  const [questionDrafts, setQuestionDrafts] = useState(project.openQuestions);
  const [newQuestion, setNewQuestion] = useState("");

  function updateStatus(status: ReviewStatus) {
    try {
      const updated = createBrowserProjectRepository().updateReview(project.projectId, { status });
      onProjectChange(updated);
      onError(null);
    } catch (error) {
      onError(readableError(error));
    }
  }

  function saveUserReflection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const updated = createBrowserProjectRepository().updateReview(project.projectId, { userReflection });
      onProjectChange(updated);
      onError(null);
    } catch (error) {
      onError(readableError(error));
    }
  }

  function setIntentCheck(value: SongIntentCheckOption) {
    try {
      const updated = createBrowserProjectRepository().setSongIntentCheck(
        project.projectId,
        project.reflection.songIntentCheck === value ? null : value,
      );
      onProjectChange(updated);
      onError(null);
    } catch (error) {
      onError(readableError(error));
    }
  }

  function saveNextFocus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const updated = createBrowserProjectRepository().updateReview(project.projectId, {
        nextFocus: { workOnNext, testNext, leaveAloneForNow },
      });
      onProjectChange(updated);
      onError(null);
    } catch (error) {
      onError(readableError(error));
    }
  }

  function saveOpenQuestions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const questions = newQuestion.trim()
        ? [...questionDrafts, newQuestion]
        : questionDrafts;
      const updated = createBrowserProjectRepository().updateOpenQuestions(project.projectId, questions);
      onProjectChange(updated);
      setQuestionDrafts(updated.openQuestions);
      setNewQuestion("");
      onError(null);
    } catch (error) {
      onError(readableError(error));
    }
  }

  function closeQuestion(index: number) {
    try {
      const updated = createBrowserProjectRepository().updateOpenQuestions(
        project.projectId,
        questionDrafts.filter((_, questionIndex) => questionIndex !== index),
      );
      onProjectChange(updated);
      setQuestionDrafts(updated.openQuestions);
      onError(null);
    } catch (error) {
      onError(readableError(error));
    }
  }

  const recentVersions = project.versions.slice(-3).reverse();
  const savedMelodyNotes = Object.values(project.melody.notesBySection).filter((notes) => notes.trim()).length;

  return (
    <section className="review-workspace" aria-labelledby="song-review-heading">
      <header className="review-header">
        <div className="archive-page-kicker"><ArchiveMeta>REFLECTION SHEET / {project.review.status.toUpperCase()}</ArchiveMeta><ArchiveMeta>OPEN QUESTIONS / {String(project.openQuestions.length).padStart(2, "0")}</ArchiveMeta></div>
        <p className="eyebrow">当前阶段</p>
        <h2 id="song-review-heading">Song Review / 歌曲回顾</h2>
        <p>退一步，记录你的发现，并选择想再看的地方。Review 不会评价歌曲，也不会替你做决定。</p>
        <div className="review-status-control" aria-label="回顾状态">
          <span>状态</span>
          {REVIEW_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={project.review.status === status}
              className={project.review.status === status ? "active" : ""}
              onClick={() => updateStatus(status)}
            >
              {REVIEW_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </header>

      <section className="review-overview" aria-labelledby="review-overview-heading">
        <StaffFragment className="review-staff-fragment" />
        <div>
          <p className="eyebrow">事实上下文</p>
          <h3 id="review-overview-heading">当前创作状态</h3>
          <p className="review-section-intro">这里是当前 Project 的记录，供你查看。它们不是对歌曲的结论。</p>
        </div>
        <div className="review-overview-grid">
          <ReviewContextCard label="Song Intent" value={project.songIntent.coreIdea ? "已填写" : "未填写"} detail={textOrPlaceholder(project.songIntent.coreIdea)} />
          <ReviewContextCard label="Lyrics / 歌词" value={`${project.lyrics.sections.length} 个 Section`} detail={sectionNames(project)} />
          <ReviewContextCard label="Melody / 旋律" value={`${project.melody.takes.length} 个 Take`} detail={`已保存 ${savedMelodyNotes} 条 Section 备注`} />
          <ReviewContextCard label="Rhythm / 节奏" value={`${project.rhythm.bpm} BPM · ${project.rhythm.timeSignature}`} detail={textOrPlaceholder(project.rhythm.notes, "尚未保存节奏备注")} />
          <ReviewContextCard label="Harmony / 和声" value={project.harmony.key ?? "未设置 Key"} detail={`已保存 ${project.harmony.progressions.length} 个和弦进行`} />
          <ReviewContextCard label="Song Structure / 歌曲结构" value={`${project.lyrics.sections.length} 个 Section`} detail={sectionNames(project)} />
          <ReviewContextCard label="Arrangement / 编曲" value={`${project.arrangement.tracks.length} 个 Track`} detail={`已保存 ${project.arrangement.cells.length} 条 Section/Track 备注`} />
          <ReviewContextCard label="GarageBand 实验" value={`${project.garageBandExperiments.length} 条记录`} detail="用户记录的目标、观察、决定和下一个问题" />
          <ReviewContextCard label="Open Questions" value={`${project.openQuestions.length} 个未解决`} detail="当前保存在这个 Project 中的问题" />
          <ReviewContextCard label="Version 历史" value={`${project.versions.length} 个已保存`} detail={recentVersions[0]?.label ?? "尚未保存 Version"} />
        </div>
      </section>

      <section className="review-intent" aria-labelledby="review-intent-heading">
        <div>
          <p className="eyebrow">Song Intent 检查</p>
          <h3 id="review-intent-heading">回看你原本想保留什么</h3>
        </div>
        {project.songIntent.coreIdea ? (
          <blockquote>这首歌是在讲：{project.songIntent.coreIdea}</blockquote>
        ) : (
          <p className="review-empty">还没有保存核心想法。想写下一个的话，可以<AppLink href={projectCreateRoute(project.projectId, "define")}>打开 Define</AppLink>。</p>
        )}
        <p>这仍然符合你的 Song Intent 吗？</p>
        <div className="intent-check-options" aria-label="Song Intent 一致性">
          {SONG_INTENT_CHECK_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={project.reflection.songIntentCheck === value}
              className={project.reflection.songIntentCheck === value ? "active" : ""}
              onClick={() => setIntentCheck(value)}
            >
              {INTENT_CHECK_LABELS[value]}
            </button>
          ))}
        </div>
      </section>

      <form className="review-user-reflection" onSubmit={saveUserReflection}>
        <div>
          <p className="eyebrow">你的反思</p>
          <h3>哪些地方现在比较明确？还有哪些地方没有解决？</h3>
          <p>用你自己的话记录。Workspace 只保存你选择记录的内容。</p>
        </div>
        <textarea
          rows={6}
          maxLength={4000}
          value={userReflection}
          onChange={(event) => setUserReflection(event.target.value)}
          placeholder="写下你对当前创作状态的观察。"
        />
        <button className="primary-button" type="submit">保存反思</button>
      </form>

      <section className="review-category-section" aria-labelledby="review-category-heading">
        <div>
          <p className="eyebrow">按维度回顾</p>
          <h3 id="review-category-heading">你想再看看什么？</h3>
          <p className="review-section-intro">只回答现在有用的问题。空白备注不会保存。</p>
        </div>
        <div className="review-category-list">
          {REVIEW_CATEGORY_DEFINITIONS.map((definition, index) => (
            <CategoryReflectionField
              key={definition.category}
              project={project}
              definition={definition}
              ordinal={index + 1}
              onProjectChange={onProjectChange}
              onError={onError}
            />
          ))}
        </div>
      </section>

      <section className="review-open-questions" aria-labelledby="review-open-questions-heading">
        <MarginNote>UNRESOLVED / {String(questionDrafts.length).padStart(2, "0")}</MarginNote>
        <div>
          <p className="eyebrow">已有 Project 数据</p>
          <h3 id="review-open-questions-heading">Open Questions</h3>
          <p>这里是 Project 和 Version System 共同保存的 Open Questions。你可以编辑、添加，或从当前列表中关闭/移除问题。</p>
        </div>
        <form className="review-open-questions-form" onSubmit={saveOpenQuestions}>
          {questionDrafts.map((question, index) => (
            <div className="review-question-row" key={`${index}:${question}`}>
              <label>
                <span className="sr-only">Open Question {index + 1}</span>
                <input
                  value={question}
                  onChange={(event) => setQuestionDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                />
              </label>
              <button type="button" onClick={() => closeQuestion(index)}>关闭 / 移除</button>
            </div>
          ))}
          <label>
            添加一个 Open Question
            <input value={newQuestion} onChange={(event) => setNewQuestion(event.target.value)} placeholder="接下来想测试什么？" />
          </label>
          <button className="primary-button" type="submit">保存 Open Questions</button>
        </form>
      </section>

      <form className="review-next-focus" onSubmit={saveNextFocus}>
        <div>
          <p className="eyebrow">下一步关注点</p>
          <h3>你想把什么带到下一步？</h3>
          <p>由你选择关注点。这个区域只记录它，不设置优先级。</p>
        </div>
        <div className="review-next-focus-grid">
          <label>接下来我想处理什么？<textarea rows={4} value={workOnNext} onChange={(event) => setWorkOnNext(event.target.value)} /></label>
          <label>我想测试什么？<textarea rows={4} value={testNext} onChange={(event) => setTestNext(event.target.value)} /></label>
          <label>哪些地方我暂时不想动？<textarea rows={4} value={leaveAloneForNow} onChange={(event) => setLeaveAloneForNow(event.target.value)} /></label>
        </div>
        <button className="primary-button" type="submit">保存下一步关注点</button>
      </form>

      <section className="review-context-section" aria-labelledby="review-experiments-heading">
        <div>
          <p className="eyebrow">实验上下文</p>
          <h3 id="review-experiments-heading">GarageBand 实验</h3>
          <p className="review-section-intro">Review 会显示你做的记录，但不会替你总结它们的意义。</p>
        </div>
        {project.garageBandExperiments.length === 0 ? (
          <p className="review-empty">这个 Project 还没有记录 GarageBand 实验。</p>
        ) : (
          <div className="review-experiment-list">
            {project.garageBandExperiments.slice().reverse().map((experiment) => {
              const section = experiment.sectionId
                ? project.lyrics.sections.find((item) => item.sectionId === experiment.sectionId)?.name ?? "Section 不可用"
                : "不指定 Section";
              return (
                <article className="review-experiment-card" key={experiment.experimentId}>
                  <header><div><span>{experiment.type}</span><h4>{experiment.date}</h4></div><p>{section}</p></header>
                  <dl>
                    <div><dt>目标</dt><dd>{experiment.goal}</dd></div>
                    <div><dt>我尝试了什么</dt><dd>{experiment.whatITried}</dd></div>
                    <div><dt>我注意到了什么</dt><dd>{experiment.whatINoticed}</dd></div>
                    <div><dt>我的决定</dt><dd>{experiment.decision}</dd></div>
                    <div><dt>下一个问题</dt><dd>{experiment.nextQuestion}</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="review-context-section" aria-labelledby="review-versions-heading">
        <div>
          <p className="eyebrow">Version 上下文</p>
          <h3 id="review-versions-heading">最近的 Versions</h3>
          <p className="review-section-intro">Versions 按保存顺序显示。打开 Project 工具，可以查看快照或对比事实差异。</p>
        </div>
        {recentVersions.length === 0 ? (
          <p className="review-empty">还没有保存 Version。</p>
        ) : (
          <div className="review-version-list">
            {recentVersions.map((version) => (
              <article className="review-version-card" key={version.versionId}>
                <div><h4>{version.label}</h4><time dateTime={version.createdAt}>{formatVersionDate(version.createdAt)} UTC</time></div>
                <p>{version.userNote || "没有 Version 备注"}</p>
              </article>
            ))}
          </div>
        )}
        <AppLink className="quiet-link" href={projectToolsRoute(project.projectId, "versions")}>打开 Version 历史</AppLink>
      </section>
    </section>
  );
}

export { REVIEW_CATEGORY_DEFINITIONS, REVIEW_CATEGORIES };
