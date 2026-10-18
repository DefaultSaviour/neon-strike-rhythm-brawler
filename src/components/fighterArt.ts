import { Point2D, SkeletonPose } from '../types/game';
import { FighterTier } from '../game/fighterTier';
import type { HeroId } from '../game/heroes';
import { bodyFill, drawNeonBody, neonHead, neonLimb } from './neonBody';

/**
 * Draws the player's fighter: the hero's top-level form (god tier), lightning (overdrive),
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

  // 1. Top-level form (god tier), behind the body: each hero has their own.
  if (tier.ascended) {
    if (opts.hero === 'dragon') drawDragonSpirit(ctx, pose, opts.time);
    else if (opts.hero === 'babaYaga') drawFocusAfterimages(ctx, pose, opts.facing);
    else drawAngelWings(ctx, pose, opts.time);
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
  if (opts.hero === 'babaYaga') drawBabaYagaOutfit(ctx, pose, tier, opts.facing);
  if (pose.prop === 'nunchaku') drawNunchaku(ctx, pose);
  if (pose.prop === 'pistol' || pose.prop === 'pistols' || pose.prop === 'shotgun' || pose.prop === 'pencil') {
    drawHandWeapons(ctx, pose, opts.facing, tier.ascended && opts.hero === 'babaYaga');
  }

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

/** Neon Striker's top-level form: radiant angel wings, gently flapping. */
function drawAngelWings(ctx: Ctx, pose: SkeletonPose, time: number) {
  ctx.save();
  ctx.globalAlpha *= 0.55;
  ctx.strokeStyle = '#fff1a8';
  ctx.shadowColor = '#ffe600';
  ctx.shadowBlur = 16;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const spread = 38 + Math.sin(time * 8) * 6;
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

/** Points along the Little Dragon's spirit, from the tail (by the hips) to the head (above his head). */
export function dragonSpiritPath(pose: SkeletonPose, time: number, count = 26): Point2D[] {
  const base = pose.pelvis.y + 22;
  const top = pose.head.y - 40;
  const pts: Point2D[] = [];
  for (let i = 0; i < count; i++) {
    const s = i / (count - 1);
    const angle = s * Math.PI * 3 + time * 2.5;
    pts.push({
      x: pose.chest.x + Math.cos(angle) * (30 - s * 12),
      y: base + (top - base) * s + Math.sin(angle) * 6,
    });
  }
  return pts;
}

/**
 * The Little Dragon's top-level form: a golden dragon spirit coiling up
 * around him from hips to head, slowly turning. Two strokes and a head, so
 * it costs about the same to draw as the wings.
 */
function drawDragonSpirit(ctx: Ctx, pose: SkeletonPose, time: number) {
  const pts = dragonSpiritPath(pose, time);
  const line = (width: number, color: string, blur: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowColor = '#ffb000';
    ctx.shadowBlur = blur;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  };
  ctx.save();
  ctx.globalAlpha *= 0.7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  line(5, '#ffb000', 16); // glowing body
  line(1.6, '#fff1a8', 0); // bright spine
  // Head at the top end, facing along the last stretch of the body
  const head = pts[pts.length - 1];
  const prev = pts[pts.length - 3];
  const dx = head.x - prev.x;
  const dy = head.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  ctx.fillStyle = '#ffb000';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(head.x + ux * 9, head.y + uy * 9);
  ctx.lineTo(head.x - uy * 5, head.y + ux * 5);
  ctx.lineTo(head.x + uy * 5, head.y - ux * 5);
  ctx.closePath();
  ctx.fill();
  // Eye and whiskers
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(head.x + ux * 3, head.y + uy * 3, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff1a8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(head.x + ux * 8, head.y + uy * 8);
    ctx.quadraticCurveTo(
      head.x + ux * 14 - uy * side * 6,
      head.y + uy * 14 + ux * side * 6,
      head.x + ux * 10 - uy * side * 12,
      head.y + uy * 10 + ux * side * 12
    );
  }
  ctx.stroke();
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

/**
 * Baba Yaga's top-level form, behind the body: the slow-motion "focus" look,
 * two faint red afterimages of his body trailing behind him. Bones only,
 * so it costs little. (The red laser sight is drawn with the gun.)
 */
function drawFocusAfterimages(ctx: Ctx, pose: SkeletonPose, facing: 1 | -1) {
  const bones: [Point2D, Point2D][] = [
    [pose.head, pose.chest],
    [pose.chest, pose.pelvis],
    [pose.leftShoulder, pose.leftElbow],
    [pose.leftElbow, pose.leftHand],
    [pose.rightShoulder, pose.rightElbow],
    [pose.rightElbow, pose.rightHand],
    [pose.pelvis, pose.leftKnee],
    [pose.leftKnee, pose.leftFoot],
    [pose.pelvis, pose.rightKnee],
    [pose.rightKnee, pose.rightFoot],
  ];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#ff2a3d';
  ctx.shadowColor = '#ff2a3d';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 5;
  const base = ctx.globalAlpha;
  [0.28, 0.13].forEach((alpha, i) => {
    const dx = -facing * 11 * (i + 1);
    ctx.globalAlpha = base * alpha;
    ctx.beginPath();
    for (const [a, b] of bones) {
      ctx.moveTo(a.x + dx, a.y);
      ctx.lineTo(b.x + dx, b.y);
    }
    ctx.stroke();
  });
  ctx.restore();
}

/**
 * Baba Yaga's suit: a dark jacket over the torso with a white collar V and a
 * black tie, slicked-back hair and stubble along the jaw.
 */
function drawBabaYagaOutfit(ctx: Ctx, pose: SkeletonPose, tier: FighterTier, facing: 1 | -1) {
  const c = pose.chest;
  const p = pose.pelvis;
  const along = (t: number) => ({ x: c.x + (p.x - c.x) * t, y: c.y + (p.y - c.y) * t });
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Jacket over the torso (as wide as the drawn body), edged in the combo colour
  const sx = p.x - c.x;
  const sy = p.y - c.y;
  const sl = Math.hypot(sx, sy) || 1;
  const nx = -sy / sl;
  const ny = sx / sl;
  ctx.fillStyle = '#0b0b12';
  ctx.strokeStyle = tier.color;
  ctx.lineWidth = 1.2;
  ctx.shadowColor = tier.color;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(c.x + nx * 10, c.y + ny * 10);
  ctx.lineTo(c.x - nx * 10, c.y - ny * 10);
  ctx.lineTo(p.x - nx * 6.5 + (sx / sl) * 3, p.y - ny * 6.5 + (sy / sl) * 3);
  ctx.lineTo(p.x + nx * 6.5 + (sx / sl) * 3, p.y + ny * 6.5 + (sy / sl) * 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // White shirt collar V, and the black tie down the middle
  ctx.shadowBlur = 0;
  const v = along(0.3);
  ctx.strokeStyle = '#f2f2f7';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(c.x - 4, c.y - 1);
  ctx.lineTo(v.x, v.y);
  ctx.lineTo(c.x + 4, c.y - 1);
  ctx.stroke();
  const knot = along(0.15);
  const tip = along(0.6);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(knot.x, knot.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  // Slicked-back hair: a dark cap swept into a point behind the head
  const h = pose.head;
  const back = -facing;
  ctx.fillStyle = '#0d0d16';
  ctx.strokeStyle = tier.color;
  ctx.lineWidth = 1.2;
  ctx.shadowColor = tier.color;
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.moveTo(h.x + facing * 8, h.y - 4);
  ctx.quadraticCurveTo(h.x, h.y - 13, h.x + back * 10, h.y - 6);
  ctx.lineTo(h.x + back * 13, h.y + 1);
  ctx.quadraticCurveTo(h.x + back * 6, h.y - 4, h.x + facing * 8, h.y - 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Stubble along the front of the jaw
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(20, 20, 30, 0.75)';
  ctx.lineWidth = 2.2;
  ctx.setLineDash([1, 1.4]);
  ctx.beginPath();
  if (facing > 0) ctx.arc(h.x + 1.5, h.y + 1, 6.5, 0.1 * Math.PI, 0.55 * Math.PI);
  else ctx.arc(h.x - 1.5, h.y + 1, 6.5, 0.45 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

/** A weapon gripped in a hand: which way it points (along the forearm) and where its muzzle is. */
function weaponAt(hand: Point2D, elbow: Point2D, length: number) {
  const dx = hand.x - elbow.x;
  const dy = hand.y - elbow.y;
  const l = Math.hypot(dx, dy) || 1;
  const dir = { x: dx / l, y: dy / l };
  return { dir, muzzle: { x: hand.x + dir.x * length, y: hand.y + dir.y * length } };
}

/** The lead (gun) arm and the rear arm. Facing left mirrors the pose, which swaps the sides. */
function arms(pose: SkeletonPose, facing: 1 | -1) {
  const left = { hand: pose.leftHand, elbow: pose.leftElbow };
  const right = { hand: pose.rightHand, elbow: pose.rightElbow };
  return facing > 0 ? { lead: left, rear: right } : { lead: right, rear: left };
}

/** The muzzle of the gun firing this pose's shot, if it fires. */
export function muzzlePoint(pose: SkeletonPose, facing: 1 | -1): Point2D | undefined {
  if (!pose.shot || !pose.bladeSlash) return undefined;
  const { lead, rear } = arms(pose, facing);
  const arm = pose.shot === 'rear' ? rear : lead;
  return weaponAt(arm.hand, arm.elbow, pose.prop === 'shotgun' ? 22 : 9).muzzle;
}

/**
 * Pistol(s), shotgun or pencil, plus the muzzle flash and a spent casing
 * when the pose fires. The bullet streak itself is the pose's trail. In the
 * top-level form a red laser sight runs out from the lead gun.
 */
function drawHandWeapons(ctx: Ctx, pose: SkeletonPose, facing: 1 | -1, laser: boolean) {
  const { lead, rear } = arms(pose, facing);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = '#c8d2ff';
  ctx.shadowBlur = 6;
  ctx.strokeStyle = '#d0d6ec';

  if (pose.prop === 'pencil') {
    const { dir, muzzle: tip } = weaponAt(lead.hand, lead.elbow, 8);
    ctx.shadowColor = '#ffd23f';
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(lead.hand.x - dir.x * 2, lead.hand.y - dir.y * 2);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const pistol = (hand: Point2D, elbow: Point2D) => {
    const { dir, muzzle } = weaponAt(hand, elbow, 9);
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(hand.x - dir.x * 1.5, hand.y - dir.y * 1.5);
    ctx.lineTo(muzzle.x, muzzle.y);
    // Grip, hanging below the slide
    ctx.moveTo(hand.x, hand.y);
    ctx.lineTo(hand.x - dir.x * 2 - dir.y * 4.5, hand.y - dir.y * 2 + dir.x * 4.5);
    ctx.stroke();
  };
  const gunLength = pose.prop === 'shotgun' ? 22 : 9;
  const { dir, muzzle } = weaponAt(lead.hand, lead.elbow, gunLength);
  if (pose.prop === 'shotgun') {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lead.hand.x - dir.x * 22, lead.hand.y - dir.y * 22 + 2);
    ctx.lineTo(lead.hand.x - dir.x * 12, lead.hand.y - dir.y * 12);
    ctx.lineTo(muzzle.x, muzzle.y);
    ctx.stroke();
    // Wooden pump grip under the barrel
    ctx.strokeStyle = '#8a6a4a';
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(lead.hand.x + dir.x * 3 - dir.y * 2, lead.hand.y + dir.y * 3 + dir.x * 2);
    ctx.lineTo(lead.hand.x + dir.x * 10 - dir.y * 2, lead.hand.y + dir.y * 10 + dir.x * 2);
    ctx.stroke();
  } else {
    pistol(lead.hand, lead.elbow);
    if (pose.prop === 'pistols') pistol(rear.hand, rear.elbow);
  }

  if (laser) {
    ctx.save();
    ctx.globalAlpha *= 0.6;
    ctx.strokeStyle = '#ff2a3d';
    ctx.shadowColor = '#ff2a3d';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(muzzle.x, muzzle.y);
    ctx.lineTo(muzzle.x + dir.x * 260, muzzle.y + dir.y * 260);
    ctx.stroke();
    ctx.restore();
  }

  const m = muzzlePoint(pose, facing);
  if (m && pose.bladeSlash) {
    // Muzzle flash: a white three-point star, and a thin white core on the tracer
    const e = pose.bladeSlash.end;
    const a = Math.atan2(e.y - m.y, e.x - m.x);
    const big = pose.prop === 'shotgun' ? 1.6 : 1;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffd27a';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const r = (i % 2 === 1 ? 2.2 : i === 0 ? 12 : 6.5) * big;
      const t = a + (i * Math.PI) / 3;
      ctx.lineTo(m.x + Math.cos(t) * r, m.y + Math.sin(t) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();
    // A spent brass casing kicked up and back off the gun
    ctx.fillStyle = '#e8b04a';
    ctx.shadowColor = '#e8b04a';
    ctx.shadowBlur = 4;
    ctx.fillRect(m.x - Math.cos(a) * 12 - 1.25, m.y - 10, 2.5, 4);
  }
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
