import { describe, expect, it } from 'vitest';
import { enemyPose } from '../game/enemyMotion';
import { flipPoseVertically } from './enemyArt';

describe('flipPoseVertically', () => {
  it('flipping twice gives back the same pose (how handstands are drawn)', () => {
    const p = enemyPose('handstand', 0.4, 'heavy');
    const back = flipPoseVertically(flipPoseVertically(p));
    expect(back).toEqual(p);
  });

  it('turns an upside-down pose into an upright one for drawing the gear', () => {
    const p = enemyPose('handstand', 0, 'heavy');
    const upright = flipPoseVertically(p);
    expect(upright.upsideDown).toBe(false);
    expect(upright.head.y).toBeLessThan(upright.chest.y); // head now on top
  });
});
