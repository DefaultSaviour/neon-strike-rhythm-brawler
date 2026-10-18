/**
 * Enemy body motion: one shared skeleton for every enemy type, posed by a
 * selectable motion style. Every style is locked to the music's beat.
 *
 * Coordinates: the enemy faces RIGHT (+x), feet on the floor at y = 68,
 * y points down. The renderer mirrors the pose for enemies facing left.
 *
 * Joints are placed with "two-bone IK": we choose where hands and feet should
 * go, and solveTwoBone works out the elbow/knee so limbs keep a fixed length
 * (no stretchy rubber arms, whatever the style does).
 */

export type EnemyMotionStyle = 'stand' | 'run' | 'dance' | 'sway';

export const ENEMY_MOTION_STYLES: Array<{ id: EnemyMotionStyle; label: string; description: string }> = [
  { id: 'run', label: 'Run on the spot', description: 'High knees and sprinter arms swinging from the shoulder, one step per beat' },
  { id: 'dance', label: 'Dance', description: 'Each enemy busts out its signature move: the Moonwalk, YMCA, the Floss, Thriller...' },
  { id: 'sway', label: 'Hands up', description: 'Facing you, arms waving overhead like a crowd, knees and elbows pumping on the beat' },
  { id: 'stand', label: 'Just stand', description: 'Guard up, riding the conveyor, nodding on the beat' },
];

export const DEFAULT_ENEMY_MOTION: EnemyMotionStyle = 'run';

/** Body shapes: heavies hunch forward with a wide stance, agile units are lighter. */
export type EnemyBuild = 'heavy' | 'samurai' | 'agile';

export interface Point {
  x: number;
  y: number;
}

export interface EnemyPose {
  head: Point;
  chest: Point;
  pelvis: Point;
  frontShoulder: Point;
  frontElbow: Point;
  frontHand: Point;
  backShoulder: Point;
  backElbow: Point;
  backHand: Point;
  frontKnee: Point;
  frontFoot: Point;
  backKnee: Point;
  backFoot: Point;
  /** 0..1, peaks the moment a foot lands (for stomp rings and dust) */
  stomp: number;
  /** True when the body faces the viewer (symmetric pose) rather than side-on */
  facingCamera: boolean;
}

export const LIMB = { upperArm: 21, forearm: 21, thigh: 31, shin: 32 } as const;
export const FLOOR = 68;

const BUILDS: Record<EnemyBuild, { hunch: number; stance: number }> = {
  heavy: { hunch: 8, stance: 26 },
  samurai: { hunch: 0, stance: 22 },
  agile: { hunch: 4, stance: 22 },
};

/**
 * Find the middle joint (elbow/knee) of a two-segment limb from `root` to
 * `target`. `bend` = +1 or -1 picks which side the joint pops out to. If the
 * target is out of reach the limb points straight at it.
 * Returns the joint and the end point actually reached.
 */
export function solveTwoBone(root: Point, target: Point, l1: number, l2: number, bend: 1 | -1) {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const distRaw = Math.hypot(dx, dy) || 1e-6;
  // Clamp to what the limb can physically reach (fully straight .. fully folded).
  const dist = Math.max(Math.abs(l1 - l2) + 1e-6, Math.min(distRaw, l1 + l2 - 1e-6));
  const ux = dx / distRaw;
  const uy = dy / distRaw;
  // Law of cosines: how far along the root->target line the joint sits, and how far off it.
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const joint = { x: root.x + ux * a - uy * h * bend, y: root.y + uy * a + ux * h * bend };
  const end = { x: root.x + ux * dist, y: root.y + uy * dist };
  return { joint, end };
}

const deg = (d: number) => (d * Math.PI) / 180;

function dirPoint(from: Point, angleDeg: number, length: number): Point {
  return { x: from.x + Math.cos(deg(angleDeg)) * length, y: from.y + Math.sin(deg(angleDeg)) * length };
}

/**
 * Place an arm by ROTATING it around its pivots: the upper arm turns around
 * the shoulder and the forearm around the elbow. Angles are in degrees on
 * screen (0 = toward +x, 90 = straight down, -90 = straight up). Returns the
 * hand position and the elbow side, which the IK then reproduces exactly.
 */
export function armByAngles(shoulder: Point, upperDeg: number, foreDeg: number): { hand: Point; bend: 1 | -1 } {
  const elbow = dirPoint(shoulder, upperDeg, LIMB.upperArm);
  const hand = dirPoint(elbow, foreDeg, LIMB.forearm);
  const cross = (hand.x - shoulder.x) * (elbow.y - shoulder.y) - (hand.y - shoulder.y) * (elbow.x - shoulder.x);
  return { hand, bend: cross >= 0 ? 1 : -1 };
}

/**
 * Where a leg's foot ends up (relative to a straight hanging leg) when the
 * thigh swings forward around the hip by `thighDeg` and the shin folds back
 * around the knee by `foldDeg`. Used for the running high-knee drive.
 */
function kneeDriveOffset(thighDeg: number, foldDeg: number): Point {
  const hip = { x: 0, y: 0 };
  const knee = dirPoint(hip, 90 - thighDeg, LIMB.thigh);
  const foot = dirPoint(knee, 90 - thighDeg + foldDeg, LIMB.shin);
  return { x: foot.x, y: foot.y - (LIMB.thigh + LIMB.shin) };
}

function pulseAt(beat: number, sharpness = 5) {
  const frac = beat - Math.floor(beat);
  return Math.exp(-frac * sharpness);
}

/**
 * Pose an enemy. `beat` is the song's beat counter (1.0 = one beat later),
 * already offset per enemy so neighbours lead with different feet.
 */
export function enemyPose(style: EnemyMotionStyle, beat: number, build: EnemyBuild): EnemyPose {
  const { hunch, stance } = BUILDS[build];
  const pulse = pulseAt(beat);

  let pelvis: Point;
  let chest: Point;
  let head: Point;
  let frontFootTarget: Point;
  let backFootTarget: Point;
  let frontHandTarget: Point;
  let backHandTarget: Point;
  // Which way elbows pop out (see solveTwoBone). +1 on a forward reach drops
  // the elbow down; on a raised arm it points the elbow forward.
  let armBendFront: 1 | -1 = 1;
  let armBendBack: 1 | -1 = 1;
  // Knees bend toward +x (forward) by default. Front-facing poses bend them outward instead.
  let legBendFront: 1 | -1 = -1;
  let legBendBack: 1 | -1 = -1;
  // Half the distance between the shoulders. Side-on poses overlap them; front-on spreads them.
  let shoulderSpread = 3;
  let facingCamera = false;
  let stomp = 0;

  if (style === 'run') {
    // One footfall per beat, alternating legs. theta = 0, pi, 2pi... are the landings.
    const theta = Math.PI * beat;
    const s = Math.sin(theta);
    const bounce = (1 - Math.abs(s)) * 4; // body lowest as a foot lands
    pelvis = { x: 2, y: 8 + bounce };
    chest = { x: hunch + 6, y: -22 + bounce };
    head = { x: hunch + 10, y: -48 + bounce };
    // High-knee drive: the lifted leg's thigh swings up around the hip and the
    // shin folds back under it, then the foot comes down exactly on the beat.
    const drive = (lift: number) => kneeDriveOffset(72 * lift, 115 * lift);
    const frontPlant = { x: stance * 0.45 + s * 6, y: FLOOR };
    const backPlant = { x: -stance * 0.45 + s * 6, y: FLOOR };
    const frontLift = drive(Math.max(0, s));
    const backLift = drive(Math.max(0, -s));
    frontFootTarget = { x: frontPlant.x + frontLift.x, y: frontPlant.y + frontLift.y };
    backFootTarget = { x: backPlant.x + backLift.x, y: backPlant.y + backLift.y };
    // Sprinter's arms, opposite to the legs: each upper arm swings around its
    // shoulder with the elbow held at about 90 degrees.
    const frontArm = armByAngles({ x: chest.x + shoulderSpread, y: chest.y + 1 }, 90 + 42 * s, 5 + 42 * s);
    const backArm = armByAngles({ x: chest.x - shoulderSpread, y: chest.y + 1 }, 90 - 42 * s, 5 - 42 * s);
    frontHandTarget = frontArm.hand;
    backHandTarget = backArm.hand;
    armBendFront = frontArm.bend;
    armBendBack = backArm.bend;
    stomp = pulse;
  } else if (style === 'dance') {
    // Dip on every beat, hips swing side to side, arms take turns pointing up.
    const swing = Math.sin(Math.PI * beat);
    const arm = Math.cos(Math.PI * beat); // +1 / -1 on alternate beats
    const dip = pulse * 6;
    pelvis = { x: swing * 6, y: 8 + dip };
    chest = { x: hunch * 0.5 + swing * 2, y: -22 + dip };
    head = { x: hunch * 0.5 + swing * 1 + 2, y: -48 + dip + pulse * 2 };
    frontFootTarget = { x: stance * 0.7, y: FLOOR };
    backFootTarget = { x: -stance * 0.7, y: FLOOR };
    const up = (v: number) => Math.max(0, v);
    frontHandTarget = { x: chest.x + 20 + up(arm) * 8, y: chest.y + 14 - up(arm) * 56 };
    backHandTarget = { x: chest.x - 18 - up(-arm) * 8, y: chest.y + 14 - up(-arm) * 56 };
    armBendFront = 1;
    armBendBack = -1;
    stomp = pulse;
  } else if (style === 'sway') {
    // Hands-up crowd pose, FACING THE CAMERA, like a crowd at a concert:
    // both arms up, waving side to side together over two beats (rotating
    // around the shoulders, forearms whipping a little further around the
    // elbows). On every beat the whole body pumps: knees bend, and the
    // forearms fold in around the elbows, then everything straightens.
    facingCamera = true;
    const wave = Math.sin((Math.PI * beat) / 2);
    const sway = wave * 3;
    const dip = pulse * 7;
    pelvis = { x: sway * 0.5, y: 8 + dip };
    chest = { x: sway, y: -22 + dip };
    head = { x: sway * 1.3, y: -48 + dip };
    frontFootTarget = { x: 13, y: FLOOR };
    backFootTarget = { x: -13, y: FLOOR };
    shoulderSpread = 9;
    const fold = pulse * 55;
    const frontUpper = -58 + wave * 8;
    const backUpper = -122 + wave * 8;
    const frontArm = armByAngles({ x: chest.x + shoulderSpread, y: chest.y + 1 }, frontUpper, frontUpper - fold + wave * 6);
    const backArm = armByAngles({ x: chest.x - shoulderSpread, y: chest.y + 1 }, backUpper, backUpper + fold + wave * 6);
    frontHandTarget = frontArm.hand;
    backHandTarget = backArm.hand;
    armBendFront = frontArm.bend;
    armBendBack = backArm.bend;
    // Knees bend OUTWARD, away from the body's centre line.
    legBendFront = -1;
    legBendBack = 1;
    stomp = 0;
  } else {
    // Stand: fighting guard, small nod on each beat.
    const dip = pulse * 1.8;
    pelvis = { x: 0, y: 8 + dip };
    chest = { x: hunch * 0.6 + 2, y: -22 + dip };
    head = { x: hunch + 6, y: -48 + dip * 1.4 };
    frontFootTarget = { x: stance * 0.6, y: FLOOR };
    backFootTarget = { x: -stance * 0.7, y: FLOOR };
    frontHandTarget = { x: chest.x + 24, y: chest.y - 2 };
    backHandTarget = { x: chest.x + 10, y: chest.y + 6 };
    armBendFront = 1;
    armBendBack = 1;
    stomp = 0;
  }

  return assemblePose(
    {
      pelvis,
      chest,
      head,
      frontHand: frontHandTarget,
      backHand: backHandTarget,
      frontFoot: frontFootTarget,
      backFoot: backFootTarget,
      bends: { frontArm: armBendFront, backArm: armBendBack, frontLeg: legBendFront, backLeg: legBendBack },
      shoulderSpread,
    },
    stomp,
    facingCamera
  );
}

/** Which side each elbow / knee pops out to (see solveTwoBone). */
export interface LimbBends {
  frontArm: 1 | -1;
  backArm: 1 | -1;
  frontLeg: 1 | -1;
  backLeg: 1 | -1;
}

/**
 * The few points that fully describe a pose: the body line (pelvis, chest,
 * head) plus where the hands and feet are aiming. Elbows and knees are worked
 * out from these, so limbs always keep their length. The built-in stances and
 * the Animation Studio's custom poses are both stored this way.
 */
export interface PoseRig {
  pelvis: Point;
  chest: Point;
  head: Point;
  frontHand: Point;
  backHand: Point;
  frontFoot: Point;
  backFoot: Point;
  bends: LimbBends;
  /** Half the gap between the shoulders (about 3 side-on, 9 facing the camera) */
  shoulderSpread: number;
}

/** Turn a rig into a full skeleton: shoulders, then elbows and knees by two-bone IK. */
export function assemblePose(rig: PoseRig, stomp: number, facingCamera: boolean): EnemyPose {
  const { pelvis, chest, head, bends, shoulderSpread } = rig;
  const frontShoulder = { x: chest.x + shoulderSpread, y: chest.y + 1 };
  const backShoulder = { x: chest.x - shoulderSpread, y: chest.y + 1 };
  const frontArm = solveTwoBone(frontShoulder, rig.frontHand, LIMB.upperArm, LIMB.forearm, bends.frontArm);
  const backArm = solveTwoBone(backShoulder, rig.backHand, LIMB.upperArm, LIMB.forearm, bends.backArm);
  const frontLeg = solveTwoBone(pelvis, rig.frontFoot, LIMB.thigh, LIMB.shin, bends.frontLeg);
  const backLeg = solveTwoBone(pelvis, rig.backFoot, LIMB.thigh, LIMB.shin, bends.backLeg);

  return {
    head: { ...head },
    chest: { ...chest },
    pelvis: { ...pelvis },
    frontShoulder,
    frontElbow: frontArm.joint,
    frontHand: frontArm.end,
    backShoulder,
    backElbow: backArm.joint,
    backHand: backArm.end,
    frontKnee: frontLeg.joint,
    frontFoot: frontLeg.end,
    backKnee: backLeg.joint,
    backFoot: backLeg.end,
    stomp,
    facingCamera,
  };
}

export function buildForBand(band: 'sub' | 'bass' | 'high'): EnemyBuild {
  return band === 'sub' ? 'heavy' : band === 'bass' ? 'samurai' : 'agile';
}
