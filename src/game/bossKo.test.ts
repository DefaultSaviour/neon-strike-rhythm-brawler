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

/** Math.random values that make pickBossKind choose each boss (from four, none met before) */
const PICK = { leaper: 0, runner: 0.3, twins: 0.6, shadow: 0.9 } as const;

describe.each(Object.entries(PICK))('the %s K.O. at the very end of a song', (_kind, pick) => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(pick);
  });

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

  async function playAllBut(last: number) {
    const onGameOver = vi.fn();
    const engine = new GameEngine({ onScoreUpdate: () => {}, onGameOver, onJudgement: () => {} });
    engine.settings.latencyOffsetMs = 0;
    await engine.startSong(track(), true);
    const order = [...engine.enemies].sort((a, b) => a.targetTime - b.targetTime);
    for (const enemy of order.slice(0, order.length - last)) {
      clock = enemy.targetTime;
      now += 10;
      engine.update(0.016, 380);
      engine.handleInput(enemy.lane);
    }
    return { engine, onGameOver, rest: order.slice(order.length - last) };
  }

  it('still lets the last fist be hit late after the music has ended', async () => {
    const { engine, onGameOver, rest } = await playAllBut(1);
    const final = rest[0];
    clock = final.targetTime - 0.01;
    now += 10;
    engine.update(0.016, 380);
    // The music ends (its clock stops and reads 0), but the song clock carries on
    clock = 0;
    musicEnded!();
    expect(onGameOver).not.toHaveBeenCalled();
    now += 50; // 40 ms after the beat: late, but inside the OK window
    engine.update(0.016, 380);
    engine.handleInput(final.lane);
    expect(final.defeated).toBe(true);
    now += RETURN_MS + 20;
    engine.update(0.016, 380);
    expect(engine.boss!.ko).toBe(true);
    now += KO_HOLD_MS;
    engine.update(0.016, 380);
    expect(onGameOver).toHaveBeenCalledTimes(1);
    expect(engine.bossResult()).toBe('ko');
  });

  it('lets the K.O. play when the boss fell just before the music ended', async () => {
    const { engine, onGameOver } = await playAllBut(0);
    now += RETURN_MS + 20;
    engine.update(0.016, 380);
    expect(engine.boss!.ko).toBe(true);
    // The music ends just after it fell: the results wait for the K.O.
    now += 30;
    musicEnded!();
    expect(onGameOver).not.toHaveBeenCalled();
    now += KO_HOLD_MS;
    engine.update(0.016, 380);
    expect(onGameOver).toHaveBeenCalledTimes(1);
  });

  it("doesn't wait for a last fist that was missed: the song ends once it's too late to hit", async () => {
    const { engine, onGameOver, rest } = await playAllBut(1);
    clock = rest[0].targetTime - 0.01;
    now += 10;
    engine.update(0.016, 380);
    musicEnded!();
    expect(onGameOver).not.toHaveBeenCalled();
    // Past the OK window, and past anything hit just before still flying back (a twin falling)
    now += RETURN_MS + KO_HOLD_MS;
    engine.update(0.016, 380);
    expect(onGameOver).toHaveBeenCalledTimes(1);
    expect(engine.bossResult()).toBe('standing');
  });
});
