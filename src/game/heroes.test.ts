import { describe, expect, it } from 'vitest';
import { AttackMove, Point2D, SkeletonPose } from '../types/game';
import { ATTACK_MOVES, getMoveForCombo, getOrientedPose } from './animations';
import { LIMB } from './enemyMotion';
import { DEFAULT_HERO, getHero, HEROES } from './heroes';
import { isHeroUnlocked } from './heroUnlocks';
import { keyToPlayerPose, safeFold } from './heroMoves/poseBuilder';
import { COMBO_SNAP_SEC, comboDuration, comboFrame } from './combo';
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

  it('holds every hit for a beat, and holds the final pose before recovering', () => {
    for (const m of baba.moves) {
      const seq = m.sequence!;
      seq.forEach((k, i) => {
        if (!k.trail || k.hold || i === seq.length - 1) return;
        expect(seq[i + 1].pose).toEqual(k.pose);
        expect(seq[i + 1].hold).toBe(true);
        // The hit's effect carries on through the hold
        expect(seq[i + 1].trail).toEqual(k.trail);
      });
      const [before, last] = seq.slice(-2);
      expect(last.pose).toEqual(before.pose);
      expect(last.ms).toBeGreaterThanOrEqual(150);
    }
  });

  it('every move is a combo whose first keyframe is the hit, landing toward the enemy', () => {
    for (const m of baba.moves) {
      expect(m.sequence!.length).toBeGreaterThanOrEqual(2);
      expect(m.sequence![0].trail).toBeDefined();
      expect(m.pose.bladeSlash!.end.x).toBeGreaterThan(m.pose.pelvis.x);
      for (const k of m.sequence!.slice(1)) expect(k.ms).toBeGreaterThan(0);
    }
  });

  it('keeps every move simple: a few big poses and at most two shots (finishers a little more)', () => {
    for (const m of baba.moves) {
      const finisher = m.tier === 5;
      // Holds repeat the pose before them; only count the real poses.
      const poses = m.sequence!.filter((k, i) => i === 0 || JSON.stringify(k.pose) !== JSON.stringify(m.sequence![i - 1].pose));
      expect(poses.length).toBeLessThanOrEqual(finisher ? 4 : 3);
      expect(m.sequence!.filter((k) => k.shot && !k.hold).length).toBeLessThanOrEqual(finisher ? 3 : 2);
    }
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
    expect(shots.length).toBeGreaterThan(15);
    for (const k of shots) {
      expect(k.trail).toBeDefined();
      expect(['pistol', 'pistols', 'shotgun']).toContain(k.prop);
    }
    // ...and the kicks, elbows and the pencil never do
    expect(allKeys.filter((k) => k.prop === 'pencil').some((k) => k.shot)).toBe(false);
  });

  it('the muzzle flash sits at the end of the gun that is firing', () => {
    const dual = baba.moves.find((m) => m.name === 'Dual Pistols')!.sequence!.filter((k) => k.shot && !k.hold).map((k) => keyToPlayerPose(k));
    // Lead hand fires first, then the rear hand
    expect(dist(muzzlePoint(dual[0], 1)!, dual[0].leftHand)).toBeCloseTo(18, 3);
    expect(dist(muzzlePoint(dual[1], 1)!, dual[1].rightHand)).toBeCloseTo(18, 3);
    const blast = keyToPlayerPose(baba.moves.find((m) => m.name === 'Shotgun Blast')!.sequence![0]);
    expect(dist(muzzlePoint(blast, 1)!, blast.leftHand)).toBeCloseTo(32, 3);
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

describe('The One', () => {
  const one = getHero('theOne');
  const realPoses = (m: AttackMove) =>
    m.sequence!.filter((k, i) => i === 0 || JSON.stringify(k.pose) !== JSON.stringify(m.sequence![i - 1].pose));

  it('has 21 moves spread over the 5 combo tiers (5, 5, 4, 4, 3), all with different names', () => {
    expect(one.moves).toHaveLength(21);
    const perTier = [1, 2, 3, 4, 5].map((t) => one.moves.filter((m) => m.tier === t).length);
    expect(perTier).toEqual([5, 5, 4, 4, 3]);
    expect(new Set(one.moves.map((m) => m.name)).size).toBe(21);
  });

  it('every pose keeps its limbs solid and stays above the floor, in every keyframe of every combo', () => {
    const poses = [one.idlePose, ...one.moves.flatMap((m) => [m.pose, ...m.sequence!.map((k) => keyToPlayerPose(k))])];
    for (const p of poses) {
      expectSolidLimbs(p);
      for (const q of [p.leftFoot, p.rightFoot, p.leftHand, p.rightHand, p.head]) {
        expect(q.y).toBeLessThanOrEqual(68 + 1e-6);
      }
    }
  });

  it('every move is a combo whose first keyframe is the hit, landing toward the enemy', () => {
    for (const m of one.moves) {
      expect(m.sequence!.length).toBeGreaterThanOrEqual(2);
      expect(m.sequence![0].trail).toBeDefined();
      expect(m.pose.bladeSlash!.end.x).toBeGreaterThan(m.pose.pelvis.x);
      for (const k of m.sequence!.slice(1)) expect(k.ms).toBeGreaterThan(0);
    }
  });

  it('keeps every move simple and holds its poses so they read', () => {
    for (const m of one.moves) {
      expect(realPoses(m).length).toBeLessThanOrEqual(m.tier === 5 ? 4 : 3);
      const [before, last] = m.sequence!.slice(-2);
      expect(last.pose).toEqual(before.pose);
      expect(last.ms).toBeGreaterThanOrEqual(150);
    }
  });

  it('never drifts far from his spot: the hips stay near the centre in every keyframe', () => {
    for (const m of one.moves) {
      for (const k of m.sequence!) expect(Math.abs(k.pose.pelvis.x)).toBeLessThanOrEqual(12);
    }
  });

  it('the tier 4 moves float: he stays off the floor for the whole combo', () => {
    const floating = one.moves.filter((m) => m.tier === 4);
    expect(floating).toHaveLength(4);
    for (const m of floating) {
      for (const k of m.sequence!) expect(Math.max(k.pose.frontFoot.y, k.pose.backFoot.y)).toBeLessThan(64);
    }
  });

  it('jumping moves really leave the ground', () => {
    for (const name of ['Wall-Run Kick', 'Corkscrew Kick', 'Flying Knee', 'Air Pirouette Kick', 'Superman Punch']) {
      const k = one.moves.find((m) => m.name === name)!.sequence![0];
      expect(Math.max(k.pose.frontFoot.y, k.pose.backFoot.y)).toBeLessThan(64);
    }
  });

  it('fights bare-handed', () => {
    expect(one.moves.every((m) => m.sequence!.every((k) => !k.prop && !k.shot))).toBe(true);
  });
});

describe('Drunken Master', () => {
  const dm = getHero('drunkenMaster');
  const realPoses = (m: AttackMove) =>
    m.sequence!.filter((k, i) => i === 0 || JSON.stringify(k.pose) !== JSON.stringify(m.sequence![i - 1].pose));

  it('has 21 moves spread over the 5 combo tiers (5, 5, 4, 4, 3), all with different names', () => {
    expect(dm.moves).toHaveLength(21);
    const perTier = [1, 2, 3, 4, 5].map((t) => dm.moves.filter((m) => m.tier === t).length);
    expect(perTier).toEqual([5, 5, 4, 4, 3]);
    expect(new Set(dm.moves.map((m) => m.name)).size).toBe(21);
  });

  it('every pose keeps its limbs solid and stays above the floor, in every keyframe of every combo', () => {
    const poses = [dm.idlePose, ...dm.moves.flatMap((m) => [m.pose, ...m.sequence!.map((k) => keyToPlayerPose(k))])];
    for (const p of poses) {
      expectSolidLimbs(p);
      for (const q of [p.leftFoot, p.rightFoot, p.leftHand, p.rightHand, p.head]) {
        expect(q.y).toBeLessThanOrEqual(68 + 1e-6);
      }
    }
  });

  it('every move is a combo whose first keyframe is the hit, landing toward the enemy', () => {
    for (const m of dm.moves) {
      expect(m.sequence!.length).toBeGreaterThanOrEqual(2);
      expect(m.sequence![0].trail).toBeDefined();
      expect(m.pose.bladeSlash!.end.x, m.name).toBeGreaterThan(m.pose.pelvis.x);
    }
  });

  it('keeps every move simple and holds its poses so they read', () => {
    for (const m of dm.moves) {
      expect(realPoses(m).length).toBeLessThanOrEqual(m.tier === 5 ? 4 : 3);
      const [before, last] = m.sequence!.slice(-2);
      expect(last.pose).toEqual(before.pose);
      expect(last.ms).toBeGreaterThanOrEqual(150);
    }
  });

  it('staggers about wildly, but his hips never drift far from his spot', () => {
    for (const m of dm.moves) {
      for (const k of m.sequence!) expect(Math.abs(k.pose.pelvis.x), m.name).toBeLessThanOrEqual(12);
    }
    // ...while the upper body really does lurch: some moves lean far over each way
    const leans = dm.moves.flatMap((m) => m.sequence!.map((k) => k.pose.chest.x - k.pose.pelvis.x));
    expect(Math.max(...leans)).toBeGreaterThan(15);
    expect(Math.min(...leans)).toBeLessThan(-15);
  });

  it('never lets go of his gourd; it swings on its string and the bench comes out only for their own moves', () => {
    for (const m of dm.moves) for (const k of m.sequence!) expect(['gourd', 'gourdSwing', 'bench']).toContain(k.prop);
    const using = (prop: string) => dm.moves.filter((m) => m.sequence!.some((k) => k.prop === prop)).map((m) => m.name);
    expect(using('gourdSwing')).toEqual(['Gourd Swing Combo']);
    expect(using('bench')).toEqual(['Bench Smash']);
  });

  it('drinks from the gourd in his stance: the rear hand is up at his mouth', () => {
    const idle = dm.idlePose;
    expect(dist(idle.rightHand, idle.head)).toBeLessThan(12);
  });

  it('jumping moves really leave the ground, and he really does fall over', () => {
    for (const name of ['Lean-and-Leap', 'Drunken Monkey Climb']) {
      const k = dm.moves.find((m) => m.name === name)!.sequence![0];
      expect(Math.max(k.pose.frontFoot.y, k.pose.backFoot.y)).toBeLessThan(64);
    }
    // Out cold: lying flat, head down near the floor
    const out = dm.moves.find((m) => m.name === 'Wake-Up Uppercut')!.sequence!.find((k) => k.ms >= 250)!;
    expect(out.pose.head.y).toBeGreaterThan(40);
  });
});

describe('The Pro Wrestler', () => {
  const pw = getHero('proWrestler');
  const realPoses = (m: AttackMove) =>
    m.sequence!.filter((k, i) => i === 0 || JSON.stringify(k.pose) !== JSON.stringify(m.sequence![i - 1].pose));

  it('has 21 moves spread over the 5 combo tiers (5, 5, 4, 4, 3), all with different names', () => {
    expect(pw.moves).toHaveLength(21);
    const perTier = [1, 2, 3, 4, 5].map((t) => pw.moves.filter((m) => m.tier === t).length);
    expect(perTier).toEqual([5, 5, 4, 4, 3]);
    expect(new Set(pw.moves.map((m) => m.name)).size).toBe(21);
  });

  it('every pose keeps its limbs solid and stays above the floor, in every keyframe of every combo', () => {
    const poses = [pw.idlePose, ...pw.moves.flatMap((m) => [m.pose, ...m.sequence!.map((k) => keyToPlayerPose(k))])];
    for (const p of poses) {
      expectSolidLimbs(p);
      for (const q of [p.leftFoot, p.rightFoot, p.leftHand, p.rightHand, p.head]) {
        expect(q.y).toBeLessThanOrEqual(68 + 1e-6);
      }
    }
  });

  it('every move is a combo whose first keyframe is the hit, landing toward the enemy', () => {
    for (const m of pw.moves) {
      expect(m.sequence!.length).toBeGreaterThanOrEqual(2);
      expect(m.sequence![0].trail).toBeDefined();
      expect(m.pose.bladeSlash!.end.x, m.name).toBeGreaterThan(m.pose.pelvis.x);
    }
  });

  it('keeps every move simple and holds its poses so they read', () => {
    for (const m of pw.moves) {
      expect(realPoses(m).length).toBeLessThanOrEqual(m.tier === 5 ? 4 : 3);
      const [before, last] = m.sequence!.slice(-2);
      expect(last.pose).toEqual(before.pose);
      expect(last.ms).toBeGreaterThanOrEqual(150);
    }
  });

  it('never drifts far from his spot: the hips stay near the centre in every keyframe', () => {
    for (const m of pw.moves) {
      for (const k of m.sequence!) expect(Math.abs(k.pose.pelvis.x), m.name).toBeLessThanOrEqual(12);
    }
  });

  it('the slams are marked, and every slam drives him down toward the mat', () => {
    const slams = pw.moves.filter((m) => m.slam);
    expect(slams.length).toBeGreaterThanOrEqual(10);
    expect(slams.map((m) => m.name)).toEqual(expect.arrayContaining(['Suplex', 'Powerbomb', 'Piledriver Drop', 'Championship Finisher']));
    for (const m of slams) {
      const lowest = Math.max(...m.sequence!.map((k) => k.pose.pelvis.y));
      expect(lowest, m.name).toBeGreaterThan(30);
    }
    // The plain strikes are not slams
    expect(pw.moves.find((m) => m.name === 'Chop')!.slam).toBeFalsy();
  });

  it('lifts them overhead before the big slams', () => {
    for (const name of ['Powerbomb', 'Suplex', 'Championship Finisher']) {
      const keys = pw.moves.find((m) => m.name === name)!.sequence!;
      const highestHands = Math.min(...keys.map((k) => Math.min(k.pose.frontHand.y, k.pose.backHand.y)));
      expect(highestHands, name).toBeLessThan(keys[0].pose.head.y);
    }
  });

  it('the flat double dropkick is a finisher, and the shoulder-first Spear is mid-level', () => {
    const dropkick = pw.moves.find((m) => m.name === 'Flying Double Dropkick')!;
    expect(dropkick.tier).toBe(5);
    // Flat out in the air, both feet driving forward together
    const k = dropkick.sequence![0].pose;
    expect(Math.abs(k.frontFoot.y - k.backFoot.y)).toBeLessThan(10);
    expect(Math.min(k.frontFoot.x, k.backFoot.x)).toBeGreaterThan(k.pelvis.x + 40);
    expect(Math.abs(k.chest.y - k.pelvis.y)).toBeLessThan(12);

    const spear = pw.moves.find((m) => m.name === 'Spear')!;
    expect(spear.tier).toBe(3);
    // Bent almost flat, head driving forward, one leg kicked up behind
    const s = spear.sequence![0].pose;
    expect(s.head.x).toBeGreaterThan(s.pelvis.x + 40);
    expect(Math.min(s.frontFoot.y, s.backFoot.y)).toBeLessThan(s.pelvis.y);
  });

  it('the steel chair comes out for the chair shot only, in both hands', () => {
    const withChair = pw.moves.filter((m) => m.sequence!.some((k) => k.prop === 'chair'));
    expect(withChair.map((m) => m.name)).toEqual(['Steel Chair Shot']);
    for (const k of withChair[0].sequence!) expect(dist(k.pose.frontHand, k.pose.backHand)).toBeLessThan(14);
  });

  it('jumping moves really leave the ground', () => {
    for (const name of ['Flying Double Dropkick', 'Flying Crossbody', 'Moonsault', 'Flying Elbow from the Top Rope']) {
      const k = pw.moves.find((m) => m.name === name)!.sequence![0];
      expect(Math.max(k.pose.frontFoot.y, k.pose.backFoot.y), name).toBeLessThan(64);
    }
  });
});

describe('The White Swan', () => {
  const pb = getHero('ballerina');
  const realPoses = (m: AttackMove) =>
    m.sequence!.filter((k, i) => i === 0 || JSON.stringify(k.pose) !== JSON.stringify(m.sequence![i - 1].pose));

  it('has 21 moves spread over the 5 combo tiers (5, 5, 4, 4, 3), all with different names', () => {
    expect(pb.moves).toHaveLength(21);
    const perTier = [1, 2, 3, 4, 5].map((t) => pb.moves.filter((m) => m.tier === t).length);
    expect(perTier).toEqual([5, 5, 4, 4, 3]);
    expect(new Set(pb.moves.map((m) => m.name)).size).toBe(21);
  });

  it('every pose keeps its limbs solid and stays above the floor, in every keyframe of every combo', () => {
    const poses = [pb.idlePose, ...pb.moves.flatMap((m) => [m.pose, ...m.sequence!.map((k) => keyToPlayerPose(k))])];
    for (const p of poses) {
      expectSolidLimbs(p);
      for (const q of [p.leftFoot, p.rightFoot, p.leftHand, p.rightHand, p.head]) {
        expect(q.y).toBeLessThanOrEqual(68 + 1e-6);
      }
    }
  });

  it('every move is a combo whose first keyframe is the hit, landing toward the enemy', () => {
    for (const m of pb.moves) {
      expect(m.sequence!.length).toBeGreaterThanOrEqual(2);
      expect(m.sequence![0].trail).toBeDefined();
      expect(m.pose.bladeSlash!.end.x, m.name).toBeGreaterThan(m.pose.pelvis.x);
    }
  });

  it('keeps every move simple and holds its poses so they read', () => {
    for (const m of pb.moves) {
      expect(realPoses(m).length).toBeLessThanOrEqual(m.tier === 5 ? 4 : 3);
      const [before, last] = m.sequence!.slice(-2);
      expect(last.pose).toEqual(before.pose);
      expect(last.ms).toBeGreaterThanOrEqual(150);
    }
  });

  it('never drifts far from her spot: the hips stay near the centre in every keyframe', () => {
    for (const m of pb.moves) {
      for (const k of m.sequence!) expect(Math.abs(k.pose.pelvis.x), m.name).toBeLessThanOrEqual(12);
    }
  });

  it('her stance is the drawn pose: hands joined above her head, legs in a diamond', () => {
    const idle = pb.idlePose;
    // Hands meet, above the head
    expect(dist(idle.leftHand, idle.rightHand)).toBeLessThan(2);
    expect(idle.leftHand.y).toBeLessThan(idle.head.y);
    // Elbows rounded out either side
    expect(Math.abs(idle.leftElbow.x - idle.rightElbow.x)).toBeGreaterThan(15);
    // Diamond legs: feet together, knees turned out wide
    expect(Math.abs(idle.leftFoot.x - idle.rightFoot.x)).toBeLessThan(10);
    expect(Math.abs(idle.leftKnee.x - idle.rightKnee.x)).toBeGreaterThan(30);
    expect(idle.leftFoot.y).toBeCloseTo(68, 0);
  });

  it('in her normal form (tiers 1-4) she never breaks the pose: hands joined overhead, only kicking', () => {
    for (const m of pb.moves.filter((x) => x.tier <= 4)) {
      for (const k of m.sequence!) {
        const p = keyToPlayerPose(k);
        expect(dist(p.leftHand, p.rightHand), m.name).toBeLessThan(2);
        expect(p.leftHand.y, m.name).toBeLessThan(p.head.y);
        // Every hit is a kick, never a punch
        if (k.trail) expect(dist(k.trail.end, p.head), m.name).toBeGreaterThan(20);
      }
      for (const k of m.sequence!.filter((x) => x.trail)) {
        const p = keyToPlayerPose(k);
        const footEnd = Math.min(dist(k.trail!.end, p.leftFoot), dist(k.trail!.end, p.rightFoot));
        expect(footEnd, m.name).toBeLessThan(30);
      }
    }
  });

  it('kicks both ways: out to the enemy, and back out the other side', () => {
    const lowTiers = pb.moves.filter((m) => m.tier <= 4).flatMap((m) => m.sequence!.filter((k) => k.trail));
    const toEnemy = lowTiers.filter((k) => k.trail!.end.x > k.pose.pelvis.x);
    const otherSide = lowTiers.filter((k) => k.trail!.end.x < k.pose.pelvis.x);
    expect(toEnemy.length).toBeGreaterThan(15);
    expect(otherSide.length).toBeGreaterThanOrEqual(4);
  });

  it('really kicks to the ceiling: the grand battements put the foot above her head', () => {
    for (const name of ['Grand Battement', 'Curtain Call']) {
      const k = pb.moves.find((m) => m.name === name)!.sequence![0].pose;
      expect(k.frontFoot.y, name).toBeLessThan(k.head.y);
    }
  });

  it('her swan-tutu finishers are the full ballet: Swan Lake opens with a flying split leap', () => {
    const jete = pb.moves.find((m) => m.name === 'Swan Lake')!.sequence![0].pose;
    expect(Math.max(jete.frontFoot.y, jete.backFoot.y)).toBeLessThan(64);
    expect(jete.frontFoot.x - jete.backFoot.x).toBeGreaterThan(100);
  });

  it('the turning steps are marked for a spin blur, and the plain kicks are not', () => {
    const spins = pb.moves.filter((m) => m.sequence!.some((k) => k.pose && keyToPlayerPose(k).spin));
    expect(spins.map((m) => m.name)).toEqual(expect.arrayContaining(['Fouetté Kick', 'Black Swan']));
    expect(spins.map((m) => m.name)).not.toContain('Grand Battement');
  });

  it('dances bare-handed', () => {
    expect(pb.moves.every((m) => m.sequence!.every((k) => !k.prop))).toBe(true);
  });
});

describe('The Stallion', () => {
  const st = getHero('stallion');
  const realPoses = (m: AttackMove) =>
    m.sequence!.filter((k, i) => i === 0 || JSON.stringify(k.pose) !== JSON.stringify(m.sequence![i - 1].pose));

  it('has 18 moves spread over the 5 combo tiers (5, 5, 4, 1, 3), all with different names', () => {
    expect(st.moves).toHaveLength(18);
    const perTier = [1, 2, 3, 4, 5].map((t) => st.moves.filter((m) => m.tier === t).length);
    expect(perTier).toEqual([5, 5, 4, 1, 3]); // tier 4 is one move: the skipping rope
    expect(new Set(st.moves.map((m) => m.name)).size).toBe(18);
  });

  it('every pose keeps its limbs solid and stays above the floor, in every keyframe of every combo', () => {
    const poses = [st.idlePose, ...st.moves.flatMap((m) => [m.pose, ...m.sequence!.map((k) => keyToPlayerPose(k))])];
    for (const p of poses) {
      expectSolidLimbs(p);
      for (const q of [p.leftFoot, p.rightFoot, p.leftHand, p.rightHand, p.head]) {
        expect(q.y).toBeLessThanOrEqual(68 + 1e-6);
      }
    }
  });

  it('every move is a combo whose first keyframe is the hit, landing toward the enemy', () => {
    for (const m of st.moves) {
      expect(m.sequence!.length).toBeGreaterThanOrEqual(2);
      expect(m.sequence![0].trail).toBeDefined();
      expect(m.pose.bladeSlash!.end.x, m.name).toBeGreaterThan(m.pose.pelvis.x);
    }
  });

  it('keeps every move simple and holds its poses so they read', () => {
    for (const m of st.moves) {
      expect(realPoses(m).length).toBeLessThanOrEqual(m.tier === 5 ? 4 : 3);
      const [before, last] = m.sequence!.slice(-2);
      expect(last.pose).toEqual(before.pose);
      expect(last.ms).toBeGreaterThanOrEqual(150);
    }
  });

  it('never drifts far from his spot: the hips stay near the centre in every keyframe', () => {
    for (const m of st.moves) {
      for (const k of m.sequence!) expect(Math.abs(k.pose.pelvis.x), m.name).toBeLessThanOrEqual(12);
    }
  });

  it('is a boxer: every hit is a punch, and his feet stay planted', () => {
    for (const m of st.moves) {
      for (const k of m.sequence!) {
        if (k.trail) expect(Math.min(dist(k.trail.end, k.pose.frontHand), dist(k.trail.end, k.pose.backHand)), m.name).toBeLessThan(30);
        // No kicks, no jumps (rising onto the toes behind a punch is fine; skipping rope hops)
        if (m.name !== 'Skipping Rope') expect(Math.min(k.pose.frontFoot.y, k.pose.backFoot.y), m.name).toBeGreaterThan(64);
      }
    }
  });

  it('stands in a boxing guard: both gloves up by his chin', () => {
    const idle = st.idlePose;
    for (const hand of [idle.leftHand, idle.rightHand]) {
      expect(dist(hand, idle.head)).toBeLessThan(26);
      expect(hand.y).toBeLessThan(idle.chest.y);
    }
  });

  it('is earned by completing 3 songs', () => {
    const later = (n: number) => ({ enemiesDefeated: 0, perfects: 0, bestCombo: 0, songsCleared: n, playSeconds: 0, adUnlocks: 0 });
    expect(isHeroUnlocked('stallion', later(2))).toBe(false);
    expect(isHeroUnlocked('stallion', later(3))).toBe(true);
  });
});

describe('hit effects on held combos', () => {
  it("never blink off and back on during one hit: the trail stays on from the hit through its hold", () => {
    for (const hero of [getHero('babaYaga'), getHero('theOne'), getHero('drunkenMaster'), getHero('proWrestler'), getHero('ballerina'), getHero('stallion')]) {
      for (const m of hero.moves) {
        const keys = m.sequence!;
        const total = comboDuration(keys);
        let wasOn = false;
        let offs = 0;
        // Sample every 5 ms; count how often the effect switches off while a later key still has one
        for (let t = 0; t < total; t += 0.005) {
          const on = !!comboFrame(t, hero.idlePose, keys, hero.idlePose, 0, (p) => p).pose.bladeSlash;
          if (wasOn && !on) offs++;
          wasOn = on;
        }
        // Once per real hit at most (hits separated by a non-hit pose), never more
        const hits = keys.filter((k) => k.trail && !k.hold).length;
        expect(offs, `${hero.label}: ${m.name}`).toBeLessThanOrEqual(hits);
      }
    }
  });

  it('the first hit still shows its effect from the very first frame', () => {
    const one = getHero('theOne');
    const m = one.moves[0];
    const f = comboFrame(COMBO_SNAP_SEC / 2, one.idlePose, m.sequence!, one.idlePose, 0, (p) => p);
    expect(f.pose.bladeSlash).toBeDefined();
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
