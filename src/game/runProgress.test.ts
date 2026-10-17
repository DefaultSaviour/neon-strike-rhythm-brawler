import { describe, expect, it } from 'vitest';
import {
  dashDuration,
  formatSongTime,
  KeyValueStore,
  loadBestProgress,
  progressFraction,
  recordRunProgress,
  runnerPositionAt,
} from './runProgress';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('progressFraction', () => {
  it('is the share of the song reached', () => {
    expect(progressFraction(84, 190, false)).toBeCloseTo(0.4421, 3);
  });

  it('counts a cleared song as 100%, and clamps odd values', () => {
    expect(progressFraction(10, 190, true)).toBe(1);
    expect(progressFraction(500, 190, false)).toBe(1);
    expect(progressFraction(-3, 190, false)).toBe(0);
    expect(progressFraction(30, 0, false)).toBe(0);
  });
});

describe('recordRunProgress (best attempt)', () => {
  it('first attempt is a new best, with no previous best', () => {
    const store = memoryStore();
    const r = recordRunProgress('song', 60, 200, false, store);
    expect(r).toMatchObject({ fraction: 0.3, previousBest: null, isNewBest: true });
    expect(loadBestProgress('song', store)).toBeCloseTo(0.3);
  });

  it('a shorter run keeps the old best', () => {
    const store = memoryStore();
    recordRunProgress('song', 100, 200, false, store);
    const r = recordRunProgress('song', 40, 200, false, store);
    expect(r).toMatchObject({ isNewBest: false, previousBest: 0.5 });
    expect(loadBestProgress('song', store)).toBeCloseTo(0.5);
  });

  it('a longer run replaces the best', () => {
    const store = memoryStore();
    recordRunProgress('song', 100, 200, false, store);
    const r = recordRunProgress('song', 150, 200, false, store);
    expect(r).toMatchObject({ isNewBest: true, previousBest: 0.5 });
    expect(loadBestProgress('song', store)).toBeCloseTo(0.75);
  });

  it('keeps each song separate', () => {
    const store = memoryStore();
    recordRunProgress('a', 100, 200, false, store);
    expect(loadBestProgress('b', store)).toBeNull();
  });

  it('copes with missing or broken storage', () => {
    expect(recordRunProgress('song', 50, 100, false, undefined).fraction).toBe(0.5);
    const broken = memoryStore();
    broken.data.set('neon_strike_best_progress_v1', '{not json');
    expect(loadBestProgress('song', broken)).toBeNull();
    const throwing: KeyValueStore = { getItem: () => null, setItem: () => { throw new Error('full'); } };
    expect(recordRunProgress('song', 50, 100, false, throwing).isNewBest).toBe(true);
  });
});

describe('runner animation', () => {
  it('starts at 0 and ends exactly at the target', () => {
    expect(runnerPositionAt(0, 0.44)).toBe(0);
    expect(runnerPositionAt(dashDuration(0.44), 0.44)).toBeCloseTo(0.44);
    expect(runnerPositionAt(99, 0.44)).toBeCloseTo(0.44);
  });

  it('slows down as it nears the end (covers most ground early)', () => {
    const d = dashDuration(1);
    expect(runnerPositionAt(d / 2, 1)).toBeGreaterThan(0.8);
  });

  it('never runs backwards', () => {
    let last = -1;
    for (let t = 0; t <= 2; t += 0.05) {
      const x = runnerPositionAt(t, 0.7);
      expect(x).toBeGreaterThanOrEqual(last);
      last = x;
    }
  });
});

describe('formatSongTime', () => {
  it('formats as m:ss', () => {
    expect(formatSongTime(84.7)).toBe('1:24');
    expect(formatSongTime(190)).toBe('3:10');
    expect(formatSongTime(5)).toBe('0:05');
  });
});
