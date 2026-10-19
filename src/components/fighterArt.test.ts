import { describe, expect, it } from 'vitest';
import { getHero } from '../game/heroes';
import { codeRainStreaks, coinHalo, dizzyHalo, dizzySpeed, dragonSpiritPath } from './fighterArt';

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

describe("Baba Yaga's gold coin halo (top-level form)", () => {
  const pose = getHero('babaYaga').idlePose;

  it('sits behind his head and shoulders, bigger than his head', () => {
    const { center, radius } = coinHalo(pose, 0);
    expect(Math.abs(center.x - pose.head.x)).toBeLessThan(1);
    expect(center.y).toBeGreaterThan(pose.head.y);
    expect(center.y).toBeLessThan(pose.chest.y);
    expect(radius).toBeGreaterThan(25);
  });

  it('spins, but never turns fully edge-on', () => {
    const widths = [0, 0.3, 0.6, 1.1, 1.5, 2.2].map((t) => coinHalo(pose, t).squash);
    expect(Math.max(...widths) - Math.min(...widths)).toBeGreaterThan(0.4);
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(0.2);
  });
});

describe("The One's code rain (top-level form)", () => {
  const pose = getHero('theOne').idlePose;

  it('falls all around him, from above his head down to the floor', () => {
    const streaks = codeRainStreaks(pose, 0);
    const xs = streaks.map((s) => s.x - pose.chest.x);
    expect(Math.min(...xs)).toBeLessThan(-40);
    expect(Math.max(...xs)).toBeGreaterThan(40);
    for (const s of streaks) {
      expect(s.y).toBeGreaterThanOrEqual(pose.head.y - 90);
      expect(s.y).toBeLessThanOrEqual(68);
    }
  });

  it('keeps falling over time', () => {
    const a = codeRainStreaks(pose, 0);
    const b = codeRainStreaks(pose, 0.1);
    expect(b.filter((s, i) => s.y > a[i].y).length).toBeGreaterThan(a.length / 2);
  });
});

describe("the Drunken Master's dizzy halo (top-level form)", () => {
  const pose = getHero('drunkenMaster').idlePose;

  it('stars and birds circle his head, some in front and some behind', () => {
    const items = dizzyHalo(pose, 0.3, 50);
    expect(items.filter((i) => i.kind === 'star').length).toBeGreaterThanOrEqual(3);
    expect(items.filter((i) => i.kind === 'bird').length).toBeGreaterThanOrEqual(2);
    for (const i of items) {
      expect(Math.abs(i.x - pose.head.x)).toBeLessThanOrEqual(34 + 1e-6);
      expect(Math.abs(i.y - (pose.head.y - 16))).toBeLessThanOrEqual(10 + 1e-6);
    }
    expect(items.some((i) => i.front)).toBe(true);
    expect(items.some((i) => !i.front)).toBe(true);
  });

  it('spins faster as the combo climbs', () => {
    expect(dizzySpeed(80)).toBeGreaterThan(dizzySpeed(50));
    const a = dizzyHalo(pose, 0, 50)[0];
    const b = dizzyHalo(pose, 0.2, 50)[0];
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(3);
  });
});
