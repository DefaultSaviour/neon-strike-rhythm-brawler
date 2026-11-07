import { describe, expect, it } from 'vitest';
import { Lane } from '../types/game';
import {
  approachSecFor,
  BOSS_KINDS,
  BOSS_SECONDS,
  BOSS_STAND_X,
  ENTRANCE_SEC,
  TWINS_STAND_X,
  bossFigures,
  bossSideAt,
  bossStage,
  fistFlightSec,
  fistPath,
  HP_PER_ATTACK,
  LOB_START_LIFT,
  OFF_SCREEN_X,
  TELEPORT_BEATS,
  TELEPORT_VANISH,
  pickBossKind,
  planBoss,
  shadowFistShown,
} from './boss';

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
      if (plan.attack[i] && plan.moves[i] === 'fist') expect(plan.lanes[i]).toBe(side);
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
    for (const kind of BOSS_KINDS) {
      const notes = chart();
      const plan = planBoss(notes, 120, kind)!;
      const lastKept = notes.map((_, i) => i).filter((i) => plan.keep[i]).pop()!;
      expect(plan.attack[lastKept], kind).toBe(true);
    }
  });

  it('never lands an ordinary enemy within a beat of a fist on the same side', () => {
    for (const kind of BOSS_KINDS) {
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
    // for spacing (only ordinary enemies too close to a fist, where the boss lands, or fists
    // making room for a lob)
    const lobTimes = notes.filter((_, i) => plan.moves[i] === 'lob').map((n) => n.time);
    notes.forEach((n, i) => {
      if (lobTimes.some((l) => Math.abs(l - n.time) < 0.5)) return;
      if (n.time >= plan.start && !plan.keep[i]) expect(n.lane).not.toBe(bossSideAt(plan, n.time));
    });
    expect(planBoss(notes, 60)!.keep.some((k) => !k)).toBe(true);
  });

  it('has one chunk of health per fist, so the bar empties exactly on the last fist', () => {
    const plan = planBoss(chart(), 120)!;
    expect(plan.maxHp).toBe(plan.attack.filter(Boolean).length * HP_PER_ATTACK);
    // The twins: each one's own fists
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

describe('the four bosses', () => {
  it('are picked at random for each play, never the same one twice running', () => {
    for (const previous of [null, ...BOSS_KINDS]) {
      const seen = new Set([0, 0.3, 0.55, 0.8, 0.999].map((r) => pickBossKind(previous, () => r)));
      if (previous) expect(seen.has(previous)).toBe(false);
      expect(seen.size).toBe(previous ? 3 : 4);
    }
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
});

describe("the Volt Runner's dash", () => {
  it('throws slow bolts before it goes, still flying in while it throws from the new side', () => {
    // 150 BPM: fists fly 0.8 s, bolts 1.6 s, the dash takes a beat (0.4 s)
    const notes: { time: number; lane: Lane }[] = [];
    for (let t = 1; t <= 120; t += 0.2) notes.push({ time: +t.toFixed(3), lane: notes.length % 2 === 0 ? 'left' : 'right' });
    const plan = planBoss(notes, 150, 'runner')!;
    const beat = 0.4;
    let overlapped = 0;
    for (const s of plan.switches) {
      const oldSide = bossSideAt(plan, s - 1e-6);
      const newSide = bossSideAt(plan, s);
      // Nothing is thrown mid-dash: what lands in the beat before the switch is bolts
      notes.forEach((n, i) => {
        if (plan.attack[i] && n.time >= s - beat && n.time < s) expect(plan.moves[i]).toBe('bolt');
      });
      // After the switch: bolts from the old side and fists from the new side, mixed
      const after = notes.map((n, i) => ({ ...n, i })).filter(({ time, i }) => plan.attack[i] && time >= s && time < s + beat);
      const bolts = after.filter(({ i }) => plan.moves[i] === 'bolt');
      bolts.forEach(({ i }) => expect(plan.lanes[i]).toBe(oldSide));
      after.filter(({ i }) => plan.moves[i] === 'fist').forEach(({ i }) => expect(plan.lanes[i]).toBe(newSide));
      if (bolts.length) overlapped++;
      if (after.length > 1) expect(bolts.length).toBeLessThan(after.length); // mixed with new-side fists
    }
    // Every dash overlaps: an old-side bolt still lands after it has switched
    expect(overlapped).toBe(plan.switches.length);
  });

  it('throws each bolt before it starts to run (no shot appears from an empty side)', () => {
    const notes: { time: number; lane: Lane }[] = [];
    for (let t = 1; t <= 120; t += 0.2) notes.push({ time: +t.toFixed(3), lane: notes.length % 2 === 0 ? 'left' : 'right' });
    const fist = fistFlightSec(150, approachSecFor(150), 'runner');
    const bolt = fistFlightSec(150, approachSecFor(150), 'runner', 'bolt');
    expect(bolt).toBeCloseTo(1.6);
    const plan = planBoss(notes, 150, 'runner')!;
    notes.forEach((n, i) => {
      if (!plan.attack[i] || n.time < plan.start) return;
      const flight = plan.moves[i] === 'bolt' ? bolt : fist;
      const thrower = bossStage(plan, n.time - flight, fist);
      expect(thrower.running, `${n.time}`).toBe(false);
      expect(Math.sign(thrower.x), `${n.time}`).toBe(plan.lanes[i] === 'left' ? -1 : 1);
    });
  });
});

describe('the twins', () => {
  it('stand one on each side, each throwing the notes on its own side, and each has its own health', () => {
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

  it('throw fists that fly for 3 beats (the single bosses: 2), never longer than an enemy walks', () => {
    expect(fistFlightSec(120, approachSecFor(120), 'twins')).toBeCloseTo(1.5);
    expect(fistFlightSec(120, approachSecFor(120), 'leaper')).toBeCloseTo(1);
    expect(fistFlightSec(240, approachSecFor(240), 'twins')).toBeLessThanOrEqual(approachSecFor(240));
  });
});

describe('getting angry halfway through', () => {
  it('the Volt Runner dashes twice as often; the Titan King keeps his pace', () => {
    const plan = planBoss(chart(), 120, 'runner')!;
    const gaps = plan.switches.map((s, i) => s - (i ? plan.switches[i - 1] : plan.start));
    plan.switches.forEach((s, i) => expect(gaps[i]).toBeCloseTo(s - gaps[i] < plan.rageAt - 0.01 ? 4 : 2));
    expect(gaps.some((g) => Math.abs(g - 2) < 1e-6)).toBe(true);
    const king = planBoss(chart(), 120, 'leaper')!;
    king.switches.forEach((s, i) => expect(s - (i ? king.switches[i - 1] : king.start)).toBeCloseTo(4));
  });

  it('the Titan King lobs some fists over the player onto the far side, with time to turn', () => {
    // A note every beat at 120 BPM, alternating sides
    const notes: { time: number; lane: Lane }[] = [];
    for (let t = 1; t <= 120; t += 0.5) notes.push({ time: t, lane: notes.length % 2 === 0 ? 'left' : 'right' });
    const plan = planBoss(notes, 120, 'leaper')!;
    const lobs = notes.map((n, i) => ({ ...n, i })).filter(({ i }) => plan.moves[i] === 'lob');
    expect(lobs.length).toBeGreaterThan(1);
    // One a bar at most
    lobs.slice(1).forEach((lob, k) => expect(lob.time - lobs[k].time).toBeGreaterThanOrEqual(2 - 1e-6));
    for (const lob of lobs) {
      expect(lob.time).toBeGreaterThanOrEqual(plan.rageAt);
      expect(plan.attack[lob.i]).toBe(true);
      expect(plan.lanes[lob.i]).not.toBe(bossSideAt(plan, lob.time)); // lands on the far side
      notes.forEach((m, j) => {
        if (j !== lob.i && plan.attack[j]) expect(Math.abs(m.time - lob.time)).toBeGreaterThanOrEqual(0.5);
      });
    }
    // Nothing is lobbed before it's angry, and the other bosses never lob
    notes.forEach((n, i) => {
      if (n.time < plan.rageAt) expect(plan.moves[i]).not.toBe('lob');
    });
    for (const kind of ['runner', 'twins', 'shadow'] as const) expect(planBoss(notes, 120, kind)!.moves).not.toContain('lob');
  });

  it("a lob leaves the boss's raised hand, goes high over the player and drops onto the far strike line", () => {
    const start = fistPath('leaper', 'lob', 'left', 78, 1);
    expect(start).toEqual({ x: BOSS_STAND_X, lift: LOB_START_LIFT });
    const middle = fistPath('leaper', 'lob', 'left', 78, 0.5);
    expect(Math.abs(middle.x)).toBeLessThan(BOSS_STAND_X / 2);
    expect(middle.lift).toBeGreaterThan(LOB_START_LIFT);
    expect(fistPath('leaper', 'lob', 'left', 78, 0)).toEqual({ x: -78, lift: 0 });
    // A straight fist flies level from the boss to its own side's strike line
    expect(fistPath('twins', 'fist', 'right', 78, 1)).toEqual({ x: TWINS_STAND_X, lift: 0 });
    expect(fistPath('twins', 'fist', 'right', 78, 0)).toEqual({ x: 78, lift: 0 });
  });
});

describe('the Shadow Fighter', () => {
  it('throws groups of 1-3 shots (2-4 once angry), teleporting to the other side between groups', () => {
    const notes = chart();
    const plan = planBoss(notes, 120, 'shadow')!;
    const shots = notes.map((n, i) => ({ ...n, i })).filter(({ time, i }) => time >= plan.start && plan.keep[i]);
    shots.forEach(({ i }) => expect(plan.attack[i]).toBe(true));
    // Split into groups by side
    const groups: (typeof shots)[] = [];
    for (const s of shots) {
      const g = groups[groups.length - 1];
      if (g && plan.lanes[g[0].i] === plan.lanes[s.i]) g.push(s);
      else groups.push([s]);
    }
    expect(groups.length).toBe(plan.switches.length + 1);
    const sizes = new Set<number>();
    groups.forEach((g, k) => {
      const angry = g[0].time >= plan.rageAt;
      sizes.add(g.length);
      // The last group can be cut short by the end of the song
      if (k < groups.length - 1) expect(g.length).toBeGreaterThanOrEqual(angry ? 2 : 1);
      expect(g.length).toBeLessThanOrEqual(angry ? 4 : 3);
      g.slice(1).forEach((s, j) => expect(s.time - g[j].time).toBeGreaterThanOrEqual(0.25 - 0.011)); // half a beat
      // The gap for the teleport before it: 2 beats, 1 once angry
      if (k) expect(g[0].time - groups[k - 1][groups[k - 1].length - 1].time).toBeGreaterThanOrEqual((angry ? 0.5 : 1) - 0.011);
    });
    expect(sizes.size).toBeGreaterThan(1); // the groups aren't all the same
    // The same every time for a song
    expect(planBoss(notes, 120, 'shadow')!.switches).toEqual(plan.switches);
  });

  it('fades out after a shot, then a portal opens on the other side and it steps out to throw the next', () => {
    const notes = chart();
    const plan = planBoss(notes, 120, 'shadow')!;
    const flight = 1;
    // Its second group starts at plan.switches[0], from the other side: thrown a flight earlier
    const throwAt = plan.switches[0] - flight;
    const gap = plan.switches[0] - plan.groupEnds[0];
    const teleport = Math.min(TELEPORT_BEATS * 0.5, 0.75 * gap);
    expect(bossStage(plan, throwAt - teleport - 0.05, flight)).toMatchObject({ x: BOSS_STAND_X, fade: 1, portal: 0 });
    const fading = bossStage(plan, throwAt - teleport * (1 - TELEPORT_VANISH / 2), flight);
    expect(fading.x).toBe(BOSS_STAND_X);
    expect(fading.fade).toBeGreaterThan(0);
    expect(fading.fade).toBeLessThan(1);
    const portal = bossStage(plan, throwAt - teleport * 0.3, flight);
    expect(portal).toMatchObject({ x: -BOSS_STAND_X, fade: 0 });
    expect(portal.portal).toBeGreaterThan(0);
    expect(bossStage(plan, throwAt + 0.01, flight)).toMatchObject({ x: -BOSS_STAND_X, fade: 1, portal: 0 });
    // It arrives the same way: out of a portal
    const arriving = bossStage(plan, plan.start - flight - ENTRANCE_SEC / 2, flight);
    expect(arriving).toMatchObject({ visible: true, fade: 0, lift: 0 });
    expect(arriving.portal).toBeCloseTo(0.5);
  });

  it('is always standing on the side of the shot it throws', () => {
    const notes = chart();
    const plan = planBoss(notes, 120, 'shadow')!;
    const flight = fistFlightSec(120, 2, 'shadow');
    notes.forEach((n, i) => {
      if (!plan.attack[i]) return;
      const at = bossStage(plan, n.time - flight + 0.001, flight);
      expect(at.fade, `${n.time}`).toBe(1);
      expect(Math.sign(at.x)).toBe(plan.lanes[i] === 'left' ? -1 : 1);
    });
  });

  it('throws its fists hidden in shadow: they only light up for the last beat', () => {
    // 120 BPM: a beat is 0.5 s
    expect(shadowFistShown(1.0, 120)).toBe(0); // thrown 2 beats out: hidden
    expect(shadowFistShown(0.5, 120)).toBe(0); // a beat out: starts to show
    expect(shadowFistShown(0.45, 120)).toBeGreaterThan(0);
    expect(shadowFistShown(0.4, 120)).toBeCloseTo(1); // fully lit for the rest of the way
    expect(shadowFistShown(0, 120)).toBe(1);
  });
});
