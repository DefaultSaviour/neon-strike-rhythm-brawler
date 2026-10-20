/**
 * The stage in front of the backdrop: the two conveyor belts and the pit in
 * the middle, styled to match the chosen floor (see backdrops). Whatever the
 * style, the parts that matter for play never change: the left belt's edges
 * are cyan and the right belt's pink (which side is which), the chevrons show
 * which way the belts run, and the cyan catwalk the fighter stands on spans
 * the pit. Surfaces stay dark so fighters, enemies and debris stand out.
 *
 * Drawn in world units (the floor line is at y = FLOOR_Y).
 */

type Ctx = CanvasRenderingContext2D;

export interface StageFrame {
  ctx: Ctx;
  halfW: number;
  /** World y of the back edge of the belts */
  top: number;
  /** World y of the front edge of the belts */
  front: number;
  /** World y of the bottom of the screen */
  worldBottom: number;
  pitRadius: number;
  /** How far the belts have moved (world units) */
  conveyorOffset: number;
  pulse: number;
}

interface StageStyle {
  /** Belt surface gradients, back to front: left belt, right belt */
  left: [string, string];
  right: [string, string];
  /** Front face of the machine below the belts, top to bottom */
  face: [string, string];
  /** Texture drawn on each belt surface (moves with the belt) */
  texture?: (f: StageFrame, x0: number, x1: number, dir: 1 | -1) => void;
  /** The pit: its void (top, middle, glow at the bottom as rgb) and its walls */
  pitVoid: [string, string, string];
  pitWall: string;
  /** What lines the inside of the pit */
  pitInside: (f: StageFrame) => void;
}

/** Repeating marks across a belt, moving with it: `draw(x)` for each position. */
function alongBelt(f: StageFrame, x0: number, x1: number, dir: 1 | -1, spacing: number, draw: (x: number) => void) {
  const shift = ((f.conveyorOffset % spacing) + spacing) % spacing;
  for (let x = x0 - spacing + (dir > 0 ? shift : spacing - shift); x < x1 + spacing; x += spacing) {
    if (x < x0 || x > x1) continue;
    draw(x);
  }
}

/** Horizontal rungs down the inside of the pit. */
function pitRungs(f: StageFrame, color: string, gap = 14) {
  const { ctx, pitRadius } = f;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let y = f.front - 8; y < f.worldBottom; y += gap) {
    ctx.beginPath();
    ctx.moveTo(-pitRadius + 4, y);
    ctx.lineTo(pitRadius - 4, y);
    ctx.stroke();
  }
}

const STYLES: Record<string, StageStyle> = {
  // The original: dark blue and plum belts over a hazard-striped pit with a pink glow
  grid: {
    left: ['#0a0d24', '#10163c'],
    right: ['#1c0a1a', '#2c0f29'],
    face: ['#0b0c1c', '#040510'],
    pitVoid: ['#020208', '#080518', '255, 0, 127'],
    pitWall: '#ffe600',
    pitInside: (f) => pitRungs(f, 'rgba(255, 230, 0, 0.22)'),
  },
  // Wooden dock planks over a dark pool
  water: {
    left: ['#0d1420', '#141c2b'],
    right: ['#16121f', '#1e1829'],
    face: ['#081019', '#03060b'],
    texture: (f, x0, x1, dir) =>
      alongBelt(f, x0, x1, dir, 14, (x) => {
        f.ctx.strokeStyle = 'rgba(150, 120, 90, 0.18)';
        f.ctx.lineWidth = 1;
        f.ctx.beginPath();
        f.ctx.moveTo(x, f.top + 1);
        f.ctx.lineTo(x, f.front - 1);
        f.ctx.stroke();
      }),
    pitVoid: ['#020711', '#041426', '60, 140, 220'],
    pitWall: '#4a6488', // darker than the blue hero and cyan enemies
    pitInside: (f) => {
      // Slow ripples across the pool
      const { ctx, pitRadius } = f;
      const t = performance.now() / 1000;
      ctx.strokeStyle = 'rgba(120, 180, 240, 0.18)';
      ctx.lineWidth = 1;
      for (let y = f.front - 4; y < f.worldBottom; y += 12) {
        ctx.beginPath();
        for (let x = -pitRadius + 4; x <= pitRadius - 4; x += 4) ctx.lineTo(x, y + Math.sin(x * 0.3 + t * 2 + y) * 1.5);
        ctx.stroke();
      }
    },
  },
  // Hex-plated belts over a violet energy shaft
  hex: {
    left: ['#0b0a22', '#120f33'],
    right: ['#1a0a24', '#241032'],
    face: ['#0a0919', '#04040d'],
    texture: (f, x0, x1, dir) =>
      alongBelt(f, x0, x1, dir, 18, (x) => {
        const { ctx } = f;
        const cy = (f.top + f.front) / 2;
        const r = (f.front - f.top) * 0.42;
        ctx.strokeStyle = 'rgba(160, 110, 255, 0.16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k;
          ctx.lineTo(x + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.stroke();
      }),
    pitVoid: ['#04020c', '#0d0620', '150, 80, 255'],
    pitWall: '#5e4a9e', // darker than the purple enemies
    pitInside: (f) => pitRungs(f, 'rgba(170, 130, 255, 0.2)', 10),
  },
  // Riveted steel belts over a chrome shaft
  checker: {
    left: ['#12141c', '#1b1e29'],
    right: ['#1a141c', '#241c27'],
    face: ['#0d0e14', '#050508'],
    texture: (f, x0, x1, dir) =>
      alongBelt(f, x0, x1, dir, 22, (x) => {
        const { ctx } = f;
        ctx.strokeStyle = 'rgba(190, 200, 220, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, f.top + 1);
        ctx.lineTo(x, f.front - 1);
        ctx.stroke();
        ctx.fillStyle = 'rgba(200, 210, 230, 0.22)';
        ctx.fillRect(x + 3, f.top + 3, 1.4, 1.4);
        ctx.fillRect(x + 3, f.front - 4.4, 1.4, 1.4);
      }),
    pitVoid: ['#050507', '#0e0f15', '170, 180, 200'],
    pitWall: '#7f879a', // duller than the pale-blue enemies
    pitInside: (f) => pitRungs(f, 'rgba(190, 200, 220, 0.2)', 9),
  },
  // Basalt belts with faint lava seams, over a pit of magma
  lava: {
    left: ['#120b0b', '#1a0f0e'],
    right: ['#180b0e', '#221012'],
    face: ['#0e0707', '#050202'],
    texture: (f, x0, x1, dir) =>
      alongBelt(f, x0, x1, dir, 26, (x) => {
        const { ctx } = f;
        ctx.strokeStyle = `rgba(150, 50, 18, ${0.25 + f.pulse * 0.15})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, f.top + 1);
        ctx.lineTo(x + 4, (f.top + f.front) / 2);
        ctx.lineTo(x - 2, f.front - 1);
        ctx.stroke();
      }),
    pitVoid: ['#080202', '#1a0603', '200, 70, 20'],
    pitWall: '#7a2e14', // darker than the red and orange enemies
    pitInside: (f) => {
      // Bubbles of magma rising in the pit
      const { ctx, pitRadius } = f;
      const t = performance.now() / 1000;
      ctx.fillStyle = 'rgba(190, 70, 25, 0.35)';
      for (let i = 0; i < 6; i++) {
        const x = -pitRadius + 8 + ((i * 37) % (pitRadius * 2 - 16));
        const rise = (t * 12 + i * 23) % (f.worldBottom - f.front);
        ctx.beginPath();
        ctx.arc(x, f.worldBottom - rise, 1.6 + (i % 3) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
};

/** The stage styles that exist, by floor id. */
export const STAGE_STYLE_IDS = Object.keys(STYLES);

/** The two conveyor belts, styled for this floor. */
export function drawConveyors(f: StageFrame, floor: string) {
  const style = STYLES[floor] ?? STYLES.grid;
  const { ctx, halfW, top, front, worldBottom, pitRadius, pulse } = f;
  ctx.save();

  // Belt surfaces
  for (const side of [-1, 1] as const) {
    const [back, near] = side < 0 ? style.left : style.right;
    const g = ctx.createLinearGradient(0, top, 0, front);
    g.addColorStop(0, back);
    g.addColorStop(1, near);
    ctx.fillStyle = g;
    ctx.fillRect(side < 0 ? -halfW : pitRadius, top, halfW - pitRadius, front - top);
  }

  // Front face of the machine below the belts
  const faceGrad = ctx.createLinearGradient(0, front, 0, worldBottom);
  faceGrad.addColorStop(0, style.face[0]);
  faceGrad.addColorStop(1, style.face[1]);
  ctx.fillStyle = faceGrad;
  ctx.fillRect(-halfW, front, halfW - pitRadius, worldBottom - front);
  ctx.fillRect(pitRadius, front, halfW - pitRadius, worldBottom - front);

  // The floor's own texture on each belt, moving with it (left runs right, right runs left)
  if (style.texture) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-halfW, top, halfW - pitRadius, front - top);
    ctx.clip();
    style.texture(f, -halfW, -pitRadius, 1);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(pitRadius, top, halfW - pitRadius, front - top);
    ctx.clip();
    style.texture(f, pitRadius, halfW, -1);
    ctx.restore();
  }

  // Rails: always cyan on the left and pink on the right, glowing brighter on every beat
  ctx.lineWidth = 1.6;
  ctx.shadowBlur = 8 + pulse * 14;
  for (const side of [-1, 1]) {
    const color = side < 0 ? '#00f3ff' : '#ff007f';
    const x0 = side < 0 ? -halfW : pitRadius;
    const x1 = side < 0 ? -pitRadius : halfW;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(x1, top);
    ctx.moveTo(x0, front);
    ctx.lineTo(x1, front);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Moving chevrons show which way the belts run
  const segment = 40;
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = `rgba(0, 243, 255, ${0.16 + pulse * 0.18})`;
  for (let x = -halfW - segment + ((f.conveyorOffset + halfW) % segment); x < -pitRadius; x += segment) {
    if (x - 8 < -halfW) continue;
    ctx.beginPath();
    ctx.moveTo(x - 8, top + 6);
    ctx.lineTo(x, (top + front) / 2);
    ctx.lineTo(x - 8, front - 6);
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(255, 0, 127, ${0.18 + pulse * 0.18})`;
  for (let x = halfW + segment - ((f.conveyorOffset + halfW) % segment); x > pitRadius; x -= segment) {
    if (x + 8 > halfW) continue;
    ctx.beginPath();
    ctx.moveTo(x + 8, top + 6);
    ctx.lineTo(x, (top + front) / 2);
    ctx.lineTo(x + 8, front - 6);
    ctx.stroke();
  }

  ctx.restore();
}

/** The pit in the middle that debris drops into, styled for this floor, with the catwalk across it. */
export function drawPit(f: StageFrame, floor: string, floorY: number) {
  const style = STYLES[floor] ?? STYLES.grid;
  const { ctx, top, worldBottom, pitRadius, pulse } = f;
  ctx.save();
  const pitVoid = ctx.createLinearGradient(0, top, 0, worldBottom);
  pitVoid.addColorStop(0, style.pitVoid[0]);
  pitVoid.addColorStop(0.6, style.pitVoid[1]);
  pitVoid.addColorStop(1, `rgba(${style.pitVoid[2]}, ${0.25 + pulse * 0.2})`);
  ctx.fillStyle = pitVoid;
  ctx.fillRect(-pitRadius, top, pitRadius * 2, worldBottom - top);

  // The walls
  ctx.strokeStyle = style.pitWall;
  ctx.shadowColor = style.pitWall;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-pitRadius, top);
  ctx.lineTo(-pitRadius, worldBottom);
  ctx.moveTo(pitRadius, top);
  ctx.lineTo(pitRadius, worldBottom);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Inside the pit
  ctx.save();
  ctx.beginPath();
  ctx.rect(-pitRadius, top, pitRadius * 2, worldBottom - top);
  ctx.clip();
  style.pitInside(f);
  ctx.restore();

  // Catwalk the fighter stands on, spanning the pit (always the same)
  ctx.strokeStyle = '#00f3ff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-pitRadius - 4, floorY + 1);
  ctx.lineTo(pitRadius + 4, floorY + 1);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.8;
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.restore();
}
