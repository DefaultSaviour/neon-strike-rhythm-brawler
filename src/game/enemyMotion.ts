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
  { id: 'run', label: 'Run on the spot', description: 'Knees up, arms pumping, one step per beat' },
  { id: 'dance', label: 'Dance', description: 'Bounce on the beat, hips sway, arms point up in turn' },
  { id: 'sway', label: 'Hands up', description: 'Facing you, hands in the air, knees and elbows pumping on the beat' },
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
const FLOOR = 68;

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
    const lift = 24;
    const bounce = (1 - Math.abs(s)) * 4; // body lowest as a foot lands
    pelvis = { x: 2, y: 8 + bounce };
    chest = { x: hunch + 6, y: -22 + bounce };
    head = { x: hunch + 10, y: -48 + bounce };
    frontFootTarget = { x: stance * 0.45 + s * 6, y: FLOOR - Math.max(0, s) * lift };
    backFootTarget = { x: -stance * 0.45 + s * 6, y: FLOOR - Math.max(0, -s) * lift };
    // Arms pump opposite to the legs.
    frontHandTarget = { x: chest.x + 18 - s * 14, y: chest.y + 6 - Math.max(0, -s) * 12 };
    backHandTarget = { x: chest.x - 4 + s * 14, y: chest.y + 8 - Math.max(0, s) * 12 };
    armBendFront = 1;
    armBendBack = 1;
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
    // Hands-up crowd pose, FACING THE CAMERA: one arm up on each side of the
    // head, feet apart. On every beat the whole body pumps: knees and elbows
    // bend (body dips, hands drop a little), then straighten between beats.
    // A gentle side-to-side sway runs over two beats.
    facingCamera = true;
    const sway = Math.sin((Math.PI * beat) / 2) * 3;
    const dip = pulse * 7;
    const handDrop = pulse * 14;
    pelvis = { x: sway * 0.5, y: 8 + dip };
    chest = { x: sway, y: -22 + dip };
    head = { x: sway * 1.3, y: -48 + dip };
    frontFootTarget = { x: 13, y: FLOOR };
    backFootTarget = { x: -13, y: FLOOR };
    frontHandTarget = { x: chest.x + 21, y: chest.y - 42 + handDrop };
    backHandTarget = { x: chest.x - 21, y: chest.y - 42 + handDrop };
    shoulderSpread = 9;
    // Elbows and knees bend OUTWARD, away from the body's centre line.
    armBendFront = 1;
    armBendBack = -1;
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

  const frontShoulder = { x: chest.x + shoulderSpread, y: chest.y + 1 };
  const backShoulder = { x: chest.x - shoulderSpread, y: chest.y + 1 };
  const frontArm = solveTwoBone(frontShoulder, frontHandTarget, LIMB.upperArm, LIMB.forearm, armBendFront);
  const backArm = solveTwoBone(backShoulder, backHandTarget, LIMB.upperArm, LIMB.forearm, armBendBack);
  const frontLeg = solveTwoBone(pelvis, frontFootTarget, LIMB.thigh, LIMB.shin, legBendFront);
  const backLeg = solveTwoBone(pelvis, backFootTarget, LIMB.thigh, LIMB.shin, legBendBack);

  return {
    head,
    chest,
    pelvis,
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
