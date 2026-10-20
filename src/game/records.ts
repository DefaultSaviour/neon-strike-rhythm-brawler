import type { HighScoreRecord, Track } from '../types/game';

/**
 * The Records screen: the player's own bests, in three tabs (best song,
 * total score, biggest combo). The best single-song score is also what goes
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
