import { FLOOR, Point, PoseRig } from './enemyMotion';
import { AnimationLibrary, CustomAnimation, EnemyKey, settleRig } from './customAnimation';

/**
 * Each enemy's signature dance (used for the "Dance" stance).
 *
 *   Titan        Gangnam Style   (horse ride, then the lasso)
 *   Breaker      The Running Man
 *   Rammer       The Dab
 *   Warlord      YMCA
 *   Ronin        The Batusi      (60s Batman: V-fingers swiped across the eyes)
 *   Acid Dancer  The Moonwalk
 *   Speeder      The Floss
 *   Wraith       Thriller        (zombie claws)
 *   Seraph       Disco Point     (Saturday Night Fever)
 *
 * Coordinates are pose units: the enemy faces RIGHT (+x), y points DOWN and
 * the feet stand on y = 68. For dances facing the camera, +x is the enemy's
 * left (the viewer's right). They are ordinary custom animations, so any of
 * them can be opened and tweaked in the Animation Studio.
 */

/** Spine and neck lengths of the built-in skeleton. */
const SPINE = 30;
const NECK = 26;

interface PoseSpec {
  pelvis: Point;
  /** Body lean in degrees: + leans toward +x */
  lean?: number;
  /** Extra head tilt in degrees on top of the lean */
  tilt?: number;
  frontHand: Point;
  backHand: Point;
  frontFoot: Point;
  backFoot: Point;
  /**
   * Which way each elbow / knee should point. Give any point on that side of
   * the limb; defaults: knees point forward (side-on) or outward (facing the
   * camera), elbows point down and out.
   */
  frontElbow?: Point;
  backElbow?: Point;
  frontKnee?: Point;
  backKnee?: Point;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** +1 or -1: which side of root->end the hint point is on (same rule as solveTwoBone). */
function bendToward(root: Point, end: Point, hint: Point): 1 | -1 {
  const cross = (end.x - root.x) * (hint.y - root.y) - (end.y - root.y) * (hint.x - root.x);
  return cross >= 0 ? 1 : -1;
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function rig(spec: PoseSpec, facingCamera: boolean): PoseRig {
  const lean = rad(spec.lean ?? 0);
  const tilt = rad((spec.lean ?? 0) + (spec.tilt ?? 0));
  const pelvis = spec.pelvis;
  const chest = { x: pelvis.x + Math.sin(lean) * SPINE, y: pelvis.y - Math.cos(lean) * SPINE };
  const head = { x: chest.x + Math.sin(tilt) * NECK, y: chest.y - Math.cos(tilt) * NECK };
  const shoulderSpread = facingCamera ? 9 : 3;
  const frontShoulder = { x: chest.x + shoulderSpread, y: chest.y + 1 };
  const backShoulder = { x: chest.x - shoulderSpread, y: chest.y + 1 };

  const elbowHint = (shoulder: Point, hand: Point, side: number) => {
    const m = midpoint(shoulder, hand);
    return { x: m.x + side * 8, y: m.y + 8 };
  };
  const kneeHint = (foot: Point, side: number) => {
    const m = midpoint(pelvis, foot);
    return facingCamera ? { x: m.x + side * 10, y: m.y } : { x: m.x + 10, y: m.y };
  };

  return settleRig({
    pelvis,
    chest,
    head,
    frontHand: spec.frontHand,
    backHand: spec.backHand,
    frontFoot: spec.frontFoot,
    backFoot: spec.backFoot,
    bends: {
      frontArm: bendToward(frontShoulder, spec.frontHand, spec.frontElbow ?? elbowHint(frontShoulder, spec.frontHand, 1)),
      backArm: bendToward(backShoulder, spec.backHand, spec.backElbow ?? elbowHint(backShoulder, spec.backHand, -1)),
      frontLeg: bendToward(pelvis, spec.frontFoot, spec.frontKnee ?? kneeHint(spec.frontFoot, 1)),
      backLeg: bendToward(pelvis, spec.backFoot, spec.backKnee ?? kneeHint(spec.backFoot, -1)),
    },
    shoulderSpread,
  });
}

function dance(facingCamera: boolean, beatsPerPose: number, poses: PoseSpec[]): CustomAnimation {
  return { facingCamera, beatsPerPose, poses: poses.map((p) => rig(p, facingCamera)) };
}

const F = FLOOR;

// ---------------------------------------------------------------------------
// TITAN: Gangnam Style. Wide horse-riding stance, wrists crossed like holding
// reins, hopping from foot to foot; then one hand twirls a lasso overhead.
// ---------------------------------------------------------------------------
const reins = { frontHand: { x: -5, y: -4 }, backHand: { x: 5, y: -4 }, frontElbow: { x: 20, y: -4 }, backElbow: { x: -20, y: -4 } };
const lasso = (x: number, y: number) => ({
  frontHand: { x, y },
  backHand: { x: -5, y: -2 },
  frontElbow: { x: 26, y: -30 },
  backElbow: { x: -20, y: -4 },
});
const GANGNAM = dance(true, 0.5, [
  { pelvis: { x: 0, y: 16 }, tilt: 0, ...reins, frontFoot: { x: 17, y: F }, backFoot: { x: -17, y: F } },
  { pelvis: { x: 1, y: 11 }, tilt: 4, ...reins, frontFoot: { x: 16, y: F - 12 }, backFoot: { x: -17, y: F } },
  { pelvis: { x: 0, y: 16 }, tilt: 0, ...reins, frontFoot: { x: 17, y: F }, backFoot: { x: -17, y: F } },
  { pelvis: { x: -1, y: 11 }, tilt: -4, ...reins, frontFoot: { x: 17, y: F }, backFoot: { x: -16, y: F - 12 } },
  { pelvis: { x: 0, y: 16 }, tilt: 0, ...lasso(14, -60), frontFoot: { x: 17, y: F }, backFoot: { x: -17, y: F } },
  { pelvis: { x: 1, y: 11 }, tilt: 3, ...lasso(26, -56), frontFoot: { x: 16, y: F - 12 }, backFoot: { x: -17, y: F } },
  { pelvis: { x: 0, y: 16 }, tilt: 0, ...lasso(8, -62), frontFoot: { x: 17, y: F }, backFoot: { x: -17, y: F } },
  { pelvis: { x: -1, y: 11 }, tilt: -3, ...lasso(22, -58), frontFoot: { x: 17, y: F }, backFoot: { x: -16, y: F - 12 } },
]);

// ---------------------------------------------------------------------------
// BREAKER: The Running Man. One knee drives up while the other foot slides
// back, then they swap. Fists pump at chest height.
// ---------------------------------------------------------------------------
const RUNNING_MAN = dance(false, 0.5, [
  {
    pelvis: { x: 0, y: 9 },
    lean: 6,
    frontHand: { x: 22, y: -12 },
    backHand: { x: -8, y: -2 },
    frontElbow: { x: 10, y: 0 },
    backElbow: { x: -16, y: -14 },
    frontFoot: { x: 14, y: 44 },
    frontKnee: { x: 30, y: 20 },
    backFoot: { x: -2, y: F },
  },
  {
    pelvis: { x: 0, y: 14 },
    lean: 4,
    frontHand: { x: 14, y: -4 },
    backHand: { x: 2, y: -8 },
    frontFoot: { x: 10, y: F },
    backFoot: { x: -22, y: F },
  },
  {
    pelvis: { x: 0, y: 9 },
    lean: 6,
    frontHand: { x: -8, y: -2 },
    backHand: { x: 22, y: -12 },
    frontElbow: { x: -16, y: -14 },
    backElbow: { x: 10, y: 0 },
    frontFoot: { x: -2, y: F },
    backFoot: { x: 14, y: 44 },
    backKnee: { x: 30, y: 20 },
  },
  {
    pelvis: { x: 0, y: 14 },
    lean: 4,
    frontHand: { x: 2, y: -8 },
    backHand: { x: 14, y: -4 },
    frontFoot: { x: -22, y: F },
    backFoot: { x: 10, y: F },
  },
]);

// ---------------------------------------------------------------------------
// RAMMER: The Dab. Bounce, then bury the face in one elbow with both arms
// pointing the same way up and out; bounce, dab the other way.
// ---------------------------------------------------------------------------
const bounce = (y: number) => ({
  pelvis: { x: 0, y },
  frontHand: { x: 14, y: 4 },
  backHand: { x: -14, y: 4 },
  frontFoot: { x: 14, y: F },
  backFoot: { x: -14, y: F },
});
const DAB = dance(true, 0.5, [
  bounce(14),
  {
    pelvis: { x: -2, y: 9 },
    lean: 4,
    tilt: 40,
    // straight arm out to +x, bent arm across the face, elbow up by the head
    frontHand: { x: 42, y: -50 },
    backHand: { x: 20, y: -54 },
    backElbow: { x: 2, y: -60 },
    frontFoot: { x: 14, y: F },
    backFoot: { x: -14, y: F },
  },
  bounce(14),
  {
    pelvis: { x: 2, y: 9 },
    lean: -4,
    tilt: -40,
    frontHand: { x: -20, y: -54 },
    backHand: { x: -42, y: -50 },
    frontElbow: { x: -2, y: -60 },
    frontFoot: { x: 14, y: F },
    backFoot: { x: -14, y: F },
  },
]);

// ---------------------------------------------------------------------------
// WARLORD: YMCA. Spell it out with the arms, one letter per beat.
// ---------------------------------------------------------------------------
const ymcaLegs = (y: number) => ({ pelvis: { x: 0, y }, frontFoot: { x: 13, y: F }, backFoot: { x: -13, y: F } });
const YMCA = dance(true, 1, [
  // Y: arms up in a wide V
  { ...ymcaLegs(10), frontHand: { x: 28, y: -58 }, backHand: { x: -28, y: -58 } },
  // M: fingertips on top of the head, elbows out wide
  {
    ...ymcaLegs(14),
    frontHand: { x: 3, y: -54 },
    backHand: { x: -3, y: -54 },
    frontElbow: { x: 30, y: -50 },
    backElbow: { x: -30, y: -50 },
  },
  // C: both arms curve over to one side
  {
    ...ymcaLegs(10),
    lean: -6,
    frontHand: { x: -16, y: -56 },
    frontElbow: { x: 14, y: -56 },
    backHand: { x: -32, y: -4 },
    backElbow: { x: -30, y: -30 },
  },
  // A: hands meet above the head
  {
    ...ymcaLegs(14),
    frontHand: { x: 1, y: -64 },
    backHand: { x: -1, y: -64 },
    frontElbow: { x: 24, y: -44 },
    backElbow: { x: -24, y: -44 },
  },
]);

// ---------------------------------------------------------------------------
// RONIN: The Batusi. V-fingers held across the eyes, swiped out to the sides
// and back while the hips twist.
// ---------------------------------------------------------------------------
const eyes = -49;
const swipe = (x: number, pelvisX: number) => ({
  pelvis: { x: pelvisX, y: 11 },
  frontHand: { x: x + 6, y: eyes },
  backHand: { x: x - 6, y: eyes + 1 },
  frontElbow: { x: x + 24, y: -26 },
  backElbow: { x: x - 24, y: -26 },
  frontFoot: { x: 14 + pelvisX, y: F },
  backFoot: { x: -14 + pelvisX, y: F },
});
const BATUSI = dance(true, 0.5, [swipe(0, 0), swipe(16, -4), swipe(0, 0), swipe(-16, 4)]);

// ---------------------------------------------------------------------------
// ACID DANCER: The Moonwalk. One foot slides back flat while the other is up
// on its toes with the knee bent; then they swap. The body stays put (the
// conveyor does the travelling), arms loose, leaning back slightly.
// ---------------------------------------------------------------------------
const toes = F - 11;
const moonArms = (swing: number) => ({
  frontHand: { x: 10 + swing, y: 8 },
  backHand: { x: -10 + swing, y: 6 },
  frontElbow: { x: 0, y: 0 },
  backElbow: { x: -16, y: -4 },
});
const MOONWALK = dance(false, 0.5, [
  // front foot flat and forward, back foot up on its toes with the knee bent forward
  { pelvis: { x: 0, y: 10 }, lean: 6, ...moonArms(3), frontFoot: { x: 10, y: F }, backFoot: { x: -6, y: toes }, backKnee: { x: 30, y: 30 } },
  // the flat foot slides back past the bent one
  { pelvis: { x: 0, y: 12 }, lean: 6, ...moonArms(0), frontFoot: { x: -20, y: F }, backFoot: { x: 4, y: toes }, backKnee: { x: 30, y: 30 } },
  // swap: the other foot drops flat in front, the back one pops up onto its toes
  { pelvis: { x: 0, y: 10 }, lean: 6, ...moonArms(-3), frontFoot: { x: -6, y: toes }, frontKnee: { x: 30, y: 30 }, backFoot: { x: 10, y: F } },
  { pelvis: { x: 0, y: 12 }, lean: 6, ...moonArms(0), frontFoot: { x: 4, y: toes }, frontKnee: { x: 30, y: 30 }, backFoot: { x: -20, y: F } },
]);

// ---------------------------------------------------------------------------
// SPEEDER: The Floss. Straight arms swing to one side while the hips swing
// to the other, back and forth.
// ---------------------------------------------------------------------------
const FLOSS = dance(true, 0.5, [
  {
    pelvis: { x: 7, y: 9 },
    lean: -10,
    frontHand: { x: -18, y: 14 },
    backHand: { x: -34, y: 14 },
    frontFoot: { x: 13, y: F },
    backFoot: { x: -13, y: F },
  },
  {
    pelvis: { x: -7, y: 9 },
    lean: 10,
    frontHand: { x: 34, y: 14 },
    backHand: { x: 18, y: 14 },
    frontFoot: { x: 13, y: F },
    backFoot: { x: -13, y: F },
  },
]);

// ---------------------------------------------------------------------------
// WRAITH: Thriller. Zombie claws raised to one side, head cocked, then a
// hunched shoulder-shrug; repeat to the other side.
// ---------------------------------------------------------------------------
const THRILLER = dance(true, 0.5, [
  {
    pelvis: { x: -2, y: 10 },
    lean: 6,
    tilt: 14,
    frontHand: { x: 32, y: -42 },
    backHand: { x: 14, y: -46 },
    frontElbow: { x: 22, y: -14 },
    backElbow: { x: 2, y: -14 },
    frontFoot: { x: 14, y: F },
    backFoot: { x: -12, y: F },
  },
  {
    pelvis: { x: -2, y: 15 },
    lean: 10,
    tilt: 20,
    frontHand: { x: 30, y: -30 },
    backHand: { x: 14, y: -34 },
    frontElbow: { x: 22, y: -4 },
    backElbow: { x: 2, y: -6 },
    frontFoot: { x: 14, y: F },
    backFoot: { x: -12, y: F },
  },
  {
    pelvis: { x: 2, y: 10 },
    lean: -6,
    tilt: -14,
    frontHand: { x: -14, y: -46 },
    backHand: { x: -32, y: -42 },
    frontElbow: { x: -2, y: -14 },
    backElbow: { x: -22, y: -14 },
    frontFoot: { x: 12, y: F },
    backFoot: { x: -14, y: F },
  },
  {
    pelvis: { x: 2, y: 15 },
    lean: -10,
    tilt: -20,
    frontHand: { x: -14, y: -34 },
    backHand: { x: -30, y: -30 },
    frontElbow: { x: -2, y: -6 },
    backElbow: { x: -22, y: -4 },
    frontFoot: { x: 12, y: F },
    backFoot: { x: -14, y: F },
  },
]);

// ---------------------------------------------------------------------------
// SERAPH: Disco Point. One hand on the hip, the other points high to the
// side, then sweeps down across the body; the hips pop the other way.
// ---------------------------------------------------------------------------
const hipHand = { backHand: { x: -12, y: 6 }, backElbow: { x: -26, y: -10 } };
const DISCO = dance(true, 0.5, [
  {
    pelvis: { x: -4, y: 9 },
    lean: 6,
    tilt: 8,
    frontHand: { x: 36, y: -58 },
    ...hipHand,
    frontFoot: { x: 14, y: F },
    backFoot: { x: -12, y: F },
  },
  {
    pelvis: { x: 4, y: 12 },
    lean: -6,
    tilt: -10,
    frontHand: { x: -22, y: 18 },
    frontElbow: { x: 20, y: 0 },
    ...hipHand,
    frontFoot: { x: 16, y: F - 6 },
    frontKnee: { x: 4, y: 40 },
    backFoot: { x: -12, y: F },
  },
]);

/** Every enemy's signature move, keyed by enemy, in the "Dance" stance slot. */
export const SIGNATURE_DANCES: AnimationLibrary = {
  'sub-1': { dance: GANGNAM },
  'sub-2': { dance: RUNNING_MAN },
  'sub-3': { dance: DAB },
  'bass-1': { dance: YMCA },
  'bass-2': { dance: BATUSI },
  'bass-3': { dance: MOONWALK },
  'high-1': { dance: FLOSS },
  'high-2': { dance: THRILLER },
  'high-3': { dance: DISCO },
};

/** Names shown in the menus, keyed like SIGNATURE_DANCES. */
export const SIGNATURE_DANCE_NAMES: Record<EnemyKey, string> = {
  'sub-1': 'Gangnam Style',
  'sub-2': 'The Running Man',
  'sub-3': 'The Dab',
  'bass-1': 'YMCA',
  'bass-2': 'The Batusi',
  'bass-3': 'The Moonwalk',
  'high-1': 'The Floss',
  'high-2': 'Thriller',
  'high-3': 'Disco Point',
};
