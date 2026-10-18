import { describe, expect, it } from 'vitest';
import { AttackMove, Point2D, SkeletonPose } from '../types/game';
import { ATTACK_MOVES, getMoveForCombo, getOrientedPose } from './animations';
import { LIMB } from './enemyMotion';
import { DEFAULT_HERO, getHero, HEROES } from './heroes';
import { keyToPlayerPose, safeFold } from './heroMoves/poseBuilder';
import { comboDuration, comboFrame } from './combo';
import { muzzlePoint } from '../components/fighterArt';

const dist = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);
const dragon = getHero('dragon');

function expectSolidLimbs(p: SkeletonPose) {
  expect(dist(p.leftShoulder, p.leftElbow)).toBeCloseTo(LIMB.upperArm, 3);
  expect(dist(p.leftElbow, p.leftHand)).toBeCloseTo(LIMB.forearm, 3);
  expect(dist(p.rightShoulder, p.rightElbow)).toBeCloseTo(LIMB.upperArm, 3);
  expect(dist(p.rightElbow, p.rightHand)).toBeCloseTo(LIMB.forearm, 3);
  expect(dist(p.pelvis, p.leftKnee)).toBeCloseTo(LIMB.thigh, 3);
  expect(dist(p.leftKnee, p.leftFoot)).toBeCloseTo(LIMB.shin, 3);
  expect(dist(p.pelvis, p.rightKnee)).toBeCloseTo(LIMB.thigh, 3);
  expect(dist(p.rightKnee, p.rightFoot)).toBeCloseTo(LIMB.shin, 3);
}

describe('heroes', () => {
  it('every hero has a unique id and name, a stance and moves', () => {
    expect(new Set(HEROES.map((h) => h.id)).size).toBe(HEROES.length);
    expect(new Set(HEROES.map((h) => h.label)).size).toBe(HEROES.length);
    for (const h of HEROES) {
      expect(h.moves.length).toBeGreaterThan(0);
      expect(h.idlePose.head).toBeDefined();
    }
  });

  it('move ids are unique across all heroes', () => {
    const ids = HEROES.flatMap((h) => h.moves.map((m) => m.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('unknown or missing hero ids fall back to the default hero', () => {
    expect(getHero('not-a-hero').id).toBe(DEFAULT_HERO);
    expect(getHero(undefined).id).toBe(DEFAULT_HERO);
  });

  it('the original Neon Striker is unchanged', () => {
    expect(getHero('striker').moves).toBe(ATTACK_MOVES);
    expect(getMoveForCombo(0, 0)).toBe(ATTACK_MOVES[0]);
  });
});

describe('The Little Dragon', () => {
  it('has 21 moves spread over the 5 combo tiers (5, 5, 4, 4, 3), all with different names', () => {
    expect(dragon.moves).toHaveLength(21);
    const perTier = [1, 2, 3, 4, 5].map((t) => dragon.moves.filter((m) => m.tier === t).length);
    expect(perTier).toEqual([5, 5, 4, 4, 3]);
    expect(new Set(dragon.moves.map((m) => m.name)).size).toBe(21);
  });

  it('every pose keeps its limbs solid and stays above the floor, in every keyframe of every combo', () => {
    const poses = [dragon.idlePose, ...dragon.moves.flatMap((m) => [m.pose, ...(m.sequence ?? []).map((k) => keyToPlayerPose(k))])];
    expect(poses.length).toBeGreaterThan(60);
    for (const p of poses) {
      expectSolidLimbs(p);
      for (const q of [p.leftFoot, p.rightFoot, p.leftHand, p.rightHand, p.head]) {
        expect(q.y).toBeLessThanOrEqual(68 + 1e-6);
      }
    }
  });

  it('every move is a combo whose first keyframe is the hit, with a trail', () => {
    for (const m of dragon.moves) {
      expect(m.sequence!.length).toBeGreaterThanOrEqual(2);
      expect(m.sequence![0].trail).toBeDefined();
      expect(m.pose.bladeSlash).toEqual(m.sequence![0].trail);
      for (const k of m.sequence!.slice(1)) expect(k.ms).toBeGreaterThan(0);
    }
    // Plenty of real multi-hit combos, not just single blows.
    const multiHit = dragon.moves.filter((m) => m.sequence!.filter((k) => k.trail).length >= 3);
    expect(multiHit.length).toBeGreaterThanOrEqual(8);
  });

  it('jumping moves really leave the ground', () => {
    const airborneHit = ['Hurricane Kick', 'Bicycle Kick', 'Tiger Knee', 'Scissor Takedown', 'Final Dragon'];
    for (const name of airborneHit) {
      const k = dragon.moves.find((m) => m.name === name)!.sequence![0];
      expect(Math.max(k.pose.frontFoot.y, k.pose.backFoot.y)).toBeLessThan(64);
    }
    // The uppercut starts on the ground and launches into the air.
    const up = dragon.moves.find((m) => m.name === 'Rising Dragon Uppercut')!.sequence!;
    expect(up[0].pose.frontFoot.y).toBeCloseTo(68, 3);
    expect(Math.max(up[1].pose.frontFoot.y, up[1].pose.backFoot.y)).toBeLessThan(64);
  });

  it('the nunchaku come out for the nunchaku combo only', () => {
    const withProp = dragon.moves.filter((m) => m.sequence!.some((k) => k.prop));
    expect(withProp.map((m) => m.name)).toEqual(['Nunchaku Fury']);
    expect(withProp[0].pose.prop).toBe('nunchaku');
    expect(withProp[0].sequence!.every((k) => k.prop === 'nunchaku')).toBe(true);
  });

  it('strikes land toward the enemy (in front of the body)', () => {
    for (const m of dragon.moves) {
      expect(m.pose.bladeSlash!.end.x).toBeGreaterThan(m.pose.pelvis.x);
    }
  });

  it('facing left mirrors the pose and keeps the nunchaku', () => {
    const m = dragon.moves.find((x) => x.pose.prop)!;
    expect(m).toBeDefined();
    const left = getOrientedPose(m.pose, 'left');
    expect(left.prop).toBe('nunchaku');
    expect(left.bladeSlash!.end.x).toBeCloseTo(-m.pose.bladeSlash!.end.x, 6);
  });
});

describe('Baba Yaga', () => {
  const baba = getHero('babaYaga');
  const allKeys = baba.moves.flatMap((m) => m.sequence!);

  it('has 21 moves spread over the 5 combo tiers (5, 5, 4, 4, 3), all with different names', () => {
    expect(baba.moves).toHaveLength(21);
    const perTier = [1, 2, 3, 4, 5].map((t) => baba.moves.filter((m) => m.tier === t).length);
    expect(perTier).toEqual([5, 5, 4, 4, 3]);
    expect(new Set(baba.moves.map((m) => m.name)).size).toBe(21);
  });

  it('every pose keeps its limbs solid and stays above the floor, in every keyframe of every combo', () => {
    const poses = [baba.idlePose, ...baba.moves.flatMap((m) => [m.pose, ...m.sequence!.map((k) => keyToPlayerPose(k))])];
    for (const p of poses) {
      expectSolidLimbs(p);
      for (const q of [p.leftFoot, p.rightFoot, p.leftHand, p.rightHand, p.head]) {
        expect(q.y).toBeLessThanOrEqual(68 + 1e-6);
      }
    }
  });

  it('every move is a combo whose first keyframe is the hit, landing toward the enemy', () => {
    for (const m of baba.moves) {
      expect(m.sequence!.length).toBeGreaterThanOrEqual(2);
      expect(m.sequence![0].trail).toBeDefined();
      expect(m.pose.bladeSlash!.end.x).toBeGreaterThan(m.pose.pelvis.x);
      for (const k of m.sequence!.slice(1)) expect(k.ms).toBeGreaterThan(0);
    }
    const multiHit = baba.moves.filter((m) => m.sequence!.filter((k) => k.trail).length >= 3);
    expect(multiHit.length).toBeGreaterThanOrEqual(8);
  });

  it('always has a weapon in hand, and holds the pistol two-handed at the chest when idle', () => {
    expect(allKeys.every((k) => k.prop)).toBe(true);
    const idle = baba.idlePose;
    expect(idle.prop).toBe('pistol');
    expect(dist(idle.leftHand, idle.rightHand)).toBeLessThan(6);
    expect(idle.leftHand.x).toBeGreaterThan(idle.chest.x);
  });

  it('shots only fire with a trail (the bullet streak), and only on guns', () => {
    const shots = allKeys.filter((k) => k.shot);
    expect(shots.length).toBeGreaterThan(40);
    for (const k of shots) {
      expect(k.trail).toBeDefined();
      expect(['pistol', 'pistols', 'shotgun']).toContain(k.prop);
    }
    // ...and the kicks, elbows and the pencil never do
    expect(allKeys.filter((k) => k.prop === 'pencil').some((k) => k.shot)).toBe(false);
  });

  it('the muzzle flash sits at the end of the gun that is firing', () => {
    const dual = baba.moves.find((m) => m.name === 'Dual Pistols')!.sequence!.map((k) => keyToPlayerPose(k));
    // Lead hand fires first, then the rear hand
    expect(dist(muzzlePoint(dual[0], 1)!, dual[0].leftHand)).toBeCloseTo(9, 3);
    expect(dist(muzzlePoint(dual[1], 1)!, dual[1].rightHand)).toBeCloseTo(9, 3);
    const blast = keyToPlayerPose(baba.moves.find((m) => m.name === 'Shotgun Blast')!.sequence![0]);
    expect(dist(muzzlePoint(blast, 1)!, blast.leftHand)).toBeCloseTo(22, 3);
    expect(muzzlePoint(baba.idlePose, 1)).toBeUndefined();
  });

  it('the shotgun, dual pistols and pencil come out for their own moves', () => {
    const using = (prop: string) => baba.moves.filter((m) => m.sequence!.some((k) => k.prop === prop)).map((m) => m.name);
    expect(using('shotgun')).toEqual(['Shotgun Blast', 'Shotgun Pump Combo']);
    expect(using('pencil')).toEqual(['Pencil Strike']);
    expect(using('pistols')).toEqual(['Dual Pistols', 'Gun-Kata Spin', 'Baba Yaga']);
  });

  it('the wall run really leaves the ground', () => {
    const k = baba.moves.find((m) => m.name === 'Wall Run Shot')!.sequence![0];
    expect(Math.max(k.pose.frontFoot.y, k.pose.backFoot.y)).toBeLessThan(64);
  });

  it('facing left mirrors the shot and keeps the gun', () => {
    const m = baba.moves.find((x) => x.name === 'Double Tap')!;
    const left = getOrientedPose(m.pose, 'left');
    expect(left.prop).toBe('pistol');
    expect(left.shot).toBe('lead');
    expect(muzzlePoint(left, -1)!.x).toBeCloseTo(-muzzlePoint(m.pose, 1)!.x, 6);
  });

  it('the flash stops when the combo recovers to the stance', () => {
    const m = baba.moves.find((x) => x.name === 'Quick Draw')!;
    const end = comboFrame(comboDuration(m.sequence!) - 0.01, baba.idlePose, m.sequence!, baba.idlePose, 0, (p) => p);
    expect(end.pose.shot).toBeFalsy();
  });
});

describe('getMoveForCombo with a hero', () => {
  it('unlocks tougher moves as the combo grows, cycling through each tier', () => {
    expect(getMoveForCombo(0, 0, dragon.moves).tier).toBe(1);
    expect(getMoveForCombo(10, 0, dragon.moves).tier).toBe(2);
    expect(getMoveForCombo(20, 0, dragon.moves).tier).toBe(3);
    expect(getMoveForCombo(40, 0, dragon.moves).tier).toBe(4);
    expect(getMoveForCombo(60, 0, dragon.moves).tier).toBe(5);
    const tier1 = dragon.moves.filter((m) => m.tier === 1);
    expect(getMoveForCombo(0, 6, dragon.moves)).toBe(tier1[6 % tier1.length]);
  });

  it("falls back to the best tier a hero has when it hasn't got the target tier yet", () => {
    const onlyBasics: AttackMove[] = dragon.moves.filter((m) => m.tier <= 2);
    expect(getMoveForCombo(80, 0, onlyBasics).tier).toBe(2);
  });
});

describe('safeFold', () => {
  it('opens a limb folded exactly back on itself, and leaves others alone', () => {
    expect(safeFold({ upper: 110, lower: -70 }).lower).not.toBe(-70);
    expect(safeFold({ upper: 0, lower: 180 }).lower).not.toBe(180);
    expect(safeFold({ upper: 40, lower: -20 })).toEqual({ upper: 40, lower: -20 });
  });
});
