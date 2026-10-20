import { describe, expect, it } from 'vitest';
import { computeArenaLayout, FIGHTER_HEIGHT, FLOOR_Y, SPAWN_DISTANCE, VISIBLE_HALF_WIDTH } from './layout';

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

  it('shows the same arena on every 16:9 screen, so enemies look the same speed everywhere', () => {
    for (const [w, h] of [[800, 450], [1280, 720], [1920, 1080], [3840, 2160]]) {
      expect(computeArenaLayout(w, h).worldHalfWidth).toBeCloseTo(VISIBLE_HALF_WIDTH, 0);
    }
  });

  it('always shows the whole approach to the strike line, on tablets and phones too', () => {
    for (const [w, h] of [[1024, 768], [768, 1024], [812, 375], [390, 844], [907, 510], [2560, 1080]]) {
      expect(computeArenaLayout(w, h).worldHalfWidth, `${w}x${h}`).toBeGreaterThanOrEqual(VISIBLE_HALF_WIDTH - 0.5);
    }
  });

  it('starts enemies just off the edge of a 16:9 screen', () => {
    expect(SPAWN_DISTANCE).toBeGreaterThan(VISIBLE_HALF_WIDTH);
    expect(SPAWN_DISTANCE - VISIBLE_HALF_WIDTH).toBeLessThan(120);
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

  it('puts the horizon above the fighters so the background never sits behind their bodies', () => {
    const l = computeArenaLayout(1600, 900);
    const headTop = l.floorScreenY - FIGHTER_HEIGHT * l.scale;
    expect(l.horizonY).toBeLessThan(headTop);
  });
});
