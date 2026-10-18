import { EnemyTier, FrequencyBand } from '../types/game';
import {
  assemblePose,
  buildForBand,
  ENEMY_MOTION_STYLES,
  EnemyMotionStyle,
  EnemyPose,
  enemyPose,
  FLOOR,
  LIMB,
  LimbBends,
  solveTwoBone,
  Point,
  PoseRig,
} from './enemyMotion';

/**
 * Custom enemy animations made in the Animation Studio.
 *
 * An animation is a list of key poses ("Pose 1, Pose 2, ...") that play in a
 * loop on the beat, smoothly blending from one to the next. Each enemy type
 * (3 bands x 3 tiers = 9) can replace any of the four stances with its own
 * animation; anything without a custom version uses the built-in maths.
 *
 * Poses are stored as rigs (see PoseRig in enemyMotion.ts): only the body line
 * and the hand / foot positions. Elbows and knees are worked out when drawing,
 * so arms and legs can never stretch, even while blending between poses.
 */

export interface CustomAnimation {
  /** How many beats each pose lasts before it has fully blended into the next */
  beatsPerPose: number;
  /** True for front-on poses (paired gear is mirrored, like the "Hands up" stance) */
  facingCamera: boolean;
  /** True for upside-down poses like the handstand (gear is drawn hanging toward the floor) */
  upsideDown?: boolean;
  poses: PoseRig[];
}

export type EnemyKey = `${FrequencyBand}-${EnemyTier}`;
export type AnimationLibrary = Partial<Record<EnemyKey, Partial<Record<EnemyMotionStyle, CustomAnimation>>>>;

export const ENEMY_KEYS: EnemyKey[] = ['sub-1', 'sub-2', 'sub-3', 'bass-1', 'bass-2', 'bass-3', 'high-1', 'high-2', 'high-3'];
export const BEATS_PER_POSE_OPTIONS = [0.25, 0.5, 1, 2] as const;
export const MAX_POSES = 16;

/** Where joints may be dragged (pose units, feet on y = 68, facing right). */
export const EDIT_BOUNDS = { minX: -75, maxX: 75, minY: -115, maxY: FLOOR } as const;

/**
 * How far (pose units) the hips may move left or right of centre. An enemy's
 * position on screen is what tells the player when to hit, so a dance must
 * not carry the body sideways or it would look early / late. Hands, feet and
 * leaning are free; only the hips are kept in this zone.
 */
export const HIP_ZONE = 8;
/** The hips can't sink lower than this (a deep squat). */
export const LOWEST_HIPS = FLOOR - 20;

export function enemyKey(band: FrequencyBand, tier: EnemyTier): EnemyKey {
  return `${band}-${tier}`;
}

// ---------------------------------------------------------------------------
// Rigs <-> poses
// ---------------------------------------------------------------------------

/** +1 or -1: which side of the root->end line the middle joint sits on. */
function bendOf(root: Point, end: Point, joint: Point): 1 | -1 {
  const cross = (end.x - root.x) * (joint.y - root.y) - (end.y - root.y) * (joint.x - root.x);
  return cross >= 0 ? 1 : -1;
}

/** Recover the rig from a full pose (used to start editing from a built-in stance). */
export function rigFromPose(p: EnemyPose): PoseRig {
  return {
    pelvis: { ...p.pelvis },
    chest: { ...p.chest },
    head: { ...p.head },
    frontHand: { ...p.frontHand },
    backHand: { ...p.backHand },
    frontFoot: { ...p.frontFoot },
    backFoot: { ...p.backFoot },
    bends: {
      frontArm: bendOf(p.frontShoulder, p.frontHand, p.frontElbow),
      backArm: bendOf(p.backShoulder, p.backHand, p.backElbow),
      frontLeg: bendOf(p.pelvis, p.frontFoot, p.frontKnee),
      backLeg: bendOf(p.pelvis, p.backFoot, p.backKnee),
    },
    shoulderSpread: (p.frontShoulder.x - p.backShoulder.x) / 2,
  };
}

/** Pull every point inside the editing area (nothing below the floor). */
function keepInBounds(rig: PoseRig): PoseRig {
  return {
    ...rig,
    pelvis: clampToBounds(rig.pelvis),
    chest: clampToBounds(rig.chest),
    head: clampToBounds(rig.head),
    frontHand: clampToBounds(rig.frontHand),
    backHand: clampToBounds(rig.backHand),
    frontFoot: clampToBounds(rig.frontFoot),
    backFoot: clampToBounds(rig.backFoot),
  };
}

/** Slide the whole pose sideways so the hips are back inside HIP_ZONE (see above). */
export function keepHipsInZone(rig: PoseRig): PoseRig {
  const x = Math.min(HIP_ZONE, Math.max(-HIP_ZONE, rig.pelvis.x));
  const dx = x - rig.pelvis.x;
  if (dx === 0) return rig;
  const shift = (p: Point): Point => ({ x: p.x + dx, y: p.y });
  return settleRig({
    ...rig,
    pelvis: shift(rig.pelvis),
    chest: shift(rig.chest),
    head: shift(rig.head),
    frontHand: shift(rig.frontHand),
    backHand: shift(rig.backHand),
    frontFoot: shift(rig.frontFoot),
    backFoot: shift(rig.backFoot),
  });
}

/**
 * Snap hand and foot targets to where the limbs actually reach, so the stored
 * rig always matches what's on screen (a hand dragged out of reach stops at
 * the end of the straight arm).
 */
export function settleRig(rig: PoseRig): PoseRig {
  rig = keepInBounds(rig);
  const p = assemblePose(rig, 0, false);
  return { ...rig, frontHand: p.frontHand, backHand: p.backHand, frontFoot: p.frontFoot, backFoot: p.backFoot };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

/** Blend two angles (radians) the short way round, so 350 deg -> 10 deg passes through 0. */
export function lerpAngle(a: number, b: number, t: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

interface Polar {
  angle: number;
  length: number;
}

function polar(from: Point, to: Point): Polar {
  return { angle: Math.atan2(to.y - from.y, to.x - from.x), length: Math.hypot(to.x - from.x, to.y - from.y) };
}

/** Rotate around `pivot`: blend the direction and length of a bone between two poses. */
function swing(pivot: Point, a: Polar, b: Polar, t: number): Point {
  const angle = lerpAngle(a.angle, b.angle, t);
  const length = lerp(a.length, b.length, t);
  return { x: pivot.x + Math.cos(angle) * length, y: pivot.y + Math.sin(angle) * length };
}

/**
 * Blend between two poses the way a real body moves: every bone ROTATES
 * around its pivot instead of sliding in a straight line.
 *  - The spine swings around the hips and the head around the neck.
 *  - Upper arms rotate around the shoulders and forearms around the elbows,
 *    so arms sweep in arcs and can spin all the way round (a lasso, a disco roll).
 *  - Feet slide in straight lines so planted feet stay on the floor; the
 *    knees follow by IK.
 */
export function blendPoses(a: EnemyPose, b: EnemyPose, t: number, stomp: number, facingCamera: boolean): EnemyPose {
  const pelvis = lerpPoint(a.pelvis, b.pelvis, t);
  const chest = swing(pelvis, polar(a.pelvis, a.chest), polar(b.pelvis, b.chest), t);
  const head = swing(chest, polar(a.chest, a.head), polar(b.chest, b.head), t);
  const spread = lerp((a.frontShoulder.x - a.backShoulder.x) / 2, (b.frontShoulder.x - b.backShoulder.x) / 2, t);
  const frontShoulder = { x: chest.x + spread, y: chest.y + 1 };
  const backShoulder = { x: chest.x - spread, y: chest.y + 1 };

  const frontElbow = swing(frontShoulder, polar(a.frontShoulder, a.frontElbow), polar(b.frontShoulder, b.frontElbow), t);
  const frontHand = swing(frontElbow, polar(a.frontElbow, a.frontHand), polar(b.frontElbow, b.frontHand), t);
  const backElbow = swing(backShoulder, polar(a.backShoulder, a.backElbow), polar(b.backShoulder, b.backElbow), t);
  const backHand = swing(backElbow, polar(a.backElbow, a.backHand), polar(b.backElbow, b.backHand), t);

  const knees = t < 0.5 ? a : b;
  const frontLeg = solveTwoBone(pelvis, lerpPoint(a.frontFoot, b.frontFoot, t), LIMB.thigh, LIMB.shin, bendOf(knees.pelvis, knees.frontFoot, knees.frontKnee));
  const backLeg = solveTwoBone(pelvis, lerpPoint(a.backFoot, b.backFoot, t), LIMB.thigh, LIMB.shin, bendOf(knees.pelvis, knees.backFoot, knees.backKnee));

  return {
    head,
    chest,
    pelvis,
    frontShoulder,
    frontElbow,
    frontHand,
    backShoulder,
    backElbow,
    backHand,
    frontKnee: frontLeg.joint,
    frontFoot: frontLeg.end,
    backKnee: backLeg.joint,
    backFoot: backLeg.end,
    stomp,
    facingCamera,
    upsideDown: a.upsideDown,
  };
}

/** Which pose we're on and how far into the blend toward the next one. */
export function animationPhase(anim: CustomAnimation, beat: number): { index: number; next: number; t: number } {
  const n = anim.poses.length;
  const pos = beat / anim.beatsPerPose;
  const whole = Math.floor(pos);
  const index = ((whole % n) + n) % n;
  return { index, next: (index + 1) % n, t: pos - whole };
}

/**
 * The enemy's pose `beat` beats into the song. Each pose is hit exactly on
 * its beat, then eases into the next one (smoothstep: slow out, slow in),
 * with every bone rotating around its pivot (see blendPoses).
 */
export function sampleAnimation(anim: CustomAnimation, beat: number): EnemyPose {
  const { index, next, t } = animationPhase(anim, beat);
  const eased = t * t * (3 - 2 * t);
  // A little stomp pulse as each pose lands (drives dust rings in the game).
  const stomp = Math.exp(-t * 5);
  const upsideDown = anim.upsideDown === true;
  const from = assemblePose(anim.poses[index], stomp, anim.facingCamera, upsideDown);
  if (eased === 0) return from;
  const to = assemblePose(anim.poses[next], stomp, anim.facingCamera, upsideDown);
  return blendPoses(from, to, eased, stomp, anim.facingCamera);
}

/**
 * A starting point for editing: the built-in stance sampled at half-beat steps.
 * Most stances repeat every 2 beats (4 poses); "Hands up" and "Robot" take 4 (8 poses).
 */
export function builtInAnimation(style: EnemyMotionStyle, band: FrequencyBand): CustomAnimation {
  const count = style === 'sway' || style === 'robot' ? 8 : 4;
  const beatsPerPose = 0.5;
  const poses: PoseRig[] = [];
  let facingCamera = false;
  let upsideDown = false;
  for (let i = 0; i < count; i++) {
    const p = enemyPose(style, i * beatsPerPose, buildForBand(band));
    facingCamera = p.facingCamera;
    upsideDown = p.upsideDown === true;
    poses.push(rigFromPose(p));
  }
  return upsideDown ? { beatsPerPose, facingCamera, upsideDown, poses } : { beatsPerPose, facingCamera, poses };
}

/** The pose the game should draw: the custom animation if there is one, else the built-in stance. */
export function enemyPoseFor(
  style: EnemyMotionStyle,
  beat: number,
  band: FrequencyBand,
  tier: EnemyTier,
  library: AnimationLibrary
): EnemyPose {
  const custom = library[enemyKey(band, tier)]?.[style];
  return custom ? sampleAnimation(custom, beat) : enemyPose(style, beat, buildForBand(band));
}

// ---------------------------------------------------------------------------
// Editing (used by the Animation Studio)
// ---------------------------------------------------------------------------

/** Every joint you can drag in the studio. */
export type DragHandle =
  | 'head'
  | 'chest'
  | 'pelvis'
  | 'frontHand'
  | 'backHand'
  | 'frontFoot'
  | 'backFoot'
  | 'frontElbow'
  | 'backElbow'
  | 'frontKnee'
  | 'backKnee';

export const DRAG_HANDLES: DragHandle[] = [
  'head',
  'chest',
  'pelvis',
  'frontHand',
  'backHand',
  'frontFoot',
  'backFoot',
  'frontElbow',
  'backElbow',
  'frontKnee',
  'backKnee',
];

/**
 * Elbows and knees are the middle of a two-bone limb. Dragging one swings
 * the upper bone around its root (shoulder / hip) and the lower bone rides
 * along with it, like moving a real arm from the elbow.
 */
const MIDDLE_JOINTS = {
  frontElbow: { root: 'frontShoulder', end: 'frontHand', bend: 'frontArm', length: LIMB.upperArm },
  backElbow: { root: 'backShoulder', end: 'backHand', bend: 'backArm', length: LIMB.upperArm },
  frontKnee: { root: 'pelvis', end: 'frontFoot', bend: 'frontLeg', length: LIMB.thigh },
  backKnee: { root: 'pelvis', end: 'backFoot', bend: 'backLeg', length: LIMB.thigh },
} as const;

type MiddleJoint = keyof typeof MIDDLE_JOINTS;

function isMiddleJoint(h: DragHandle): h is MiddleJoint {
  return h in MIDDLE_JOINTS;
}

/** Where a handle is drawn (pose units). */
export function handlePosition(rig: PoseRig, handle: DragHandle): Point {
  if (!isMiddleJoint(handle)) return rig[handle];
  return assemblePose(rig, 0, false)[handle];
}

function clampToBounds(p: Point): Point {
  return {
    x: Math.min(EDIT_BOUNDS.maxX, Math.max(EDIT_BOUNDS.minX, p.x)),
    y: Math.min(EDIT_BOUNDS.maxY, Math.max(EDIT_BOUNDS.minY, p.y)),
  };
}

function add(a: Point, d: Point): Point {
  return { x: a.x + d.x, y: a.y + d.y };
}

/** Put `p` at the same distance from `centre` as `keepDistanceOf`, pointing toward `toward`. */
function onCircle(centre: Point, radius: number, toward: Point): Point {
  const dx = toward.x - centre.x;
  const dy = toward.y - centre.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: centre.x, y: centre.y - radius };
  return { x: centre.x + (dx / len) * radius, y: centre.y + (dy / len) * radius };
}

function rotateAround(p: Point, centre: Point, angle: number): Point {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = p.x - centre.x;
  const dy = p.y - centre.y;
  return { x: centre.x + dx * c - dy * s, y: centre.y + dx * s + dy * c };
}

/**
 * Drag one joint to `target` and return the new rig (the old one is untouched).
 *  - pelvis: moves the whole upper body with it; the feet stay planted. It
 *    can only move inside the timing zone (HIP_ZONE).
 *  - chest:  swings around the pelvis (the spine keeps its length), carrying head and hands.
 *  - head:   swings around the chest (the neck keeps its length).
 *  - hands / feet: go where you drag them, as far as the limb reaches.
 *  - elbows / knees: swing the upper bone around the shoulder / hip; the
 *    forearm / shin rides along, still pointing the same way (drag across
 *    the limb to bend it the other way).
 */
export function moveHandle(rig: PoseRig, handle: DragHandle, target: Point): PoseRig {
  const to = clampToBounds(target);
  const next: PoseRig = { ...rig, bends: { ...rig.bends } };

  if (handle === 'pelvis') {
    // The hips stay inside the timing zone (see HIP_ZONE) and above a deep squat.
    const hips = { x: Math.min(HIP_ZONE, Math.max(-HIP_ZONE, to.x)), y: Math.min(LOWEST_HIPS, to.y) };
    const d = { x: hips.x - rig.pelvis.x, y: hips.y - rig.pelvis.y };
    next.pelvis = hips;
    next.chest = add(rig.chest, d);
    next.head = add(rig.head, d);
    next.frontHand = add(rig.frontHand, d);
    next.backHand = add(rig.backHand, d);
  } else if (handle === 'chest') {
    const spine = Math.hypot(rig.chest.x - rig.pelvis.x, rig.chest.y - rig.pelvis.y);
    const chest = onCircle(rig.pelvis, spine, to);
    const turn =
      Math.atan2(chest.y - rig.pelvis.y, chest.x - rig.pelvis.x) -
      Math.atan2(rig.chest.y - rig.pelvis.y, rig.chest.x - rig.pelvis.x);
    next.chest = chest;
    next.head = rotateAround(rig.head, rig.pelvis, turn);
    const d = { x: chest.x - rig.chest.x, y: chest.y - rig.chest.y };
    next.frontHand = add(rig.frontHand, d);
    next.backHand = add(rig.backHand, d);
  } else if (handle === 'head') {
    const neck = Math.hypot(rig.head.x - rig.chest.x, rig.head.y - rig.chest.y);
    next.head = onCircle(rig.chest, neck, to);
  } else if (isMiddleJoint(handle)) {
    const spec = MIDDLE_JOINTS[handle];
    const pose = assemblePose(rig, 0, false);
    const root = pose[spec.root];
    const oldJoint = pose[handle];
    const joint = onCircle(root, spec.length, to);
    // The lower bone keeps pointing the same way and rides along with the joint
    // (like the hands do when you drag the chest). Drag the joint across the
    // limb and it bends the other way.
    const end = clampToBounds(add(pose[spec.end], { x: joint.x - oldJoint.x, y: joint.y - oldJoint.y }));
    next[spec.end] = end;
    next.bends[spec.bend] = bendOf(root, end, joint);
  } else {
    next[handle] = to;
  }
  return settleRig(next);
}

/** Swap left and right limbs (keeps the body where it is). Handy for "same move, other side". */
export function mirrorRig(rig: PoseRig): PoseRig {
  const cx = rig.pelvis.x;
  const flip = (p: Point): Point => ({ x: 2 * cx - p.x, y: p.y });
  return settleRig({
    ...rig,
    chest: flip(rig.chest),
    head: flip(rig.head),
    frontHand: flip(rig.backHand),
    backHand: flip(rig.frontHand),
    frontFoot: flip(rig.backFoot),
    backFoot: flip(rig.frontFoot),
    bends: {
      frontArm: rig.bends.backArm === 1 ? -1 : 1,
      backArm: rig.bends.frontArm === 1 ? -1 : 1,
      frontLeg: rig.bends.backLeg === 1 ? -1 : 1,
      backLeg: rig.bends.frontLeg === 1 ? -1 : 1,
    },
  });
}

/** The nearest joint within `radius` of the pointer (pose units), if any. */
export function handleAt(rig: PoseRig, p: Point, radius: number): DragHandle | null {
  let best: DragHandle | null = null;
  let bestDist = radius;
  for (const h of DRAG_HANDLES) {
    const q = handlePosition(rig, h);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= bestDist) {
      bestDist = d;
      best = h;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Library: checking, merging and saving
// ---------------------------------------------------------------------------

const STYLE_IDS = new Set<string>(ENEMY_MOTION_STYLES.map((s) => s.id));

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parsePoint(v: unknown): Point | null {
  if (!isRecord(v)) return null;
  const { x, y } = v;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return clampToBounds({ x, y });
}

function parseBend(v: unknown): 1 | -1 | null {
  return v === 1 || v === -1 ? v : null;
}

function parseRig(v: unknown): PoseRig | null {
  if (!isRecord(v) || !isRecord(v.bends)) return null;
  const pts = {
    pelvis: parsePoint(v.pelvis),
    chest: parsePoint(v.chest),
    head: parsePoint(v.head),
    frontHand: parsePoint(v.frontHand),
    backHand: parsePoint(v.backHand),
    frontFoot: parsePoint(v.frontFoot),
    backFoot: parsePoint(v.backFoot),
  };
  const bends = {
    frontArm: parseBend(v.bends.frontArm),
    backArm: parseBend(v.bends.backArm),
    frontLeg: parseBend(v.bends.frontLeg),
    backLeg: parseBend(v.bends.backLeg),
  };
  const spread = v.shoulderSpread;
  if (Object.values(pts).some((p) => p === null) || Object.values(bends).some((b) => b === null)) return null;
  if (typeof spread !== 'number' || !Number.isFinite(spread)) return null;
  return {
    pelvis: pts.pelvis!,
    chest: pts.chest!,
    head: pts.head!,
    frontHand: pts.frontHand!,
    backHand: pts.backHand!,
    frontFoot: pts.frontFoot!,
    backFoot: pts.backFoot!,
    bends: bends as LimbBends,
    shoulderSpread: Math.min(15, Math.max(0, spread)),
  };
}

function parseAnimation(v: unknown): CustomAnimation | null {
  if (!isRecord(v) || !Array.isArray(v.poses)) return null;
  const bpp = v.beatsPerPose;
  if (typeof bpp !== 'number' || !Number.isFinite(bpp) || bpp < 0.125 || bpp > 8) return null;
  const poses = v.poses.slice(0, MAX_POSES).map(parseRig);
  if (poses.length === 0 || poses.some((p) => p === null)) return null;
  return {
    beatsPerPose: bpp,
    facingCamera: v.facingCamera === true,
    ...(v.upsideDown === true ? { upsideDown: true } : {}),
    poses: (poses as PoseRig[]).map(keepHipsInZone),
  };
}

/**
 * Read a library from untrusted data (a saved file, local storage). Anything
 * malformed is dropped rather than crashing the game.
 */
export function parseLibrary(raw: unknown): AnimationLibrary {
  const out: AnimationLibrary = {};
  if (!isRecord(raw)) return out;
  for (const key of ENEMY_KEYS) {
    const slot = raw[key];
    if (!isRecord(slot)) continue;
    for (const [style, anim] of Object.entries(slot)) {
      if (!STYLE_IDS.has(style)) continue;
      const parsed = parseAnimation(anim);
      if (parsed) (out[key] ??= {})[style as EnemyMotionStyle] = parsed;
    }
  }
  return out;
}

/** `overrides` wins wherever both have an animation for the same enemy + stance. */
export function mergeLibraries(base: AnimationLibrary, overrides: AnimationLibrary): AnimationLibrary {
  const out: AnimationLibrary = {};
  for (const key of ENEMY_KEYS) {
    const merged = { ...base[key], ...overrides[key] };
    if (Object.keys(merged).length > 0) out[key] = merged;
  }
  return out;
}

/** Return a copy of `lib` with one animation set (or removed when `anim` is null). */
export function withAnimation(
  lib: AnimationLibrary,
  key: EnemyKey,
  style: EnemyMotionStyle,
  anim: CustomAnimation | null
): AnimationLibrary {
  const slot = { ...lib[key] };
  if (anim) slot[style] = anim;
  else delete slot[style];
  const out = { ...lib };
  if (Object.keys(slot).length > 0) out[key] = slot;
  else delete out[key];
  return out;
}

/** How many enemy + stance slots have a custom animation. */
export function countAnimations(lib: AnimationLibrary): number {
  return ENEMY_KEYS.reduce((n, k) => n + Object.keys(lib[k] ?? {}).length, 0);
}

/** Minimal storage interface (localStorage fits), so tests can pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const ANIMATION_STORAGE_KEY = 'neon_strike_custom_animations_v1';

export function loadSavedAnimations(store: KeyValueStore | undefined): AnimationLibrary {
  if (!store) return {};
  try {
    return parseLibrary(JSON.parse(store.getItem(ANIMATION_STORAGE_KEY) || '{}'));
  } catch {
    return {};
  }
}

/** Returns false if the browser refused to save (storage full or blocked). */
export function saveAnimations(store: KeyValueStore | undefined, lib: AnimationLibrary): boolean {
  if (!store) return false;
  try {
    store.setItem(ANIMATION_STORAGE_KEY, JSON.stringify(lib));
    return true;
  } catch {
    return false;
  }
}

/** Round to 0.1 so exported files stay small and readable. */
export function roundLibrary(lib: AnimationLibrary): AnimationLibrary {
  return JSON.parse(JSON.stringify(lib, (_k, v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v)));
}
