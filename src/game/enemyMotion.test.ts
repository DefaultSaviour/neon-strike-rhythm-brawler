import { describe, expect, it } from 'vitest';
import { armByAngles, ENEMY_MOTION_STYLES, EnemyMotionStyle, enemyPose, LIMB, solveTwoBone } from './enemyMotion';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const styles: EnemyMotionStyle[] = ['stand', 'run', 'dance', 'sway', 'handstand'];
const builds = ['heavy', 'samurai', 'agile'] as const;

describe('solveTwoBone', () => {
  it('keeps both segments at their exact length when the target is reachable', () => {
    const { joint, end } = solveTwoBone({ x: 0, y: 0 }, { x: 20, y: 30 }, 25, 25, 1);
    expect(dist({ x: 0, y: 0 }, joint)).toBeCloseTo(25);
    expect(dist(joint, end)).toBeCloseTo(25);
    expect(end.x).toBeCloseTo(20);
    expect(end.y).toBeCloseTo(30);
  });

  it('reaches straight toward a target that is too far away', () => {
    const { end } = solveTwoBone({ x: 0, y: 0 }, { x: 0, y: -200 }, 20, 20, 1);
    expect(end.y).toBeCloseTo(-40, 3);
    expect(end.x).toBeCloseTo(0);
  });

  it('bend flips which side the joint pops out to', () => {
    const a = solveTwoBone({ x: 0, y: 0 }, { x: 0, y: 40 }, 30, 30, 1).joint;
    const b = solveTwoBone({ x: 0, y: 0 }, { x: 0, y: 40 }, 30, 30, -1).joint;
    expect(Math.sign(a.x)).toBe(-Math.sign(b.x));
  });
});

describe('enemyPose', () => {
  it('every style keeps limbs at a constant length (no stretchy arms)', () => {
    for (const style of styles) {
      for (const build of builds) {
        for (let beat = 0; beat < 4; beat += 0.13) {
          const p = enemyPose(style, beat, build);
          expect(dist(p.frontShoulder, p.frontElbow)).toBeCloseTo(LIMB.upperArm, 3);
          expect(dist(p.frontElbow, p.frontHand)).toBeCloseTo(LIMB.forearm, 3);
          expect(dist(p.pelvis, p.frontKnee)).toBeCloseTo(LIMB.thigh, 3);
          expect(dist(p.backKnee, p.backFoot)).toBeCloseTo(LIMB.shin, 3);
        }
      }
    }
  });

  it('feet never go below the floor', () => {
    for (const style of styles) {
      for (let beat = 0; beat < 4; beat += 0.1) {
        const p = enemyPose(style, beat, 'heavy');
        expect(p.frontFoot.y).toBeLessThanOrEqual(68.001);
        expect(p.backFoot.y).toBeLessThanOrEqual(68.001);
      }
    }
  });

  it('knees bend forward, like real knees', () => {
    for (const style of styles) {
      const p = enemyPose(style, 0.3, 'samurai');
      const midX = (p.pelvis.x + p.frontFoot.x) / 2;
      expect(p.frontKnee.x).toBeGreaterThanOrEqual(midX - 0.5);
    }
  });

  it('stand keeps both feet planted', () => {
    for (let beat = 0; beat < 2; beat += 0.1) {
      const p = enemyPose('stand', beat, 'agile');
      expect(p.frontFoot.y).toBeCloseTo(68);
      expect(p.backFoot.y).toBeCloseTo(68);
    }
  });

  it('run lifts alternate feet, landing exactly on the beats', () => {
    const halfway = (k: number) => enemyPose('run', k + 0.5, 'heavy');
    expect(halfway(0).frontFoot.y).toBeLessThan(55); // front knee up between beats 0 and 1
    expect(halfway(0).backFoot.y).toBeCloseTo(68);
    expect(halfway(1).backFoot.y).toBeLessThan(55); // then the other leg
    expect(halfway(1).frontFoot.y).toBeCloseTo(68);
    const onBeat = enemyPose('run', 3, 'heavy');
    expect(onBeat.frontFoot.y).toBeCloseTo(68);
    expect(onBeat.backFoot.y).toBeCloseTo(68);
  });

  it('dance raises one arm on each beat, taking turns', () => {
    const even = enemyPose('dance', 2, 'samurai');
    const odd = enemyPose('dance', 3, 'samurai');
    expect(even.frontHand.y).toBeLessThan(even.head.y);
    expect(even.backHand.y).toBeGreaterThan(even.chest.y);
    expect(odd.backHand.y).toBeLessThan(odd.head.y);
    expect(odd.frontHand.y).toBeGreaterThan(odd.chest.y);
  });

  it('hands-up faces the camera: one hand each side of the head, feet apart', () => {
    for (let beat = 0; beat < 4; beat += 0.25) {
      const p = enemyPose('sway', beat, 'agile');
      expect(p.facingCamera).toBe(true);
      expect(p.frontHand.x).toBeGreaterThan(p.head.x + 5);
      expect(p.backHand.x).toBeLessThan(p.head.x - 5);
      expect(p.frontHand.y).toBeLessThan(p.head.y);
      expect(p.backHand.y).toBeLessThan(p.head.y);
      expect(p.frontFoot.x).toBeGreaterThan(p.pelvis.x);
      expect(p.backFoot.x).toBeLessThan(p.pelvis.x);
      // Elbows and knees point outward, away from the centre line.
      expect(p.frontElbow.x).toBeGreaterThan(p.frontShoulder.x);
      expect(p.backElbow.x).toBeLessThan(p.backShoulder.x);
      expect(p.frontKnee.x).toBeGreaterThan(p.pelvis.x);
      expect(p.backKnee.x).toBeLessThan(p.pelvis.x);
    }
  });

  it('hands-up bends knees and elbows on the beat and straightens between beats', () => {
    const onBeat = enemyPose('sway', 2, 'samurai');
    const between = enemyPose('sway', 2.8, 'samurai');
    // Knees bend = hip comes closer to the foot.
    expect(onBeat.frontFoot.y - onBeat.pelvis.y).toBeLessThan(between.frontFoot.y - between.pelvis.y - 4);
    // Elbows bend = hand comes closer to the shoulder.
    const reach = (p: typeof onBeat) => Math.hypot(p.frontHand.x - p.frontShoulder.x, p.frontHand.y - p.frontShoulder.y);
    expect(reach(onBeat)).toBeLessThan(reach(between) - 4);
  });

  it('only the hands-up pose faces the camera', () => {
    for (const style of ['stand', 'run', 'dance'] as const) {
      expect(enemyPose(style, 1, 'heavy').facingCamera).toBe(false);
    }
  });

  it('repeats every two beats, so the motion stays in time for the whole song', () => {
    for (const style of styles) {
      const period = style === 'sway' ? 4 : 2;
      const a = enemyPose(style, 1.37, 'heavy');
      const b = enemyPose(style, 1.37 + period * 10, 'heavy');
      expect(b.frontHand.x).toBeCloseTo(a.frontHand.x, 6);
      expect(b.pelvis.y).toBeCloseTo(a.pelvis.y, 6);
    }
  });

  it('run: arms swing around the shoulders, elbows held bent, opposite to the legs', () => {
    const angle = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.atan2(b.y - a.y, b.x - a.x);
    const elbowBend = (p: ReturnType<typeof enemyPose>) => {
      const d = angle(p.frontElbow, p.frontHand) - angle(p.frontShoulder, p.frontElbow);
      return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
    };
    const frontKneeUp = enemyPose('run', 0.5, 'samurai'); // front knee up...
    const backKneeUp = enemyPose('run', 1.5, 'samurai');
    // ...so the front arm is swung BACK (elbow behind the shoulder), and vice versa.
    expect(frontKneeUp.frontElbow.x).toBeLessThan(frontKneeUp.frontShoulder.x - 5);
    expect(backKneeUp.frontElbow.x).toBeGreaterThan(backKneeUp.frontShoulder.x + 5);
    // The elbow stays bent at roughly a right angle all through the swing.
    for (let beat = 0; beat < 2; beat += 0.1) {
      expect(elbowBend(enemyPose('run', beat, 'agile'))).toBeGreaterThan(Math.PI / 4);
    }
  });

  it('run: the lifted knee drives up high', () => {
    const p = enemyPose('run', 0.5, 'heavy');
    expect(p.frontKnee.y).toBeLessThan(p.pelvis.y + 20);
    expect(p.frontKnee.x).toBeGreaterThan(p.pelvis.x + 15);
  });

  it('hands-up: both arms wave the same way together, in time with the sway', () => {
    const left = enemyPose('sway', 3, 'agile'); // swayed to -x
    const right = enemyPose('sway', 1, 'agile'); // swayed to +x
    expect(right.frontHand.x).toBeGreaterThan(left.frontHand.x + 5);
    expect(right.backHand.x).toBeGreaterThan(left.backHand.x + 5);
  });

  it('armByAngles puts the elbow and hand where the angles say, and the IK agrees', () => {
    const shoulder = { x: 0, y: 0 };
    const { hand, bend } = armByAngles(shoulder, 90, 0); // upper arm straight down, forearm forward
    expect(hand.x).toBeCloseTo(LIMB.forearm, 6);
    expect(hand.y).toBeCloseTo(LIMB.upperArm, 6);
    const { joint } = solveTwoBone(shoulder, hand, LIMB.upperArm, LIMB.forearm, bend);
    expect(joint.x).toBeCloseTo(0, 6);
    expect(joint.y).toBeCloseTo(LIMB.upperArm, 6);
  });

  it('handstand: hands planted on the floor, head hanging between them, legs in the air', () => {
    for (let beat = 0; beat < 2; beat += 0.1) {
      const p = enemyPose('handstand', beat, 'samurai');
      expect(p.upsideDown).toBe(true);
      expect(p.frontHand.y).toBeCloseTo(68, 6);
      expect(p.backHand.y).toBeCloseTo(68, 6);
      expect(p.head.y).toBeGreaterThan(p.chest.y); // head below the chest
      expect(p.head.y).toBeLessThan(68 - 8); // ...but clear of the floor
      expect(p.pelvis.y).toBeLessThan(p.chest.y); // hips above the shoulders
      expect(Math.max(p.frontFoot.y, p.backFoot.y)).toBeLessThan(p.pelvis.y); // feet up in the air
    }
  });

  it('handstand: legs scissor from beat to beat, and the elbows dip on the beat', () => {
    const a = enemyPose('handstand', 0.5, 'agile');
    const b = enemyPose('handstand', 1.5, 'agile');
    expect(a.frontFoot.x).toBeGreaterThan(a.backFoot.x + 20);
    expect(b.backFoot.x).toBeGreaterThan(b.frontFoot.x + 20);
    expect(enemyPose('handstand', 1, 'agile').chest.y).toBeGreaterThan(enemyPose('handstand', 1.8, 'agile').chest.y + 3);
  });

  it('only the handstand is upside down', () => {
    for (const style of ['stand', 'run', 'dance', 'sway'] as const) {
      expect(enemyPose(style, 1, 'heavy').upsideDown).toBeFalsy();
    }
  });

  it('lists every style once for the options menu', () => {
    expect(ENEMY_MOTION_STYLES.map((s) => s.id).sort()).toEqual([...styles].sort());
  });
});
