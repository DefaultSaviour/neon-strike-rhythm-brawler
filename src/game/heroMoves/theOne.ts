import { AttackMove, Point2D, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { STILL_DRIFT } from '../combo';
import { armReaching, buildFighterPose, buildKey, comboMove, FighterSpec, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE ONE: a calm, bullet-time martial artist in a long black coat, in the
 * spirit of the late-90s cyberpunk kung-fu films. Effortless, precise
 * strikes in tiers 1 to 3 and 5.
 *
 * Tier 4 is his twist: he stops fighting with his body at all. He sits
 * cross-legged in the air like a monk at prayer, facing you, palms pressed
 * together at his chest, and does not move. He never turns to face an
 * enemy: the whole of him simply drifts over toward the side being
 * attacked, and the hit appears there as a cut in the air, with nothing
 * connecting it to him. Between attacks he stays sitting there (the tier's
 * rest pose).
 *
 * He holds the last pose of every move until the next attack (`holdsPose`
 * in heroes.ts), so each move ends in its own pose.
 *
 * Built the Baba Yaga way: each move is ONE clear idea in a few big poses,
 * every hit is held for a beat (withHolds), and the hips stay near the
 * centre so he never drifts off his spot. 21 combos over the 5 tiers
 * (5, 5, 4, 4, 3); the first keyframe is the hit.
 *
 * Angles: 0 deg = toward the enemy, 90 = down, -90 = up, 180 = back. Feet
 * planted on the floor are at y = 68.
 */

const TRAIL = '#39ff6a'; // digital green
const F = FLOOR;

/** Rear hand loose by the hip: he barely needs a guard. */
const relaxed: LimbAngles = { upper: 95, lower: 80 };
/** Rear hand up guarding the chin, for the harder exchanges. */
const guard: LimbAngles = { upper: 110, lower: -65 };
/** An arm or leg held straight out at an angle (- is higher). */
const straight = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
/** Arms swept back for balance in kicks and leaps. */
const armsBack: LimbAngles = { upper: 150, lower: 130 };
/** Arms spread wide, like a T: spins and floating. */
const spreadFront = straight(-10);
const spreadBack = straight(190);
/** A leg tucked up under the body in the air. */
const tucked: LimbAngles = { upper: 70, lower: 150 };

/** A wide, planted base. */
const wide = { frontLeg: { x: 22, y: F }, backLeg: { x: -20, y: F } };
/** A lunge forward, hips kept near the centre. */
const lunge = { pelvis: { x: 6, y: 20 }, frontLeg: { x: 30, y: F }, backLeg: { x: -20, y: F } };

/** Sitting cross-legged in the air, seen from the front: knees wide out to either side, shins crossing flat under him. */
const lotus = { frontLeg: { upper: 12, lower: 162 }, backLeg: { upper: 168, lower: 18 } };
/** Sitting in the air with his hips at this height (lower numbers are higher up). */
const sit = (y: number) => ({ pelvis: { x: 0, y }, ...lotus });
/**
 * Where the enemy stands when the hit lands, measured from his own middle:
 * the strike line is 78 out, and by then he has drifted STILL_DRIFT toward it.
 */
const ENEMY_X = 78 - STILL_DRIFT;

/** A cut that appears in the air, given by its two ends. */
interface Cut {
  from: Point2D;
  to: Point2D;
  curve?: number;
}

type Key = FighterSpec & { ms?: number };

let nextId = 301;
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[]): AttackMove {
  return comboMove(nextId++, tier, name, description, withHolds(keys.map((k) => buildKey(k, TRAIL, k.ms ?? 0))));
}

/** Tier 4, always: sitting cross-legged in the air, palms pressed together in front of his chest, elbows out. */
const lotusAt = (y: number): FighterSpec => {
  const base: FighterSpec = { ...sit(y), lean: 0, frontArm: straight(90), backArm: straight(90) };
  const palms = { x: 0, y: y - 21 };
  return { ...base, frontArm: armReaching(base, 'front', palms, true), backArm: armReaching(base, 'back', palms) };
};
export const THE_ONE_LOTUS: SkeletonPose = buildFighterPose(lotusAt(6), TRAIL);

/**
 * A tier 4 move. He does not move a muscle or turn his head: he sits in the
 * air (lifting a touch as the hit lands, then settling), and the hit simply
 * appears as a cut in the air where the enemy stands. `still` keeps him
 * facing the same way and drifts the whole of him toward the attacking side.
 */
function mind(name: string, description: string, cut: Cut): AttackMove {
  const hit = buildKey(lotusAt(3), TRAIL, 0);
  hit.trail = { start: cut.from, end: cut.to, curveOffset: cut.curve ?? 0, color: TRAIL };
  const settle = buildKey(lotusAt(6), TRAIL, 200);
  return { ...comboMove(nextId++, 4, name, description, withHolds([hit, settle])), restPose: THE_ONE_LOTUS, still: true };
}

/** Relaxed and upright, lead hand out palm-up: "come on". */
export const THE_ONE_IDLE: SkeletonPose = buildFighterPose(
  {
    pelvis: { x: 0, y: 8 },
    lean: 0,
    frontArm: { upper: 40, lower: -55 },
    backArm: relaxed,
    frontLeg: { x: 14, y: F },
    backLeg: { x: -14, y: F },
  },
  TRAIL
);

export const THE_ONE_MOVES: AttackMove[] = [
  // ======================= Tier 1: effortless basics =======================
  combo(1, 'Palm Block Counter', 'Brushes the strike aside with one palm and counters with the other', [
    { pelvis: { x: 2, y: 12 }, lean: 6, frontArm: { upper: -40, lower: -95 }, backArm: guard, ...wide, trail: { from: 'frontHand', reach: 14, curve: -12 } },
    { ms: 120, ...lunge, lean: 18, frontArm: { upper: 100, lower: -60 }, backArm: straight(-4), trail: { from: 'backHand', reach: 18 } },
  ]),
  combo(1, 'Rapid Jab Flurry', 'Jab, cross, jab: three straight punches, hardly moving', [
    { pelvis: { x: 2, y: 12 }, lean: 10, frontArm: straight(-4), backArm: guard, ...wide, trail: { from: 'frontHand', reach: 16 } },
    { ms: 70, pelvis: { x: 4, y: 12 }, lean: 16, frontArm: guard, backArm: straight(-2), ...wide, trail: { from: 'backHand', reach: 18 } },
    { ms: 70, pelvis: { x: 2, y: 12 }, lean: 10, frontArm: straight(-6), backArm: guard, ...wide, trail: { from: 'frontHand', reach: 16 } },
  ]),
  combo(1, 'Low Sweep', 'Drops to one knee and scythes the rear leg along the floor', [
    { pelvis: { x: -2, y: 50 }, lean: 25, frontArm: { upper: 80, lower: 95 }, backArm: armsBack, frontLeg: { x: 8, y: F }, backLeg: straight(4), trail: { from: 'backFoot', reach: 20, curve: 8 } },
    { ms: 140, pelvis: { x: -2, y: 48 }, lean: 18, frontArm: { upper: 80, lower: 95 }, backArm: armsBack, frontLeg: { x: 8, y: F }, backLeg: straight(22) },
  ]),
  combo(1, 'One-Hand Push', 'A single calm palm that sends them flying, then he straightens his coat', [
    { ...lunge, lean: 20, frontArm: straight(-2), backArm: relaxed, trail: { from: 'frontHand', reach: 20 } },
    { ms: 160, pelvis: { x: 2, y: 10 }, lean: 2, frontArm: { upper: 30, lower: -40 }, backArm: relaxed, frontLeg: { x: 16, y: F }, backLeg: { x: -16, y: F } },
  ]),
  combo(1, 'Spin Backfist', 'Turns on the spot and whips the back of the fist round', [
    { pelvis: { x: 2, y: 12 }, lean: 8, tilt: -8, frontArm: { upper: -40, lower: 12 }, backArm: armsBack, ...wide, trail: { from: 'frontHand', reach: 18, curve: -16 } },
    { ms: 140, pelvis: { x: 2, y: 12 }, lean: 6, frontArm: straight(-10), backArm: relaxed, ...wide },
  ]),

  // ================= Tier 2: the famous moves =================
  combo(2, 'Bullet Dodge Lean-Back', 'Bends impossibly far back with a kick, then springs up into a punch', [
    { pelvis: { x: 0, y: 30 }, lean: -70, frontArm: armsBack, backArm: { upper: 170, lower: 150 }, frontLeg: { upper: -30, lower: -30 }, backLeg: { x: -6, y: F }, trail: { from: 'frontFoot', reach: 18, curve: -10 } },
    { ms: 200, ...lunge, lean: 18, frontArm: straight(-4), backArm: guard, trail: { from: 'frontHand', reach: 20 } },
  ]),
  combo(2, 'Wall-Run Kick', 'Runs up the wall and kicks off it, high and sideways', [
    { pelvis: { x: 0, y: -16 }, lean: -32, frontArm: guard, backArm: armsBack, frontLeg: straight(-12), backLeg: tucked, trail: { from: 'frontFoot', reach: 22 } },
    { ms: 200, pelvis: { x: 4, y: 34 }, lean: 22, frontArm: { upper: 75, lower: 85 }, backArm: armsBack, frontLeg: { x: 26, y: F }, backLeg: { x: -18, y: F } },
  ]),
  combo(2, 'Corkscrew Kick', 'Leaps and twists in the air: one leg, then the other', [
    { pelvis: { x: 0, y: -14 }, lean: -20, tilt: 10, frontArm: spreadFront, backArm: spreadBack, frontLeg: tucked, backLeg: straight(-6), trail: { from: 'backFoot', reach: 20, curve: 14 } },
    { ms: 120, pelvis: { x: 2, y: -14 }, lean: -20, tilt: -10, frontArm: spreadBack, backArm: spreadFront, frontLeg: straight(-4), backLeg: tucked, trail: { from: 'frontFoot', reach: 20, curve: -14 } },
    { ms: 170, pelvis: { x: 2, y: 22 }, lean: 0, frontArm: spreadFront, backArm: spreadBack, ...wide },
  ]),
  combo(2, 'Twin Palm Strike', 'Both palms driven out together from a low stance', [
    { ...lunge, lean: 16, frontArm: straight(-2), backArm: straight(6), trail: { from: 'frontHand', reach: 22 } },
    { ms: 150, ...lunge, pelvis: { x: 6, y: 24 }, lean: 22, frontArm: straight(4), backArm: straight(10) },
  ]),
  combo(2, 'Flying Knee', 'Leaps straight up and drives the knee through the chin', [
    { pelvis: { x: 2, y: -12 }, lean: 6, frontArm: armsBack, backArm: { upper: 30, lower: -60 }, frontLeg: { upper: -55, lower: 80 }, backLeg: { upper: 100, lower: 120 }, trail: { from: 'frontKnee', reach: 18, curve: -6 } },
    { ms: 190, pelvis: { x: 2, y: 14 }, lean: 0, frontArm: { upper: -10, lower: -80 }, backArm: relaxed, ...wide },
  ]),

  // =================== Tier 3: bullet time ===================
  combo(3, 'Air Pirouette Kick', 'Spins up into the air with a high kick, then a back heel', [
    { pelvis: { x: 0, y: -16 }, lean: -24, frontArm: spreadFront, backArm: spreadBack, frontLeg: straight(-30), backLeg: tucked, trail: { from: 'frontFoot', reach: 20, curve: -18 } },
    { ms: 130, pelvis: { x: 2, y: -16 }, lean: -30, tilt: 10, frontArm: spreadBack, backArm: spreadFront, frontLeg: tucked, backLeg: straight(4), trail: { from: 'backFoot', reach: 20, curve: 16 } },
    { ms: 180, pelvis: { x: 0, y: 36 }, lean: 14, tilt: 22, frontArm: { upper: 80, lower: 95 }, backArm: { upper: 100, lower: 85 }, frontLeg: { x: 20, y: F }, backLeg: { x: -24, y: F } },
  ]),
  combo(3, 'Hands-Only Spin', 'Arms out like blades, he spins and strikes with each hand in turn', [
    { pelvis: { x: 2, y: 12 }, lean: 4, frontArm: straight(0), backArm: spreadBack, ...wide, trail: { from: 'frontHand', reach: 20, curve: 18 } },
    { ms: 110, pelvis: { x: 0, y: 12 }, lean: 0, tilt: 10, frontArm: spreadBack, backArm: straight(0), ...wide, trail: { from: 'backHand', reach: 20, curve: 18 } },
    { ms: 110, pelvis: { x: 2, y: 12 }, lean: 4, frontArm: straight(-6), backArm: spreadBack, ...wide, trail: { from: 'frontHand', reach: 20, curve: 18 } },
  ]),
  combo(3, 'Lean-Back Flip Kick', 'Leans back as the leg arcs up, flips right over, and lands', [
    { pelvis: { x: -2, y: 4 }, lean: -55, frontArm: { upper: 170, lower: 180 }, backArm: { upper: 150, lower: 170 }, frontLeg: straight(-60), backLeg: { upper: 100, lower: 140 }, trail: { from: 'frontFoot', reach: 22, curve: -24 } },
    { ms: 150, pelvis: { x: -4, y: -14 }, lean: -110, frontArm: { upper: 200, lower: 210 }, backArm: { upper: 190, lower: 200 }, frontLeg: straight(-115), backLeg: { upper: -80, lower: -50 } },
    { ms: 160, pelvis: { x: -2, y: 8 }, lean: 0, frontArm: { upper: 60, lower: -110 }, backArm: relaxed, frontLeg: { x: 8, y: F }, backLeg: { x: -12, y: F } },
  ]),
  combo(3, 'Hundred Punch Blur', 'Rooted in place, punches too fast to follow', [
    { pelvis: { x: 2, y: 12 }, lean: 12, frontArm: straight(-6), backArm: guard, ...wide, trail: { from: 'frontHand', reach: 16 } },
    { ms: 55, pelvis: { x: 3, y: 12 }, lean: 14, frontArm: guard, backArm: straight(2), ...wide, trail: { from: 'backHand', reach: 16 } },
    { ms: 55, pelvis: { x: 2, y: 12 }, lean: 12, frontArm: straight(8), backArm: guard, ...wide, trail: { from: 'frontHand', reach: 16 } },
  ]),

  // ================= Tier 4: the lotus (he sits in the air; the hits just appear) =================
  mind('A Thought', 'He thinks it, and a cut falls across them from above', {
    from: { x: ENEMY_X - 14, y: -46 },
    to: { x: ENEMY_X + 14, y: 22 },
    curve: 8,
  }),
  mind('Stillness', 'Nothing moves, and a line opens straight through them', {
    from: { x: ENEMY_X - 16, y: -14 },
    to: { x: ENEMY_X + 16, y: -14 },
  }),
  mind('Silence', 'A cut drops down through them from over their head', {
    from: { x: ENEMY_X, y: -62 },
    to: { x: ENEMY_X + 2, y: 40 },
    curve: -8,
  }),
  mind('A Breath', 'He breathes out, and a cut rises up through them from the floor', {
    from: { x: ENEMY_X - 14, y: 34 },
    to: { x: ENEMY_X + 14, y: -48 },
    curve: -10,
  }),

  // ================= Tier 5: legendary finishers =================
  combo(5, 'Surrounded', 'Surrounded: a punch ahead, a kick behind, a kick ahead, and a final palm', [
    { pelvis: { x: 2, y: 12 }, lean: 12, frontArm: straight(-4), backArm: guard, ...wide, trail: { from: 'frontHand', reach: 18 } },
    { ms: 110, pelvis: { x: 0, y: 8 }, lean: 30, frontArm: { upper: 120, lower: 100 }, backArm: guard, frontLeg: { x: 10, y: F }, backLeg: straight(176), trail: { from: 'backFoot', reach: 20 } },
    { ms: 110, pelvis: { x: 0, y: 8 }, lean: -26, frontArm: guard, backArm: armsBack, frontLeg: straight(-12), backLeg: { x: -12, y: F }, trail: { from: 'frontFoot', reach: 20 } },
    { ms: 130, ...lunge, lean: 20, frontArm: straight(-2), backArm: relaxed, trail: { from: 'frontHand', reach: 22 } },
  ]),
  combo(5, 'Superman Punch', 'Launches flat out through the air behind one fist, and lands in a crouch', [
    { pelvis: { x: 0, y: -10 }, lean: 70, frontArm: straight(-2), backArm: straight(170), frontLeg: straight(165), backLeg: straight(175), trail: { from: 'frontHand', reach: 28 } },
    { ms: 220, pelvis: { x: 4, y: 40 }, lean: 30, frontArm: { upper: 70, lower: 90 }, backArm: armsBack, frontLeg: { x: 24, y: F }, backLeg: { upper: 100, lower: 175 } },
  ]),
  combo(5, 'Instant Master', 'Jab, high kick, a palm to the chest, then he stands tall and beckons', [
    { pelvis: { x: 2, y: 12 }, lean: 10, frontArm: straight(-4), backArm: guard, ...wide, trail: { from: 'frontHand', reach: 18 } },
    { ms: 110, pelvis: { x: 0, y: 8 }, lean: -28, frontArm: guard, backArm: armsBack, frontLeg: straight(-22), backLeg: { x: -12, y: F }, trail: { from: 'frontFoot', reach: 22 } },
    { ms: 120, ...lunge, lean: 20, frontArm: straight(0), backArm: relaxed, trail: { from: 'frontHand', reach: 22 } },
    { ms: 200, pelvis: { x: 0, y: 8 }, lean: 0, frontArm: { upper: 40, lower: -55 }, backArm: relaxed, frontLeg: { x: 14, y: F }, backLeg: { x: -14, y: F } },
  ]),
];
