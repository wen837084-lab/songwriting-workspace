import type { TimeSignature } from "../../domain/project/project";

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;
const START_DELAY_SECONDS = 0.05;

export interface MetronomeSettings {
  getBpm(): number;
  getTimeSignature(): TimeSignature;
}

function beatsPerBar(timeSignature: TimeSignature): number {
  return Number(timeSignature.split("/")[0]);
}

export class WebAudioMetronome {
  private audioContext: AudioContext | null = null;
  private timerId: number | null = null;
  private nextBeatTime = 0;
  private beatIndex = 0;
  private scheduledOscillators = new Set<OscillatorNode>();

  constructor(private readonly settings: MetronomeSettings) {}

  async start(): Promise<void> {
    if (this.timerId !== null) return;
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) throw new Error("Web Audio is not supported in this browser.");
    const context = new AudioContextClass();
    this.audioContext = context;
    await context.resume();
    this.beatIndex = 0;
    this.nextBeatTime = context.currentTime + START_DELAY_SECONDS;
    this.scheduleWindow();
    this.timerId = window.setInterval(() => this.scheduleWindow(), LOOKAHEAD_MS);
  }

  stop(): void {
    if (this.timerId !== null) window.clearInterval(this.timerId);
    this.timerId = null;
    for (const oscillator of this.scheduledOscillators) {
      try { oscillator.stop(); } catch { /* already stopped */ }
    }
    this.scheduledOscillators.clear();
    const context = this.audioContext;
    this.audioContext = null;
    if (context) void context.close();
    this.beatIndex = 0;
  }

  private scheduleWindow(): void {
    const context = this.audioContext;
    if (!context) return;
    while (this.nextBeatTime < context.currentTime + SCHEDULE_AHEAD_SECONDS) {
      this.scheduleClick(context, this.nextBeatTime, this.beatIndex === 0);
      this.beatIndex = (this.beatIndex + 1) % beatsPerBar(this.settings.getTimeSignature());
      this.nextBeatTime += 60 / this.settings.getBpm();
    }
  }

  private scheduleClick(context: AudioContext, time: number, accented: boolean): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = accented ? 1_100 : 760;
    gain.gain.setValueAtTime(accented ? 0.32 : 0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.04);
    this.scheduledOscillators.add(oscillator);
    oscillator.addEventListener("ended", () => this.scheduledOscillators.delete(oscillator), { once: true });
  }
}
