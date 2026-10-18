import { SkeletonPose } from '../../types/game';
import { assemblePose, FLOOR, LIMB, limbByAngles, Point } from '../enemyMotion';
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
  from: 'frontHand' | 'backHand' | 'frontFoot' | 'backFoot' | 'frontKnee';
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
}

const SPINE = 30;
const NECK = 26;
const SHOULDER_SPREAD = 3;
const rad = (d: number) => (d * Math.PI) / 180;

function isAngles(v: LimbAngles | Point): v is LimbAngles {
  return 'upper' in v;
}

/** A leg from its angles, or planted at a point (knee bent forward). Never below the floor. */
function leg(pelvis: Point, given: LimbAngles | Point): { foot: Point; bend: 1 | -1 } {
  if (isAngles(given)) {
    const { end, bend } = limbByAngles(pelvis, given.upper, given.lower, LIMB.thigh, LIMB.shin);
    if (end.y <= FLOOR) return { foot: end, bend };
    // Would poke through the floor: keep the same knee side, stand on the floor instead.
    return { foot: { x: end.x, y: FLOOR }, bend };
  }
  return { foot: { x: given.x, y: Math.min(FLOOR, given.y) }, bend: -1 };
}

export function buildFighterPose(spec: FighterSpec, trailColor: string): SkeletonPose {
  const lean = rad(spec.lean ?? 0);
  const tilt = rad((spec.lean ?? 0) + (spec.tilt ?? 0));
  const pelvis = spec.pelvis;
  const chest = { x: pelvis.x + Math.sin(lean) * SPINE, y: pelvis.y - Math.cos(lean) * SPINE };
  const head = { x: chest.x + Math.sin(tilt) * NECK, y: chest.y - Math.cos(tilt) * NECK };
  const frontShoulder = { x: chest.x + SHOULDER_SPREAD, y: chest.y + 1 };
  const backShoulder = { x: chest.x - SHOULDER_SPREAD, y: chest.y + 1 };
  const frontArm = limbByAngles(frontShoulder, spec.frontArm.upper, spec.frontArm.lower, LIMB.upperArm, LIMB.forearm);
  const backArm = limbByAngles(backShoulder, spec.backArm.upper, spec.backArm.lower, LIMB.upperArm, LIMB.forearm);
  const frontLeg = leg(pelvis, spec.frontLeg);
  const backLeg = leg(pelvis, spec.backLeg);

  const enemyStyle = assemblePose(
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
  const pose = playerPoseFromEnemyPose(enemyStyle);
  delete pose.scarf;
  if (spec.prop) pose.prop = spec.prop;
  if (spec.trail) pose.bladeSlash = trailFor(enemyStyle, spec.trail, trailColor);
  return pose;
}

/** The glowing crescent swept by a limb: from partway down the limb to just past its end. */
function trailFor(p: ReturnType<typeof assemblePose>, trail: TrailSpec, color: string): NonNullable<SkeletonPose['bladeSlash']> {
  const [joint, end] =
    trail.from === 'frontHand'
      ? [p.frontElbow, p.frontHand]
      : trail.from === 'backHand'
        ? [p.backElbow, p.backHand]
        : trail.from === 'frontFoot'
          ? [p.frontKnee, p.frontFoot]
          : trail.from === 'backFoot'
            ? [p.backKnee, p.backFoot]
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
