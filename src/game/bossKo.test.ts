import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioEngine } from '../audio/audioEngine';
import { GameEngine, KO_HOLD_MS, RETURN_MS } from './gameEngine';
import { BeatNote, Track } from '../types/game';

/** The killing blow often lands right as the music ends: the K.O. must still happen. */

let clock = 0;
let now = 1000;
let musicEnded: (() => void) | null = null;

function track(): Track {
  const notes: BeatNote[] = [];
  for (let t = 3; t <= 70; t += 0.5) notes.push({ time: t, lane: notes.length % 2 ? 'right' : 'left', enemyType: 'brawler', band: 'sub', tier: 2 });
  return { id: 't', title: 't', artist: 'a', bpm: 120, difficulty: 'Hard', duration: 70, description: '', notes };
}

beforeEach(() => {
  clock = 0;
  now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.spyOn(audioEngine, 'getPlaybackTime').mockImplementation(() => clock);
  vi.spyOn(audioEngine, 'prepareTrack').mockResolvedValue();
  vi.spyOn(audioEngine, 'startTrack').mockImplementation(async (_track, onEnded) => {
    musicEnded = onEnded as () => void;
  });
  vi.spyOn(audioEngine, 'stop').mockImplementation(() => {});
  vi.spyOn(audioEngine, 'playHitSound').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('the boss K.O. at the very end of a song', () => {
  it('waits for the killing blow to land and the K.O. to play before the results', async () => {
    const onGameOver = vi.fn();
    const engine = new GameEngine({ onScoreUpdate: () => {}, onGameOver, onJudgement: () => {} });
    engine.settings.latencyOffsetMs = 0;
    await engine.startSong(track(), true);
    expect(engine.boss).not.toBeNull();

    // Hit everything perfectly
    for (const enemy of [...engine.enemies].sort((a, b) => a.targetTime - b.targetTime)) {
      clock = enemy.targetTime;
      now += 10;
      engine.update(0.016, 380);
      engine.handleInput(enemy.lane);
    }
    expect(engine.boss!.hp).toBe(0);

    // The music ends straight after the last fist, before it has flown back into the boss
    musicEnded!();
    expect(onGameOver).not.toHaveBeenCalled();
    now += RETURN_MS + 20;
    engine.update(0.016, 380);
    expect(engine.boss!.ko).toBe(true);
    expect(onGameOver).not.toHaveBeenCalled();

    now += KO_HOLD_MS;
    engine.update(0.016, 380);
    expect(onGameOver).toHaveBeenCalledTimes(1);
    expect(onGameOver.mock.calls[0][1]).toBe(true);
    expect(engine.bossResult()).toBe('ko');
  });
});
