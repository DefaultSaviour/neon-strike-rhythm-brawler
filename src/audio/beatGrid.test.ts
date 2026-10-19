import { describe, expect, it } from 'vitest';
import { extraNoteFilter } from './audioEngine';
import { beatPulse, fitBeatGrid, gridForNotes, onEighthNote } from './beatGrid';

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

describe('gridForNotes with double-time kicks', () => {
  it('finds the grid when the kicks land on every half beat (they cancel out on a one-beat fit)', () => {
    // A 103.5 BPM song with a kick on every eighth note, guessed at 104
    const kicks = beatsAt(207, 0.3, 300).map((time) => ({ time, band: 'sub' }));
    const grid = gridForNotes(kicks, 104, 0.01);
    expect(grid.bpm).toBeCloseTo(103.5, 1);
    expect(grid.strength).toBeGreaterThan(0.9);
    // Every kick sits on a beat or exactly halfway between two
    for (const k of kicks) expect(onEighthNote(k.time, grid, 0.01)).toBe(true);
  });

  it('leaves an ordinary one-kick-per-beat song alone', () => {
    const kicks = beatsAt(128, 0.1, 200).map((time) => ({ time, band: 'sub' }));
    expect(gridForNotes(kicks, 128).bpm).toBeCloseTo(128, 1);
  });
});

describe('onEighthNote', () => {
  it('accepts beats and half beats, and rejects points in between', () => {
    const grid = { bpm: 120, offset: 0 }; // a beat every 0.5 s, eighths every 0.25 s
    expect(onEighthNote(1.0, grid, 0.03)).toBe(true);
    expect(onEighthNote(1.25, grid, 0.03)).toBe(true);
    expect(onEighthNote(1.27, grid, 0.03)).toBe(true);
    expect(onEighthNote(1.125, grid, 0.03)).toBe(false);
    expect(onEighthNote(1.36, grid, 0.03)).toBe(false);
  });
});

describe('beatPulse', () => {
  it('peaks on the beat and fades before the next one', () => {
    const grid = { bpm: 120, offset: 0 };
    expect(beatPulse(1.0, grid)).toBeCloseTo(1);
    expect(beatPulse(1.25, grid)).toBeLessThan(0.1);
  });
});

describe('extraNoteFilter (fair charts for slow songs)', () => {
  // A slow song has room between its beats; before this, a rolling bassline
  // filled it with notes at random points (the 104 BPM song had more notes per
  // second than the 200 BPM one). Extras in slow songs now stay on eighth notes.
  it('a slow song with a clear grid keeps extra notes on eighth notes only', () => {
    const keep = extraNoteFilter({ bpm: 100, offset: 0, strength: 0.6 }); // eighths every 0.3 s
    expect(keep(0.3)).toBe(true);
    expect(keep(0.62)).toBe(true);
    expect(keep(0.15)).toBe(false);
    expect(keep(0.42)).toBe(false);
  });

  it('fast songs keep their charts as they were', () => {
    const keep = extraNoteFilter({ bpm: 150, offset: 0, strength: 0.9 });
    expect([0.05, 0.13, 0.27, 0.33].every(keep)).toBe(true);
  });

  it('a song with no clear grid is left alone rather than guessed at', () => {
    const keep = extraNoteFilter({ bpm: 100, offset: 0, strength: 0.1 });
    expect([0.15, 0.42].every(keep)).toBe(true);
  });
});
