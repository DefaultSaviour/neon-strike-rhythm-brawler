import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { applyEdit } from '../heroPoses';
import { armReaching, buildFighterPose, buildKey, comboMove, FighterSpec, handOf, LimbAngles, withHolds } from './poseBuilder';
import { SAW_FACE_POSE_EDITS } from './sawFacePoses';

/**
 * SAW FACE: the masked slasher of the 1970s backwoods horror films: a
 * stitched-together mask, a shirt and tie under a grimy butcher's apron,
 * and a roaring chainsaw held in both hands (drawn by fighterArt on every
 * pose). Every attack is a chainsaw strike: thrusts, chops, sweeps and big
 * lumbering spins. His finishers (tier 5, his top-level form, with two
 * enemies hanging on meat hooks behind him) all end with the dance: the saw
 * held high overhead and whirled round. The designer drew the finishers'
 * poses in the Pose Studio (sawFacePoses.ts).
 *
 * Built the round-one way: each move is ONE clear idea in a few big poses,
 * every hit is held for a beat (withHolds), and the hips stay near the
 * centre. 21 combos over the 5 tiers (5, 5, 4, 4, 3); the first keyframe is
 * the hit. Saw hits trail from the lead hand out to the tip of the bar.
 *
 * Angles: 0 deg = toward the enemy, 90 = down, -90 = up, 180 = back. Feet
 * planted on the floor are at y = 68.
 */

const TRAIL = '#ff7a1a'; // chainsaw orange
const F = FLOOR;
/** How far a saw hit reaches past his hand: out to the tip of the bar. */
const TIP = 40;

const straight = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
/** The saw held low in front of him, the bar angled up at them (the guard). */
const sawLow: LimbAngles = { upper: 62, lower: -12 };
/** The rear arm before it is set onto the rear handle (see twoHanded). */
const freeBack: LimbAngles = { upper: 160, lower: 170 };

/** A wide, hunched stance: a big man, heavy on his feet. */
const stance = { pelvis: { x: 0, y: 18 }, frontLeg: { x: 24, y: F }, backLeg: { x: -22, y: F } };
/** Lunging in behind a thrust or a chop. */
const lunge = { pelvis: { x: 8, y: 22 }, frontLeg: { x: 34, y: F }, backLeg: { x: -18, y: F } };
/** Crouched low to sweep at the legs. */
const low = { pelvis: { x: 4, y: 34 }, frontLeg: { x: 30, y: F }, backLeg: { x: -20, y: F } };
/** Up in the air, knees tucked. */
const airborne = { pelvis: { x: 2, y: -2 }, frontLeg: { upper: 40, lower: 120 }, backLeg: { upper: 70, lower: 150 } };

type Key = FighterSpec & { ms?: number };

/** How far behind his lead hand (on the front handle) the rear hand grips the rear handle. */
const GRIP = 12;

/** Put the rear hand on the rear handle behind the lead hand, elbow hanging down. */
function twoHanded(k: Key): Key {
  const hand = handOf(k, 'front');
  const a = ((typeof k.frontArm.lower === 'number' ? k.frontArm.lower : 0) * Math.PI) / 180;
  const target = { x: hand.x - Math.cos(a) * GRIP, y: hand.y - Math.sin(a) * GRIP };
  const options = [armReaching(k, 'back', target), armReaching(k, 'back', target, true)];
  // Of the two ways the elbow can bend, keep the one that hangs lower
  const lower = (l: LimbAngles) => Math.sin((l.upper * Math.PI) / 180);
  return { ...k, backArm: lower(options[0]) >= lower(options[1]) ? options[0] : options[1] };
}

/**
 * How far every pose is moved back from the enemy: the chainsaw's bar adds
 * a long reach, so he stands further back than the bare-handed heroes. His
 * hips stay within 12 of the centre (they run from -12 to 0).
 */
const STAND_BACK = 10;

/** Move a whole pose back, planted feet included (limbs given as angles move with the hips). */
function standBack(k: Key): Key {
  const shift = <T,>(leg: T): T => (leg && typeof leg === 'object' && 'x' in (leg as object) ? ({ ...(leg as object), x: (leg as unknown as { x: number }).x - STAND_BACK } as T) : leg);
  return { ...k, pelvis: { ...k.pelvis, x: k.pelvis.x - STAND_BACK }, frontLeg: shift(k.frontLeg), backLeg: shift(k.backLeg) };
}

let nextId = 1201;
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[]): AttackMove {
  return comboMove(nextId++, tier, name, description, withHolds(keys.map(standBack).map(twoHanded).map((k) => buildKey(k, TRAIL, k.ms ?? 0))));
}

/** The guard: hunched in a wide stance, the saw held low in both hands, the bar angled up at them. */
export const SAW_FACE_IDLE: SkeletonPose = buildFighterPose(twoHanded(standBack({ ...stance, lean: 14, tilt: 6, frontArm: sawLow, backArm: freeBack })), TRAIL);

/** Back on guard. */
const guard = (ms: number): Key => ({ ms, ...stance, lean: 14, tilt: 6, frontArm: sawLow, backArm: freeBack });
/** The thrust: the running saw driven straight at them. */
const thrust = (extra: Partial<Key> = {}): Key => ({ ...lunge, lean: 20, frontArm: straight(-4), backArm: freeBack, trail: { from: 'frontHand', reach: TIP }, ...extra });
/** A chop straight down from overhead. */
const chop = (extra: Partial<Key> = {}): Key => ({ ...lunge, lean: 22, frontArm: straight(30), backArm: freeBack, trail: { from: 'frontHand', reach: TIP, curve: 24 }, ...extra });
/** A wide flat swing across at chest height. */
const swing = (extra: Partial<Key> = {}): Key => ({ ...lunge, lean: 16, frontArm: straight(2), backArm: freeBack, trail: { from: 'frontHand', reach: TIP, curve: 28 }, ...extra });
/** Ripping the saw upward, low to high. */
const rip = (extra: Partial<Key> = {}): Key => ({ ...stance, lean: 6, tilt: -8, frontArm: { upper: -34, lower: -46 }, backArm: freeBack, trail: { from: 'frontHand', reach: TIP, curve: -22 }, ...extra });
/** A sweep across their legs from a crouch. */
const sweep = (extra: Partial<Key> = {}): Key => ({ ...low, lean: 26, frontArm: straight(38), backArm: freeBack, trail: { from: 'frontHand', reach: TIP, curve: 22 }, ...extra });
/** A big lumbering turn with the saw held out: the swing comes round as he spins. */
const spinSwing = (extra: Partial<Key> = {}): Key => ({ pelvis: { x: 0, y: 16 }, lean: 2, frontArm: straight(6), backArm: freeBack, frontLeg: { x: 10, y: F }, backLeg: { x: -10, y: F }, spin: true, trail: { from: 'frontHand', reach: TIP, curve: 30 }, ...extra });

/**
 * The dance, the end of every finisher: standing tall, leaning back, the
 * saw held high overhead in both hands and whirled round. Two poses: the
 * saw straight up with one knee raised, then tipped forward with the other
 * leg kicked out behind. His arms reach up in front of his face, so the
 * engine never covers his mask.
 */
const danceUp = (ms: number): Key => ({ ms, pelvis: { x: 2, y: 12 }, lean: -8, tilt: -10, frontArm: { upper: -55, lower: -88 }, backArm: freeBack, frontLeg: { upper: 20, lower: 92 }, backLeg: { x: -6, y: F }, spin: true });
const danceBack = (ms: number): Key => ({ ms, pelvis: { x: -2, y: 12 }, lean: -14, tilt: -6, frontArm: { upper: -40, lower: -62 }, backArm: freeBack, frontLeg: { x: 10, y: F }, backLeg: { upper: 140, lower: 112 }, spin: true });

const BUILT_MOVES: AttackMove[] = [
  // ======================= Tier 1: the saw =======================
  combo(1, 'Rev and Thrust', 'Revs the saw and drives it straight in', [thrust(), guard(150)]),
  combo(1, 'Overhead Chop', 'Lifts the saw and brings it straight down', [chop(), guard(150)]),
  combo(1, 'Side Swipe', 'One wide, flat swing across them', [swing(), guard(150)]),
  combo(1, 'Ripper', 'Rips the saw upward from low to high', [rip(), guard(150)]),
  combo(1, 'Low Sweep', 'Crouches and sweeps the saw across their legs', [sweep(), guard(150)]),

  // ================= Tier 2: the chase =================
  combo(2, 'Lumbering Spin', 'Turns his whole body and the saw comes round with him', [spinSwing(), guard(170)]),
  combo(2, 'Hammer Down', 'A heavy chop that drives him down into a crouch', [
    { ...low, lean: 30, frontArm: straight(44), backArm: freeBack, trail: { from: 'frontHand', reach: TIP, curve: 24 } },
    guard(170),
  ]),
  combo(2, 'Back and Forth', 'Swings across one way, then straight back the other', [swing(), { ms: 100, ...swing({ lean: 10, frontArm: straight(-14), trail: { from: 'frontHand', reach: TIP, curve: -28 } }) }]),
  combo(2, 'Chop and Thrust', 'Chops down, then drives the point of the bar in', [chop(), { ms: 100, ...thrust() }]),
  combo(2, 'Grinding Push', 'Leans his whole weight into a long, grinding thrust', [
    thrust({ pelvis: { x: 10, y: 24 }, lean: 26, frontLeg: { x: 38, y: F } }),
    guard(170),
  ]),

  // =================== Tier 3: the hunt ===================
  combo(3, 'Three Swings', 'Across, down and back up, without stopping', [swing(), { ms: 90, ...chop() }, { ms: 90, ...rip() }]),
  combo(3, 'Low and High', 'Sweeps their legs, then swings high across the shoulders', [sweep(), { ms: 110, ...swing({ frontArm: straight(-12) }) }]),
  combo(3, 'Leaping Chop', 'Leaps in and chops down from above', [
    { ...airborne, lean: 16, frontArm: straight(32), backArm: freeBack, trail: { from: 'frontHand', reach: TIP, curve: 24 } },
    guard(180),
  ]),
  combo(3, 'Spin and Chop', 'Swings the saw round, then brings it down', [spinSwing(), { ms: 100, ...chop() }]),

  // ================= Tier 4: the slaughterhouse =================
  combo(4, 'Frenzy', 'Two wild thrusts, one high and one low', [thrust({ frontArm: straight(-14) }), { ms: 90, ...thrust({ frontArm: straight(14) }) }]),
  combo(4, 'Kneeling Rip', 'Drops to one knee, sweeps low, then rips the saw up', [
    { pelvis: { x: 2, y: 36 }, lean: 18, frontArm: straight(32), backArm: freeBack, frontLeg: { x: 26, y: F }, backLeg: { upper: 100, lower: 180 }, trail: { from: 'frontHand', reach: TIP, curve: 22 } },
    { ms: 110, ...rip() },
  ]),
  combo(4, 'Wild Spin', 'Spins twice with the saw held out', [spinSwing(), { ms: 100, ...spinSwing() }]),
  combo(4, 'Flying Swing', 'Leaps through the air with the saw held out flat', [
    { ...airborne, lean: 10, frontArm: straight(2), backArm: freeBack, trail: { from: 'frontHand', reach: TIP, curve: 26 } },
    guard(190),
  ]),

  // ================= Tier 5: the dance =================
  combo(5, 'Sunset Dance', 'One big swing, then the saw goes up overhead and he whirls it round', [swing(), danceUp(110), danceBack(160)]),
  combo(5, 'Dinner Time', 'Chop, thrust, then the dance with the saw held high', [chop(), { ms: 90, ...thrust() }, danceUp(110), danceBack(160)]),
  combo(5, 'Last Light', 'Swings the saw up high, cuts across, then dances with it overhead', [spinSwing(), { ms: 100, ...rip() }, danceBack(110), danceUp(160)]),
];

/** The moves, with the poses the designer drew in the Pose Studio (sawFacePoses.ts) in place of the built ones. */
export const SAW_FACE_MOVES: AttackMove[] = BUILT_MOVES.map((m) => (SAW_FACE_POSE_EDITS[m.name] ? applyEdit(m, SAW_FACE_POSE_EDITS[m.name]) : m));
