import type { HeroId } from './heroes';
import { backdropsAfterRun, milestonesFor } from './backdrops';

/**
 * Heroes are earned by playing. Each locked hero has one goal, measured on
 * the player's lifetime totals (kept across songs and sessions), so every
 * song moves them closer to the next hero, even a song they don't finish.
 * The goals mix kinds on purpose: some reward simply playing, some reward
 * finishing a song, some reward skill (big combos, PERFECT hits, a song
 * finished at 98% accuracy or with no misses at all). One hero (The Bride)
 * can also be unlocked straight away by watching a rewarded ad.
 *
 * The numbers were set with the user on 2026-10-20, one hero at a time,
 * after one song (about 500 enemies) unlocked five or more heroes at once.
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
  /** Rewarded ads watched to unlock the ad hero (The Bride) early */
  heroAds: number;
  /** Every song's score added together (the Records screen's Total Score); also unlocks backdrops */
  totalScore: number;
  /** Backdrop pieces unlocked early by watching a rewarded ad (see backdrops) */
  backdropAds: number;
  /** Backdrop pieces opened by score milestones: at most one more per song (see backdrops) */
  backdropsUnlocked: number;
  /** OK hits (the sloppiest hit that still counts) */
  okHits: number;
  /** Best accuracy (0-100) of any song finished without dying */
  bestClearAccuracy: number;
  /** Songs finished without a single miss */
  flawlessClears: number;
  /** Most misses (swings at nothing) in one song that was still finished: Drunken Master's goal */
  mostMissesCleared: number;
  /** Songs that ended with an enemy getting through (not quitting): The Scarecrow's goal */
  songsDied: number;
  /** Songs quit part way (Quit to Main Menu): The Lion's goal */
  songsQuit: number;
  /** Most OK hits in a row in one song (a PERFECT, GOOD or miss breaks it): The Tin Man's goal */
  bestOkStreak: number;
}

export const EMPTY_STATS: LifetimeStats = { enemiesDefeated: 0, perfects: 0, bestCombo: 0, songsCleared: 0, playSeconds: 0, adUnlocks: 0, heroAds: 0, totalScore: 0, backdropAds: 0, backdropsUnlocked: 0, okHits: 0, bestClearAccuracy: 0, flawlessClears: 0, mostMissesCleared: 0, songsDied: 0, songsQuit: 0, bestOkStreak: 0 };

/**
 * A song's accuracy, 0-100: PERFECT counts 100, GOOD 70, OK 40, a miss 0
 * (the same sum the results screen and the grade use).
 */
export function accuracyPercent(c: { perfect: number; good: number; ok: number; miss: number }): number {
  const total = c.perfect + c.good + c.ok + c.miss;
  if (total <= 0) return 0;
  return Math.round(((c.perfect * 100 + c.good * 70 + c.ok * 40) / (total * 100)) * 100);
}

export interface UnlockGoal {
  stat: keyof LifetimeStats;
  target: number;
  /** Shown on the locked hero, e.g. "Defeat 150 enemies" */
  label: string;
  /**
   * Can also be unlocked straight away by watching a rewarded ad (the Unlocks
   * screen adds a Watch ad button). CrazyGames requires the play goal as well:
   * every rewarded ad must have another way to earn the reward.
   */
  ad?: boolean;
}

/** What it takes to earn each hero. Heroes not listed are free from the start. */
export const HERO_UNLOCKS: Partial<Record<HeroId, UnlockGoal>> = {
  theOne: { stat: 'songsCleared', target: 1, label: 'Complete any song' },
  dragon: { stat: 'enemiesDefeated', target: 333, label: 'Defeat 333 enemies' },
  sawFace: { stat: 'perfects', target: 666, label: 'Land 666 PERFECT hits' },
  stallion: { stat: 'songsCleared', target: 5, label: 'Complete 5 songs' },
  proWrestler: { stat: 'okHits', target: 200, label: 'Land 200 OK hits' },
  bride: { stat: 'songsCleared', target: 8, label: 'Complete 8 songs', ad: true },
  kid: { stat: 'playSeconds', target: 1800, label: 'Train for 30 minutes' },
  discoKing: { stat: 'perfects', target: 2500, label: 'Land 2,500 PERFECT hits' },
  // Meme unlocks: no brain? No problem. He comes to the players who keep getting knocked out
  scarecrow: { stat: 'songsDied', target: 10, label: 'Die in 10 songs' },
  // The cowardly one runs away
  lion: { stat: 'songsQuit', target: 5, label: 'Run away from 5 songs (quit part way)' },
  // Rusty, so always a little off the beat: being perfectly bad is hard
  tinMan: { stat: 'bestOkStreak', target: 20, label: 'Hit 20 OKs in a row' },
  // Swing wildly at thin air, and still get to the end of the song
  drunkenMaster: { stat: 'mostMissesCleared', target: 50, label: 'Complete a song with 50+ misses' },
  spartan: { stat: 'bestCombo', target: 300, label: 'Reach a 300 combo' },
  babaYaga: { stat: 'bestClearAccuracy', target: 98, label: 'Complete a song with 98% accuracy' },
  ballerina: { stat: 'flawlessClears', target: 1, label: 'Complete a song with no misses' },
};

/**
 * Heroes in the order players earn them, easiest first: the picker lists
 * them this way, as a path. Play goals come first (about 1 to 10 songs),
 * then the skill goals, hardest last.
 */
export const UNLOCK_ORDER: HeroId[] = ['striker', 'theOne', 'dragon', 'scarecrow', 'lion', 'sawFace', 'drunkenMaster', 'stallion', 'proWrestler', 'bride', 'kid', 'discoKing', 'spartan', 'tinMan', 'babaYaga', 'ballerina'];

export function isHeroUnlocked(id: HeroId, stats: LifetimeStats): boolean {
  const goal = HERO_UNLOCKS[id];
  return !goal || stats[goal.stat] >= goal.target || (!!goal.ad && stats.heroAds > 0);
}

/** How far the player is toward a locked hero (null for free heroes). */
export function unlockProgress(id: HeroId, stats: LifetimeStats): { goal: UnlockGoal; current: number; done: boolean } | null {
  const goal = HERO_UNLOCKS[id];
  if (!goal) return null;
  const current = Math.min(goal.target, stats[goal.stat]);
  return { goal, current, done: isHeroUnlocked(id, stats) };
}

/** How far along a goal is, as shown under a locked hero ("12 / 30 min", "Best 91% / 98%"). */
export function progressText(goal: UnlockGoal, current: number): string {
  if (goal.stat === 'playSeconds') return `${Math.floor(current / 60)} / ${Math.round(goal.target / 60)} min`;
  if (goal.stat === 'bestClearAccuracy') return `Best ${current}% / ${goal.target}%`;
  if (goal.stat === 'mostMissesCleared') return `Best ${current} / ${goal.target} misses`;
  if (goal.stat === 'flawlessClears' && goal.target === 1) return current >= 1 ? 'Done' : 'Not yet';
  return `${current.toLocaleString()} / ${goal.target.toLocaleString()}`;
}

/** One song's results, as they count toward the totals. */
export interface RunResult {
  enemiesDefeated: number;
  perfects: number;
  /** OK hits */
  oks: number;
  misses: number;
  /** 0-100, see accuracyPercent */
  accuracy: number;
  /** It ended with an enemy getting through (quitting doesn't count) */
  died?: boolean;
  /** The player quit part way (Quit to Main Menu) */
  quit?: boolean;
  /** Most OK hits in a row in this song */
  okStreak?: number;
  maxCombo: number;
  cleared: boolean;
  /** How long the song was played for */
  seconds: number;
  /** The run's final score */
  score: number;
}

export function addRun(stats: LifetimeStats, run: RunResult): LifetimeStats {
  return {
    enemiesDefeated: stats.enemiesDefeated + run.enemiesDefeated,
    perfects: stats.perfects + run.perfects,
    bestCombo: Math.max(stats.bestCombo, run.maxCombo),
    songsCleared: stats.songsCleared + (run.cleared ? 1 : 0),
    playSeconds: stats.playSeconds + Math.max(0, run.seconds),
    adUnlocks: stats.adUnlocks,
    heroAds: stats.heroAds,
    totalScore: stats.totalScore + Math.max(0, run.score),
    backdropAds: stats.backdropAds,
    backdropsUnlocked: backdropsAfterRun(stats.backdropsUnlocked, stats.totalScore + Math.max(0, run.score)),
    okHits: stats.okHits + run.oks,
    bestClearAccuracy: run.cleared ? Math.max(stats.bestClearAccuracy, run.accuracy) : stats.bestClearAccuracy,
    // A song you finished, with hits and not one miss
    flawlessClears: stats.flawlessClears + (run.cleared && run.misses === 0 && run.enemiesDefeated > 0 ? 1 : 0),
    mostMissesCleared: run.cleared ? Math.max(stats.mostMissesCleared, run.misses) : stats.mostMissesCleared,
    songsDied: stats.songsDied + (run.died ? 1 : 0),
    songsQuit: stats.songsQuit + (run.quit ? 1 : 0),
    bestOkStreak: Math.max(stats.bestOkStreak, run.okStreak ?? 0),
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
      heroAds: num(parsed.heroAds),
      totalScore: num(parsed.totalScore),
      backdropAds: num(parsed.backdropAds),
      // Saves from before this count existed keep every piece their score had opened
      backdropsUnlocked:
        typeof parsed.backdropsUnlocked === 'number' ? num(parsed.backdropsUnlocked) : milestonesFor(num(parsed.totalScore)),
      okHits: num(parsed.okHits),
      bestClearAccuracy: Math.min(100, num(parsed.bestClearAccuracy)),
      flawlessClears: num(parsed.flawlessClears),
      mostMissesCleared: num(parsed.mostMissesCleared),
      songsDied: num(parsed.songsDied),
      songsQuit: num(parsed.songsQuit),
      bestOkStreak: num(parsed.bestOkStreak),
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
