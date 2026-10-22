/**
 * The end-of-song bosses.
 *
 * Over the last stretch of a song a big boss throws punches (energy fists) on
 * the beat. Hitting a fist on time damages it: PERFECTs hurt most. There are
 * three, and songs take turns:
 *  - Titan King (leaper): stands on one side and every few bars leaps over the
 *    player to the other side.
 *  - Volt Runner (runner): sprints off the edge of the screen and bursts back
 *    in from the other side.
 *  - Twin Warlords (twins): one on each side, neither moves. Each has its own
 *    health and falls on its own.
 * With the single bosses, every third beat charted on the far side still brings
 * a small enemy from there.
 *
 * Letting a fist through is the same as letting any enemy through, so surviving
 * isn't enough to win: the KO needs good timing.
 */
import { EnemyTier, FrequencyBand, Lane, TimingJudgementType } from '../types/game';

export type BossKind = 'leaper' | 'runner' | 'twins';

export interface BossLook {
  /** As said in sentences ("The Titan King survived") */
  name: string;
  /** Drawn as a giant one of these enemies */
  band: FrequencyBand;
  tier: EnemyTier;
  color: string;
  accent: string;
  crown: boolean;
}

export const BOSS_LOOKS: Record<BossKind, BossLook> = {
  leaper: { name: 'Titan King', band: 'sub', tier: 1, color: '#ff1744', accent: '#ffd54a', crown: true },
  // Electric yellow: the fighter is cyan, so a cyan boss would blur into them
  runner: { name: 'Volt Runner', band: 'high', tier: 1, color: '#ffe600', accent: '#ffffff', crown: false },
  twins: { name: 'Twin Warlords', band: 'bass', tier: 1, color: '#9d4dff', accent: '#e1c4ff', crown: false },
};

/** Songs on the soundtrack take turns, in this order. */
export const BOSS_ORDER: BossKind[] = ['leaper', 'runner', 'twins'];

/** Which boss a song gets: by its place on the soundtrack, or (imported songs) from its id, so it never changes. */
export function bossKindFor(trackId: string, soundtrackIds: string[]): BossKind {
  const place = soundtrackIds.indexOf(trackId);
  if (place >= 0) return BOSS_ORDER[place % BOSS_ORDER.length];
  let hash = 0;
  for (const c of trackId) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return BOSS_ORDER[hash % BOSS_ORDER.length];
}

/** How long the boss section lasts, counted back from the last note (seconds). */
export const BOSS_SECONDS = 24;
/** Beats a single boss stays on one side before moving to the other. */
export const SWITCH_BEATS = 8;
/** Damage a fist does to the boss when hit, by timing. */
export const BOSS_DAMAGE: Record<TimingJudgementType, number> = { PERFECT: 3, GOOD: 2, OK: 1, MISS: 0 };
/** Boss health per fist it throws: all GOODs fall short, so the KO needs some PERFECTs. */
export const HP_PER_ATTACK = 2.2;
/** Fists land at least this many beats apart on one side (so no frantic runs on one key). */
export const MIN_GAP_BEATS = 0.5;
/** Of the beats charted on the far side, every this-many-th stays a small enemy. */
export const MINION_EVERY = 3;
/** Songs shorter than this (or with fewer notes) get no boss. 50 s lets the 1-minute opener have one. */
const MIN_SONG_SEC = 50;
const MIN_NOTES = 40;

export interface BossPlan {
  kind: BossKind;
  /** Hit time of the first fist (song seconds) */
  start: number;
  /** Hit time of the last note */
  end: number;
  /** Seconds a single boss stays on one side */
  switchSec: number;
  firstSide: Lane;
  maxHp: number;
  /** Twins: each one's health (they add up to maxHp) */
  sideHp: Record<Lane, number>;
  /** Per note: the lane it comes from (notes in the boss section are moved) */
  lanes: Lane[];
  /** Per note: true when the boss throws it */
  attack: boolean[];
  /** Per note: false when the boss section drops it (too close to the fist before) */
  keep: boolean[];
}

/** Which side a single boss's fists land on at song time `time`. */
export function bossSideAt(plan: Pick<BossPlan, 'start' | 'switchSec' | 'firstSide'>, time: number): Lane {
  const segment = Math.max(0, Math.floor((time - plan.start) / plan.switchSec));
  const other: Lane = plan.firstSide === 'left' ? 'right' : 'left';
  return segment % 2 === 0 ? plan.firstSide : other;
}

/** Plan the boss section for a chart, or null when the song is too short for one. */
export function planBoss(notes: { time: number; lane: Lane }[], bpm: number, kind: BossKind = 'leaper'): BossPlan | null {
  if (notes.length < MIN_NOTES) return null;
  const end = notes[notes.length - 1].time;
  if (end - notes[0].time < MIN_SONG_SEC) return null;

  const firstIndex = notes.findIndex((n) => n.time >= end - BOSS_SECONDS);
  const plan: BossPlan = {
    kind,
    start: notes[firstIndex].time,
    end,
    switchSec: (SWITCH_BEATS * 60) / bpm,
    firstSide: 'right',
    maxHp: 0,
    sideHp: { left: 0, right: 0 },
    lanes: notes.map((n) => n.lane),
    attack: notes.map(() => false),
    keep: notes.map(() => true),
  };

  const minGap = (MIN_GAP_BEATS * 60) / bpm - 0.01;
  if (kind === 'twins') {
    // A twin on each side: every note is a fist from its own side, spaced out per side.
    const lastFist: Record<Lane, number> = { left: -Infinity, right: -Infinity };
    for (let i = firstIndex; i < notes.length; i++) {
      const { time, lane } = notes[i];
      if (time - lastFist[lane] < minGap) {
        plan.keep[i] = false;
        continue;
      }
      plan.attack[i] = true;
      lastFist[lane] = time;
      plan.sideHp[lane] += HP_PER_ATTACK;
    }
    clearAroundFists(plan, notes, bpm, ['left', 'right']);
    plan.sideHp = { left: Math.round(plan.sideHp.left), right: Math.round(plan.sideHp.right) };
    plan.maxHp = plan.sideHp.left + plan.sideHp.right;
    return plan;
  }

  // One boss: every note becomes a fist from its side, except every third far-side beat
  // (which stays a small enemy) and ones too close to the fist before (dropped).
  let lastFist = -Infinity;
  let lastMinion = -Infinity;
  let farSide = 0;
  for (let i = firstIndex; i < notes.length; i++) {
    const { time, lane } = notes[i];
    if (lane !== bossSideAt(plan, time) && farSide++ % MINION_EVERY === 0 && time - lastMinion >= minGap) {
      lastMinion = time;
      continue;
    }
    if (time - lastFist < minGap) {
      plan.keep[i] = false;
      continue;
    }
    plan.lanes[i] = bossSideAt(plan, time);
    plan.attack[i] = true;
    lastFist = time;
  }
  clearAroundFists(plan, notes, bpm, [plan.firstSide]);

  const attacks = plan.attack.filter(Boolean).length;
  plan.maxHp = Math.round(attacks * HP_PER_ATTACK);
  return plan;
}

/**
 * Keep enemies from hiding behind the boss and its fists (players died to both):
 *  - While the boss crashes down, nothing new walks in on the side(s) it lands on,
 *    so no enemy is hidden behind it.
 *  - No ordinary enemy lands within a beat of a fist on the same side, so a fist never
 *    flies out from behind one (one press only takes the first).
 *  - Nothing comes after the last fist: it's the killing blow.
 * Fists themselves are never dropped.
 */
function clearAroundFists(plan: BossPlan, notes: { time: number; lane: Lane }[], bpm: number, landingSides: Lane[]) {
  const beatSec = 60 / bpm;
  // Same timings the game uses: enemies walk for 4 beats (1.1-2.2 s), fists fly for 2
  const flight = fistFlightSec(bpm, Math.max(1.1, Math.min(2.2, beatSec * 4)));
  const landingFrom = plan.start - flight - ENTRANCE_SEC;
  const fists = notes.map((n, i) => ({ time: n.time, lane: plan.lanes[i], i })).filter(({ i }) => plan.attack[i]);
  // The last fist is the killing blow, so it's the last thing to hit: nothing after it
  const lastFist = Math.max(...fists.map((f) => f.time));
  notes.forEach((n, i) => {
    if (plan.attack[i] || !plan.keep[i]) return;
    const lane = plan.lanes[i];
    const landing = n.time >= landingFrom && n.time < plan.start && landingSides.includes(lane);
    const tooClose = fists.some((f) => f.lane === lane && Math.abs(f.time - n.time) < beatSec);
    if (landing || tooClose || n.time > lastFist) plan.keep[i] = false;
  });
}

/** Fists fly for 2 beats (normal enemies walk for 4), so they don't bunch up on the short trip. */
export const FIST_FLIGHT_BEATS = 2;

/** How long a fist is in the air (seconds), never longer than a normal enemy's walk. */
export function fistFlightSec(bpm: number, approachSec: number): number {
  return Math.min(approachSec, (FIST_FLIGHT_BEATS * 60) / bpm);
}

/** How big a boss is drawn, next to a normal enemy. */
export const BOSS_SCALE = 1.7;
/** World x where a boss stands (it throws its fists from here). */
export const BOSS_STAND_X = 235;
/** The twins stand further out, so their swords stay clear of the strike rings. */
export const TWINS_STAND_X = 300;

/** Where this kind of boss stands, and throws its fists from. */
export function standX(kind: BossKind): number {
  return kind === 'twins' ? TWINS_STAND_X : BOSS_STAND_X;
}
/** How long the Titan King's leap over the player takes (seconds). */
export const LEAP_SEC = 0.55;
/** How long the Volt Runner takes to run off one side and back in the other (seconds). */
export const RUN_SEC = 0.75;
/** Where the Volt Runner goes when it runs off screen (world x, beyond every screen's edge). */
export const OFF_SCREEN_X = 620;
/** How long a boss takes to crash down when it arrives (seconds). */
export const ENTRANCE_SEC = 1.2;

export interface BossFigure {
  x: number;
  /** Height off the floor (leaps and the crash-down entrance) */
  lift: number;
  /** The side whose fists it throws */
  side: Lane;
  /** 1 = facing right, -1 = facing left */
  facing: 1 | -1;
  visible: boolean;
  /** True while the Volt Runner is sprinting */
  running: boolean;
}

const faceMiddle = (x: number): 1 | -1 => (x < 0 ? 1 : -1);

/**
 * Where a single boss is at song time `time`. Its side follows the fists it is
 * throwing now (they land `flight` seconds later). It moves to the other side
 * just before the fists switch: the Titan King in an arc over the middle, the
 * Volt Runner off one edge and back in from the other. `visible` is false before it arrives.
 */
export function bossStage(plan: BossPlan, time: number, flight: number): BossFigure {
  const throwing = time + flight;
  const side = bossSideAt(plan, throwing);
  const sign = side === 'left' ? -1 : 1;
  const stand = sign * BOSS_STAND_X;
  const still = (x: number, lift = 0, visible = true): BossFigure => ({ x, lift, side, facing: faceMiddle(x), visible, running: false });

  const arrive = plan.start - flight;
  if (time < arrive - ENTRANCE_SEC) return still(stand, 0, false);
  if (time < arrive) {
    // Crashes down from above
    const u = (time - (arrive - ENTRANCE_SEC)) / ENTRANCE_SEC;
    return still(stand, 320 * (1 - u) * (1 - u));
  }

  // Move to the other side over the last stretch before the next segment, while
  // there are still fists to throw.
  const moveSec = plan.kind === 'runner' ? RUN_SEC : LEAP_SEC;
  const intoSegment = (throwing - plan.start) % plan.switchSec;
  const nextSegmentAt = throwing - intoSegment + plan.switchSec;
  const moveStart = plan.switchSec - moveSec;
  if (intoSegment > moveStart && nextSegmentAt <= plan.end) {
    const u = (intoSegment - moveStart) / moveSec;
    if (plan.kind === 'runner') {
      // Sprints off its own edge, then bursts in from the far edge, still running the same way
      const facing = (sign > 0 ? 1 : -1) as 1 | -1;
      if (u < 0.5) {
        const e = (u / 0.5) ** 2;
        return { x: sign * (BOSS_STAND_X + (OFF_SCREEN_X - BOSS_STAND_X) * e), lift: 0, side, facing, visible: true, running: true };
      }
      const k = (u - 0.5) / 0.5;
      const e = 1 - (1 - k) ** 2;
      return { x: -sign * (OFF_SCREEN_X - (OFF_SCREEN_X - BOSS_STAND_X) * e), lift: 0, side, facing, visible: true, running: true };
    }
    const ease = u * u * (3 - 2 * u);
    return still(sign * BOSS_STAND_X * (1 - 2 * ease), Math.sin(u * Math.PI) * 150);
  }
  return still(stand);
}

/** Every boss figure on screen: one, or the twins (one each side, never moving). */
export function bossFigures(plan: BossPlan, time: number, flight: number): BossFigure[] {
  if (plan.kind !== 'twins') return [bossStage(plan, time, flight)];
  const arrive = plan.start - flight;
  const visible = time >= arrive - ENTRANCE_SEC;
  const u = Math.min(1, Math.max(0, (time - (arrive - ENTRANCE_SEC)) / ENTRANCE_SEC));
  const lift = 320 * (1 - u) * (1 - u);
  return (['left', 'right'] as Lane[]).map((side) => {
    const x = (side === 'left' ? -1 : 1) * TWINS_STAND_X;
    return { x, lift, side, facing: faceMiddle(x), visible, running: false };
  });
}
