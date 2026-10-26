"use client";

import { useEffect, useRef, useState } from "react";
import { WebAudioMetronome } from "../../application/rhythm/metronome";
import { recordTempoTap, type TapTempoSession } from "../../application/rhythm/tap-tempo";
import {
  TIME_SIGNATURES,
  type SongProject,
  type TimeSignature,
  type UpdateRhythmInput,
} from "../../domain/project/project";
import { createBrowserProjectRepository } from "../../infrastructure/persistence/browser-project-repository";
import { ArchiveMeta, BeatTicks } from "../../components/archive/archive-markup";

interface RhythmWorkspaceProps {
  project: SongProject;
  onProjectChange(project: SongProject): void;
  onError(message: string | null): void;
}

export function RhythmWorkspace({ project, onProjectChange, onError }: RhythmWorkspaceProps) {
  const [manualBpm, setManualBpm] = useState(String(project.rhythm.bpm));
  const [notes, setNotes] = useState(project.rhythm.notes);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const tapSession = useRef<TapTempoSession>({ timestamps: [] });
  const bpmRef = useRef(project.rhythm.bpm);
  const timeSignatureRef = useRef(project.rhythm.timeSignature);
  const metronome = useRef<WebAudioMetronome | null>(null);

  useEffect(() => {
    bpmRef.current = project.rhythm.bpm;
  }, [project.rhythm.bpm]);

  useEffect(() => {
    timeSignatureRef.current = project.rhythm.timeSignature;
  }, [project.rhythm.timeSignature]);

  useEffect(() => () => metronome.current?.stop(), []);

  function saveRhythm(change: UpdateRhythmInput) {
    try {
      const updated = createBrowserProjectRepository().updateRhythm(project.projectId, change);
      onProjectChange(updated);
      onError(null);
      return true;
    } catch (saveError) {
       onError(saveError instanceof Error ? saveError.message : "无法保存节奏设置。");
      return false;
    }
  }

  function applyBpm(value: number) {
    if (!Number.isInteger(value) || value < 40 || value > 220) {
       onError("BPM 必须是 40 到 220 之间的整数。");
      return;
    }
    if (saveRhythm({ bpm: value })) setManualBpm(String(value));
  }

  function submitManualBpm() {
    applyBpm(Number(manualBpm));
  }

  function tapTempo() {
    const result = recordTempoTap(tapSession.current, performance.now());
    tapSession.current = result.session;
    setTapCount(result.session.timestamps.length);
    if (result.bpm !== null) applyBpm(result.bpm);
  }

  async function toggleMetronome() {
    if (isPlaying) {
      metronome.current?.stop();
      metronome.current = null;
      setIsPlaying(false);
      return;
    }
    try {
      const player = new WebAudioMetronome({
        getBpm: () => bpmRef.current,
        getTimeSignature: () => timeSignatureRef.current,
      });
      metronome.current = player;
      await player.start();
      setIsPlaying(true);
      onError(null);
    } catch (audioError) {
      metronome.current?.stop();
      metronome.current = null;
      setIsPlaying(false);
       onError(audioError instanceof Error ? audioError.message : "无法启动节拍器。");
    }
  }

  return (
    <div className="rhythm-workspace">
      <header className="rhythm-header">
        <div className="archive-page-kicker"><ArchiveMeta>RHYTHM / TEMPO NOTES</ArchiveMeta><ArchiveMeta>{project.rhythm.bpm} BPM</ArchiveMeta></div>
        <p className="eyebrow">当前阶段</p>
        <h2 id="current-stage-heading">Rhythm</h2>
        <p>设定一个律动，选择拍号，并记录你自己的节奏备注。</p>
      </header>

      <section className="metronome-panel" aria-labelledby="metronome-heading">
        <div>
          <p className="eyebrow">节拍器</p>
          <h3 id="metronome-heading">{project.rhythm.bpm} BPM · {project.rhythm.timeSignature}</h3>
          <p>每次点击代表一个显示的拍子。每小节的第一拍会加重。</p>
        </div>
        <BeatTicks count={Number(project.rhythm.timeSignature.split("/")[0]) || 4} />
        <button
          type="button"
          className={isPlaying ? "stop-metronome" : "primary-button"}
          aria-pressed={isPlaying}
          onClick={() => void toggleMetronome()}
        >
          {isPlaying ? "停止" : "开始"}
        </button>
      </section>

       <section className="rhythm-controls" aria-label="速度控制">
        <label className="bpm-slider">
           BPM 滑块
          <input
            type="range"
            min="40"
            max="220"
            step="1"
            value={project.rhythm.bpm}
            onChange={(event) => applyBpm(Number(event.target.value))}
          />
          <span><span>40</span><span>220</span></span>
        </label>

        <form className="manual-bpm" onSubmit={(event) => { event.preventDefault(); submitManualBpm(); }}>
          <label>
             手动 BPM
            <input
              type="number"
              min="40"
              max="220"
              step="1"
              inputMode="numeric"
              value={manualBpm}
              onChange={(event) => setManualBpm(event.target.value)}
            />
          </label>
           <button type="submit">设置 BPM</button>
        </form>

        <div className="tap-tempo">
          <div>
             <h3>Tap Tempo / 点击测速</h3>
             <p>至少点击两次。速度会使用最近最多八次点击的平均间隔；暂停超过 2.5 秒会开始新的记录。</p>
          </div>
           <button type="button" onClick={tapTempo}>点击</button>
           <span aria-live="polite">{tapCount ? `${tapCount} 次点击` : "准备好了"}</span>
        </div>
      </section>

      <fieldset className="time-signature-control">
         <legend>拍号</legend>
         <p>选择你想使用的拍子分组。</p>
        <div>
          {TIME_SIGNATURES.map((timeSignature) => (
            <button
              key={timeSignature}
              type="button"
              aria-pressed={project.rhythm.timeSignature === timeSignature}
              className={project.rhythm.timeSignature === timeSignature ? "active" : ""}
              onClick={() => saveRhythm({ timeSignature: timeSignature as TimeSignature })}
            >
              {timeSignature}
            </button>
          ))}
        </div>
      </fieldset>

      <form className="rhythm-notes" onSubmit={(event) => { event.preventDefault(); saveRhythm({ notes }); }}>
        <label>
           节奏备注
          <textarea
            rows={6}
            value={notes}
             placeholder="记录你的发现，或想尝试什么。"
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
         <button className="primary-button" type="submit" disabled={notes.trim() === project.rhythm.notes}>保存备注</button>
      </form>
    </div>
  );
}

export function RhythmContext({ project }: { project: SongProject }) {
  return <p>{project.rhythm.notes ? "这个 Project 已保存节奏备注。" : "还没有保存节奏备注。"} 离开或刷新页面后播放会停止。</p>;
}
