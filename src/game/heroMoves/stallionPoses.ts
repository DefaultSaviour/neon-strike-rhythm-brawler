import { PoseRig } from '../enemyMotion';
import type { HeroPoseEdit } from '../heroPoses';

/**
 * The Stallion poses drawn in the Pose Studio by the designer. They replace
 * the built-in keyframes of the moves named here (see stallion.ts); each
 * pose keeps the hit effect of the keyframe it replaces.
 */

/** A studio rig: joint positions, plus which way each elbow and knee bends (front arm, back arm, front leg, back leg). */
function pose(p: Omit<PoseRig, 'bends' | 'shoulderSpread'>, [frontArm, backArm, frontLeg, backLeg]: number[]): PoseRig {
  return { ...p, bends: { frontArm, backArm, frontLeg, backLeg }, shoulderSpread: 3 } as PoseRig;
}

export const STALLION_POSE_EDITS: Record<string, HeroPoseEdit> = {
  'Lead Hook': {
    ms: [0, 160],
    poses: [
      pose({ pelvis: { x: 5.3, y: 32.3 }, chest: { x: 10.6, y: 2.7 }, head: { x: 12.4, y: -23.2 }, frontHand: { x: 55.4, y: 7.3 }, backHand: { x: 11.6, y: 0 }, frontFoot: { x: 22, y: 68 }, backFoot: { x: -18, y: 68 } }, [-1, 1, -1, -1]),
      pose({ pelvis: { x: 0, y: 12 }, chest: { x: 5.2, y: -17.5 }, head: { x: 12.4, y: -42.5 }, frontHand: { x: 12.6, y: -19.9 }, backHand: { x: 6.3, y: -20.2 }, frontFoot: { x: 22, y: 68 }, backFoot: { x: -18, y: 68 } }, [1, 1, -1, -1]),
    ],
  },
  'Body Jab': {
    ms: [0, 160],
    poses: [
      pose({ pelvis: { x: 2.1, y: 27.6 }, chest: { x: 14.3, y: 0.2 }, head: { x: 24.9, y: -23.5 }, frontHand: { x: 57.2, y: 14.2 }, backHand: { x: 15.3, y: -2.5 }, frontFoot: { x: 26, y: 68 }, backFoot: { x: -32.1, y: 68 } }, [1, 1, -1, -1]),
      pose({ pelvis: { x: 0, y: 12 }, chest: { x: 5.2, y: -17.5 }, head: { x: 12.4, y: -42.5 }, frontHand: { x: 12.6, y: -19.9 }, backHand: { x: 6.3, y: -20.2 }, frontFoot: { x: 22, y: 68 }, backFoot: { x: -18, y: 68 } }, [1, 1, -1, -1]),
    ],
  },
  'Double Jab': {
    ms: [0, 80, 80],
    poses: [
      pose({ pelvis: { x: 4, y: 13 }, chest: { x: 8.3, y: -16.7 }, head: { x: 17.7, y: -40.9 }, frontHand: { x: 53.2, y: -18.6 }, backHand: { x: 9.3, y: -19.4 }, frontFoot: { x: 22, y: 68 }, backFoot: { x: -18, y: 68 } }, [1, 1, -1, -1]),
      pose({ pelvis: { x: 0, y: 12 }, chest: { x: 5.2, y: -17.5 }, head: { x: 12.4, y: -42.5 }, frontHand: { x: 34.8, y: -21.2 }, backHand: { x: 6.3, y: -20.2 }, frontFoot: { x: 22, y: 68 }, backFoot: { x: -18, y: 68 } }, [1, 1, -1, -1]),
      pose({ pelvis: { x: 8, y: 13 }, chest: { x: 15.3, y: -16.1 }, head: { x: 21.5, y: -41.3 }, frontHand: { x: 60, y: -19.5 }, backHand: { x: 16.3, y: -18.8 }, frontFoot: { x: 28, y: 68 }, backFoot: { x: -18, y: 68 } }, [-1, 1, -1, -1]),
    ],
  },
  'Uppercut': {
    ms: [0, 170],
    poses: [
      pose({ pelvis: { x: 12, y: 11.8 }, chest: { x: 15.1, y: -18 }, head: { x: 12, y: -43.8 }, frontHand: { x: 6.1, y: 19.1 }, backHand: { x: 44.4, y: -38.8 }, frontFoot: { x: 27, y: 66.6 }, backFoot: { x: -5.8, y: 68 } }, [1, 1, -1, -1]),
      pose({ pelvis: { x: 0, y: 12 }, chest: { x: 5.2, y: -17.5 }, head: { x: 12.4, y: -42.5 }, frontHand: { x: 12.6, y: -19.9 }, backHand: { x: 6.3, y: -20.2 }, frontFoot: { x: 22, y: 68 }, backFoot: { x: -18, y: 68 } }, [1, 1, -1, -1]),
    ],
  },
  'Liver Shot': {
    ms: [0, 100],
    poses: [
      pose({ pelvis: { x: 12, y: 27.1 }, chest: { x: 23.2, y: -0.7 }, head: { x: 29.5, y: -25.9 }, frontHand: { x: 65.1, y: 10.9 }, backHand: { x: 24.3, y: -3.4 }, frontFoot: { x: 26, y: 68 }, backFoot: { x: -18, y: 68 } }, [1, 1, -1, -1]),
      pose({ pelvis: { x: 4, y: 14 }, chest: { x: 9.2, y: -15.5 }, head: { x: 11, y: -41.5 }, frontHand: { x: 43.5, y: 0.7 }, backHand: { x: 10.3, y: -18.2 }, frontFoot: { x: 22, y: 68 }, backFoot: { x: -18, y: 68 } }, [-1, 1, -1, -1]),
    ],
  },
  'Bob and Weave': {
    ms: [0, 120],
    poses: [
      pose({ pelvis: { x: 8.1, y: 29.5 }, chest: { x: 23.1, y: 3.5 }, head: { x: 39.8, y: -16.4 }, frontHand: { x: 30.5, y: 1.2 }, backHand: { x: 53.4, y: 21.3 }, frontFoot: { x: 26, y: 68 }, backFoot: { x: -18, y: 68 } }, [1, 1, -1, -1]),
      pose({ pelvis: { x: 4, y: 14 }, chest: { x: 9.2, y: -15.5 }, head: { x: 11, y: -41.5 }, frontHand: { x: 43.5, y: 0.7 }, backHand: { x: 10.3, y: -18.2 }, frontFoot: { x: 22, y: 68 }, backFoot: { x: -18, y: 68 } }, [-1, 1, -1, -1]),
    ],
  },
  'Overhand Right': {
    ms: [0, 170],
    poses: [
      pose({ pelvis: { x: -1.9, y: 9 }, chest: { x: 12.2, y: -17.5 }, head: { x: 37.2, y: -24.6 }, frontHand: { x: 2.4, y: 10.6 }, backHand: { x: 36.3, y: -37.2 }, frontFoot: { x: 13.2, y: 68 }, backFoot: { x: -24.2, y: 65.8 } }, [1, -1, -1, -1]),
      pose({ pelvis: { x: 0, y: 12 }, chest: { x: 5.2, y: -17.5 }, head: { x: 12.4, y: -42.5 }, frontHand: { x: 12.6, y: -19.9 }, backHand: { x: 6.3, y: -20.2 }, frontFoot: { x: 22, y: 68 }, backFoot: { x: -18, y: 68 } }, [1, 1, -1, -1]),
    ],
  },
  'Check Hook': {
    ms: [0, 170],
    poses: [
      pose({ pelvis: { x: -2, y: 14 }, chest: { x: 0.1, y: -15.9 }, head: { x: -2.6, y: -41.8 }, frontHand: { x: 36.3, y: 6 }, backHand: { x: 1.1, y: -18.6 }, frontFoot: { x: 20, y: 68 }, backFoot: { x: -24, y: 68 } }, [1, 1, -1, -1]),
      pose({ pelvis: { x: 0, y: 12 }, chest: { x: 5.2, y: -17.5 }, head: { x: 12.4, y: -42.5 }, frontHand: { x: 12.6, y: -19.9 }, backHand: { x: 6.3, y: -20.2 }, frontFoot: { x: 22, y: 68 }, backFoot: { x: -18, y: 68 } }, [1, 1, -1, -1]),
    ],
  },
  'Body-Head': {
    ms: [0, 100, 100],
    poses: [
      pose({ pelvis: { x: 4, y: 26 }, chest: { x: 16.2, y: -1.4 }, head: { x: 26.8, y: -25.2 }, frontHand: { x: 57, y: -18.8 }, backHand: { x: 54.9, y: 4.4 }, frontFoot: { x: 26, y: 68 }, backFoot: { x: -18, y: 68 } }, [1, 1, -1, -1]),
      pose({ pelvis: { x: 4, y: 14 }, chest: { x: 9.2, y: -15.5 }, head: { x: 11, y: -41.5 }, frontHand: { x: 43.5, y: 0.7 }, backHand: { x: 10.3, y: -18.2 }, frontFoot: { x: 22, y: 68 }, backFoot: { x: -18, y: 68 } }, [-1, 1, -1, -1]),
      pose({ pelvis: { x: 6, y: 16 }, chest: { x: 17.2, y: -11.8 }, head: { x: 27, y: -35.9 }, frontHand: { x: 24.6, y: -14.2 }, backHand: { x: 56.2, y: -12.3 }, frontFoot: { x: 30, y: 68 }, backFoot: { x: -14, y: 68 } }, [1, 1, -1, -1]),
    ],
  },
  'Iron Chin': {
    ms: [0, 180],
    poses: [
      pose({ pelvis: { x: 12, y: 12.5 }, chest: { x: 22.3, y: -15.7 }, head: { x: 21.1, y: -41.7 }, frontHand: { x: 29.6, y: -18 }, backHand: { x: 61.2, y: -16.1 }, frontFoot: { x: 30, y: 68 }, backFoot: { x: -14, y: 68 } }, [1, 1, -1, -1]),
      pose({ pelvis: { x: 0, y: 12 }, chest: { x: 5.2, y: -17.5 }, head: { x: 5.2, y: -43.5 }, frontHand: { x: 12.6, y: -19.9 }, backHand: { x: 6.3, y: -20.2 }, frontFoot: { x: 22, y: 68 }, backFoot: { x: -18, y: 68 } }, [1, 1, -1, -1]),
    ],
  },
};
