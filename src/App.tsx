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
import { StartChoice, StartScreen } from './components/StartScreen';
import { UnlocksScreen } from './components/UnlocksScreen';
import { OptionsScreen } from './components/OptionsScreen';
import { StancesScreen } from './components/StancesScreen';
import { RecordsScreen } from './components/RecordsScreen';
import { BackdropScreen } from './components/BackdropScreen';
import { UnlockTab, UnlockTabs } from './components/UnlockTabs';
import type { UnlockKind } from './game/seenUnlocks';
import { bestSongScore, songRecords } from './game/records';
import {
  followMuteSetting,
  happytime,
  hasAdblock,
  initCrazyGames,
  loadingStart,
  loadingStop,
  RewardedResult,
  setGameplayActive,
  showMidgameAd,
  submitLeaderboardScore,
  showRewardedAd,
  progressStore,
} from './platform/crazyGames';
import { markFirstSongDone, needsFirstSong } from './game/firstSong';
import { midgameAdDue } from './game/adPacing';
import { ENEMY_MOTION_STYLES, EnemyMotionStyle } from './game/enemyMotion';
import { getHero, HeroId } from './game/heroes';
import { adOffer, backdropLayerOf, describeUnlock, RunUnlock } from './game/runUnlocks';
import { UnlockFanfare } from './components/UnlockFanfare';

/** Dev builds only: ?adTest makes a midgame ad due at the end of every song, to try the flow. */
const AD_TEST = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('adTest');

/** The song a brand-new player starts on: the easiest of the soundtrack. */
const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard', 'Custom'];
const FIRST_SONG = [...PRELOADED_TRACKS].sort((a, b) => DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty))[0];

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
  const [menuScreen, setMenuScreen] = useState<'unlocks' | 'records' | 'options' | null>(null);
  /** Which tab of the Unlocks screen is open */
  const [unlockTab, setUnlockTab] = useState<UnlockTab>('heroes');
  /** Rewarded ads can be shown here (CrazyGames, or its local test mode) */
  const [adAvailable, setAdAvailable] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  /** Why rewarded ads can't be offered here (shown where the ad buttons would be), or null */
  const [adsOffNote, setAdsOffNote] = useState<string | null>(null);
  /** A midgame ad is being requested or shown at the end of a song: the results wait for it */
  const [adBreak, setAdBreak] = useState(false);
  /** The unlock popup after a song: what it unlocked, and what an ad could unlock on top */
  const [fanfare, setFanfare] = useState<{ unlocks: RunUnlock[]; offer: RunUnlock | null } | null>(null);
  /** The ad offer taken after this song (unlocked and equipped) */
  const [offerTaken, setOfferTaken] = useState<RunUnlock | null>(null);
  /** A song is being loaded (decoded and charted) before it starts */
  const [songLoading, setSongLoading] = useState(false);
  const [menuNotice, setMenuNotice] = useState<string | null>(null);
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
  /** Start a song; `practice` plays it in practice mode (hits don't end it, nothing counts) */
  const handleStartGame = useCallback((trackToPlay: Track = selectedTrack, practice = false) => {
    setSelectedTrack(trackToPlay);
    // Drop focus from the button that started the song, so game keys go to the game
    (document.activeElement as HTMLElement | null)?.blur?.();
    setGameStatus('PLAYING');
    setShowTrackSelect(false);
    setSongLoading(true);
    loadingStart();
    engine.startSong(trackToPlay, practice).finally(() => {
      loadingStop();
      setSongLoading(false);
    });
  }, [selectedTrack, engine]);

  // Restart current track (a practice run restarts in practice)
  const handleRestart = useCallback(() => {
    handleStartGame(selectedTrack, engine.practice);
  }, [handleStartGame, selectedTrack, engine]);

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

  /** Leave the song (the enemies beaten so far still count) and go back to the title screen. */
  const handleQuitToMenu = useCallback(() => {
    engine.stop();
    setShowTrackSelect(false);
    setGameStatus('MENU');
    refreshHighScores();
  }, [engine, refreshHighScores]);

  const handleUpdateSettings = (newSettings: Partial<AudioSettings>) => {
    engine.saveSettings(newSettings);
    setAudioSettings({ ...engine.settings });
  };

  // Start the CrazyGames SDK: then load progress from where it lives there, follow its mute
  // setting, and only offer rewarded ads when they can actually play (not with an ad blocker).
  useEffect(() => {
    initCrazyGames().then(async (live) => {
      engine.reloadProgress();
      playSecondsAtLastAd.current = engine.adClockSeconds;
      bestSongAtStart.current = bestSongScore(engine.getAllHighScores());
      setAudioSettings({ ...engine.settings });
      refreshHighScores();
      followMuteSetting((muted) => audioEngine.setPlatformMuted(muted));
      if (live && (await hasAdblock())) {
        setAdsOffNote('Ad blocker on: turn it off to unlock by watching an ad.');
        return;
      }
      setAdAvailable(live);
    });
  }, [engine]);

  // Midgame ads: at the end of a song, once there's been 5 minutes of play since the last one
  // (see adPacing). The results screen waits behind the ad. Unlocking a hero makes the
  // CrazyGames site celebrate, after any ad.
  const playSecondsAtLastAd = useRef(engine.adClockSeconds);
  /** The best single-song score already sent to the leaderboard (or saved before this visit) */
  const bestSongAtStart = useRef(bestSongScore(engine.getAllHighScores()));
  useEffect(() => {
    if (gameStatus !== 'GAME_OVER' && gameStatus !== 'CLEARED') return;
    // A new best single-song score goes to the CrazyGames leaderboard
    const best = bestSongScore(engine.getAllHighScores());
    if (best > bestSongAtStart.current) {
      bestSongAtStart.current = best;
      void submitLeaderboardScore(best);
    }
    const unlockedHero = engine.newUnlocks.length > 0;
    // The unlock popup, if the song unlocked anything, with an ad offer on the end where ads can play
    const celebrate = () => {
      if (unlockedHero) happytime();
      if (engine.runUnlocks.length > 0) setFanfare({ unlocks: engine.runUnlocks, offer: adsOnRef.current ? adOffer(engine.lifetimeStats) : null });
    };
    // Practice play counts toward the next ad too (adClockSeconds)
    if (!midgameAdDue(engine.adClockSeconds, playSecondsAtLastAd.current, AD_TEST ? 0 : undefined)) {
      celebrate();
      return;
    }
    setAdBreak(true);
    const ctx = audioEngine.getAudioContext();
    showMidgameAd(
      () => void ctx.suspend(),
      () => void ctx.resume()
    ).then((watched) => {
      // No ad played (none available, too soon for CrazyGames, ad blocker): try again after the next song
      if (watched) playSecondsAtLastAd.current = engine.adClockSeconds;
      setAdBreak(false);
      celebrate();
    });
  }, [gameStatus, engine]);

  // A new song: last song's popup and ad offer are done with
  useEffect(() => {
    if (gameStatus !== 'PLAYING') return;
    setFanfare(null);
    setOfferTaken(null);
  }, [gameStatus]);

  // Tell CrazyGames when the player is actually in gameplay (in a song, not paused or loading).
  useEffect(() => {
    setGameplayActive(gameStatus === 'PLAYING' && !songLoading);
  }, [gameStatus, songLoading]);

  // iOS stops the game's audio when the app is interrupted (a call, switching apps), and
  // only lets it start again from a tap: resume it on the next tap, if a song is playing.
  const gameStatusRef = useRef(gameStatus);
  gameStatusRef.current = gameStatus;
  useEffect(() => {
    const wake = () => {
      const ctx = audioEngine.getAudioContext();
      if (gameStatusRef.current === 'PLAYING' && !audioEngine.isPaused() && ctx.state !== 'running') void ctx.resume();
    };
    document.addEventListener('touchend', wake);
    document.addEventListener('click', wake);
    return () => {
      document.removeEventListener('touchend', wake);
      document.removeEventListener('click', wake);
    };
  }, []);

  /**
   * Play a rewarded ad (the game is muted while it plays) and hand out the
   * reward only if it was watched to the end. If ads can't play here at all,
   * stop offering them and say why.
   */
  const watchRewardedAd = useCallback(
    async (reward: () => void) => {
      if (adBusy) return;
      setAdBusy(true);
      const ctx = audioEngine.getAudioContext();
      const result: RewardedResult = await showRewardedAd(
        () => void ctx.suspend(),
        () => void ctx.resume()
      );
      setAdBusy(false);
      if (result === 'watched') {
        reward();
      } else if (result === 'unavailable') {
        setAdAvailable(false);
        setAdsOffNote('Ads aren\'t available right now, so ad unlocks are off.');
        setMenuNotice('Ads aren\'t available right now, so no unlock this time.');
      } else {
        setMenuNotice('The ad did not finish, so no unlock this time.');
      }
    },
    [adBusy]
  );

  /** Watch a rewarded ad for the next enemy stance, and use it straight away. */
  const handleWatchAd = useCallback(() => {
    void watchRewardedAd(() => {
      const stance = engine.unlockStanceWithAd();
      const label = ENEMY_MOTION_STYLES.find((m) => m.id === stance)?.label;
      if (stance) handleUpdateSettings({ enemyMotion: stance });
      setMenuNotice(label ? `New stance unlocked and equipped: ${label}!` : null);
    });
  }, [watchRewardedAd, engine, handleUpdateSettings]);

  /** Watch a rewarded ad for the next backdrop piece, and put it up straight away. */
  const handleWatchBackdropAd = useCallback(() => {
    void watchRewardedAd(() => {
      const piece = engine.unlockBackdropWithAd();
      if (piece) handleUpdateSettings({ backdrop: { ...engine.backdrop, [piece.layer]: piece.id } });
      setMenuNotice(piece ? `New backdrop piece unlocked and equipped: ${piece.label}!` : null);
    });
  }, [watchRewardedAd, engine, handleUpdateSettings]);

  /** Watch a rewarded ad to unlock an ad-only hero (The Bride), then play as her. */
  const handleWatchHeroAd = useCallback(
    (hero: HeroId) => {
      void watchRewardedAd(() => {
        if (engine.unlockHeroWithAd(hero)) {
          handleUpdateSettings({ hero });
          setMenuNotice(`New hero unlocked: ${getHero(hero).label}!`);
        }
      });
    },
    [watchRewardedAd, engine, handleUpdateSettings]
  );

  useEffect(() => {
    if (!menuNotice) return;
    const t = setTimeout(() => setMenuNotice(null), 3500);
    return () => clearTimeout(t);
  }, [menuNotice]);

  const handleStartChoice = useCallback((choice: StartChoice) => {
    // A brand-new player goes straight into a song with one click (CrazyGames asks for this):
    // the easiest one, as practice, so getting hit doesn't end it straight away (see firstSong).
    // After that, New Game opens the song list.
    if (choice === 'newGame' && needsFirstSong(progressStore(), engine.lifetimeStats.playSeconds)) {
      markFirstSongDone(progressStore());
      handleStartGame(FIRST_SONG, true);
    } else if (choice === 'newGame') setShowTrackSelect(true);
    else if (choice === 'studio') setShowStudio(true);
    else {
      if (choice === 'unlocks') {
        // Open on the tab with something new to see, if any
        const fresh = engine.unseenUnlocks();
        setUnlockTab(fresh.hero.length ? 'heroes' : fresh.stance.length ? 'stances' : fresh.backdrop.length ? 'backdrops' : 'heroes');
      }
      setMenuScreen(choice);
    }
  }, [engine, handleStartGame]);
  const closeMenuScreen = useCallback(() => setMenuScreen(null), []);

  // New unlocks not yet tapped on: badges on the Unlocks button and its tabs
  const [, setSeenTick] = useState(0);
  const markSeen = useCallback((kind: UnlockKind, id: string) => {
    if (engine.markUnlockSeen(kind, id)) setSeenTick((n) => n + 1);
  }, [engine]);

  /** Use an unlock now: play as the hero, switch the enemies' stance, or put the backdrop piece up. */
  const equipUnlock = (u: RunUnlock) => {
    if (u.kind === 'hero') handleUpdateSettings({ hero: u.id as HeroId });
    else if (u.kind === 'stance') handleUpdateSettings({ enemyMotion: u.id as EnemyMotionStyle });
    else {
      const layer = backdropLayerOf(u.id);
      if (layer) handleUpdateSettings({ backdrop: { ...engine.backdrop, [layer]: u.id } });
    }
    markSeen(u.kind, u.id);
  };
  const isEquipped = (u: RunUnlock) =>
    u.kind === 'hero' ? engine.hero.id === u.id : u.kind === 'stance' ? engine.enemyMotion === u.id : Object.values(engine.backdrop).includes(u.id);
  /** Watch a rewarded ad for the after-song offer: unlocked and equipped straight away. */
  const takeOffer = (u: RunUnlock) => {
    void watchRewardedAd(() => {
      if (!engine.unlockWithAd(u)) return;
      equipUnlock(u);
      setOfferTaken(u);
      if (u.kind === 'hero') happytime();
    });
  };
  /** Rewarded ads can play here (the end-of-song popup reads it when it opens) */
  const adsOnRef = useRef(adAvailable);
  adsOnRef.current = adAvailable;
  /** The small offer on the results screen: what an ad would unlock now (or what it just did) */
  const endOffer = offerTaken ?? (adAvailable ? adOffer(engine.lifetimeStats) : null);
  const unseen = engine.unseenUnlocks();
  const unlockTabs = (
    <UnlockTabs
      tab={unlockTab}
      onTab={setUnlockTab}
      counts={{ heroes: unseen.hero.length, stances: unseen.stance.length, backdrops: unseen.backdrop.length }}
    />
  );

  const handleToggleOneButtonMode = useCallback(() => {
    handleUpdateSettings({ oneButtonMode: !audioSettings.oneButtonMode });
  }, [audioSettings.oneButtonMode]);

  // Keyboard controls listener (Optimized for minimal input latency)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // The Animation Studio has its own shortcuts (Space plays the preview there).
      if (showStudio) return;
      // Nothing happens while an ad plays
      if (adBreak) return;
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

    // Space pauses during a song; it must never also "click" whatever button last had focus
    // (browsers activate a focused button on Space keyup)
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (gameStatus === 'PLAYING' || gameStatus === 'PAUSED')) e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    gameStatus,
    adBreak,
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
          practice={engine.practice}
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
          newUnlocks={unseen.hero.length + unseen.stance.length + unseen.backdrop.length}
          oneButtonMode={audioSettings.oneButtonMode}
          notice={menuNotice}
        />
      )}

      {menuScreen === 'unlocks' && unlockTab === 'stances' && (
        <StancesScreen
          tabs={unlockTabs}
          stats={engine.lifetimeStats}
          selected={engine.enemyMotion}
          isUnlocked={(id) => engine.isStanceUnlocked(id)}
          isNew={(id) => unseen.stance.includes(id)}
          onSeen={(id) => markSeen('stance', id)}
          onSelect={(enemyMotion) => handleUpdateSettings({ enemyMotion })}
          onWatchAd={adAvailable ? handleWatchAd : undefined}
          adBusy={adBusy}
          adsOffNote={adsOffNote}
          notice={menuNotice}
          onClose={closeMenuScreen}
        />
      )}

      {menuScreen === 'unlocks' && unlockTab === 'heroes' && (
        <UnlocksScreen
          tabs={unlockTabs}
          stats={engine.lifetimeStats}
          selectedHero={engine.hero.id}
          isUnlocked={(id) => engine.isHeroUnlocked(id)}
          isNew={(id) => unseen.hero.includes(id)}
          onSeen={(id) => markSeen('hero', id)}
          onSelect={(hero) => handleUpdateSettings({ hero })}
          onWatchAd={adAvailable ? handleWatchHeroAd : undefined}
          adBusy={adBusy}
          notice={menuNotice}
          onClose={closeMenuScreen}
        />
      )}

      {menuScreen === 'unlocks' && unlockTab === 'backdrops' && (
        <BackdropScreen
          tabs={unlockTabs}
          stats={engine.lifetimeStats}
          selected={engine.backdrop}
          isUnlocked={(id) => engine.isBackdropUnlocked(id)}
          isNew={(id) => unseen.backdrop.includes(id)}
          onSeen={(id) => markSeen('backdrop', id)}
          onSelect={(layer, id) => handleUpdateSettings({ backdrop: { ...engine.backdrop, [layer]: id } })}
          onWatchAd={adAvailable ? handleWatchBackdropAd : undefined}
          adBusy={adBusy}
          adsOffNote={adsOffNote}
          notice={menuNotice}
          onClose={closeMenuScreen}
        />
      )}

      {menuScreen === 'records' && (
        <RecordsScreen
          stats={engine.lifetimeStats}
          songs={songRecords(highScores, [...PRELOADED_TRACKS, ...customTracks])}
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

            <div className="mt-6 w-full flex flex-col gap-3">
              <button
                onClick={handleTogglePause}
                className="w-full py-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-sm shadow-[0_0_15px_rgba(0,243,255,0.4)] transition-all cursor-pointer"
              >
                Resume ({audioSettings.oneButtonMode ? 'Esc' : 'Space'})
              </button>

              <button
                onClick={handleRestart}
                className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-sm transition-colors cursor-pointer"
              >
                Restart Song (R)
              </button>
              <button
                onClick={handleQuitToMenu}
                className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-sm transition-colors cursor-pointer"
              >
                Quit to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over / Clear Results Modal */}
      {(gameStatus === 'GAME_OVER' || gameStatus === 'CLEARED') && adBreak && (
        // Blocks the screen while the ad is requested and plays (CrazyGames shows the ad on top)
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" aria-busy="true">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
        </div>
      )}

      {(gameStatus === 'GAME_OVER' || gameStatus === 'CLEARED') && !adBreak && (
        <GameOverModal
          cleared={clearedOutcome}
          deathReport={deathReport}
          runProgress={engine.lastRun}
          heroId={engine.hero.id}
          practice={engine.practice}
          practiceHits={engine.practiceHits.length}
          onPlayForReal={() => handleStartGame(selectedTrack, false)}
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
          onMainMenu={() => {
            setShowTrackSelect(false);
            setGameStatus('MENU');
          }}
          averageTimingErrorMs={engine.getAverageTimingErrorMs()}
          currentLatencyOffsetMs={audioSettings.latencyOffsetMs}
          suggestedLatencyOffsetMs={engine.getSuggestedLatencyOffsetMs()}
          onApplyLatencyOffset={(offsetMs) => handleUpdateSettings({ latencyOffsetMs: offsetMs })}
          adOffer={
            endOffer && !fanfare && !engine.practice
              ? { name: describeUnlock(endOffer).name, busy: adBusy, done: offerTaken !== null, notice: menuNotice, onWatch: () => takeOffer(endOffer) }
              : undefined
          }
        />
      )}

      {(gameStatus === 'GAME_OVER' || gameStatus === 'CLEARED') && !adBreak && fanfare && (
        <UnlockFanfare
          unlocks={fanfare.unlocks}
          offer={fanfare.offer}
          offerTaken={offerTaken !== null}
          adBusy={adBusy}
          notice={menuNotice}
          stats={engine.lifetimeStats}
          backdrop={engine.backdrop}
          isEquipped={isEquipped}
          onEquip={equipUnlock}
          onWatchOffer={() => fanfare.offer && takeOffer(fanfare.offer)}
          onClose={() => setFanfare(null)}
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
          onPracticeTrack={(t) => {
            setSelectedTrack(t);
            setShowTrackSelect(false);
            handleStartGame(t, true);
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

