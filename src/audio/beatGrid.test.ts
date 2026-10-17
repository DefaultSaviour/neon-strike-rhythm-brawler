import { describe, expect, it } from 'vitest';
import { beatPulse, fitBeatGrid, gridForNotes } from './beatGrid';

const beatsAt = (bpm: number, offset: number, count: number) =>
  Array.from({ length: count }, (_, i) => offset + (i * 60) / bpm);

describe('fitBeatGrid', () => {
  it('recovers exact tempo and offset from a rough guess', () => {
    const grid = fitBeatGrid(beatsAt(151.3, 0.37, 300), 150);
    expect(grid.bpm).toBeCloseTo(151.3, 1);
    expect(grid.offset).toBeCloseTo(0.37, 2);
    expect(grid.strength).toBeGreaterThan(0.95);
  });

  it('copes with timing jitter and a few off-beat notes', () => {
    const times = beatsAt(128, 0.1, 200).map((t, i) => t + (i % 3 === 0 ? 0.004 : -0.003));
    times.push(5.33, 12.71, 40.05);
    const grid = fitBeatGrid(times, 126);
    expect(grid.bpm).toBeCloseTo(128, 1);
  });

  it('returns the rough tempo unchanged when there is too little data', () => {
    expect(fitBeatGrid([1, 2], 140).bpm).toBe(140);
  });
});

describe('gridForNotes', () => {
  it('fits on kick notes and ignores off-beat bass notes', () => {
    const kicks = beatsAt(140, 0.2, 120).map((time) => ({ time, band: 'sub' }));
    const offbeats = beatsAt(140, 0.2 + 30 / 140, 120).map((time) => ({ time, band: 'bass' }));
    const grid = gridForNotes([...kicks, ...offbeats], 139);
    expect(grid.offset).toBeCloseTo(0.2, 2);
  });
});

describe('beatPulse', () => {
  it('peaks on the beat and fades before the next one', () => {
    const grid = { bpm: 120, offset: 0 };
    expect(beatPulse(1.0, grid)).toBeCloseTo(1);
    expect(beatPulse(1.25, grid)).toBeLessThan(0.1);
  });
});
