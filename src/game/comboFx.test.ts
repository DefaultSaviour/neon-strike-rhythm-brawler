import { describe, expect, it } from 'vitest';
import { comboBlastPower, extraShardsForCombo, MAX_BLAST } from './comboFx';

describe('comboBlastPower', () => {
  it('is exactly 1 with no combo', () => {
    expect(comboBlastPower(0)).toBe(1);
  });

  it('keeps getting stronger as the chain grows (no early ceiling)', () => {
    const chain = [0, 10, 25, 45, 60, 100, 150, 200];
    for (let i = 1; i < chain.length; i++) {
      expect(comboBlastPower(chain[i])).toBeGreaterThan(comboBlastPower(chain[i - 1]));
    }
    // The old formula stopped growing at combo 45; this one is clearly stronger at 100.
    expect(comboBlastPower(100)).toBeGreaterThan(comboBlastPower(45) + 0.3);
  });

  it('never goes past the maximum, however long the chain', () => {
    expect(comboBlastPower(10_000)).toBeLessThanOrEqual(MAX_BLAST);
    expect(comboBlastPower(10_000)).toBeGreaterThan(MAX_BLAST - 0.01);
  });

  it('treats a negative combo as zero', () => {
    expect(comboBlastPower(-5)).toBe(1);
  });
});

describe('extraShardsForCombo', () => {
  it('adds a few shards at milestones, but stays small', () => {
    expect(extraShardsForCombo(0)).toBe(0);
    expect(extraShardsForCombo(10)).toBeGreaterThan(0);
    expect(extraShardsForCombo(1000)).toBeLessThanOrEqual(5);
  });
});
