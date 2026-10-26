"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { WebAudioChordPlayer } from "../../application/harmony/chord-player";
import {
  CHORD_SYMBOLS,
  HARMONY_KEYS,
  HARMONY_PROGRESSION_TYPES,
  type ChordSymbol,
  type HarmonyKey,
  type HarmonyProgression,
  type HarmonyProgressionType,
  type SongProject,
  type UpdateHarmonyProgressionInput,
} from "../../domain/project/project";
import { createBrowserProjectRepository } from "../../infrastructure/persistence/browser-project-repository";
import { ArchiveMeta, MarginNote } from "../../components/archive/archive-markup";

const PROGRESSION_TYPE_LABELS: Record<HarmonyProgressionType, string> = {
  verse: "Verse",
  chorus: "Chorus",
  bridge: "Bridge",
  custom: "自定义",
};

interface HarmonyWorkspaceProps {
  project: SongProject;
  onProjectChange(project: SongProject): void;
  onError(message: string | null): void;
}

export function HarmonyWorkspace({ project, onProjectChange, onError }: HarmonyWorkspaceProps) {
  const [chordNotes, setChordNotes] = useState(project.harmony.chordNotes);
  const [progressionType, setProgressionType] = useState<HarmonyProgressionType>("verse");
  const [sectionId, setSectionId] = useState(project.lyrics.sections[0]?.sectionId ?? "");
  const [progressionName, setProgressionName] = useState("");
  const [lastPlayed, setLastPlayed] = useState<ChordSymbol | null>(null);
  const player = useRef<WebAudioChordPlayer | null>(null);
  const activeSectionId = project.lyrics.sections.some((section) => section.sectionId === sectionId)
    ? sectionId
    : project.lyrics.sections[0]?.sectionId ?? "";

  useEffect(() => {
    player.current = new WebAudioChordPlayer();
    return () => {
      player.current?.dispose();
      player.current = null;
    };
  }, []);

  function updateProject(action: () => SongProject, fallbackMessage: string): boolean {
    try {
      onProjectChange(action());
      onError(null);
      return true;
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : fallbackMessage);
      return false;
    }
  }

  function saveKey(value: string) {
    updateProject(
      () => createBrowserProjectRepository().setHarmonyKey(
        project.projectId,
        value === "" ? null : value as HarmonyKey,
      ),
       "无法保存 Key。",
    );
  }

  function saveChordNotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateProject(
      () => createBrowserProjectRepository().setHarmonyNotes(project.projectId, chordNotes),
       "无法保存和弦备注。",
    );
  }

  function playChord(chord: ChordSymbol) {
    void player.current?.play(chord).then(() => {
      setLastPlayed(chord);
      onError(null);
    }).catch((audioError: unknown) => {
      onError(audioError instanceof Error ? audioError.message : "无法播放这个和弦。");
    });
  }

  function createProgression(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const updated = updateProject(
      () => createBrowserProjectRepository().createHarmonyProgression(project.projectId, {
        type: progressionType,
        sectionId: activeSectionId || undefined,
        name: progressionName.trim() || undefined,
      }),
      "无法创建和弦进行。",
    );
    if (updated) setProgressionName("");
  }

  function updateProgression(progressionId: string, input: UpdateHarmonyProgressionInput) {
    updateProject(
      () => createBrowserProjectRepository().updateHarmonyProgression(
        project.projectId,
        progressionId,
        input,
      ),
      "无法更新和弦进行。",
    );
  }

  function deleteProgression(progressionId: string) {
    updateProject(
      () => createBrowserProjectRepository().deleteHarmonyProgression(project.projectId, progressionId),
      "无法删除和弦进行。",
    );
  }

  return (
    <div className="harmony-workspace">
      <header className="harmony-header">
        <div className="archive-page-kicker"><ArchiveMeta>HARMONY / CHORD SHEET</ArchiveMeta><ArchiveMeta>KEY / {project.harmony.key ?? "—"}</ArchiveMeta></div>
        <p className="eyebrow">当前阶段</p>
        <h2 id="current-stage-heading">Harmony Workspace / 和声工作区</h2>
        <p>探索声音，写下你的发现，并保留你做出的和声决定。</p>
      </header>

      <section className="harmony-key-panel" aria-labelledby="harmony-key-heading">
        <div>
          <p className="eyebrow">你的设置</p>
          <h3 id="harmony-key-heading">Key</h3>
          <p>在你想为这个 Project 记录调性之前，可以先留空。</p>
        </div>
        <label className="harmony-key-select">
           Key / 调性
          <select
             aria-label="Key / 调性"
            value={project.harmony.key ?? ""}
            onChange={(event) => saveKey(event.target.value)}
          >
             <option value="">未设置</option>
            {HARMONY_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
          </select>
        </label>
      </section>

      <section className="chord-playground" aria-labelledby="chord-playground-heading">
        <div>
           <p className="eyebrow">聆听并观察</p>
           <h3 id="chord-playground-heading">Chord Playground / 和弦试玩</h3>
           <p>点击一个基础和弦，听一小段声音。这里只是聆听，不会替你的歌曲做选择。</p>
        </div>
        <div className="chord-button-grid">
          {CHORD_SYMBOLS.map((chord) => (
            <button
              key={chord}
              type="button"
              className={lastPlayed === chord ? "chord-button played" : "chord-button"}
              aria-label={`Play ${chord}`}
              onClick={() => playChord(chord)}
            >
              {chord}
            </button>
          ))}
        </div>
        <p className="playground-status" aria-live="polite">
           {lastPlayed ? `最近播放：${lastPlayed}` : "还没有播放和弦。"}
        </p>
      </section>

      <form className="harmony-notes" onSubmit={saveChordNotes}>
        <label>
           和弦备注
          <textarea
            rows={5}
            value={chordNotes}
             placeholder="写下你的发现，或想尝试什么。"
            onChange={(event) => setChordNotes(event.target.value)}
          />
        </label>
        <button className="primary-button" type="submit" disabled={chordNotes.trim() === project.harmony.chordNotes}>
           保存备注
        </button>
      </form>

      <section className="progressions-panel" aria-labelledby="progressions-heading">
        <div className="progressions-heading">
          <div>
             <p className="eyebrow">你的素材</p>
             <h3 id="progressions-heading">和弦进行</h3>
             <p>先创建一个空的和弦进行，再添加你选择的和弦。</p>
          </div>
          <MarginNote>已保存 {project.harmony.progressions.length} 个进行<br />只记录你选择的序列。</MarginNote>
        </div>

        <form className="progression-create-form" onSubmit={createProgression}>
          <label>
             和弦进行类型
            <select
              value={progressionType}
              onChange={(event) => setProgressionType(event.target.value as HarmonyProgressionType)}
            >
              {HARMONY_PROGRESSION_TYPES.map((type) => (
                <option key={type} value={type}>{PROGRESSION_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </label>
          <label>
             歌曲 Section
            <select
              value={activeSectionId}
              disabled={project.lyrics.sections.length === 0}
              onChange={(event) => setSectionId(event.target.value)}
            >
              {project.lyrics.sections.length === 0 ? (
                 <option value="">还没有 Section</option>
              ) : project.lyrics.sections.map((section) => (
                <option key={section.sectionId} value={section.sectionId}>{section.name}</option>
              ))}
            </select>
          </label>
          <label>
             名称 <span className="optional">（可选）</span>
            <input
              value={progressionName}
              placeholder={`${PROGRESSION_TYPE_LABELS[progressionType]} progression`}
              onChange={(event) => setProgressionName(event.target.value)}
            />
          </label>
           <button className="primary-button" type="submit">添加和弦进行</button>
        </form>

        {project.harmony.progressions.length === 0 ? (
          <div className="progressions-empty">
             <p>还没有保存和弦进行。</p>
             <p>只有在你想记录一组序列时，才从一个 Section 开始。</p>
          </div>
        ) : (
          <div className="progression-list">
            {project.harmony.progressions.map((progression) => (
              <HarmonyProgressionCard
                key={progression.progressionId}
                progression={progression}
                onUpdate={updateProgression}
                onDelete={deleteProgression}
                onPlay={playChord}
              />
            ))}
          </div>
        )}
      </section>

      <details className="harmony-learning">
         <summary>快速理解</summary>
         <p>Major 和 minor 描述和弦内部不同的音程关系。使用试玩区聆听，再记录你自己的观察。</p>
      </details>
    </div>
  );
}

interface HarmonyProgressionCardProps {
  progression: HarmonyProgression;
  onUpdate(progressionId: string, input: UpdateHarmonyProgressionInput): void;
  onDelete(progressionId: string): void;
  onPlay(chord: ChordSymbol): void;
}

function HarmonyProgressionCard({ progression, onUpdate, onDelete, onPlay }: HarmonyProgressionCardProps) {
  const [name, setName] = useState(progression.name);
  const [notes, setNotes] = useState(progression.notes);
  const [chordToAdd, setChordToAdd] = useState<ChordSymbol>("C");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onUpdate(progression.progressionId, { name, notes });
  }

  function addChord() {
    onUpdate(progression.progressionId, { chords: [...progression.chords, chordToAdd] });
  }

  function removeChord(index: number) {
    onUpdate(progression.progressionId, {
      chords: progression.chords.filter((_, chordIndex) => chordIndex !== index),
    });
  }

  return (
    <article className="progression-card">
      <header>
        <div>
          <p className="progression-type">{PROGRESSION_TYPE_LABELS[progression.type]}</p>
          <h4>{progression.name}</h4>
        </div>
        <button type="button" className="danger-button" onClick={() => setConfirmDelete(true)}>
           删除
        </button>
      </header>

      {confirmDelete ? (
        <div className="progression-delete-confirmation" role="alert">
           <span>确定删除这个和弦进行吗？</span>
           <button type="button" onClick={() => onDelete(progression.progressionId)}>删除</button>
           <button type="button" onClick={() => setConfirmDelete(false)}>保留</button>
        </div>
      ) : null}

      <div className="progression-chords" aria-label={`${progression.name} chords`}>
        {progression.chords.length === 0 ? (
           <p>还没有添加和弦。</p>
        ) : progression.chords.map((chord, index) => (
          <span className="chord-chip" key={`${chord}-${index}`}>
            <button type="button" onClick={() => onPlay(chord)} aria-label={`Play ${chord}`}>{chord}</button>
            <button type="button" onClick={() => removeChord(index)} aria-label={`Remove ${chord}`}>×</button>
          </span>
        ))}
      </div>

      <div className="progression-add-chord">
        <label>
           添加和弦
          <select value={chordToAdd} onChange={(event) => setChordToAdd(event.target.value as ChordSymbol)}>
            {CHORD_SYMBOLS.map((chord) => <option key={chord} value={chord}>{chord}</option>)}
          </select>
        </label>
         <button type="button" onClick={addChord}>添加和弦</button>
      </div>

      <form className="progression-details" onSubmit={saveDetails}>
        <label>
           和弦进行名称
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
           备注
           <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="你注意到了什么？" />
        </label>
         <button type="submit" disabled={name.trim() === progression.name && notes === progression.notes}>保存和弦进行详情</button>
      </form>
    </article>
  );
}

export function HarmonyContext({ project }: { project: SongProject }) {
  const key = project.harmony.key ?? "未设置 Key";
  const count = project.harmony.progressions.length;
  return <p>{key} · 已保存 {count} 个和弦进行。离开或刷新页面后播放会停止。</p>;
}
