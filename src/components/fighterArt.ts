import { Point2D, SkeletonPose } from '../types/game';
import { FighterTier } from '../game/fighterTier';
import type { HeroId } from '../game/heroes';
import { bodyFill, drawNeonBody, neonHead, neonLimb } from './neonBody';

/**
 * Draws the player's fighter: angel wings (god tier), lightning (overdrive),
 * ground aura, scarf, solid neon body, head, visor and chest core.
 *
 * Shared by the game and the results-screen progress bar, so the little guy
 * running along the bar is exactly the same character you play.
 * Coordinates are world units with the feet on y = 68.
 */

export interface FighterDrawOptions {
  tier: FighterTier;
  /** +1 facing right, -1 facing left (only the visor needs it) */
  facing: 1 | -1;
  /** Seconds, for the wing flap */
  time: number;
  /** 0..1 extra chest-core pulse (the bass meter in game) */
  corePulse?: number;
  /** Combo, for the aura size (defaults to the tier's minimum) */
  combo?: number;
  /** Random source for the lightning crackle */
  random?: () => number;
  /** Which hero's outfit to draw (default: the original Neon Striker) */
  hero?: HeroId;
}

type Ctx = CanvasRenderingContext2D;

export function drawFighter(ctx: Ctx, pose: SkeletonPose, opts: FighterDrawOptions) {
  const { tier } = opts;
  const combo = opts.combo ?? tier.minCombo;
  const rnd = opts.random ?? Math.random;

  // 1. Radiant angel wings (god tier)
  if (tier.wings) {
    ctx.save();
    ctx.globalAlpha *= 0.55;
    ctx.strokeStyle = '#fff1a8';
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 16;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const spread = 38 + Math.sin(opts.time * 8) * 6;
    for (const side of [-1, 1]) {
      const c = pose.chest;
      const joint = { x: c.x + side * (45 + spread), y: c.y - 45 };
      ctx.beginPath();
      ctx.moveTo(c.x + side * 8, c.y);
      ctx.lineTo(joint.x, joint.y);
      ctx.lineTo(c.x + side * (70 + spread), c.y - 75);
      ctx.moveTo(joint.x, joint.y);
      ctx.lineTo(c.x + side * (65 + spread), c.y - 35);
      ctx.moveTo(joint.x, joint.y);
      ctx.lineTo(c.x + side * (55 + spread), c.y - 15);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 2. Overdrive lightning crackling from the chest to the hands
  if (tier.lightning) {
    ctx.save();
    ctx.globalAlpha *= 0.7;
    ctx.strokeStyle = '#ffe600';
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (const hand of [pose.leftHand, pose.rightHand]) {
      ctx.moveTo(pose.chest.x, pose.chest.y);
      ctx.lineTo((pose.chest.x + hand.x) / 2 + (rnd() - 0.5) * 16, (pose.chest.y + hand.y) / 2 + (rnd() - 0.5) * 16);
      ctx.lineTo(hand.x, hand.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 3. Ground aura ring under the feet
  if (tier.aura) {
    ctx.save();
    const r = 24 + Math.min(26, combo * 0.6);
    ctx.strokeStyle = tier.color;
    ctx.shadowColor = tier.color;
    ctx.shadowBlur = tier.glow * 0.6;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 68, r, r * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 4. Flowing scarf (behind the body), tapering from the neck to the tip
  if (pose.scarf && pose.scarf.length > 1) {
    const pts = [pose.head, ...pose.scarf];
    for (let i = 1; i < pts.length; i++) {
      neonLimb(ctx, pts[i - 1], pts[i], 5 - i * 0.8, tier.scarfColor, bodyFill(tier.scarfColor), 14);
    }
  }

  // 5. Solid neon body. The left limbs lead in every attack pose, so they're in front.
  drawNeonBody(
    ctx,
    {
      head: pose.head,
      chest: pose.chest,
      pelvis: pose.pelvis,
      nearShoulder: pose.leftShoulder,
      nearElbow: pose.leftElbow,
      nearHand: pose.leftHand,
      farShoulder: pose.rightShoulder,
      farElbow: pose.rightElbow,
      farHand: pose.rightHand,
      nearHip: pose.leftHip,
      nearKnee: pose.leftKnee,
      nearFoot: pose.leftFoot,
      farHip: pose.rightHip,
      farKnee: pose.rightKnee,
      farFoot: pose.rightFoot,
    },
    { color: tier.color, glow: tier.glow, shoulderHalf: 12, waistHalf: 6.5, limbScale: 1 }
  );
  neonHead(ctx, pose.head, 9, { color: tier.color, glow: tier.glow });

  // 5b. Hero outfit details on top of the body
  if (opts.hero === 'dragon') drawLittleDragonOutfit(ctx, pose, tier);
  if (pose.prop === 'nunchaku') drawNunchaku(ctx, pose);

  // 6. Visor and pulsing chest core
  ctx.save();
  ctx.fillStyle = tier.visorColor;
  ctx.shadowColor = tier.visorColor;
  ctx.shadowBlur = 10;
  ctx.fillRect(opts.facing > 0 ? pose.head.x - 1 : pose.head.x - 9, pose.head.y - 2.5, 10, 3.5);
  const core = 2.5 + (opts.corePulse ?? 0) * 2.5 + Math.min(2.5, combo * 0.08);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = tier.color;
  ctx.shadowBlur = tier.glow * 0.8;
  ctx.beginPath();
  ctx.arc(pose.chest.x, pose.chest.y + 4, core, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The Little Dragon: a stripe down the side of the tracksuit (yellow, or dark
 * when the combo glow is itself yellow) and a mop of black hair.
 */
function drawLittleDragonOutfit(ctx: Ctx, pose: SkeletonPose, tier: FighterTier) {
  const yellowish = tier.color === '#ffe600' || tier.color === '#fff1a8';
  const stripe = yellowish ? '#1a1a1a' : '#ffe600';
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stripe;
  ctx.lineWidth = 1.8;
  ctx.shadowColor = stripe;
  ctx.shadowBlur = yellowish ? 0 : 6;
  ctx.beginPath();
  ctx.moveTo(pose.chest.x, pose.chest.y + 2);
  ctx.lineTo(pose.pelvis.x, pose.pelvis.y);
  ctx.lineTo(pose.leftKnee.x, pose.leftKnee.y);
  ctx.lineTo(pose.leftFoot.x, pose.leftFoot.y);
  ctx.stroke();
  // Hair: a black bowl cut, a little bigger than the head, with a straight
  // fringe across the forehead, so it reads as its own shape.
  const h = pose.head;
  ctx.fillStyle = '#0d0d16';
  ctx.strokeStyle = tier.color;
  ctx.lineWidth = 1.4;
  ctx.shadowColor = tier.color;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(h.x, h.y - 0.5, 11.5, Math.PI * 0.92, Math.PI * 2.08);
  ctx.lineTo(h.x + 9, h.y - 3.5);
  ctx.lineTo(h.x - 9, h.y - 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Nunchaku in the lead hand: one handle gripped, the other swung out along the strike. */
function drawNunchaku(ctx: Ctx, pose: SkeletonPose) {
  const hand = pose.leftHand;
  const fx = hand.x - pose.leftElbow.x;
  const fy = hand.y - pose.leftElbow.y;
  const fl = Math.hypot(fx, fy) || 1;
  const grip = { x: hand.x + (fx / fl) * 10, y: hand.y + (fy / fl) * 10 };
  const aim = pose.bladeSlash?.end ?? { x: grip.x + (fx / fl) * 20, y: grip.y + (fy / fl) * 20 };
  const ax = aim.x - grip.x;
  const ay = aim.y - grip.y;
  const al = Math.hypot(ax, ay) || 1;
  const link = { x: grip.x + (ax / al) * 5, y: grip.y + (ay / al) * 5 };
  const tip = { x: link.x + (ax / al) * 12, y: link.y + (ay / al) * 12 };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = '#ffb347';
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#ffb347';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hand.x, hand.y);
  ctx.lineTo(grip.x, grip.y);
  ctx.moveTo(link.x, link.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  ctx.strokeStyle = '#d0d0e0';
  ctx.lineWidth = 1;
  ctx.setLineDash([1.5, 1.5]);
  ctx.beginPath();
  ctx.moveTo(grip.x, grip.y);
  ctx.lineTo(link.x, link.y);
  ctx.stroke();
  ctx.restore();
}

/** Crescent-shaped slash: thick in the middle, tapering to points at both ends. */
export function drawSlashCrescent(
  ctx: CanvasRenderingContext2D,
  slash: { start: Point2D; end: Point2D; curveOffset: number; color: string }
) {
  const midX = (slash.start.x + slash.end.x) / 2;
  const midY = (slash.start.y + slash.end.y) / 2 + slash.curveOffset;
  // Push the outer curve away from the chord to give the crescent its thickness.
  const dx = slash.end.x - slash.start.x;
  const dy = slash.end.y - slash.start.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const side = slash.curveOffset >= 0 ? 1 : -1;
  const thick = 9;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(slash.start.x, slash.start.y);
  ctx.quadraticCurveTo(midX + nx * thick * side, midY + ny * thick * side, slash.end.x, slash.end.y);
  ctx.quadraticCurveTo(midX - nx * thick * 0.4 * side, midY - ny * thick * 0.4 * side, slash.start.x, slash.start.y);
  ctx.closePath();
  ctx.fillStyle = colorWithAlpha(slash.color, 0.55);
  ctx.shadowColor = slash.color;
  ctx.shadowBlur = 26;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(slash.start.x, slash.start.y);
  ctx.quadraticCurveTo(midX + nx * thick * 0.5 * side, midY + ny * thick * 0.5 * side, slash.end.x, slash.end.y);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.restore();
}

function colorWithAlpha(hex: string, alpha: number): string {
  if (hex.startsWith('#') && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}
