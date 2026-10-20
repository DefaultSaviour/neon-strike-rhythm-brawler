import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { armReaching, buildFighterPose, buildKey, comboMove, FighterSpec, headOf, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE LION: the lion who wanted courage, from the old fairy tale of the
 * yellow road (the books, not any film's costume or songs): a big shaggy
 * mane, a lion's face, a swishing tail and clawed paws (drawn by
 * fighterArt). He starts out a scaredy-cat: in the low tiers every swipe
 * is followed by a cower, paws over his face. As the combo grows he gets
 * braver (pounces, claw flurries, roars), and his finishers end on a big
 * brave roar. His top-level form: his courage, as a blazing mane of fire.
 *
 * Built the round-one way: each move is ONE clear idea in a few big poses,
 * every hit is held for a beat (withHolds), and the hips stay near the
 * centre. 21 combos over the 5 tiers (5, 5, 4, 4, 3); the first keyframe is
 * the hit. Claw hits trail from the paws.
 *
 * Angles: 0 deg = toward the enemy, 90 = down, -90 = up, 180 = back. Feet
 * planted on the floor are at y = 68.
 */

const TRAIL = '#ffb347'; // mane orange
const F = FLOOR;
const CLAW = 16;

const straight = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
const kick = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
/** Paws up, claws out, in front of his chest. */
const pawFront: LimbAngles = { upper: 40, lower: -40 };
const pawBack: LimbAngles = { upper: 60, lower: -30 };

/** A crouched, ready-to-spring stance. */
const crouch = { pelvis: { x: 0, y: 20 }, frontLeg: { x: 22, y: F }, backLeg: { x: -20, y: F } };
/** Lunging in behind a swipe. */
const lunge = { pelvis: { x: 8, y: 22 }, frontLeg: { x: 32, y: F }, backLeg: { x: -16, y: F } };
/** Leaping, paws first. */
const pounce = { pelvis: { x: 4, y: -2 }, frontLeg: { upper: 40, lower: 110 }, backLeg: { upper: 120, lower: 150 } };

/** A keyframe; `cower` puts both paws over his face. */
type Key = FighterSpec & { ms?: number; cower?: boolean };

/** Both paws up over his face (he's scared). */
function covering(k: Key): Key {
  if (!k.cower) return k;
  const head = headOf(k);
  return {
    ...k,
    frontArm: armReaching(k, 'front', { x: head.x + 5, y: head.y + 2 }),
    backArm: armReaching(k, 'back', { x: head.x + 2, y: head.y + 5 }),
  };
}

let nextId = 1501;
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[]): AttackMove {
  return comboMove(nextId++, tier, name, description, withHolds(keys.map(covering).map((k) => buildKey(k, TRAIL, k.ms ?? 0))));
}

/** Crouched, paws up and claws out (a bit nervous about it). */
export const LION_IDLE: SkeletonPose = buildFighterPose({ ...crouch, lean: 10, tilt: 6, frontArm: pawFront, backArm: pawBack }, TRAIL);

const ready = (ms: number): Key => ({ ms, ...crouch, lean: 10, tilt: 6, frontArm: pawFront, backArm: pawBack });
/** Cowering: shrunk back, paws over his face, head turned away. */
const cower = (ms: number): Key => ({ ms, pelvis: { x: -8, y: 30 }, lean: -14, tilt: -20, frontArm: pawFront, backArm: pawBack, frontLeg: { x: 12, y: F }, backLeg: { x: -26, y: F }, cower: true });
/** A claw swipe with the lead paw. */
const swipe = (extra: Partial<Key> = {}): Key => ({ ...lunge, lean: 16, frontArm: straight(10), backArm: pawBack, trail: { from: 'frontHand', reach: CLAW, curve: 26 }, ...extra });
/** A claw swipe with the rear paw. */
const rearSwipe = (extra: Partial<Key> = {}): Key => ({ ...lunge, lean: 18, frontArm: { upper: 120, lower: 80 }, backArm: straight(4), trail: { from: 'backHand', reach: CLAW, curve: -26 }, ...extra });
/** A pounce, both paws out in front. */
const leap = (extra: Partial<Key> = {}): Key => ({ ...pounce, lean: 24, frontArm: straight(-6), backArm: straight(8), trail: { from: 'frontHand', reach: CLAW, curve: 20 }, ...extra });
/** The big brave roar: chest out, head up, paws spread. */
const roar = (ms: number): Key => ({ ms, pelvis: { x: 0, y: 10 }, lean: -8, tilt: -14, frontArm: { upper: -40, lower: -70 }, backArm: { upper: -140, lower: -110 }, frontLeg: { x: 16, y: F }, backLeg: { x: -16, y: F } });

export const LION_MOVES: AttackMove[] = [
  // ======================= Tier 1: scaredy-cat =======================
  combo(1, 'Panic Swipe', 'A wild claw swipe, then he cowers behind his paws', [swipe(), cower(150)]),
  combo(1, 'Eyes-Shut Slap', 'Slaps out with his eyes shut and his head turned away', [swipe({ tilt: -24, frontArm: straight(-6), trail: { from: 'frontHand', reach: CLAW, curve: -20 } }), cower(150)]),
  combo(1, 'Scared Kick', 'A frightened kick, then he shrinks back', [
    { pelvis: { x: -4, y: 12 }, lean: -14, tilt: -10, frontArm: pawFront, backArm: pawBack, frontLeg: kick(-6), backLeg: { x: -8, y: F }, trail: { from: 'frontFoot', reach: 14 } },
    cower(150),
  ]),
  combo(1, 'Flinch Jab', 'A quick jab, flinching as it lands', [swipe({ frontArm: straight(-2), trail: { from: 'frontHand', reach: CLAW } }), ready(150)]),
  combo(1, 'Duck and Paw', 'Ducks down low and paws at their legs', [
    { pelvis: { x: 2, y: 34 }, lean: 26, frontArm: straight(40), backArm: pawBack, frontLeg: { x: 28, y: F }, backLeg: { x: -20, y: F }, trail: { from: 'frontHand', reach: CLAW, curve: 20 } },
    cower(150),
  ]),

  // ================= Tier 2: finding his nerve =================
  combo(2, 'Double Swipe', 'Lead paw, rear paw: getting the hang of it', [swipe(), { ms: 100, ...rearSwipe() }]),
  combo(2, 'Little Roar', 'Lunges in with a roar, then checks nobody saw', [
    { ...lunge, lean: 24, tilt: 10, frontArm: pawFront, backArm: pawBack, trail: { from: 'head', reach: 18 } },
    cower(170),
  ]),
  combo(2, 'Uppercut Claw', 'A swipe that rakes up from low to high', [
    { ...crouch, lean: 6, tilt: -10, frontArm: { upper: -36, lower: -50 }, backArm: pawBack, trail: { from: 'frontHand', reach: CLAW, curve: -22 } },
    ready(170),
  ]),
  combo(2, 'Short Pounce', 'A little hop forward, paws first', [leap({ pelvis: { x: 4, y: 4 } }), ready(170)]),
  combo(2, 'Tail Spin', 'Spins round with his paws out, tail flying', [
    { pelvis: { x: 0, y: 16 }, lean: 0, frontArm: straight(4), backArm: straight(186), frontLeg: { x: 8, y: F }, backLeg: { x: -8, y: F }, spin: true, trail: { from: 'frontHand', reach: CLAW, curve: 30 } },
    ready(170),
  ]),

  // =================== Tier 3: braver ===================
  combo(3, 'Pounce', 'Leaps right at them with both paws', [leap(), ready(180)]),
  combo(3, 'Claw Flurry', 'Swipe, swipe, swipe', [swipe(), { ms: 90, ...rearSwipe() }, { ms: 90, ...swipe({ frontArm: straight(-12) }) }]),
  combo(3, 'Mane Shake', 'Shakes his mane and swipes as he comes round', [
    { pelvis: { x: 0, y: 16 }, lean: 6, tilt: 20, frontArm: straight(0), backArm: straight(170), frontLeg: { x: 10, y: F }, backLeg: { x: -10, y: F }, spin: true, trail: { from: 'frontHand', reach: CLAW, curve: 30 } },
    { ms: 110, ...rearSwipe() },
  ]),
  combo(3, 'Leaping Swipe', 'Jumps and rakes a paw down through them', [leap({ frontArm: straight(30), trail: { from: 'frontHand', reach: CLAW, curve: 24 } }), ready(180)]),

  // ================= Tier 4: the king of the forest =================
  combo(4, 'Big Pounce', 'A huge leap, landing with both paws', [leap({ pelvis: { x: 6, y: -8 } }), { ms: 110, ...swipe({ frontArm: straight(30) }) }]),
  combo(4, 'Double Claw', 'Both paws rake down at once', [
    { ...lunge, lean: 22, frontArm: straight(28), backArm: straight(36), trail: { from: 'frontHand', reach: CLAW, curve: 24 } },
    ready(190),
  ]),
  combo(4, 'Maul', 'Drops low and mauls their legs, then rakes up', [
    { pelvis: { x: 2, y: 34 }, lean: 30, frontArm: straight(44), backArm: straight(50), frontLeg: { x: 28, y: F }, backLeg: { x: -20, y: F }, trail: { from: 'frontHand', reach: CLAW, curve: 20 } },
    { ms: 110, ...swipe({ frontArm: { upper: -30, lower: -44 }, trail: { from: 'frontHand', reach: CLAW, curve: -22 } }) },
  ]),
  combo(4, 'Roaring Swipe', 'A swipe and a real roar this time', [swipe(), roar(190)]),

  // ================= Tier 5: courage =================
  combo(5, 'Courage', 'Pounce, swipe, and the bravest roar in the land', [leap(), { ms: 100, ...rearSwipe() }, roar(180)]),
  combo(5, 'Lionheart', 'Swipe, swipe, swipe, then he stands and roars', [swipe(), { ms: 90, ...rearSwipe() }, { ms: 90, ...swipe({ frontArm: straight(-12) }) }, roar(180)]),
  combo(5, 'King of the Forest', 'Spins, mauls and roars like a king', [
    { pelvis: { x: 0, y: 16 }, lean: 0, frontArm: straight(4), backArm: straight(186), frontLeg: { x: 8, y: F }, backLeg: { x: -8, y: F }, spin: true, trail: { from: 'frontHand', reach: CLAW, curve: 30 } },
    { ms: 100, pelvis: { x: 2, y: 34 }, lean: 30, frontArm: straight(44), backArm: straight(50), frontLeg: { x: 28, y: F }, backLeg: { x: -20, y: F }, trail: { from: 'frontHand', reach: CLAW, curve: 20 } },
    roar(180),
  ]),
];
