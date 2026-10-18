import { describe, expect, it } from 'vitest';
import { FLOOR, LIMB, Point } from './enemyMotion';
import { ENEMY_KEYS, HIP_ZONE, parseLibrary, sampleAnimation } from './customAnimation';
import { SIGNATURE_DANCE_NAMES, SIGNATURE_DANCES } from './signatureDances';

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

describe('signature dances', () => {
  it('every one of the 9 enemies has its own named dance', () => {
    for (const key of ENEMY_KEYS) {
      expect(SIGNATURE_DANCES[key]?.dance?.poses.length).toBeGreaterThan(1);
      expect(SIGNATURE_DANCE_NAMES[key]).toBeTruthy();
    }
    expect(new Set(Object.values(SIGNATURE_DANCE_NAMES)).size).toBe(9);
  });

  it('pass the same checks as a file loaded from disk, unchanged', () => {
    expect(parseLibrary(SIGNATURE_DANCES)).toEqual(SIGNATURE_DANCES);
  });

  for (const key of ENEMY_KEYS) {
    it(`${SIGNATURE_DANCE_NAMES[key]}: stays in time, on the floor and in one piece`, () => {
      const anim = SIGNATURE_DANCES[key]!.dance!;
      const loop = anim.poses.length * anim.beatsPerPose;
      for (let beat = 0; beat < loop; beat += 0.05) {
        const p = sampleAnimation(anim, beat);
        // The hips never leave the timing zone, so the enemy never looks early or late.
        expect(Math.abs(p.pelvis.x)).toBeLessThanOrEqual(HIP_ZONE + 1e-9);
        // Nothing goes through the floor.
        for (const q of [p.frontFoot, p.backFoot, p.frontHand, p.backHand, p.frontKnee, p.backKnee]) {
          expect(q.y).toBeLessThanOrEqual(FLOOR + 1e-6);
        }
        // Limbs keep their length.
        expect(dist(p.frontShoulder, p.frontElbow)).toBeCloseTo(LIMB.upperArm, 3);
        expect(dist(p.frontElbow, p.frontHand)).toBeCloseTo(LIMB.forearm, 3);
        expect(dist(p.pelvis, p.backKnee)).toBeCloseTo(LIMB.thigh, 3);
        expect(dist(p.backKnee, p.backFoot)).toBeCloseTo(LIMB.shin, 3);
      }
    });
  }
});
