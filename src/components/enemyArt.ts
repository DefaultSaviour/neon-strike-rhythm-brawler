import { EnemyTier, FrequencyBand } from '../types/game';
import { EnemyPose, Point } from '../game/enemyMotion';

/**
 * Draws one enemy on top of a shared skeleton pose (see game/enemyMotion.ts).
 *
 * Everything is drawn FACING RIGHT with feet on y = 68; the caller mirrors the
 * canvas for enemies facing left. Each of the 9 types keeps its own gear
 * (horns, hats, blades, wings...) attached to the pose's head, chest and hands,
 * so the gear follows whatever motion style is selected.
 */

export interface EnemyArtColors {
  main: string;
  accent: string;
}

type Ctx = CanvasRenderingContext2D;

function line(ctx: Ctx, a: Point, b: Point) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function seg(ctx: Ctx, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function circle(ctx: Ctx, c: Point, r: number) {
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.stroke();
}

/** Unit vector from a to b. */
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

/** Run `draw` with a temporary glow style, restoring the old style afterwards. */
function withGlow(ctx: Ctx, color: string, blur: number, width: number, draw: () => void, glowColor = color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = blur;
  ctx.lineWidth = width;
  draw();
  ctx.restore();
}

/**
 * Eye slit. Side-on poses put it toward the front of the face (`dx` along
 * +x); front-facing poses centre it on the face.
 */
function visor(ctx: Ctx, pose: EnemyPose, dx: number, dyUp: number, w: number, hgt: number) {
  const x = pose.facingCamera ? pose.head.x - w / 2 : pose.head.x + dx;
  ctx.fillRect(x, pose.head.y - dyUp, w, hgt);
}

function drawSkeleton(ctx: Ctx, p: EnemyPose) {
  line(ctx, p.chest, p.pelvis);
  line(ctx, p.frontShoulder, p.frontElbow);
  line(ctx, p.frontElbow, p.frontHand);
  line(ctx, p.backShoulder, p.backElbow);
  line(ctx, p.backElbow, p.backHand);
  line(ctx, p.pelvis, p.frontKnee);
  line(ctx, p.frontKnee, p.frontFoot);
  line(ctx, p.pelvis, p.backKnee);
  line(ctx, p.backKnee, p.backFoot);
}

function drawCoreHighlight(ctx: Ctx, p: EnemyPose) {
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.3;
  ctx.shadowBlur = 0;
  line(ctx, p.chest, p.pelvis);
  line(ctx, p.frontShoulder, p.frontElbow);
  line(ctx, p.pelvis, p.frontKnee);
  ctx.restore();
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
  const { main, accent } = colors;
  const h = pose.head;
  const c = pose.chest;
  const rnd = flash ? () => 0.5 : Math.random;
  const forearmFront = dirOf(pose.frontElbow, pose.frontHand);
  const forearmBack = dirOf(pose.backElbow, pose.backHand);
  // Side-on poses draw paired gear once; facing the camera, it's mirrored onto both sides.
  const front = pose.facingCamera;
  const sides: Array<1 | -1> = front ? [1, -1] : [1];

  // ---------------------------------------------------------------------------
  // SUB / KICK: heavy juggernauts
  // ---------------------------------------------------------------------------
  if (band === 'sub') {
    circle(ctx, h, tier === 1 ? 10 : 8.5);
    ctx.fillStyle = '#ffffff';
    visor(ctx, pose, 4, 2, 5, 3);

    if (tier === 1) {
      // TITAN: forward-curving horns, shoulder pauldrons, chest reactor, stomp rings
      withGlow(ctx, accent, 12, 3.8, () => {
        for (const sd of sides) {
          if (front) {
            seg(ctx, h.x + sd * 6, h.y - 7, h.x + sd * 14, h.y - 24);
            seg(ctx, h.x + sd * 14, h.y - 24, h.x + sd * 24, h.y - 20);
          } else {
            seg(ctx, h.x - 2, h.y - 8, h.x + 14, h.y - 24);
            seg(ctx, h.x + 14, h.y - 24, h.x + 24, h.y - 18);
            seg(ctx, h.x - 8, h.y - 8, h.x + 6, h.y - 20);
          }
        }
      });
      for (const sd of sides) {
        seg(ctx, c.x - sd * 4, c.y - 8, c.x + sd * 10, c.y - 6);
        seg(ctx, c.x + sd * 10, c.y - 6, c.x + sd * 14, c.y + 6);
      }
      if (!front) seg(ctx, c.x - 16, c.y - 8, c.x - 26, c.y - 4);
      ctx.fillStyle = main;
      ctx.fillRect(c.x - 2, c.y - 4, 8, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(c.x, c.y - 2, 4, 4);
      if (pose.stomp > 0.4) {
        ctx.save();
        ctx.globalAlpha *= pose.stomp;
        withGlow(ctx, accent, 10, 2, () => {
          ctx.beginPath();
          ctx.ellipse(pose.frontFoot.x, 68, 14, 4, 0, 0, Math.PI * 2);
          ctx.ellipse(pose.backFoot.x, 68, 14, 4, 0, 0, Math.PI * 2);
          ctx.stroke();
        }, main);
        ctx.restore();
      }
    } else if (tier === 2) {
      // BREAKER: spine fins and a forearm piston that punches on the beat
      for (let s = 0; s < (front ? 0 : 3); s++) {
        // Spine fins are on the back, so they're hidden when facing the camera.
        const t = s / 3;
        const sx = c.x + (pose.pelvis.x - c.x) * t;
        const sy = c.y + (pose.pelvis.y - c.y) * t;
        seg(ctx, sx - 2, sy, sx - 12 - s * 2, sy - 7);
      }
      const pistonExt = 6 + Math.sin(Math.PI * 2 * beat) * 6;
      withGlow(ctx, accent, 14, 3.2, () => line(ctx, pose.frontHand, along(pose.frontHand, forearmFront, 10 + pistonExt)));
    } else {
      // RAMMER: ram horns, arm-mounted battering shield, rocket flames
      withGlow(ctx, accent, 14, 4, () => {
        for (const sd of sides) {
          seg(ctx, h.x + sd * (front ? 6 : 2), h.y - 4, h.x + sd * 18, h.y + 4);
          seg(ctx, h.x + sd * 18, h.y + 4, h.x + sd * 16, h.y + 14);
        }
      });
      withGlow(ctx, accent, 16, 4.2, () => {
        const f = pose.frontHand;
        ctx.beginPath();
        ctx.moveTo(f.x - 6, f.y - 18);
        ctx.lineTo(f.x + 12, f.y);
        ctx.lineTo(f.x - 6, f.y + 16);
        ctx.closePath();
        ctx.stroke();
      }, main);
      if (!front) {
        // Back-mounted rocket flames (hidden behind the body when facing the camera)
        withGlow(ctx, accent, 16, 2.5, () => {
          seg(ctx, c.x - 8, c.y - 4, c.x - 35 - rnd() * 12, c.y - 4 + (rnd() - 0.5) * 6);
          seg(ctx, c.x - 8, c.y + 4, c.x - 30 - rnd() * 12, c.y + 4 + (rnd() - 0.5) * 6);
        }, main);
      }
    }

    drawSkeleton(ctx, pose);
    drawCoreHighlight(ctx, pose);
    return;
  }

  // ---------------------------------------------------------------------------
  // BASSLINE: cyber samurai and blade dancers
  // ---------------------------------------------------------------------------
  if (band === 'bass') {
    if (tier === 1) {
      // WARLORD: kabuto crest with horns, war flag, heavy odachi
      ctx.beginPath();
      ctx.moveTo(h.x + 20, h.y - 4);
      ctx.lineTo(h.x, h.y - 18);
      ctx.lineTo(h.x - 20, h.y - 4);
      ctx.closePath();
      ctx.stroke();
      withGlow(ctx, accent, 14, 3.2, () => {
        seg(ctx, h.x, h.y - 18, h.x + 16, h.y - 30);
        seg(ctx, h.x, h.y - 18, h.x - 16, h.y - 30);
      });
      circle(ctx, h, 8.5);
      ctx.fillStyle = '#ffffff';
      visor(ctx, pose, 3, 2, 6, 3);

      const flagWave = Math.sin(Math.PI * 1.4 * beat) * 6;
      if (front) {
        // Flag pole rises straight up behind the head
        seg(ctx, c.x, h.y - 18, c.x, h.y - 44);
        withGlow(ctx, accent, 0, 2, () => ctx.strokeRect(c.x + 1, h.y - 44, 14 + flagWave * 0.4, 12), main);
      } else {
        seg(ctx, c.x - 6, c.y, c.x - 12, h.y - 28);
        withGlow(ctx, accent, 0, 2, () => ctx.strokeRect(c.x - 28 + flagWave, h.y - 26, 16, 26), main);
      }

      // Odachi: long blade held out from the lead hand
      withGlow(ctx, accent, 22, 4.2, () => line(ctx, pose.frontHand, along(pose.frontHand, forearmFront, 58, 0.55)));
    } else if (tier === 2) {
      // RONIN: kasa hat, flowing cape, katana
      ctx.beginPath();
      ctx.moveTo(h.x + 18, h.y - 4);
      ctx.lineTo(h.x, h.y - 14);
      ctx.lineTo(h.x - 18, h.y - 4);
      ctx.closePath();
      ctx.stroke();
      circle(ctx, h, 8);
      ctx.fillStyle = '#ffffff';
      visor(ctx, pose, 2, 1, 6, 2.5);

      if (!front) {
        // Cape trails behind (hidden behind the body when facing the camera)
        const capeWave = Math.sin(Math.PI * 1.5 * beat) * 10;
        ctx.beginPath();
        ctx.moveTo(c.x - 8, c.y);
        ctx.lineTo(c.x - 38, c.y + 15 + capeWave);
        ctx.lineTo(c.x - 60, c.y + 36 + capeWave * 1.3);
        ctx.stroke();
      }

      withGlow(ctx, accent, 20, 3.2, () => line(ctx, pose.frontHand, along(pose.frontHand, forearmFront, 44, 0.45)));
    } else {
      // ACID DANCER: ninja cowl, ribbon streamers, a reverse-grip blade in each hand
      ctx.beginPath();
      ctx.moveTo(h.x + (front ? 12 : 14), h.y - (front ? 4 : 2));
      ctx.lineTo(h.x, h.y - 12);
      ctx.lineTo(h.x - 12, h.y - (front ? 4 : 6));
      ctx.closePath();
      ctx.stroke();
      circle(ctx, h, 7.5);
      ctx.fillStyle = accent;
      visor(ctx, pose, 2, 1, 6, 2.5);

      // Ribbons stream behind; facing the camera, one flows out from each side.
      for (let r = 0; r < 2; r++) {
        const wave = Math.sin(Math.PI * 2 * beat + r * 1.5) * 12;
        const sd = front && r === 1 ? 1 : -1;
        const len = front ? 0.6 : 1;
        withGlow(ctx, r === 0 ? main : accent, 16, 2, () => {
          ctx.beginPath();
          ctx.moveTo(h.x + sd * 6, h.y + (front ? 0 : r * 6));
          ctx.lineTo(h.x + sd * 34 * len, h.y + 10 + wave);
          ctx.lineTo(h.x + sd * 62 * len, h.y + 22 + wave * 1.4);
          ctx.stroke();
        }, main);
      }

      withGlow(ctx, accent, 18, 3.4, () => {
        for (const [hand, fore] of [
          [pose.frontHand, forearmFront],
          [pose.backHand, forearmBack],
        ] as const) {
          const tip = along(hand, fore, 26, -1.9);
          line(ctx, hand, tip);
          line(ctx, tip, along(tip, fore, 12, -0.6));
        }
      });
    }

    drawSkeleton(ctx, pose);
    drawCoreHighlight(ctx, pose);
    return;
  }

  // ---------------------------------------------------------------------------
  // HIGHS: plasma speeders, wraiths and seraphs
  // ---------------------------------------------------------------------------
  if (tier === 1) {
    // SPEEDER: aerodynamic visor, forearm plasma blade, boot jets
    ctx.beginPath();
    if (front) {
      // Head-on: a symmetric arrowhead visor
      ctx.moveTo(h.x - 12, h.y + 6);
      ctx.lineTo(h.x, h.y - 12);
      ctx.lineTo(h.x + 12, h.y + 6);
    } else {
      ctx.moveTo(h.x + 16, h.y);
      ctx.lineTo(h.x - 12, h.y - 10);
      ctx.lineTo(h.x - 14, h.y + 8);
    }
    ctx.closePath();
    ctx.stroke();
    withGlow(ctx, main, 18, 3.5, () => line(ctx, pose.frontElbow, along(pose.frontHand, forearmFront, 26)));
    if (!front) {
      // Boot jets fire backwards (out of sight when facing the camera)
      withGlow(ctx, main, 14, 2.5, () => {
        const f = pose.backFoot;
        seg(ctx, f.x - 2, f.y - 2, f.x - 26 - rnd() * 14, f.y - 2 + (rnd() - 0.5) * 5);
      });
    }
  } else if (tier === 2) {
    // WRAITH: swept energy wings, plasma claws, hover discs under the feet
    circle(ctx, h, 8);
    ctx.fillStyle = '#ffffff';
    visor(ctx, pose, 4, 2, 5, 2.5);
    withGlow(ctx, accent, 18, 3.4, () => {
      for (const sd of sides) {
        seg(ctx, c.x, c.y - 6, c.x - sd * 36, c.y - 32);
        seg(ctx, c.x - sd * 36, c.y - 32, c.x - sd * 48, c.y - 14);
        seg(ctx, c.x, c.y - 2, c.x - sd * 32, c.y - 10);
      }
    }, main);
    withGlow(ctx, accent, 16, 2.8, () => {
      const tip = along(pose.frontHand, forearmFront, 22, -0.3);
      line(ctx, pose.frontHand, tip);
      line(ctx, tip, along(tip, forearmFront, 10, 0.4));
      line(ctx, pose.backHand, along(pose.backHand, forearmBack, 16, 0.3));
    });
    withGlow(ctx, accent, 16, 2.5, () => {
      ctx.beginPath();
      // The renderer lifts wraiths a few units, so the discs float just under their feet.
      ctx.ellipse(pose.frontFoot.x, pose.frontFoot.y + 3, 8, 2.5, 0, 0, Math.PI * 2);
      ctx.ellipse(pose.backFoot.x, pose.backFoot.y + 3, 8, 2.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
  } else {
    // SERAPH: crested helmet, spinning halo, quad wings, beam sabers, sparkle
    circle(ctx, h, 8);
    ctx.fillStyle = '#ffffff';
    visor(ctx, pose, 4, 2, 6, 3);
    withGlow(ctx, accent, 20, 2.5, () => {
      ctx.beginPath();
      ctx.ellipse(h.x, h.y - 14, 14, 4.5, Math.sin(Math.PI * beat) * 0.25, 0, Math.PI * 2);
      ctx.stroke();
    });
    const wingPulse = Math.exp(-((beat % 1) * 5)) * 6;
    withGlow(ctx, accent, 24, 3.6, () => {
      for (const sd of sides) {
        seg(ctx, c.x, c.y - 8, c.x - sd * (42 + wingPulse), c.y - 42);
        seg(ctx, c.x - sd * (42 + wingPulse), c.y - 42, c.x - sd * (58 + wingPulse), c.y - 26);
        seg(ctx, c.x, c.y, c.x - sd * (38 + wingPulse), c.y - 14);
        seg(ctx, c.x - sd * (38 + wingPulse), c.y - 14, c.x - sd * (52 + wingPulse), c.y + 4);
      }
    });
    withGlow(ctx, '#ffffff', 22, 3.8, () => {
      line(ctx, pose.frontHand, along(pose.frontHand, forearmFront, 36, -0.5));
      line(ctx, pose.backHand, along(pose.backHand, forearmBack, 28, 0.5));
    }, accent);
    if (!flash) {
      ctx.fillStyle = '#ffffff';
      for (let sp = 0; sp < 2; sp++) {
        ctx.fillRect(c.x + (rnd() - 0.5) * 40, c.y + (rnd() - 0.5) * 40, 2.5, 2.5);
      }
    }
  }

  drawSkeleton(ctx, pose);
  drawCoreHighlight(ctx, pose);
}
