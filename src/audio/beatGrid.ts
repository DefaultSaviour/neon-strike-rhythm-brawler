/**
 * Beat grid fitting: find the song's exact tempo and where its beats fall.
 *
 * The detector's tempo is only accurate to ~±2 BPM (it works in 10ms steps).
 * That's fine for charting, but any animation that "bounces on the beat"
 * drifts out of time within a few bars. Here we refine it using the note
 * times themselves.
 *
 * Idea: treat each note time as an angle on a clock whose one full turn is one
 * beat. If the tempo is right, notes on the beat all point the same way, and
 * their average direction is long. If it's wrong, they smear around the clock
 * and cancel out. We try tempos near the rough guess and keep the one where
 * notes line up best. The direction they point gives the beat offset.
 */

export interface BeatGrid {
  bpm: number;
  /** Time (s) of a beat; every beat is at offset + k * 60/bpm */
  offset: number;
  /** 0..1: how strongly the notes agree with this grid (1 = perfectly on grid) */
  strength: number;
}

function alignment(times: readonly number[], beatSec: number): { strength: number; angle: number } {
  let sx = 0;
  let sy = 0;
  for (const t of times) {
    const a = (2 * Math.PI * t) / beatSec;
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  return { strength: Math.hypot(sx, sy) / Math.max(1, times.length), angle: Math.atan2(sy, sx) };
}

export function fitBeatGrid(times: readonly number[], roughBpm: number, searchFraction = 0.035): BeatGrid {
  if (times.length < 4 || !(roughBpm > 0)) {
    return { bpm: roughBpm, offset: 0, strength: 0 };
  }

  let bestBpm = roughBpm;
  let best = alignment(times, 60 / roughBpm);
  const lo = roughBpm * (1 - searchFraction);
  const hi = roughBpm * (1 + searchFraction);

  // Coarse sweep, then a fine sweep around the winner.
  for (const stepBpm of [0.05, 0.005]) {
    const start = stepBpm === 0.05 ? lo : bestBpm - 0.05;
    const end = stepBpm === 0.05 ? hi : bestBpm + 0.05;
    for (let bpm = start; bpm <= end; bpm += stepBpm) {
      const a = alignment(times, 60 / bpm);
      if (a.strength > best.strength) {
        best = a;
        bestBpm = bpm;
      }
    }
  }

  const beatSec = 60 / bestBpm;
  let offset = (best.angle / (2 * Math.PI)) * beatSec;
  offset = ((offset % beatSec) + beatSec) % beatSec;
  return { bpm: Math.round(bestBpm * 100) / 100, offset, strength: best.strength };
}

/** Continuous beat counter: 0 at the grid offset, 1 a beat later, etc. */
export function beatPosition(songTime: number, grid: Pick<BeatGrid, 'bpm' | 'offset'>): number {
  return ((songTime - grid.offset) * grid.bpm) / 60;
}

/**
 * Pulse that spikes to 1 exactly on each beat and decays before the next.
 * `sharpness` controls how quickly it fades (higher = snappier).
 */
export function beatPulse(songTime: number, grid: Pick<BeatGrid, 'bpm' | 'offset'>, sharpness = 6): number {
  const pos = beatPosition(songTime, grid);
  const frac = pos - Math.floor(pos);
  return Math.exp(-frac * sharpness);
}

/**
 * Fit a grid to a chart. Kick ("sub") notes sit on the beat in almost all
 * dance music, so we prefer them; off-beat notes would blur the fit.
 */
export function gridForNotes(
  notes: ReadonlyArray<{ time: number; band?: string }>,
  roughBpm: number,
  searchFraction?: number
): BeatGrid {
  const kicks = notes.filter((n) => n.band === 'sub').map((n) => n.time);
  const times = kicks.length >= 16 ? kicks : notes.map((n) => n.time);
  return fitBeatGrid(times, roughBpm, searchFraction);
}
