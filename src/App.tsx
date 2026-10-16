import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GameEngine } from './game/gameEngine';
import { Track, GameStatus, GameScoreState, HighScoreRecord, Lane, AudioSettings } from './types/game';
import { PRELOADED_TRACKS, audioEngine } from './audio/audioEngine';
import { audioStorage } from './utils/audioStorage';
import { NeonCanvas } from './components/NeonCanvas';
import { HUD } from './components/HUD';
import { TrackSelectModal } from './components/TrackSelectModal';
import { GameOverModal } from './components/GameOverModal';
import { Play, Music, Keyboard, Volume2, ShieldAlert, Award, Zap } from 'lucide-react';

export default function App() {
  const [gameStatus, setGameStatus] = useState<GameStatus>('MENU');
  const [customTracks, setCustomTracks] = useState<Track[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<Track>(PRELOADED_TRACKS[0]);
  const [scoreState, setScoreState] = useState<GameScoreState>({
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfectCount: 0,
    goodCount: 0,
    okCount: 0,
    missCount: 0,
    totalNotes: 0,
  });
  const [highScores, setHighScores] = useState<Record<string, HighScoreRecord>>({});
  const [showTrackSelect, setShowTrackSelect] = useState(false);
  const [clearedOutcome, setClearedOutcome] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    volume: 0.8,
    sfxVolume: 0.9,
    latencyOffsetMs: 0,
    scanlines: true,
    screenShake: 'subtle',
    oneButtonMode: false,
  });

  const callbacksRef = useRef({
    onScoreUpdate: (score: GameScoreState) => setScoreState(score),
    onGameOver: (score: GameScoreState, cleared: boolean) => {
      setScoreState(score);
      setClearedOutcome(cleared);
      setGameStatus(cleared ? 'CLEARED' : 'GAME_OVER');
      refreshHighScores();
    },
    onJudgement: (_judgement: string, _combo: number) => {},
  });

  // Persistent GameEngine instance
  const engine = useMemo(() => {
    return new GameEngine({
      onScoreUpdate: (s) => callbacksRef.current.onScoreUpdate(s),
      onGameOver: (s, c) => callbacksRef.current.onGameOver(s, c),
      onJudgement: (j, c) => callbacksRef.current.onJudgement(j, c),
    });
  }, []);

  const refreshHighScores = useCallback(() => {
    setHighScores(engine.getAllHighScores());
  }, [engine]);

  // Load custom tracks permanently from IndexedDB on startup
  useEffect(() => {
    const loadSavedAudio = async () => {
      try {
        await audioEngine.preloadTrackAudio(PRELOADED_TRACKS[0]);
        const stored = await audioStorage.loadAllCustomTracks(
          audioEngine.getAudioContext(),
          (buf) => audioEngine.analyzeAudioBuffer(buf)
        );
        if (stored.length > 0) {
          setCustomTracks(stored);
        }
      } catch (err) {
        console.warn('Could not load custom tracks from IndexedDB:', err);
      }
    };
    loadSavedAudio();
  }, []);

  useEffect(() => {
    refreshHighScores();
    setAudioSettings(engine.settings);
  }, [engine, refreshHighScores]);

  const handleTrackAdded = useCallback((newTrack: Track) => {
    setCustomTracks((prev) => [newTrack, ...prev.filter((t) => t.id !== newTrack.id)]);
    setSelectedTrack(newTrack);
  }, []);

  const handleTrackDeleted = useCallback(
    async (trackId: string) => {
      try {
        await audioStorage.deleteCustomTrack(trackId);
        setCustomTracks((prev) => prev.filter((t) => t.id !== trackId));
        if (selectedTrack.id === trackId) {
          setSelectedTrack(PRELOADED_TRACKS[0]);
        }
      } catch (err) {
        console.warn('Failed to delete custom track:', err);
      }
    },
    [selectedTrack.id]
  );

  // Start playing a track
  const handleStartGame = useCallback((trackToPlay: Track = selectedTrack) => {
    setSelectedTrack(trackToPlay);
    setGameStatus('PLAYING');
    setShowTrackSelect(false);
    engine.startSong(trackToPlay);
  }, [selectedTrack, engine]);

  // Restart current track
  const handleRestart = useCallback(() => {
    handleStartGame(selectedTrack);
  }, [handleStartGame, selectedTrack]);

  // Strike input handler
  const handleStrike = useCallback((lane: Lane) => {
    if (gameStatus === 'PLAYING') {
      engine.handleInput(lane);
    }
  }, [gameStatus, engine]);

  const handleOneButtonStrike = useCallback(() => {
    if (gameStatus === 'PLAYING') {
      engine.handleOneButtonInput();
    }
  }, [gameStatus, engine]);

  // Pause / Resume
  const handleTogglePause = useCallback(() => {
    if (gameStatus === 'PLAYING') {
      engine.stop();
      setGameStatus('PAUSED');
    } else if (gameStatus === 'PAUSED') {
      setGameStatus('PLAYING');
      engine.startSong(selectedTrack);
    }
  }, [gameStatus, engine, selectedTrack]);

  const handleUpdateSettings = (newSettings: Partial<AudioSettings>) => {
    engine.saveSettings(newSettings);
    setAudioSettings({ ...engine.settings });
  };

  const handleToggleOneButtonMode = useCallback(() => {
    handleUpdateSettings({ oneButtonMode: !audioSettings.oneButtonMode });
  }, [audioSettings.oneButtonMode]);

  // Keyboard controls listener (Optimized for minimal input latency)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside an input field
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      if (e.code === 'KeyR') {
        e.preventDefault();
        handleRestart();
        return;
      }

      if (audioSettings.oneButtonMode) {
        // ONE-BUTTON COMBAT MODE
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          if (gameStatus === 'PLAYING' || gameStatus === 'PAUSED') {
            handleTogglePause();
          }
        } else if (
          e.code === 'Space' ||
          e.code === 'Enter' ||
          e.code === 'KeyA' ||
          e.code === 'KeyD' ||
          e.code === 'KeyF' ||
          e.code === 'KeyJ' ||
          e.code === 'ArrowLeft' ||
          e.code === 'ArrowRight' ||
          e.code === 'ArrowDown' ||
          e.code === 'ArrowUp'
        ) {
          e.preventDefault();
          if (gameStatus === 'PLAYING') {
            handleOneButtonStrike();
          } else if (gameStatus === 'MENU') {
            handleStartGame();
          } else if (gameStatus === 'PAUSED') {
            handleTogglePause();
          }
        }
      } else {
        // STANDARD 2-BUTTON COMBAT MODE
        if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyQ') {
          e.preventDefault();
          handleStrike('left');
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'KeyE') {
          e.preventDefault();
          handleStrike('right');
        } else if (e.code === 'Space' || e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          if (gameStatus === 'PLAYING' || gameStatus === 'PAUSED') {
            handleTogglePause();
          } else if (gameStatus === 'MENU') {
            handleStartGame();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    gameStatus,
    audioSettings.oneButtonMode,
    handleStrike,
    handleOneButtonStrike,
    handleRestart,
    handleTogglePause,
    handleStartGame,
  ]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#060713] text-slate-100 select-none">
      {/* 60FPS Neon Vector Canvas Game Arena */}
      <NeonCanvas engine={engine} scanlines={audioSettings.scanlines} />

      {/* In-Game HUD overlay */}
      {gameStatus === 'PLAYING' && (
        <HUD
          track={selectedTrack}
          scoreState={scoreState}
          oneButtonMode={audioSettings.oneButtonMode}
          onToggleOneButtonMode={handleToggleOneButtonMode}
          onStrike={handleStrike}
          onOneButtonStrike={handleOneButtonStrike}
          onPause={handleTogglePause}
          onRestart={handleRestart}
          onOpenSelect={() => {
            engine.stop();
            setGameStatus('PAUSED');
            setShowTrackSelect(true);
          }}
        />
      )}

      {/* Title / Main Menu Overlay */}
      {gameStatus === 'MENU' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-between p-6 md:p-12 pointer-events-auto bg-black/60 backdrop-blur-[2px]">
          {/* Top Marquee */}
          <div className="w-full flex items-center justify-between max-w-5xl">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400 fill-current" />
              <span className="font-mono text-xs font-bold tracking-widest text-cyan-400 uppercase">
                Synthwave Rhythm Combat
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleToggleOneButtonMode}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                  audioSettings.oneButtonMode
                    ? 'bg-amber-400/20 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(255,230,0,0.35)]'
                    : 'bg-slate-900/80 border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300'
                }`}
                title="Toggle between 1-Button Mode (Auto-targets nearest beat) and 2-Button Mode (Left/Right)"
              >
                <span>Control Mode:</span>
                <span className={audioSettings.oneButtonMode ? 'text-amber-300 font-black' : 'text-cyan-400'}>
                  {audioSettings.oneButtonMode ? '1-Button Mode (ON)' : '2-Button Mode'}
                </span>
              </button>

              <button
                onClick={() => setShowTrackSelect(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700 hover:border-cyan-400 text-xs text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                <Music className="w-3.5 h-3.5 text-cyan-400" />
                <span>Track Library / Custom Audio</span>
              </button>
            </div>
          </div>

          {/* Central Logo & Start */}
          <div className="flex flex-col items-center text-center max-w-2xl">
            <h1 className="text-5xl md:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-300 to-pink-500 drop-shadow-[0_0_35px_rgba(0,243,255,0.6)]">
              NEON STRIKE
            </h1>

            <p className="mt-3 text-sm md:text-base text-slate-300 max-w-lg">
              Enemies swarm from the left and right in sync with the beat. Strike with surgical timing to chain 24 martial arts combat animations. Don't let them breach your line.
            </p>

            {/* Quick Track Preview card */}
            <div className="mt-6 p-4 rounded-xl border border-cyan-500/30 bg-slate-950/70 shadow-[0_0_20px_rgba(0,243,255,0.15)] flex items-center gap-6">
              <div className="text-left">
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                  Current Selection
                </div>
                <div className="font-extrabold text-slate-100 text-lg flex items-center gap-2">
                  <span>{selectedTrack.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-mono">
                    {selectedTrack.bpm} BPM · {selectedTrack.difficulty}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{selectedTrack.description}</div>
              </div>

              <button
                onClick={() => setShowTrackSelect(true)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer shrink-0"
              >
                Change
              </button>
            </div>

            {/* Acoustic Threat Intel Matrix: 3 Bands x 3 Tiers */}
            <div className="mt-4 w-full max-w-xl p-3 rounded-lg border border-slate-800 bg-slate-950/60 text-left text-xs">
              <div className="text-[10px] font-mono uppercase font-bold tracking-widest text-slate-500 mb-2">
                Acoustic Frequency Threat Matrix (Enemy Variants)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                <div className="p-2 rounded bg-red-950/20 border border-red-500/30">
                  <div className="text-red-400 font-bold flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full bg-[#ff1744] shadow-[0_0_6px_#ff1744]" />
                    <span>Sub / Kick</span>
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    36–145 Hz
                  </div>
                  <div className="text-[10px] text-red-200/80 mt-1 space-y-0.5">
                    <div>1. Titan <span className="text-slate-500">(low)</span></div>
                    <div>2. Breaker <span className="text-slate-500">(mid)</span></div>
                    <div>3. Rammer <span className="text-slate-500">(high)</span></div>
                  </div>
                </div>

                <div className="p-2 rounded bg-purple-950/20 border border-purple-500/30">
                  <div className="text-purple-400 font-bold flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full bg-[#d84dff] shadow-[0_0_6px_#d84dff]" />
                    <span>Bassline</span>
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    105–300 Hz
                  </div>
                  <div className="text-[10px] text-purple-200/80 mt-1 space-y-0.5">
                    <div>1. Warlord <span className="text-slate-500">(low)</span></div>
                    <div>2. Ronin <span className="text-slate-500">(mid)</span></div>
                    <div>3. Acid Dancer <span className="text-slate-500">(high)</span></div>
                  </div>
                </div>

                <div className="p-2 rounded bg-cyan-950/20 border border-cyan-500/30">
                  <div className="text-cyan-400 font-bold flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_6px_#00e5ff]" />
                    <span>Highs / Lead</span>
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    800–6500 Hz
                  </div>
                  <div className="text-[10px] text-cyan-200/80 mt-1 space-y-0.5">
                    <div>1. Speeder <span className="text-slate-500">(low)</span></div>
                    <div>2. Wraith <span className="text-slate-500">(mid)</span></div>
                    <div>3. Seraph <span className="text-slate-500">(high)</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Big Start Button */}
            <button
              onClick={() => handleStartGame()}
              className="mt-6 px-10 py-4 rounded-xl bg-gradient-to-r from-cyan-400 via-pink-500 to-amber-300 text-black font-black text-lg tracking-wider shadow-[0_0_30px_rgba(0,243,255,0.6)] hover:shadow-[0_0_40px_rgba(255,0,127,0.8)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>ENGAGE COMBAT</span>
            </button>
          </div>

          {/* Controls Instruction Bar */}
          <div className="w-full max-w-2xl bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 flex flex-wrap items-center justify-around gap-4 text-xs font-mono">
            {audioSettings.oneButtonMode ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-400 text-amber-300 font-bold">
                    [SPACE] · [ANY KEY] · [TAP]
                  </span>
                  <span className="text-amber-200">One-Button Strike (Auto-Targets)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 font-bold">
                    [ESC]
                  </span>
                  <span className="text-slate-400">Pause</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 font-bold">
                    [R]
                  </span>
                  <span className="text-slate-400">Restart</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-cyan-400 font-bold">
                    [←] or [A]
                  </span>
                  <span className="text-slate-400">Strike Left</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-pink-400 font-bold">
                    [→] or [D]
                  </span>
                  <span className="text-slate-400">Strike Right</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 font-bold">
                    [R]
                  </span>
                  <span className="text-slate-400">Restart</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Paused Overlay */}
      {gameStatus === 'PAUSED' && !showTrackSelect && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0b0d1e] border border-cyan-500/40 rounded-xl p-6 text-center flex flex-col items-center shadow-2xl">
            <div className="text-2xl font-black tracking-widest text-cyan-400 uppercase mb-2">
              PAUSED
            </div>
            <div className="text-xs text-slate-400 mb-6 font-mono">
              Track: {selectedTrack.title}
            </div>

            <div className="w-full flex flex-col gap-3">
              <button
                onClick={handleTogglePause}
                className="w-full py-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-sm shadow-[0_0_15px_rgba(0,243,255,0.4)] transition-all cursor-pointer"
              >
                Resume (Space)
              </button>

              <button
                onClick={handleRestart}
                className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                Restart Track (R)
              </button>

              <button
                onClick={() => setShowTrackSelect(true)}
                className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                Track Library & Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over / Clear Results Modal */}
      {(gameStatus === 'GAME_OVER' || gameStatus === 'CLEARED') && (
        <GameOverModal
          cleared={clearedOutcome}
          track={selectedTrack}
          scoreState={scoreState}
          highScoreRecord={engine.getHighScore(selectedTrack.id)}
          onRestart={handleRestart}
          onOpenSelect={() => {
            setGameStatus('MENU');
            setShowTrackSelect(true);
          }}
        />
      )}

      {/* Track Select & Custom Audio Importer Modal */}
      {showTrackSelect && (
        <TrackSelectModal
          currentTrack={selectedTrack}
          highScores={highScores}
          settings={audioSettings}
          customTracks={customTracks}
          onSelectTrack={(t) => {
            setSelectedTrack(t);
          }}
          onPlayTrack={(t) => {
            setSelectedTrack(t);
            setShowTrackSelect(false);
            handleStartGame(t);
          }}
          onTrackAdded={handleTrackAdded}
          onTrackDeleted={handleTrackDeleted}
          onUpdateSettings={handleUpdateSettings}
          onClose={() => {
            setShowTrackSelect(false);
          }}
        />
      )}
    </div>
  );
}

