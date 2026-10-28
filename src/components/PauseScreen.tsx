import React, { useState } from 'react';
import type { Track } from '../types/game';
import { audioEngine } from '../audio/audioEngine';
import { formatSongTime } from '../game/runProgress';
import { FitText, SlantButton } from './arcade/ui';

const u = (n: number) => `calc(var(--u) * ${n})`;

/**
 * The pause screen, arcade style. The fight stays frozen in view behind a
 * slanted dark panel. On the panel: PAUSED, the song and how far in you
 * are, and only three buttons (Resume, Restart, Quit to Menu). There are no
 * music stripes here. App handles the keys: Space / Esc / P resume, R
 * restarts.
 */
export const PauseScreen: React.FC<{
  track: Track | null;
  /** How long the song plays (s) */
  length: number;
  practice: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}> = ({ track, length, practice, onResume, onRestart, onQuit }) => {
  // The song is frozen while paused, so read where it stopped once
  const [at] = useState(() => audioEngine.getPlaybackTime());
  const duration = length;
  const ratio = duration > 0 ? Math.min(1, Math.max(0, at / duration)) : 0;
  const delay = (i: number): React.CSSProperties => ({ animationDelay: `${0.06 + i * 0.05}s` });

  return (
    <div className="arc-frame is-see-through arc-pause">
      <div className="arc-rotate" aria-hidden="true">
        <span className="on-touch">↻ TURN YOUR PHONE SIDEWAYS</span>
        <span className="on-mouse">↔ MAKE THE WINDOW WIDER</span>
      </div>
      <div className="arc-screen" role="dialog" aria-label="Paused">
        {/* The slanted panel, with a pink edge along its slant */}
        <div className="arc-pause-edge arc-in-left" aria-hidden="true" />
        <div className="arc-pause-panel arc-in-left" aria-hidden="true" />

        {/* Kept to the left of the middle, so your fighter stays in view */}
        <div className="absolute inset-y-0 left-0 flex flex-col justify-center" style={{ width: `min(40%, ${u(64)})`, paddingLeft: u(7), paddingRight: u(2), gap: u(2.4) }}>
          {practice && (
            <div className="arc-in-left" style={delay(0)}>
              <span className="arc-tag">PRACTICE</span>
            </div>
          )}
          <div className="arc-display arc-split arc-stamp" style={{ fontSize: u(19), transformOrigin: 'left center', ['--tilt' as string]: '-4deg' }}>
            Paused
          </div>

          {track && (
            <div className="arc-in-left" style={{ ...delay(1), marginTop: u(1) }}>
              <FitText className="arc-display" style={{ fontSize: u(5.2), color: '#fff' }}>{track.title}</FitText>
              <div className="flex items-center" style={{ gap: u(2), marginTop: u(1.4) }}>
                {/* How far into the song you are */}
                <div className="arc-strip relative flex-1" style={{ height: u(2.4), background: '#1d1d2c' }} aria-hidden="true">
                  <div className="absolute inset-y-0 left-0" style={{ width: `${ratio * 100}%`, background: 'var(--yellow)' }} />
                </div>
                {duration > 0 && (
                  <span className="font-black tabular-nums whitespace-nowrap" style={{ fontSize: u(2.8), color: 'var(--muted)' }}>
                    <span style={{ color: '#fff' }}>{formatSongTime(at)}</span> / {formatSongTime(duration)}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col" style={{ gap: u(2), marginTop: u(3) }}>
            <SlantButton variant="hot" size="lg" hotkey="Space" onClick={onResume} className="arc-in-left w-full" style={delay(2)}>
              Resume
            </SlantButton>
            <SlantButton hotkey="R" onClick={onRestart} className="arc-in-left w-full" style={delay(3)}>
              Restart
            </SlantButton>
            <SlantButton onClick={onQuit} className="arc-in-left w-full" style={delay(4)}>
              Quit to Menu
            </SlantButton>
          </div>
        </div>
      </div>
    </div>
  );
};
