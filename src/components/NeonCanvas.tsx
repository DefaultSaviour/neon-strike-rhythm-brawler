import React, { useRef, useEffect } from 'react';
import { GameEngine } from '../game/gameEngine';
import { Point2D } from '../types/game';
import { getMoveForCombo } from '../game/animations';
import { getEnemyStyle, resolveBandTier } from '../game/enemyStyles';
import { audioEngine } from '../audio/audioEngine';
import { beatPulse } from '../audio/beatGrid';
import { ArenaLayout, computeArenaLayout, FLOOR_Y, SPAWN_DISTANCE } from '../game/layout';
import { HIT_WINDOWS } from '../game/timing';
import { Enemy } from '../types/game';
import { enemyPoseFor } from '../game/customAnimation';
import { getActiveAnimations } from '../game/animationLibrary';
import { drawEnemyArt } from './enemyArt';
import { drawBackdropLayers } from './backdropArt';
import { drawConveyors, drawPit } from './stageArt';
import { applyHeroBuild, drawFighter, drawMeatHooks, drawImpactRipple, drawShotFlash, drawSlashCrescent } from './fighterArt';
import { fighterTier } from '../game/fighterTier';
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
      const conveyorSpeed = engine.beltSpeed();
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
      drawBackdrop(ctx, layout, width, pulse, engine);

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

      // The belts and the pit, styled to match the chosen floor (see stageArt)
      const stage = { ctx, halfW, top: FLOOR_Y - FLOOR_BACK, front: FLOOR_Y + 22, worldBottom, pitRadius: engine.pitRadius, conveyorOffset, pulse };
      drawConveyors(stage, engine.backdrop.floor);
      drawPit(stage, engine.backdrop.floor, FLOOR_Y);
      // Saw Face's top-level form: enemies on meat hooks, a static part of the stage behind the fight
      if (engine.hero.id === 'sawFace' && fighterTier(engine.scoreState.combo).ascended) drawMeatHooks(ctx, performance.now() / 1000);
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

      if (engine.crowdPop > 0) {
        drawCrowdPop(ctx, width, height, engine.crowdPop);
      }

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

/** The distant backdrop: the player's chosen sky, centrepiece, skyline and floor (see backdropArt). */
function drawBackdrop(ctx: CanvasRenderingContext2D, layout: ArenaLayout, width: number, pulse: number, engine: GameEngine) {
  drawBackdropLayers(
    {
      ctx,
      width,
      cx: layout.originX,
      hy: layout.horizonY,
      s: layout.scale,
      beltTop: layout.originY + (FLOOR_Y - FLOOR_BACK) * layout.scale,
      pulse,
      bass: audioEngine.bassMeter,
      time: performance.now() / 1000,
    },
    engine.backdrop
  );
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
    const presence = 0.45 + 0.55 * p.heat;
    ctx.globalAlpha = Math.max(0, p.alpha) * presence;

    // Same solid-neon look as the bodies they came from. Fresh pieces glow
    // white-hot and cool down to the enemy's colour.
    const outline = heatColor(p.color, p.heat * 0.85);
    // Only fresh (hot) pieces glow; cooled pieces stay quiet in the background.
    const glow = p.heat > 0.15 ? 6 + p.heat * 14 : 0;
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
    // Fade in over the first stretch of the walk: on screens wider than 16:9 the spawn point is in view
    const fadeIn = Math.min(1, Math.max(0, (SPAWN_DISTANCE - Math.abs(enemy.x)) / 50));
    ctx.save();
    ctx.globalAlpha = (isNext ? 1 : 0.42) * fadeIn;
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

    const pose = enemyPoseFor(engine.enemyMotion, phase, band, tier, getActiveAnimations());
    drawEnemyArt(ctx, pose, band, tier, { main: mainColor, accent }, phase, !!opts.flash);

    ctx.restore();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  const pose = engine.currentPose;
  const combo = engine.scoreState.combo;
  // Glow, colour, lightning and the top-level form all come from the combo tier (see fighterTier.ts).
  const tier = fighterTier(combo);

  const facing = engine.attackDirection === 'left' ? -1 : 1;
  ctx.save();
  ctx.translate(engine.playerOffsetX, 0);

  // Cyber ghost afterimage while attacking (Cyber Ninja tier and up)
  if (tier.ghost && engine.isAttacking) {
    ctx.save();
    applyHeroBuild(ctx, engine.hero.id, facing, true);
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = tier.color;
    ctx.shadowColor = tier.color;
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

  // The fighter himself (shared with the results-screen progress bar)
  drawFighter(ctx, pose, {
    tier,
    combo,
    facing,
    time: performance.now() / 1000,
    corePulse: audioEngine.bassMeter,
    hero: engine.hero.id,
    inGame: true,
  });

  // Blade slash, in front of the body: a glowing crescent with a white-hot edge
  if (pose.bladeSlash && engine.strikeActive) {
    ctx.save();
    applyHeroBuild(ctx, engine.hero.id, facing, true);
    drawSlashCrescent(ctx, pose.bladeSlash);
    drawShotFlash(ctx, pose, facing);
    if (engine.hero.id === 'theOne') drawImpactRipple(ctx, pose);
    ctx.restore();
  }

  // Move & tier banner
  if (engine.isAttacking && combo > 0) {
    const move = getMoveForCombo(combo, engine.currentMoveIndex, engine.hero.moves);
    ctx.save();
    ctx.font = '800 9px "Outfit", sans-serif';
    ctx.fillStyle = tier.color;
    ctx.shadowColor = tier.color;
    ctx.shadowBlur = 12;
    ctx.textAlign = 'center';
    ctx.fillText(`${tier.name} · ${move.name.toUpperCase()}`, 0, -150);
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

/** The crowd pops after a slam: a brief white glow round the edges of the screen. */
function drawCrowdPop(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number) {
  const g = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.4,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75
  );
  g.addColorStop(0, 'rgba(255, 255, 255, 0)');
  g.addColorStop(1, `rgba(255, 255, 255, ${(0.4 * amount).toFixed(3)})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
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
