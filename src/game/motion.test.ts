import { describe, expect, it } from 'vitest';
import { IDLE_POSE, ATTACK_MOVES } from './animations';
import { easeInOutCubic, easeOutBack, idleBouncePose, playerRunPose, playerVictoryPose, STRIKE_PHASES, strikeFrame } from './motion';

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

describe('player run and victory poses', () => {
  const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  it('running keeps his limbs a constant length and his feet on or above the ground', () => {
    const first = playerRunPose(0);
    for (let beat = 0; beat < 3; beat += 0.1) {
      const p = playerRunPose(beat);
      expect(d(p.leftShoulder, p.leftElbow)).toBeCloseTo(d(first.leftShoulder, first.leftElbow), 3);
      expect(d(p.rightKnee, p.rightFoot)).toBeCloseTo(d(first.rightKnee, first.rightFoot), 3);
      expect(p.leftFoot.y).toBeLessThanOrEqual(68.001);
      expect(p.rightFoot.y).toBeLessThanOrEqual(68.001);
    }
  });

  it('running lifts his knees in turn', () => {
    expect(playerRunPose(0.5).leftFoot.y).toBeLessThan(55);
    expect(playerRunPose(1.5).rightFoot.y).toBeLessThan(55);
  });

  it('his scarf streams out behind him while running', () => {
    const p = playerRunPose(0.3);
    expect(p.scarf!.every((pt) => pt.x < p.head.x)).toBe(true);
  });

  it('victory pose has both hands up above his head', () => {
    const p = playerVictoryPose(2.5);
    expect(p.leftHand.y).toBeLessThan(p.head.y);
    expect(p.rightHand.y).toBeLessThan(p.head.y);
  });
});
