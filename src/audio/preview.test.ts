import { describe, expect, it } from 'vitest';
import { energyEnvelope, LEAD_IN_BEATS, planPreview, PREVIEW_BEATS, PREVIEW_HOP_SEC, previewBeatAt } from './preview';
import { strikeBlend } from '../components/arcade/ui';

const SR = 8000;

/**
 * A made-up song: a click on every beat (120 BPM, first beat at `phase`),
 * quiet until `dropAt`, then loud with a rumble under the clicks.
 */
function song(durationSec: number, phase: number, dropAt: number): Float32Array {
  const out = new Float32Array(Math.round(durationSec * SR));
  const period = 0.5;
  for (let t = phase; t < durationSec; t += period) {
    const loud = t >= dropAt ? 0.9 : 0.25;
    const at = Math.round(t * SR);
    for (let i = 0; i < 400 && at + i < out.length; i++) out[at + i] += loud * Math.exp(-i / 80) * Math.sin(i * 0.9);
  }
  for (let i = Math.round(dropAt * SR); i < out.length; i++) out[i] += 0.25 * Math.sin((i / SR) * 2 * Math.PI * 55);
  return out;
}

describe('song previews', () => {
  it("find the drop, start a bar before it on the song's beat grid, and loop 8 bars", () => {
    const plan = planPreview(energyEnvelope([song(120, 0.18, 52.18)], SR), PREVIEW_HOP_SEC, { bpm: 120, offset: 0.18 }, 120);
    expect(Math.abs(plan.drop - 52.18)).toBeLessThanOrEqual(0.5);
    expect(plan.start).toBeCloseTo(plan.drop - LEAD_IN_BEATS * 0.5, 5);
    expect(plan.end - plan.start).toBeCloseTo(PREVIEW_BEATS * 0.5, 5);
    // On the beat grid
    expect(((plan.start - 0.18) / 0.5) % 1).toBeCloseTo(0, 1);
  });

  it('never loop past the end of the song', () => {
    const plan = planPreview(energyEnvelope([song(40, 0, 29)], SR), PREVIEW_HOP_SEC, { bpm: 120, offset: 0 }, 40);
    expect(plan.end).toBeLessThanOrEqual(40);
    expect(plan.start).toBeGreaterThanOrEqual(0);
  });

  it('know which beat is playing', () => {
    const plan = { start: 10, drop: 12, period: 0.5, end: 26 };
    expect(previewBeatAt(plan, 10)).toEqual({ beat: 0, since: 0 });
    const b = previewBeatAt(plan, 11.6);
    expect(b.beat).toBe(3);
    expect(b.since).toBeCloseTo(0.1, 5);
  });
});

describe('the fighter striking to the beat', () => {
  it('snaps into the strike, holds it, then eases back to the stance', () => {
    expect(strikeBlend(0)).toBe(0);
    expect(strikeBlend(0.1)).toBe(1);
    expect(strikeBlend(0.3)).toBeGreaterThan(0);
    expect(strikeBlend(0.3)).toBeLessThan(1);
    expect(strikeBlend(0.5)).toBe(0);
  });
});
