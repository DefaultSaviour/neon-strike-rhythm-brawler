import { SkeletonPose } from '../types/game';
import { FighterTier } from '../game/fighterTier';
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
