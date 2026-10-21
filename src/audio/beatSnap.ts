/**
 * Snap a chart onto the song's beat.
 *
 * The chart is made from where sounds start. With crisp drums that lands on
 * the beat, but soft sounds (8-bit square-wave bass, chip "kicks") start
 * smeared, so notes land up to ~60ms either side of the real beat, at random.
 * Players hit the beat they hear, so timing feels random: PERFECT is only
 * ±55ms. Rhythm games put notes on the beat grid instead.
 *
 * AI-made songs (Suno) also drift in tempo by a few BPM, so one fixed grid
 * doesn't fit a whole song. So:
 *  1. Follow the beat through the song with a beat tracker (each beat is
 *     placed where the music is loudest, about one beat after the last one,
 *     so it can bend with the tempo).
 *  2. Give each note a slot: the nearest beat, half beat (or quarter beat on
 *     slow songs) by those beats.
 *  3. Fit a smooth curve through the notes around each slot and put the note
 *     on it (a curve, so a drifting tempo fits). That keeps sub-millisecond precision, even though the
 *     tracker only works in 10ms steps.
 */

/**
 * Beat tracker (dynamic programming, after Ellis 2007). `onset` is how
 * strongly sound starts in each frame; `period` is the beat length in frames.
 * Each frame's score is its onset plus the best score of an earlier beat,
 * with a penalty for beats that aren't about one period apart. The best chain
 * of beats is read back from the end. Returns beat frame indices, in order.
 */
export function trackBeatFrames(onset: ArrayLike<number>, period: number, tightness = 100): number[] {
  const n = onset.length;
  if (n === 0 || !(period > 1)) return [];
  // Normalise so the tightness means the same in every song
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    sum += onset[i];
    sumSq += onset[i] * onset[i];
  }
  const sd = Math.sqrt(Math.max(1e-12, sumSq / n - (sum / n) ** 2));

  const score = new Float64Array(n);
  const back = new Int32Array(n).fill(-1);
  const lo = Math.round(period / 2);
  const hi = Math.round(period * 2);
  for (let t = 0; t < n; t++) {
    const local = onset[t] / sd;
    let best = -Infinity;
    let arg = -1;
    for (let prev = t - hi; prev <= t - lo; prev++) {
      if (prev < 0) continue;
      const v = score[prev] - tightness * Math.log((t - prev) / period) ** 2;
      if (v > best) {
        best = v;
        arg = prev;
      }
    }
    score[t] = arg >= 0 ? local + best : local;
    back[t] = arg;
  }

  // Finish on the best-scoring frame in the last period, then follow the chain back
  let end = Math.max(0, n - Math.round(period));
  for (let t = end; t < n; t++) if (score[t] > score[end]) end = t;
  const beats: number[] = [];
  for (let t = end; t >= 0; t = back[t]) beats.push(t);
  return beats.reverse();
}

/**
 * How well the notes sit on the grid traced by `beats`: the share of notes
 * within a quarter of a slot of one. Notes at random spots score about 0.5, so
 * a low score means the grid (usually the tempo) is wrong and snapping onto it
 * would make things worse.
 */
export function gridFit(times: readonly number[], beats: readonly number[], slotsPerBeat: number): number {
  if (beats.length < 4 || times.length === 0) return 0;
  let on = 0;
  let k = 0;
  for (const t of [...times].sort((a, b) => a - b)) {
    while (k < beats.length - 2 && beats[k + 1] <= t) k++;
    const p = (k + (t - beats[k]) / (beats[k + 1] - beats[k])) * slotsPerBeat;
    if (Math.abs(p - Math.round(p)) <= 0.25) on++;
  }
  return on / times.length;
}

/** Below this grid fit the chart is left as it is (see gridFit). */
export const MIN_GRID_FIT = 0.65;

export interface SnapResult {
  /** Each note's time on the grid */
  times: number[];
  /** False for a note that landed in the same slot as an earlier one (drop it) */
  keep: boolean[];
}

/** Notes this many beats either side of a slot shape its local grid line. */
const FIT_BEATS = 16;
const MIN_FIT_NOTES = 6;

/**
 * Put note times on the nearest slot of the beat grid traced by `beats`
 * (seconds, in order). `slotsPerBeat` 2 = eighth notes, 4 = sixteenths.
 */
export function snapToBeats(times: readonly number[], beats: readonly number[], slotsPerBeat: number): SnapResult {
  const keep = times.map(() => true);
  if (beats.length < 4) return { times: [...times], keep };

  // 1. Each note's position in beats (fractional), then its slot.
  const pos = (t: number): number => {
    if (t <= beats[0]) return (t - beats[0]) / (beats[1] - beats[0]);
    const last = beats.length - 1;
    if (t >= beats[last]) return last + (t - beats[last]) / (beats[last] - beats[last - 1]);
    let lo = 0;
    let hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (beats[mid] <= t) lo = mid;
      else hi = mid;
    }
    return lo + (t - beats[lo]) / (beats[lo + 1] - beats[lo]);
  };
  const slot = times.map((t) => Math.round(pos(t) * slotsPerBeat) / slotsPerBeat);

  // Fallback slot time straight from the tracked beats
  const coarse = (q: number): number => {
    const k = Math.max(0, Math.min(beats.length - 2, Math.floor(q)));
    return beats[k] + (q - k) * (beats[k + 1] - beats[k]);
  };

  // 2. A smooth curve (time against slot) through the notes near each slot, refitted once
  //    without notes far off it (off-grid melody notes shouldn't bend it).
  const order = times.map((_, i) => i).sort((a, b) => slot[a] - slot[b]);
  const sortedSlots = order.map((i) => slot[i]);
  const lowerBound = (q: number) => {
    let lo = 0;
    let hi = sortedSlots.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedSlots[mid] < q) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  // A gentle curve (time = a + b·x + c·x², x = slots from here), so a drifting tempo fits too.
  // a is the slot's time; b is the beat length there.
  const fit = (idx: number[], q: number): { a: number; b: number; c: number } | null => {
    if (idx.length < MIN_FIT_NOTES) return null;
    const n = 3;
    const s = [0, 0, 0, 0, 0];
    const r = [0, 0, 0];
    for (const j of idx) {
      const x = slot[j] - q;
      let p = 1;
      for (let d = 0; d < 5; d++, p *= x) s[d] += p;
      r[0] += times[j];
      r[1] += x * times[j];
      r[2] += x * x * times[j];
    }
    // Normal equations, solved by Gaussian elimination
    const m = Array.from({ length: n }, (_, row) => [...s.slice(row, row + n), r[row]]);
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let row = col + 1; row < n; row++) if (Math.abs(m[row][col]) > Math.abs(m[piv][col])) piv = row;
      if (Math.abs(m[piv][col]) < 1e-9) return null;
      [m[col], m[piv]] = [m[piv], m[col]];
      for (let row = 0; row < n; row++) {
        if (row === col) continue;
        const f = m[row][col] / m[col][col];
        for (let k = col; k <= n; k++) m[row][k] -= f * m[col][k];
      }
    }
    return { a: m[0][n] / m[0][0], b: m[1][n] / m[1][1], c: n === 3 ? m[2][n] / m[2][2] : 0 };
  };
  const at = (line: { a: number; b: number; c: number }, x: number) => line.a + line.b * x + line.c * x * x;

  const out = [...times];
  for (let i = 0; i < times.length; i++) {
    const q = slot[i];
    const near = order.slice(lowerBound(q - FIT_BEATS), lowerBound(q + FIT_BEATS + 1e-9));
    const k = Math.max(0, Math.min(beats.length - 2, Math.floor(q)));
    const beatLen = beats[k + 1] - beats[k];
    let line = fit(near, q);
    if (line) {
      const first = line;
      const tol = (0.3 * beatLen) / slotsPerBeat;
      const close = near.filter((j) => Math.abs(times[j] - at(first, slot[j] - q)) <= tol);
      line = fit(close, q) ?? line;
    }
    // Trust the curve only if its beat length is sane next to the tracked beats
    const ok = line && line.b > beatLen * 0.85 && line.b < beatLen * 1.15;
    out[i] = ok ? line!.a : coarse(q);
  }

  // 3. One note per slot
  const seen = new Set<number>();
  for (const i of order) {
    const key = Math.round(slot[i] * slotsPerBeat);
    if (seen.has(key)) keep[i] = false;
    else seen.add(key);
  }
  return { times: out, keep };
}
