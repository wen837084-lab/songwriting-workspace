"use client";

import { AppLink } from "../navigation/app-link";
import { projectCreateRoute } from "../navigation/routes";
import { type FormEvent, useState } from "react";
import {
  ARRANGEMENT_TRACK_PRESETS,
  type ArrangementCell,
  type ArrangementTrack,
  type ArrangementTrackCategory,
  type LyricsSection,
  type SongProject,
} from "../../domain/project/project";
import { createBrowserProjectRepository } from "../../infrastructure/persistence/browser-project-repository";
import { ArchiveMeta, MarginNote } from "../../components/archive/archive-markup";

interface ArrangementWorkspaceProps {
  project: SongProject;
  onProjectChange(project: SongProject): void;
  onError(message: string | null): void;
}

type CellDraft = Pick<ArrangementCell, "presence" | "energy" | "density" | "dynamics" | "register" | "notes">;

const EMPTY_CELL: CellDraft = {
  presence: "",
  energy: "",
  density: "",
  dynamics: "",
  register: "",
  notes: "",
};

function readableError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function trackCategoryLabel(category: ArrangementTrackCategory): string {
  return ARRANGEMENT_TRACK_PRESETS.find((preset) => preset.category === category)?.label ?? "其他";
}

function cellDraftFrom(cell: ArrangementCell | undefined): CellDraft {
  return cell ? {
    presence: cell.presence,
    energy: cell.energy,
    density: cell.density,
    dynamics: cell.dynamics,
    register: cell.register,
    notes: cell.notes,
  } : EMPTY_CELL;
}

function AddTrackForm({
  project,
  onProjectChange,
  onError,
  onClose,
}: ArrangementWorkspaceProps & { onClose: () => void }) {
  const [category, setCategory] = useState<ArrangementTrackCategory>("other");
  const [name, setName] = useState<string>("");

  function addTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const repository = createBrowserProjectRepository();
      repository.addArrangementTrack(project.projectId, { category, name });
      const updated = repository.get(project.projectId);
      if (!updated) throw new Error("The project could not be reloaded after adding this track.");
      onProjectChange(updated);
      onError(null);
      onClose();
    } catch (error) {
      onError(readableError(error, "Could not add this track."));
    }
  }

  return (
    <form className="arrangement-track-form" onSubmit={addTrack}>
      <label>
        预设类别
        <select
          value={category}
          onChange={(event) => {
            const nextCategory = event.target.value as ArrangementTrackCategory;
            const preset = ARRANGEMENT_TRACK_PRESETS.find((item) => item.category === nextCategory);
            setCategory(nextCategory);
            setName(preset?.label ?? "其他");
          }}
        >
          {ARRANGEMENT_TRACK_PRESETS.map((preset) => (
            <option key={preset.category} value={preset.category}>{preset.label}</option>
          ))}
        </select>
      </label>
      <label>
        Track 名称
        <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <div className="arrangement-form-actions">
        <button className="primary-button" type="submit">添加 Track</button>
        <button type="button" onClick={onClose}>取消</button>
      </div>
    </form>
  );
}

function TrackManagement({
  project,
  track,
  onProjectChange,
  onError,
}: ArrangementWorkspaceProps & { track: ArrangementTrack }) {
  const [name, setName] = useState(track.name);
  const [isDeletePending, setIsDeletePending] = useState(false);
  const isDirty = name !== track.name;

  function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const repository = createBrowserProjectRepository();
      repository.updateArrangementTrack(project.projectId, track.trackId, { name });
      const updated = repository.get(project.projectId);
      if (!updated) throw new Error("The project could not be reloaded after renaming this track.");
      onProjectChange(updated);
      onError(null);
    } catch (error) {
      onError(readableError(error, "Could not rename this track."));
    }
  }

  function deleteTrack() {
    try {
      const repository = createBrowserProjectRepository();
      repository.deleteArrangementTrack(project.projectId, track.trackId);
      const updated = repository.get(project.projectId);
      if (!updated) throw new Error("The project could not be reloaded after deleting this track.");
      onProjectChange(updated);
      onError(null);
      setIsDeletePending(false);
    } catch (error) {
      onError(readableError(error, "Could not delete this track."));
    }
  }

  return (
    <div className="arrangement-track-management">
      <span className="arrangement-track-category">{trackCategoryLabel(track.category)}</span>
      <form onSubmit={saveName}>
        <label className="sr-only" htmlFor={`arrangement-track-${track.trackId}`}>Track 名称</label>
        <input
          id={`arrangement-track-${track.trackId}`}
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" disabled={!isDirty}>保存名称</button>
      </form>
      {isDeletePending ? (
        <span className="arrangement-delete-confirmation" role="alert">
          <span>确定删除这个 Track 及其单元格备注吗？</span>
          <button className="danger-button" type="button" onClick={deleteTrack}>确认删除</button>
          <button type="button" onClick={() => setIsDeletePending(false)}>取消</button>
        </span>
      ) : (
        <button className="danger-button" type="button" onClick={() => setIsDeletePending(true)}>删除</button>
      )}
    </div>
  );
}

function ArrangementCellEditor({
  project,
  section,
  track,
  cell,
  onProjectChange,
  onError,
}: ArrangementWorkspaceProps & {
  section: LyricsSection;
  track: ArrangementTrack;
  cell?: ArrangementCell;
}) {
  const [draft, setDraft] = useState<CellDraft>(() => cellDraftFrom(cell));
  const savedDraft = cellDraftFrom(cell);
  const isDirty = (Object.keys(EMPTY_CELL) as (keyof CellDraft)[]).some(
    (field) => draft[field] !== savedDraft[field],
  );

  function updateDraft(field: keyof CellDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function saveCell(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const repository = createBrowserProjectRepository();
      repository.updateArrangementCell(project.projectId, section.sectionId, track.trackId, draft);
      const updated = repository.get(project.projectId);
      if (!updated) throw new Error("The project could not be reloaded after saving this cell.");
      onProjectChange(updated);
      onError(null);
    } catch (error) {
      onError(readableError(error, "Could not save this arrangement cell."));
    }
  }

  return (
    <form className="arrangement-cell-form" onSubmit={saveCell}>
      <fieldset>
        <legend className="sr-only">{track.name} in {section.name}</legend>
        <label>
          是否出现
          <input value={draft.presence} onChange={(event) => updateDraft("presence", event.target.value)} placeholder="Your note" />
        </label>
        <label>
          能量
          <input value={draft.energy} onChange={(event) => updateDraft("energy", event.target.value)} placeholder="Your note" />
        </label>
        <label>
          密度
          <input value={draft.density} onChange={(event) => updateDraft("density", event.target.value)} placeholder="Your note" />
        </label>
        <label>
          动态
          <input value={draft.dynamics} onChange={(event) => updateDraft("dynamics", event.target.value)} placeholder="Your note" />
        </label>
        <label>
          音区
          <input value={draft.register} onChange={(event) => updateDraft("register", event.target.value)} placeholder="Your note" />
        </label>
        <label className="arrangement-cell-notes">
          编曲备注
          <textarea rows={3} value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} placeholder="你做了什么决定？" />
        </label>
      </fieldset>
      <button type="submit" disabled={!isDirty}>{cell ? "保存单元格" : "保存备注"}</button>
    </form>
  );
}

export function ArrangementWorkspace({ project, onProjectChange, onError }: ArrangementWorkspaceProps) {
  const [showAddTrack, setShowAddTrack] = useState(project.arrangement.tracks.length === 0);

  return (
    <div className="arrangement-workspace">
      <header className="arrangement-header">
        <div>
          <div className="archive-page-kicker"><ArchiveMeta>ARR / SESSION SHEET</ArchiveMeta><ArchiveMeta>{project.arrangement.tracks.length} TRACKS · {project.lyrics.sections.length} SECTIONS</ArchiveMeta></div>
          <p className="eyebrow">当前阶段</p>
          <h2 id="current-stage-heading">Arrangement Board / 编曲板</h2>
          <p>用这个矩阵记录你在歌曲各个 Section 中做出的编曲选择。</p>
        </div>
        <button type="button" onClick={() => setShowAddTrack((visible) => !visible)}>
          {showAddTrack ? "关闭添加表单" : "添加 Track"}
        </button>
      </header>

      <div className="arrangement-boundary-note">
        <strong>你的决定始终属于你。</strong>
        <MarginNote>这个板块保存关于是否出现、能量、密度、动态、音区和编曲观察的备注。它不会替你选择乐器，也不会告诉你何时加入或退出。</MarginNote>
      </div>

      <details className="arrangement-thinking-dimensions">
        <summary>思考维度</summary>
        <p>在不同 Section 之间移动时，你可以问自己：更大还是更小、更密还是更开放、更有能量还是更克制，或者暂时还不确定？</p>
      </details>

      {showAddTrack ? (
        <AddTrackForm
          project={project}
          onProjectChange={onProjectChange}
          onError={onError}
          onClose={() => setShowAddTrack(false)}
        />
      ) : null}

      {project.lyrics.sections.length === 0 ? (
        <section className="arrangement-empty">
          <h3>请先添加歌曲 Section</h3>
          <p>这个矩阵会复用 Song Map 中的 Section。请先在那里添加或复制 Section，再记录编曲备注。</p>
          <AppLink className="quiet-link" href={projectCreateRoute(project.projectId, "song-structure")}>打开 Song Map</AppLink>
        </section>
      ) : project.arrangement.tracks.length === 0 ? (
        <section className="arrangement-empty">
          <h3>还没有 Track</h3>
          <p>使用预设类别添加 Track，或创建一个自定义名称的 Track。系统不会自动添加。</p>
        </section>
      ) : (
        <div className="arrangement-matrix-scroll" role="region" aria-label="Arrangement 矩阵" tabIndex={0}>
          <table className="arrangement-matrix">
            <thead>
              <tr>
                <th scope="col" className="arrangement-track-column">Tracks / 乐器</th>
                {project.lyrics.sections.map((section) => (
                  <th scope="col" key={section.sectionId}>
                    <span>{section.name}</span>
                    {section.bars !== null ? <small>{section.bars} 小节</small> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {project.arrangement.tracks.map((track) => (
                <tr key={track.trackId}>
                  <th scope="row" className="arrangement-track-column">
                    <TrackManagement
                      project={project}
                      track={track}
                      onProjectChange={onProjectChange}
                      onError={onError}
                    />
                  </th>
                  {project.lyrics.sections.map((section) => {
                    const cell = project.arrangement.cells.find(
                      (item) => item.sectionId === section.sectionId && item.trackId === track.trackId,
                    );
                    return (
                      <td key={`${track.trackId}-${section.sectionId}-${cell?.updatedAt ?? "empty"}`}>
                        <ArrangementCellEditor
                          project={project}
                          section={section}
                          track={track}
                          cell={cell}
                          onProjectChange={onProjectChange}
                          onError={onError}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ArrangementContext({ project }: { project: SongProject }) {
  const populatedCells = project.arrangement.cells.length;
  return <p>共有 {project.arrangement.tracks.length} 个 Track · {populatedCells} 个编曲单元格已记录备注。</p>;
}
