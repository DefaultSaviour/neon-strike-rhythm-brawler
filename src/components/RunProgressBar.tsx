import React, { useEffect, useRef } from 'react';
import { RunProgress, dashDuration, formatSongTime, runnerPositionAt } from '../game/runProgress';
import { enemyPose } from '../game/enemyMotion';
import { enemyBodyJoints } from './enemyArt';
import { drawNeonBody, neonHead, neonLimb, bodyFill } from './neonBody';

/**
 * Results-screen progress bar: a neon line the length of the song. Your fighter
 * dashes along it and stops where the run ended: a red X if you died, a
 * hands-up victory bounce at the flag if you cleared it. A gold marker shows
 * your best attempt before this one.
 */

interface RunProgressBarProps {
  run: RunProgress;
}

const HEIGHT = 112;
const PAD_X = 22;
const FIGHTER = '#00f3ff';

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export const RunProgressBar: React.FC<RunProgressBarProps> = ({ run }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 400;
    canvas.width = width * dpr;
    canvas.height = HEIGHT * dpr;

    const reduced = prefersReducedMotion();
    const start = performance.now();
    // Animate the dash, the landing, and a little of the end pose, then stop.
    const animLength = dashDuration(run.fraction) + 1.6;
    let frame = 0;

    const draw = (now: number) => {
      const elapsed = reduced ? animLength : (now - start) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFrame(ctx, width, run, elapsed);
      if (elapsed < animLength) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [run]);

  const best = run.previousBest;
  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ height: HEIGHT }}
        role="img"
        aria-label={`Progress: reached ${formatSongTime(run.reachedSec)} of ${formatSongTime(run.durationSec)}`}
      />
      <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-[11px] font-mono text-slate-400">
        <span>
          {run.cleared ? 'Cleared the whole song' : `Made it to ${formatSongTime(run.reachedSec)}`}{' '}
          <span className="text-slate-200 font-bold">({Math.round(run.fraction * 100)}%)</span>
        </span>
        <span className={run.isNewBest && best !== null ? 'text-amber-300 font-bold' : ''}>
          {best === null
            ? 'First attempt'
            : run.isNewBest
              ? `New best! (was ${Math.round(best * 100)}%)`
              : `Best: ${Math.round(best * 100)}%`}
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function drawFrame(ctx: CanvasRenderingContext2D, width: number, run: RunProgress, elapsed: number) {
  ctx.clearRect(0, 0, width, HEIGHT);
  const barY = HEIGHT - 30;
  const x0 = PAD_X;
  const x1 = width - PAD_X - 14; // leave room for the flag
  const xAt = (f: number) => x0 + (x1 - x0) * f;

  const dash = dashDuration(run.fraction);
  const pos = runnerPositionAt(elapsed, run.fraction);
  const arrived = elapsed >= dash;
  const sinceArrival = Math.max(0, elapsed - dash);
  const runnerX = xAt(pos);

  // Track: dim full length, with quarter ticks
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1b2140';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x0, barY);
  ctx.lineTo(x1, barY);
  ctx.stroke();
  ctx.strokeStyle = '#2a3260';
  ctx.lineWidth = 1;
  for (const q of [0.25, 0.5, 0.75]) {
    ctx.beginPath();
    ctx.moveTo(xAt(q), barY + 5);
    ctx.lineTo(xAt(q), barY + 9);
    ctx.stroke();
  }

  // Lit trail behind the runner
  if (pos > 0.001) {
    const grad = ctx.createLinearGradient(x0, 0, runnerX, 0);
    grad.addColorStop(0, '#00f3ff');
    grad.addColorStop(1, run.cleared ? '#ffe600' : '#ff007f');
    ctx.strokeStyle = grad;
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x0, barY);
    ctx.lineTo(runnerX, barY);
    ctx.stroke();
  }
  ctx.restore();

  // Start / end labels
  ctx.save();
  ctx.font = '600 10px "JetBrains Mono", monospace';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText('0:00', x0 - 4, barY + 20);
  ctx.textAlign = 'right';
  ctx.fillText(formatSongTime(run.durationSec), x1 + 14, barY + 20);
  ctx.restore();

  drawFlag(ctx, x1 + 6, barY, run.cleared && arrived);

  // Best attempt marker (the best BEFORE this run, so you can see if you beat it)
  if (run.previousBest !== null && run.previousBest < 0.999) {
    const bx = xAt(run.previousBest);
    const passed = pos >= run.previousBest;
    ctx.save();
    ctx.strokeStyle = '#ffd34d';
    ctx.fillStyle = '#ffd34d';
    ctx.shadowColor = '#ffd34d';
    ctx.shadowBlur = passed ? 14 : 6;
    ctx.globalAlpha = passed ? 1 : 0.75;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, barY - 9);
    ctx.lineTo(bx, barY + 9);
    ctx.stroke();
    // Small diamond on top
    ctx.beginPath();
    ctx.moveTo(bx, barY - 16);
    ctx.lineTo(bx + 4, barY - 12);
    ctx.lineTo(bx, barY - 8);
    ctx.lineTo(bx - 4, barY - 12);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = '800 9px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BEST', bx, barY - 20);
    ctx.restore();
  }

  // Speed streaks while dashing
  if (!arrived && pos > 0.01) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.45)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const y = barY - 14 - i * 11;
      ctx.beginPath();
      ctx.moveTo(runnerX - 14 - i * 4, y);
      ctx.lineTo(runnerX - 34 - i * 8, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // The fighter
  const scale = 0.4;
  let hop = 0;
  let pose;
  if (!arrived) {
    pose = enemyPose('run', elapsed * 5, 'agile');
  } else if (run.cleared) {
    pose = enemyPose('sway', 2 + sinceArrival * 3, 'agile');
    hop = Math.abs(Math.sin(sinceArrival * Math.PI * 1.8)) * 10;
  } else {
    pose = enemyPose('stand', 0, 'agile');
  }
  ctx.save();
  // World units: feet at y = 68. Map so feet sit on the bar.
  ctx.translate(runnerX, barY - 3 - hop);
  ctx.scale(scale, scale);
  ctx.translate(0, -68);
  const j = enemyBodyJoints(pose);
  // Scarf trailing behind the head
  const h = pose.head;
  const wave = Math.sin(elapsed * 14) * 3;
  neonLimb(ctx, h, { x: h.x - 14, y: h.y + 3 + wave }, 4, '#ff007f', bodyFill('#ff007f'), 10);
  neonLimb(ctx, { x: h.x - 14, y: h.y + 3 + wave }, { x: h.x - 28, y: h.y + 8 - wave }, 3, '#ff007f', bodyFill('#ff007f'), 10);
  drawNeonBody(ctx, j, { color: FIGHTER, glow: 14, shoulderHalf: 11, waistHalf: 6, limbScale: 1 });
  neonHead(ctx, h, 9, { color: FIGHTER, glow: 14 });
  ctx.fillStyle = '#ffe600';
  ctx.shadowColor = '#ffe600';
  ctx.shadowBlur = 8;
  if (pose.facingCamera) ctx.fillRect(h.x - 5, h.y - 2, 10, 3.5);
  else ctx.fillRect(h.x - 1, h.y - 2, 10, 3.5);
  ctx.restore();

  // Death: a glowing red X pops in over the fighter
  if (arrived && !run.cleared) {
    const pop = Math.min(1, sinceArrival / 0.18);
    const s = 1.6 - 0.6 * pop; // starts big, snaps to size
    const r = 15 * s;
    const cx = runnerX;
    const cy = barY - 30;
    ctx.save();
    ctx.globalAlpha = pop;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ff2a5f';
    ctx.shadowColor = '#ff2a5f';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r);
    ctx.lineTo(cx + r, cy + r);
    ctx.moveTo(cx + r, cy - r);
    ctx.lineTo(cx - r, cy + r);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffd0d8';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  // Time reached, above the end point
  if (arrived) {
    const label = run.cleared ? 'CLEARED!' : formatSongTime(run.reachedSec);
    ctx.save();
    ctx.font = '900 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    const lx = Math.min(Math.max(runnerX, x0 + 20), x1 - 10);
    ctx.fillStyle = run.cleared ? '#ffe600' : '#ffd0d8';
    ctx.shadowColor = run.cleared ? '#ffe600' : '#ff2a5f';
    ctx.shadowBlur = 10;
    ctx.globalAlpha = Math.min(1, sinceArrival / 0.25);
    ctx.fillText(label, lx, 14);
    ctx.restore();
  }
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, barY: number, reached: boolean) {
  const color = reached ? '#ffe600' : '#ff007f';
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = reached ? 16 : 8;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, barY + 4);
  ctx.lineTo(x, barY - 34);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, barY - 34);
  ctx.lineTo(x + 13, barY - 29);
  ctx.lineTo(x, barY - 24);
  ctx.closePath();
  ctx.fillStyle = bodyFill(color);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
