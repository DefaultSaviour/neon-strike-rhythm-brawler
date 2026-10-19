import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { buildFighterPose, buildKey, comboMove, FighterSpec, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE STALLION: a heavyweight boxer in the spirit of the 70s underdog
 * boxing films: grey sweats, a black beanie and big red gloves. The nobody
 * who goes the distance. Every move is a punch: jabs, crosses, hooks, body
 * shots and uppercuts, with slips and rolls between them. Physical only:
 * no magic.
 *
 * Built the round-one way: each move is ONE clear idea in a few big poses,
 * every hit is held for a beat (withHolds), and the hips stay near the
 * centre. 21 combos over the 5 tiers (5, 5, 4, 4, 3); the first keyframe is
 * the hit.
 *
 * Angles: 0 deg = toward the enemy, 90 = down, -90 = up, 180 = back. Feet
 * planted on the floor are at y = 68.
 */

const TRAIL = '#ff4a3d'; // red leather glove
const F = FLOOR;

/** An arm held straight out at an angle (- is higher). */
const straight = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
/** The guard: both gloves up by the chin, elbows tucked in to cover the ribs. */
const guardFront: LimbAngles = { upper: 45, lower: -120 };
const guardBack: LimbAngles = { upper: 40, lower: -125 };
/** A hook: elbow up level with the fist, the arm swinging round like a hinge. */
const hook: LimbAngles = { upper: -8, lower: 60 };
/** An uppercut: fist driving straight up from the hip. */
const uppercut: LimbAngles = { upper: 40, lower: -88 };
/** Arms thrown wide in celebration. */
const armsUp = straight(-90);
const armsUpBack = straight(-96);

/** Bladed stance: lead foot forward, rear foot back, up on the balls of the feet. */
const stance = { frontLeg: { x: 22, y: F }, backLeg: { x: -18, y: F } };
/** Stepping in behind a punch. */
const stepIn = { pelvis: { x: 6, y: 16 }, frontLeg: { x: 30, y: F }, backLeg: { x: -14, y: F } };
/** Sitting down low to dig to the body. */
const low = { pelvis: { x: 4, y: 26 }, frontLeg: { x: 26, y: F }, backLeg: { x: -18, y: F } };

type Key = FighterSpec & { ms?: number };

let nextId = 701;
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[]): AttackMove {
  return comboMove(nextId++, tier, name, description, withHolds(keys.map((k) => buildKey(k, TRAIL, k.ms ?? 0))));
}

/** Hands up, chin down, bouncing on the balls of his feet. */
export const STALLION_IDLE: SkeletonPose = buildFighterPose(
  { pelvis: { x: 0, y: 12 }, lean: 10, tilt: 6, frontArm: guardFront, backArm: guardBack, ...stance },
  TRAIL
);

/** A jab or cross landing, the other glove still guarding the chin. */
const jab = (deg = -4, extra: Partial<Key> = {}): Key => ({
  pelvis: { x: 4, y: 13 },
  lean: 14,
  frontArm: straight(deg),
  backArm: guardBack,
  ...stance,
  trail: { from: 'frontHand', reach: 18 },
  ...extra,
});
const cross = (deg = -2, extra: Partial<Key> = {}): Key => ({
  ...stepIn,
  lean: 22,
  frontArm: guardFront,
  backArm: straight(deg),
  trail: { from: 'backHand', reach: 20 },
  ...extra,
});
/** Back in his guard, hands up. */
const guardUp = (ms: number, extra: Partial<Key> = {}): Key => ({ ms, pelvis: { x: 0, y: 12 }, lean: 10, tilt: 6, frontArm: guardFront, backArm: guardBack, ...stance, ...extra });

export const STALLION_MOVES: AttackMove[] = [
  // ======================= Tier 1: the fundamentals =======================
  combo(1, 'Jab', 'A stiff lead jab, snapped straight back to the chin', [jab(), guardUp(150)]),
  combo(1, 'One-Two', 'Jab to set it up, then the rear hand crashes straight through', [jab(), { ms: 90, ...cross() }]),
  combo(1, 'Lead Hook', 'The lead arm swings round in a short, heavy hook', [
    { pelvis: { x: 4, y: 14 }, lean: 10, tilt: -6, frontArm: hook, backArm: guardBack, ...stance, trail: { from: 'frontHand', reach: 18, curve: 20 } },
    guardUp(160),
  ]),
  combo(1, 'Body Jab', 'Drops level and spears a jab into the stomach', [
    { ...low, lean: 24, frontArm: straight(18), backArm: guardBack, trail: { from: 'frontHand', reach: 18 } },
    guardUp(160),
  ]),
  combo(1, 'Double Jab', 'Two jabs, the second one stepping in behind the first', [
    jab(-4),
    guardUp(80, { frontArm: { upper: 40, lower: -60 } }),
    { ms: 80, ...jab(-6, { pelvis: { x: 8, y: 13 }, frontLeg: { x: 28, y: F } }) },
  ]),

  // ================= Tier 2: power punches =================
  combo(2, 'Uppercut', 'Dips at the knees and drives a rear uppercut up under the chin', [
    { ...low, pelvis: { x: 4, y: 22 }, lean: 6, frontArm: guardFront, backArm: uppercut, trail: { from: 'backHand', reach: 20, curve: -12 } },
    guardUp(170),
  ]),
  combo(2, 'Liver Shot', 'A lead hook ripped low into the ribs, then one to the head', [
    { ...low, lean: 22, tilt: -8, frontArm: { upper: 30, lower: 80 }, backArm: guardBack, trail: { from: 'frontHand', reach: 18, curve: 18 } },
    { ms: 100, pelvis: { x: 4, y: 14 }, lean: 10, tilt: -6, frontArm: hook, backArm: guardBack, ...stance, trail: { from: 'frontHand', reach: 18, curve: 20 } },
  ]),
  combo(2, 'Bob and Weave', 'Ducks under a punch and comes up firing a hook', [
    { ...low, pelvis: { x: 0, y: 30 }, lean: 30, tilt: 10, frontArm: guardFront, backArm: hook, trail: { from: 'backHand', reach: 18, curve: 20 } },
    { ms: 120, pelvis: { x: 4, y: 14 }, lean: 10, tilt: -6, frontArm: hook, backArm: guardBack, ...stance, trail: { from: 'frontHand', reach: 18, curve: 20 } },
  ]),
  combo(2, 'Overhand Right', 'The rear hand loops over the top and crashes down', [
    { ...stepIn, lean: 28, tilt: 6, frontArm: guardFront, backArm: { upper: -50, lower: 25 }, trail: { from: 'backHand', reach: 20, curve: 18 } },
    guardUp(170),
  ]),
  combo(2, 'Check Hook', 'Pivots away on the lead foot and hooks them as they come in', [
    { pelvis: { x: -2, y: 14 }, lean: 4, tilt: -10, frontArm: hook, backArm: guardBack, frontLeg: { x: 20, y: F }, backLeg: { x: -24, y: F }, trail: { from: 'frontHand', reach: 18, curve: 22 } },
    guardUp(170),
  ]),

  // =================== Tier 3: combinations ===================
  combo(3, 'Body-Head', 'Rips the body, then switches straight up to the head', [
    { ...low, lean: 24, frontArm: guardFront, backArm: straight(22), trail: { from: 'backHand', reach: 18 } },
    { ms: 100, pelvis: { x: 4, y: 14 }, lean: 10, tilt: -6, frontArm: hook, backArm: guardBack, ...stance, trail: { from: 'frontHand', reach: 18, curve: 20 } },
    { ms: 100, ...cross() },
  ]),
  combo(3, 'Meat Locker Flurry', 'Pounds away like he is working the frozen meat in the cold store', [
    jab(6, { pelvis: { x: 4, y: 18 }, lean: 18 }),
    { ms: 70, ...cross(8, { pelvis: { x: 6, y: 18 } }) },
    { ms: 70, ...jab(2, { pelvis: { x: 4, y: 18 }, lean: 18 }) },
  ]),
  combo(3, 'Southpaw Switch', 'Switches stance mid-fight and lands a big straight from the other side', [
    { pelvis: { x: 4, y: 14 }, lean: 18, frontArm: guardFront, backArm: straight(-4), frontLeg: { x: -16, y: F }, backLeg: { x: 26, y: F }, trail: { from: 'backHand', reach: 22 } },
    guardUp(170, { frontLeg: { x: -16, y: F }, backLeg: { x: 22, y: F } }),
  ]),
  combo(3, 'Iron Chin', 'Takes the hit on the chin, grins, and fires one straight back', [
    { ...stepIn, lean: 20, tilt: -14, frontArm: guardFront, backArm: straight(-2), trail: { from: 'backHand', reach: 20 } },
    guardUp(180, { tilt: -10 }),
  ]),

  // ================= Tier 4: heavyweight =================
  combo(4, 'Haymaker', 'Winds right back and throws everything into one huge rear hand', [
    { ...stepIn, lean: 30, tilt: 6, frontArm: { upper: 120, lower: 100 }, backArm: straight(-8), trail: { from: 'backHand', reach: 26, curve: 24 } },
    guardUp(190),
  ]),
  combo(4, 'Three-Piece', 'Hook, hook, uppercut, digging in close', [
    { pelvis: { x: 4, y: 14 }, lean: 10, tilt: -6, frontArm: hook, backArm: guardBack, ...stance, trail: { from: 'frontHand', reach: 18, curve: 20 } },
    { ms: 90, pelvis: { x: 4, y: 14 }, lean: 12, tilt: 6, frontArm: guardFront, backArm: hook, ...stance, trail: { from: 'backHand', reach: 18, curve: 20 } },
    { ms: 90, ...low, pelvis: { x: 4, y: 22 }, lean: 6, frontArm: uppercut, backArm: guardBack, trail: { from: 'frontHand', reach: 20, curve: -12 } },
  ]),
  combo(4, 'Corner Barrage', 'Traps them on the ropes and unloads both hands', [
    cross(4),
    { ms: 75, ...jab(2, { pelvis: { x: 6, y: 14 } }) },
    { ms: 75, ...cross(-4) },
  ]),
  combo(4, 'Training Montage', 'A blur of punches as if the whole training montage plays at once', [
    { ...low, lean: 24, frontArm: straight(18), backArm: guardBack, trail: { from: 'frontHand', reach: 18 } },
    { ms: 80, ...jab(-4) },
    { ms: 90, pelvis: { x: 0, y: 10 }, lean: -4, frontArm: armsUp, backArm: armsUpBack, ...stance },
  ]),

  // ================= Tier 5: legendary finishers =================
  combo(5, 'The Distance', 'Jab, cross, hook and uppercut: everything he has left, still standing at the end', [
    jab(),
    { ms: 80, ...cross() },
    { ms: 90, pelvis: { x: 4, y: 14 }, lean: 10, tilt: -6, frontArm: hook, backArm: guardBack, ...stance, trail: { from: 'frontHand', reach: 18, curve: 20 } },
    { ms: 100, ...low, pelvis: { x: 4, y: 22 }, lean: 6, frontArm: guardFront, backArm: uppercut, trail: { from: 'backHand', reach: 22, curve: -12 } },
  ]),
  combo(5, 'Final Round', 'One last haymaker that ends it, then both arms thrown up high', [
    { ...stepIn, lean: 32, tilt: 6, frontArm: { upper: 120, lower: 100 }, backArm: straight(-8), trail: { from: 'backHand', reach: 28, curve: 24 } },
    { ms: 260, pelvis: { x: 0, y: 10 }, lean: -6, tilt: -12, frontArm: armsUp, backArm: armsUpBack, ...stance },
  ]),
  combo(5, 'Comeback', 'Ducks low, bursts up with an uppercut, and finishes with a cross', [
    { ...low, pelvis: { x: 0, y: 30 }, lean: 30, tilt: 10, frontArm: guardFront, backArm: straight(24), trail: { from: 'backHand', reach: 18 } },
    { ms: 110, ...low, pelvis: { x: 4, y: 20 }, lean: 4, frontArm: uppercut, backArm: guardBack, trail: { from: 'frontHand', reach: 22, curve: -12 } },
    { ms: 100, ...cross(-4) },
  ]),
];
