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

      // Screen-space backdrop
      drawAtmosphereAndSun(ctx, layout, width, pulse);
      drawHorizonVisualizer(ctx, width, layout);

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

function drawAtmosphereAndSun(ctx: CanvasRenderingContext2D, layout: ArenaLayout, width: number, pulse: number) {
  const centerX = layout.originX;
  const horizonY = layout.horizonY;
  const bassPulse = audioEngine.bassMeter * 0.25 + pulse * 0.12;

  const horizonGlow = ctx.createRadialGradient(centerX, horizonY, 20, centerX, horizonY, width * 0.7);
  horizonGlow.addColorStop(0, `rgba(255, 0, 127, ${0.32 + bassPulse})`);
  horizonGlow.addColorStop(0.4, 'rgba(121, 40, 202, 0.18)');
  horizonGlow.addColorStop(1, 'rgba(6, 7, 19, 0)');
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, 0, width, layout.floorScreenY);

  // Synthwave sun, sized to the arena and breathing on the beat.
  const sunRadius = (62 + bassPulse * 14) * layout.scale;
  const sunCenterY = horizonY - 4 * layout.scale;

  ctx.save();
  ctx.globalAlpha = 0.72; // slightly dimmed so the fighter in front of it stays readable
  ctx.beginPath();
  ctx.arc(centerX, sunCenterY, sunRadius, Math.PI, 0, false);
  ctx.closePath();

  const sunGrad = ctx.createLinearGradient(0, sunCenterY - sunRadius, 0, sunCenterY);
  sunGrad.addColorStop(0, '#ffe600');
  sunGrad.addColorStop(0.5, '#ff007f');
  sunGrad.addColorStop(1, '#7928ca');
  ctx.fillStyle = sunGrad;
  ctx.fill();

  ctx.fillStyle = '#060713';
  const stripeGap = sunRadius / 6.5;
  for (let i = 1; i <= 6; i++) {
    const y = sunCenterY - stripeGap * i;
    const stripeHeight = (1.6 + i * 1.1) * (layout.scale * 0.6);
    ctx.fillRect(centerX - sunRadius - 5, y, sunRadius * 2 + 10, stripeHeight);
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#00f3ff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 12 + pulse * 10;
  ctx.lineWidth = 1.5 + pulse;
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(width, horizonY);
  ctx.stroke();
  ctx.restore();
}

function drawHorizonVisualizer(ctx: CanvasRenderingContext2D, width: number, layout: ArenaLayout) {
  const bars = 64;
  const barWidth = width / bars;
  const bass = audioEngine.bassMeter;
  const treble = audioEngine.trebleMeter;
  const maxH = 40 * layout.scale;
  const now = performance.now();

  ctx.save();
  for (let i = 0; i < bars; i++) {
    const norm = Math.abs(i - bars / 2) / (bars / 2);
    const isLeft = i < bars / 2;
    const factor = isLeft ? bass * (1 - norm * 0.6) : treble * (1 - norm * 0.6);
    const h = factor * maxH + Math.sin(now * 0.006 + i) * 4;

    if (h > 4) {
      const grad = ctx.createLinearGradient(0, layout.horizonY - h, 0, layout.horizonY);
      grad.addColorStop(0, isLeft ? 'rgba(0, 243, 255, 0.32)' : 'rgba(255, 0, 127, 0.32)');
      grad.addColorStop(1, 'rgba(6, 7, 19, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(i * barWidth + 1, layout.horizonY - h, barWidth - 2, h);
    }
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

    // Fresh pieces glow white-hot and cool down to the enemy's colour.
    const color = heatColor(p.color, p.heat * 0.85);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8 + p.heat * 14;

    if (p.shape === 'circle') {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.radius * 0.1, -1.5, p.radius * 0.7, 2.5); // visor
    } else if (p.shape === 'segment') {
      ctx.lineWidth = p.radius * 2;
      ctx.beginPath();
      ctx.moveTo(-p.halfLength, 0);
      ctx.lineTo(p.halfLength, 0);
      ctx.stroke();
      // Bright core, plus glowing cut ends while hot
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(0.6, p.radius * 0.6);
      ctx.stroke();
      if (p.heat > 0.05) {
        ctx.fillStyle = colorWithAlpha('#fff6c0', p.heat);
        ctx.beginPath();
        ctx.arc(-p.halfLength, 0, p.radius * 1.4, 0, Math.PI * 2);
        ctx.arc(p.halfLength, 0, p.radius * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const s = p.halfLength;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-s, -s * 0.5);
      ctx.lineTo(s, 0);
      ctx.lineTo(-s * 0.5, s);
      ctx.closePath();
      ctx.globalAlpha = Math.max(0, p.alpha) * presence * 0.35;
      ctx.fill();
      ctx.globalAlpha = Math.max(0, p.alpha) * presence;
      ctx.stroke();
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

    // Cyber ghost trail
    if (!opts.flash && enemy.trailHistory.length > 0) {
      for (let t = 0; t < enemy.trailHistory.length; t++) {
        const tr = enemy.trailHistory[t];
        const trailAlpha = ((t + 1) / enemy.trailHistory.length) * 0.24;
        ctx.save();
        ctx.globalAlpha = trailAlpha;
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 2.2;
        ctx.strokeRect(tr.x - 12 * scale, -52 * scale, 24 * scale, 120 * scale);
        ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(posX, 0);

    // Anchor scaling (and the wind-up lean) at the feet so they stay on the floor (y = 68)
    ctx.translate(0, 68);
    ctx.rotate(lean);
    ctx.scale(scale, scale);
    ctx.translate(0, -68);

    ctx.strokeStyle = mainColor;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = band === 'high' && tier === 3 ? 24 : 16;
    ctx.lineWidth = 3.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawBone = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    // =========================================================================
    // GROUP 1: SUB / KICK (Heavy Juggernauts: Crimson, Lava Red, Blood Orange)
    // =========================================================================
    if (band === 'sub') {
      const bob = Math.abs(Math.sin(phase)) * 6.5;
      const legStride = Math.sin(phase) * 22;
      const armStride = Math.cos(phase) * 26;

      const headY = -48 - bob;
      const chestY = -22 - bob;
      const pelvisY = 8 - bob * 0.5;

      // Heavy Hunched Head
      ctx.beginPath();
      ctx.arc(dir * 12, headY, tier === 1 ? 10 : 8.5, 0, Math.PI * 2);
      ctx.stroke();

      // Glowing Visor / Eye Slit
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dir * 16, headY - 2, 5, 3);

      // --- TIER VARIATIONS (Sub/Kick) ---
      if (tier === 1) {
        // TIER 1: TITAN (Deep Sub 36-65Hz) - Massive Horned Juggernaut
        // Upward forward-curving cyber battle horns
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3.8;
        drawBone(dir * 10, headY - 8, dir * 26, headY - 24);
        drawBone(dir * 26, headY - 24, dir * 36, headY - 18);
        drawBone(dir * 4, headY - 8, dir * 18, headY - 20);
        ctx.restore();

        // Heavy shoulder pauldrons
        drawBone(dir * 6, chestY - 8, dir * 20, chestY - 6);
        drawBone(dir * 20, chestY - 6, dir * 24, chestY + 6);
        drawBone(-dir * 6, chestY - 8, -dir * 16, chestY - 4);

        // Chest Reactor Plate
        ctx.fillStyle = mainColor;
        ctx.fillRect(dir * 4, chestY - 4, 8, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(dir * 6, chestY - 2, 4, 4);

        // Stomping Foot Quake Ring when lead foot impacts (phase near 0 or PI)
        if (bob < 1.5) {
          ctx.save();
          ctx.strokeStyle = accent;
          ctx.shadowColor = mainColor;
          ctx.shadowBlur = 10;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(dir * 28 + legStride, 68, 14, 4, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      } else if (tier === 2) {
        // TIER 2: BREAKER (Core Kick 65-110Hz) - Pneumatic Piston Brawler
        // Spiked dorsal vertebrae fins along the spine
        for (let s = 0; s < 3; s++) {
          const sy = chestY + s * 9;
          drawBone(-dir * 2, sy, -dir * (12 + s * 2), sy - 7);
        }
        // Forearm Pneumatic Piston Spike (slides dynamically with stride)
        const pistonExt = Math.sin(phase * 1.5) * 8;
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 3.2;
        drawBone(dir * 54 + armStride, chestY + 2, dir * (68 + pistonExt) + armStride, chestY - 3);
        ctx.restore();
      } else {
        // TIER 3: RAMMER (Upper Kick/Transient 110-145Hz) - Forward Battering Ram
        // Curved Molten Ram Horns
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 4;
        drawBone(dir * 14, headY - 4, dir * 30, headY + 4);
        drawBone(dir * 30, headY + 4, dir * 28, headY + 14);
        ctx.restore();

        // Arm-Mounted Battering Shield
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.shadowColor = mainColor;
        ctx.shadowBlur = 16;
        ctx.lineWidth = 4.2;
        ctx.beginPath();
        ctx.moveTo(dir * 46 + armStride, chestY - 16);
        ctx.lineTo(dir * 64 + armStride, chestY + 2);
        ctx.lineTo(dir * 46 + armStride, chestY + 18);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Molten Back Rocket Flame Trails
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.shadowColor = mainColor;
        ctx.shadowBlur = 16;
        ctx.lineWidth = 2.5;
        drawBone(-dir * 8, chestY - 4, -dir * (35 + Math.random() * 12), chestY - 4 + (Math.random() - 0.5) * 6);
        drawBone(-dir * 8, chestY + 4, -dir * (30 + Math.random() * 12), chestY + 4 + (Math.random() - 0.5) * 6);
        ctx.restore();
      }

      // Muscular Spine
      drawBone(dir * 10, chestY, 0, pelvisY);

      // Lead Punch Arm
      drawBone(dir * 6, chestY, dir * 28 + armStride, chestY + 6);
      drawBone(dir * 28 + armStride, chestY + 6, dir * 54 + armStride, chestY + 2);
      drawBone(dir * 54 + armStride, chestY + 2, dir * 65 + armStride, chestY - 4);

      // Trailing Arm
      drawBone(-dir * 4, chestY, -dir * 18 - armStride, chestY + 10);
      drawBone(-dir * 18 - armStride, chestY + 10, -dir * 36 - armStride, chestY + 18);

      // Stomping Running Legs (planted on ground at y = 68)
      drawBone(0, pelvisY, dir * 22 + legStride, 38);
      drawBone(dir * 22 + legStride, 38, dir * 28 + legStride, 68);
      drawBone(0, pelvisY, -dir * 22 - legStride, 34);
      drawBone(-dir * 22 - legStride, 34, -dir * 32 - legStride, 68);

      // Core white accent highlight
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.3;
      ctx.shadowBlur = 0;
      drawBone(dir * 10, chestY, 0, pelvisY);
      drawBone(dir * 6, chestY, dir * 28 + armStride, chestY + 6);
      drawBone(0, pelvisY, dir * 22 + legStride, 38);
    }

    // =========================================================================
    // GROUP 2: BASSLINE (Cyber Samurai & Blade Dancers: Violet, Magenta, Acid Pink)
    // =========================================================================
    else if (band === 'bass') {
      const bob = Math.sin(phase * 1.2) * 2.5;
      const headY = -48 + bob;
      const chestY = -22 + bob;
      const pelvisY = 8;

      // Spine
      drawBone(0, chestY, 0, pelvisY);

      if (tier === 1) {
        // TIER 1: WARLORD (Deep Rolling Bass 105-150Hz) - Armored Shogun with Odachi
        // Horned Kabuto War Crest
        ctx.beginPath();
        ctx.moveTo(dir * 20, headY - 4);
        ctx.lineTo(0, headY - 18);
        ctx.lineTo(-dir * 20, headY - 4);
        ctx.closePath();
        ctx.stroke();

        ctx.save();
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 3.2;
        // Crescent Kuwagata Horns on Crest
        drawBone(0, headY - 18, dir * 16, headY - 30);
        drawBone(0, headY - 18, -dir * 16, headY - 30);
        ctx.restore();

        // Head & Demon Mempo Face Visor
        ctx.beginPath();
        ctx.arc(0, headY, 8.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(dir > 0 ? 3 : -8, headY - 2, 6, 3);

        // Double Sashimono War-Flags fluttering from back
        const flagWave = Math.sin(phase * 1.4) * 8;
        drawBone(-dir * 6, chestY, -dir * 12, headY - 28);
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.shadowColor = mainColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(-dir * 28 + flagWave, headY - 26, 16, 26);
        ctx.restore();

        // GIANT CURVED ODACHI (Heavy Great-Sword dragging along runway)
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 22;
        ctx.lineWidth = 4.2;
        drawBone(dir * 16, chestY + 8, dir * 68, 68);
        // Heavy dragging blade spark shower
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(dir * 68, 68, 4.5, 0, Math.PI * 2);
        ctx.fill();
        for (let sp = 0; sp < 4; sp++) {
          drawBone(dir * 68, 68, dir * (68 - Math.random() * 22), 68 - Math.random() * 18);
        }
        ctx.restore();

        // Arms holding greatsword
        drawBone(dir * 6, chestY, dir * 16, chestY + 4);
        drawBone(dir * 16, chestY + 4, dir * 28, chestY + 12);
        drawBone(-dir * 6, chestY, -dir * 14, chestY + 4);
        drawBone(-dir * 14, chestY + 4, dir * 14, chestY + 8);
      } else if (tier === 2) {
        // TIER 2: RONIN (Mid-Bass Groove 150-220Hz) - Classic Cyber Kasa Samurai
        // Ronin Conical Cyber-Kasa Hat
        ctx.beginPath();
        ctx.moveTo(dir * 18, headY - 4);
        ctx.lineTo(0, headY - 14);
        ctx.lineTo(-dir * 18, headY - 4);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, headY, 8, 0, Math.PI * 2);
        ctx.stroke();

        // Gold Visor Slit
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(dir > 0 ? 2 : -7, headY - 1, 6, 2.5);

        // Flowing Cyber Haori Cape
        const capeWave = Math.sin(phase * 1.5) * 12;
        ctx.beginPath();
        ctx.moveTo(-dir * 8, chestY);
        ctx.lineTo(-dir * 38, chestY + 15 + capeWave);
        ctx.lineTo(-dir * 62, chestY + 38 + capeWave * 1.3);
        ctx.stroke();

        // Katana dragging with conveyor spark
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 20;
        ctx.lineWidth = 3.2;
        drawBone(dir * 16, chestY + 8, dir * 55, 68);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(dir * 55, 68, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        drawBone(dir * 6, chestY, dir * 16, chestY + 4);
        drawBone(dir * 16, chestY + 4, dir * 28, chestY + 14);
        drawBone(-dir * 6, chestY, -dir * 22, chestY - 2);
        drawBone(-dir * 22, chestY - 2, -dir * 35, chestY - 14);
      } else {
        // TIER 3: ACID DANCER (Upper/Acid Synth Riffs 220-300Hz) - Dual Reverse-Blade Kunoichi
        // Sleek Ninja Cowl
        ctx.beginPath();
        ctx.moveTo(dir * 14, headY - 2);
        ctx.lineTo(0, headY - 12);
        ctx.lineTo(-dir * 12, headY - 6);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, headY, 7.5, 0, Math.PI * 2);
        ctx.stroke();

        // Neon Lime Visor
        ctx.fillStyle = accent;
        ctx.fillRect(dir > 0 ? 2 : -7, headY - 1, 6, 2.5);

        // Undulating Energy Ribbon Streamers
        for (let r = 0; r < 2; r++) {
          const rWave = Math.sin(phase * 2 + r * 1.5) * 14;
          ctx.save();
          ctx.strokeStyle = r === 0 ? mainColor : accent;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-dir * 6, headY + r * 6);
          ctx.lineTo(-dir * 34, headY + 10 + rWave);
          ctx.lineTo(-dir * 65, headY + 22 + rWave * 1.4);
          ctx.stroke();
          ctx.restore();
        }

        // DUAL REVERSE-GRIP ACID SCYTHE BLADES
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 18;
        ctx.lineWidth = 3.4;
        // Lead hand reverse blade (sweeps downward forward)
        drawBone(dir * 30, chestY + 4, dir * 54, chestY - 12);
        drawBone(dir * 54, chestY - 12, dir * 44, chestY - 22);
        // Trailing hand reverse blade (sweeps upward backward)
        drawBone(-dir * 26, chestY + 8, -dir * 48, chestY - 14);
        drawBone(-dir * 48, chestY - 14, -dir * 38, chestY - 24);
        ctx.restore();

        drawBone(dir * 6, chestY, dir * 20, chestY + 2);
        drawBone(dir * 20, chestY + 2, dir * 30, chestY + 4);
        drawBone(-dir * 6, chestY, -dir * 18, chestY + 4);
        drawBone(-dir * 18, chestY + 4, -dir * 26, chestY + 8);
      }

      // Gliding ninja stance legs (planted on ground at y = 68)
      drawBone(0, pelvisY, dir * 18, 38);
      drawBone(dir * 18, 38, dir * 28, 68);
      drawBone(0, pelvisY, -dir * 22, 38);
      drawBone(-dir * 22, 38, -dir * 38, 68);

      // White core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.3;
      ctx.shadowBlur = 0;
      drawBone(0, chestY, 0, pelvisY);
      drawBone(0, pelvisY, dir * 18, 38);
    }

    // =========================================================================
    // GROUP 3: HIGH (Plasma Jets, Wraiths & Seraphs: Cyan, Mint, Prismatic White)
    // =========================================================================
    else {
      const bob = Math.sin(phase * 1.8) * 2.2;
      const headY = -46 + bob;
      const chestY = -20 + bob;
      const pelvisY = 8;

      if (tier === 1) {
        // TIER 1: SPEEDER (Snare / Lower Highs 800-1800Hz) - Jet Roller with Forearm Blades
        // Aerodynamic Speed Visor
        ctx.beginPath();
        ctx.moveTo(dir * 20, headY);
        ctx.lineTo(-dir * 12, headY - 10);
        ctx.lineTo(-dir * 14, headY + 8);
        ctx.closePath();
        ctx.stroke();

        drawBone(dir * 4, chestY, -dir * 2, pelvisY);

        // Dual forward plasma blades on forearms
        ctx.save();
        ctx.strokeStyle = mainColor;
        ctx.shadowColor = mainColor;
        ctx.shadowBlur = 18;
        ctx.lineWidth = 3.5;
        drawBone(dir * 24, chestY - 2, dir * 55, chestY - 2);
        ctx.restore();

        drawBone(dir * 6, chestY, dir * 24, chestY - 2);
        drawBone(-dir * 4, chestY, -dir * 20, chestY + 8);
        drawBone(-dir * 20, chestY + 8, -dir * 32, chestY + 16);

        // Roller legs planted on conveyor (y = 68)
        drawBone(-dir * 2, pelvisY, dir * 18, 38);
        drawBone(dir * 18, 38, dir * 25, 68);
        drawBone(-dir * 2, pelvisY, -dir * 20, 38);
        drawBone(-dir * 20, 38, -dir * 28, 68);

        // Jet booster flames shooting backward from boots
        ctx.save();
        ctx.strokeStyle = mainColor;
        ctx.shadowColor = mainColor;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2.5;
        drawBone(-dir * 28, 66, -dir * (55 + Math.random() * 15), 66 + (Math.random() - 0.5) * 5);
        ctx.restore();
      } else if (tier === 2) {
        // TIER 2: WRAITH (Sharp Claps / Leads 1800-3500Hz) - Hovering Plasma Phantom with Wings
        // Sleek aerodynamic helmet
        ctx.beginPath();
        ctx.arc(dir * 6, headY, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(dir * 10, headY - 2, 5, 2.5);

        // Spine
        drawBone(dir * 4, chestY, -dir * 2, pelvisY);

        // Twin Swept-Back Cyber Energy Wings on Back
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.shadowColor = mainColor;
        ctx.shadowBlur = 18;
        ctx.lineWidth = 3.4;
        drawBone(0, chestY - 6, -dir * 36, chestY - 32);
        drawBone(-dir * 36, chestY - 32, -dir * 48, chestY - 14);
        drawBone(0, chestY - 2, -dir * 32, chestY - 10);
        ctx.restore();

        // Twin crackling plasma claws
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 16;
        ctx.lineWidth = 2.8;
        drawBone(dir * 20, chestY + 2, dir * 44, chestY - 6);
        drawBone(dir * 44, chestY - 6, dir * 54, chestY - 4);
        drawBone(-dir * 16, chestY + 4, -dir * 34, chestY + 12);
        ctx.restore();

        drawBone(dir * 4, chestY, dir * 20, chestY + 2);
        drawBone(-dir * 4, chestY, -dir * 16, chestY + 4);

        // Hover-skate posture (feet floating 6px above ground with anti-grav glow discs)
        drawBone(-dir * 2, pelvisY, dir * 16, 36);
        drawBone(dir * 16, 36, dir * 22, 62);
        drawBone(-dir * 2, pelvisY, -dir * 18, 36);
        drawBone(-dir * 18, 36, -dir * 26, 62);

        ctx.save();
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 16;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(dir * 22, 65, 8, 2.5, 0, 0, Math.PI * 2);
        ctx.ellipse(-dir * 26, 65, 8, 2.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        // TIER 3: SERAPH (Screaming Hyper Leads / Treble 3500-6500Hz) - Radiant Angel of Light
        // Sleek Crested Helmet
        ctx.beginPath();
        ctx.arc(dir * 4, headY, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(dir * 8, headY - 2, 6, 3);

        // Rotating Radiant Cyber-Halo / Crown above head
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 20;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(dir * 4, headY - 14, 14, 4.5, phase * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Spine
        drawBone(dir * 4, chestY, -dir * 2, pelvisY);

        // Quad Radiant Geometric Plasma Wing Fins (pulsing outward)
        const wingPulse = Math.sin(phase * 2) * 5;
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 24;
        ctx.lineWidth = 3.6;
        // Upper high swept wings
        drawBone(0, chestY - 8, -dir * (42 + wingPulse), chestY - 42);
        drawBone(-dir * (42 + wingPulse), chestY - 42, -dir * (58 + wingPulse), chestY - 26);
        // Lower swept wings
        drawBone(0, chestY, -dir * (38 + wingPulse), chestY - 14);
        drawBone(-dir * (38 + wingPulse), chestY - 14, -dir * (52 + wingPulse), chestY + 4);
        ctx.restore();

        // Orbiting Beam Sabers hovering near hands
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.shadowColor = accent;
        ctx.shadowBlur = 22;
        ctx.lineWidth = 3.8;
        drawBone(dir * 22, chestY + 2, dir * 56, chestY - 16);
        drawBone(-dir * 18, chestY + 4, -dir * 44, chestY + 18);
        ctx.restore();

        drawBone(dir * 4, chestY, dir * 22, chestY + 2);
        drawBone(-dir * 4, chestY, -dir * 18, chestY + 4);

        // Radiant gliding legs planted on conveyor (y = 68)
        drawBone(-dir * 2, pelvisY, dir * 16, 36);
        drawBone(dir * 16, 36, dir * 24, 68);
        drawBone(-dir * 2, pelvisY, -dir * 18, 36);
        drawBone(-dir * 18, 36, -dir * 26, 68);

        // Blinding white spark particles around Seraph
        for (let sp = 0; sp < 2; sp++) {
          const spx = (Math.random() - 0.5) * 40;
          const spy = chestY + (Math.random() - 0.5) * 40;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(spx, spy, 2.5, 2.5);
        }
      }

      // White core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.3;
      ctx.shadowBlur = 0;
      drawBone(dir * 4, chestY, -dir * 2, pelvisY);
    }

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

  // 5. Blade Slash Arc
  if (pose.bladeSlash && engine.strikeActive) {
    const slash = pose.bladeSlash;
    ctx.save();
    ctx.strokeStyle = slash.color;
    ctx.shadowColor = slash.color;
    ctx.shadowBlur = 25;
    ctx.lineWidth = 4.2;

    ctx.beginPath();
    ctx.moveTo(slash.start.x, slash.start.y);
    const midX = (slash.start.x + slash.end.x) / 2;
    const midY = (slash.start.y + slash.end.y) / 2 + slash.curveOffset;
    ctx.quadraticCurveTo(midX, midY, slash.end.x, slash.end.y);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
  }

  // 6. Flowing Cyber Scarf
  if (pose.scarf && pose.scarf.length > 1) {
    ctx.save();
    ctx.strokeStyle = combo >= 30 ? '#ffe600' : '#ff007f';
    ctx.shadowColor = combo >= 30 ? '#ffe600' : '#ff007f';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(pose.scarf[0].x, pose.scarf[0].y);
    for (let i = 1; i < pose.scarf.length; i++) {
      ctx.lineTo(pose.scarf[i].x, pose.scarf[i].y);
    }
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.3;
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
  }

  // 7. Cyber Skeleton Bones & Joints (Glow scales with combo!)
  ctx.save();
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = glowBlur;
  ctx.lineWidth = 3.8;
  ctx.strokeStyle = glowColor;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const drawBone = (p1: Point2D, p2: Point2D) => {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  };

  drawBone(pose.chest, pose.pelvis);
  drawBone(pose.chest, pose.leftShoulder);
  drawBone(pose.leftShoulder, pose.leftElbow);
  drawBone(pose.leftElbow, pose.leftHand);
  drawBone(pose.chest, pose.rightShoulder);
  drawBone(pose.rightShoulder, pose.rightElbow);
  drawBone(pose.rightElbow, pose.rightHand);
  drawBone(pose.pelvis, pose.leftHip);
  drawBone(pose.leftHip, pose.leftKnee);
  drawBone(pose.leftKnee, pose.leftFoot);
  drawBone(pose.pelvis, pose.rightHip);
  drawBone(pose.rightHip, pose.rightKnee);
  drawBone(pose.rightKnee, pose.rightFoot);

  // Head
  ctx.beginPath();
  ctx.arc(pose.head.x, pose.head.y, 8.5, 0, Math.PI * 2);
  ctx.stroke();

  // Cyber Visor
  ctx.strokeStyle = combo >= 30 ? '#ffffff' : '#ffe600';
  ctx.shadowColor = combo >= 30 ? '#ffffff' : '#ffe600';
  ctx.lineWidth = 2.8;
  const visorDir = engine.attackDirection === 'left' ? -1 : 1;
  ctx.beginPath();
  ctx.moveTo(pose.head.x - 3 * visorDir, pose.head.y - 1);
  ctx.lineTo(pose.head.x + 10 * visorDir, pose.head.y - 1);
  ctx.stroke();

  // Chest Reactor Core (Pulses intensely with combo and bass)
  const corePulse = 3.5 + audioEngine.bassMeter * 3.5 + Math.min(3, combo * 0.1);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = glowBlur * 0.8;
  ctx.beginPath();
  ctx.arc(pose.chest.x, pose.chest.y, corePulse, 0, Math.PI * 2);
  ctx.fill();

  // White Core Highlights
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.4;
  ctx.shadowBlur = 0;
  drawBone(pose.chest, pose.pelvis);
  drawBone(pose.leftShoulder, pose.leftElbow);
  drawBone(pose.leftElbow, pose.leftHand);
  drawBone(pose.rightShoulder, pose.rightElbow);
  drawBone(pose.rightElbow, pose.rightHand);
  drawBone(pose.leftHip, pose.leftKnee);
  drawBone(pose.leftKnee, pose.leftFoot);
  drawBone(pose.rightHip, pose.rightKnee);
  drawBone(pose.rightKnee, pose.rightFoot);

  ctx.restore();

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
