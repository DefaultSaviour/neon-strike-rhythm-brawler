import React, { useRef, useEffect } from 'react';
import { GameEngine } from '../game/gameEngine';
import { Point2D } from '../types/game';
import { getEnemyStyle, resolveBandTier } from '../game/enemyStyles';
import { audioEngine } from '../audio/audioEngine';
import { beatPosition, beatPulse } from '../audio/beatGrid';
import { BOSS_LOOKS, BOSS_SCALE, bossFigures, BossLook } from '../game/boss';
import { ArenaLayout, computeArenaLayout, FIGHTER_HEIGHT, FLOOR_Y, SPAWN_DISTANCE } from '../game/layout';
import { HIT_WINDOWS } from '../game/timing';
import { HIT_LOG_FADE_SECONDS, HIT_LOG_SECONDS, hitLogArea, HitLogEntry, HudBox, JUDGEMENT_COLORS } from '../game/hitLog';
import { Enemy } from '../types/game';
import type { DebrisPiece } from '../game/debrisPhysics';
import { enemyPoseFor } from '../game/customAnimation';
import { getActiveAnimations } from '../game/animationLibrary';
import { drawEnemyArt } from './enemyArt';
import { drawBackdropLayers } from './backdropArt';
import { drawConveyors, drawPit } from './stageArt';
import { applyHeroBuild, drawFighter, drawFlyingArmOverHit, drawMeatHooks, drawStrawBurst, drawImpactRipple, drawShotFlash, drawSlashCrescent } from './fighterArt';
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

    // The canvas fills its box (the game's 4:3-limited frame), not the whole window
    let width = 1;
    let height = 1;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const box = canvas.parentElement;
      width = Math.max(1, box ? box.clientWidth : window.innerWidth);
      height = Math.max(1, box ? box.clientHeight : window.innerHeight);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    window.addEventListener('resize', resize);
    const watch = typeof ResizeObserver !== 'undefined' && canvas.parentElement ? new ResizeObserver(resize) : null;
    if (watch && canvas.parentElement) watch.observe(canvas.parentElement);
    resize();

    // Where the HUD's score row is, so the hit lists keep clear of it (re-read now and then)
    let hud: HudBox | null = null;
    let hudReadAt = -Infinity;
    const readHud = (now: number) => {
      if (now - hudReadAt < 500) return hud;
      hudReadAt = now;
      const el = document.querySelector('[data-hud-scores]');
      const r = el?.getBoundingClientRect();
      // Its three blocks: combo, rank, score
      const [combo, rank, score] = el ? [...el.children].map((c) => c.getBoundingClientRect()) : [];
      // In the canvas's own coordinates (the frame can sit lower down, below a bar)
      const at = canvas.getBoundingClientRect();
      const x = (v: number) => v - at.left;
      const y = (v: number) => v - at.top;
      hud =
        r && r.width > 0 && combo && rank && score
          ? { left: x(r.left), right: x(r.right), top: y(r.top), bottom: y(r.bottom), comboRight: x(combo.right), rankLeft: x(rank.left), rankRight: x(rank.right), scoreLeft: x(score.left) }
          : null;
      return hud;
    };

    const render = (timestamp: number) => {
      const dt = Math.min(0.1, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;

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
      drawBoss(ctx, engine);
      drawFullSizedEnemies(ctx, engine, halfW, false);
      drawPlayer(ctx, engine);
      drawParticles(ctx, engine);
      // Boss fists go above the fighter and the effects: a big move must never hide one
      drawFullSizedEnemies(ctx, engine, halfW, true);
      drawReturningFists(ctx, engine);
      drawBossKo(ctx, engine);
      // Last, so no effect can ever cover the timing cue.
      drawTimingRings(ctx, engine);
      ctx.restore();

      ctx.restore();

      if (engine.crowdPop > 0) {
        drawCrowdPop(ctx, width, height, engine.crowdPop);
      }
      drawBossBar(ctx, engine, width, height);
      if (engine.hitLog.length > 0) {
        // Up from the horizon, and never down among the fighters' and enemies' heads
        const heads = layout.floorScreenY - FIGHTER_HEIGHT * layout.scale;
        drawHitLists(ctx, engine.hitLog, width, height, layout.horizonY - 10, heads - 24, layout.scale, readHud(timestamp));
      }

      if (scanlines) {
        drawScanlines(ctx, width, height);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      watch?.disconnect();
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
  // Players read "a circle appeared" as "hit now", so it only shows while a press can
  // land (the OK window), shrinking onto the target ring at the PERFECT moment.
  const lead = HIT_WINDOWS.OK;

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
    const r = baseR + progress * 36;
    const color = lane === 'left' ? '#00f3ff' : '#ff007f';

    ctx.strokeStyle = colorWithAlpha(color, 0.75 + (1 - progress) * 0.25);
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2.5 + (1 - progress) * 1.5;
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
  drawDebrisList(ctx, engine.debris);
}

/**
 * The pieces struck enemies break into (also used by the title screen's
 * fight). In the game fresh pieces glow white-hot; `whiteHot: false` keeps
 * them in their own colour (the title, where the white was distracting).
 */
export function drawDebrisList(ctx: CanvasRenderingContext2D, pieces: DebrisPiece[], { whiteHot = true }: { whiteHot?: boolean } = {}) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const p of pieces) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    // Bright on impact, then fades back so it never competes with incoming enemies.
    const presence = 0.45 + 0.55 * p.heat;
    ctx.globalAlpha = Math.max(0, p.alpha) * presence;

    // Same solid-neon look as the bodies they came from. Fresh pieces glow
    // white-hot and cool down to the enemy's colour.
    const outline = whiteHot ? heatColor(p.color, p.heat * 0.85) : p.color;
    // Only fresh (hot) pieces glow; cooled pieces stay quiet in the background.
    const glow = p.heat > 0.15 ? 6 + p.heat * 14 : 0;
    const fill = bodyFill(p.color);

    if (p.shape === 'circle') {
      neonHead(ctx, { x: 0, y: 0 }, p.radius, { color: outline, glow });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.radius * 0.1, -1.5, p.radius * 0.7, 3); // visor
    } else if (p.shape === 'segment') {
      neonLimb(ctx, { x: -p.halfLength, y: 0 }, { x: p.halfLength, y: 0 }, p.radius * 2, outline, fill, glow);
      if (whiteHot && p.heat > 0.05) {
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
/** `fists`: draw only the boss's fists (a later layer), or only everything else. */
function drawFullSizedEnemies(ctx: CanvasRenderingContext2D, engine: GameEngine, halfW: number, fists: boolean) {
  const now = performance.now();
  // The next enemy due in each lane is drawn at full strength; the queue behind
  // it is dimmed, so the player always knows which one to hit next.
  const nextLeft = nextEnemyInLane(engine, 'left');
  const nextRight = nextEnemyInLane(engine, 'right');

  // Draw back-to-front: queued enemies first, the next one on top.
  const ordered = [...engine.enemies].sort((a, b) => b.targetTime - a.targetTime);
  for (const enemy of ordered) {
    if (!!enemy.bossAttack !== fists) continue;
    if (enemy.defeated) {
      const age = enemy.deathTime !== undefined ? now - enemy.deathTime : Infinity;
      if (age < HIT_FLASH_MS) {
        const t = age / HIT_FLASH_MS;
        ctx.save();
        ctx.globalAlpha = 1 - t;
        if (enemy.bossAttack) drawBossFist(ctx, enemy, engine, true, 1 + t * 0.8);
        else drawEnemyFigure(ctx, enemy, engine, { flash: true, grow: 1 + t * 0.18 });
        ctx.restore();
      }
      continue;
    }
    if (Math.abs(enemy.x) > halfW + 120) continue;
    const isNext = enemy === nextLeft || enemy === nextRight;
    // Fade in over the first stretch of the walk: on screens wider than 16:9 the spawn point is in view
    const fadeIn = Math.min(1, Math.max(0, (SPAWN_DISTANCE - Math.abs(enemy.x)) / 50));
    ctx.save();
    if (enemy.bossAttack) {
      // Fists only show once thrown
      if (enemy.spawnTime > engine.songTime) {
        ctx.restore();
        continue;
      }
      ctx.globalAlpha = isNext ? 1 : 0.6;
      drawBossFist(ctx, enemy, engine, false);
    } else {
      ctx.globalAlpha = (isNext ? 1 : 0.42) * fadeIn;
      drawEnemyFigure(ctx, enemy, engine, {});
    }
    ctx.restore();
  }
}

// THE END-OF-SONG BOSSES (see boss.ts): giant enemies throwing energy fists on the beat
function drawBoss(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  const boss = engine.boss;
  if (!boss || boss.ko || !engine.track) return;
  const look = BOSS_LOOKS[boss.plan.kind];
  const twins = boss.plan.kind === 'twins';
  const beat = beatPosition(engine.songTime, engine.beatGrid);

  for (const fig of bossFigures(boss.plan, engine.songTime, engine.fistFlight)) {
    if (!fig.visible || (twins && boss.downAt[fig.side])) continue;

    // Punches as each fist leaves its hand
    let lastThrow = -Infinity;
    for (const e of engine.enemies) {
      if (!e.bossAttack || (twins && e.lane !== fig.side)) continue;
      if (e.spawnTime <= engine.songTime && e.spawnTime > lastThrow) lastThrow = e.spawnTime;
    }
    const punch = fig.running ? 0 : Math.max(0, 1 - (engine.songTime - lastThrow) / 0.22);
    const hurt = performance.now() - boss.hurtAt < 90 && (!twins || boss.hurtSide === fig.side);

    // The Volt Runner sprints with the run cycle; otherwise the chosen enemy motion
    const base = fig.running
      ? enemyPoseFor('run', beat * 3, look.band, look.tier, getActiveAnimations())
      : enemyPoseFor(engine.enemyMotion, beat, look.band, look.tier, getActiveAnimations());
    const pose = {
      ...base,
      frontElbow: { x: base.frontElbow.x + 10 * punch, y: base.frontElbow.y - 4 * punch },
      frontHand: { x: base.frontHand.x + 26 * punch, y: base.frontHand.y - 10 * punch },
    };

    ctx.save();
    // A glow on the floor under it (fades as it lifts off)
    const glow = ctx.createRadialGradient(fig.x, FLOOR_Y + 2, 2, fig.x, FLOOR_Y + 2, 70);
    glow.addColorStop(0, colorWithAlpha(look.color, 0.45 * (1 - Math.min(1, fig.lift / 200))));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(fig.x, FLOOR_Y + 2, 70, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Speed trail: fading copies behind the Volt Runner while it sprints
    if (fig.running) {
      for (const k of [3, 2, 1]) {
        ctx.save();
        ctx.globalAlpha = 0.1 * (4 - k);
        drawBossBody(ctx, fig.x - fig.facing * 26 * k, fig.lift, fig.facing, 0, pose, look, false, beat);
        ctx.restore();
      }
    }
    drawBossBody(ctx, fig.x, fig.lift, fig.facing, punch, pose, look, hurt, beat);
  }
}

function drawBossBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  lift: number,
  facing: 1 | -1,
  punch: number,
  pose: ReturnType<typeof enemyPoseFor>,
  look: BossLook,
  hurt: boolean,
  beat: number
) {
  const main = hurt ? '#ffffff' : look.color;
  const accent = hurt ? '#ffffff' : look.accent;
  ctx.save();
  ctx.translate(x, -lift);
  ctx.translate(0, 68);
  ctx.rotate(facing * 0.16 * punch);
  ctx.scale(BOSS_SCALE * facing, BOSS_SCALE);
  ctx.translate(0, -68);
  ctx.strokeStyle = main;
  ctx.shadowColor = main;
  ctx.shadowBlur = 22;
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawEnemyArt(ctx, pose, look.band, look.tier, { main, accent }, beat, hurt);

  if (look.crown) {
    const h = pose.head;
    ctx.fillStyle = accent;
    ctx.shadowColor = look.accent;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(h.x - 9, h.y - 10);
    ctx.lineTo(h.x - 10, h.y - 21);
    ctx.lineTo(h.x - 5, h.y - 15);
    ctx.lineTo(h.x, h.y - 24);
    ctx.lineTo(h.x + 5, h.y - 15);
    ctx.lineTo(h.x + 10, h.y - 21);
    ctx.lineTo(h.x + 9, h.y - 10);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * A fist thrown by the boss: a ball of energy that swells as it flies, from the
 * boss's colour to white-hot, crackling at the end, and is fullest exactly on
 * its beat, like it's about to burst. That swell is the timing cue.
 */
function drawBossFist(ctx: CanvasRenderingContext2D, enemy: Enemy, engine: GameEngine, flash: boolean, grow = 1) {
  const look = BOSS_LOOKS[engine.boss?.plan.kind ?? 'leaper'];
  const away = enemy.x < 0 ? -1 : 1;
  const y = -6;
  // 0 when thrown, 1 on the beat
  const u = Math.min(1, Math.max(0, 1 - (enemy.targetTime - engine.songTime) / engine.fistFlight));
  const r = (5 + 12 * Math.pow(u, 1.6)) * grow;
  const outer = flash ? '#ffffff' : heatColor(look.color, Math.max(0, u - 0.35) * 1.2);
  const core = flash ? '#ffffff' : heatColor(look.accent, u * u);
  ctx.save();
  ctx.lineCap = 'round';
  if (!flash) {
    const tail = ctx.createLinearGradient(enemy.x, y, enemy.x + away * 34, y);
    tail.addColorStop(0, colorWithAlpha(look.accent, 0.7));
    tail.addColorStop(1, colorWithAlpha(look.color, 0));
    ctx.strokeStyle = tail;
    ctx.lineWidth = r * 1.1;
    ctx.beginPath();
    ctx.moveTo(enemy.x, y);
    ctx.lineTo(enemy.x + away * 34, y);
    ctx.stroke();
  }
  ctx.fillStyle = outer;
  ctx.shadowColor = flash ? '#ffffff' : look.accent;
  ctx.shadowBlur = 10 + 26 * u;
  ctx.beginPath();
  ctx.arc(enemy.x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(enemy.x, y, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  // Crackling sparks over the last stretch: it's about to go
  if (!flash && u > 0.7) {
    const k = (u - 0.7) / 0.3;
    const spin = engine.songTime * 9 + enemy.targetTime * 3;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = spin + (i * Math.PI) / 3;
      ctx.moveTo(enemy.x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(enemy.x + Math.cos(a) * r * (1 + 0.7 * k), y + Math.sin(a) * r * (1 + 0.7 * k));
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Fists the player hit back: white-hot, a tail streaming behind, curving into the boss. */
function drawReturningFists(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  if (!engine.boss || engine.returningFists.length === 0) return;
  const look = BOSS_LOOKS[engine.boss.plan.kind];
  const now = performance.now();
  ctx.save();
  ctx.lineCap = 'round';
  for (const f of engine.returningFists) {
    const p = engine.returnedFistPosition(f, now);
    const back = engine.returnedFistPosition(f, now - 45);
    const r = 9 + 4 * Math.sin(p.u * Math.PI);
    const tail = ctx.createLinearGradient(p.x, p.y, back.x, back.y);
    tail.addColorStop(0, colorWithAlpha('#ffffff', 0.9));
    tail.addColorStop(1, colorWithAlpha(look.accent, 0));
    ctx.strokeStyle = tail;
    ctx.lineWidth = r * 1.3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(back.x + (back.x - p.x) * 1.5, back.y + (back.y - p.y) * 1.5);
    ctx.stroke();
    ctx.fillStyle = heatColor(look.accent, 0.6);
    ctx.shadowColor = look.accent;
    ctx.shadowBlur = 26;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

/** The arcade font for big canvas text (as on the menus), with fallbacks while it loads */
const ARCADE_FONT = 'Anton, Impact, "Arial Narrow", sans-serif';

/** The K.O. stamp over the fight when the boss falls: slams in big and tilted, like the menus' stamps. */
function drawBossKo(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  const boss = engine.boss;
  if (!boss || !boss.ko) return;
  const age = (performance.now() - boss.koAt) / 1000;
  if (age > 2.4) return;
  const gold = BOSS_LOOKS.leaper.accent;
  // From 2.2x down past 1 and back (as .arc-stamp), then a slow drift bigger
  const t = Math.min(1, age / 0.3);
  const slam = t < 0.6 ? 2.2 - (2.2 - 0.92) * (t / 0.6) : 0.92 + 0.08 * ((t - 0.6) / 0.4);
  ctx.save();
  ctx.translate(0, -120);
  ctx.rotate((-6 * Math.PI) / 180);
  ctx.scale(slam + age * 0.03, slam + age * 0.03);
  ctx.globalAlpha = Math.min(1, age / 0.1, (2.4 - age) / 0.4);
  ctx.font = `italic 64px ${ARCADE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // The split-colour shadow of the menus' titles, then a hard black drop
  ctx.fillStyle = '#000000';
  ctx.fillText('K.O.!', 0, 6);
  ctx.fillStyle = '#ff1f6d';
  ctx.fillText('K.O.!', 3, 0);
  ctx.fillStyle = '#00e5ff';
  ctx.fillText('K.O.!', -3, 0);
  ctx.fillStyle = gold;
  ctx.shadowColor = gold;
  ctx.shadowBlur = 24;
  ctx.fillText('K.O.!', 0, 0);
  ctx.restore();
}

/**
 * How much health each boss bar showed a moment ago: the bar keeps a pale
 * chunk where the last hit landed, which drains away after a beat (as in
 * fighting games). Keyed by boss and bar.
 */
const bossTrails = new Map<string, { value: number; holdUntil: number; at: number }>();

function trailFor(key: string, share: number, now: number): number {
  const st = bossTrails.get(key);
  if (!st || share > st.value + 1e-6) {
    bossTrails.set(key, { value: share, holdUntil: now, at: now });
    return share;
  }
  if (share < st.value - 1e-6 && st.holdUntil <= st.at) st.holdUntil = now + 380;
  const dt = (now - st.at) / 1000;
  st.at = now;
  if (now >= st.holdUntil) {
    st.value = Math.max(share, st.value - dt * 0.9);
    if (st.value <= share + 1e-6) st.holdUntil = 0;
  }
  return st.value;
}

/** A slanted (parallelogram) path, like the menus' buttons */
function slantPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cut: number) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

/**
 * The boss's name and health along the bottom of the screen (clear of the HUD
 * at the top), fighting-game style: a slanted bar in the boss's colour with a
 * notch for every fist it has (each fist does the same damage), a pale chunk
 * that drains after each hit, and a BOSS tag by its name. The twins get a bar
 * each. Sized in the arcade unit, like the HUD.
 */
function drawBossBar(ctx: CanvasRenderingContext2D, engine: GameEngine, width: number, height: number) {
  const boss = engine.boss;
  if (!boss || boss.ko || !engine.track) return;
  if (!bossFigures(boss.plan, engine.songTime, engine.fistFlight)[0].visible) return;
  const look = BOSS_LOOKS[boss.plan.kind];

  const u = Math.min(height / 100, width * 0.005625);
  const now = performance.now();
  const w = Math.min(84 * u, width * 0.46);
  const left = (width - w) / 2;
  const barH = Math.max(10, 3.2 * u);
  const y = height - Math.max(12, 3.6 * u) - barH;
  const cut = barH * 0.8;
  const recentlyHurt = now - boss.hurtAt < 90;

  const bar = (x: number, barW: number, share: number, hurt: boolean, hp: number, key: string) => {
    const shown = Math.max(0, Math.min(1, share));
    const trail = trailFor(`${boss.plan.kind}:${key}`, shown, now);
    // The frame: a black slab a little bigger than the bar, with the boss's accent edge
    const pad = Math.max(2, 0.5 * u);
    ctx.fillStyle = 'rgba(5, 5, 12, 0.9)';
    slantPath(ctx, x - pad, y - pad, barW + pad * 2, barH + pad * 2, cut + pad);
    ctx.fill();
    ctx.save();
    slantPath(ctx, x, y, barW, barH, cut);
    ctx.clip();
    ctx.fillStyle = '#1b1b29';
    ctx.fillRect(x, y, barW, barH);
    // The pale chunk the last hit took, draining
    // (each share is a slanted slab, so its end runs parallel to the bar's ends and notches)
    const slab = (f: number) => slantPath(ctx, x, y, cut + (barW - cut) * f, barH, cut);
    if (trail > shown) {
      ctx.fillStyle = 'rgba(255, 241, 168, 0.85)';
      slab(trail);
      ctx.fill();
    }
    // What's left: the boss's colour, lighter along the top
    const g = ctx.createLinearGradient(0, y, 0, y + barH);
    g.addColorStop(0, hurt ? '#ffffff' : colorWithAlpha(look.accent, 1));
    g.addColorStop(0.45, hurt ? '#ffffff' : look.color);
    g.addColorStop(1, hurt ? '#ffffff' : colorWithAlpha(look.color, 0.75));
    ctx.fillStyle = g;
    ctx.shadowColor = look.color;
    ctx.shadowBlur = 12;
    if (shown > 0) {
      slab(shown);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // A notch for each fist (only when there are few enough to read)
    if (hp > 1 && hp <= 40) {
      ctx.fillStyle = 'rgba(5, 5, 12, 0.55)';
      const notch = Math.max(1, 0.25 * u);
      for (let i = 1; i < hp; i++) {
        const nx = x + ((barW - cut) * i) / hp;
        ctx.save();
        ctx.translate(nx, y);
        ctx.transform(1, 0, -cut / barH, 1, 0, 0);
        ctx.fillRect(-notch / 2 + cut, 0, notch, barH);
        ctx.restore();
      }
    }
    ctx.restore();
    ctx.strokeStyle = colorWithAlpha(look.accent, 0.9);
    ctx.lineWidth = Math.max(1, 0.25 * u);
    slantPath(ctx, x - pad, y - pad, barW + pad * 2, barH + pad * 2, cut + pad);
    ctx.stroke();
  };

  ctx.save();
  // The name: a yellow BOSS tag, then the name in the arcade font
  const nameSize = Math.max(14, 4.2 * u);
  const baseY = y - Math.max(5, 1.6 * u);
  const tagSize = Math.max(9, 1.9 * u);
  ctx.font = `900 ${tagSize}px "Outfit", sans-serif`;
  const tagText = 'BOSS';
  const spacing = tagSize * 0.18;
  let tagW = 0;
  for (const ch of tagText) tagW += ctx.measureText(ch).width + spacing;
  const tagPadX = tagSize * 0.7;
  const tagH = tagSize * 1.6;
  const tagX = left + cut;
  const tagY = baseY - nameSize * 0.42 - tagH / 2;
  ctx.fillStyle = '#ffe600';
  slantPath(ctx, tagX, tagY, tagW + tagPadX * 2, tagH, tagH * 0.35);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'middle';
  let cx = tagX + tagPadX;
  for (const ch of tagText) {
    ctx.fillText(ch, cx, tagY + tagH / 2 + tagSize * 0.05);
    cx += ctx.measureText(ch).width + spacing;
  }
  ctx.textBaseline = 'alphabetic';
  ctx.font = `italic ${nameSize}px ${ARCADE_FONT}`;
  ctx.textAlign = 'left';
  const nameX = tagX + tagW + tagPadX * 2 + Math.max(6, 1.4 * u);
  ctx.fillStyle = '#000000';
  ctx.fillText(look.name.toUpperCase(), nameX, baseY + Math.max(2, 0.5 * u));
  ctx.fillStyle = look.accent;
  ctx.shadowColor = look.accent;
  ctx.shadowBlur = 10;
  ctx.fillText(look.name.toUpperCase(), nameX, baseY);
  ctx.shadowBlur = 0;

  if (boss.plan.kind === 'twins') {
    const gap = Math.max(10, 2.4 * u);
    const half = (w - gap) / 2;
    for (const side of ['left', 'right'] as const) {
      const full = boss.plan.sideHp[side];
      bar(side === 'left' ? left : left + half + gap, half, full > 0 ? boss.shownSideHp[side] / full : 0, recentlyHurt && boss.hurtSide === side, full, side);
    }
  } else {
    bar(left, w, boss.shownHp / boss.plan.maxHp, recentlyHurt, boss.plan.maxHp, 'all');
  }
  ctx.restore();
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
    applyHeroBuild(ctx, engine.hero.id, facing, true, tier.ascended);
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
    applyHeroBuild(ctx, engine.hero.id, facing, true, tier.ascended);
    drawSlashCrescent(ctx, pose.bladeSlash);
    drawShotFlash(ctx, pose, facing);
    if (engine.hero.id === 'theOne') drawImpactRipple(ctx, pose);
    if (engine.hero.id === 'scarecrow') {
      drawFlyingArmOverHit(ctx, pose, tier, facing);
      drawStrawBurst(ctx, pose);
    }
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

/**
 * The hit lists up the sides (see hitLog): left-lane hits on the left,
 * right-lane hits on the right. The newest line comes in at the bottom with
 * a little pop, pushing the older ones up; older lines dim, and each fades
 * out after a few seconds so the sky clears when the fight goes quiet.
 */
function drawHitLists(ctx: CanvasRenderingContext2D, log: HitLogEntry[], width: number, height: number, horizon: number, lowest: number, scale: number, hud: HudBox | null) {
  const area = hitLogArea(width, height, horizon, lowest, scale, hud);
  const now = performance.now();
  // Never smaller than this, even on a phone
  const big = Math.max(11, Math.round(area.lineH * 0.74));
  const small = Math.max(9, Math.round(area.lineH * 0.52));
  const gap = Math.round(area.lineH * 0.3);
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  for (const lane of ['left', 'right'] as const) {
    const lines = log.filter((e) => e.lane === lane).slice(-area.rows);
    if (lines.length === 0) continue;
    // Slide the older lines up by one as the newest comes in
    const newestAge = (now - lines[lines.length - 1].at) / 1000;
    const slide = 1 - smoothstep(0, 0.12, newestAge);
    for (let i = lines.length - 1; i >= 0; i--) {
      const e = lines[i];
      const slot = lines.length - 1 - i;
      const age = (now - e.at) / 1000;
      // The newest fades in at the bottom; the rest slide up from the line below
      const y = area.bottom - (slot === 0 ? 0 : slot - slide) * area.lineH;
      const fade = Math.min(1, (HIT_LOG_SECONDS - age) / HIT_LOG_FADE_SECONDS);
      const alpha = Math.max(0, fade) * (slot === 0 ? 1 - slide * 0.8 : 1 - (slot / area.rows) * 0.65);
      if (alpha <= 0.01) continue;
      const color = JUDGEMENT_COLORS[e.text];
      // The pieces of the line: judgement, early/late, move
      const parts: { text: string; font: string; fill: string; glow: boolean }[] = [
        { text: e.text, font: `900 ${big}px "Outfit", sans-serif`, fill: color, glow: true },
      ];
      if (e.detail) parts.push({ text: e.detail, font: `800 ${small}px "JetBrains Mono", monospace`, fill: e.detail === 'EARLY' ? '#7dd3fc' : '#fda4af', glow: false });
      if (e.move) parts.push({ text: e.move.toUpperCase(), font: `800 ${small + 1}px "Outfit", sans-serif`, fill: '#e2e8f0', glow: false });
      const widths = parts.map((p) => {
        ctx.font = p.font;
        return ctx.measureText(p.text).width;
      });
      const total = widths.reduce((a, w) => a + w, 0) + gap * (parts.length - 1);
      const squeeze = Math.min(1, area.maxWidth / total);
      const pop = slot === 0 ? 1 + 0.18 * (1 - smoothstep(0, 0.15, age)) : 1;
      const left = lane === 'left' ? area.leftX : area.rightX - total * squeeze * pop;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(left, y);
      ctx.scale(squeeze * pop, pop);
      let x = 0;
      parts.forEach((p, k) => {
        ctx.font = p.font;
        ctx.fillStyle = p.fill;
        ctx.shadowColor = p.fill;
        ctx.shadowBlur = p.glow ? 14 : 0;
        ctx.fillText(p.text, x, 0);
        if (p.glow) {
          // A white-hot core on the judgement word, like the old pop-up
          ctx.shadowBlur = 0;
          ctx.globalAlpha = alpha * 0.55;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(p.text, x, 0);
          ctx.globalAlpha = alpha;
        }
        x += widths[k] + gap;
      });
      ctx.restore();
    }
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
