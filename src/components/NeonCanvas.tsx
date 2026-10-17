import React, { useRef, useEffect } from 'react';
import { GameEngine } from '../game/gameEngine';
import { Point2D } from '../types/game';
import { getMoveForCombo } from '../game/animations';
import { getEnemyStyle, resolveBandTier } from '../game/enemyStyles';
import { audioEngine } from '../audio/audioEngine';
import { beatPulse } from '../audio/beatGrid';
import { ArenaLayout, computeArenaLayout, FLOOR_Y } from '../game/layout';
import { HIT_WINDOWS } from '../game/timing';
import { Enemy } from '../types/game';
import { buildForBand, enemyPose } from '../game/enemyMotion';
import { drawEnemyArt } from './enemyArt';
import { bodyFill, drawNeonBody, neonHead, neonLimb, neonShape } from './neonBody';

interface NeonCanvasProps {
  engine: GameEngine;
  scanlines: boolean;
}

/** How long a struck enemy flashes white before it is gone (ms) */
const HIT_FLASH_MS = 110;
/** Depth of the conveyor floor behind the fighters' feet (world units) */
const FLOOR_BACK = 34;

export const NeonCanvas: React.FC<NeonCanvasProps> = ({ engine, scanlines }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTimestamp = performance.now();
    let conveyorOffset = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    window.addEventListener('resize', resize);
    resize();

    const render = (timestamp: number) => {
      const dt = Math.min(0.1, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      const layout = computeArenaLayout(width, height);

      // Update engine physics (enemies, debris, conveyor belt forces)
      engine.update(dt, layout.worldHalfWidth);

      // Inward conveyor scrolling (world units)
      const conveyorSpeed = engine.conveyorSpeed * (engine.beatGrid.bpm / 120) * 0.6;
      conveyorOffset = (conveyorOffset + dt * conveyorSpeed) % 40;

      // 1 on each beat, fading before the next: drives everything that pulses with the music.
      const pulse = engine.track ? beatPulse(engine.songTime, engine.beatGrid, 5) : 0;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Deep void background
      ctx.fillStyle = '#060713';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      if (engine.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * engine.screenShake * 2;
        const shakeY = (Math.random() - 0.5) * engine.screenShake * 2;
        ctx.translate(shakeX, shakeY);
      }

      // Screen-space backdrop (kept dim and distant so the fight stays readable)
      drawBackdrop(ctx, layout, width, pulse);

      // World space: everything in the fight is drawn in world units, scaled to fit the screen.
      ctx.save();
      const zoom = 1 + engine.cameraKick.zoom;
      ctx.translate(layout.originX, layout.originY);
      // Zoom punch is centred on the fighter's chest so it feels like the camera leans in.
      ctx.translate(0, -20 * layout.scale);
      ctx.scale(zoom, zoom);
      ctx.translate(engine.cameraKick.x * layout.scale, 20 * layout.scale);
      ctx.scale(layout.scale, layout.scale);

      const halfW = layout.worldHalfWidth / zoom + 20;
      const worldBottom = (height - layout.originY) / layout.scale + 20;

      drawConvergingConveyors(ctx, halfW, worldBottom, engine.pitRadius, conveyorOffset, pulse);
      drawCentralPit(ctx, worldBottom, engine.pitRadius, pulse);
      drawTacticalStrikeZones(ctx, engine);
      drawFloorShadowsAndReflections(ctx, engine, halfW);
      drawDebrisPieces(ctx, engine);
      drawFullSizedEnemies(ctx, engine, halfW);
      drawPlayer(ctx, engine);
      drawParticles(ctx, engine);
      drawJudgements(ctx, engine);
      // Last, so no effect can ever cover the timing cue.
      drawTimingRings(ctx, engine);
      ctx.restore();

      ctx.restore();

      if (scanlines) {
        drawScanlines(ctx, width, height);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine, scanlines]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full block cursor-crosshair touch-none select-none"
    />
  );
};

// --- RENDER HELPERS ---

function colorWithAlpha(hex: string, alpha: number): string {
  if (hex.startsWith('#') && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

/** Blend a #rrggbb colour toward white. amount 0 = original, 1 = white. */
function heatColor(hex: string, amount: number): string {
  if (!(hex.startsWith('#') && hex.length === 7) || amount <= 0) return hex;
  const mix = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(c + (255 - c) * Math.min(1, amount));
  };
  return `rgb(${mix(1)}, ${mix(3)}, ${mix(5)})`;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * DISTANT BACKDROP. Everything here is deliberately dim, small and hazy, so it
 * reads as far away and never competes with the fighters (a timing game has to
 * stay readable). Layers, back to front: sky glow, sun, skyline, haze, and a
 * perspective grid floor running from the horizon to the conveyors.
 */
function drawBackdrop(ctx: CanvasRenderingContext2D, layout: ArenaLayout, width: number, pulse: number) {
  const cx = layout.originX;
  const hy = layout.horizonY;
  const s = layout.scale;
  const beltTop = layout.originY + (FLOOR_Y - FLOOR_BACK) * s;
  const bass = audioEngine.bassMeter;

  // Sky: deep gradient with a soft glow low on the horizon
  const sky = ctx.createLinearGradient(0, 0, 0, hy);
  sky.addColorStop(0, '#05060f');
  sky.addColorStop(1, '#1a0b2e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, hy);
  const glow = ctx.createRadialGradient(cx, hy, 10, cx, hy, width * 0.6);
  glow.addColorStop(0, `rgba(255, 0, 127, ${0.16 + bass * 0.08 + pulse * 0.05})`);
  glow.addColorStop(1, 'rgba(255, 0, 127, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, hy);

  // Small, dim sun far away
  const sunR = (34 + pulse * 2) * s;
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

  // City skyline silhouette on the horizon
  drawSkyline(ctx, width, hy, s);

  // Atmospheric haze: the horizon fades into fog
  const haze = ctx.createLinearGradient(0, hy - 40 * s, 0, hy + 6 * s);
  haze.addColorStop(0, 'rgba(26, 11, 46, 0)');
  haze.addColorStop(1, 'rgba(46, 16, 70, 0.75)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, hy - 40 * s, width, 46 * s);

  // Perspective grid floor from the horizon down to the conveyors
  const floorGrad = ctx.createLinearGradient(0, hy, 0, beltTop);
  floorGrad.addColorStop(0, '#120726');
  floorGrad.addColorStop(1, '#070816');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, hy, width, Math.max(0, beltTop - hy));

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, hy, width, Math.max(0, beltTop - hy));
  ctx.clip();
  const depth = beltTop - hy;
  // Lines running into the distance, all meeting at the vanishing point
  ctx.strokeStyle = `rgba(0, 243, 255, ${0.1 + pulse * 0.05})`;
  ctx.lineWidth = 1;
  for (let i = -24; i <= 24; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 6 * s, hy);
    ctx.lineTo(cx + i * 80 * s, beltTop + depth);
    ctx.stroke();
  }
  // Cross lines bunch up toward the horizon (perspective) and drift toward you on the beat grid
  const drift = (performance.now() / 1000) * 0.35;
  for (let k = 0; k < 14; k++) {
    const t = ((k + (drift % 1)) / 14);
    const y = hy + depth * t * t;
    ctx.strokeStyle = `rgba(255, 0, 127, ${0.04 + t * 0.14})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  // Thin, soft horizon line
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 243, 255, 0.45)';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 6 + pulse * 6;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, hy);
  ctx.lineTo(width, hy);
  ctx.stroke();
  ctx.restore();

  // Dark band just behind the conveyors so the fighters separate from the grid
  const sep = ctx.createLinearGradient(0, beltTop - 30 * s, 0, beltTop);
  sep.addColorStop(0, 'rgba(6, 7, 19, 0)');
  sep.addColorStop(1, 'rgba(6, 7, 19, 0.6)');
  ctx.fillStyle = sep;
  ctx.fillRect(0, beltTop - 30 * s, width, 30 * s);
}

/** Skyline building shapes depend only on the screen size, so build them once and reuse. */
let skylineCache: { key: string; buildings: Array<{ x: number; w: number; h: number; windows: Array<[number, number]> }> } | null =
  null;

function drawSkyline(ctx: CanvasRenderingContext2D, width: number, horizonY: number, s: number) {
  const key = `${Math.round(width)}:${s.toFixed(3)}`;
  if (!skylineCache || skylineCache.key !== key) {
    let seed = 1337;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const buildings: Array<{ x: number; w: number; h: number; windows: Array<[number, number]> }> = [];
    for (let x = -10; x < width + 10; ) {
      const w = (10 + rnd() * 22) * s;
      // Taller towards the edges, leaving a gap around the sun in the middle
      const edge = Math.abs(x + w / 2 - width / 2) / (width / 2);
      const h = (6 + rnd() * 26 * (0.35 + edge)) * s;
      const windows: Array<[number, number]> = [];
      for (let k = 0; k < Math.floor(h / (6 * s)); k++) {
        if (rnd() > 0.55) windows.push([x + rnd() * (w - 3 * s), horizonY - h + 3 * s + k * 6 * s]);
      }
      buildings.push({ x, w, h, windows });
      x += w + rnd() * 4 * s;
    }
    skylineCache = { key, buildings };
  }
  ctx.save();
  ctx.fillStyle = '#140a28';
  for (const b of skylineCache.buildings) ctx.fillRect(b.x, horizonY - b.h, b.w, b.h);
  ctx.fillStyle = 'rgba(255, 180, 255, 0.22)';
  for (const b of skylineCache.buildings) {
    for (const [wx, wy] of b.windows) ctx.fillRect(wx, wy, 1.6 * s, 1.6 * s);
  }
  ctx.restore();
}

// DUAL CONVERGING CONVEYOR FLOORS (world units):
// Left side moves RIGHT (inwards towards the pit: >>>>>)
// Right side moves LEFT (inwards towards the pit: <<<<<)
function drawConvergingConveyors(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  worldBottom: number,
  pitRadius: number,
  conveyorOffset: number,
  pulse: number
) {
  const top = FLOOR_Y - FLOOR_BACK;
  const front = FLOOR_Y + 22;

  ctx.save();

  // Belt surfaces
  const leftGrad = ctx.createLinearGradient(0, top, 0, front);
  leftGrad.addColorStop(0, '#0a0d24');
  leftGrad.addColorStop(1, '#10163c');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(-halfW, top, halfW - pitRadius, front - top);

  const rightGrad = ctx.createLinearGradient(0, top, 0, front);
  rightGrad.addColorStop(0, '#1c0a1a');
  rightGrad.addColorStop(1, '#2c0f29');
  ctx.fillStyle = rightGrad;
  ctx.fillRect(pitRadius, top, halfW - pitRadius, front - top);

  // Front face of the machine below the belts
  const faceGrad = ctx.createLinearGradient(0, front, 0, worldBottom);
  faceGrad.addColorStop(0, '#0b0c1c');
  faceGrad.addColorStop(1, '#040510');
  ctx.fillStyle = faceGrad;
  ctx.fillRect(-halfW, front, halfW - pitRadius, worldBottom - front);
  ctx.fillRect(pitRadius, front, halfW - pitRadius, worldBottom - front);

  // Rails glow brighter on every beat
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
  for (let x = -halfW - segment + ((conveyorOffset + halfW) % segment); x < -pitRadius; x += segment) {
    if (x - 8 < -halfW) continue;
    ctx.beginPath();
    ctx.moveTo(x - 8, top + 6);
    ctx.lineTo(x, (top + front) / 2);
    ctx.lineTo(x - 8, front - 6);
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(255, 0, 127, ${0.18 + pulse * 0.18})`;
  for (let x = halfW + segment - ((conveyorOffset + halfW) % segment); x > pitRadius; x -= segment) {
    if (x + 8 > halfW) continue;
    ctx.beginPath();
    ctx.moveTo(x + 8, top + 6);
    ctx.lineTo(x, (top + front) / 2);
    ctx.lineTo(x + 8, front - 6);
    ctx.stroke();
  }

  ctx.restore();
}

// CENTRAL ABYSS PIT: debris that reaches the middle drops in here
function drawCentralPit(ctx: CanvasRenderingContext2D, worldBottom: number, pitRadius: number, pulse: number) {
  const top = FLOOR_Y - FLOOR_BACK;

  ctx.save();
  const pitVoid = ctx.createLinearGradient(0, top, 0, worldBottom);
  pitVoid.addColorStop(0, '#020208');
  pitVoid.addColorStop(0.6, '#080518');
  pitVoid.addColorStop(1, `rgba(255, 0, 127, ${0.25 + pulse * 0.2})`);
  ctx.fillStyle = pitVoid;
  ctx.fillRect(-pitRadius, top, pitRadius * 2, worldBottom - top);

  // Hazard walls
  ctx.strokeStyle = '#ffe600';
  ctx.shadowColor = '#ffe600';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-pitRadius, top);
  ctx.lineTo(-pitRadius, worldBottom);
  ctx.moveTo(pitRadius, top);
  ctx.lineTo(pitRadius, worldBottom);
  ctx.stroke();

  // Grate teeth
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 230, 0, 0.22)';
  ctx.lineWidth = 1;
  for (let y = FLOOR_Y + 14; y < worldBottom; y += 14) {
    ctx.beginPath();
    ctx.moveTo(-pitRadius + 4, y);
    ctx.lineTo(pitRadius - 4, y);
    ctx.stroke();
  }

  // Catwalk the fighter stands on, spanning the pit
  ctx.strokeStyle = '#00f3ff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-pitRadius - 4, FLOOR_Y + 1);
  ctx.lineTo(pitRadius + 4, FLOOR_Y + 1);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.8;
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.restore();
}

function drawTacticalStrikeZones(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  const hitDist = engine.hitLineOffset;
  const now = engine.songTime;

  const inRange = (lane: 'left' | 'right') =>
    engine.enemies.some((e) => !e.defeated && e.lane === lane && Math.abs(e.targetTime - now) < HIT_WINDOWS.GOOD);

  ctx.save();
  for (const lane of ['left', 'right'] as const) {
    const side = lane === 'left' ? -1 : 1;
    const x = side * hitDist;
    const color = lane === 'left' ? '#00f3ff' : '#ff007f';
    const hot = inRange(lane);

    ctx.strokeStyle = colorWithAlpha(color, hot ? 0.95 : 0.4);
    ctx.shadowColor = color;
    ctx.shadowBlur = hot ? 18 : 6;
    ctx.lineWidth = hot ? 2.2 : 1.4;

    // Bracket opening toward the incoming enemies
    ctx.beginPath();
    ctx.moveTo(x + side * 12, -62);
    ctx.lineTo(x, -62);
    ctx.lineTo(x, FLOOR_Y + 4);
    ctx.lineTo(x + side * 12, FLOOR_Y + 4);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(x, FLOOR_Y + 2, 18, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Timing rings: for each lane's next enemy, a ring closes in on the strike
 * zone and meets it EXACTLY on the beat. The enemy body is wide, so "when is it
 * touching the line?" is fuzzy; the ring gives a precise moment to hit on.
 */
function drawTimingRings(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  const now = engine.songTime;
  const lead = Math.min(0.6, engine.approachDuration * 0.45);

  ctx.save();
  for (const lane of ['left', 'right'] as const) {
    const next = nextEnemyInLane(engine, lane);
    if (!next) continue;

    const remaining = next.targetTime - now;
    if (remaining > lead) continue;

    const side = lane === 'left' ? -1 : 1;
    const cx = side * engine.hitLineOffset;
    const cy = -2;
    const baseR = 22;
    const progress = Math.max(0, remaining / lead);
    const r = baseR + progress * 70;
    const color = lane === 'left' ? '#00f3ff' : '#ff007f';

    ctx.strokeStyle = colorWithAlpha(color, 0.25 + (1 - progress) * 0.7);
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.5 + (1 - progress) * 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Fixed target ring the moving ring closes onto
    ctx.strokeStyle = colorWithAlpha('#ffffff', Math.abs(remaining) < HIT_WINDOWS.PERFECT ? 0.9 : 0.22);
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFloorShadowsAndReflections(ctx: CanvasRenderingContext2D, engine: GameEngine, halfW: number) {
  ctx.save();

  const shadow = (x: number, color: string, w: number) => {
    const g = ctx.createRadialGradient(x, FLOOR_Y + 2, 1, x, FLOOR_Y + 2, w);
    g.addColorStop(0, colorWithAlpha(color, 0.5));
    g.addColorStop(0.6, 'rgba(0, 0, 0, 0.3)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, FLOOR_Y + 2, w, w * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  shadow(engine.playerOffsetX, '#00f3ff', 34);

  for (const enemy of engine.enemies) {
    if (enemy.defeated || Math.abs(enemy.x) > halfW + 60) continue;
    if (Math.abs(enemy.x) < engine.pitRadius) continue; // no shadow over the empty pit
    shadow(enemy.x, enemy.color, 30);
  }

  ctx.restore();
}

// SHATTERED ENEMY PIECES: rigid sticks, heads and armour shards (see debrisPhysics.ts)
function drawDebrisPieces(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const p of engine.debris) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    // Bright on impact, then fades back so it never competes with incoming enemies.
    const presence = 0.4 + 0.6 * p.heat;
    ctx.globalAlpha = Math.max(0, p.alpha) * presence;

    // Same solid-neon look as the bodies they came from. Fresh pieces glow
    // white-hot and cool down to the enemy's colour.
    const outline = heatColor(p.color, p.heat * 0.85);
    const glow = 8 + p.heat * 14;
    const fill = bodyFill(p.color);

    if (p.shape === 'circle') {
      neonHead(ctx, { x: 0, y: 0 }, p.radius, { color: outline, glow });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.radius * 0.1, -1.5, p.radius * 0.7, 3); // visor
    } else if (p.shape === 'segment') {
      neonLimb(ctx, { x: -p.halfLength, y: 0 }, { x: p.halfLength, y: 0 }, p.radius * 2, outline, fill, glow);
      if (p.heat > 0.05) {
        // Freshly cut ends glow
        ctx.fillStyle = colorWithAlpha('#fff6c0', p.heat);
        ctx.shadowColor = '#fff6c0';
        ctx.shadowBlur = 10 * p.heat;
        ctx.beginPath();
        ctx.arc(-p.halfLength, 0, p.radius * 1.05, 0, Math.PI * 2);
        ctx.arc(p.halfLength, 0, p.radius * 1.05, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const sz = p.halfLength;
      neonShape(ctx, [{ x: -sz, y: -sz * 0.5 }, { x: sz, y: 0 }, { x: -sz * 0.5, y: sz }], outline, glow);
    }

    ctx.restore();
  }

  ctx.restore();
}

interface EnemyDrawOptions {
  /** Draw as a solid white silhouette (the instant it is struck) */
  flash?: boolean;
  /** Extra scale multiplier (the flash swells as it fades) */
  grow?: number;
}

// FULL-SIZED CYBER ENEMIES: 3 Frequency Bands (Sub, Bass, High) x 3 Tiers (Low, Mid, High Hz)
function drawFullSizedEnemies(ctx: CanvasRenderingContext2D, engine: GameEngine, halfW: number) {
  const now = performance.now();
  // The next enemy due in each lane is drawn at full strength; the queue behind
  // it is dimmed, so the player always knows which one to hit next.
  const nextLeft = nextEnemyInLane(engine, 'left');
  const nextRight = nextEnemyInLane(engine, 'right');

  // Draw back-to-front: queued enemies first, the next one on top.
  const ordered = [...engine.enemies].sort((a, b) => b.targetTime - a.targetTime);
  for (const enemy of ordered) {
    if (enemy.defeated) {
      const age = enemy.deathTime !== undefined ? now - enemy.deathTime : Infinity;
      if (age < HIT_FLASH_MS) {
        const t = age / HIT_FLASH_MS;
        ctx.save();
        ctx.globalAlpha = 1 - t;
        drawEnemyFigure(ctx, enemy, engine, { flash: true, grow: 1 + t * 0.18 });
        ctx.restore();
      }
      continue;
    }
    if (Math.abs(enemy.x) > halfW + 120) continue;
    const isNext = enemy === nextLeft || enemy === nextRight;
    ctx.save();
    ctx.globalAlpha = isNext ? 1 : 0.42;
    drawEnemyFigure(ctx, enemy, engine, {});
    ctx.restore();
  }
}

/** The undefeated enemy in `lane` whose beat comes first (still hittable or upcoming). */
function nextEnemyInLane(engine: GameEngine, lane: 'left' | 'right'): Enemy | null {
  let next: Enemy | null = null;
  for (const e of engine.enemies) {
    if (e.defeated || e.lane !== lane) continue;
    if (e.targetTime - engine.songTime < -HIT_WINDOWS.OK) continue;
    if (!next || e.targetTime < next.targetTime) next = e;
  }
  return next;
}

function drawEnemyFigure(ctx: CanvasRenderingContext2D, enemy: Enemy, engine: GameEngine, opts: EnemyDrawOptions) {
  {
    const posX = enemy.x;
    const dir = enemy.lane === 'left' ? 1 : -1;
    const phase = enemy.animPhase;

    const { band, tier } = resolveBandTier(enemy);
    const style = getEnemyStyle(band, tier);
    const mainColor = opts.flash ? '#ffffff' : enemy.color || style.color;
    const accent = opts.flash ? '#ffffff' : style.accent;
    const scale = style.scale * (opts.grow ?? 1);

    // Wind-up: enemies lean in over the last moments before their beat.
    const timeLeft = enemy.targetTime - engine.songTime;
    const lean = opts.flash ? 0 : dir * 0.14 * smoothstep(0.32, 0, timeLeft);

    ctx.save();
    ctx.translate(posX, 0);

    // Anchor scaling (and the wind-up lean) at the feet so they stay on the floor (y = 68).
    // The art is drawn facing right; scaling x by `dir` mirrors it for left-facing enemies.
    ctx.translate(0, 68);
    ctx.rotate(lean);
    ctx.scale(scale * dir, scale);
    ctx.translate(0, -68);
    if (band === 'high' && tier === 2) ctx.translate(0, -5); // wraiths hover

    ctx.strokeStyle = mainColor;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = band === 'high' && tier === 3 ? 24 : 16;
    ctx.lineWidth = 3.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const pose = enemyPose(engine.settings.enemyMotion, phase, buildForBand(band));
    drawEnemyArt(ctx, pose, band, tier, { main: mainColor, accent }, phase, !!opts.flash);

    ctx.restore();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  const pose = engine.currentPose;
  const combo = engine.scoreState.combo;

  // ESCALATING NEON GLOW & AURA TIERS:
  // Character glow ascends from basic cyan -> electric azure -> overdrive magenta -> solar gold -> transcendent god-tier!
  let glowColor = '#00f3ff';
  let glowBlur = 16;
  let tierName = 'BASIC STRIKER';
  let tierColor = '#00f3ff';

  if (combo >= 50) {
    glowColor = '#ffffff';
    glowBlur = 55;
    tierName = 'GOD TIER';
    tierColor = '#ffffff';
  } else if (combo >= 30) {
    glowColor = '#ffe600';
    glowBlur = 42;
    tierName = 'OVERDRIVE';
    tierColor = '#ffe600';
  } else if (combo >= 16) {
    glowColor = '#ff007f';
    glowBlur = 32;
    tierName = 'CYBER NINJA';
    tierColor = '#ff007f';
  } else if (combo >= 6) {
    glowColor = '#38bdf8';
    glowBlur = 24;
    tierName = 'ACROBATIC';
    tierColor = '#38bdf8';
  }

  ctx.save();
  ctx.translate(engine.playerOffsetX, 0);

  // 1. GOD-TIER RADIANT PLASMA WINGS (Combo 50+)
  if (combo >= 50) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 40;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    const wingSpread = 38 + Math.sin(performance.now() * 0.008) * 6;
    // Left Wing
    ctx.beginPath();
    ctx.moveTo(pose.chest.x - 8, pose.chest.y);
    ctx.lineTo(pose.chest.x - 45 - wingSpread, pose.chest.y - 45);
    ctx.lineTo(pose.chest.x - 70 - wingSpread, pose.chest.y - 75);
    ctx.moveTo(pose.chest.x - 45 - wingSpread, pose.chest.y - 45);
    ctx.lineTo(pose.chest.x - 65 - wingSpread, pose.chest.y - 35);
    ctx.moveTo(pose.chest.x - 45 - wingSpread, pose.chest.y - 45);
    ctx.lineTo(pose.chest.x - 55 - wingSpread, pose.chest.y - 15);
    ctx.stroke();

    // Right Wing
    ctx.beginPath();
    ctx.moveTo(pose.chest.x + 8, pose.chest.y);
    ctx.lineTo(pose.chest.x + 45 + wingSpread, pose.chest.y - 45);
    ctx.lineTo(pose.chest.x + 70 + wingSpread, pose.chest.y - 75);
    ctx.moveTo(pose.chest.x + 45 + wingSpread, pose.chest.y - 45);
    ctx.lineTo(pose.chest.x + 65 + wingSpread, pose.chest.y - 35);
    ctx.moveTo(pose.chest.x + 45 + wingSpread, pose.chest.y - 45);
    ctx.lineTo(pose.chest.x + 55 + wingSpread, pose.chest.y - 15);
    ctx.stroke();
    ctx.restore();
  }

  // 2. OVERDRIVE LIGHTNING ARCS (Combo 30+)
  if (combo >= 30) {
    ctx.save();
    ctx.strokeStyle = '#ffe600';
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 22;
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Crackling arc from chest to hands
    const arcX1 = (pose.chest.x + pose.leftHand.x) / 2 + (Math.random() - 0.5) * 16;
    const arcY1 = (pose.chest.y + pose.leftHand.y) / 2 + (Math.random() - 0.5) * 16;
    ctx.moveTo(pose.chest.x, pose.chest.y);
    ctx.lineTo(arcX1, arcY1);
    ctx.lineTo(pose.leftHand.x, pose.leftHand.y);

    const arcX2 = (pose.chest.x + pose.rightHand.x) / 2 + (Math.random() - 0.5) * 16;
    const arcY2 = (pose.chest.y + pose.rightHand.y) / 2 + (Math.random() - 0.5) * 16;
    ctx.moveTo(pose.chest.x, pose.chest.y);
    ctx.lineTo(arcX2, arcY2);
    ctx.lineTo(pose.rightHand.x, pose.rightHand.y);
    ctx.stroke();
    ctx.restore();
  }

  // 3. CYBER GHOST AFTERIMAGE (Combo 16+)
  if (combo >= 16 && engine.isAttacking) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = glowColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 2.2;
    const ghostPose = engine.lastAttackPose;
    const ghostDir = engine.attackDirection === 'left' ? 12 : -12;

    const drawGhostBone = (p1: Point2D, p2: Point2D) => {
      ctx.beginPath();
      ctx.moveTo(p1.x + ghostDir, p1.y);
      ctx.lineTo(p2.x + ghostDir, p2.y);
      ctx.stroke();
    };

    drawGhostBone(ghostPose.chest, ghostPose.pelvis);
    drawGhostBone(ghostPose.chest, ghostPose.leftShoulder);
    drawGhostBone(ghostPose.leftShoulder, ghostPose.leftElbow);
    drawGhostBone(ghostPose.leftElbow, ghostPose.leftHand);
    drawGhostBone(ghostPose.chest, ghostPose.rightShoulder);
    drawGhostBone(ghostPose.rightShoulder, ghostPose.rightElbow);
    drawGhostBone(ghostPose.rightElbow, ghostPose.rightHand);
    drawGhostBone(ghostPose.pelvis, ghostPose.leftHip);
    drawGhostBone(ghostPose.leftHip, ghostPose.leftKnee);
    drawGhostBone(ghostPose.leftKnee, ghostPose.leftFoot);
    drawGhostBone(ghostPose.pelvis, ghostPose.rightHip);
    drawGhostBone(ghostPose.rightHip, ghostPose.rightKnee);
    drawGhostBone(ghostPose.rightKnee, ghostPose.rightFoot);
    ctx.restore();
  }

  // 4. Ground Aura Ring under Player Feet (Combo 6+)
  if (combo >= 6) {
    ctx.save();
    const auraRadius = 24 + Math.min(26, combo * 0.6);
    ctx.strokeStyle = glowColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glowBlur * 0.6;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 68, auraRadius, auraRadius * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 6. Flowing Cyber Scarf (behind the body)
  if (pose.scarf && pose.scarf.length > 1) {
    const scarfColor = combo >= 30 ? '#ffe600' : '#ff007f';
    const pts = [pose.head, ...pose.scarf];
    for (let i = 1; i < pts.length; i++) {
      // Tapers from the neck to the tip
      neonLimb(ctx, pts[i - 1], pts[i], 5 - i * 0.8, scarfColor, bodyFill(scarfColor), 14);
    }
  }

  // 7. Solid neon body (outline colour and glow rise with the combo).
  // The left limbs lead in every attack pose, so they're drawn in front.
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
    { color: glowColor, glow: glowBlur, shoulderHalf: 12, waistHalf: 6.5, limbScale: 1 }
  );
  neonHead(ctx, pose.head, 9, { color: glowColor, glow: glowBlur });

  // Visor
  ctx.save();
  const visorColor = combo >= 30 ? '#ffffff' : '#ffe600';
  const visorDir = engine.attackDirection === 'left' ? -1 : 1;
  ctx.fillStyle = visorColor;
  ctx.shadowColor = visorColor;
  ctx.shadowBlur = 10;
  ctx.fillRect(visorDir > 0 ? pose.head.x - 1 : pose.head.x - 9, pose.head.y - 2.5, 10, 3.5);

  // Chest reactor core (pulses with the bass and the combo)
  const corePulse = 2.5 + audioEngine.bassMeter * 2.5 + Math.min(2.5, combo * 0.08);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = glowBlur * 0.8;
  ctx.beginPath();
  ctx.arc(pose.chest.x, pose.chest.y + 4, corePulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Blade slash, in front of the body: a glowing crescent with a white-hot edge
  if (pose.bladeSlash && engine.strikeActive) {
    drawSlashCrescent(ctx, pose.bladeSlash);
  }

  // 8. Dynamic Move & Tier HUD Banner
  if (engine.isAttacking && combo > 0) {
    const move = getMoveForCombo(combo, engine.currentMoveIndex);
    ctx.save();
    ctx.font = '800 9px "Outfit", sans-serif';
    ctx.fillStyle = tierColor;
    ctx.shadowColor = tierColor;
    ctx.shadowBlur = 12;
    ctx.textAlign = 'center';
    ctx.fillText(`${tierName} · ${move.name.toUpperCase()}`, 0, -150);
    ctx.restore();
  }

  ctx.restore();
}

/** Crescent-shaped slash: thick in the middle, tapering to points at both ends. */
function drawSlashCrescent(
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

function drawParticles(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  ctx.save();

  for (const p of engine.particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.strokeStyle = p.color;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;

    if (p.sparkType === 'ring') {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size, p.size * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.sparkType === 'flash') {
      // Impact flash: bright core fading out into a soft halo
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      g.addColorStop(0.35, 'rgba(255, 255, 255, 0.45)');
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.sparkType === 'ember') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.sparkType === 'line') {
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  ctx.restore();
}

function drawJudgements(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  ctx.save();

  const now = performance.now();

  for (const j of engine.judgements) {
    const age = (now - j.createdAt) / 1000;
    const alpha = Math.max(0, 1 - age / 0.7);
    const floatY = j.y - age * 40;
    // Pops in big, then settles
    const scale = j.scale * (1 + Math.max(0, 0.45 - age * 4));

    ctx.save();
    ctx.translate(j.x, floatY);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    ctx.font = '900 13px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = j.color;
    ctx.shadowColor = j.color;
    ctx.shadowBlur = 16;
    ctx.fillText(j.text, 0, 0);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(j.text, 0, 0);

    // EARLY / LATE hint so players can tell which way they're off
    if (j.detail) {
      ctx.font = '800 7px "JetBrains Mono", monospace';
      ctx.fillStyle = j.detail === 'EARLY' ? '#7dd3fc' : '#fda4af';
      ctx.fillText(j.detail, 0, 9);
    }

    ctx.restore();
  }

  ctx.restore();
}

function drawScanlines(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 1.5);
  }

  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.45,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.82
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(6, 7, 19, 0.7)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}
