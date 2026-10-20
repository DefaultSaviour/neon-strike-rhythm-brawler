import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { armReaching, buildFighterPose, buildKey, comboMove, FighterSpec, handOf, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE SCARECROW: the straw man from the old fairy tale of the yellow road
 * (the books, not any film's costume): a sack head with a stitched smile,
 * a floppy pointed hat, a patched shirt and straw poking out everywhere
 * (drawn by fighterArt). He fights like he's stuffed: loose, rubbery
 * flails, kicks that whip out, a heap he collapses into and springs back
 * out of, and the old wooden pole he was hung on, swung two-handed like a
 * staff. Every hit puffs out straw (NeonCanvas). His top-level form: he
 * finally gets a brain, glowing in the open top of his head.
 *
 * Built the round-one way: each move is ONE clear idea in a few big poses,
 * every hit is held for a beat (withHolds), and the hips stay near the
 * centre. 21 combos over the 5 tiers (5, 5, 4, 4, 3); the first keyframe is
 * the hit. Pole hits trail out to the end of the pole.
 *
 * Angles: 0 deg = toward the enemy, 90 = down, -90 = up, 180 = back. Feet
 * planted on the floor are at y = 68.
 */

const TRAIL = '#f2c94c'; // straw yellow
const F = FLOOR;
/** How far a pole hit reaches past his lead hand: out to the end of the pole. */
export const POLE_REACH = 44;

const straight = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
/** Arms hanging loose like stuffed sleeves, the elbows bent the wrong way a little. */
const dangleFront: LimbAngles = { upper: 72, lower: 104 };
const dangleBack: LimbAngles = { upper: 112, lower: 82 };
/** Flung out wide behind him, all floppy. */
const flungBack: LimbAngles = { upper: 170, lower: 140 };
const kick = (deg: number): LimbAngles => ({ upper: deg, lower: deg });

/** A slumped, knock-kneed stance. */
const slump = { pelvis: { x: 0, y: 14 }, frontLeg: { x: 14, y: F }, backLeg: { x: -12, y: F } };
/** Lurching in behind a hit. */
const lurch = { pelvis: { x: 6, y: 18 }, frontLeg: { x: 30, y: F }, backLeg: { x: -16, y: F } };
/** Standing on the back leg to kick. */
const onBackLeg = { pelvis: { x: -4, y: 10 }, backLeg: { x: -6, y: F } };
/** Up in the air, knees tucked. */
const airborne = { pelvis: { x: 2, y: -4 }, frontLeg: { upper: 30, lower: 120 }, backLeg: { upper: 70, lower: 150 } };
/** Collapsed in a heap on the floor, legs splayed. */
const heap = { pelvis: { x: -2, y: 48 }, backLeg: { upper: 160, lower: 170 } };

/** A keyframe; `prop: 'pole'` puts the rear hand on the pole too. */
type Key = FighterSpec & { ms?: number };

/** How far behind his lead hand the rear hand grips the pole. */
const GRIP = 14;

/** With the pole, put the rear hand on it just behind the lead hand, elbow hanging down. */
function onPole(k: Key): Key {
  if (k.prop !== 'pole') return k;
  const hand = handOf(k, 'front');
  const a = ((typeof k.frontArm.lower === 'number' ? k.frontArm.lower : 0) * Math.PI) / 180;
  const target = { x: hand.x - Math.cos(a) * GRIP, y: hand.y - Math.sin(a) * GRIP };
  const options = [armReaching(k, 'back', target), armReaching(k, 'back', target, true)];
  const lower = (l: LimbAngles) => Math.sin((l.upper * Math.PI) / 180);
  return { ...k, backArm: lower(options[0]) >= lower(options[1]) ? options[0] : options[1] };
}

let nextId = 1301;
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[]): AttackMove {
  return comboMove(nextId++, tier, name, description, withHolds(keys.map(onPole).map((k) => buildKey(k, TRAIL, k.ms ?? 0))));
}

/** Slumped, head lolling, arms hanging like empty sleeves. */
export const SCARECROW_IDLE: SkeletonPose = buildFighterPose({ ...slump, lean: 8, tilt: 18, frontArm: dangleFront, backArm: dangleBack }, TRAIL);

/** Back to the slump. */
const slumped = (ms: number): Key => ({ ms, ...slump, lean: 8, tilt: 18, frontArm: dangleFront, backArm: dangleBack });
/** The lead arm flopping out straight. */
const flopJab = (extra: Partial<Key> = {}): Key => ({ ...lurch, lean: 14, tilt: 10, frontArm: straight(-2), backArm: flungBack, trail: { from: 'frontHand', reach: 18 }, ...extra });
/** The rear arm swinging round wide like a rope. */
const ropeHook = (extra: Partial<Key> = {}): Key => ({ ...lurch, lean: 18, tilt: -10, frontArm: { upper: 150, lower: 120 }, backArm: { upper: -6, lower: 24 }, trail: { from: 'backHand', reach: 18, curve: 26 }, ...extra });
/** A loose leg whipping out. */
const whipKick = (deg = -10, extra: Partial<Key> = {}): Key => ({ ...onBackLeg, lean: -16, tilt: 14, frontArm: { upper: -40, lower: -10 }, backArm: flungBack, frontLeg: kick(deg), trail: { from: 'frontFoot', reach: 16 }, ...extra });
/** The pole driven straight at them, two-handed. */
const polePoke = (extra: Partial<Key> = {}): Key => ({ ...lurch, pelvis: { x: 0, y: 18 }, lean: 16, frontArm: straight(0), backArm: flungBack, prop: 'pole', trail: { from: 'frontHand', reach: POLE_REACH }, ...extra });
/** The pole swung round at their legs. */
const poleSweep = (extra: Partial<Key> = {}): Key => ({ pelvis: { x: -2, y: 32 }, lean: 24, frontArm: straight(38), backArm: flungBack, frontLeg: { x: 22, y: F }, backLeg: { x: -22, y: F }, prop: 'pole', trail: { from: 'frontHand', reach: POLE_REACH, curve: 22 }, ...extra });
/** A floppy spin, arms flung out: the swing comes round as he turns. */
const flailSpin = (extra: Partial<Key> = {}): Key => ({ pelvis: { x: 0, y: 14 }, lean: 0, tilt: 16, frontArm: straight(4), backArm: straight(186), frontLeg: { x: 8, y: F }, backLeg: { x: -8, y: F }, spin: true, trail: { from: 'frontHand', reach: 18, curve: 30 }, ...extra });
/** Springing up out of the heap with a big floppy uppercut. */
const springUp = (extra: Partial<Key> = {}): Key => ({ pelvis: { x: 4, y: 6 }, lean: 6, tilt: -12, frontArm: { upper: -50, lower: -84 }, backArm: { upper: 160, lower: 130 }, frontLeg: { x: 14, y: F }, backLeg: { upper: 110, lower: 150 }, trail: { from: 'frontHand', reach: 18, curve: -24 }, ...extra });
/** The eureka pose: one finger in the air, the other hand tapping his head. */
const eureka = (ms: number): Key => ({ ms, pelvis: { x: 0, y: 10 }, lean: -4, tilt: -8, frontArm: { upper: -70, lower: -92 }, backArm: { upper: -150, lower: -40 }, frontLeg: { x: 12, y: F }, backLeg: { x: -10, y: F } });

export const SCARECROW_MOVES: AttackMove[] = [
  // ======================= Tier 1: the straw man =======================
  combo(1, 'Floppy Jab', 'The lead arm flops out straight like a stuffed sleeve', [flopJab(), slumped(150)]),
  combo(1, 'Rope Haymaker', 'The rear arm swings round wide, like a rope with a fist on the end', [ropeHook(), slumped(150)]),
  combo(1, 'Loose Kick', 'A leg whips out, wobbling all the way', [whipKick(), slumped(150)]),
  combo(1, 'Pole Poke', 'Grabs his old pole and jabs it straight in', [polePoke(), slumped(150)]),
  combo(1, 'Straw Slap', 'A wild backhand slap, straw flying', [
    { ...lurch, lean: 12, tilt: 14, frontArm: { upper: -30, lower: 14 }, backArm: flungBack, trail: { from: 'frontHand', reach: 18, curve: -22 } },
    slumped(150),
  ]),

  // ================= Tier 2: the cornfield =================
  combo(2, 'Windmill', 'Both arms windmill over and down, one after the other', [
    { ...lurch, lean: 16, frontArm: { upper: -40, lower: 14 }, backArm: { upper: 120, lower: 160 }, trail: { from: 'frontHand', reach: 18, curve: 30 } },
    { ms: 100, ...ropeHook({ backArm: { upper: -30, lower: 20 } }) },
  ]),
  combo(2, 'Pole Sweep', 'Drops low and sweeps the pole across their legs', [poleSweep(), slumped(170)]),
  combo(2, 'Double Flop', 'Two floppy punches, one from each limp arm', [flopJab(), { ms: 100, ...ropeHook({ backArm: straight(0), trail: { from: 'backHand', reach: 18 } }) }]),
  combo(2, 'Kick and Wobble', 'Kicks, then wobbles about trying to stay up', [
    whipKick(-14),
    { ms: 170, pelvis: { x: -6, y: 12 }, lean: -20, tilt: 24, frontArm: { upper: -60, lower: -30 }, backArm: { upper: -130, lower: -160 }, frontLeg: { x: 10, y: F }, backLeg: { x: -18, y: F } },
  ]),
  combo(2, 'Hat Butt', 'Lurches in head first, floppy hat and all', [
    { ...lurch, lean: 34, tilt: 10, frontArm: dangleFront, backArm: flungBack, trail: { from: 'head', reach: 14 } },
    slumped(170),
  ]),

  // =================== Tier 3: falling apart ===================
  combo(3, 'Pile Up', 'Collapses into a heap, kicks out from the floor, then springs back up', [
    { ...heap, lean: -20, tilt: 10, frontArm: { upper: 120, lower: 90 }, backArm: { upper: 150, lower: 110 }, frontLeg: kick(-6), trail: { from: 'frontFoot', reach: 16 } },
    { ms: 140, ...springUp({ trail: undefined }) },
  ]),
  combo(3, 'Spring Back', 'Pops up out of nowhere with a big floppy uppercut, then flops back down', [
    springUp(),
    { ms: 170, ...heap, lean: -10, tilt: 20, frontArm: { upper: 110, lower: 80 }, backArm: { upper: 150, lower: 120 }, frontLeg: { upper: 10, lower: 0 } },
  ]),
  combo(3, 'Pole Vault Kick', 'Plants the pole, vaults up on it and kicks with both feet', [
    { ...airborne, lean: -10, frontArm: straight(76), backArm: flungBack, frontLeg: kick(-8), backLeg: kick(6), prop: 'pole', trail: { from: 'frontFoot', reach: 16 } },
    slumped(180),
  ]),
  combo(3, 'Scatter', 'Spins with his arms flung out, straw going everywhere', [flailSpin(), { ms: 100, ...flailSpin() }]),

  // ================= Tier 4: the crows =================
  combo(4, 'Crow Flap', 'Flaps his arms like wings, then chops down with both', [
    { ...lurch, lean: 18, frontArm: { upper: -20, lower: 16 }, backArm: { upper: -150, lower: -120 }, trail: { from: 'frontHand', reach: 18, curve: 24 } },
    { ms: 160, pelvis: { x: 0, y: 8 }, lean: 0, tilt: -10, frontArm: { upper: -30, lower: -70 }, backArm: { upper: -150, lower: -110 }, frontLeg: { x: 12, y: F }, backLeg: { x: -10, y: F } },
  ]),
  combo(4, 'Pole Spin', 'Twirls the pole round in front of him, hitting twice', [
    polePoke({ spin: true, trail: { from: 'frontHand', reach: POLE_REACH, curve: 30 } }),
    { ms: 100, ...poleSweep({ spin: true }) },
  ]),
  combo(4, 'Haystack Drop', 'Leaps up and drops knee first onto them like a falling haystack', [
    { ...airborne, lean: 20, frontArm: { upper: -60, lower: -100 }, backArm: { upper: -120, lower: -80 }, frontLeg: { upper: 10, lower: 100 }, trail: { from: 'frontKnee', reach: 14 } },
    { ms: 170, ...heap, lean: 10, tilt: 10, frontArm: { upper: 60, lower: 80 }, backArm: { upper: 120, lower: 100 }, frontLeg: kick(4) },
  ]),
  combo(4, 'Rag Doll', 'Flops forward with everything flailing, then rebounds', [
    { ...lurch, pelvis: { x: 8, y: 22 }, lean: 40, tilt: 20, frontArm: straight(10), backArm: { upper: -20, lower: 30 }, trail: { from: 'frontHand', reach: 18, curve: 20 } },
    { ms: 110, ...ropeHook() },
  ]),

  // ================= Tier 5: the brain =================
  combo(5, 'Big Idea', 'Pokes with the pole, then taps his head as the idea lights up', [polePoke(), { ms: 100, ...poleSweep() }, eureka(170)]),
  combo(5, 'Genius Combo', 'Jab, haymaker, kick: suddenly it all makes sense', [flopJab(), { ms: 90, ...ropeHook() }, { ms: 100, ...whipKick(-16) }, eureka(170)]),
  combo(5, 'Brainstorm', 'Spins the pole twice in a storm of straw, then the eureka pose', [
    polePoke({ spin: true, trail: { from: 'frontHand', reach: POLE_REACH, curve: 30 } }),
    { ms: 100, ...poleSweep({ spin: true }) },
    eureka(180),
  ]),
];
