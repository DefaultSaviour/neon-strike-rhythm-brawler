/**
 * Works out "where in the song is the player HEARING right now?".
 *
 * Why this exists: `AudioContext.currentTime` is the time of the audio the
 * browser is *processing*, not the audio coming out of the speakers. The sound
 * reaches the player's ears later (the "output latency"): ~10-50ms on normal
 * speakers, 150ms+ on Bluetooth. If the game uses `currentTime` directly, the
 * enemies arrive on screen before the beat is heard, and players who hit on
 * the sound get judged late.
 */

export interface ClockReadings {
  /** AudioContext.currentTime (seconds) */
  contextTime: number;
  /** The context time at which the song's first sample was scheduled to play */
  songStartContextTime: number;
  /** AudioContext.outputLatency + baseLatency, in seconds (0 if unknown) */
  outputLatency: number;
  /**
   * AudioContext.getOutputTimestamp(): the context time of the sample leaving
   * the speakers at `performanceTime`. Optional because not every browser has it.
   */
  outputStamp?: { contextTime?: number; performanceTime?: number };
  /** performance.now() right now (ms) */
  perfNow: number;
}

/** Largest disagreement (s) we accept between the two ways of measuring before distrusting the timestamp. */
const MAX_STAMP_DISAGREEMENT = 0.25;

/** Song position (seconds) that the player is hearing right now. Never negative. */
export function computeHeardSongTime(r: ClockReadings): number {
  // Method 1 (always available): processing time minus the reported latency.
  const fallbackHeard = r.contextTime - Math.max(0, r.outputLatency);
  let heard = fallbackHeard;

  // Method 2 (smoother, more precise): the browser's own output timestamp,
  // advanced by however long ago it was taken.
  const stamp = r.outputStamp;
  if (stamp && stamp.contextTime && stamp.performanceTime) {
    const fromStamp = stamp.contextTime + (r.perfNow - stamp.performanceTime) / 1000;
    // Sanity checks: you can't hear audio that hasn't been processed yet, and
    // a wildly different answer means the timestamp is stale or broken.
    if (fromStamp <= r.contextTime + 0.001 && Math.abs(fromStamp - fallbackHeard) < MAX_STAMP_DISAGREEMENT) {
      heard = fromStamp;
    }
  }

  return Math.max(0, heard - r.songStartContextTime);
}

/**
 * Convert an input event's timestamp into song time.
 *
 * Key/pointer events carry `event.timeStamp` (same clock as performance.now()).
 * By the time our handler runs, a few ms may have passed (React work, a busy
 * frame). Subtracting that delay judges the press at the moment it happened.
 */
export function songTimeAtEvent(songTimeNow: number, perfNow: number, eventTimeStamp?: number): number {
  if (eventTimeStamp === undefined) return songTimeNow;
  const lagMs = perfNow - eventTimeStamp;
  // Ignore nonsense (0, future, or very old stamps from odd browsers/synthetic events).
  if (!(lagMs > 0 && lagMs < 200)) return songTimeNow;
  return songTimeNow - lagMs / 1000;
}
