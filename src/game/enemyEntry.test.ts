import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioEngine } from '../audio/audioEngine';
import { GameEngine } from './gameEngine';
import { BeatNote, Track } from '../types/game';

/** Enemies walk in from beyond the edge of the screen, at the same speed on every screen. */

let clock = 0;

function track(times: number[]): Track {
  const notes: BeatNote[] = times.map((time, i) => ({ time, lane: i % 2 ? 'right' : 'left', enemyType: 'brawler', band: 'sub', tier: 2 }));
  return { id: 't', title: 't', artist: 'a', bpm: 150, difficulty: 'Hard', duration: 60, description: '', notes };
}

async function start(times: number[]) {
  const engine = new GameEngine({ onScoreUpdate: () => {}, onGameOver: () => {}, onJudgement: () => {} });
  engine.settings.latencyOffsetMs = 0;
  await engine.startSong(track(times), true);
  return engine;
}

beforeEach(() => {
  clock = 0;
  vi.spyOn(audioEngine, 'getPlaybackTime').mockImplementation(() => clock);
  vi.spyOn(audioEngine, 'prepareTrack').mockResolvedValue();
  vi.spyOn(audioEngine, 'startTrack').mockResolvedValue();
  vi.spyOn(audioEngine, 'stop').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('enemies walk in from the edge', () => {
  it('leaves out enemies due before they could walk in (they would already be on the floor)', async () => {
    const engine = await start([0.6, 1.2, 4, 5]);
    expect(engine.enemies.map((e) => e.targetTime)).toEqual([4, 5]);
  });

  it('moves enemies the same on a normal and a very wide screen', async () => {
    const normal = await start([4, 5]);
    const wide = await start([4, 5]);
    for (const t of [0.5, 1.5, 2.5, 3.5]) {
      clock = t;
      normal.update(0.016, 380);
      wide.update(0.016, 900);
      expect(wide.enemies.map((e) => e.x)).toEqual(normal.enemies.map((e) => e.x));
    }
  });

  it('starts them beyond the edge of a wide screen, then brings them on', async () => {
    const engine = await start([4]);
    const halfWidth = 700;
    clock = 0;
    engine.update(0.016, halfWidth);
    expect(Math.abs(engine.enemies[0].x)).toBeGreaterThan(halfWidth);
    clock = 3.5;
    engine.update(0.016, halfWidth);
    expect(Math.abs(engine.enemies[0].x)).toBeLessThan(halfWidth);
  });
});
