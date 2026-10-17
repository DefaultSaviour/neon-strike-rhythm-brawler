import { describe, expect, it } from 'vitest';
import { BREACH_LATE_SEC, explainDeath, HIT_WINDOWS, judgeOffset, pickTarget, suggestLatencyOffsetMs } from './timing';

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

describe('explainDeath', () => {
  const ronin = { name: 'Ronin', lane: 'right' as const, targetTime: 10 };

  it('reports a press on the right side that was too early', () => {
    const r = explainDeath(ronin, [{ time: 9.788, lane: 'right' }]);
    expect(r.reason).toBe('You pressed 212 ms too early.');
    expect(r.enemyName).toBe('Ronin');
    expect(r.lane).toBe('right');
  });

  it('reports a press that was too late (up to the moment the enemy breaks through)', () => {
    expect(explainDeath(ronin, [{ time: 10.16, lane: 'right' }]).reason).toBe('You pressed 160 ms too late.');
  });

  it('picks the press closest to the enemy beat', () => {
    const r = explainDeath(ronin, [
      { time: 9.5, lane: 'right' },
      { time: 9.8, lane: 'right' },
    ]);
    expect(r.reason).toBe('You pressed 200 ms too early.');
  });

  it('explains a press on the wrong side', () => {
    expect(explainDeath(ronin, [{ time: 10.008, lane: 'left' }]).reason).toBe(
      'You pressed LEFT 8 ms after it arrived. Wrong side.'
    );
  });

  it('explains a press that was used up on the enemy just ahead', () => {
    const r = explainDeath(ronin, [{ time: 9.95, lane: 'right', hitEnemyName: 'Titan' }]);
    expect(r.reason).toBe('Your press hit the Titan just ahead of it, so this one got through.');
  });

  it('says when there was no press at all', () => {
    expect(explainDeath(ronin, []).reason).toBe("You didn't press for it.");
    // Presses long before don't count as attempts at this enemy
    expect(explainDeath(ronin, [{ time: 5, lane: 'right' }]).reason).toBe("You didn't press for it.");
  });

  it('in one-button mode, any press counts as an attempt at this enemy', () => {
    expect(explainDeath(ronin, [{ time: 9.7, lane: 'left' }], true).reason).toBe('You pressed 300 ms too early.');
  });
});
