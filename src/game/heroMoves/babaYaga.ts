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

/** A bullet streak from a hand: long and dead straight. */
const bullet = (from: 'frontHand' | 'backHand' = 'frontHand', reach = 50) => ({
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

/** A wide, planted fighting base: the silhouette reads from across the screen. */
const wide = { frontLeg: { x: 24, y: F }, backLeg: { x: -22, y: F } };
/** A deep forward lunge. */
const lunge = { pelvis: { x: 8, y: 22 }, frontLeg: { x: 34, y: F }, backLeg: { x: -20, y: F } };

/** Two-handed aim at an angle (- is higher), on a wide base. */
const aimed = (aim: number, extra: Partial<Key> = {}): Key => ({
  pelvis: { x: 2, y: 14 },
  lean: 10,
  frontArm: straight(aim),
  backArm: guard,
  ...wide,
  support: true,
  ...extra,
});

/** Gun hand snapped up by the recoil, weight rocked back. Held, so it reads. */
const kickedBack = (extra: Partial<Key> = {}): Key => aimed(-35, { pelvis: { x: -6, y: 12 }, lean: -10, ...extra });

/*
 * Simple and bold: each move is ONE clear idea in 2-3 big poses (4 for the
 * finishers), with at most two shots (three for the finishers). The last
 * pose is held long enough to read at game speed.
 */
export const BABA_YAGA_MOVES: AttackMove[] = [
  // ======================= Tier 1: close-quarters basics =======================
  combo(1, 'Double Tap', 'Two shots, two-handed, rock steady', [
    { ...aimed(0), ...bullet() },
    { ms: 110, ...aimed(-3, { pelvis: { x: 6, y: 14 } }), ...bullet() },
  ]),
  combo(1, 'Pistol Whip', 'Lunges in and cracks the gun down across the jaw', [
    { ...lunge, lean: 26, frontArm: { upper: -30, lower: 40 }, backArm: armsBack, trail: { from: 'frontHand', reach: 20, curve: 18 } },
    { ms: 160, ...lunge, lean: 34, frontArm: { upper: 50, lower: 80 }, backArm: armsBack },
  ]),
  combo(1, 'Elbow-Shot', 'A big elbow to the face, then the arm unfolds into a point-blank shot', [
    { ...lunge, lean: 22, frontArm: { upper: -5, lower: 175 }, backArm: guard, trail: { from: 'frontElbow', reach: 16, curve: 10 } },
    { ms: 130, ...lunge, lean: 14, frontArm: straight(0), backArm: armsBack, ...bullet() },
  ]),
  combo(1, 'Knee and Shoot', 'A high knee to the gut, then one shot down into the doubled-over target', [
    { pelvis: { x: 4, y: 4 }, lean: 6, frontArm: relock, backArm: armsBack, frontLeg: { upper: -65, lower: 80 }, backLeg: { x: -10, y: F }, trail: { from: 'frontKnee', reach: 18, curve: -6 } },
    { ms: 140, ...aimed(38, { pelvis: { x: 6, y: 18 }, lean: 22 }), ...bullet('frontHand', 40) },
  ]),
  combo(1, 'Quick Draw', 'Leans back and fires one-handed from the hip', [
    { pelvis: { x: -2, y: 12 }, lean: -14, frontArm: { upper: 30, lower: -2 }, backArm: { upper: -150, lower: -120 }, ...wide, ...bullet() },
    { ms: 170, pelvis: { x: -2, y: 12 }, lean: -14, frontArm: { upper: 20, lower: -40 }, backArm: { upper: -150, lower: -120 }, ...wide },
  ]),

  // ================= Tier 2: gun-fu (grapples mixed with shots) =================
  combo(2, 'Judo Throw Shot', 'Hip-throws the attacker over, then drops low and fires down at them', [
    { pelvis: { x: 2, y: 20 }, lean: 50, frontArm: { upper: -40, lower: -10 }, backArm: { upper: 20, lower: 60 }, ...wide, trail: { from: 'frontHand', reach: 22, curve: 24 } },
    { ms: 160, ...aimed(55, { pelvis: { x: 6, y: 32 }, lean: 24, frontLeg: { x: 30, y: F }, backLeg: { x: -22, y: F } }), ...bullet('frontHand', 40) },
  ]),
  combo(2, 'Arm Lock Triple Tap', 'Traps the arm with the rear hand and fires under it', [
    { ...lunge, lean: 16, frontArm: relock, backArm: straight(-8), trail: { from: 'backHand', reach: 16, curve: 8 } },
    { ms: 110, ...lunge, lean: 16, frontArm: straight(8), backArm: straight(-10), ...bullet() },
    { ms: 110, ...lunge, lean: 16, frontArm: straight(14), backArm: straight(-10), ...bullet() },
  ]),
  combo(2, 'Reload Kick', 'A head-high front kick, slaps in a fresh mag, and fires', [
    { pelvis: { x: -2, y: 6 }, lean: -26, frontArm: { upper: -70, lower: -110 }, backArm: armsBack, frontLeg: straight(-20), backLeg: { x: -12, y: F }, trail: { from: 'frontFoot', reach: 20 } },
    { ms: 150, pelvis: { x: 2, y: 14 }, lean: 6, frontArm: { upper: 70, lower: -60 }, backArm: { upper: 60, lower: -80 }, ...wide },
    { ms: 110, ...aimed(0), ...bullet() },
  ]),
  combo(2, 'Headshot Pivot', 'A spinning gun-butt to the temple, then he pivots and aims high', [
    { ...lunge, lean: 18, tilt: -8, frontArm: { upper: -45, lower: 10 }, backArm: armsBack, trail: { from: 'frontHand', reach: 18, curve: -14 } },
    { ms: 150, pelvis: { x: -2, y: 12 }, lean: -8, frontArm: straight(-26), backArm: armsBack, ...wide, ...bullet('frontHand', 60) },
  ]),
  combo(2, 'Dual Pistols', 'Both guns out at once: left, then right', [
    { pelvis: { x: 2, y: 14 }, lean: 10, frontArm: straight(-6), backArm: straight(8), ...wide, prop: 'pistols', ...bullet() },
    { ms: 120, pelvis: { x: 4, y: 14 }, lean: 10, frontArm: straight(-10), backArm: straight(4), ...wide, prop: 'pistols', ...bullet('backHand') },
  ]),

  // =================== Tier 3: heavy hitters ===================
  combo(3, 'Shotgun Blast', 'One booming shotgun blast that rocks him back a step', [
    { ...aimed(0, { prop: 'shotgun' }), ...bullet('frontHand', 60) },
    { ms: 200, ...kickedBack({ prop: 'shotgun', frontLeg: { x: 14, y: F }, backLeg: { x: -30, y: F } }) },
  ]),
  combo(3, 'Slide Shot', 'Drops into a knee slide along the floor and fires', [
    { pelvis: { x: 10, y: 44 }, lean: -26, frontArm: straight(-8), backArm: guard, frontLeg: straight(8), backLeg: { upper: 100, lower: 170 }, support: true, ...bullet('frontHand', 56) },
    { ms: 200, pelvis: { x: 22, y: 45 }, lean: -22, frontArm: straight(-8), backArm: guard, frontLeg: straight(6), backLeg: { upper: 100, lower: 170 }, support: true },
  ]),
  combo(3, 'Pencil Strike', 'Out of bullets: raises a pencil high and drives it down', [
    { ...lunge, lean: 18, frontArm: straight(2), backArm: straight(-12), prop: 'pencil', trail: { from: 'frontHand', reach: 16 } },
    { ms: 130, pelvis: { x: 4, y: 12 }, lean: 0, frontArm: { upper: -95, lower: -75 }, backArm: straight(-12), ...wide, prop: 'pencil' },
    { ms: 110, ...lunge, lean: 30, frontArm: { upper: 10, lower: 75 }, backArm: straight(-6), prop: 'pencil', trail: { from: 'frontHand', reach: 16, curve: 16 } },
  ]),
  combo(3, 'Wall Run Shot', 'Runs up the wall sideways, fires down, then lands', [
    { pelvis: { x: 0, y: -18 }, lean: -34, frontArm: straight(22), backArm: armsBack, frontLeg: { upper: 20, lower: 100 }, backLeg: tucked, ...bullet('frontHand', 56) },
    { ms: 200, pelvis: { x: 10, y: 26 }, lean: 14, frontArm: relock, backArm: armsBack, frontLeg: { x: 30, y: F }, backLeg: { x: -10, y: F } },
  ]),

  // ================= Tier 4: gun-kata =================
  combo(4, 'Gun-Kata Spin', 'Fires ahead, spins, and fires behind', [
    { pelvis: { x: 2, y: 14 }, lean: 10, frontArm: straight(0), backArm: armsBack, ...wide, prop: 'pistols', ...bullet() },
    { ms: 140, pelvis: { x: 0, y: 14 }, lean: -6, tilt: 8, frontArm: { upper: 70, lower: 50 }, backArm: straight(180), ...wide, prop: 'pistols', ...bullet('backHand', 46) },
  ]),
  combo(4, 'Grapple and Execute', 'Grabs the collar, drives a knee in, and fires down', [
    { ...lunge, lean: 16, frontArm: relock, backArm: straight(-6), trail: { from: 'backHand', reach: 16, curve: 8 } },
    { ms: 120, pelvis: { x: 6, y: 4 }, lean: 8, frontArm: relock, backArm: straight(14), frontLeg: { upper: -60, lower: 85 }, backLeg: { x: -12, y: F }, trail: { from: 'frontKnee', reach: 18 } },
    { ms: 140, ...aimed(45, { pelvis: { x: 6, y: 22 }, lean: 18 }), ...bullet('frontHand', 40) },
  ]),
  combo(4, 'Shotgun Pump Combo', 'Blast, a big pump, and a second blast stepping forward', [
    { ...aimed(0, { prop: 'shotgun' }), ...bullet('frontHand', 60) },
    { ms: 160, ...kickedBack({ prop: 'shotgun' }) },
    { ms: 120, ...aimed(0, { prop: 'shotgun', ...lunge, lean: 14 }), ...bullet('frontHand', 60) },
  ]),
  combo(4, 'Rolling Fire', 'Dives into a forward roll and comes up kneeling, firing', [
    { pelvis: { x: 6, y: 34 }, lean: 55, frontArm: straight(12), backArm: armsBack, frontLeg: { x: 26, y: F }, backLeg: { x: -20, y: F }, ...bullet() },
    { ms: 150, pelvis: { x: 12, y: 40 }, lean: 80, frontArm: { upper: 20, lower: -110 }, backArm: { upper: 40, lower: -100 }, frontLeg: tucked, backLeg: tucked },
    { ms: 160, ...aimed(-2, { pelvis: { x: 16, y: 40 }, lean: 2, frontLeg: { x: 34, y: F }, backLeg: { upper: 100, lower: 175 } }), ...bullet('frontHand', 56) },
  ]),

  // ================= Tier 5: legendary finishers =================
  combo(5, 'Excommunicado', 'Front kick, hip throw, one shot down, then he holsters and walks', [
    { pelvis: { x: -2, y: 6 }, lean: -26, frontArm: relock, backArm: armsBack, frontLeg: straight(-20), backLeg: { x: -12, y: F }, trail: { from: 'frontFoot', reach: 20 } },
    { ms: 130, pelvis: { x: 2, y: 20 }, lean: 50, frontArm: { upper: -40, lower: -10 }, backArm: { upper: 20, lower: 60 }, ...wide, trail: { from: 'frontHand', reach: 22, curve: 24 } },
    { ms: 140, ...aimed(55, { pelvis: { x: 6, y: 32 }, lean: 24, frontLeg: { x: 30, y: F }, backLeg: { x: -22, y: F } }), ...bullet('frontHand', 40) },
    { ms: 220, pelvis: { x: 0, y: 9 }, lean: 0, frontArm: { upper: 85, lower: 95 }, backArm: { upper: 95, lower: 80 }, frontLeg: { x: 14, y: F }, backLeg: { x: -14, y: F } },
  ]),
  combo(5, 'Baba Yaga', 'Two guns: fires ahead, spins to fire behind, and ends with both guns out front', [
    { pelvis: { x: 2, y: 14 }, lean: 10, frontArm: straight(-4), backArm: armsBack, ...wide, prop: 'pistols', ...bullet() },
    { ms: 140, pelvis: { x: 0, y: 14 }, lean: -6, tilt: 8, frontArm: { upper: 70, lower: 50 }, backArm: straight(180), ...wide, prop: 'pistols', ...bullet('backHand', 46) },
    { ms: 140, pelvis: { x: 4, y: 14 }, lean: 12, frontArm: straight(-6), backArm: straight(6), ...wide, prop: 'pistols', ...bullet('frontHand', 56) },
    { ms: 200, pelvis: { x: 4, y: 14 }, lean: 12, frontArm: straight(-6), backArm: straight(6), ...wide, prop: 'pistols' },
  ]),
  combo(5, 'Last Bullet', 'One huge shot that throws his arms up, then he blows the smoke off the barrel', [
    { ...aimed(-2), ...bullet('frontHand', 90) },
    { ms: 200, ...kickedBack({ frontArm: straight(-50), frontLeg: { x: 16, y: F }, backLeg: { x: -30, y: F } }) },
    { ms: 300, pelvis: { x: -4, y: 12 }, lean: 0, frontArm: { upper: 60, lower: -115 }, backArm: { upper: 95, lower: 80 }, frontLeg: { x: 14, y: F }, backLeg: { x: -24, y: F } },
  ]),
];
