import React, { useEffect, useRef } from 'react';
import { BACKDROP_ITEMS, BACKDROP_LAYERS, BackdropLayer } from '../../game/backdrops';
import { drawBackdropFinish, drawBackdropLayer, drawBackdropLayers } from '../backdropArt';
import { REVEAL_TIMES, spinEase } from './unlockReveal';

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/**
 * A new backdrop piece's reveal (fills the element): its layer alone on a
 * dark stage, that layer's five pieces flicking past like a reel from the
 * one you had, slowing and landing on the new one with a flash. It holds a
 * moment on its own (lit up, and a floor gets the horizon raised so it fills
 * the stage), then the rest of your backdrop fades in round it as the view
 * settles back. `elapsed` says how far in the reveal is (s), so a tap can
 * skip it to the end.
 */
export const BackdropReveal: React.FC<{ layer: BackdropLayer; id: string; mix: Record<BackdropLayer, string>; elapsed: () => number; className?: string }> = ({ layer, id, mix, elapsed, className = '' }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const clock = useRef(elapsed);
  clock.current = elapsed;
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { spin: SPIN, land: LAND, build: BUILD } = REVEAL_TIMES.backdrop;
    const pieces = BACKDROP_ITEMS.filter((b) => b.layer === layer).map((b) => b.id);
    const from = Math.max(0, pieces.indexOf(mix[layer]));
    const to = Math.max(0, pieces.indexOf(id));
    // Two whole turns of the reel, then on to the new piece
    const steps = 10 + ((to - from + pieces.length) % pieces.length);
    let raf = 0;
    const draw = (now: number) => {
      const t = clock.current();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (w > 0 && h > 0) {
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#05050a';
        ctx.fillRect(0, 0, w, h);
        // A gentle pretend beat (about 120 BPM), as on the Backdrops tab
        const pulse = Math.max(0, 1 - ((now / 500) % 1) * 2.5);
        const built = t < SPIN + LAND ? 0 : smooth((t - SPIN - LAND) / BUILD);
        const soloHy = layer === 'floor' ? 0.22 : 0.6;
        const frame = { ctx, width: w, cx: w / 2, hy: h * (soloHy + (0.6 - soloHy) * built), s: h / 120, beltTop: h * 1.08, pulse, bass: pulse * 0.8, time: now / 1000 };
        // Backdrops are drawn dim (they sit behind the fight): alone, the piece is lit up, settling as the rest arrives
        const boost = (layer === 'sky' ? 0.4 : 1) * (1 - built);
        const glow = (pieceId: string) => {
          if (boost <= 0) return;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha *= boost;
          drawBackdropLayer(frame, layer, pieceId);
          ctx.restore();
        };
        const solo = (pieceId: string) => {
          drawBackdropLayer(frame, layer, pieceId);
          glow(pieceId);
          if (layer !== 'sky') drawBackdropFinish(frame);
        };

        if (t < SPIN) {
          // The reel: each piece alone, sliding in from the right, slowing to a stop
          const pos = steps * spinEase(t / SPIN);
          const at = Math.floor(pos);
          const frac = pos - at;
          for (const [k, x] of [
            [at, -frac * w],
            [at + 1, (1 - frac) * w],
          ] as const) {
            if (x <= -w || x >= w) continue;
            ctx.save();
            ctx.translate(x, 0);
            ctx.beginPath();
            ctx.rect(0, 0, w, h);
            ctx.clip();
            ctx.globalAlpha = 0.5 + 0.5 * spinEase(t / SPIN);
            solo(pieces[(from + k) % pieces.length]);
            ctx.restore();
          }
        } else {
          if (built <= 0) solo(id);
          else {
            const fade: Partial<Record<BackdropLayer, number>> = {};
            for (const { layer: l } of BACKDROP_LAYERS) fade[l] = l === layer ? 1 : built;
            drawBackdropLayers(frame, { ...mix, [layer]: id }, fade);
            glow(id);
          }
          // The flash as it lands
          const flash = 1 - (t - SPIN) / 0.35;
          if (flash > 0) {
            ctx.fillStyle = `rgba(255,255,255,${0.55 * flash * flash})`;
            ctx.fillRect(0, 0, w, h);
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [layer, id, mix]);
  return <canvas ref={ref} className={`block ${className}`} aria-hidden="true" />;
};
