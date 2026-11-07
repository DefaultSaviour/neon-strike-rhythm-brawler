import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameEngine } from './gameEngine';

/** Hits used to play a note by default ('both'); now the default is just the song boost. */
describe('the hit sound default', () => {
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => (store[k] = v),
      removeItem: (k: string) => delete store[k],
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const load = () => {
    const engine = new GameEngine({ onScoreUpdate: () => {}, onGameOver: () => {}, onJudgement: () => {} });
    engine.loadSettings();
    return engine.settings;
  };

  it('is the boost for a new player', () => {
    expect(load().hitSound).toBe('surge');
  });

  it('moves a save still on the old default over to the boost', () => {
    store.neon_strike_settings = JSON.stringify({ volume: 0.5, hitSound: 'both' });
    const s = load();
    expect(s.hitSound).toBe('surge');
    expect(s.volume).toBe(0.5);
  });

  it('keeps Both when the player picked it after the change', () => {
    store.neon_strike_settings = JSON.stringify({ hitSound: 'both', settingsVersion: 2 });
    expect(load().hitSound).toBe('both');
  });

  it('keeps any other old choice', () => {
    store.neon_strike_settings = JSON.stringify({ hitSound: 'tone' });
    expect(load().hitSound).toBe('tone');
  });
});
