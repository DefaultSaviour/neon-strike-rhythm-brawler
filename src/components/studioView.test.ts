import { describe, expect, it } from 'vitest';
import { studioView } from './studioView';
import { EDIT_BOUNDS } from '../game/customAnimation';

describe('studioView', () => {
  it('converts back and forth without drifting', () => {
    const v = studioView(800, 600);
    const p = { x: 12.5, y: -40 };
    const back = v.toPose(v.toScreen(p));
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
  });

  it('fits the whole editing area on the canvas, whatever its shape', () => {
    for (const [w, h] of [[800, 600], [300, 900], [1600, 400]]) {
      const v = studioView(w, h);
      for (const corner of [
        { x: EDIT_BOUNDS.minX, y: EDIT_BOUNDS.minY },
        { x: EDIT_BOUNDS.maxX, y: EDIT_BOUNDS.maxY },
      ]) {
        const s = v.toScreen(corner);
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(w);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(h);
      }
    }
  });
});
