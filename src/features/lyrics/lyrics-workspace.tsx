"use client";

import { type FormEvent, useState } from "react";
import {
  LYRICS_SECTION_GUIDANCE,
  LYRICS_SECTION_TYPES,
  type LyricsSection,
  type LyricsSectionType,
  type SongProject,
} from "../../domain/project/project";
import {
  createBrowserMelodyService,
  createBrowserProjectRepository,
} from "../../infrastructure/persistence/browser-project-repository";
import { ArchiveIndex, ArchiveMeta, MarginNote, StaffFragment } from "../../components/archive/archive-markup";

interface LyricsWorkspaceProps {
  project: SongProject;
  onProjectChange: (project: SongProject) => void;
  onError: (message: string | null) => void;
}

function readableError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function AddSectionForm({ project, onProjectChange, onError, onClose, onAdded }: LyricsWorkspaceProps & {
  onClose: () => void;
  onAdded: (sectionId: string) => void;
}) {
  const [type, setType] = useState<LyricsSectionType>("verse");
  const [name, setName] = useState(LYRICS_SECTION_GUIDANCE.verse.defaultName);

  function changeType(nextType: LyricsSectionType) {
    setType(nextType);
    setName(LYRICS_SECTION_GUIDANCE[nextType].defaultName);
  }

  function addSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const repository = createBrowserProjectRepository();
      const section = repository.addLyricsSection(project.projectId, { type, name });
      const updated = repository.get(project.projectId);
       if (!updated) throw new Error("添加段落后无法重新加载项目。");
      onProjectChange(updated);
      onAdded(section.sectionId);
      onError(null);
      onClose();
    } catch (error) {
       onError(readableError(error, "无法添加这个段落。"));
    }
  }

  return (
    <form className="lyrics-add-form" onSubmit={addSection}>
      <label>
         Section 类型
        <select value={type} onChange={(event) => changeType(event.target.value as LyricsSectionType)}>
          {LYRICS_SECTION_TYPES.map((sectionType) => (
            <option key={sectionType} value={sectionType}>
              {LYRICS_SECTION_GUIDANCE[sectionType].defaultName}
            </option>
          ))}
        </select>
      </label>
      <label>
         Section 名称
        <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <p>{LYRICS_SECTION_GUIDANCE[type].purpose}</p>
      <div className="lyrics-form-actions">
        <button className="primary-button" type="submit">添加 Section</button>
        <button type="button" onClick={onClose}>取消</button>
      </div>
    </form>
  );
}

function SectionEditor({
  project,
  section,
  onProjectChange,
  onError,
}: LyricsWorkspaceProps & { section: LyricsSection }) {
  const [name, setName] = useState(section.name);
  const [userLyrics, setUserLyrics] = useState(section.userLyrics);
  const [notes, setNotes] = useState(section.notes);
  const isDirty = name !== section.name || userLyrics !== section.userLyrics || notes !== section.notes;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const repository = createBrowserProjectRepository();
      repository.updateLyricsSection(project.projectId, section.sectionId, {
        name,
        userLyrics,
        notes,
      });
      const updated = repository.get(project.projectId);
       if (!updated) throw new Error("保存段落后无法重新加载项目。");
      onProjectChange(updated);
      onError(null);
    } catch (error) {
       onError(readableError(error, "无法保存这个段落。"));
    }
  }

  return (
    <form
      className="lyrics-editor"
      aria-labelledby={`lyrics-section-heading-${section.sectionId}`}
      onSubmit={save}
    >
      <div className="lyrics-editor-heading">
        <div>
          <ArchiveMeta>SECTION {String(section.order + 1).padStart(2, "0")} / {section.bars === null ? "BARS —" : `${section.bars} BARS`}</ArchiveMeta>
          <p className="eyebrow">当前 Section</p>
          <h2 id={`lyrics-section-heading-${section.sectionId}`}>{section.name}</h2>
        </div>
        <div className="lyrics-editor-heading-side">
          <span className="lyrics-type-label">{LYRICS_SECTION_GUIDANCE[section.type].defaultName}</span>
          <StaffFragment />
        </div>
      </div>

      <label>
         Section 名称
        <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
      </label>

      <div className="lyrics-editor-grid">
        <div className="lyrics-manuscript-column">
          <label className="lyrics-writing-field">
             你的歌词
            <textarea
              rows={14}
              value={userLyrics}
              onChange={(event) => setUserLyrics(event.target.value)}
               placeholder="在这里写下你自己的文字。编辑器只保存你输入的内容。"
            />
          </label>
          <div className="lyrics-save-row">
             <button className="primary-button" type="submit" disabled={!isDirty}>保存 Section</button>
             <span aria-live="polite">{isDirty ? "有未保存修改" : "已保存"}</span>
          </div>
        </div>
        <aside className="lyrics-editor-margin">
          <section className="section-guidance" aria-labelledby={`purpose-${section.sectionId}`}>
            <h3 id={`purpose-${section.sectionId}`}>这个 Section 通常做什么</h3>
            <p>{section.purpose}</p>
            <h3>可以思考的问题</h3>
            <ul>
              {section.reflectionQuestions.map((question) => <li key={question}>{question}</li>)}
            </ul>
          </section>
          <label>
             Section 备注 <span className="optional">可选</span>
            <textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
               placeholder="记录你对这个 Section 的观察或决定。"
            />
          </label>
          <MarginNote>MANUSCRIPT NOTE / {String(section.order + 1).padStart(2, "0")}</MarginNote>
        </aside>
      </div>
    </form>
  );
}

export function LyricsWorkspace(props: LyricsWorkspaceProps) {
  const { project, onProjectChange, onError } = props;
  const [activeSectionId, setActiveSectionId] = useState(project.lyrics.sections[0]?.sectionId ?? null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const activeSection = project.lyrics.sections.find((section) => section.sectionId === activeSectionId)
    ?? project.lyrics.sections[0]
    ?? null;

  function initializeGuidedStructure() {
    try {
      const updated = createBrowserProjectRepository().initializeGuidedLyrics(project.projectId);
      onProjectChange(updated);
      setActiveSectionId(updated.lyrics.sections[0]?.sectionId ?? null);
      onError(null);
    } catch (error) {
       onError(readableError(error, "无法创建 Guided 起始结构。"));
    }
  }

  function refreshAfter(action: (repository: ReturnType<typeof createBrowserProjectRepository>) => void) {
    try {
      const repository = createBrowserProjectRepository();
      action(repository);
      const updated = repository.get(project.projectId);
       if (!updated) throw new Error("项目无法重新加载。");
      onProjectChange(updated);
      onError(null);
      return updated;
    } catch (error) {
       onError(readableError(error, "无法更新 Lyrics Workspace。"));
      return null;
    }
  }

  function duplicateSection(sectionId: string) {
    let duplicateId: string | null = null;
    const updated = refreshAfter((repository) => {
      duplicateId = repository.duplicateLyricsSection(project.projectId, sectionId).sectionId;
    });
    if (updated && duplicateId) setActiveSectionId(duplicateId);
  }

  async function deleteSection(sectionId: string) {
    try {
      await createBrowserMelodyService().deleteSection(project.projectId, sectionId);
      const updated = createBrowserProjectRepository().get(project.projectId);
       if (!updated) throw new Error("项目无法重新加载。");
      onProjectChange(updated);
      onError(null);
      setPendingDeleteId(null);
      setActiveSectionId(updated.lyrics.sections[0]?.sectionId ?? null);
    } catch (error) {
       onError(readableError(error, "无法删除这个 Section 及其录音。"));
    }
  }

  function moveSection(section: LyricsSection, direction: -1 | 1) {
    const updated = refreshAfter((repository) => {
      repository.moveLyricsSection(project.projectId, section.sectionId, section.order + direction);
    });
    if (updated) setActiveSectionId(section.sectionId);
  }

  return (
    <div className="lyrics-workspace">
      <header className="lyrics-workspace-header">
        <div>
          <div className="archive-page-kicker"><ArchiveMeta>LYRICS / {String(project.lyrics.sections.length).padStart(2, "0")}</ArchiveMeta><ArchiveMeta>MANUSCRIPT DRAFT</ArchiveMeta></div>
          <p className="eyebrow">当前阶段</p>
          <h2 id="current-stage-heading">Lyrics Workspace / 歌词工作区</h2>
          <p>管理歌曲的形状，并保留你写下的文字。这里不会替你写作。</p>
        </div>
        <button type="button" onClick={() => setShowAddSection((visible) => !visible)}>添加 Section</button>
      </header>

      {showAddSection ? (
        <AddSectionForm
          {...props}
          onClose={() => setShowAddSection(false)}
          onAdded={setActiveSectionId}
        />
      ) : null}

      {project.lyrics.sections.length === 0 ? (
        <section className="lyrics-empty-state">
          <h3>还没有 Section</h3>
          {project.creationMode === "Guided" ? (
            <>
              <p>你可以从可编辑的六段结构开始，也可以添加自己的第一个 Section。起始结构是可选的，并且可以重命名、重新排序、复制或删除。</p>
              <button className="primary-button" type="button" onClick={initializeGuidedStructure}>
                使用可编辑的起始结构
              </button>
            </>
          ) : (
            <p>Free 模式从空白开始。按你选择的顺序，只添加你想要的 Section。</p>
          )}
        </section>
      ) : (
        <div className={`lyrics-mode-layout ${project.creationMode === "Free" ? "free" : "guided"}`}>
          <nav className="lyrics-section-nav" aria-label="歌曲段落">
            <p className="eyebrow">歌曲段落</p>
            <ol>
              {project.lyrics.sections.map((section) => (
                <li key={section.sectionId}>
                  <ArchiveIndex number={section.order + 1} />
                  <button
                    type="button"
                    className={section.sectionId === activeSection?.sectionId ? "active" : ""}
                    aria-current={section.sectionId === activeSection?.sectionId ? "true" : undefined}
                    onClick={() => setActiveSectionId(section.sectionId)}
                  >
                    <span>{section.name}</span>
                    {project.creationMode === "Free" ? <small>{section.purpose}</small> : null}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          {activeSection ? (
            <div className="lyrics-section-focus manuscript-focus">
              <div className="section-management" aria-label={`Manage ${activeSection.name}`}>
                <ArchiveMeta>WORKING SECTION / {String(activeSection.order + 1).padStart(2, "0")}</ArchiveMeta>
                <button type="button" disabled={activeSection.order === 0} onClick={() => moveSection(activeSection, -1)}>上移</button>
                <button type="button" disabled={activeSection.order === project.lyrics.sections.length - 1} onClick={() => moveSection(activeSection, 1)}>下移</button>
                <button type="button" onClick={() => duplicateSection(activeSection.sectionId)}>复制</button>
                {pendingDeleteId === activeSection.sectionId ? (
                  <span className="section-delete-confirmation">
                    <span>{activeSection.userLyrics ? "This section contains lyrics. Delete it?" : "Delete this section?"}</span>
                    <button className="danger-button" type="button" onClick={() => deleteSection(activeSection.sectionId)}>确认删除</button>
                    <button type="button" onClick={() => setPendingDeleteId(null)}>取消</button>
                  </span>
                ) : (
                  <button className="danger-button" type="button" onClick={() => setPendingDeleteId(activeSection.sectionId)}>删除</button>
                )}
              </div>
              <SectionEditor key={activeSection.sectionId} {...props} section={activeSection} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function LyricsContext({ project }: { project: SongProject }) {
  const selectedMaterials = project.songIntent.selectedMaterialIds.flatMap((materialId) => {
    const material = project.materials.find((item) => item.materialId === materialId);
    return material ? [material] : [];
  });
  const intentFields = [
    ["Core idea", project.songIntent.coreIdea],
    ["Desired feeling", project.songIntent.desiredFeeling],
    ["Core image", project.songIntent.coreImage],
    ["Central conflict", project.songIntent.centralConflict],
  ].filter((item) => item[1]);

  return (
    <div className="lyrics-context">
      <details>
        <summary>Song Intent</summary>
        {intentFields.length === 0 ? <p>尚未保存 Song Intent 内容。</p> : (
          <dl>
            {intentFields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        )}
      </details>
      <details>
        <summary>已选素材</summary>
        {selectedMaterials.length === 0 ? <p>Song Intent 中尚未选择素材。</p> : (
          <ul>{selectedMaterials.map((material) => <li key={material.materialId}>{material.content}</li>)}</ul>
        )}
      </details>
      <details>
        <summary>Material Library ({project.materials.length})</summary>
        {project.materials.length === 0 ? <p>Material Library 为空。</p> : (
          <ul>{project.materials.map((material) => <li key={material.materialId}>{material.content}</li>)}</ul>
        )}
      </details>
    </div>
  );
}
