import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GameEngine } from './game/gameEngine';
import type { DeathReport } from './game/timing';
import { Track, GameStatus, GameScoreState, HighScoreRecord, Lane, AudioSettings } from './types/game';
import { PRELOADED_TRACKS, audioEngine } from './audio/audioEngine';
import { audioStorage } from './utils/audioStorage';
import { NeonCanvas } from './components/NeonCanvas';
import { HUD } from './components/HUD';
import { TrackSelectModal } from './components/TrackSelectModal';
import { AnimationStudio } from './components/AnimationStudio';
import { GameOverModal } from './components/GameOverModal';
import { GameOptions } from './components/GameOptions';
import { StartChoice, StartScreen } from './components/StartScreen';
import { UnlocksScreen } from './components/UnlocksScreen';
import { OptionsScreen } from './components/OptionsScreen';
import { HEROES } from './game/heroes';

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
  const [showStudio, setShowStudio] = useState(false);
  /** A screen opened from the title menu */
  const [menuScreen, setMenuScreen] = useState<'unlocks' | 'options' | null>(null);
  const [clearedOutcome, setClearedOutcome] = useState(false);
  const [deathReport, setDeathReport] = useState<DeathReport | null>(null);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    volume: 0.8,
    sfxVolume: 0.9,
    latencyOffsetMs: 0,
    scanlines: true,
    screenShake: 'subtle',
    oneButtonMode: false,
    enemyMotion: 'run',
    hitSound: 'both',
    hero: 'striker',
  });

  const callbacksRef = useRef({
    onScoreUpdate: (score: GameScoreState) => setScoreState(score),
    onGameOver: (score: GameScoreState, cleared: boolean, death?: DeathReport) => {
      setDeathReport(death ?? null);
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
      onGameOver: (s, c, d) => callbacksRef.current.onGameOver(s, c, d),
      onJudgement: (j, c) => callbacksRef.current.onJudgement(j, c),
    });
  }, []);

  // Dev builds only: expose the engine so automated browser tests can drive the game.
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { __neonEngine?: GameEngine }).__neonEngine = engine;
    }
  }, [engine]);

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
  // `eventTimeStamp` is the input event's timeStamp, so presses are judged
  // at the moment they happened rather than when this code got to run.
  const handleStrike = useCallback((lane: Lane, eventTimeStamp?: number) => {
    if (gameStatus === 'PLAYING') {
      engine.handleInput(lane, eventTimeStamp);
    }
  }, [gameStatus, engine]);

  const handleOneButtonStrike = useCallback((eventTimeStamp?: number) => {
    if (gameStatus === 'PLAYING') {
      engine.handleOneButtonInput(eventTimeStamp);
    }
  }, [gameStatus, engine]);

  // Pause / Resume: freezes the song in place and carries on from the same spot.
  const handleTogglePause = useCallback(() => {
    if (gameStatus === 'PLAYING') {
      engine.pause();
      setGameStatus('PAUSED');
    } else if (gameStatus === 'PAUSED') {
      // Drop focus from any option the player clicked, so game keys go to the game.
      (document.activeElement as HTMLElement | null)?.blur?.();
      setShowTrackSelect(false);
      engine.resume();
      setGameStatus('PLAYING');
    }
  }, [gameStatus, engine]);

  const handleUpdateSettings = (newSettings: Partial<AudioSettings>) => {
    engine.saveSettings(newSettings);
    setAudioSettings({ ...engine.settings });
  };

  const handleStartChoice = useCallback((choice: StartChoice) => {
    if (choice === 'newGame') setShowTrackSelect(true);
    else if (choice === 'studio') setShowStudio(true);
    else setMenuScreen(choice);
  }, []);
  const closeMenuScreen = useCallback(() => setMenuScreen(null), []);

  const handleToggleOneButtonMode = useCallback(() => {
    handleUpdateSettings({ oneButtonMode: !audioSettings.oneButtonMode });
  }, [audioSettings.oneButtonMode]);

  // Keyboard controls listener (Optimized for minimal input latency)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // The Animation Studio has its own shortcuts (Space plays the preview there).
      if (showStudio) return;
      // Ignore typing in text fields (sliders and buttons are fine).
      const target = e.target as HTMLInputElement | null;
      if (target?.tagName === 'INPUT' && target.type !== 'range') return;
      // Holding a key down fires repeated keydown events; only the first press counts.
      if (e.repeat) return;

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
            handleOneButtonStrike(e.timeStamp);
          } else if (gameStatus === 'PAUSED') {
            handleTogglePause();
          }
        }
      } else {
        // STANDARD 2-BUTTON COMBAT MODE
        if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyQ') {
          e.preventDefault();
          handleStrike('left', e.timeStamp);
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'KeyE') {
          e.preventDefault();
          handleStrike('right', e.timeStamp);
        } else if (e.code === 'Space' || e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          if (gameStatus === 'PLAYING' || gameStatus === 'PAUSED') {
            handleTogglePause();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    gameStatus,
    showStudio,
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
            engine.pause();
            setGameStatus('PAUSED');
            setShowTrackSelect(true);
          }}
        />
      )}

      {/* Title screen: New Game, Unlocks, Options, Pose Studio */}
      {gameStatus === 'MENU' && !showTrackSelect && !showStudio && !menuScreen && (
        <StartScreen
          onChoose={handleStartChoice}
          heroLabel={engine.hero.label}
          unlockedHeroes={HEROES.filter((h) => engine.isHeroUnlocked(h.id)).length}
          totalHeroes={HEROES.length}
          oneButtonMode={audioSettings.oneButtonMode}
        />
      )}

      {menuScreen === 'unlocks' && (
        <UnlocksScreen
          stats={engine.lifetimeStats}
          selectedHero={engine.hero.id}
          isUnlocked={(id) => engine.isHeroUnlocked(id)}
          onSelect={(hero) => handleUpdateSettings({ hero })}
          onClose={closeMenuScreen}
        />
      )}

      {menuScreen === 'options' && (
        <OptionsScreen settings={audioSettings} onUpdateSettings={handleUpdateSettings} onClose={closeMenuScreen} />
      )}

      {/* Paused Overlay: resume where you left off, and change options mid-song */}
      {gameStatus === 'PAUSED' && !showTrackSelect && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-[#0b0d1e] border border-cyan-500/40 rounded-xl p-6 flex flex-col shadow-2xl my-auto">
            <div className="text-center">
              <div className="text-2xl font-black tracking-widest text-cyan-400 uppercase">PAUSED</div>
              <div className="text-xs text-slate-400 mt-1 font-mono">Track: {selectedTrack.title}</div>
            </div>

            <div className="mt-5 p-4 rounded-lg bg-slate-950/70 border border-slate-800">
              <GameOptions settings={audioSettings} onUpdateSettings={handleUpdateSettings} lifetimeStats={engine.lifetimeStats} />
            </div>

            <div className="mt-5 w-full flex flex-col gap-3">
              <button
                onClick={handleTogglePause}
                className="w-full py-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-sm shadow-[0_0_15px_rgba(0,243,255,0.4)] transition-all cursor-pointer"
              >
                Resume ({audioSettings.oneButtonMode ? 'Esc' : 'Space'})
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleRestart}
                  className="py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Restart Track (R)
                </button>
                <button
                  onClick={() => setShowTrackSelect(true)}
                  className="py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Track Library
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over / Clear Results Modal */}
      {(gameStatus === 'GAME_OVER' || gameStatus === 'CLEARED') && (
        <GameOverModal
          cleared={clearedOutcome}
          deathReport={deathReport}
          runProgress={engine.lastRun}
          heroId={engine.hero.id}
          newUnlocks={engine.newUnlocks}
          onPickHero={(hero) => handleUpdateSettings({ hero })}
          track={selectedTrack}
          scoreState={scoreState}
          highScoreRecord={engine.getHighScore(selectedTrack.id)}
          onRestart={handleRestart}
          onOpenSelect={() => {
            setGameStatus('MENU');
            setShowTrackSelect(true);
          }}
          averageTimingErrorMs={engine.getAverageTimingErrorMs()}
          currentLatencyOffsetMs={audioSettings.latencyOffsetMs}
          suggestedLatencyOffsetMs={engine.getSuggestedLatencyOffsetMs()}
          onApplyLatencyOffset={(offsetMs) => handleUpdateSettings({ latencyOffsetMs: offsetMs })}
        />
      )}

      {/* Animation Studio: custom enemy moves */}
      {showStudio && <AnimationStudio onClose={() => setShowStudio(false)} />}

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

