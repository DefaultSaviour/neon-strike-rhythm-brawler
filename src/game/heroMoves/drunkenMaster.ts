import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { armReaching, buildFighterPose, buildKey, comboMove, FighterSpec, handOf, headOf, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE DRUNKEN MASTER: drunken boxing in the spirit of the classic 70s and
 * 90s kung-fu comedies. He lurches, staggers and nearly falls over, and
 * every wild-looking swing lands exactly where he meant it. His wine gourd
 * never leaves his rear hand, and it swings out on its string for the gourd
 * combos. Physical only: no magic.
 *
 * Built like The One: each move is ONE clear idea in a few big poses, every
 * hit is held for a beat (withHolds), and the hips stay near the centre even
 * when the upper body leans far over. 21 combos over the 5 tiers
 * (5, 5, 4, 4, 3); the first keyframe is the hit.
 *
 * Angles: 0 deg = toward the enemy, 90 = down, -90 = up, 180 = back. Feet
 * planted on the floor are at y = 68.
 */

const TRAIL = '#ffb347'; // warm rice-wine amber
const F = FLOOR;

/** An arm or leg held straight out at an angle (- is higher). */
const straight = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
/** Loose arm hanging by the side, the gourd dangling from it. */
const dangle: LimbAngles = { upper: 100, lower: 85 };
/** Lead hand curled into a drunken "cup" fist, held loose in front. */
const cupReady: LimbAngles = { upper: 40, lower: -30 };
/** Arms flung out for balance as he totters. */
const armsBack: LimbAngles = { upper: 150, lower: 130 };
const flailUp: LimbAngles = { upper: -130, lower: -100 };
/** A leg tucked up under the body in the air. */
const tucked: LimbAngles = { upper: 70, lower: 150 };

/** Feet planted wide (he needs it). */
const wide = { frontLeg: { x: 22, y: F }, backLeg: { x: -20, y: F } };
/** Feet crossed over: the classic drunken stumble. */
const crossed = { frontLeg: { x: -6, y: F }, backLeg: { x: 10, y: F } };

type Key = FighterSpec & {
  ms?: number;
  /** Rear hand lifts the gourd to his mouth */
  drink?: boolean;
  /** Rear hand grips the bench plank too */
  twoHanded?: boolean;
};

/** Fill in the arms that have to meet something: the gourd at his lips, or both hands on the plank. */
function resolve(k: Key): FighterSpec {
  const spec: FighterSpec = { prop: 'gourd', ...k };
  if (k.drink) {
    const h = headOf(spec);
    spec.backArm = armReaching(spec, 'back', { x: h.x + 5, y: h.y + 4 });
  }
  if (k.twoHanded) {
    const hand = handOf(spec, 'front');
    const l = (spec.frontArm.lower * Math.PI) / 180;
    spec.backArm = armReaching(spec, 'back', { x: hand.x - Math.cos(l) * 12, y: hand.y - Math.sin(l) * 12 });
  }
  return spec;
}

let nextId = 401;
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[]): AttackMove {
  return comboMove(nextId++, tier, name, description, withHolds(keys.map((k) => buildKey(resolve(k), TRAIL, k.ms ?? 0))));
}

/** Swaying, leaning back on his heels, taking a swig from the gourd. */
export const DRUNKEN_MASTER_IDLE: SkeletonPose = buildFighterPose(
  resolve({ pelvis: { x: 0, y: 10 }, lean: -14, tilt: -8, frontArm: cupReady, backArm: dangle, frontLeg: { x: 16, y: F }, backLeg: { x: -14, y: F }, drink: true }),
  TRAIL
);

export const DRUNKEN_MASTER_MOVES: AttackMove[] = [
  // ======================= Tier 1: stumbling basics =======================
  combo(1, 'Stumble Jab', 'Trips forward and the jab lands on the way down, then he totters back upright', [
    { pelvis: { x: 6, y: 18 }, lean: 32, tilt: 10, frontArm: straight(-2), backArm: armsBack, frontLeg: { x: 30, y: F }, backLeg: { x: -16, y: F }, trail: { from: 'frontHand', reach: 18 } },
    { ms: 160, pelvis: { x: 0, y: 10 }, lean: -18, tilt: -10, frontArm: cupReady, backArm: armsBack, ...crossed },
  ]),
  combo(1, 'Gourd Bonk', 'Swings the gourd down on top of their head', [
    { pelvis: { x: 4, y: 16 }, lean: 28, frontArm: cupReady, backArm: { upper: -40, lower: 40 }, ...wide, trail: { from: 'backHand', reach: 18, curve: 18 } },
    { ms: 160, pelvis: { x: 0, y: 10 }, lean: -20, tilt: 12, frontArm: flailUp, backArm: dangle, ...crossed },
  ]),
  combo(1, 'Tipsy Elbow', 'Lurches sideways into a big elbow, then sways away', [
    { pelvis: { x: 4, y: 14 }, lean: 36, tilt: -12, frontArm: { upper: -5, lower: 175 }, backArm: armsBack, ...wide, trail: { from: 'frontElbow', reach: 16, curve: 10 } },
    { ms: 160, pelvis: { x: -2, y: 10 }, lean: -22, tilt: -10, frontArm: cupReady, backArm: armsBack, ...crossed },
  ]),
  combo(1, 'Hiccup Headbutt', 'A hiccup throws his head forward into a headbutt, and he hops back', [
    { pelvis: { x: 4, y: 14 }, lean: 40, tilt: 16, frontArm: armsBack, backArm: armsBack, ...wide, trail: { from: 'head', reach: 14 } },
    { ms: 160, pelvis: { x: 0, y: 2 }, lean: -16, tilt: -14, frontArm: flailUp, backArm: dangle, frontLeg: { upper: 100, lower: 110 }, backLeg: { upper: 80, lower: 100 } },
  ]),
  combo(1, 'Wobble Slap', 'A floppy open-hand slap one way, and back the other', [
    { pelvis: { x: 3, y: 14 }, lean: 22, frontArm: { upper: -25, lower: 10 }, backArm: dangle, ...wide, trail: { from: 'frontHand', reach: 18, curve: 18 } },
    { ms: 110, pelvis: { x: 2, y: 14 }, lean: 10, tilt: -10, frontArm: { upper: 25, lower: -55 }, backArm: dangle, ...wide, trail: { from: 'frontHand', reach: 16, curve: -18 } },
  ]),

  // ================= Tier 2: drunken boxing =================
  combo(2, 'Drunken Fist Flurry', 'Three cup-fist strikes while swaying side to side', [
    { pelvis: { x: 4, y: 14 }, lean: 26, tilt: 10, frontArm: straight(-6), backArm: dangle, ...wide, trail: { from: 'frontHand', reach: 16 } },
    { ms: 90, pelvis: { x: 0, y: 14 }, lean: -14, tilt: -10, frontArm: straight(-20), backArm: dangle, ...wide, trail: { from: 'frontHand', reach: 16, curve: -10 } },
    { ms: 90, pelvis: { x: 4, y: 14 }, lean: 28, tilt: 10, frontArm: straight(4), backArm: dangle, ...wide, trail: { from: 'frontHand', reach: 18 } },
  ]),
  combo(2, 'Falling Kick', 'Topples over backwards and kicks straight up as he falls', [
    { pelvis: { x: -2, y: 40 }, lean: -60, frontArm: armsBack, backArm: { upper: 140, lower: 120 }, frontLeg: straight(-50), backLeg: { upper: 30, lower: 110 }, trail: { from: 'frontFoot', reach: 22, curve: -16 } },
    { ms: 220, pelvis: { x: 0, y: 30 }, lean: 10, frontArm: cupReady, backArm: dangle, frontLeg: { x: 20, y: F }, backLeg: { x: -16, y: F } },
  ]),
  combo(2, 'Swaying Sweep', 'Sags down low and sweeps the floor, then sways back up', [
    { pelvis: { x: -2, y: 48 }, lean: 30, frontArm: { upper: 80, lower: 95 }, backArm: armsBack, frontLeg: { x: 8, y: F }, backLeg: straight(4), trail: { from: 'backFoot', reach: 20, curve: 8 } },
    { ms: 180, pelvis: { x: 0, y: 12 }, lean: -20, tilt: 12, frontArm: flailUp, backArm: dangle, ...crossed },
  ]),
  combo(2, 'Cup-Hand Strike', 'A cupped lead hand to the ribs, then the gourd hand follows', [
    { pelvis: { x: 4, y: 16 }, lean: 22, frontArm: straight(10), backArm: dangle, ...wide, trail: { from: 'frontHand', reach: 16, curve: 6 } },
    { ms: 110, pelvis: { x: 4, y: 16 }, lean: 26, frontArm: cupReady, backArm: straight(4), ...wide, trail: { from: 'backHand', reach: 18 } },
  ]),
  combo(2, 'Lean-and-Leap', 'Leans way back, then springs into a flying kick and stumbles on landing', [
    { pelvis: { x: 0, y: -14 }, lean: -26, frontArm: armsBack, backArm: flailUp, frontLeg: straight(-10), backLeg: tucked, trail: { from: 'frontFoot', reach: 22 } },
    { ms: 220, pelvis: { x: 4, y: 20 }, lean: 30, tilt: 10, frontArm: armsBack, backArm: dangle, frontLeg: { x: 28, y: F }, backLeg: { x: -10, y: F } },
  ]),

  // =================== Tier 3: props come out ===================
  combo(3, 'Gourd Swing Combo', 'Swings the gourd round on its string: high, low, high', [
    { pelvis: { x: 2, y: 14 }, lean: 10, frontArm: { upper: -60, lower: -30 }, backArm: armsBack, ...wide, prop: 'gourdSwing', trail: { from: 'frontHand', reach: 26, curve: 22 } },
    { ms: 120, pelvis: { x: 3, y: 18 }, lean: 24, frontArm: { upper: 40, lower: 60 }, backArm: armsBack, ...wide, prop: 'gourdSwing', trail: { from: 'frontHand', reach: 26, curve: 18 } },
    { ms: 120, pelvis: { x: 2, y: 14 }, lean: 6, frontArm: { upper: -25, lower: -45 }, backArm: armsBack, ...wide, prop: 'gourdSwing', trail: { from: 'frontHand', reach: 26, curve: -20 } },
  ]),
  combo(3, 'Bench Smash', 'Grabs a bench plank, smashes it down, hauls it up, and smashes again', [
    { pelvis: { x: 4, y: 18 }, lean: 30, frontArm: { upper: 0, lower: 25 }, backArm: dangle, ...wide, prop: 'bench', twoHanded: true, trail: { from: 'frontHand', reach: 30, curve: 22 } },
    { ms: 140, pelvis: { x: 0, y: 10 }, lean: -10, frontArm: { upper: -100, lower: -80 }, backArm: dangle, ...wide, prop: 'bench', twoHanded: true },
    { ms: 120, pelvis: { x: 4, y: 20 }, lean: 34, frontArm: { upper: 15, lower: 40 }, backArm: dangle, ...wide, prop: 'bench', twoHanded: true, trail: { from: 'frontHand', reach: 30, curve: 22 } },
  ]),
  combo(3, 'Rolling Kick', 'Rolls onto his back and kicks up from the floor, then rocks up to a crouch', [
    { pelvis: { x: 0, y: 50 }, lean: -80, frontArm: { upper: -120, lower: -100 }, backArm: { upper: -140, lower: -110 }, frontLeg: straight(-60), backLeg: { upper: -10, lower: 60 }, trail: { from: 'frontFoot', reach: 22, curve: -12 } },
    { ms: 220, pelvis: { x: 2, y: 38 }, lean: 20, frontArm: cupReady, backArm: dangle, frontLeg: { x: 22, y: F }, backLeg: { upper: 100, lower: 175 } },
  ]),
  combo(3, 'Drunken Monkey Climb', 'Scrambles up them like a monkey, then stamps a kick down', [
    { pelvis: { x: 2, y: -16 }, lean: 20, frontArm: { upper: -70, lower: -40 }, backArm: { upper: -40, lower: -10 }, frontLeg: tucked, backLeg: { upper: 100, lower: 150 }, trail: { from: 'frontHand', reach: 16, curve: -10 } },
    { ms: 140, pelvis: { x: 2, y: -10 }, lean: -10, frontArm: armsBack, backArm: flailUp, frontLeg: straight(40), backLeg: tucked, trail: { from: 'frontFoot', reach: 18 } },
    { ms: 200, pelvis: { x: 0, y: 24 }, lean: 26, tilt: 10, frontArm: cupReady, backArm: dangle, ...wide },
  ]),

  // ================= Tier 4: the eight immortals =================
  combo(4, "Lu's Stagger", 'Staggers in shoulder-first, reels back, and staggers in again with an elbow', [
    { pelvis: { x: 6, y: 16 }, lean: 36, tilt: 10, frontArm: dangle, backArm: straight(-4), ...wide, trail: { from: 'backHand', reach: 18, curve: 20 } },
    { ms: 130, pelvis: { x: -2, y: 10 }, lean: -30, tilt: 14, frontArm: flailUp, backArm: armsBack, ...crossed },
    { ms: 130, pelvis: { x: 6, y: 16 }, lean: 38, tilt: -10, frontArm: { upper: -5, lower: 175 }, backArm: armsBack, ...wide, trail: { from: 'frontElbow', reach: 16, curve: 10 } },
  ]),
  combo(4, 'Iron Crutch Kick', 'Leans right back on one leg like a crutch and kicks twice, hopping', [
    { pelvis: { x: -2, y: 8 }, lean: -36, frontArm: armsBack, backArm: flailUp, frontLeg: straight(0), backLeg: { x: -8, y: F }, trail: { from: 'frontFoot', reach: 22 } },
    { ms: 130, pelvis: { x: -2, y: 2 }, lean: -40, frontArm: armsBack, backArm: flailUp, frontLeg: straight(-22), backLeg: { upper: 100, lower: 110 }, trail: { from: 'frontFoot', reach: 22 } },
  ]),
  combo(4, 'Spinning Drunk', 'Twirls round tipsily, arms flung out, cracking them with each hand', [
    { pelvis: { x: 2, y: 12 }, lean: 6, tilt: 12, frontArm: straight(0), backArm: straight(190), ...wide, trail: { from: 'frontHand', reach: 20, curve: 18 } },
    { ms: 120, pelvis: { x: 0, y: 12 }, lean: -6, tilt: -12, frontArm: straight(190), backArm: straight(0), ...crossed, trail: { from: 'backHand', reach: 20, curve: 18 } },
    { ms: 120, pelvis: { x: 2, y: 12 }, lean: 8, tilt: 12, frontArm: straight(-8), backArm: straight(190), ...wide, trail: { from: 'frontHand', reach: 20, curve: 18 } },
  ]),
  combo(4, 'Bottle-Neck Strike', 'Hops in with two fingers to the throat, then nearly falls over', [
    { pelvis: { x: 6, y: 8 }, lean: 30, frontArm: straight(-14), backArm: armsBack, frontLeg: { x: 26, y: F }, backLeg: { upper: 120, lower: 150 }, trail: { from: 'frontHand', reach: 20 } },
    { ms: 180, pelvis: { x: -2, y: 14 }, lean: -32, tilt: -14, frontArm: flailUp, backArm: dangle, ...crossed },
  ]),

  // ================= Tier 5: legendary finishers =================
  combo(5, 'Drunken Master', 'Four stumbles that all land: a lurching jab, an elbow, a sweep and a gourd bonk', [
    { pelvis: { x: 6, y: 18 }, lean: 32, tilt: 10, frontArm: straight(-2), backArm: armsBack, frontLeg: { x: 30, y: F }, backLeg: { x: -16, y: F }, trail: { from: 'frontHand', reach: 18 } },
    { ms: 120, pelvis: { x: 0, y: 12 }, lean: -26, tilt: -12, frontArm: { upper: -5, lower: 175 }, backArm: armsBack, ...crossed, trail: { from: 'frontElbow', reach: 16, curve: 10 } },
    { ms: 130, pelvis: { x: -2, y: 48 }, lean: 30, frontArm: { upper: 80, lower: 95 }, backArm: armsBack, frontLeg: { x: 8, y: F }, backLeg: straight(4), trail: { from: 'backFoot', reach: 20, curve: 8 } },
    { ms: 140, pelvis: { x: 4, y: 16 }, lean: 28, frontArm: cupReady, backArm: { upper: -40, lower: 40 }, ...wide, trail: { from: 'backHand', reach: 18, curve: 18 } },
  ]),
  combo(5, 'Last Call', 'Takes a swig, sprays it in their face, then a huge spinning kick', [
    { pelvis: { x: 2, y: 12 }, lean: 18, tilt: 8, frontArm: cupReady, backArm: dangle, ...wide, drink: true, trail: { from: 'head', reach: 30 } },
    { ms: 130, pelvis: { x: 0, y: 6 }, lean: -20, tilt: 12, frontArm: straight(190), backArm: dangle, ...crossed },
    { ms: 150, pelvis: { x: 0, y: -14 }, lean: -34, frontArm: armsBack, backArm: flailUp, frontLeg: tucked, backLeg: straight(-8), trail: { from: 'backFoot', reach: 28, curve: 14 } },
  ]),
  combo(5, 'Wake-Up Uppercut', 'Flops down out cold, lies there a moment, then springs up into an uppercut', [
    { pelvis: { x: 0, y: 52 }, lean: -75, frontArm: straight(30), backArm: { upper: -150, lower: -120 }, frontLeg: straight(-20), backLeg: straight(10), trail: { from: 'frontHand', reach: 18, curve: 8 } },
    { ms: 280, pelvis: { x: 0, y: 56 }, lean: -85, frontArm: { upper: 200, lower: 190 }, backArm: { upper: -160, lower: -150 }, frontLeg: straight(5), backLeg: straight(10) },
    { ms: 140, pelvis: { x: 4, y: 4 }, lean: 6, frontArm: { upper: -80, lower: -86 }, backArm: armsBack, frontLeg: { x: 22, y: F }, backLeg: { x: -14, y: F }, trail: { from: 'frontHand', reach: 24, curve: -10 } },
  ]),
];
