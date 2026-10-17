import { describe, expect, it } from 'vitest';
import { FIGHTER_TIERS, fighterTier } from './fighterTier';

describe('fighterTier', () => {
  it('starts as a basic striker', () => {
    expect(fighterTier(0).name).toBe('BASIC STRIKER');
  });

  it('levels up exactly at each threshold', () => {
    expect(fighterTier(5).name).toBe('BASIC STRIKER');
    expect(fighterTier(6).name).toBe('ACROBATIC');
    expect(fighterTier(16).name).toBe('CYBER NINJA');
    expect(fighterTier(30).name).toBe('OVERDRIVE');
    expect(fighterTier(50).name).toBe('GOD TIER');
    expect(fighterTier(9999).name).toBe('GOD TIER');
  });

  it('only the top tier has angel wings, and effects only build up', () => {
    expect(FIGHTER_TIERS.filter((t) => t.wings).map((t) => t.name)).toEqual(['GOD TIER']);
    for (let i = 1; i < FIGHTER_TIERS.length; i++) {
      expect(FIGHTER_TIERS[i].minCombo).toBeGreaterThan(FIGHTER_TIERS[i - 1].minCombo);
      expect(FIGHTER_TIERS[i].glow).toBeGreaterThanOrEqual(FIGHTER_TIERS[i - 1].glow);
    }
  });
});
