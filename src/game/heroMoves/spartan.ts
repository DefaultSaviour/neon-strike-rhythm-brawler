import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { buildFighterPose, buildKey, comboMove, FighterSpec, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE SPARTAN: the ancient hoplite from the stylised sword-and-sandal epics:
 * a bronze crested helmet, a red cape, a round bronze shield on his lead arm
 * and a spear in his rear hand (both drawn by fighterArt on every pose).
 * Spear thrusts over and under the shield, shield bashes, and the huge push
 * kick that sends them into the pit.
 *
 * Built the round-one way: each move is ONE clear idea in a few big poses,
 * every hit is held for a beat (withHolds), and the hips stay near the
 * centre. 21 combos over the 5 tiers (5, 5, 4, 4, 3); the first keyframe is
 * the hit. Spear hits trail from the rear hand far out past it, to the
 * spear's tip.
 *
 * Angles: 0 deg = toward the enemy, 90 = down, -90 = up, 180 = back. Feet
 * planted on the floor are at y = 68.
 */

const TRAIL = '#ffb347'; // bronze
const F = FLOOR;
/** How far a spear hit reaches past his hand: out to the spear's tip. */
const TIP = 34;

const straight = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
/** The shield held up in front of his chest. */
const shieldUp: LimbAngles = { upper: 60, lower: -20 };
/** The shield raised high, over his head (against arrows). */
const shieldHigh: LimbAngles = { upper: -10, lower: -70 };
/** The spear cocked over his shoulder, point forward, ready to thrust. */
const spearReady: LimbAngles = { upper: -150, lower: -5 };
/** The spear driven forward overhand. */
const overhand: LimbAngles = { upper: -10, lower: 6 };
/** The spear driven forward underhand, low. */
const underhand: LimbAngles = { upper: 70, lower: 8 };
const kick = (deg: number): LimbAngles => ({ upper: deg, lower: deg });

/** Wide and low, braced behind the shield. */
const braced = { pelvis: { x: 0, y: 18 }, frontLeg: { x: 24, y: F }, backLeg: { x: -24, y: F } };
/** Driving forward behind a thrust. */
const stepIn = { pelvis: { x: 8, y: 20 }, frontLeg: { x: 34, y: F }, backLeg: { x: -18, y: F } };
/** Down on one knee behind the shield. */
const kneel = { pelvis: { x: 0, y: 36 }, frontLeg: { x: 24, y: F }, backLeg: { upper: 100, lower: 180 } };
/** Standing on the back leg to kick. */
const onBackLeg = { pelvis: { x: -6, y: 10 }, backLeg: { x: -8, y: F } };
/** In the air, both knees tucked. */
const airborne = { pelvis: { x: 2, y: -2 }, frontLeg: { upper: 40, lower: 120 }, backLeg: { upper: 70, lower: 150 } };

type Key = FighterSpec & { ms?: number };

let nextId = 901;
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[], opts: { slam?: boolean } = {}): AttackMove {
  const move = comboMove(nextId++, tier, name, description, withHolds(keys.map((k) => buildKey(k, TRAIL, k.ms ?? 0))));
  return opts.slam ? { ...move, slam: true } : move;
}

/** Braced behind his shield, spear cocked over his shoulder. */
export const SPARTAN_IDLE: SkeletonPose = buildFighterPose({ ...braced, lean: 10, frontArm: shieldUp, backArm: spearReady }, TRAIL);

/** Back behind his shield. */
const ready = (ms: number, extra: Partial<Key> = {}): Key => ({ ms, ...braced, lean: 10, frontArm: shieldUp, backArm: spearReady, ...extra });
/** The overhand spear thrust over the top of the shield. */
const thrust = (extra: Partial<Key> = {}): Key => ({ ...stepIn, lean: 18, frontArm: shieldUp, backArm: overhand, trail: { from: 'backHand', reach: TIP }, ...extra });
/** The underhand spear thrust, low under the shield. */
const lowThrust = (extra: Partial<Key> = {}): Key => ({ ...stepIn, lean: 22, frontArm: shieldUp, backArm: underhand, trail: { from: 'backHand', reach: TIP }, ...extra });
/** The shield punched straight out. */
const bash = (extra: Partial<Key> = {}): Key => ({ ...stepIn, lean: 20, frontArm: straight(0), backArm: spearReady, trail: { from: 'frontHand', reach: 18 }, ...extra });
/** The push kick, straight into the chest. */
const pushKick = (extra: Partial<Key> = {}): Key => ({ ...onBackLeg, lean: -12, frontArm: { upper: 100, lower: 120 }, backArm: { upper: -120, lower: -100 }, frontLeg: kick(-2), trail: { from: 'frontFoot', reach: 20 }, ...extra });

export const SPARTAN_MOVES: AttackMove[] = [
  // ======================= Tier 1: the hoplite =======================
  combo(1, 'Spear Thrust', 'Drives the spear forward over the top of his shield', [thrust(), ready(150)]),
  combo(1, 'Shield Bash', 'Punches the whole bronze shield into them', [bash(), ready(150)]),
  combo(1, 'Low Thrust', 'Stabs low, under the rim of the shield', [lowThrust(), ready(150)]),
  combo(1, 'Shield Edge', 'Snaps the rim of the shield up under the chin', [
    { ...stepIn, lean: 14, frontArm: { upper: 40, lower: -70 }, backArm: spearReady, trail: { from: 'frontHand', reach: 16, curve: -16 } },
    ready(150),
  ]),
  combo(1, 'Push Kick', 'A flat-footed kick that shoves them back off the line', [pushKick(), ready(160)]),

  // ================= Tier 2: the shield wall =================
  combo(2, 'Thrust and Bash', 'Spear first, then the shield straight behind it', [thrust(), { ms: 100, ...bash() }]),
  combo(2, 'Shield Rush', 'Drops his shoulder behind the shield and charges', [
    { ...stepIn, pelvis: { x: 10, y: 24 }, lean: 34, frontArm: straight(10), backArm: { upper: 160, lower: 150 }, trail: { from: 'frontHand', reach: 20 } },
    ready(170),
  ]),
  combo(2, 'Kneeling Thrust', 'Drops to one knee behind the shield and spears upward', [
    { ...kneel, lean: 12, frontArm: shieldUp, backArm: { upper: 10, lower: -6 }, trail: { from: 'backHand', reach: TIP } },
    ready(180),
  ]),
  combo(2, 'Spear Sweep', 'Swings the spear round flat, shaft first', [
    { ...braced, lean: 14, tilt: -6, frontArm: shieldUp, backArm: { upper: 20, lower: 30 }, trail: { from: 'backHand', reach: 24, curve: 28 } },
    ready(160),
  ]),
  combo(2, 'Hold the Line', 'Shield up high, then a thrust from underneath it', [
    { ...braced, lean: 16, frontArm: shieldHigh, backArm: underhand, trail: { from: 'backHand', reach: TIP } },
    ready(170),
  ]),

  // =================== Tier 3: the phalanx ===================
  combo(3, 'Double Thrust', 'Two quick stabs, high then low', [thrust(), { ms: 90, ...lowThrust() }]),
  combo(3, 'Phalanx Push', 'Shield bash to break them, then the spear through the gap', [bash(), { ms: 100, ...thrust() }]),
  combo(3, 'Shield Uppercut', 'Rips the shield rim up, then follows with a thrust', [
    { ...stepIn, lean: 14, frontArm: { upper: 40, lower: -70 }, backArm: spearReady, trail: { from: 'frontHand', reach: 16, curve: -16 } },
    { ms: 100, ...thrust() },
  ]),
  combo(3, 'Bash and Kick', 'Shield bash, then a push kick to send them flying', [bash(), { ms: 110, ...pushKick() }]),

  // ================= Tier 4: the battle =================
  combo(4, 'Leaping Thrust', 'Leaps up and drives the spear down at them', [
    { ...airborne, lean: 10, frontArm: shieldUp, backArm: { upper: -40, lower: 30 }, trail: { from: 'backHand', reach: TIP } },
    ready(190),
  ]),
  combo(
    4,
    'Shield Slam',
    'Brings the shield crashing down edge first',
    [
      { ...braced, pelvis: { x: 4, y: 34 }, lean: 30, frontArm: straight(60), backArm: spearReady, trail: { from: 'frontHand', reach: 18, curve: 20 } },
      ready(190),
    ],
    { slam: true }
  ),
  combo(4, 'Spinning Bash', 'Spins right round and slams the shield into them', [
    { ...bash(), spin: true },
    ready(180),
  ]),
  combo(4, 'Arrow Storm', 'Raises the shield against the arrows, then strikes back', [
    { ...braced, lean: 6, frontArm: shieldHigh, backArm: overhand, trail: { from: 'backHand', reach: TIP } },
    { ms: 110, ...thrust() },
  ]),

  // ================= Tier 5: legendary =================
  combo(5, 'Into the Pit', 'One enormous push kick that sends them back into the pit', [pushKick({ lean: -16, trail: { from: 'frontFoot', reach: 26 } }), ready(260)], { slam: true }),
  combo(5, 'Last Stand', 'Thrust, bash, and the kick: everything the shield wall has', [thrust(), { ms: 90, ...bash() }, { ms: 110, ...pushKick() }]),
  combo(
    5,
    'Hot Gates',
    'Holds the narrow pass: a leaping thrust, then down behind the shield',
    [
      { ...airborne, lean: 10, frontArm: shieldUp, backArm: { upper: -40, lower: 30 }, trail: { from: 'backHand', reach: TIP } },
      { ms: 130, ...kneel, lean: 12, frontArm: shieldUp, backArm: { upper: 10, lower: -6 }, trail: { from: 'backHand', reach: TIP } },
      ready(220),
    ],
    { slam: true }
  ),
];
