import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { buildFighterPose, buildKey, comboMove, FighterSpec, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE KID: the underdog karate student from the 80s martial-arts films:
 * a white gi, a black belt and a headband. Clean, crisp karate: punches
 * from a fist chambered at the hip, front kicks, and the chores that turned
 * out to be training (polishing the car, painting the fence, sanding the
 * floor) as circular blocks that flow into strikes. His finisher is the
 * one-legged crane kick.
 *
 * Built the round-one way: each move is ONE clear idea in a few big poses,
 * every hit is held for a beat (withHolds), and the hips stay near the
 * centre. 21 combos over the 5 tiers (5, 5, 4, 4, 3); the first keyframe is
 * the hit.
 *
 * Angles: 0 deg = toward the enemy, 90 = down, -90 = up, 180 = back. Feet
 * planted on the floor are at y = 68.
 */

const TRAIL = '#bfe9ff'; // crane-feather white-blue
const F = FLOOR;

const straight = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
/** The rear fist pulled back to the hip, knuckles down (ready to punch). */
const chamber: LimbAngles = { upper: 130, lower: 0 };
/** The lead hand open and forward at chest height, guarding. */
const openGuard: LimbAngles = { upper: 30, lower: -40 };
/** Arms spread up and out like wings (the crane). */
const wingFront: LimbAngles = { upper: -30, lower: -70 };
const wingBack: LimbAngles = { upper: -150, lower: -110 };
/** A leg kicking straight out at this angle (- is higher). */
const kick = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
/** A leg tucked up under him in a jump. */
const tucked: LimbAngles = { upper: 60, lower: 150 };

/** Front stance: long and low, lead foot well forward. */
const frontStance = { pelvis: { x: 0, y: 16 }, frontLeg: { x: 26, y: F }, backLeg: { x: -22, y: F } };
/** Stepping through behind a punch. */
const stepIn = { pelvis: { x: 6, y: 18 }, frontLeg: { x: 32, y: F }, backLeg: { x: -18, y: F } };
/** Standing on the back leg to kick with the front one. */
const onBackLeg = { pelvis: { x: -4, y: 10 }, backLeg: { x: -6, y: F } };
/** Up in the air for a jumping kick. */
const airborne = { pelvis: { x: 2, y: -2 }, backLeg: tucked };

type Key = FighterSpec & { ms?: number };

let nextId = 801;
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[]): AttackMove {
  return comboMove(nextId++, tier, name, description, withHolds(keys.map((k) => buildKey(k, TRAIL, k.ms ?? 0))));
}

/** Front stance, lead hand open, rear fist chambered at the hip. */
export const THE_KID_IDLE: SkeletonPose = buildFighterPose({ ...frontStance, lean: 4, frontArm: openGuard, backArm: chamber }, TRAIL);

/** Back in his stance. */
const ready = (ms: number, extra: Partial<Key> = {}): Key => ({ ms, ...frontStance, lean: 4, frontArm: openGuard, backArm: chamber, ...extra });
/** Lead-hand punch, stepping in. */
const lungePunch = (extra: Partial<Key> = {}): Key => ({ ...stepIn, lean: 12, frontArm: straight(-4), backArm: chamber, trail: { from: 'frontHand', reach: 18 }, ...extra });
/** Rear-hand punch, the lead fist snapping back to the hip. */
const reversePunch = (extra: Partial<Key> = {}): Key => ({ ...frontStance, lean: 16, frontArm: chamber, backArm: straight(-2), trail: { from: 'backHand', reach: 20 }, ...extra });
/** Front kick at this height. */
const frontKick = (deg = -4, extra: Partial<Key> = {}): Key => ({ ...onBackLeg, lean: -10, frontArm: openGuard, backArm: chamber, frontLeg: kick(deg), trail: { from: 'frontFoot', reach: 16 }, ...extra });
/** Side kick: leaning right back, the heel driving straight out. */
const sideKick = (extra: Partial<Key> = {}): Key => ({ ...onBackLeg, pelvis: { x: -6, y: 10 }, lean: -32, tilt: 20, frontArm: { upper: 60, lower: 20 }, backArm: { upper: 160, lower: 140 }, frontLeg: kick(-12), trail: { from: 'frontFoot', reach: 18 }, ...extra });
/** Roundhouse: the shin whipping round at head height. */
const roundhouse = (extra: Partial<Key> = {}): Key => ({ ...onBackLeg, lean: -22, tilt: 12, frontArm: openGuard, backArm: { upper: 150, lower: 120 }, frontLeg: { upper: -30, lower: -20 }, trail: { from: 'frontFoot', reach: 18, curve: 24 }, ...extra });
/** The crane: up on one leg, front knee raised, arms spread like wings. */
const crane = (ms: number): Key => ({ ms, pelvis: { x: 0, y: 8 }, lean: 0, frontArm: wingFront, backArm: wingBack, frontLeg: { upper: -20, lower: 100 }, backLeg: { x: -2, y: F } });
/** A low crouch with both palms down, sanding the floor. */
const sandLow = { pelvis: { x: 2, y: 34 }, frontLeg: { x: 28, y: F }, backLeg: { x: -20, y: F } };

export const THE_KID_MOVES: AttackMove[] = [
  // ======================= Tier 1: the basics =======================
  combo(1, 'Lunge Punch', 'Steps through and drives the lead fist straight out', [lungePunch(), ready(150)]),
  combo(1, 'Reverse Punch', 'The rear fist fires from the hip as the lead one snaps back', [reversePunch(), ready(150)]),
  combo(1, 'Front Kick', 'Lifts the knee and snaps the foot straight out', [frontKick(), ready(150)]),
  combo(1, 'Knife Hand', 'An open-hand chop, edge first, down across the neck', [
    { ...stepIn, lean: 10, frontArm: { upper: -20, lower: 20 }, backArm: chamber, trail: { from: 'frontHand', reach: 16, curve: 18 } },
    ready(150),
  ]),
  combo(1, 'Polish the Car', 'One hand circles out like polishing a car, knocking the attack aside', [
    { ...frontStance, lean: 8, frontArm: { upper: 10, lower: -50 }, backArm: chamber, trail: { from: 'frontHand', reach: 16, curve: 30 } },
    ready(150),
  ]),

  // ================= Tier 2: the chores were training =================
  combo(2, 'Polish Both Ways', 'Circles the other hand out, then punches through the gap', [
    { ...frontStance, lean: 8, frontArm: openGuard, backArm: { upper: 20, lower: -60 }, trail: { from: 'backHand', reach: 16, curve: -30 } },
    { ms: 100, ...lungePunch() },
  ]),
  combo(2, 'Paint the Fence', 'The open hand brushes down like a paintbrush, then back up', [
    { ...frontStance, lean: 10, frontArm: { upper: 20, lower: 40 }, backArm: chamber, trail: { from: 'frontHand', reach: 16, curve: -22 } },
    { ms: 160, ...frontStance, lean: 2, frontArm: { upper: -50, lower: -80 }, backArm: chamber },
  ]),
  combo(2, 'Sand the Floor', 'Drops low and sweeps both palms in circles across the floor', [
    { ...sandLow, lean: 30, frontArm: straight(35), backArm: chamber, trail: { from: 'frontHand', reach: 16, curve: 24 } },
    { ms: 110, ...sandLow, lean: 30, frontArm: chamber, backArm: straight(32), trail: { from: 'backHand', reach: 16, curve: -24 } },
  ]),
  combo(2, 'Roundhouse', 'The shin whips round at head height', [roundhouse(), ready(170)]),
  combo(2, 'Low Sweep', 'Drops onto the back leg and sweeps the front foot along the floor', [
    { pelvis: { x: 0, y: 40 }, lean: 18, frontArm: openGuard, backArm: { upper: 120, lower: 100 }, frontLeg: { upper: 20, lower: 5 }, backLeg: { x: -14, y: F }, trail: { from: 'frontFoot', reach: 16, curve: 18 } },
    ready(170),
  ]),

  // =================== Tier 3: combinations ===================
  combo(3, 'Double Punch', 'Lead punch, then the rear hand straight behind it', [lungePunch(), { ms: 90, ...reversePunch() }]),
  combo(3, 'Kick and Punch', 'Front kick, then steps down into a reverse punch', [frontKick(-8), { ms: 110, ...reversePunch({ ...stepIn }) }]),
  combo(3, 'Side Kick', 'Leans right back and drives the heel straight out', [sideKick(), ready(180)]),
  combo(3, 'Hammer Fist', 'Raises the fist high and brings it straight down', [
    { ...stepIn, lean: 14, frontArm: { upper: 0, lower: 60 }, backArm: chamber, trail: { from: 'frontHand', reach: 16, curve: 20 } },
    ready(170),
  ]),

  // ================= Tier 4: in the air =================
  combo(4, 'Jumping Front Kick', 'Leaps up and snaps a front kick at head height', [
    { ...airborne, lean: -10, frontArm: openGuard, backArm: chamber, frontLeg: kick(-14), trail: { from: 'frontFoot', reach: 18 } },
    ready(180),
  ]),
  combo(4, 'Double Kick', 'A low front kick, then the same leg whips round high', [frontKick(10), { ms: 110, ...roundhouse() }]),
  combo(4, 'Flying Side Kick', 'Launches off the floor with the heel leading the way', [
    { ...airborne, ...{ pelvis: { x: 0, y: -4 } }, lean: -34, tilt: 20, frontArm: { upper: 60, lower: 20 }, backArm: { upper: 160, lower: 140 }, frontLeg: kick(-6), trail: { from: 'frontFoot', reach: 20 } },
    ready(190),
  ]),
  combo(4, 'Drum Punches', 'Balanced on one foot, both fists beat down like drumsticks', [
    { ...onBackLeg, lean: 12, frontArm: { upper: 0, lower: 60 }, backArm: { upper: -60, lower: -100 }, frontLeg: { upper: -10, lower: 95 }, trail: { from: 'frontHand', reach: 16, curve: 18 } },
    { ms: 100, ...onBackLeg, lean: 12, frontArm: { upper: -60, lower: -100 }, backArm: { upper: 0, lower: 60 }, frontLeg: { upper: -10, lower: 95 }, trail: { from: 'backHand', reach: 16, curve: 18 } },
  ]),

  // ================= Tier 5: the tournament =================
  combo(5, 'Crane Kick', 'Rises onto one leg with his arms spread like wings, then the kick nobody sees coming', [
    { pelvis: { x: 2, y: 2 }, lean: -14, frontArm: wingFront, backArm: wingBack, frontLeg: { upper: -25, lower: -35 }, backLeg: tucked, trail: { from: 'frontFoot', reach: 20, curve: -14 } },
    crane(260),
  ]),
  combo(5, 'Tournament Point', 'Side kick, roundhouse, and a bow to the referee', [
    sideKick(),
    { ms: 110, ...roundhouse() },
    { ms: 200, pelvis: { x: 0, y: 12 }, lean: 36, frontArm: straight(96), backArm: straight(92), frontLeg: { x: 6, y: F }, backLeg: { x: -6, y: F } },
  ]),
  combo(5, 'Final Bout', 'Sweeps low, punches through, then the crane kick to finish it', [
    { pelvis: { x: 0, y: 40 }, lean: 18, frontArm: openGuard, backArm: { upper: 120, lower: 100 }, frontLeg: { upper: 20, lower: 5 }, backLeg: { x: -14, y: F }, trail: { from: 'frontFoot', reach: 16, curve: 18 } },
    { ms: 100, ...reversePunch() },
    { ms: 120, pelvis: { x: 2, y: 2 }, lean: -14, frontArm: wingFront, backArm: wingBack, frontLeg: { upper: -25, lower: -35 }, backLeg: tucked, trail: { from: 'frontFoot', reach: 20, curve: -14 } },
    crane(220),
  ]),
];
