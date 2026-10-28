import { describe, expect, it } from 'vitest';
import type { HighScoreRecord, Track } from '../types/game';
import { bestSongScore, byCombo, byScore, compareScore, playTime, shortNumber, songRecords } from './records';

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

describe('compareScore', () => {
  it('is just a first score the first time a song is played', () => {
    expect(compareScore(5000, 30, null)).toEqual({ previousBest: null, newBest: false, newCombo: false });
  });

  it('spots a new best score and a new best combo separately', () => {
    expect(compareScore(6000, 20, { highScore: 5000, maxCombo: 30 })).toEqual({ previousBest: 5000, newBest: true, newCombo: false });
    expect(compareScore(4000, 40, { highScore: 5000, maxCombo: 30 })).toEqual({ previousBest: 5000, newBest: false, newCombo: true });
  });

  it('needs to beat the old best, not tie it', () => {
    expect(compareScore(5000, 30, { highScore: 5000, maxCombo: 30 }).newBest).toBe(false);
  });
});

describe('shortNumber and playTime', () => {
  it('keeps small numbers whole and shortens big ones', () => {
    expect(shortNumber(6412)).toBe('6,412');
    expect(shortNumber(99_999)).toBe('99,999');
    expect(shortNumber(123_456)).toBe('123K');
    expect(shortNumber(1_250_000)).toBe('1.2M');
    expect(shortNumber(1_000_000_000)).toBe('1B');
  });

  it('shows time played briefly', () => {
    expect(playTime(720)).toBe('12m');
    expect(playTime(11_520)).toBe('3h 12m');
    expect(playTime(540_000)).toBe('150h');
  });
});
