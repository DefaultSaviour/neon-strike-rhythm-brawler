import { describe, expect, it } from 'vitest';
import { getHero, HEROES } from './heroes';
import { moveHandle } from './customAnimation';
import { applyEdit, editForSharing, editFromMove, editFromStance, HERO_HIP_LIMITS, heroWithEdits, parseHeroPoses, realKeys, STANCE_SLOT } from './heroPoses';

const close = (a: { x: number; y: number }, b: { x: number; y: number }, eps = 1e-6) => Math.hypot(a.x - b.x, a.y - b.y) < eps;

describe('editing hero moves in the Pose Studio', () => {
  it('opening any move and saving it untouched gives back exactly the same move', () => {
    for (const hero of HEROES) {
      for (const move of hero.moves) {
        if (!move.sequence) continue;
        const again = applyEdit(move, editFromMove(move));
        expect(again.sequence!.length, `${hero.label}: ${move.name}`).toBe(move.sequence.length);
        again.sequence!.forEach((k, i) => {
          const o = move.sequence![i];
          for (const joint of ['pelvis', 'head', 'frontHand', 'backHand', 'frontFoot', 'backFoot'] as const) {
            expect(close(k.pose[joint], o.pose[joint], 1e-3), `${hero.label}: ${move.name} key ${i} ${joint}`).toBe(true);
          }
          expect(k.ms).toBe(o.ms);
          expect(!!k.trail).toBe(!!o.trail);
          if (k.trail && o.trail) expect(close(k.trail.end, o.trail.end, 1e-3), `${hero.label}: ${move.name} trail ${i}`).toBe(true);
          expect(k.prop).toBe(o.prop);
          expect(k.shot).toBe(o.shot);
        });
      }
    }
  });

  it('only shows the real poses, not the holds', () => {
    const move = getHero('theOne').moves[0];
    expect(editFromMove(move).poses).toHaveLength(realKeys(move).length);
    expect(realKeys(move).length).toBeLessThan(move.sequence!.length);
  });

  it('moving a hand moves its hit effect with it', () => {
    const move = getHero('dragon').moves[0];
    const edit = editFromMove(move);
    const rig = edit.poses[0];
    const before = applyEdit(move, edit).sequence![0].trail!;
    const raised = moveHandle(rig, 'frontHand', { x: rig.frontHand.x, y: rig.frontHand.y - 15 }, HERO_HIP_LIMITS);
    const after = applyEdit(move, { ...edit, poses: [raised, ...edit.poses.slice(1)] }).sequence![0].trail!;
    expect(after.end.y).toBeLessThan(before.end.y - 5);
  });

  it('changing a pose time changes the move timing', () => {
    const move = getHero('dragon').moves[0];
    const edit = editFromMove(move);
    const slower = applyEdit(move, { ...edit, ms: edit.ms.map((m, i) => (i === 0 ? m : m + 100)) });
    expect(slower.durationMs).toBeGreaterThan(move.durationMs);
  });

  it('a hero with saved edits uses them, and leaves the other moves alone', () => {
    const hero = getHero('dragon');
    const move = hero.moves[3];
    const edit = editFromMove(move);
    const moved = { ...edit, poses: edit.poses.map((r) => moveHandle(r, 'pelvis', { x: r.pelvis.x, y: r.pelvis.y + 5 }, HERO_HIP_LIMITS)) };
    const edited = heroWithEdits(hero, { dragon: { [move.name]: moved } });
    expect(edited.moves[3].sequence![0].pose.pelvis.y).toBeCloseTo(move.sequence![0].pose.pelvis.y + 5, 3);
    expect(edited.moves[2]).toBe(hero.moves[2]);
    expect(heroWithEdits(hero, {})).toBe(hero);
  });

  it('the stance can be edited too', () => {
    const hero = getHero('dragon');
    const stance = editFromStance(hero.idlePose);
    const edited = heroWithEdits(hero, { dragon: { [STANCE_SLOT]: stance } });
    expect(close(edited.idlePose.leftHand, hero.idlePose.leftHand, 1e-3)).toBe(true);
    expect(close(edited.idlePose.pelvis, hero.idlePose.pelvis, 1e-3)).toBe(true);
  });

  it('ignores broken saves instead of crashing', () => {
    expect(parseHeroPoses(null)).toEqual({});
    expect(parseHeroPoses({ dragon: { Jab: { poses: [{ pelvis: 'nope' }], ms: [0] } } })).toEqual({});
    const good = editFromMove(getHero('dragon').moves[0]);
    expect(parseHeroPoses({ dragon: { Jab: good } }).dragon!.Jab.poses).toHaveLength(good.poses.length);
  });

  it('shares an edit as compact text with the hero and move named', () => {
    const move = getHero('dragon').moves[0];
    const text = editForSharing('dragon', move.name, editFromMove(move));
    const parsed = JSON.parse(text);
    expect(parsed.hero).toBe('dragon');
    expect(parsed.move).toBe(move.name);
    expect(parsed.poses[0].pelvis).toHaveProperty('x');
  });
});
