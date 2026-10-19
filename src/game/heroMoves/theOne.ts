import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { buildFighterPose, buildKey, comboMove, FighterSpec, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE ONE: a calm, bullet-time martial artist in a long black coat, in the
 * spirit of the late-90s cyberpunk kung-fu films. Effortless, precise
 * strikes, and in the overdrive tier he simply floats, kicking in slow
 * motion. Physical only: no magic.
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

type Key = FighterSpec & { ms?: number };

let nextId = 301;
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[]): AttackMove {
  return comboMove(nextId++, tier, name, description, withHolds(keys.map((k) => buildKey(k, TRAIL, k.ms ?? 0))));
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
    { ms: 200, pelvis: { x: 4, y: 24 }, lean: 10, frontArm: { upper: 40, lower: -55 }, backArm: relaxed, frontLeg: { x: 26, y: F }, backLeg: { x: -14, y: F } },
  ]),
  combo(2, 'Corkscrew Kick', 'Leaps and twists in the air: one leg, then the other', [
    { pelvis: { x: 0, y: -14 }, lean: -20, tilt: 10, frontArm: spreadFront, backArm: spreadBack, frontLeg: tucked, backLeg: straight(-6), trail: { from: 'backFoot', reach: 20, curve: 14 } },
    { ms: 120, pelvis: { x: 2, y: -14 }, lean: -20, tilt: -10, frontArm: spreadBack, backArm: spreadFront, frontLeg: straight(-4), backLeg: tucked, trail: { from: 'frontFoot', reach: 20, curve: -14 } },
    { ms: 170, pelvis: { x: 2, y: 22 }, lean: 10, frontArm: { upper: 40, lower: -55 }, backArm: relaxed, ...wide },
  ]),
  combo(2, 'Twin Palm Strike', 'Both palms driven out together from a low stance', [
    { ...lunge, lean: 16, frontArm: straight(-2), backArm: straight(6), trail: { from: 'frontHand', reach: 22 } },
    { ms: 150, ...lunge, pelvis: { x: 6, y: 24 }, lean: 22, frontArm: straight(4), backArm: straight(10) },
  ]),
  combo(2, 'Flying Knee', 'Leaps straight up and drives the knee through the chin', [
    { pelvis: { x: 2, y: -12 }, lean: 6, frontArm: armsBack, backArm: { upper: 30, lower: -60 }, frontLeg: { upper: -55, lower: 80 }, backLeg: { upper: 100, lower: 120 }, trail: { from: 'frontKnee', reach: 18, curve: -6 } },
    { ms: 190, pelvis: { x: 2, y: 22 }, lean: 10, frontArm: { upper: 40, lower: -55 }, backArm: relaxed, ...wide },
  ]),

  // =================== Tier 3: bullet time ===================
  combo(3, 'Air Pirouette Kick', 'Spins up into the air with a high kick, then a back heel', [
    { pelvis: { x: 0, y: -16 }, lean: -24, frontArm: spreadFront, backArm: spreadBack, frontLeg: straight(-30), backLeg: tucked, trail: { from: 'frontFoot', reach: 20, curve: -18 } },
    { ms: 130, pelvis: { x: 2, y: -16 }, lean: -30, tilt: 10, frontArm: spreadBack, backArm: spreadFront, frontLeg: tucked, backLeg: straight(4), trail: { from: 'backFoot', reach: 20, curve: 16 } },
    { ms: 180, pelvis: { x: 2, y: 22 }, lean: 10, frontArm: { upper: 40, lower: -55 }, backArm: relaxed, ...wide },
  ]),
  combo(3, 'Hands-Only Spin', 'Arms out like blades, he spins and strikes with each hand in turn', [
    { pelvis: { x: 2, y: 12 }, lean: 4, frontArm: straight(0), backArm: spreadBack, ...wide, trail: { from: 'frontHand', reach: 20, curve: 18 } },
    { ms: 110, pelvis: { x: 0, y: 12 }, lean: 0, tilt: 10, frontArm: spreadBack, backArm: straight(0), ...wide, trail: { from: 'backHand', reach: 20, curve: 18 } },
    { ms: 110, pelvis: { x: 2, y: 12 }, lean: 4, frontArm: straight(-6), backArm: spreadBack, ...wide, trail: { from: 'frontHand', reach: 20, curve: 18 } },
  ]),
  combo(3, 'Lean-Back Flip Kick', 'Leans back as the leg arcs up, flips right over, and lands', [
    { pelvis: { x: -2, y: 4 }, lean: -55, frontArm: { upper: 170, lower: 180 }, backArm: { upper: 150, lower: 170 }, frontLeg: straight(-60), backLeg: { upper: 100, lower: 140 }, trail: { from: 'frontFoot', reach: 22, curve: -24 } },
    { ms: 150, pelvis: { x: -4, y: -14 }, lean: -110, frontArm: { upper: 200, lower: 210 }, backArm: { upper: 190, lower: 200 }, frontLeg: straight(-115), backLeg: { upper: -80, lower: -50 } },
    { ms: 160, pelvis: { x: -2, y: 22 }, lean: 10, frontArm: { upper: 40, lower: -55 }, backArm: relaxed, ...wide },
  ]),
  combo(3, 'Hundred Punch Blur', 'Rooted in place, punches too fast to follow', [
    { pelvis: { x: 2, y: 12 }, lean: 12, frontArm: straight(-6), backArm: guard, ...wide, trail: { from: 'frontHand', reach: 16 } },
    { ms: 55, pelvis: { x: 3, y: 12 }, lean: 14, frontArm: guard, backArm: straight(2), ...wide, trail: { from: 'backHand', reach: 16 } },
    { ms: 55, pelvis: { x: 2, y: 12 }, lean: 12, frontArm: straight(8), backArm: guard, ...wide, trail: { from: 'frontHand', reach: 16 } },
  ]),

  // ================= Tier 4: he floats (slow-motion air moves) =================
  combo(4, 'Float Kick', 'Floats up off the floor and kicks three times in slow motion', [
    { pelvis: { x: 0, y: -24 }, lean: -20, frontArm: spreadFront, backArm: spreadBack, frontLeg: straight(-8), backLeg: { upper: 100, lower: 120 }, trail: { from: 'frontFoot', reach: 22 } },
    { ms: 220, pelvis: { x: 0, y: -26 }, lean: -14, frontArm: spreadFront, backArm: spreadBack, frontLeg: { upper: 100, lower: 120 }, backLeg: straight(2), trail: { from: 'backFoot', reach: 22 } },
    { ms: 220, pelvis: { x: 0, y: -26 }, lean: -24, frontArm: spreadFront, backArm: spreadBack, frontLeg: straight(-18), backLeg: { upper: 100, lower: 120 }, trail: { from: 'frontFoot', reach: 22 } },
  ]),
  combo(4, 'Hover Spin', 'Hangs in the air turning slowly, arms and legs out like spokes', [
    { pelvis: { x: 0, y: -22 }, lean: -6, frontArm: straight(-4), backArm: spreadBack, frontLeg: { upper: 100, lower: 110 }, backLeg: { upper: 80, lower: 100 }, trail: { from: 'frontHand', reach: 20, curve: 16 } },
    { ms: 220, pelvis: { x: 0, y: -24 }, lean: -10, tilt: 10, frontArm: spreadBack, backArm: spreadFront, frontLeg: straight(4), backLeg: straight(176), trail: { from: 'frontFoot', reach: 20, curve: 16 } },
  ]),
  combo(4, 'Hang-Time Axe', 'Floats up with the leg raised high, hangs there, then chops it down', [
    { pelvis: { x: 0, y: -22 }, lean: -16, frontArm: spreadFront, backArm: spreadBack, frontLeg: { upper: -80, lower: -82 }, backLeg: { upper: 100, lower: 120 }, trail: { from: 'frontFoot', reach: 18, curve: -20 } },
    { ms: 260, pelvis: { x: 0, y: -26 }, lean: -18, frontArm: spreadFront, backArm: spreadBack, frontLeg: { upper: -84, lower: -86 }, backLeg: { upper: 100, lower: 120 } },
    { ms: 120, pelvis: { x: 2, y: -6 }, lean: 10, frontArm: { upper: 60, lower: -30 }, backArm: armsBack, frontLeg: straight(45), backLeg: { upper: 100, lower: 120 }, trail: { from: 'frontFoot', reach: 18, curve: -16 } },
  ]),
  combo(4, 'Slow-Mo Flying Side Kick', 'A flying side kick that hangs in the air in slow motion', [
    { pelvis: { x: 0, y: -20 }, lean: -40, frontArm: armsBack, backArm: { upper: 160, lower: 150 }, frontLeg: straight(-6), backLeg: tucked, trail: { from: 'frontFoot', reach: 26 } },
    { ms: 340, pelvis: { x: 6, y: -22 }, lean: -42, frontArm: armsBack, backArm: { upper: 160, lower: 150 }, frontLeg: straight(-4), backLeg: tucked, trail: { from: 'frontFoot', reach: 26 } },
  ]),

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
