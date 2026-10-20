import { PoseRig } from '../enemyMotion';
import type { HeroPoseEdit } from '../heroPoses';

/**
 * The Saw Face finisher poses drawn in the Pose Studio by the designer. They
 * replace the built-in keyframes of the moves named here (see sawFace.ts);
 * each pose keeps the hit effect of the keyframe it replaces.
 */

/** A studio rig: joint positions, plus which way each elbow and knee bends (front arm, back arm, front leg, back leg). */
function pose(p: Omit<PoseRig, 'bends' | 'shoulderSpread'>, [frontArm, backArm, frontLeg, backLeg]: number[]): PoseRig {
  return { ...p, bends: { frontArm, backArm, frontLeg, backLeg }, shoulderSpread: 3 } as PoseRig;
}

export const SAW_FACE_POSE_EDITS: Record<string, HeroPoseEdit> = {
  'Sunset Dance': {
    ms: [0, 110, 160, 120],
    poses: [
      pose({ pelvis: { x: -2.9, y: 11.3 }, chest: { x: -2.2, y: -18.6 }, head: { x: -1.6, y: -44.6 }, frontHand: { x: 2.2, y: -11 }, backHand: { x: 13.4, y: -15.8 }, frontFoot: { x: 23.5, y: 66.9 }, backFoot: { x: -28.1, y: 65.5 } }, [-1, 1, -1, 1]),
      pose({ pelvis: { x: -8, y: 12 }, chest: { x: -12.2, y: -17.7 }, head: { x: -20.2, y: -42.4 }, frontHand: { x: 25, y: -14 }, backHand: { x: 15.7, y: -18.6 }, frontFoot: { x: 34.7, y: 44.3 }, backFoot: { x: -16, y: 68 } }, [-1, 1, -1, -1]),
      pose({ pelvis: { x: -12, y: 12 }, chest: { x: -19.3, y: -17.1 }, head: { x: -28.2, y: -41.5 }, frontHand: { x: 9.7, y: -48.1 }, backHand: { x: 4.1, y: -37.6 }, frontFoot: { x: 0, y: 68 }, backFoot: { x: -47.7, y: 61.6 } }, [1, 1, -1, 1]),
      pose({ pelvis: { x: -12, y: 12 }, chest: { x: -19.3, y: -17.1 }, head: { x: -28.2, y: -41.5 }, frontHand: { x: -16.6, y: -32.6 }, backHand: { x: -8, y: -28.1 }, frontFoot: { x: 0, y: 68 }, backFoot: { x: -47.7, y: 61.6 } }, [1, 1, -1, 1]),
    ],
  },
  'Dinner Time': {
    ms: [0, 90, 110, 160],
    poses: [
      pose({ pelvis: { x: -2, y: 22 }, chest: { x: 9.2, y: -5.8 }, head: { x: 19, y: -29.9 }, frontHand: { x: 43.5, y: -32.8 }, backHand: { x: 38.9, y: -25.4 }, frontFoot: { x: 24, y: 68 }, backFoot: { x: -28, y: 68 } }, [1, 1, -1, -1]),
      pose({ pelvis: { x: -2, y: 22 }, chest: { x: 8.3, y: -6.2 }, head: { x: 17.2, y: -30.6 }, frontHand: { x: 28.5, y: -43.5 }, backHand: { x: 28.4, y: -40.2 }, frontFoot: { x: 24, y: 68 }, backFoot: { x: -28, y: 68 } }, [1, 1, -1, -1]),
      pose({ pelvis: { x: -8, y: 12 }, chest: { x: -12.2, y: -17.7 }, head: { x: -20.2, y: -42.4 }, frontHand: { x: 3.6, y: -54.9 }, backHand: { x: 3.2, y: -42.9 }, frontFoot: { x: 20, y: 54.6 }, backFoot: { x: -16, y: 68 } }, [1, 1, -1, -1]),
      pose({ pelvis: { x: -12, y: 12 }, chest: { x: -19.3, y: -17.1 }, head: { x: -28.2, y: -41.5 }, frontHand: { x: 9.7, y: -48.1 }, backHand: { x: 4.1, y: -37.6 }, frontFoot: { x: 0, y: 68 }, backFoot: { x: -47.7, y: 61.6 } }, [1, 1, -1, 1]),
    ],
  },
  'Last Light': {
    ms: [0, 40, 110, 160],
    poses: [
      pose({ pelvis: { x: -10, y: 16 }, chest: { x: -9, y: -14 }, head: { x: -28.2, y: -31.5 }, frontHand: { x: -17.6, y: -52.1 }, backHand: { x: -14.3, y: -50.9 }, frontFoot: { x: 20.3, y: 68 }, backFoot: { x: -40.8, y: 68 } }, [-1, 1, -1, 1]),
      pose({ pelvis: { x: -10.6, y: 11.1 }, chest: { x: -7.4, y: -18.7 }, head: { x: -8.3, y: -44.7 }, frontHand: { x: 27.6, y: -44.6 }, backHand: { x: 19.2, y: -35.9 }, frontFoot: { x: 14, y: 68 }, backFoot: { x: -38, y: 67.8 } }, [1, 1, -1, -1]),
      pose({ pelvis: { x: -12, y: 12 }, chest: { x: -19.3, y: -17.1 }, head: { x: -28.2, y: -41.5 }, frontHand: { x: 9.7, y: -48.1 }, backHand: { x: 4.1, y: -37.6 }, frontFoot: { x: 0, y: 68 }, backFoot: { x: -47.7, y: 61.6 } }, [1, 1, -1, 1]),
      pose({ pelvis: { x: -8, y: 12 }, chest: { x: -12.2, y: -17.7 }, head: { x: -20.2, y: -42.4 }, frontHand: { x: 3.6, y: -54.9 }, backHand: { x: 3.2, y: -42.9 }, frontFoot: { x: 20, y: 54.6 }, backFoot: { x: -16, y: 68 } }, [1, 1, -1, -1]),
    ],
  },
};
