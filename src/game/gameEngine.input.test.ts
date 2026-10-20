import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioEngine } from '../audio/audioEngine';
import { CROWD_POP_SEC, GameEngine, SLAM_SHAKE } from './gameEngine';
import { DEFAULT_HERO, getHero } from './heroes';
import { EMPTY_STATS } from './heroUnlocks';
import { BeatNote, TimingJudgementType, Track } from '../types/game';
import type { DeathReport } from './timing';

/**
 * Drives the real GameEngine with a fake song clock, pressing keys at exact
 * song times, to check that on-time presses always count.
 */

let clock = 0;

function makeTrack(notes: Array<[number, 'left' | 'right']>): Track {
  const beatNotes: BeatNote[] = notes.map(([time, lane]) => ({ time, lane, enemyType: 'brawler', band: 'sub', tier: 2 }));
  return { id: 't', title: 't', artist: 'a', bpm: 150, difficulty: 'Hard', duration: 60, description: '', notes: beatNotes };
}

async function play(notes: Array<[number, 'left' | 'right']>, practice = false) {
  const judgements: TimingJudgementType[] = [];
  let gameOver = false;
  let death: DeathReport | undefined;
  const engine = new GameEngine({
    onScoreUpdate: () => {},
    onGameOver: (_s, _c, d) => {
      gameOver = true;
      death = d;
    },
    onJudgement: (j) => judgements.push(j),
  });
  engine.settings.latencyOffsetMs = 0;
  await engine.startSong(makeTrack(notes), practice);
  /** Advance the song clock to `t`, running frames like the real game loop. */
  const advanceTo = (t: number) => {
    while (clock < t) {
      clock = Math.min(t, clock + 1 / 60);
      engine.update(1 / 60, 500);
    }
  };
  const press = (t: number, lane: 'left' | 'right') => {
    advanceTo(t);
    engine.handleInput(lane);
  };
  return { engine, judgements, press, advanceTo, isOver: () => gameOver, death: () => death };
}

beforeEach(() => {
  clock = 0;
  vi.spyOn(audioEngine, 'getPlaybackTime').mockImplementation(() => clock);
  vi.spyOn(audioEngine, 'prepareTrack').mockResolvedValue();
  vi.spyOn(audioEngine, 'startTrack').mockResolvedValue();
  vi.spyOn(audioEngine, 'stop').mockImplementation(() => {});
  vi.spyOn(audioEngine, 'playHitSound').mockImplementation(() => {});
  vi.spyOn(audioEngine, 'playSwingSound').mockImplementation(() => {});
  vi.spyOn(audioEngine, 'playDeathSound').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('presses on the beat always count', () => {
  it('exactly on time = PERFECT', async () => {
    const g = await play([[2, 'left']]);
    g.press(2, 'left');
    expect(g.judgements).toEqual(['PERFECT']);
  });

  it('fast alternating lanes at the tightest chart spacing (185ms)', async () => {
    const notes: Array<[number, 'left' | 'right']> = Array.from({ length: 16 }, (_, i) => [2 + i * 0.185, i % 2 ? 'right' : 'left']);
    const g = await play(notes);
    for (const [t, lane] of notes) g.press(t, lane);
    expect(g.judgements.every((j) => j === 'PERFECT')).toBe(true);
    expect(g.judgements).toHaveLength(16);
  });

  it('back-to-back notes in the SAME lane at 185ms spacing', async () => {
    const notes: Array<[number, 'left' | 'right']> = Array.from({ length: 12 }, (_, i) => [2 + i * 0.185, 'right']);
    const g = await play(notes);
    for (const [t, lane] of notes) g.press(t, lane);
    expect(g.judgements.every((j) => j === 'PERFECT')).toBe(true);
  });

  it('a slightly late hit does not steal the next note in the same lane', async () => {
    const g = await play([
      [2, 'left'],
      [2.2, 'left'],
    ]);
    g.press(2.09, 'left'); // 90ms late: GOOD on the first note
    g.press(2.2, 'left'); // then right on time for the second
    expect(g.judgements).toEqual(['GOOD', 'PERFECT']);
  });

  it('pressing 40ms early or late on every note still scores PERFECT', async () => {
    const notes: Array<[number, 'left' | 'right']> = Array.from({ length: 10 }, (_, i) => [2 + i * 0.4, i % 3 ? 'left' : 'right']);
    const g = await play(notes);
    notes.forEach(([t, lane], i) => g.press(t + (i % 2 ? 0.04 : -0.04), lane));
    expect(g.judgements.every((j) => j === 'PERFECT')).toBe(true);
  });

  it('a press with no enemy anywhere near counts as a MISS (current rule)', async () => {
    const g = await play([[5, 'left']]);
    g.press(2, 'left');
    expect(g.judgements).toEqual(['MISS']);
  });

  it('the wrong lane is a MISS even when the timing is perfect', async () => {
    const g = await play([[2, 'left']]);
    g.press(2, 'right');
    expect(g.judgements).toEqual(['MISS']);
  });
});

describe('when an enemy gets through, the game says why', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('names the enemy and how early the press was', async () => {
    const g = await play([[3, 'right']]);
    g.press(2.788, 'right'); // 212ms early: outside the window, so a MISS
    g.advanceTo(3.3); // enemy breaks through
    vi.runAllTimers();
    expect(g.isOver()).toBe(true);
    expect(g.death()).toEqual({ enemyName: 'Breaker', lane: 'right', reason: 'You pressed 212 ms too early.' });
  });

  it('spots a press on the wrong side', async () => {
    const g = await play([[3, 'left']]);
    g.press(3.0, 'right');
    g.advanceTo(3.3);
    vi.runAllTimers();
    expect(g.death()?.reason).toMatch(/You pressed RIGHT .* Wrong side\./);
  });

  it('says when there was no press at all', async () => {
    const g = await play([[3, 'left']]);
    g.advanceTo(3.3);
    vi.runAllTimers();
    expect(g.death()?.reason).toBe("You didn't press for it.");
  });
});

describe('slams', () => {
  const pw = getHero('proWrestler');
  const slam = pw.moves.find((m) => m.name === 'Powerbomb')!;
  const chop = pw.moves.find((m) => m.name === 'Chop')!;
  /** Hit once on time, with the hero's move list cut down to one move. */
  const hitWith = async (move: typeof slam, screenShake: 'none' | 'subtle' | 'normal') => {
    const g = await play([[2, 'left']]);
    g.engine.settings.screenShake = screenShake;
    vi.spyOn(g.engine, 'hero', 'get').mockReturnValue({ ...pw, moves: [move] });
    g.press(2, 'left');
    return g;
  };

  it('a slam shakes the screen harder than an ordinary hit and pops the crowd', async () => {
    const plain = await hitWith(chop, 'normal');
    const big = await hitWith(slam, 'normal');
    expect(plain.engine.crowdPop).toBe(0);
    expect(big.engine.crowdPop).toBe(1);
    expect(big.engine.screenShake).toBeCloseTo(plain.engine.screenShake * SLAM_SHAKE, 6);
  });

  it('the crowd pop fades out quickly', async () => {
    const g = await hitWith(slam, 'normal');
    g.advanceTo(2 + CROWD_POP_SEC + 0.05);
    expect(g.engine.crowdPop).toBe(0);
  });

  it('with screen shake turned off there is no flash either', async () => {
    const g = await hitWith(slam, 'none');
    expect(g.engine.crowdPop).toBe(0);
    expect(g.engine.screenShake).toBe(0);
  });
});

describe('earning heroes', () => {
  const notes: Array<[number, 'left' | 'right']> = Array.from({ length: 6 }, (_, i) => [2 + i * 0.5, 'left']);

  it('quitting part way still counts the enemies beaten, once', async () => {
    const g = await play(notes);
    g.engine.lifetimeStats = { ...EMPTY_STATS };
    for (const [t, lane] of notes.slice(0, 4)) g.press(t, lane);
    g.engine.stop();
    g.engine.stop();
    expect(g.engine.lifetimeStats).toMatchObject({ enemiesDefeated: 4, perfects: 4, bestCombo: 4, songsCleared: 0 });
    // A song you quit isn't finished: it can't count for accuracy or a no-miss song
    expect(g.engine.lifetimeStats).toMatchObject({ bestClearAccuracy: 0, flawlessClears: 0 });
  });

  it('reports a hero the song just unlocked', async () => {
    const g = await play(notes);
    g.engine.lifetimeStats = { ...EMPTY_STATS, enemiesDefeated: 330 };
    for (const [t, lane] of notes.slice(0, 3)) g.press(t, lane);
    g.engine.stop();
    expect(g.engine.newUnlocks).toEqual(['dragon']);
    expect(g.engine.isHeroUnlocked('dragon')).toBe(true);
  });

  it('a hero not yet earned plays as the default hero', async () => {
    const g = await play(notes);
    g.engine.lifetimeStats = { ...EMPTY_STATS };
    g.engine.settings.hero = 'ballerina';
    expect(g.engine.hero.id).toBe(DEFAULT_HERO);
    g.engine.lifetimeStats = { ...EMPTY_STATS, flawlessClears: 1 };
    expect(g.engine.hero.id).toBe('ballerina');
  });
});

describe('earning enemy stances', () => {
  it('playing time counts toward stances, and a locked stance plays as the default', async () => {
    const g = await play([[2, 'left']]);
    g.engine.lifetimeStats = { ...EMPTY_STATS, playSeconds: 20 * 60 - 1 };
    g.engine.settings.enemyMotion = 'sway';
    expect(g.engine.enemyMotion).toBe('run');
    g.advanceTo(3);
    g.engine.stop();
    expect(g.engine.lifetimeStats.playSeconds).toBeGreaterThanOrEqual(20 * 60);
    expect(g.engine.enemyMotion).toBe('sway');
  });

  it('a watched ad opens the next stance straight away', async () => {
    const g = await play([[2, 'left']]);
    g.engine.lifetimeStats = { ...EMPTY_STATS };
    expect(g.engine.isStanceUnlocked('sway')).toBe(false);
    expect(g.engine.unlockStanceWithAd()).toBe('sway');
    expect(g.engine.isStanceUnlocked('sway')).toBe(true);
    expect(g.engine.isStanceUnlocked('dance')).toBe(false);
  });
});

describe('practice mode', () => {
  const notes: Array<[number, 'left' | 'right']> = Array.from({ length: 6 }, (_, i) => [2 + i * 0.5, 'left']);

  it('enemies that get through are hits taken, not death: the song goes on', async () => {
    const g = await play(notes, true);
    g.press(notes[0][0], 'left');
    g.advanceTo(6);
    expect(g.death()).toBeUndefined();
    expect(g.isOver()).toBe(false);
    expect(g.engine.practiceHits).toHaveLength(5);
    // Each one is a miss and breaks the combo
    expect(g.engine.scoreState.missCount).toBe(5);
    expect(g.engine.scoreState.combo).toBe(0);
  });

  it('counts for nothing: no lifetime stats, no unlocks, no best progress', async () => {
    const g = await play(notes, true);
    g.engine.lifetimeStats = { ...EMPTY_STATS, enemiesDefeated: 330 };
    for (const [t, lane] of notes) g.press(t, lane);
    g.engine.stop();
    expect(g.engine.lifetimeStats).toEqual({ ...EMPTY_STATS, enemiesDefeated: 330 });
    expect(g.engine.newUnlocks).toEqual([]);
    expect(g.engine.runUnlocks).toEqual([]);
  });

  it('still runs the midgame ad clock, so practice is never an ad-free way to play', async () => {
    const g = await play(notes, true);
    const before = g.engine.adClockSeconds;
    g.advanceTo(4);
    g.engine.stop();
    expect(g.engine.adClockSeconds).toBeGreaterThan(before + 3);
  });

  it('a normal song after a practice one is back to normal: one enemy through ends it', async () => {
    const g = await play(notes, true);
    await g.engine.startSong(g.engine.track!, false);
    expect(g.engine.practice).toBe(false);
    expect(g.engine.practiceHits).toEqual([]);
  });
});
