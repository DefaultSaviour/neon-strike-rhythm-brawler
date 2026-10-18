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

export type EnemyMotionStyle = 'stand' | 'run' | 'dance' | 'sway' | 'handstand' | 'robot' | 'headbang' | 'zombie';

export const ENEMY_MOTION_STYLES: Array<{ id: EnemyMotionStyle; label: string; description: string }> = [
  { id: 'run', label: 'Run on the spot', description: 'High knees and sprinter arms swinging from the shoulder, one step per beat' },
  { id: 'dance', label: 'Dance', description: 'Each enemy busts out its signature move: the Moonwalk, YMCA, the Floss, Thriller...' },
  { id: 'sway', label: 'Hands up', description: 'Facing you, hands in the air, swaying side to side on the beat like a crowd' },
  { id: 'stand', label: 'Just stand', description: 'Guard up, riding the conveyor, nodding on the beat' },
  { id: 'handstand', label: 'Handstand', description: 'Upside down on their hands, legs scissoring in the air, elbows dipping on the beat' },
  { id: 'robot', label: 'Robot', description: 'Stiff right-angle arm poses that snap to the next one exactly on each beat, then freeze' },
  { id: 'headbang', label: 'Headbang', description: 'Bent over, head whipping down on every beat, shredding air guitar' },
  { id: 'zombie', label: 'Zombie', description: 'Hunched, arms reaching out at you, head lolling, shuffling and dragging a foot' },
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
  /**
   * True when the body is upside down (a handstand). The joints are real
   * positions either way; this only tells the art to draw hats, helmets and
   * other gear flipped, hanging toward the floor.
   */
  upsideDown?: boolean;
}

export const LIMB = { upperArm: 21, forearm: 21, thigh: 31, shin: 32 } as const;
/** Pelvis to chest in the built-in stances. */
const SPINE_LENGTH = 30;
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
  const { end, bend } = limbByAngles(shoulder, upperDeg, foreDeg, LIMB.upperArm, LIMB.forearm);
  return { hand: end, bend };
}

/** Same as armByAngles for any two-bone limb (legs use the thigh and shin lengths). */
export function limbByAngles(
  root: Point,
  upperDeg: number,
  lowerDeg: number,
  upperLength: number,
  lowerLength: number
): { end: Point; bend: 1 | -1 } {
  const joint = dirPoint(root, upperDeg, upperLength);
  const end = dirPoint(joint, lowerDeg, lowerLength);
  const cross = (end.x - root.x) * (joint.y - root.y) - (end.y - root.y) * (joint.x - root.x);
  return { end, bend: cross >= 0 ? 1 : -1 };
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

/**
 * Robot keyframes, one per beat: arm angles (degrees, see armByAngles; the
 * front arm is on the +x side, facing the camera), a stiff head tilt and a
 * knee dip. Classic right-angle "robot" arms.
 */
const ROBOT_POSES = [
  { frontUpper: 0, frontFore: -90, backUpper: 180, backFore: -90, tilt: 0 }, // goalposts
  { frontUpper: 0, frontFore: 90, backUpper: 180, backFore: -90, tilt: 14 }, // one up, one down
  { frontUpper: 90, frontFore: 0, backUpper: 90, backFore: 180, tilt: 0 }, // arms down, forearms out
  { frontUpper: -90, frontFore: 180, backUpper: 180, backFore: 90, tilt: -14 }, // one over the head
] as const;
/** How much of a beat the robot takes to snap into its next pose before freezing. */
const ROBOT_SNAP = 0.12;

/** Blend two angles (degrees) the short way round. */
function lerpDeg(a: number, b: number, t: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
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
  let upsideDown = false;
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
    // Hands-up crowd groove, FACING THE CAMERA, like a crowd at a concert.
    // The whole body sways to one side ON each beat and the other side on
    // the next, dipping into the knees as it lands on the beat and rising
    // as it crosses the middle between beats. Both arms ride the sway
    // overhead (rotating around the shoulders) and the forearms ease in
    // around the elbows into each beat. Everything is smooth: no snapping.
    facingCamera = true;
    const side = Math.cos(Math.PI * beat); // +1 on even beats, -1 on odd beats
    const groove = (1 + Math.cos(2 * Math.PI * beat)) / 2; // 1 on every beat, 0 halfway between
    const sway = side * 4;
    const dip = groove * 7;
    pelvis = { x: sway * 0.5, y: 8 + dip };
    chest = { x: sway, y: -22 + dip };
    head = { x: sway * 1.3, y: -48 + dip };
    frontFootTarget = { x: 13, y: FLOOR };
    backFootTarget = { x: -13, y: FLOOR };
    shoulderSpread = 9;
    const fold = groove * 55;
    const lean = side * 10;
    const frontUpper = -55 + lean;
    const backUpper = -125 + lean;
    const frontArm = armByAngles({ x: chest.x + shoulderSpread, y: chest.y + 1 }, frontUpper, frontUpper - fold);
    const backArm = armByAngles({ x: chest.x - shoulderSpread, y: chest.y + 1 }, backUpper, backUpper + fold);
    frontHandTarget = frontArm.hand;
    backHandTarget = backArm.hand;
    armBendFront = frontArm.bend;
    armBendBack = backArm.bend;
    // Knees bend OUTWARD, away from the body's centre line.
    legBendFront = -1;
    legBendBack = 1;
    stomp = 0;
  } else if (style === 'robot') {
    // The Robot, FACING THE CAMERA: right-angle arms that SNAP to the next
    // pose in the first instant of each beat, then freeze completely until
    // the next beat. Stiff head tilts and a little knee dip as it locks in.
    facingCamera = true;
    shoulderSpread = 9;
    const whole = Math.floor(beat);
    const frac = beat - whole;
    const n = ROBOT_POSES.length;
    const from = ROBOT_POSES[(((whole - 1) % n) + n) % n];
    const to = ROBOT_POSES[((whole % n) + n) % n];
    const k = Math.min(1, frac / ROBOT_SNAP);
    const snap = 1 - (1 - k) * (1 - k); // fast in, then locked
    const lock = Math.sin(Math.min(1, frac / (ROBOT_SNAP * 2)) * Math.PI) * 3; // knee dip as it locks in
    pelvis = { x: 0, y: 8 + lock };
    chest = { x: 0, y: -22 + lock };
    head = dirPoint(chest, -90 + lerpDeg(from.tilt, to.tilt, snap), 26);
    frontFootTarget = { x: 13, y: FLOOR };
    backFootTarget = { x: -13, y: FLOOR };
    const frontArm = armByAngles(
      { x: chest.x + shoulderSpread, y: chest.y + 1 },
      lerpDeg(from.frontUpper, to.frontUpper, snap),
      lerpDeg(from.frontFore, to.frontFore, snap)
    );
    const backArm = armByAngles(
      { x: chest.x - shoulderSpread, y: chest.y + 1 },
      lerpDeg(from.backUpper, to.backUpper, snap),
      lerpDeg(from.backFore, to.backFore, snap)
    );
    frontHandTarget = frontArm.hand;
    backHandTarget = backArm.hand;
    armBendFront = frontArm.bend;
    armBendBack = backArm.bend;
    legBendFront = -1;
    legBendBack = 1;
    stomp = 0;
  } else if (style === 'headbang') {
    // Headbang with air guitar, side-on: bent forward from the hips, the
    // head whips DOWN fast into every beat and rises slowly after it. One
    // arm holds the guitar neck out front, the other strums down on the beat.
    const frac = beat - Math.floor(beat);
    // 1 = head fully down (exactly on the beat), 0 = up (three-quarters of the way to the next beat)
    const raw = frac < 0.75 ? 1 - frac / 0.75 : (frac - 0.75) / 0.25;
    const bang = raw * raw * (3 - 2 * raw);
    const lean = 12 + 38 * bang; // degrees forward from upright
    pelvis = { x: -4, y: 12 + bang * 4 };
    chest = dirPoint(pelvis, -90 + lean, SPINE_LENGTH);
    head = dirPoint(chest, -90 + lean + 45 * bang, 24);
    frontFootTarget = { x: stance * 0.75, y: FLOOR };
    backFootTarget = { x: -stance * 0.75, y: FLOOR };
    const neck = armByAngles({ x: chest.x - shoulderSpread, y: chest.y + 1 }, 50 + lean * 0.5, -15 + lean * 0.5);
    const strum = armByAngles({ x: chest.x + shoulderSpread, y: chest.y + 1 }, 75 + lean * 0.4, 10 + 55 * bang);
    backHandTarget = neck.hand;
    frontHandTarget = strum.hand;
    armBendBack = neck.bend;
    armBendFront = strum.bend;
    stomp = 0;
  } else if (style === 'zombie') {
    // Zombie shuffle, side-on: hunched over, both arms stretched out toward
    // the player with drooping wrists, head lolling from side to side. Each
    // beat one foot shuffles forward with a little lift while the other drags.
    const s = Math.sin(Math.PI * beat);
    const sway = Math.cos(Math.PI * beat);
    pelvis = { x: -2, y: 10 + Math.abs(s) * 2 };
    chest = dirPoint(pelvis, -90 + 14, SPINE_LENGTH);
    head = dirPoint(chest, -90 + 30 + 18 * sway, 24);
    // One foot shuffles forward (lifting a little) while the other drags back.
    frontFootTarget = { x: 4 + 9 * s, y: FLOOR - Math.max(0, s) * 6 };
    backFootTarget = { x: -10 - 9 * s, y: FLOOR - Math.max(0, -s) * 6 };
    const reach = (shoulder: Point, droop: number) => armByAngles(shoulder, -4 + droop, 14 + droop * 1.5);
    const frontArm = reach({ x: chest.x + shoulderSpread, y: chest.y + 1 }, 6 * s);
    const backArm = reach({ x: chest.x - shoulderSpread, y: chest.y + 1 }, -6 * s);
    frontHandTarget = frontArm.hand;
    backHandTarget = backArm.hand;
    armBendFront = frontArm.bend;
    armBendBack = backArm.bend;
    stomp = 0;
  } else if (style === 'handstand') {
    // Handstand, side-on: hands planted on the floor with the head hanging
    // between them, body straight up, legs scissoring in the air (rotating
    // around the hips) over two beats. On every beat the elbows dip and the
    // knees tuck a little further, then push back up.
    upsideDown = true;
    const s = Math.sin(Math.PI * beat);
    const dip = pulse * 5;
    chest = { x: 1, y: 27 + dip };
    pelvis = { x: chest.x - 2, y: chest.y - SPINE_LENGTH };
    // Head tucked in between the arms (closer to the chest than standing up),
    // so hats and helmets have room above the floor.
    head = { x: chest.x + 4, y: chest.y + 18 };
    frontHandTarget = { x: 9, y: FLOOR };
    backHandTarget = { x: -7, y: FLOOR };
    // Elbows bend back toward the legs' side, like a handstand push-up.
    armBendFront = 1;
    armBendBack = 1;
    const split = 32 * s;
    const tuck = 22 + pulse * 30;
    const frontLeg = limbByAngles(pelvis, -90 + split, -90 + split - tuck, LIMB.thigh, LIMB.shin);
    const backLeg = limbByAngles(pelvis, -90 - split, -90 - split - tuck, LIMB.thigh, LIMB.shin);
    frontFootTarget = frontLeg.end;
    backFootTarget = backLeg.end;
    legBendFront = frontLeg.bend;
    legBendBack = backLeg.bend;
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
    facingCamera,
    upsideDown
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
export function assemblePose(rig: PoseRig, stomp: number, facingCamera: boolean, upsideDown = false): EnemyPose {
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
    upsideDown,
  };
}

export function buildForBand(band: 'sub' | 'bass' | 'high'): EnemyBuild {
  return band === 'sub' ? 'heavy' : band === 'bass' ? 'samurai' : 'agile';
}
