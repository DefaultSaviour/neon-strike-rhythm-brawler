import { describe, expect, it } from 'vitest';
import { enemyPose, EnemyPose, LIMB, Point } from './enemyMotion';
import {
  ANIMATION_STORAGE_KEY,
  animationPhase,
  builtInAnimation,
  countAnimations,
  CustomAnimation,
  EDIT_BOUNDS,
  enemyPoseFor,
  handleAt,
  handlePosition,
  lerpAngle,
  HIP_ZONE,
  LOWEST_HIPS,
  KeyValueStore,
  loadSavedAnimations,
  mergeLibraries,
  mirrorRig,
  moveHandle,
  parseLibrary,
  rigFromPose,
  roundLibrary,
  sampleAnimation,
  saveAnimations,
  withAnimation,
} from './customAnimation';

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Arms and legs must never stretch or shrink, whatever the pose. */
function expectLimbLengths(p: EnemyPose) {
  expect(dist(p.frontShoulder, p.frontElbow)).toBeCloseTo(LIMB.upperArm, 3);
  expect(dist(p.frontElbow, p.frontHand)).toBeCloseTo(LIMB.forearm, 3);
  expect(dist(p.backShoulder, p.backElbow)).toBeCloseTo(LIMB.upperArm, 3);
  expect(dist(p.backElbow, p.backHand)).toBeCloseTo(LIMB.forearm, 3);
  expect(dist(p.pelvis, p.frontKnee)).toBeCloseTo(LIMB.thigh, 3);
  expect(dist(p.frontKnee, p.frontFoot)).toBeCloseTo(LIMB.shin, 3);
  expect(dist(p.pelvis, p.backKnee)).toBeCloseTo(LIMB.thigh, 3);
  expect(dist(p.backKnee, p.backFoot)).toBeCloseTo(LIMB.shin, 3);
}

function expectSamePose(a: EnemyPose, b: EnemyPose) {
  for (const k of ['head', 'chest', 'pelvis', 'frontElbow', 'frontHand', 'backElbow', 'backHand', 'frontKnee', 'frontFoot', 'backKnee', 'backFoot'] as const) {
    expect(a[k].x).toBeCloseTo(b[k].x, 3);
    expect(a[k].y).toBeCloseTo(b[k].y, 3);
  }
}

function fakeStore(): KeyValueStore & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe('rigFromPose', () => {
  it('rebuilds every built-in stance exactly, elbows and knees included', () => {
    for (const style of ['stand', 'run', 'dance', 'sway'] as const) {
      for (const beat of [0, 0.3, 1.1]) {
        const original = enemyPose(style, beat, 'samurai');
        const anim: CustomAnimation = { beatsPerPose: 1, facingCamera: original.facingCamera, poses: [rigFromPose(original)] };
        expectSamePose(sampleAnimation(anim, 0), original);
      }
    }
  });
});

describe('sampleAnimation', () => {
  const anim = builtInAnimation('dance', 'bass');

  it('hits each pose exactly on its beat and loops', () => {
    expect(animationPhase(anim, 0)).toEqual({ index: 0, next: 1, t: 0 });
    expect(animationPhase(anim, 1.5).index).toBe(3);
    expect(animationPhase(anim, 2).index).toBe(0); // 4 poses x 0.5 beats = loops every 2 beats
    expect(animationPhase(anim, -0.5).index).toBe(3); // negative beats still land on a pose
  });

  it('keeps limbs the same length while blending between poses', () => {
    for (let beat = 0; beat < 2; beat += 0.07) expectLimbLengths(sampleAnimation(anim, beat));
  });

  it('blends smoothly: halfway between two poses is between them', () => {
    const a = sampleAnimation(anim, 0).pelvis.x;
    const b = sampleAnimation(anim, 0.5).pelvis.x;
    const mid = sampleAnimation(anim, 0.25).pelvis.x;
    expect(mid).toBeGreaterThanOrEqual(Math.min(a, b) - 1e-9);
    expect(mid).toBeLessThanOrEqual(Math.max(a, b) + 1e-9);
  });
});

describe('blending rotates around the pivots', () => {
  const base = rigFromPose(enemyPose('stand', 0, 'samurai'));
  const shoulderOf = (r: typeof base) => ({ x: r.chest.x + r.shoulderSpread, y: r.chest.y + 1 });
  const reach = LIMB.upperArm + LIMB.forearm;

  it('lerpAngle takes the short way round', () => {
    const a = (350 * Math.PI) / 180;
    const b = (10 * Math.PI) / 180;
    const mid = lerpAngle(a, b, 0.5);
    expect(Math.cos(mid)).toBeCloseTo(1, 6); // through 0 deg, not 180 deg
  });

  it('a straight arm sweeps round in an arc instead of cutting across', () => {
    const sh = shoulderOf(base);
    const up = moveHandle(base, 'frontHand', { x: sh.x, y: sh.y - 60 });
    const out = moveHandle(base, 'frontHand', { x: sh.x + 60, y: sh.y });
    const anim: CustomAnimation = { beatsPerPose: 1, facingCamera: false, poses: [up, out] };
    const mid = sampleAnimation(anim, 0.5);
    // A straight-line blend would pull the hand in to ~0.71 of the reach; an arc keeps it at full reach.
    expect(dist(mid.frontShoulder, mid.frontHand)).toBeCloseTo(reach, 1);
    expectLimbLengths(mid);
  });

  it('a forearm can spin all the way round its elbow', () => {
    // Keep the upper arm still and point the forearm up, forward, down, back.
    const pose0 = sampleAnimation({ beatsPerPose: 1, facingCamera: false, poses: [base] }, 0);
    const elbow = pose0.frontElbow;
    const spokes = [0, 1, 2, 3].map((q) => {
      const a = -Math.PI / 2 + (q * Math.PI) / 2;
      const hand = { x: elbow.x + Math.cos(a) * LIMB.forearm, y: elbow.y + Math.sin(a) * LIMB.forearm };
      // Pick the elbow side that keeps the elbow where it is (as the signature dances do).
      const sh = pose0.frontShoulder;
      const cross = (hand.x - sh.x) * (elbow.y - sh.y) - (hand.y - sh.y) * (elbow.x - sh.x);
      return { ...base, frontHand: hand, bends: { ...base.bends, frontArm: cross >= 0 ? (1 as const) : (-1 as const) } };
    });
    const anim: CustomAnimation = { beatsPerPose: 1, facingCamera: false, poses: spokes };
    let turned = 0;
    let prev: number | null = null;
    for (let beat = 0; beat <= 4; beat += 0.05) {
      const p = sampleAnimation(anim, beat);
      expectLimbLengths(p);
      const angle = Math.atan2(p.frontHand.y - p.frontElbow.y, p.frontHand.x - p.frontElbow.x);
      if (prev !== null) turned += Math.atan2(Math.sin(angle - prev), Math.cos(angle - prev));
      prev = angle;
    }
    // One full turn over the loop, always the same way round.
    expect(Math.abs(turned)).toBeCloseTo(2 * Math.PI, 1);
  });
});

describe('upside-down animations', () => {
  it('the built-in handstand stays upside down through editing, saving and playback', () => {
    const anim = builtInAnimation('handstand', 'bass');
    expect(anim.upsideDown).toBe(true);
    const lib = parseLibrary(withAnimation({}, 'bass-2', 'handstand', anim));
    expect(lib['bass-2']!.handstand!.upsideDown).toBe(true);
    for (let beat = 0; beat < 2; beat += 0.13) {
      const p = sampleAnimation(lib['bass-2']!.handstand!, beat);
      expect(p.upsideDown).toBe(true);
      expectLimbLengths(p);
    }
  });

  it('upright animations do not gain an upsideDown flag when loaded', () => {
    const anim = builtInAnimation('dance', 'sub');
    expect('upsideDown' in anim).toBe(false);
    expect('upsideDown' in parseLibrary(withAnimation({}, 'sub-1', 'dance', anim))['sub-1']!.dance!).toBe(false);
  });
});

describe('enemyPoseFor', () => {
  it('uses the built-in stance when there is no custom animation', () => {
    expectSamePose(enemyPoseFor('dance', 0.7, 'sub', 1, {}), enemyPose('dance', 0.7, 'heavy'));
  });

  it('uses the custom animation only for that enemy and stance', () => {
    const custom = builtInAnimation('sway', 'sub');
    const lib = withAnimation({}, 'sub-2', 'dance', custom);
    expectSamePose(enemyPoseFor('dance', 0, 'sub', 2, lib), sampleAnimation(custom, 0));
    expectSamePose(enemyPoseFor('dance', 0, 'sub', 1, lib), enemyPose('dance', 0, 'heavy'));
    expectSamePose(enemyPoseFor('run', 0, 'sub', 2, lib), enemyPose('run', 0, 'heavy'));
  });
});

describe('moveHandle', () => {
  const rig = rigFromPose(enemyPose('stand', 0, 'samurai'));

  it('moves a hand where you drag it when it is within reach', () => {
    const target = { x: rig.chest.x + 20, y: rig.chest.y - 20 };
    const moved = moveHandle(rig, 'frontHand', target);
    expect(moved.frontHand.x).toBeCloseTo(target.x, 3);
    expect(moved.frontHand.y).toBeCloseTo(target.y, 3);
    expect(rig.frontHand).not.toEqual(moved.frontHand); // the original rig is untouched
  });

  it('stops a hand at the end of the straight arm when dragged too far', () => {
    const moved = moveHandle(rig, 'frontHand', { x: 90, y: -150 });
    const shoulder = { x: moved.chest.x + moved.shoulderSpread, y: moved.chest.y + 1 };
    expect(dist(shoulder, moved.frontHand)).toBeCloseTo(LIMB.upperArm + LIMB.forearm, 2);
  });

  it('keeps feet above the floor', () => {
    expect(moveHandle(rig, 'frontFoot', { x: 10, y: 200 }).frontFoot.y).toBeLessThanOrEqual(EDIT_BOUNDS.maxY);
  });

  it('dragging the pelvis carries the upper body and leaves the feet planted', () => {
    const moved = moveHandle(rig, 'pelvis', { x: rig.pelvis.x + 5, y: rig.pelvis.y + 6 });
    expect(moved.chest.x - rig.chest.x).toBeCloseTo(5);
    expect(moved.head.y - rig.head.y).toBeCloseTo(6);
    expect(moved.frontFoot.x).toBeCloseTo(rig.frontFoot.x, 3);
    expect(moved.frontFoot.y).toBeCloseTo(rig.frontFoot.y, 3);
  });

  it('chest and head swing around their parent without stretching the body', () => {
    const spine = dist(rig.pelvis, rig.chest);
    const neck = dist(rig.chest, rig.head);
    const bent = moveHandle(rig, 'chest', { x: 40, y: -10 });
    expect(dist(bent.pelvis, bent.chest)).toBeCloseTo(spine, 5);
    expect(dist(bent.chest, bent.head)).toBeCloseTo(neck, 5);
    const nod = moveHandle(rig, 'head', { x: 50, y: -40 });
    expect(dist(nod.chest, nod.head)).toBeCloseTo(neck, 5);
  });

  it('every edit keeps limbs the right length', () => {
    let r = rig;
    r = moveHandle(r, 'pelvis', { x: 4, y: 20 });
    r = moveHandle(r, 'backHand', { x: -60, y: -100 });
    r = moveHandle(r, 'frontFoot', { x: 30, y: 30 });
    r = moveHandle(r, 'frontKnee', { x: -20, y: 40 });
    r = moveHandle(r, 'backElbow', { x: 30, y: -60 });
    r = mirrorRig(r);
    expectLimbLengths(sampleAnimation({ beatsPerPose: 1, facingCamera: false, poses: [r] }, 0));
  });
});

describe('timing zone', () => {
  const rig = rigFromPose(enemyPose('stand', 0, 'samurai'));

  it('the hips cannot be dragged out of the timing zone', () => {
    expect(moveHandle(rig, 'pelvis', { x: 60, y: rig.pelvis.y }).pelvis.x).toBe(HIP_ZONE);
    expect(moveHandle(rig, 'pelvis', { x: -60, y: rig.pelvis.y }).pelvis.x).toBe(-HIP_ZONE);
  });

  it('the hips cannot sink into the floor, and nothing else ends up below it', () => {
    const squashed = moveHandle(rig, 'pelvis', { x: 0, y: 200 });
    expect(squashed.pelvis.y).toBe(LOWEST_HIPS);
    for (const q of [squashed.frontHand, squashed.backHand, squashed.frontFoot, squashed.backFoot]) {
      expect(q.y).toBeLessThanOrEqual(EDIT_BOUNDS.maxY + 1e-9);
    }
  });

  it('a loaded animation with the hips off to one side is slid back into the zone, shape intact', () => {
    const shifted = { ...rig, pelvis: { x: rig.pelvis.x + 40, y: rig.pelvis.y }, chest: { x: rig.chest.x + 40, y: rig.chest.y } };
    const lib = parseLibrary({ 'sub-1': { dance: { beatsPerPose: 1, facingCamera: false, poses: [shifted] } } });
    const loaded = lib['sub-1']!.dance!.poses[0];
    expect(Math.abs(loaded.pelvis.x)).toBeLessThanOrEqual(HIP_ZONE);
    // Slid as one piece: the chest is still the same distance from the hips.
    expect(loaded.chest.x - loaded.pelvis.x).toBeCloseTo(shifted.chest.x - shifted.pelvis.x, 6);
  });
});

describe('dragging elbows and knees', () => {
  // The guard stance has bent arms and legs, so there's a real elbow / knee to grab.
  const rig = rigFromPose(enemyPose('stand', 0, 'samurai'));
  const poseOf = (r: typeof rig) => sampleAnimation({ beatsPerPose: 1, facingCamera: false, poses: [r] }, 0);

  it('the elbow follows the pointer around the shoulder, and the forearm rides along', () => {
    const before = poseOf(rig);
    const target = { x: before.frontShoulder.x + 5, y: before.frontShoulder.y - 30 };
    const after = poseOf(moveHandle(rig, 'frontElbow', target));
    // Upper arm now points at the pointer...
    const dir = Math.atan2(after.frontElbow.y - after.frontShoulder.y, after.frontElbow.x - after.frontShoulder.x);
    expect(dir).toBeCloseTo(Math.atan2(target.y - after.frontShoulder.y, target.x - after.frontShoulder.x), 3);
    // ...and the forearm still points the same way it did.
    const forearm = (p: EnemyPose) => Math.atan2(p.frontHand.y - p.frontElbow.y, p.frontHand.x - p.frontElbow.x);
    expect(forearm(after)).toBeCloseTo(forearm(before), 3);
    expectLimbLengths(after);
  });

  it('swinging the elbow past straight bends the arm the other way', () => {
    const before = poseOf(rig);
    const sh = before.frontShoulder;
    // The arm is straight when the upper arm points the same way as the forearm.
    // Swing the elbow from where it is, past that line, to the other side.
    const upper = Math.atan2(before.frontElbow.y - sh.y, before.frontElbow.x - sh.x);
    const fore = Math.atan2(before.frontHand.y - before.frontElbow.y, before.frontHand.x - before.frontElbow.x);
    const gap = Math.atan2(Math.sin(fore - upper), Math.cos(fore - upper));
    const past = fore + gap * 0.6;
    const moved = moveHandle(rig, 'frontElbow', { x: sh.x + Math.cos(past) * 20, y: sh.y + Math.sin(past) * 20 });
    expect(moved.bends.frontArm).toBe(-rig.bends.frontArm);
    // Swinging only part way (not past straight) keeps the bend.
    const part = upper + gap * 0.4;
    const kept = moveHandle(rig, 'frontElbow', { x: sh.x + Math.cos(part) * 20, y: sh.y + Math.sin(part) * 20 });
    expect(kept.bends.frontArm).toBe(rig.bends.frontArm);
    expectLimbLengths(poseOf(moved));
  });

  it('a knee drag never pushes the foot through the floor', () => {
    const moved = moveHandle(rig, 'frontKnee', { x: 60, y: 60 });
    expect(moved.frontFoot.y).toBeLessThanOrEqual(EDIT_BOUNDS.maxY + 1e-9);
    expectLimbLengths(poseOf(moved));
  });
});

describe('mirrorRig', () => {
  const rig = rigFromPose(enemyPose('dance', 0, 'samurai'));

  it('mirroring twice gives back the same pose', () => {
    const twice = mirrorRig(mirrorRig(rig));
    expect(twice.frontHand.x).toBeCloseTo(rig.frontHand.x, 3);
    expect(twice.backFoot.y).toBeCloseTo(rig.backFoot.y, 3);
    expect(twice.bends).toEqual(rig.bends);
  });
});

describe('handleAt', () => {
  const rig = rigFromPose(enemyPose('stand', 0, 'samurai'));

  it('finds the joint under the pointer', () => {
    expect(handleAt(rig, { x: rig.head.x + 1, y: rig.head.y }, 6)).toBe('head');
    expect(handleAt(rig, { x: 80, y: -140 }, 6)).toBeNull();
  });

  it('finds elbows and knees too', () => {
    expect(handleAt(rig, handlePosition(rig, 'frontKnee'), 4)).toBe('frontKnee');
    expect(handleAt(rig, handlePosition(rig, 'backElbow'), 4)).toBe('backElbow');
  });
});

describe('library', () => {
  const anim = builtInAnimation('dance', 'high');

  it('survives a save / load round trip', () => {
    const store = fakeStore();
    const lib = withAnimation({}, 'high-3', 'dance', anim);
    expect(saveAnimations(store, lib)).toBe(true);
    expect(loadSavedAnimations(store)).toEqual(lib);
  });

  it('ignores broken or tampered data instead of crashing', () => {
    const store = fakeStore();
    store.data[ANIMATION_STORAGE_KEY] = '{not json';
    expect(loadSavedAnimations(store)).toEqual({});
    expect(parseLibrary(null)).toEqual({});
    expect(parseLibrary({ 'boss-9': { dance: anim } })).toEqual({}); // unknown enemy
    expect(parseLibrary({ 'sub-1': { moonwalk: anim } })).toEqual({}); // unknown stance
    expect(parseLibrary({ 'sub-1': { dance: { ...anim, poses: [] } } })).toEqual({}); // no poses
    expect(parseLibrary({ 'sub-1': { dance: { ...anim, beatsPerPose: 0 } } })).toEqual({});
    const badPose = { ...anim.poses[0], head: { x: 'a', y: 1 } };
    expect(parseLibrary({ 'sub-1': { dance: { ...anim, poses: [badPose] } } })).toEqual({});
  });

  it('pulls wild coordinates back inside the editing area', () => {
    const far = { ...anim.poses[0], head: { x: 1e6, y: -1e6 } };
    const lib = parseLibrary({ 'sub-1': { dance: { ...anim, poses: [far] } } });
    expect(lib['sub-1']!.dance!.poses[0].head).toEqual({ x: EDIT_BOUNDS.maxX, y: EDIT_BOUNDS.minY });
  });

  it('saving a storage-full browser reports failure', () => {
    const store: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(saveAnimations(store, {})).toBe(false);
  });

  it('merges, adds and removes animations per enemy and stance', () => {
    const base = withAnimation({}, 'sub-1', 'dance', anim);
    const mine = withAnimation({}, 'sub-1', 'run', anim);
    const merged = mergeLibraries(base, mine);
    expect(Object.keys(merged['sub-1']!).sort()).toEqual(['dance', 'run']);
    expect(countAnimations(merged)).toBe(2);
    expect(withAnimation(mine, 'sub-1', 'run', null)).toEqual({});
  });

  it('rounding for export keeps the file loadable', () => {
    const lib = roundLibrary(withAnimation({}, 'bass-2', 'sway', builtInAnimation('sway', 'bass')));
    expect(parseLibrary(lib)).toEqual(lib);
  });
});
