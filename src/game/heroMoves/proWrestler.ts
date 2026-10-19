import { AttackMove, SkeletonPose } from '../../types/game';
import { FLOOR } from '../enemyMotion';
import { armReaching, buildFighterPose, buildKey, comboMove, FighterSpec, handOf, LimbAngles, withHolds } from './poseBuilder';

/**
 * THE PRO WRESTLER: a showman grappler in the spirit of 80s and 90s
 * championship wrestling. Chops, clotheslines, a steel chair, and big
 * slams. The enemy explodes on the hit, so throws and slams are his own
 * motion: lifting an imaginary opponent and driving them into the mat.
 * Physical only: no magic.
 *
 * Built like the other combo heroes: each move is ONE clear idea in a few
 * big poses, every hit is held for a beat (withHolds), and the hips stay
 * near the centre. Moves marked as slams shake the screen harder and get a
 * crowd-pop flash (see gameEngine). 21 combos over the 5 tiers
 * (5, 5, 4, 4, 3); the first keyframe is the hit.
 *
 * Angles: 0 deg = toward the enemy, 90 = down, -90 = up, 180 = back. Feet
 * planted on the floor are at y = 68.
 */

const TRAIL = '#ff3355'; // hot ring-rope red
const F = FLOOR;

/** An arm or leg held straight out at an angle (- is higher). */
const straight = (deg: number): LimbAngles => ({ upper: deg, lower: deg });
/** Flexed arms: upper arm out, forearm up (the double-biceps pose). */
const flexFront: LimbAngles = { upper: 5, lower: -85 };
const flexBack: LimbAngles = { upper: 175, lower: -95 };
/** Arms flung back. */
const armsBack: LimbAngles = { upper: 150, lower: 130 };
/** Arms raised straight up: lifting someone overhead, or soaking up the cheers. */
const armsUp = straight(-90);
const armsUpBack = straight(-96);
/** Arms driving straight down: the slam. */
const armsDown = straight(70);
/** A leg tucked up under the body in the air. */
const tucked: LimbAngles = { upper: 70, lower: 150 };

/** A wide, heavy, planted base. */
const wide = { frontLeg: { x: 24, y: F }, backLeg: { x: -22, y: F } };
/** A lunge forward, hips kept near the centre. */
const lunge = { pelvis: { x: 6, y: 22 }, frontLeg: { x: 32, y: F }, backLeg: { x: -20, y: F } };
/** Crouched low, as after driving someone into the mat. */
const slamCrouch = { pelvis: { x: 4, y: 38 }, frontLeg: { x: 26, y: F }, backLeg: { x: -20, y: F } };

type Key = FighterSpec & {
  ms?: number;
  /** Rear hand grips the chair too */
  twoHanded?: boolean;
};

function resolve(k: Key): FighterSpec {
  const spec: FighterSpec = { ...k };
  if (k.twoHanded) {
    const hand = handOf(spec, 'front');
    const l = (spec.frontArm.lower * Math.PI) / 180;
    spec.backArm = armReaching(spec, 'back', { x: hand.x - Math.cos(l) * 10, y: hand.y - Math.sin(l) * 10 });
  }
  return spec;
}

let nextId = 501;
function combo(tier: AttackMove['tier'], name: string, description: string, keys: Key[], opts: { slam?: boolean } = {}): AttackMove {
  const move = comboMove(nextId++, tier, name, description, withHolds(keys.map((k) => buildKey(resolve(k), TRAIL, k.ms ?? 0))));
  return opts.slam ? { ...move, slam: true } : move;
}

/** The big man's stance: wide, chest out, both arms flexed. */
export const PRO_WRESTLER_IDLE: SkeletonPose = buildFighterPose(
  { pelvis: { x: 0, y: 12 }, lean: 4, frontArm: flexFront, backArm: flexBack, frontLeg: { x: 20, y: F }, backLeg: { x: -20, y: F } },
  TRAIL
);

export const PRO_WRESTLER_MOVES: AttackMove[] = [
  // ======================= Tier 1: the basics, with attitude =======================
  combo(1, 'Forearm Smash', 'Clubs a forearm down across the jaw and follows right through', [
    { ...lunge, lean: 22, frontArm: { upper: -40, lower: 30 }, backArm: armsBack, trail: { from: 'frontHand', reach: 20, curve: 16 } },
    { ms: 160, ...lunge, lean: 26, frontArm: { upper: 60, lower: 120 }, backArm: armsBack },
  ]),
  combo(1, 'Chop', 'A huge open-hand chop across the chest, then he roars at the crowd', [
    { pelvis: { x: 4, y: 16 }, lean: 18, frontArm: straight(8), backArm: armsBack, ...wide, trail: { from: 'frontHand', reach: 22, curve: 20 } },
    { ms: 170, pelvis: { x: 0, y: 12 }, lean: -10, tilt: -14, frontArm: straight(-40), backArm: straight(220), ...wide },
  ]),
  combo(1, 'Clothesline', 'Charges in with one arm stuck out straight at neck height', [
    { ...lunge, lean: 16, frontArm: straight(-4), backArm: armsBack, trail: { from: 'frontHand', reach: 26 } },
    { ms: 170, ...lunge, lean: 10, frontArm: straight(-24), backArm: armsBack },
  ]),
  combo(1, 'Headbutt', 'Grabs them by the ears and drives his forehead in', [
    { pelvis: { x: 4, y: 16 }, lean: 40, tilt: 12, frontArm: straight(-12), backArm: straight(-4), ...wide, trail: { from: 'head', reach: 14 } },
    { ms: 160, pelvis: { x: 0, y: 12 }, lean: -10, tilt: -16, frontArm: flexFront, backArm: flexBack, ...wide },
  ]),
  combo(1, 'Big Boot', 'A size-fourteen boot straight up into the face', [
    { pelvis: { x: -2, y: 8 }, lean: -20, frontArm: armsBack, backArm: armsBack, frontLeg: straight(-26), backLeg: { x: -12, y: F }, trail: { from: 'frontFoot', reach: 22 } },
    { ms: 170, pelvis: { x: 2, y: 14 }, lean: 6, frontArm: flexFront, backArm: flexBack, ...wide },
  ]),

  // ================= Tier 2: power moves =================
  combo(
    2,
    'Spinebuster',
    'Catches them round the waist, lifts, and slams them flat on their back',
    [
      { pelvis: { x: 4, y: 18 }, lean: 30, frontArm: straight(14), backArm: straight(20), ...wide, trail: { from: 'frontHand', reach: 16 } },
      { ms: 140, pelvis: { x: 0, y: 10 }, lean: -10, frontArm: { upper: -60, lower: -80 }, backArm: { upper: -70, lower: -90 }, ...wide },
      { ms: 130, ...slamCrouch, lean: 40, frontArm: armsDown, backArm: straight(76), trail: { from: 'frontHand', reach: 18 } },
    ],
    { slam: true }
  ),
  combo(2, 'Running Shoulder Tackle', 'Drops his shoulder and runs straight through them', [
    { ...lunge, lean: 45, frontArm: { upper: 80, lower: -40 }, backArm: armsBack, trail: { from: 'frontElbow', reach: 20 } },
    { ms: 170, pelvis: { x: 2, y: 12 }, lean: -4, frontArm: armsUp, backArm: armsUpBack, ...wide },
  ]),
  combo(
    2,
    'Elbow Drop',
    'Drops his whole weight down onto one elbow, then pushes up onto a knee',
    [
      { pelvis: { x: 0, y: 46 }, lean: 70, frontArm: { upper: 95, lower: -60 }, backArm: armsBack, frontLeg: straight(172), backLeg: straight(178), trail: { from: 'frontElbow', reach: 16 } },
      { ms: 180, pelvis: { x: 2, y: 38 }, lean: 10, frontArm: flexFront, backArm: flexBack, frontLeg: { x: 24, y: F }, backLeg: { upper: 100, lower: 175 } },
    ],
    { slam: true }
  ),
  combo(
    2,
    'Flying Elbow from the Top Rope',
    'Leaps off the top rope, elbow cocked, and crashes down onto it',
    [
      { pelvis: { x: 0, y: -24 }, lean: 20, frontArm: { upper: 80, lower: -100 }, backArm: straight(-120), frontLeg: tucked, backLeg: { upper: 100, lower: 150 }, trail: { from: 'frontElbow', reach: 18 } },
      { ms: 180, pelvis: { x: 2, y: 46 }, lean: 70, frontArm: { upper: 95, lower: -60 }, backArm: armsBack, frontLeg: straight(172), backLeg: straight(178), trail: { from: 'frontElbow', reach: 16 } },
    ],
    { slam: true }
  ),
  combo(
    2,
    'Leg Drop',
    'Sits out hard, the leg slamming across their throat, and sits up to soak in the cheers',
    [
      { pelvis: { x: 0, y: 56 }, lean: -30, frontArm: armsBack, backArm: armsBack, frontLeg: straight(2), backLeg: straight(8), trail: { from: 'frontFoot', reach: 18 } },
      { ms: 180, pelvis: { x: 0, y: 56 }, lean: 0, frontArm: armsUp, backArm: armsUpBack, frontLeg: straight(4), backLeg: straight(8) },
    ],
    { slam: true }
  ),

  // =================== Tier 3: crowd favourites ===================
  combo(
    3,
    'Suplex',
    'Hooks the head, lifts them straight up, and arches back to slam them down',
    [
      { pelvis: { x: 4, y: 16 }, lean: 24, frontArm: { upper: -20, lower: -140 }, backArm: straight(10), ...wide, trail: { from: 'frontHand', reach: 16, curve: -10 } },
      { ms: 150, pelvis: { x: 0, y: 8 }, lean: -20, frontArm: armsUp, backArm: armsUpBack, ...wide },
      { ms: 130, pelvis: { x: -2, y: 40 }, lean: -78, frontArm: straight(200), backArm: straight(196), frontLeg: { x: 20, y: F }, backLeg: { x: -6, y: F }, trail: { from: 'frontHand', reach: 18, curve: 12 } },
    ],
    { slam: true }
  ),
  combo(
    3,
    'Flying Crossbody',
    'Launches himself flat through the air, body first, and lands in a crouch',
    [
      { pelvis: { x: 0, y: -14 }, lean: 80, frontArm: straight(-4), backArm: straight(6), frontLeg: straight(170), backLeg: straight(176), trail: { from: 'frontHand', reach: 24 } },
      { ms: 200, ...slamCrouch, lean: 20, frontArm: flexFront, backArm: armsBack },
    ],
    { slam: true }
  ),
  combo(3, 'Steel Chair Shot', 'Grabs a folding steel chair and swings it down, twice', [
    { ...lunge, lean: 30, frontArm: { upper: -20, lower: 40 }, backArm: armsBack, prop: 'chair', twoHanded: true, trail: { from: 'frontHand', reach: 30, curve: 24 } },
    { ms: 140, pelvis: { x: 0, y: 12 }, lean: -10, frontArm: { upper: -100, lower: -80 }, backArm: armsBack, ...wide, prop: 'chair', twoHanded: true },
    { ms: 120, ...lunge, lean: 34, frontArm: { upper: 0, lower: 50 }, backArm: armsBack, prop: 'chair', twoHanded: true, trail: { from: 'frontHand', reach: 30, curve: 24 } },
  ]),
  combo(
    3,
    'Spear',
    'Bent flat with one leg kicked up behind, he drives his shoulder through their middle, then roars on his knees',
    [
      { pelvis: { x: 4, y: 30 }, lean: 75, tilt: -12, frontArm: { upper: 95, lower: -170 }, backArm: armsBack, frontLeg: { x: 26, y: F }, backLeg: { upper: 200, lower: -110 }, trail: { from: 'head', reach: 18 } },
      { ms: 150, pelvis: { x: 6, y: 40 }, lean: 70, tilt: -8, frontArm: { upper: 95, lower: -170 }, backArm: armsBack, frontLeg: { x: 30, y: F }, backLeg: { upper: 180, lower: 200 }, trail: { from: 'head', reach: 18 } },
      { ms: 200, pelvis: { x: 2, y: 38 }, lean: -6, tilt: -14, frontArm: armsUp, backArm: armsUpBack, frontLeg: { x: 24, y: F }, backLeg: { upper: 100, lower: 175 } },
    ],
    { slam: true }
  ),

  // ================= Tier 4: main-event moves =================
  combo(
    4,
    'Powerbomb',
    'Hoists them up onto his shoulders and drives them down into the mat',
    [
      { pelvis: { x: 2, y: 14 }, lean: 4, frontArm: { upper: -80, lower: -60 }, backArm: { upper: -84, lower: -70 }, ...wide, trail: { from: 'frontHand', reach: 18, curve: -10 } },
      { ms: 160, pelvis: { x: 0, y: 8 }, lean: -4, frontArm: armsUp, backArm: armsUpBack, ...wide },
      { ms: 130, ...slamCrouch, lean: 30, frontArm: armsDown, backArm: straight(76), trail: { from: 'frontHand', reach: 20 } },
    ],
    { slam: true }
  ),
  combo(
    4,
    'Moonsault',
    'Springs off the ropes with a kick, backflips right over, and lands chest-first',
    [
      { pelvis: { x: -2, y: -14 }, lean: -30, frontArm: armsBack, backArm: armsBack, frontLeg: straight(-20), backLeg: tucked, trail: { from: 'frontFoot', reach: 20 } },
      { ms: 150, pelvis: { x: 0, y: -20 }, lean: -150, frontArm: armsBack, backArm: armsBack, frontLeg: tucked, backLeg: tucked },
      { ms: 150, pelvis: { x: 2, y: 46 }, lean: 72, frontArm: straight(12), backArm: straight(168), frontLeg: straight(172), backLeg: straight(178), trail: { from: 'frontHand', reach: 16 } },
    ],
    { slam: true }
  ),
  combo(4, 'Lariat Spin', 'Spins round with his arm out like a club: three huge lariats', [
    { pelvis: { x: 2, y: 14 }, lean: 8, tilt: 10, frontArm: straight(0), backArm: straight(190), ...wide, trail: { from: 'frontHand', reach: 24, curve: 18 } },
    { ms: 110, pelvis: { x: 0, y: 14 }, lean: -6, tilt: -10, frontArm: straight(190), backArm: straight(0), ...wide, trail: { from: 'backHand', reach: 24, curve: 18 } },
    { ms: 110, pelvis: { x: 2, y: 14 }, lean: 8, tilt: 10, frontArm: straight(-6), backArm: straight(190), ...wide, trail: { from: 'frontHand', reach: 24, curve: 18 } },
  ]),
  combo(
    4,
    'Piledriver Drop',
    'Turns them upside down, jumps, and sits out hard',
    [
      { pelvis: { x: 2, y: 14 }, lean: 6, frontArm: { upper: -60, lower: -100 }, backArm: { upper: -66, lower: -110 }, ...wide, trail: { from: 'frontHand', reach: 16, curve: -12 } },
      { ms: 160, pelvis: { x: 0, y: -6 }, lean: 0, frontArm: { upper: -60, lower: -100 }, backArm: { upper: -66, lower: -110 }, frontLeg: tucked, backLeg: tucked },
      { ms: 130, pelvis: { x: 0, y: 52 }, lean: -10, frontArm: armsDown, backArm: straight(84), frontLeg: straight(10), backLeg: straight(170), trail: { from: 'frontHand', reach: 16 } },
    ],
    { slam: true }
  ),

  // ================= Tier 5: legendary finishers =================
  combo(
    5,
    'Five-Move Finale',
    'Shoulder tackle, a slam, the hand wave in front of his face, and the leg drop',
    [
      { ...lunge, lean: 45, frontArm: { upper: 80, lower: -40 }, backArm: armsBack, trail: { from: 'frontElbow', reach: 20 } },
      { ms: 130, ...slamCrouch, lean: 40, frontArm: armsDown, backArm: straight(76), trail: { from: 'frontHand', reach: 18 } },
      { ms: 170, pelvis: { x: 2, y: 12 }, lean: 0, frontArm: { upper: 60, lower: -110 }, backArm: flexBack, ...wide },
      { ms: 140, pelvis: { x: 0, y: 56 }, lean: -30, frontArm: armsBack, backArm: armsBack, frontLeg: straight(2), backLeg: straight(8), trail: { from: 'frontFoot', reach: 18 } },
    ],
    { slam: true }
  ),
  combo(5, 'Flying Double Dropkick', 'Launches flat out through the air and drives both feet through them at once', [
    { pelvis: { x: 0, y: -4 }, lean: -78, frontArm: straight(195), backArm: straight(205), frontLeg: straight(-2), backLeg: straight(6), trail: { from: 'frontFoot', reach: 28 } },
    { ms: 160, pelvis: { x: 4, y: 0 }, lean: -74, frontArm: straight(192), backArm: straight(202), frontLeg: straight(4), backLeg: straight(10), trail: { from: 'frontFoot', reach: 26 } },
    { ms: 220, pelvis: { x: 2, y: 30 }, lean: 16, frontArm: flexFront, backArm: armsBack, frontLeg: { x: 22, y: F }, backLeg: { x: -18, y: F } },
  ]),
  combo(
    5,
    'Championship Finisher',
    'Hoists them up, runs, drives them down with a powerbomb, then raises the title high',
    [
      { pelvis: { x: 2, y: 14 }, lean: 4, frontArm: { upper: -80, lower: -60 }, backArm: { upper: -84, lower: -70 }, ...wide, trail: { from: 'frontHand', reach: 18, curve: -10 } },
      { ms: 160, pelvis: { x: 8, y: 10 }, lean: 6, frontArm: armsUp, backArm: armsUpBack, frontLeg: { x: 30, y: F }, backLeg: { x: -12, y: F } },
      { ms: 130, ...slamCrouch, lean: 30, frontArm: armsDown, backArm: straight(76), trail: { from: 'frontHand', reach: 20 } },
      { ms: 240, pelvis: { x: 0, y: 10 }, lean: -4, tilt: -10, frontArm: armsUp, backArm: armsUpBack, ...wide },
    ],
    { slam: true }
  ),
];
