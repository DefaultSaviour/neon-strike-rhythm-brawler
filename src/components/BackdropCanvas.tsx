import React, { useEffect, useRef } from 'react';
import type { BackdropLayer } from '../game/backdrops';
import { drawBackdropLayers } from './backdropArt';

/** Draws a backdrop onto a canvas: animated (the live preview) or a still (a piece's thumbnail). */
export const BackdropCanvas: React.FC<{ pieces: Record<BackdropLayer, string>; animated?: boolean; className?: string; dim?: boolean; closeUp?: boolean; stage?: boolean }> = ({
  pieces,
  animated,
  className,
  dim,
  closeUp,
  stage,
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let frame = 0;
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const time = animated ? performance.now() / 1000 : 2.4;
      // A gentle pretend beat for the preview (about 120 BPM)
      const pulse = animated ? Math.max(0, 1 - ((time * 2) % 1) * 2.5) : 0.6;
      // Thumbnails are a close-up on the horizon, so a small piece still reads
      // ...and a wide, short stage (the Backdrops tab) is a little closer, so every layer reads
      const view = closeUp ? { hy: h * 0.62, s: h / 95, beltTop: h * 1.4 } : stage ? { hy: h * 0.6, s: h / 120, beltTop: h * 1.08 } : { hy: h * 0.42, s: h / 230, beltTop: h * 0.92 };
      drawBackdropLayers({ ctx, width: w, cx: w / 2, ...view, pulse, bass: pulse * 0.8, time }, pieces);
      if (animated) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [pieces, animated, closeUp, stage]);
  return <canvas ref={ref} className={`${className ?? ''} ${dim ? 'opacity-30 grayscale' : ''}`} />;
};
