"use client";

import { AppLink } from "../navigation/app-link";
import { projectCreateRoute } from "../navigation/routes";
import { type FormEvent, useMemo, useState } from "react";
import {
  LINE_REFLECTION_LABELS,
  SONG_INTENT_CHECK_OPTIONS,
  type LineReflectionLabel,
  type LyricsSection,
  type SongIntentCheckOption,
  type SongProject,
} from "../../domain/project/project";
import { createBrowserProjectRepository } from "../../infrastructure/persistence/browser-project-repository";
import { countRepeatedTerms } from "./repetition";

interface ReflectionWorkspaceProps {
  project: SongProject;
  onProjectChange: (project: SongProject) => void;
  onError: (message: string | null) => void;
  showIntentCheck?: boolean;
}

type ReflectionTool = "lines" | "repetition" | "emotion" | "intent";

const TOOL_LABELS: Record<ReflectionTool, string> = {
  lines: "具体 / 抽象",
  repetition: "重复次数",
  emotion: "Emotion Map / 情绪地图",
  intent: "Song Intent 检查",
};

const LINE_LABELS: Record<LineReflectionLabel, string> = {
  specific: "具体",
  abstract: "抽象",
  unsure: "不确定",
};

const INTENT_LABELS: Record<SongIntentCheckOption, string> = {
  yes: "是",
  partly: "部分符合",
  no: "不是",
  "not-sure": "不确定",
};

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : "无法保存这次反思。";
}

function EmotionField({
  project,
  section,
  onProjectChange,
  onError,
}: ReflectionWorkspaceProps & { section: LyricsSection }) {
  const savedEmotion = project.reflection.emotionMap.find(
    (entry) => entry.sectionId === section.sectionId,
  )?.emotion ?? "";
  const [emotion, setEmotion] = useState(savedEmotion);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const updated = createBrowserProjectRepository().setSectionEmotion(
        project.projectId,
        section.sectionId,
        emotion,
      );
      onProjectChange(updated);
      onError(null);
    } catch (error) {
      onError(readableError(error));
    }
  }

  return (
    <form className="emotion-map-row" onSubmit={save}>
      <label>
        {section.name}
        <input
          value={emotion}
          maxLength={160}
          onChange={(event) => setEmotion(event.target.value)}
          placeholder="用你自己的话描述这个情绪"
        />
      </label>
      <button type="submit" disabled={emotion.trim() === savedEmotion}>保存</button>
    </form>
  );
}

export function ReflectionWorkspace({
  project,
  onProjectChange,
  onError,
  showIntentCheck = true,
}: ReflectionWorkspaceProps) {
  const [tool, setTool] = useState<ReflectionTool>("lines");
  const reflectionTools = (Object.keys(TOOL_LABELS) as ReflectionTool[]).filter(
    (item) => showIntentCheck || item !== "intent",
  );
  const lyricSections = project.lyrics.sections.filter((section) => section.userLyrics.trim());
  const repetitions = useMemo(
    () => countRepeatedTerms(project.lyrics.sections.map((section) => section.userLyrics).join("\n")),
    [project.lyrics.sections],
  );

  function setLineLabel(
    section: LyricsSection,
    lineIndex: number,
    lineText: string,
    label: LineReflectionLabel,
  ) {
    const saved = project.reflection.lineReflections.find(
      (entry) => entry.sectionId === section.sectionId &&
        entry.lineIndex === lineIndex &&
        entry.lineText === lineText,
    );
    try {
      const updated = createBrowserProjectRepository().setLineReflection(project.projectId, {
        sectionId: section.sectionId,
        lineIndex,
        lineText,
        label: saved?.label === label ? null : label,
      });
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

  return (
    <div className="reflection-workspace">
      <header className="reflection-header">
        <p className="eyebrow">当前阶段</p>
        <h2 id="current-stage-heading">Reflection / 反思</h2>
        <p>观察页面上已有的内容。这些工具只记录你的判断，不会改写你的歌曲。</p>
      </header>

      <div className="reflection-tools" role="tablist" aria-label="反思工具">
        {reflectionTools.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tool === item}
            className={tool === item ? "active" : ""}
            onClick={() => setTool(item)}
          >
            {TOOL_LABELS[item]}
          </button>
        ))}
      </div>

      {tool === "lines" ? (
        <section className="reflection-panel" aria-labelledby="line-reflection-heading">
          <h3 id="line-reflection-heading">你如何看待每一行？</h3>
          <p>由你自己选择标签。Workspace 不会分析或评价这一行。</p>
          {lyricSections.length === 0 ? (
            <p className="reflection-empty">请先添加并保存歌词，再回顾单行内容。</p>
          ) : lyricSections.map((section) => (
            <div className="line-reflection-section" key={section.sectionId}>
              <h4>{section.name}</h4>
              {section.userLyrics.split(/\r?\n/).map((line, lineIndex) => {
                if (!line.trim()) return null;
                const saved = project.reflection.lineReflections.find(
                  (entry) => entry.sectionId === section.sectionId &&
                    entry.lineIndex === lineIndex &&
                    entry.lineText === line,
                );
                return (
                  <div className="line-reflection-row" key={`${section.sectionId}-${lineIndex}`}>
                    <p><span>{lineIndex + 1}</span>{line}</p>
                    <div aria-label={`标记 ${section.name} 的第 ${lineIndex + 1} 行`}>
                      {LINE_REFLECTION_LABELS.map((label) => (
                        <button
                          key={label}
                          type="button"
                          aria-pressed={saved?.label === label}
                          className={saved?.label === label ? "active" : ""}
                          onClick={() => setLineLabel(section, lineIndex, line, label)}
                        >
                          {LINE_LABELS[label]}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      ) : null}

      {tool === "repetition" ? (
        <section className="reflection-panel" aria-labelledby="repetition-heading">
          <h3 id="repetition-heading">重复词语</h3>
          <p>这是对已保存歌词的机械计数，不表示重复是有帮助还是过多。</p>
          {repetitions.length === 0 ? (
            <p className="reflection-empty">已保存歌词中没有发现重复词语。</p>
          ) : (
            <ul className="repetition-list">
              {repetitions.map((item) => (
                <li key={item.term}><span>{item.term}</span><strong>{item.count}</strong></li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tool === "emotion" ? (
        <section className="reflection-panel" aria-labelledby="emotion-heading">
          <h3 id="emotion-heading">Emotion Map / 情绪地图</h3>
          <p>描述你在每个 Section 中注意到的内容，再由你自己观察变化或对比。</p>
          {project.lyrics.sections.length === 0 ? (
            <p className="reflection-empty">请先添加歌曲 Section，再记录情绪地图。</p>
          ) : (
            <div className="emotion-map-list">
              {project.lyrics.sections.map((section) => (
                <EmotionField
                  key={section.sectionId}
                  project={project}
                  section={section}
                  onProjectChange={onProjectChange}
                  onError={onError}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {showIntentCheck && tool === "intent" ? (
        <section className="reflection-panel" aria-labelledby="intent-check-heading">
          <h3 id="intent-check-heading">Song Intent 检查</h3>
          {project.songIntent.coreIdea ? (
            <blockquote>这首歌是在讲：{project.songIntent.coreIdea}</blockquote>
          ) : (
            <p className="reflection-empty">
              还没有保存核心想法。想写下一个的话，可以<AppLink href={projectCreateRoute(project.projectId, "define")}>打开 Define</AppLink>。
            </p>
          )}
          <p>这首歌现在仍然围绕这个想法吗？</p>
          <div className="intent-check-options" aria-label="Song Intent 一致性">
            {SONG_INTENT_CHECK_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={project.reflection.songIntentCheck === value}
                className={project.reflection.songIntentCheck === value ? "active" : ""}
                onClick={() => setIntentCheck(value)}
              >
                {INTENT_LABELS[value]}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
