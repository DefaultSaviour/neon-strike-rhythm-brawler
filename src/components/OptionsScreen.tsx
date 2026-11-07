import React, { useEffect, useRef, useState } from 'react';
import { AudioSettings, HitSoundMode } from '../types/game';
import { audioEngine } from '../audio/audioEngine';
import { ArcadeScreen, ArcadeSwitch, SlantButton } from './arcade/ui';
import { snapValue, stepValue, valueAt } from './arcade/optionsControls';
import { dragAlong, PipMeter } from './arcade/PipMeter';

/**
 * The Options screen, arcade style, all on one screen (no scrolling, even on
 * a phone on its side): sound down the left, the game's feel down the right,
 * each setting a slanted card. Volumes are pip meters you tap or drag, the
 * choices are switches with a sliding yellow block, and the timing offset
 * has − / + buttons (hold to keep going). The title music keeps playing, so
 * you hear the volume change as you go, and changing the hit sound plays it.
 *
 * Keys: Up / Down pick a setting, Left / Right change it, Escape goes back.
 * (One-button mode is the switch on the title screen.)
 */

const u = (n: number) => `calc(var(--u) * ${n})`;
const small = `max(10px, ${u(2.3)})`;

const HIT_SOUNDS: Array<{ id: HitSoundMode; label: string; note: string }> = [
  { id: 'surge', label: 'Boost', note: 'The song jumps louder for a moment' },
  { id: 'both', label: 'Both', note: 'The boost, plus a short note in key with the song' },
  { id: 'tone', label: 'Tone', note: 'A short note in key with the song' },
  { id: 'off', label: 'Off', note: 'No hit sound' },
];

const SHAKES: Array<{ id: AudioSettings['screenShake']; label: string }> = [
  { id: 'none', label: 'Off' },
  { id: 'subtle', label: 'Subtle' },
  { id: 'normal', label: 'Full' },
];

const ON_OFF: Array<{ id: 'off' | 'on'; label: string }> = [
  { id: 'off', label: 'Off' },
  { id: 'on', label: 'On' },
];

/** A button that repeats while held (after a short pause), for nudging the timing. */
const HoldButton: React.FC<{ label: string; onStep: () => void; children: React.ReactNode }> = ({ label, onStep, children }) => {
  const step = useRef(onStep);
  step.current = onStep;
  const timer = useRef(0);
  const stop = () => window.clearTimeout(timer.current);
  useEffect(() => stop, []);
  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    step.current();
    const again = (delay: number) => {
      timer.current = window.setTimeout(() => {
        step.current();
        again(55);
      }, delay);
    };
    again(380);
  };
  return (
    <SlantButton
      size="sm"
      aria-label={label}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      // A keyboard press (Enter / Space on the focused button) steps once
      onClick={(e) => e.detail === 0 && step.current()}
      style={{ width: u(10), minWidth: 44, height: u(9), padding: 0, fontSize: u(6.4), touchAction: 'none' }}
    >
      {children}
    </SlantButton>
  );
};

/** The timing offset: a bar with 0 in the middle, earlier to the left and later to the right. Tap or drag it. */
const TimingBar: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => {
  const f = (value + 300) / 600;
  const left = Math.min(f, 0.5);
  const width = Math.abs(f - 0.5);
  return (
    <div
      role="slider"
      aria-label="Timing offset"
      aria-valuemin={-300}
      aria-valuemax={300}
      aria-valuenow={value}
      aria-valuetext={`${value > 0 ? '+' : ''}${value} milliseconds`}
      className="relative flex-1 cursor-pointer select-none"
      style={{ height: u(9), minHeight: 44, touchAction: 'none' }}
      {...dragAlong((fr) => {
        const next = valueAt(fr, -300, 300, 5);
        if (next !== value) onChange(next);
      })}
    >
      {/* The track, with the middle (no offset) marked */}
      <span className="absolute inset-x-0" style={{ top: '50%', height: u(2.2), transform: 'translateY(-50%) skewX(-14deg)', background: '#262638' }} />
      <span className="absolute" style={{ left: `${left * 100}%`, width: `${width * 100}%`, top: '50%', height: u(2.2), transform: 'translateY(-50%) skewX(-14deg)', background: 'var(--cyan)', boxShadow: `0 0 ${u(1.2)} var(--cyan)` }} />
      <span className="absolute" style={{ left: '50%', top: '18%', bottom: '18%', width: 2, background: '#8d95b3' }} />
      {/* The handle */}
      <span
        className="absolute"
        style={{ left: `${f * 100}%`, top: '8%', bottom: '8%', width: u(2.6), minWidth: 10, transform: 'translateX(-50%) skewX(-14deg)', background: 'var(--yellow)', boxShadow: '0 0 0 2px #000' }}
      />
    </div>
  );
};

interface Setting {
  id: string;
  label: string;
  /** Shown big at the top right of the card */
  value?: string;
  /** Shown along the bottom while this setting is picked */
  hint: string;
  /** Left / Right on the keyboard */
  nudge: (dir: 1 | -1) => void;
  control: React.ReactNode;
}

/** Cycle through a list of choices for the keyboard (stops at the ends). */
function nextChoice<T>(list: Array<{ id: T }>, value: T, dir: 1 | -1): T {
  const i = list.findIndex((o) => o.id === value);
  return list[Math.min(list.length - 1, Math.max(0, i + dir))].id;
}

export const OptionsScreen: React.FC<{
  settings: AudioSettings;
  onUpdateSettings: (settings: Partial<AudioSettings>) => void;
  onClose: () => void;
}> = ({ settings, onUpdateSettings, onClose }) => {
  const [selected, setSelected] = useState(0);
  const lastTone = useRef(0);

  // Let you hear what you picked: a hit sound, or the tone at its new volume (not too often while dragging)
  const playSample = (mode: HitSoundMode) => {
    const now = performance.now();
    if (now - lastTone.current < 110) return;
    lastTone.current = now;
    audioEngine.playHitSound('PERFECT', 'bass', 262, mode);
  };

  const setHitSound = (hitSound: HitSoundMode) => {
    onUpdateSettings({ hitSound });
    lastTone.current = 0;
    playSample(hitSound);
  };
  const setSfx = (sfxVolume: number) => {
    onUpdateSettings({ sfxVolume });
    playSample('tone');
  };
  const setLatency = (latencyOffsetMs: number) => onUpdateSettings({ latencyOffsetMs: snapValue(latencyOffsetMs, -300, 300, 5) });

  const hitSound = HIT_SOUNDS.find((h) => h.id === settings.hitSound) ?? HIT_SOUNDS[0];
  const shake = settings.screenShake || 'subtle';
  const latency = settings.latencyOffsetMs;

  const sound: Setting[] = [
    {
      id: 'music',
      label: 'Music',
      value: `${Math.round(settings.volume * 100)}%`,
      hint: 'How loud the songs are. Tap or drag the meter.',
      nudge: (d) => onUpdateSettings({ volume: stepValue(settings.volume, d, 0, 1, 0.05) }),
      control: <PipMeter label="Music volume" value={settings.volume} color="var(--pink)" onChange={(volume) => onUpdateSettings({ volume })} />,
    },
    {
      id: 'sfx',
      label: 'Hit sound volume',
      value: `${Math.round(settings.sfxVolume * 100)}%`,
      hint: 'How loud the note is when you land a hit.',
      nudge: (d) => setSfx(stepValue(settings.sfxVolume, d, 0, 1, 0.05)),
      control: <PipMeter label="Hit sound volume" value={settings.sfxVolume} color="var(--cyan)" onChange={setSfx} />,
    },
    {
      id: 'hitSound',
      label: 'Hit sound',
      hint: `${hitSound.label}: ${hitSound.note}.`,
      nudge: (d) => setHitSound(nextChoice(HIT_SOUNDS, settings.hitSound, d)),
      control: <ArcadeSwitch label="Hit sound" options={HIT_SOUNDS} value={settings.hitSound} onChange={setHitSound} />,
    },
  ];

  const feel: Setting[] = [
    {
      id: 'timing',
      label: 'Timing offset',
      value: `${latency > 0 ? '+' : ''}${latency} ms`,
      hint: 'Hits showing LATE? Raise it. EARLY? Lower it. Bluetooth headphones often need +150 ms or more. After a song, the results suggest a fix.',
      nudge: (d) => setLatency(latency + d * 5),
      control: (
        <div className="flex items-center" style={{ gap: u(1.6) }}>
          <HoldButton label="Earlier" onStep={() => setLatency(latency - 5)}>
            −
          </HoldButton>
          <TimingBar value={latency} onChange={setLatency} />
          <HoldButton label="Later" onStep={() => setLatency(latency + 5)}>
            +
          </HoldButton>
        </div>
      ),
    },
    {
      id: 'shake',
      label: 'Screen shake',
      hint: 'How hard the screen jolts on big hits. Off keeps it perfectly still.',
      nudge: (d) => onUpdateSettings({ screenShake: nextChoice(SHAKES, shake, d) }),
      control: <ArcadeSwitch label="Screen shake" options={SHAKES} value={shake} onChange={(screenShake) => onUpdateSettings({ screenShake })} />,
    },
    {
      id: 'scanlines',
      label: 'Scanlines',
      hint: 'The lines of an old arcade screen over the game.',
      nudge: (d) => onUpdateSettings({ scanlines: d === 1 }),
      control: <ArcadeSwitch label="Scanlines" options={ON_OFF} value={settings.scanlines ? 'on' : 'off'} onChange={(v) => onUpdateSettings({ scanlines: v === 'on' })} />,
    },
  ];

  const all = [...sound, ...feel];
  const current = all[Math.min(selected, all.length - 1)];

  // Keys. Caught first (capture) so the game's own keys never fire here too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      let handled = true;
      if (e.code === 'Escape' || e.code === 'Backspace') onClose();
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') setSelected((i) => (i + 1) % all.length);
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') setSelected((i) => (i - 1 + all.length) % all.length);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') current.nudge(1);
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') current.nudge(-1);
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const card = (s: Setting, i: number) => {
    const active = all[selected] === s;
    return (
      <div
        key={s.id}
        className="arc-strip arc-in-left flex flex-col"
        onPointerEnter={() => setSelected(all.indexOf(s))}
        onFocusCapture={() => setSelected(all.indexOf(s))}
        style={{
          gap: u(1.2),
          padding: `${u(1.6)} ${u(4)} ${u(1.9)}`,
          animationDelay: `${0.04 + i * 0.05}s`,
          background: active ? 'linear-gradient(to top, var(--pink) 0 3px, #1f1f30 3px)' : undefined,
          transition: 'background 0.12s',
        }}
      >
        <div className="flex items-baseline justify-between" style={{ gap: u(2) }}>
          <span className="font-black uppercase tracking-[0.16em] whitespace-nowrap" style={{ fontSize: small, color: active ? '#fff' : 'var(--muted)' }}>
            {s.label}
          </span>
          {s.value && (
            <b className="arc-display" style={{ fontSize: u(4.2), color: active ? 'var(--yellow)' : '#fff' }}>
              {s.value}
            </b>
          )}
        </div>
        {s.control}
      </div>
    );
  };

  const column = (title: string, color: string, settingsList: Setting[], offset: number) => (
    <section className="flex flex-col min-w-0" style={{ gap: u(1.4) }} aria-label={title}>
      <div className="font-black tracking-[0.25em]" style={{ fontSize: small, color, paddingLeft: u(1) }}>
        {title.toUpperCase()}
      </div>
      {settingsList.map((s, i) => card(s, offset + i))}
    </section>
  );

  return (
    <ArcadeScreen label="Options" stripes="options">
      {/* Header */}
      <div className="absolute flex items-center" style={{ left: u(5), top: u(4), gap: u(2) }}>
        <SlantButton onClick={onClose} aria-label="Back" className="arc-in-left" style={{ width: u(12), padding: 0 }}>
          ‹
        </SlantButton>
        <h2 className="arc-display arc-skew m-0 arc-in-left" style={{ fontSize: u(8.4), textShadow: `${u(0.4)} 0 0 var(--pink)` }}>
          Options
        </h2>
      </div>

      {/* The settings: sound on the left, the game's feel on the right */}
      <div
        className="absolute grid"
        style={{ top: u(16.5), left: '50%', transform: 'translateX(-50%)', width: `min(calc(100% - ${u(10)}), ${u(168)})`, gridTemplateColumns: '1fr 1fr', gap: `0 ${u(3)}` }}
      >
        {column('Sound', 'var(--pink)', sound, 0)}
        {column('Game', 'var(--cyan)', feel, sound.length)}
      </div>

      {/* What the picked setting does */}
      <div
        className="absolute flex items-end justify-between"
        style={{ left: '50%', transform: 'translateX(-50%)', width: `min(calc(100% - ${u(10)}), ${u(168)})`, bottom: u(3.5), gap: u(4) }}
      >
        <div role="status" className="font-bold text-[#ffc2d6] line-clamp-2" style={{ fontSize: `max(11px, ${u(2.6)})`, lineHeight: 1.3, paddingLeft: u(1) }}>
          {current.hint}
        </div>
        <div className="arc-blink font-black tracking-[0.3em] text-[color:var(--yellow)] whitespace-nowrap [@media(pointer:coarse)]:hidden" style={{ fontSize: `max(10px, ${u(2.2)})` }}>
          ↑↓ PICK · ←→ CHANGE · ESC BACK
        </div>
      </div>
    </ArcadeScreen>
  );
};
