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

export function drawFighter(ctx: Ctx, skeleton: SkeletonPose, opts: FighterDrawOptions) {
  const { tier } = opts;
  // The Prima Ballerina is drawn with long dancer's arms (see ballerinaArms)
  const pose = opts.hero === 'ballerina' ? ballerinaArms(skeleton) : skeleton;
  const combo = opts.combo ?? tier.minCombo;
  const rnd = opts.random ?? Math.random;

  // 1. Top-level form (god tier), behind the body: each hero has their own.
  if (tier.ascended) {
    if (opts.hero === 'dragon') drawDragonSpirit(ctx, pose, opts.time);
    else if (opts.hero === 'babaYaga') drawGoldCoinHalo(ctx, pose, opts.time);
    else if (opts.hero === 'theOne') drawCodeRain(ctx, pose, opts.time);
    else if (opts.hero === 'drunkenMaster') drawDizzyHalo(ctx, pose, opts.time, combo, 'back');
    else if (opts.hero === 'proWrestler') drawChampionSpotlight(ctx, pose, opts.time);
    // The Prima Ballerina's swan tutu is part of her outfit, drawn over the body (step 5b)
    else if (opts.hero === 'ballerina') {
      /* nothing behind her */
    }
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

  // 4a. The Prima Ballerina's spin blur when she turns, behind the body
  if (opts.hero === 'ballerina' && pose.spin) drawSpinBlur(ctx, pose);

  // 4b. The One's long coat tail, flaring out behind his legs
  if (opts.hero === 'theOne') drawCoatTail(ctx, pose, tier, opts.facing, opts.time);

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
  if (opts.hero === 'theOne') drawTheOneOutfit(ctx, pose, tier, opts.facing);
  if (opts.hero === 'drunkenMaster') drawDrunkenOutfit(ctx, pose, tier, opts.facing, combo);
  if (pose.prop === 'gourd' || pose.prop === 'gourdSwing' || pose.prop === 'bench') drawDrunkenProps(ctx, pose, opts.facing);
  if (opts.hero === 'proWrestler') drawWrestlerOutfit(ctx, pose, tier, opts.facing);
  if (pose.prop === 'chair') drawSteelChair(ctx, pose, opts.facing);
  if (opts.hero === 'ballerina') drawBallerinaOutfit(ctx, pose, tier, opts.facing, opts.time);
  // ...and the front half of the Drunken Master's dizzy halo, passing in front of his head
  if (tier.ascended && opts.hero === 'drunkenMaster') drawDizzyHalo(ctx, pose, opts.time, combo, 'front');
  if (pose.prop === 'nunchaku') drawNunchaku(ctx, pose);
  if (pose.prop === 'pistol' || pose.prop === 'pistols' || pose.prop === 'shotgun' || pose.prop === 'pencil') {
    drawHandWeapons(ctx, pose, opts.facing, tier.ascended && opts.hero === 'babaYaga');
  }

  // 6. Visor (The One wears small dark sunglasses instead) and pulsing chest core
  ctx.save();
  if (opts.hero === 'theOne') {
    drawSunglasses(ctx, pose, opts.facing);
  } else if (opts.hero === 'drunkenMaster') {
    drawSleepyEyes(ctx, pose, opts.facing);
  } else {
    ctx.fillStyle = tier.visorColor;
    ctx.shadowColor = tier.visorColor;
    ctx.shadowBlur = 10;
    ctx.fillRect(opts.facing > 0 ? pose.head.x - 1 : pose.head.x - 9, pose.head.y - 2.5, 10, 3.5);
  }
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

/** The falling streaks of The One's code rain: where each bright head is, and how long it is. */
export function codeRainStreaks(pose: SkeletonPose, time: number, count = 20) {
  const top = pose.head.y - 90;
  const span = 68 - top;
  const streaks = [];
  for (let i = 0; i < count; i++) {
    // Spread the columns across both sides of him, each falling at its own speed
    const x = pose.chest.x + ((i * 37) % 150) - 75;
    const speed = 70 + ((i * 53) % 60);
    const y = top + ((time * speed + i * 41) % span);
    streaks.push({ x, y, length: 16 + ((i * 29) % 18) });
  }
  return streaks;
}

/**
 * The One's top-level form: green "code" raining down all around him, each
 * streak a column of short dashes with a bright head, plus a green glow
 * ring under his feet. One path per colour, so it stays cheap.
 */
function drawCodeRain(ctx: Ctx, pose: SkeletonPose, time: number) {
  const streaks = codeRainStreaks(pose, time);
  ctx.save();
  ctx.lineCap = 'butt';
  // Dim tails: a column of dashes trailing up from each head
  ctx.strokeStyle = 'rgba(57, 255, 106, 0.55)';
  ctx.shadowColor = '#39ff6a';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (const st of streaks) {
    for (let d = 5; d < st.length; d += 5) {
      ctx.moveTo(st.x, st.y - d);
      ctx.lineTo(st.x, st.y - d - 3);
    }
  }
  ctx.stroke();
  // Bright heads
  ctx.strokeStyle = '#d8ffe0';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const st of streaks) {
    ctx.moveTo(st.x, st.y);
    ctx.lineTo(st.x, st.y - 4);
  }
  ctx.stroke();
  // Green glow ring under his feet
  ctx.strokeStyle = '#39ff6a';
  ctx.shadowBlur = 18;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(pose.pelvis.x, 68, 46, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * The One's long black coat, behind the body: from the shoulders down past
 * the knees, the tail flaring out behind him. It flares more when he is in
 * the air and sways gently with time.
 */
function drawCoatTail(ctx: Ctx, pose: SkeletonPose, tier: FighterTier, facing: 1 | -1, time: number) {
  const c = pose.chest;
  const p = pose.pelvis;
  const back = -facing;
  const airborne = Math.max(0, Math.min(1, (40 - p.y) / 40));
  const flare = 10 + airborne * 18 + Math.sin(time * 3) * 3;
  const sx = p.x - c.x;
  const sy = p.y - c.y;
  const sl = Math.hypot(sx, sy) || 1;
  // Hem: below the hips along the spine, swept behind
  const hemFront = { x: p.x + (sx / sl) * 42 - back * 4, y: p.y + (sy / sl) * 42 };
  const hemBack = { x: p.x + (sx / sl) * 38 + back * (16 + flare), y: p.y + (sy / sl) * 38 - airborne * 12 };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#07070c';
  ctx.strokeStyle = tier.color;
  ctx.lineWidth = 1.4;
  ctx.shadowColor = tier.color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(c.x - back * 8, c.y);
  ctx.lineTo(c.x + back * 10, c.y + 2);
  ctx.quadraticCurveTo(p.x + back * (8 + flare * 0.5), p.y, hemBack.x, hemBack.y);
  ctx.lineTo(hemFront.x, hemFront.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** The One's coat front over the torso (with a high open collar), and short dark hair. */
function drawTheOneOutfit(ctx: Ctx, pose: SkeletonPose, tier: FighterTier, facing: 1 | -1) {
  const c = pose.chest;
  const p = pose.pelvis;
  const sx = p.x - c.x;
  const sy = p.y - c.y;
  const sl = Math.hypot(sx, sy) || 1;
  const nx = -sy / sl;
  const ny = sx / sl;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#07070c';
  ctx.strokeStyle = tier.color;
  ctx.lineWidth = 1.2;
  ctx.shadowColor = tier.color;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(c.x + nx * 10, c.y + ny * 10);
  ctx.lineTo(c.x - nx * 10, c.y - ny * 10);
  ctx.lineTo(p.x - nx * 7 + (sx / sl) * 6, p.y - ny * 7 + (sy / sl) * 6);
  ctx.lineTo(p.x + nx * 7 + (sx / sl) * 6, p.y + ny * 7 + (sy / sl) * 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // High coat collar, open in a V at the neck
  ctx.beginPath();
  ctx.moveTo(c.x - 5, c.y - 3);
  ctx.lineTo(c.x + (p.x - c.x) * 0.4, c.y + (p.y - c.y) * 0.4);
  ctx.lineTo(c.x + 5, c.y - 3);
  ctx.stroke();
  // Short dark hair, close to the head
  const h = pose.head;
  ctx.fillStyle = '#0d0d16';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(h.x - facing * 0.5, h.y - 0.5, 10, Math.PI * 1.05, Math.PI * 1.95);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Small, dark, oval sunglasses where the visor would be. */
function drawSunglasses(ctx: Ctx, pose: SkeletonPose, facing: 1 | -1) {
  const h = pose.head;
  ctx.fillStyle = '#020204';
  ctx.strokeStyle = '#9fffb8';
  ctx.lineWidth = 0.8;
  ctx.shadowColor = '#39ff6a';
  ctx.shadowBlur = 6;
  for (const dx of [2, 7]) {
    ctx.beginPath();
    ctx.ellipse(h.x + facing * dx, h.y - 1, 2.8, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(h.x + facing * 4.8, h.y - 1.4);
  ctx.lineTo(h.x + facing * 4.2, h.y - 1.4);
  ctx.moveTo(h.x - facing * 0.8, h.y - 1.5);
  ctx.lineTo(h.x - facing * 7, h.y - 2.5);
  ctx.stroke();
}

/**
 * A wine gourd: a small neck where it is held and two round bulbs hanging
 * away from it along `down` (a unit vector). Outlined dark so it reads
 * against the neon body.
 */
function drawGourd(ctx: Ctx, neck: Point2D, down: Point2D, scale = 1) {
  const at = (d: number) => ({ x: neck.x + down.x * d * scale, y: neck.y + down.y * d * scale });
  const top = at(5);
  const bottom = at(13);
  ctx.save();
  ctx.fillStyle = '#c8741e';
  ctx.strokeStyle = '#05050c';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#ffb347';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(top.x, top.y, 3.8 * scale, 0, Math.PI * 2);
  ctx.moveTo(bottom.x + 6 * scale, bottom.y);
  ctx.arc(bottom.x, bottom.y, 6 * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fill();
  // Red cord tied round the waist of the gourd
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ff3b3b';
  ctx.lineWidth = 1.6 * scale;
  ctx.beginPath();
  const waist = at(8.5);
  ctx.moveTo(waist.x - down.y * 3 * scale, waist.y + down.x * 3 * scale);
  ctx.lineTo(waist.x + down.y * 3 * scale, waist.y - down.x * 3 * scale);
  ctx.stroke();
  ctx.restore();
}

/** How fast the Drunken Master's dizzy halo spins (radians per second): faster as the combo climbs. */
export function dizzySpeed(combo: number): number {
  return 2.6 + Math.min(4, combo * 0.04);
}

/**
 * The items circling the Drunken Master's head in his top-level form, on a
 * tilted ring: stars and little birds, and whether each is in front of his
 * head right now.
 */
export function dizzyHalo(pose: SkeletonPose, time: number, combo: number) {
  const kinds = ['star', 'bird', 'star', 'star', 'bird', 'star'] as const;
  const centre = { x: pose.head.x, y: pose.head.y - 16 };
  return kinds.map((kind, i) => {
    const a = time * dizzySpeed(combo) + (i / kinds.length) * Math.PI * 2;
    return { kind, x: centre.x + Math.cos(a) * 34, y: centre.y + Math.sin(a) * 10, front: Math.sin(a) > 0 };
  });
}

/** A fat cartoon five-point star. */
function drawCartoonStar(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const t = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
}

/** A little cartoon bird: round body, a flapping wing, a beak. */
function drawCartoonBird(ctx: Ctx, x: number, y: number, flap: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.4, 1.4);
  ctx.translate(-x, -y);
  ctx.fillStyle = '#7fd8ff';
  ctx.beginPath();
  ctx.arc(x, y, 4.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fill();
  // Wing flapping up and down
  ctx.beginPath();
  ctx.moveTo(x - 1, y);
  ctx.lineTo(x - 6, y - 4 * flap);
  ctx.lineTo(x + 2, y - 1);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  // Beak
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.moveTo(x + 4, y - 1);
  ctx.lineTo(x + 7.5, y);
  ctx.lineTo(x + 4, y + 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * The Drunken Master's top-level form: a cartoon "dizzy halo" of stars and
 * little birds circling his head, spinning faster as the combo grows. Drawn
 * in two halves round the head, so they pass behind it and then in front.
 */
function drawDizzyHalo(ctx: Ctx, pose: SkeletonPose, time: number, combo: number, half: 'back' | 'front') {
  const items = dizzyHalo(pose, time, combo);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#05050c';
  ctx.lineWidth = 1.6;
  ctx.shadowColor = '#fff1a8';
  ctx.shadowBlur = 10;
  if (half === 'back') {
    // The dizzy ring itself: a faint tilted loop round the head
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 241, 168, 0.4)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.ellipse(pose.head.x, pose.head.y - 16, 34, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  const flap = Math.sin(time * 18) > 0 ? 1 : -0.4;
  for (const it of items) {
    if (it.front !== (half === 'front')) continue;
    // Items behind the head are a touch smaller and dimmer, for depth
    const depth = it.front ? 1 : 0.8;
    ctx.globalAlpha = it.front ? 1 : 0.75;
    if (it.kind === 'star') {
      ctx.fillStyle = '#ffe14a';
      drawCartoonStar(ctx, it.x, it.y, 8.5 * depth);
    } else {
      drawCartoonBird(ctx, it.x, it.y, flap);
    }
  }
  ctx.restore();
}

/**
 * The Drunken Master: an open shirt (two light edges down the chest), a red
 * sash with a tail, messy spiky hair, and cheeks that flush redder as the
 * combo grows.
 */
function drawDrunkenOutfit(ctx: Ctx, pose: SkeletonPose, tier: FighterTier, facing: 1 | -1, combo: number) {
  const c = pose.chest;
  const p = pose.pelvis;
  const sx = p.x - c.x;
  const sy = p.y - c.y;
  const sl = Math.hypot(sx, sy) || 1;
  const nx = -sy / sl;
  const ny = sx / sl;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Open shirt: the two front edges, falling open from the collar
  ctx.strokeStyle = '#f2e6cc';
  ctx.shadowColor = '#f2e6cc';
  ctx.shadowBlur = 4;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(c.x + nx * 8 * side, c.y + ny * 8 * side);
    ctx.lineTo(c.x + sx * 0.45 + nx * 3 * side, c.y + sy * 0.45 + ny * 3 * side);
    ctx.lineTo(p.x - (sx / sl) * 3 + nx * 5 * side, p.y - (sy / sl) * 3 + ny * 5 * side);
  }
  ctx.stroke();
  // Red sash round the waist, its tail hanging down behind
  const back = -facing;
  ctx.strokeStyle = '#ff3b3b';
  ctx.shadowColor = '#ff3b3b';
  ctx.shadowBlur = 6;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(p.x - (sx / sl) * 4 + nx * 8, p.y - (sy / sl) * 4 + ny * 8);
  ctx.lineTo(p.x - (sx / sl) * 4 - nx * 8, p.y - (sy / sl) * 4 - ny * 8);
  ctx.stroke();
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(p.x + back * 5, p.y - 3);
  ctx.quadraticCurveTo(p.x + back * 12, p.y + 6, p.x + back * 10, p.y + 16);
  ctx.stroke();
  // Messy hair: a ragged mop of spikes
  const h = pose.head;
  ctx.fillStyle = '#0d0d16';
  ctx.strokeStyle = tier.color;
  ctx.shadowColor = tier.color;
  ctx.shadowBlur = 5;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const spikes = [
    [-11, 0],
    [-13, -8],
    [-7, -7],
    [-6, -15],
    [-1, -10],
    [3, -16],
    [5, -9],
    [11, -12],
    [9, -4],
    [11, 0],
  ];
  ctx.moveTo(h.x - 10, h.y + 1);
  for (const [x, y] of spikes) ctx.lineTo(h.x + x * facing, h.y + y);
  ctx.quadraticCurveTo(h.x, h.y - 6, h.x - 10 * facing, h.y + 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Flushed cheek: redder as the combo climbs
  const flush = Math.min(1, 0.2 + combo / 55);
  ctx.fillStyle = `rgba(255, 60, 70, ${flush.toFixed(2)})`;
  ctx.shadowColor = '#ff3b3b';
  ctx.shadowBlur = 6 * flush;
  ctx.beginPath();
  ctx.ellipse(h.x + facing * 4, h.y + 3.5, 3.2, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Half-closed, sleepy eyes where the visor would be. */
function drawSleepyEyes(ctx: Ctx, pose: SkeletonPose, facing: 1 | -1) {
  const h = pose.head;
  ctx.strokeStyle = '#05050c';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const dx of [2.5, 7]) {
    ctx.moveTo(h.x + facing * (dx - 2), h.y - 1);
    ctx.quadraticCurveTo(h.x + facing * dx, h.y + 0.6, h.x + facing * (dx + 2), h.y - 1);
  }
  ctx.stroke();
}

/**
 * The Drunken Master's props. The gourd hangs from his rear hand (or is
 * tipped to his lips when the hand is up by his face); for the gourd combos
 * it swings out from the lead hand on its string; the bench plank is gripped
 * in both hands. Big swings spill drops of wine.
 */
function drawDrunkenProps(ctx: Ctx, pose: SkeletonPose, facing: 1 | -1) {
  const { lead, rear } = arms(pose, facing);
  ctx.save();
  ctx.lineCap = 'round';
  let spillAt: Point2D | undefined;
  if (pose.prop === 'gourdSwing') {
    // Out on its string, toward where the swing lands
    const { dir } = weaponAt(lead.hand, lead.elbow, 1);
    const aim = pose.bladeSlash?.end ?? { x: lead.hand.x + dir.x * 20, y: lead.hand.y + dir.y * 20 };
    const ax = aim.x - lead.hand.x;
    const ay = aim.y - lead.hand.y;
    const al = Math.hypot(ax, ay) || 1;
    const down = { x: ax / al, y: ay / al };
    const neck = { x: lead.hand.x + down.x * 14, y: lead.hand.y + down.y * 14 };
    ctx.strokeStyle = '#ff3b3b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(lead.hand.x, lead.hand.y);
    ctx.lineTo(neck.x, neck.y);
    ctx.stroke();
    drawGourd(ctx, neck, down, 1.1);
    spillAt = { x: neck.x + down.x * 16, y: neck.y + down.y * 16 };
  } else {
    if (pose.prop === 'bench') {
      // Plank through both hands, sticking out well past the lead hand
      const dx = lead.hand.x - rear.hand.x;
      const dy = lead.hand.y - rear.hand.y;
      const fallback = weaponAt(lead.hand, lead.elbow, 1).dir;
      const l = Math.hypot(dx, dy);
      const d = l > 3 ? { x: dx / l, y: dy / l } : fallback;
      ctx.beginPath();
      ctx.moveTo(rear.hand.x - d.x * 8, rear.hand.y - d.y * 8);
      ctx.lineTo(lead.hand.x + d.x * 30, lead.hand.y + d.y * 30);
      ctx.strokeStyle = '#05050c';
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = '#b8875a';
      ctx.shadowColor = '#ffb347';
      ctx.shadowBlur = 6;
      ctx.lineWidth = 6;
      ctx.stroke();
      if (pose.bladeSlash) spillAt = { x: lead.hand.x + d.x * 30, y: lead.hand.y + d.y * 30 };
    }
    // The gourd in his rear hand: tipped to his lips, or hanging by its neck
    const atMouth = rear.hand.y < pose.chest.y - 6;
    const down = atMouth ? { x: -facing * 0.6, y: -0.8 } : { x: 0, y: 1 };
    drawGourd(ctx, rear.hand, down, 1);
  }
  // Spilled drops of wine on the big swings
  if (spillAt && pose.bladeSlash) {
    ctx.fillStyle = '#ffcf7a';
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 8;
    for (const [ox, oy, r] of [
      [4, -6, 2.4],
      [-6, -3, 1.8],
      [8, 4, 1.6],
    ]) {
      ctx.beginPath();
      ctx.arc(spillAt.x + ox * facing, spillAt.y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Where the Pro Wrestler's championship belt floats in his top-level form: high above his head, bobbing. */
export function championBelt(pose: SkeletonPose, time: number) {
  return { x: pose.head.x, y: pose.head.y - 34 + Math.sin(time * 3) * 3, halfWidth: 30 };
}

/** A gold championship belt plate with black straps either side, centred on (x, y). */
function drawBeltPlate(ctx: Ctx, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Straps
  ctx.fillStyle = '#111118';
  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = 0.8;
  ctx.fillRect(-15, -2.6, 30, 5.2);
  ctx.strokeRect(-15, -2.6, 30, 5.2);
  // Big gold plate, with a ruby in the middle
  ctx.fillStyle = '#ffc23a';
  ctx.strokeStyle = '#05050c';
  ctx.lineWidth = 1.4;
  ctx.shadowColor = '#ffb000';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.ellipse(0, 0, 7.5, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffe9a0';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 10.5, 0, 2.6, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff2a3d';
  ctx.beginPath();
  ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The Pro Wrestler's top-level form: a bright spotlight beaming down on him
 * from above, and the gold championship belt floating high over his head.
 */
function drawChampionSpotlight(ctx: Ctx, pose: SkeletonPose, time: number) {
  const x = pose.pelvis.x;
  ctx.save();
  // The spotlight cone, from a point far above down to a pool on the floor
  const g = ctx.createLinearGradient(0, -230, 0, 68);
  g.addColorStop(0, 'rgba(255, 250, 225, 0.05)');
  g.addColorStop(1, 'rgba(255, 250, 225, 0.32)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 12, -230);
  ctx.lineTo(x + 12, -230);
  ctx.lineTo(x + 54, 68);
  ctx.lineTo(x - 54, 68);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 250, 225, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x, 68, 54, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // The belt, held aloft over his head
  const belt = championBelt(pose, time);
  drawBeltPlate(ctx, belt.x, belt.y, belt.halfWidth / 15);
}

/**
 * The Pro Wrestler: a red singlet with one strap over the shoulder, the
 * championship belt round his waist, a headband and taped wrists. Every hit
 * flicks a few drops of sweat off him.
 */
function drawWrestlerOutfit(ctx: Ctx, pose: SkeletonPose, tier: FighterTier, facing: 1 | -1) {
  const c = pose.chest;
  const p = pose.pelvis;
  const sx = p.x - c.x;
  const sy = p.y - c.y;
  const sl = Math.hypot(sx, sy) || 1;
  const nx = -sy / sl;
  const ny = sx / sl;
  const along = (t: number, side: number) => ({ x: c.x + sx * t + nx * side, y: c.y + sy * t + ny * side });
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Singlet: from mid-chest to the hips
  const a = along(0.35, 9);
  const b = along(0.35, -9);
  const d = along(1.08, -7);
  const e = along(1.08, 7);
  ctx.fillStyle = '#b3122a';
  ctx.strokeStyle = tier.color;
  ctx.lineWidth = 1.2;
  ctx.shadowColor = '#ff3355';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(d.x, d.y);
  ctx.lineTo(e.x, e.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // One strap up over the front shoulder
  ctx.strokeStyle = '#b3122a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const strapFrom = facing > 0 ? a : b;
  ctx.moveTo(strapFrom.x, strapFrom.y);
  ctx.lineTo(pose.leftShoulder.x, pose.leftShoulder.y);
  ctx.stroke();
  // The championship belt round his waist
  ctx.shadowBlur = 0;
  const waist = along(0.86, 0);
  ctx.save();
  ctx.translate(waist.x, waist.y);
  ctx.rotate(Math.atan2(ny, nx) - Math.PI / 2);
  drawBeltPlate(ctx, 0, 0, 0.62);
  ctx.restore();
  // Headband
  const h = pose.head;
  ctx.strokeStyle = '#ff3355';
  ctx.shadowColor = '#ff3355';
  ctx.shadowBlur = 6;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(h.x, h.y, 9.3, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(h.x - facing * 8, h.y - 3);
  ctx.lineTo(h.x - facing * 15, h.y + 2);
  ctx.moveTo(h.x - facing * 8, h.y - 3);
  ctx.lineTo(h.x - facing * 14, h.y + 6);
  ctx.stroke();
  // White tape round both wrists
  ctx.strokeStyle = '#f4f4f8';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 4;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  for (const [hand, elbow] of [
    [pose.leftHand, pose.leftElbow],
    [pose.rightHand, pose.rightElbow],
  ] as const) {
    const dx = hand.x - elbow.x;
    const dy = hand.y - elbow.y;
    const l = Math.hypot(dx, dy) || 1;
    ctx.moveTo(hand.x - (dx / l) * 6, hand.y - (dy / l) * 6);
    ctx.lineTo(hand.x - (dx / l) * 2, hand.y - (dy / l) * 2);
  }
  ctx.stroke();
  // Sweat flying off him on every hit
  if (pose.bladeSlash) {
    ctx.fillStyle = '#a8e6ff';
    ctx.shadowColor = '#a8e6ff';
    ctx.shadowBlur = 6;
    for (const [ox, oy, r] of [
      [-12, -10, 1.8],
      [-17, -2, 1.4],
      [-8, -16, 1.3],
    ]) {
      ctx.beginPath();
      ctx.ellipse(h.x + ox * facing, h.y + oy, r * 0.75, r * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A folding steel chair, folded flat, gripped in both hands and swung seat-first. */
function drawSteelChair(ctx: Ctx, pose: SkeletonPose, facing: 1 | -1) {
  const { lead, rear } = arms(pose, facing);
  const dx = lead.hand.x - rear.hand.x;
  const dy = lead.hand.y - rear.hand.y;
  const l = Math.hypot(dx, dy);
  const d = l > 3 ? { x: dx / l, y: dy / l } : weaponAt(lead.hand, lead.elbow, 1).dir;
  const n = { x: -d.y, y: d.x };
  const base = { x: lead.hand.x + d.x * 2, y: lead.hand.y + d.y * 2 };
  const corner = (along: number, across: number) => ({ x: base.x + d.x * along + n.x * across, y: base.y + d.y * along + n.y * across });
  ctx.save();
  ctx.lineJoin = 'round';
  // The folded seat and back: one flat slab of steel
  const pts = [corner(0, -6), corner(28, -6), corner(28, 6), corner(0, 6)];
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const q of pts.slice(1)) ctx.lineTo(q.x, q.y);
  ctx.closePath();
  ctx.fillStyle = '#9aa3b8';
  ctx.strokeStyle = '#05050c';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fill();
  ctx.strokeStyle = '#e6eaf7';
  ctx.shadowColor = '#c8d2ff';
  ctx.shadowBlur = 6;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Folded legs along the back edge
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#5a6278';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const l1 = corner(4, 2);
  const l2 = corner(26, 2);
  ctx.moveTo(l1.x, l1.y);
  ctx.lineTo(l2.x, l2.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * The feathers of the Prima Ballerina's swan tutu (her top-level form): two
 * layers fanned out round her hips, each feather's base and tip. They
 * flutter gently with time.
 */
export function swanTutuFeathers(pose: SkeletonPose, time: number) {
  const c = pose.chest;
  const p = pose.pelvis;
  // Along the spine (down) and across the hips
  const sx = p.x - c.x;
  const sy = p.y - c.y;
  const sl = Math.hypot(sx, sy) || 1;
  const down = { x: sx / sl, y: sy / sl };
  const across = { x: -down.y, y: down.x };
  const centre = { x: p.x - down.x * 3, y: p.y - down.y * 3 };
  const feathers: { base: Point2D; tip: Point2D; layer: number }[] = [];
  for (const [layer, count, length] of [
    [0, 13, 36],
    [1, 11, 24],
  ] as const) {
    for (let i = 0; i < count; i++) {
      // Spread from one side across to the other, sweeping slightly down
      const u = (i / (count - 1)) * 2 - 1;
      const flutter = Math.sin(time * 6 + i * 1.7 + layer) * 3;
      const dirX = across.x * u * 1.0 + down.x * (0.35 + 0.25 * (1 - Math.abs(u)));
      const dirY = across.y * u * 1.0 + down.y * (0.35 + 0.25 * (1 - Math.abs(u)));
      const dl = Math.hypot(dirX, dirY) || 1;
      const base = { x: centre.x + across.x * u * 5, y: centre.y + across.y * u * 5 };
      feathers.push({
        base,
        tip: { x: base.x + (dirX / dl) * length + across.x * flutter, y: base.y + (dirY / dl) * length + across.y * flutter },
        layer,
      });
    }
  }
  return feathers;
}

/** One feather: a long pointed leaf from base to tip, with a quill down the middle. */
function drawFeather(ctx: Ctx, base: Point2D, tip: Point2D, width: number) {
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const l = Math.hypot(dx, dy) || 1;
  const n = { x: -dy / l, y: dx / l };
  const mid = { x: base.x + dx * 0.45, y: base.y + dy * 0.45 };
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.quadraticCurveTo(mid.x + n.x * width, mid.y + n.y * width, tip.x, tip.y);
  ctx.quadraticCurveTo(mid.x - n.x * width, mid.y - n.y * width, base.x, base.y);
  ctx.fill();
  ctx.stroke();
}

/**
 * The Prima Ballerina: a hair bun and pointe shoes with crossed ribbons, and
 * a pink tutu, which in her top-level form becomes a huge swan tutu of white
 * feathers with a feather crown. She kicks up a puff of dust when she lands
 * in a deep plié.
 */
function drawBallerinaOutfit(ctx: Ctx, pose: SkeletonPose, tier: FighterTier, facing: 1 | -1, time: number) {
  const c = pose.chest;
  const p = pose.pelvis;
  const h = pose.head;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (tier.ascended) {
    // Swan tutu: two layers of white feathers fanned round her hips
    const feathers = swanTutuFeathers(pose, time);
    ctx.shadowColor = '#cfe6ff';
    ctx.shadowBlur = 14;
    for (const layer of [0, 1]) {
      ctx.fillStyle = layer === 0 ? '#e9f1ff' : '#ffffff';
      ctx.strokeStyle = layer === 0 ? '#a9c4ef' : '#d6e4fb';
      ctx.lineWidth = 0.9;
      for (const f of feathers) if (f.layer === layer) drawFeather(ctx, f.base, f.tip, layer === 0 ? 5 : 4);
    }
    // Feather crown on top of her head
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#a9c4ef';
    for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) {
      const base = { x: h.x + Math.sin(a) * 8, y: h.y - Math.cos(a) * 8 };
      drawFeather(ctx, base, { x: h.x + Math.sin(a) * 17, y: h.y - Math.cos(a) * 17 }, 2.2);
    }
  } else {
    // Pink tutu: a short stiff disc of net round the hips
    const sx = p.x - c.x;
    const sy = p.y - c.y;
    const angle = Math.atan2(sy, sx) - Math.PI / 2;
    ctx.save();
    ctx.translate(p.x - (sx / (Math.hypot(sx, sy) || 1)) * 3, p.y - (sy / (Math.hypot(sx, sy) || 1)) * 3);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(255, 143, 209, 0.75)';
    ctx.strokeStyle = '#ffc6e8';
    ctx.shadowColor = '#ff8fd1';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 2, 20, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Pleats of net
    ctx.shadowBlur = 0;
    ctx.beginPath();
    for (let i = -3; i <= 3; i++) {
      ctx.moveTo(i * 2, 0);
      ctx.lineTo(i * 5.6, 5);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Hair in a neat bun at the back of the head
  ctx.shadowBlur = 4;
  ctx.shadowColor = tier.color;
  ctx.fillStyle = '#2a1a14';
  ctx.strokeStyle = tier.color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(h.x - facing * 0.5, h.y - 1, 9.6, Math.PI * 1.1, Math.PI * 1.9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(h.x - facing * 8, h.y - 6, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Pointe shoes: pink ribbons criss-crossed up the ankles
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ff8fd1';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const [knee, foot] of [
    [pose.leftKnee, pose.leftFoot],
    [pose.rightKnee, pose.rightFoot],
  ] as const) {
    const dx = knee.x - foot.x;
    const dy = knee.y - foot.y;
    const l = Math.hypot(dx, dy) || 1;
    const u = { x: dx / l, y: dy / l };
    const n = { x: -u.y, y: u.x };
    for (const [a, b] of [
      [2, 7],
      [7, 2],
    ]) {
      ctx.moveTo(foot.x + u.x * a + n.x * 2.4, foot.y + u.y * a + n.y * 2.4);
      ctx.lineTo(foot.x + u.x * b - n.x * 2.4, foot.y + u.y * b - n.y * 2.4);
    }
  }
  ctx.stroke();

  // A puff of dust as she lands in a deep plié, both feet down
  if (p.y >= 22 && pose.leftFoot.y > 67 && pose.rightFoot.y > 67) {
    ctx.fillStyle = 'rgba(230, 220, 240, 0.35)';
    for (const foot of [pose.leftFoot, pose.rightFoot]) {
      for (const [ox, oy, r] of [
        [-5, -2, 3.5],
        [0, -4, 4.5],
        [5, -2, 3.5],
      ]) {
        ctx.beginPath();
        ctx.arc(foot.x + ox, foot.y + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** Spin blur: soft pink swoosh rings round her body while she turns. */
function drawSpinBlur(ctx: Ctx, pose: SkeletonPose) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 143, 209, 0.55)';
  ctx.shadowColor = '#ff8fd1';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 2;
  for (const [y, rx] of [
    [pose.chest.y + 2, 22],
    [pose.pelvis.y + 4, 26],
  ]) {
    ctx.beginPath();
    ctx.ellipse(pose.pelvis.x, y, rx, 5, 0, Math.PI * 0.15, Math.PI * 1.1);
    ctx.stroke();
  }
  ctx.restore();
}

/** How much longer the Prima Ballerina's arms are drawn than the standard skeleton's. */
export const BALLERINA_ARM_SCALE = 1.3;

/**
 * The Prima Ballerina has long dancer's arms. The skeleton (and so every
 * pose, blend and timing) keeps the standard arm length; only the drawing
 * stretches each arm out from its shoulder. With standard arms, hands joined
 * above her head sat right on top of it, as if she were holding her head;
 * stretched, they meet well clear of it and the elbows loop out wide.
 */
export function ballerinaArms(pose: SkeletonPose): SkeletonPose {
  const stretch = (shoulder: Point2D, p: Point2D) => ({
    x: shoulder.x + (p.x - shoulder.x) * BALLERINA_ARM_SCALE,
    y: shoulder.y + (p.y - shoulder.y) * BALLERINA_ARM_SCALE,
  });
  return {
    ...pose,
    leftElbow: stretch(pose.leftShoulder, pose.leftElbow),
    leftHand: stretch(pose.leftShoulder, pose.leftHand),
    rightElbow: stretch(pose.rightShoulder, pose.rightElbow),
    rightHand: stretch(pose.rightShoulder, pose.rightHand),
  };
}

/** Where Baba Yaga's gold coin halo sits and how wide it looks as it spins (1 = face on). */
export function coinHalo(pose: SkeletonPose, time: number) {
  return {
    center: { x: pose.head.x, y: pose.head.y + 8 },
    radius: 34,
    // Spinning round its vertical axis, but never quite edge-on so it never vanishes
    squash: Math.max(0.2, Math.abs(Math.cos(time * 1.4))),
  };
}

/**
 * Baba Yaga's top-level form: a huge gold assassin's coin spinning slowly
 * behind his head and shoulders like a halo. A milled rim, an inner ring and
 * a crossed-pistols mark. Flat shapes only, about the cost of the wings.
 * (His suit also gets gold trim, see drawBabaYagaOutfit.)
 */
function drawGoldCoinHalo(ctx: Ctx, pose: SkeletonPose, time: number) {
  const { center: c, radius: r, squash } = coinHalo(pose, time);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(squash, 1);
  ctx.globalAlpha *= 0.9;
  // Face of the coin
  ctx.fillStyle = '#9a6a10';
  ctx.strokeStyle = '#ffd34d';
  ctx.shadowColor = '#ffb000';
  ctx.shadowBlur = 22;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Milled edge: ticks between the rim and the inner ring
  ctx.strokeStyle = '#ffe9a0';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    ctx.moveTo(Math.cos(t) * (r - 2), Math.sin(t) * (r - 2));
    ctx.lineTo(Math.cos(t) * (r - 7), Math.sin(t) * (r - 7));
  }
  ctx.stroke();
  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, r - 9, 0, Math.PI * 2);
  ctx.stroke();
  // Crossed pistols in the middle
  ctx.strokeStyle = '#ffe9a0';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(side * -13, 11);
    ctx.lineTo(side * 11, -11);
    // grip
    ctx.moveTo(side * -13, 11);
    ctx.lineTo(side * -17, 5);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Baba Yaga's suit, kept simple so it reads at game size: a dark jacket over
 * the torso, a white collar V and slicked-back hair. Gold-trimmed in his
 * top-level form, to match the coin halo.
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
  const trim = tier.ascended ? '#ffc23a' : tier.color;
  ctx.fillStyle = '#0b0b12';
  ctx.strokeStyle = trim;
  ctx.lineWidth = tier.ascended ? 2 : 1.2;
  ctx.shadowColor = trim;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(c.x + nx * 10, c.y + ny * 10);
  ctx.lineTo(c.x - nx * 10, c.y - ny * 10);
  ctx.lineTo(p.x - nx * 6.5 + (sx / sl) * 3, p.y - ny * 6.5 + (sy / sl) * 3);
  ctx.lineTo(p.x + nx * 6.5 + (sx / sl) * 3, p.y + ny * 6.5 + (sy / sl) * 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // White shirt collar V (gold lapels in his top-level form)
  ctx.shadowBlur = 0;
  const v = along(0.3);
  ctx.strokeStyle = tier.ascended ? '#ffd34d' : '#f2f2f7';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(c.x - 4, c.y - 1);
  ctx.lineTo(v.x, v.y);
  ctx.lineTo(c.x + 4, c.y - 1);
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
  ctx.restore();
}

/** Barrel lengths past the hand. Big on purpose: the guns must read at game size. */
const PISTOL_LENGTH = 18;
const SHOTGUN_LENGTH = 32;

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
  return weaponAt(arm.hand, arm.elbow, pose.prop === 'shotgun' ? SHOTGUN_LENGTH : PISTOL_LENGTH).muzzle;
}

/**
 * Pistol(s), shotgun or pencil. The bullet streak is the pose's trail and
 * the flash is drawShotFlash. In the top-level form a red laser sight runs
 * out from the lead gun.
 */
function drawHandWeapons(ctx: Ctx, pose: SkeletonPose, facing: 1 | -1, laser: boolean) {
  const { lead, rear } = arms(pose, facing);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  /** Stroke the current path with a dark outline, then bright on top, so it stands out from the neon body. */
  const outlined = (width: number, color: string) => {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#05050c';
    ctx.lineWidth = width + 3;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.lineWidth = width;
    ctx.stroke();
  };

  if (pose.prop === 'pencil') {
    const { dir, muzzle: tip } = weaponAt(lead.hand, lead.elbow, 13);
    ctx.beginPath();
    ctx.moveTo(lead.hand.x - dir.x * 3, lead.hand.y - dir.y * 3);
    ctx.lineTo(tip.x, tip.y);
    outlined(3, '#ffd23f');
    ctx.restore();
    return;
  }

  const pistol = (hand: Point2D, elbow: Point2D) => {
    const { dir, muzzle } = weaponAt(hand, elbow, PISTOL_LENGTH);
    ctx.beginPath();
    ctx.moveTo(hand.x - dir.x * 2, hand.y - dir.y * 2);
    ctx.lineTo(muzzle.x, muzzle.y);
    // Grip, hanging below the slide
    ctx.moveTo(hand.x, hand.y);
    ctx.lineTo(hand.x - dir.x * 3 - dir.y * 8, hand.y - dir.y * 3 + dir.x * 8);
    outlined(6, '#e6eaf7');
  };
  const gunLength = pose.prop === 'shotgun' ? SHOTGUN_LENGTH : PISTOL_LENGTH;
  const { dir, muzzle } = weaponAt(lead.hand, lead.elbow, gunLength);
  if (pose.prop === 'shotgun') {
    ctx.beginPath();
    ctx.moveTo(lead.hand.x - dir.x * 24, lead.hand.y - dir.y * 24 + 3);
    ctx.lineTo(lead.hand.x - dir.x * 13, lead.hand.y - dir.y * 13);
    ctx.lineTo(muzzle.x, muzzle.y);
    outlined(6, '#e6eaf7');
    // Wooden pump grip under the barrel
    ctx.beginPath();
    ctx.moveTo(lead.hand.x + dir.x * 4 - dir.y * 3, lead.hand.y + dir.y * 4 + dir.x * 3);
    ctx.lineTo(lead.hand.x + dir.x * 14 - dir.y * 3, lead.hand.y + dir.y * 14 + dir.x * 3);
    outlined(5, '#b8875a');
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

  ctx.restore();
}

/**
 * The muzzle flash for a pose that fires: a bold white starburst at the
 * muzzle and a white core down the tracer. Drawn AFTER the slash
 * crescent (the bullet streak), or the streak would cover it.
 */
export function drawShotFlash(ctx: Ctx, pose: SkeletonPose, facing: 1 | -1) {
  ctx.save();
  const m = muzzlePoint(pose, facing);
  if (m && pose.bladeSlash) {
    const e = pose.bladeSlash.end;
    const a = Math.atan2(e.y - m.y, e.x - m.x);
    const big = pose.prop === 'shotgun' ? 1.5 : 1;
    // White core down the tracer
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = '#ffd27a';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();
    // Starburst: a glowing orange disc with eight white spikes, the longest pointing down the barrel
    ctx.fillStyle = 'rgba(255, 170, 60, 0.85)';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 9 * big, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = (i % 2 === 1 ? 4 : i === 0 ? 24 : 14) * big;
      const t = a + (i * Math.PI) / 8;
      ctx.lineTo(m.x + Math.cos(t) * r, m.y + Math.sin(t) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** The One's ripple rings where a strike lands: two thin ellipses round the end of the trail. */
export function drawImpactRipple(ctx: Ctx, pose: SkeletonPose) {
  const e = pose.bladeSlash?.end;
  if (!e) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(160, 255, 190, 0.8)';
  ctx.shadowColor = '#39ff6a';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(e.x, e.y, 6, 14, 0, 0, Math.PI * 2);
  ctx.moveTo(e.x + 11, e.y);
  ctx.ellipse(e.x, e.y, 11, 24, 0, 0, Math.PI * 2);
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
