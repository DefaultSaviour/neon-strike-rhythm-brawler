import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { buildFighterPose, buildKey, comboMove, FighterSpec, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE BRIDE: the vengeful swordswoman of the 2000s revenge epics: a bright
 * yellow jumpsuit with a black stripe, a long blonde ponytail, and a katana
 * in her lead hand (drawn by fighterArt on every pose). Quick draws, clean
 * cuts and thrusts, kicks, spins, and a whirlwind finisher.
 *
 * Built the round-one way: each move is ONE clear idea in a few big poses,
 * every hit is held for a beat (withHolds), and the hips stay near the
 * centre. 21 combos over the 5 tiers (5, 5, 4, 4, 3); the first keyframe is
 * the hit. Sword hits trail from the lead hand out to the blade's tip.
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
/** The free hand flung back for balance. */
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
/** Standing on the back leg to kick. */
const onBackLeg = { pelvis: { x: -4, y: 10 }, backLeg: { x: -6, y: F } };
/** Up in the air, knees tucked. */
const airborne = { pelvis: { x: 2, y: -2 }, frontLeg: { upper: 40, lower: 120 }, backLeg: { upper: 70, lower: 150 } };

type Key = FighterSpec & { ms?: number };

let nextId = 1101;
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[]): AttackMove {
  return comboMove(nextId++, tier, name, description, withHolds(keys.map((k) => buildKey(k, TRAIL, k.ms ?? 0))));
}

/** The guard: long stance, both hands on the hilt, the blade angled up at them. */
export const BRIDE_IDLE: SkeletonPose = buildFighterPose({ ...stance, lean: 6, frontArm: hiltFront, backArm: hiltBack }, TRAIL);

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
/** A front kick, the sword held back out of the way. */
const frontKick = (extra: Partial<Key> = {}): Key => ({ ...onBackLeg, lean: -12, frontArm: { upper: 130, lower: 160 }, backArm: freeBack, frontLeg: kick(-6), trail: { from: 'frontFoot', reach: 18 }, ...extra });

export const BRIDE_MOVES: AttackMove[] = [
  // ======================= Tier 1: the blade =======================
  combo(1, 'Quick Draw', 'The blade comes out of nowhere in one flat cut', [flatCut(), guard(150)]),
  combo(1, 'Rising Cut', 'Cuts upward from low to high', [risingCut(), guard(150)]),
  combo(1, 'Overhead Cut', 'Raises the sword and brings it straight down', [downCut(), guard(150)]),
  combo(1, 'Thrust', 'Lunges and drives the point straight in', [thrust(), guard(150)]),
  combo(1, 'Front Kick', 'Keeps the blade back and kicks them off it', [frontKick(), guard(150)]),

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
    { ms: 180, ...stance, lean: 0, frontArm: { upper: 100, lower: 150 }, backArm: { upper: 80, lower: 160 } },
  ]),

  // =================== Tier 3: the list ===================
  combo(3, 'Three Cuts', 'Across, down and back up, without stopping', [flatCut(), { ms: 90, ...downCut() }, { ms: 90, ...risingCut() }]),
  combo(3, 'Cut and Kick', 'A flat cut, then a kick to clear the space', [flatCut(), { ms: 110, ...frontKick() }]),
  combo(3, 'Leaping Cut', 'Leaps in and cuts down from above', [
    { ...airborne, lean: 16, frontArm: straight(30), backArm: freeBack, trail: { from: 'frontHand', reach: TIP, curve: 24 } },
    guard(180),
  ]),
  combo(3, 'Blade Flourish', 'Spins the sword round, then thrusts', [spinCut(), { ms: 100, ...thrust() }]),

  // ================= Tier 4: the showdown =================
  combo(4, 'Lightning Draw', 'Draws and thrusts in a single flash', [
    thrust({ pelvis: { x: 10, y: 24 }, frontLeg: { x: 38, y: F } }),
    { ms: 160, ...stance, lean: 0, frontArm: { upper: 100, lower: 150 }, backArm: { upper: 80, lower: 160 } },
  ]),
  combo(4, 'Flying Cut', 'Leaps through the air with the blade held out flat', [
    { ...airborne, lean: 10, frontArm: straight(0), backArm: freeBack, trail: { from: 'frontHand', reach: TIP, curve: 26 } },
    guard(190),
  ]),
  combo(4, 'Kneeling Cut', 'Drops to one knee, cuts low, then rises cutting high', [
    { pelvis: { x: 2, y: 36 }, lean: 18, frontArm: straight(30), backArm: freeBack, frontLeg: { x: 26, y: F }, backLeg: { upper: 100, lower: 180 }, trail: { from: 'frontHand', reach: TIP, curve: 22 } },
    { ms: 110, ...risingCut() },
  ]),
  combo(4, 'High Guard Strike', 'Sword raised high in both hands, then the cut falls', [
    downCut(),
    { ms: 160, ...stance, lean: 0, frontArm: swordHigh, backArm: { upper: -70, lower: -110 } },
  ]),

  // ================= Tier 5: revenge =================
  combo(5, 'Whirlwind', 'Spins twice with the blade out, a storm of steel, then holds the guard', [spinCut(), { ms: 100, ...spinCut() }, { ms: 110, ...flatCut() }]),
  combo(5, 'The List', 'Cut, cut, thrust: every name crossed off, then the blade is sheathed', [
    flatCut(),
    { ms: 90, ...downCut() },
    { ms: 100, ...thrust() },
    { ms: 160, ...stance, lean: 0, frontArm: { upper: 100, lower: 150 }, backArm: { upper: 80, lower: 160 } },
  ]),
  combo(5, 'Final Duel', 'Raises the sword high, cuts down, and finishes with the thrust', [
    downCut(),
    { ms: 100, ...risingCut() },
    { ms: 110, ...thrust() },
  ]),
];
