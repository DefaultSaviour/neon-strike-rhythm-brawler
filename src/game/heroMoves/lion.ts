import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { armReaching, buildFighterPose, buildKey, comboMove, FighterSpec, headOf, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE LION: the lion who wanted courage, from the old fairy tale of the
 * yellow road (the books, not any film's costume or songs): a big shaggy
 * mane, a lion's face, a swishing tail and clawed paws (drawn by
 * fighterArt). He starts out a scaredy-cat: for the first three tiers he
 * fights with one paw over his eyes and only ever hits with the other, and
 * in tier 1 most swipes end in a cower, both paws over his face. In tier 4
 * the paw comes down and he fights properly (pounces, both claws, roars). His top-level form is his
 * courage: a blazing mane of fire, and he bulks up into a much bigger,
 * jacked king (fighterArt's HERO_BUILDS and bodyBulk), his finishers
 * ending on a roaring double-biceps flex.
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

/**
 * His rear paw clapped over his eyes (he can't bear to look): he leans back
 * from what he is hitting, head turned away, and the arm comes up in front
 * of him, elbow out toward the enemy, so the paw sits on the front of his face.
 */
function eyesCovered(k: Key): Key {
  if (k.cower) return k;
  const flinch: Key = { ...k, lean: (k.lean ?? 0) - 14, tilt: (k.tilt ?? 0) - 16 };
  const head = headOf(flinch);
  const target = { x: head.x + 9, y: head.y - 2.5 };
  const options = [armReaching(flinch, 'back', target), armReaching(flinch, 'back', target, true)];
  // The elbow that sticks out in front of him, not the one tucked behind his mane
  const elbowOut = (l: LimbAngles) => Math.cos((l.upper * Math.PI) / 180);
  return { ...flinch, backArm: elbowOut(options[0]) >= elbowOut(options[1]) ? options[0] : options[1] };
}

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

/**
 * A move from tiers 1 to 3: too scared to look. His rear paw stays over his
 * eyes in every pose, so he only ever hits with the lead paw, a foot or his
 * head, and he waits like that between attacks too (LION_NOT_LOOKING).
 */
function scared(tier: 1 | 2 | 3, name: string, description: string, keys: Key[]): AttackMove {
  return { ...combo(tier, name, description, keys.map(eyesCovered)), restPose: LION_NOT_LOOKING };
}

/** Crouched, paws up and claws out (a bit nervous about it). */
export const LION_IDLE: SkeletonPose = buildFighterPose({ ...crouch, lean: 10, tilt: 6, frontArm: pawFront, backArm: pawBack }, TRAIL);

/** Tiers 1 to 3 between attacks: crouched, one paw over his eyes, the other feeling about in front. */
export const LION_NOT_LOOKING: SkeletonPose = buildFighterPose(eyesCovered({ ...crouch, lean: 6, tilt: -8, frontArm: { upper: 30, lower: -10 }, backArm: pawBack }), TRAIL);

const ready = (ms: number): Key => ({ ms, ...crouch, lean: 10, tilt: 6, frontArm: pawFront, backArm: pawBack });
/** Cowering: shrunk back, paws over his face, head turned away. */
const cower = (ms: number): Key => ({ ms, pelvis: { x: -8, y: 30 }, lean: -14, tilt: -20, frontArm: pawFront, backArm: pawBack, frontLeg: { x: 12, y: F }, backLeg: { x: -26, y: F }, cower: true });
/** A claw swipe with the lead paw. */
const swipe = (extra: Partial<Key> = {}): Key => ({ ...lunge, lean: 16, frontArm: straight(10), backArm: pawBack, trail: { from: 'frontHand', reach: CLAW, curve: 26 }, ...extra });
/** A claw swipe with the rear paw. */
const rearSwipe = (extra: Partial<Key> = {}): Key => ({ ...lunge, lean: 18, frontArm: { upper: 120, lower: 80 }, backArm: straight(4), trail: { from: 'backHand', reach: CLAW, curve: -26 }, ...extra });
/** A pounce, both paws out in front. */
const leap = (extra: Partial<Key> = {}): Key => ({ ...pounce, lean: 24, frontArm: straight(-6), backArm: straight(8), trail: { from: 'frontHand', reach: CLAW, curve: 20 }, ...extra });
/**
 * His top-level finish: jacked at last, he roars with a double-biceps flex,
 * both fists up by his head, feet planted wide.
 */
const flex = (ms: number): Key => ({ ms, pelvis: { x: 0, y: 10 }, lean: -4, tilt: -16, frontArm: { upper: -15, lower: -100 }, backArm: { upper: -165, lower: -80 }, frontLeg: { x: 20, y: F }, backLeg: { x: -20, y: F } });
/** The big brave roar: chest out, head up, paws spread. */
const roar = (ms: number): Key => ({ ms, pelvis: { x: 0, y: 10 }, lean: -8, tilt: -14, frontArm: { upper: -40, lower: -70 }, backArm: { upper: -140, lower: -110 }, frontLeg: { x: 16, y: F }, backLeg: { x: -16, y: F } });

export const LION_MOVES: AttackMove[] = [
  // ======================= Tier 1: scaredy-cat (one paw over his eyes until tier 4) =======================
  scared(1, 'Panic Swipe', 'A wild claw swipe without looking, then he cowers behind both paws', [swipe(), cower(150)]),
  scared(1, 'Eyes-Shut Slap', 'Slaps out with his eyes shut and his head turned away', [swipe({ tilt: -24, frontArm: straight(-6), trail: { from: 'frontHand', reach: CLAW, curve: -20 } }), cower(150)]),
  scared(1, 'Scared Kick', 'A frightened kick, then he shrinks back', [
    { pelvis: { x: -4, y: 12 }, lean: -14, tilt: -10, frontArm: pawFront, backArm: pawBack, frontLeg: kick(-6), backLeg: { x: -8, y: F }, trail: { from: 'frontFoot', reach: 14 } },
    cower(150),
  ]),
  scared(1, 'Flinch Jab', 'A quick jab, flinching as it lands', [swipe({ frontArm: straight(-2), trail: { from: 'frontHand', reach: CLAW } }), ready(150)]),
  scared(1, 'Duck and Paw', 'Ducks down low and paws at their legs', [
    { pelvis: { x: 2, y: 34 }, lean: 26, frontArm: straight(40), backArm: pawBack, frontLeg: { x: 28, y: F }, backLeg: { x: -20, y: F }, trail: { from: 'frontHand', reach: CLAW, curve: 20 } },
    cower(150),
  ]),

  // ================= Tier 2: finding his nerve =================
  scared(2, 'Double Swipe', 'High, then low, with the same paw: getting the hang of it', [swipe({ frontArm: straight(-14) }), { ms: 100, ...swipe({ frontArm: straight(34), trail: { from: 'frontHand', reach: CLAW, curve: -22 } }) }]),
  scared(2, 'Little Roar', 'Lunges in with a roar, then checks nobody saw', [
    { ...lunge, lean: 24, tilt: 10, frontArm: pawFront, backArm: pawBack, trail: { from: 'head', reach: 18 } },
    cower(170),
  ]),
  scared(2, 'Uppercut Claw', 'A swipe that rakes up from low to high', [
    { ...crouch, lean: 6, tilt: -10, frontArm: { upper: -36, lower: -50 }, backArm: pawBack, trail: { from: 'frontHand', reach: CLAW, curve: -22 } },
    ready(170),
  ]),
  scared(2, 'Short Pounce', 'A little hop forward, paws first', [leap({ pelvis: { x: 4, y: 4 } }), ready(170)]),
  scared(2, 'Tail Spin', 'Spins round with his paws out, tail flying', [
    { pelvis: { x: 0, y: 16 }, lean: 0, frontArm: straight(4), backArm: straight(186), frontLeg: { x: 8, y: F }, backLeg: { x: -8, y: F }, spin: true, trail: { from: 'frontHand', reach: CLAW, curve: 30 } },
    ready(170),
  ]),

  // =================== Tier 3: braver ===================
  scared(3, 'Pounce', 'Leaps right at them, one paw out and the other over his eyes', [leap(), ready(180)]),
  scared(3, 'Claw Flurry', 'Swipe, swipe, swipe, all with the one paw', [swipe(), { ms: 90, ...swipe({ frontArm: straight(36), lean: 24, trail: { from: 'frontHand', reach: CLAW, curve: -22 } }) }, { ms: 90, ...swipe({ frontArm: straight(-16), lean: 8 }) }]),
  scared(3, 'Mane Shake', 'Shakes his mane and swipes as he comes round', [
    { pelvis: { x: 0, y: 16 }, lean: 6, tilt: 20, frontArm: straight(0), backArm: straight(170), frontLeg: { x: 10, y: F }, backLeg: { x: -10, y: F }, spin: true, trail: { from: 'frontHand', reach: CLAW, curve: 30 } },
    { ms: 110, ...swipe({ frontArm: straight(-10), lean: 20 }) },
  ]),
  scared(3, 'Leaping Swipe', 'Jumps and rakes a paw down through them', [leap({ frontArm: straight(30), trail: { from: 'frontHand', reach: CLAW, curve: 24 } }), ready(180)]),

  // ================= Tier 4: the paw comes down, and he fights properly =================
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
  combo(5, 'Courage', 'Pounce, swipe, then a roaring double-biceps flex', [leap(), { ms: 100, ...rearSwipe() }, flex(180)]),
  combo(5, 'Lionheart', 'Swipe, swipe, swipe, then he flexes and roars', [swipe(), { ms: 90, ...rearSwipe() }, { ms: 90, ...swipe({ frontArm: straight(-12) }) }, flex(180)]),
  combo(5, 'King of the Forest', 'Spins, mauls, and flexes like the king he is', [
    { pelvis: { x: 0, y: 16 }, lean: 0, frontArm: straight(4), backArm: straight(186), frontLeg: { x: 8, y: F }, backLeg: { x: -8, y: F }, spin: true, trail: { from: 'frontHand', reach: CLAW, curve: 30 } },
    { ms: 100, pelvis: { x: 2, y: 34 }, lean: 30, frontArm: straight(44), backArm: straight(50), frontLeg: { x: 28, y: F }, backLeg: { x: -20, y: F }, trail: { from: 'frontHand', reach: CLAW, curve: 20 } },
    flex(180),
  ]),
];
