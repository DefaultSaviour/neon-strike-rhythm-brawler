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
