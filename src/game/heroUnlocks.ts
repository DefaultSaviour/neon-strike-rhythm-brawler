import type { HeroId } from './heroes';

/**
 * Heroes are earned by playing. Each locked hero has one goal, measured on
 * the player's lifetime totals (kept across songs and sessions), so every
 * song moves them closer to the next hero, even a song they don't finish.
 * The goals mix kinds on purpose: some reward simply playing, some reward
 * finishing a song, some reward skill (big combos, PERFECT hits).
 */

/** The player's totals over every song they have ever played. */
export interface LifetimeStats {
  /** Enemies defeated (every hit, any judgement) */
  enemiesDefeated: number;
  /** PERFECT hits */
  perfects: number;
  /** Biggest combo ever reached in one song */
  bestCombo: number;
  /** Songs finished without dying */
  songsCleared: number;
  /** Seconds spent playing songs (not menus): unlocks enemy stances, see stanceUnlocks */
  playSeconds: number;
  /** Enemy stances unlocked early by watching a rewarded ad */
  adUnlocks: number;
}

export const EMPTY_STATS: LifetimeStats = { enemiesDefeated: 0, perfects: 0, bestCombo: 0, songsCleared: 0, playSeconds: 0, adUnlocks: 0 };

export interface UnlockGoal {
  stat: keyof LifetimeStats;
  target: number;
  /** Shown on the locked hero, e.g. "Defeat 150 enemies" */
  label: string;
}

/** What it takes to earn each hero. Heroes not listed are free from the start. */
export const HERO_UNLOCKS: Partial<Record<HeroId, UnlockGoal>> = {
  dragon: { stat: 'enemiesDefeated', target: 150, label: 'Defeat 150 enemies' },
  theOne: { stat: 'songsCleared', target: 1, label: 'Complete any song' },
  drunkenMaster: { stat: 'bestCombo', target: 50, label: 'Reach a 50 combo' },
  stallion: { stat: 'songsCleared', target: 3, label: 'Complete 3 songs' },
  kid: { stat: 'playSeconds', target: 1800, label: 'Train for 30 minutes' },
  spartan: { stat: 'enemiesDefeated', target: 300, label: 'Defeat 300 enemies' },
  proWrestler: { stat: 'enemiesDefeated', target: 1000, label: 'Defeat 1,000 enemies' },
  babaYaga: { stat: 'bestCombo', target: 100, label: 'Reach a 100 combo' },
  ballerina: { stat: 'perfects', target: 200, label: 'Land 200 PERFECT hits' },
};

/** Heroes in the order players earn them, easiest first: the picker lists them this way, as a path. */
export const UNLOCK_ORDER: HeroId[] = ['striker', 'dragon', 'theOne', 'drunkenMaster', 'stallion', 'spartan', 'kid', 'proWrestler', 'babaYaga', 'ballerina'];

export function isHeroUnlocked(id: HeroId, stats: LifetimeStats): boolean {
  const goal = HERO_UNLOCKS[id];
  return !goal || stats[goal.stat] >= goal.target;
}

/** How far the player is toward a locked hero (null for free heroes). */
export function unlockProgress(id: HeroId, stats: LifetimeStats): { goal: UnlockGoal; current: number; done: boolean } | null {
  const goal = HERO_UNLOCKS[id];
  if (!goal) return null;
  const current = Math.min(goal.target, stats[goal.stat]);
  return { goal, current, done: current >= goal.target };
}

/** One song's results, as they count toward the totals. */
export interface RunResult {
  enemiesDefeated: number;
  perfects: number;
  maxCombo: number;
  cleared: boolean;
  /** How long the song was played for */
  seconds: number;
}

export function addRun(stats: LifetimeStats, run: RunResult): LifetimeStats {
  return {
    enemiesDefeated: stats.enemiesDefeated + run.enemiesDefeated,
    perfects: stats.perfects + run.perfects,
    bestCombo: Math.max(stats.bestCombo, run.maxCombo),
    songsCleared: stats.songsCleared + (run.cleared ? 1 : 0),
    playSeconds: stats.playSeconds + Math.max(0, run.seconds),
    adUnlocks: stats.adUnlocks,
  };
}

/** Heroes that were locked before and are unlocked now, in the order they appear in `ids`. */
export function newlyUnlocked(ids: readonly HeroId[], before: LifetimeStats, after: LifetimeStats): HeroId[] {
  return ids.filter((id) => !isHeroUnlocked(id, before) && isHeroUnlocked(id, after));
}

const STORAGE_KEY = 'neon_strike_lifetime_v1';

/** Read the totals. Missing, broken or partial saves count as zeros, never as an error. */
export function loadStats(store: Pick<Storage, 'getItem'> | undefined): LifetimeStats {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATS };
    const parsed = JSON.parse(raw) as Partial<LifetimeStats>;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
    return {
      enemiesDefeated: num(parsed.enemiesDefeated),
      perfects: num(parsed.perfects),
      bestCombo: num(parsed.bestCombo),
      songsCleared: num(parsed.songsCleared),
      playSeconds: num(parsed.playSeconds),
      adUnlocks: num(parsed.adUnlocks),
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

export function saveStats(store: Pick<Storage, 'setItem'> | undefined, stats: LifetimeStats) {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Private modes can refuse storage; the unlocks then last for this visit only.
  }
}
