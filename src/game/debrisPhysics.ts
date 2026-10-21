import type { EnemyPose, Point } from './enemyMotion';
import { LIMB_WIDTH, TORSO_WIDTH } from './bodyProportions';

/**
 * Rigid-body physics for the pieces enemies shatter into.
 *
 * Each piece is a simple rigid shape (a stick, a ball or a triangle) with mass,
 * spin and a few "contact points". When a contact point hits the floor we apply
 * a proper impulse at THAT point, so:
 *   - a stick landing on one end flips and tumbles,
 *   - pieces bounce a little lower each time and then settle,
 *   - friction turns sliding into rolling and slows things down,
 *   - the conveyor belts drag resting pieces toward the pit, where they fall.
 *
 * Coordinates are world units with y pointing DOWN (canvas style). The floor
 * is the line y = world.floorY, except over the pit (|x| < pitHalfWidth).
 */

export type DebrisShape = 'segment' | 'circle' | 'shard';
export type DebrisRole = 'head' | 'torso' | 'limb' | 'weapon' | 'shard';

export interface DebrisPiece {
  id: number;
  shape: DebrisShape;
  role: DebrisRole;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Rotation in radians */
  angle: number;
  /** Spin in radians per second */
  vAngle: number;
  /** Segment: half its length. Shard: its size. Circle: unused (0). */
  halfLength: number;
  /** Thickness radius used for collisions and drawing */
  radius: number;
  mass: number;
  inertia: number;
  color: string;
  accent: string;
  /** 1 = freshly cut and glowing white-hot, cools to 0 */
  heat: number;
  life: number;
  maxLife: number;
  alpha: number;
  /** True once it has dropped below the floor into the pit */
  inPit: boolean;
  /** Seconds this piece has been lying still on the floor (it fades once settled) */
  restTime?: number;
  /** True once it has ridden a conveyor belt (it then gets time to reach the pit) */
  rodeBelt?: boolean;
}

export interface DebrisWorld {
  floorY: number;
  pitHalfWidth: number;
  /** Conveyor surface speed (units/s). Both belts move toward the centre. */
  beltSpeed: number;
  gravity: number;
  /**
   * Half the visible width (world units). Pieces knocked this far past the
   * edge of the screen are removed, since nobody will see them again.
   */
  halfWidth?: number;
}

export interface DebrisImpact {
  x: number;
  y: number;
  /** Size of the hit in units/s of velocity change, for choosing spark count */
  strength: number;
  color: string;
}

export interface DebrisStepResult {
  impacts: DebrisImpact[];
  /** Pieces that finished falling into the pit this step (for ember effects) */
  sunk: DebrisPiece[];
}

const RESTITUTION = 0.38;
/** Below this landing speed pieces stop bouncing (prevents endless micro-jitter) */
const BOUNCE_THRESHOLD = 90;
const FRICTION = 0.55;
const AIR_DRAG = 0.35;
/** Gravity for debris (units/s^2). The game passes this to stepDebris too. */
export const DEBRIS_GRAVITY = 1500;
const SPIN_DRAG = 0.6;
const SUBSTEP = 1 / 240;
const PIT_DEPTH = 260;
const HEAT_COOL_RATE = 1.6;
/** Seconds a piece may lie still before it starts fading */
const REST_BEFORE_FADE = 0.45;
/** Alpha lost per second while fading (about 0.5 s to vanish) */
const FADE_RATE = 2;
/**
 * How far past the screen edge a piece may fly before it's removed. Pieces
 * that land within this margin ride the conveyor back into view and on into
 * the pit, which is what makes the belts look busy.
 */
const OFFSCREEN_MARGIN = 420;
/** How much longer than its normal life a piece may live while riding a belt to the pit */
const RIDING_LIFE_FACTOR = 2.5;
/** Fastest sideways launch speed for a shattered piece (world units/s) */
const MAX_LAUNCH_VX = 600;
const OFFSCREEN_HEIGHT = 1400;

/** Contact points in the piece's own (unrotated) coordinates. */
function localContacts(p: DebrisPiece): Array<{ x: number; y: number }> {
  if (p.shape === 'segment') {
    return [
      { x: -p.halfLength, y: 0 },
      { x: p.halfLength, y: 0 },
    ];
  }
  if (p.shape === 'shard') {
    const s = p.halfLength;
    return [
      { x: -s, y: -s * 0.5 },
      { x: s, y: 0 },
      { x: -s * 0.5, y: s },
    ];
  }
  return [{ x: 0, y: 0 }];
}

/** Mass and rotational inertia for a shape, so heavy/long pieces react realistically. */
export function massProperties(shape: DebrisShape, halfLength: number, radius: number) {
  if (shape === 'circle') {
    const mass = Math.PI * radius * radius * 0.02;
    return { mass, inertia: 0.5 * mass * radius * radius };
  }
  if (shape === 'segment') {
    const length = halfLength * 2;
    const mass = length * radius * 2 * 0.02 + 0.05;
    // Thin rod about its centre: m * L^2 / 12 (plus a little for thickness)
    return { mass, inertia: (mass * (length * length + 4 * radius * radius)) / 12 };
  }
  const mass = halfLength * halfLength * 0.02 + 0.05;
  return { mass, inertia: (mass * halfLength * halfLength) / 3 };
}

function beltVelocityAt(x: number, world: DebrisWorld): number {
  if (x < -world.pitHalfWidth) return world.beltSpeed; // left belt runs right
  if (x > world.pitHalfWidth) return -world.beltSpeed; // right belt runs left
  return 0;
}

/** Applies an impulse (jx, jy) at offset (rx, ry) from the piece's centre. */
function applyImpulse(p: DebrisPiece, rx: number, ry: number, jx: number, jy: number) {
  p.vx += jx / p.mass;
  p.vy += jy / p.mass;
  p.vAngle += (rx * jy - ry * jx) / p.inertia;
}

/** Resolve floor contact for one piece. Returns the largest impact speed this step. */
function collideWithFloor(p: DebrisPiece, world: DebrisWorld): number {
  const cos = Math.cos(p.angle);
  const sin = Math.sin(p.angle);
  let deepest = 0;
  let maxImpact = 0;

  for (const c of localContacts(p)) {
    const rx = c.x * cos - c.y * sin;
    const ry = c.x * sin + c.y * cos;
    const px = p.x + rx;
    const py = p.y + ry + p.radius;

    // No floor over the pit: the piece just drops in.
    if (Math.abs(px) < world.pitHalfWidth) continue;

    const penetration = py - world.floorY;
    if (penetration <= 0) continue;
    deepest = Math.max(deepest, penetration);

    // Velocity of the contact point = centre velocity + spin contribution.
    const vpy = p.vy + p.vAngle * rx;
    if (vpy <= 0) continue; // already moving away from the floor

    // Normal impulse (floor pushes up = negative y). r x n for n = (0, -1) is -rx.
    const bounce = vpy > BOUNCE_THRESHOLD ? RESTITUTION : 0;
    const rxn = -rx;
    const jn = ((1 + bounce) * vpy) / (1 / p.mass + (rxn * rxn) / p.inertia);
    applyImpulse(p, rx, ry, 0, -jn);
    maxImpact = Math.max(maxImpact, vpy);

    // Friction impulse: opposes sliding relative to the belt surface, capped by
    // Coulomb's law (can't exceed friction coefficient x normal impulse).
    // It acts where the piece's surface touches the floor (one radius below the
    // centre line), which is what makes balls roll instead of skid.
    const ryc = ry + p.radius;
    const vpx = p.vx - p.vAngle * ryc;
    const slide = vpx - beltVelocityAt(px, world);
    const rxt = -ryc; // r x t for t = (1, 0)
    let jt = -slide / (1 / p.mass + (rxt * rxt) / p.inertia);
    const maxFriction = FRICTION * jn;
    jt = Math.max(-maxFriction, Math.min(maxFriction, jt));
    applyImpulse(p, rx, ryc, jt, 0);
  }

  // Push the piece back out of the floor so it never sinks in.
  if (deepest > 0) p.y -= deepest;
  return maxImpact;
}

/**
 * Keep at most `max` pieces, choosing which ones to drop so the screen loses
 * the least: first pieces that are already fading out, then pieces off the
 * side of the screen, and only then the oldest of the rest. This keeps the
 * pieces riding the belts into the pit (the fun part to watch) alive as long
 * as possible. Mutates the array in place and keeps the original order.
 */
export function trimDebris(pieces: DebrisPiece[], max: number, halfWidth: number): void {
  let excess = pieces.length - max;
  if (excess <= 0) return;
  const drop = new Set<DebrisPiece>();
  const takeWhere = (test: (p: DebrisPiece) => boolean) => {
    // Array order is oldest first, so this drops the oldest matching pieces.
    for (const p of pieces) {
      if (excess <= 0) return;
      if (!drop.has(p) && test(p)) {
        drop.add(p);
        excess--;
      }
    }
  };
  takeWhere((p) => p.alpha < 1);
  takeWhere((p) => Math.abs(p.x) > halfWidth);
  takeWhere(() => true);
  let w = 0;
  for (const p of pieces) if (!drop.has(p)) pieces[w++] = p;
  pieces.length = w;
}

/**
 * Advance all pieces by `dt` seconds. Mutates the pieces, removes finished ones
 * from the array in place, and reports impacts (for sparks) and pieces that
 * sank into the pit (for embers).
 */
export function stepDebris(pieces: DebrisPiece[], world: DebrisWorld, dt: number): DebrisStepResult {
  const impacts: DebrisImpact[] = [];
  const sunk: DebrisPiece[] = [];
  const steps = Math.max(1, Math.ceil(dt / SUBSTEP));
  const h = dt / steps;

  for (let i = pieces.length - 1; i >= 0; i--) {
    const p = pieces[i];
    let strongestImpact = 0;

    for (let s = 0; s < steps; s++) {
      p.vy += world.gravity * h;
      const drag = Math.max(0, 1 - AIR_DRAG * h);
      p.vx *= drag;
      p.vy *= drag;
      p.vAngle *= Math.max(0, 1 - SPIN_DRAG * h);

      p.x += p.vx * h;
      p.y += p.vy * h;
      p.angle += p.vAngle * h;

      if (!p.inPit) {
        strongestImpact = Math.max(strongestImpact, collideWithFloor(p, world));
        if (Math.abs(p.x) < world.pitHalfWidth && p.y - p.radius > world.floorY) {
          p.inPit = true;
        }
      }
    }

    if (strongestImpact > 160) {
      impacts.push({ x: p.x, y: world.floorY, strength: strongestImpact, color: p.color });
    }

    p.life += dt;
    p.heat = Math.max(0, p.heat - HEAT_COOL_RATE * dt);

    if (p.inPit) {
      // Keep falling into the dark; fade as it goes.
      p.alpha -= 1.6 * dt;
      // Pit walls: stop pieces flying back out sideways.
      const limit = world.pitHalfWidth - p.radius;
      if (Math.abs(p.x) > limit) {
        p.x = Math.sign(p.x) * limit;
        p.vx *= -0.3;
      }
      if (p.y > world.floorY + PIT_DEPTH || p.alpha <= 0) {
        sunk.push(p);
        pieces.splice(i, 1);
      }
      continue;
    }

    // Gone off the side of the screen (or way above it): drop it.
    if (world.halfWidth !== undefined && (Math.abs(p.x) > world.halfWidth + OFFSCREEN_MARGIN || p.y < -OFFSCREEN_HEIGHT)) {
      pieces.splice(i, 1);
      continue;
    }

    // Pieces that have landed and are moving with a conveyor belt ride it all
    // the way to the pit. Only pieces lying still with no belt under them
    // fade quickly, so finished debris never just piles up.
    const belt = beltVelocityAt(p.x, world);
    const onFloor = p.y + p.radius >= world.floorY - 2 && Math.abs(p.vy) < 30;
    const settled = onFloor && Math.abs(p.vx - belt) < 30;
    const riding = settled && Math.abs(belt) > 1;
    if (riding) p.rodeBelt = true;
    p.restTime = settled && !riding ? (p.restTime ?? 0) + dt : 0;

    // Pieces that rode a belt keep extra time to reach the pit and tip in
    // (with a safety limit), so they never fade out right at the edge.
    const lifeLimit = p.rodeBelt ? p.maxLife * RIDING_LIFE_FACTOR : p.maxLife;
    if (p.life > lifeLimit || p.restTime > REST_BEFORE_FADE) {
      p.alpha -= FADE_RATE * dt;
      if (p.alpha <= 0) pieces.splice(i, 1);
    }
  }

  return { impacts, sunk };
}

// ---------------------------------------------------------------------------
// Shattering an enemy
// ---------------------------------------------------------------------------

export interface ShatterOptions {
  /** Enemy position (world x) at the moment it was hit */
  x: number;
  /** The enemy's body pose at the moment it was hit (facing right, see enemyMotion.ts) */
  pose: EnemyPose;
  /** +1 if the enemy faces right (it's on the left lane), -1 otherwise */
  facing: number;
  scale: number;
  /** Limb thickness multiplier for this enemy type (see enemyStyles.ts) */
  limbScale?: number;
  color: string;
  accent: string;
  /** Does this enemy carry a long blade? Adds a spinning weapon piece. */
  hasBlade: boolean;
  /** Overall blow strength: ~1 for OK, up to ~2.5 for PERFECT at high combo */
  power: number;
  /** Extra armour shards to add for big combos */
  extraShards: number;
  maxLife?: number;
  /** Random source in [0, 1). Injected so tests are repeatable. */
  random?: () => number;
}

/**
 * Break an enemy into rigid pieces placed exactly where its body parts were,
 * then hit them all with one blow coming from the player. Pieces near the point
 * of impact fly fastest; long limbs hit off-centre start spinning.
 */
export function shatterEnemy(opts: ShatterOptions, nextId: () => number): DebrisPiece[] {
  const rnd = opts.random ?? Math.random;
  // Convert the pose into world space: mirror for facing, scale around the feet.
  const toWorld = (pt: Point): Point => ({ x: pt.x * opts.facing * opts.scale, y: 68 - (68 - pt.y) * opts.scale });
  const p = opts.pose;
  const sk = {
    head: toWorld(p.head),
    chest: toWorld(p.chest),
    pelvis: toWorld(p.pelvis),
    frontShoulder: toWorld(p.frontShoulder),
    frontElbow: toWorld(p.frontElbow),
    frontHand: toWorld(p.frontHand),
    backShoulder: toWorld(p.backShoulder),
    backElbow: toWorld(p.backElbow),
    backHand: toWorld(p.backHand),
    frontKnee: toWorld(p.frontKnee),
    frontFoot: toWorld(p.frontFoot),
    backKnee: toWorld(p.backKnee),
    backFoot: toWorld(p.backFoot),
  };
  const pieces: DebrisPiece[] = [];
  const maxLife = opts.maxLife ?? 3;

  const make = (
    shape: DebrisShape,
    role: DebrisRole,
    cx: number,
    cy: number,
    angle: number,
    halfLength: number,
    radius: number,
    color: string
  ) => {
    const { mass, inertia } = massProperties(shape, halfLength, radius);
    const piece: DebrisPiece = {
      id: nextId(),
      shape,
      role,
      x: opts.x + cx,
      y: cy,
      vx: 0,
      vy: 0,
      angle,
      vAngle: 0,
      halfLength,
      radius,
      mass,
      inertia,
      color,
      accent: opts.accent,
      heat: 1,
      life: 0,
      maxLife: maxLife + rnd(),
      alpha: 1,
      inPit: false,
    };
    pieces.push(piece);
    return piece;
  };

  const bone = (a: Point, b: Point, role: DebrisRole, thickness: number, color = opts.color) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return make('segment', role, (a.x + b.x) / 2, (a.y + b.y) / 2, Math.atan2(dy, dx), Math.hypot(dx, dy) / 2, thickness, color);
  };

  const sc = opts.scale;
  // Pieces are as thick as the limbs drawn on screen (radius = half the width).
  const thick = sc * (opts.limbScale ?? 1) * 0.5;
  make('circle', 'head', sk.head.x, sk.head.y, 0, 0, 9 * sc, opts.color);
  bone(sk.chest, sk.pelvis, 'torso', TORSO_WIDTH * thick);
  const frontUpperArm = bone(sk.frontShoulder, sk.frontElbow, 'limb', LIMB_WIDTH.upperArm * thick);
  const frontForearm = bone(sk.frontElbow, sk.frontHand, 'limb', LIMB_WIDTH.forearm * thick);
  bone(sk.backShoulder, sk.backElbow, 'limb', LIMB_WIDTH.upperArm * thick);
  const backForearm = bone(sk.backElbow, sk.backHand, 'limb', LIMB_WIDTH.forearm * thick);
  bone(sk.pelvis, sk.frontKnee, 'limb', LIMB_WIDTH.thigh * thick);
  bone(sk.frontKnee, sk.frontFoot, 'limb', LIMB_WIDTH.shin * thick);
  bone(sk.pelvis, sk.backKnee, 'limb', LIMB_WIDTH.thigh * thick);
  bone(sk.backKnee, sk.backFoot, 'limb', LIMB_WIDTH.shin * thick);

  let weapon: DebrisPiece | undefined;
  if (opts.hasBlade) {
    // Blade continues on from the forearm.
    const fx = sk.frontHand.x - sk.frontElbow.x;
    const fy = sk.frontHand.y - sk.frontElbow.y;
    const len = Math.hypot(fx, fy) || 1;
    const tip = { x: sk.frontHand.x + (fx / len) * 40 * sc, y: sk.frontHand.y + (fy / len) * 40 * sc };
    weapon = bone(sk.frontHand, tip, 'weapon', 1.6 * sc, opts.accent);
  }

  const shardCount = 3 + opts.extraShards;
  const shards: DebrisPiece[] = [];
  for (let i = 0; i < shardCount; i++) {
    const t = rnd();
    const shard = make(
      'shard',
      'shard',
      sk.chest.x + (rnd() - 0.5) * 18 * sc,
      sk.chest.y + t * (sk.pelvis.y - sk.chest.y) + (rnd() - 0.5) * 20 * sc,
      rnd() * Math.PI * 2,
      (4 + rnd() * 5) * sc,
      1,
      i % 2 ? opts.accent : opts.color
    );
    shards.push(shard);
  }

  // The blow lands on the enemy's chest, from the player's side, pushing the
  // enemy back (away from the centre) and up.
  const away = -opts.facing;
  const impact = { x: opts.x + sk.chest.x - away * 6 * sc, y: sk.chest.y };
  for (const p of pieces) {
    const dx = p.x - impact.x;
    const dy = p.y - impact.y;
    const dist = Math.max(8, Math.hypot(dx, dy));
    // Closer to the impact = harder hit (but never zero).
    const falloff = 0.55 + 0.45 * Math.min(1, 30 / dist);
    const blow = (300 + rnd() * 190) * opts.power * falloff;

    // Main direction: away from player and upward, plus a little radial burst.
    const jxDir = away * 0.85 + (dx / dist) * 0.35;
    const jyDir = -0.5 + (dy / dist) * 0.3 - rnd() * 0.2;
    const len = Math.hypot(jxDir, jyDir);
    const jx = (jxDir / len) * blow * p.mass;
    const jy = (jyDir / len) * blow * p.mass;

    // Apply it at the point of the piece nearest the impact, so pieces struck
    // off-centre pick up spin (long limbs cartwheel, heads barely rotate).
    const along = p.shape === 'segment' ? Math.max(-p.halfLength, Math.min(p.halfLength, -(dx * Math.cos(p.angle) + dy * Math.sin(p.angle)))) : 0;
    const rx = along * Math.cos(p.angle);
    const ry = along * Math.sin(p.angle);
    applyImpulse(p, rx, ry, jx, jy);
    p.vAngle += (rnd() - 0.5) * 6;

    // Cap the sideways speed so even huge combo blasts land on the belts
    // (just off-screen at worst) and ride back to the pit, instead of flying
    // away for good. Capped pieces spin faster, so big hits still look wild.
    if (Math.abs(p.vx) > MAX_LAUNCH_VX) {
      const excess = Math.abs(p.vx) - MAX_LAUNCH_VX;
      p.vx = Math.sign(p.vx) * MAX_LAUNCH_VX;
      p.vAngle *= 1 + Math.min(1, excess / MAX_LAUNCH_VX);
    }
  }

  // Special flights. These reuse pieces the blast already made, so they add
  // nothing to draw or simulate: the explosion just looks wilder.
  //  - The head pops STRAIGHT UP, spinning, then drops back onto the belt.
  //  - The weapon (or a forearm) and a shard sail back OVER the player's head
  //    and land on the belt behind them. Bigger hits send more pieces over.
  const head = pieces.find((q) => q.role === 'head');
  if (head) launchStraightUp(head, opts.power, rnd);
  const over: DebrisPiece[] = [weapon ?? backForearm, shards[0]];
  if (opts.power > 1.6) over.push(frontForearm);
  if (opts.power > 2.2) over.push(frontUpperArm);
  for (const q of over) if (q) launchOverPlayer(q, rnd);

  return pieces;
}

export interface BurstOptions {
  /** Where the orb was hit (world units) */
  x: number;
  y: number;
  color: string;
  accent: string;
  /** 1 = an ordinary hit; bigger = harder (timing and combo) */
  power: number;
  count: number;
  random?: () => number;
  maxLife?: number;
}

/**
 * A boss fist smashed back: it bursts into white-hot shards that fly away from
 * the player (back toward the boss) and up, then land on the belts like any
 * other debris.
 */
export function burstOrb(opts: BurstOptions, nextId: () => number): DebrisPiece[] {
  const rnd = opts.random ?? Math.random;
  const away = opts.x < 0 ? -1 : 1;
  const pieces: DebrisPiece[] = [];
  for (let i = 0; i < opts.count; i++) {
    const halfLength = 3 + rnd() * 4;
    const { mass, inertia } = massProperties('shard', halfLength, 1);
    // A fan that opens away from the player, mostly upward
    const a = (rnd() - 0.5) * Math.PI * 0.9;
    const speed = (260 + rnd() * 260) * opts.power;
    const vx = away * Math.cos(a) * speed;
    pieces.push({
      id: nextId(),
      shape: 'shard',
      role: 'shard',
      x: opts.x + (rnd() - 0.5) * 8,
      y: opts.y + (rnd() - 0.5) * 8,
      vx: Math.max(-MAX_LAUNCH_VX, Math.min(MAX_LAUNCH_VX, vx)),
      vy: -Math.abs(Math.sin(a)) * speed - 180 - rnd() * 160,
      angle: rnd() * Math.PI * 2,
      vAngle: (rnd() - 0.5) * 24,
      halfLength,
      radius: 1,
      mass,
      inertia,
      color: i % 2 ? opts.accent : opts.color,
      accent: opts.accent,
      heat: 1,
      life: 0,
      maxLife: (opts.maxLife ?? 2.2) + rnd(),
      alpha: 1,
      inPit: false,
    });
  }
  return pieces;
}

/** Fire a piece almost straight up, spinning hard. */
export function launchStraightUp(p: DebrisPiece, power: number, rnd: () => number) {
  const strength = Math.min(1.25, 0.85 + 0.15 * power);
  p.vy = -(780 + rnd() * 160) * strength;
  p.vx = (rnd() - 0.5) * 40;
  p.vAngle = (rnd() < 0.5 ? -1 : 1) * (10 + rnd() * 8);
}

/**
 * Lob a piece in a high arc back over the player (who stands at x = 0) so it
 * lands on the far side, about as far out as it started. Aimed with the real
 * gravity and air drag, so it reliably comes down on the other belt.
 */
export function launchOverPlayer(p: DebrisPiece, rnd: () => number) {
  const vy = -(700 + rnd() * 120);
  const target = -p.x * (0.6 + rnd() * 0.3);
  const drop = Math.max(0, 68 - p.y);
  const time = (-vy + Math.sqrt(vy * vy + 2 * DEBRIS_GRAVITY * drop)) / DEBRIS_GRAVITY;
  // Air drag slows sideways speed by AIR_DRAG per second, so aim a bit harder.
  const vx = ((target - p.x) * AIR_DRAG) / (1 - Math.exp(-AIR_DRAG * time));
  p.vx = Math.max(-MAX_LAUNCH_VX, Math.min(MAX_LAUNCH_VX, vx));
  p.vy = vy;
  p.vAngle = (rnd() < 0.5 ? -1 : 1) * (12 + rnd() * 8);
}
