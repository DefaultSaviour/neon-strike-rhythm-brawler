import React from 'react';
import { AudioSettings, HitSoundMode } from '../types/game';
import { ENEMY_MOTION_STYLES } from '../game/enemyMotion';
import { HEROES } from '../game/heroes';
import { LifetimeStats, UNLOCK_ORDER, unlockProgress } from '../game/heroUnlocks';

/**
 * Quick in-game options, shared by the pause menu and the Settings tab.
 * Pick which sections to show with `sections`.
 */

export type OptionSection = 'hero' | 'motion' | 'hitSound' | 'volume' | 'latency';

const HIT_SOUND_OPTIONS: Array<{ id: HitSoundMode; label: string; description: string }> = [
  { id: 'both', label: 'Tone + boost', description: 'A note in key with the song, plus a short music volume boost' },
  { id: 'tone', label: 'Tone only', description: 'A short note tuned to the beat you hit' },
  { id: 'surge', label: 'Boost only', description: 'The song gets louder for a moment' },
  { id: 'off', label: 'Off', description: 'No hit sound' },
];

interface GameOptionsProps {
  settings: AudioSettings;
  onUpdateSettings: (settings: Partial<AudioSettings>) => void;
  sections?: OptionSection[];
  /** The player's lifetime totals: heroes not yet earned show their goal and can't be picked */
  lifetimeStats?: LifetimeStats;
}

/** A choice that can't be picked yet, and what it takes to earn it. */
interface Lock {
  label: string;
  current: number;
  target: number;
}

function ChoiceGrid<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: Array<{ id: T; label: string; description: string; lock?: Lock }>;
  value: T;
  onChange: (id: T) => void;
}) {
  const selected = options.find((o) => o.id === value);
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-slate-300">{title}</div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) =>
          o.lock ? (
            <button
              key={o.id}
              type="button"
              disabled
              title={`Locked: ${o.lock.label}`}
              className="px-2.5 py-2 rounded-lg border text-xs font-bold bg-slate-950/70 border-slate-800 text-slate-500 cursor-not-allowed flex flex-col items-start gap-0.5 text-left"
            >
              <span>
                <span aria-hidden="true">🔒 </span>
                {o.label}
              </span>
              <span className="text-[10px] font-medium text-slate-500">{o.lock.label}</span>
              <span className="w-full h-1 rounded bg-slate-800 overflow-hidden" aria-label={`${o.lock.current} of ${o.lock.target}`}>
                <span className="block h-full bg-cyan-500/70" style={{ width: `${(o.lock.current / o.lock.target) * 100}%` }} />
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {o.lock.current.toLocaleString()} / {o.lock.target.toLocaleString()}
              </span>
            </button>
          ) : (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              aria-pressed={o.id === value}
              className={`px-2.5 py-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                o.id === value
                  ? 'bg-cyan-400/15 border-cyan-400 text-cyan-300'
                  : 'bg-slate-900/70 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              {o.label}
            </button>
          )
        )}
      </div>
      {selected && <div className="text-[11px] text-slate-500">{selected.description}</div>}
    </div>
  );
}

function Slider({
  label,
  display,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs text-slate-300">
        <span className="font-semibold">{label}</span>
        <span className="font-mono text-cyan-400">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-cyan-400 cursor-pointer"
      />
    </label>
  );
}

export const GameOptions: React.FC<GameOptionsProps> = ({
  settings,
  onUpdateSettings,
  sections = ['hero', 'motion', 'hitSound', 'volume', 'latency'],
  lifetimeStats,
}) => {
  const ordered = [...HEROES].sort((a, b) => UNLOCK_ORDER.indexOf(a.id) - UNLOCK_ORDER.indexOf(b.id));
  const heroOptions = ordered.map((h) => {
    const progress = lifetimeStats ? unlockProgress(h.id, lifetimeStats) : null;
    const lock = progress && !progress.done ? { label: progress.goal.label, current: progress.current, target: progress.goal.target } : undefined;
    return { id: h.id, label: h.label, description: h.description, lock };
  });
  // A saved choice the player hasn't earned (yet) shows as the hero they'll actually play.
  const heroValue = heroOptions.find((o) => o.id === settings.hero && !o.lock) ? settings.hero : HEROES[0].id;
  return (
    <div className="flex flex-col gap-5 text-left">
      {sections.includes('hero') && (
        <ChoiceGrid
          title="Hero"
          options={heroOptions}
          value={heroValue}
          onChange={(hero) => onUpdateSettings({ hero })}
        />
      )}

      {sections.includes('motion') && (
        <ChoiceGrid
          title="Enemy Movement"
          options={ENEMY_MOTION_STYLES}
          value={settings.enemyMotion}
          onChange={(enemyMotion) => onUpdateSettings({ enemyMotion })}
        />
      )}

      {sections.includes('hitSound') && (
        <ChoiceGrid
          title="Hit Sound"
          options={HIT_SOUND_OPTIONS}
          value={settings.hitSound}
          onChange={(hitSound) => onUpdateSettings({ hitSound })}
        />
      )}

      {sections.includes('volume') && (
        <div className="flex flex-col gap-3">
          <Slider
            label="Music Volume"
            display={`${Math.round(settings.volume * 100)}%`}
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(volume) => onUpdateSettings({ volume })}
          />
          <Slider
            label="Hit Sound Volume"
            display={`${Math.round(settings.sfxVolume * 100)}%`}
            min={0}
            max={1}
            step={0.05}
            value={settings.sfxVolume}
            onChange={(sfxVolume) => onUpdateSettings({ sfxVolume })}
          />
        </div>
      )}

      {sections.includes('latency') && (
        <div className="flex flex-col gap-1">
          <Slider
            label="Audio Latency Offset"
            display={`${settings.latencyOffsetMs > 0 ? '+' : ''}${settings.latencyOffsetMs} ms`}
            min={-300}
            max={300}
            step={5}
            value={settings.latencyOffsetMs}
            onChange={(latencyOffsetMs) => onUpdateSettings({ latencyOffsetMs: Math.round(latencyOffsetMs) })}
          />
          <div className="text-[11px] text-slate-500">Hits showing LATE? Raise it. Showing EARLY? Lower it.</div>
        </div>
      )}
    </div>
  );
};
