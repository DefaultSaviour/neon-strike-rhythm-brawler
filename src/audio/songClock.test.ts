import { describe, expect, it } from 'vitest';
import { computeHeardSongTime, songTimeAtEvent } from './songClock';

describe('computeHeardSongTime', () => {
  const base = { contextTime: 10, songStartContextTime: 2, outputLatency: 0, perfNow: 5000 };

  it('equals processing time minus start when there is no latency', () => {
    expect(computeHeardSongTime(base)).toBeCloseTo(8);
  });

  it('subtracts output latency so visuals match what is heard', () => {
    expect(computeHeardSongTime({ ...base, outputLatency: 0.04 })).toBeCloseTo(7.96);
  });

  it('uses the output timestamp, advanced by the time since it was taken', () => {
    const t = computeHeardSongTime({
      ...base,
      outputLatency: 0.04,
      outputStamp: { contextTime: 9.95, performanceTime: 4990 }, // taken 10ms ago
    });
    expect(t).toBeCloseTo(7.96);
  });

  it('ignores a timestamp that claims to be ahead of processing time', () => {
    const t = computeHeardSongTime({
      ...base,
      outputLatency: 0.02,
      outputStamp: { contextTime: 10.5, performanceTime: 5000 },
    });
    expect(t).toBeCloseTo(7.98);
  });

  it('ignores a stale timestamp that disagrees wildly', () => {
    const t = computeHeardSongTime({
      ...base,
      outputLatency: 0.02,
      outputStamp: { contextTime: 3, performanceTime: 5000 },
    });
    expect(t).toBeCloseTo(7.98);
  });

  it('never returns a negative time before the song starts', () => {
    expect(computeHeardSongTime({ ...base, contextTime: 1 })).toBe(0);
  });
});

describe('songTimeAtEvent', () => {
  it('rewinds by how long ago the key was pressed', () => {
    expect(songTimeAtEvent(10, 5000, 4992)).toBeCloseTo(9.992);
  });

  it('falls back to "now" for missing or nonsense timestamps', () => {
    expect(songTimeAtEvent(10, 5000)).toBe(10);
    expect(songTimeAtEvent(10, 5000, 0)).toBe(10);
    expect(songTimeAtEvent(10, 5000, 6000)).toBe(10);
  });
});
