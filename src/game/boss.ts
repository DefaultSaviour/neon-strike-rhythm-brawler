/**
 * The end-of-song bosses.
 *
 * Over the last stretch of a song a big boss throws punches (energy fists) on
 * the beat. Every fist hit back takes off the same chunk of its health, so the
 * bar empties exactly on its last fist: the killing blow. There are four, and
 * each play of a song meets one at random (never the same one twice running):
 *  - Titan King (leaper): stands on one side and every few bars leaps over the
 *    player to the other side.
 *  - Volt Runner (runner): sprints off the edge of the screen and bursts back
 *    in from the other side. Just before each dash it throws slow lightning
 *    bolts, and they're still flying in when it starts throwing from the new
 *    side, so for a moment shots come from both sides.
 *  - Twin Warlords (twins): one on each side, neither moves. Each throws the
 *    notes charted on its own side. Each has its own health and falls on its own.
 *  - Shadow Fighter (shadow): a giant dark copy of your own fighter, copying
 *    your moves. Its fists travel hidden in shadow, a faint wisp until they
 *    light up for the last beat before they land: watch its wind-up and go
 *    with the music. It throws a quick group of 1 to 3 shots, then teleports
 *    to the other side for the next group: it fades out, a portal opens on the
 *    other side, and it steps out of it and throws.
 * With the Titan King and the Volt Runner, every third beat charted on the far
 * side still brings a small enemy from there.
 *
 * Halfway through, the boss gets angry and adds its own twist:
 *  - Titan King: lobs some fists high over the player, down onto the far side
 *    (a target shows where each will land).
 *  - Volt Runner: dashes across twice as often (so more bolts overlap).
 *  - Twin Warlords: no new move, just the angry glow.
 *  - Shadow Fighter: bigger groups (2 to 4 shots), and teleports quicker (a beat
 *    between groups, not two).
 *
 * Every fist is wound up in the boss's hand for a beat before it's thrown, so
 * you can see it coming.
 *
 * Letting a fist through is the same as letting any enemy through, so in a real
 * run getting through the boss alive is the KO. (In practice a fist that gets
 * through leaves it standing.)
 */
import { EnemyTier, FrequencyBand, Lane } from '../types/game';

export type BossKind = 'leaper' | 'runner' | 'twins' | 'shadow';
/**
 * How a fist flies: straight at the player, lobbed over them onto the far side (the
 * Titan King), or as a slow lightning bolt (the Volt Runner, just before it dashes).
 */
export type BossMove = 'fist' | 'lob' | 'bolt';

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
  // Drawn as your own fighter (band and tier only shape the pieces it shatters into)
  shadow: { name: 'Shadow Fighter', band: 'sub', tier: 2, color: '#ff2bd6', accent: '#ffd1f7', crown: false },
};

export const BOSS_KINDS: BossKind[] = ['leaper', 'runner', 'twins', 'shadow'];

/** A boss for this play of a song, at random, but never the one met last time. */
export function pickBossKind(previous: BossKind | null, random: () => number = Math.random): BossKind {
  const choices = BOSS_KINDS.filter((k) => k !== previous);
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}

/** How long the boss section lasts, counted back from the last note (seconds). */
export const BOSS_SECONDS = 24;
/** Beats the Titan King and the Volt Runner stay on one side before moving to the other. */
export const SWITCH_BEATS = 8;
/** Once angry, the Volt Runner dashes every this-many beats. */
export const RAGE_SWITCH_BEATS = 4;
/** Beats between the Shadow Fighter's groups of shots, for its teleport (then, once angry, the second). */
export const SHADOW_GAP_BEATS = [2, 1];
/** How many shots in each of the Shadow Fighter's groups, at random: [fewest, most] (then once angry). */
export const SHADOW_GROUP: [number, number][] = [
  [1, 3],
  [2, 4],
];
/** Boss health per fist it throws: every fist hit back does the same damage, whatever the timing. */
export const HP_PER_ATTACK = 1;
/** Fists land at least this many beats apart on one side (so no frantic runs on one key). */
export const MIN_GAP_BEATS = 0.5;
/** A lobbed fist lands at least this many beats from any other fist, so there's time to turn. */
export const LOB_CLEAR_BEATS = 1;
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
  /** Seconds the Titan King or the Volt Runner stays on one side before it gets angry */
  switchSec: number;
  /** Song times (when fists land) where a single boss's fists change side (the Shadow Fighter: each group after the first) */
  switches: number[];
  /** The Shadow Fighter: when the last shot before each switch lands (it teleports in between) */
  groupEnds: number[];
  /** From here on (when fists land) it's angry */
  rageAt: number;
  /** The side a single boss starts on */
  firstSide: Lane;
  maxHp: number;
  /** Twins: each one's health (they add up to maxHp) */
  sideHp: Record<Lane, number>;
  /** Per note: the lane it comes from (notes in the boss section are moved) */
  lanes: Lane[];
  /** Per note: true when the boss throws it */
  attack: boolean[];
  /** Per note: how the boss throws it (null for anything that isn't a fist) */
  moves: (BossMove | null)[];
  /** Per note: false when the boss section drops it (too close to the fist before) */
  keep: boolean[];
}

/** Which side a single boss's fists land on at song time `time`. */
export function bossSideAt(plan: Pick<BossPlan, 'switches' | 'firstSide'>, time: number): Lane {
  let flips = 0;
  for (const s of plan.switches) {
    if (s > time) break;
    flips++;
  }
  const other: Lane = plan.firstSide === 'left' ? 'right' : 'left';
  return flips % 2 === 0 ? plan.firstSide : other;
}

/** A small seeded random source, so a song's boss plan is the same every time it's worked out. */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * When the sides change: every 8 beats, then (once angry) every 4 for the Volt Runner.
 * The twins never change sides, and the Shadow Fighter's follow its shots (see planBoss).
 */
function planSwitches(kind: BossKind, start: number, end: number, bpm: number, rageAt: number): number[] {
  if (kind === 'twins' || kind === 'shadow') return [];
  const beatSec = 60 / bpm;
  const switches: number[] = [];
  let t = start;
  for (;;) {
    const fast = kind === 'runner' && t >= rageAt - 0.01;
    t += (fast ? RAGE_SWITCH_BEATS : SWITCH_BEATS) * beatSec;
    if (t > end) return switches;
    switches.push(t);
  }
}

/** How long enemies walk in for at this tempo (seconds): 4 beats, kept between 1.1 and 2.2 s. */
export function approachSecFor(bpm: number): number {
  return Math.max(1.1, Math.min(2.2, (60 / bpm) * 4));
}

/** Plan the boss section for a chart, or null when the song is too short for one. */
export function planBoss(notes: { time: number; lane: Lane }[], bpm: number, kind: BossKind = 'leaper'): BossPlan | null {
  if (notes.length < MIN_NOTES) return null;
  const end = notes[notes.length - 1].time;
  if (end - notes[0].time < MIN_SONG_SEC) return null;

  const firstIndex = notes.findIndex((n) => n.time >= end - BOSS_SECONDS);
  const start = notes[firstIndex].time;
  const rageAt = start + (end - start) / 2;
  const plan: BossPlan = {
    kind,
    start,
    end,
    switchSec: (SWITCH_BEATS * 60) / bpm,
    switches: planSwitches(kind, start, end, bpm, rageAt),
    groupEnds: [],
    rageAt,
    firstSide: 'right',
    maxHp: 0,
    sideHp: { left: 0, right: 0 },
    lanes: notes.map((n) => n.lane),
    attack: notes.map(() => false),
    moves: notes.map(() => null),
    keep: notes.map(() => true),
  };

  const beatSec = 60 / bpm;
  const minGap = MIN_GAP_BEATS * beatSec - 0.01;

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
      plan.moves[i] = 'fist';
      lastFist[lane] = time;
      plan.sideHp[lane] += HP_PER_ATTACK;
    }
    clearAroundFists(plan, notes, bpm, ['left', 'right']);
    plan.sideHp = { left: Math.round(plan.sideHp.left), right: Math.round(plan.sideHp.right) };
    plan.maxHp = plan.sideHp.left + plan.sideHp.right;
    return plan;
  }

  if (kind === 'shadow') {
    // A quick group of shots from one side (half a beat apart at least), then a gap while it
    // teleports, then the next group from the other side.
    const random = seededRandom(Math.round(start * 1000));
    let side = plan.firstSide;
    let last = -Infinity;
    let left = 0; // shots still to come in this group
    for (let i = firstIndex; i < notes.length; i++) {
      const { time } = notes[i];
      const angry = time >= rageAt ? 1 : 0;
      if (left === 0) {
        // A new group: after a gap for the teleport (none before the first)
        if (time - last < SHADOW_GAP_BEATS[angry] * beatSec - 0.01) {
          plan.keep[i] = false;
          continue;
        }
        if (last > -Infinity) {
          plan.switches.push(time);
          plan.groupEnds.push(last);
          side = side === 'left' ? 'right' : 'left';
        }
        const [fewest, most] = SHADOW_GROUP[angry];
        left = fewest + Math.floor(random() * (most - fewest + 1));
      } else if (time - last < minGap) {
        plan.keep[i] = false;
        continue;
      }
      plan.attack[i] = true;
      plan.moves[i] = 'fist';
      plan.lanes[i] = side;
      left--;
      last = time;
    }
    clearAroundFists(plan, notes, bpm, [plan.firstSide]);
    plan.maxHp = Math.round(plan.attack.filter(Boolean).length * HP_PER_ATTACK);
    return plan;
  }

  // The Titan King and the Volt Runner: every note becomes a fist from its side, except
  // every third far-side beat (which stays a small enemy, or once the Titan King is angry,
  // a fist lobbed over the player) and ones too close to the fist before (dropped).
  let lastFist = -Infinity;
  let lastMinion = -Infinity;
  let farSide = 0;
  for (let i = firstIndex; i < notes.length; i++) {
    const { time, lane } = notes[i];
    if (lane !== bossSideAt(plan, time) && farSide++ % MINION_EVERY === 0 && time - lastMinion >= minGap) {
      lastMinion = time;
      if (kind === 'leaper' && time >= rageAt) {
        plan.attack[i] = true;
        plan.moves[i] = 'lob';
      }
      continue;
    }
    if (time - lastFist < minGap) {
      plan.keep[i] = false;
      continue;
    }
    plan.lanes[i] = bossSideAt(plan, time);
    plan.attack[i] = true;
    plan.moves[i] = 'fist';
    lastFist = time;
  }
  if (kind === 'leaper') keepLobsFair(plan, notes, bpm);
  if (kind === 'runner') overlapDashes(plan, notes, bpm);
  clearAroundFists(plan, notes, bpm, [plan.firstSide]);

  const attacks = plan.attack.filter(Boolean).length;
  plan.maxHp = Math.round(attacks * HP_PER_ATTACK);
  return plan;
}

/** Lobs land at least this many beats apart: one is a big moment, not a barrage. */
export const LOB_EVERY_BEATS = 4;

/**
 * The Volt Runner's dash: the fists it would throw while sprinting become slow bolts thrown
 * just before it goes, and they're still flying in when it starts throwing from the new
 * side. So for a moment after each switch the shots take turns: a fist from the new side,
 * a bolt from the old, a fist from the new... (just a bolt, when only one shot lands then).
 * The bolts are slow enough for this from about 110 BPM; at slower tempos the overlap
 * shrinks, and fists that would be thrown mid-dash with no time for a bolt are left out.
 */
function overlapDashes(plan: BossPlan, notes: { time: number; lane: Lane }[], bpm: number) {
  const beatSec = 60 / bpm;
  const approach = approachSecFor(bpm);
  const fist = fistFlightSec(bpm, approach, 'runner');
  const bolt = fistFlightSec(bpm, approach, 'runner', 'bolt');
  const dash = RUN_BEATS * beatSec;
  // Bolts landing up to this long after the switch were thrown before the dash began
  const overlap = bolt - fist - dash;
  for (const s of plan.switches) {
    const oldSide = bossSideAt(plan, s - 1e-6);
    const afterSwitch: number[] = [];
    notes.forEach((n, i) => {
      if (n.time < s - dash || n.time >= s + Math.max(0, overlap) || plan.moves[i] !== 'fist') return;
      if (n.time < s) {
        // Thrown mid-dash: a bolt thrown before it instead, when one can make it
        if (n.time <= s + overlap + 1e-6) plan.moves[i] = 'bolt';
        else {
          plan.attack[i] = false;
          plan.moves[i] = null;
          plan.keep[i] = false;
        }
        return;
      }
      afterSwitch.push(i);
    });
    // Just after the switch: every other shot is a bolt still flying in from the old side
    afterSwitch.forEach((i, k) => {
      if (k % 2 === 0 && afterSwitch.length > 1) return;
      plan.lanes[i] = oldSide;
      plan.moves[i] = 'bolt';
    });
  }
}

/**
 * A lob stays a lob only when it's fair: the boss is standing still on the other side
 * when it's thrown (and stays there till it lands), and there's been no other in the last
 * bar. Then the fists landing within a beat either side of it are left out, so there's
 * time to turn and back. Otherwise it goes back to being a small enemy from the far side.
 */
function keepLobsFair(plan: BossPlan, notes: { time: number; lane: Lane }[], bpm: number) {
  const beatSec = 60 / bpm;
  const approach = approachSecFor(bpm);
  const flight = fistFlightSec(bpm, approach, plan.kind);
  let lastLob = -Infinity;
  notes.forEach((n, i) => {
    const move = plan.moves[i];
    if (move !== 'lob') return;
    const moveFlight = fistFlightSec(bpm, approach, plan.kind, move);
    const thrower = bossStage(plan, n.time - moveFlight, flight);
    const standing = thrower.visible && thrower.lift === 0 && thrower.side !== n.lane;
    // Its landing side must be the far side the whole way down (no switch in between)
    const sameSideAll = bossSideAt(plan, n.time - moveFlight + flight) === bossSideAt(plan, n.time);
    const spaced = n.time - lastLob >= LOB_EVERY_BEATS * beatSec - 0.01;
    if (standing && sameSideAll && spaced) {
      lastLob = n.time;
      notes.forEach((m, j) => {
        if (j === i || !plan.attack[j] || Math.abs(m.time - n.time) >= LOB_CLEAR_BEATS * beatSec - 0.01) return;
        plan.attack[j] = false;
        plan.moves[j] = null;
        plan.keep[j] = false;
      });
      return;
    }
    plan.attack[i] = false;
    plan.moves[i] = null;
  });
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
  const flight = fistFlightSec(bpm, approachSecFor(bpm), plan.kind);
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

/**
 * Beats a fist is in the air. The single bosses stand close, so 2; the twins stand
 * further out and both throw, so 3 (normal enemies walk for 4). Lobs go
 * high over the player, so 3; the Volt Runner's bolts are slow, so 4.
 */
export const FIST_FLIGHT_BEATS: Record<BossKind, number> = { leaper: 2, runner: 2, twins: 3, shadow: 2 };
export const LOB_FLIGHT_BEATS = 3;
export const BOLT_FLIGHT_BEATS = 4;
/** Beats a boss winds a fist up in its hand before it throws it. */
export const WINDUP_BEATS = 1;
/** The Shadow Fighter's fists light up for this many beats before they land (hidden in shadow before that). */
export const SHADOW_SHOWN_BEATS = 1;
/** ...fading in over this much of a beat. */
const SHADOW_FADE_BEATS = 0.2;

/** How much a Shadow Fighter fist shows (0 hidden in shadow, 1 lit up), `timeLeft` seconds before it lands. */
export function shadowFistShown(timeLeft: number, bpm: number): number {
  const beatSec = 60 / bpm;
  return Math.min(1, Math.max(0, (SHADOW_SHOWN_BEATS * beatSec - timeLeft) / (SHADOW_FADE_BEATS * beatSec)));
}

/** How long a fist is in the air (seconds), never longer than a normal enemy's walk. */
export function fistFlightSec(bpm: number, approachSec: number, kind: BossKind = 'leaper', move: BossMove = 'fist'): number {
  const beats = move === 'lob' ? LOB_FLIGHT_BEATS : move === 'bolt' ? BOLT_FLIGHT_BEATS : FIST_FLIGHT_BEATS[kind];
  return Math.min(approachSec, (beats * 60) / bpm);
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

/** A lob leaves the boss's raised hand this high, and arcs this much higher on the way over. */
export const LOB_START_LIFT = 130;
export const LOB_ARC = 130;

/**
 * Where a fist is (world x, and height above where straight fists fly), `t` of the way
 * back from its beat: 1 when thrown, 0 on the beat. Straight fists fly level from the
 * boss to the strike line on their own side; lobs go up from the boss's raised hand,
 * over the player, and drop onto the strike line on the far side.
 */
export function fistPath(kind: BossKind, move: BossMove, lane: Lane, hitLineOffset: number, t: number): { x: number; lift: number } {
  const sign = lane === 'left' ? -1 : 1;
  const hitX = sign * hitLineOffset;
  if (move === 'lob') {
    const k = Math.min(1, Math.max(0, t));
    const fromX = -sign * standX(kind);
    const p = 1 - k;
    return { x: hitX + (fromX - hitX) * k, lift: LOB_ARC * 4 * p * k + LOB_START_LIFT * k };
  }
  return { x: hitX + (sign * standX(kind) - hitX) * t, lift: 0 };
}

/** How long the Titan King's leap over the player takes (seconds). */
export const LEAP_SEC = 0.55;
/** How long the Volt Runner takes to run off one side and back in the other (beats): a blur. */
export const RUN_BEATS = 1;
/** Where the Volt Runner goes when it runs off screen (world x, beyond every screen's edge). */
export const OFF_SCREEN_X = 620;
/** How long a boss takes to crash down when it arrives (seconds). */
export const ENTRANCE_SEC = 1.2;
/**
 * The Shadow Fighter's teleport takes a beat (or 3/4 of the gap between its groups, if that's
 * shorter): it fades out over the first part, then its portal opens on the other side.
 */
export const TELEPORT_BEATS = 1;
export const TELEPORT_SHARE = 0.75;
export const TELEPORT_VANISH = 0.25;

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
  /** It's angry (the second half of the fight) */
  angry: boolean;
  /** How solid it is: 1 normally, less as the Shadow Fighter fades out, 0 while it's gone */
  fade: number;
  /** The Shadow Fighter: its portal opening here (0..1), 0 when there's none */
  portal: number;
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
  const angry = throwing >= plan.rageAt;
  const still = (x: number, lift = 0, visible = true, fade = 1, portal = 0): BossFigure => ({
    x,
    lift,
    side,
    facing: faceMiddle(x),
    visible,
    running: false,
    angry,
    fade,
    portal,
  });

  const arrive = plan.start - flight;
  if (time < arrive - ENTRANCE_SEC) return still(stand, 0, false);
  if (time < arrive) {
    const u = (time - (arrive - ENTRANCE_SEC)) / ENTRANCE_SEC;
    // The Shadow Fighter steps out of a portal; the others crash down from above
    if (plan.kind === 'shadow') return still(stand, 0, true, 0, u);
    return still(stand, 320 * (1 - u) * (1 - u));
  }

  // Move to the other side over the last stretch before the next switch
  const beatSec = plan.switchSec / SWITCH_BEATS;
  const next = plan.switches.find((s) => s > throwing);
  let moveSec = plan.kind === 'runner' ? RUN_BEATS * beatSec : LEAP_SEC;
  if (plan.kind === 'shadow' && next !== undefined) {
    const groupEnd = plan.groupEnds[plan.switches.indexOf(next)];
    moveSec = Math.min(TELEPORT_BEATS * beatSec, TELEPORT_SHARE * (next - groupEnd));
  }
  if (next !== undefined && next - throwing < moveSec) {
    const u = 1 - (next - throwing) / moveSec;
    if (plan.kind === 'shadow') {
      // Fades out where it stands, then its portal opens on the other side
      if (u < TELEPORT_VANISH) return still(stand, 0, true, 1 - u / TELEPORT_VANISH);
      return still(-stand, 0, true, 0, (u - TELEPORT_VANISH) / (1 - TELEPORT_VANISH));
    }
    if (plan.kind === 'runner') {
      // Sprints off its own edge, then bursts in from the far edge, still running the same way
      const facing = (sign > 0 ? 1 : -1) as 1 | -1;
      const run = (x: number): BossFigure => ({ x, lift: 0, side, facing, visible: true, running: true, angry, fade: 1, portal: 0 });
      if (u < 0.5) {
        const e = (u / 0.5) ** 2;
        return run(sign * (BOSS_STAND_X + (OFF_SCREEN_X - BOSS_STAND_X) * e));
      }
      const k = (u - 0.5) / 0.5;
      const e = 1 - (1 - k) ** 2;
      return run(-sign * (OFF_SCREEN_X - (OFF_SCREEN_X - BOSS_STAND_X) * e));
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
  const angry = time + flight >= plan.rageAt;
  return (['left', 'right'] as Lane[]).map((side) => {
    const x = (side === 'left' ? -1 : 1) * TWINS_STAND_X;
    return { x, lift, side, facing: faceMiddle(x), visible, running: false, angry, fade: 1, portal: 0 };
  });
}
