import { describe, expect, it } from 'vitest';
import { gridFit, MIN_GRID_FIT, snapToBeats, trackBeatFrames } from './beatSnap';

/** Deterministic pseudo-random numbers so tests never flake. */
function makeRandom(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** True beat times for a song whose tempo drifts from 140 to 148 BPM and back (like a Suno song). */
function driftingBeats(seconds: number): number[] {
  const beats: number[] = [];
  let t = 1;
  while (t < seconds) {
    beats.push(t);
    const bpm = 144 + 4 * Math.sin((2 * Math.PI * t) / 40);
    t += 60 / bpm;
  }
  return beats;
}

describe('following the beat through a song', () => {
  it('finds every beat of a drifting tempo from a noisy onset curve', () => {
    const truth = driftingBeats(60);
    const frameDt = 0.01;
    const n = Math.round(62 / frameDt);
    const rnd = makeRandom(3);
    const onset = new Float32Array(n);
    for (let i = 0; i < n; i++) onset[i] = rnd() * 0.3; // background noise
    for (const b of truth) {
      const f = Math.round(b / frameDt);
      onset[f] += 1;
      onset[f + 1] += 0.4;
    }
    // Some beats are quiet (a break) and there are loud off-beat blips
    for (let k = 20; k < 26; k++) onset[Math.round(truth[k] / frameDt)] -= 0.9;
    for (let k = 40; k < 60; k += 3) onset[Math.round(((truth[k] + truth[k + 1]) / 2) / frameDt)] += 0.6;

    const beats = trackBeatFrames(onset, 60 / 144 / frameDt).map((f) => f * frameDt);
    let matched = 0;
    for (const t of truth) if (beats.some((b) => Math.abs(b - t) <= 0.02)) matched++;
    expect(matched).toBeGreaterThan(truth.length * 0.95);
  });
});

describe('snapping a chart onto the beat', () => {
  const truth = driftingBeats(90);
  // Coarse tracked beats: right to within 10ms steps
  const tracked = truth.map((t) => Math.round(t * 100) / 100);
  // Every beat and every other eighth, each smeared by up to ±60ms (soft 8-bit sounds)
  const rnd = makeRandom(11);
  const realTimes: number[] = [];
  for (let k = 0; k < truth.length - 1; k++) {
    realTimes.push(truth[k]);
    if (k % 2 === 0) realTimes.push((truth[k] + truth[k + 1]) / 2);
  }
  const charted = realTimes.map((t) => t + (rnd() * 2 - 1) * 0.06);

  it('pulls every note back close to its beat or half beat', () => {
    const { times, keep } = snapToBeats(charted, tracked, 2);
    expect(keep.every(Boolean)).toBe(true);
    const sorted = (xs: number[]) => xs.sort((x, y) => x - y);
    const before = sorted(charted.map((t, i) => Math.abs(t - realTimes[i])));
    const after = sorted(times.map((t, i) => Math.abs(t - realTimes[i])));
    const median = (xs: number[]) => xs[Math.floor(xs.length / 2)];
    // The smear averages out: typical error drops about 4x
    // (±60ms of even smear is harsher than real songs; averaging can't remove all of it)
    expect(median(before)).toBeGreaterThan(0.025);
    expect(median(after)).toBeLessThan(0.012);
    expect(after[Math.floor(after.length * 0.95)]).toBeLessThan(0.03);
    expect(after[after.length - 1]).toBeLessThan(0.045);
  });

  it('keeps notes already exactly on the beat where they are', () => {
    const { times } = snapToBeats(realTimes, tracked, 2);
    times.forEach((t, i) => expect(Math.abs(t - realTimes[i])).toBeLessThan(0.002));
  });

  it('drops a second note that lands in the same slot', () => {
    const { keep } = snapToBeats([truth[10], truth[10] + 0.03, truth[12]], tracked, 2);
    expect(keep).toEqual([true, false, true]);
  });

  it('can tell a grid that fits the notes from one at the wrong tempo', () => {
    const notes = charted.map((t) => t); // smeared, but on this song's beats
    expect(gridFit(notes, tracked, 2)).toBeGreaterThan(MIN_GRID_FIT);
    // The same notes against beats at 2/3 of the tempo (a common mistake with swung beats)
    const slow = tracked.filter((_, k) => k % 3 === 0).flatMap((t, i, a) => (i + 1 < a.length ? [t, t + (a[i + 1] - t) / 2] : [t]));
    expect(gridFit(notes, slow, 2)).toBeLessThan(MIN_GRID_FIT);
  });

  it('leaves the chart alone when there are too few beats to go by', () => {
    const { times, keep } = snapToBeats([1.01, 2.02], [1, 1.5], 2);
    expect(times).toEqual([1.01, 2.02]);
    expect(keep).toEqual([true, true]);
  });
});
