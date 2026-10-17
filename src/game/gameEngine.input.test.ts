import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioEngine } from '../audio/audioEngine';
import { GameEngine } from './gameEngine';
import { BeatNote, TimingJudgementType, Track } from '../types/game';

/**
 * Drives the real GameEngine with a fake song clock, pressing keys at exact
 * song times, to check that on-time presses always count.
 */

let clock = 0;

function makeTrack(notes: Array<[number, 'left' | 'right']>): Track {
  const beatNotes: BeatNote[] = notes.map(([time, lane]) => ({ time, lane, enemyType: 'brawler', band: 'sub', tier: 2 }));
  return { id: 't', title: 't', artist: 'a', bpm: 150, difficulty: 'Hard', duration: 60, description: '', notes: beatNotes };
}

async function play(notes: Array<[number, 'left' | 'right']>) {
  const judgements: TimingJudgementType[] = [];
  let gameOver = false;
  const engine = new GameEngine({
    onScoreUpdate: () => {},
    onGameOver: () => (gameOver = true),
    onJudgement: (j) => judgements.push(j),
  });
  engine.settings.latencyOffsetMs = 0;
  await engine.startSong(makeTrack(notes));
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
  return { engine, judgements, press, advanceTo, isOver: () => gameOver };
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
