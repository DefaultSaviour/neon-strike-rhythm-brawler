import { describe, expect, it } from 'vitest';
import { litPips, pipsAt, snapValue, stepValue, valueAt } from './optionsControls';

describe('snapValue', () => {
  it('rounds to the step and stays in range', () => {
    expect(snapValue(0.87, 0, 1, 0.05)).toBe(0.85);
    expect(snapValue(1.3, 0, 1, 0.05)).toBe(1);
    expect(snapValue(-12, -300, 300, 5)).toBe(-10);
    expect(snapValue(-400, -300, 300, 5)).toBe(-300);
  });

  it('leaves no float fuzz', () => {
    expect(snapValue(0.1 + 0.2, 0, 1, 0.05)).toBe(0.3);
  });
});

describe('stepValue', () => {
  it('moves one step and stops at the ends', () => {
    expect(stepValue(0.9, 1, 0, 1, 0.05)).toBe(0.95);
    expect(stepValue(1, 1, 0, 1, 0.05)).toBe(1);
    expect(stepValue(0, -1, 0, 1, 0.05)).toBe(0);
    expect(stepValue(150, -1, -300, 300, 5)).toBe(145);
  });
});

describe('pipsAt', () => {
  it('lights the tapped pip and the ones before it', () => {
    // 20 pips: the middle of the first is 0.025 across, the middle of the 10th is 0.475
    expect(pipsAt(0.025, 20)).toBe(1);
    expect(pipsAt(0.475, 20)).toBe(10);
    expect(pipsAt(0.999, 20)).toBe(20);
  });

  it('is all off past the left end and all on past the right', () => {
    expect(pipsAt(-0.01, 20)).toBe(0);
    expect(pipsAt(1.4, 20)).toBe(20);
  });

  it('agrees with litPips, so a tap lights what the meter then shows', () => {
    for (let i = 0; i < 20; i++) {
      const n = pipsAt((i + 0.5) / 20, 20);
      expect(litPips(n * 0.05, 0, 1, 20)).toBe(n);
    }
  });
});

describe('valueAt', () => {
  it('maps across the bar, snapped, with the middle at 0 for the timing bar', () => {
    expect(valueAt(0.5, -300, 300, 5)).toBe(0);
    expect(valueAt(0, -300, 300, 5)).toBe(-300);
    expect(valueAt(1.2, -300, 300, 5)).toBe(300);
    expect(valueAt(0.7, -300, 300, 5)).toBe(120);
  });
});
