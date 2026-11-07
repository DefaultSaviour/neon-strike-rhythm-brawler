import React, { useState } from 'react';
import type { Track } from '../types/game';
import { audioEngine } from '../audio/audioEngine';
import { formatSongTime } from '../game/runProgress';
import { FitText, SlantButton } from './arcade/ui';
import { PipMeter } from './arcade/PipMeter';

const u = (n: number) => `calc(var(--u) * ${n})`;

/**
 * The pause screen, arcade style. The fight stays frozen in view behind a
 * slanted dark panel. On the panel: PAUSED, the song and how far in you
 * are, a music volume meter, and three buttons (Resume, Restart, Quit to Menu). There are no
 * music stripes here. App handles the keys: Space / Esc / P resume, R
 * restarts.
 */
export const PauseScreen: React.FC<{
  track: Track | null;
  /** How long the song plays (s) */
  length: number;
  practice: boolean;
  /** Music volume (0..1) */
  volume: number;
  onVolume: (volume: number) => void;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}> = ({ track, length, practice, volume, onVolume, onResume, onRestart, onQuit }) => {
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

          {/* Music volume: tap or drag (you hear it once the song resumes) */}
          <div className="arc-in-left flex items-center font-black tracking-[0.2em]" style={{ ...delay(2), gap: u(1.4), fontSize: `max(10px, ${u(2.3)})` }}>
            <span style={{ color: 'var(--muted)' }}>MUSIC</span>
            <div className="flex-1">
              <PipMeter label="Music volume" value={volume} color="var(--pink)" onChange={onVolume} />
            </div>
            <span className="tabular-nums text-right" style={{ color: '#fff', minWidth: '4ch' }}>{Math.round(volume * 100)}%</span>
          </div>

          <div className="flex flex-col" style={{ gap: u(2), marginTop: u(1) }}>
            <SlantButton variant="hot" size="lg" hotkey="Space" onClick={onResume} className="arc-in-left w-full" style={delay(3)}>
              Resume
            </SlantButton>
            <SlantButton hotkey="R" onClick={onRestart} className="arc-in-left w-full" style={delay(4)}>
              Restart
            </SlantButton>
            <SlantButton onClick={onQuit} className="arc-in-left w-full" style={delay(5)}>
              Quit to Menu
            </SlantButton>
          </div>
        </div>
      </div>
    </div>
  );
};
