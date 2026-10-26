import type { ChordSymbol } from "../../domain/project/project";

const CHORD_FREQUENCIES: Record<ChordSymbol, readonly number[]> = {
  C: [261.63, 329.63, 392.0],
  Cm: [261.63, 311.13, 392.0],
  D: [293.66, 369.99, 440.0],
  Dm: [293.66, 349.23, 440.0],
  E: [329.63, 415.3, 493.88],
  Em: [329.63, 392.0, 493.88],
  F: [349.23, 440.0, 523.25],
  Fm: [349.23, 415.3, 523.25],
  G: [392.0, 493.88, 587.33],
  Gm: [392.0, 466.16, 587.33],
  A: [440.0, 554.37, 659.25],
  Am: [440.0, 523.25, 659.25],
  B: [493.88, 622.25, 739.99],
  Bm: [493.88, 587.33, 739.99],
};

const CHORD_DURATION_SECONDS = 0.85;

export class WebAudioChordPlayer {
  private audioContext: AudioContext | null = null;
  private activeOscillators = new Set<OscillatorNode>();

  async play(chord: ChordSymbol): Promise<void> {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) throw new Error("Web Audio is not supported in this browser.");

    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new AudioContextClass();
    }
    const context = this.audioContext;
    await context.resume();
    this.stopActiveOscillators();

    const startTime = context.currentTime + 0.01;
    const endTime = startTime + CHORD_DURATION_SECONDS;
    const frequencies = CHORD_FREQUENCIES[chord];
    const masterGain = context.createGain();
    masterGain.gain.setValueAtTime(0.0001, startTime);
    masterGain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.035);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, endTime);
    masterGain.connect(context.destination);

    for (const frequency of frequencies) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startTime);
      oscillator.connect(masterGain);
      oscillator.start(startTime);
      oscillator.stop(endTime + 0.03);
      this.activeOscillators.add(oscillator);
      oscillator.addEventListener("ended", () => this.activeOscillators.delete(oscillator), { once: true });
    }
  }

  dispose(): void {
    this.stopActiveOscillators();
    const context = this.audioContext;
    this.audioContext = null;
    if (context) void context.close();
  }

  private stopActiveOscillators(): void {
    for (const oscillator of this.activeOscillators) {
      try {
        oscillator.stop();
      } catch {
        // The oscillator may already have ended naturally.
      }
    }
    this.activeOscillators.clear();
  }
}
