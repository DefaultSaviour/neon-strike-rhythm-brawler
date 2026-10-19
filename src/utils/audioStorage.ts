import { Track, BeatNote } from '../types/game';

const DB_NAME = 'neon_strike_audio_db_v2';
const STORE_NAME = 'custom_tracks';
const DB_VERSION = 1;
export const CURRENT_ANALYSIS_VERSION = 6;

interface StoredTrackData {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  difficulty: 'Custom';
  duration: number;
  description: string;
  notes: BeatNote[];
  audioArrayBuffer: ArrayBuffer;
  createdAt: number;
  analysisVersion?: number;
}

class AudioStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  // Save track with raw audio ArrayBuffer forever in IndexedDB
  public async saveCustomTrack(track: Track, arrayBuffer: ArrayBuffer): Promise<void> {
    const db = await this.getDB();
    const data: StoredTrackData = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      bpm: track.bpm,
      difficulty: 'Custom',
      duration: track.duration,
      description: track.description,
      notes: track.notes,
      audioArrayBuffer: arrayBuffer,
      createdAt: Date.now(),
      analysisVersion: CURRENT_ANALYSIS_VERSION,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Load all custom tracks from IndexedDB forever across sessions
  // Automatically upgrades beat charts if a newer bassline analysis version exists
  public async loadAllCustomTracks(
    audioCtx: AudioContext,
    reanalyzeBuffer?: (audioBuffer: AudioBuffer) => { bpm: number; notes: BeatNote[]; description: string }
  ): Promise<Track[]> {
    try {
      const db = await this.getDB();
      const storedList: StoredTrackData[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      const loadedTracks: Track[] = [];

      for (const item of storedList) {
        try {
          // Decode audio buffer for playback
          // Slice the arrayBuffer in case decodeAudioData detaches it
          const bufferCopy = item.audioArrayBuffer.slice(0);
          const audioBuffer = await audioCtx.decodeAudioData(bufferCopy);

          let bpm = item.bpm;
          let notes = item.notes;
          let description = item.description;

          if (reanalyzeBuffer && item.analysisVersion !== CURRENT_ANALYSIS_VERSION) {
            const upgraded = reanalyzeBuffer(audioBuffer);
            bpm = upgraded.bpm;
            notes = upgraded.notes;
            description = upgraded.description;

            const updatedTrack: Track = {
              id: item.id,
              title: item.title,
              artist: item.artist,
              bpm,
              difficulty: 'Custom',
              duration: item.duration,
              description,
              notes,
              isCustom: true,
              audioBuffer,
            };
            await this.saveCustomTrack(updatedTrack, item.audioArrayBuffer);
          }

          loadedTracks.push({
            id: item.id,
            title: item.title,
            artist: item.artist,
            bpm,
            difficulty: 'Custom',
            duration: item.duration,
            description,
            notes,
            isCustom: true,
            audioBuffer,
          });
        } catch (err) {
          console.warn(`Could not decode stored track ${item.title}:`, err);
        }
      }

      return loadedTracks;
    } catch (err) {
      console.warn('Failed to load custom tracks from IndexedDB:', err);
      return [];
    }
  }

  // Delete a custom track from IndexedDB
  public async deleteCustomTrack(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const audioStorage = new AudioStorage();

