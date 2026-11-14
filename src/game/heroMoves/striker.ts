import { AttackMove } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { trailingScarf } from '../motion';
import { buildKey, comboMove, FighterSpec, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE NEON STRIKER, reworked so he flows.
 *
 * Every move is a short combo: the first keyframe is the hit that lands on
 * your button press, then one follow-up, and the LAST pose is a strong,
 * grounded pose he can stay in. He holds that pose (see `holdsPose` in
 * heroes.ts) until your next attack, which launches straight out of it, so
 * a string of hits reads as one fight instead of pose - stance - pose.
 *
 * The end poses are all different heights and shapes (fist out, fist up,
 * knee raised, low crouch, deep lunge), so the next attack always has
 * somewhere new to come from.
 *
 * 21 moves across the 5 combo tiers (5, 5, 4, 4, 3): on the ground, then
 * acrobatic, then spinning and flying, and three finishers.
 *
 * Angles: 0 deg = toward the enemy, 90 = down, -90 = up, 180 = back.
 */

const TRAIL = '#00f3ff';
const F = FLOOR;

/** Fist by the chin. */
const chinGuard: LimbAngles = { upper: 45, lower: -120 };
/** Fist chambered at the hip. */
const hipFist: LimbAngles = { upper: 110, lower: 20 };
/** Arm thrown back for balance. */
const backLow: LimbAngles = { upper: 140, lower: 120 };
const backHigh: LimbAngles = { upper: 160, lower: 140 };
/** A limb held straight out at an angle. */
const straight = (deg: number): LimbAngles => ({ upper: deg, lower: deg });

type Key = FighterSpec & { ms?: number };

let nextId = 1;
function move(tier: AttackMove['tier'], name: string, description: string, keys: Key[], slam = false): AttackMove {
  const built = comboMove(nextId++, tier, name, description, withHolds(keys.map((k) => buildKey(k, TRAIL, k.ms ?? 0))));
  // The hit pose carries a scarf, for the places that show it on its own (title screen, progress bar).
  // In a song the engine trails the scarf behind his head itself.
  built.pose.scarf = trailingScarf(undefined, built.pose.head, 1, 0, 0);
  return slam ? { ...built, slam: true } : built;
}

export const STRIKER_MOVES: AttackMove[] = [
  // ============================ Tier 1: on the ground ============================
  move(1, 'One-Two', 'Lead jab, then the rear fist drives through. He stays on the cross.', [
    { pelvis: { x: 2, y: 11 }, lean: 8, frontArm: straight(-2), backArm: chinGuard, frontLeg: { x: 20, y: F }, backLeg: { x: -16, y: F }, trail: { from: 'frontHand', reach: 16 } },
    {
      ms: 80,
      pelvis: { x: 6, y: 13 },
      lean: 18,
      frontArm: { upper: 100, lower: -70 },
      backArm: straight(0),
      frontLeg: { x: 22, y: F },
      backLeg: { x: -14, y: F },
      trail: { from: 'backHand', reach: 18 },
    },
  ]),
  move(1, 'Snap Kick', 'A fast front kick, then he steps down into a deep lunge', [
    { pelvis: { x: -2, y: 9 }, lean: -12, frontArm: chinGuard, backArm: backLow, frontLeg: { upper: -15, lower: 5 }, backLeg: { x: -10, y: F }, trail: { from: 'frontFoot', reach: 14, curve: 6 } },
    { ms: 110, pelvis: { x: 6, y: 18 }, lean: 14, frontArm: { upper: 20, lower: -60 }, backArm: hipFist, frontLeg: { x: 30, y: F }, backLeg: { x: -26, y: F } },
  ]),
  move(1, 'Elbow Uppercut', 'Short lead elbow, then the rear fist rips up. He stays with the fist in the air.', [
    { pelvis: { x: 4, y: 12 }, lean: 14, frontArm: { upper: 0, lower: 175 }, backArm: chinGuard, frontLeg: { x: 20, y: F }, backLeg: { x: -16, y: F }, trail: { from: 'frontElbow', reach: 12, curve: 8 } },
    {
      ms: 90,
      pelvis: { x: 4, y: 8 },
      lean: -4,
      frontArm: { upper: 120, lower: -40 },
      backArm: { upper: -50, lower: -95 },
      frontLeg: { x: 18, y: F },
      backLeg: { x: -12, y: F },
      trail: { from: 'backHand', reach: 16, curve: -10 },
    },
  ]),
  move(1, 'Chop and Knee', 'A knife-hand chop, then he pulls them onto a rising knee', [
    { pelvis: { x: 4, y: 12 }, lean: 14, frontArm: { upper: -20, lower: 20 }, backArm: chinGuard, frontLeg: { x: 20, y: F }, backLeg: { x: -16, y: F }, trail: { from: 'frontHand', reach: 14, curve: 14 } },
    {
      ms: 100,
      pelvis: { x: 2, y: 8 },
      lean: -8,
      frontArm: { upper: 30, lower: 80 },
      backArm: { upper: 40, lower: 90 },
      frontLeg: { upper: -25, lower: 95 },
      backLeg: { x: -6, y: F },
      trail: { from: 'frontKnee', reach: 12 },
    },
  ]),
  move(1, 'Low Sweep', 'Drops and sweeps the legs, then rises into a low crouch', [
    { pelvis: { x: -4, y: 34 }, lean: 25, frontArm: chinGuard, backArm: { upper: 110, lower: 100 }, frontLeg: straight(28), backLeg: { x: -10, y: F }, trail: { from: 'frontFoot', reach: 16, curve: 10 } },
    { ms: 110, pelvis: { x: 0, y: 26 }, lean: 10, frontArm: { upper: 30, lower: -60 }, backArm: chinGuard, frontLeg: { x: 22, y: F }, backLeg: { x: -22, y: F } },
  ]),

  // ============================ Tier 2: acrobatic ============================
  move(2, 'Roundhouse', 'A high roundhouse, and he spins through to land set', [
    { pelvis: { x: -2, y: 8 }, lean: -28, frontArm: chinGuard, backArm: backHigh, frontLeg: straight(-28), backLeg: { x: -8, y: F }, trail: { from: 'frontFoot', reach: 16, curve: -12 } },
    { ms: 120, pelvis: { x: 2, y: 14 }, lean: 10, spin: true, frontArm: { upper: 20, lower: -70 }, backArm: { upper: 150, lower: 130 }, frontLeg: { x: 24, y: F }, backLeg: { x: -22, y: F } },
  ]),
  move(2, 'Flying Knee', 'Leaps in knee-first, then lands with an elbow driven down', [
    { pelvis: { x: 4, y: -4 }, lean: 10, frontArm: chinGuard, backArm: { upper: -120, lower: -60 }, frontLeg: { upper: -20, lower: 100 }, backLeg: { upper: 120, lower: 150 }, trail: { from: 'frontKnee', reach: 14 } },
    {
      ms: 130,
      pelvis: { x: 8, y: 20 },
      lean: 24,
      frontArm: { upper: 35, lower: -140 },
      backArm: { upper: 140, lower: 110 },
      frontLeg: { x: 30, y: F },
      backLeg: { x: -22, y: F },
      trail: { from: 'frontElbow', reach: 12, curve: 10 },
    },
  ]),
  move(2, 'Blade Dash', 'A low dashing hand-blade cut, finished on one knee with the blade hand high', [
    { pelvis: { x: 8, y: 16 }, lean: 32, frontArm: straight(15), backArm: straight(170), frontLeg: { x: 30, y: F }, backLeg: { x: -24, y: F }, trail: { from: 'frontHand', reach: 22, curve: 16 } },
    {
      ms: 120,
      pelvis: { x: 6, y: 30 },
      lean: 18,
      frontArm: straight(-35),
      backArm: hipFist,
      frontLeg: { x: 26, y: F },
      backLeg: { x: -28, y: F },
      trail: { from: 'frontHand', reach: 18, curve: -16 },
    },
  ]),
  move(2, 'Flash Kick', 'Kicks straight up into a backflip and lands in a crouch', [
    { pelvis: { x: 0, y: 6 }, lean: -40, frontArm: backLow, backArm: backLow, frontLeg: straight(-62), backLeg: { x: -4, y: F }, trail: { from: 'frontFoot', reach: 16, curve: -14 } },
    { ms: 110, pelvis: { x: -6, y: -16 }, lean: -110, spin: true, frontArm: { upper: -160, lower: -60 }, backArm: { upper: -160, lower: -60 }, frontLeg: { upper: -150, lower: -30 }, backLeg: { upper: -140, lower: -20 } },
    { ms: 120, pelvis: { x: -4, y: 24 }, lean: 12, frontArm: { upper: 70, lower: 80 }, backArm: backHigh, frontLeg: { x: 18, y: F }, backLeg: { x: -24, y: F } },
  ]),
  move(
    2,
    'Axe Kick',
    'The heel comes down like an axe, then he stomps in with the rear fist cocked',
    [
      { pelvis: { x: 2, y: 12 }, lean: 16, frontArm: backLow, backArm: chinGuard, frontLeg: straight(12), backLeg: { x: -10, y: F }, trail: { from: 'frontFoot', reach: 14, curve: 18 } },
      { ms: 100, pelvis: { x: 8, y: 18 }, lean: 20, frontArm: { upper: 60, lower: -10 }, backArm: { upper: 170, lower: -100 }, frontLeg: { x: 34, y: F }, backLeg: { x: -22, y: F } },
    ],
    true
  ),

  // ============================ Tier 3: superhuman ============================
  move(3, 'Scythe Kick', 'A spinning back hook kick, landing in a wide low stance', [
    { pelvis: { x: 0, y: 8 }, lean: -35, spin: true, frontArm: chinGuard, backArm: backHigh, frontLeg: { x: 4, y: F }, backLeg: straight(-15), trail: { from: 'backFoot', reach: 18, curve: -16 } },
    { ms: 130, pelvis: { x: 0, y: 22 }, lean: 4, frontArm: hipFist, backArm: hipFist, frontLeg: { x: 26, y: F }, backLeg: { x: -26, y: F } },
  ]),
  move(3, 'Rocket Punch', 'Leaps in with the rear fist flying, and lands tall with the arm still out', [
    { pelvis: { x: 6, y: -6 }, lean: 40, frontArm: backLow, backArm: straight(5), frontLeg: { upper: 60, lower: 150 }, backLeg: { upper: 150, lower: 165 }, trail: { from: 'backHand', reach: 22 } },
    { ms: 130, pelvis: { x: 6, y: 12 }, lean: 10, frontArm: hipFist, backArm: straight(-4), frontLeg: { x: 24, y: F }, backLeg: { x: -16, y: F } },
  ]),
  move(
    3,
    'Sledgehammer',
    'Both fists come down together, and he follows them to the floor',
    [
      { pelvis: { x: 6, y: 18 }, lean: 30, frontArm: straight(35), backArm: straight(40), frontLeg: { x: 26, y: F }, backLeg: { x: -20, y: F }, trail: { from: 'frontHand', reach: 16, curve: 18 } },
      { ms: 110, pelvis: { x: 6, y: 30 }, lean: 36, frontArm: straight(72), backArm: straight(76), frontLeg: { x: 28, y: F }, backLeg: { x: -22, y: F } },
    ],
    true
  ),
  move(3, 'Dropkick', 'Both feet, flat out in the air, then he flips back onto his feet', [
    { pelvis: { x: -4, y: 2 }, lean: -80, frontArm: backLow, backArm: backHigh, frontLeg: straight(-6), backLeg: straight(2), trail: { from: 'frontFoot', reach: 18 } },
    { ms: 140, pelvis: { x: 0, y: 14 }, lean: 6, spin: true, frontArm: { upper: 30, lower: -60 }, backArm: chinGuard, frontLeg: { x: 18, y: F }, backLeg: { x: -18, y: F } },
  ]),

  // ============================ Tier 4: overdrive ============================
  move(4, 'Tornado Kick', 'Two spinning kicks in the air, one from each leg, and a kung-fu landing', [
    { pelvis: { x: 0, y: -8 }, lean: -20, spin: true, frontArm: backHigh, backArm: { upper: -30, lower: -80 }, frontLeg: straight(-10), backLeg: { upper: 100, lower: 160 }, trail: { from: 'frontFoot', reach: 18, curve: -18 } },
    { ms: 100, pelvis: { x: 0, y: -10 }, lean: -30, spin: true, frontArm: backHigh, backArm: { upper: -30, lower: -80 }, frontLeg: { upper: 80, lower: 150 }, backLeg: straight(-20), trail: { from: 'backFoot', reach: 18, curve: -18 } },
    { ms: 130, pelvis: { x: 0, y: 20 }, lean: 8, frontArm: straight(10), backArm: straight(-150), frontLeg: { x: 24, y: F }, backLeg: { x: -24, y: F } },
  ]),
  move(4, 'Dragon Whip', 'A spinning backfist, straight into a spinning sweep. He ends low, arms wide.', [
    { pelvis: { x: 4, y: 12 }, lean: 10, spin: true, frontArm: hipFist, backArm: straight(-10), frontLeg: { x: 20, y: F }, backLeg: { x: -16, y: F }, trail: { from: 'backHand', reach: 20, curve: -20 } },
    { ms: 110, pelvis: { x: -2, y: 32 }, lean: 20, spin: true, frontArm: chinGuard, backArm: { upper: 110, lower: 100 }, frontLeg: { x: -8, y: F }, backLeg: straight(26), trail: { from: 'backFoot', reach: 16, curve: 12 } },
    { ms: 120, pelvis: { x: 0, y: 28 }, lean: 6, frontArm: straight(-20), backArm: straight(200), frontLeg: { x: 24, y: F }, backLeg: { x: -26, y: F } },
  ]),
  move(4, 'Sonic Palm', 'Both palms thrust out with a shockwave, and he sinks into it', [
    { pelvis: { x: 8, y: 16 }, lean: 22, frontArm: straight(-4), backArm: straight(2), frontLeg: { x: 30, y: F }, backLeg: { x: -24, y: F }, trail: { from: 'frontHand', reach: 28 } },
    { ms: 120, pelvis: { x: 10, y: 22 }, lean: 26, frontArm: straight(-12), backArm: straight(12), frontLeg: { x: 34, y: F }, backLeg: { x: -24, y: F } },
  ]),
  move(
    4,
    'Somersault Cleave',
    'Flips over with the heel coming down, then lands cutting low with the blade hand',
    [
      { pelvis: { x: 2, y: -10 }, lean: 30, spin: true, frontArm: backHigh, backArm: backHigh, frontLeg: straight(20), backLeg: { upper: 140, lower: 170 }, trail: { from: 'frontFoot', reach: 16, curve: 20 } },
      { ms: 120, pelvis: { x: 8, y: 26 }, lean: 30, frontArm: straight(40), backArm: straight(190), frontLeg: { x: 30, y: F }, backLeg: { x: -26, y: F }, trail: { from: 'frontHand', reach: 18, curve: 16 } },
    ],
    true
  ),

  // ============================ Tier 5: finishers ============================
  move(
    5,
    'Thunder Palm',
    'A rising palm, a leap, and the palm slams down into the floor',
    [
      { pelvis: { x: 4, y: 8 }, lean: -6, frontArm: straight(-70), backArm: hipFist, frontLeg: { x: 16, y: F }, backLeg: { x: -12, y: F }, trail: { from: 'frontHand', reach: 24, curve: -14 } },
      { ms: 110, pelvis: { x: 2, y: -14 }, lean: 0, frontArm: straight(-100), backArm: straight(-80), frontLeg: { upper: 60, lower: 140 }, backLeg: { upper: 100, lower: 160 } },
      { ms: 120, pelvis: { x: 6, y: 30 }, lean: 40, frontArm: straight(65), backArm: straight(-170), frontLeg: { x: 28, y: F }, backLeg: { x: -26, y: F }, trail: { from: 'frontHand', reach: 14, curve: 18 } },
    ],
    true
  ),
  move(5, 'Scissor Cleave', 'A flying split kick, the legs scissor shut, and he lands with his arms crossed', [
    { pelvis: { x: 0, y: -10 }, lean: 0, frontArm: straight(-30), backArm: straight(210), frontLeg: straight(0), backLeg: straight(180), trail: { from: 'frontFoot', reach: 18 } },
    { ms: 110, pelvis: { x: 0, y: -12 }, lean: -40, spin: true, frontArm: backLow, backArm: backHigh, frontLeg: straight(-50), backLeg: straight(-20), trail: { from: 'backFoot', reach: 18, curve: -16 } },
    { ms: 130, pelvis: { x: 0, y: 16 }, lean: 0, frontArm: { upper: 20, lower: -110 }, backArm: { upper: 30, lower: -100 }, frontLeg: { x: 20, y: F }, backLeg: { x: -20, y: F } },
  ]),
  move(
    5,
    'Omega Burst',
    'An uppercut that lifts him off the floor, a knee, a spinning kick, and he lands with a fist in the air',
    [
      { pelvis: { x: 4, y: 8 }, lean: -8, frontArm: hipFist, backArm: straight(-75), frontLeg: { x: 18, y: F }, backLeg: { x: -12, y: F }, trail: { from: 'backHand', reach: 20, curve: -12 } },
      { ms: 100, pelvis: { x: 4, y: -12 }, lean: -4, frontArm: hipFist, backArm: straight(-80), frontLeg: { upper: -20, lower: 100 }, backLeg: { upper: 110, lower: 150 }, trail: { from: 'frontKnee', reach: 14 } },
      { ms: 110, pelvis: { x: 2, y: -14 }, lean: -30, spin: true, frontArm: backHigh, backArm: backLow, frontLeg: { upper: 80, lower: 150 }, backLeg: straight(-10), trail: { from: 'backFoot', reach: 18, curve: -18 } },
      { ms: 140, pelvis: { x: 0, y: 14 }, lean: 0, frontArm: straight(-85), backArm: hipFist, frontLeg: { x: 20, y: F }, backLeg: { x: -20, y: F } },
    ],
    true
  ),
];
