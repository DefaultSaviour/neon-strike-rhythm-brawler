import { describe, expect, it } from 'vitest';
import { audioEngine } from './audioEngine';
import { matchErrors, median, synthesizeSong } from '../test/synthAudio';

// These tests chart fake songs whose kick times we know exactly, then check
// the chart lands on the real sound. Before the lag fix the detector was
// 13-19ms late; players feel that as "the beat is off".
describe('beat detection timing accuracy', () => {
  for (const bpm of [128, 150, 175]) {
    it(`charts kicks within 5ms of the real sound in a dense mix at ${bpm} BPM`, () => {
      const song = synthesizeSong({ bpm, seconds: 20, dense: true });
      const { notes } = audioEngine.analyzeAudioBuffer(song.buffer);
      const errs = matchErrors(song.kickTimes, notes.map((n) => n.time));

      expect(errs.length).toBeGreaterThan(song.kickTimes.length * 0.9);
      expect(Math.abs(median(errs))).toBeLessThan(0.005);
    });
  }

  it('charts clean kicks within 5ms and finds the right tempo', () => {
    const song = synthesizeSong({ bpm: 132, seconds: 20, dense: false });
    const { notes, bpm } = audioEngine.analyzeAudioBuffer(song.buffer);
    const errs = matchErrors(song.kickTimes, notes.map((n) => n.time));

    expect(Math.abs(median(errs))).toBeLessThan(0.005);
    expect(bpm).toBeCloseTo(132, 0);
  });
});

// An imported song can be mostly silence between hits. The detector scales each band by its
// 95th percentile, which is zero when the band is silent 95% of the time: then every faint
// bump of noise would count as a huge hit and become an enemy.
describe('sparse songs', () => {
  it('charts only the kicks when they are far apart in near-silence', () => {
    const sr = 44100;
    const sig = new Float32Array(sr * 24);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let i = 0; i < sig.length; i++) sig[i] = 0.002 * rnd(); // a faint hiss
    const kicks: number[] = [];
    for (let t = 2; t < 22; t += 2.5) {
      kicks.push(t);
      const s0 = Math.round(t * sr);
      let p = 0;
      for (let i = 0; i < sr * 0.2; i++) {
        const tt = i / sr;
        p += (2 * Math.PI * (48 + 110 * Math.exp(-tt * 30))) / sr;
        sig[s0 + i] += 0.9 * Math.sin(p) * Math.exp(-tt * 9);
      }
    }
    const buffer = { sampleRate: sr, duration: sig.length / sr, length: sig.length, numberOfChannels: 1, getChannelData: () => sig } as unknown as AudioBuffer;
    const { notes } = audioEngine.analyzeAudioBuffer(buffer);

    expect(matchErrors(kicks, notes.map((n) => n.time)).length).toBe(kicks.length);
    expect(notes.length).toBeLessThanOrEqual(kicks.length + 1);
  });
});

