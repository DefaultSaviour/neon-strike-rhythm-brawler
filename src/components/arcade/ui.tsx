import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { HeroId, HEROES } from '../../game/heroes';
import { fighterTier } from '../../game/fighterTier';
import { drawFighter } from '../fighterArt';
import { getOrientedPose, lerpPose } from '../../game/animations';
import { audioEngine } from '../../audio/audioEngine';
import { dialStep, SLASH_ANGLE, STRIPE_ANGLES, stripeLayout, StripeStyle, THROB, throbAfter, waveLevel } from './musicLines';

/**
 * Shared pieces of the arcade menus (see arcade.css): the full-screen frame
 * with its slashes, slanted buttons, and a hero drawn big in their stance.
 */

/**
 * A full-screen arcade menu: dark, with the music lines and halftone behind.
 * `stripes` picks the screen's own angle for the lines (see STRIPE_ANGLES):
 * they swing round to it when the screen opens.
 */
export const ArcadeScreen: React.FC<{ children: React.ReactNode; className?: string; label?: string; stripes?: StripeStyle }> = ({ children, className = '', label, stripes = 'slash' }) => (
  // The frame fills the window; the screen inside is never taller than 4:3 (see .arc-frame)
  <div className="arc-frame">
    <div className="arc-rotate" aria-hidden="true">
      <span className="on-touch">↻ TURN YOUR PHONE SIDEWAYS</span>
      <span className="on-mouse">↔ MAKE THE WINDOW WIDER</span>
    </div>
    <div className={`arc-screen ${className}`} role="dialog" aria-label={label}>
      <div className="arc-bg" aria-hidden="true" />
      {/* The dots under the music lines, so they never speckle them */}
      <div className="arc-halftone" aria-hidden="true" />
      <MusicStripes angle={STRIPE_ANGLES[stripes]} />
      {children}
    </div>
  </div>
);

/**
 * One line of text that shrinks to fit its space instead of being cut off
 * (down to `min` of its size; only past that does it end in "…"). It leaves
 * room for an italic last letter's lean. Give it its size with `style`.
 */
export const FitText: React.FC<{ children: string; className?: string; style?: React.CSSProperties; min?: number; title?: string }> = ({ children, className = '', style, min = 0.55, title }) => {
  const outer = useRef<HTMLSpanElement | null>(null);
  const inner = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    const box = outer.current;
    const text = inner.current;
    if (!box || !text) return;
    // The width it settled at, so its own shrinking doesn't set off another fit
    let settled = -1;
    const fit = () => {
      text.style.fontSize = '';
      box.style.textOverflow = '';
      box.style.overflow = '';
      const room = box.clientWidth;
      const natural = text.getBoundingClientRect().width;
      const scale = room > 0 && natural > room ? room / natural : 1;
      if (scale < 1) text.style.fontSize = `${Math.max(min, scale * 0.98)}em`;
      if (scale < min) {
        box.style.overflow = 'hidden';
        box.style.textOverflow = 'ellipsis';
      }
      settled = box.clientWidth;
    };
    fit();
    const watch = new ResizeObserver(() => {
      if (Math.abs(box.clientWidth - settled) > 0.5) fit();
    });
    watch.observe(box);
    // The display font arriving late changes every width
    void document.fonts?.ready.then(fit);
    return () => watch.disconnect();
  }, [children, min]);
  return (
    <span ref={outer} className={`arc-fit ${className}`} style={style} title={title}>
      <span ref={inner}>{children}</span>
    </span>
  );
};

/**
 * The two colour slashes behind the menus, throbbing with the music (see
 * musicLines): pink with the bass, cyan with the mids, each up to 30%
 * fatter on a hit. Plain when nothing's playing, and when the player has
 * asked for less motion.
 *
 * They're one pair of lines however many screens draw them: each screen
 * has its own angle, and opening a screen swings them round to it from
 * wherever the last screen left them, like a dial (straight there when
 * the player has asked for less motion).
 */
export const MusicStripes: React.FC<{ angle?: number }> = ({ angle = SLASH_ANGLE }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    // Each line's recent loudest level: the music is measured against it, so the lines throb as much
    // in a quiet song (or at low volume) as in a loud one. It lets go slowly, so a fade-out still fades.
    const peak = { bass: 0, mid: 0 };
    // ...and its usual level over the last second: a hit is how far above that it jumps
    const usual = { bass: 0, mid: 0 };
    const throb = { bass: 0, mid: 0 };
    let last = performance.now();
    let raf = 0;
    const draw = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const scopes = still ? null : audioEngine.getScopes();
      for (const kind of ['bass', 'mid'] as const) {
        const rms = scopes ? waveLevel(scopes[kind]) : 0;
        peak[kind] = Math.max(rms, peak[kind] * Math.exp(-dt / 3));
        usual[kind] += (rms - usual[kind]) * Math.min(1, dt / 0.8);
        // How far above its usual level the music jumps, against its loudest; a floor so near-silence stays still
        const level = (rms - usual[kind]) / Math.max(kind === 'bass' ? 0.01 : 0.005, peak[kind] - usual[kind]);
        throb[kind] = throbAfter(throb[kind], level, dt);
      }
      if (still) dial = { angle, speed: 0 };
      else dial = dialStep(dial.angle, dial.speed, angle, dt);
      const layout = stripeLayout(w, h, dial.angle);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'butt';
      for (const stripe of layout.stripes) {
        ctx.lineWidth = stripe.width * (1 + THROB * throb[stripe.kind]);
        ctx.strokeStyle = stripe.color;
        ctx.beginPath();
        ctx.moveTo(stripe.x - layout.along.x * layout.halfLength, stripe.y - layout.along.y * layout.halfLength);
        ctx.lineTo(stripe.x + layout.along.x * layout.halfLength, stripe.y + layout.along.y * layout.halfLength);
        ctx.stroke();
      }
      if (!still) raf = requestAnimationFrame(draw);
    };
    draw(performance.now());
    const resized = new ResizeObserver(() => still && draw(performance.now()));
    resized.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      resized.disconnect();
    };
  }, [angle]);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.85 }} aria-hidden="true" />;
};

/** Where the stripes are now, and how fast they're turning: kept between screens, so the next one turns them on from here */
let dial = { angle: SLASH_ANGLE, speed: 0 };

type SlantButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** hot: the yellow main action. alt: yellow text on dark (Practice). selected: white */
  variant?: 'hot' | 'alt' | 'dark' | 'selected';
  size?: 'sm' | 'md' | 'lg';
  /** The keyboard key that does the same, shown small (hidden on touch screens) */
  hotkey?: string;
};

/** A slanted, fighting-game style button. */
export const SlantButton: React.FC<SlantButtonProps> = ({ variant = 'dark', size = 'md', hotkey, className = '', children, ...rest }) => (
  <button
    type="button"
    {...rest}
    className={`arc-btn ${variant === 'hot' ? 'is-hot' : variant === 'alt' ? 'is-alt' : variant === 'selected' ? 'is-selected' : ''} ${size === 'lg' ? 'is-lg' : size === 'sm' ? 'is-sm' : ''} ${className}`}
  >
    {children}
    {hotkey && <span className="arc-key [@media(pointer:coarse)]:hidden">{hotkey}</span>}
  </button>
);

/** What a rewarded ad would unlock now, for the pink offer button (results and song select) */
export interface AdOffer {
  /** The unlock's name */
  name: string;
  /** The ad is loading or playing */
  busy: boolean;
  /** Watched: unlocked and equipped */
  done: boolean;
  /** Why the last ad didn't unlock anything, if it didn't */
  notice?: string | null;
  onWatch: () => void;
}

/**
 * The pink offer button: watch an ad to unlock the next thing now (every
 * one can be earned by playing too). Once watched it says what it
 * unlocked; a note above says why an ad didn't count, if one didn't.
 */
export const AdOfferButton: React.FC<{ offer: AdOffer; className?: string; style?: React.CSSProperties }> = ({ offer, className = '', style }) => {
  const small = 'max(10px, calc(var(--u) * 2.3))';
  if (offer.done) {
    return (
      <span className={`font-bold text-[color:var(--yellow)] text-center ${className}`} style={{ fontSize: small }}>
        {offer.name} unlocked and equipped!
      </span>
    );
  }
  return (
    <>
      {offer.notice && (
        <span className="text-pink-300 text-center" style={{ fontSize: small }}>
          {offer.notice}
        </span>
      )}
      <button type="button" onClick={offer.onWatch} disabled={offer.busy} className={`arc-btn is-offer ${className}`} style={{ height: 'calc(var(--u) * 10)', padding: '0 calc(var(--u) * 4)', fontSize: 'calc(var(--u) * 3.4)', ...style }}>
        <span className="arc-play" aria-hidden>
          ▶
        </span>
        <span className="arc-offer-text min-w-0">
          <FitText>{offer.busy ? 'Loading ad…' : `Unlock ${offer.name}`}</FitText>
          <FitText className="arc-offer-sub">{offer.busy ? 'One moment' : 'Watch an ad · now'}</FitText>
        </span>
      </button>
    </>
  );
};

const SWITCH_SLANT = 'polygon(calc(var(--u) * 2) 0, 100% 0, calc(100% - calc(var(--u) * 2)) 100%, 0 100%)';

/** A row of choices with a yellow block that slides to the one that's on (like the title's Controls switch). At least 44px tall. */
export function ArcadeSwitch<T extends string>({ label, options, value, onChange }: { label: string; options: Array<{ id: T; label: string }>; value: T; onChange: (id: T) => void }) {
  const index = Math.max(0, options.findIndex((o) => o.id === value));
  const share = 100 / options.length;
  return (
    <div role="radiogroup" aria-label={label} className="relative grid" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)`, height: `calc(var(--u) * 9)`, minHeight: 44, background: '#0b0b14', clipPath: SWITCH_SLANT }}>
      <span
        aria-hidden="true"
        className="absolute top-0 bottom-0"
        style={{ left: `${index * share}%`, width: `${share}%`, background: 'var(--yellow)', clipPath: SWITCH_SLANT, transition: 'left 0.18s cubic-bezier(0.2, 0.9, 0.2, 1)' }}
      />
      {options.map((o, i) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={i === index}
          onClick={() => onChange(o.id)}
          className="relative arc-display whitespace-nowrap cursor-pointer"
          style={{ fontSize: 'calc(var(--u) * 3.4)', color: i === index ? '#000' : '#8d95b3', transition: 'color 0.18s', background: 'none', border: 0, padding: '0 calc(var(--u) * 0.8)' }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The beat being heard (see audioEngine.getPreviewBeat): which beat, how long ago it hit (s), and seconds per beat. */
export type BeatNow = () => { beat: number; since: number; period?: number } | null;

/**
 * Which pose the fighter is in `since` seconds after striking on a beat:
 * snap into the strike, hold it, then ease back to their stance.
 */
export function strikeBlend(since: number): number {
  if (since < 0.05) return since / 0.05;
  if (since < 0.2) return 1;
  if (since < 0.42) return 1 - (since - 0.2) / 0.22;
  return 0;
}

/**
 * A fighter drawn in their fighting stance, filling the element's height,
 * feet at the bottom. With `animate` they breathe and glow like in a song;
 * locked fighters are a black silhouette with a faint outline. With
 * `beatNow` they fight to the music: each beat they throw their next move,
 * left then right, and they level up through the glow tiers as the bars go
 * by (`comboAt` says what the combo is on each beat, if not two a beat).
 */
export const HeroFigure: React.FC<{
  id: HeroId;
  animate?: boolean;
  locked?: boolean;
  beatNow?: BeatNow;
  comboAt?: (beat: number) => number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ id, animate = false, locked = false, beatNow, comboAt, className = '', style }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const beatRef = useRef(beatNow);
  beatRef.current = beatNow;
  const comboRef = useRef(comboAt);
  comboRef.current = comboAt;
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const hero = HEROES.find((h) => h.id === id) ?? HEROES[0];
    let facing: 1 | -1 = 1;
    const draw = (now: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w <= 0 || h <= 0) return;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      // A fighter is about 150 units from crest to feet, feet at y = 68: fit that to the height, feet near the bottom
      const s = (h * 0.85) / 150;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h * 0.95 - 68 * s);
      ctx.scale(s, s);
      let pose = hero.idlePose;
      let combo = 0;
      const beat = beatRef.current?.();
      if (beat && hero.moves.length > 0) {
        const lane = beat.beat % 2 === 0 ? 'right' : 'left';
        const move = hero.moves[beat.beat % hero.moves.length];
        const t = strikeBlend(beat.since);
        if (t > 0) facing = lane === 'left' ? -1 : 1;
        const stance = facing === 1 ? hero.idlePose : getOrientedPose(hero.idlePose, 'left');
        pose = lerpPose(stance, getOrientedPose(move.pose, lane), t);
        // Climbs a tier every few bars, like a combo building up
        combo = comboRef.current ? comboRef.current(beat.beat) : beat.beat * 2;
      } else if (facing === -1) {
        pose = getOrientedPose(hero.idlePose, 'left');
      }
      drawFighter(ctx, pose, {
        tier: fighterTier(combo),
        facing,
        time: animate || beatRef.current ? now / 1000 : 0.4,
        hero: id,
        random: animate || beatRef.current ? Math.random : () => 0.5,
      });
      ctx.restore();
    };
    // Animated: about 30 frames a second is plenty for a menu (60 when fighting to a beat)
    const frameMs = beatNow ? 15 : 33;
    let raf = 0;
    let last = -Infinity;
    const loop = (t: number) => {
      if (t - last >= frameMs) {
        last = t;
        draw(t);
      }
      raf = requestAnimationFrame(loop);
    };
    if (animate || beatNow) raf = requestAnimationFrame(loop);
    else draw(0);
    const resized = new ResizeObserver(() => draw(performance.now()));
    resized.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      resized.disconnect();
    };
    // beatNow is read through a ref; only whether there is one changes the loop
  }, [id, animate, locked, !!beatNow]);
  // Locked: black, outlined faintly so it shows on the dark screen (a CSS filter: canvas filters don't work in Safari)
  const look = locked ? { ...style, filter: `brightness(0) drop-shadow(0 0 1px rgba(160,170,210,0.9)) drop-shadow(0 0 calc(var(--u) * 1.2) rgba(160,170,210,0.35))` } : style;
  return <canvas ref={ref} className={`block ${className}`} style={look} aria-hidden="true" />;
};

/** The arcade unit (--u) in pixels, kept up to date as the window changes (for scaling canvases to fit). */
export function useArcadeUnit(): number {
  const read = () => Math.min(window.innerHeight / 100, window.innerWidth * 0.005625);
  const [unit, setUnit] = React.useState(read);
  useEffect(() => {
    const onResize = () => setUnit(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return unit;
}

/** Difficulty as 0-3 slanted pips (imported songs have none). */
export function difficultyPips(difficulty: string): number {
  return difficulty === 'Easy' ? 1 : difficulty === 'Medium' ? 2 : difficulty === 'Hard' ? 3 : 0;
}
