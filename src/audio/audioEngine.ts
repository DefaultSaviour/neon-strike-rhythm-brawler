import { Track, BeatNote, Lane, TimingJudgementType } from '../types/game';
import { audioStorage } from '../utils/audioStorage';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isPlayingSynth: boolean = false;
  private synthIntervalId: number | null = null;
  private startTime: number = 0;
  private masterVolume: number = 0.8;
  private sfxVolume: number = 0.9;
  public bassMeter: number = 0;
  public trebleMeter: number = 0;

  public getAudioContext(): AudioContext {
    this.initContext();
    return this.ctx!;
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.musicGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);

      this.musicGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(musicVol: number, sfxVol: number) {
    this.masterVolume = musicVol;
    this.sfxVolume = sfxVol;
    if (this.ctx && this.musicGain && this.sfxGain) {
      this.musicGain.gain.setValueAtTime(musicVol, this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(sfxVol, this.ctx.currentTime);
    }
  }

  public getPlaybackTime(): number {
    if (!this.ctx || (!this.currentSource && !this.isPlayingSynth)) return 0;
    return Math.max(0, this.ctx.currentTime - this.startTime);
  }

  public async startTrack(track: Track, onComplete?: () => void) {
    this.initContext();
    this.stop();

    this.startTime = this.ctx!.currentTime;

    if (track.audioBuffer) {
      // Custom uploaded audio file
      const source = this.ctx!.createBufferSource();
      source.buffer = track.audioBuffer;
      source.connect(this.musicGain!);
      source.onended = () => {
        if (this.currentSource === source) {
          this.currentSource = null;
          if (onComplete) onComplete();
        }
      };
      source.start(0);
      this.currentSource = source;
    } else {
      // Procedural Web Audio synthesizer for built-in tracks
      this.isPlayingSynth = true;
      this.startProceduralSynth(track, onComplete);
    }
  }

  public stop() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {}
      this.currentSource = null;
    }

    this.isPlayingSynth = false;
    if (this.synthIntervalId) {
      clearInterval(this.synthIntervalId);
      this.synthIntervalId = null;
    }
  }

  // Sample-Accurate Lookahead Audio Scheduler:
  // Sits directly on top of track.notes to guarantee 100% microsecond synchronization
  // with enemy arrival at the strike line!
  private startProceduralSynth(track: Track, onComplete?: () => void) {
    if (!this.ctx || !this.musicGain) return;

    const ctx = this.ctx;
    const bpm = track.bpm;
    const beatSeconds = 60 / bpm;
    const sixteenth = beatSeconds / 4;
    const trackDuration = track.duration;
    const startAudioTime = this.startTime;

    const isJCore = track.id === 'track_ready_go' || track.bpm >= 170;
    const bassFreqs = isJCore
      ? [146.83, 146.83, 164.81, 196.0, 146.83, 110, 146.83, 220]
      : [110, 110, 130.81, 146.83, 110, 98, 110, 164.81];
    const leadFreqs = isJCore
      ? [587.33, 659.25, 739.99, 880, 987.77, 1174.66, 987.77, 880]
      : [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 783.99, 659.25];

    let nextNoteIndex = 0;
    let nextSixteenthStep = 0;
    const scheduleAheadTime = 0.35; // 350ms lookahead window
    const lookaheadCheckIntervalMs = 25; // Check every 25ms

    const scheduler = () => {
      if (!this.isPlayingSynth || !ctx) return;

      const currentPlayback = ctx.currentTime - startAudioTime;
      if (currentPlayback >= trackDuration) {
        this.stop();
        if (onComplete) onComplete();
        return;
      }

      const scheduleUntil = currentPlayback + scheduleAheadTime;

      // 1. SCHEDULE EVERY NOTE FROM track.notes AT ITS EXACT TARGET TIMESTAMP!
      // When enemy reaches strike line at note.time, the sound wave fires at that EXACT instant!
      while (nextNoteIndex < track.notes.length) {
        const note = track.notes[nextNoteIndex];
        if (note.time > scheduleUntil) break;

        const scheduledTargetTime = startAudioTime + note.time;

        if (scheduledTargetTime >= ctx.currentTime - 0.05) {
          if (note.lane === 'left' || note.pitchCategory === 'kick' || note.pitchCategory === 'bass') {
            // Low Tone: Kick drum & sub-bass on Left
            this.synthKick(scheduledTargetTime);
            this.synthBassNote(
              bassFreqs[nextNoteIndex % bassFreqs.length],
              scheduledTargetTime,
              sixteenth * 1.8
            );
            const delayMs = Math.max(0, (scheduledTargetTime - ctx.currentTime) * 1000);
            setTimeout(() => {
              this.bassMeter = 1.0;
            }, delayMs);
          } else {
            // High Tone: Snare snap & treble lead on Right
            this.synthSnare(scheduledTargetTime);
            this.synthLeadNote(
              leadFreqs[nextNoteIndex % leadFreqs.length],
              scheduledTargetTime,
              sixteenth * 1.5
            );
            const delayMs = Math.max(0, (scheduledTargetTime - ctx.currentTime) * 1000);
            setTimeout(() => {
              this.trebleMeter = 1.0;
            }, delayMs);
          }
        }

        nextNoteIndex++;
      }

      // 2. SCHEDULE RHYTHMIC 16th BACKGROUND GROOVE (Hi-hats and rolling 16th groove)
      while (nextSixteenthStep * sixteenth < scheduleUntil) {
        const stepTime = startAudioTime + nextSixteenthStep * sixteenth;
        if (stepTime >= ctx.currentTime) {
          // Hi-hat sizzles on offbeats
          if (nextSixteenthStep % 2 === 1) {
            this.synthHiHat(stepTime, nextSixteenthStep % 4 === 2);
          }
          // Subtle rolling 16th syncopation
          if (nextSixteenthStep % 4 === 2) {
            const freq = bassFreqs[Math.floor(nextSixteenthStep / 8) % bassFreqs.length];
            this.synthBassNote(freq * 0.5, stepTime, sixteenth * 0.8);
          }
        }
        nextSixteenthStep++;
      }

      // Decay visual meters
      this.bassMeter = Math.max(0, this.bassMeter - 0.08);
      this.trebleMeter = Math.max(0, this.trebleMeter - 0.08);
    };

    this.synthIntervalId = window.setInterval(scheduler, lookaheadCheckIntervalMs);
  }

  private synthKick(time: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(32, time + 0.14);

    gain.gain.setValueAtTime(0.75, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  private synthSnare(time: number) {
    if (!this.ctx || !this.musicGain) return;

    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 950;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.45, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.musicGain);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.1);

    oscGain.gain.setValueAtTime(0.4, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    osc.connect(oscGain);
    oscGain.connect(this.musicGain);

    noise.start(time);
    osc.start(time);
    noise.stop(time + 0.15);
    osc.stop(time + 0.15);
  }

  private synthHiHat(time: number, accent: boolean) {
    if (!this.ctx || !this.musicGain) return;
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6500;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(accent ? 0.28 : 0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noise.start(time);
    noise.stop(time + 0.05);
  }

  private synthBassNote(freq: number, time: number, duration: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, time);
    filter.frequency.exponentialRampToValueAtTime(260, time + duration);

    gain.gain.setValueAtTime(0.38, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  private synthLeadNote(freq: number, time: number, duration: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  // SFX
  // Subtle, pleasant tactile feedback: soft electronic micro-tap with gentle low-pass filter
  public playHitSound(judgement: TimingJudgementType) {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const ctx = this.ctx;
    const time = ctx.currentTime;

    // Extremely subtle, satisfying tactile click (zero ear fatigue, blends under the music)
    const vol = judgement === 'PERFECT' ? 0.08 : judgement === 'GOOD' ? 0.055 : 0.035;
    const freq = judgement === 'PERFECT' ? 220 : judgement === 'GOOD' ? 180 : 150;
    const dur = judgement === 'PERFECT' ? 0.022 : 0.018;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(70, time + dur);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, time);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(time);
    osc.stop(time + dur + 0.005);
  }

  public playSwingSound() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const time = ctx.currentTime;

    // Subtle soft air swish
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, time);
    osc.frequency.exponentialRampToValueAtTime(70, time + 0.035);

    gain.gain.setValueAtTime(0.07, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  public playDeathSound() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const time = ctx.currentTime;

    const bufferSize = ctx.sampleRate * 0.45;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1300, time);
    filter.frequency.exponentialRampToValueAtTime(70, time + 0.4);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.85, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.42);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(time);
    noise.stop(time + 0.45);
  }

  // Dual-band spectral analysis:
  // Low Band (40Hz - 220Hz) -> Left Lane
  // High Band (400Hz - 6000Hz) -> Right Lane
  public async analyzeAudioFile(
    file: File,
    progressCallback?: (progress: number) => void
  ): Promise<Track> {
    this.initContext();
    const arrayBuffer = await file.arrayBuffer();
    if (progressCallback) progressCallback(0.25);

    const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
    if (progressCallback) progressCallback(0.5);

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    // We process energy across frames
    const frameSize = 1024;
    const hopSize = 512;
    const numFrames = Math.floor((channelData.length - frameSize) / hopSize);

    // Approximate low-pass (bass) and high-pass (treble) energy via simple differentiation
    const bassEnergies: number[] = new Array(numFrames).fill(0);
    const trebleEnergies: number[] = new Array(numFrames).fill(0);

    for (let i = 0; i < numFrames; i++) {
      const offset = i * hopSize;
      let bSum = 0;
      let tSum = 0;
      let prevVal = 0;

      for (let j = 0; j < frameSize; j++) {
        const val = channelData[offset + j];
        // Low band proxy: moving average/envelope
        bSum += val * val;
        // High band proxy: difference between consecutive samples (high frequency slope)
        const diff = val - prevVal;
        tSum += diff * diff;
        prevVal = val;
      }
      bassEnergies[i] = bSum;
      trebleEnergies[i] = tSum;
    }

    if (progressCallback) progressCallback(0.75);

    // Pick raw peaks in Bass (Left Lane) and Treble (Right Lane)
    const windowRadius = 8;
    const rawNotes: { time: number; lane: Lane; enemyType: 'brawler' | 'speeder' | 'ronin'; pitchCategory: 'bass' | 'treble' }[] = [];
    const minTimeBetweenBeats = 0.22;
    let lastBeatTime = -1;

    for (let i = windowRadius; i < numFrames - windowRadius; i++) {
      let bMean = 0;
      let tMean = 0;
      for (let w = -windowRadius; w <= windowRadius; w++) {
        bMean += bassEnergies[i + w];
        tMean += trebleEnergies[i + w];
      }
      bMean /= windowRadius * 2 + 1;
      tMean /= windowRadius * 2 + 1;

      // Frame time centered
      const time = ((i * hopSize) + frameSize / 2) / sampleRate;
      if (time < 1.2 || time > duration - 1) continue;

      const isBassPeak =
        bassEnergies[i] > bassEnergies[i - 1] &&
        bassEnergies[i] > bassEnergies[i + 1] &&
        bassEnergies[i] > bMean * 1.35;

      const isTreblePeak =
        trebleEnergies[i] > trebleEnergies[i - 1] &&
        trebleEnergies[i] > trebleEnergies[i + 1] &&
        trebleEnergies[i] > tMean * 1.40;

      if (time - lastBeatTime >= minTimeBetweenBeats) {
        if (isBassPeak && (!isTreblePeak || bassEnergies[i] / bMean > trebleEnergies[i] / tMean)) {
          // Low tone (Kick / Sub) -> LEFT LANE
          rawNotes.push({
            time,
            lane: 'left',
            enemyType: 'brawler',
            pitchCategory: 'bass',
          });
          lastBeatTime = time;
        } else if (isTreblePeak) {
          // High tone (Snare / Treble Lead) -> RIGHT LANE
          rawNotes.push({
            time,
            lane: 'right',
            enemyType: Math.random() > 0.45 ? 'ronin' : 'speeder',
            pitchCategory: 'treble',
          });
          lastBeatTime = time;
        }
      }
    }

    if (progressCallback) progressCallback(0.85);

    // Estimate dominant BPM from peak intervals
    const intervals: number[] = [];
    for (let i = 1; i < rawNotes.length; i++) {
      const diff = rawNotes[i].time - rawNotes[i - 1].time;
      if (diff >= 0.25 && diff <= 1.2) {
        intervals.push(diff);
      }
    }
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals.length > 0 ? intervals[Math.floor(intervals.length / 2)] : 0.5;
    let estimatedBpm = Math.round(60 / medianInterval);
    while (estimatedBpm < 95) estimatedBpm *= 2;
    while (estimatedBpm > 185) estimatedBpm = Math.round(estimatedBpm / 2);
    estimatedBpm = Math.min(180, Math.max(90, estimatedBpm));

    // Musical Grid Quantization: Snap notes to nearest musical subdivisions
    // This locks visual enemy arrival directly into the musical pocket!
    const beatSec = 60 / estimatedBpm;
    const subdivision = beatSec / 2; // Eighth-note rhythmic pocket
    const firstDownbeat = rawNotes.length > 0 ? rawNotes[0].time : 1.5;

    const notes: BeatNote[] = [];
    let prevQuantizedTime = -1;

    for (const raw of rawNotes) {
      // Find nearest musical subdivision
      const nearestStep = Math.round((raw.time - firstDownbeat) / subdivision);
      const quantizedTime = firstDownbeat + nearestStep * subdivision;
      const deviation = Math.abs(raw.time - quantizedTime);

      // Snap if within 85ms of musical beat pocket; otherwise keep precise transient
      const finalTime = deviation < 0.085 ? Number(quantizedTime.toFixed(3)) : Number(raw.time.toFixed(3));

      if (finalTime >= 1.0 && finalTime > prevQuantizedTime + 0.20 && finalTime < duration - 0.8) {
        notes.push({
          time: finalTime,
          lane: raw.lane,
          enemyType: raw.enemyType,
          pitchCategory: raw.pitchCategory,
        });
        prevQuantizedTime = finalTime;
      }
    }

    if (progressCallback) progressCallback(1.0);

    const trackTitle = file.name.replace(/\.[^/.]+$/, '') || 'Custom Track';
    const track: Track = {
      id: `custom_${Date.now()}`,
      title: trackTitle,
      artist: 'Custom Import',
      bpm: estimatedBpm,
      difficulty: 'Custom',
      duration: Math.round(duration),
      description: `${notes.length} beats locked to rhythm (${estimatedBpm} BPM · Low on Left, High on Right)`,
      notes,
      isCustom: true,
      audioBuffer,
    };

    try {
      await audioStorage.saveCustomTrack(track, arrayBuffer);
    } catch (saveErr) {
      console.warn('Could not persist track to IndexedDB:', saveErr);
    }

    return track;
  }
}

export const audioEngine = new AudioEngine();

// Procedural Track Notes mapped specifically to Musical Tones & Motifs
function generateMusicalTrackNotes(
  bpm: number,
  duration: number,
  difficulty: 'Easy' | 'Medium' | 'Hard'
): BeatNote[] {
  const notes: BeatNote[] = [];
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;

  let currentBar = 0;
  const totalBars = Math.floor(duration / barSec);

  // Musical Section Progression:
  // Bars 0-3: Intro groove (Steady Kick on Left beat 1, Snare on Right beat 2)
  // Bars 4-7: Verse (Kick-Kick Left, Snare Right, Hi-Hat treble flurries)
  // Bars 8-11: Build-up (Rising pitch patterns, fast right-side hi-hat syncopations)
  // Bars 12+: Drop / Climax (High speed call-and-response: Bass barrages on Left, blade strikes on Right)

  for (let bar = 0; bar < totalBars; bar++) {
    const barStart = bar * barSec + 1.8;
    const progress = bar / totalBars;

    // Pattern 1: Fundamental Beat (Kick on 1 & 3 -> LEFT; Snare on 2 & 4 -> RIGHT)
    if (bar % 4 === 0 || bar % 4 === 1) {
      // Beat 1: Heavy Kick -> LEFT
      notes.push({
        time: Number(barStart.toFixed(3)),
        lane: 'left',
        enemyType: 'brawler',
        pitchCategory: 'kick',
      });

      // Beat 2: Snare -> RIGHT
      notes.push({
        time: Number((barStart + beatSec).toFixed(3)),
        lane: 'right',
        enemyType: 'ronin',
        pitchCategory: 'snare',
      });

      if (difficulty !== 'Easy') {
        // Beat 3: Bass Kick -> LEFT
        notes.push({
          time: Number((barStart + beatSec * 2).toFixed(3)),
          lane: 'left',
          enemyType: 'brawler',
          pitchCategory: 'bass',
        });
      }

      // Beat 4: Sharp Snare -> RIGHT
      notes.push({
        time: Number((barStart + beatSec * 3).toFixed(3)),
        lane: 'right',
        enemyType: 'speeder',
        pitchCategory: 'snare',
      });
    }
    // Pattern 2: Bass Flurry / 808 Double-Kick Motif (LEFT) answered by Treble Slash (RIGHT)
    else if (bar % 4 === 2) {
      // Double bass kick: Left -> Left
      notes.push({
        time: Number(barStart.toFixed(3)),
        lane: 'left',
        enemyType: 'brawler',
        pitchCategory: 'kick',
      });
      notes.push({
        time: Number((barStart + beatSec * 0.5).toFixed(3)),
        lane: 'left',
        enemyType: 'brawler',
        pitchCategory: 'bass',
      });

      // Treble answer: Right
      notes.push({
        time: Number((barStart + beatSec * 1.5).toFixed(3)),
        lane: 'right',
        enemyType: 'ronin',
        pitchCategory: 'lead',
      });

      // Heavy anchor: Left
      notes.push({
        time: Number((barStart + beatSec * 2.5).toFixed(3)),
        lane: 'left',
        enemyType: 'brawler',
        pitchCategory: 'bass',
      });

      // High lead finish: Right
      notes.push({
        time: Number((barStart + beatSec * 3.25).toFixed(3)),
        lane: 'right',
        enemyType: 'speeder',
        pitchCategory: 'snare',
      });
    }
    // Pattern 3: High-Speed Arpeggio & Drum Roll
    else {
      if (difficulty === 'Hard' || (difficulty === 'Medium' && progress > 0.4)) {
        // Left Bass -> Right High Lead -> Right High Lead -> Left Bass Finish
        notes.push({
          time: Number(barStart.toFixed(3)),
          lane: 'left',
          enemyType: 'brawler',
          pitchCategory: 'kick',
        });
        notes.push({
          time: Number((barStart + beatSec * 0.75).toFixed(3)),
          lane: 'right',
          enemyType: 'speeder',
          pitchCategory: 'lead',
        });
        notes.push({
          time: Number((barStart + beatSec * 1.5).toFixed(3)),
          lane: 'right',
          enemyType: 'ronin',
          pitchCategory: 'lead',
        });
        notes.push({
          time: Number((barStart + beatSec * 2.25).toFixed(3)),
          lane: 'left',
          enemyType: 'brawler',
          pitchCategory: 'bass',
        });
        notes.push({
          time: Number((barStart + beatSec * 3.0).toFixed(3)),
          lane: 'right',
          enemyType: 'ronin',
          pitchCategory: 'snare',
        });
      } else {
        // Standard accessible call-and-response
        notes.push({
          time: Number(barStart.toFixed(3)),
          lane: 'left',
          enemyType: 'brawler',
          pitchCategory: 'kick',
        });
        notes.push({
          time: Number((barStart + beatSec * 1.5).toFixed(3)),
          lane: 'right',
          enemyType: 'ronin',
          pitchCategory: 'snare',
        });
        notes.push({
          time: Number((barStart + beatSec * 2.5).toFixed(3)),
          lane: 'right',
          enemyType: 'speeder',
          pitchCategory: 'lead',
        });
      }
    }
  }

  return notes;
}

// Dedicated rhythmic beat chart for Ready Go! (175 BPM, 189s duration)
function generateReadyGoNotes(): BeatNote[] {
  const notes: BeatNote[] = [];
  const bpm = 175;
  const beatSec = 60 / bpm; // ~0.3428s

  // 1. Intro (0.0s - 7.5s): Sparkling synth arpeggios on Right
  notes.push({ time: 1.8, lane: 'right', enemyType: 'speeder', pitchCategory: 'lead' });
  notes.push({ time: 2.8, lane: 'right', enemyType: 'ronin', pitchCategory: 'lead' });
  notes.push({ time: 3.8, lane: 'right', enemyType: 'speeder', pitchCategory: 'lead' });
  notes.push({ time: 4.8, lane: 'left', enemyType: 'brawler', pitchCategory: 'bass' });
  notes.push({ time: 5.5, lane: 'right', enemyType: 'speeder', pitchCategory: 'lead' });
  notes.push({ time: 6.2, lane: 'right', enemyType: 'ronin', pitchCategory: 'lead' });
  notes.push({ time: 6.9, lane: 'left', enemyType: 'brawler', pitchCategory: 'bass' });

  // 2. "1, 2, 3, Ready Go!" drop at ~8.5s!
  // From 8.5s to 38.0s: Main High-Tempo J-Core Verse
  let t = 8.5;
  while (t < 38.0) {
    // 4-on-the-floor kick & snare: Kick (Left) -> Snare (Right)
    notes.push({ time: Number(t.toFixed(3)), lane: 'left', enemyType: 'brawler', pitchCategory: 'kick' });
    notes.push({ time: Number((t + beatSec).toFixed(3)), lane: 'right', enemyType: 'ronin', pitchCategory: 'snare' });
    notes.push({ time: Number((t + beatSec * 2).toFixed(3)), lane: 'left', enemyType: 'brawler', pitchCategory: 'kick' });
    notes.push({ time: Number((t + beatSec * 3).toFixed(3)), lane: 'right', enemyType: 'speeder', pitchCategory: 'snare' });
    t += beatSec * 4;
  }

  // 3. Main Chorus 1 (39.0s - 72.0s): High Energy Hardcore Drop
  while (t < 72.0) {
    // Double bass kicks (Left) + lead synths (Right)
    notes.push({ time: Number(t.toFixed(3)), lane: 'left', enemyType: 'brawler', pitchCategory: 'kick' });
    notes.push({ time: Number((t + beatSec * 0.5).toFixed(3)), lane: 'left', enemyType: 'brawler', pitchCategory: 'bass' });
    notes.push({ time: Number((t + beatSec * 1.5).toFixed(3)), lane: 'right', enemyType: 'ronin', pitchCategory: 'lead' });
    notes.push({ time: Number((t + beatSec * 2.0).toFixed(3)), lane: 'left', enemyType: 'brawler', pitchCategory: 'kick' });
    notes.push({ time: Number((t + beatSec * 3.0).toFixed(3)), lane: 'right', enemyType: 'speeder', pitchCategory: 'snare' });
    notes.push({ time: Number((t + beatSec * 3.5).toFixed(3)), lane: 'right', enemyType: 'ronin', pitchCategory: 'lead' });
    t += beatSec * 4;
  }

  // 4. Breakdown / Chiptune interlude (73.0s - 92.0s)
  while (t < 92.0) {
    notes.push({ time: Number(t.toFixed(3)), lane: 'right', enemyType: 'speeder', pitchCategory: 'lead' });
    notes.push({ time: Number((t + beatSec * 1.5).toFixed(3)), lane: 'left', enemyType: 'brawler', pitchCategory: 'bass' });
    notes.push({ time: Number((t + beatSec * 2.5).toFixed(3)), lane: 'right', enemyType: 'ronin', pitchCategory: 'lead' });
    t += beatSec * 4;
  }

  // 5. Verse 2 & Rising Build-up (93.0s - 130.0s)
  while (t < 130.0) {
    notes.push({ time: Number(t.toFixed(3)), lane: 'left', enemyType: 'brawler', pitchCategory: 'kick' });
    notes.push({ time: Number((t + beatSec * 1.0).toFixed(3)), lane: 'right', enemyType: 'ronin', pitchCategory: 'snare' });
    notes.push({ time: Number((t + beatSec * 1.75).toFixed(3)), lane: 'right', enemyType: 'speeder', pitchCategory: 'lead' });
    notes.push({ time: Number((t + beatSec * 2.5).toFixed(3)), lane: 'left', enemyType: 'brawler', pitchCategory: 'kick' });
    notes.push({ time: Number((t + beatSec * 3.25).toFixed(3)), lane: 'right', enemyType: 'ronin', pitchCategory: 'snare' });
    t += beatSec * 4;
  }

  // 6. Chorus 2 & Climax Solo (131.0s - 165.0s)
  while (t < 165.0) {
    notes.push({ time: Number(t.toFixed(3)), lane: 'left', enemyType: 'brawler', pitchCategory: 'kick' });
    notes.push({ time: Number((t + beatSec * 0.5).toFixed(3)), lane: 'left', enemyType: 'brawler', pitchCategory: 'bass' });
    notes.push({ time: Number((t + beatSec * 1.25).toFixed(3)), lane: 'right', enemyType: 'ronin', pitchCategory: 'lead' });
    notes.push({ time: Number((t + beatSec * 2.0).toFixed(3)), lane: 'left', enemyType: 'brawler', pitchCategory: 'kick' });
    notes.push({ time: Number((t + beatSec * 2.75).toFixed(3)), lane: 'right', enemyType: 'speeder', pitchCategory: 'lead' });
    notes.push({ time: Number((t + beatSec * 3.25).toFixed(3)), lane: 'right', enemyType: 'ronin', pitchCategory: 'snare' });
    t += beatSec * 4;
  }

  // 7. Master Climax Outro Flurry (166.0s - 188.0s)
  while (t < 187.0) {
    notes.push({ time: Number(t.toFixed(3)), lane: 'left', enemyType: 'brawler', pitchCategory: 'kick' });
    notes.push({ time: Number((t + beatSec * 0.75).toFixed(3)), lane: 'right', enemyType: 'ronin', pitchCategory: 'lead' });
    notes.push({ time: Number((t + beatSec * 1.5).toFixed(3)), lane: 'left', enemyType: 'brawler', pitchCategory: 'kick' });
    notes.push({ time: Number((t + beatSec * 2.25).toFixed(3)), lane: 'right', enemyType: 'speeder', pitchCategory: 'lead' });
    notes.push({ time: Number((t + beatSec * 3.0).toFixed(3)), lane: 'left', enemyType: 'brawler', pitchCategory: 'bass' });
    t += beatSec * 3.5;
  }

  return notes;
}

// Preloaded Curated Tracks with Pitch-Based Lane Mappings
export const PRELOADED_TRACKS: Track[] = [
  {
    id: 'track_ready_go',
    title: 'Ready Go!',
    artist: 'DJ Genki feat. yukacco',
    bpm: 175,
    difficulty: 'Hard',
    duration: 189,
    description: 'High-octane 175 BPM J-Core anthem! Thunderous gabber kicks on the Left, rapid arpeggio flurries on the Right.',
    notes: generateReadyGoNotes(),
  },
  {
    id: 'track_cyber_highway',
    title: 'Cyber Highway',
    artist: 'Neon Drive',
    bpm: 110,
    difficulty: 'Easy',
    duration: 55,
    description: 'Bass kicks pulse on the Left; crisp snares and synth leads answer on the Right.',
    notes: generateMusicalTrackNotes(110, 55, 'Easy'),
  },
  {
    id: 'track_neon_overdrive',
    title: 'Neon Overdrive',
    artist: 'Vector Pulse',
    bpm: 130,
    difficulty: 'Medium',
    duration: 65,
    description: 'Pumping 808 low-end rumbles Left; rapid high-frequency arpeggios attack Right.',
    notes: generateMusicalTrackNotes(130, 65, 'Medium'),
  },
  {
    id: 'track_grid_runner',
    title: 'Grid Runner 2088',
    artist: 'Hyperion Core',
    bpm: 150,
    difficulty: 'Hard',
    duration: 75,
    description: 'High-octane darksynth barrage: complex rhythmic bass motifs and blistering high-lead counter-strikes.',
    notes: generateMusicalTrackNotes(150, 75, 'Hard'),
  },
];
