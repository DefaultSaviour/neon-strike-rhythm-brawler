import React, { useEffect } from 'react';
import { AudioSettings } from '../types/game';
import { SettingsPanel } from './SettingsPanel';

/** The Options screen from the title menu. */
export const OptionsScreen: React.FC<{
  settings: AudioSettings;
  onUpdateSettings: (settings: Partial<AudioSettings>) => void;
  onClose: () => void;
}> = ({ settings, onUpdateSettings, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-[#0b0d1e] border border-cyan-500/30 rounded-xl shadow-[0_0_40px_rgba(0,243,255,0.15)] flex flex-col overflow-hidden max-h-[92vh]">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-pink-500 to-amber-300">
            OPTIONS
          </div>
          <div className="text-xs text-slate-400">Sound, timing and how the game looks</div>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <SettingsPanel settings={settings} onUpdateSettings={onUpdateSettings} />
        </div>
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-sm tracking-wide cursor-pointer"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};
