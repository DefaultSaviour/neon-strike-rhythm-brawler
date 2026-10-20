import { describe, expect, it } from 'vitest';
import { midgameAdDue, SECONDS_BETWEEN_ADS } from './adPacing';

describe('midgame ad pacing', () => {
  it('waits for 5 minutes of actual play since the last ad', () => {
    expect(SECONDS_BETWEEN_ADS).toBe(300);
    expect(midgameAdDue(299, 0)).toBe(false);
    expect(midgameAdDue(300, 0)).toBe(true);
    expect(midgameAdDue(1000, 800)).toBe(false);
    expect(midgameAdDue(1100, 800)).toBe(true);
    expect(midgameAdDue(5, 5, 0)).toBe(true);
  });
});
