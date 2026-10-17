import { describe, expect, it } from 'vitest';
import { BREACH_LATE_SEC, HIT_WINDOWS, judgeOffset, pickTarget, suggestLatencyOffsetMs } from './timing';

describe('judgeOffset', () => {
  it('gives the same judgement for early and late presses of equal size', () => {
    expect(judgeOffset(-0.03)).toBe('PERFECT');
    expect(judgeOffset(0.03)).toBe('PERFECT');
  });

  it('uses the window edges inclusively', () => {
    expect(judgeOffset(HIT_WINDOWS.PERFECT)).toBe('PERFECT');
    expect(judgeOffset(HIT_WINDOWS.GOOD)).toBe('GOOD');
    expect(judgeOffset(HIT_WINDOWS.OK)).toBe('OK');
    expect(judgeOffset(HIT_WINDOWS.OK + 0.001)).toBe('MISS');
  });

  it('never lets an enemy breach before its OK window has passed', () => {
    expect(BREACH_LATE_SEC).toBeGreaterThanOrEqual(HIT_WINDOWS.OK);
  });
});

describe('pickTarget', () => {
  const enemy = (targetTime: number, lane: 'left' | 'right' = 'left', defeated = false) => ({
    targetTime,
    lane,
    defeated,
  });

  it('returns null when nothing is inside the hit window', () => {
    expect(pickTarget([enemy(5)], 4, 'left')).toBeNull();
  });

  it('prefers the earliest enemy in the window over the closest one', () => {
    // A late enemy (100ms ago) and an upcoming one (20ms away): hit the late one first,
    // otherwise it would walk through and end the run.
    const late = enemy(9.9);
    const next = enemy(10.02);
    expect(pickTarget([next, late], 10, 'left')).toBe(late);
  });

  it('ignores defeated enemies and the other lane', () => {
    const dead = enemy(10, 'left', true);
    const other = enemy(10, 'right');
    const mine = enemy(10.05, 'left');
    expect(pickTarget([dead, other, mine], 10, 'left')).toBe(mine);
  });

  it('searches both lanes when lane is null (one-button mode)', () => {
    const right = enemy(10.01, 'right');
    expect(pickTarget([right], 10, null)).toBe(right);
  });
});

describe('suggestLatencyOffsetMs', () => {
  it('needs enough hits before suggesting anything', () => {
    expect(suggestLatencyOffsetMs(0, [0.03, 0.03])).toBeNull();
  });

  it('adds the median lateness to the current offset', () => {
    const lateBy30ms = Array.from({ length: 20 }, () => 0.03);
    expect(suggestLatencyOffsetMs(0, lateBy30ms)).toBe(30);
    expect(suggestLatencyOffsetMs(20, lateBy30ms)).toBe(50);
  });

  it('is not thrown off by a few wild presses', () => {
    const offsets = [...Array.from({ length: 18 }, () => -0.02), 0.15, 0.15];
    expect(suggestLatencyOffsetMs(0, offsets)).toBe(-20);
  });

  it('clamps to the settings slider range', () => {
    const veryLate = Array.from({ length: 20 }, () => 0.5);
    expect(suggestLatencyOffsetMs(0, veryLate)).toBe(300);
  });
});
