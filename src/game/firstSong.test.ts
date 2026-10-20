import { describe, expect, it } from 'vitest';
import { markFirstSongDone, needsFirstSong } from './firstSong';

function memoryStore() {
  const data: Record<string, string> = {};
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) };
}

describe("a brand-new player's first song", () => {
  it('is given once: a new player gets it, and after that New Game opens the song list', () => {
    const store = memoryStore();
    expect(needsFirstSong(store, 0)).toBe(true);
    markFirstSongDone(store);
    expect(needsFirstSong(store, 0)).toBe(false);
  });

  it('is not given to anyone who has already played a real song', () => {
    expect(needsFirstSong(memoryStore(), 12)).toBe(false);
  });

  it('works without storage (it just comes again)', () => {
    expect(needsFirstSong(undefined, 0)).toBe(true);
    expect(() => markFirstSongDone(undefined)).not.toThrow();
  });
});
