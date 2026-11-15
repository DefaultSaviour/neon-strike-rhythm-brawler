import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { armReaching, buildFighterPose, buildKey, comboMove, FighterSpec, handOf, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE BRIDE: the vengeful swordswoman of the 2000s revenge epics: a bright
 * yellow jumpsuit with a black stripe, a long blonde ponytail, and a katana
 * (drawn by fighterArt on every pose). Every attack is a two-handed sword
 * strike: both hands on the hilt for quick draws, clean cuts and thrusts,
 * spins, and a whirlwind finisher.
 *
 * Built the round-one way: each move is ONE clear idea in a few big poses,
 * every hit is held for a beat (withHolds), and the hips stay near the
 * centre. 25 combos over the 5 tiers (5, 5, 8, 4, 3); the first keyframe is
 * the hit. Sword hits trail from the lead hand out to the blade's tip.
 * Tier 4 is her twist: nothing but the quick draw. The sword stays at her
 * hip, every hit is one cut drawn out of it with one hand, and it goes
 * straight back.
 *
 * Angles: 0 deg = toward the enemy, 90 = down, -90 = up, 180 = back. Feet
 * planted on the floor are at y = 68.
 */

const TRAIL = '#ffe14f'; // jumpsuit yellow
const F = FLOOR;
/** How far a sword hit reaches past her hand: out to the tip of the blade. */
const TIP = 40;

const straight = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
/** Both hands on the hilt in front of her, blade raised forward (the guard). */
const hiltFront: LimbAngles = { upper: 40, lower: -30 };
const hiltBack: LimbAngles = { upper: 50, lower: -22 };
/** The rear arm before it is set onto the hilt (see twoHanded). */
const freeBack: LimbAngles = { upper: 160, lower: 170 };
/** The sword raised high over her head, ready to cut down. */
const swordHigh: LimbAngles = { upper: -80, lower: -120 };
const kick = (deg: number): LimbAngles => ({ upper: deg, lower: deg });

/** A long, low fencing stance. */
const stance = { pelvis: { x: 0, y: 16 }, frontLeg: { x: 26, y: F }, backLeg: { x: -22, y: F } };
/** Lunging in behind a cut. */
const lunge = { pelvis: { x: 8, y: 22 }, frontLeg: { x: 36, y: F }, backLeg: { x: -18, y: F } };
/** Crouched low to cut at the legs. */
const low = { pelvis: { x: 4, y: 34 }, frontLeg: { x: 30, y: F }, backLeg: { x: -20, y: F } };
/** Up in the air, knees tucked. */
const airborne = { pelvis: { x: 2, y: -2 }, frontLeg: { upper: 40, lower: 120 }, backLeg: { upper: 70, lower: 150 } };

/** A keyframe; `oneHand` keeps the rear arm as given (sheathing the blade). */
type Key = FighterSpec & { ms?: number; oneHand?: boolean };

/** How far behind her lead hand the rear hand grips the hilt. */
const GRIP = 7;

/** Put the rear hand on the hilt just behind the lead hand, elbow hanging down. */
function twoHanded(k: Key): Key {
  if (k.oneHand) return k;
  const hand = handOf(k, 'front');
  const a = ((typeof k.frontArm.lower === 'number' ? k.frontArm.lower : 0) * Math.PI) / 180;
  const target = { x: hand.x - Math.cos(a) * GRIP, y: hand.y - Math.sin(a) * GRIP };
  const options = [armReaching(k, 'back', target), armReaching(k, 'back', target, true)];
  // Of the two ways the elbow can bend, keep the one that hangs lower
  const lower = (l: LimbAngles) => Math.sin((l.upper * Math.PI) / 180);
  return { ...k, backArm: lower(options[0]) >= lower(options[1]) ? options[0] : options[1] };
}

/**
 * How far every pose is moved back from the enemy: the katana adds a long
 * reach, so she stands further back than the bare-handed heroes. Her hips
 * stay within 12 of the centre (they run from -12 to -2).
 */
const STAND_BACK = 12;

/** Move a whole pose back, planted feet included (limbs given as angles move with the hips). */
function standBack(k: Key): Key {
  const shift = <T,>(leg: T): T => (leg && typeof leg === 'object' && 'x' in (leg as object) ? ({ ...(leg as object), x: (leg as unknown as { x: number }).x - STAND_BACK } as T) : leg);
  return { ...k, pelvis: { ...k.pelvis, x: k.pelvis.x - STAND_BACK }, frontLeg: shift(k.frontLeg), backLeg: shift(k.backLeg) };
}

let nextId = 1101;
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[]): AttackMove {
  return comboMove(nextId++, tier, name, description, withHolds(keys.map(standBack).map(twoHanded).map((k) => buildKey(k, TRAIL, k.ms ?? 0))));
}

/** The guard: long stance, both hands on the hilt, the blade angled up at them. */
export const BRIDE_IDLE: SkeletonPose = buildFighterPose(twoHanded(standBack({ ...stance, lean: 6, frontArm: hiltFront, backArm: hiltBack })), TRAIL);

/** Back on guard. */
const guard = (ms: number, extra: Partial<Key> = {}): Key => ({ ms, ...stance, lean: 6, frontArm: hiltFront, backArm: hiltBack, ...extra });
/** A flat cut across, the blade sweeping round at chest height. */
const flatCut = (extra: Partial<Key> = {}): Key => ({ ...lunge, lean: 16, frontArm: straight(0), backArm: freeBack, trail: { from: 'frontHand', reach: TIP, curve: 26 }, ...extra });
/** A cut straight down from overhead. */
const downCut = (extra: Partial<Key> = {}): Key => ({ ...lunge, lean: 20, frontArm: straight(28), backArm: { upper: 40, lower: 20 }, trail: { from: 'frontHand', reach: TIP, curve: 24 }, ...extra });
/** A rising cut, low to high. */
const risingCut = (extra: Partial<Key> = {}): Key => ({ ...stance, lean: 4, tilt: -8, frontArm: { upper: -36, lower: -48 }, backArm: freeBack, trail: { from: 'frontHand', reach: TIP, curve: -22 }, ...extra });
/** The thrust: the point driven straight at them. */
const thrust = (extra: Partial<Key> = {}): Key => ({ ...lunge, lean: 22, frontArm: straight(-2), backArm: freeBack, trail: { from: 'frontHand', reach: TIP }, ...extra });
/** A spin with the blade held out: the cut comes round as she turns. */
const spinCut = (extra: Partial<Key> = {}): Key => ({ pelvis: { x: 0, y: 14 }, lean: 0, frontArm: straight(4), backArm: straight(186), frontLeg: { x: 8, y: F }, backLeg: { x: -8, y: F }, spin: true, trail: { from: 'frontHand', reach: TIP, curve: 30 }, ...extra });

/**
 * The sword at her hip, as if sheathed: crouched a little, the lead hand
 * across her body on the hilt with the blade pointing down and back behind
 * her (well below the rear timing circle), the rear hand at the same hip
 * where the scabbard would be.
 */
const sheathed = (ms: number): Key => ({ ms, pelvis: { x: 0, y: 20 }, lean: 10, tilt: -6, frontArm: { upper: 100, lower: 130 }, backArm: { upper: 96, lower: 150 }, frontLeg: { x: 24, y: F }, backLeg: { x: -22, y: F }, oneHand: true });
/** The rear hand stays back at her hip while the lead hand cuts alone. */
const atHip: LimbAngles = { upper: 110, lower: 150 };

/** Tier 4 between draws: the sword at her hip. */
export const BRIDE_SHEATHED: SkeletonPose = buildFighterPose(twoHanded(standBack(sheathed(0))), TRAIL);

/** One quick draw: a single one-handed cut out of the sheath, and the blade goes straight back. */
function quickDraw(name: string, description: string, cut: Key): AttackMove {
  return { ...combo(4, name, description, [{ ...cut, backArm: atHip, oneHand: true }, sheathed(170)]), restPose: BRIDE_SHEATHED };
}

export const BRIDE_MOVES: AttackMove[] = [
  // ======================= Tier 1: the blade =======================
  combo(1, 'Quick Draw', 'The blade comes out of nowhere in one flat cut', [flatCut(), guard(150)]),
  combo(1, 'Rising Cut', 'Cuts upward from low to high', [risingCut(), guard(150)]),
  combo(1, 'Overhead Cut', 'Raises the sword and brings it straight down', [downCut(), guard(150)]),
  combo(1, 'Thrust', 'Lunges and drives the point straight in', [thrust(), guard(150)]),
  combo(1, 'Diagonal Cut', 'A slanting cut from the shoulder down across them', [
    { ...lunge, lean: 18, tilt: -6, frontArm: straight(14), backArm: freeBack, trail: { from: 'frontHand', reach: TIP, curve: 20 } },
    guard(150),
  ]),

  // ================= Tier 2: the duel =================
  combo(2, 'Two-Handed Cut', 'Both hands on the hilt for a heavy cut down', [
    { ...lunge, lean: 22, frontArm: straight(24), backArm: { upper: 30, lower: 14 }, trail: { from: 'frontHand', reach: TIP, curve: 24 } },
    guard(170),
  ]),
  combo(2, 'Spin Cut', 'Spins on the spot and cuts as she comes round', [spinCut(), guard(170)]),
  combo(2, 'Low Cut', 'Drops low and sweeps the blade across their legs', [
    { ...low, lean: 26, frontArm: straight(36), backArm: freeBack, trail: { from: 'frontHand', reach: TIP, curve: 22 } },
    guard(170),
  ]),
  combo(2, 'Cross Cut', 'Two cuts that cross: down one way, then back up', [downCut(), { ms: 100, ...risingCut() }]),
  combo(2, 'Cut and Sheathe', 'One clean cut, then the blade slides home', [
    flatCut(),
    { ms: 180, ...stance, lean: 0, frontArm: { upper: 100, lower: 150 }, backArm: { upper: 80, lower: 160 }, oneHand: true },
  ]),

  // =================== Tier 3: the list ===================
  combo(3, 'Three Cuts', 'Across, down and back up, without stopping', [flatCut(), { ms: 90, ...downCut() }, { ms: 90, ...risingCut() }]),
  combo(3, 'Low and High', 'Cuts low across the legs, then high across the shoulders', [
    { ...low, lean: 26, frontArm: straight(36), backArm: freeBack, trail: { from: 'frontHand', reach: TIP, curve: 22 } },
    { ms: 110, ...flatCut({ frontArm: straight(-12) }) },
  ]),
  combo(3, 'Leaping Cut', 'Leaps in and cuts down from above', [
    { ...airborne, lean: 16, frontArm: straight(30), backArm: freeBack, trail: { from: 'frontHand', reach: TIP, curve: 24 } },
    guard(180),
  ]),
  combo(3, 'Blade Flourish', 'Spins the sword round, then thrusts', [spinCut(), { ms: 100, ...thrust() }]),

  // ============ Tier 3, continued: the showdown (these were tier 4 before the quick draw) ============
  combo(3, 'Lightning Draw', 'Draws and thrusts in a single flash', [
    thrust({ pelvis: { x: 10, y: 24 }, frontLeg: { x: 38, y: F } }),
    { ms: 160, ...stance, lean: 0, frontArm: { upper: 100, lower: 150 }, backArm: { upper: 80, lower: 160 }, oneHand: true },
  ]),
  combo(3, 'Flying Cut', 'Leaps through the air with the blade held out flat', [
    { ...airborne, lean: 10, frontArm: straight(0), backArm: freeBack, trail: { from: 'frontHand', reach: TIP, curve: 26 } },
    guard(190),
  ]),
  combo(3, 'Kneeling Cut', 'Drops to one knee, cuts low, then rises cutting high', [
    { pelvis: { x: 2, y: 36 }, lean: 18, frontArm: straight(30), backArm: freeBack, frontLeg: { x: 26, y: F }, backLeg: { upper: 100, lower: 180 }, trail: { from: 'frontHand', reach: TIP, curve: 22 } },
    { ms: 110, ...risingCut() },
  ]),
  combo(3, 'High Guard Strike', 'Sword raised high in both hands, then the cut falls', [
    downCut(),
    { ms: 160, ...stance, lean: 0, frontArm: swordHigh, backArm: { upper: -70, lower: -110 } },
  ]),

  // ================= Tier 4: nothing but the quick draw =================
  quickDraw('Draw Cut', 'The blade leaves her hip in one flat cut across them and is back before they fall', flatCut()),
  quickDraw('Rising Draw', 'Draws upward, the cut going from her hip to over her shoulder', risingCut()),
  quickDraw('Low Draw', 'Drops low and draws the blade across their legs', { ...low, lean: 26, frontArm: straight(36), backArm: freeBack, trail: { from: 'frontHand', reach: TIP, curve: 22 } }),
  quickDraw('Falling Draw', 'Draws up and over and lets the cut fall straight down', downCut()),

  // ================= Tier 5: revenge =================
  combo(5, 'Whirlwind', 'Spins twice with the blade out, a storm of steel, then holds the guard', [spinCut(), { ms: 100, ...spinCut() }, { ms: 110, ...flatCut() }]),
  combo(5, 'The List', 'Cut, cut, thrust: every name crossed off, then the blade is sheathed', [
    flatCut(),
    { ms: 90, ...downCut() },
    { ms: 100, ...thrust() },
    { ms: 160, ...stance, lean: 0, frontArm: { upper: 100, lower: 150 }, backArm: { upper: 80, lower: 160 }, oneHand: true },
  ]),
  combo(5, 'Final Duel', 'Raises the sword high, cuts down, and finishes with the thrust', [
    downCut(),
    { ms: 100, ...risingCut() },
    { ms: 110, ...thrust() },
  ]),
];
