import type { BackdropLayer } from '../game/backdrops';

/**
 * Drawing the backdrop behind the fight, one layer at a time (see
 * game/backdrops for the pieces and how they unlock). Back to front: sky,
 * centrepiece, skyline, a haze over the horizon, then the floor running down
 * to the conveyors. Everything here stays deliberately dim, small and hazy, so
 * it reads as far away and never competes with the fighters: a timing game
 * has to stay readable.
 */

type Ctx = CanvasRenderingContext2D;

export interface BackdropFrame {
  ctx: Ctx;
  width: number;
  /** Screen x of the centre of the arena */
  cx: number;
  /** Screen y of the horizon */
  hy: number;
  /** Screen pixels per world unit */
  s: number;
  /** Screen y where the floor meets the conveyors */
  beltTop: number;
  /** 1 on the beat, fading to 0 before the next */
  pulse: number;
  /** How loud the bass is right now (0..1) */
  bass: number;
  /** Seconds, for anything that moves on its own */
  time: number;
}

/** A repeatable random number source, so seeded shapes look the same every frame. */
function seeded(seed: number) {
  let n = seed;
  return () => (n = (n * 16807) % 2147483647) / 2147483647;
}

/** Shapes that depend only on the screen size are built once and reused. */
const cache = new Map<string, unknown>();
function cached<T>(key: string, f: BackdropFrame, build: () => T): T {
  const k = `${key}:${Math.round(f.width)}:${f.s.toFixed(3)}:${Math.round(f.hy)}`;
  if (!cache.has(k)) {
    if (cache.size > 40) cache.clear();
    cache.set(k, build());
  }
  return cache.get(k) as T;
}

function fillSky(f: BackdropFrame, top: string, bottom: string) {
  const g = f.ctx.createLinearGradient(0, 0, 0, f.hy);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  f.ctx.fillStyle = g;
  f.ctx.fillRect(0, 0, f.width, f.hy);
}

// ============================== SKIES ==============================

function skyDusk(f: BackdropFrame) {
  fillSky(f, '#05060f', '#1a0b2e');
  const glow = f.ctx.createRadialGradient(f.cx, f.hy, 10, f.cx, f.hy, f.width * 0.6);
  glow.addColorStop(0, `rgba(255, 0, 127, ${0.16 + f.bass * 0.08 + f.pulse * 0.05})`);
  glow.addColorStop(1, 'rgba(255, 0, 127, 0)');
  f.ctx.fillStyle = glow;
  f.ctx.fillRect(0, 0, f.width, f.hy);
}

function skyStarfield(f: BackdropFrame) {
  const { ctx } = f;
  fillSky(f, '#02030a', '#0b1030');
  const stars = cached('stars', f, () => {
    const rnd = seeded(91);
    return Array.from({ length: Math.round((f.width * f.hy) / 2500) }, () => ({ x: rnd() * f.width, y: rnd() * f.hy * 0.95, r: 0.5 + rnd() * 1.1, phase: rnd() * 6.28, rate: 0.6 + rnd() * 2 }));
  });
  ctx.save();
  for (const st of stars) {
    ctx.globalAlpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(f.time * st.rate + st.phase));
    ctx.fillStyle = '#dfe8ff';
    ctx.fillRect(st.x, st.y, st.r * 1.4, st.r * 1.4);
  }
  // A shooting star every few seconds, streaking down across the sky
  const cycle = 7;
  const t = (f.time % cycle) / 0.9;
  if (t < 1) {
    const n = Math.floor(f.time / cycle);
    const sx = ((n * 37) % 70) / 100 * f.width + f.width * 0.1;
    const x = sx + t * f.width * 0.25;
    const y = f.hy * 0.08 + t * f.hy * 0.3;
    const tail = ctx.createLinearGradient(x, y, x - 60 * f.s, y - 24 * f.s);
    tail.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    tail.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = tail;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 60 * f.s, y - 24 * f.s);
    ctx.stroke();
  }
  ctx.restore();
}

function skyAurora(f: BackdropFrame) {
  const { ctx } = f;
  fillSky(f, '#020814', '#071a22');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bands = [
    { base: 0.32, amp: 0.07, k: 0.006, speed: 0.4, color: [60, 255, 170] },
    { base: 0.45, amp: 0.06, k: 0.009, speed: -0.3, color: [170, 90, 255] },
    { base: 0.24, amp: 0.05, k: 0.004, speed: 0.25, color: [80, 220, 255] },
  ];
  for (const b of bands) {
    const step = 6 * f.s;
    for (let x = 0; x <= f.width; x += step) {
      const y = f.hy * (b.base + b.amp * Math.sin(x * b.k / f.s + f.time * b.speed));
      const len = f.hy * (0.16 + 0.06 * Math.sin(x * 0.01 + f.time));
      const g = ctx.createLinearGradient(0, y - len, 0, y + len * 0.3);
      const [r, gg, bb] = b.color;
      const a = 0.07 + f.pulse * 0.04;
      g.addColorStop(0, `rgba(${r},${gg},${bb},0)`);
      g.addColorStop(0.75, `rgba(${r},${gg},${bb},${a})`);
      g.addColorStop(1, `rgba(${r},${gg},${bb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y - len, step + 1, len * 1.3);
    }
  }
  ctx.restore();
}

function skyOcean(f: BackdropFrame) {
  const { ctx } = f;
  fillSky(f, '#00111f', '#00395a');
  ctx.save();
  // Light rays slanting down from the surface, swaying slowly
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const x = f.width * (0.1 + i * 0.16) + Math.sin(f.time * 0.4 + i) * 20 * f.s;
    const w = (18 + (i % 3) * 10) * f.s;
    ctx.fillStyle = `rgba(120, 220, 255, ${0.05 + f.pulse * 0.02})`;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + w, 0);
    ctx.lineTo(x + w * 2.5 + 30 * f.s, f.hy);
    ctx.lineTo(x + 30 * f.s, f.hy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // Bubbles drifting up
  const bubbles = cached('bubbles', f, () => {
    const rnd = seeded(7);
    return Array.from({ length: 26 }, () => ({ x: rnd() * f.width, r: (1 + rnd() * 2.5) * f.s, speed: 10 + rnd() * 25, offset: rnd() * 500 }));
  });
  ctx.strokeStyle = 'rgba(180, 235, 255, 0.35)';
  ctx.lineWidth = 1;
  for (const b of bubbles) {
    const y = f.hy - ((f.time * b.speed * f.s + b.offset * f.s) % f.hy);
    ctx.beginPath();
    ctx.arc(b.x + Math.sin(f.time + b.offset) * 4 * f.s, y, b.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function skyStorm(f: BackdropFrame) {
  const { ctx } = f;
  // Kept dark: the red UI and the red enemies have to stand out against it
  fillSky(f, '#070103', '#1e0308');
  // Heavy clouds drifting slowly
  const clouds = cached('clouds', f, () => {
    const rnd = seeded(23);
    return Array.from({ length: 14 }, () => ({ x: rnd() * f.width, y: rnd() * f.hy * 0.7, rx: (60 + rnd() * 90) * f.s, ry: (14 + rnd() * 18) * f.s, speed: 3 + rnd() * 6 }));
  });
  ctx.save();
  for (const c of clouds) {
    const x = ((c.x + f.time * c.speed * f.s) % (f.width + c.rx * 2)) - c.rx;
    ctx.fillStyle = 'rgba(48, 6, 14, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Lightning on the big beats: the sky flashes and a bolt forks down
  if (f.bass > 0.72 && f.pulse > 0.6) {
    ctx.fillStyle = `rgba(255, 210, 220, ${0.05 * f.pulse})`;
    ctx.fillRect(0, 0, f.width, f.hy);
    const rnd = seeded(1 + Math.floor(f.time * 3));
    let x = f.width * (0.15 + rnd() * 0.7);
    let y = 0;
    ctx.strokeStyle = `rgba(255, 230, 240, ${0.55 * f.pulse})`;
    ctx.shadowColor = '#ff6a8a';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    while (y < f.hy * 0.85) {
      x += (rnd() - 0.5) * 30 * f.s;
      y += (8 + rnd() * 14) * f.s;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// =========================== CENTREPIECES ===========================

function centreSun(f: BackdropFrame) {
  const { ctx, cx, hy, s } = f;
  const sunR = (34 + f.pulse * 2) * s;
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(cx, hy, sunR, Math.PI, 0);
  ctx.closePath();
  const sunGrad = ctx.createLinearGradient(0, hy - sunR, 0, hy);
  sunGrad.addColorStop(0, '#ffe600');
  sunGrad.addColorStop(0.55, '#ff007f');
  sunGrad.addColorStop(1, '#7928ca');
  ctx.fillStyle = sunGrad;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#12082a';
  for (let i = 1; i <= 5; i++) {
    ctx.fillRect(cx - sunR - 2, hy - (sunR / 6) * i, sunR * 2 + 4, (0.8 + i * 0.5) * s * 0.6);
  }
  ctx.restore();
}

function centreMoon(f: BackdropFrame) {
  const { ctx, cx, hy, s } = f;
  const r = 30 * s;
  const y = hy - 26 * s;
  ctx.save();
  const glow = ctx.createRadialGradient(cx, y, r, cx, y, r * (2.4 + f.pulse * 0.8));
  glow.addColorStop(0, `rgba(150, 165, 200, ${0.1 + f.pulse * 0.08})`);
  glow.addColorStop(1, 'rgba(150, 165, 200, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 4, y - r * 4, r * 8, r * 8);
  ctx.globalAlpha = 0.4;
  const g = ctx.createRadialGradient(cx - r * 0.3, y - r * 0.3, r * 0.1, cx, y, r);
  g.addColorStop(0, '#b9c2d8');
  g.addColorStop(1, '#6f7a96');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(110, 125, 160, 0.4)';
  for (const [dx, dy, rr] of [
    [-0.35, -0.2, 0.22],
    [0.3, 0.15, 0.16],
    [-0.05, 0.4, 0.12],
  ]) {
    ctx.beginPath();
    ctx.arc(cx + dx * r, y + dy * r, rr * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function centreSpeaker(f: BackdropFrame) {
  const { ctx, cx, hy, s } = f;
  const y = hy - 34 * s;
  const thump = 1 + f.pulse * 0.09 + f.bass * 0.04;
  const r = 32 * s;
  ctx.save();
  ctx.globalAlpha = 0.75;
  // The cabinet
  ctx.fillStyle = '#0d0b18';
  ctx.strokeStyle = 'rgba(255, 0, 127, 0.4)';
  ctx.lineWidth = 1.2;
  ctx.fillRect(cx - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6 + 34 * s);
  ctx.strokeRect(cx - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6 + 34 * s);
  // The cone, pushing out on every beat
  const cone = ctx.createRadialGradient(cx, y, r * 0.2 * thump, cx, y, r * thump);
  cone.addColorStop(0, '#2a2440');
  cone.addColorStop(0.85, '#14111f');
  cone.addColorStop(1, '#3a3155');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.arc(cx, y, r * thump, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(0, 243, 255, ${0.3 + f.pulse * 0.4})`;
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 6 + f.pulse * 12;
  ctx.lineWidth = 2;
  ctx.stroke();
  // The dust cap in the middle
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#4a3f6e';
  ctx.beginPath();
  ctx.arc(cx, y, r * 0.28 * thump, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function centrePlanet(f: BackdropFrame) {
  const { ctx, cx, hy, s } = f;
  const r = 26 * s;
  const y = hy - 30 * s;
  const ring = (front: boolean) => {
    ctx.save();
    ctx.translate(cx, y);
    ctx.rotate(-0.25);
    ctx.strokeStyle = `rgba(255, 200, 120, ${0.25 + f.pulse * 0.45})`;
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 4 + f.pulse * 12;
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 2.1, r * 0.42, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };
  ctx.save();
  ctx.globalAlpha = 0.7;
  ring(false);
  const g = ctx.createLinearGradient(cx - r, y - r, cx + r, y + r);
  g.addColorStop(0, '#5ad1c8');
  g.addColorStop(1, '#5b2a8c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, y, r, 0, Math.PI * 2);
  ctx.fill();
  ring(true);
  ctx.restore();
}

function centreBlackHole(f: BackdropFrame) {
  const { ctx, cx, hy, s } = f;
  const y = hy - 32 * s;
  const r = 18 * s;
  const spin = f.time * (0.8 + f.bass * 3);
  ctx.save();
  ctx.globalAlpha = 0.85;
  // The glowing disc of matter, seen at an angle, streaks spinning round it
  ctx.translate(cx, y);
  for (let i = 0; i < 18; i++) {
    const a = spin + (i / 18) * Math.PI * 2;
    ctx.strokeStyle = `rgba(200, ${110 + (i % 3) * 20}, 50, ${0.2 + f.pulse * 0.2})`;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 2.6, r * 0.8, 0, a, a + 0.6);
    ctx.stroke();
  }
  // The dark centre, and the thin bright ring of light bent round it
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(220, 190, 150, ${0.35 + f.pulse * 0.2})`;
  ctx.shadowColor = '#b8742a';
  ctx.shadowBlur = 6 + f.pulse * 6;
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();
  ctx.restore();
}

// ============================= SKYLINES =============================

/** How tall things are allowed to be at this x: low in the middle (around the centrepiece), taller toward the edges. */
const edgeFactor = (x: number, f: BackdropFrame) => 0.35 + Math.abs(x - f.width / 2) / (f.width / 2);

function skylineCity(f: BackdropFrame) {
  const { ctx, hy, s } = f;
  const buildings = cached('city', f, () => {
    const rnd = seeded(1337);
    const out: Array<{ x: number; w: number; h: number; windows: Array<[number, number]> }> = [];
    for (let x = -10; x < f.width + 10; ) {
      const w = (10 + rnd() * 22) * s;
      const h = (6 + rnd() * 26 * edgeFactor(x + w / 2, f)) * s;
      const windows: Array<[number, number]> = [];
      for (let k = 0; k < Math.floor(h / (6 * s)); k++) {
        if (rnd() > 0.55) windows.push([x + rnd() * (w - 3 * s), hy - h + 3 * s + k * 6 * s]);
      }
      out.push({ x, w, h, windows });
      x += w + rnd() * 4 * s;
    }
    return out;
  });
  ctx.save();
  ctx.fillStyle = '#140a28';
  for (const b of buildings) ctx.fillRect(b.x, hy - b.h, b.w, b.h);
  ctx.fillStyle = 'rgba(255, 180, 255, 0.22)';
  for (const b of buildings) for (const [wx, wy] of b.windows) ctx.fillRect(wx, wy, 1.6 * s, 1.6 * s);
  ctx.restore();
}

function skylinePalms(f: BackdropFrame) {
  const { ctx, hy, s } = f;
  const palms = cached('palms', f, () => {
    const rnd = seeded(404);
    const out: Array<{ x: number; h: number; lean: number }> = [];
    for (let x = 0; x < f.width; x += (26 + rnd() * 40) * s) {
      if (Math.abs(x - f.width / 2) < 70 * s) continue; // keep the middle clear for the centrepiece
      out.push({ x, h: (20 + rnd() * 24) * s * Math.min(1.3, edgeFactor(x, f)), lean: (rnd() - 0.5) * 0.5 });
    }
    return out;
  });
  ctx.save();
  // The low shoreline
  ctx.fillStyle = '#0c0718';
  ctx.beginPath();
  ctx.moveTo(0, hy);
  for (let x = 0; x <= f.width; x += 20 * s) ctx.lineTo(x, hy - (2 + Math.sin(x * 0.02) * 1.5) * s);
  ctx.lineTo(f.width, hy);
  ctx.fill();
  ctx.strokeStyle = '#0c0718';
  ctx.fillStyle = '#0c0718';
  for (const p of palms) {
    const topX = p.x + p.lean * p.h;
    const topY = hy - p.h;
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(p.x, hy);
    ctx.quadraticCurveTo(p.x + p.lean * p.h * 0.2, hy - p.h * 0.6, topX, topY);
    ctx.stroke();
    // Fronds drooping out from the top, swaying a little
    ctx.lineWidth = 1.6 * s;
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI + (k / 5) * Math.PI + Math.sin(f.time + p.x) * 0.06;
      const len = 11 * s;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.6, topY + Math.sin(a) * len * 0.6 - 3 * s, topX + Math.cos(a) * len, topY + Math.sin(a) * len * 0.4 + 4 * s);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function skylineMountains(f: BackdropFrame) {
  const { ctx, hy, s } = f;
  const ridges = cached('mountains', f, () => {
    const rnd = seeded(808);
    return [0, 1].map((layer) => {
      const pts: Array<[number, number]> = [[0, hy]];
      for (let x = 0; x <= f.width + 40 * s; x += (24 + rnd() * 40) * s) {
        const h = (10 + rnd() * (layer ? 22 : 34)) * s * Math.min(1.2, edgeFactor(x, f));
        pts.push([x, hy - h]);
      }
      pts.push([f.width + 40 * s, hy]);
      return pts;
    });
  });
  ctx.save();
  ridges.forEach((pts, layer) => {
    ctx.fillStyle = layer ? '#0d0820' : '#0a0618';
    ctx.strokeStyle = layer ? `rgba(255, 0, 127, ${0.3 + f.pulse * 0.15})` : `rgba(0, 243, 255, ${0.35 + f.pulse * 0.15})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Wireframe: lines from each peak down to the foot of the next
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    for (let i = 1; i < pts.length - 2; i++) {
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo((pts[i][0] + pts[i + 1][0]) / 2, hy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
  ctx.restore();
}

function skylinePyramids(f: BackdropFrame) {
  const { ctx, hy, s } = f;
  const shapes = cached('pyramids', f, () => {
    const rnd = seeded(2024);
    const out: Array<{ x: number; w: number; h: number; temple: boolean }> = [];
    for (let x = 10 * s; x < f.width; x += (50 + rnd() * 60) * s) {
      if (Math.abs(x - f.width / 2) < 60 * s) continue;
      const w = (30 + rnd() * 40) * s * Math.min(1.3, edgeFactor(x, f));
      out.push({ x, w, h: w * 0.6, temple: rnd() > 0.7 });
    }
    return out;
  });
  ctx.save();
  ctx.lineWidth = 1;
  for (const p of shapes) {
    ctx.fillStyle = '#100a1e';
    ctx.strokeStyle = `rgba(255, 200, 80, ${0.35 + f.pulse * 0.2})`;
    ctx.beginPath();
    if (p.temple) {
      // A stepped temple: three tiers and a little shrine on top
      for (let k = 0; k < 3; k++) {
        const w = p.w * (1 - k * 0.28);
        const tierH = p.h * 0.22;
        ctx.rect(p.x - w / 2, hy - tierH * (k + 1), w, tierH);
      }
      ctx.rect(p.x - p.w * 0.1, hy - p.h * 0.66 - p.h * 0.14, p.w * 0.2, p.h * 0.14);
    } else {
      ctx.moveTo(p.x - p.w / 2, hy);
      ctx.lineTo(p.x, hy - p.h);
      ctx.lineTo(p.x + p.w / 2, hy);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function skylineStation(f: BackdropFrame) {
  const { ctx, hy, s } = f;
  const parts = cached('station', f, () => {
    const rnd = seeded(77);
    const out: Array<{ x: number; y: number; w: number; antenna: number; lights: number[] }> = [];
    for (let x = 0; x < f.width; x += (40 + rnd() * 50) * s) {
      if (Math.abs(x - f.width / 2) < 70 * s) continue;
      const w = (24 + rnd() * 30) * s;
      out.push({
        x,
        y: hy - (8 + rnd() * 30 * Math.min(1.2, edgeFactor(x, f))) * s,
        w,
        antenna: (6 + rnd() * 14) * s,
        lights: Array.from({ length: 3 }, () => rnd()),
      });
    }
    return out;
  });
  ctx.save();
  for (const p of parts) {
    // A floating deck with a support strut down to the horizon
    ctx.fillStyle = '#0e0c1e';
    ctx.fillRect(p.x, p.y, p.w, 5 * s);
    ctx.fillRect(p.x + p.w / 2 - 1.5 * s, p.y, 3 * s, hy - p.y);
    ctx.strokeStyle = 'rgba(140, 160, 220, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x + p.w * 0.25, p.y);
    ctx.lineTo(p.x + p.w * 0.25, p.y - p.antenna);
    ctx.stroke();
    // Blinking lights
    p.lights.forEach((l, i) => {
      const on = Math.sin(f.time * (1.5 + l * 2) + l * 10) > 0.4;
      ctx.fillStyle = on ? (i === 0 ? '#ff3b4a' : '#7fe0ff') : 'rgba(80, 90, 120, 0.4)';
      ctx.fillRect(p.x + p.w * (0.15 + i * 0.3), p.y + 1.5 * s, 1.6 * s, 1.6 * s);
    });
    ctx.fillStyle = Math.sin(f.time * 2 + p.x) > 0 ? '#ff3b4a' : 'rgba(80, 90, 120, 0.4)';
    ctx.fillRect(p.x + p.w * 0.25 - 1, p.y - p.antenna - 1, 2, 2);
  }
  ctx.restore();
}

// ============================== FLOORS ==============================

/** Where a floor line at grid column `i` crosses the screen at depth fraction `t` (0 = horizon, 1 = the conveyors). */
function floorX(f: BackdropFrame, i: number, t: number) {
  return f.cx + i * f.s * (6 + 74 * (t / 2));
}

/** Depth fraction of the k-th of n cross lines, bunched toward the horizon and drifting toward you. */
function crossT(k: number, n: number, drift: number) {
  const t = (k + (drift % 1)) / n;
  return t * t;
}

function floorBase(f: BackdropFrame, top: string, bottom: string) {
  const g = f.ctx.createLinearGradient(0, f.hy, 0, f.beltTop);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  f.ctx.fillStyle = g;
  f.ctx.fillRect(0, f.hy, f.width, Math.max(0, f.beltTop - f.hy));
}

function floorGrid(f: BackdropFrame) {
  const { ctx, hy, cx, s } = f;
  const depth = f.beltTop - hy;
  floorBase(f, '#120726', '#070816');
  ctx.strokeStyle = `rgba(0, 243, 255, ${0.1 + f.pulse * 0.05})`;
  ctx.lineWidth = 1;
  for (let i = -24; i <= 24; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 6 * s, hy);
    ctx.lineTo(cx + i * 80 * s, f.beltTop + depth);
    ctx.stroke();
  }
  const drift = f.time * 0.35;
  for (let k = 0; k < 14; k++) {
    const t = (k + (drift % 1)) / 14;
    const y = hy + depth * t * t;
    ctx.strokeStyle = `rgba(255, 0, 127, ${0.04 + t * 0.14})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(f.width, y);
    ctx.stroke();
  }
}

function floorWater(f: BackdropFrame) {
  const { ctx, hy, cx } = f;
  const depth = f.beltTop - hy;
  floorBase(f, '#071628', '#03070f');
  // The light of the centrepiece glinting on the water: short pale streaks down the middle,
  // shimmering, fading toward you (a soft neutral blue, never a hero or lane colour)
  for (let k = 0; k < 18; k++) {
    const t = (k + 0.5) / 18;
    const y = hy + depth * t * t;
    const half = (6 + 40 * t) * f.s * (0.6 + 0.4 * Math.sin(f.time * 3 + k * 1.7));
    ctx.strokeStyle = `rgba(170, 190, 230, ${(0.16 + f.pulse * 0.06) * (1 - t)})`;
    ctx.lineWidth = 1 + t;
    ctx.beginPath();
    ctx.moveTo(cx - half, y);
    ctx.lineTo(cx + half, y);
    ctx.stroke();
  }
  // Gentle swell lines rolling toward you
  const drift = f.time * 0.25;
  for (let k = 0; k < 16; k++) {
    const t = crossT(k, 16, drift);
    const y = hy + depth * t;
    ctx.strokeStyle = `rgba(120, 200, 255, ${0.04 + t * 0.12})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= f.width; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.03 + f.time * 2 + k) * (1 + t * 2));
    ctx.stroke();
  }
  // A ripple ring spreading out from the centre on every beat
  const grow = 1 - f.pulse;
  ctx.strokeStyle = `rgba(160, 230, 255, ${0.35 * f.pulse})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, hy + depth * 0.15, f.width * 0.5 * grow + 10, depth * 0.6 * grow + 3, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function floorHex(f: BackdropFrame) {
  const { ctx, hy, cx, s } = f;
  const depth = f.beltTop - hy;
  floorBase(f, '#0c0a1e', '#05060f');
  const rows = 12;
  for (let r = 0; r < rows; r++) {
    const t = ((r + 1) / rows) ** 2;
    const y = hy + depth * t;
    const size = (3 + 26 * t) * s;
    const offset = r % 2 ? size * 0.87 : 0;
    // A wave of light rolling through the rows on the beat
    const wave = Math.max(0, Math.sin(f.time * 3 - r * 0.7));
    const glow = 0.05 + t * 0.1 + wave * f.pulse * 0.18;
    ctx.strokeStyle = `rgba(160, 90, 255, ${glow})`;
    ctx.lineWidth = 1;
    for (let x = cx - f.width; x < cx + f.width; x += size * 1.74) {
      const hx = x + offset;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        ctx.lineTo(hx + Math.cos(a) * size, y + Math.sin(a) * size * 0.35);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
}

function floorChecker(f: BackdropFrame) {
  const { ctx, hy } = f;
  const depth = f.beltTop - hy;
  floorBase(f, '#15161f', '#08080d');
  const n = 14;
  const drift = f.time * 0.35;
  for (let k = 0; k < n; k++) {
    const t0 = crossT(k, n, drift);
    const t1 = crossT(k + 1, n, drift);
    if (t1 > 1.2) continue;
    const y0 = hy + depth * t0;
    const y1 = hy + depth * Math.min(t1, 1.2);
    for (let i = -24; i < 24; i++) {
      if ((i + k + Math.floor(drift)) % 2 !== 0) continue;
      const a = floorX(f, i, t0);
      const b = floorX(f, i + 1, t0);
      const c = floorX(f, i + 1, Math.min(t1, 1.2));
      const d = floorX(f, i, Math.min(t1, 1.2));
      // Kept faint: the fighters stand in front of the near squares, and pale enemies must not blend in
      const shine = 0.05 + t0 * 0.08 + (Math.abs(i) < 2 ? f.pulse * 0.04 : 0);
      ctx.fillStyle = `rgba(200, 210, 235, ${shine})`;
      ctx.beginPath();
      ctx.moveTo(a, y0);
      ctx.lineTo(b, y0);
      ctx.lineTo(c, y1);
      ctx.lineTo(d, y1);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function floorLava(f: BackdropFrame) {
  const { ctx, hy } = f;
  const depth = f.beltTop - hy;
  floorBase(f, '#140806', '#070303');
  const cracks = cached('lava', f, () => {
    const rnd = seeded(666);
    return Array.from({ length: 22 }, () => {
      let u = (rnd() - 0.5) * 40;
      let t = rnd() * 0.6;
      const pts: Array<[number, number]> = [];
      for (let k = 0; k < 6; k++) {
        pts.push([u, t]);
        u += (rnd() - 0.5) * 3;
        t += 0.05 + rnd() * 0.12;
      }
      return pts;
    });
  });
  ctx.save();
  ctx.lineCap = 'round';
  // Kept dim and dark: red and orange enemies walk over this floor and must stay the brightest thing on it
  ctx.shadowColor = '#7a1c08';
  ctx.shadowBlur = 3 + f.pulse * 4;
  for (const pts of cracks) {
    ctx.beginPath();
    pts.forEach(([u, t], i) => {
      const tt = Math.min(1.1, t);
      const x = floorX(f, u, tt * tt);
      const y = hy + depth * tt * tt;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = `rgba(150, ${38 + f.pulse * 22}, 16, ${0.3 + f.pulse * 0.25})`;
    ctx.lineWidth = 1 + f.pulse * 0.5;
    ctx.stroke();
  }
  ctx.restore();
}

// ============================ THE WHOLE ============================

const SKIES: Record<string, (f: BackdropFrame) => void> = { dusk: skyDusk, starfield: skyStarfield, aurora: skyAurora, ocean: skyOcean, storm: skyStorm };
const CENTRES: Record<string, (f: BackdropFrame) => void> = { sun: centreSun, moon: centreMoon, speaker: centreSpeaker, planet: centrePlanet, blackhole: centreBlackHole };
const SKYLINES: Record<string, (f: BackdropFrame) => void> = { city: skylineCity, palms: skylinePalms, mountains: skylineMountains, pyramids: skylinePyramids, station: skylineStation };
const FLOORS: Record<string, (f: BackdropFrame) => void> = { grid: floorGrid, water: floorWater, hex: floorHex, checker: floorChecker, lava: floorLava };

/** The haze each sky leaves over the horizon (rgb), so the skyline melts into it. */
const HAZE: Record<string, string> = {
  dusk: '46, 16, 70',
  starfield: '14, 20, 60',
  aurora: '10, 40, 50',
  ocean: '0, 60, 90',
  storm: '60, 6, 20',
};

/** Every piece that can be drawn, by id (for the tests and the Backdrop screen). */
export const DRAWABLE_BACKDROP_IDS = [...Object.keys(SKIES), ...Object.keys(CENTRES), ...Object.keys(SKYLINES), ...Object.keys(FLOORS)];

/** Draw the whole backdrop from the chosen pieces, back to front. */
/**
 * Draws one layer's piece by itself (the unlock popup shows a new piece
 * alone before building the rest of the backdrop round it). The floor stays
 * between the horizon and the conveyors.
 */
export function drawBackdropLayer(f: BackdropFrame, layer: BackdropLayer, id: string) {
  if (layer === 'sky') (SKIES[id] ?? skyDusk)(f);
  else if (layer === 'centre') (CENTRES[id] ?? centreSun)(f);
  else if (layer === 'skyline') (SKYLINES[id] ?? skylineCity)(f);
  else {
    const { ctx, width, hy } = f;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, hy, width, Math.max(0, f.beltTop - hy));
    ctx.clip();
    (FLOORS[id] ?? floorGrid)(f);
    ctx.restore();
  }
}

/** The atmospheric haze over the horizon, the colour of the sky. */
function drawHaze(f: BackdropFrame, sky: string) {
  const { ctx, width, hy, s } = f;
  const hazeRgb = HAZE[sky] ?? HAZE.dusk;
  const haze = ctx.createLinearGradient(0, hy - 40 * s, 0, hy + 6 * s);
  haze.addColorStop(0, `rgba(${hazeRgb}, 0)`);
  haze.addColorStop(1, `rgba(${hazeRgb}, 0.75)`);
  ctx.fillStyle = haze;
  ctx.fillRect(0, hy - 40 * s, width, 46 * s);
}

/** The thin, soft horizon line, and the dark band just behind the conveyors so the fighters separate from the floor. */
export function drawBackdropFinish(f: BackdropFrame) {
  const { ctx, width, hy, s } = f;
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 243, 255, 0.45)';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 6 + f.pulse * 6;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, hy);
  ctx.lineTo(width, hy);
  ctx.stroke();
  ctx.restore();

  const sep = ctx.createLinearGradient(0, f.beltTop - 30 * s, 0, f.beltTop);
  sep.addColorStop(0, 'rgba(6, 7, 19, 0)');
  sep.addColorStop(1, 'rgba(6, 7, 19, 0.6)');
  ctx.fillStyle = sep;
  ctx.fillRect(0, f.beltTop - 30 * s, width, 30 * s);
}

/**
 * Draws the whole backdrop, back to front. `fade` (0..1, per layer) draws a
 * layer see-through: the unlock popup fades the rest in round a new piece.
 */
export function drawBackdropLayers(f: BackdropFrame, pieces: Record<BackdropLayer, string>, fade?: Partial<Record<BackdropLayer, number>>) {
  const { ctx } = f;
  const layer = (l: BackdropLayer) => {
    const a = fade?.[l] ?? 1;
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    drawBackdropLayer(f, l, pieces[l]);
    ctx.restore();
  };
  layer('sky');
  layer('centre');
  layer('skyline');
  // The haze belongs with the sky (it's the sky's colour)
  ctx.save();
  ctx.globalAlpha *= fade?.sky ?? 1;
  drawHaze(f, pieces.sky);
  ctx.restore();
  layer('floor');
  drawBackdropFinish(f);
}
