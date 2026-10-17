import { describe, expect, it } from 'vitest';
import { foldIntoOctave, HIT_TONE_FALLBACK_HZ, HIT_TONE_LOW_HZ, peakHzInBand } from './hitTone';

describe('foldIntoOctave', () => {
  it('moves a bass note up by octaves into the tone register', () => {
    expect(foldIntoOctave(55)).toBeCloseTo(440); // A1 -> A4
    expect(foldIntoOctave(49)).toBeCloseTo(392); // G1 -> G4
  });

  it('moves a high note down by octaves', () => {
    expect(foldIntoOctave(3520)).toBeCloseTo(440); // A7 -> A4
  });

  it('keeps the same musical note (only whole octaves)', () => {
    for (const hz of [41.2, 98, 233, 1000, 5000]) {
      const ratio = foldIntoOctave(hz) / hz;
      expect(Math.log2(ratio) % 1).toBeCloseTo(0, 9);
      expect(foldIntoOctave(hz)).toBeGreaterThanOrEqual(HIT_TONE_LOW_HZ);
      expect(foldIntoOctave(hz)).toBeLessThan(HIT_TONE_LOW_HZ * 2);
    }
  });

  it('falls back to A4 for missing or broken pitches', () => {
    expect(foldIntoOctave(0)).toBe(HIT_TONE_FALLBACK_HZ);
    expect(foldIntoOctave(NaN)).toBe(HIT_TONE_FALLBACK_HZ);
  });
});

describe('peakHzInBand', () => {
  /** Real FFT of a windowed sine, computed directly (slow but simple). */
  function spectrumOf(freq: number, sr: number, n: number) {
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let k = 0; k < n / 2; k++) {
      let r = 0;
      let i = 0;
      for (let t = 0; t < n; t++) {
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / (n - 1));
        const x = Math.sin((2 * Math.PI * freq * t) / sr) * w;
        r += x * Math.cos((2 * Math.PI * k * t) / n);
        i -= x * Math.sin((2 * Math.PI * k * t) / n);
      }
      re[k] = r;
      im[k] = i;
    }
    return { re, im, binHz: sr / n };
  }

  it("finds a sine wave's frequency to within 1%, even between FFT bins", () => {
    const { re, im, binHz } = spectrumOf(110, 4000, 512);
    const hz = peakHzInBand(re, im, binHz, 40, 300)!;
    expect(Math.abs(hz - 110) / 110).toBeLessThan(0.01);
  });

  it('only looks inside the requested band', () => {
    const { re, im, binHz } = spectrumOf(110, 4000, 512);
    const hz = peakHzInBand(re, im, binHz, 500, 1500);
    expect(hz === undefined || hz >= 500).toBe(true);
  });
});
