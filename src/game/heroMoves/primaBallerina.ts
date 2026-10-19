import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { armReaching, buildFighterPose, buildKey, comboMove, FighterSpec, headOf, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE PRIMA BALLERINA: ballet as a weapon, in the spirit of the boy from
 * the mining town who trains his way to the ballet school. Every move is a
 * real ballet step (battement, fouetté, grand jeté) turned into a strike:
 * straight-legged kicks, whipping turns and flying leaps. Physical only: no
 * magic.
 *
 * Her look is one exact pose, drawn by the player: both hands joined in a
 * crown above her head, and the legs in a diamond (knees turned out wide,
 * feet together). In her normal form (tiers 1-4) she never breaks it: she
 * only kicks, out to the side at the enemy and back to the other side, and
 * every kick returns to the diamond. The tier 5 finishers, which arrive
 * with her swan tutu, are the full ballet: leaps, turns and the bow.
 *
 * Built like the other combo heroes: a few big poses per move, every hit
 * held for a beat (withHolds), hips near the centre. Turning steps are
 * marked `spin` for a spin blur. 21 combos over the 5 tiers
 * (5, 5, 4, 4, 3); the first keyframe is the hit.
 *
 * Angles: 0 deg = toward the enemy, 90 = down, -90 = up, 180 = back. Feet
 * planted on the floor are at y = 68.
 */

const TRAIL = '#ff8fd1'; // pink satin ribbon
const F = FLOOR;

/** An arm or leg held straight out at an angle (- is higher). */
const straight = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
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

/** Standing on one leg, up on pointe. */
const standing = { x: -2, y: F };

type Key = FighterSpec & {
  ms?: number;
  /** Both hands joined in a crown above her head (fills in both arms) */
  crown?: boolean;
};

/** The diamond: thighs turned out wide, shins back in, feet together. */
const diamondFront: LimbAngles = { upper: 50, lower: 120 };
const diamondBack: LimbAngles = { upper: 130, lower: 60 };
/** Hip height that puts the diamond's feet exactly on the floor. */
const DIAMOND_Y = 16.5;

/**
 * Her neck is shorter than the default, like a dancer's long-necked but
 * compact frame drawn by the player: with the standard neck the top of her
 * head is almost a full arm's length above the shoulders, so joined hands
 * could only reach it with the arms dead straight. This leaves room for the
 * rounded crown of arms in the drawing.
 */
const NECK = 16;

/** Both hands meet just above her head, the elbows rounded out wide either side. */
function withCrown(k: Key): FighterSpec {
  const base: FighterSpec = { neck: NECK, ...k };
  if (!k.crown) return base;
  const spec: FighterSpec = { ...base, frontArm: { upper: -60, lower: -120 }, backArm: { upper: -120, lower: -60 } };
  const h = headOf(spec);
  // Just above the top of her head (the head is 9 across, so this clears it)
  const join = { x: h.x, y: h.y - 12 };
  return { ...spec, frontArm: armReaching(spec, 'front', join), backArm: armReaching(spec, 'back', join, true) };
}

/**
 * One keyframe of her side-kick pose: crown arms, diamond legs, with
 * `front` and/or `back` replacing a leg to kick out that side (front is
 * toward the enemy, back is the other side).
 */
function kick(front?: LimbAngles, back?: LimbAngles, extra: Partial<Key> = {}): Key {
  return {
    pelvis: { x: 0, y: DIAMOND_Y },
    lean: front ? -6 : back ? 6 : 0,
    frontArm: { upper: 0, lower: 0 },
    backArm: { upper: 0, lower: 0 },
    frontLeg: front ?? diamondFront,
    backLeg: back ?? diamondBack,
    crown: true,
    ...(front ? { trail: { from: 'frontFoot' as const, reach: 22 } } : back ? { trail: { from: 'backFoot' as const, reach: 22 } } : {}),
    ...extra,
  };
}
/** Back to the diamond, hands still joined overhead. */
const diamond = (ms: number): Key => ({ ...kick(), ms });

let nextId = 601;
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[]): AttackMove {
  return comboMove(nextId++, tier, name, description, withHolds(keys.map((k) => buildKey(withCrown(k), TRAIL, k.ms ?? 0))));
}

/** Her pose: hands joined in a crown above her head, legs in the diamond. */
export const PRIMA_BALLERINA_IDLE: SkeletonPose = buildFighterPose(withCrown(kick()), TRAIL);

export const PRIMA_BALLERINA_MOVES: AttackMove[] = [
  // ============ Tiers 1-4: her pose, kicking out to each side ============
  // ======================= Tier 1: single kicks =======================
  combo(1, 'Battement Kick', 'A sharp straight-legged kick out to the side, and back to her pose', [
    kick(straight(0)),
    diamond(160),
  ]),
  combo(1, 'Low Battement', 'A low kick to the shins, and back to her pose', [
    kick(straight(28)),
    diamond(160),
  ]),
  combo(1, 'Battement Frappé', 'The foot strikes out sharp from the ankle, then snaps back', [
    kick(straight(12), undefined, { trail: { from: 'frontFoot', reach: 18 } }),
    diamond(150),
  ]),
  combo(1, 'Petit Battement', 'Two quick little kicks, back to the diamond between them', [
    kick(straight(16)),
    diamond(90),
    kick(straight(8), undefined, { ms: 90 }),
  ]),
  combo(1, 'Développé', 'The leg unfolds up high and slow, and folds back into her pose', [
    kick(straight(-32)),
    diamond(170),
  ]),

  // ================= Tier 2: left and right =================
  combo(2, 'Battement Left-Right', 'Kicks out to the enemy, then back out the other side', [
    kick(straight(0)),
    kick(undefined, straight(180), { ms: 120 }),
    diamond(160),
  ]),
  combo(2, 'Grand Battement', 'A huge straight-legged kick, the foot up above her head', [
    kick(straight(-76), undefined, { trail: { from: 'frontFoot', reach: 20, curve: -18 } }),
    diamond(170),
  ]),
  combo(2, 'Double Frappé', 'Two sharp strikes of the foot, one low and one high', [
    kick(straight(18)),
    diamond(90),
    kick(straight(-10), undefined, { ms: 90 }),
  ]),
  combo(2, 'Rond de Jambe', 'The leg sweeps round in a big arc, low to high', [
    kick(straight(24), undefined, { trail: { from: 'frontFoot', reach: 22, curve: 18 } }),
    kick(straight(-28), undefined, { ms: 120, trail: { from: 'frontFoot', reach: 22, curve: 18 } }),
  ]),
  combo(2, 'Fondu Kick', 'Melts down low on the standing leg, then kicks out from there', [
    kick(straight(4), { upper: 140, lower: 40 }, { pelvis: { x: 0, y: 26 } }),
    diamond(170),
  ]),

  // =================== Tier 3: combinations ===================
  combo(3, 'Grand Battement Left-Right', 'A huge kick to the enemy, then just as high out the other side', [
    kick(straight(-70), undefined, { trail: { from: 'frontFoot', reach: 20, curve: -16 } }),
    kick(undefined, straight(250), { ms: 130, trail: { from: 'backFoot', reach: 20, curve: 16 } }),
    diamond(170),
  ]),
  combo(3, 'Triple Battement', 'Low, middle, high: three kicks climbing up', [
    kick(straight(26)),
    kick(straight(0), undefined, { ms: 90 }),
    kick(straight(-34), undefined, { ms: 90 }),
  ]),
  combo(3, 'Battement en Cloche', 'Swings the leg like a bell: out front, out behind, out front again', [
    kick(straight(-20)),
    kick(undefined, straight(200), { ms: 120 }),
    kick(straight(-30), undefined, { ms: 120 }),
  ]),
  combo(3, 'Sauté Battement', 'A little hop off the floor with the kick, landing back in her pose', [
    kick(straight(-10), undefined, { pelvis: { x: 0, y: 6 } }),
    diamond(180),
  ]),

  // ================= Tier 4: fury =================
  combo(4, 'Grand Battement Fury', 'Three huge kicks: to the enemy, out the other side, and to the enemy again', [
    kick(straight(-70), undefined, { trail: { from: 'frontFoot', reach: 22, curve: -16 } }),
    kick(undefined, straight(250), { ms: 110, trail: { from: 'backFoot', reach: 22, curve: 16 } }),
    kick(straight(-78), undefined, { ms: 110, trail: { from: 'frontFoot', reach: 22, curve: -16 } }),
  ]),
  combo(4, 'Développé Axe', 'The leg unfolds right up high, hangs there, and chops down', [
    kick(straight(-82), undefined, { trail: { from: 'frontFoot', reach: 18, curve: -20 } }),
    kick(straight(-86), undefined, { ms: 220, trail: undefined }),
    kick(straight(36), undefined, { ms: 120, trail: { from: 'frontFoot', reach: 20, curve: -16 } }),
  ]),
  combo(4, 'Battement Storm', 'Low to the enemy, middle out the other side, high to the enemy', [
    kick(straight(24)),
    kick(undefined, straight(180), { ms: 100 }),
    kick(straight(-40), undefined, { ms: 100 }),
  ]),
  combo(4, 'Fouetté Kick', 'Whips round on the standing leg, lashing out a kick on each turn', [
    kick(straight(0), undefined, { spin: true, trail: { from: 'frontFoot', reach: 24, curve: 18 } }),
    kick(undefined, undefined, { ms: 100, spin: true }),
    kick(straight(-16), undefined, { ms: 100, spin: true, trail: { from: 'frontFoot', reach: 24, curve: 18 } }),
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
