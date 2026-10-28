import React, { useEffect, useRef, useState } from 'react';
import type { LifetimeStats } from '../game/heroUnlocks';
import { byCombo, byScore, playTime, shortNumber, SongRecord } from '../game/records';
import { ArcadeScreen, ArcadeSwitch, FitText, SlantButton } from './arcade/ui';
import { useDragScroll } from './arcade/dragScroll';

/**
 * Your records, arcade style, on one screen (only the song list scrolls,
 * and you can drag it): your lifetime totals in a slanted panel on the
 * left, and every song you've played ranked on the right, by best score or
 * by biggest combo. Number one is picked out in white. (On CrazyGames, your
 * best song score also goes on the site's leaderboard.)
 *
 * Keys: Left / Right switch the ranking, Up / Down scroll, Escape goes back.
 */

interface RecordsScreenProps {
  stats: LifetimeStats;
  /** Every song played, with its best score and combo */
  songs: SongRecord[];
  onClose: () => void;
}

type Rank = 'score' | 'combo';

const RANKS: Array<{ id: Rank; label: string }> = [
  { id: 'score', label: 'Best score' },
  { id: 'combo', label: 'Best combo' },
];

const u = (n: number) => `calc(var(--u) * ${n})`;
const small = `max(10px, ${u(2.3)})`;

export const RecordsScreen: React.FC<RecordsScreenProps> = ({ stats, songs, onClose }) => {
  const [rank, setRank] = useState<Rank>('score');
  const listRef = useRef<HTMLOListElement | null>(null);
  useDragScroll(listRef);
  // A new ranking starts from number one
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [rank]);

  // Keys. Caught first (capture) so the game's own keys never fire here too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      let handled = true;
      if (e.code === 'Escape' || e.code === 'Backspace') onClose();
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') setRank('combo');
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') setRank('score');
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') listRef.current?.scrollBy({ top: 120, behavior: 'smooth' });
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') listRef.current?.scrollBy({ top: -120, behavior: 'smooth' });
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const ranked = rank === 'score' ? byScore(songs) : byCombo(songs);
  const tiles: Array<[string, string, string]> = [
    ['Songs cleared', shortNumber(stats.songsCleared), 'var(--cyan)'],
    ['Enemies down', shortNumber(stats.enemiesDefeated), 'var(--pink)'],
    ['Perfect hits', shortNumber(stats.perfects), 'var(--yellow)'],
    ['Time played', playTime(stats.playSeconds), '#fff'],
  ];

  return (
    <ArcadeScreen label="Records">
      {/* Header */}
      <div className="absolute flex items-center" style={{ left: u(5), top: u(4), gap: u(2) }}>
        <SlantButton onClick={onClose} aria-label="Back" className="arc-in-left" style={{ width: u(12), padding: 0 }}>
          ‹
        </SlantButton>
        <h2 className="arc-display arc-skew m-0 arc-in-left" style={{ fontSize: u(8.4), textShadow: `${u(0.4)} 0 0 var(--pink)` }}>
          Records
        </h2>
      </div>

      {/* Lifetime totals */}
      <section
        className="absolute arc-in-left"
        aria-label="Lifetime"
        style={{ left: 0, top: u(18), bottom: 0, width: '36%', background: 'linear-gradient(160deg, #1a0b18, rgba(7,7,12,0) 75%)', clipPath: 'polygon(0 0, 100% 0, 84% 100%, 0 100%)' }}
      >
        <div className="absolute flex flex-col" style={{ left: u(5), right: u(9), top: u(3), gap: u(2.4) }}>
          <div className="font-black tracking-[0.25em] text-[color:var(--pink)]" style={{ fontSize: small }}>
            LIFETIME
          </div>
          <div>
            <div className="font-black uppercase tracking-[0.16em] text-[color:var(--muted)]" style={{ fontSize: small }}>
              Total score
            </div>
            <div className="arc-display arc-skew text-[color:var(--yellow)]" style={{ fontSize: u(9.5), textShadow: `${u(0.5)} ${u(0.5)} 0 #000` }}>
              {stats.totalScore.toLocaleString()}
            </div>
          </div>
          <div className="grid grid-cols-2" style={{ gap: u(1) }}>
            {tiles.map(([label, value, color]) => (
              <div key={label} className="arc-strip flex flex-col justify-center" style={{ height: u(12), minHeight: 44, padding: `0 ${u(3)}` }}>
                <span className="font-black uppercase tracking-[0.12em] text-[color:var(--muted)] whitespace-nowrap" style={{ fontSize: `max(9px, ${u(1.9)})` }}>
                  {label}
                </span>
                <b className="arc-display whitespace-nowrap" style={{ fontSize: u(5), color }}>
                  {value}
                </b>
              </div>
            ))}
          </div>
          <div>
            <div className="font-black uppercase tracking-[0.16em] text-[color:var(--muted)]" style={{ fontSize: small }}>
              Biggest combo
            </div>
            <div className="arc-display arc-skew" style={{ fontSize: u(8), color: 'var(--cyan)', textShadow: `${u(0.5)} ${u(0.5)} 0 #000` }}>
              {stats.bestCombo.toLocaleString()}×
            </div>
          </div>
        </div>
      </section>

      {/* Your songs, ranked */}
      {songs.length > 0 && (
        <div className="absolute arc-in-right" style={{ left: '38%', right: u(4), top: u(5) }}>
          <ArcadeSwitch label="Rank songs by" options={RANKS} value={rank} onChange={setRank} />
        </div>
      )}

      {songs.length === 0 ? (
        <div className="absolute grid place-items-center text-center" style={{ left: '38%', right: u(4), top: u(18), bottom: u(12) }}>
          <div>
            <div className="arc-display arc-skew" style={{ fontSize: u(6) }}>
              No records yet
            </div>
            <div className="font-bold text-[color:var(--muted)]" style={{ fontSize: `max(11px, ${u(2.6)})`, marginTop: u(1.4) }}>
              Play a song to set your first.
            </div>
          </div>
        </div>
      ) : (
        <ol
          ref={listRef}
          className="absolute arc-scroll flex flex-col select-none m-0 p-0 list-none"
          aria-label={rank === 'score' ? 'Songs by best score' : 'Songs by best combo'}
          style={{ left: '38%', right: u(4), top: u(18), bottom: u(10), gap: u(1.2), paddingRight: u(1) }}
        >
          {ranked.map((s, i) => {
            const top = i === 0;
            const value = rank === 'score' ? s.score.toLocaleString() : `${s.combo.toLocaleString()}×`;
            return (
              <li
                key={s.trackId}
                className={`arc-strip arc-in-right shrink-0 flex items-center ${top ? 'text-black' : 'text-white'}`}
                style={{
                  animationDelay: `${Math.min(i, 8) * 0.03}s`,
                  minHeight: 44,
                  height: top ? u(12) : u(9.5),
                  marginInline: top ? 0 : '3%',
                  padding: `0 ${u(4)}`,
                  gap: u(2.2),
                  background: top ? `linear-gradient(to top, var(--pink) ${u(0.9)}, #fff ${u(0.9)})` : undefined,
                }}
              >
                <span className="arc-display shrink-0" style={{ fontSize: top ? u(5) : u(3.6), width: u(6), color: top ? 'var(--pink)' : i < 3 ? 'var(--yellow)' : '#3c4363' }}>
                  {top ? '★1' : i + 1}
                </span>
                <FitText className="arc-display" style={{ fontSize: top ? u(5.2) : u(4.2), flex: 1 }}>
                  {s.title}
                </FitText>
                <span className="arc-display shrink-0 text-center" style={{ fontSize: u(3.8), width: u(6), color: top ? '#9a9cab' : 'var(--muted)' }} aria-label={`Grade ${s.grade}`}>
                  {s.grade}
                </span>
                <b className="arc-display shrink-0 text-right" style={{ fontSize: top ? u(5.6) : u(4.4), minWidth: u(16) }}>
                  {value}
                </b>
              </li>
            );
          })}
        </ol>
      )}

      {/* Where your best goes, and the keys */}
      <div className="absolute flex items-end justify-between" style={{ left: '38%', right: u(4), bottom: u(3.5), gap: u(3) }}>
        <div className="font-bold text-[color:var(--muted)]" style={{ fontSize: `max(10px, ${u(2.2)})` }}>
          Your best song score also goes on the CrazyGames leaderboard.
        </div>
        <div className="arc-blink font-black tracking-[0.3em] text-[color:var(--yellow)] whitespace-nowrap [@media(pointer:coarse)]:hidden" style={{ fontSize: `max(10px, ${u(2.2)})` }}>
          ←→ RANK · ESC BACK
        </div>
      </div>
    </ArcadeScreen>
  );
};
