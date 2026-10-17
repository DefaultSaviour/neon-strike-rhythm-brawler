import { describe, expect, it } from 'vitest';
import { IDLE_POSE, ATTACK_MOVES } from './animations';
import { attackChainFrame, CHAIN_STRIKE_SEC, easeInOutCubic, easeOutBack, idleBouncePose, playerVictoryPose, STRIKE_PHASES, strikeFrame } from './motion';

describe('easing', () => {
  it('starts at 0 and ends at 1', () => {
    for (const f of [easeOutBack, easeInOutCubic]) {
      expect(f(0)).toBeCloseTo(0);
      expect(f(1)).toBeCloseTo(1);
    }
  });

  it('easeOutBack overshoots past 1 before settling (the "snap")', () => {
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => easeOutBack(i / 100)));
    expect(peak).toBeGreaterThan(1.05);
  });
});

describe('strikeFrame', () => {
  const strike = ATTACK_MOVES[0].pose;

  it('begins at the pose the fighter was already in', () => {
    const f = strikeFrame(0, IDLE_POSE, strike, IDLE_POSE, 20);
    expect(f.pose.leftHand).toEqual(IDLE_POSE.leftHand);
    expect(f.lungeX).toBeCloseTo(0);
  });

  it('holds the full attack pose and lunge at the moment of impact', () => {
    const f = strikeFrame((STRIKE_PHASES.impact + STRIKE_PHASES.hold) / 2, IDLE_POSE, strike, IDLE_POSE, 20);
    expect(f.pose.leftHand).toEqual(strike.leftHand);
    expect(f.lungeX).toBe(20);
    expect(f.active).toBe(true);
  });

  it('reaches the attack pose much faster than it recovers', () => {
    expect(STRIKE_PHASES.impact).toBeLessThan(1 - STRIKE_PHASES.hold);
  });

  it('returns fully to rest with no lunge at the end', () => {
    const f = strikeFrame(1, IDLE_POSE, strike, IDLE_POSE, 20);
    expect(f.pose.chest.x).toBeCloseTo(IDLE_POSE.chest.x);
    expect(f.lungeX).toBeCloseTo(0);
    expect(f.active).toBe(false);
  });
});

describe('idleBouncePose', () => {
  it('dips the body on the beat but keeps the feet planted', () => {
    const onBeat = idleBouncePose(IDLE_POSE, 1, 0);
    const offBeat = idleBouncePose(IDLE_POSE, 0, 0);
    expect(onBeat.chest.y).toBeGreaterThan(offBeat.chest.y);
    expect(onBeat.leftFoot).toEqual(IDLE_POSE.leftFoot);
    expect(onBeat.rightFoot).toEqual(IDLE_POSE.rightFoot);
  });
});

describe('player victory pose', () => {
  it('victory pose has both hands up above his head', () => {
    const p = playerVictoryPose(2.5);
    expect(p.leftHand.y).toBeLessThan(p.head.y);
    expect(p.rightHand.y).toBeLessThan(p.head.y);
  });
});

describe('attackChainFrame (progress-bar attack chain)', () => {
  const pick = (i: number) => ATTACK_MOVES[i % ATTACK_MOVES.length].pose;

  it('throws a new strike every CHAIN_STRIKE_SEC', () => {
    expect(attackChainFrame(0.01, pick, IDLE_POSE).strikeIndex).toBe(0);
    expect(attackChainFrame(CHAIN_STRIKE_SEC * 1.5, pick, IDLE_POSE).strikeIndex).toBe(1);
    expect(attackChainFrame(CHAIN_STRIKE_SEC * 3.2, pick, IDLE_POSE).strikeIndex).toBe(3);
  });

  it('hits the full attack pose in the middle of each strike', () => {
    const mid = (STRIKE_PHASES.impact + STRIKE_PHASES.hold) / 2;
    const f = attackChainFrame(CHAIN_STRIKE_SEC * (2 + mid), pick, IDLE_POSE);
    expect(f.pose.leftHand).toEqual(pick(2).leftHand);
    expect(f.active).toBe(true);
  });

  it('flows from one strike into the next without jumping', () => {
    const justBefore = attackChainFrame(CHAIN_STRIKE_SEC * 2 - 1e-6, pick, IDLE_POSE).pose;
    const justAfter = attackChainFrame(CHAIN_STRIKE_SEC * 2 + 1e-6, pick, IDLE_POSE).pose;
    expect(justAfter.chest.x).toBeCloseTo(justBefore.chest.x, 2);
    expect(justAfter.leftHand.x).toBeCloseTo(justBefore.leftHand.x, 1);
  });
});
