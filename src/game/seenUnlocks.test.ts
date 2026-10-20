import { describe, expect, it } from 'vitest';
import { loadSeen, saveSeen, unlockKey, unseen } from './seenUnlocks';

const memoryStore = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

describe('seen unlocks', () => {
  it('counts everything already open as seen the first time, so nobody starts with badges', () => {
    const store = memoryStore();
    const open = [unlockKey('hero', 'striker'), unlockKey('stance', 'run')];
    const seen = loadSeen(store, open);
    expect(unseen(open, seen)).toEqual([]);
    // Something opened later is new
    expect(unseen([...open, unlockKey('hero', 'dragon')], loadSeen(store, open))).toEqual(['hero:dragon']);
  });

  it('remembers what was tapped on', () => {
    const store = memoryStore();
    const seen = loadSeen(store, []);
    saveSeen(store, new Set([...seen, unlockKey('backdrop', 'moon')]));
    expect(unseen(['backdrop:moon', 'backdrop:hex'], loadSeen(store, []))).toEqual(['backdrop:hex']);
  });

  it('can start empty without saving (dev ?unlockAll shows everything as new)', () => {
    const store = memoryStore();
    expect(loadSeen(store, ['hero:dragon'], { seed: false }).size).toBe(0);
    expect(store.getItem('neon_strike_seen_unlocks_v1')).toBeNull();
  });

  it('keeps the kinds apart', () => {
    expect(unlockKey('hero', 'x')).not.toBe(unlockKey('stance', 'x'));
  });
});
