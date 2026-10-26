"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  MELODY_TAKE_STATUSES,
  type MelodyTake,
  type MelodyTakeStatus,
  type SongProject,
} from "../../domain/project/project";
import {
  createBrowserMelodyService,
  createBrowserProjectRepository,
} from "../../infrastructure/persistence/browser-project-repository";
import { recordingErrorMessage } from "../../application/melody/recording-errors";
import { ArchiveMeta, MarginNote, RecordStamp, StaffFragment } from "../../components/archive/archive-markup";

interface MelodyWorkspaceProps {
  project: SongProject;
  onProjectChange: (project: SongProject) => void;
  onError: (message: string | null) => void;
}

const STATUS_LABELS: Record<MelodyTakeStatus, string> = {
  "keep-exploring": "继续探索",
  interesting: "有意思",
  "return-later": "之后再看",
};

function TakeCard({ projectId, take, takeNumber, selected, onChanged, onError }: {
  projectId: string;
  take: MelodyTake;
  takeNumber: number;
  selected: boolean;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const [name, setName] = useState(take.name);
  const [notes, setNotes] = useState(take.notes);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      createBrowserMelodyService().updateTake(projectId, take.takeId, { name, notes });
      onChanged();
      onError(null);
    } catch (error) {
      onError(recordingErrorMessage(error));
    }
  }

  function changeStatus(status: MelodyTakeStatus) {
    try {
      createBrowserMelodyService().updateTake(projectId, take.takeId, { status });
      onChanged();
      onError(null);
    } catch (error) {
      onError(recordingErrorMessage(error));
    }
  }

  function changeVersionSelection(selected: boolean) {
    try {
      createBrowserProjectRepository().setMelodyTakeSelected(projectId, take.takeId, selected);
      onChanged();
      onError(null);
    } catch (error) {
      onError(recordingErrorMessage(error));
    }
  }

  async function preparePlayback() {
    setIsLoadingAudio(true);
    try {
      const blob = await createBrowserMelodyService().loadAudio(projectId, take.takeId);
      setAudioUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(blob);
      });
      onError(null);
    } catch (error) {
      onError(recordingErrorMessage(error));
    } finally {
      setIsLoadingAudio(false);
    }
  }

  async function deleteTake() {
    try {
      await createBrowserMelodyService().deleteTake(projectId, take.takeId);
      onChanged();
      onError(null);
    } catch (error) {
      onError(recordingErrorMessage(error));
    }
  }

  const isDirty = name !== take.name || notes !== take.notes;
  const recordingCode = `REC_${take.takeId.slice(-4).toUpperCase()}`;
  const duration = take.durationMs === null ? "DURATION —" : `${Math.floor(take.durationMs / 60000)}:${String(Math.floor((take.durationMs % 60000) / 1000)).padStart(2, "0")}`;
  const createdLabel = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(new Date(take.createdAt)).toUpperCase();
  return (
    <article className="melody-take-card voice-note-entry">
      <header className="take-archive-header">
        <div>
          <RecordStamp>{recordingCode}</RecordStamp>
          <h4>{take.name}</h4>
          <ArchiveMeta>{createdLabel} UTC · TAKE {String(takeNumber).padStart(2, "0")}</ArchiveMeta>
        </div>
        <div className="take-archive-duration">
          <strong>{duration}</strong>
          <span>{selected ? "IN VERSION" : "VOICE MEMO"}</span>
        </div>
      </header>
      <form onSubmit={save}>
        <label>
          Take 名称
          <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Take 备注 <span className="optional">可选</span>
          <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="记录你的发现，或想在下一步尝试什么。" />
        </label>
        <button type="submit" disabled={!isDirty}>保存名称和备注</button>
      </form>

      <fieldset className="take-status">
        <legend>状态</legend>
        {MELODY_TAKE_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className={take.status === status ? "active" : ""}
            aria-pressed={take.status === status}
            onClick={() => changeStatus(status)}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </fieldset>

      <label className="version-take-selection">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => changeVersionSelection(event.target.checked)}
        />
        将这个 Take 加入已保存 Version 的选择
      </label>

      <div className="take-playback">
        {audioUrl ? (
          <audio controls preload="metadata" src={audioUrl} aria-label={`播放 ${take.name}`} />
        ) : (
          <button type="button" disabled={isLoadingAudio} onClick={() => void preparePlayback()}>
            {isLoadingAudio ? "正在加载录音…" : "加载播放"}
          </button>
        )}
      </div>

      <MarginNote>{take.notes || "没有 Take 备注"}</MarginNote>

      {confirmDelete ? (
        <div className="take-delete-confirmation">
           <span>确定删除这个 Take 及其录音吗？</span>
           <button className="danger-button" type="button" onClick={() => void deleteTake()}>确认删除</button>
           <button type="button" onClick={() => setConfirmDelete(false)}>取消</button>
        </div>
      ) : (
         <button className="danger-button" type="button" onClick={() => setConfirmDelete(true)}>删除 Take</button>
      )}
    </article>
  );
}

export function MelodyWorkspace({ project, onProjectChange, onError }: MelodyWorkspaceProps) {
  const [sectionId, setSectionId] = useState(project.lyrics.sections[0]?.sectionId ?? "");
  const [sectionNotes, setSectionNotes] = useState(
    sectionId ? project.melody.notesBySection[sectionId] ?? "" : "",
  );
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const recordingFailedRef = useRef(false);

  const activeSection = project.lyrics.sections.find((section) => section.sectionId === sectionId) ?? null;
  const takes = project.melody.takes.filter((take) => take.sectionId === sectionId);
  const supportsRecording = typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        setRecordingSeconds(Math.floor((performance.now() - startedAtRef.current) / 1000));
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => () => {
    recordingFailedRef.current = true;
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function reloadProject() {
    const updated = createBrowserProjectRepository().get(project.projectId);
     if (!updated) throw new Error("项目无法重新加载。");
    onProjectChange(updated);
  }

  async function startRecording() {
    if (!activeSection || !supportsRecording) {
      onError("此浏览器不支持语音备忘录录音。你的项目没有改变。");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recordingFailedRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        recordingFailedRef.current = true;
        onError("录音失败。没有保存 Take，你的项目数据没有改变。");
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.onstop = async () => {
        const durationMs = startedAtRef.current === null ? null : performance.now() - startedAtRef.current;
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        startedAtRef.current = null;
        setIsRecording(false);
        if (recordingFailedRef.current) return;
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          await createBrowserMelodyService().createTake(project.projectId, activeSection.sectionId, blob, durationMs);
          reloadProject();
          onError(null);
        } catch (error) {
          onError(recordingErrorMessage(error));
        }
      };
      streamRef.current = stream;
      recorderRef.current = recorder;
      startedAtRef.current = performance.now();
      setRecordingSeconds(0);
      recorder.start();
      setIsRecording(true);
      onError(null);
    } catch (error) {
      onError(recordingErrorMessage(error));
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  }

  function saveSectionNotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSection) return;
    try {
      const updated = createBrowserMelodyService().setSectionNotes(
        project.projectId,
        activeSection.sectionId,
        sectionNotes,
      );
      onProjectChange(updated);
      onError(null);
    } catch (error) {
      onError(recordingErrorMessage(error));
    }
  }

  return (
    <div className="melody-workspace">
      <header className="melody-header">
        <div className="archive-page-kicker"><ArchiveMeta>MELODY / VOICE MEMOS</ArchiveMeta><ArchiveMeta>TAKES / {String(project.melody.takes.length).padStart(2, "0")}</ArchiveMeta></div>
        <p className="eyebrow">当前阶段</p>
        <h2 id="current-stage-heading">Melody Workspace / 旋律工作区</h2>
        <p>录下你自己的语音备忘录，回听并继续探索。工作区不会分析或排序 Takes。</p>
      </header>

      {project.lyrics.sections.length === 0 ? (
        <div className="melody-empty">
           <p>请先在 Lyrics 中添加一个歌曲 Section，再开始录音。每个 Take 都必须属于一个 Section。</p>
        </div>
      ) : (
        <>
          <label className="melody-section-picker">
            Section
            <select
              value={sectionId}
              disabled={isRecording}
              onChange={(event) => {
                const nextSectionId = event.target.value;
                setSectionId(nextSectionId);
                setSectionNotes(project.melody.notesBySection[nextSectionId] ?? "");
              }}
            >
              {project.lyrics.sections.map((section) => (
                <option key={section.sectionId} value={section.sectionId}>{section.name}</option>
              ))}
            </select>
          </label>

          <section className="recorder-panel" aria-labelledby="voice-memo-heading">
            <div>
              <RecordStamp tone={isRecording ? "pink" : "blue"}>{isRecording ? "REC" : "READY"}</RecordStamp>
              <p className="eyebrow">{activeSection?.name}</p>
              <h3 id="voice-memo-heading">语音备忘录</h3>
              <p>{isRecording ? `录音中 ${recordingSeconds}s` : "一次录下一个想法。你可以保留多个 Take。"}</p>
            </div>
            <StaffFragment />
            {isRecording ? (
              <button className="stop-recording" type="button" onClick={stopRecording}>停止</button>
            ) : (
              <button className="primary-button" type="button" disabled={!supportsRecording} onClick={() => void startRecording()}>录音</button>
            )}
          </section>
          {!supportsRecording ? (
            <p className="recording-support-error" role="status">此浏览器不支持麦克风录音。已有 Takes 仍可播放。</p>
          ) : null}

          <form className="melody-section-notes" onSubmit={saveSectionNotes}>
            <label>
              Section 旋律备注 <span className="optional">可选</span>
              <textarea rows={3} value={sectionNotes} onChange={(event) => setSectionNotes(event.target.value)} placeholder="记录你对这个 Section 的观察，或下一个实验。" />
            </label>
            <button type="submit" disabled={sectionNotes.trim() === (project.melody.notesBySection[sectionId] ?? "")}>保存 Section 备注</button>
          </form>

          <section className="melody-takes" aria-labelledby="takes-heading">
            <div className="melody-takes-heading">
              <h3 id="takes-heading">Takes</h3>
              <span>{takes.length}</span>
            </div>
            {takes.length === 0 ? <p className="melody-empty">这个 Section 还没有录制 Take。</p> : null}
            {takes.map((take, index) => (
              <TakeCard
                key={take.takeId}
                projectId={project.projectId}
                take={take}
                takeNumber={index + 1}
                selected={project.melody.selectedTakeIds.includes(take.takeId)}
                onChanged={reloadProject}
                onError={onError}
              />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

export function MelodyContext({ project }: { project: SongProject }) {
  return (
    <div className="lyrics-context">
       <p>共有 {project.melody.takes.length} 个 Take，分布在 {project.lyrics.sections.length} 个 Section 中。</p>
       <p>每个 Take 都是你的录音。工作区不会选择或排序任何 Take。</p>
    </div>
  );
}
