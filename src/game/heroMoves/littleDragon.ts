import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { buildFighterPose, FighterSpec, LimbAngles } from './poseBuilder';

/**
 * THE LITTLE DRAGON: a lightning-fast martial artist in the spirit of the
 * great 70s kung-fu films. Low bouncing stance, lead hand forward, snapping
 * straight blows, high side kicks, flying kicks and nunchaku.
 *
 * 21 moves across the 5 combo tiers (5, 5, 4, 4, 3). Each pose is built from
 * joint angles (see poseBuilder.ts): 0 deg = toward the enemy, 90 = down,
 * -90 = up, 180 = back. Feet planted on the floor are at y = 68.
 */

const TRAIL = '#ffe600'; // the famous yellow tracksuit
const F = FLOOR;

/** Rear hand guarding the chin / chest. */
const guard: LimbAngles = { upper: 110, lower: -65 };
/** Lead hand held low and forward, ready. */
const leadReady: LimbAngles = { upper: 40, lower: -20 };

let nextId = 101;
function move(
  tier: AttackMove['tier'],
  name: string,
  description: string,
  durationMs: number,
  spec: FighterSpec
): AttackMove {
  return { id: nextId++, tier, name, description, durationMs, pose: buildFighterPose(spec, TRAIL) };
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
  // ---- Tier 1: the basics, fast and straight ----
  move(1, 'Lead Straight', 'The fastest punch in the West, straight down the centre line', 130, {
    pelvis: { x: 2, y: 11 },
    lean: 8,
    frontArm: { upper: -2, lower: -2 },
    backArm: guard,
    frontLeg: { x: 20, y: F },
    backLeg: { x: -16, y: F },
    trail: { from: 'frontHand', reach: 16 },
  }),
  move(1, 'Finger Jab', 'Fingertips flicked straight at the eyes', 125, {
    pelvis: { x: 2, y: 10 },
    lean: 10,
    tilt: -6,
    frontArm: { upper: -14, lower: -16 },
    backArm: guard,
    frontLeg: { x: 20, y: F },
    backLeg: { x: -16, y: F },
    trail: { from: 'frontHand', reach: 14, curve: -4 },
  }),
  move(1, 'Stop Kick', 'A low side kick that jams the shin before the enemy can step', 145, {
    pelvis: { x: 0, y: 8 },
    lean: -18,
    frontArm: { upper: 60, lower: -40 },
    backArm: guard,
    frontLeg: { upper: 22, lower: 22 },
    backLeg: { x: -10, y: F },
    trail: { from: 'frontFoot', reach: 14, curve: 6 },
  }),
  move(1, 'Back Fist', 'Elbow up, the fist whips down like a snapping towel', 135, {
    pelvis: { x: 1, y: 11 },
    lean: 4,
    frontArm: { upper: -35, lower: 15 },
    backArm: guard,
    frontLeg: { x: 18, y: F },
    backLeg: { x: -16, y: F },
    trail: { from: 'frontHand', reach: 12, curve: -10 },
  }),
  move(1, 'One-Inch Punch', 'No wind-up at all: the whole body explodes through one inch', 120, {
    pelvis: { x: 4, y: 13 },
    lean: 14,
    frontArm: { upper: 4, lower: 0 },
    backArm: { upper: 120, lower: -50 },
    frontLeg: { x: 22, y: F },
    backLeg: { x: -14, y: F },
    trail: { from: 'frontHand', reach: 24 },
  }),

  // ---- Tier 2: kicks open up ----
  move(2, 'High Side Kick', 'Leaning right back, the heel drives out at head height', 165, {
    pelvis: { x: -2, y: 6 },
    lean: -35,
    frontArm: { upper: 40, lower: -60 },
    backArm: { upper: 160, lower: 130 },
    frontLeg: { upper: -8, lower: -8 },
    backLeg: { x: -10, y: F },
    trail: { from: 'frontFoot', reach: 18, curve: -6 },
  }),
  move(2, 'Hook Kick', 'The leg swings out wide, then the heel hooks back in', 170, {
    pelvis: { x: -2, y: 7 },
    lean: -30,
    frontArm: { upper: 50, lower: -50 },
    backArm: { upper: 150, lower: 120 },
    frontLeg: { upper: -35, lower: 40 },
    backLeg: { x: -10, y: F },
    trail: { from: 'frontFoot', reach: 12, curve: 16 },
  }),
  move(2, 'Lead Hook', 'Elbow high, the fist curls round the guard', 140, {
    pelvis: { x: 2, y: 11 },
    lean: 8,
    tilt: 4,
    frontArm: { upper: -15, lower: 35 },
    backArm: guard,
    frontLeg: { x: 18, y: F },
    backLeg: { x: -16, y: F },
    trail: { from: 'frontHand', reach: 12, curve: 16 },
  }),
  move(2, 'Spinning Back Kick', 'Turns his back for an instant, then the rear heel spears out', 175, {
    pelvis: { x: -4, y: 7 },
    lean: -40,
    tilt: 10,
    frontArm: { upper: 140, lower: 100 },
    backArm: { upper: 170, lower: 140 },
    frontLeg: { x: -6, y: F },
    backLeg: { upper: -4, lower: -4 },
    trail: { from: 'backFoot', reach: 18, curve: 10 },
  }),
  move(2, 'Chain Punches', 'A blur of straight punches stacked down the centre', 130, {
    pelvis: { x: 3, y: 11 },
    lean: 10,
    frontArm: { upper: 0, lower: 0 },
    backArm: { upper: 6, lower: -6 },
    frontLeg: { x: 20, y: F },
    backLeg: { x: -14, y: F },
    trail: { from: 'frontHand', reach: 12 },
  }),

  // ---- Tier 3: off the ground, out come the nunchaku ----
  move(3, 'Flying Side Kick', 'Launches clear of the floor, one leg spearing out', 190, {
    pelvis: { x: 0, y: -10 },
    lean: -30,
    frontArm: { upper: 40, lower: -60 },
    backArm: { upper: 150, lower: 120 },
    frontLeg: { upper: -5, lower: -5 },
    backLeg: { upper: 30, lower: 150 },
    trail: { from: 'frontFoot', reach: 20, curve: -4 },
  }),
  move(3, 'Nunchaku Strike', 'The nunchaku cracks down in a blur', 160, {
    pelvis: { x: 2, y: 11 },
    lean: 6,
    frontArm: { upper: -60, lower: -10 },
    backArm: guard,
    frontLeg: { x: 18, y: F },
    backLeg: { x: -16, y: F },
    trail: { from: 'frontHand', reach: 26, curve: -14 },
    prop: 'nunchaku',
  }),
  move(3, 'Tornado Kick', 'Spins in the air, the lead leg whipping round', 185, {
    pelvis: { x: 0, y: -6 },
    lean: 10,
    frontArm: { upper: 150, lower: 170 },
    backArm: { upper: 120, lower: 160 },
    frontLeg: { upper: -20, lower: -30 },
    backLeg: { upper: 60, lower: 140 },
    trail: { from: 'frontFoot', reach: 18, curve: 18 },
  }),
  move(3, 'Flying Knee', 'Leaps and drives the knee up into the chest', 165, {
    pelvis: { x: 2, y: -4 },
    lean: 6,
    frontArm: { upper: -40, lower: 60 },
    backArm: { upper: 140, lower: 100 },
    frontLeg: { upper: -25, lower: 100 },
    backLeg: { upper: 100, lower: 130 },
    trail: { from: 'frontKnee', reach: 14, curve: -6 },
  }),

  // ---- Tier 4: overdrive ----
  move(4, 'Nunchaku Whirlwind', 'The nunchaku spins overhead in a figure-eight before it lands', 175, {
    pelvis: { x: 1, y: 10 },
    lean: 4,
    tilt: -8,
    frontArm: { upper: -75, lower: -35 },
    backArm: { upper: 160, lower: 200 },
    frontLeg: { x: 18, y: F },
    backLeg: { x: -18, y: F },
    trail: { from: 'frontHand', reach: 28, curve: 22 },
    prop: 'nunchaku',
  }),
  move(4, 'Dragon Axe Kick', 'The leg rises straight up, then chops down like an axe', 180, {
    pelvis: { x: -2, y: 7 },
    lean: -15,
    frontArm: { upper: 60, lower: -30 },
    backArm: { upper: 150, lower: 110 },
    frontLeg: { upper: -78, lower: -80 },
    backLeg: { x: -10, y: F },
    trail: { from: 'frontFoot', reach: 16, curve: -20 },
  }),
  move(4, 'Scissor Kick', 'Airborne, both legs snap shut like scissors', 185, {
    pelvis: { x: 0, y: -14 },
    lean: -25,
    frontArm: { upper: 30, lower: -40 },
    backArm: { upper: 160, lower: 140 },
    frontLeg: { upper: -10, lower: -10 },
    backLeg: { upper: 25, lower: 25 },
    trail: { from: 'frontFoot', reach: 16, curve: 12 },
  }),
  move(4, 'Triple Kick Flurry', 'Three kicks from the same leg before it touches down', 170, {
    pelvis: { x: -2, y: 6 },
    lean: -30,
    frontArm: { upper: 40, lower: -60 },
    backArm: { upper: 165, lower: 140 },
    frontLeg: { upper: -30, lower: -30 },
    backLeg: { x: -10, y: F },
    trail: { from: 'frontFoot', reach: 24, curve: -10 },
  }),

  // ---- Tier 5: legendary finishers ----
  move(5, 'Flying Dragon Kick', 'A huge leap, body flat out, the kick lands like a thunderbolt', 210, {
    pelvis: { x: 0, y: -24 },
    lean: -40,
    frontArm: { upper: 200, lower: 190 },
    backArm: { upper: 160, lower: 150 },
    frontLeg: { upper: -15, lower: -15 },
    backLeg: { upper: 70, lower: 150 },
    trail: { from: 'frontFoot', reach: 30, curve: -8 },
  }),
  move(5, 'Intercepting Fist', 'Lunges under the attack and fires the fist straight through it', 175, {
    pelvis: { x: 6, y: 20 },
    lean: 22,
    frontArm: { upper: 0, lower: 0 },
    backArm: { upper: 120, lower: -40 },
    frontLeg: { x: 30, y: F },
    backLeg: { x: -24, y: F },
    trail: { from: 'frontHand', reach: 30 },
  }),
  move(5, "Dragon's Roar", 'A one-inch punch with everything behind it, and a roar', 200, {
    pelvis: { x: 6, y: 14 },
    lean: 18,
    tilt: -20,
    frontArm: { upper: -3, lower: -3 },
    backArm: { upper: 170, lower: 175 },
    frontLeg: { x: 26, y: F },
    backLeg: { x: -20, y: F },
    trail: { from: 'frontHand', reach: 34 },
  }),
];
