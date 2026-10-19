import { AttackMove, MoveKey, SkeletonPose } from '../types/game';
import { assemblePose, EnemyPose, FLOOR, Point, PoseRig } from './enemyMotion';
import { rigFromPose, HipLimits } from './customAnimation';
import { keyToPlayerPose, trailFor, TrailSpec, withHolds } from './heroMoves/poseBuilder';
import type { HeroDefinition, HeroId } from './heroes';

/**
 * Hero moves edited in the Pose Studio. A hero move is a list of keyframes;
 * the studio shows only the real poses (the holds added by withHolds repeat
 * the pose before them, so they're rebuilt rather than edited). Each edited
 * pose is a PoseRig, the same draggable rig the studio uses for enemies,
 * plus how long it takes to reach it.
 *
 * Saved edits replace the built-in poses in the game (stored in this
 * browser). Each pose keeps its hit effect (trail), weapon and shot from the
 * original keyframe, re-aimed from the same limb after the edit.
 */

export interface HeroPoseEdit {
  poses: PoseRig[];
  /** Milliseconds to reach each pose from the one before (the first is ignored) */
  ms: number[];
}

/** Edits by hero, then by move name (STANCE_SLOT for the fighting stance). */
export type HeroPoseLibrary = Partial<Record<HeroId, Record<string, HeroPoseEdit>>>;

/** The slot name for a hero's fighting stance (between attacks). */
export const STANCE_SLOT = 'Stance';

/** Heroes may move their hips further than enemies (they lunge, fly and lie down). */
export const HERO_HIP_LIMITS: HipLimits = { zone: 12, lowest: FLOOR - 8 };

/** Each pose's duration choices in the studio (ms). */
export const POSE_MS_OPTIONS = [40, 60, 80, 100, 120, 150, 200, 250, 300, 400];

/** The poses of a move you can edit (holds left out). */
export function realKeys(move: AttackMove): MoveKey[] {
  return (move.sequence ?? []).filter((k) => !k.hold);
}

export function editFromMove(move: AttackMove): HeroPoseEdit {
  const keys = realKeys(move);
  return { poses: keys.map((k) => rigFromPose(k.pose)), ms: keys.map((k) => k.ms) };
}

/** The player skeleton maps the front limbs to "left" (see playerPoseFromEnemyPose). */
function rigFromPlayerPose(p: SkeletonPose): PoseRig {
  return rigFromPose({
    head: p.head,
    chest: p.chest,
    pelvis: p.pelvis,
    frontShoulder: p.leftShoulder,
    frontElbow: p.leftElbow,
    frontHand: p.leftHand,
    backShoulder: p.rightShoulder,
    backElbow: p.rightElbow,
    backHand: p.rightHand,
    frontKnee: p.leftKnee,
    frontFoot: p.leftFoot,
    backKnee: p.rightKnee,
    backFoot: p.rightFoot,
    stomp: 0,
    facingCamera: false,
  } as EnemyPose);
}

export function editFromStance(idle: SkeletonPose): HeroPoseEdit {
  return { poses: [rigFromPlayerPose(idle)], ms: [0] };
}

/** The limbs a hit trail can come from, and their two points in a pose. */
const TRAIL_LIMBS: Array<{ from: TrailSpec['from']; joint: (p: EnemyPose) => Point; end: (p: EnemyPose) => Point }> = [
  { from: 'frontHand', joint: (p) => p.frontElbow, end: (p) => p.frontHand },
  { from: 'backHand', joint: (p) => p.backElbow, end: (p) => p.backHand },
  { from: 'frontFoot', joint: (p) => p.frontKnee, end: (p) => p.frontFoot },
  { from: 'backFoot', joint: (p) => p.backKnee, end: (p) => p.backFoot },
  { from: 'frontElbow', joint: (p) => p.frontShoulder, end: (p) => p.frontElbow },
  { from: 'frontKnee', joint: (p) => p.pelvis, end: (p) => p.frontKnee },
  { from: 'head', joint: (p) => p.chest, end: (p) => p.head },
];

/** Work out which limb a built trail came from, and how far past it it reaches. */
export function trailSource(pose: EnemyPose, trail: NonNullable<MoveKey['trail']>): { spec: TrailSpec; color: string } {
  let best = { error: Infinity, spec: { from: 'frontHand', reach: 14, curve: trail.curveOffset } as TrailSpec };
  for (const limb of TRAIL_LIMBS) {
    const j = limb.joint(pose);
    const e = limb.end(pose);
    const len = Math.hypot(e.x - j.x, e.y - j.y) || 1;
    const reach = Math.hypot(trail.end.x - e.x, trail.end.y - e.y);
    const expected = { x: e.x + ((e.x - j.x) / len) * reach, y: e.y + ((e.y - j.y) / len) * reach };
    const error = Math.hypot(expected.x - trail.end.x, expected.y - trail.end.y);
    if (error < best.error) best = { error, spec: { from: limb.from, reach, curve: trail.curveOffset } };
  }
  return { spec: best.spec, color: trail.color };
}

/** Rebuild a move from an edit: new poses and timings, each keeping its original hit effect and weapon. */
export function applyEdit(move: AttackMove, edit: HeroPoseEdit): AttackMove {
  const originals = realKeys(move);
  const keys: MoveKey[] = edit.poses.map((rig, i) => {
    // Added poses borrow the effect of the pose they were copied from (the nearest earlier one).
    const source = originals[Math.min(i, originals.length - 1)];
    const pose = assemblePose(rig, 0, false);
    const key: MoveKey = { pose, ms: i === 0 ? 0 : Math.max(20, edit.ms[i] ?? 120) };
    if (source.trail) {
      const { spec, color } = trailSource(source.pose, source.trail);
      key.trail = trailFor(pose, spec, color);
      if (source.shot) key.shot = source.shot;
    }
    if (source.prop) key.prop = source.prop;
    if (source.spin) key.spin = source.spin;
    return key;
  });
  // The first pose is the hit: it must have a hit effect.
  if (!keys[0].trail && originals[0].trail) {
    const { spec, color } = trailSource(originals[0].pose, originals[0].trail);
    keys[0].trail = trailFor(keys[0].pose, spec, color);
  }
  // Heroes built before holds existed (the Little Dragon) stay without them.
  const hadHolds = (move.sequence ?? []).some((k) => k.hold);
  const sequence = hadHolds ? withHolds(keys) : keys;
  const durationMs = 50 + sequence.slice(1).reduce((s, k) => s + k.ms, 0) + 140;
  return { ...move, durationMs, pose: keyToPlayerPose(sequence[0]), sequence };
}

/** A hero with any saved edits applied (moves matched by name). */
export function heroWithEdits(hero: HeroDefinition, lib: HeroPoseLibrary): HeroDefinition {
  const edits = lib[hero.id];
  if (!edits || Object.keys(edits).length === 0) return hero;
  const stance = edits[STANCE_SLOT];
  return {
    ...hero,
    idlePose: stance ? keyToPlayerPose({ pose: assemblePose(stance.poses[0], 0, false), ms: 0 }) : hero.idlePose,
    moves: hero.moves.map((m) => (edits[m.name] ? applyEdit(m, edits[m.name]) : m)),
  };
}

const STORAGE_KEY = 'neon_strike_hero_poses_v1';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const isPoint = (p: unknown): p is Point =>
  !!p && typeof (p as Point).x === 'number' && typeof (p as Point).y === 'number' && Number.isFinite((p as Point).x) && Number.isFinite((p as Point).y);

function isRig(r: unknown): r is PoseRig {
  const rig = r as PoseRig;
  return (
    !!rig &&
    ['pelvis', 'chest', 'head', 'frontHand', 'backHand', 'frontFoot', 'backFoot'].every((k) => isPoint((rig as unknown as Record<string, unknown>)[k])) &&
    !!rig.bends &&
    typeof rig.shoulderSpread === 'number'
  );
}

/** Read saved edits, dropping anything malformed (never throws). */
export function parseHeroPoses(raw: unknown): HeroPoseLibrary {
  const out: HeroPoseLibrary = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [hero, moves] of Object.entries(raw as Record<string, unknown>)) {
    if (!moves || typeof moves !== 'object') continue;
    for (const [name, edit] of Object.entries(moves as Record<string, unknown>)) {
      const e = edit as HeroPoseEdit;
      if (!e || !Array.isArray(e.poses) || e.poses.length === 0 || !e.poses.every(isRig) || !Array.isArray(e.ms)) continue;
      const slot = (out[hero as HeroId] ??= {});
      slot[name] = { poses: e.poses, ms: e.poses.map((_, i) => (typeof e.ms[i] === 'number' ? e.ms[i] : 120)) };
    }
  }
  return out;
}

export function loadHeroPoses(store: Pick<Storage, 'getItem'> | undefined): HeroPoseLibrary {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    return raw ? parseHeroPoses(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function saveHeroPoses(store: Store | undefined, lib: HeroPoseLibrary): boolean {
  try {
    if (!store) return false;
    store.setItem(STORAGE_KEY, JSON.stringify(lib));
    return true;
  } catch {
    return false;
  }
}

/** One edit, tidied up for pasting into a chat: rounded numbers, hero and move named. */
export function editForSharing(hero: HeroId, move: string, edit: HeroPoseEdit): string {
  const r = (n: number) => Math.round(n * 10) / 10;
  const pt = (p: Point) => ({ x: r(p.x), y: r(p.y) });
  return JSON.stringify({
    hero,
    move,
    poses: edit.poses.map((rig, i) => ({
      ms: edit.ms[i],
      pelvis: pt(rig.pelvis),
      chest: pt(rig.chest),
      head: pt(rig.head),
      frontHand: pt(rig.frontHand),
      backHand: pt(rig.backHand),
      frontFoot: pt(rig.frontFoot),
      backFoot: pt(rig.backFoot),
      bends: rig.bends,
    })),
  });
}
