"use client";

import { type FormEvent, useMemo, useState } from "react";
import type { SongProject, SongVersion } from "../../domain/project/project";
import { compareVersions } from "../../domain/project/versions";
import {
  createBrowserProjectRepository,
  createBrowserVersionService,
} from "../../infrastructure/persistence/browser-project-repository";
import { ArchiveMeta, MarginNote, StripeMarker } from "../../components/archive/archive-markup";

interface VersionWorkspaceProps {
  project: SongProject;
  onProjectChange: (project: SongProject) => void;
  onError: (message: string | null) => void;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Version 操作无法完成。";
}

function formatVersionDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function VersionDetails({ version }: { version: SongVersion }) {
  const selectedTakes = version.snapshot.melody.takes.filter((take) =>
    version.snapshot.melody.selectedTakeIds.includes(take.takeId)
  );
  return (
    <div className="version-details">
      <dl>
        <div><dt>Rhythm</dt><dd>{version.snapshot.rhythm.bpm} BPM · {version.snapshot.rhythm.timeSignature}</dd></div>
        <div><dt>段落</dt><dd>{version.snapshot.lyrics.sections.map((section) => section.name).join(" · ") || "暂无"}</dd></div>
        <div><dt>Harmony / 和声</dt><dd>{version.snapshot.harmony.key ?? "未设置 Key"} · {version.snapshot.harmony.progressions.length} 个和弦进行</dd></div>
        <div><dt>Arrangement / 编曲</dt><dd>{version.snapshot.arrangement.tracks.length} 个 Track · {version.snapshot.arrangement.cells.length} 个已保存单元格</dd></div>
        <div><dt>已选 Melody Takes</dt><dd>{selectedTakes.map((take) => take.name).join(" · ") || "暂无"}</dd></div>
      </dl>
      <div>
        <h4>Lyrics 快照</h4>
        {version.snapshot.lyrics.sections.map((section) => (
          <section key={section.sectionId} className="version-lyrics-section">
            <strong>{section.name}</strong>
            <pre>{section.userLyrics || "这个 Section 尚未保存 Lyrics。"}</pre>
          </section>
        ))}
      </div>
      <div>
        <h4>Open Questions</h4>
        {version.snapshot.openQuestions.length ? (
          <ul>{version.snapshot.openQuestions.map((question, index) => <li key={`${index}:${question}`}>{question}</li>)}</ul>
        ) : <p>暂无</p>}
      </div>
    </div>
  );
}

export function VersionWorkspace({ project, onProjectChange, onError }: VersionWorkspaceProps) {
  const [note, setNote] = useState("");
  const [openVersionId, setOpenVersionId] = useState<string | null>(null);
  const [leftVersionId, setLeftVersionId] = useState(project.versions[0]?.versionId ?? "");
  const [rightVersionId, setRightVersionId] = useState(project.versions[1]?.versionId ?? "");
  const [renameVersionId, setRenameVersionId] = useState<string | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [deleteVersionId, setDeleteVersionId] = useState<string | null>(null);
  const [restoreVersionId, setRestoreVersionId] = useState<string | null>(null);
  const [createBackup, setCreateBackup] = useState(true);

  const differences = useMemo(() => {
    const left = project.versions.find((version) => version.versionId === leftVersionId);
    const right = project.versions.find((version) => version.versionId === rightVersionId);
    return left && right && left.versionId !== right.versionId ? compareVersions(left, right) : null;
  }, [leftVersionId, project.versions, rightVersionId]);

  function saveVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      createBrowserProjectRepository().saveVersion(project.projectId, { userNote: note });
      const updated = createBrowserProjectRepository().get(project.projectId);
      if (!updated) throw new Error("项目无法重新加载。");
      onProjectChange(updated);
      setNote("");
      if (!leftVersionId) setLeftVersionId(updated.versions[0]?.versionId ?? "");
      if (!rightVersionId) setRightVersionId(updated.versions[1]?.versionId ?? "");
      onError(null);
    } catch (error) {
      onError(message(error));
    }
  }

  function renameVersion(event: FormEvent<HTMLFormElement>, versionId: string) {
    event.preventDefault();
    try {
      createBrowserProjectRepository().renameVersion(project.projectId, versionId, renameLabel);
      const updated = createBrowserProjectRepository().get(project.projectId)!;
      onProjectChange(updated);
      setRenameVersionId(null);
      onError(null);
    } catch (error) {
      onError(message(error));
    }
  }

  function duplicateVersion(versionId: string) {
    try {
      createBrowserProjectRepository().duplicateVersion(project.projectId, versionId);
      onProjectChange(createBrowserProjectRepository().get(project.projectId)!);
      onError(null);
    } catch (error) {
      onError(message(error));
    }
  }

  async function deleteVersion(versionId: string) {
    try {
      const updated = await createBrowserVersionService().deleteVersion(project.projectId, versionId);
      onProjectChange(updated);
      setDeleteVersionId(null);
      if (leftVersionId === versionId) setLeftVersionId("");
      if (rightVersionId === versionId) setRightVersionId("");
      onError(null);
    } catch (error) {
      onError(message(error));
    }
  }

  async function restoreVersion(versionId: string) {
    try {
      const updated = await createBrowserVersionService().restoreVersion(project.projectId, versionId, createBackup);
      onProjectChange(updated);
      setRestoreVersionId(null);
      onError(null);
    } catch (error) {
      onError(message(error));
    }
  }

  return (
    <section className="version-workspace" aria-labelledby="versions-heading">
      <header>
        <div className="archive-page-kicker"><ArchiveMeta>DEMO ARCHIVE / {String(project.versions.length).padStart(2, "0")}</ArchiveMeta><ArchiveMeta>DATED SNAPSHOTS</ArchiveMeta></div>
        <p className="eyebrow">Version 历史</p>
        <h2 id="versions-heading">Versions</h2>
        <p>在你选择的时刻手动保存快照。Versions 只显示事实变化，不评价歌曲。</p>
      </header>

      <form className="save-version-form" onSubmit={saveVersion}>
        <label>
          Version 备注 <span className="optional">可选</span>
          <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="关于这个快照，你想记住什么？" />
        </label>
        <button className="primary-button" type="submit">保存 Version</button>
      </form>

      {project.versions.length === 0 ? <p className="empty-state">还没有保存 Version。</p> : null}
      <div className="version-list">
        {project.versions.slice().reverse().map((version) => (
          <article className="version-card demo-archive-entry" key={version.versionId}>
            <div className="version-stamp">
              <ArchiveMeta>V{version.versionNumber}</ArchiveMeta>
              <StripeMarker label={openVersionId === version.versionId ? "当前查看的 Version" : undefined} />
            </div>
            <div className="version-card-heading">
              <div><h3>{version.label}</h3><ArchiveMeta><time dateTime={version.createdAt}>{formatVersionDate(version.createdAt)} UTC</time></ArchiveMeta></div>
              <MarginNote>{version.userNote || "没有 Version 备注"}</MarginNote>
            </div>
            <div className="version-actions">
              <button type="button" onClick={() => setOpenVersionId(openVersionId === version.versionId ? null : version.versionId)}>
                {openVersionId === version.versionId ? "关闭" : "打开 / 查看"}
              </button>
              <button type="button" onClick={() => duplicateVersion(version.versionId)}>复制</button>
              <button type="button" onClick={() => { setRenameVersionId(version.versionId); setRenameLabel(version.label); }}>重命名</button>
              <button type="button" onClick={() => setRestoreVersionId(version.versionId)}>恢复</button>
              <button className="danger-button" type="button" onClick={() => setDeleteVersionId(version.versionId)}>删除</button>
            </div>
            {renameVersionId === version.versionId ? (
              <form className="inline-form" onSubmit={(event) => renameVersion(event, version.versionId)}>
                <label>Version 标签<input required maxLength={80} value={renameLabel} onChange={(event) => setRenameLabel(event.target.value)} /></label>
                <button type="submit">保存标签</button>
                <button type="button" onClick={() => setRenameVersionId(null)}>取消</button>
              </form>
            ) : null}
            {restoreVersionId === version.versionId ? (
              <div className="version-confirmation" role="alert">
                <p>确定恢复 {version.label} 吗？当前 Lyrics、段落、Rhythm、Harmony、Arrangement、已选 Takes、备注和 Open Questions 将被替换。当前 Review 反思、分类备注、下一步关注点和状态会保留在这个 Project 中。</p>
                <label><input type="checkbox" checked={createBackup} onChange={(event) => setCreateBackup(event.target.checked)} /> 恢复前创建一个安全 Version</label>
                <div><button className="danger-button" type="button" onClick={() => void restoreVersion(version.versionId)}>确认恢复</button><button type="button" onClick={() => setRestoreVersionId(null)}>取消</button></div>
              </div>
            ) : null}
            {deleteVersionId === version.versionId ? (
              <div className="version-confirmation" role="alert">
                <p>确定删除 {version.label} 吗？这会删除这个快照。只有在没有当前 Take 或其他 Version 引用音频时，音频才会被删除。</p>
                <div><button className="danger-button" type="button" onClick={() => void deleteVersion(version.versionId)}>确认删除</button><button type="button" onClick={() => setDeleteVersionId(null)}>取消</button></div>
              </div>
            ) : null}
            {openVersionId === version.versionId ? <VersionDetails version={version} /> : null}
          </article>
        ))}
      </div>

      {project.versions.length >= 2 ? (
        <section className="version-compare" aria-labelledby="compare-heading">
          <h3 id="compare-heading">对比 Versions</h3>
          <div className="version-compare-pickers">
            <label>从<select value={leftVersionId} onChange={(event) => setLeftVersionId(event.target.value)}><option value="">选择 Version</option>{project.versions.map((version) => <option key={version.versionId} value={version.versionId}>{version.label}</option>)}</select></label>
            <label>到<select value={rightVersionId} onChange={(event) => setRightVersionId(event.target.value)}><option value="">选择 Version</option>{project.versions.map((version) => <option key={version.versionId} value={version.versionId}>{version.label}</option>)}</select></label>
          </div>
          {differences?.length === 0 ? <p>保存的快照字段中没有发现事实差异。</p> : null}
          {differences ? <ul className="version-differences">{differences.map((difference, index) => <li key={`${difference.kind}:${index}`}><strong>{difference.label}</strong><span>{difference.detail}</span></li>)}</ul> : <p>选择两个不同的 Versions 进行对比。</p>}
        </section>
      ) : null}
    </section>
  );
}
