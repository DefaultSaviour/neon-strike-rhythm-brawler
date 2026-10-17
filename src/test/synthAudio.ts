/**
 * Builds fake songs with known beat times so tests can check the analyzer's
 * accuracy. Returns an object shaped like a Web Audio AudioBuffer (the analyzer
 * only uses sampleRate, duration, numberOfChannels and getChannelData).
 */

export interface SynthSong {
  buffer: AudioBuffer;
  kickTimes: number[];
}

/** Deterministic pseudo-random numbers so tests never flake. */
function makeRandom(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function synthesizeSong(opts: { bpm: number; seconds: number; dense: boolean; sampleRate?: number }): SynthSong {
  const sr = opts.sampleRate ?? 44100;
  const n = Math.round(sr * opts.seconds);
  const sig = new Float32Array(n);
  const beat = 60 / opts.bpm;
  const rnd = makeRandom(7);

  if (opts.dense) {
    // Rolling sawtooth bassline on 16th notes plus a noise bed: a busy, loud mix.
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const step = Math.floor(t / (beat / 4));
      const freq = [41.2, 41.2, 82.4, 55][step % 4];
      phase += freq / sr;
      const env = 0.6 + 0.4 * Math.exp(-(t % (beat / 4)) * 20);
      sig[i] = 0.35 * env * (2 * (phase % 1) - 1) + 0.06 * (rnd() * 2 - 1);
    }
  }

  const kickTimes: number[] = [];
  for (let t = 1.5; t < opts.seconds - 1.5; t += beat) {
    kickTimes.push(t);
    // Kick drum: sine with a fast downward pitch sweep and exponential decay.
    const s0 = Math.round(t * sr);
    let p = 0;
    for (let i = 0; i < sr * 0.3 && s0 + i < n; i++) {
      const tt = i / sr;
      const f = 48 + 110 * Math.exp(-tt * 30);
      p += (2 * Math.PI * f) / sr;
      sig[s0 + i] += 0.9 * Math.sin(p) * Math.exp(-tt * 7);
    }
  }

  if (opts.dense) {
    for (let i = 0; i < n; i++) sig[i] = Math.tanh(sig[i] * 1.6); // loud "mastered" sound
  }

  const buffer = {
    sampleRate: sr,
    duration: n / sr,
    length: n,
    numberOfChannels: 1,
    getChannelData: () => sig,
  } as unknown as AudioBuffer;
  return { buffer, kickTimes };
}

/** Signed errors (seconds) from each true time to the nearest detected time, ignoring misses. */
export function matchErrors(truth: number[], detected: number[], maxDist = 0.05): number[] {
  const errs: number[] = [];
  for (const t of truth) {
    let best = Infinity;
    for (const d of detected) if (Math.abs(d - t) < Math.abs(best)) best = d - t;
    if (Math.abs(best) <= maxDist) errs.push(best);
  }
  return errs;
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
