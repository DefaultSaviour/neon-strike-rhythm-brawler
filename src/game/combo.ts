import { MoveKey, SkeletonPose } from '../types/game';
import { blendPoses } from './customAnimation';
import { keyToPlayerPose } from './heroMoves/poseBuilder';
import { blendPose, easeInOutCubic, easeOutBack, easeOutCubic, StrikeFrame } from './motion';

/**
 * Multi-hit moves ("combos"): a chain of keyframes played after a button press.
 *
 *   press -> SNAP into the first hit (very fast, so the hit still lands on
 *            your timing) -> each follow-up keyframe in turn -> RECOVER back
 *            to the fighting stance.
 *
 * Between keyframes every bone rotates around its joint (blendPoses), so
 * kicks and punches swing in arcs instead of sliding. If another note comes
 * before the combo finishes, the next move simply starts from wherever the
 * fighter is, so fast passages stay fluid.
 */

/** Time to snap into the first hit (seconds) */
export const COMBO_SNAP_SEC = 0.05;
/** Time to settle back into the stance after the last keyframe (seconds) */
export const COMBO_RECOVER_SEC = 0.14;
/** Fraction of each keyframe's travel during which its trail is drawn */
const TRAIL_SHOWN_FOR = 0.75;

/** Total length of a combo (seconds). */
export function comboDuration(keys: MoveKey[]): number {
  return COMBO_SNAP_SEC + keys.slice(1).reduce((s, k) => s + k.ms / 1000, 0) + COMBO_RECOVER_SEC;
}

/**
 * The fighter `elapsed` seconds into a combo.
 * @param from where the fighter was when the button was pressed (screen space)
 * @param rest the fighting stance to recover to (screen space)
 * @param orient turns a right-facing pose toward the struck lane
 */
export function comboFrame(
  elapsed: number,
  from: SkeletonPose,
  keys: MoveKey[],
  rest: SkeletonPose,
  lunge: number,
  orient: (p: SkeletonPose) => SkeletonPose
): StrikeFrame {
  const keyPose = (i: number) => orient(keyToPlayerPose(keys[i]));
  const t0 = Math.max(0, elapsed);

  // 1. Snap into the first hit
  if (t0 < COMBO_SNAP_SEC) {
    const t = t0 / COMBO_SNAP_SEC;
    return { pose: blendPose(from, keyPose(0), easeOutBack(t)), lungeX: lunge * easeOutCubic(t), active: true };
  }

  // 2. Follow-up hits: rotate from each keyframe into the next
  let e = t0 - COMBO_SNAP_SEC;
  for (let i = 1; i < keys.length; i++) {
    const d = keys[i].ms / 1000;
    if (e < d) {
      const t = e / d;
      const blended = blendPoses(keys[i - 1].pose, keys[i].pose, easeOutCubic(t), 0, false);
      // A hit's trail fades out near the end of its travel, unless a hold follows: then it stays
      // on through the travel and the hold, so the effect never blinks off and back on.
      const showTrail = t < TRAIL_SHOWN_FOR || keys[i].hold || keys[i + 1]?.hold;
      const pose = keyToPlayerPose({ ...keys[i], pose: blended, trail: showTrail ? keys[i].trail : undefined });
      return { pose: orient(pose), lungeX: lunge, active: !!pose.bladeSlash };
    }
    e -= d;
  }

  // 3. Recover to the stance
  const last = keyPose(keys.length - 1);
  delete last.bladeSlash;
  delete last.shot;
  delete last.spin;
  delete last.flyingArm;
  const t = Math.min(1, e / COMBO_RECOVER_SEC);
  const eased = easeInOutCubic(t);
  return { pose: blendPose(last, rest, eased), lungeX: lunge * (1 - eased), active: false };
}
