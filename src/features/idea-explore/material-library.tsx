"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  MATERIAL_TYPES,
  type Material,
  type MaterialType,
  type SongProject,
} from "../../domain/project/project";
import { createBrowserProjectRepository } from "../../infrastructure/persistence/browser-project-repository";
import { MATERIAL_TYPE_LABELS } from "./prompts";

interface MaterialLibraryProps {
  project: SongProject;
  onProjectChange: (project: SongProject) => void;
  onError: (message: string | null) => void;
  addFormOpen?: boolean;
  onAddFormOpenChange?: (open: boolean) => void;
}

export function MaterialLibrary({
  project,
  onProjectChange,
  onError,
  addFormOpen: controlledAddFormOpen,
  onAddFormOpenChange,
}: MaterialLibraryProps) {
  const [localAddFormOpen, setLocalAddFormOpen] = useState(false);
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [type, setType] = useState<MaterialType>("other");
  const [filter, setFilter] = useState<MaterialType | "all">("all");
  const [editing, setEditing] = useState<Material | null>(null);
  const addFormOpen = controlledAddFormOpen ?? localAddFormOpen;

  const visibleMaterials = useMemo(
    () => project.materials.filter((material) => filter === "all" || material.type === filter),
    [filter, project.materials],
  );

  function setAddFormOpen(open: boolean) {
    setLocalAddFormOpen(open);
    onAddFormOpenChange?.(open);
  }

  function reload() {
    const updated = createBrowserProjectRepository().get(project.projectId);
    if (updated) onProjectChange(updated);
  }

  function addMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      createBrowserProjectRepository().addMaterial(project.projectId, { type, content, note });
      reload();
      setContent("");
      setNote("");
      setType("other");
      setAddFormOpen(false);
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not add this material.");
    }
  }

  function updateMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    try {
      createBrowserProjectRepository().updateMaterial(project.projectId, editing.materialId, {
        type: editing.type,
        content: editing.content,
        note: editing.note,
      });
      reload();
      setEditing(null);
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not update this material.");
    }
  }

  function deleteMaterial(materialId: string) {
    try {
      createBrowserProjectRepository().deleteMaterial(project.projectId, materialId);
      reload();
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not delete this material.");
    }
  }

  return (
    <section className="material-library" id="material-library" aria-labelledby="material-library-heading">
      <div className="material-library-header">
        <div>
          <p className="eyebrow">你保存的素材</p>
          <h3 id="material-library-heading">Material Library / 素材库</h3>
        </div>
        <button type="button" onClick={() => setAddFormOpen(!addFormOpen)}>
          {addFormOpen ? "关闭" : "添加素材"}
        </button>
      </div>

      {addFormOpen ? (
        <form className="material-form" onSubmit={addMaterial}>
          <label>
            你的素材
            <textarea required rows={4} maxLength={4000} value={content} onChange={(event) => setContent(event.target.value)} />
          </label>
          <label>
            素材类型
            <select value={type} onChange={(event) => setType(event.target.value as MaterialType)}>
              {MATERIAL_TYPES.map((value) => <option key={value} value={value}>{MATERIAL_TYPE_LABELS[value]}</option>)}
            </select>
          </label>
          <label>
            备注 <span className="optional">可选</span>
            <input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button className="primary-button" type="submit">保存素材</button>
        </form>
      ) : null}

      {project.materials.length > 1 ? (
        <label className="material-filter">
          按类型筛选
          <select value={filter} onChange={(event) => setFilter(event.target.value as MaterialType | "all")}>
            <option value="all">全部类型</option>
            {MATERIAL_TYPES.map((value) => <option key={value} value={value}>{MATERIAL_TYPE_LABELS[value]}</option>)}
          </select>
        </label>
      ) : null}

      {visibleMaterials.length === 0 ? (
        <p className="material-empty">这里还没有保存的素材。只有你选择保存的内容才会出现在素材库中。</p>
      ) : (
        <div className="material-list">
          {visibleMaterials.map((material) => editing?.materialId === material.materialId ? (
            <form className="material-card material-form" key={material.materialId} onSubmit={updateMaterial}>
              <label>
                内容
                <textarea required rows={4} value={editing.content} onChange={(event) => setEditing({ ...editing, content: event.target.value })} />
              </label>
              <label>
                类型
                <select value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value as MaterialType })}>
                  {MATERIAL_TYPES.map((value) => <option key={value} value={value}>{MATERIAL_TYPE_LABELS[value]}</option>)}
                </select>
              </label>
              <label>
                备注 <span className="optional">可选</span>
                <input value={editing.note} onChange={(event) => setEditing({ ...editing, note: event.target.value })} />
              </label>
              <div className="material-actions">
                <button className="primary-button" type="submit">保存修改</button>
                <button type="button" onClick={() => setEditing(null)}>取消</button>
              </div>
            </form>
          ) : (
            <article className="material-card" key={material.materialId}>
              <p className="material-type">{MATERIAL_TYPE_LABELS[material.type]}</p>
              <p className="material-content">{material.content}</p>
                {material.note ? <p className="material-note">备注：{material.note}</p> : null}
              <div className="material-actions">
                <button type="button" onClick={() => setEditing(structuredClone(material))}>编辑</button>
                <button className="danger-button" type="button" onClick={() => deleteMaterial(material.materialId)}>删除</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
