import { describe, expect, it } from 'vitest';
import { Point2D, SkeletonPose } from '../types/game';
import { getOrientedPose } from './animations';
import { COMBO_RECOVER_SEC, COMBO_SNAP_SEC, comboDuration, comboFrame } from './combo';
import { LIMB } from './enemyMotion';
import { getHero } from './heroes';
import { keyToPlayerPose } from './heroMoves/poseBuilder';

const dragon = getHero('dragon');
const rest = dragon.idlePose;
const dist = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);
const right = (p: SkeletonPose) => p;

function expectSamePose(a: SkeletonPose, b: SkeletonPose) {
  for (const k of ['head', 'chest', 'pelvis', 'leftHand', 'rightHand', 'leftFoot', 'rightFoot'] as const) {
    expect(a[k].x).toBeCloseTo(b[k].x, 2);
    expect(a[k].y).toBeCloseTo(b[k].y, 2);
  }
}

describe('combos', () => {
  const move = dragon.moves.find((m) => m.name === 'Hurricane Kick')!;
  const keys = move.sequence!;

  it('the first hit lands almost instantly, so it stays on your timing', () => {
    expect(COMBO_SNAP_SEC).toBeLessThanOrEqual(0.06);
    const f = comboFrame(COMBO_SNAP_SEC + 1e-9, rest, keys, rest, 16, right);
    expectSamePose(f.pose, keyToPlayerPose(keys[0]));
    expect(f.lungeX).toBeCloseTo(16, 6);
  });

  it('hits every keyframe exactly on its time, and recovers to the stance at the end', () => {
    let t = COMBO_SNAP_SEC;
    for (let i = 1; i < keys.length; i++) {
      t += keys[i].ms / 1000;
      expectSamePose(comboFrame(t - 1e-9, rest, keys, rest, 16, right).pose, keyToPlayerPose(keys[i]));
    }
    expect(comboDuration(keys)).toBeCloseTo(t + COMBO_RECOVER_SEC, 9);
    const end = comboFrame(comboDuration(keys), rest, keys, rest, 16, right);
    expectSamePose(end.pose, rest);
    expect(end.lungeX).toBeCloseTo(0, 6);
    expect(end.active).toBe(false);
  });

  it('limbs keep their length while swinging between keyframes', () => {
    for (let t = COMBO_SNAP_SEC; t < comboDuration(keys) - COMBO_RECOVER_SEC; t += 0.007) {
      const p = comboFrame(t, rest, keys, rest, 16, right).pose;
      expect(dist(p.leftShoulder, p.leftElbow)).toBeCloseTo(LIMB.upperArm, 2);
      expect(dist(p.pelvis, p.leftKnee)).toBeCloseTo(LIMB.thigh, 2);
      expect(dist(p.rightKnee, p.rightFoot)).toBeCloseTo(LIMB.shin, 2);
    }
  });

  it('striking left mirrors the whole combo', () => {
    const t = COMBO_SNAP_SEC + keys[1].ms / 1000 / 2;
    const r = comboFrame(t, rest, keys, rest, 16, right).pose;
    const l = comboFrame(t, getOrientedPose(rest, 'left'), keys, getOrientedPose(rest, 'left'), -16, (p) => getOrientedPose(p, 'left')).pose;
    expect(l.head.x).toBeCloseTo(-r.head.x, 6);
    expect(l.leftFoot.y).toBeCloseTo(r.rightFoot.y, 6);
  });
});
