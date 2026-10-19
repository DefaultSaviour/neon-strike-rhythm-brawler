import { Track, BeatNote, Lane, TimingJudgementType, FrequencyBand, HitSoundMode } from '../types/game';
import { audioStorage } from '../utils/audioStorage';
import { BeatGrid, gridForNotes, onEighthNote } from './beatGrid';
import { computeHeardSongTime } from './songClock';
import { foldIntoOctave, peakHzInBand } from './hitTone';

/** How late the kick/bass onset detector lands after the real attack (see analyzeAudioBuffer step 5b). */
export const LOW_BAND_DETECTOR_LAG_SEC = 0.015;

/** Songs at or below this tempo keep their extra (off-main-beat) notes on the eighth-note grid. */
export const SLOW_SONG_MAX_BPM = 120;
/** How close to an eighth note an extra note must be in a slow song (seconds). */
export const EIGHTH_NOTE_TOLERANCE_SEC = 0.05;

/**
 * Which extra notes (beyond the main beats) a song may keep, given the grid
 * fitted to its main beats. Slow songs with a clear grid keep only extras on
 * an eighth note; fast songs, or songs with no clear grid, keep them all.
 */
export function extraNoteFilter(grid: BeatGrid): (time: number) => boolean {
  if (grid.bpm > SLOW_SONG_MAX_BPM || grid.strength < 0.3) return () => true;
  return (time) => onEighthNote(time, grid, EIGHTH_NOTE_TOLERANCE_SEC);
}

type BiquadCoeffs = [number, number, number, number, number];

function computeBiquadCoeffs(
  sr: number,
  type: 'lowpass' | 'highpass' | 'bandpass',
  freq: number,
  q: number = 0.7071
): BiquadCoeffs {
  const w0 = (2 * Math.PI * freq) / sr;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * q);

  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  if (type === 'lowpass') {
    b0 = (1 - cosW0) / 2;
    b1 = 1 - cosW0;
    b2 = (1 - cosW0) / 2;
  } else if (type === 'highpass') {
    b0 = (1 + cosW0) / 2;
    b1 = -(1 + cosW0);
    b2 = (1 + cosW0) / 2;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
  }

  const a0 = 1 + alpha;
  const a1 = -2 * cosW0;
  const a2 = 1 - alpha;
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

function runBiquadFilter(sig: Float32Array, coeffs: BiquadCoeffs): Float32Array {
  const [b0, b1, b2, a1, a2] = coeffs;
  const out = new Float32Array(sig.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < sig.length; i++) {
    const x0 = sig[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}

function smooth3Tap(arr: Float32Array, w0: number, w1: number, w2: number): Float32Array {
  const n = arr.length;
  const out = new Float32Array(n);
  if (n === 0) return out;
  out[0] = arr[0] * (w0 + w1) + (n > 1 ? arr[1] * w2 : 0);
  for (let i = 1; i < n - 1; i++) {
    out[i] = arr[i - 1] * w0 + arr[i] * w1 + arr[i + 1] * w2;
  }
  if (n > 1) {
    out[n - 1] = arr[n - 2] * w0 + arr[n - 1] * (w1 + w2);
  }
  return out;
}

function computeMovingMean(arr: Float32Array, radius: number): Float32Array {
  const n = arr.length;
  const out = new Float32Array(n);
  if (n === 0) return out;
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    prefix[i + 1] = prefix[i] + arr[i];
  }
  for (let i = 0; i < n; i++) {
    const s = Math.max(0, i - radius);
    const e = Math.min(n - 1, i + radius);
    out[i] = (prefix[e + 1] - prefix[s]) / (e - s + 1);
  }
  return out;
}

function percentile(arr: Float32Array, p: number): number {
  if (arr.length === 0) return 0;
  const copy = Float32Array.from(arr);
  copy.sort();
  const idx = Math.min(copy.length - 1, Math.max(0, Math.floor((p / 100) * (copy.length - 1))));
  return copy[idx];
}

/** In-place iterative radix-2 FFT (re/im length must be a power of 2). */
function fftInPlace(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let tmp = re[i];
      re[i] = re[j];
      re[j] = tmp;
      tmp = im[i];
      im[i] = im[j];
      im[j] = tmp;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const ang = (-2 * Math.PI) / size;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let start = 0; start < n; start += size) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < half; k++) {
        const a = start + k;
        const b = a + half;
        const tRe = re[b] * curRe - im[b] * curIm;
        const tIm = re[b] * curIm + im[b] * curRe;
        re[b] = re[a] - tRe;
        im[b] = im[a] - tIm;
        re[a] += tRe;
        im[a] += tIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

/** Hz range used to measure "how high" a hit sits inside its band. */
const BAND_HZ_RANGE: Record<FrequencyBand, [number, number]> = {
  sub: [36, 145],
  bass: [120, 300],
  high: [800, 6500],
};

/**
 * For every note, measure the power-weighted log-frequency centroid inside its band's
 * Hz range right at the hit, then split each band into 3 tiers by tertile:
 * tier 1 = low extreme of the band, tier 3 = high extreme.
 */
function assignSpectralTiers(notes: BeatNote[], mono: Float32Array, sr: number) {
  const N = 8192; // ~170ms at 48kHz, ~5.9Hz bins: fine enough to resolve sub-bass pitch
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const hann = new Float64Array(N);
  for (let i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const binHz = sr / N;

  const positions: Record<FrequencyBand, number[]> = { sub: [], bass: [], high: [] };
  const notePos: number[] = new Array(notes.length).fill(0.5);

  for (let n = 0; n < notes.length; n++) {
    const note = notes[n];
    const band = note.band ?? 'high';
    const [lo, hi] = BAND_HZ_RANGE[band];
    const start = Math.floor((note.time - 0.01) * sr);

    for (let i = 0; i < N; i++) {
      const idx = start + i;
      re[i] = idx >= 0 && idx < mono.length ? mono[idx] * hann[i] : 0;
      im[i] = 0;
    }
    fftInPlace(re, im);

    const b0 = Math.max(1, Math.floor(lo / binHz));
    const b1 = Math.min(N / 2 - 1, Math.ceil(hi / binHz));
    let wSum = 0;
    let logSum = 0;
    for (let k = b0; k <= b1; k++) {
      const p = re[k] * re[k] + im[k] * im[k];
      wSum += p;
      logSum += p * Math.log2(k * binHz);
    }
    if (wSum <= 1e-12) continue;
    note.pitchHz = peakHzInBand(re, im, binHz, lo, hi);
    const centroidLog = logSum / wSum;
    const pos = (centroidLog - Math.log2(lo)) / (Math.log2(hi) - Math.log2(lo));
    notePos[n] = Math.min(1, Math.max(0, pos));
    positions[band].push(notePos[n]);
  }

  const thresholds: Record<FrequencyBand, [number, number]> = { sub: [1 / 3, 2 / 3], bass: [1 / 3, 2 / 3], high: [1 / 3, 2 / 3] };
  for (const band of ['sub', 'bass', 'high'] as FrequencyBand[]) {
    const arr = positions[band];
    if (arr.length >= 6) {
      const sorted = Float32Array.from(arr).sort();
      thresholds[band] = [sorted[Math.floor(sorted.length / 3)], sorted[Math.floor((2 * sorted.length) / 3)]];
    }
  }

  for (let n = 0; n < notes.length; n++) {
    const band = notes[n].band ?? 'high';
    const [t1, t2] = thresholds[band];
    const p = notePos[n];
    notes[n].tier = p < t1 ? 1 : p < t2 ? 2 : 3;
  }
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private freqBins: Uint8Array<ArrayBuffer> | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isPlayingSynth: boolean = false;
  private isLoadingBuffer: boolean = false;
  private playSessionId: number = 0;
  private synthIntervalId: number | null = null;
  private startTime: number = 0;
  private masterVolume: number = 0.8;
  private sfxVolume: number = 0.9;
  private urlBufferCache: Map<string, AudioBuffer> = new Map();
  private compressor: DynamicsCompressorNode | null = null;
  private paused: boolean = false;
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
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.65;
      this.freqBins = new Uint8Array(this.analyser.frequencyBinCount);

      this.musicGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);

      // Studio master compressor: prevents digital clipping during +25% hit surges
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-2, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(8, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.08, this.ctx.currentTime);

      this.musicGain.connect(this.analyser);
      this.analyser.connect(this.compressor);
      this.sfxGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended' && !this.paused) {
      this.ctx.resume();
    }
  }

  /**
   * Pause: freeze the whole audio clock. The song stops, and because the game
   * reads its time from this clock, enemies and timing freeze at exactly the
   * same spot. resume() carries on from there.
   */
  public async pause() {
    if (!this.ctx || this.paused) return;
    this.paused = true;
    await this.ctx.suspend();
  }

  public async resume() {
    if (!this.ctx || !this.paused) return;
    this.paused = false;
    await this.ctx.resume();
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public setVolume(musicVol: number, sfxVol: number) {
    this.masterVolume = musicVol;
    this.sfxVolume = sfxVol;
    if (this.ctx && this.musicGain && this.sfxGain) {
      this.musicGain.gain.setValueAtTime(musicVol, this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(sfxVol, this.ctx.currentTime);
    }
  }

  private updateRealtimeMeters() {
    if (!this.analyser || !this.freqBins || !this.ctx || !this.currentSource) return;
    this.analyser.getByteFrequencyData(this.freqBins);
    const binHz = this.ctx.sampleRate / this.analyser.fftSize;

    // Sub/Kick & Bassline Bins (~35Hz to 180Hz)
    const bStart = Math.max(1, Math.floor(35 / binHz));
    const bEnd = Math.min(this.freqBins.length - 1, Math.ceil(180 / binHz));
    let bSum = 0;
    for (let i = bStart; i <= bEnd; i++) {
      bSum += this.freqBins[i];
    }
    const bAvg = bSum / Math.max(1, bEnd - bStart + 1) / 255;

    // High/Treble Bins (~800Hz to 6000Hz)
    const tStart = Math.max(bEnd + 1, Math.floor(800 / binHz));
    const tEnd = Math.min(this.freqBins.length - 1, Math.ceil(6000 / binHz));
    let tSum = 0;
    for (let i = tStart; i <= tEnd; i++) {
      tSum += this.freqBins[i];
    }
    const tAvg = tSum / Math.max(1, tEnd - tStart + 1) / 255;

    this.bassMeter = Math.min(1.0, Math.pow(bAvg, 1.3) * 1.45);
    this.trebleMeter = Math.min(1.0, Math.pow(tAvg, 1.1) * 1.65);
  }

  /**
   * Song position (seconds) the player is HEARING right now, corrected for the
   * delay between the browser processing audio and it leaving the speakers.
   * See songClock.ts for the details.
   */
  public getPlaybackTime(): number {
    if (this.isLoadingBuffer) return 0;
    if (!this.ctx || (!this.currentSource && !this.isPlayingSynth)) return 0;
    if (this.currentSource) {
      this.updateRealtimeMeters();
    }
    const ctx = this.ctx;
    let outputStamp: AudioTimestamp | undefined;
    try {
      outputStamp = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : undefined;
    } catch {
      outputStamp = undefined;
    }
    return computeHeardSongTime({
      contextTime: ctx.currentTime,
      songStartContextTime: this.startTime,
      outputLatency: (ctx.outputLatency || 0) + (ctx.baseLatency || 0),
      outputStamp,
      perfNow: performance.now(),
    });
  }

  private preparePromises: Map<string, Promise<void>> = new Map();

  /**
   * Ensures a track has audio decoded and a beat chart. Bundled tracks ship with
   * `notes: []` and are charted at runtime by the same analyzer used for imports.
   */
  public prepareTrack(track: Track): Promise<void> {
    if (track.notes.length > 0 && (track.audioBuffer || !track.audioUrl)) return Promise.resolve();
    const existing = this.preparePromises.get(track.id);
    if (existing) return existing;

    const p = (async () => {
      const buffer = await this.preloadTrackAudio(track);
      if (buffer && track.notes.length === 0) {
        const result = this.analyzeAudioBuffer(buffer);
        track.bpm = result.bpm;
        track.notes = result.notes;
      }
    })().finally(() => this.preparePromises.delete(track.id));

    this.preparePromises.set(track.id, p);
    return p;
  }

  public async preloadTrackAudio(track: Track): Promise<AudioBuffer | null> {
    if (track.audioBuffer) return track.audioBuffer;
    if (!track.audioUrl) return null;

    const cached = this.urlBufferCache.get(track.audioUrl);
    if (cached) {
      track.audioBuffer = cached;
      return cached;
    }

    try {
      this.initContext();
      const response = await fetch(track.audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const decoded = await this.ctx!.decodeAudioData(arrayBuffer);
      this.urlBufferCache.set(track.audioUrl, decoded);
      track.audioBuffer = decoded;
      return decoded;
    } catch (err) {
      console.warn('Could not preload track audio URL:', err);
      return null;
    }
  }

  public async startTrack(track: Track, onComplete?: () => void) {
    this.initContext();
    this.stop();
    const session = ++this.playSessionId;

    let bufferToPlay = track.audioBuffer || null;
    if (!bufferToPlay && track.audioUrl) {
      this.isLoadingBuffer = true;
      bufferToPlay = await this.preloadTrackAudio(track);
      this.isLoadingBuffer = false;
      if (session !== this.playSessionId) return;
    }

    this.startTime = this.ctx!.currentTime;

    if (bufferToPlay) {
      const source = this.ctx!.createBufferSource();
      source.buffer = bufferToPlay;
      source.connect(this.musicGain!);
      source.onended = () => {
        if (this.currentSource === source) {
          this.currentSource = null;
          if (onComplete) onComplete();
        }
      };
      // Start a touch in the future so the first sample lands exactly on startTime.
      this.startTime = this.ctx!.currentTime + 0.05;
      source.start(this.startTime);
      this.currentSource = source;
    } else {
      // Procedural Web Audio synthesizer fallback
      this.isPlayingSynth = true;
      this.startProceduralSynth(track, onComplete);
    }
  }

  public stop() {
    this.playSessionId++;
    this.isLoadingBuffer = false;
    if (this.paused) {
      // Un-freeze the clock so the next song (or menu sounds) can play.
      this.paused = false;
      this.ctx?.resume();
    }
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
    this.bassMeter = 0;
    this.trebleMeter = 0;
  }

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
  // Dynamic Song Hit Noise: Instead of an artificial synth click, the song itself surges +25% louder on hit!
  /**
   * Hit feedback. `mode` picks what plays: the tuned tone, the song volume
   * surge, both, or nothing. `pitchHz` is the pitch of the struck note.
   */
  public playHitSound(
    judgement: TimingJudgementType,
    band?: FrequencyBand,
    pitchHz?: number,
    mode: HitSoundMode = 'both'
  ) {
    if (mode === 'off') return;
    if (mode === 'both' || mode === 'tone') this.playHitTone(judgement, pitchHz);
    if (mode === 'both' || mode === 'surge') this.playSongSurge(judgement, band);
  }

  /** Short plucked note, tuned to the music at the struck beat (see hitTone.ts). */
  private playHitTone(judgement: TimingJudgementType, pitchHz?: number) {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const time = ctx.currentTime;
    const freq = foldIntoOctave(pitchHz ?? 0);
    const peak = judgement === 'PERFECT' ? 0.22 : judgement === 'GOOD' ? 0.16 : 0.11;
    const decay = judgement === 'PERFECT' ? 0.28 : 0.2;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(peak, time + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    env.connect(this.sfxGain);

    // Body of the note, plus a quieter octave on top for sparkle on PERFECT.
    const partials: Array<[OscillatorType, number, number]> = [
      ['triangle', 1, 1],
      ['sine', 2, judgement === 'PERFECT' ? 0.45 : 0.2],
    ];
    for (const [type, multiple, level] of partials) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq * multiple, time);
      g.gain.setValueAtTime(level, time);
      osc.connect(g);
      g.connect(env);
      osc.start(time);
      osc.stop(time + decay + 0.02);
    }
  }

  private playSongSurge(judgement: TimingJudgementType, band?: FrequencyBand) {
    this.initContext();
    if (!this.ctx || !this.musicGain) return;

    const ctx = this.ctx;
    const time = ctx.currentTime;

    // +25% volume boost on PERFECT (15% on GOOD, 8% on OK)
    const boostFactor = judgement === 'PERFECT' ? 1.25 : judgement === 'GOOD' ? 1.15 : 1.08;
    const peakVolume = this.masterVolume * boostFactor;
    const decayDuration = judgement === 'PERFECT' ? 0.14 : 0.10;

    // Surge the song volume right on the hit beat, then smoothly decay back to master volume
    this.musicGain.gain.cancelScheduledValues(time);
    this.musicGain.gain.setValueAtTime(peakVolume, time);
    this.musicGain.gain.linearRampToValueAtTime(this.masterVolume, time + decayDuration);

    // Punch the visual frequency meters so canvas floor effects flare in sync with the +25% song pump
    if (band === 'sub' || band === 'bass') {
      this.bassMeter = Math.min(1.0, this.bassMeter + 0.35);
    } else {
      this.trebleMeter = Math.min(1.0, this.trebleMeter + 0.35);
    }
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

  public analyzeAudioBuffer(
    audioBuffer: AudioBuffer,
    progressCallback?: (progress: number) => void
  ): { bpm: number; notes: BeatNote[]; description: string } {
    const sr = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : ch0;
    const len = ch0.length;

    // 1. Center-reinforced stereo-to-mono mixdown (reinforces center-panned kick & bassline)
    const mono = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      mono[i] = 0.5 * (ch0[i] + ch1[i]);
    }

    // 2. 4x Decimated low-frequency stream for ultra-clean IIR Biquad filtering
    const ds = 4;
    const srLow = sr / ds;
    const nDs = Math.floor(len / ds);
    const monoDs = new Float32Array(nDs);
    for (let i = 0; i < nDs; i++) {
      const base = i * ds;
      monoDs[i] = 0.25 * (mono[base] + mono[base + 1] + mono[base + 2] + mono[base + 3]);
    }

    // Band 1: Thumping Sub-Kick Band (36Hz - 145Hz, steep 4th-order lowpass rejection of synths)
    let kickSig = runBiquadFilter(monoDs, computeBiquadCoeffs(srLow, 'highpass', 36.0, 0.707));
    kickSig = runBiquadFilter(kickSig, computeBiquadCoeffs(srLow, 'lowpass', 135.0, 0.85));
    kickSig = runBiquadFilter(kickSig, computeBiquadCoeffs(srLow, 'lowpass', 145.0, 0.85));

    // Band 2: Changing Bassline / Rolling & Acid Groove Band (105Hz - 300Hz)
    let bassSig = runBiquadFilter(monoDs, computeBiquadCoeffs(srLow, 'bandpass', 175.0, 0.95));
    bassSig = runBiquadFilter(bassSig, computeBiquadCoeffs(srLow, 'lowpass', 300.0, 0.8));

    if (progressCallback) progressCallback(0.65);

    // 3. 10ms High-Resolution Frame Envelopes
    const hop = Math.round(srLow * 0.01);
    const win = Math.round(srLow * 0.025);
    const nFrames = Math.floor((nDs - win) / hop);
    const frameDt = hop / srLow;

    const kickRms = new Float32Array(nFrames);
    const bassRms = new Float32Array(nFrames);
    const highRms = new Float32Array(nFrames);

    const hopFull = hop * ds;
    const winFull = win * ds;

    for (let i = 0; i < nFrames; i++) {
      const offLow = i * hop;
      let kSum = 0;
      let bSum = 0;
      for (let j = 0; j < win; j++) {
        const kv = kickSig[offLow + j];
        const bv = bassSig[offLow + j];
        kSum += kv * kv;
        bSum += bv * bv;
      }
      kickRms[i] = Math.sqrt(kSum / win);
      bassRms[i] = Math.sqrt(bSum / win);

      const offFull = i * hopFull;
      let hSum = 0;
      let prev = offFull > 0 ? mono[offFull - 1] : mono[0];
      for (let j = 0; j < winFull; j++) {
        const v = mono[offFull + j];
        const d = v - prev;
        hSum += d * d;
        prev = v;
      }
      highRms[i] = Math.sqrt(hSum / winFull);
    }

    const kickEnv = smooth3Tap(kickRms, 0.2, 0.6, 0.2);
    const bassEnv = smooth3Tap(bassRms, 0.2, 0.6, 0.2);
    const highEnv = smooth3Tap(highRms, 0.2, 0.6, 0.2);

    // 4. Onset Attack Flux (half-wave rectified derivative weighted by envelope amplitude)
    const computeOnset = (env: Float32Array): Float32Array => {
      const flux = new Float32Array(env.length);
      for (let i = 3; i < env.length; i++) {
        const d1 = Math.max(0, env[i] - env[i - 1]);
        const d2 = Math.max(0, env[i] - env[i - 2]);
        const d3 = Math.max(0, env[i] - env[i - 3]);
        flux[i] = (0.45 * d1 + 0.35 * d2 + 0.2 * d3) * Math.sqrt(env[i]);
      }
      return smooth3Tap(flux, 0.25, 0.5, 0.25);
    };

    const kickOnset = computeOnset(kickEnv);
    const bassOnset = computeOnset(bassEnv);
    const highOnset = computeOnset(highEnv);

    const kP95 = percentile(kickOnset, 95) + 1e-9;
    const bP95 = percentile(bassOnset, 95) + 1e-9;
    const hP95 = percentile(highOnset, 95) + 1e-9;
    const kEnvP85 = percentile(kickEnv, 85) + 1e-9;
    const bEnvP85 = percentile(bassEnv, 85) + 1e-9;

    const kickN = new Float32Array(nFrames);
    const bassN = new Float32Array(nFrames);
    const highN = new Float32Array(nFrames);
    const lowOnset = new Float32Array(nFrames);
    const lowEnvNorm = new Float32Array(nFrames);

    let lowMeanGlobal = 0;
    for (let i = 0; i < nFrames; i++) {
      kickN[i] = kickOnset[i] / kP95;
      bassN[i] = bassOnset[i] / bP95;
      highN[i] = highOnset[i] / hP95;
      lowOnset[i] = Math.max(kickN[i], 0.82 * bassN[i]);
      lowEnvNorm[i] = Math.max(kickEnv[i] / kEnvP85, 0.8 * (bassEnv[i] / bEnvP85));
      lowMeanGlobal += lowOnset[i];
    }
    lowMeanGlobal /= Math.max(1, nFrames);

    if (progressCallback) progressCallback(0.8);

    // 5. Global BPM Estimation via Autocorrelation of Bassline Onset Envelope (92 - 200 BPM)
    const minLag = Math.round(0.3 / frameDt);
    const maxLag = Math.round(0.65 / frameDt);
    let bestLag = minLag;
    let bestAc = -Infinity;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let c1 = 0;
      for (let i = 0; i < nFrames - lag; i++) {
        c1 += (lowOnset[i] - lowMeanGlobal) * (lowOnset[i + lag] - lowMeanGlobal);
      }
      let c2 = 0;
      const lag2 = lag * 2;
      if (lag2 < nFrames) {
        for (let i = 0; i < nFrames - lag2; i++) {
          c2 += (lowOnset[i] - lowMeanGlobal) * (lowOnset[i + lag2] - lowMeanGlobal);
        }
      }
      const score = c1 + 0.5 * c2;
      if (score > bestAc) {
        bestAc = score;
        bestLag = lag;
      }
    }

    const beatFrames = bestLag;
    const beatSec = beatFrames * frameDt;
    const estimatedBpm = Math.min(200, Math.max(90, Math.round(60 / beatSec)));

    const locLowMean = computeMovingMean(lowOnset, 24);
    const locHighMean = computeMovingMean(highN, 24);
    const secBassActivity = computeMovingMean(lowOnset, 120);

    // Local Comb Periodicity Score: locks onto local beat phase in thumping sections
    const combScore = new Float32Array(nFrames);
    const primarySignal = new Float32Array(nFrames);
    const combSteps = [-3, -2, -1, 1, 2, 3];

    for (let i = 0; i < nFrames; i++) {
      let s = 0;
      let cnt = 0;
      for (const k of combSteps) {
        const p = i + k * beatFrames;
        if (p >= 0 && p < nFrames) {
          const p0 = Math.max(0, p - 2);
          const p1 = Math.min(nFrames - 1, p + 2);
          let maxLocal = 0;
          for (let m = p0; m <= p1; m++) {
            if (lowOnset[m] > maxLocal) maxLocal = lowOnset[m];
          }
          s += maxLocal;
          cnt++;
        }
      }
      combScore[i] = s / Math.max(1, cnt);
      primarySignal[i] = lowOnset[i] * (1 + 0.65 * combScore[i]);
    }

    interface BeatCandidate {
      frame: number;
      time: number;
      val: number;
      pScore: number;
      comb: number;
      lowEnv: number;
      kickN: number;
      bassN: number;
      highN: number;
      locMean: number;
      kind: 'kick' | 'bass' | 'lead';
      source: 'primary_bass' | 'bridged_kick' | 'sub_bass' | 'treble_melody';
    }

    const bassCandidates: BeatCandidate[] = [];
    for (let i = 3; i < nFrames - 3; i++) {
      const t = (i * hop + win / 2) / srLow;
      if (t < 1.0 || t > duration - 0.8) continue;

      const val = lowOnset[i];
      if (val >= lowOnset[i - 1] && val >= lowOnset[i + 1]) {
        const denom = lowOnset[i - 1] - 2 * lowOnset[i] + lowOnset[i + 1];
        let offset = Math.abs(denom) > 1e-9 ? (0.5 * (lowOnset[i - 1] - lowOnset[i + 1])) / denom : 0;
        offset = Math.max(-0.5, Math.min(0.5, offset));
        const preciseT = ((i + offset) * hop + win / 2) / srLow;
        const isKickDom = kickN[i] >= bassN[i] * 0.82 && kickEnv[i] / kEnvP85 > 0.28;

        let hSimult = 0;
        for (let m = Math.max(0, i - 2); m <= Math.min(nFrames - 1, i + 2); m++) {
          if (highN[m] > hSimult) hSimult = highN[m];
        }

        bassCandidates.push({
          frame: i,
          time: preciseT,
          val,
          pScore: primarySignal[i],
          comb: combScore[i],
          lowEnv: lowEnvNorm[i],
          kickN: kickN[i],
          bassN: bassN[i],
          highN: hSimult,
          locMean: locLowMean[i],
          kind: isKickDom ? 'kick' : 'bass',
          source: 'primary_bass',
        });
      }
    }

    // PASS 1: Lock in primary thumping kicks & main bassline hits (sorted by primary score so off-beats never displace real kicks!)
    const minPrimarySpacing = Math.max(0.28, beatSec * 0.76);
    const pass1Candidates = bassCandidates
      .filter(
        (c) =>
          (c.comb > 0.34 && c.val > Math.max(0.12, c.locMean * 1.04) && c.lowEnv > 0.22) ||
          (c.val > Math.max(0.19, c.locMean * 1.32) && c.lowEnv > 0.18)
      )
      .sort((a, b) => b.pScore - a.pScore);

    const lockedBeats: BeatCandidate[] = [];
    for (const c of pass1Candidates) {
      if (lockedBeats.every((b) => Math.abs(c.time - b.time) >= minPrimarySpacing)) {
        lockedBeats.push({ ...c, source: 'primary_bass' });
      }
    }
    lockedBeats.sort((a, b) => a.time - b.time);

    // PASS 1.5: Bridge single missed beat in steady 4/4 thumping train
    const bridged: BeatCandidate[] = [];
    for (let idx = 0; idx < lockedBeats.length - 1; idx++) {
      const bPrev = lockedBeats[idx];
      const bNext = lockedBeats[idx + 1];
      const gap = bNext.time - bPrev.time;
      if (gap >= 1.72 * beatSec && gap <= 2.28 * beatSec && bPrev.comb > 0.38 && bNext.comb > 0.38) {
        const midT = 0.5 * (bPrev.time + bNext.time);
        const midFrame = Math.round((midT * srLow - win / 2) / hop);
        const f0 = Math.max(3, midFrame - 4);
        const f1 = Math.min(nFrames - 4, midFrame + 4);
        let bestF = f0;
        for (let f = f0; f <= f1; f++) {
          if (lowOnset[f] > lowOnset[bestF]) bestF = f;
        }
        if (lowEnvNorm[bestF] > 0.3 && lowOnset[bestF] > 0.08) {
          const preciseT = (bestF * hop + win / 2) / srLow;
          let hSimult = 0;
          for (let m = Math.max(0, bestF - 2); m <= Math.min(nFrames - 1, bestF + 2); m++) {
            if (highN[m] > hSimult) hSimult = highN[m];
          }
          bridged.push({
            frame: bestF,
            time: preciseT,
            val: lowOnset[bestF],
            pScore: primarySignal[bestF],
            comb: combScore[bestF],
            lowEnv: lowEnvNorm[bestF],
            kickN: kickN[bestF],
            bassN: bassN[bestF],
            highN: hSimult,
            locMean: locLowMean[bestF],
            kind: 'kick',
            source: 'bridged_kick',
          });
        }
      }
    }
    lockedBeats.push(...bridged);
    lockedBeats.sort((a, b) => a.time - b.time);

    // Extra notes (passes 2 and 3) need a gap measured in BEATS, not just seconds: a
    // fixed gap lets a slow song cram in two or three notes per beat (most of them
    // off the beat), so it plays far harder than a fast one. Scaled like this, extra
    // notes come at most every eighth note at any tempo; fast songs, whose
    // eighth notes are already near the old fixed gaps, are almost unchanged.
    const extraSpacing = Math.max(0.185, beatSec * 0.45);

    // Slow songs also keep their extra notes ON the eighth-note grid (fitted to the
    // main beats found so far). A rolling bassline gives onsets all over the beat;
    // at a slow tempo there is room for them between the beats, so without this
    // they land at random points and the chart feels unreadable. Fast songs keep
    // their charts as they were: their spacing already limits the extras.
    const allowedExtra = extraNoteFilter(
      gridForNotes(
        lockedBeats.map((b) => ({ time: b.time, band: b.kind === 'kick' ? 'sub' : 'bass' })),
        estimatedBpm
      )
    );

    // PASS 2: Fast / Rolling / Syncopated Bassline Sub-Beats (follows changing bassline riffs & off-beat bounces)
    const pass2Sorted = [...bassCandidates].sort((a, b) => b.val - a.val);
    for (const c of pass2Sorted) {
      if (c.val > Math.max(0.27, c.locMean * 1.46) && c.lowEnv > 0.22 && allowedExtra(c.time)) {
        if (lockedBeats.every((b) => Math.abs(c.time - b.time) >= extraSpacing)) {
          lockedBeats.push({ ...c, source: 'sub_bass' });
        }
      }
    }
    lockedBeats.sort((a, b) => a.time - b.time);

    // PASS 3: Melodic / High-Frequency notes in breakdowns/intros or wide gaps where bass isn't driving
    const highCandidates: { frame: number; time: number; val: number; minDist: number }[] = [];
    for (let i = 3; i < nFrames - 3; i++) {
      const t = (i * hop + win / 2) / srLow;
      if (t < 1.0 || t > duration - 0.8) continue;

      const val = highN[i];
      if (
        val >= highN[i - 1] &&
        val >= highN[i + 1] &&
        val >= highN[i - 2] &&
        val >= highN[i + 2]
      ) {
        const isLowBassSec = secBassActivity[i] < 0.28;
        const thresh = isLowBassSec
          ? Math.max(0.22, locHighMean[i] * 1.35)
          : Math.max(0.48, locHighMean[i] * 1.65);
        const minDist = isLowBassSec ? Math.max(0.22, extraSpacing) : Math.max(0.34, beatSec * 0.6);
        if (val > thresh) {
          highCandidates.push({ frame: i, time: t, val, minDist });
        }
      }
    }

    highCandidates.sort((a, b) => b.val - a.val);
    for (const hc of highCandidates) {
      if (!allowedExtra(hc.time)) continue;
      if (lockedBeats.every((b) => Math.abs(hc.time - b.time) >= hc.minDist)) {
        lockedBeats.push({
          frame: hc.frame,
          time: hc.time,
          val: hc.val,
          pScore: hc.val,
          comb: 0,
          lowEnv: 0,
          kickN: 0,
          bassN: 0,
          highN: hc.val,
          locMean: 0,
          kind: 'lead',
          source: 'treble_melody',
        });
      }
    }
    lockedBeats.sort((a, b) => a.time - b.time);

    // 5b. Remove the detector's built-in lag on kick & bass notes.
    // The low-band onset curve peaks after the sound actually starts (25ms
    // analysis windows, smoothing and filter delay). Measured on synthetic
    // songs with known kick times: 13-19ms late in a loud, dense mix, so we
    // pull these notes 15ms earlier. Treble notes measured ~0ms off: unchanged.
    for (const b of lockedBeats) {
      if (b.kind !== 'lead') b.time = Math.max(0, b.time - LOW_BAND_DETECTOR_LAG_SEC);
    }
    lockedBeats.sort((a, b) => a.time - b.time);

    // 6. Acoustic & Phrase-Aware Lane Choreography
    const notes: BeatNote[] = [];
    let sameLaneStreak = 0;
    let lastLane: Lane = 'right';

    for (let idx = 0; idx < lockedBeats.length; idx++) {
      const b = lockedBeats[idx];
      const dtPrev = idx > 0 ? b.time - lockedBeats[idx - 1].time : 999;

      let lane: Lane = 'left';
      let enemyType: 'brawler' | 'speeder' | 'ronin' = 'brawler';
      let pitchCategory: BeatNote['pitchCategory'] = 'kick';

      if (b.source === 'treble_melody') {
        lane = 'right';
        enemyType = idx % 2 === 0 ? 'speeder' : 'ronin';
        pitchCategory = 'treble';
      } else if (b.source === 'sub_bass' || dtPrev < 0.26) {
        lane = lastLane === 'left' ? 'right' : 'left';
        enemyType = lane === 'right' ? 'speeder' : 'brawler';
        pitchCategory = 'bass';
      } else {
        const prevH = idx > 0 ? lockedBeats[idx - 1].highN : b.highN;
        const nextH = idx + 1 < lockedBeats.length ? lockedBeats[idx + 1].highN : b.highN;
        const hasBackbeatSnap = b.highN > (prevH + nextH) * 0.55 && b.highN > 0.28;
        const isUpperBassRiff = b.bassN > b.kickN * 1.12;

        lane = hasBackbeatSnap || isUpperBassRiff ? 'right' : 'left';

        if (lane === lastLane) {
          sameLaneStreak++;
          if (
            sameLaneStreak >= 2 &&
            (b.highN > 0.2 || b.bassN > b.kickN * 0.85 || sameLaneStreak >= 3)
          ) {
            lane = lastLane === 'left' ? 'right' : 'left';
            sameLaneStreak = 0;
          }
        } else {
          sameLaneStreak = 0;
        }

        if (lane === 'left') {
          enemyType = 'brawler';
          pitchCategory = b.kind === 'kick' ? 'kick' : 'bass';
        } else {
          enemyType = hasBackbeatSnap || b.kind === 'kick' ? 'ronin' : 'speeder';
          pitchCategory = hasBackbeatSnap ? 'snare' : 'bass';
        }
      }

      if (lane === lastLane) {
        sameLaneStreak++;
      } else {
        sameLaneStreak = 1;
      }
      lastLane = lane;

      notes.push({
        time: Number(b.time.toFixed(3)),
        lane,
        enemyType,
        pitchCategory,
        band: b.kind === 'kick' ? 'sub' : b.kind === 'bass' ? 'bass' : 'high',
      });
    }

    // 7. Enemy variant tiers: where does each hit sit inside its band's Hz range?
    assignSpectralTiers(notes, mono, sr);

    if (progressCallback) progressCallback(1.0);

    // Refine the coarse tempo (only accurate to ~±2 BPM) by lining notes up on a beat grid.
    const grid = gridForNotes(notes, estimatedBpm);
    const preciseBpm = grid.strength > 0.15 ? grid.bpm : estimatedBpm;

    return {
      bpm: preciseBpm,
      notes,
      description: `${notes.length} dynamic bassline-locked beats (${Math.round(preciseBpm)} BPM · Adaptive Kick & Bass Tracker)`,
    };
  }

  public async analyzeAudioFile(
    file: File,
    progressCallback?: (progress: number) => void
  ): Promise<Track> {
    this.initContext();
    const arrayBuffer = await file.arrayBuffer();
    if (progressCallback) progressCallback(0.25);

    const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer.slice(0));
    if (progressCallback) progressCallback(0.5);

    const { bpm, notes, description } = this.analyzeAudioBuffer(audioBuffer, progressCallback);

    const trackTitle = file.name.replace(/\.[^/.]+$/, '') || 'Custom Track';
    const track: Track = {
      id: `custom_${Date.now()}`,
      title: trackTitle,
      artist: 'Custom Import',
      bpm,
      difficulty: 'Custom',
      duration: Math.round(audioBuffer.duration),
      description,
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


export const PRELOADED_TRACKS: Track[] = [
  {
    id: 'track_eargasm',
    title: 'Eargasm',
    artist: 'defaultsaviour',
    bpm: 150,
    difficulty: 'Hard',
    duration: 190,
    description:
      'Hard-thumping 150 BPM techno anthem! Heavy 4-on-the-floor kick drops with dynamic evolving basslines.',
    notes: [], // Charted at runtime from the audio by analyzeAudioBuffer (see prepareTrack)
    audioUrl: '/audio/Eargasm.mp3',
  },
  {
    id: 'track_eargasm_2',
    title: 'Eargasm 2',
    artist: 'defaultsaviour',
    bpm: 150,
    difficulty: 'Hard',
    duration: 220,
    description:
      'Extended 220s techno powerhouse with relentless sub-bass pressure, rolling groove changes, and surging leads.',
    notes: [],
    audioUrl: '/audio/Eargasm2.mp3',
  },
  {
    id: 'track_eargasm_3',
    title: 'Eargasm 3',
    artist: 'defaultsaviour',
    bpm: 150,
    difficulty: 'Hard',
    duration: 189,
    description:
      'Driving peak-time energy packed with syncopated bassline runs and razor-sharp high percussive accents.',
    notes: [],
    audioUrl: '/audio/Eargasm3.mp3',
  },
  {
    id: 'track_eargasm_4',
    title: 'Eargasm 4',
    artist: 'defaultsaviour',
    bpm: 200,
    difficulty: 'Hard',
    duration: 195,
    description:
      'Blistering 200 BPM high-speed techno overdrive! Fast-paced rhythm streams test reflexes and combo mastery.',
    notes: [],
    audioUrl: '/audio/Eargasm4.mp3',
  },
  {
    id: 'track_eargasm_5',
    title: 'Eargasm 5',
    artist: 'defaultsaviour',
    bpm: 104,
    difficulty: 'Medium',
    duration: 199,
    description:
      'Hypnotic 104 BPM deep techno groove with deep resonant sub kicks and spacious atmospheric sweeps.',
    notes: [],
    audioUrl: '/audio/Eargasm5.mp3',
  },
];



