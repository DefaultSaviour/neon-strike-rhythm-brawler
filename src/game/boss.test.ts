import { describe, expect, it } from 'vitest';
import { Lane } from '../types/game';
import { BOSS_ORDER, BOSS_SECONDS, BOSS_STAND_X, ENTRANCE_SEC, TWINS_STAND_X, bossFigures, bossKindFor, bossSideAt, bossStage, fistFlightSec, HP_PER_ATTACK, OFF_SCREEN_X, planBoss } from './boss';

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

  it('throws its fists from the side it stands on; anything else comes from the other side', () => {
    const notes = chart();
    const plan = planBoss(notes, 120)!;
    notes.forEach((n, i) => {
      if (n.time < plan.start || !plan.keep[i]) return;
      const side = bossSideAt(plan, n.time);
      if (plan.attack[i]) expect(plan.lanes[i]).toBe(side);
      else expect(plan.lanes[i]).not.toBe(side);
    });
  });

  it('still sends a few small enemies from the far side', () => {
    const notes = chart();
    const plan = planBoss(notes, 120)!;
    const minions = notes.filter((n, i) => n.time >= plan.start && plan.keep[i] && !plan.attack[i]);
    expect(minions.length).toBeGreaterThan(0);
    minions.forEach((n) => expect(n.lane).not.toBe(bossSideAt(plan, n.time)));
    const fists = plan.attack.filter(Boolean).length;
    expect(minions.length).toBeLessThan(fists / 3);
  });

  it('keeps every note before it arrives, except on the side it lands on while it crashes down', () => {
    const notes = chart();
    const plan = planBoss(notes, 120)!;
    // At 120 BPM enemies walk 2 s (4 beats), fists fly 1 s (2 beats)
    const landingFrom = plan.start - fistFlightSec(120, 2) - ENTRANCE_SEC;
    let cleared = 0;
    notes.forEach((n, i) => {
      if (n.time >= plan.start) return;
      const landing = n.time >= landingFrom && n.lane === plan.firstSide;
      if (landing) cleared++;
      expect(plan.keep[i]).toBe(!landing);
    });
    expect(cleared).toBeGreaterThan(0);
  });

  it('ends on a fist: the killing blow is the last thing to hit', () => {
    for (const kind of ['leaper', 'runner', 'twins'] as const) {
      const notes = chart();
      const plan = planBoss(notes, 120, kind)!;
      const lastKept = notes.map((_, i) => i).filter((i) => plan.keep[i]).pop()!;
      expect(plan.attack[lastKept], kind).toBe(true);
    }
  });

  it('never lands an ordinary enemy within a beat of a fist on the same side', () => {
    for (const kind of ['leaper', 'runner', 'twins'] as const) {
      const notes = chart();
      const plan = planBoss(notes, 120, kind)!;
      const kept = notes.map((n, i) => ({ time: n.time, lane: plan.lanes[i], i })).filter(({ i }) => plan.keep[i]);
      for (const e of kept.filter(({ i }) => !plan.attack[i])) {
        for (const f of kept.filter(({ i }) => plan.attack[i] && plan.lanes[i] === e.lane)) {
          expect(Math.abs(f.time - e.time), kind).toBeGreaterThanOrEqual(0.5); // a beat at 120 BPM
        }
      }
    }
  });

  it('switches sides every 8 beats', () => {
    const plan = planBoss(chart(), 120)!;
    expect(bossSideAt(plan, plan.start)).toBe('right');
    expect(bossSideAt(plan, plan.start + 4.1)).toBe('left'); // 8 beats at 120 BPM = 4 s
    expect(bossSideAt(plan, plan.start + 8.1)).toBe('right');
  });

  it('throws its fists at least half a beat apart, dropping notes in between', () => {
    const notes = chart();
    const plan = planBoss(notes, 120)!;
    const fists = notes.filter((_, i) => plan.attack[i]).map((n) => n.time);
    for (let i = 1; i < fists.length; i++) expect(fists[i] - fists[i - 1]).toBeGreaterThanOrEqual(0.25 - 0.011);
    // The test chart has a note every quarter second = half a beat at 120 BPM: no fist is dropped
    // for spacing (only ordinary enemies too close to a fist, or where the boss lands)
    notes.forEach((n, i) => {
      if (n.time >= plan.start && !plan.keep[i]) expect(n.lane).not.toBe(bossSideAt(plan, n.time));
    });
    expect(planBoss(notes, 60)!.keep.some((k) => !k)).toBe(true);
  });

  it('has one chunk of health per fist, so the bar empties exactly on the last fist', () => {
    const plan = planBoss(chart(), 120)!;
    expect(plan.maxHp).toBe(plan.attack.filter(Boolean).length * HP_PER_ATTACK);
    const twins = planBoss(chart(), 120, 'twins')!;
    const notes = chart();
    for (const side of ['left', 'right'] as const) {
      expect(twins.sideHp[side]).toBe(notes.filter((_, i) => twins.attack[i] && twins.lanes[i] === side).length);
    }
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

describe('the three bosses', () => {
  it('take turns down the soundtrack, and an imported song always gets the same one', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    expect(ids.map((id) => bossKindFor(id, ids))).toEqual(['leaper', 'runner', 'twins', 'leaper', 'runner']);
    const imported = bossKindFor('custom_123', ids);
    expect(BOSS_ORDER).toContain(imported);
    expect(bossKindFor('custom_123', ids)).toBe(imported);
  });

  it('the Volt Runner runs off its own edge, then comes back in from the other, facing the way it runs', () => {
    const plan = planBoss(chart(), 120, 'runner')!;
    const flight = 1;
    const switchAt = plan.start - flight + plan.switchSec; // its fists change side here
    const out = bossStage(plan, switchAt - 0.4, flight);
    expect(out.running).toBe(true);
    expect(out.x).toBeGreaterThan(BOSS_STAND_X); // off past its own (right) side
    expect(out.facing).toBe(1);
    const back = bossStage(plan, switchAt - 0.1, flight);
    expect(back.x).toBeLessThan(-BOSS_STAND_X); // coming in from the left edge
    expect(back.x).toBeGreaterThan(-OFF_SCREEN_X);
    expect(back.facing).toBe(1);
    expect(bossStage(plan, switchAt + 0.2, flight)).toMatchObject({ x: -BOSS_STAND_X, running: false });
  });

  it('the twins stand one on each side, throw from their own side, and each has its own health', () => {
    const notes = chart();
    const plan = planBoss(notes, 120, 'twins')!;
    notes.forEach((n, i) => {
      if (n.time < plan.start || !plan.keep[i]) return;
      expect(plan.attack[i]).toBe(true);
      expect(plan.lanes[i]).toBe(n.lane); // never moved
    });
    expect(plan.sideHp.left).toBeGreaterThan(0);
    expect(plan.sideHp.right).toBeGreaterThan(0);
    expect(plan.sideHp.left + plan.sideHp.right).toBe(plan.maxHp);
    const figures = bossFigures(plan, plan.start, 1);
    expect(figures.map((f) => [f.side, f.x])).toEqual([
      ['left', -TWINS_STAND_X],
      ['right', TWINS_STAND_X],
    ]);
  });
});
