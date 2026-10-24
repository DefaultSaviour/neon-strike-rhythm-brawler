/**
 * Song previews on the song select screen: a loop of the song from just
 * before its drop, on the song's beat grid, so the fighter can strike in time.
 *
 * The beat grid comes from the song's chart (the same one the game plays,
 * see beatGrid.gridForNotes), which is exact. The drop is found here, from
 * one loudness envelope: the beat where the next 4 bars get loudest compared
 * with the 4 bars before.
 */

import type { BeatGrid } from './beatGrid';

/** Seconds per envelope frame */
export const PREVIEW_HOP_SEC = 0.02;
/** How long the preview loops, in beats (8 bars) */
export const PREVIEW_BEATS = 32;
/** Beats of build-up played before the drop */
export const LEAD_IN_BEATS = 4;

export interface PreviewPlan {
  /** Song time (s) the preview starts at, on a beat */
  start: number;
  /** Song time (s) of the drop itself */
  drop: number;
  /** Seconds per beat */
  period: number;
  /** Song time (s) the loop wraps at */
  end: number;
}

/** Loudness (RMS of the mono mix) per frame. */
export function energyEnvelope(channels: Float32Array[], sampleRate: number, hopSec = PREVIEW_HOP_SEC): Float32Array {
  const hop = Math.max(1, Math.round(sampleRate * hopSec));
  const length = channels[0]?.length ?? 0;
  const frames = Math.floor(length / hop);
  const env = new Float32Array(frames);
  const n = channels.length || 1;
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const from = f * hop;
    for (let i = from; i < from + hop; i++) {
      let s = 0;
      for (const ch of channels) s += ch[i];
      s /= n;
      sum += s * s;
    }
    env[f] = Math.sqrt(sum / hop);
  }
  return env;
}

function mean(env: Float32Array, from: number, to: number): number {
  const a = Math.max(0, from);
  const b = Math.min(env.length, to);
  if (b <= a) return 0;
  let s = 0;
  for (let i = a; i < b; i++) s += env[i];
  return s / (b - a);
}

/**
 * Plan a preview on the song's beat grid: find the drop (the beat, between
 * 15% and 75% of the song, where the next 4 bars are loudest compared with
 * the 4 bars before) and start one bar before it, looping 8 bars.
 */
export function planPreview(env: Float32Array, hopSec: number, grid: Pick<BeatGrid, 'bpm' | 'offset'>, durationSec: number): PreviewPlan {
  const period = 60 / Math.max(40, Math.min(260, grid.bpm || 120));
  const phase = ((grid.offset % period) + period) % period;
  const loop = PREVIEW_BEATS * period;
  const window = Math.round((16 * period) / hopSec);

  let drop = phase + Math.ceil((durationSec * 0.3 - phase) / period) * period;
  let bestScore = -Infinity;
  for (let t = phase; t < durationSec; t += period) {
    if (t < durationSec * 0.15 || t > durationSec * 0.75) continue;
    const f = Math.round(t / hopSec);
    const score = mean(env, f, f + window) - mean(env, f - window, f);
    if (score > bestScore) {
      bestScore = score;
      drop = t;
    }
  }

  // One bar of build-up first, and never running past the end of the song
  let start = Math.max(phase, drop - LEAD_IN_BEATS * period);
  if (start + loop > durationSec) start = Math.max(phase, start - Math.ceil((start + loop - durationSec) / period) * period);
  return { start, drop, period, end: Math.min(durationSec, start + loop) };
}

/** Which beat of the preview is playing, and how long ago it hit (s). */
export function previewBeatAt(plan: PreviewPlan, songTime: number): { beat: number; since: number } {
  const beat = Math.floor((songTime - plan.start) / plan.period + 1e-6);
  return { beat, since: songTime - (plan.start + beat * plan.period) };
}
