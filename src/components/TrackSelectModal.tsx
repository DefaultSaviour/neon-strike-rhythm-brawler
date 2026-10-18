import React, { useState, useRef } from 'react';
import { Track, HighScoreRecord, AudioSettings } from '../types/game';
import { GameOptions } from './GameOptions';
import { PRELOADED_TRACKS, audioEngine } from '../audio/audioEngine';
import { Play, Upload, Award, Sliders, Volume2, Sparkles, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';

interface TrackSelectModalProps {
  currentTrack: Track | null;
  highScores: Record<string, HighScoreRecord>;
  settings: AudioSettings;
  customTracks: Track[];
  onSelectTrack: (track: Track) => void;
  onPlayTrack?: (track: Track) => void;
  onTrackAdded: (track: Track) => void;
  onTrackDeleted: (trackId: string) => void;
  onUpdateSettings: (settings: Partial<AudioSettings>) => void;
  onClose: () => void;
}

export const TrackSelectModal: React.FC<TrackSelectModalProps> = ({
  currentTrack,
  highScores,
  settings,
  customTracks,
  onSelectTrack,
  onPlayTrack,
  onTrackAdded,
  onTrackDeleted,
  onUpdateSettings,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'tracks' | 'custom' | 'settings'>('tracks');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allTracks = [...PRELOADED_TRACKS, ...customTracks];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setAnalysisProgress(0.1);
    setAnalysisError(null);

    try {
      const track = await audioEngine.analyzeAudioFile(file, (p) => {
        setAnalysisProgress(p);
      });
      onTrackAdded(track);
      onSelectTrack(track);
      setAnalyzing(false);
    } catch (err: unknown) {
      console.error('Audio analysis failed:', err);
      setAnalysisError(
        err instanceof Error ? err.message : 'Could not decode audio. Try another MP3 or WAV file.'
      );
      setAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-3xl bg-[#0b0d1e] border border-cyan-500/30 rounded-xl shadow-[0_0_40px_rgba(0,243,255,0.15)] flex flex-col overflow-hidden max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <div className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-pink-500 to-amber-300">
              NEON STRIKE
            </div>
            <div className="text-xs text-slate-400">Rhythm Combat Library & Settings</div>
          </div>

          {/* Tab selector */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('tracks')}
              className={`px-3 py-1.5 rounded font-medium transition-colors cursor-pointer ${
                activeTab === 'tracks'
                  ? 'bg-cyan-500 text-black font-bold shadow-[0_0_10px_rgba(0,243,255,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Soundtrack
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-3 py-1.5 rounded font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                activeTab === 'custom'
                  ? 'bg-pink-500 text-white font-bold shadow-[0_0_10px_rgba(255,0,127,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Audio</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                activeTab === 'settings'
                  ? 'bg-amber-400 text-black font-bold shadow-[0_0_10px_rgba(255,230,0,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Calibrate</span>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'tracks' && (
            <div className="flex flex-col gap-3">
              {allTracks.map((track) => {
                const isSelected = currentTrack?.id === track.id;
                const record = highScores[track.id];

                return (
                  <div
                    key={track.id}
                    onClick={() => onSelectTrack(track)}
                    className={`p-4 rounded-lg border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/30 shadow-[0_0_15px_rgba(0,243,255,0.2)]'
                        : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded flex items-center justify-center font-bold text-sm shrink-0 border ${
                          track.difficulty === 'Easy'
                            ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/30'
                            : track.difficulty === 'Medium'
                            ? 'border-cyan-500/40 text-cyan-400 bg-cyan-950/30'
                            : track.difficulty === 'Hard'
                            ? 'border-pink-500/40 text-pink-400 bg-pink-950/30'
                            : 'border-amber-500/40 text-amber-400 bg-amber-950/30'
                        }`}
                      >
                        {track.difficulty[0]}
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100 text-base">{track.title}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                            {track.bpm} BPM
                          </span>
                          {track.isCustom && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-950 text-pink-300 border border-pink-500/40 uppercase">
                              Custom
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{track.description}</div>
                      </div>
                    </div>

                    {/* Stats & High Score Badge */}
                    <div className="flex items-center justify-between md:justify-end gap-5 border-t md:border-t-0 pt-2 md:pt-0 border-slate-800/80">
                      {record ? (
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div className="text-right">
                            <div className="text-slate-400 text-[10px]">BEST SCORE</div>
                            <div className="text-slate-100 font-bold tabular-nums">
                              {record.highScore.toLocaleString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-slate-400 text-[10px]">MAX COMBO</div>
                            <div className="text-cyan-400 font-bold tabular-nums">
                              {record.maxCombo}x
                            </div>
                          </div>
                          <div className="w-8 h-8 rounded-full border border-amber-400/50 flex items-center justify-center font-black text-amber-300 bg-amber-950/30">
                            {record.grade}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 font-mono">No record yet</div>
                      )}

                      {track.isCustom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTrackDeleted(track.id);
                          }}
                          className="p-2 rounded bg-red-950/40 border border-red-500/40 text-red-400 hover:bg-red-900/60 transition-colors cursor-pointer"
                          title="Delete custom track"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onPlayTrack) {
                            onPlayTrack(track);
                          } else {
                            onSelectTrack(track);
                            onClose();
                          }
                        }}
                        className={`px-4 py-2 rounded font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-400 text-black hover:bg-cyan-300 shadow-[0_0_12px_rgba(0,243,255,0.5)]'
                            : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Play</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="flex flex-col gap-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center gap-3 transition-colors cursor-pointer ${
                  analyzing
                    ? 'border-pink-500 bg-pink-950/20'
                    : 'border-slate-700 hover:border-cyan-400 bg-slate-900/40 hover:bg-slate-900/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/mp3,audio/wav,audio/ogg,audio/mpeg"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={analyzing}
                />

                <div className="w-14 h-14 rounded-full bg-pink-500/10 border border-pink-500/40 flex items-center justify-center text-pink-400">
                  <Upload className="w-6 h-6" />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="font-bold text-slate-100 text-base">
                    Drop your music file here or click to browse
                  </div>
                  <div className="text-xs text-slate-400">
                    Supports .mp3, .wav, .ogg · Analyzed locally in your browser via Web Audio API
                  </div>
                </div>

                {analyzing && (
                  <div className="w-full max-w-xs mt-3 flex flex-col gap-2">
                    <div className="flex justify-between text-xs text-slate-400 font-mono">
                      <span>Analyzing Spectral Beats...</span>
                      <span>{Math.round(analysisProgress * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-pink-500 transition-all duration-150"
                        style={{ width: `${analysisProgress * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {analysisError && (
                <div className="p-3 rounded bg-red-950/40 border border-red-500/50 flex items-center gap-2 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{analysisError}</span>
                </div>
              )}

              {/* Imported Tracks list */}
              {customTracks.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs uppercase font-bold tracking-wider text-slate-400">
                    <span>Imported Tracks ({customTracks.length})</span>
                    <span className="text-[10px] text-cyan-400 font-mono">Stored permanently in browser</span>
                  </div>
                  {customTracks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded border border-slate-800 bg-slate-900/50 flex items-center justify-between gap-3"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-200 text-sm">{t.title}</span>
                        <span className="text-xs text-slate-400 font-mono">
                          {t.bpm} BPM · {t.notes.length} beat enemies · {t.duration}s
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onTrackDeleted(t.id)}
                          className="p-1.5 rounded bg-red-950/40 border border-red-500/40 text-red-400 hover:bg-red-900/60 transition-colors cursor-pointer"
                          title="Delete track"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            onSelectTrack(t);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded bg-cyan-500 text-black font-bold text-xs flex items-center gap-1 hover:bg-cyan-400 cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Play Now</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex flex-col gap-6 max-w-lg mx-auto">
              <GameOptions settings={settings} onUpdateSettings={onUpdateSettings} sections={['hero', 'motion', 'hitSound']} />

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
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-mono">
            Selected: <span className="text-slate-300">{currentTrack?.title}</span>
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-sm tracking-wide shadow-[0_0_15px_rgba(0,243,255,0.4)] transition-all cursor-pointer"
          >
            Start Combat
          </button>
        </div>
      </div>
    </div>
  );
};
