import React, { useEffect, useRef } from 'react';
import { HeroId, HEROES } from '../../game/heroes';
import { fighterTier } from '../../game/fighterTier';
import { getOrientedPose, lerpPose } from '../../game/animations';
import { enemyPoseFor } from '../../game/customAnimation';
import { getActiveAnimations } from '../../game/animationLibrary';
import { getEnemyStyle } from '../../game/enemyStyles';
import type { EnemyMotionStyle } from '../../game/enemyMotion';
import type { BeatNote, Track } from '../../types/game';
import { drawFighter } from '../fighterArt';
import { drawEnemyArt } from '../enemyArt';
import { drawDebrisList } from '../NeonCanvas';
import { DEBRIS_GRAVITY, DebrisPiece, DebrisWorld, shatterEnemy, stepDebris } from '../../game/debrisPhysics';
import { comboBlastPower, extraShardsForCombo } from '../../game/comboFx';
import { strikeBlend } from './ui';
import { approachSpeed, firstNoteFrom, TITLE_HIT_X, titleEnemyAt, titleEnemyLook, titleEnemyRange, TitleEnemyState } from './titleFightBeats';

/**
 * The title screen's fight: your fighter floats on the left of this canvas,
 * facing right, and the title song's enemies float in from the right edge:
 * every enemy in its chart, on its note, at the game's speed (all from the
 * right). Each is hit with your fighter's own moves and broken into pieces
 * like in the game (but without the game's white flash), which fall off the
 * bottom and are gone. The enemies move in your chosen stance. With no music
 * (a browser holds the sound until the first tap or key) the fighter just
 * waits in their stance.
 *
 * The canvas can be taller than the scene (so pieces flying up aren't cut
 * off): the scene is `sceneHeightU` arcade units tall (see --u), at the
 * bottom, and the fighter is about two thirds of that tall.
 */

/** Fighter height as a share of the scene height */
const HERO_SHARE = 0.66;
/** How far in from the left edge the fighter stands (world units), so a back swing isn't cut off */
const HERO_X = 62;
/** At most this many pieces flying at once (a fast run of notes makes a lot) */
const MAX_PIECES = 260;

/** Where the song is (s) and the seconds per beat, or null with no music. */
export type SongClock = () => { songTime: number; period: number } | null;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

type Ctx = CanvasRenderingContext2D;

/** The enemy's body pose at a moment (the same one is broken into pieces when it's hit). */
function enemyPoseAt(note: BeatNote, index: number, beatPos: number, stance: EnemyMotionStyle) {
  const { band, tier } = titleEnemyLook(note);
  // Neighbours lead with opposite feet / arms, like in the game
  return enemyPoseFor(stance, beatPos + (index % 2), band, tier, getActiveAnimations());
}

function drawEnemy(ctx: Ctx, note: BeatNote, index: number, e: TitleEnemyState, beatPos: number, stance: EnemyMotionStyle, fade: number) {
  const { band, tier } = titleEnemyLook(note);
  const style = getEnemyStyle(band, tier);
  // Coming from the right, so facing left (the art is drawn facing right)
  const dir = -1;
  const lean = dir * 0.14 * smoothstep(0.32, 0, e.timeLeft);

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(e.x, e.y);
  // Lean from the feet on the way in
  ctx.translate(0, 68);
  ctx.rotate(lean);
  ctx.scale(style.scale * dir, style.scale);
  ctx.translate(0, -68);
  if (band === 'high' && tier === 2) ctx.translate(0, -5); // wraiths hover

  ctx.strokeStyle = style.color;
  ctx.shadowColor = style.color;
  ctx.shadowBlur = band === 'high' && tier === 3 ? 24 : 16;
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawEnemyArt(ctx, enemyPoseAt(note, index, beatPos, stance), band, tier, { main: style.color, accent: style.accent }, beatPos, false);
  ctx.restore();
}

/** A starburst where the blow lands, for the first fifth of a second. */
function drawImpact(ctx: Ctx, since: number, color: string) {
  const t = since / 0.2;
  if (t < 0 || t >= 1) return;
  ctx.save();
  ctx.translate(TITLE_HIT_X - 14, 10);
  ctx.globalAlpha = 1 - t;
  ctx.strokeStyle = '#ffffff';
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.lineWidth = 4 * (1 - t) + 1;
  ctx.lineCap = 'round';
  const inner = 8 + 20 * t;
  const outer = 22 + 34 * t;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    ctx.stroke();
  }
  ctx.restore();
}

export const TitleFight: React.FC<{
  heroId: HeroId;
  stance: EnemyMotionStyle;
  /** The title song: its chart (filled in once it's been charted) gives the enemies */
  track: Track;
  clock: SongClock;
  /** How tall the fight is, in arcade units (--u); the canvas can be taller */
  sceneHeightU: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ heroId, stance, track, clock, sceneHeightU, className = '', style }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const clockRef = useRef(clock);
  clockRef.current = clock;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const hero = HEROES.find((h) => h.id === heroId) ?? HEROES[0];
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    // The chart, in time order (it arrives once the song has been charted)
    let notes: BeatNote[] = [];
    let chartOf: BeatNote[] | null = null;
    // The pieces of the enemies hit so far, the last note broken up, and where the run of hits started
    let debris: DebrisPiece[] = [];
    let lastBroken: number | null = null;
    let runStart = 0;
    let lastSongTime = -Infinity;
    let nextId = 1;
    let lastFrame = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w <= 0 || h <= 0) return;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      // The arcade unit (--u) in pixels, as in arcade.css
      const unit = Math.min(window.innerHeight / 100, window.innerWidth * 0.005625);
      const sceneH = Math.min(h, sceneHeightU * unit);
      const s = (sceneH * HERO_SHARE) / 150;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      // Feet a little above the bottom of the scene, room above for flying pieces
      const feetY = h - sceneH * 0.1;
      ctx.translate(HERO_X * s, feetY - 68 * s);
      ctx.scale(s, s);
      const rightEdge = w / s - HERO_X;

      if (chartOf !== track.notes) {
        chartOf = track.notes;
        notes = [...track.notes].sort((a, b) => a.time - b.time);
        lastBroken = null;
      }
      const music = notes.length > 0 ? clockRef.current() : null;
      const songTime = music?.songTime ?? 0;
      const speed = music ? approachSpeed(music.period) : 0;
      const beatPos = music ? songTime / music.period : 0;

      if (music) {
        // Just started, or the song went back to the drop: carry on from here
        if (lastBroken === null || songTime < lastSongTime - 0.5) {
          lastBroken = firstNoteFrom(notes, songTime) - 1;
          runStart = lastBroken + 1;
        }
        lastSongTime = songTime;
        // Break each enemy into pieces the moment it's hit
        while (lastBroken + 1 < notes.length && notes[lastBroken + 1].time <= songTime) {
          lastBroken++;
          const note = notes[lastBroken];
          if (songTime - note.time > 0.15) continue; // long gone (the tab was in the background)
          const { band, tier } = titleEnemyLook(note);
          const style = getEnemyStyle(band, tier);
          const combo = lastBroken - runStart;
          debris.push(
            ...shatterEnemy(
              {
                x: TITLE_HIT_X,
                pose: enemyPoseAt(note, lastBroken, note.time / music.period, stance),
                facing: -1,
                scale: style.scale,
                color: style.color,
                accent: style.accent,
                limbScale: style.limbScale,
                hasBlade: band !== 'sub',
                // As hard as a PERFECT, and harder as the combo builds, like in the game
                power: 1.35 * comboBlastPower(combo),
                extraShards: extraShardsForCombo(combo),
              },
              () => nextId++
            )
          );
        }
        if (debris.length > MAX_PIECES) debris = debris.slice(debris.length - MAX_PIECES);
      } else {
        lastBroken = null;
      }

      // The pieces fall with nothing to land on, and go once they're off the bottom or the side
      if (dt > 0 && debris.length > 0) {
        const bottom = (h - (feetY - 68 * s)) / s;
        const world: DebrisWorld = { floorY: bottom + 10000, pitHalfWidth: 0, beltSpeed: 0, gravity: DEBRIS_GRAVITY, halfWidth: rightEdge + 200 };
        stepDebris(debris, world, dt);
        debris = debris.filter((p) => p.y < bottom + 40 && p.x < rightEdge + 120 && p.alpha > 0.02);
      }

      // Enemies on the way in, furthest first (behind the fighter's strike)
      const hits: Array<[number, TitleEnemyState]> = [];
      if (music) {
        const [from, to] = titleEnemyRange(notes, songTime, speed, rightEdge);
        for (let i = to - 1; i >= from; i--) {
          const e = titleEnemyAt(notes[i].time, songTime, speed, i);
          if (!e) continue;
          if (e.phase !== 'coming') {
            hits.push([i, e]);
            continue;
          }
          // Fade in as they come on at the right edge
          const fade = Math.max(0, Math.min(1, (rightEdge + 10 - e.x) / 40));
          if (fade > 0) drawEnemy(ctx, notes[i], i, e, beatPos, stance, fade);
        }
      }

      // The fighter, floating, throwing their next move on each note
      let pose = hero.idlePose;
      let combo = 0;
      if (music && hero.moves.length > 0) {
        const last = firstNoteFrom(notes, songTime + 1e-6) - 1;
        if (last >= 0) {
          const since = songTime - notes[last].time;
          pose = lerpPose(hero.idlePose, getOrientedPose(hero.moves[last % hero.moves.length].pose, 'right'), strikeBlend(since));
          combo = Math.max(0, last - runStart + 1);
        }
      }
      const tier = fighterTier(combo);
      ctx.save();
      if (!still) ctx.translate(0, Math.sin((now / 1800) * Math.PI * 2) * 3);
      drawFighter(ctx, pose, { tier, facing: 1, time: now / 1000, hero: heroId, random: Math.random });
      ctx.restore();

      // The pieces (in their own colours: no white flash or white-hot pieces here, it was distracting),
      // with the burst where the blow lands
      drawDebrisList(ctx, debris, { whiteHot: false });
      for (const [, e] of hits) drawImpact(ctx, -e.timeLeft, tier.color);
      ctx.restore();
    };

    // 60 frames a second: the hits have to land on the beat
    let raf = 0;
    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [heroId, stance, track, sceneHeightU]);

  return <canvas ref={ref} className={`block ${className}`} style={style} aria-hidden="true" />;
};
