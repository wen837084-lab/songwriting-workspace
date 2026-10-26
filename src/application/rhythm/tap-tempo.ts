export const TAP_SESSION_TIMEOUT_MS = 2_500;
const MAX_TAPS = 8;

export interface TapTempoSession {
  timestamps: number[];
}

export interface TapTempoResult {
  session: TapTempoSession;
  bpm: number | null;
}

export function clampBpm(value: number): number {
  return Math.min(220, Math.max(40, Math.round(value)));
}

export function recordTempoTap(
  session: TapTempoSession,
  timestamp: number,
): TapTempoResult {
  const previous = session.timestamps.at(-1);
  const startsNewSession = previous === undefined ||
    timestamp <= previous ||
    timestamp - previous > TAP_SESSION_TIMEOUT_MS;
  const timestamps = startsNewSession
    ? [timestamp]
    : [...session.timestamps, timestamp].slice(-MAX_TAPS);

  if (timestamps.length < 2) return { session: { timestamps }, bpm: null };

  const elapsed = timestamps.at(-1)! - timestamps[0];
  const averageInterval = elapsed / (timestamps.length - 1);
  return {
    session: { timestamps },
    bpm: clampBpm(60_000 / averageInterval),
  };
}
