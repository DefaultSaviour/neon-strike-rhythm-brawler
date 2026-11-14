import { describe, expect, it } from 'vitest';
import { SPAWN_DISTANCE } from '../../game/layout';
import { approachSpeed, firstNoteFrom, HIT_FLASH_SEC, TITLE_HIT_X, titleEnemyAt, titleEnemyLook, TITLE_COMBO_LOOP, titleCombo, titleEnemyRange, titleStrike } from './titleFightBeats';
import { fighterTier } from '../../game/fighterTier';
import { getHero } from '../../game/heroes';
import { STILL_DRIFT } from '../../game/combo';

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

describe("the title fighter's moves", () => {
  it('throws the moves of the tier the run has reached, like the game', () => {
    const striker = getHero('striker');
    expect(titleStrike(striker, 0, 0, 0.42).move.tier).toBe(1);
    expect(titleStrike(striker, 8, 8, 0.42).move.tier).toBe(2);
    expect(titleStrike(striker, 20, 20, 0.42).move.tier).toBe(3);
    expect(titleStrike(striker, 35, 35, 0.42).move.tier).toBe(4);
    expect(titleStrike(striker, 60, 60, 0.42).move.tier).toBe(5);
    // And it works through the tier's moves, not the same one each time
    const names = new Set([0, 1, 2, 3, 4].map((i) => titleStrike(striker, 0, i, 0.42).move.name));
    expect(names.size).toBe(5);
  });

  it('shows the tier 4 twist: The One sits in the air, never turns, and drifts toward the enemy', () => {
    const one = getHero('theOne');
    const t4 = titleStrike(one, 35, 35, 0.42);
    expect(t4.still).toBe(true);
    expect(t4.lunge).toBe(STILL_DRIFT);
    expect(t4.rest).toBe(t4.move.restPose);
    expect(Math.max(t4.rest.leftFoot.y, t4.rest.rightFoot.y)).toBeLessThan(64);
    // Below tier 4 he stands in his own stance and stays put
    const t1 = titleStrike(one, 0, 0, 0.42);
    expect(t1.still).toBe(false);
    expect(t1.lunge).toBe(0);
    expect(t1.rest).toBe(one.idlePose);
  });

  it('holds the last pose for about two beats for heroes who hold, and not at all for the others', () => {
    expect(titleStrike(getHero('striker'), 0, 0, 0.42).holdSec).toBeCloseTo(0.84, 6);
    expect(titleStrike(getHero('striker'), 0, 0, 0.2).holdSec).toBe(0.6);
    expect(titleStrike(getHero('babaYaga'), 0, 0, 0.42).holdSec).toBe(0);
  });
});

describe("the title fighter's tiers", () => {
  it('goes through all five tiers and then starts again, so tier 4 always gets its turn', () => {
    const tiers = Array.from({ length: TITLE_COMBO_LOOP * 2 }, (_, hits) => fighterTier(titleCombo(hits)).minCombo);
    // Each tier in order, twice over
    const order = tiers.filter((t, i) => i === 0 || t !== tiers[i - 1]);
    expect(order).toEqual([0, 6, 16, 30, 50, 0, 6, 16, 30, 50]);
    // Tier 4 (30 to 49) and the top form get 20 hits each, every time round
    expect(tiers.slice(0, TITLE_COMBO_LOOP).filter((t) => t === 30)).toHaveLength(20);
    expect(tiers.slice(0, TITLE_COMBO_LOOP).filter((t) => t === 50)).toHaveLength(20);
  });
});
