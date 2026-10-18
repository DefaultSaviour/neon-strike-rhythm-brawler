import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { buildFighterPose, buildKey, FighterSpec, keyToPlayerPose, LimbAngles } from './poseBuilder';

/**
 * THE LITTLE DRAGON: a lightning-fast martial artist in the spirit of the
 * great 70s kung-fu films, fighting like a hero from Street Fighter or
 * Mortal Kombat. No fireballs, no magic: just hard, physical moves.
 *
 * Every move is a COMBO: the first keyframe is the hit that lands on your
 * button press, then the follow-ups play out (extra hits, spins, landings).
 * Between keyframes each bone rotates around its joint (see combo.ts).
 *
 * 21 moves across the 5 combo tiers (5, 5, 4, 4, 3). Poses are built from
 * joint angles (see poseBuilder.ts): 0 deg = toward the enemy, 90 = down,
 * -90 = up, 180 = back. Feet planted on the floor are at y = 68.
 */

const TRAIL = '#ffe600'; // the famous yellow tracksuit
const F = FLOOR;

/** Rear hand guarding the chin / chest. */
const guard: LimbAngles = { upper: 110, lower: -65 };
/** Lead hand held low and forward, ready. */
const leadReady: LimbAngles = { upper: 40, lower: -20 };
/** Arms flung back for balance in big kicks and jumps. */
const armsBackHigh: LimbAngles = { upper: 160, lower: 140 };
const armsBackLow: LimbAngles = { upper: 140, lower: 120 };
/** A leg held straight out at an angle (both bones the same way). */
const straight = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
/** A leg tucked up under the body in the air. */
const tucked: LimbAngles = { upper: 70, lower: 150 };

/** The usual planted feet. */
const stanceLegs = { frontLeg: { x: 20, y: F }, backLeg: { x: -16, y: F } };

type Key = FighterSpec & { ms?: number };

let nextId = 101;
/** A move made of keyframes: the first one is the hit, then the follow-ups. */
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[]): AttackMove {
  const sequence = keys.map((k) => buildKey(k, TRAIL, k.ms ?? 0));
  const durationMs = 50 + sequence.slice(1).reduce((s, k) => s + k.ms, 0) + 140;
  return { id: nextId++, tier, name, description, durationMs, pose: keyToPlayerPose(sequence[0]), sequence };
}

/** The classic stance: low, on the balls of the feet, lead hand forward. */
export const LITTLE_DRAGON_IDLE: SkeletonPose = buildFighterPose(
  {
    pelvis: { x: 0, y: 12 },
    lean: 4,
    frontArm: leadReady,
    backArm: guard,
    frontLeg: { x: 16, y: F },
    backLeg: { x: -18, y: F },
  },
  TRAIL
);

export const LITTLE_DRAGON_MOVES: AttackMove[] = [
  // ======================= Tier 1: fast ground combos =======================
  combo(1, 'Jab-Cross', 'A snapping lead jab, then the rear fist fires straight through', [
    { pelvis: { x: 2, y: 11 }, lean: 8, frontArm: straight(-2), backArm: guard, ...stanceLegs, trail: { from: 'frontHand', reach: 16 } },
    {
      ms: 80,
      pelvis: { x: 5, y: 12 },
      lean: 16,
      frontArm: { upper: 100, lower: -70 },
      backArm: straight(0),
      frontLeg: { x: 20, y: F },
      backLeg: { x: -12, y: F },
      trail: { from: 'backHand', reach: 18 },
    },
  ]),
  combo(1, 'Double Snap Kick', 'Low kick to the shin, then the same leg snaps up to the head', [
    { pelvis: { x: 0, y: 9 }, lean: -10, frontArm: guard, backArm: armsBackLow, frontLeg: straight(30), backLeg: { x: -10, y: F }, trail: { from: 'frontFoot', curve: 6 } },
    { ms: 90, pelvis: { x: 0, y: 6 }, lean: -30, frontArm: guard, backArm: armsBackHigh, frontLeg: straight(-20), backLeg: { x: -10, y: F }, trail: { from: 'frontFoot', reach: 16, curve: -10 } },
  ]),
  combo(1, 'Elbow Backfist', 'A short lead elbow, then the fist whips out off the same arm', [
    { pelvis: { x: 4, y: 12 }, lean: 14, frontArm: { upper: 0, lower: 175 }, backArm: guard, ...stanceLegs, trail: { from: 'frontElbow', reach: 12, curve: 8 } },
    { ms: 85, pelvis: { x: 3, y: 11 }, lean: 6, frontArm: { upper: -35, lower: 15 }, backArm: guard, ...stanceLegs, trail: { from: 'frontHand', reach: 12, curve: -10 } },
  ]),
  combo(1, 'Palm Shove', 'A rooted palm strike, then both palms drive the enemy back', [
    { pelvis: { x: 3, y: 12 }, lean: 12, frontArm: { upper: 0, lower: -12 }, backArm: guard, ...stanceLegs, trail: { from: 'frontHand', reach: 14 } },
    {
      ms: 100,
      pelvis: { x: 9, y: 12 },
      lean: 18,
      frontArm: { upper: 2, lower: -8 },
      backArm: { upper: 8, lower: -12 },
      frontLeg: { x: 26, y: F },
      backLeg: { x: -10, y: F },
      trail: { from: 'backHand', reach: 18 },
    },
  ]),
  combo(1, 'Dragon Sweep', 'Drops low and spins the rear leg across the floor', [
    {
      pelvis: { x: -2, y: 50 },
      lean: 25,
      frontArm: { upper: 80, lower: 95 },
      backArm: { upper: 120, lower: 70 },
      frontLeg: { x: 6, y: F },
      backLeg: { upper: 6, lower: 2 },
      trail: { from: 'backFoot', reach: 18, curve: 8 },
    },
    {
      ms: 110,
      pelvis: { x: -2, y: 48 },
      lean: 15,
      frontArm: { upper: 80, lower: 95 },
      backArm: { upper: 140, lower: 100 },
      frontLeg: { x: 6, y: F },
      backLeg: { upper: 30, lower: 20 },
    },
  ]),

  // ================= Tier 2: the famous fighting-game specials =================
  combo(2, 'Rising Dragon Uppercut', 'A body blow from a crouch, then he launches skyward behind the uppercut', [
    { pelvis: { x: 4, y: 22 }, lean: 18, frontArm: { upper: 20, lower: -40 }, backArm: guard, frontLeg: { x: 22, y: F }, backLeg: { x: -14, y: F }, trail: { from: 'frontHand', curve: -8 } },
    {
      ms: 110,
      pelvis: { x: 8, y: -16 },
      lean: 4,
      frontArm: { upper: -82, lower: -86 },
      backArm: { upper: 150, lower: 170 },
      frontLeg: { upper: -30, lower: 80 },
      backLeg: { upper: 100, lower: 110 },
      trail: { from: 'frontHand', reach: 24, curve: -10 },
    },
    { ms: 140, pelvis: { x: 8, y: -6 }, lean: 0, frontArm: { upper: -86, lower: -90 }, backArm: { upper: 150, lower: 170 }, frontLeg: tucked, backLeg: { upper: 100, lower: 120 } },
  ]),
  combo(2, 'Hurricane Kick', 'Leaps and whirls like a propeller, legs scything round', [
    { pelvis: { x: 0, y: -12 }, lean: -8, frontArm: { upper: 150, lower: 120 }, backArm: { upper: 30, lower: -40 }, frontLeg: straight(-3), backLeg: straight(177), trail: { from: 'frontFoot', reach: 16, curve: 18 } },
    { ms: 55, pelvis: { x: 2, y: -14 }, lean: -8, frontArm: { upper: 150, lower: 120 }, backArm: { upper: 30, lower: -40 }, frontLeg: straight(90), backLeg: straight(-90) },
    { ms: 55, pelvis: { x: 4, y: -14 }, lean: -8, frontArm: { upper: 150, lower: 120 }, backArm: { upper: 30, lower: -40 }, frontLeg: straight(177), backLeg: straight(-3), trail: { from: 'backFoot', reach: 16, curve: 18 } },
    { ms: 55, pelvis: { x: 6, y: -12 }, lean: -8, frontArm: { upper: 150, lower: 120 }, backArm: { upper: 30, lower: -40 }, frontLeg: straight(-90), backLeg: straight(90) },
    { ms: 55, pelvis: { x: 8, y: -10 }, lean: -8, frontArm: { upper: 150, lower: 120 }, backArm: { upper: 30, lower: -40 }, frontLeg: straight(-3), backLeg: straight(177), trail: { from: 'frontFoot', reach: 16, curve: 18 } },
  ]),
  combo(2, 'Lightning Legs', 'Balanced on one leg, a blur of kicks too fast to count', [
    { pelvis: { x: -2, y: 8 }, lean: -25, frontArm: { upper: 40, lower: -50 }, backArm: armsBackHigh, frontLeg: straight(-10), backLeg: { x: -10, y: F }, trail: { from: 'frontFoot', reach: 14 } },
    { ms: 55, pelvis: { x: -2, y: 8 }, lean: -20, frontArm: { upper: 40, lower: -50 }, backArm: armsBackHigh, frontLeg: straight(30), backLeg: { x: -10, y: F }, trail: { from: 'frontFoot', reach: 14 } },
    { ms: 55, pelvis: { x: -2, y: 8 }, lean: -28, frontArm: { upper: 40, lower: -50 }, backArm: armsBackHigh, frontLeg: straight(-22), backLeg: { x: -10, y: F }, trail: { from: 'frontFoot', reach: 14 } },
    { ms: 55, pelvis: { x: -2, y: 8 }, lean: -20, frontArm: { upper: 40, lower: -50 }, backArm: armsBackHigh, frontLeg: straight(25), backLeg: { x: -10, y: F }, trail: { from: 'frontFoot', reach: 14 } },
    { ms: 55, pelvis: { x: -2, y: 8 }, lean: -26, frontArm: { upper: 40, lower: -50 }, backArm: armsBackHigh, frontLeg: straight(-14), backLeg: { x: -10, y: F }, trail: { from: 'frontFoot', reach: 16 } },
  ]),
  combo(2, 'Flash Kick', 'The leg sweeps up in a huge arc as he backflips away', [
    { pelvis: { x: -2, y: 2 }, lean: -55, frontArm: { upper: 170, lower: 180 }, backArm: { upper: 150, lower: 170 }, frontLeg: straight(-60), backLeg: { upper: 100, lower: 140 }, trail: { from: 'frontFoot', reach: 20, curve: -24 } },
    { ms: 120, pelvis: { x: -6, y: -14 }, lean: -105, frontArm: { upper: 200, lower: 210 }, backArm: { upper: 190, lower: 200 }, frontLeg: straight(-115), backLeg: { upper: -80, lower: -50 } },
    { ms: 130, pelvis: { x: -4, y: 24 }, lean: 10, frontArm: leadReady, backArm: guard, frontLeg: { x: 14, y: F }, backLeg: { x: -20, y: F } },
  ]),
  combo(2, 'Bicycle Kick', 'Flies forward pedalling kick after kick', [
    { pelvis: { x: 0, y: -10 }, lean: -30, frontArm: armsBackLow, backArm: { upper: 40, lower: -40 }, frontLeg: straight(-5), backLeg: tucked, trail: { from: 'frontFoot', reach: 16 } },
    { ms: 65, pelvis: { x: 5, y: -12 }, lean: -30, frontArm: armsBackLow, backArm: { upper: 40, lower: -40 }, frontLeg: tucked, backLeg: straight(-5), trail: { from: 'backFoot', reach: 16 } },
    { ms: 65, pelvis: { x: 10, y: -12 }, lean: -30, frontArm: armsBackLow, backArm: { upper: 40, lower: -40 }, frontLeg: straight(-5), backLeg: tucked, trail: { from: 'frontFoot', reach: 16 } },
    { ms: 65, pelvis: { x: 14, y: -10 }, lean: -30, frontArm: armsBackLow, backArm: { upper: 40, lower: -40 }, frontLeg: tucked, backLeg: straight(-5), trail: { from: 'backFoot', reach: 18 } },
  ]),

  // =================== Tier 3: big physical specials ===================
  combo(3, 'Shadow Slide Kick', 'Drops back and slides in feet-first along the floor', [
    { pelvis: { x: 10, y: 46 }, lean: -50, frontArm: armsBackHigh, backArm: { upper: 150, lower: 170 }, frontLeg: straight(8), backLeg: { x: -2, y: F }, trail: { from: 'frontFoot', reach: 26 } },
    { ms: 140, pelvis: { x: 18, y: 46 }, lean: -45, frontArm: armsBackHigh, backArm: { upper: 150, lower: 170 }, frontLeg: straight(6), backLeg: { x: 6, y: F } },
  ]),
  combo(3, 'Tiger Knee', 'Leaps up driving the knee through the chin', [
    { pelvis: { x: 4, y: -6 }, lean: 10, frontArm: { upper: 20, lower: 60 }, backArm: { upper: 30, lower: 70 }, frontLeg: { upper: -40, lower: 90 }, backLeg: { upper: 100, lower: 120 }, trail: { from: 'frontKnee', reach: 16, curve: -6 } },
    { ms: 120, pelvis: { x: 6, y: -18 }, lean: 6, frontArm: { upper: 10, lower: 50 }, backArm: { upper: 20, lower: 60 }, frontLeg: { upper: -60, lower: 80 }, backLeg: { upper: 105, lower: 125 }, trail: { from: 'frontKnee', reach: 14 } },
  ]),
  combo(3, 'Hundred-Hand Slap', 'Rooted in place, palms fire faster than the eye can follow', [
    { pelvis: { x: 3, y: 13 }, lean: 12, frontArm: straight(-5), backArm: guard, ...stanceLegs, trail: { from: 'frontHand', reach: 12 } },
    { ms: 45, pelvis: { x: 4, y: 13 }, lean: 14, frontArm: { upper: 100, lower: -60 }, backArm: straight(-15), ...stanceLegs, trail: { from: 'backHand', reach: 12 } },
    { ms: 45, pelvis: { x: 3, y: 13 }, lean: 12, frontArm: straight(10), backArm: { upper: 100, lower: -60 }, ...stanceLegs, trail: { from: 'frontHand', reach: 12 } },
    { ms: 45, pelvis: { x: 4, y: 13 }, lean: 14, frontArm: { upper: 100, lower: -60 }, backArm: straight(0), ...stanceLegs, trail: { from: 'backHand', reach: 12 } },
    { ms: 45, pelvis: { x: 3, y: 13 }, lean: 12, frontArm: straight(-20), backArm: { upper: 100, lower: -60 }, ...stanceLegs, trail: { from: 'frontHand', reach: 12 } },
    { ms: 45, pelvis: { x: 4, y: 13 }, lean: 14, frontArm: { upper: 100, lower: -60 }, backArm: straight(12), ...stanceLegs, trail: { from: 'backHand', reach: 14 } },
  ]),
  combo(3, 'Split Punch', 'Drops straight into the splits and punches low', [
    { pelvis: { x: 0, y: 62 }, lean: 10, frontArm: straight(20), backArm: { upper: -120, lower: -100 }, frontLeg: straight(2), backLeg: straight(178), trail: { from: 'frontHand', reach: 16 } },
    { ms: 150, pelvis: { x: 0, y: 60 }, lean: 6, frontArm: straight(16), backArm: { upper: -125, lower: -110 }, frontLeg: straight(1), backLeg: straight(179) },
  ]),

  // ================= Tier 4: overdrive combos =================
  combo(4, 'Nunchaku Fury', 'Three cracking nunchaku swings: high, low, high', [
    { pelvis: { x: 1, y: 10 }, lean: 4, tilt: -8, frontArm: { upper: -75, lower: -35 }, backArm: guard, ...stanceLegs, trail: { from: 'frontHand', reach: 28, curve: 22 }, prop: 'nunchaku' },
    { ms: 70, pelvis: { x: 3, y: 14 }, lean: 14, frontArm: { upper: 40, lower: 60 }, backArm: guard, ...stanceLegs, trail: { from: 'frontHand', reach: 26, curve: 18 }, prop: 'nunchaku' },
    { ms: 70, pelvis: { x: 2, y: 11 }, lean: 6, frontArm: { upper: -30, lower: -60 }, backArm: guard, ...stanceLegs, trail: { from: 'frontHand', reach: 26, curve: -18 }, prop: 'nunchaku' },
    { ms: 80, pelvis: { x: 4, y: 12 }, lean: 10, frontArm: { upper: 10, lower: 0 }, backArm: guard, ...stanceLegs, trail: { from: 'frontHand', reach: 28 }, prop: 'nunchaku' },
  ]),
  combo(4, 'Axe and Spin', 'Axe kick straight down, then a spinning back heel', [
    { pelvis: { x: -2, y: 7 }, lean: -15, frontArm: { upper: 60, lower: -30 }, backArm: armsBackHigh, frontLeg: { upper: -78, lower: -80 }, backLeg: { x: -10, y: F }, trail: { from: 'frontFoot', reach: 16, curve: -20 } },
    { ms: 90, pelvis: { x: 0, y: 10 }, lean: 10, frontArm: { upper: 60, lower: -30 }, backArm: armsBackLow, frontLeg: straight(45), backLeg: { x: -10, y: F }, trail: { from: 'frontFoot', reach: 14, curve: -14 } },
    { ms: 110, pelvis: { x: -4, y: 7 }, lean: -38, tilt: 10, frontArm: { upper: 140, lower: 100 }, backArm: { upper: 170, lower: 140 }, frontLeg: { x: -6, y: F }, backLeg: straight(-6), trail: { from: 'backFoot', reach: 18, curve: 10 } },
  ]),
  combo(4, 'Dragon Rush', 'Dashes in low with a straight, then rips an uppercut and a hook', [
    { pelvis: { x: 12, y: 20 }, lean: 25, frontArm: straight(10), backArm: guard, frontLeg: { x: 34, y: F }, backLeg: { x: -10, y: F }, trail: { from: 'frontHand', reach: 22 } },
    { ms: 80, pelvis: { x: 14, y: 12 }, lean: 5, frontArm: guard, backArm: { upper: -60, lower: -70 }, frontLeg: { x: 34, y: F }, backLeg: { x: -4, y: F }, trail: { from: 'backHand', reach: 16, curve: -10 } },
    { ms: 90, pelvis: { x: 14, y: 12 }, lean: 10, tilt: 6, frontArm: { upper: -15, lower: 35 }, backArm: guard, frontLeg: { x: 34, y: F }, backLeg: { x: -4, y: F }, trail: { from: 'frontHand', reach: 12, curve: 16 } },
  ]),
  combo(4, 'Scissor Takedown', 'Leaps legs-wide, scissors them shut, and lands in a crouch', [
    { pelvis: { x: 0, y: -14 }, lean: -25, frontArm: { upper: 30, lower: -40 }, backArm: armsBackHigh, frontLeg: straight(-10), backLeg: straight(25), trail: { from: 'frontFoot', reach: 16, curve: 12 } },
    { ms: 80, pelvis: { x: 4, y: -10 }, lean: -25, frontArm: { upper: 30, lower: -40 }, backArm: armsBackHigh, frontLeg: straight(12), backLeg: straight(4), trail: { from: 'backFoot', reach: 14, curve: -12 } },
    { ms: 120, pelvis: { x: 4, y: 26 }, lean: 12, frontArm: leadReady, backArm: guard, frontLeg: { x: 20, y: F }, backLeg: { x: -16, y: F } },
  ]),

  // ================= Tier 5: legendary finishing combos =================
  combo(5, 'Rising Storm', 'Body blow, rising uppercut, a whirling kick on the way down, then the axe', [
    { pelvis: { x: 4, y: 22 }, lean: 18, frontArm: { upper: 20, lower: -40 }, backArm: guard, frontLeg: { x: 22, y: F }, backLeg: { x: -14, y: F }, trail: { from: 'frontHand', curve: -8 } },
    { ms: 100, pelvis: { x: 8, y: -16 }, lean: 4, frontArm: { upper: -82, lower: -86 }, backArm: { upper: 150, lower: 170 }, frontLeg: { upper: -30, lower: 80 }, backLeg: { upper: 100, lower: 110 }, trail: { from: 'frontHand', reach: 24, curve: -10 } },
    { ms: 70, pelvis: { x: 8, y: -14 }, lean: -8, frontArm: { upper: 150, lower: 120 }, backArm: { upper: 30, lower: -40 }, frontLeg: straight(-3), backLeg: straight(177), trail: { from: 'frontFoot', reach: 16, curve: 18 } },
    { ms: 60, pelvis: { x: 8, y: -12 }, lean: -8, frontArm: { upper: 150, lower: 120 }, backArm: { upper: 30, lower: -40 }, frontLeg: straight(177), backLeg: straight(-3), trail: { from: 'backFoot', reach: 16, curve: 18 } },
    { ms: 90, pelvis: { x: 6, y: 4 }, lean: -15, frontArm: { upper: 60, lower: -30 }, backArm: armsBackHigh, frontLeg: { upper: -78, lower: -80 }, backLeg: { upper: 100, lower: 110 } },
    { ms: 90, pelvis: { x: 6, y: 12 }, lean: 10, frontArm: { upper: 60, lower: -30 }, backArm: armsBackLow, frontLeg: straight(45), backLeg: { x: -10, y: F }, trail: { from: 'frontFoot', reach: 14, curve: -16 } },
  ]),
  combo(5, 'Dragon Flurry', 'Jab, cross, hook, knee, high kick, and a flying side kick to finish', [
    { pelvis: { x: 2, y: 11 }, lean: 8, frontArm: straight(-2), backArm: guard, ...stanceLegs, trail: { from: 'frontHand', reach: 16 } },
    { ms: 60, pelvis: { x: 5, y: 12 }, lean: 16, frontArm: { upper: 100, lower: -70 }, backArm: straight(0), frontLeg: { x: 20, y: F }, backLeg: { x: -12, y: F }, trail: { from: 'backHand', reach: 18 } },
    { ms: 60, pelvis: { x: 3, y: 11 }, lean: 8, tilt: 4, frontArm: { upper: -15, lower: 35 }, backArm: guard, ...stanceLegs, trail: { from: 'frontHand', reach: 12, curve: 16 } },
    { ms: 70, pelvis: { x: 6, y: 4 }, lean: 10, frontArm: { upper: 20, lower: 60 }, backArm: { upper: 30, lower: 70 }, frontLeg: { upper: -40, lower: 90 }, backLeg: { x: -8, y: F }, trail: { from: 'frontKnee', reach: 14 } },
    { ms: 70, pelvis: { x: 2, y: 6 }, lean: -32, frontArm: { upper: 40, lower: -60 }, backArm: armsBackHigh, frontLeg: straight(-12), backLeg: { x: -10, y: F }, trail: { from: 'frontFoot', reach: 18, curve: -6 } },
    { ms: 90, pelvis: { x: 8, y: -12 }, lean: -32, frontArm: { upper: 40, lower: -60 }, backArm: armsBackHigh, frontLeg: straight(-5), backLeg: { upper: 30, lower: 150 }, trail: { from: 'frontFoot', reach: 24, curve: -4 } },
  ]),
  combo(5, 'Final Dragon', 'A huge flying side kick, a rebound flip, and he lands beckoning for more', [
    { pelvis: { x: 0, y: -24 }, lean: -40, frontArm: { upper: 200, lower: 190 }, backArm: { upper: 160, lower: 150 }, frontLeg: straight(-15), backLeg: { upper: 70, lower: 150 }, trail: { from: 'frontFoot', reach: 30, curve: -8 } },
    { ms: 130, pelvis: { x: -6, y: -20 }, lean: -100, frontArm: { upper: 200, lower: 210 }, backArm: { upper: 190, lower: 200 }, frontLeg: straight(-110), backLeg: { upper: -80, lower: -40 } },
    {
      ms: 140,
      pelvis: { x: -4, y: 16 },
      lean: 2,
      frontArm: { upper: 10, lower: -100 },
      backArm: guard,
      frontLeg: { x: 16, y: F },
      backLeg: { x: -20, y: F },
    },
  ]),
];
