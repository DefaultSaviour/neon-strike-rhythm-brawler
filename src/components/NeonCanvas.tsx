import React, { useRef, useEffect } from 'react';
import { GameEngine } from '../game/gameEngine';
import { Point2D, DebrisPiece } from '../types/game';
import { ATTACK_MOVES, getMoveForCombo } from '../game/animations';
import { getEnemyStyle, resolveBandTier } from '../game/enemyStyles';
import { audioEngine } from '../audio/audioEngine';

interface NeonCanvasProps {
  engine: GameEngine;
  scanlines: boolean;
}

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

      // Update engine physics (enemies, debris, conveyor belt forces)
      engine.update(dt, width);

      // Inward conveyor scrolling
      const bpm = engine.track?.bpm || 120;
      const conveyorSpeed = engine.conveyorSpeed * (bpm / 120);
      conveyorOffset = (conveyorOffset + dt * conveyorSpeed) % 50;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Deep void background
      ctx.fillStyle = '#060713';
      ctx.fillRect(0, 0, width, height);

      // Apply screen shake
      ctx.save();
      if (engine.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * engine.screenShake * 1.5;
        const shakeY = (Math.random() - 0.5) * engine.screenShake * 1.5;
        ctx.translate(shakeX, shakeY);
      }

      const horizonY = height * 0.44;
      const runwayTopY = height * 0.58;
      const runwayBottomY = height * 0.92;
      const runwayCenterY = (runwayTopY + runwayBottomY) / 2;
      const groundY = runwayCenterY + 15; // Characters physically stand on this runway line
      const centerX = width / 2;
      const pitRadius = engine.pitRadius;

      // 1. Atmosphere & Sun
      drawAtmosphereAndSun(ctx, centerX, horizonY, width);

      // 2. Horizon Visualizer
      drawHorizonVisualizer(ctx, width, horizonY);

      // 3. Third Vertical Conveyor (Top down to player, for Jump Hurdles)
      drawVerticalConveyor(ctx, centerX, groundY, conveyorOffset);

      // 4. Dual Converging Conveyor Floors (Left moves Right -> Pit <- Right moves Left)
      drawConvergingConveyors(
        ctx,
        centerX,
        runwayTopY,
        runwayBottomY,
        width,
        pitRadius,
        conveyorOffset
      );

      // 4. Central Abyss Pit & Grinder (Behind/Underneath the player)
      drawCentralPit(ctx, centerX, groundY, runwayBottomY, pitRadius);

      // 5. Tactical Strike Range Brackets
      drawTacticalStrikeZones(ctx, centerX, groundY, engine);

      // 6. Ground Shadows & Underglow
      drawFloorShadowsAndReflections(ctx, centerX, groundY, engine, pitRadius);

      // 7. Exploded Debris Shapes (Tumbling on conveyors and into the pit!)
      drawDebrisPieces(ctx, centerX, groundY, engine);

      // 8. Full-Sized Cyber Enemies (Same scale as the player!)
      drawFullSizedEnemies(ctx, centerX, groundY, engine);

      // 9. Player Neon Cyber-Fighter
      drawPlayer(ctx, centerX, groundY, engine);

      // 10. Hit Sparks & Particles
      drawParticles(ctx, centerX, groundY, engine);

      // 11. Floating Timing Judgements
      drawJudgements(ctx, centerX, groundY, engine);

      ctx.restore();

      // 12. Scanlines
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

function drawAtmosphereAndSun(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  horizonY: number,
  width: number
) {
  const bassPulse = audioEngine.bassMeter * 0.25;

  const horizonGlow = ctx.createRadialGradient(
    centerX,
    horizonY,
    20,
    centerX,
    horizonY,
    width * 0.65
  );
  horizonGlow.addColorStop(0, `rgba(255, 0, 127, ${0.35 + bassPulse})`);
  horizonGlow.addColorStop(0.4, 'rgba(121, 40, 202, 0.18)');
  horizonGlow.addColorStop(1, 'rgba(6, 7, 19, 0)');
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, horizonY - 260, width, 400);

  const sunRadius = 75 + bassPulse * 15;
  const sunCenterY = horizonY - 12;

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, sunCenterY, sunRadius, Math.PI, 0, false);
  ctx.lineTo(centerX + sunRadius, sunCenterY);
  ctx.lineTo(centerX - sunRadius, sunCenterY);
  ctx.closePath();

  const sunGrad = ctx.createLinearGradient(0, sunCenterY - sunRadius, 0, sunCenterY);
  sunGrad.addColorStop(0, '#ffe600');
  sunGrad.addColorStop(0.5, '#ff007f');
  sunGrad.addColorStop(1, '#7928ca');
  ctx.fillStyle = sunGrad;
  ctx.fill();

  ctx.fillStyle = '#060713';
  for (let i = 1; i <= 6; i++) {
    const y = sunCenterY - 12 * i;
    const stripeHeight = 1.6 + i * 1.1;
    ctx.fillRect(centerX - sunRadius - 5, y, sunRadius * 2 + 10, stripeHeight);
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#00f3ff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(width, horizonY);
  ctx.stroke();
  ctx.restore();
}

function drawHorizonVisualizer(ctx: CanvasRenderingContext2D, width: number, horizonY: number) {
  const bars = 48;
  const barWidth = width / bars;
  const bass = audioEngine.bassMeter;
  const treble = audioEngine.trebleMeter;

  ctx.save();
  for (let i = 0; i < bars; i++) {
    const norm = Math.abs(i - bars / 2) / (bars / 2);
    const isLeft = i < bars / 2;
    const factor = isLeft ? bass * (1 - norm) : treble * (1 - norm);
    const h = factor * 45 + Math.sin(performance.now() * 0.006 + i) * 6;

    if (h > 4) {
      const grad = ctx.createLinearGradient(0, horizonY - h, 0, horizonY);
      grad.addColorStop(0, isLeft ? 'rgba(0, 243, 255, 0.7)' : 'rgba(255, 0, 127, 0.7)');
      grad.addColorStop(1, 'rgba(6, 7, 19, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(i * barWidth + 1, horizonY - h, barWidth - 2, h);
    }
  }
  ctx.restore();
}

// DUAL CONVERGING CONVEYOR FLOORS:
// Left side moves RIGHT (inwards towards the pit: >>>>>)
// Right side moves LEFT (inwards towards the pit: <<<<<)
function drawConvergingConveyors(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  runwayTopY: number,
  runwayBottomY: number,
  width: number,
  pitRadius: number,
  conveyorOffset: number
) {
  const runwayH = runwayBottomY - runwayTopY;
  const leftEnd = centerX - pitRadius;
  const rightStart = centerX + pitRadius;

  ctx.save();

  // 1. LEFT CONVEYOR BELT (Surface from 0 to leftEnd)
  const leftGrad = ctx.createLinearGradient(0, runwayTopY, 0, runwayBottomY);
  leftGrad.addColorStop(0, '#0a0d24');
  leftGrad.addColorStop(0.5, '#0e1232');
  leftGrad.addColorStop(1, '#07091a');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, runwayTopY, leftEnd, runwayH);

  // 2. RIGHT CONVEYOR BELT (Surface from rightStart to width)
  const rightGrad = ctx.createLinearGradient(0, runwayTopY, 0, runwayBottomY);
  rightGrad.addColorStop(0, '#1c0a1a');
  rightGrad.addColorStop(0.5, '#280e25');
  rightGrad.addColorStop(1, '#140612');
  ctx.fillStyle = rightGrad;
  ctx.fillRect(rightStart, runwayTopY, width - rightStart, runwayH);

  // Top and Bottom Rails
  ctx.save();
  ctx.strokeStyle = '#00f3ff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 2.5;

  // Left rails
  ctx.beginPath();
  ctx.moveTo(0, runwayTopY);
  ctx.lineTo(leftEnd, runwayTopY);
  ctx.moveTo(0, runwayBottomY);
  ctx.lineTo(leftEnd, runwayBottomY);
  ctx.stroke();

  // Right rails (Hot Magenta)
  ctx.strokeStyle = '#ff007f';
  ctx.shadowColor = '#ff007f';
  ctx.beginPath();
  ctx.moveTo(rightStart, runwayTopY);
  ctx.lineTo(width, runwayTopY);
  ctx.moveTo(rightStart, runwayBottomY);
  ctx.lineTo(width, runwayBottomY);
  ctx.stroke();
  ctx.restore();

  // LEFT INWARD MOVING CHEVRONS & SEGMENTS (Moving RIGHT >>>)
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 243, 255, 0.22)';
  ctx.lineWidth = 2;
  const segmentDist = 50;

  for (let x = -segmentDist + conveyorOffset; x < leftEnd; x += segmentDist) {
    if (x >= 0 && x <= leftEnd) {
      // Chevron pointing RIGHT >>>
      ctx.beginPath();
      ctx.moveTo(x - 12, runwayTopY + 12);
      ctx.lineTo(x, runwayTopY + runwayH * 0.5);
      ctx.lineTo(x - 12, runwayBottomY - 12);
      ctx.stroke();
    }
  }

  // RIGHT INWARD MOVING CHEVRONS & SEGMENTS (Moving LEFT <<<)
  ctx.strokeStyle = 'rgba(255, 0, 127, 0.25)';
  for (let x = width + segmentDist - conveyorOffset; x > rightStart; x -= segmentDist) {
    if (x >= rightStart && x <= width) {
      // Chevron pointing LEFT <<<
      ctx.beginPath();
      ctx.moveTo(x + 12, runwayTopY + 12);
      ctx.lineTo(x, runwayTopY + runwayH * 0.5);
      ctx.lineTo(x + 12, runwayBottomY - 12);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// THIRD VERTICAL CONVEYOR: Vertical conveyor lane coming straight down from the top to the player
function drawVerticalConveyor(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  groundY: number,
  conveyorOffset: number
) {
  const laneW = 86;
  const leftX = centerX - laneW / 2;
  const rightX = centerX + laneW / 2;
  const topY = 0;
  const bottomY = groundY + 12;

  ctx.save();

  // 1. Vertical Conveyor Belt Surface Gradient
  const laneGrad = ctx.createLinearGradient(leftX, 0, rightX, 0);
  laneGrad.addColorStop(0, '#070b20');
  laneGrad.addColorStop(0.5, '#0c1334');
  laneGrad.addColorStop(1, '#070b20');
  ctx.fillStyle = laneGrad;
  ctx.fillRect(leftX, topY, laneW, bottomY - topY);

  // 2. Vertical Glowing Neon Guide Rails
  ctx.strokeStyle = '#00f3ff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 2.5;

  // Left vertical rail
  ctx.beginPath();
  ctx.moveTo(leftX, topY);
  ctx.lineTo(leftX, bottomY);
  // Right vertical rail
  ctx.moveTo(rightX, topY);
  ctx.lineTo(rightX, bottomY);
  ctx.stroke();

  // White inner rail accents
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.0;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(leftX, topY);
  ctx.lineTo(leftX, bottomY);
  ctx.moveTo(rightX, topY);
  ctx.lineTo(rightX, bottomY);
  ctx.stroke();

  // 3. Downward-moving chevrons (vvvvv) synchronized with conveyorOffset!
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 243, 255, 0.28)';
  ctx.lineWidth = 2.2;
  const stepDist = 50;

  for (let y = topY - stepDist + conveyorOffset; y < bottomY - 15; y += stepDist) {
    if (y >= topY && y <= bottomY - 15) {
      // Downward pointing chevron vvv
      ctx.beginPath();
      ctx.moveTo(leftX + 16, y - 10);
      ctx.lineTo(centerX, y + 6);
      ctx.lineTo(rightX - 16, y - 10);
      ctx.stroke();
    }
  }
  ctx.restore();

  // 4. Hurdle Jump Zone Threshold Bar (Right across the vertical conveyor at player feet level)
  ctx.save();
  ctx.strokeStyle = '#00f3ff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 14;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(leftX - 4, groundY);
  ctx.lineTo(rightX + 4, groundY);
  ctx.stroke();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.shadowBlur = 0;
  ctx.stroke();

  // "▲ JUMP ▲" indicator glow at the base
  ctx.fillStyle = 'rgba(0, 243, 255, 0.7)';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('▲ JUMP ▲', centerX, groundY + 10);
  ctx.restore();

  ctx.restore();
}

// CENTRAL ABYSS PIT: Deep incinerator void behind/beneath the player where debris falls
function drawCentralPit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  groundY: number,
  runwayBottomY: number,
  pitRadius: number
) {
  const pitLeft = centerX - pitRadius;
  const pitRight = centerX + pitRadius;
  const pitW = pitRadius * 2;
  const pitTopY = groundY - 20;
  const pitBottomY = runwayBottomY + 25;

  ctx.save();

  // Deep black abyss void
  const pitVoid = ctx.createLinearGradient(0, pitTopY, 0, pitBottomY);
  pitVoid.addColorStop(0, '#04040a');
  pitVoid.addColorStop(0.6, '#080518');
  pitVoid.addColorStop(1, '#ff007f33');
  ctx.fillStyle = pitVoid;
  ctx.fillRect(pitLeft, pitTopY, pitW, pitBottomY - pitTopY);

  // Pit Hazard Walls & Neon Rim
  ctx.strokeStyle = '#ffe600';
  ctx.shadowColor = '#ffe600';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 2.5;

  // Left pit rim wall
  ctx.beginPath();
  ctx.moveTo(pitLeft, pitTopY);
  ctx.lineTo(pitLeft, pitBottomY);
  ctx.stroke();

  // Right pit rim wall
  ctx.beginPath();
  ctx.moveTo(pitRight, pitTopY);
  ctx.lineTo(pitRight, pitBottomY);
  ctx.stroke();

  // Incinerator glow at bottom of the pit
  const glow = ctx.createRadialGradient(
    centerX,
    pitBottomY,
    5,
    centerX,
    pitBottomY,
    pitRadius * 1.4
  );
  glow.addColorStop(0, 'rgba(255, 0, 127, 0.7)');
  glow.addColorStop(0.5, 'rgba(121, 40, 202, 0.3)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(pitLeft - 10, pitBottomY - 40, pitW + 20, 60);

  // Central Combat Bridge Platform for the player (spanning across the pit)
  ctx.strokeStyle = '#00f3ff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pitLeft - 6, groundY + 12);
  ctx.lineTo(pitRight + 6, groundY + 12);
  ctx.stroke();

  // Bridge core
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.shadowBlur = 0;
  ctx.stroke();

  ctx.restore();
}

function drawTacticalStrikeZones(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  groundY: number,
  engine: GameEngine
) {
  const hitDist = engine.hitLineOffset;
  const leftX = centerX - hitDist;
  const rightX = centerX + hitDist;

  const nowTime = audioEngine.getPlaybackTime();
  const leftEnemyInRange = engine.enemies.some(
    (e) => !e.defeated && e.lane === 'left' && Math.abs(e.targetTime - nowTime) < 0.22
  );
  const rightEnemyInRange = engine.enemies.some(
    (e) => !e.defeated && e.lane === 'right' && Math.abs(e.targetTime - nowTime) < 0.22
  );
  const airEnemyInRange = engine.enemies.some(
    (e) => !e.defeated && e.lane === 'air' && Math.abs(e.targetTime - nowTime) < 0.22
  );

  ctx.save();

  const leftAlpha = leftEnemyInRange ? 0.95 : 0.45;
  ctx.strokeStyle = `rgba(0, 243, 255, ${leftAlpha})`;
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = leftEnemyInRange ? 18 : 6;
  ctx.lineWidth = leftEnemyInRange ? 3 : 2;

  ctx.beginPath();
  ctx.moveTo(leftX - 18, groundY - 65);
  ctx.lineTo(leftX, groundY - 65);
  ctx.lineTo(leftX, groundY + 12);
  ctx.lineTo(leftX - 18, groundY + 12);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(leftX, groundY + 8, 22, 8, 0, 0, Math.PI * 2);
  ctx.stroke();

  const rightAlpha = rightEnemyInRange ? 0.95 : 0.45;
  ctx.strokeStyle = `rgba(255, 0, 127, ${rightAlpha})`;
  ctx.shadowColor = '#ff007f';
  ctx.shadowBlur = rightEnemyInRange ? 18 : 6;
  ctx.lineWidth = rightEnemyInRange ? 3 : 2;

  ctx.beginPath();
  ctx.moveTo(rightX + 18, groundY - 65);
  ctx.lineTo(rightX, groundY - 65);
  ctx.lineTo(rightX, groundY + 12);
  ctx.lineTo(rightX + 18, groundY + 12);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(rightX, groundY + 8, 22, 8, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Center Vertical Hurdle Jump Threshold
  const airAlpha = airEnemyInRange ? 1.0 : 0.45;
  ctx.strokeStyle = `rgba(0, 243, 255, ${airAlpha})`;
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = airEnemyInRange ? 22 : 8;
  ctx.lineWidth = airEnemyInRange ? 3.5 : 2;

  ctx.beginPath();
  ctx.moveTo(centerX - 43, groundY);
  ctx.lineTo(centerX + 43, groundY);
  ctx.stroke();

  if (airEnemyInRange) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 14;
    ctx.font = '900 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('▲ JUMP! ▲', centerX, groundY - 14);
    ctx.restore();
  }

  ctx.restore();
}

function drawFloorShadowsAndReflections(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  groundY: number,
  engine: GameEngine,
  pitRadius: number
) {
  ctx.save();

  // Player Ground Shadow
  const pShadow = ctx.createRadialGradient(
    centerX,
    groundY + 10,
    2,
    centerX,
    groundY + 10,
    35
  );
  pShadow.addColorStop(0, 'rgba(0, 243, 255, 0.55)');
  pShadow.addColorStop(0.5, 'rgba(0, 243, 255, 0.2)');
  pShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = pShadow;
  ctx.beginPath();
  ctx.ellipse(centerX, groundY + 10, 36, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Full-size enemy ground shadows (ground enemies only)
  for (const enemy of engine.enemies) {
    if (enemy.defeated || enemy.lane === 'air' || Math.abs(enemy.x) > window.innerWidth / 2 + 60) continue;

    const posX = centerX + enemy.x;
    if (Math.abs(enemy.x) < pitRadius) continue; // don't draw shadow over empty pit

    const eShadow = ctx.createRadialGradient(
      posX,
      groundY + 10,
      2,
      posX,
      groundY + 10,
      35
    );
    eShadow.addColorStop(0, colorWithAlpha(enemy.color, 0.55));
    eShadow.addColorStop(0.6, 'rgba(0, 0, 0, 0.35)');
    eShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = eShadow;
    ctx.beginPath();
    ctx.ellipse(posX, groundY + 10, 32, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// EXPLODED DEBRIS PIECES: Basic shapes that fly all over the place and sweep into the pit
function drawDebrisPieces(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  groundY: number,
  engine: GameEngine
) {
  ctx.save();
  ctx.translate(centerX, groundY);

  for (const p of engine.debris) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = Math.max(0, p.alpha);

    ctx.strokeStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = p.color;
    ctx.lineWidth = 2;

    if (p.shapeType === 'head') {
      // Exploded head circle with eye slit
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-3, -2, 6, 2);
    } else if (p.shapeType === 'chest' && p.points) {
      // Exploded chest armor plate polygon
      ctx.beginPath();
      ctx.moveTo(p.points[0].x, p.points[0].y);
      for (let i = 1; i < p.points.length; i++) {
        ctx.lineTo(p.points[i].x, p.points[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (p.shapeType === 'arm') {
      // Limb capsule
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-p.size * 0.5, 0);
      ctx.lineTo(p.size * 0.5, 0);
      ctx.stroke();
    } else if (p.shapeType === 'leg') {
      // Leg bone segment
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-p.size * 0.5, 0);
      ctx.lineTo(p.size * 0.5, 0);
      ctx.stroke();
    } else if (p.shapeType === 'blade') {
      // Flying severed katana blade
      ctx.strokeStyle = '#ffe600';
      ctx.shadowColor = '#ffe600';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-p.size * 0.5, 0);
      ctx.lineTo(p.size * 0.5, 0);
      ctx.stroke();
    } else if (p.shapeType === 'barrier_beam') {
      // Shattered laser hurdle horizontal beam
      ctx.strokeStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(-p.size * 0.5, 0);
      ctx.lineTo(p.size * 0.5, 0);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    } else {
      // Geometric sharp shard
      ctx.beginPath();
      ctx.moveTo(-p.size, -p.size * 0.5);
      ctx.lineTo(p.size, 0);
      ctx.lineTo(-p.size * 0.5, p.size);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  ctx.restore();
}

// NEON HURDLE RECTANGLE: Obstacles on the third vertical conveyor that the player jumps over!
function drawVerticalHurdleRectangle(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  color: string,
  accent: string,
  tier: EnemyTier
) {
  const hurdleW = 82;
  const hurdleH = 20;
  const halfW = hurdleW / 2;
  const halfH = hurdleH / 2;
  const y = enemy.y; // Linear vertical coordinate down the conveyor

  ctx.save();
  ctx.translate(0, y);

  // 1. Vertical Motion Trails (streaming straight up the vertical conveyor lane)
  ctx.save();
  ctx.strokeStyle = colorWithAlpha(color, 0.35);
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(-halfW + 12, -halfH);
  ctx.lineTo(-halfW + 12, -halfH - 28);
  ctx.moveTo(0, -halfH);
  ctx.lineTo(0, -halfH - 42);
  ctx.moveTo(halfW - 12, -halfH);
  ctx.lineTo(halfW - 12, -halfH - 28);
  ctx.stroke();
  ctx.restore();

  // 2. Hurdle Outer Rectangle with Neon Glow
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = tier === 3 ? 24 : 16;
  ctx.lineWidth = 3.2;

  // Semi-transparent laser plasma fill
  ctx.fillStyle = colorWithAlpha(color, 0.25);
  ctx.beginPath();
  ctx.roundRect(-halfW, -halfH, hurdleW, hurdleH, 4);
  ctx.fill();
  ctx.stroke();

  // 3. Bright White Laser Core Line
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.6;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(-halfW + 8, 0);
  ctx.lineTo(halfW - 8, 0);
  ctx.stroke();

  // 4. Lateral High-Voltage Emitter Nodes (left and right power caps)
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 12;
  ctx.fillRect(-halfW - 3, -halfH - 2, 6, hurdleH + 4);
  ctx.fillRect(halfW - 3, -halfH - 2, 6, hurdleH + 4);

  // 5. Upward Jump Instruction Glyph [ ▲ JUMP ▲ ]
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.font = '900 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('▲ JUMP ▲', 0, 0);

  ctx.restore();
  ctx.restore();
}

// FULL-SIZED CYBER ENEMIES: Ground conveyor fighters on Left and Right
function drawFullSizedEnemies(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  groundY: number,
  engine: GameEngine
) {
  ctx.save();
  ctx.translate(centerX, groundY);

  for (const enemy of engine.enemies) {
    if (enemy.defeated || Math.abs(enemy.x) > window.innerWidth / 2 + 120) continue;

    const { band, tier } = resolveBandTier(enemy);
    const style = getEnemyStyle(band, tier);
    const mainColor = enemy.color || style.color;
    const accent = style.accent;
    const scale = style.scale;

    // AIR LANE: Draw sleek neon hurdle rectangles to jump over!
    if (enemy.lane === 'air') {
      drawVerticalHurdleRectangle(ctx, enemy, mainColor, accent, tier);
      continue;
    }

    const posX = enemy.x;
    const dir = enemy.lane === 'left' ? 1 : -1;
    const phase = enemy.animPhase;

    // Cyber ghost trail
    if (enemy.trailHistory.length > 0) {
      for (let t = 0; t < enemy.trailHistory.length; t++) {
        const tr = enemy.trailHistory[t];
        const trailAlpha = ((t + 1) / enemy.trailHistory.length) * 0.24;
        ctx.save();
        ctx.globalAlpha = trailAlpha;
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 2.2;
        ctx.strokeRect(tr.x - 12 * scale, (tr.y || 0) - 52 * scale, 24 * scale, 120 * scale);
        ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(posX, enemy.y || 0);

    // Anchor scaling so feet remain on the conveyor ground level (y = 68)
    ctx.translate(0, 68);
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

  ctx.restore();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  groundY: number,
  engine: GameEngine
) {
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
  const isAirAttack = engine.isAttacking && engine.attackDirection === 'air';
  const jumpProgress = isAirAttack
    ? Math.sin(
        Math.min(
          1,
          (performance.now() - engine.attackStartTime) / Math.max(1, engine.attackDuration)
        ) * Math.PI
      )
    : 0;
  const playerOffsetY = -jumpProgress * 70; // Leaps 70px skyward!
  ctx.translate(centerX, groundY + playerOffsetY);

  // Jump takeoff booster flames shooting downward
  if (jumpProgress > 0.15) {
    ctx.save();
    ctx.strokeStyle = '#00f3ff';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pose.leftFoot.x, pose.leftFoot.y);
    ctx.lineTo(pose.leftFoot.x + (Math.random() - 0.5) * 8, pose.leftFoot.y + 22 + Math.random() * 15);
    ctx.moveTo(pose.rightFoot.x, pose.rightFoot.y);
    ctx.lineTo(pose.rightFoot.x + (Math.random() - 0.5) * 8, pose.rightFoot.y + 22 + Math.random() * 15);
    ctx.stroke();
    ctx.restore();
  }

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
  if (pose.bladeSlash && engine.isAttacking) {
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
    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.fillStyle = tierColor;
    ctx.shadowColor = tierColor;
    ctx.shadowBlur = 12;
    ctx.textAlign = 'center';
    ctx.fillText(`${tierName} · ${move.name.toUpperCase()}`, 0, -92);
    ctx.restore();
  }

  ctx.restore();
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  groundY: number,
  engine: GameEngine
) {
  ctx.save();
  ctx.translate(centerX, groundY);

  for (const p of engine.particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.strokeStyle = p.color;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;

    if (p.sparkType === 'ring') {
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(p.x, 8, p.size, p.size * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.sparkType === 'ember') {
      // Pit heat embers rising upward
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.sparkType === 'line') {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  ctx.restore();
}

function drawJudgements(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  groundY: number,
  engine: GameEngine
) {
  ctx.save();
  ctx.translate(centerX, groundY);

  const now = performance.now();

  for (const j of engine.judgements) {
    const age = (now - j.createdAt) / 1000;
    const alpha = Math.max(0, 1 - age / 0.65);
    const floatY = j.y - age * 45;
    const scale = j.scale * (1 + Math.sin(Math.min(Math.PI, age * 12)) * 0.35);

    ctx.save();
    ctx.translate(j.x, floatY);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    ctx.font = '900 19px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = j.color;
    ctx.shadowColor = j.color;
    ctx.shadowBlur = 16;
    ctx.fillText(j.text, 0, 0);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(j.text, 0, 0);

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
