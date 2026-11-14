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
 * staff. His signature: on his big hits an arm rips right off, flies into
 * them trailing straw, and snaps back on (`flyingArm`). Every hit puffs out
 * straw (NeonCanvas). His top-level form: he
 * finally gets a brain, glowing in the open top of his head.
 *
 * Built the round-one way: each move is ONE clear idea in a few big poses,
 * every hit is held for a beat (withHolds), and the hips stay near the
 * centre. 25 combos over the 5 tiers (5, 5, 8, 4, 3); the first keyframe is
 * the hit. Tier 4 is his twist: he is back on his post, feet off the floor,
 * and the post tips toward the enemy and flings a bit of him at them. Pole hits trail out to the end of the pole.
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

/** Tier 4: how far up his post his hips hang, so his feet dangle clear of the floor. */
export const HANG = 78;
/** Hung on the post, which is stuck in the ground at his spot and tipped over this many degrees toward the enemy. */
const post = (tip: number) => {
  const t = (tip * Math.PI) / 180;
  return { pelvis: { x: Math.sin(t) * HANG, y: F - Math.cos(t) * HANG }, lean: tip, prop: 'post' as const };
};
/** An arm tied along the crossbar, the forearm hanging off the end of it. */
const barFront = (tip: number, fore = 84): LimbAngles => ({ upper: tip, lower: fore });
const barBack = (tip: number, fore = 96): LimbAngles => ({ upper: 180 + tip, lower: fore });
/** Legs dangling: straight down, or trailing behind (+) or swinging ahead (-) as the post tips. */
const dangling = (lag = 0) => ({ frontLeg: { upper: 84 + lag, lower: 96 + lag * 1.4 }, backLeg: { upper: 98 + lag, lower: 86 + lag * 1.4 } });

/** Tier 4 between attacks: hanging on his post, head lolling, like a scarecrow in a field. */
export const ON_THE_POST: SkeletonPose = buildFighterPose({ ...post(0), tilt: 20, frontArm: barFront(0), backArm: barBack(0), ...dangling() }, TRAIL);

/**
 * A tier 4 move: he never steps. The post tips toward the enemy and flings a
 * bit of him at them. `planted` keeps the foot of the post on his spot.
 */
function hung(name: string, description: string, keys: Key[]): AttackMove {
  return { ...combo(4, name, description, keys), restPose: ON_THE_POST, planted: true };
}

/** Slumped, head lolling, arms hanging like empty sleeves. */
export const SCARECROW_IDLE: SkeletonPose = buildFighterPose({ ...slump, lean: 8, tilt: 18, frontArm: dangleFront, backArm: dangleBack }, TRAIL);

/** Back to the slump. */
const slumped = (ms: number): Key => ({ ms, ...slump, lean: 8, tilt: 18, frontArm: dangleFront, backArm: dangleBack });
/** The lead arm flopping out straight. */
const flopJab = (extra: Partial<Key> = {}): Key => ({ ...lurch, lean: 14, tilt: 10, frontArm: straight(-2), backArm: flungBack, trail: { from: 'frontHand', reach: 18 }, ...extra });
/** How far a flying arm goes: it rips off and flies this far past his hand before snapping back. */
const ARM_FLIES = 40;
/** The rear arm swinging round wide like a rope. */
const ropeHook = (extra: Partial<Key> = {}): Key => ({ ...lurch, lean: 18, tilt: -10, frontArm: { upper: 150, lower: 120 }, backArm: { upper: -6, lower: 24 }, trail: { from: 'backHand', reach: 18, curve: 26 }, ...extra });
/** His signature: the rear arm rips right off and flies into them, fist first, trailing straw. */
const flyingFist = (extra: Partial<Key> = {}): Key => ropeHook({ backArm: straight(-4), flyingArm: 'back', trail: { from: 'backHand', reach: ARM_FLIES, curve: 12 }, ...extra });
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
  combo(1, 'Flying Fist', 'His rear arm rips right off, flies into them, and snaps back on', [flyingFist(), slumped(150)]),
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
  combo(2, 'Double Flop', 'A floppy jab, then he throws the other arm at them', [flopJab(), { ms: 100, ...flyingFist() }]),
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
  combo(3, 'Scatter', 'Spins with his arms flung out, straw going everywhere, and comes out of it dizzy', [
    flailSpin(),
    { ms: 100, ...flailSpin() },
    { ms: 150, pelvis: { x: -2, y: 16 }, lean: -10, tilt: 26, frontArm: { upper: 60, lower: 100 }, backArm: { upper: 130, lower: 100 }, frontLeg: { x: 18, y: F }, backLeg: { x: -6, y: F } },
  ]),

  // =================== Tier 3, continued (these were tier 4 before he went back on his post) ===================
  combo(3, 'Crow Flap', 'Flaps his arms like wings, then chops down with both', [
    { ...lurch, lean: 18, frontArm: { upper: -20, lower: 16 }, backArm: { upper: -150, lower: -120 }, trail: { from: 'frontHand', reach: 18, curve: 24 } },
    { ms: 160, pelvis: { x: 0, y: 8 }, lean: 0, tilt: -10, frontArm: { upper: -30, lower: -70 }, backArm: { upper: -150, lower: -110 }, frontLeg: { x: 12, y: F }, backLeg: { x: -10, y: F } },
  ]),
  combo(3, 'Pole Spin', 'Twirls the pole round in front of him, hitting twice, then stands it up like a staff', [
    polePoke({ spin: true, trail: { from: 'frontHand', reach: POLE_REACH, curve: 30 } }),
    { ms: 100, ...poleSweep({ spin: true }) },
    { ms: 150, ...slump, lean: 4, tilt: 12, frontArm: { upper: 40, lower: -70 }, backArm: flungBack, prop: 'pole' },
  ]),
  combo(3, 'Haystack Drop', 'Leaps up and drops knee first onto them like a falling haystack', [
    { ...airborne, lean: 20, frontArm: { upper: -60, lower: -100 }, backArm: { upper: -120, lower: -80 }, frontLeg: { upper: 10, lower: 100 }, trail: { from: 'frontKnee', reach: 14 } },
    { ms: 170, ...heap, lean: 10, tilt: 10, frontArm: { upper: 60, lower: 80 }, backArm: { upper: 120, lower: 100 }, frontLeg: kick(4) },
  ]),
  combo(3, 'Rag Doll', 'Flops forward and throws his whole lead arm at them, then rebounds', [
    { ...lurch, pelvis: { x: 8, y: 22 }, lean: 40, tilt: 20, frontArm: straight(4), backArm: { upper: -20, lower: 30 }, flyingArm: 'front', trail: { from: 'frontHand', reach: ARM_FLIES + 4, curve: 10 } },
    { ms: 110, ...ropeHook() },
  ]),

  // ================= Tier 4: back on his post =================
  // He hangs on his post like a scarecrow in a field, feet off the floor,
  // and never steps. The post tips toward the enemy and flings a bit of
  // him at them. Between attacks he hangs upright (ON_THE_POST).
  hung('In the Wind', 'The post tips over and his arm rips off the crossbar and flies at them', [
    { ...post(20), tilt: 6, frontArm: straight(8), backArm: barBack(20), ...dangling(22), flyingArm: 'front', trail: { from: 'frontHand', reach: ARM_FLIES, curve: 10 } },
    { ms: 170, ...post(8), tilt: 18, frontArm: barFront(8, 60), backArm: barBack(8), ...dangling(-12) },
  ]),
  hung('Both Sleeves', 'Tips over and throws one arm, tips further and throws the other', [
    { ...post(14), tilt: 4, frontArm: straight(4), backArm: barBack(14), ...dangling(14), flyingArm: 'front', trail: { from: 'frontHand', reach: ARM_FLIES, curve: 10 } },
    { ms: 130, ...post(24), tilt: 10, frontArm: barFront(24, 110), backArm: straight(12), ...dangling(28), flyingArm: 'back', trail: { from: 'backHand', reach: ARM_FLIES, curve: -10 } },
  ]),
  hung('Dangling Kick', 'His legs swing up off the post as it tips: one whips out, then the other', [
    { ...post(18), tilt: 14, frontArm: barFront(18), backArm: barBack(18), frontLeg: kick(6), backLeg: { upper: 120, lower: 150 }, trail: { from: 'frontFoot', reach: 16 } },
    { ms: 140, ...post(22), tilt: 4, frontArm: barFront(22), backArm: barBack(22), frontLeg: { upper: 70, lower: 130 }, backLeg: kick(-12), trail: { from: 'backFoot', reach: 16, curve: -16 } },
  ]),
  hung('Timber', 'The whole post topples at them, hat first, then rocks back upright', [
    { ...post(24), tilt: 32, frontArm: barFront(26, 50), backArm: barBack(26, 130), ...dangling(34), trail: { from: 'head', reach: 16 } },
    { ms: 180, ...post(-8), tilt: -6, frontArm: barFront(-8, 110), backArm: barBack(-8, 70), ...dangling(-16) },
  ]),

  // ================= Tier 5: the brain =================
  combo(5, 'Big Idea', 'Pokes with the pole, then taps his head as the idea lights up', [polePoke(), { ms: 100, ...poleSweep() }, eureka(170)]),
  combo(5, 'Genius Combo', 'Jab, a flying fist, a kick: suddenly it all makes sense', [flopJab(), { ms: 90, ...flyingFist() }, { ms: 100, ...whipKick(-16) }, eureka(170)]),
  combo(5, 'Brainstorm', 'Spins the pole twice in a storm of straw, then the eureka pose', [
    polePoke({ spin: true, trail: { from: 'frontHand', reach: POLE_REACH, curve: 30 } }),
    { ms: 100, ...poleSweep({ spin: true }) },
    eureka(180),
  ]),
];
