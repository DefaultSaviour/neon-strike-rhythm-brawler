import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioEngine } from '../audio/audioEngine';
import { BOSS_KINDS } from './boss';
import { GameEngine, KO_HOLD_MS, RETURN_MS } from './gameEngine';
import { BeatNote, Enemy, Track } from '../types/game';

/**
 * The last fist often lands right as the music ends (Blitz's ends 16 ms after it). The song
 * clock runs on after the music (AudioEngine keeps counting until it's stopped), and the end
 * of the song waits while the last note can still be hit, the killing blow flies back, and
 * the K.O. plays.
 */

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

describe.each(BOSS_KINDS)('the %s K.O. at the very end of a song', (kind) => {
  beforeEach(() => {
    // pickBossKind chooses from all of BOSS_KINDS when none has been met: aim at this one
    vi.spyOn(Math, 'random').mockReturnValue((BOSS_KINDS.indexOf(kind) + 0.5) / BOSS_KINDS.length);
  });

  /** Play the song hitting every note perfectly, except the last `skip`, and stop just before the last note. */
  async function playAllBut(skip: number) {
    const onGameOver = vi.fn();
    const engine = new GameEngine({ onScoreUpdate: () => {}, onGameOver, onJudgement: () => {} });
    engine.settings.latencyOffsetMs = 0;
    await engine.startSong(track(), true);
    expect(engine.boss!.plan.kind).toBe(kind);
    const order = [...engine.enemies].sort((a, b) => a.targetTime - b.targetTime);
    const played = order.slice(0, order.length - skip);
    for (const enemy of played) {
      clock = enemy.targetTime;
      now += 10;
      engine.update(0.016, 380);
      engine.handleInput(enemy.lane);
    }
    const last: Enemy = order[order.length - 1];
    clock = Math.max(clock, last.targetTime - 0.01);
    /** Let `ms` pass on both clocks (the song clock runs on after the music), a frame at a time */
    const wait = (ms: number) => {
      for (let left = ms; left > 0; left -= 16) {
        const step = Math.min(16, left);
        now += step;
        clock += step / 1000;
        engine.update(step / 1000, 380);
      }
    };
    return { engine, onGameOver, last, wait };
  }

  it('waits for the killing blow to land and the K.O. to play before the results', async () => {
    const { engine, onGameOver, wait } = await playAllBut(0);
    expect(engine.boss!.hp).toBe(0);
    // The music ends straight after the last fist, before it has flown back into the boss
    musicEnded!();
    expect(onGameOver).not.toHaveBeenCalled();
    wait(RETURN_MS + 20);
    expect(engine.boss!.ko).toBe(true);
    expect(onGameOver).not.toHaveBeenCalled();
    wait(KO_HOLD_MS);
    expect(onGameOver).toHaveBeenCalledTimes(1);
    expect(onGameOver.mock.calls[0][1]).toBe(true);
    expect(engine.bossResult()).toBe('ko');
  });

  it('still lets the last fist be hit late after the music has ended', async () => {
    const { engine, onGameOver, last, wait } = await playAllBut(1);
    musicEnded!();
    expect(onGameOver).not.toHaveBeenCalled();
    wait(50); // 40 ms after the beat: late, but inside the OK window
    engine.handleInput(last.lane);
    expect(last.defeated).toBe(true);
    wait(RETURN_MS + 20);
    expect(engine.boss!.ko).toBe(true);
    wait(KO_HOLD_MS);
    expect(onGameOver).toHaveBeenCalledTimes(1);
    expect(engine.bossResult()).toBe('ko');
  });

  it('lets the K.O. play when the boss fell just before the music ended', async () => {
    const { engine, onGameOver, wait } = await playAllBut(0);
    wait(RETURN_MS + 20);
    expect(engine.boss!.ko).toBe(true);
    // The music ends just after it fell: the results wait for the K.O.
    now += 30;
    musicEnded!();
    expect(onGameOver).not.toHaveBeenCalled();
    wait(KO_HOLD_MS);
    expect(onGameOver).toHaveBeenCalledTimes(1);
  });

  it("doesn't wait for a last fist that was missed: the song ends once it's too late to hit", async () => {
    const { engine, onGameOver, wait } = await playAllBut(1);
    musicEnded!();
    expect(onGameOver).not.toHaveBeenCalled();
    // Past the OK window, and past anything hit just before still flying back (a twin falling)
    wait(RETURN_MS + KO_HOLD_MS + 50);
    expect(onGameOver).toHaveBeenCalledTimes(1);
    expect(engine.bossResult()).toBe('standing');
  });

  it("holds the late-hit window on the song clock, so a pause doesn't use it up", async () => {
    const { engine, onGameOver, last, wait } = await playAllBut(1);
    musicEnded!();
    engine.paused = true;
    now += 5000; // a long pause: the song clock (AudioContext) is suspended, so it doesn't move
    engine.update(0.016, 380);
    engine.paused = false;
    expect(onGameOver).not.toHaveBeenCalled();
    wait(40);
    engine.handleInput(last.lane);
    expect(last.defeated).toBe(true);
  });
});
