import { describe, expect, it } from 'vitest';
import { getHero } from '../game/heroes';
import { keyToPlayerPose } from '../game/heroMoves/poseBuilder';
import { getOrientedPose } from '../game/animations';
import { Point2D } from '../types/game';
import { ballerinaArms, blossomStorm, katanaTip, championBelt, codeRainStreaks, coinHalo, dizzyHalo, dizzySpeed, discoFever, dragonSpiritPath, kidCrane, battlePlate, spearTip, stallionSun, applyHeroBuild, axeHead, bodyBulk, flyingArmOf, HERO_BUILDS, lionMane, meatHooks, poleEnds, tinHeart, sawBarTip, scarecrowBrain, swanTutuFeathers } from './fighterArt';

const dist = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);

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

describe("the Pro Wrestler's championship belt (top-level form)", () => {
  const pose = getHero('proWrestler').idlePose;

  it('floats high above his head, wider than his shoulders', () => {
    const belt = championBelt(pose, 0);
    expect(Math.abs(belt.x - pose.head.x)).toBeLessThan(1);
    expect(belt.y).toBeLessThan(pose.head.y - 25);
    expect(belt.halfWidth * 2).toBeGreaterThan(40);
  });

  it('bobs gently over time', () => {
    const ys = [0, 0.3, 0.6, 0.9].map((t) => championBelt(pose, t).y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(2);
  });
});

describe("the White Swan's swan tutu (top-level form)", () => {
  const pose = getHero('ballerina').idlePose;

  it('fans two layers of feathers out round her hips, much wider than her body', () => {
    const feathers = swanTutuFeathers(pose, 0);
    expect(feathers.filter((f) => f.layer === 0).length).toBeGreaterThanOrEqual(10);
    expect(feathers.filter((f) => f.layer === 1).length).toBeGreaterThanOrEqual(8);
    for (const f of feathers) expect(Math.abs(f.base.y - pose.pelvis.y)).toBeLessThan(8);
    const xs = feathers.map((f) => f.tip.x - pose.pelvis.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(55);
  });

  it('the feathers flutter over time', () => {
    const a = swanTutuFeathers(pose, 0);
    const b = swanTutuFeathers(pose, 0.25);
    expect(a.some((f, i) => Math.hypot(f.tip.x - b[i].tip.x, f.tip.y - b[i].tip.y) > 1)).toBe(true);
  });
});

describe("the White Swan's long arms", () => {
  const pose = getHero('ballerina').idlePose;
  const drawn = ballerinaArms(pose);
  const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  it('are drawn longer than the skeleton, from the same shoulders', () => {
    expect(d(drawn.leftShoulder, drawn.leftHand)).toBeGreaterThan(d(pose.leftShoulder, pose.leftHand) * 1.2);
    expect(drawn.leftShoulder).toEqual(pose.leftShoulder);
  });

  it('so her joined hands meet well clear above her head, not on it', () => {
    // Head radius is 9: the hands should be clearly above the top of it
    expect(drawn.leftHand.y).toBeLessThan(pose.head.y - 9 - 6);
    expect(drawn.rightHand.y).toBeLessThan(pose.head.y - 9 - 6);
    expect(d(drawn.leftHand, drawn.rightHand)).toBeLessThan(4);
  });
});

describe("The Stallion's sunrise (top-level form)", () => {
  const pose = getHero('stallion').idlePose;

  it('a big sun rising behind his shoulders, wider than he is', () => {
    const sun = stallionSun(pose, 0);
    expect(Math.abs(sun.x - pose.chest.x)).toBeLessThan(1);
    expect(sun.radius * 2).toBeGreaterThan(80);
    expect(sun.rays).toBeGreaterThanOrEqual(10);
  });

  it('its rays turn slowly', () => {
    expect(stallionSun(pose, 2).turn).not.toBe(stallionSun(pose, 0).turn);
  });
});

describe("The Kid's crane (top-level form)", () => {
  const pose = getHero('kid').idlePose;

  it('a crane behind his shoulders, its wings spreading far wider than he is', () => {
    const crane = kidCrane(pose, 0);
    expect(Math.abs(crane.x - pose.chest.x)).toBeLessThan(1);
    expect(crane.span).toBeGreaterThan(120);
  });

  it('its wings slowly beat', () => {
    expect(kidCrane(pose, 0.7).lift).not.toBeCloseTo(kidCrane(pose, 0).lift, 2);
  });
});

describe("The Spartan's gear and battle plate", () => {
  const sp = getHero('spartan');

  it('every spear hit lands at the tip of his spear', () => {
    for (const m of sp.moves) {
      for (const k of m.sequence!) {
        if (!k.trail) continue;
        // Shield and kick hits land by the lead hand or foot; anything else is the spear
        const nearLimb = [k.pose.frontHand, k.pose.frontFoot].some((e) => dist(k.trail!.end, e) < 30);
        if (!nearLimb) expect(dist(spearTip(keyToPlayerPose(k), 1), k.trail.end), m.name).toBeLessThan(6);
      }
    }
  });

  it('his battle plate: greaves down both shins and guards along both forearms', () => {
    const pose = sp.idlePose;
    const plate = battlePlate(pose);
    expect(plate.greaves).toHaveLength(2);
    expect(plate.armGuards).toHaveLength(2);
    for (const [a, b] of plate.greaves) {
      expect(a.y).toBeGreaterThan(Math.min(pose.leftKnee.y, pose.rightKnee.y) - 1);
      expect(dist(a, b)).toBeGreaterThan(15);
    }
  });
});

describe("The Disco King's disco fever (top-level form)", () => {
  const pose = getHero('discoKing').idlePose;

  it('a big mirror ball hanging over his head, and a light-up floor under his feet', () => {
    const { ball, tiles } = discoFever(pose, 0);
    expect(ball.y).toBeLessThan(pose.head.y - 30);
    expect(ball.radius * 2).toBeGreaterThan(36);
    expect(tiles.length).toBeGreaterThanOrEqual(8);
    for (const t of tiles) expect(t.y).toBeGreaterThanOrEqual(60);
  });

  it('the ball turns and the floor lights change', () => {
    expect(discoFever(pose, 1).ball.turn).not.toBe(discoFever(pose, 0).ball.turn);
    expect(discoFever(pose, 0.3).tiles[0].color).not.toBe(discoFever(pose, 0).tiles[0].color);
  });
});

describe("The Bride's katana and blossom storm", () => {
  const br = getHero('bride');

  it('every sword hit lands at the tip of her blade', () => {
    for (const m of br.moves) {
      for (const k of m.sequence!) {
        if (!k.trail) continue;
        expect(dist(katanaTip(keyToPlayerPose(k), 1), k.trail.end), m.name).toBeLessThan(6);
      }
    }
  });

  it('a storm of petals whirling round her, some behind and some in front', () => {
    const petals = blossomStorm(br.idlePose, 0);
    expect(petals.length).toBeGreaterThanOrEqual(10);
    expect(petals.length).toBeLessThanOrEqual(16); // sparse: a calm drift, not clutter
    expect(petals.some((p) => p.front)).toBe(true);
    expect(petals.some((p) => !p.front)).toBe(true);
    const xs = petals.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(90);
    expect(blossomStorm(br.idlePose, 0.5)[0].x).not.toBeCloseTo(petals[0].x, 1);
  });
});

describe("Saw Face's chainsaw and meat hooks", () => {
  const sf = getHero('sawFace');

  it('every saw hit lands at the tip of the bar', () => {
    for (const m of sf.moves) {
      for (const k of m.sequence!) {
        if (!k.trail) continue;
        expect(dist(sawBarTip(keyToPlayerPose(k), 1), k.trail.end), m.name).toBeLessThan(6);
      }
    }
  });

  it('the saw never sits on top of his mask, even with it held high in the dance', () => {
    for (const m of sf.moves) {
      for (const k of m.sequence!) {
        const pose = keyToPlayerPose(k);
        const tip = sawBarTip(pose, 1);
        const hand = pose.leftHand;
        const len = dist(tip, hand);
        // The middle of the engine block, behind the lead hand
        const engine = { x: hand.x - ((tip.x - hand.x) / len) * 6.5, y: hand.y - ((tip.y - hand.y) / len) * 6.5 };
        expect(dist(engine, pose.head), m.name).toBeGreaterThan(10);
      }
    }
  });

  it('two small enemies hang limp from meat hooks, one each side, clear of the timing circles', () => {
    const pose = sf.idlePose;
    const hooks = meatHooks(0);
    expect(hooks).toHaveLength(2);
    expect(hooks.map((h) => Math.sign(h.hook.x)).sort()).toEqual([-1, 1]);
    for (const h of hooks) {
      // Inside the strike lines (78 out), clear of the settled timing circle (radius 22) round them
      expect(Math.abs(h.hook.x) + 12 * h.scale).toBeLessThan(78 - 22);
      // High up, hung off the floor
      expect(h.hook.y).toBeLessThan(pose.chest.y);
      expect(h.hook.y + 104 * h.scale).toBeLessThan(68 - 10);
      expect(h.scale).toBeLessThanOrEqual(0.6);
      expect(h.chainTop.y).toBeLessThan(h.hook.y - 80);
    }
    expect(hooks[0].color).not.toBe(hooks[1].color);
    // They sway a little on their chains, but never move along
    expect(meatHooks(0.5)[0].sway).not.toBeCloseTo(hooks[0].sway, 3);
    expect(meatHooks(0.5)[0].hook).toEqual(hooks[0].hook);
  });

});

describe('hero builds', () => {
  it('Saw Face is a big man: drawn about 15-20% bigger than the skeleton, and stood back in a song', () => {
    const build = HERO_BUILDS.sawFace!;
    expect(build.scale).toBeGreaterThanOrEqual(1.15);
    expect(build.scale).toBeLessThanOrEqual(1.2);
    expect(build.standBack).toBeGreaterThan(0);
  });

  it('the build scales from the feet and moves him back away from the enemy he faces', () => {
    const calls: string[] = [];
    const ctx = { translate: (x: number, y: number) => calls.push(`t ${x} ${y}`), scale: (x: number) => calls.push(`s ${x}`) } as unknown as CanvasRenderingContext2D;
    applyHeroBuild(ctx, 'sawFace', -1, true);
    expect(calls).toEqual([`t ${HERO_BUILDS.sawFace!.standBack} 0`, 't 0 68', `s ${HERO_BUILDS.sawFace!.scale}`, 't 0 -68']);
    calls.length = 0;
    applyHeroBuild(ctx, 'bride', 1, true);
    expect(calls).toEqual([]);
  });
});

describe("The Scarecrow's pole and brain", () => {
  const sc = getHero('scarecrow');

  it('every pole hit lands at the end of the pole', () => {
    for (const m of sc.moves) {
      for (const k of m.sequence!) {
        // The vault kick lands with his feet, not the pole
        if (!k.trail || k.prop !== 'pole' || m.name === 'Pole Vault Kick') continue;
        expect(dist(poleEnds(keyToPlayerPose(k), 1).tip, k.trail.end), m.name).toBeLessThan(6);
      }
    }
  });

  it('his flying arm comes right off: fist at the end of the hit, torn end well away from his shoulder, both ways round', () => {
    const fist = sc.moves.find((m) => m.name === 'Flying Fist')!;
    const pose = keyToPlayerPose(fist.sequence![0]);
    for (const facing of [1, -1] as const) {
      const p = facing > 0 ? pose : getOrientedPose(pose, 'left');
      const fly = flyingArmOf(p, facing)!;
      expect(fly).not.toBeNull();
      expect(dist(fly.hand, p.bladeSlash!.end)).toBeLessThan(1e-6);
      expect(dist(fly.shoulder, fly.stump)).toBeGreaterThan(30);
      // The arm keeps its shape in the air
      expect(dist(fly.shoulder, fly.elbow)).toBeCloseTo(dist(fly.stump, facing > 0 ? p.rightElbow : p.leftElbow), 3);
    }
    // ...and is back on when there's no hit showing
    expect(flyingArmOf({ ...pose, bladeSlash: undefined }, 1)).toBeNull();
    expect(flyingArmOf(sc.idlePose, 1)).toBeNull();
  });

  it('his brain glows in the top of his head, with sparks of genius round it, both ways round', () => {
    for (const facing of [1, -1] as const) {
      const { brain, sparks } = scarecrowBrain(sc.idlePose, 0, facing);
      expect(brain.y).toBeLessThan(sc.idlePose.head.y);
      expect(Math.abs(brain.x - sc.idlePose.head.x)).toBeLessThan(3);
      expect(sparks.length).toBeGreaterThanOrEqual(3);
      expect(sparks.length).toBeLessThanOrEqual(5); // sparse
    }
    expect(scarecrowBrain(sc.idlePose, 0.4, 1).sparks[0].x).not.toBeCloseTo(scarecrowBrain(sc.idlePose, 0, 1).sparks[0].x, 1);
  });
});

describe("The Lion's top-level form", () => {
  it('he grows much bigger and jacked: broad shoulders and thick limbs, only in his top form', () => {
    expect(HERO_BUILDS.lion!.topScale!).toBeGreaterThanOrEqual(1.2);
    expect(HERO_BUILDS.lion!.scale).toBe(1);
    const normal = bodyBulk('lion', false);
    const jacked = bodyBulk('lion', true);
    expect(jacked.shoulderHalf).toBeGreaterThan(normal.shoulderHalf * 1.3);
    expect(jacked.limbScale).toBeGreaterThan(1.3);
    expect(bodyBulk('bride', true)).toEqual(normal);
  });

  it('the build scales him up from the feet in his top form, and leaves him alone otherwise', () => {
    const calls: string[] = [];
    const ctx = { translate: (x: number, y: number) => calls.push(`t ${x} ${y}`), scale: (x: number) => calls.push(`s ${x}`) } as unknown as CanvasRenderingContext2D;
    applyHeroBuild(ctx, 'lion', 1, true, false);
    expect(calls).toEqual([]);
    applyHeroBuild(ctx, 'lion', 1, true, true);
    expect(calls).toEqual(['t 0 68', `s ${HERO_BUILDS.lion!.topScale}`, 't 0 -68']);
  });
});

describe("The Tin Man's axe and heart, and The Lion's mane", () => {
  it('every axe hit lands at the axe head', () => {
    const tm = getHero('tinMan');
    let axeHits = 0;
    for (const m of tm.moves) {
      for (const k of m.sequence!) {
        if (!k.trail) continue;
        const p = keyToPlayerPose(k);
        if (Math.abs(dist(k.trail.end, p.leftHand) - 30) > 3) continue; // a punch, kick or headbutt
        axeHits++;
        expect(dist(axeHead(p, 1), k.trail.end), m.name).toBeLessThan(6);
      }
    }
    expect(axeHits).toBeGreaterThan(10);
  });

  it('his heart sits in his chest and beats', () => {
    const pose = getHero('tinMan').idlePose;
    const a = tinHeart(pose, 0);
    // In his chest, just below the chest core
    expect(a.y).toBeGreaterThan(pose.chest.y);
    expect(dist(a, pose.chest)).toBeLessThan(16);
    expect(tinHeart(pose, 0.25).size).not.toBeCloseTo(a.size, 2);
  });

  it("the Lion's mane rings his head; with his courage it's a bigger, flickering mane of fire", () => {
    const pose = getHero('lion').idlePose;
    const calm = lionMane(pose, 0, false);
    const fire = lionMane(pose, 0, true);
    expect(calm.length).toBeGreaterThanOrEqual(10);
    const avg = (m: { length: number }[]) => m.reduce((s, t) => s + t.length, 0) / m.length;
    expect(avg(fire)).toBeGreaterThan(avg(calm));
    expect(lionMane(pose, 0.2, true)[0].length).not.toBeCloseTo(fire[0].length, 2);
    expect(lionMane(pose, 0.2, false)[0].length).toBeCloseTo(calm[0].length, 6);
  });
});
