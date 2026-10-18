import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR, LIMB } from '../enemyMotion';
import { buildFighterPose, buildKey, FighterSpec, keyToPlayerPose, LimbAngles } from './poseBuilder';

/**
 * BABA YAGA: a gun-fu assassin in a black suit, in the spirit of the
 * modern action-thriller hitman. Close-quarters shooting mixed with judo
 * throws, elbows and kicks. Physical only: muzzle flashes and bullet
 * streaks, no magic.
 *
 * Same pattern as the Little Dragon (see littleDragon.ts): 21 combos over
 * the 5 tiers (5, 5, 4, 4, 3), the first keyframe is the hit. Keys marked
 * `shot` fire the gun: their trail is drawn as the bullet streak and a
 * muzzle flash pops at the gun hand (fighterArt.ts).
 *
 * Angles: 0 deg = toward the enemy, 90 = down, -90 = up, 180 = back. Feet
 * planted on the floor are at y = 68.
 */

const TRAIL = '#ff2a3d'; // a hot red tracer
const F = FLOOR;

/** Rear hand guarding the chin. */
const guard: LimbAngles = { upper: 110, lower: -65 };
/** Lead arm aimed straight out at an angle (- is higher). */
const straight = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
/** Gun hand drawn back by the ribs, muzzle forward (the centre-axis relock). */
const relock: LimbAngles = { upper: 75, lower: -15 };
/** Arms flung back for balance. */
const armsBack: LimbAngles = { upper: 150, lower: 130 };
/** A leg tucked up under the body in the air. */
const tucked: LimbAngles = { upper: 70, lower: 150 };

/** The usual planted feet: narrow, square, ready to turn. */
const stanceLegs = { frontLeg: { x: 16, y: F }, backLeg: { x: -14, y: F } };

/** A bullet streak from a hand: long and dead straight. */
const bullet = (from: 'frontHand' | 'backHand' = 'frontHand', reach = 46) => ({
  trail: { from, reach, curve: 0 },
  shot: from === 'backHand' ? ('rear' as const) : ('lead' as const),
});

type Key = FighterSpec & {
  ms?: number;
  /** Rear hand grips the gun too (two-handed pistol or shotgun) */
  support?: boolean;
};

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Angles for the rear arm so its hand lands on the gun just behind the lead
 * hand (further back for the shotgun's long body). Same skeleton maths as
 * poseBuilder: chest 30 above the pelvis along the lean, shoulders 3 apart.
 */
function supportArm(k: Key): LimbAngles {
  const lean = rad(k.lean ?? 0);
  const chest = { x: k.pelvis.x + Math.sin(lean) * 30, y: k.pelvis.y - Math.cos(lean) * 30 };
  const fs = { x: chest.x + 3, y: chest.y + 1 };
  const bs = { x: chest.x - 3, y: chest.y + 1 };
  const u = rad(k.frontArm.upper);
  const l = rad(k.frontArm.lower);
  const hand = { x: fs.x + Math.cos(u) * LIMB.upperArm + Math.cos(l) * LIMB.forearm, y: fs.y + Math.sin(u) * LIMB.upperArm + Math.sin(l) * LIMB.forearm };
  const gap = k.prop === 'shotgun' ? 15 : 4;
  const target = { x: hand.x - Math.cos(l) * gap, y: hand.y - Math.sin(l) * gap };
  const reach = LIMB.upperArm + LIMB.forearm;
  const d = Math.min(reach - 0.5, Math.max(4, Math.hypot(target.x - bs.x, target.y - bs.y)));
  const toward = Math.atan2(target.y - bs.y, target.x - bs.x);
  const bend = Math.acos(d / reach);
  // Elbow tucked down under the gun
  return { upper: deg(toward + bend), lower: deg(toward - bend) };
}

let nextId = 201;
/** A move made of keyframes: the first one is the hit, then the follow-ups. Guns stay in hand throughout. */
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[]): AttackMove {
  const sequence = keys.map((k) => {
    const spec: Key = { prop: 'pistol', ...k };
    if (spec.support) spec.backArm = supportArm(spec);
    return buildKey(spec, TRAIL, k.ms ?? 0);
  });
  const durationMs = 50 + sequence.slice(1).reduce((s, k) => s + k.ms, 0) + 140;
  return { id: nextId++, tier, name, description, durationMs, pose: keyToPlayerPose(sequence[0]), sequence };
}

/** Compact two-handed gun stance, the pistol held close at the chest. */
const IDLE_SPEC: Key = {
  pelvis: { x: 0, y: 10 },
  lean: 6,
  frontArm: { upper: 70, lower: -30 },
  backArm: guard,
  frontLeg: { x: 14, y: F },
  backLeg: { x: -16, y: F },
  prop: 'pistol',
  support: true,
};
export const BABA_YAGA_IDLE: SkeletonPose = buildFighterPose({ ...IDLE_SPEC, backArm: supportArm(IDLE_SPEC) }, TRAIL);

/** Two-handed aim at an angle, on planted feet. */
const aimed = (aim: number, extra: Partial<Key> = {}): Key => ({
  pelvis: { x: 2, y: 10 },
  lean: 8,
  frontArm: straight(aim),
  backArm: guard,
  ...stanceLegs,
  support: true,
  ...extra,
});
/** The kick of the gun after a shot: hands up, weight back. */
const recoil = (aim: number, extra: Partial<Key> = {}): Key => aimed(aim - 14, { pelvis: { x: 0, y: 10 }, lean: 2, ...extra });

export const BABA_YAGA_MOVES: AttackMove[] = [
  // ======================= Tier 1: close-quarters basics =======================
  combo(1, 'Double Tap', 'Two fast shots, two-handed, the gun barely moving between them', [
    { ...aimed(0), ...bullet() },
    { ...recoil(0), ms: 60 },
    { ...aimed(-2), ms: 55, ...bullet() },
  ]),
  combo(1, 'Pistol Whip', 'Cracks the gun across the jaw, then backhands it back the other way', [
    { pelvis: { x: 4, y: 11 }, lean: 14, frontArm: { upper: -40, lower: 30 }, backArm: guard, ...stanceLegs, trail: { from: 'frontHand', reach: 14, curve: 14 } },
    { ms: 90, pelvis: { x: 3, y: 11 }, lean: 8, tilt: 6, frontArm: { upper: 10, lower: -50 }, backArm: guard, ...stanceLegs, trail: { from: 'frontHand', reach: 12, curve: -12 } },
  ]),
  combo(1, 'Elbow-Shot', 'A short elbow to the face, then the arm unfolds into a point-blank shot', [
    { pelvis: { x: 4, y: 12 }, lean: 14, frontArm: { upper: 0, lower: 175 }, backArm: guard, ...stanceLegs, trail: { from: 'frontElbow', reach: 12, curve: 8 } },
    { ms: 80, pelvis: { x: 4, y: 11 }, lean: 10, frontArm: straight(4), backArm: guard, ...stanceLegs, ...bullet('frontHand', 36) },
  ]),
  combo(1, 'Knee and Shoot', 'A knee to the gut, then two shots down into the doubled-over target', [
    { pelvis: { x: 4, y: 6 }, lean: 10, frontArm: relock, backArm: { upper: 20, lower: 60 }, frontLeg: { upper: -40, lower: 90 }, backLeg: { x: -10, y: F }, trail: { from: 'frontKnee', reach: 14, curve: -6 } },
    { ms: 90, ...aimed(22, { pelvis: { x: 4, y: 12 }, lean: 12 }), ...bullet() },
    { ms: 60, ...aimed(26, { pelvis: { x: 4, y: 12 }, lean: 12 }), ...bullet() },
  ]),
  combo(1, 'Quick Draw', 'From the hip, three shots before the target can blink', [
    { pelvis: { x: 0, y: 10 }, lean: 0, frontArm: { upper: 60, lower: 0 }, backArm: guard, ...stanceLegs, ...bullet() },
    { ms: 50, pelvis: { x: 0, y: 10 }, lean: 2, frontArm: { upper: 45, lower: -4 }, backArm: guard, ...stanceLegs, ...bullet() },
    { ms: 50, ...aimed(-2), ...bullet() },
  ]),

  // ================= Tier 2: gun-fu (grapples mixed with shots) =================
  combo(2, 'Judo Throw Shot', 'Hip-throws the attacker over, then fires down at them on the floor', [
    { pelvis: { x: 2, y: 16 }, lean: 36, frontArm: { upper: 30, lower: -70 }, backArm: { upper: 10, lower: 40 }, frontLeg: { x: 18, y: F }, backLeg: { x: -12, y: F }, trail: { from: 'frontHand', reach: 18, curve: 22 } },
    { ms: 110, ...aimed(48, { pelvis: { x: 4, y: 22 }, lean: 16, frontLeg: { x: 20, y: F }, backLeg: { x: -16, y: F } }), ...bullet('frontHand', 34) },
    { ms: 70, ...aimed(52, { pelvis: { x: 4, y: 22 }, lean: 16, frontLeg: { x: 20, y: F }, backLeg: { x: -16, y: F } }), ...bullet('frontHand', 34) },
  ]),
  combo(2, 'Arm Lock Triple Tap', 'Traps the arm with the rear hand and fires three shots under it', [
    { pelvis: { x: 4, y: 11 }, lean: 12, frontArm: relock, backArm: straight(-6), ...stanceLegs, trail: { from: 'backHand', reach: 12, curve: 8 } },
    { ms: 60, pelvis: { x: 4, y: 11 }, lean: 12, frontArm: straight(6), backArm: straight(-8), ...stanceLegs, ...bullet() },
    { ms: 55, pelvis: { x: 4, y: 11 }, lean: 12, frontArm: straight(2), backArm: straight(-8), ...stanceLegs, ...bullet() },
    { ms: 55, pelvis: { x: 4, y: 11 }, lean: 12, frontArm: straight(8), backArm: straight(-8), ...stanceLegs, ...bullet() },
  ]),
  combo(2, 'Reload Kick', 'A front kick while the empty mag drops, slaps in a new one and fires', [
    { pelvis: { x: 0, y: 8 }, lean: -14, frontArm: { upper: -60, lower: -110 }, backArm: guard, frontLeg: straight(-4), backLeg: { x: -10, y: F }, trail: { from: 'frontFoot', reach: 16 } },
    { ms: 90, pelvis: { x: 2, y: 10 }, lean: 4, frontArm: relock, backArm: { upper: 60, lower: -40 }, ...stanceLegs },
    { ms: 80, ...aimed(0), ...bullet() },
  ]),
  combo(2, 'Headshot Pivot', 'A spinning gun-butt to the temple, then he pivots and aims high', [
    { pelvis: { x: 3, y: 11 }, lean: 6, tilt: -6, frontArm: { upper: -35, lower: 15 }, backArm: guard, ...stanceLegs, trail: { from: 'frontHand', reach: 12, curve: -10 } },
    { ms: 100, ...aimed(-12, { pelvis: { x: -2, y: 10 }, tilt: 6 }), ...bullet('frontHand', 50) },
  ]),
  combo(2, 'Dual Pistols', 'A gun in each hand, firing left-right-left-right', [
    { pelvis: { x: 2, y: 10 }, lean: 8, frontArm: straight(-2), backArm: { upper: 30, lower: 20 }, ...stanceLegs, prop: 'pistols', ...bullet() },
    { ms: 55, pelvis: { x: 2, y: 10 }, lean: 8, frontArm: { upper: 20, lower: 10 }, backArm: straight(4), ...stanceLegs, prop: 'pistols', ...bullet('backHand') },
    { ms: 55, pelvis: { x: 2, y: 10 }, lean: 8, frontArm: straight(-4), backArm: { upper: 30, lower: 20 }, ...stanceLegs, prop: 'pistols', ...bullet() },
    { ms: 55, pelvis: { x: 2, y: 10 }, lean: 8, frontArm: { upper: 20, lower: 10 }, backArm: straight(2), ...stanceLegs, prop: 'pistols', ...bullet('backHand') },
  ]),

  // =================== Tier 3: heavy hitters ===================
  combo(3, 'Shotgun Blast', 'One booming shotgun blast that rocks him back a step', [
    { ...aimed(0, { prop: 'shotgun' }), ...bullet('frontHand', 40) },
    { ms: 120, ...aimed(-20, { prop: 'shotgun', pelvis: { x: -8, y: 10 }, lean: -10, frontLeg: { x: 10, y: F }, backLeg: { x: -22, y: F } }) },
    { ms: 120, ...aimed(0, { prop: 'shotgun', pelvis: { x: -6, y: 11 } }) },
  ]),
  combo(3, 'Slide Shot', 'Drops into a knee slide along the floor, firing all the way', [
    { pelvis: { x: 8, y: 44 }, lean: -24, frontArm: straight(-6), backArm: guard, frontLeg: straight(10), backLeg: { upper: 100, lower: 170 }, support: true, ...bullet() },
    { ms: 70, pelvis: { x: 14, y: 45 }, lean: -24, frontArm: straight(-4), backArm: guard, frontLeg: straight(8), backLeg: { upper: 100, lower: 170 }, support: true, ...bullet() },
    { ms: 70, pelvis: { x: 18, y: 45 }, lean: -22, frontArm: straight(-8), backArm: guard, frontLeg: straight(8), backLeg: { upper: 100, lower: 170 }, support: true, ...bullet() },
  ]),
  combo(3, 'Pencil Strike', 'No bullets left: a pencil, stabbed in three times', [
    { pelvis: { x: 4, y: 12 }, lean: 14, frontArm: straight(4), backArm: straight(-10), ...stanceLegs, prop: 'pencil', trail: { from: 'frontHand', reach: 12 } },
    { ms: 70, pelvis: { x: 4, y: 12 }, lean: 12, frontArm: { upper: -60, lower: -20 }, backArm: straight(-10), ...stanceLegs, prop: 'pencil' },
    { ms: 70, pelvis: { x: 5, y: 13 }, lean: 18, frontArm: { upper: -10, lower: 50 }, backArm: straight(-8), ...stanceLegs, prop: 'pencil', trail: { from: 'frontHand', reach: 12, curve: 12 } },
    { ms: 70, pelvis: { x: 5, y: 12 }, lean: 16, frontArm: straight(8), backArm: guard, ...stanceLegs, prop: 'pencil', trail: { from: 'frontHand', reach: 14 } },
  ]),
  combo(3, 'Wall Run Shot', 'Runs up the wall sideways, firing three shots down, then lands', [
    { pelvis: { x: 0, y: -14 }, lean: -28, frontArm: straight(18), backArm: armsBack, frontLeg: { upper: 20, lower: 100 }, backLeg: tucked, ...bullet() },
    { ms: 60, pelvis: { x: 4, y: -18 }, lean: -32, frontArm: straight(22), backArm: armsBack, frontLeg: tucked, backLeg: { upper: 20, lower: 100 }, ...bullet() },
    { ms: 60, pelvis: { x: 8, y: -16 }, lean: -30, frontArm: straight(26), backArm: armsBack, frontLeg: { upper: 20, lower: 100 }, backLeg: tucked, ...bullet() },
    { ms: 120, pelvis: { x: 10, y: 22 }, lean: 12, frontArm: relock, backArm: guard, frontLeg: { x: 26, y: F }, backLeg: { x: -6, y: F } },
  ]),

  // ================= Tier 4: gun-kata =================
  combo(4, 'Gun-Kata Spin', 'Spins on the spot with two guns, a shot at every quarter turn', [
    { pelvis: { x: 2, y: 10 }, lean: 6, frontArm: straight(0), backArm: { upper: 120, lower: 100 }, ...stanceLegs, prop: 'pistols', ...bullet() },
    { ms: 60, pelvis: { x: 0, y: 10 }, lean: -6, tilt: 8, frontArm: { upper: 60, lower: 40 }, backArm: straight(180), ...stanceLegs, prop: 'pistols', ...bullet('backHand', 30) },
    { ms: 60, pelvis: { x: 0, y: 10 }, lean: 4, frontArm: straight(-50), backArm: { upper: 100, lower: 80 }, ...stanceLegs, prop: 'pistols', ...bullet('frontHand', 30) },
    { ms: 60, pelvis: { x: 2, y: 10 }, lean: 8, frontArm: { upper: 60, lower: 40 }, backArm: straight(2), ...stanceLegs, prop: 'pistols', ...bullet('backHand') },
  ]),
  combo(4, 'Grapple and Execute', 'Grabs the collar, knees twice, and finishes with two shots down', [
    { pelvis: { x: 4, y: 11 }, lean: 14, frontArm: relock, backArm: straight(-4), ...stanceLegs, trail: { from: 'backHand', reach: 12, curve: 8 } },
    { ms: 80, pelvis: { x: 5, y: 6 }, lean: 10, frontArm: relock, backArm: straight(10), frontLeg: { upper: -40, lower: 90 }, backLeg: { x: -10, y: F }, trail: { from: 'frontKnee', reach: 14 } },
    { ms: 80, pelvis: { x: 5, y: 6 }, lean: 10, frontArm: relock, backArm: straight(16), frontLeg: { upper: -36, lower: 92 }, backLeg: { x: -10, y: F }, trail: { from: 'frontKnee', reach: 14 } },
    { ms: 90, ...aimed(40, { pelvis: { x: 4, y: 16 }, lean: 14 }), ...bullet('frontHand', 34) },
    { ms: 60, ...aimed(44, { pelvis: { x: 4, y: 16 }, lean: 14 }), ...bullet('frontHand', 34) },
  ]),
  combo(4, 'Shotgun Pump Combo', 'Blast, pump, blast, pump, blast, walking forward', [
    { ...aimed(0, { prop: 'shotgun' }), ...bullet('frontHand', 40) },
    { ms: 90, ...aimed(-14, { prop: 'shotgun', pelvis: { x: 0, y: 10 }, lean: 0 }) },
    { ms: 70, ...aimed(0, { prop: 'shotgun', pelvis: { x: 6, y: 10 }, frontLeg: { x: 22, y: F } }), ...bullet('frontHand', 40) },
    { ms: 90, ...aimed(-14, { prop: 'shotgun', pelvis: { x: 4, y: 10 }, lean: 0, frontLeg: { x: 22, y: F } }) },
    { ms: 70, ...aimed(2, { prop: 'shotgun', pelvis: { x: 10, y: 10 }, frontLeg: { x: 28, y: F }, backLeg: { x: -6, y: F } }), ...bullet('frontHand', 40) },
  ]),
  combo(4, 'Rolling Fire', 'Fires as he dives into a forward roll, then comes up kneeling and shooting', [
    { pelvis: { x: 4, y: 36 }, lean: 50, frontArm: straight(10), backArm: armsBack, frontLeg: { x: 22, y: F }, backLeg: { x: -18, y: F }, ...bullet() },
    { ms: 120, pelvis: { x: 10, y: 40 }, lean: 80, frontArm: { upper: 20, lower: -110 }, backArm: { upper: 40, lower: -100 }, frontLeg: tucked, backLeg: tucked },
    { ms: 120, ...aimed(0, { pelvis: { x: 14, y: 40 }, lean: 2, frontLeg: { x: 30, y: F }, backLeg: { upper: 100, lower: 175 } }), ...bullet() },
    { ms: 60, ...aimed(-3, { pelvis: { x: 14, y: 40 }, lean: 2, frontLeg: { x: 30, y: F }, backLeg: { upper: 100, lower: 175 } }), ...bullet() },
  ]),

  // ================= Tier 5: legendary finishers =================
  combo(5, 'Excommunicado', 'Kick, gun-whip, double tap, hip throw, a shot to finish, then he holsters', [
    { pelvis: { x: 0, y: 8 }, lean: -14, frontArm: relock, backArm: guard, frontLeg: straight(-4), backLeg: { x: -10, y: F }, trail: { from: 'frontFoot', reach: 16 } },
    { ms: 70, pelvis: { x: 4, y: 11 }, lean: 14, frontArm: { upper: -40, lower: 30 }, backArm: guard, ...stanceLegs, trail: { from: 'frontHand', reach: 14, curve: 14 } },
    { ms: 60, ...aimed(0), ...bullet() },
    { ms: 55, ...aimed(-2), ...bullet() },
    { ms: 100, pelvis: { x: 2, y: 16 }, lean: 36, frontArm: { upper: 30, lower: -70 }, backArm: { upper: 10, lower: 40 }, frontLeg: { x: 18, y: F }, backLeg: { x: -12, y: F }, trail: { from: 'frontHand', reach: 18, curve: 22 } },
    { ms: 100, ...aimed(46, { pelvis: { x: 4, y: 20 }, lean: 16 }), ...bullet('frontHand', 34) },
    { ms: 160, pelvis: { x: 0, y: 9 }, lean: 0, frontArm: { upper: 85, lower: 95 }, backArm: { upper: 95, lower: 80 }, ...stanceLegs },
  ]),
  combo(5, 'Baba Yaga', 'Two guns fanning in a long spin, shot after shot', [
    { pelvis: { x: 2, y: 10 }, lean: 8, frontArm: straight(-2), backArm: { upper: 30, lower: 20 }, ...stanceLegs, prop: 'pistols', ...bullet() },
    { ms: 50, pelvis: { x: 2, y: 10 }, lean: 6, frontArm: { upper: 40, lower: 30 }, backArm: straight(4), ...stanceLegs, prop: 'pistols', ...bullet('backHand') },
    { ms: 55, pelvis: { x: 0, y: 10 }, lean: -4, tilt: 8, frontArm: { upper: 80, lower: 60 }, backArm: straight(180), ...stanceLegs, prop: 'pistols', ...bullet('backHand', 30) },
    { ms: 55, pelvis: { x: 0, y: 10 }, lean: -4, tilt: -8, frontArm: straight(176), backArm: { upper: 80, lower: 60 }, ...stanceLegs, prop: 'pistols', ...bullet('frontHand', 30) },
    { ms: 55, pelvis: { x: 2, y: 10 }, lean: 4, frontArm: straight(-30), backArm: { upper: 100, lower: 80 }, ...stanceLegs, prop: 'pistols', ...bullet('frontHand', 34) },
    { ms: 55, pelvis: { x: 2, y: 10 }, lean: 8, frontArm: straight(0), backArm: straight(6), ...stanceLegs, prop: 'pistols', ...bullet() },
    { ms: 50, pelvis: { x: 2, y: 10 }, lean: 8, frontArm: straight(-4), backArm: straight(2), ...stanceLegs, prop: 'pistols', ...bullet('backHand') },
  ]),
  combo(5, 'Last Bullet', 'One huge shot that throws his arms up, then he blows the smoke off the barrel', [
    { ...aimed(-2, { pelvis: { x: 2, y: 11 }, lean: 6 }), ...bullet('frontHand', 70) },
    { ms: 140, ...aimed(-42, { pelvis: { x: -6, y: 10 }, lean: -14, frontLeg: { x: 12, y: F }, backLeg: { x: -20, y: F } }) },
    { ms: 240, pelvis: { x: -4, y: 10 }, lean: 0, frontArm: { upper: 60, lower: -115 }, backArm: { upper: 95, lower: 80 }, frontLeg: { x: 12, y: F }, backLeg: { x: -20, y: F } },
  ]),
];
