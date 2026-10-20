import React, { useState, useRef } from 'react';
import { Track, HighScoreRecord, AudioSettings } from '../types/game';
import { PRELOADED_TRACKS, audioEngine } from '../audio/audioEngine';
import { Play, Upload, Award, Sliders, Volume2, Sparkles, AlertCircle, CheckCircle, Trash2, Shield } from 'lucide-react';

interface TrackSelectModalProps {
  currentTrack: Track | null;
  highScores: Record<string, HighScoreRecord>;
  settings: AudioSettings;
  customTracks: Track[];
  onSelectTrack: (track: Track) => void;
  onPlayTrack?: (track: Track) => void;
  /** Play the song in practice mode: getting hit doesn't end it, and nothing counts */
  onPracticeTrack?: (track: Track) => void;
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
  onPracticeTrack,
  onTrackAdded,
  onTrackDeleted,
  onUpdateSettings,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'tracks' | 'custom'>('tracks');
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
            <div className="text-xs text-slate-400">Choose a song</div>
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

                      {onPracticeTrack && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPracticeTrack(track);
                          }}
                          title="Practice: getting hit doesn't end the song, and nothing counts toward unlocks or records"
                          className="min-h-11 px-4 py-2 rounded font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer bg-amber-400/10 border border-amber-400/70 text-amber-300 hover:bg-amber-400/20"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          <span>Practice</span>
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

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-mono">
            Selected: <span className="text-slate-300">{currentTrack?.title}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm cursor-pointer"
            >
              Back
            </button>
            {onPracticeTrack && currentTrack && (
              <button
                onClick={() => onPracticeTrack(currentTrack)}
                title="Practice: getting hit doesn't end the song, and nothing counts toward unlocks or records"
                className="min-h-11 px-6 py-2.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border-2 border-amber-400 text-amber-300 font-extrabold text-sm tracking-wide shadow-[0_0_15px_rgba(255,194,58,0.3)] flex items-center gap-2 cursor-pointer"
              >
                <Shield className="w-4 h-4" />
                Practice
              </button>
            )}
            {onPlayTrack && currentTrack && (
              <button
                onClick={() => onPlayTrack(currentTrack)}
                className="px-6 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-sm tracking-wide shadow-[0_0_15px_rgba(0,243,255,0.4)] transition-all cursor-pointer"
              >
                Play
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
