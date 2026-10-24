import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Track, HighScoreRecord } from '../types/game';
import { PRELOADED_TRACKS, audioEngine } from '../audio/audioEngine';
import type { HeroId } from '../game/heroes';
import { ArcadeScreen, difficultyPips, HeroFigure, SlantButton } from './arcade/ui';

/**
 * Pick a song, and who to fight as, in one place (arcade style). Your
 * fighter is on the left (‹ › to switch between the ones you've earned);
 * the songs are slanted strips on the right, the picked one white and
 * bigger, with its difficulty, BPM and your best grade. One FIGHT! button
 * plays it, Practice plays it without dying. Your own songs can be imported
 * from the last strip.
 *
 * Keys: Up / Down pick a song, Left / Right switch fighter, Enter or Space
 * fight, P practice, Escape back.
 */

interface SongSelectScreenProps {
  currentTrack: Track | null;
  highScores: Record<string, HighScoreRecord>;
  customTracks: Track[];
  onSelectTrack: (track: Track) => void;
  onPlayTrack: (track: Track) => void;
  /** Play the song in practice mode: getting hit doesn't end it, and nothing counts */
  onPracticeTrack: (track: Track) => void;
  onTrackAdded: (track: Track) => void;
  onTrackDeleted: (trackId: string) => void;
  /** The fighter you'll play as, and the ones you can switch to (in path order) */
  heroId: HeroId;
  heroLabel: string;
  unlockedHeroes: HeroId[];
  onSelectHero: (id: HeroId) => void;
  onClose: () => void;
}

const u = (n: number) => `calc(var(--u) * ${n})`;

export const SongSelectScreen: React.FC<SongSelectScreenProps> = ({
  currentTrack,
  highScores,
  customTracks,
  onSelectTrack,
  onPlayTrack,
  onPracticeTrack,
  onTrackAdded,
  onTrackDeleted,
  heroId,
  heroLabel,
  unlockedHeroes,
  onSelectHero,
  onClose,
}) => {
  const tracks = [...PRELOADED_TRACKS, ...customTracks];
  const selected = tracks.find((t) => t.id === currentTrack?.id) ?? tracks[0];
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  const heroIndex = Math.max(0, unlockedHeroes.indexOf(heroId));
  const switchHero = (step: number) => {
    if (unlockedHeroes.length < 2) return;
    onSelectHero(unlockedHeroes[(heroIndex + step + unlockedHeroes.length) % unlockedHeroes.length]);
  };

  // Keep the picked song in view
  useLayoutEffect(() => {
    rowRefs.current.get(selected.id)?.scrollIntoView({ block: 'nearest' });
  }, [selected.id]);

  // Hear the picked song from its drop (after a moment, so scrolling past songs stays quiet)
  useEffect(() => {
    const t = window.setTimeout(() => void audioEngine.playPreview(selected), 250);
    return () => window.clearTimeout(t);
  }, [selected]);
  useEffect(() => () => audioEngine.stopPreview(), []);

  // Keys. Caught first (capture) so the game's own keys (Space pauses, arrows strike) never fire here too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT') return;
      const i = tracks.findIndex((t) => t.id === selected.id);
      let handled = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') onSelectTrack(tracks[Math.min(tracks.length - 1, i + 1)]);
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') onSelectTrack(tracks[Math.max(0, i - 1)]);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') switchHero(1);
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') switchHero(-1);
      else if (e.code === 'Enter' || e.code === 'Space') !e.repeat && onPlayTrack(selected);
      else if (e.code === 'KeyP') !e.repeat && onPracticeTrack(selected);
      else if (e.code === 'Escape' || e.code === 'Backspace') onClose();
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAnalyzing(true);
    setProgress(0.05);
    setImportError(null);
    try {
      const track = await audioEngine.analyzeAudioFile(file, setProgress);
      onTrackAdded(track);
      onSelectTrack(track);
    } catch (err: unknown) {
      console.error('Audio analysis failed:', err);
      setImportError(err instanceof Error ? err.message : 'Could not read that file. Try another MP3 or WAV.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <ArcadeScreen label="Pick your song">
      {/* Header */}
      <div className="absolute flex items-center" style={{ left: u(5), top: u(4), gap: u(2) }}>
        <SlantButton onClick={onClose} aria-label="Back" className="arc-in-left" style={{ width: u(12), padding: 0 }}>
          ‹
        </SlantButton>
        <h2 className="arc-display arc-skew m-0 arc-in-left" style={{ fontSize: u(8.4), textShadow: `${u(0.4)} 0 0 var(--pink)` }}>
          Pick your song
        </h2>
      </div>

      {/* Your fighter */}
      <section
        className="absolute"
        aria-label="Fighter"
        style={{ left: 0, top: u(18), bottom: 0, width: '34%', background: 'linear-gradient(160deg, #1a0b18, rgba(7,7,12,0) 75%)', clipPath: 'polygon(0 0, 100% 0, 84% 100%, 0 100%)' }}
      >
        <div className="absolute font-black tracking-[0.25em] text-[color:var(--pink)]" style={{ left: u(5), top: u(3), fontSize: `max(10px, ${u(2.3)})` }}>
          FIGHTER {unlockedHeroes.length > 1 && <span className="text-[color:var(--muted)]">{heroIndex + 1}/{unlockedHeroes.length}</span>}
        </div>
        <div className="absolute arc-display arc-skew whitespace-nowrap" style={{ left: u(5), top: u(7), fontSize: u(6), maxWidth: '86%' }}>
          {heroLabel}
        </div>
        {unlockedHeroes.length > 1 && (
          <div className="absolute flex" style={{ left: u(5), bottom: u(4), gap: u(1.2) }}>
            <SlantButton onClick={() => switchHero(-1)} aria-label="Previous fighter" style={{ width: u(13), padding: 0 }}>
              ‹
            </SlantButton>
            <SlantButton onClick={() => switchHero(1)} aria-label="Next fighter" style={{ width: u(13), padding: 0 }}>
              ›
            </SlantButton>
          </div>
        )}
      </section>

      {/* Your fighter, striking to the preview's beat (outside the panel, so a big kick isn't cut off) */}
      <div className="absolute pointer-events-none" style={{ left: 0, width: '36%', top: u(30), bottom: u(15) }}>
        <HeroFigure
          key={heroId}
          id={heroId}
          animate
          beatNow={() => audioEngine.getPreviewBeat()}
          className="w-full h-full"
          style={{ filter: 'drop-shadow(0 0 calc(var(--u) * 1.4) rgba(255,230,0,0.4))' }}
        />
      </div>

      {/* Songs */}
      <div
        className="absolute arc-scroll flex flex-col"
        role="listbox"
        aria-label="Songs"
        style={{ left: '36%', right: u(4), top: u(18), bottom: u(21), gap: u(1.2), paddingRight: u(1) }}
      >
        {tracks.map((t, i) => {
          const sel = t.id === selected.id;
          const pips = difficultyPips(t.difficulty);
          const best = highScores[t.id];
          return (
            <button
              key={t.id}
              ref={(el) => {
                if (el) rowRefs.current.set(t.id, el);
                else rowRefs.current.delete(t.id);
              }}
              type="button"
              role="option"
              aria-selected={sel}
              title={t.description}
              onClick={() => (sel ? onPlayTrack(t) : onSelectTrack(t))}
              className={`arc-strip arc-in-right shrink-0 flex items-center text-left cursor-pointer border-0 ${sel ? 'bg-white text-black' : 'text-white hover:bg-[#1b1b29]'}`}
              style={{ animationDelay: `${Math.min(i, 8) * 0.03}s`, minHeight: 44, height: sel ? u(13) : u(10), padding: `0 ${u(4)}`, gap: u(2.2) }}
            >
              <span className="arc-display" style={{ fontSize: u(3.6), width: u(5), color: sel ? '#000' : '#3c4363' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="arc-display truncate" style={{ fontSize: sel ? u(5.8) : u(4.4), flex: 1, minWidth: 0 }}>
                {t.title}
              </span>
              {t.isCustom && sel && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Delete ${t.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrackDeleted(t.id);
                  }}
                  className="grid place-items-center font-black bg-black text-white"
                  style={{ width: u(7), height: u(7), minWidth: 32, minHeight: 32, fontSize: u(3) }}
                >
                  ✕
                </span>
              )}
              {pips > 0 && (
                <span className="flex shrink-0" style={{ gap: u(0.5) }} aria-label={t.difficulty}>
                  {[1, 2, 3].map((k) => (
                    <i key={k} style={{ width: u(1.3), height: u(3.2), transform: 'skewX(-14deg)', background: k <= pips ? 'var(--pink)' : sel ? '#c9cbd6' : '#2c3250' }} />
                  ))}
                </span>
              )}
              <span className="font-mono font-extrabold shrink-0 text-right max-[700px]:hidden" style={{ fontSize: `max(10px, ${u(2.1)})`, width: u(11), color: sel ? '#000' : 'var(--muted)' }}>
                {Math.round(t.bpm)} BPM
              </span>
              <span className="arc-display shrink-0 text-center" style={{ fontSize: u(4.2), width: u(7), color: best ? (sel ? 'var(--pink)' : '#fff') : sel ? '#9a9cab' : '#3c4363' }}>
                {best?.grade ?? '—'}
              </span>
            </button>
          );
        })}

        {/* Your own song */}
        <button
          type="button"
          onClick={() => !analyzing && fileRef.current?.click()}
          className="arc-strip shrink-0 flex items-center cursor-pointer border-0 text-[color:var(--yellow)] hover:bg-[#1b1b29]"
          style={{ minHeight: 44, height: u(10), padding: `0 ${u(4)}`, gap: u(2) }}
        >
          <span className="arc-display" style={{ fontSize: u(4.2) }}>
            {analyzing ? `Reading your song… ${Math.round(progress * 100)}%` : '+ Import your own song'}
          </span>
          {importError && <span className="text-pink-300 truncate" style={{ fontSize: `max(10px, ${u(2.2)})` }}>{importError}</span>}
        </button>
        <input ref={fileRef} type="file" accept="audio/mp3,audio/wav,audio/ogg,audio/mpeg" className="hidden" onChange={importFile} />
      </div>

      {/* Fight */}
      <div className="absolute flex" style={{ right: u(4), bottom: u(4), gap: u(1.6) }}>
        <SlantButton variant="alt" size="lg" hotkey="P" onClick={() => onPracticeTrack(selected)} style={{ fontSize: u(4.2) }} title="Practice: getting hit doesn't end the song, and nothing counts toward unlocks or records">
          Practice
        </SlantButton>
        <SlantButton variant="hot" size="lg" hotkey="ENTER" onClick={() => onPlayTrack(selected)} className="arc-pulse" style={{ padding: `0 ${u(7)}`, fontSize: u(7.4) }}>
          Fight!
        </SlantButton>
      </div>
    </ArcadeScreen>
  );
};
