import { describe, expect, it } from 'vitest';
import { Lane } from '../types/game';
import { BOSS_SECONDS, BOSS_STAND_X, bossSideAt, bossStage, HP_PER_ATTACK, planBoss } from './boss';

/** A 2-minute chart at 120 BPM: a note every half beat, alternating sides. */
function chart(seconds = 120) {
  const notes: { time: number; lane: Lane }[] = [];
  for (let t = 1; t <= seconds; t += 0.25) notes.push({ time: t, lane: notes.length % 2 === 0 ? 'left' : 'right' });
  return notes;
}

describe('the end-of-song boss', () => {
  it('takes over the last stretch of the song, and nothing before it', () => {
    const notes = chart();
    const plan = planBoss(notes, 120)!;
    expect(plan.start).toBeGreaterThanOrEqual(notes[notes.length - 1].time - BOSS_SECONDS);
    notes.forEach((n, i) => {
      if (n.time < plan.start) {
        expect(plan.attack[i]).toBe(false);
        expect(plan.lanes[i]).toBe(n.lane);
      }
    });
  });

  it('throws its fists from the side it stands on, and still sends some small enemies from the other', () => {
    const notes = chart();
    const plan = planBoss(notes, 120)!;
    let minions = 0;
    notes.forEach((n, i) => {
      if (n.time < plan.start) return;
      const side = bossSideAt(plan, n.time);
      if (plan.attack[i]) expect(plan.lanes[i]).toBe(side);
      else {
        expect(plan.lanes[i]).not.toBe(side);
        minions++;
      }
    });
    expect(minions).toBeGreaterThan(0);
  });

  it('switches sides every 8 beats', () => {
    const plan = planBoss(chart(), 120)!;
    expect(bossSideAt(plan, plan.start)).toBe('right');
    expect(bossSideAt(plan, plan.start + 4.1)).toBe('left'); // 8 beats at 120 BPM = 4 s
    expect(bossSideAt(plan, plan.start + 8.1)).toBe('right');
  });

  it('never stacks two fists on top of each other', () => {
    const notes = chart();
    const plan = planBoss(notes, 120)!;
    const fists = notes.filter((_, i) => plan.attack[i]).map((n) => n.time);
    for (let i = 1; i < fists.length; i++) expect(fists[i] - fists[i - 1]).toBeGreaterThanOrEqual(0.12);
  });

  it('has more health than all-GOOD hits can take, so the KO needs PERFECTs', () => {
    const plan = planBoss(chart(), 120)!;
    const fists = plan.attack.filter(Boolean).length;
    expect(plan.maxHp).toBe(Math.round(fists * HP_PER_ATTACK));
    expect(fists * 2).toBeLessThan(plan.maxHp);
    expect(fists * 3).toBeGreaterThan(plan.maxHp);
  });

  it('skips short songs', () => {
    expect(planBoss(chart(30), 120)).toBeNull();
  });

  it('crashes down before its first fist, then stands on its side and leaps between sides', () => {
    const plan = planBoss(chart(), 120)!;
    const approach = 2;
    expect(bossStage(plan, plan.start - approach - 5, approach).visible).toBe(false);
    expect(bossStage(plan, plan.start - approach - 0.6, approach).lift).toBeGreaterThan(0);
    const standing = bossStage(plan, plan.start - approach + 1, approach);
    expect(standing).toMatchObject({ x: BOSS_STAND_X, lift: 0, visible: true });
    // Mid-leap (just before the fists switch to the left), it is over the middle and in the air
    const leaping = bossStage(plan, plan.start - approach + plan.switchSec - 0.27, approach);
    expect(Math.abs(leaping.x)).toBeLessThan(BOSS_STAND_X / 2);
    expect(leaping.lift).toBeGreaterThan(100);
    expect(bossStage(plan, plan.start - approach + plan.switchSec + 0.5, approach).x).toBe(-BOSS_STAND_X);
  });
});
