import { describe, expect, it } from 'vitest';
import { computeArenaLayout, FIGHTER_HEIGHT, FLOOR_Y } from './layout';

describe('computeArenaLayout', () => {
  it('makes fighters about a third of the screen tall on a laptop', () => {
    const l = computeArenaLayout(1600, 900);
    const fighterPx = FIGHTER_HEIGHT * l.scale;
    expect(fighterPx / 900).toBeGreaterThan(0.3);
    expect(fighterPx / 900).toBeLessThan(0.4);
  });

  it('grows with bigger screens instead of leaving empty space', () => {
    expect(computeArenaLayout(2560, 1440).scale).toBeGreaterThan(computeArenaLayout(1280, 720).scale * 1.5);
  });

  it('keeps enough arena width visible on a narrow phone screen', () => {
    const l = computeArenaLayout(390, 844);
    expect(l.worldHalfWidth * 2).toBeGreaterThanOrEqual(440);
  });

  it('puts the floor line (world y = FLOOR_Y) at the floor screen position', () => {
    const l = computeArenaLayout(1600, 900);
    expect(l.originY + FLOOR_Y * l.scale).toBeCloseTo(l.floorScreenY);
    expect(l.horizonY).toBeLessThan(l.floorScreenY);
  });

  it('keeps the whole fighter on screen', () => {
    for (const [w, h] of [[1600, 900], [390, 844], [844, 390], [3840, 2160]]) {
      const l = computeArenaLayout(w, h);
      const headTop = l.floorScreenY - FIGHTER_HEIGHT * l.scale;
      expect(headTop).toBeGreaterThan(0);
    }
  });
});
