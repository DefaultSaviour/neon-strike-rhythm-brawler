import { AttackMove } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { trailingScarf } from '../motion';
import { buildKey, comboMove, FighterSpec, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE NEON STRIKER: bare-handed, and as big and wild as the rig allows.
 *
 * Every move is a short combo: the first keyframe is the hit that lands on
 * your button press, then one or two follow-ups, and the LAST pose is one he
 * can stay in. He holds that pose (see `holdsPose` in heroes.ts) until your
 * next attack, which launches straight out of it, so a string of hits reads
 * as one fight instead of pose - stance - pose.
 *
 * Two rules for the poses:
 *  - BIG: limbs go fully straight, the body leans right over or goes upside
 *    down, jumps go high and landings go low.
 *  - NO TWO ALIKE: every move makes its own shape (a long flat line, a
 *    vertical line, a star, a handstand, a split on the floor...), and every
 *    move ends in a different pose from the others.
 *
 * 21 moves across the 5 combo tiers (5, 5, 4, 4, 3).
 *
 * Angles: 0 deg = toward the enemy, 90 = down, -90 = up, 180 = back.
 * A lean of 180 is a handstand.
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
  // ============================ Tier 1 ============================
  move(1, 'One-Two', 'A long jab, then a haymaker thrown with his whole body. Ends as one flat line, fist to fist.', [
    { pelvis: { x: 8, y: 14 }, lean: 25, frontArm: straight(-3), backArm: straight(172), frontLeg: { x: 30, y: F }, backLeg: { x: -22, y: F }, trail: { from: 'frontHand', reach: 18 } },
    { ms: 80, pelvis: { x: 10, y: 16 }, lean: 35, frontArm: straight(178), backArm: straight(-4), frontLeg: { x: 34, y: F }, backLeg: { x: -20, y: F }, trail: { from: 'backHand', reach: 22 } },
  ]),
  move(1, 'Sky Uppercut', 'An uppercut that takes him off the floor. He lands low with the fist still high.', [
    { pelvis: { x: 4, y: 6 }, lean: -12, frontArm: straight(110), backArm: straight(-80), frontLeg: { x: 10, y: F }, backLeg: { x: -6, y: F }, trail: { from: 'backHand', reach: 20, curve: -12 } },
    { ms: 90, pelvis: { x: 4, y: -12 }, lean: -8, frontArm: straight(105), backArm: straight(-88), frontLeg: { upper: 60, lower: 120 }, backLeg: straight(95) },
    { ms: 120, pelvis: { x: 2, y: 28 }, lean: 0, frontArm: { upper: 70, lower: 100 }, backArm: straight(-82), frontLeg: { x: 24, y: F }, backLeg: { x: -24, y: F } },
  ]),
  move(1, 'Split Kick', 'A kick straight up past his own head, dropping into a very wide lunge with the palm out', [
    { pelvis: { x: -2, y: 7 }, lean: -25, frontArm: backLow, backArm: backHigh, frontLeg: straight(-75), backLeg: { x: -4, y: F }, trail: { from: 'frontFoot', reach: 18, curve: -10 } },
    { ms: 110, pelvis: { x: 6, y: 30 }, lean: 10, frontArm: straight(-10), backArm: straight(190), frontLeg: { x: 44, y: F }, backLeg: { x: -40, y: F } },
  ]),
  move(1, 'Cartwheel Kick', 'Goes over on his hands and kicks from upside down, landing flat and wide with his arms out', [
    { pelvis: { x: 0, y: -6 }, lean: 170, spin: true, frontArm: straight(90), backArm: straight(95), frontLeg: straight(-30), backLeg: straight(-150), trail: { from: 'frontFoot', reach: 18, curve: 16 } },
    { ms: 130, pelvis: { x: 0, y: 34 }, lean: 0, frontArm: straight(0), backArm: straight(180), frontLeg: { x: 34, y: F }, backLeg: { x: -34, y: F } },
  ]),
  move(1, 'Low Sweep', 'Drops almost flat and whips a leg round along the floor. He stays down, arms up in a V.', [
    { pelvis: { x: -6, y: 40 }, lean: 50, spin: true, frontArm: chinGuard, backArm: { upper: 120, lower: 100 }, frontLeg: straight(24), backLeg: { x: -14, y: F }, trail: { from: 'frontFoot', reach: 18, curve: 12 } },
    { ms: 110, pelvis: { x: -4, y: 36 }, lean: 25, frontArm: straight(-20), backArm: straight(-150), frontLeg: straight(29), backLeg: { x: -12, y: F } },
  ]),

  // ============================ Tier 2 ============================
  move(2, 'Roundhouse', 'A head-high roundhouse with his body laid right back. He lands on one leg, knee still up.', [
    { pelvis: { x: -2, y: 8 }, lean: -60, frontArm: chinGuard, backArm: straight(170), frontLeg: straight(-35), backLeg: { x: -6, y: F }, trail: { from: 'frontFoot', reach: 18, curve: -14 } },
    { ms: 120, pelvis: { x: 0, y: 8 }, lean: -10, spin: true, frontArm: { upper: 20, lower: -70 }, backArm: chinGuard, frontLeg: { upper: -40, lower: 80 }, backLeg: { x: -2, y: F } },
  ]),
  move(2, 'Flying Knee', 'Leaps high knee-first, and comes down driving an elbow in', [
    { pelvis: { x: 4, y: -14 }, lean: 15, frontArm: chinGuard, backArm: straight(-110), frontLeg: { upper: -25, lower: 100 }, backLeg: { upper: 125, lower: 150 }, trail: { from: 'frontKnee', reach: 16 } },
    { ms: 130, pelvis: { x: 8, y: 22 }, lean: 28, frontArm: { upper: 35, lower: -140 }, backArm: straight(160), frontLeg: { x: 32, y: F }, backLeg: { x: -24, y: F }, trail: { from: 'frontElbow', reach: 14, curve: 10 } },
  ]),
  move(2, 'Blade Dash', 'A flat-out dashing cut with the hand, finished on one knee with the blade hand thrown high', [
    { pelvis: { x: 10, y: 20 }, lean: 42, frontArm: straight(18), backArm: straight(175), frontLeg: { x: 34, y: F }, backLeg: { x: -28, y: F }, trail: { from: 'frontHand', reach: 26, curve: 18 } },
    { ms: 120, pelvis: { x: 6, y: 32 }, lean: 15, frontArm: straight(-60), backArm: straight(170), frontLeg: { x: 28, y: F }, backLeg: { x: -30, y: F }, trail: { from: 'frontHand', reach: 20, curve: -18 } },
  ]),
  move(2, 'Flash Kick', 'Kicks straight up into a backflip, fully upside down at the top, and lands like a superhero', [
    { pelvis: { x: 0, y: 6 }, lean: -45, frontArm: backLow, backArm: backLow, frontLeg: straight(-70), backLeg: { x: -4, y: F }, trail: { from: 'frontFoot', reach: 18, curve: -16 } },
    { ms: 110, pelvis: { x: -4, y: -22 }, lean: 180, spin: true, frontArm: straight(60), backArm: straight(120), frontLeg: straight(-70), backLeg: straight(-110) },
    { ms: 120, pelvis: { x: -4, y: 30 }, lean: 25, frontArm: { upper: 80, lower: 85 }, backArm: straight(-160), frontLeg: { x: 24, y: F }, backLeg: { x: -30, y: F } },
  ]),
  move(
    2,
    'Axe Kick',
    'The heel comes down like an axe, and he drops into the full splits with his arms up',
    [
      { pelvis: { x: 2, y: 10 }, lean: 20, frontArm: backLow, backArm: chinGuard, frontLeg: straight(15), backLeg: { x: -8, y: F }, trail: { from: 'frontFoot', reach: 16, curve: 22 } },
      { ms: 110, pelvis: { x: 0, y: 60 }, lean: 0, frontArm: straight(-45), backArm: straight(-135), frontLeg: straight(5), backLeg: straight(175) },
    ],
    true
  ),

  // ============================ Tier 3 ============================
  move(3, 'Scythe Kick', 'A spinning back kick with his body flat, landing sat back and pointing straight at them', [
    { pelvis: { x: 0, y: 8 }, lean: -55, spin: true, frontArm: chinGuard, backArm: backHigh, frontLeg: { x: 4, y: F }, backLeg: straight(-25), trail: { from: 'backFoot', reach: 20, curve: -18 } },
    { ms: 130, pelvis: { x: -6, y: 24 }, lean: -12, frontArm: straight(0), backArm: straight(180), frontLeg: { x: 22, y: F }, backLeg: { x: -30, y: F } },
  ]),
  move(3, 'Rocket Punch', 'Flies in flat like a rocket, fist first, and slides to a stop on one knee', [
    { pelvis: { x: 6, y: -12 }, lean: 62, frontArm: straight(175), backArm: straight(5), frontLeg: straight(165), backLeg: { upper: 150, lower: 175 }, trail: { from: 'backHand', reach: 26 } },
    { ms: 130, pelvis: { x: 8, y: 34 }, lean: 20, frontArm: straight(180), backArm: straight(0), frontLeg: { x: 36, y: F }, backLeg: { x: -30, y: F } },
  ]),
  move(
    3,
    'Sledgehammer',
    'Jumps and brings both fists down together, landing with them buried in the floor',
    [
      { pelvis: { x: 4, y: -8 }, lean: 25, frontArm: straight(20), backArm: straight(26), frontLeg: { upper: 100, lower: 170 }, backLeg: { upper: 110, lower: 175 }, trail: { from: 'frontHand', reach: 18, curve: 22 } },
      { ms: 110, pelvis: { x: 6, y: 34 }, lean: 45, frontArm: straight(78), backArm: straight(82), frontLeg: { x: 30, y: F }, backLeg: { x: -24, y: F } },
    ],
    true
  ),
  move(3, 'Dropkick', 'Both feet, flat out in the air, then he flips up and stands there with his hands on his hips', [
    { pelvis: { x: -4, y: -2 }, lean: -85, frontArm: straight(180), backArm: straight(170), frontLeg: straight(-4), backLeg: straight(4), trail: { from: 'frontFoot', reach: 20 } },
    { ms: 140, pelvis: { x: 0, y: 8 }, lean: 0, spin: true, frontArm: { upper: 60, lower: 150 }, backArm: { upper: 120, lower: 30 }, frontLeg: { x: 14, y: F }, backLeg: { x: -14, y: F } },
  ]),

  // ============================ Tier 4 ============================
  move(4, 'Tornado Kick', 'Two spinning kicks high in the air, one from each leg, and a low kung-fu landing', [
    { pelvis: { x: 0, y: -16 }, lean: -30, spin: true, frontArm: backHigh, backArm: { upper: -30, lower: -80 }, frontLeg: straight(-15), backLeg: { upper: 100, lower: 160 }, trail: { from: 'frontFoot', reach: 20, curve: -20 } },
    { ms: 100, pelvis: { x: 0, y: -20 }, lean: -45, spin: true, frontArm: backHigh, backArm: { upper: -30, lower: -80 }, frontLeg: { upper: 80, lower: 150 }, backLeg: straight(-28), trail: { from: 'backFoot', reach: 20, curve: -20 } },
    { ms: 130, pelvis: { x: 0, y: 26 }, lean: 8, frontArm: straight(10), backArm: straight(-150), frontLeg: { x: 26, y: F }, backLeg: { x: -26, y: F } },
  ]),
  move(4, 'Dragon Whip', 'A spinning backfist, then up on his hands for a spinning split kick. He ends sat back on one hand, leg out, pointing up at them.', [
    { pelvis: { x: 4, y: 12 }, lean: 15, spin: true, frontArm: straight(170), backArm: straight(-10), frontLeg: { x: 22, y: F }, backLeg: { x: -16, y: F }, trail: { from: 'backHand', reach: 22, curve: -22 } },
    { ms: 110, pelvis: { x: 0, y: -6 }, lean: 180, spin: true, frontArm: straight(88), backArm: straight(92), frontLeg: straight(-20), backLeg: straight(-160), trail: { from: 'frontFoot', reach: 18, curve: 14 } },
    { ms: 120, pelvis: { x: -6, y: 44 }, lean: -25, frontArm: straight(-30), backArm: straight(100), frontLeg: straight(22), backLeg: { upper: -40, lower: 105 } },
  ]),
  move(4, 'Sonic Palm', 'Throws his whole body behind both palms with a shockwave, and sinks into it with the hands spread', [
    { pelvis: { x: 10, y: 20 }, lean: 40, frontArm: straight(-4), backArm: straight(4), frontLeg: { x: 34, y: F }, backLeg: { x: -28, y: F }, trail: { from: 'frontHand', reach: 30 } },
    { ms: 120, pelvis: { x: 10, y: 26 }, lean: 32, frontArm: straight(-25), backArm: straight(25), frontLeg: { x: 36, y: F }, backLeg: { x: -26, y: F } },
  ]),
  move(
    4,
    'Somersault Cleave',
    'Dives over forwards with the heel coming down, then lands cutting low with the blade hand',
    [
      { pelvis: { x: 2, y: -18 }, lean: 70, spin: true, frontArm: backHigh, backArm: backHigh, frontLeg: straight(35), backLeg: { upper: 150, lower: 175 }, trail: { from: 'frontFoot', reach: 18, curve: 22 } },
      { ms: 120, pelvis: { x: 8, y: 28 }, lean: 32, frontArm: straight(40), backArm: straight(190), frontLeg: { x: 32, y: F }, backLeg: { x: -28, y: F }, trail: { from: 'frontHand', reach: 20, curve: 18 } },
    ],
    true
  ),

  // ============================ Tier 5: finishers ============================
  move(
    5,
    'Thunder Palm',
    'A rising palm, a star jump high in the air, and the palm slams down into the floor',
    [
      { pelvis: { x: 4, y: 8 }, lean: -8, frontArm: straight(-72), backArm: straight(120), frontLeg: { x: 16, y: F }, backLeg: { x: -12, y: F }, trail: { from: 'frontHand', reach: 26, curve: -14 } },
      { ms: 110, pelvis: { x: 2, y: -22 }, lean: 0, frontArm: straight(-45), backArm: straight(-135), frontLeg: straight(55), backLeg: straight(125) },
      { ms: 120, pelvis: { x: 6, y: 32 }, lean: 42, frontArm: straight(68), backArm: straight(-170), frontLeg: { x: 30, y: F }, backLeg: { x: -28, y: F }, trail: { from: 'frontHand', reach: 16, curve: 20 } },
    ],
    true
  ),
  move(5, 'Scissor Cleave', 'A flying split kick, the legs scissor shut overhead, and he lands with his arms crossed', [
    { pelvis: { x: 0, y: -16 }, lean: 0, frontArm: straight(-30), backArm: straight(210), frontLeg: straight(0), backLeg: straight(180), trail: { from: 'frontFoot', reach: 20 } },
    { ms: 110, pelvis: { x: 0, y: -18 }, lean: -50, spin: true, frontArm: backLow, backArm: backHigh, frontLeg: straight(-55), backLeg: straight(-25), trail: { from: 'backFoot', reach: 20, curve: -18 } },
    { ms: 130, pelvis: { x: 0, y: 16 }, lean: 0, frontArm: { upper: 20, lower: -110 }, backArm: { upper: 30, lower: -100 }, frontLeg: { x: 22, y: F }, backLeg: { x: -22, y: F } },
  ]),
  move(
    5,
    'Omega Burst',
    'A leaping knee, a spinning kick, an upside-down kick at the top, and he lands with a fist in the air',
    [
      { pelvis: { x: 4, y: -10 }, lean: -6, frontArm: straight(120), backArm: straight(130), frontLeg: { upper: -25, lower: 100 }, backLeg: straight(100), trail: { from: 'frontKnee', reach: 16 } },
      { ms: 100, pelvis: { x: 2, y: -20 }, lean: -45, spin: true, frontArm: backHigh, backArm: backLow, frontLeg: { upper: 80, lower: 150 }, backLeg: straight(-18), trail: { from: 'backFoot', reach: 20, curve: -20 } },
      { ms: 110, pelvis: { x: 0, y: -22 }, lean: 180, spin: true, frontArm: straight(60), backArm: straight(120), frontLeg: straight(-60), backLeg: straight(-120), trail: { from: 'frontFoot', reach: 18, curve: 18 } },
      { ms: 140, pelvis: { x: 0, y: 18 }, lean: 0, frontArm: straight(-85), backArm: hipFist, frontLeg: { x: 26, y: F }, backLeg: { x: -26, y: F } },
    ],
    true
  ),
];
