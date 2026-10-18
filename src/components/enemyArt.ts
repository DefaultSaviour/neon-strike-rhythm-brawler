import { EnemyTier, FrequencyBand } from '../types/game';
import { EnemyPose, FLOOR as FLOOR_Y, Point } from '../game/enemyMotion';
import { BodyJoints, drawNeonBody, neonHead, neonShape } from './neonBody';
import { getEnemyStyle } from '../game/enemyStyles';

/**
 * Draws one enemy on top of a shared skeleton pose (see game/enemyMotion.ts),
 * in the "solid neon" style (see neonBody.ts).
 *
 * Everything is drawn FACING RIGHT with feet on y = 68; the caller mirrors the
 * canvas for enemies facing left. Drawing happens in three layers so gear sits
 * correctly around the solid body:
 *   1. back gear  (wings, capes, flags, ribbons, rocket flames)
 *   2. body + head
 *   3. front gear (helmets, horns, hats, visors, blades, shields, halos)
 */

export interface EnemyArtColors {
  main: string;
  accent: string;
}

type Ctx = CanvasRenderingContext2D;

/** Everything a gear-drawing function needs. */
interface GearEnv {
  ctx: Ctx;
  pose: EnemyPose;
  main: string;
  accent: string;
  beat: number;
  flash: boolean;
  /** Facing the camera: paired gear is mirrored and back gear mostly hidden */
  front: boolean;
  sides: Array<1 | -1>;
  forearmFront: Point;
  forearmBack: Point;
  rnd: () => number;
}

interface EnemyLook {
  /** Head radius */
  headR: number;
  /** Torso proportions (limb thickness comes from enemyStyles.ts) */
  shoulderHalf: number;
  waistHalf: number;
  back?: (g: GearEnv) => void;
  front?: (g: GearEnv) => void;
}

// ---------------------------------------------------------------------------
// Small drawing helpers
// ---------------------------------------------------------------------------

function line(ctx: Ctx, a: Point, b: Point) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function polyline(ctx: Ctx, pts: Point[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

const P = (x: number, y: number): Point => ({ x, y });

function dirOf(a: Point, b: Point): Point {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
}

function rotate(v: Point, angle: number): Point {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/** A point `length` away from `from`, in direction `d` turned by `angle` radians. */
function along(from: Point, d: Point, length: number, angle = 0): Point {
  const r = rotate(d, angle);
  return { x: from.x + r.x * length, y: from.y + r.y * length };
}

/** Glowing stroke in `color`, with optional white-hot core (blades, energy). */
function neonStroke(g: GearEnv, color: string, width: number, glow: number, draw: () => void, core = false) {
  const { ctx } = g;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = g.flash ? '#ffffff' : color;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.lineWidth = width;
  draw();
  if (core && !g.flash) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, width * 0.35);
    draw();
  }
  ctx.restore();
}

/** A blade: a long neon stroke from the hand with a white-hot edge. */
function blade(g: GearEnv, from: Point, to: Point, width: number) {
  neonStroke(g, g.accent, width, 18, () => line(g.ctx, from, to), true);
}

/** Eye slit: toward the front of the face side-on, centred when facing the camera. */
function visor(g: GearEnv, dx: number, w: number, hgt: number, color = '#ffffff') {
  const { ctx, pose } = g;
  const x = pose.facingCamera ? pose.head.x - w / 2 : pose.head.x + dx;
  ctx.save();
  ctx.fillStyle = g.flash ? '#ffffff' : color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillRect(x, pose.head.y - hgt / 2 - 0.5, w, hgt);
  ctx.restore();
}

/** Soft glowing fin/wing: a translucent filled shape with a bright edge. */
function energyShape(g: GearEnv, pts: Point[], color: string) {
  const { ctx } = g;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fillStyle = g.flash ? '#ffffff' : color;
  ctx.globalAlpha *= g.flash ? 1 : 0.22;
  ctx.fill();
  ctx.globalAlpha /= g.flash ? 1 : 0.22;
  ctx.strokeStyle = g.flash ? '#ffffff' : color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// The 9 enemy looks
// ---------------------------------------------------------------------------

const LOOKS: Record<FrequencyBand, Record<EnemyTier, EnemyLook>> = {
  // SUB / KICK: heavy juggernauts with broad chests and thick limbs
  sub: {
    1: {
      // TITAN: forward-curving horns, shoulder pauldrons, chest reactor, stomp rings
      headR: 10,
      shoulderHalf: 15,
      waistHalf: 8,
      front: (g) => {
        const { ctx, pose } = g;
        const h = pose.head;
        visor(g, 3, 6, 3);
        for (const sd of g.sides) {
          const hornBase = g.front ? P(h.x + sd * 6, h.y - 7) : P(h.x - 2, h.y - 8);
          const tip = g.front ? P(h.x + sd * 24, h.y - 20) : P(h.x + 24, h.y - 18);
          const bend = g.front ? P(h.x + sd * 14, h.y - 25) : P(h.x + 14, h.y - 25);
          neonStroke(g, g.accent, 4.5, 12, () => polyline(ctx, [hornBase, bend, tip]), true);
          // Pauldron on the near shoulder (both shoulders when facing the camera)
          const s = sd === 1 ? pose.frontShoulder : pose.backShoulder;
          neonShape(ctx, [P(s.x - sd * 6, s.y - 8), P(s.x + sd * 14, s.y - 6), P(s.x + sd * 12, s.y + 8), P(s.x - sd * 4, s.y + 6)], g.accent, 10, g.flash);
        }
        // Chest reactor
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = g.main;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(pose.chest.x + (g.front ? 0 : 2), pose.chest.y + 6, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (pose.stomp > 0.4 && !g.flash) {
          ctx.save();
          ctx.globalAlpha *= pose.stomp;
          neonStroke(g, g.accent, 2, 10, () => {
            ctx.beginPath();
            ctx.ellipse(pose.frontFoot.x, 68, 14, 4, 0, 0, Math.PI * 2);
            ctx.ellipse(pose.backFoot.x, 68, 14, 4, 0, 0, Math.PI * 2);
            ctx.stroke();
          });
          ctx.restore();
        }
      },
    },
    2: {
      // BREAKER: spine fins and a forearm piston that punches on the beat
      headR: 8.5,
      shoulderHalf: 13,
      waistHalf: 7,
      back: (g) => {
        if (g.front) return; // fins are on the back
        const { pose } = g;
        const c = pose.chest;
        for (let s = 0; s < 3; s++) {
          const t = s / 3;
          const x = c.x + (pose.pelvis.x - c.x) * t - 6;
          const y = c.y + (pose.pelvis.y - c.y) * t;
          energyShape(g, [P(x, y - 3), P(x - 14 - s * 2, y - 10), P(x, y + 4)], g.accent);
        }
      },
      front: (g) => {
        visor(g, 3, 6, 3);
        const ext = 8 + Math.sin(Math.PI * 2 * g.beat) * 6;
        const hand = g.pose.frontHand;
        neonStroke(g, g.accent, 5, 14, () => line(g.ctx, hand, along(hand, g.forearmFront, 8 + ext)), true);
      },
    },
    3: {
      // RAMMER: ram horns, arm-mounted battering shield, rocket flames
      headR: 8.5,
      shoulderHalf: 13,
      waistHalf: 7,
      back: (g) => {
        if (g.front) return;
        const c = g.pose.chest;
        neonStroke(g, g.accent, 3, 16, () => {
          line(g.ctx, P(c.x - 10, c.y), P(c.x - 36 - g.rnd() * 12, c.y + (g.rnd() - 0.5) * 6));
          line(g.ctx, P(c.x - 10, c.y + 8), P(c.x - 30 - g.rnd() * 12, c.y + 8 + (g.rnd() - 0.5) * 6));
        });
      },
      front: (g) => {
        const h = g.pose.head;
        visor(g, 3, 6, 3);
        for (const sd of g.sides) {
          neonStroke(g, g.accent, 4.5, 14, () =>
            polyline(g.ctx, [P(h.x + sd * (g.front ? 6 : 2), h.y - 4), P(h.x + sd * 18, h.y + 3), P(h.x + sd * 15, h.y + 14)]),
            true
          );
        }
        const f = g.pose.frontHand;
        neonShape(g.ctx, [P(f.x - 6, f.y - 20), P(f.x + 12, f.y - 4), P(f.x + 12, f.y + 6), P(f.x - 6, f.y + 18)], g.accent, 16, g.flash);
      },
    },
  },

  // BASSLINE: cyber samurai and blade dancers
  bass: {
    1: {
      // WARLORD: kabuto crest with horns, war flag, heavy odachi
      headR: 8.5,
      shoulderHalf: 12,
      waistHalf: 7,
      back: (g) => {
        const { ctx, pose } = g;
        const c = pose.chest;
        const h = pose.head;
        const wave = Math.sin(Math.PI * 1.4 * g.beat) * 6;
        if (g.front) {
          neonStroke(g, g.main, 2.5, 8, () => line(ctx, P(c.x, h.y - 16), P(c.x, h.y - 46)));
          energyShape(g, [P(c.x + 1, h.y - 46), P(c.x + 16 + wave * 0.4, h.y - 42), P(c.x + 1, h.y - 34)], g.accent);
        } else {
          neonStroke(g, g.main, 2.5, 8, () => line(ctx, P(c.x - 6, c.y), P(c.x - 12, h.y - 30)));
          energyShape(g, [P(c.x - 12, h.y - 30), P(c.x - 30 + wave, h.y - 26), P(c.x - 28 + wave, h.y - 2), P(c.x - 10, h.y - 6)], g.accent);
        }
      },
      front: (g) => {
        const h = g.pose.head;
        neonShape(g.ctx, [P(h.x + 18, h.y - 3), P(h.x, h.y - 17), P(h.x - 18, h.y - 3)], g.main, 12, g.flash);
        neonStroke(g, g.accent, 3.2, 14, () => {
          line(g.ctx, P(h.x, h.y - 17), P(h.x + 16, h.y - 30));
          line(g.ctx, P(h.x, h.y - 17), P(h.x - 16, h.y - 30));
        });
        visor(g, 2, 7, 3);
        blade(g, g.pose.frontHand, along(g.pose.frontHand, g.forearmFront, 60, 0.55), 5);
      },
    },
    2: {
      // RONIN: kasa hat, flowing cape, katana
      headR: 8,
      shoulderHalf: 11,
      waistHalf: 6.5,
      back: (g) => {
        if (g.front) return;
        const c = g.pose.chest;
        const wave = Math.sin(Math.PI * 1.5 * g.beat) * 10;
        energyShape(g, [P(c.x - 4, c.y - 2), P(c.x - 40, c.y + 16 + wave), P(c.x - 62, c.y + 40 + wave * 1.3), P(c.x - 34, c.y + 30 + wave), P(c.x - 4, c.y + 14)], g.main);
      },
      front: (g) => {
        const h = g.pose.head;
        neonShape(g.ctx, [P(h.x + 20, h.y - 3), P(h.x, h.y - 15), P(h.x - 20, h.y - 3)], g.main, 12, g.flash);
        visor(g, 2, 7, 2.5, g.accent);
        blade(g, g.pose.frontHand, along(g.pose.frontHand, g.forearmFront, 46, 0.45), 4);
      },
    },
    3: {
      // ACID DANCER: ninja cowl, ribbon streamers, a reverse-grip blade in each hand
      headR: 7.5,
      shoulderHalf: 10,
      waistHalf: 6,
      back: (g) => {
        const h = g.pose.head;
        for (let r = 0; r < 2; r++) {
          const wave = Math.sin(Math.PI * 2 * g.beat + r * 1.5) * 12;
          const sd = g.front && r === 1 ? 1 : -1;
          const len = g.front ? 0.6 : 1;
          neonStroke(g, r === 0 ? g.main : g.accent, 2.5, 16, () =>
            polyline(g.ctx, [P(h.x + sd * 6, h.y + (g.front ? 0 : r * 6)), P(h.x + sd * 34 * len, h.y + 10 + wave), P(h.x + sd * 62 * len, h.y + 22 + wave * 1.4)])
          );
        }
      },
      front: (g) => {
        const h = g.pose.head;
        neonShape(
          g.ctx,
          [P(h.x + (g.front ? 12 : 14), h.y - (g.front ? 3 : 1)), P(h.x, h.y - 13), P(h.x - 12, h.y - (g.front ? 3 : 6))],
          g.main,
          10,
          g.flash
        );
        visor(g, 2, 7, 2.5, g.accent);
        for (const [hand, fore] of [
          [g.pose.frontHand, g.forearmFront],
          [g.pose.backHand, g.forearmBack],
        ] as const) {
          const tip = along(hand, fore, 26, -1.9);
          neonStroke(g, g.accent, 3.6, 18, () => polyline(g.ctx, [hand, tip, along(tip, fore, 12, -0.6)]), true);
        }
      },
    },
  },

  // HIGHS: plasma speeders, wraiths and seraphs (slim and light)
  high: {
    1: {
      // SPEEDER: aerodynamic helmet, forearm plasma blade, boot jets
      headR: 8,
      shoulderHalf: 10,
      waistHalf: 5.5,
      back: (g) => {
        if (g.front) return;
        const f = g.pose.backFoot;
        neonStroke(g, g.main, 3, 14, () => line(g.ctx, P(f.x - 2, f.y - 3), P(f.x - 28 - g.rnd() * 14, f.y - 3 + (g.rnd() - 0.5) * 5)));
      },
      front: (g) => {
        const h = g.pose.head;
        const shape = g.front
          ? [P(h.x - 12, h.y + 6), P(h.x, h.y - 13), P(h.x + 12, h.y + 6)]
          : [P(h.x + 16, h.y + 1), P(h.x - 12, h.y - 11), P(h.x - 13, h.y + 8)];
        neonShape(g.ctx, shape, g.main, 14, g.flash);
        visor(g, 3, 7, 2.5);
        neonStroke(g, g.main, 4, 18, () => line(g.ctx, g.pose.frontElbow, along(g.pose.frontHand, g.forearmFront, 26)), true);
      },
    },
    2: {
      // WRAITH: swept energy wings, plasma claws, hover discs under the feet
      headR: 8,
      shoulderHalf: 10,
      waistHalf: 5.5,
      back: (g) => {
        const c = g.pose.chest;
        for (const sd of g.sides) {
          energyShape(g, [P(c.x, c.y - 6), P(c.x - sd * 38, c.y - 34), P(c.x - sd * 50, c.y - 14), P(c.x - sd * 30, c.y - 8)], g.accent);
        }
      },
      front: (g) => {
        visor(g, 3, 6, 2.5);
        const { pose } = g;
        const tip = along(pose.frontHand, g.forearmFront, 22, -0.3);
        neonStroke(g, g.accent, 3, 16, () => {
          polyline(g.ctx, [pose.frontHand, tip, along(tip, g.forearmFront, 10, 0.4)]);
          line(g.ctx, pose.backHand, along(pose.backHand, g.forearmBack, 16, 0.3));
        }, true);
        neonStroke(g, g.accent, 2.5, 16, () => {
          g.ctx.beginPath();
          g.ctx.ellipse(pose.frontFoot.x, pose.frontFoot.y + 3, 8, 2.5, 0, 0, Math.PI * 2);
          g.ctx.ellipse(pose.backFoot.x, pose.backFoot.y + 3, 8, 2.5, 0, 0, Math.PI * 2);
          g.ctx.stroke();
        });
      },
    },
    3: {
      // SERAPH: crested helmet, spinning halo, quad wings, beam sabers, sparkle
      headR: 8,
      shoulderHalf: 10,
      waistHalf: 5.5,
      back: (g) => {
        const c = g.pose.chest;
        const pulse = Math.exp(-((g.beat % 1) * 5)) * 6;
        for (const sd of g.sides) {
          energyShape(g, [P(c.x, c.y - 8), P(c.x - sd * (42 + pulse), c.y - 42), P(c.x - sd * (58 + pulse), c.y - 26)], g.accent);
          energyShape(g, [P(c.x, c.y), P(c.x - sd * (38 + pulse), c.y - 14), P(c.x - sd * (52 + pulse), c.y + 4)], g.accent);
        }
      },
      front: (g) => {
        const { ctx, pose } = g;
        const h = pose.head;
        visor(g, 3, 7, 3);
        neonStroke(g, g.accent, 2.5, 20, () => {
          ctx.beginPath();
          ctx.ellipse(h.x, h.y - 14, 14, 4.5, Math.sin(Math.PI * g.beat) * 0.25, 0, Math.PI * 2);
          ctx.stroke();
        });
        blade(g, pose.frontHand, along(pose.frontHand, g.forearmFront, 36, -0.5), 4);
        blade(g, pose.backHand, along(pose.backHand, g.forearmBack, 28, 0.5), 4);
        if (!g.flash) {
          ctx.fillStyle = '#ffffff';
          for (let sp = 0; sp < 2; sp++) {
            ctx.fillRect(pose.chest.x + (g.rnd() - 0.5) * 40, pose.chest.y + (g.rnd() - 0.5) * 40, 2.5, 2.5);
          }
        }
      },
    },
  },
};

/**
 * Mirror a pose top-to-bottom (y -> -y). Doing it twice gives back the same
 * pose, which is how upside-down poses are drawn (see drawEnemyArt).
 */
export function flipPoseVertically(p: EnemyPose): EnemyPose {
  const f = (q: Point): Point => ({ x: q.x, y: -q.y });
  return {
    ...p,
    head: f(p.head),
    chest: f(p.chest),
    pelvis: f(p.pelvis),
    frontShoulder: f(p.frontShoulder),
    frontElbow: f(p.frontElbow),
    frontHand: f(p.frontHand),
    backShoulder: f(p.backShoulder),
    backElbow: f(p.backElbow),
    backHand: f(p.backHand),
    frontKnee: f(p.frontKnee),
    frontFoot: f(p.frontFoot),
    backKnee: f(p.backKnee),
    backFoot: f(p.backFoot),
    upsideDown: !p.upsideDown,
  };
}

/** Map the enemy pose onto the shared body-joint names (front = near side). */
export function enemyBodyJoints(p: EnemyPose): BodyJoints {
  return {
    head: p.head,
    chest: p.chest,
    pelvis: p.pelvis,
    nearShoulder: p.frontShoulder,
    nearElbow: p.frontElbow,
    nearHand: p.frontHand,
    farShoulder: p.backShoulder,
    farElbow: p.backElbow,
    farHand: p.backHand,
    nearHip: p.pelvis,
    nearKnee: p.frontKnee,
    nearFoot: p.frontFoot,
    farHip: p.pelvis,
    farKnee: p.backKnee,
    farFoot: p.backFoot,
  };
}

/**
 * @param beat the song's beat counter (drives capes, flags, halos and the like)
 * @param flash true while drawing the white "just got hit" silhouette (no random sparks)
 */
export function drawEnemyArt(
  ctx: Ctx,
  pose: EnemyPose,
  band: FrequencyBand,
  tier: EnemyTier,
  colors: EnemyArtColors,
  beat: number,
  flash: boolean
) {
  if (pose.upsideDown) {
    // Handstand: draw the body the right way up, then flip the canvas, so the
    // joints land where they really are AND hats / helmets / halos hang
    // toward the floor like they would on an upside-down body.
    ctx.save();
    // Anything hanging past the floor (long horns, crests, halos) is cut off
    // at the floor line instead of poking through it.
    ctx.beginPath();
    ctx.rect(-1000, -1000, 2000, 1000 + FLOOR_Y);
    ctx.clip();
    ctx.scale(1, -1);
    drawEnemyArt(ctx, flipPoseVertically(pose), band, tier, colors, beat, flash);
    ctx.restore();
    return;
  }
  const look = LOOKS[band][tier];
  const front = pose.facingCamera;
  const g: GearEnv = {
    ctx,
    pose,
    main: colors.main,
    accent: colors.accent,
    beat,
    flash,
    front,
    sides: front ? [1, -1] : [1],
    forearmFront: dirOf(pose.frontElbow, pose.frontHand),
    forearmBack: dirOf(pose.backElbow, pose.backHand),
    rnd: flash ? () => 0.5 : Math.random,
  };
  const glow = band === 'high' && tier === 3 ? 18 : 12;

  look.back?.(g);
  drawNeonBody(ctx, enemyBodyJoints(pose), {
    color: colors.main,
    glow,
    shoulderHalf: look.shoulderHalf,
    waistHalf: look.waistHalf,
    limbScale: getEnemyStyle(band, tier).limbScale,
    flash,
  });
  neonHead(ctx, pose.head, look.headR, { color: colors.main, glow, flash });
  look.front?.(g);
}
