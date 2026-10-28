import type { HighScoreRecord, Track } from '../types/game';

/**
 * The Records screen: the player's own bests (lifetime totals, and songs
 * ranked by score or combo). The best single-song score is also what goes
 * to the CrazyGames leaderboard.
 */

export interface SongRecord {
  trackId: string;
  title: string;
  score: number;
  combo: number;
  grade: HighScoreRecord['grade'];
  cleared: boolean;
}

/** Every song played, with its title (songs no longer in the list are left out). */
export function songRecords(highScores: Record<string, HighScoreRecord>, tracks: Track[]): SongRecord[] {
  return tracks
    .filter((t) => highScores[t.id])
    .map((t) => {
      const r = highScores[t.id];
      return { trackId: t.id, title: t.title, score: r.highScore, combo: r.maxCombo, grade: r.grade, cleared: r.cleared };
    });
}

/** Songs ranked by best score, highest first. */
export function byScore(records: SongRecord[]): SongRecord[] {
  return [...records].sort((a, b) => b.score - a.score);
}

/** Songs ranked by best combo, longest first. */
export function byCombo(records: SongRecord[]): SongRecord[] {
  return [...records].sort((a, b) => b.combo - a.combo);
}

/** The best score on any one song (0 before any song is played). */
export function bestSongScore(highScores: Record<string, HighScoreRecord>): number {
  return Object.values(highScores).reduce((best, r) => Math.max(best, r.highScore), 0);
}

/** How a finished run's score and combo compare with the song's best before it. */
export interface ScoreComparison {
  /** The song's best score before this run (null the first time it's played) */
  previousBest: number | null;
  /** Beat the old best score (not counted the first time a song is played: that's just a first score) */
  newBest: boolean;
  /** Beat the old best combo on this song */
  newCombo: boolean;
}

export function compareScore(score: number, combo: number, previous: Pick<HighScoreRecord, 'highScore' | 'maxCombo'> | null): ScoreComparison {
  if (!previous) return { previousBest: null, newBest: false, newCombo: false };
  return { previousBest: previous.highScore, newBest: score > previous.highScore, newCombo: combo > previous.maxCombo };
}

/** A number short enough for a small box: in full up to 99,999, then "123K", "1.2M", "4.5B". */
export function shortNumber(n: number): string {
  if (Math.abs(n) < 100_000) return Math.round(n).toLocaleString('en-US');
  for (const [size, suffix] of [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']] as const) {
    if (Math.abs(n) >= size) {
      const v = n / size;
      return `${v >= 100 ? Math.floor(v) : Math.floor(v * 10) / 10}${suffix}`;
    }
  }
  return String(n);
}

/** Time played, short: "12m", "3h 12m", or just "150h" once it's 100 hours or more. */
export function playTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours >= 100) return `${shortNumber(hours)}h`;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
