"use client";

import { type FormEvent, useState } from "react";
import { getSongMapSectionStatuses } from "../../application/song-map/section-status";
import {
  LYRICS_SECTION_GUIDANCE,
  LYRICS_SECTION_TYPES,
  type LyricsSection,
  type LyricsSectionType,
  type SongProject,
  type UpdateLyricsSectionInput,
} from "../../domain/project/project";
import {
  createBrowserMelodyService,
  createBrowserProjectRepository,
} from "../../infrastructure/persistence/browser-project-repository";
import { ArchiveIndex, ArchiveMeta, BeatTicks } from "../../components/archive/archive-markup";

interface SongMapWorkspaceProps {
  project: SongProject;
  onProjectChange(project: SongProject): void;
  onError(message: string | null): void;
}

function readableError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function sectionTypeLabel(type: LyricsSectionType): string {
  return LYRICS_SECTION_GUIDANCE[type].defaultName;
}

function AddMapSectionForm({
  project,
  onProjectChange,
  onError,
  onClose,
}: SongMapWorkspaceProps & { onClose: () => void }) {
  const [type, setType] = useState<LyricsSectionType>("verse");
  const [name, setName] = useState(LYRICS_SECTION_GUIDANCE.verse.defaultName);

  function addSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const repository = createBrowserProjectRepository();
      repository.addLyricsSection(project.projectId, { type, name });
      const updated = repository.get(project.projectId);
      if (!updated) throw new Error("The project could not be reloaded after adding the section.");
      onProjectChange(updated);
      onError(null);
      onClose();
    } catch (error) {
      onError(readableError(error, "Could not add this section."));
    }
  }

  return (
    <form className="song-map-add-form" onSubmit={addSection}>
      <label>
         Section 类型
        <select
          value={type}
          onChange={(event) => {
            const nextType = event.target.value as LyricsSectionType;
            setType(nextType);
            setName(LYRICS_SECTION_GUIDANCE[nextType].defaultName);
          }}
        >
          {LYRICS_SECTION_TYPES.map((sectionType) => (
            <option key={sectionType} value={sectionType}>{sectionTypeLabel(sectionType)}</option>
          ))}
        </select>
      </label>
      <label>
         Section 名称
        <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <div className="song-map-form-actions">
        <button className="primary-button" type="submit">添加 Section</button>
        <button type="button" onClick={onClose}>取消</button>
      </div>
    </form>
  );
}

function SectionMapCard({
  project,
  section,
  onProjectChange,
  onError,
  onMove,
  onDuplicate,
  onRequestDelete,
  isDeletePending,
}: SongMapWorkspaceProps & {
  section: LyricsSection;
  onMove(sectionId: string, targetIndex: number): void;
  onDuplicate(sectionId: string): void;
  onRequestDelete(sectionId: string): void;
  isDeletePending: boolean;
}) {
  const [name, setName] = useState(section.name);
  const [bars, setBars] = useState(section.bars === null ? "" : String(section.bars));
  const statuses = getSongMapSectionStatuses(project, section);
  const isNameDirty = name !== section.name;
  const isBarsDirty = bars !== (section.bars === null ? "" : String(section.bars));

  function save(input: UpdateLyricsSectionInput, fallback: string) {
    try {
      const repository = createBrowserProjectRepository();
      repository.updateLyricsSection(project.projectId, section.sectionId, input);
      const updated = repository.get(project.projectId);
      if (!updated) throw new Error("The project could not be reloaded after saving this section.");
      onProjectChange(updated);
      onError(null);
    } catch (error) {
      onError(readableError(error, fallback));
    }
  }

  function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save({ name }, "Could not rename this section.");
  }

  function saveBars(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = bars.trim();
    save({ bars: normalized === "" ? null : Number(normalized) }, "Could not save bars.");
  }

  return (
    <article className="song-map-card" aria-labelledby={`song-map-section-${section.sectionId}`}>
      <ArchiveIndex number={section.order + 1} label="SECTION" />
      <header className="song-map-card-header">
        <div>
          <ArchiveMeta>{section.bars === null ? "BARS —" : `${section.bars} BARS`} / SECTION {String(section.order + 1).padStart(2, "0")}</ArchiveMeta>
          <p className="eyebrow">{sectionTypeLabel(section.type)} entry</p>
          <h3 id={`song-map-section-${section.sectionId}`}>{section.name}</h3>
          <span className="song-map-type">{sectionTypeLabel(section.type)}</span>
        </div>
        <div className="song-map-reorder" aria-label={`Reorder ${section.name}`}>
          <button type="button" disabled={section.order === 0} onClick={() => onMove(section.sectionId, section.order - 1)}>上移</button>
          <button type="button" disabled={section.order === project.lyrics.sections.length - 1} onClick={() => onMove(section.sectionId, section.order + 1)}>下移</button>
        </div>
      </header>

      <div className="song-map-edit-grid">
        <form onSubmit={saveName}>
          <label>
             名称
            <input maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
           <button type="submit" disabled={!isNameDirty}>保存名称</button>
        </form>
        <form onSubmit={saveBars}>
          <label>
             小节数 <span className="optional">可选</span>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={bars}
               placeholder="未设置"
              onChange={(event) => setBars(event.target.value)}
            />
          </label>
           <button type="submit" disabled={!isBarsDirty}>保存小节数</button>
        </form>
      </div>

      <dl className="song-map-statuses" aria-label={`${section.name} statuses`}>
         <div><dt>歌词状态</dt><dd>{statuses.lyrics}</dd></div>
         <div><dt>Melody 状态</dt><dd>{statuses.melody}</dd></div>
         <div><dt>Harmony 状态</dt><dd>{statuses.harmony}</dd></div>
         <div><dt>Arrangement 状态</dt><dd>{statuses.arrangement}</dd></div>
      </dl>
      <BeatTicks count={section.bars ? Math.min(section.bars, 8) : 4} />

      <div className="song-map-card-actions">
         <button type="button" onClick={() => onDuplicate(section.sectionId)}>复制</button>
        {isDeletePending ? (
          <span className="song-map-delete-confirmation" role="alert">
            <span>确定删除这个 Section 吗？</span>
            <button className="danger-button" type="button" onClick={() => onRequestDelete(section.sectionId)}>确认删除</button>
            <button type="button" onClick={() => onRequestDelete("")}>取消</button>
          </span>
        ) : (
          <button className="danger-button" type="button" onClick={() => onRequestDelete(section.sectionId)}>删除</button>
        )}
      </div>
    </article>
  );
}

export function SongMapWorkspace({ project, onProjectChange, onError }: SongMapWorkspaceProps) {
  const [showAddSection, setShowAddSection] = useState(project.lyrics.sections.length === 0);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function moveSection(sectionId: string, targetIndex: number) {
    try {
      const repository = createBrowserProjectRepository();
      repository.moveLyricsSection(project.projectId, sectionId, targetIndex);
      const updated = repository.get(project.projectId);
      if (!updated) throw new Error("The project could not be reloaded after reordering sections.");
      onProjectChange(updated);
      onError(null);
    } catch (error) {
      onError(readableError(error, "Could not reorder sections."));
    }
  }

  function duplicateSection(sectionId: string) {
    try {
      const repository = createBrowserProjectRepository();
      repository.duplicateLyricsSection(project.projectId, sectionId);
      const updated = repository.get(project.projectId);
      if (!updated) throw new Error("The project could not be reloaded after duplicating the section.");
      onProjectChange(updated);
      onError(null);
    } catch (error) {
      onError(readableError(error, "Could not duplicate this section."));
    }
  }

  async function deleteSection(sectionId: string) {
    if (!sectionId) {
      setPendingDeleteId(null);
      return;
    }
    try {
      await createBrowserMelodyService().deleteSection(project.projectId, sectionId);
      const updated = createBrowserProjectRepository().get(project.projectId);
      if (!updated) throw new Error("The project could not be reloaded after deleting the section.");
      onProjectChange(updated);
      onError(null);
      setPendingDeleteId(null);
    } catch (error) {
      onError(readableError(error, "Could not delete this section."));
    }
  }

  function requestDelete(sectionId: string) {
    if (pendingDeleteId === sectionId) {
      void deleteSection(sectionId);
    } else {
      setPendingDeleteId(sectionId || null);
    }
  }

  return (
    <div className="song-map-workspace">
      <header className="song-map-header">
        <div>
          <div className="archive-page-kicker"><ArchiveMeta>SONG MAP / SECTION INDEX</ArchiveMeta><ArchiveMeta>{project.lyrics.sections.length} SECTIONS</ArchiveMeta></div>
          <p className="eyebrow">当前阶段</p>
          <h2 id="current-stage-heading">Song Map / 歌曲结构</h2>
          <p>保留你选择的段落、顺序和小节数。这个 Map 不会替你决定结构。</p>
        </div>
        <button type="button" onClick={() => setShowAddSection((visible) => !visible)}>
          {showAddSection ? "关闭添加表单" : "添加 Section"}
        </button>
      </header>

      {showAddSection ? (
        <AddMapSectionForm
          project={project}
          onProjectChange={onProjectChange}
          onError={onError}
          onClose={() => setShowAddSection(false)}
        />
      ) : null}

      {project.lyrics.sections.length === 0 ? (
        <section className="song-map-empty">
          <h3>还没有 Section</h3>
          <p>添加你想在这个 Song Map 中看到的 Section。系统不会自动添加。</p>
        </section>
      ) : (
        <div className="song-map-list">
          {project.lyrics.sections.map((section) => (
            <SectionMapCard
              key={section.sectionId}
              project={project}
              section={section}
              onProjectChange={onProjectChange}
              onError={onError}
              onMove={moveSection}
              onDuplicate={duplicateSection}
              onRequestDelete={requestDelete}
              isDeletePending={pendingDeleteId === section.sectionId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SongMapContext({ project }: { project: SongProject }) {
  const barsSet = project.lyrics.sections.filter((section) => section.bars !== null).length;
  return <p>共有 {project.lyrics.sections.length} 个 Section · 已填写 {barsSet} 个小节数。</p>;
}
