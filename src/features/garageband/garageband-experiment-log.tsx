"use client";

import { FormEvent, useState } from "react";
import type {
  AddGarageBandExperimentInput,
  GarageBandExperiment,
  GarageBandExperimentType,
  SongProject,
} from "../../domain/project/project";
import { GARAGEBAND_EXPERIMENT_TYPES } from "../../domain/project/project";
import { createBrowserProjectRepository } from "../../infrastructure/persistence/browser-project-repository";
import { ArchiveMeta, MarginNote, RecordStamp } from "../../components/archive/archive-markup";

interface GarageBandExperimentLogProps {
  project: SongProject;
  isOpen: boolean;
  initialSectionId?: string | null;
  onOpenChange(open: boolean): void;
  onProjectChange(project: SongProject): void;
  onError(message: string | null): void;
}

interface ExperimentFormState {
  sectionId: string;
  type: GarageBandExperimentType;
  date: string;
  goal: string;
  whatITried: string;
  whatINoticed: string;
  decision: string;
  nextQuestion: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(sectionId = ""): ExperimentFormState {
  return {
    sectionId,
    type: "Other",
    date: "",
    goal: "",
    whatITried: "",
    whatINoticed: "",
    decision: "",
    nextQuestion: "",
  };
}

function formFromExperiment(experiment: GarageBandExperiment): ExperimentFormState {
  return {
    sectionId: experiment.sectionId ?? "",
    type: experiment.type,
    date: experiment.date,
    goal: experiment.goal,
    whatITried: experiment.whatITried,
    whatINoticed: experiment.whatINoticed,
    decision: experiment.decision,
    nextQuestion: experiment.nextQuestion,
  };
}

function sectionName(project: SongProject, sectionId: string | null): string {
  if (!sectionId) return "没有关联的 Section（历史记录保留）";
  return project.lyrics.sections.find((section) => section.sectionId === sectionId)?.name
    ?? "Section 不可用";
}

function Field({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  rows?: number;
}) {
  return (
    <label className="garageband-experiment-field">
      {label}
      <textarea
        required
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function GarageBandExperimentLog({
  project,
  isOpen,
  initialSectionId,
  onOpenChange,
  onProjectChange,
  onError,
}: GarageBandExperimentLogProps) {
  const [form, setForm] = useState<ExperimentFormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function setField(field: keyof ExperimentFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startNew() {
    setEditingId(null);
    setDeletingId(null);
    setForm(emptyForm(initialSectionId ?? ""));
    onError(null);
  }

  function closeLog() {
    setEditingId(null);
    setDeletingId(null);
    setForm(emptyForm(initialSectionId ?? ""));
    onOpenChange(false);
  }

  function startEdit(experiment: GarageBandExperiment) {
    setEditingId(experiment.experimentId);
    setDeletingId(null);
    setForm(formFromExperiment(experiment));
    onError(null);
  }

  function saveExperiment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: AddGarageBandExperimentInput = {
      sectionId: form.sectionId || null,
      type: form.type,
      date: form.date,
      goal: form.goal,
      whatITried: form.whatITried,
      whatINoticed: form.whatINoticed,
      decision: form.decision,
      nextQuestion: form.nextQuestion,
    };
    try {
      const repository = createBrowserProjectRepository();
      if (editingId === null) {
        repository.addGarageBandExperiment(project.projectId, input);
      } else {
        repository.updateGarageBandExperiment(project.projectId, editingId, input);
      }
      const updated = repository.get(project.projectId);
      if (!updated) throw new Error("Could not save this experiment.");
      onProjectChange(updated);
      setEditingId(null);
      setForm(emptyForm(initialSectionId ?? ""));
      setDeletingId(null);
      onError(null);
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : "Could not save this experiment.");
    }
  }

  function deleteExperiment(experimentId: string) {
    try {
      const repository = createBrowserProjectRepository();
      repository.deleteGarageBandExperiment(project.projectId, experimentId);
      const updated = repository.get(project.projectId);
      if (!updated) throw new Error("Could not reload this project.");
      onProjectChange(updated);
      if (editingId === experimentId) {
        setEditingId(null);
        setForm(emptyForm(initialSectionId ?? ""));
      }
      setDeletingId(null);
      onError(null);
    } catch (deleteError) {
      onError(deleteError instanceof Error ? deleteError.message : "Could not delete this experiment.");
    }
  }

  return (
    <section className="garageband-experiment-log" aria-labelledby="garageband-experiment-log-heading">
      {!isOpen ? (
        <div className="garageband-experiment-entry">
          <div>
            <ArchiveMeta>STUDIO NOTEBOOK / {String(project.garageBandExperiments.length).padStart(2, "0")}</ArchiveMeta>
            <p className="eyebrow">Project 记录</p>
            <h2 id="garageband-experiment-log-heading">GarageBand 实验记录</h2>
            <p>用你自己的话记录你尝试了什么、注意到了什么、做了什么决定，以及接下来想探索什么。</p>
          </div>
          <button type="button" onClick={() => onOpenChange(true)}>打开实验记录</button>
        </div>
      ) : (
        <div className="garageband-experiment-panel">
          <header className="garageband-experiment-header">
            <div>
              <ArchiveMeta>STUDIO NOTEBOOK / {String(project.garageBandExperiments.length).padStart(2, "0")}</ArchiveMeta>
              <p className="eyebrow">Project 记录</p>
              <h2 id="garageband-experiment-log-heading">GarageBand 实验记录</h2>
              <p>下面的每条结果都由你书写和决定。Practice Guide 中的临时问题不会复制到这里。</p>
            </div>
            <div className="garageband-experiment-header-actions">
              <button type="button" onClick={startNew}>新建实验</button>
              <button className="learning-close-button" type="button" onClick={closeLog}>
                关闭记录
              </button>
            </div>
          </header>

          <form className="garageband-experiment-form" onSubmit={saveExperiment}>
            <div className="garageband-experiment-form-grid">
              <label>
                类型
                <select value={form.type} onChange={(event) => setField("type", event.target.value)}>
                  {GARAGEBAND_EXPERIMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label>
                日期
                <input
                  required
                  type="date"
                  value={form.date}
                  onFocus={(event) => {
                    if (!event.currentTarget.value) setField("date", today());
                  }}
                  onChange={(event) => setField("date", event.target.value)}
                />
              </label>
              <label>
                Section <span className="optional">可选</span>
                <select value={form.sectionId} onChange={(event) => setField("sectionId", event.target.value)}>
                  <option value="">不指定 Section</option>
                  {project.lyrics.sections.map((section) => (
                    <option key={section.sectionId} value={section.sectionId}>{section.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <Field label="目标" value={form.goal} onChange={(value) => setField("goal", value)} />
            <Field label="我尝试了什么" value={form.whatITried} onChange={(value) => setField("whatITried", value)} />
            <Field label="我注意到了什么" value={form.whatINoticed} onChange={(value) => setField("whatINoticed", value)} />
            <Field label="我的决定" value={form.decision} onChange={(value) => setField("decision", value)} />
            <Field label="下一个问题" value={form.nextQuestion} onChange={(value) => setField("nextQuestion", value)} />
            <div className="garageband-experiment-form-actions">
              <button className="primary-button" type="submit">
                {editingId === null ? "保存实验" : "保存修改"}
              </button>
              {editingId !== null ? <button type="button" onClick={startNew}>取消编辑</button> : null}
            </div>
          </form>

          <div className="garageband-experiment-list" aria-live="polite">
            <div className="garageband-experiment-list-heading">
              <div>
                <p className="eyebrow">已保存历史</p>
                <h3>共 {project.garageBandExperiments.length} 条实验记录</h3>
              </div>
              <p>关联的 Section 删除后，历史记录仍会保留。</p>
            </div>
            {project.garageBandExperiments.length === 0 ? (
              <p className="empty-state">还没有实验记录。</p>
            ) : project.garageBandExperiments.map((experiment) => (
              <article className="garageband-experiment-card" key={experiment.experimentId}>
                <header>
                  <div>
                    <RecordStamp tone="green">{experiment.type.toUpperCase()}</RecordStamp>
                    <span className="garageband-experiment-type">{experiment.type}</span>
                    <h3>{experiment.date}</h3>
                  <MarginNote>{sectionName(project, experiment.sectionId)}</MarginNote>
                  </div>
                  <div className="garageband-experiment-card-actions">
                    <button type="button" onClick={() => startEdit(experiment)}>编辑</button>
                    <button type="button" onClick={() => setDeletingId(experiment.experimentId)}>删除</button>
                  </div>
                </header>
                <dl className="garageband-experiment-details">
                    <div><dt>目标</dt><dd>{experiment.goal}</dd></div>
                    <div><dt>我尝试了什么</dt><dd>{experiment.whatITried}</dd></div>
                    <div><dt>我注意到了什么</dt><dd>{experiment.whatINoticed}</dd></div>
                    <div><dt>我的决定</dt><dd>{experiment.decision}</dd></div>
                    <div><dt>下一个问题</dt><dd>{experiment.nextQuestion}</dd></div>
                </dl>
                {deletingId === experiment.experimentId ? (
                  <div className="garageband-experiment-delete-confirmation" role="alert">
                    <span>确定删除这条实验记录吗？此操作无法撤销。</span>
                    <button type="button" onClick={() => deleteExperiment(experiment.experimentId)}>删除记录</button>
                    <button type="button" onClick={() => setDeletingId(null)}>保留记录</button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
