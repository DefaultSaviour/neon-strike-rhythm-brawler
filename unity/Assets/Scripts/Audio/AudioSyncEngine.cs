using System;
using UnityEngine;

namespace NeonStrike.Audio
{
    public class AudioSyncEngine : MonoBehaviour
    {
        public static AudioSyncEngine Instance { get; private set; }

        [Header("Audio Components")]
        [SerializeField] private AudioSource musicSource;

        [Header("Volume Surge Settings")]
        [SerializeField] private float baseVolume = 0.8f;
        [SerializeField] private float surgeMultiplier = 1.25f; // +25% volume surge on impact
        [SerializeField] private float surgeDecaySpeed = 12f;

        private double dspSongStartTime;
        private bool isPlaying = false;
        private bool isPaused = false;
        private double pauseDspTime = 0;
        private float currentSurgeVolume = 0f;

        public float BaseVolume
        {
            get => baseVolume;
            set
            {
                baseVolume = Mathf.Clamp01(value);
                if (musicSource != null && !isPlaying)
                    musicSource.volume = baseVolume;
            }
        }

        public bool IsPlaying => isPlaying && !isPaused;
        public float SongDuration => musicSource != null && musicSource.clip != null ? musicSource.clip.length : 0f;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            if (musicSource == null)
            {
                musicSource = GetComponent<AudioSource>();
                if (musicSource == null)
                {
                    musicSource = gameObject.AddComponent<AudioSource>();
                }
            }

            musicSource.playOnAwake = false;
            musicSource.loop = false;
            musicSource.volume = baseVolume;
        }

        public void PlayTrack(AudioClip clip, double startDelayDsp = 0.5)
        {
            if (clip == null) return;

            musicSource.clip = clip;
            currentSurgeVolume = baseVolume;
            musicSource.volume = baseVolume;

            double currentDsp = AudioSettings.dspTime;
            dspSongStartTime = currentDsp + startDelayDsp;
            musicSource.PlayScheduled(dspSongStartTime);

            isPlaying = true;
            isPaused = false;
        }

        public void PauseTrack()
        {
            if (!isPlaying || isPaused) return;

            musicSource.Pause();
            pauseDspTime = AudioSettings.dspTime;
            isPaused = true;
        }

        public void ResumeTrack()
        {
            if (!isPlaying || !isPaused) return;

            double pausedDuration = AudioSettings.dspTime - pauseDspTime;
            dspSongStartTime += pausedDuration;
            musicSource.UnPause();
            isPaused = false;
        }

        public void StopTrack()
        {
            if (musicSource != null)
            {
                musicSource.Stop();
            }
            isPlaying = false;
            isPaused = false;
        }

        /// <summary>
        /// Returns the exact hardware-clock song time in seconds with zero micro-stutter.
        /// </summary>
        public float GetSongTime()
        {
            if (!isPlaying) return 0f;

            if (isPaused)
            {
                return Mathf.Max(0f, (float)(pauseDspTime - dspSongStartTime));
            }

            double elapsed = AudioSettings.dspTime - dspSongStartTime;
            return Mathf.Max(0f, (float)elapsed);
        }

        /// <summary>
        /// Triggers the dynamic +25% volume surge on impact (zero synthetic beep; the song itself punches louder).
        /// </summary>
        public void TriggerHitSurge()
        {
            currentSurgeVolume = baseVolume * surgeMultiplier;
            if (musicSource != null)
            {
                musicSource.volume = Mathf.Clamp(currentSurgeVolume, 0f, 1.0f);
            }
        }

        private void Update()
        {
            if (!isPlaying || isPaused || musicSource == null) return;

            // Exponential decay of surge volume back to baseVolume
            if (currentSurgeVolume > baseVolume)
            {
                currentSurgeVolume = Mathf.MoveTowards(currentSurgeVolume, baseVolume, Time.deltaTime * surgeDecaySpeed);
                musicSource.volume = Mathf.Clamp(currentSurgeVolume, 0f, 1.0f);
            }
        }
    }
}
