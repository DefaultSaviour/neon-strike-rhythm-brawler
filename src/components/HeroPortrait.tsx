import React, { useEffect, useRef } from 'react';
import { HeroId, HEROES } from '../game/heroes';
import { fighterTier } from '../game/fighterTier';
import { drawFighter } from './fighterArt';

/** A fighter drawn small in their fighting stance (dark and grey when still locked), for the unlock popup. */
export const HeroPortrait: React.FC<{ id: HeroId; locked: boolean }> = ({ id, locked }) => {
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const hero = HEROES.find((x) => x.id === id)!;
    ctx.save();
    ctx.translate(w / 2, 100);
    ctx.scale(0.95, 0.95);
    if (locked) {
      ctx.filter = 'grayscale(1) brightness(0.35)';
      ctx.globalAlpha = 0.8;
    }
    drawFighter(ctx, hero.idlePose, { tier: fighterTier(0), facing: 1, time: 0.4, hero: id, random: () => 0.5 });
    ctx.restore();
  }, [id, locked]);
  return <canvas ref={ref} style={{ width: 120, height: 150 }} aria-hidden="true" />;
};
