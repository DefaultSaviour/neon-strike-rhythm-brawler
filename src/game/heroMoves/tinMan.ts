import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR, Point } from '../enemyMotion';
import { armReaching, buildFighterPose, buildKey, comboMove, FighterSpec, headOf, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE TIN MAN: the woodsman made of tin from the old fairy tale of the
 * yellow road (the books, not any film's costume or songs): a funnel hat,
 * a riveted tin face and chest, and a one-handed axe (drawn by fighterArt).
 * He fights stiff: straight arms and legs, jerky chops and swings, and an
 * oil can he squeaks his joints with. In tier 4 he has rusted solid: his
 * whole body is locked in his stance and only his forearms still swing,
 * from the elbow. His top-level form: he gets a heart, glowing in his chest.
 *
 * Built the round-one way: each move is ONE clear idea in a few big poses,
 * every hit is held for a beat (withHolds), and the hips stay near the
 * centre. 21 combos over the 5 tiers (5, 5, 4, 4, 3); the first keyframe is
 * the hit. Axe hits trail out to the axe head.
 *
 * Angles: 0 deg = toward the enemy, 90 = down, -90 = up, 180 = back. Feet
 * planted on the floor are at y = 68.
 */

const TRAIL = '#c9d6e3'; // polished tin
const F = FLOOR;
/** How far an axe hit reaches past his hand: out to the axe head. */
export const AXE_REACH = 30;

const straight = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
const kick = (deg: number): LimbAngles => ({ upper: deg, lower: deg });

/** Where his upper arms are locked when he's rusted (the same as his stance). */
const FRONT_UPPER = 20;
const BACK_UPPER = 100;
/** The stance: standing tall and stiff-legged, the axe raised in front. */
const stance = { pelvis: { x: 0, y: 8 }, frontLeg: { x: 14, y: F }, backLeg: { x: -14, y: F } };
const axeUp: LimbAngles = { upper: FRONT_UPPER, lower: -40 };
const rearDown: LimbAngles = { upper: BACK_UPPER, lower: 60 };
/** A stiff step in behind a hit. */
const step = { pelvis: { x: 6, y: 10 }, frontLeg: { x: 28, y: F }, backLeg: { x: -12, y: F } };
/** Standing on the back leg, the front leg kicking out straight. */
const onBackLeg = { pelvis: { x: -4, y: 6 }, backLeg: { x: -6, y: F } };

/** A keyframe; `oil` puts the oil can in his rear hand, aimed at his jaw. `heart`: rear hand over his heart. */
type Key = FighterSpec & { ms?: number; oil?: boolean; heart?: boolean };

/** The rear hand reaching to his jaw (oiling it) or to his chest (over his new heart). */
function rearTo(k: Key): Key {
  if (!k.oil && !k.heart) return k;
  const head = headOf(k);
  const lean = ((k.lean ?? 0) * Math.PI) / 180;
  const chest: Point = { x: k.pelvis.x + Math.sin(lean) * 30, y: k.pelvis.y - Math.cos(lean) * 30 };
  const target = k.oil ? { x: head.x + 6, y: head.y + 10 } : { x: chest.x + 5, y: chest.y + 4 };
  return { ...k, backArm: armReaching(k, 'back', target), ...(k.oil ? { prop: 'oilcan' as const } : {}) };
}

let nextId = 1401;
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[]): AttackMove {
  return comboMove(nextId++, tier, name, description, withHolds(keys.map(rearTo).map((k) => buildKey(k, TRAIL, k.ms ?? 0))));
}

/** Standing tall and stiff, the axe raised in front, the rear arm straight down. */
export const TIN_MAN_IDLE: SkeletonPose = buildFighterPose({ ...stance, lean: 4, frontArm: axeUp, backArm: rearDown }, TRAIL);

/** Back in his stance. */
const ready = (ms: number): Key => ({ ms, ...stance, lean: 4, frontArm: axeUp, backArm: rearDown });
/** A stiff chop down with the axe. */
const chop = (extra: Partial<Key> = {}): Key => ({ ...step, lean: 14, frontArm: straight(32), backArm: straight(110), trail: { from: 'frontHand', reach: AXE_REACH, curve: 24 }, ...extra });
/** A flat swing across. */
const swing = (extra: Partial<Key> = {}): Key => ({ ...step, lean: 10, frontArm: straight(0), backArm: straight(150), trail: { from: 'frontHand', reach: AXE_REACH, curve: 26 }, ...extra });
/** The rear fist punched straight out, the axe held low. */
const tinPunch = (extra: Partial<Key> = {}): Key => ({ ...step, lean: 12, frontArm: { upper: 70, lower: 20 }, backArm: straight(-2), trail: { from: 'backHand', reach: 16 }, ...extra });
/** A straight-legged kick. */
const clankKick = (deg = -6, extra: Partial<Key> = {}): Key => ({ ...onBackLeg, lean: -10, frontArm: axeUp, backArm: straight(130), frontLeg: kick(deg), trail: { from: 'frontFoot', reach: 14 }, ...extra });
/** The axe held high over his head, ready for the next chop. */
const raised = (ms: number): Key => ({ ms, ...stance, lean: -4, frontArm: straight(-80), backArm: rearDown });
/** Oiling his squeaky jaw. */
const oiling = (ms: number): Key => ({ ms, ...stance, lean: 0, tilt: -14, frontArm: { upper: 60, lower: 80 }, backArm: rearDown, oil: true });
/** A hand over his new heart (the finishers). */
const heartPose = (ms: number): Key => ({ ms, ...stance, pelvis: { x: 0, y: 6 }, lean: -4, tilt: -8, frontArm: { upper: -60, lower: -80 }, backArm: rearDown, heart: true });

/**
 * Rusted solid (tier 4): his body locked exactly in his stance, upper arms
 * and all; only his forearms move, from the elbow (`front` / `back` are the
 * forearm angles).
 */
const rusted = (front: number, back = rearDown.lower, extra: Partial<Key> = {}): Key => ({
  ...stance,
  lean: 4,
  frontArm: { upper: FRONT_UPPER, lower: front },
  backArm: { upper: BACK_UPPER, lower: back },
  ...extra,
});

export const TIN_MAN_MOVES: AttackMove[] = [
  // ======================= Tier 1: the woodsman =======================
  combo(1, 'Axe Chop', 'A stiff chop straight down with the axe', [chop(), ready(150)]),
  combo(1, 'Flat Swing', 'Swings the axe across, flat and jerky', [swing(), ready(150)]),
  combo(1, 'Tin Punch', 'A straight-armed punch: clang', [tinPunch(), ready(150)]),
  combo(1, 'Clank Kick', 'A straight-legged kick that clanks', [clankKick(), ready(150)]),
  combo(1, 'Handle Jab', 'Jabs the end of the axe straight at them', [swing({ frontArm: straight(-6), trail: { from: 'frontHand', reach: AXE_REACH } }), ready(150)]),

  // ================= Tier 2: the forest =================
  combo(2, 'Timber!', 'Chops down hard, then raises the axe for the next tree', [chop({ frontArm: straight(42), lean: 20 }), raised(170)]),
  combo(2, 'Double Chop', 'Chop, then chop again a little higher', [chop(), { ms: 100, ...chop({ frontArm: straight(14) }) }]),
  combo(2, 'Funnel Butt', 'Leads with his funnel hat, head first', [
    { ...step, lean: 30, frontArm: { upper: 70, lower: 30 }, backArm: straight(130), trail: { from: 'head', reach: 16 } },
    ready(170),
  ]),
  combo(2, 'Robot Turn', 'Turns stiffly on the spot, the axe out flat', [swing({ spin: true, pelvis: { x: 0, y: 8 }, frontLeg: { x: 8, y: F }, backLeg: { x: -8, y: F } }), ready(170)]),
  combo(2, 'Chop and Kick', 'Chops, then a straight-legged kick', [chop(), { ms: 100, ...clankKick(-10) }]),

  // =================== Tier 3: squeaky joints ===================
  combo(3, 'Oil Change', 'Chops, then gives his squeaky jaw a quick oil', [chop(), oiling(180)]),
  combo(3, 'Rivet Punches', 'Two straight punches, clang clang', [tinPunch(), { ms: 90, ...tinPunch({ backArm: straight(-12) }) }]),
  combo(3, 'Clank Stomp', 'Stamps down with a straight leg, then swings', [
    { ...onBackLeg, pelvis: { x: 0, y: 8 }, lean: 6, frontArm: axeUp, backArm: straight(120), frontLeg: kick(40), trail: { from: 'frontFoot', reach: 14 } },
    { ms: 100, ...swing() },
  ]),
  combo(3, 'Squeaky Swing', 'Swings so hard his joints squeak, then oils them', [swing({ frontArm: straight(-10) }), oiling(180)]),

  // ================= Tier 4: rusted solid =================
  // Every pose here is his stance; only the forearms swing
  combo(4, 'Rusty Chop', 'Rusted stiff: only his forearm still swings the axe down', [
    rusted(60, rearDown.lower, { trail: { from: 'frontHand', reach: AXE_REACH, curve: 22 } }),
    { ms: 160, ...rusted(-70) },
  ]),
  combo(4, 'Elbow Flick', 'Rusted stiff: flicks the rear forearm up into them', [
    rusted(axeUp.lower, -10, { trail: { from: 'backHand', reach: 14, curve: -16 } }),
    { ms: 160, ...rusted(axeUp.lower) },
  ]),
  combo(4, 'Creaky Sweep', 'Rusted stiff: the forearm creaks round in a flat sweep', [
    rusted(-2, rearDown.lower, { trail: { from: 'frontHand', reach: AXE_REACH, curve: 26 } }),
    { ms: 160, ...rusted(-80) },
  ]),
  combo(4, 'Seized Up', 'Rusted stiff: a forearm chop, then a rear forearm flick', [
    rusted(50, rearDown.lower, { trail: { from: 'frontHand', reach: AXE_REACH, curve: 22 } }),
    { ms: 110, ...rusted(-60, -10, { trail: { from: 'backHand', reach: 14, curve: -16 } }) },
  ]),

  // ================= Tier 5: the heart =================
  combo(5, 'Heartfelt', 'Chop, swing, then a hand over his new heart', [chop(), { ms: 100, ...swing() }, heartPose(180)]),
  combo(5, 'Tick Tock', 'Swings the axe back and forth like a clock, then the heart', [
    swing(),
    { ms: 100, ...swing({ frontArm: straight(-20), trail: { from: 'frontHand', reach: AXE_REACH, curve: -26 } }) },
    heartPose(180),
  ]),
  combo(5, 'Timberrr', 'Chop, kick, the biggest chop of all, and the heart', [chop(), { ms: 90, ...clankKick(-10) }, { ms: 100, ...chop({ frontArm: straight(44), lean: 22 }) }, heartPose(180)]),
];
