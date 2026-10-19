import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { buildFighterPose, buildKey, comboMove, FighterSpec, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE DISCO KING: the white-suited dance-floor hero of the late-70s disco
 * films: a white three-piece suit with a wide collar and big dark hair.
 * He fights like he dances: the finger pointed to the sky, hip-swing kicks,
 * spins on the spot, struts and knee slides, every pose struck on the beat.
 *
 * Built the round-one way: each move is ONE clear idea in a few big poses,
 * every hit is held for a beat (withHolds), and the hips stay near the
 * centre. 21 combos over the 5 tiers (5, 5, 4, 4, 3); the first keyframe is
 * the hit.
 *
 * Angles: 0 deg = toward the enemy, 90 = down, -90 = up, 180 = back. Feet
 * planted on the floor are at y = 68.
 */

const TRAIL = '#ff4fd8'; // dance-floor pink
const F = FLOOR;

const straight = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
/** A hand resting on the hip, elbow out. */
const handOnHip: LimbAngles = { upper: 140, lower: 40 };
/** The finger pointed up to the sky, high and forward. */
const pointUp: LimbAngles = { upper: -55, lower: -62 };
/** The finger pointed down to the floor, across the body. */
const pointDown: LimbAngles = { upper: 110, lower: 120 };
/** Both forearms rolling round each other in front of his chest. */
const rollFront: LimbAngles = { upper: 50, lower: -30 };
const rollBack: LimbAngles = { upper: 70, lower: -10 };
/** Arms flung out wide in a spin. */
const flungFront = straight(-10);
const flungBack = straight(190);
const kick = (deg: number): LimbAngles => ({ upper: deg, lower: deg });

/** Weight on the back leg, the front hip cocked out, front toe pointed. */
const strut = { pelvis: { x: 2, y: 14 }, frontLeg: { x: 22, y: F }, backLeg: { x: -12, y: F } };
/** Standing on the back leg to kick. */
const onBackLeg = { pelvis: { x: -4, y: 10 }, backLeg: { x: -6, y: F } };
/** On his knees, sliding in. */
const kneeSlide = { pelvis: { x: 4, y: 38 }, frontLeg: { upper: 60, lower: 178 }, backLeg: { upper: 115, lower: 178 } };
/** In the air in the splits. */
const splitsAir = { pelvis: { x: 0, y: 0 }, backLeg: kick(175) };

type Key = FighterSpec & { ms?: number };

let nextId = 1001;
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[]): AttackMove {
  return comboMove(nextId++, tier, name, description, withHolds(keys.map((k) => buildKey(k, TRAIL, k.ms ?? 0))));
}

/** Hip cocked, one hand on the hip, the other finger pointing down at the floor. */
export const DISCO_KING_IDLE: SkeletonPose = buildFighterPose({ ...strut, lean: -4, tilt: 6, frontArm: pointDown, backArm: handOnHip }, TRAIL);

/** Back to his strut. */
const ready = (ms: number, extra: Partial<Key> = {}): Key => ({ ms, ...strut, lean: -4, tilt: 6, frontArm: pointDown, backArm: handOnHip, ...extra });
/** THE pose: finger to the sky, other hand on the hip, hip out. */
const skyPoint = (extra: Partial<Key> = {}): Key => ({ ...strut, pelvis: { x: 6, y: 14 }, lean: -8, tilt: -10, frontArm: pointUp, backArm: handOnHip, trail: { from: 'frontHand', reach: 18 }, ...extra });
/** Pointing straight at them. */
const forwardPoint = (extra: Partial<Key> = {}): Key => ({ ...strut, lean: 6, frontArm: straight(-6), backArm: handOnHip, trail: { from: 'frontHand', reach: 18 }, ...extra });
/** A spin on the spot, arms flung out wide: the lead hand backfists as it comes round. */
const spinOut = (extra: Partial<Key> = {}): Key => ({ pelvis: { x: 0, y: 12 }, lean: 0, frontArm: flungFront, backArm: flungBack, frontLeg: { x: 6, y: F }, backLeg: { x: -6, y: F }, spin: true, trail: { from: 'frontHand', reach: 20, curve: 24 }, ...extra });
/** A hip-swing kick: the hip swings out and the leg follows, waist high. */
const hipKick = (extra: Partial<Key> = {}): Key => ({ ...onBackLeg, lean: -18, tilt: 10, frontArm: pointUp, backArm: handOnHip, frontLeg: kick(-6), trail: { from: 'frontFoot', reach: 18, curve: 16 }, ...extra });

export const DISCO_KING_MOVES: AttackMove[] = [
  // ======================= Tier 1: the strut =======================
  combo(1, 'Point to the Sky', 'Strikes the pose: finger to the sky, hand on the hip', [skyPoint(), ready(160)]),
  combo(1, 'Disco Point', 'Points straight at them, right on the beat', [forwardPoint(), ready(150)]),
  combo(1, 'Strut Kick', 'A cocky little kick with the toe pointed', [
    { ...onBackLeg, lean: -8, frontArm: pointDown, backArm: handOnHip, frontLeg: kick(28), trail: { from: 'frontFoot', reach: 16 } },
    ready(150),
  ]),
  combo(1, 'Hip Swing Kick', 'Swings the hip out and the leg follows, waist high', [hipKick(), ready(160)]),
  combo(1, 'Rolling Fists', 'Rolls both forearms round each other, then lets one fly', [
    { ...strut, lean: 10, frontArm: straight(-4), backArm: rollBack, trail: { from: 'frontHand', reach: 16, curve: 20 } },
    { ms: 110, ...strut, lean: 6, frontArm: rollFront, backArm: rollBack },
  ]),

  // ================= Tier 2: on the floor =================
  combo(2, 'Disco Spin', 'Spins on the spot, arms flung out, and backfists as he comes round', [spinOut(), ready(170)]),
  combo(2, 'Floor Point', 'Points down at the floor, then up at the sky', [
    { ...strut, lean: 14, tilt: 10, frontArm: { upper: 40, lower: 30 }, backArm: handOnHip, trail: { from: 'frontHand', reach: 18, curve: -12 } },
    { ms: 140, ...skyPoint(), trail: undefined },
  ]),
  combo(2, 'Slide and Point', 'Slides in across the floor and points at them', [
    { ...strut, pelvis: { x: 10, y: 18 }, frontLeg: { x: 34, y: F }, backLeg: { x: -16, y: F }, lean: 12, frontArm: straight(-8), backArm: handOnHip, trail: { from: 'frontHand', reach: 20 } },
    ready(170),
  ]),
  combo(2, 'High Kick', 'A long leg kicked up high, toe pointed', [
    { ...onBackLeg, lean: -24, tilt: 14, frontArm: straight(-30), backArm: straight(200), frontLeg: kick(-34), trail: { from: 'frontFoot', reach: 18, curve: 18 } },
    ready(170),
  ]),
  combo(2, 'Collar Pop', 'Flicks up the big collar, then a backhand with the same hand', [
    { ...strut, lean: 4, tilt: -8, frontArm: { upper: 10, lower: 20 }, backArm: handOnHip, trail: { from: 'frontHand', reach: 16, curve: 22 } },
    { ms: 140, ...strut, lean: -4, tilt: -10, frontArm: { upper: 60, lower: -120 }, backArm: handOnHip },
  ]),

  // =================== Tier 3: the routine ===================
  combo(3, 'Fever Point', 'Up to the sky, down to the floor, up to the sky', [
    skyPoint(),
    { ms: 110, ...strut, lean: 14, tilt: 10, frontArm: { upper: 40, lower: 30 }, backArm: handOnHip, trail: { from: 'frontHand', reach: 18, curve: -12 } },
    { ms: 110, ...skyPoint() },
  ]),
  combo(3, 'Spin and Kick', 'A spin, and the hip-swing kick comes out of it', [spinOut(), { ms: 110, ...hipKick() }]),
  combo(3, 'Hip Swing Combo', 'Kick, then point at them while the hip is still swinging', [hipKick(), { ms: 100, ...forwardPoint() }]),
  combo(3, 'Strut and Kick', 'Two strutting kicks, low then high', [
    { ...onBackLeg, lean: -8, frontArm: pointDown, backArm: handOnHip, frontLeg: kick(28), trail: { from: 'frontFoot', reach: 16 } },
    { ms: 100, ...onBackLeg, lean: -24, tilt: 14, frontArm: straight(-30), backArm: straight(200), frontLeg: kick(-34), trail: { from: 'frontFoot', reach: 18, curve: 18 } },
  ]),

  // ================= Tier 4: the spotlight =================
  combo(4, 'Knee Slide', 'Drops onto his knees, slides in and points up at the sky', [
    { ...kneeSlide, lean: -14, tilt: -10, frontArm: pointUp, backArm: straight(160), trail: { from: 'frontHand', reach: 20 } },
    ready(190),
  ]),
  combo(4, 'Double Spin', 'Two spins, the second faster, and a point to finish', [spinOut(), { ms: 100, ...spinOut() }, { ms: 110, ...forwardPoint() }]),
  combo(4, 'Jumping Splits', 'Leaps into the splits in mid-air, kicking them in the chest', [
    { ...splitsAir, lean: 0, frontArm: straight(-20), backArm: straight(200), frontLeg: kick(-4), trail: { from: 'frontFoot', reach: 20 } },
    ready(190),
  ]),
  combo(4, 'Lightning Point', 'Points up to the sky, then drives the point down at them', [
    skyPoint(),
    { ms: 110, ...strut, lean: 18, frontArm: straight(30), backArm: handOnHip, trail: { from: 'frontHand', reach: 20, curve: -16 } },
  ]),

  // ================= Tier 5: king of the dance floor =================
  combo(5, 'Dance Floor King', 'Spins, kicks, then strikes the pose and holds it', [spinOut(), { ms: 110, ...hipKick() }, { ms: 140, ...skyPoint() }, ready(260, { ...skyPoint(), trail: undefined })]),
  combo(5, 'Saturday Night', 'The whole routine: point, spin, splits', [
    forwardPoint(),
    { ms: 100, ...spinOut() },
    { ms: 120, ...splitsAir, lean: 0, frontArm: straight(-20), backArm: straight(200), frontLeg: kick(-4), trail: { from: 'frontFoot', reach: 20 } },
  ]),
  combo(5, 'Last Dance', 'Slides in on his knees and holds the sky point as the lights flash', [
    { ...kneeSlide, lean: -14, tilt: -10, frontArm: pointUp, backArm: straight(160), trail: { from: 'frontHand', reach: 20 } },
    { ms: 140, ...skyPoint() },
  ]),
];
