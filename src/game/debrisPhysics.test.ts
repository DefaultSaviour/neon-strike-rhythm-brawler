import { describe, expect, it } from 'vitest';
import { DebrisPiece, DebrisWorld, massProperties, shatterEnemy, stepDebris } from './debrisPhysics';

const world: DebrisWorld = { floorY: 68, pitHalfWidth: 40, beltSpeed: 0, gravity: 1500 };

function piece(overrides: Partial<DebrisPiece> & Pick<DebrisPiece, 'shape'>): DebrisPiece {
  const halfLength = overrides.halfLength ?? (overrides.shape === 'circle' ? 0 : 15);
  const radius = overrides.radius ?? (overrides.shape === 'circle' ? 8 : 2);
  const { mass, inertia } = massProperties(overrides.shape, halfLength, radius);
  return {
    id: 1,
    role: 'limb',
    x: -200,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    vAngle: 0,
    color: '#ff0000',
    accent: '#ffffff',
    heat: 1,
    life: 0,
    maxLife: 100,
    alpha: 1,
    inPit: false,
    mass,
    inertia,
    halfLength,
    radius,
    ...overrides,
  };
}

/** Run the simulation at 60fps for `seconds`, calling `onFrame` after every frame. */
function simulate(pieces: DebrisPiece[], w: DebrisWorld, seconds: number, onFrame?: () => void) {
  const result = { impacts: 0, sunk: [] as DebrisPiece[] };
  for (let t = 0; t < seconds; t += 1 / 60) {
    const r = stepDebris(pieces, w, 1 / 60);
    result.impacts += r.impacts.length;
    result.sunk.push(...r.sunk);
    onFrame?.();
  }
  return result;
}

describe('stepDebris: floor physics', () => {
  it('a dropped ball bounces lower each time, then rests on the floor', () => {
    const ball = piece({ shape: 'circle', y: -150 });
    const peaks: number[] = [];
    let wasFalling = false;
    simulate([ball], world, 4, () => {
      // A bounce peak is where the ball stops rising and starts falling.
      if (ball.vy > 0 && !wasFalling) peaks.push(ball.y);
      wasFalling = ball.vy > 0;
    });

    // Each peak is higher on screen (smaller y means higher), i.e. lower bounces.
    for (let i = 2; i < peaks.length; i++) expect(peaks[i]).toBeGreaterThanOrEqual(peaks[i - 1] - 0.5);
    expect(ball.y + ball.radius).toBeCloseTo(world.floorY, 0);
    expect(Math.abs(ball.vy)).toBeLessThan(5);
  });

  it('never lets a piece sink through the floor', () => {
    const fast = piece({ shape: 'segment', y: 0, vy: 3000, angle: 0.4 });
    simulate([fast], world, 2, () => {
      const lowest = fast.y + Math.abs(Math.sin(fast.angle)) * fast.halfLength + fast.radius;
      expect(lowest).toBeLessThanOrEqual(world.floorY + 1);
    });
  });

  it('a stick landing on one end starts to spin and ends up lying flat', () => {
    const stick = piece({ shape: 'segment', y: -60, angle: 0.9 });
    let maxSpin = 0;
    simulate([stick], world, 4, () => (maxSpin = Math.max(maxSpin, Math.abs(stick.vAngle))));

    expect(maxSpin).toBeGreaterThan(1);
    const tilt = Math.abs(Math.sin(stick.angle));
    expect(tilt).toBeLessThan(0.1);
  });

  it('friction stops a sliding piece on a still floor', () => {
    const slider = piece({ shape: 'segment', y: world.floorY - 2, vx: 300 });
    simulate([slider], world, 3);
    expect(Math.abs(slider.vx)).toBeLessThan(2);
  });

  it('a rolling ball spins in the direction it travels', () => {
    const ball = piece({ shape: 'circle', y: world.floorY - 8, vx: 200 });
    simulate([ball], world, 0.3);
    // Rolling right with y pointing down means clockwise = positive spin.
    expect(ball.vAngle).toBeGreaterThan(0);
  });
});

describe('stepDebris: conveyors and pit', () => {
  const beltWorld: DebrisWorld = { ...world, beltSpeed: 120 };

  it('the left belt carries a resting piece right, into the pit', () => {
    const p = piece({ shape: 'segment', x: -150, y: world.floorY - 2 });
    const pieces = [p];
    const { sunk } = simulate(pieces, beltWorld, 5);
    expect(sunk).toContain(p);
    expect(pieces).not.toContain(p);
  });

  it('the right belt carries pieces left', () => {
    const p = piece({ shape: 'segment', x: 200, y: world.floorY - 2 });
    simulate([p], beltWorld, 0.5);
    expect(p.x).toBeLessThan(200);
    expect(p.vx).toBeLessThan(0);
  });

  it('a piece over the pit falls straight through the floor line', () => {
    const p = piece({ shape: 'circle', x: 0, y: 0 });
    simulate([p], world, 0.6);
    expect(p.inPit).toBe(true);
    expect(p.y).toBeGreaterThan(world.floorY);
  });

  it('reports sparks for hard landings only', () => {
    const hard = piece({ shape: 'segment', y: -200 });
    const soft = piece({ shape: 'segment', x: 200, y: world.floorY - 3 });
    expect(simulate([hard], world, 1).impacts).toBeGreaterThan(0);
    expect(simulate([soft], world, 1).impacts).toBe(0);
  });

  it('fades out and removes pieces that outlive their lifetime', () => {
    const p = piece({ shape: 'segment', y: world.floorY - 2, maxLife: 0.5 });
    const pieces = [p];
    simulate(pieces, world, 2);
    expect(pieces).toHaveLength(0);
  });
});

describe('shatterEnemy', () => {
  // Small deterministic random source.
  let seed = 3;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let id = 0;
  const shatter = (facing: number, power = 1) =>
    shatterEnemy(
      {
        x: facing === 1 ? -80 : 80,
        phase: 0.5,
        facing,
        scale: 1,
        color: '#ff0000',
        accent: '#ffff00',
        hasBlade: true,
        power,
        extraShards: 2,
        random,
      },
      () => ++id
    );

  it('creates a head, torso, 8 limb pieces, a weapon and shards', () => {
    const roles = shatter(1).map((p) => p.role);
    expect(roles.filter((r) => r === 'head')).toHaveLength(1);
    expect(roles.filter((r) => r === 'torso')).toHaveLength(1);
    expect(roles.filter((r) => r === 'limb')).toHaveLength(8);
    expect(roles.filter((r) => r === 'weapon')).toHaveLength(1);
    expect(roles.filter((r) => r === 'shard')).toHaveLength(5);
  });

  it('starts pieces inside the enemy body and launches them away from the player', () => {
    const left = shatter(1); // enemy on the left lane, player is to its right
    const avgVx = left.reduce((s, p) => s + p.vx, 0) / left.length;
    expect(avgVx).toBeLessThan(0);
    for (const p of left) {
      // Body parts sit within the figure; the sword is held out in front, so it reaches further.
      expect(Math.abs(p.x - -80)).toBeLessThan(p.role === 'weapon' ? 90 : 60);
      expect(p.y).toBeLessThanOrEqual(68);
      expect(p.vy).toBeLessThan(200); // mostly upward or flat, never slammed down
    }

    const right = shatter(-1);
    expect(right.reduce((s, p) => s + p.vx, 0)).toBeGreaterThan(0);
  });

  it('a stronger hit throws pieces faster', () => {
    const speed = (ps: DebrisPiece[]) => ps.reduce((s, p) => s + Math.hypot(p.vx, p.vy), 0) / ps.length;
    expect(speed(shatter(1, 2))).toBeGreaterThan(speed(shatter(1, 1)) * 1.5);
  });

  it('long limbs struck off-centre pick up spin', () => {
    const limbs = shatter(1).filter((p) => p.role === 'limb');
    expect(limbs.some((p) => Math.abs(p.vAngle) > 5)).toBe(true);
  });
});
