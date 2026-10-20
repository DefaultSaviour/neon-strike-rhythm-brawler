import { describe, expect, it } from 'vitest';
import type { HighScoreRecord, Track } from '../types/game';
import { bestSongScore, byCombo, byScore, songRecords } from './records';

const track = (id: string, title: string) => ({ id, title }) as Track;
const record = (trackId: string, highScore: number, maxCombo: number) =>
  ({ trackId, highScore, maxCombo, accuracy: 90, grade: 'A', cleared: true, timestamp: 0 }) as HighScoreRecord;

describe('records', () => {
  const tracks = [track('a', 'Song A'), track('b', 'Song B'), track('c', 'Song C')];
  const scores = { a: record('a', 5000, 120), b: record('b', 9000, 40), gone: record('gone', 99999, 999) };

  it('lists the songs played, by title, leaving out songs that are gone', () => {
    expect(songRecords(scores, tracks).map((r) => r.title)).toEqual(['Song A', 'Song B']);
  });

  it('ranks by score and by combo', () => {
    const recs = songRecords(scores, tracks);
    expect(byScore(recs).map((r) => r.trackId)).toEqual(['b', 'a']);
    expect(byCombo(recs).map((r) => r.trackId)).toEqual(['a', 'b']);
  });

  it('knows the best single-song score', () => {
    expect(bestSongScore({})).toBe(0);
    expect(bestSongScore({ a: record('a', 5000, 1), b: record('b', 9000, 1) })).toBe(9000);
  });
});
