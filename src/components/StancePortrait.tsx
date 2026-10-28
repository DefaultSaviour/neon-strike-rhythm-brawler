import React, { useEffect, useRef } from 'react';
import type { EnemyMotionStyle } from '../game/enemyMotion';
import { getActiveAnimations } from '../game/animationLibrary';
import { enemyPoseFor } from '../game/customAnimation';
import { getEnemyStyle } from '../game/enemyStyles';
import type { EnemyTier, FrequencyBand } from '../types/game';
import { drawEnemyArt } from './enemyArt';

/** An enemy moving in a stance, on a steady beat (dark and grey when the stance is still locked). Same size as a fighter portrait (the unlock popup shows it). */
export const StancePortrait: React.FC<{ stance: EnemyMotionStyle; band: FrequencyBand; tier: EnemyTier; locked: boolean }> = ({ stance, band, tier, locked }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = 120;
    const h = 150;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const style = getEnemyStyle(band, tier);
    let frame = 0;
    const draw = () => {
      // Locked stances stand still; unlocked ones move on a beat of about 120 BPM
      const beat = locked ? 0.25 : (performance.now() / 1000) * 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, 62);
      // Facing left, like the enemies coming at you down the right lane; feet on the floor (y = 68)
      const scale = 0.8 * style.scale;
      ctx.translate(0, 68);
      ctx.scale(-scale, scale);
      ctx.translate(0, -68);
      if (locked) {
        ctx.filter = 'grayscale(1) brightness(0.35)';
        ctx.globalAlpha = 0.8;
      }
      ctx.strokeStyle = style.color;
      ctx.shadowColor = style.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const pose = enemyPoseFor(stance, beat, band, tier, getActiveAnimations());
      drawEnemyArt(ctx, pose, band, tier, { main: style.color, accent: style.accent }, beat, false);
      ctx.restore();
      if (!locked) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [stance, band, tier, locked]);
  return <canvas ref={ref} style={{ width: 120, height: 150 }} aria-hidden="true" />;
};
