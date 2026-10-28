import React, { useEffect, useRef } from 'react';
import type { EnemyMotionStyle } from '../../game/enemyMotion';
import { getActiveAnimations } from '../../game/animationLibrary';
import { enemyPoseFor } from '../../game/customAnimation';
import { getEnemyStyle } from '../../game/enemyStyles';
import type { EnemyTier, FrequencyBand } from '../../types/game';
import { drawEnemyArt } from '../enemyArt';

/**
 * An enemy moving in a stance, filling the element's height with its feet
 * at the bottom, at the same size as a fighter (see HeroFigure). It moves
 * on `beatNow` (the music's beat), facing left like the enemies coming at
 * you, with a ring on the floor thumping on each step when `stomps`.
 * Locked: a black silhouette with a faint outline.
 */
export const EnemyFigure: React.FC<{
  stance: EnemyMotionStyle;
  band: FrequencyBand;
  tier: EnemyTier;
  beatNow: () => { beat: number; since: number; period: number };
  locked?: boolean;
  stomps?: boolean;
  className?: string;
  style?: React.CSSProperties;
}> = ({ stance, band, tier, beatNow, locked = false, stomps = false, className = '', style }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const beatRef = useRef(beatNow);
  beatRef.current = beatNow;
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const look = getEnemyStyle(band, tier);
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w <= 0 || h <= 0) return;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      // Where the music is, in beats (a steady pose when the player has asked for less motion)
      const b = beatRef.current();
      const beatPos = still ? 0.25 : b.beat + b.since / b.period;
      const pose = enemyPoseFor(stance, beatPos, band, tier, getActiveAnimations());
      // The same scale as a fighter: about 150 units tall, feet at y = 68, near the bottom
      const s = (h * 0.85) / 150;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h * 0.95 - 68 * s);
      ctx.scale(s, s);
      // The thump on the floor as a foot lands
      if (stomps && !locked && pose.stomp > 0.02) {
        ctx.save();
        ctx.globalAlpha = pose.stomp * 0.8;
        ctx.strokeStyle = look.color;
        ctx.shadowColor = look.color;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 70, 34 + 22 * (1 - pose.stomp), 7 + 4 * (1 - pose.stomp), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // Facing left (the art faces right), scaled from the feet
      ctx.translate(0, 68);
      ctx.scale(-look.scale, look.scale);
      ctx.translate(0, -68);
      if (band === 'high' && tier === 2) ctx.translate(0, -5); // wraiths hover
      ctx.strokeStyle = look.color;
      ctx.shadowColor = look.color;
      ctx.shadowBlur = band === 'high' && tier === 3 ? 24 : 16;
      ctx.lineWidth = 3.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawEnemyArt(ctx, pose, band, tier, { main: look.color, accent: look.accent }, beatPos, false);
      ctx.restore();
    };
    // About 30 frames a second is plenty for a menu (60 for the one in focus, so it lands on the beat)
    const frameMs = stomps ? 15 : 33;
    let raf = 0;
    let last = -Infinity;
    const loop = (t: number) => {
      if (t - last >= frameMs) {
        last = t;
        draw();
      }
      raf = requestAnimationFrame(loop);
    };
    if (still) draw();
    else raf = requestAnimationFrame(loop);
    const resized = new ResizeObserver(() => draw());
    resized.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      resized.disconnect();
    };
  }, [stance, band, tier, locked, stomps]);
  // Locked: black, outlined faintly so it shows on the dark screen (as HeroFigure)
  const shown = locked ? { ...style, filter: `brightness(0) drop-shadow(0 0 1px rgba(160,170,210,0.9)) drop-shadow(0 0 calc(var(--u) * 1.2) rgba(160,170,210,0.35))` } : style;
  return <canvas ref={ref} className={`block ${className}`} style={shown} aria-hidden="true" />;
};
