import { describe, expect, it } from 'vitest';
import { getHero } from '../game/heroes';
import { dragonSpiritPath } from './fighterArt';

describe("the Little Dragon's dragon spirit (top-level form)", () => {
  const pose = getHero('dragon').idlePose;

  it('coils up from by his hips to above his head', () => {
    const pts = dragonSpiritPath(pose, 0);
    expect(pts[0].y).toBeGreaterThan(pose.pelvis.y);
    expect(pts[pts.length - 1].y).toBeLessThan(pose.head.y - 20);
    // ...wrapping round him, out to both sides
    const xs = pts.map((p) => p.x - pose.chest.x);
    expect(Math.min(...xs)).toBeLessThan(-15);
    expect(Math.max(...xs)).toBeGreaterThan(15);
  });

  it('turns slowly over time', () => {
    const a = dragonSpiritPath(pose, 0);
    const b = dragonSpiritPath(pose, 0.5);
    expect(Math.abs(a[10].x - b[10].x)).toBeGreaterThan(3);
  });
});
