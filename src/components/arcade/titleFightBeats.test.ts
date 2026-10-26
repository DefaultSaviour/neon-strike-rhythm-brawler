import { describe, expect, it } from 'vitest';
import { SPAWN_DISTANCE } from '../../game/layout';
import { approachSpeed, firstNoteFrom, HIT_FLASH_SEC, TITLE_HIT_X, titleEnemyAt, titleEnemyLook, titleEnemyRange } from './titleFightBeats';

const PERIOD = 60 / 197;
const notes = [1, 1.3, 1.45, 2, 3.5, 3.5, 6].map((time) => ({ time }));

describe('the title fight', () => {
  it('comes in at the game speed: spawn point to strike line in one bar', () => {
    expect(approachSpeed(PERIOD) * PERIOD * 4).toBeCloseTo(SPAWN_DISTANCE - TITLE_HIT_X);
    // ...but never quicker than 1.1 s or slower than 2.2 s, like the game
    expect(approachSpeed(0.1)).toBeCloseTo((SPAWN_DISTANCE - TITLE_HIT_X) / 1.1);
    expect(approachSpeed(1)).toBeCloseTo((SPAWN_DISTANCE - TITLE_HIT_X) / 2.2);
  });

  it('an enemy reaches the strike point exactly on its note', () => {
    const speed = approachSpeed(PERIOD);
    const before = titleEnemyAt(10, 9.999, speed)!;
    expect(before.phase).toBe('coming');
    expect(before.x).toBeCloseTo(TITLE_HIT_X, 0);
    expect(titleEnemyAt(10, 9, speed)!.x).toBeCloseTo(TITLE_HIT_X + speed);
    const on = titleEnemyAt(10, 10, speed)!;
    expect(on.phase).toBe('hit');
    expect(on.x).toBe(TITLE_HIT_X);
  });

  it('is hit on its note, then gone (it breaks into pieces)', () => {
    expect(titleEnemyAt(10, 10 + HIT_FLASH_SEC / 2, 300)!.phase).toBe('hit');
    expect(titleEnemyAt(10, 10 + HIT_FLASH_SEC + 0.01, 300)).toBeNull();
  });

  it('finds notes by time', () => {
    expect(firstNoteFrom(notes, 0)).toBe(0);
    expect(firstNoteFrom(notes, 1.3)).toBe(1);
    expect(firstNoteFrom(notes, 3.5)).toBe(4);
    expect(firstNoteFrom(notes, 9)).toBe(notes.length);
  });

  it('lists the enemies on screen: just hit, and on the way in as far as the right edge', () => {
    // At 1.32 s with 100 units per second and 200 units to the right edge: 1.3 was just hit, up to 2.0 s are coming
    const [from, to] = titleEnemyRange(notes, 1.32, 100, 200);
    expect(notes.slice(from, to).map((n) => n.time)).toEqual([1.3, 1.45, 2]);
  });

  it('looks like the enemy the game would send for that note', () => {
    expect(titleEnemyLook({ time: 0, lane: 'left', enemyType: 'brawler', band: 'bass', tier: 3 })).toEqual({ band: 'bass', tier: 3 });
    expect(titleEnemyLook({ time: 0, lane: 'left', enemyType: 'brawler', pitchCategory: 'kick' }).band).toBe('sub');
  });
});
