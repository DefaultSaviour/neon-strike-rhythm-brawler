import { AttackMove, MoveKey, SkeletonPose } from '../../types/game';
import { assemblePose, EnemyPose, FLOOR, LIMB, limbByAngles, Point } from '../enemyMotion';
import { playerPoseFromEnemyPose } from '../motion';

/**
 * Build hero attack poses from JOINT ANGLES, the same way the enemy stances
 * and dances are built, so arms and legs always keep their length.
 *
 * Angles are in degrees on screen: 0 = straight ahead (toward the enemy, +x),
 * 90 = straight down, -90 = straight up, 180 = straight back. Each limb gives
 * the angle of its upper bone (from the shoulder / hip) and of its lower bone
 * (from the elbow / knee). The "front" limbs are the lead limbs, drawn in
 * front of the body. Feet on the floor are at y = 68.
 */

export interface LimbAngles {
  upper: number;
  lower: number;
}

/** A trail for the hit effect, swept by the end of one limb. */
export interface TrailSpec {
  from: 'frontHand' | 'backHand' | 'frontFoot' | 'backFoot' | 'frontKnee' | 'frontElbow' | 'head';
  /** How far the trail reaches past the limb (world units) */
  reach?: number;
  /** Bend of the crescent (+ curves one way, - the other) */
  curve?: number;
}

export interface FighterSpec {
  pelvis: Point;
  /** Body lean in degrees: + leans forward (toward the enemy) */
  lean?: number;
  /** Extra head tilt in degrees on top of the lean */
  tilt?: number;
  frontArm: LimbAngles;
  backArm: LimbAngles;
  /** Leg angles, or a point where the foot is planted */
  frontLeg: LimbAngles | Point;
  backLeg: LimbAngles | Point;
  trail?: TrailSpec;
  prop?: SkeletonPose['prop'];
  /** The gun in this hand fires: the trail becomes the bullet streak */
  shot?: SkeletonPose['shot'];
}

const SPINE = 30;
const NECK = 26;
const SHOULDER_SPREAD = 3;
const rad = (d: number) => (d * Math.PI) / 180;

/** Where the chest and a shoulder end up for this spec (same maths as buildKey). */
function shoulderOf(spec: FighterSpec, side: 'front' | 'back'): Point {
  const lean = rad(spec.lean ?? 0);
  const chest = { x: spec.pelvis.x + Math.sin(lean) * SPINE, y: spec.pelvis.y - Math.cos(lean) * SPINE };
  return { x: chest.x + (side === 'front' ? SHOULDER_SPREAD : -SHOULDER_SPREAD), y: chest.y + 1 };
}

/** Where a hand ends up for this spec. */
export function handOf(spec: FighterSpec, side: 'front' | 'back'): Point {
  const s = shoulderOf(spec, side);
  const a = safeFold(side === 'front' ? spec.frontArm : spec.backArm);
  return limbByAngles(s, a.upper, a.lower, LIMB.upperArm, LIMB.forearm).end;
}

/** Where the head ends up for this spec. */
export function headOf(spec: FighterSpec): Point {
  const lean = rad(spec.lean ?? 0);
  const tilt = rad((spec.lean ?? 0) + (spec.tilt ?? 0));
  const chest = { x: spec.pelvis.x + Math.sin(lean) * SPINE, y: spec.pelvis.y - Math.cos(lean) * SPINE };
  return { x: chest.x + Math.sin(tilt) * NECK, y: chest.y - Math.cos(tilt) * NECK };
}

/**
 * Arm angles that put this side's hand on `target` (as near as the arm can
 * reach), elbow bent downward. For hands that must meet something: a hand
 * gripping the same weapon, or lifting a drink to the mouth.
 */
export function armReaching(spec: FighterSpec, side: 'front' | 'back', target: Point): LimbAngles {
  const s = shoulderOf(spec, side);
  const reach = LIMB.upperArm + LIMB.forearm;
  const d = Math.min(reach - 0.5, Math.max(4, Math.hypot(target.x - s.x, target.y - s.y)));
  const toward = Math.atan2(target.y - s.y, target.x - s.x);
  const bend = Math.acos(d / reach);
  const deg = (r: number) => (r * 180) / Math.PI;
  return { upper: deg(toward + bend), lower: deg(toward - bend) };
}

function isAngles(v: LimbAngles | Point): v is LimbAngles {
  return 'upper' in v;
}

/**
 * A limb folded exactly back on itself puts the hand / foot right on the
 * shoulder / hip, where the joint maths can't tell which way the elbow goes.
 * Nudge it a few degrees open so the pose always stays well defined.
 */
export function safeFold(a: LimbAngles): LimbAngles {
  const diff = ((((a.lower - a.upper) % 360) + 540) % 360) - 180;
  if (Math.abs(diff) <= 176) return a;
  return { upper: a.upper, lower: a.lower - Math.sign(diff || 1) * 4 };
}

/** A leg from its angles, or planted at a point (knee bent forward). Never below the floor. */
function leg(pelvis: Point, given: LimbAngles | Point): { foot: Point; bend: 1 | -1 } {
  if (isAngles(given)) {
    const safe = safeFold(given);
    const { end, bend } = limbByAngles(pelvis, safe.upper, safe.lower, LIMB.thigh, LIMB.shin);
    if (end.y <= FLOOR) return { foot: end, bend };
    // Would poke through the floor: keep the same knee side, stand on the floor instead.
    return { foot: { x: end.x, y: FLOOR }, bend };
  }
  return { foot: { x: given.x, y: Math.min(FLOOR, given.y) }, bend: -1 };
}

/** Build one keyframe (enemy-style skeleton plus its trail) from joint angles. */
export function buildKey(spec: FighterSpec, trailColor: string, ms = 0): MoveKey {
  const lean = rad(spec.lean ?? 0);
  const tilt = rad((spec.lean ?? 0) + (spec.tilt ?? 0));
  const pelvis = spec.pelvis;
  const chest = { x: pelvis.x + Math.sin(lean) * SPINE, y: pelvis.y - Math.cos(lean) * SPINE };
  const head = { x: chest.x + Math.sin(tilt) * NECK, y: chest.y - Math.cos(tilt) * NECK };
  const frontShoulder = { x: chest.x + SHOULDER_SPREAD, y: chest.y + 1 };
  const backShoulder = { x: chest.x - SHOULDER_SPREAD, y: chest.y + 1 };
  const fa = safeFold(spec.frontArm);
  const ba = safeFold(spec.backArm);
  const frontArm = limbByAngles(frontShoulder, fa.upper, fa.lower, LIMB.upperArm, LIMB.forearm);
  const backArm = limbByAngles(backShoulder, ba.upper, ba.lower, LIMB.upperArm, LIMB.forearm);
  const frontLeg = leg(pelvis, spec.frontLeg);
  const backLeg = leg(pelvis, spec.backLeg);

  const pose = assemblePose(
    {
      pelvis,
      chest,
      head,
      frontHand: frontArm.end,
      backHand: backArm.end,
      frontFoot: frontLeg.foot,
      backFoot: backLeg.foot,
      bends: { frontArm: frontArm.bend, backArm: backArm.bend, frontLeg: frontLeg.bend, backLeg: backLeg.bend },
      shoulderSpread: SHOULDER_SPREAD,
    },
    0,
    false
  );
  return {
    pose,
    ms,
    ...(spec.trail ? { trail: trailFor(pose, spec.trail, trailColor) } : {}),
    ...(spec.prop ? { prop: spec.prop } : {}),
    ...(spec.shot && spec.trail ? { shot: spec.shot } : {}),
  };
}

/** A keyframe as the player's skeleton (no scarf), with its trail and weapon. */
export function keyToPlayerPose(key: MoveKey): SkeletonPose {
  const pose = playerPoseFromEnemyPose(key.pose);
  delete pose.scarf;
  if (key.prop) pose.prop = key.prop;
  if (key.trail) pose.bladeSlash = key.trail;
  // The flash only shows while the bullet streak does.
  if (key.shot && key.trail) pose.shot = key.shot;
  return pose;
}

export function buildFighterPose(spec: FighterSpec, trailColor: string): SkeletonPose {
  return keyToPlayerPose(buildKey(spec, trailColor));
}

/** The glowing crescent swept by a limb: from partway down the limb to just past its end. */
function trailFor(p: EnemyPose, trail: TrailSpec, color: string): NonNullable<SkeletonPose['bladeSlash']> {
  const [joint, end] =
    trail.from === 'frontHand'
      ? [p.frontElbow, p.frontHand]
      : trail.from === 'backHand'
        ? [p.backElbow, p.backHand]
        : trail.from === 'frontFoot'
          ? [p.frontKnee, p.frontFoot]
          : trail.from === 'backFoot'
            ? [p.backKnee, p.backFoot]
            : trail.from === 'frontElbow'
              ? [p.frontShoulder, p.frontElbow]
              : trail.from === 'head'
                ? [p.chest, p.head]
                : [p.pelvis, p.frontKnee];
  const dx = end.x - joint.x;
  const dy = end.y - joint.y;
  const len = Math.hypot(dx, dy) || 1;
  const reach = trail.reach ?? 14;
  return {
    start: { x: joint.x + dx * 0.3, y: joint.y + dy * 0.3 },
    end: { x: end.x + (dx / len) * reach, y: end.y + (dy / len) * reach },
    curveOffset: trail.curve ?? 0,
    color,
  };
}

/** How long each hit is held so it reads at game speed, and how long the final pose is held. */
export const HIT_HOLD_MS = 80;
export const FINAL_HOLD_MS = 200;

/**
 * Hold the poses so they read: after every hit (a key with a trail) the
 * same pose repeats for a beat, and the last pose is held longer before the
 * fighter recovers to the stance. A hit's hold keeps its trail and flash
 * showing (see comboFrame), so the effect stays on for the whole hit
 * instead of blinking off and back on.
 */
export function withHolds(keys: MoveKey[]): MoveKey[] {
  return keys.flatMap((key, i) => {
    const ms = i === keys.length - 1 ? FINAL_HOLD_MS : key.trail ? HIT_HOLD_MS : 0;
    if (!ms) return [key];
    return [key, { ...key, ms, hold: true }];
  });
}

/** A combo move from its keyframes: the first one is the hit that lands on the button press. */
export function comboMove(id: number, tier: AttackMove['tier'], name: string, description: string, sequence: MoveKey[]): AttackMove {
  const durationMs = 50 + sequence.slice(1).reduce((s, k) => s + k.ms, 0) + 140;
  return { id, tier, name, description, durationMs, pose: keyToPlayerPose(sequence[0]), sequence };
}
