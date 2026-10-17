import { LIMB_WIDTH } from '../game/bodyProportions';

/**
 * "Solid neon" body drawing, shared by the player, every enemy and the debris
 * they break into, so all characters look like they belong to one world.
 *
 * Each limb is a thick capsule: a dark fill tinted with the character's colour,
 * wrapped in a glowing neon outline. The torso is a wedge (broad shoulders,
 * narrow waist). Limbs on the far side of the body are drawn first and a bit
 * dimmer, which gives a sense of depth.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface BodyJoints {
  head: Pt;
  chest: Pt;
  pelvis: Pt;
  nearShoulder: Pt;
  nearElbow: Pt;
  nearHand: Pt;
  farShoulder: Pt;
  farElbow: Pt;
  farHand: Pt;
  nearHip: Pt;
  nearKnee: Pt;
  nearFoot: Pt;
  farHip: Pt;
  farKnee: Pt;
  farFoot: Pt;
}

export interface BodyStyle {
  /** Neon outline colour (#rrggbb) */
  color: string;
  /** Glow strength for the outline */
  glow: number;
  /** Half-width of the shoulders and waist on the torso wedge */
  shoulderHalf: number;
  waistHalf: number;
  /** Multiplies every limb's thickness (heavies are chunkier) */
  limbScale: number;
  /** Draw as a solid white silhouette (the instant an enemy is struck) */
  flash?: boolean;
}


type Ctx = CanvasRenderingContext2D;

function parseHex(hex: string): [number, number, number] | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/** Blend two #rrggbb colours. t = 0 gives `a`, t = 1 gives `b`. Returns #rrggbb. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  const k = Math.min(1, Math.max(0, t));
  const out = ca.map((v, i) => Math.round(v + (cb[i] - v) * k));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Dark body fill tinted with the character's colour (about 14% of the colour over near-black). */
export function bodyFill(color: string): string {
  return mixHex('#07081a', color, 0.14);
}

/** Dimmer outline for limbs on the far side of the body. */
export function farColor(color: string): string {
  return mixHex(color, '#07081a', 0.38);
}

/** One limb segment: glowing outline capsule with a dark core. */
export function neonLimb(ctx: Ctx, a: Pt, b: Pt, width: number, outline: string, fill: string, glow: number) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = outline;
  ctx.shadowColor = outline;
  ctx.shadowBlur = glow;
  ctx.lineWidth = width + 3;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = fill;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

/** Wedge-shaped torso following the spine from pelvis to chest. */
function neonTorso(ctx: Ctx, j: BodyJoints, s: BodyStyle, outline: string, fill: string) {
  const ax = j.chest.x - j.pelvis.x;
  const ay = j.chest.y - j.pelvis.y;
  const len = Math.hypot(ax, ay) || 1;
  const ux = ax / len;
  const uy = ay / len;
  const nx = -uy;
  const ny = ux;
  // Front-facing poses spread the shoulders; make the chest at least that wide.
  const shoulderSpan = Math.hypot(j.nearShoulder.x - j.farShoulder.x, j.nearShoulder.y - j.farShoulder.y) / 2 + 3;
  const sh = Math.max(s.shoulderHalf, shoulderSpan);
  const top = { x: j.chest.x + ux * 5, y: j.chest.y + uy * 5 };

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(top.x + nx * sh, top.y + ny * sh);
  ctx.lineTo(top.x - nx * sh, top.y - ny * sh);
  ctx.lineTo(j.pelvis.x - nx * s.waistHalf, j.pelvis.y - ny * s.waistHalf);
  ctx.lineTo(j.pelvis.x + nx * s.waistHalf, j.pelvis.y + ny * s.waistHalf);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.shadowColor = outline;
  ctx.shadowBlur = s.glow;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // Thin energy line down the middle of the chest
  if (!s.flash) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(j.chest.x, j.chest.y);
    ctx.lineTo((j.chest.x + j.pelvis.x) / 2, (j.chest.y + j.pelvis.y) / 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Far limbs, torso, then near limbs. Heads are drawn separately with neonHead. */
export function drawNeonBody(ctx: Ctx, j: BodyJoints, s: BodyStyle) {
  const outline = s.flash ? '#ffffff' : s.color;
  const fill = s.flash ? '#ffffff' : bodyFill(s.color);
  const far = s.flash ? '#ffffff' : farColor(s.color);
  const w = (k: keyof typeof LIMB_WIDTH) => LIMB_WIDTH[k] * s.limbScale;
  const dim = s.glow * 0.6;

  neonLimb(ctx, j.farHip, j.farKnee, w('thigh'), far, fill, dim);
  neonLimb(ctx, j.farKnee, j.farFoot, w('shin'), far, fill, dim);
  neonLimb(ctx, j.farShoulder, j.farElbow, w('upperArm'), far, fill, dim);
  neonLimb(ctx, j.farElbow, j.farHand, w('forearm'), far, fill, dim);

  neonTorso(ctx, j, s, outline, fill);

  neonLimb(ctx, j.nearHip, j.nearKnee, w('thigh'), outline, fill, s.glow);
  neonLimb(ctx, j.nearKnee, j.nearFoot, w('shin'), outline, fill, s.glow);
  neonLimb(ctx, j.nearShoulder, j.nearElbow, w('upperArm'), outline, fill, s.glow);
  neonLimb(ctx, j.nearElbow, j.nearHand, w('forearm'), outline, fill, s.glow);
}

/** Solid head: dark tinted fill with a glowing outline. */
export function neonHead(ctx: Ctx, c: Pt, r: number, s: Pick<BodyStyle, 'color' | 'glow' | 'flash'>) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fillStyle = s.flash ? '#ffffff' : bodyFill(s.color);
  ctx.fill();
  ctx.strokeStyle = s.flash ? '#ffffff' : s.color;
  ctx.shadowColor = s.color;
  ctx.shadowBlur = s.glow;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.restore();
}

/** Filled armour/gear shape: dark tinted fill, neon outline. */
export function neonShape(ctx: Ctx, points: Pt[], outline: string, glow: number, flash = false) {
  if (points.length < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.fillStyle = flash ? '#ffffff' : bodyFill(outline);
  ctx.fill();
  ctx.strokeStyle = flash ? '#ffffff' : outline;
  ctx.shadowColor = outline;
  ctx.shadowBlur = glow;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}
