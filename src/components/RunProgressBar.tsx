import React, { useEffect, useRef } from 'react';
import {
  RunProgress,
  dashDuration,
  formatSongTime,
  levelUpTimes,
  runnerPositionAt,
  runnerTierCombo,
} from '../game/runProgress';
import { fighterTier } from '../game/fighterTier';
import { attackChainFrame, playerVictoryPose } from '../game/motion';
import { getMoveForCombo, getOrientedPose } from '../game/animations';
import { getHero, HeroDefinition, HeroId } from '../game/heroes';
import { applyHeroBuild, drawFighter, drawSlashCrescent } from './fighterArt';
import { bodyFill } from './neonBody';

/**
 * Results-screen progress bar: a neon line the length of the song. Your fighter
 * dashes along it and stops where the run ended: a red X if you died, a
 * hands-up victory bounce at the flag if you cleared it. A gold marker shows
 * your best attempt before this one.
 */

interface RunProgressBarProps {
  run: RunProgress;
  /** The hero you played, so the runner is the same character */
  heroId?: HeroId;
}

const HEIGHT = 150;
const PAD_X = 22;
/** Size of the little fighter: world units -> canvas pixels */
const RUNNER_SCALE = 0.42;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export const RunProgressBar: React.FC<RunProgressBarProps> = ({ run, heroId }) => {
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
      drawFrame(ctx, width, run, elapsed, getHero(heroId));
      if (elapsed < animLength) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [run, heroId]);

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

function drawFrame(ctx: CanvasRenderingContext2D, width: number, run: RunProgress, elapsed: number, hero: HeroDefinition) {
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

  // Lit trail behind the runner, coloured by the tier he had in each quarter
  if (pos > 0.001) {
    ctx.lineWidth = 5;
    ctx.shadowBlur = 12;
    for (let q = 0; q < 4; q++) {
      const from = q / 4;
      const to = Math.min(pos, (q + 1) / 4);
      if (to <= from) break;
      const color = fighterTier(runnerTierCombo(from)).color;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.moveTo(xAt(from), barY);
      ctx.lineTo(xAt(to), barY);
      ctx.stroke();
    }
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

  // The fighter: the same character you play, levelling up as he crosses each quarter.
  const tier = fighterTier(runnerTierCombo(pos));
  let hop = 0;
  let pose;
  let slashing = false;
  if (!arrived) {
    // He fights his way along: a non-stop chain of his real attack moves,
    // picked from the tier he's in (basic strikes early, god-tier finishers late).
    const tierCombo = runnerTierCombo(pos);
    const frame = attackChainFrame(
      elapsed,
      (i) => getOrientedPose(getMoveForCombo(tierCombo, i, hero.moves).pose, 'right'),
      hero.idlePose
    );
    pose = frame.pose;
    slashing = frame.active;
  } else if (run.cleared) {
    pose = playerVictoryPose(2 + sinceArrival * 3);
    hop = Math.abs(Math.sin(sinceArrival * Math.PI * 1.8)) * 10;
  } else {
    pose = hero.idlePose;
  }
  ctx.save();
  // World units have the feet at y = 68. Map so the feet sit on the bar.
  ctx.translate(runnerX, barY - 3 - hop);
  ctx.scale(RUNNER_SCALE, RUNNER_SCALE);
  ctx.translate(0, -68);
  drawFighter(ctx, pose, { tier, facing: 1, time: elapsed, combo: tier.minCombo, hero: hero.id });
  if (slashing && pose.bladeSlash) {
    applyHeroBuild(ctx, hero.id, 1, false, tier.ascended);
    drawSlashCrescent(ctx, pose.bladeSlash);
  }
  ctx.restore();

  // Level-up flash: a ring bursts out and the new tier name pops up as he crosses each quarter line
  // Only the most recent level-up shows, so the names never pile up.
  const latestUp = levelUpTimes(run.fraction)
    .filter((u) => u.elapsed <= elapsed)
    .pop();
  for (const up of latestUp ? [latestUp] : []) {
    const age = elapsed - up.elapsed;
    if (age > 0.7) continue;
    const t = age / 0.7;
    const upTier = fighterTier(up.combo);
    const ux = xAt(up.position);
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = upTier.color;
    ctx.shadowColor = upTier.color;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ux, barY - 22, 8 + t * 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = '900 10px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = upTier.color;
    ctx.fillText(upTier.name, ux, barY - 58 - t * 10);
    ctx.restore();
  }

  // Death: a glowing red X pops in over the fighter
  if (arrived && !run.cleared) {
    const pop = Math.min(1, sinceArrival / 0.18);
    const s = 1.6 - 0.6 * pop; // starts big, snaps to size
    const r = 15 * s;
    const cx = runnerX;
    const cy = barY - 28;
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
