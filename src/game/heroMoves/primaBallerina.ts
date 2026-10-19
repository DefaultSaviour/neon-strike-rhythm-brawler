import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { buildFighterPose, buildKey, comboMove, FighterSpec, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE PRIMA BALLERINA: ballet as a weapon, in the spirit of the boy from
 * the mining town who trains his way to the ballet school. Every move is a
 * real ballet step (battement, fouetté, grand jeté) turned into a strike:
 * straight-legged kicks, whipping turns and flying leaps. Physical only: no
 * magic.
 *
 * Built like the other combo heroes: each move is ONE clear idea in a few
 * big poses, every hit is held for a beat (withHolds), and the hips stay
 * near the centre. Turning steps are marked `spin` for a spin blur. 21
 * combos over the 5 tiers (5, 5, 4, 4, 3); the first keyframe is the hit.
 *
 * Angles: 0 deg = toward the enemy, 90 = down, -90 = up, 180 = back. Feet
 * planted on the floor are at y = 68.
 */

const TRAIL = '#ff8fd1'; // pink satin ribbon
const F = FLOOR;

/** An arm or leg held straight out at an angle (- is higher). */
const straight = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
/** Bras bas: arms rounded low in front of the hips. */
const brasBasFront: LimbAngles = { upper: 75, lower: 135 };
const brasBasBack: LimbAngles = { upper: 85, lower: 145 };
/** Second position: arms open wide to the sides, softly rounded. */
const secondFront: LimbAngles = { upper: 5, lower: 20 };
const secondBack: LimbAngles = { upper: 175, lower: 160 };
/** Couronne (fifth position): arms in a crown over the head. */
const crownFront: LimbAngles = { upper: -105, lower: -150 };
const crownBack: LimbAngles = { upper: -75, lower: -30 };
/** First position: arms rounded in front of the chest, for turning. */
const firstFront: LimbAngles = { upper: 40, lower: 150 };
const firstBack: LimbAngles = { upper: 50, lower: 160 };
/** Passé: the working foot drawn up to the standing knee. */
const passe: LimbAngles = { upper: 25, lower: 150 };
/** A leg tucked up under the body in the air. */
const tucked: LimbAngles = { upper: 70, lower: 150 };

/** Up on pointe, feet together. */
const onPointe = { pelvis: { x: 0, y: 6 }, frontLeg: { x: 3, y: F }, backLeg: { x: -3, y: F } };
/** Standing on one leg, up on pointe. */
const standing = { x: -2, y: F };
/** A deep plié in second position, as she lands. */
const plie = { pelvis: { x: 0, y: 26 }, frontLeg: { x: 22, y: F }, backLeg: { x: -22, y: F } };

type Key = FighterSpec & { ms?: number };

let nextId = 601;
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[]): AttackMove {
  return comboMove(nextId++, tier, name, description, withHolds(keys.map((k) => buildKey(k, TRAIL, k.ms ?? 0))));
}

/** First position up on pointe, arms in bras bas. */
export const PRIMA_BALLERINA_IDLE: SkeletonPose = buildFighterPose({ ...onPointe, lean: 0, frontArm: brasBasFront, backArm: brasBasBack }, TRAIL);

export const PRIMA_BALLERINA_MOVES: AttackMove[] = [
  // ======================= Tier 1: from the barre =======================
  combo(1, 'Battement Kick', 'A sharp straight-legged kick, then she closes into fifth with arms in a crown', [
    { pelvis: { x: 0, y: 8 }, lean: -10, frontArm: secondFront, backArm: secondBack, frontLeg: straight(-30), backLeg: standing, trail: { from: 'frontFoot', reach: 20 } },
    { ms: 160, ...onPointe, lean: 0, frontArm: crownFront, backArm: crownBack },
  ]),
  combo(1, 'Pas de Chat Knee', 'A cat-like little jump, the knee snapping up, and a soft landing', [
    { pelvis: { x: 2, y: -10 }, lean: 6, frontArm: secondFront, backArm: secondBack, frontLeg: { upper: -40, lower: 80 }, backLeg: tucked, trail: { from: 'frontKnee', reach: 16 } },
    { ms: 180, ...plie, lean: 4, frontArm: brasBasFront, backArm: brasBasBack },
  ]),
  combo(1, 'Port de Bras Chop', 'The arm sweeps down from high like a blade, carriage and all', [
    { pelvis: { x: 4, y: 16 }, lean: 16, frontArm: { upper: -40, lower: 10 }, backArm: secondBack, frontLeg: { x: 26, y: F }, backLeg: { x: -18, y: F }, trail: { from: 'frontHand', reach: 20, curve: 16 } },
    { ms: 160, pelvis: { x: 4, y: 16 }, lean: 22, frontArm: { upper: 60, lower: 90 }, backArm: secondBack, frontLeg: { x: 26, y: F }, backLeg: { x: -18, y: F } },
  ]),
  combo(1, 'Relevé Uppercut', 'Rises up onto pointe behind a rising uppercut', [
    { ...onPointe, lean: 4, frontArm: { upper: -70, lower: -86 }, backArm: secondBack, trail: { from: 'frontHand', reach: 20, curve: -10 } },
    { ms: 160, ...onPointe, lean: 0, frontArm: crownFront, backArm: crownBack },
  ]),
  combo(1, 'Plié Punch', 'Sinks into a deep plié and punches straight out, then rises', [
    { ...plie, lean: 8, frontArm: straight(0), backArm: secondBack, trail: { from: 'frontHand', reach: 22 } },
    { ms: 170, ...onPointe, lean: 0, frontArm: secondFront, backArm: secondBack },
  ]),

  // ================= Tier 2: centre work =================
  combo(2, 'Pirouette Heel', 'Whips round in a pirouette and the heel shoots out of the turn', [
    { pelvis: { x: 0, y: 8 }, lean: 0, frontArm: firstFront, backArm: firstBack, frontLeg: straight(0), backLeg: standing, spin: true, trail: { from: 'frontFoot', reach: 22, curve: 14 } },
    { ms: 170, pelvis: { x: 0, y: 6 }, lean: 0, frontArm: crownFront, backArm: crownBack, frontLeg: passe, backLeg: standing, spin: true },
  ]),
  combo(2, 'Grand Battement', 'A huge straight-legged kick, the foot right up by her ear', [
    { pelvis: { x: -2, y: 8 }, lean: -16, frontArm: secondFront, backArm: secondBack, frontLeg: straight(-78), backLeg: standing, trail: { from: 'frontFoot', reach: 20, curve: -18 } },
    { ms: 170, ...onPointe, lean: 0, frontArm: secondFront, backArm: secondBack },
  ]),
  combo(2, 'Fouetté Whip', 'Three whipping turns on one leg, the other leg lashing out each time', [
    { pelvis: { x: 0, y: 8 }, lean: -4, frontArm: secondFront, backArm: secondBack, frontLeg: straight(-6), backLeg: standing, spin: true, trail: { from: 'frontFoot', reach: 22, curve: 16 } },
    { ms: 110, pelvis: { x: 0, y: 8 }, lean: 0, tilt: 8, frontArm: firstFront, backArm: firstBack, frontLeg: straight(10), backLeg: standing, spin: true, trail: { from: 'frontFoot', reach: 22, curve: 16 } },
    { ms: 110, pelvis: { x: 0, y: 8 }, lean: -6, frontArm: secondFront, backArm: secondBack, frontLeg: straight(-14), backLeg: standing, spin: true, trail: { from: 'frontFoot', reach: 22, curve: 16 } },
  ]),
  combo(2, 'Arabesque Thrust', 'Tips forward into an arabesque, one palm driving out, the back leg high', [
    { pelvis: { x: 0, y: 10 }, lean: 32, frontArm: straight(-8), backArm: straight(190), frontLeg: { x: 4, y: F }, backLeg: straight(198), trail: { from: 'frontHand', reach: 22 } },
    { ms: 180, pelvis: { x: 0, y: 10 }, lean: 38, frontArm: straight(-14), backArm: straight(196), frontLeg: { x: 4, y: F }, backLeg: straight(204) },
  ]),
  combo(2, 'Sissonne Scissor', 'Springs up and scissors the legs wide open in the air', [
    { pelvis: { x: 0, y: -12 }, lean: -10, frontArm: secondFront, backArm: secondBack, frontLeg: straight(-10), backLeg: straight(188), trail: { from: 'frontFoot', reach: 22 } },
    { ms: 200, ...plie, lean: 6, frontArm: brasBasFront, backArm: brasBasBack },
  ]),

  // =================== Tier 3: allegro (the big jumps) ===================
  combo(3, 'Grand Jeté', 'A flying split leap, front foot first', [
    { pelvis: { x: 0, y: -20 }, lean: -6, frontArm: straight(-30), backArm: straight(200), frontLeg: straight(-6), backLeg: straight(188), trail: { from: 'frontFoot', reach: 26 } },
    { ms: 220, ...plie, lean: 8, frontArm: secondFront, backArm: secondBack },
  ]),
  combo(3, "Tour en l'Air", 'Leaps and turns right round in the air, kicking out of the turn', [
    { pelvis: { x: 0, y: -16 }, lean: -6, frontArm: crownFront, backArm: crownBack, frontLeg: straight(0), backLeg: straight(84), spin: true, trail: { from: 'frontFoot', reach: 22, curve: 12 } },
    { ms: 160, pelvis: { x: 0, y: -18 }, lean: 0, frontArm: crownFront, backArm: crownBack, frontLeg: straight(86), backLeg: straight(92), spin: true },
    { ms: 180, ...plie, lean: 4, frontArm: secondFront, backArm: secondBack },
  ]),
  combo(3, 'Cabriole Beat', 'Kicks up and beats the legs together in mid-air, twice', [
    { pelvis: { x: 0, y: -14 }, lean: -14, frontArm: secondFront, backArm: secondBack, frontLeg: straight(-26), backLeg: { upper: 100, lower: 110 }, trail: { from: 'frontFoot', reach: 20 } },
    { ms: 120, pelvis: { x: 0, y: -16 }, lean: -16, frontArm: secondFront, backArm: secondBack, frontLeg: straight(-30), backLeg: straight(-24), trail: { from: 'backFoot', reach: 20 } },
    { ms: 190, ...plie, lean: 4, frontArm: brasBasFront, backArm: brasBasBack },
  ]),
  combo(3, 'Pas de Bourrée Flurry', 'Tiny quick steps on pointe, a palm strike on every one', [
    { pelvis: { x: 2, y: 6 }, lean: 10, frontArm: straight(-4), backArm: secondBack, frontLeg: { x: 6, y: F }, backLeg: { x: -2, y: F }, trail: { from: 'frontHand', reach: 18 } },
    { ms: 80, pelvis: { x: 4, y: 6 }, lean: 12, frontArm: secondFront, backArm: straight(2), frontLeg: { x: 10, y: F }, backLeg: { x: 2, y: F }, trail: { from: 'backHand', reach: 18 } },
    { ms: 80, pelvis: { x: 6, y: 6 }, lean: 12, frontArm: straight(-8), backArm: secondBack, frontLeg: { x: 12, y: F }, backLeg: { x: 4, y: F }, trail: { from: 'frontHand', reach: 18 } },
  ]),

  // ================= Tier 4: virtuoso =================
  combo(4, '32 Fouettés', 'The famous run of whipping turns: on and on, lashing out every time', [
    { pelvis: { x: 0, y: 8 }, lean: -6, frontArm: secondFront, backArm: secondBack, frontLeg: straight(-10), backLeg: standing, spin: true, trail: { from: 'frontFoot', reach: 24, curve: 18 } },
    { ms: 95, pelvis: { x: 0, y: 8 }, lean: 0, tilt: 10, frontArm: firstFront, backArm: firstBack, frontLeg: passe, backLeg: standing, spin: true },
    { ms: 95, pelvis: { x: 0, y: 8 }, lean: -8, frontArm: secondFront, backArm: secondBack, frontLeg: straight(-18), backLeg: standing, spin: true, trail: { from: 'frontFoot', reach: 24, curve: 18 } },
  ]),
  combo(4, 'Lift-Off Leap', 'Soars straight up as if lifted, one leg kicking high', [
    { pelvis: { x: 0, y: -26 }, lean: -10, frontArm: crownFront, backArm: crownBack, frontLeg: straight(-44), backLeg: tucked, trail: { from: 'frontFoot', reach: 24 } },
    { ms: 230, ...plie, lean: 6, frontArm: secondFront, backArm: secondBack },
  ]),
  combo(4, 'Arabesque Spin', 'Turns in a full arabesque, striking ahead with the hand, then behind with the leg', [
    { pelvis: { x: 0, y: 10 }, lean: 30, frontArm: straight(-6), backArm: straight(190), frontLeg: { x: 4, y: F }, backLeg: straight(196), spin: true, trail: { from: 'frontHand', reach: 22, curve: 14 } },
    { ms: 150, pelvis: { x: 0, y: 10 }, lean: 30, tilt: -10, frontArm: straight(190), backArm: straight(-6), frontLeg: { x: 4, y: F }, backLeg: straight(196), spin: true, trail: { from: 'backFoot', reach: 22, curve: 14 } },
    { ms: 170, ...onPointe, lean: 0, frontArm: crownFront, backArm: crownBack },
  ]),
  combo(4, 'Développé Axe', 'The leg slowly unfolds right up high, hangs there, and chops down', [
    { pelvis: { x: -2, y: 8 }, lean: -14, frontArm: secondFront, backArm: secondBack, frontLeg: straight(-82), backLeg: standing, trail: { from: 'frontFoot', reach: 18, curve: -20 } },
    { ms: 220, pelvis: { x: -2, y: 6 }, lean: -16, frontArm: crownFront, backArm: crownBack, frontLeg: straight(-86), backLeg: standing },
    { ms: 120, pelvis: { x: 2, y: 14 }, lean: 12, frontArm: secondFront, backArm: secondBack, frontLeg: straight(40), backLeg: standing, trail: { from: 'frontFoot', reach: 20, curve: -16 } },
  ]),

  // ================= Tier 5: legendary finishers =================
  combo(5, 'Swan Lake', 'A grand jeté, a turn, a kick, and she ends in a swan arabesque, arms like wings', [
    { pelvis: { x: 0, y: -20 }, lean: -6, frontArm: straight(-30), backArm: straight(200), frontLeg: straight(-6), backLeg: straight(188), trail: { from: 'frontFoot', reach: 26 } },
    { ms: 150, pelvis: { x: 0, y: 6 }, lean: 0, frontArm: crownFront, backArm: crownBack, frontLeg: passe, backLeg: standing, spin: true },
    { ms: 140, pelvis: { x: -2, y: 8 }, lean: -14, frontArm: secondFront, backArm: secondBack, frontLeg: straight(-60), backLeg: standing, trail: { from: 'frontFoot', reach: 22, curve: -14 } },
    { ms: 240, pelvis: { x: 0, y: 10 }, lean: 34, frontArm: { upper: -40, lower: -10 }, backArm: { upper: 220, lower: 250 }, frontLeg: { x: 4, y: F }, backLeg: straight(198) },
  ]),
  combo(5, 'Black Swan', 'A dark, relentless run of whipping turns and kicks, ending on a stab of the leg', [
    { pelvis: { x: 0, y: 8 }, lean: -8, frontArm: secondFront, backArm: secondBack, frontLeg: straight(-14), backLeg: standing, spin: true, trail: { from: 'frontFoot', reach: 24, curve: 18 } },
    { ms: 100, pelvis: { x: 0, y: 8 }, lean: 0, tilt: 10, frontArm: firstFront, backArm: firstBack, frontLeg: passe, backLeg: standing, spin: true },
    { ms: 100, pelvis: { x: 0, y: 8 }, lean: -10, frontArm: secondFront, backArm: secondBack, frontLeg: straight(-24), backLeg: standing, spin: true, trail: { from: 'frontFoot', reach: 24, curve: 18 } },
    { ms: 130, pelvis: { x: -2, y: 8 }, lean: -14, frontArm: crownFront, backArm: crownBack, frontLeg: straight(-4), backLeg: standing, trail: { from: 'frontFoot', reach: 26 } },
  ]),
  combo(5, 'Curtain Call', 'A devastating grand battement, then she sinks into a deep bow to the audience', [
    { pelvis: { x: -2, y: 8 }, lean: -18, frontArm: secondFront, backArm: secondBack, frontLeg: straight(-84), backLeg: standing, trail: { from: 'frontFoot', reach: 26, curve: -20 } },
    { ms: 320, pelvis: { x: 0, y: 24 }, lean: 40, tilt: 10, frontArm: { upper: 60, lower: 30 }, backArm: secondBack, frontLeg: { x: 10, y: F }, backLeg: { x: -24, y: F } },
  ]),
];
