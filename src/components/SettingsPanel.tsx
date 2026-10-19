import React from 'react';
import { AudioSettings } from '../types/game';
import { GameOptions } from './GameOptions';

/**
 * Every setting in one place: hit sounds, volume, audio latency, one-button
 * mode, screen shake and scanlines. Heroes are chosen on the Unlocks screen,
 * enemy stances on the Stances screen.
 */
export const SettingsPanel: React.FC<{
  settings: AudioSettings;
  onUpdateSettings: (settings: Partial<AudioSettings>) => void;
}> = ({ settings, onUpdateSettings }) => (
  <div className="flex flex-col gap-6 max-w-lg mx-auto">
    <GameOptions settings={settings} onUpdateSettings={onUpdateSettings} sections={['hitSound']} />

    {/* Music Volume */}
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs text-slate-300">
        <span className="font-semibold">Music Volume</span>
        <span className="font-mono">{Math.round(settings.volume * 100)}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={settings.volume}
        onChange={(e) => onUpdateSettings({ volume: parseFloat(e.target.value) })}
        className="w-full accent-cyan-400 cursor-pointer"
      />
    </div>

    {/* SFX Volume */}
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs text-slate-300">
        <span className="font-semibold">Sound FX Volume</span>
        <span className="font-mono">{Math.round(settings.sfxVolume * 100)}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={settings.sfxVolume}
        onChange={(e) => onUpdateSettings({ sfxVolume: parseFloat(e.target.value) })}
        className="w-full accent-pink-500 cursor-pointer"
      />
    </div>

    {/* Latency Calibration */}
    <div className="flex flex-col gap-2 p-4 rounded-lg bg-slate-900/60 border border-slate-800">
      <div className="flex justify-between text-xs text-slate-300">
        <span className="font-semibold">Audio Latency Calibration</span>
        <span className="font-mono text-cyan-400 font-bold">
          {settings.latencyOffsetMs > 0 ? `+${settings.latencyOffsetMs}` : settings.latencyOffsetMs} ms
        </span>
      </div>
      <input
        type="range"
        min="-300"
        max="300"
        step="5"
        value={settings.latencyOffsetMs}
        onChange={(e) => onUpdateSettings({ latencyOffsetMs: parseInt(e.target.value, 10) })}
        className="w-full accent-cyan-400 cursor-pointer"
      />
      <div className="text-[11px] text-slate-500">
        If hits keep showing LATE, raise this; if they show EARLY, lower it. Bluetooth headphones usually need +150 ms or more. Tip: after a song, the results screen suggests a value for you.
      </div>
    </div>

    {/* One-Button Combat Mode Toggle */}
    <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-900/60 border border-amber-500/30">
      <div className="flex flex-col pr-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-100 text-xs">One-Button Mode</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase border ${
              settings.oneButtonMode
                ? 'bg-amber-950 border-amber-500/60 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {settings.oneButtonMode ? 'ON (1-Button)' : 'OFF (2-Button)'}
          </span>
        </div>
        <span className="text-[11px] text-slate-400 mt-1 leading-snug">
          Strike with a single input ([SPACE], screen tap, or any key). Auto-detects and targets the nearest incoming enemy in either lane.
        </span>
      </div>
      <button
        onClick={() => onUpdateSettings({ oneButtonMode: !settings.oneButtonMode })}
        className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
          settings.oneButtonMode ? 'bg-amber-400 shadow-[0_0_10px_rgba(255,230,0,0.5)]' : 'bg-slate-700'
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-black transition-transform ${
            settings.oneButtonMode ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </button>
    </div>

    {/* Screen Shake Control */}
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800">
      <div className="flex flex-col">
        <span className="font-semibold text-slate-200 text-xs">Screen Shake</span>
        <span className="text-[11px] text-slate-500">
          Controls impact vibration (Turn Off for complete stability)
        </span>
      </div>
      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
        {(['none', 'subtle', 'normal'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => onUpdateSettings({ screenShake: mode })}
            className={`px-2.5 py-1 rounded capitalize transition-colors cursor-pointer ${
              (settings.screenShake || 'subtle') === mode
                ? 'bg-cyan-500 text-black font-bold shadow-[0_0_8px_rgba(0,243,255,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {mode === 'none' ? 'Off' : mode === 'subtle' ? 'Subtle' : 'Standard'}
          </button>
        ))}
      </div>
    </div>

    {/* Scanlines CRT Toggle */}
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800">
      <div className="flex flex-col">
        <span className="font-semibold text-slate-200 text-xs">Retro CRT Scanlines</span>
        <span className="text-[11px] text-slate-500">
          Classic arcade monitor scanline & vignette overlay
        </span>
      </div>
      <button
        onClick={() => onUpdateSettings({ scanlines: !settings.scanlines })}
        className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${
          settings.scanlines ? 'bg-cyan-500' : 'bg-slate-700'
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white transition-transform ${
            settings.scanlines ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  </div>
);
