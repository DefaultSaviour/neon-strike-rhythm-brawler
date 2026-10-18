import { Point2D, SkeletonPose } from '../types/game';
import { EnemyPose, enemyPose } from './enemyMotion';

/**
 * Animation helpers for the player fighter.
 *
 * The old strike animation slid linearly from idle to the attack pose and back,
 * which reads as floaty. Good fighting-game animation is about contrast:
 * a very fast snap INTO the hit (slightly overshooting, then settling), a short
 * hold so the eye can read the pose, then a softer recovery. The fighter also
 * lunges toward the enemy so the blow visibly travels.
 */

/** 0..1 -> 0..1 with a small overshoot past 1 before settling (a "snap"). */
export function easeOutBack(t: number, overshoot = 1.6): number {
  const x = Math.min(1, Math.max(0, t)) - 1;
  return 1 + (overshoot + 1) * x * x * x + overshoot * x * x;
}

export function easeOutCubic(t: number): number {
  const x = 1 - Math.min(1, Math.max(0, t));
  return 1 - x * x * x;
}

export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Linear blend between two poses. Unlike lerpPose, `t` may go past 1 for overshoot. */
export function blendPose(a: SkeletonPose, b: SkeletonPose, t: number): SkeletonPose {
  const mix = (p: Point2D, q: Point2D): Point2D => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const mixList = (p?: Point2D[], q?: Point2D[]) =>
    p && q && p.length === q.length ? p.map((pt, i) => mix(pt, q[i])) : q ?? p;
  return {
    head: mix(a.head, b.head),
    chest: mix(a.chest, b.chest),
    pelvis: mix(a.pelvis, b.pelvis),
    leftShoulder: mix(a.leftShoulder, b.leftShoulder),
    leftElbow: mix(a.leftElbow, b.leftElbow),
    leftHand: mix(a.leftHand, b.leftHand),
    rightShoulder: mix(a.rightShoulder, b.rightShoulder),
    rightElbow: mix(a.rightElbow, b.rightElbow),
    rightHand: mix(a.rightHand, b.rightHand),
    leftHip: mix(a.leftHip, b.leftHip),
    leftKnee: mix(a.leftKnee, b.leftKnee),
    leftFoot: mix(a.leftFoot, b.leftFoot),
    rightHip: mix(a.rightHip, b.rightHip),
    rightKnee: mix(a.rightKnee, b.rightKnee),
    rightFoot: mix(a.rightFoot, b.rightFoot),
    scarf: mixList(a.scarf, b.scarf),
    prop: b.prop ?? a.prop,
    bladeSlash: b.bladeSlash ?? a.bladeSlash,
  };
}

/** Strike timeline, as fractions of the whole attack. */
export const STRIKE_PHASES = {
  /** End of the snap into the attack pose */
  impact: 0.28,
  /** End of the hold on the attack pose */
  hold: 0.6,
} as const;

export interface StrikeFrame {
  pose: SkeletonPose;
  /** Horizontal body offset toward the enemy (world units) */
  lungeX: number;
  /** True while the blow is landing (used to draw the slash trail) */
  active: boolean;
}

/**
 * Pose of the fighter `progress` (0..1) of the way through a strike.
 * `fromPose` is wherever the fighter was when the button was pressed, so fast
 * strings of hits chain smoothly instead of snapping back to idle each time.
 */
export function strikeFrame(
  progress: number,
  fromPose: SkeletonPose,
  strikePose: SkeletonPose,
  restPose: SkeletonPose,
  lungeX: number
): StrikeFrame {
  const p = Math.min(1, Math.max(0, progress));
  if (p < STRIKE_PHASES.impact) {
    const t = p / STRIKE_PHASES.impact;
    return { pose: blendPose(fromPose, strikePose, easeOutBack(t)), lungeX: lungeX * easeOutCubic(t), active: true };
  }
  if (p < STRIKE_PHASES.hold) {
    return { pose: strikePose, lungeX, active: true };
  }
  const t = easeInOutCubic((p - STRIKE_PHASES.hold) / (1 - STRIKE_PHASES.hold));
  return { pose: blendPose(strikePose, restPose, t), lungeX: lungeX * (1 - t), active: false };
}

/**
 * Idle fighting stance that bounces on the music's beat: knees dip as the beat
 * lands (`pulse` = 1) and spring back up between beats.
 */
export function idleBouncePose(rest: SkeletonPose, pulse: number, sway: number): SkeletonPose {
  const dip = pulse * 4;
  const lift = (pt: Point2D, amount: number, dx = 0): Point2D => ({ x: pt.x + dx, y: pt.y + amount });
  return {
    ...rest,
    head: lift(rest.head, dip * 1.1, sway * 0.6),
    chest: lift(rest.chest, dip, sway * 0.4),
    pelvis: lift(rest.pelvis, dip * 0.9),
    leftShoulder: lift(rest.leftShoulder, dip),
    rightShoulder: lift(rest.rightShoulder, dip),
    leftElbow: lift(rest.leftElbow, dip * 0.8),
    rightElbow: lift(rest.rightElbow, dip * 0.8),
    leftHand: lift(rest.leftHand, dip * 0.7 - pulse * 2),
    rightHand: lift(rest.rightHand, dip * 0.7 - pulse * 2),
    leftHip: lift(rest.leftHip, dip * 0.9),
    rightHip: lift(rest.rightHip, dip * 0.9),
    // Knees push outward as the body sinks; feet stay planted.
    leftKnee: lift(rest.leftKnee, dip * 0.5, -dip * 0.6),
    rightKnee: lift(rest.rightKnee, dip * 0.5, dip * 0.6),
    scarf: rest.scarf?.map((pt, i) => ({ x: pt.x - sway * i * 0.8, y: pt.y + dip + Math.sin(sway + i) * i * 1.5 })),
  };
}

/**
 * Convert an enemy-style skeleton (front/back limbs) into the player's
 * skeleton format (left/right limbs). The player's LEFT limbs lead, so they
 * take the front limbs. A scarf is added, streaming behind the head.
 */
export function playerPoseFromEnemyPose(p: EnemyPose, scarfWave = 0): SkeletonPose {
  const h = p.head;
  const behind = p.facingCamera ? 0.4 : 1; // a front-facing scarf hangs down more
  return {
    head: p.head,
    chest: p.chest,
    pelvis: p.pelvis,
    leftShoulder: p.frontShoulder,
    leftElbow: p.frontElbow,
    leftHand: p.frontHand,
    rightShoulder: p.backShoulder,
    rightElbow: p.backElbow,
    rightHand: p.backHand,
    leftHip: { x: p.pelvis.x + 2, y: p.pelvis.y },
    leftKnee: p.frontKnee,
    leftFoot: p.frontFoot,
    rightHip: { x: p.pelvis.x - 2, y: p.pelvis.y },
    rightKnee: p.backKnee,
    rightFoot: p.backFoot,
    scarf: [1, 2, 3, 4].map((i) => ({
      x: h.x - 4 - i * 14 * behind,
      y: h.y + 2 + i * (behind < 1 ? 7 : 3) + Math.sin(scarfWave + i * 0.9) * i * 1.6,
    })),
  };
}

/** The player celebrating: facing you, hands up, bouncing on the beat. */
export function playerVictoryPose(beat: number): SkeletonPose {
  return playerPoseFromEnemyPose(enemyPose('sway', beat, 'agile'), beat * Math.PI);
}

/** How long each blow takes in the progress-bar attack chain (seconds) */
export const CHAIN_STRIKE_SEC = 0.26;

export interface ChainFrame {
  pose: SkeletonPose;
  /** True while the blow is landing (draw the slash) */
  active: boolean;
  /** Which strike in the chain this is (0, 1, 2...) */
  strikeIndex: number;
}

/**
 * The fighter throwing a non-stop chain of attacks, each one snapping out
 * from his guard and recovering back to it, so blows flow into each other
 * with no jumps. `pickMove(i)` chooses the i-th strike's pose (already facing
 * the right way), so the caller can use moves from the current combo tier.
 */
export function attackChainFrame(
  elapsed: number,
  pickMove: (strikeIndex: number) => SkeletonPose,
  rest: SkeletonPose
): ChainFrame {
  const t = Math.max(0, elapsed);
  const strikeIndex = Math.floor(t / CHAIN_STRIKE_SEC);
  const progress = (t - strikeIndex * CHAIN_STRIKE_SEC) / CHAIN_STRIKE_SEC;
  const frame = strikeFrame(progress, rest, pickMove(strikeIndex), rest, 0);
  return { pose: frame.pose, active: frame.active, strikeIndex };
}
