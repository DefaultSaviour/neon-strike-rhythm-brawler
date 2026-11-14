import { SkeletonPose } from '../types/game';
import { STRIKER_PARTS } from '../game/strikerParts';
import { Pt } from './neonBody';

/**
 * The Neon Striker as Gemini drew him: his parts are cut from that drawing
 * (public/fighters/striker/, see strikerParts.ts) and each is hung between the
 * two joints of its bone, so every move still works. A part is stretched along
 * its bone to the bone's length and kept the same thickness across it.
 *
 * His outline colour changes with the combo tier, so each part is recoloured
 * from Gemini's cyan into the tier's colour (the yellow visor and gem, and the
 * pink scarf, stay as drawn). Until the pictures have loaded (and in tests,
 * where there are none) fighterArt draws him the old way.
 */

type Ctx = CanvasRenderingContext2D;
type PartName = keyof typeof STRIKER_PARTS;

const NAMES = Object.keys(STRIKER_PARTS) as PartName[];
/** The colour Gemini drew him in (the first combo tier's), which needs no recolouring */
const DRAWN_COLOR = '#00f3ff';
/** World units per picture pixel across a part: his spine (about 31 units) over its length in the picture */
const ACROSS = 31 / Math.hypot(STRIKER_PARTS.torso.b[0] - STRIKER_PARTS.torso.a[0], STRIKER_PARTS.torso.b[1] - STRIKER_PARTS.torso.a[1]);

/**
 * The helmet is drawn smaller than Gemini drew it. The game's skeleton has shorter arms and legs
 * than the drawing, so at its drawn size the helmet looked too big for the body.
 */
export const HELMET_SIZE = 0.8;

/** Where the middle of the helmet is drawn: up the neck from the chest, toward the head joint. */
export function helmetCentre(pose: Pick<SkeletonPose, 'chest' | 'head'>): Pt {
  const p = STRIKER_PARTS.head;
  const up = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]) * ACROSS * HELMET_SIZE;
  const dx = pose.head.x - pose.chest.x;
  const dy = pose.head.y - pose.chest.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: pose.chest.x + (dx / len) * up, y: pose.chest.y + (dy / len) * up };
}

const images = new Map<PartName, HTMLImageElement>();
let loadedCount = 0;

function load() {
  if (typeof Image === 'undefined' || images.size > 0) return;
  for (const name of NAMES) {
    const img = new Image();
    img.onload = () => loadedCount++;
    img.src = `fighters/striker/${name}.png`;
    images.set(name, img);
  }
}
load();

/** True once every part has loaded. */
export function strikerSpritesReady(): boolean {
  return loadedCount === NAMES.length;
}

const tinted = new Map<string, HTMLCanvasElement>();

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The part in this outline colour: Gemini's cyan becomes `color`, at the same brightness. */
function partIn(name: PartName, color: string): CanvasImageSource {
  const img = images.get(name)!;
  if (color.toLowerCase() === DRAWN_COLOR) return img;
  const key = `${name}:${color}`;
  const cached = tinted.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const cx = c.getContext('2d', { willReadFrequently: true });
  if (!cx) return img;
  cx.drawImage(img, 0, 0);
  const data = cx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  const [tr, tg, tb] = hexRgb(color);
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    // Only the cyan: leave the yellow visor and gem, and the pink scarf
    if (!(g > r + 12 && b > r + 12)) continue;
    const bright = Math.max(g, b) / 255;
    const white = r / 255; // the hot white core of a neon line
    px[i] = (tr * (1 - white) + 255 * white) * bright;
    px[i + 1] = (tg * (1 - white) + 255 * white) * bright;
    px[i + 2] = (tb * (1 - white) + 255 * white) * bright;
  }
  cx.putImageData(data, 0, 0);
  tinted.set(key, c);
  return c;
}

/**
 * Draw a part between world points A and B (its joints `a` and `b` in the picture land on them).
 * `flip` mirrors it across the bone; `uniform` keeps its proportions instead of stretching it.
 */
function drawPart(ctx: Ctx, name: PartName, A: Pt, B: Pt, color: string, flip: number, uniform = false, size = 1) {
  const p = STRIKER_PARTS[name];
  const [ax, ay] = p.a;
  const [bx, by] = p.b;
  const along = uniform ? ACROSS * size : Math.hypot(B.x - A.x, B.y - A.y) / (Math.hypot(bx - ax, by - ay) || 1);
  ctx.save();
  ctx.translate(A.x, A.y);
  ctx.rotate(Math.atan2(B.y - A.y, B.x - A.x));
  ctx.scale(along, ACROSS * size * flip);
  ctx.rotate(-Math.atan2(by - ay, bx - ax));
  ctx.translate(-ax, -ay);
  ctx.drawImage(partIn(name, color), 0, 0);
  ctx.restore();
}

/** How many strips the headband is cut into along its length, so it can bend */
const BAND_STRIPS = 16;
/** Spare picture on each end of the straightened headband (pixels) */
const BAND_MARGIN = 30;
const BAND_HEIGHT = 240;

let bandCanvas: HTMLCanvasElement | null = null;

/** The headband picture turned so it runs left to right from the knot (at x = BAND_MARGIN) to the tip. */
function straightBand(): HTMLCanvasElement | null {
  if (bandCanvas) return bandCanvas;
  if (typeof document === 'undefined') return null;
  const p = STRIKER_PARTS.scarf;
  const len = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]);
  const c = document.createElement('canvas');
  c.width = Math.ceil(len + BAND_MARGIN * 2);
  c.height = BAND_HEIGHT;
  const cx = c.getContext('2d');
  if (!cx) return null;
  cx.translate(BAND_MARGIN, BAND_HEIGHT / 2);
  cx.rotate(-Math.atan2(p.b[1] - p.a[1], p.b[0] - p.a[0]));
  cx.translate(-p.a[0], -p.a[1]);
  cx.drawImage(images.get('scarf')!, 0, 0);
  bandCanvas = c;
  return c;
}

/**
 * The line the headband follows, from the knot to the tip: a smooth curve
 * through the pose's scarf points, with a wave running down it like cloth in
 * the wind. The wave is nothing at the knot and biggest at the tip.
 */
export function headbandPath(scarf: Pt[], time: number, count = BAND_STRIPS): Pt[] {
  const at = (i: number) => scarf[Math.max(0, Math.min(scarf.length - 1, i))];
  const dx = scarf[scarf.length - 1].x - scarf[0].x;
  const dy = scarf[scarf.length - 1].y - scarf[0].y;
  const len = Math.hypot(dx, dy) || 1;
  const out: Pt[] = [];
  for (let n = 0; n <= count; n++) {
    const u = n / count;
    const f = u * (scarf.length - 1);
    const i = Math.min(scarf.length - 2, Math.floor(f));
    const t = f - i;
    // Catmull-Rom through the scarf points
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const cr = (a: number, b: number, c: number, d: number) =>
      0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
    // The wave pushes across the band's overall direction
    const wave = (Math.sin(time * 9 - u * 5) * 6 + Math.sin(time * 14.5 - u * 9) * 2) * u;
    out.push({ x: cr(p0.x, p1.x, p2.x, p3.x) + (-dy / len) * wave, y: cr(p0.y, p1.y, p2.y, p3.y) + (dx / len) * wave });
  }
  return out;
}

/**
 * The headband, as drawn, flowing from the knot at the back of his head along
 * the pose's scarf and waving in the wind (behind the body). It is cut into
 * strips across its length and each strip is laid along the curve.
 */
export function drawStrikerSpriteScarf(ctx: Ctx, pose: SkeletonPose, facing: 1 | -1, time: number) {
  const s = pose.scarf;
  const band = straightBand();
  if (!s || s.length < 2 || !band) return;
  const pts = headbandPath(s, time);
  const stripPx = (band.width - BAND_MARGIN * 2) / BAND_STRIPS;
  const flip = facing > 0 ? 1 : -1;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  for (let i = 0; i < BAND_STRIPS; i++) {
    const A = pts[i];
    const B = pts[i + 1];
    // The first and last strips carry the spare picture past the knot and the tip
    const sx = i === 0 ? 0 : BAND_MARGIN + stripPx * i;
    const ex = i === BAND_STRIPS - 1 ? band.width : BAND_MARGIN + stripPx * (i + 1) + 4;
    ctx.save();
    ctx.translate(A.x, A.y);
    ctx.rotate(Math.atan2(B.y - A.y, B.x - A.x));
    ctx.scale(Math.hypot(B.x - A.x, B.y - A.y) / stripPx, ACROSS * flip);
    ctx.drawImage(band, sx, 0, ex - sx, BAND_HEIGHT, sx - (BAND_MARGIN + stripPx * i), -BAND_HEIGHT / 2, ex - sx, BAND_HEIGHT);
    ctx.restore();
  }
  ctx.restore();
}

/** The Neon Striker's body and head, in the combo tier's colour. The core gem glows with `pulse` (0..1). */
export function drawStrikerSpriteBody(ctx: Ctx, pose: SkeletonPose, color: string, gemColor: string, facing: 1 | -1, pulse: number) {
  const flip = facing > 0 ? 1 : -1;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Far side first, then the torso, then the near side over it, then the head
  drawPart(ctx, 'farThigh', pose.rightHip, pose.rightKnee, color, flip);
  drawPart(ctx, 'farShin', pose.rightKnee, pose.rightFoot, color, flip);
  drawPart(ctx, 'farUpperArm', pose.rightShoulder, pose.rightElbow, color, flip);
  drawPart(ctx, 'farForearm', pose.rightElbow, pose.rightHand, color, flip);
  drawPart(ctx, 'torso', pose.pelvis, pose.chest, color, flip);
  drawGemGlow(ctx, pose, gemColor, flip, pulse);
  drawPart(ctx, 'nearThigh', pose.leftHip, pose.leftKnee, color, flip);
  // Gemini drew the near boot's toes pointing out: turn them to the front
  drawPart(ctx, 'nearShin', pose.leftKnee, pose.leftFoot, color, -flip);
  drawPart(ctx, 'nearUpperArm', pose.leftShoulder, pose.leftElbow, color, flip);
  drawPart(ctx, 'nearForearm', pose.leftElbow, pose.leftHand, color, flip);
  // The helmet rides on the neck (so it meets the collar), leaning toward the head joint
  drawPart(ctx, 'head', pose.chest, pose.head, color, flip, true, HELMET_SIZE);
  ctx.restore();
}

/** A soft glow over the core gem, pulsing with the bass and growing with the combo. */
function drawGemGlow(ctx: Ctx, pose: SkeletonPose, gemColor: string, flip: number, pulse: number) {
  if (pulse <= 0.02) return;
  const p = STRIKER_PARTS.torso;
  const [ax, ay] = p.a;
  const [bx, by] = p.b;
  const [gx, gy] = p.gem;
  const along = Math.hypot(pose.chest.x - pose.pelvis.x, pose.chest.y - pose.pelvis.y) / (Math.hypot(bx - ax, by - ay) || 1);
  ctx.save();
  ctx.translate(pose.pelvis.x, pose.pelvis.y);
  ctx.rotate(Math.atan2(pose.chest.y - pose.pelvis.y, pose.chest.x - pose.pelvis.x));
  ctx.scale(along, ACROSS * flip);
  ctx.rotate(-Math.atan2(by - ay, bx - ax));
  ctx.translate(gx - ax, gy - ay);
  ctx.globalCompositeOperation = 'lighter';
  const r = 18 + 22 * pulse;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  const [cr, cg, cb] = hexRgb(gemColor);
  g.addColorStop(0, `rgba(${cr},${cg},${cb},${0.55 * pulse})`);
  g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
