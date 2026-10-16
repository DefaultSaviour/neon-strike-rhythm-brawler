using System;
using System.Collections.Generic;
using UnityEngine;
using NeonStrike.Core;

namespace NeonStrike.Game
{
    [Serializable]
    public class TrackMetadata
    {
        public string id;
        public string title;
        public string artist;
        public float bpm;
        public string difficulty;
        public AudioClip clip;
    }

    public static class BeatChartGenerator
    {
        public static List<BeatNote> GenerateChart(float duration, float bpm)
        {
            List<BeatNote> notes = new List<BeatNote>();
            if (bpm <= 0 || duration <= 0) return notes;

            float secondsPerBeat = 60f / bpm;
            float totalBeats = duration / secondsPerBeat;

            Lane currentLane = Lane.Left;
            int consecutiveSameLane = 0;

            // Generate musical rhythm patterns across the 3 acoustic frequency bands
            for (int b = 4; b < totalBeats - 4; b++)
            {
                float time = b * secondsPerBeat;

                // Alternate lanes with periodic double taps
                if (b % 4 == 0 || consecutiveSameLane >= 3)
                {
                    currentLane = (currentLane == Lane.Left) ? Lane.Right : Lane.Left;
                    consecutiveSameLane = 1;
                }
                else
                {
                    consecutiveSameLane++;
                }

                // Determine acoustic frequency band & tier based on rhythmic role
                FrequencyBand band;
                EnemyTier tier;

                if (b % 4 == 0)
                {
                    // Primary Downbeat: Heavy Sub / Kick
                    band = FrequencyBand.Sub;
                    tier = (b % 8 == 0) ? EnemyTier.Tier1_Low : (b % 16 == 0 ? EnemyTier.Tier3_High : EnemyTier.Tier2_Mid);
                    notes.Add(new BeatNote(time, currentLane, band, tier));
                }
                else if (b % 2 == 0)
                {
                    // Snare / High clap on beat 2 & 4
                    band = FrequencyBand.High;
                    tier = (b % 6 == 0) ? EnemyTier.Tier2_Mid : EnemyTier.Tier1_Low;
                    notes.Add(new BeatNote(time, currentLane, band, tier));
                }
                else
                {
                    // Syncopated Bassline groove on upbeat
                    band = FrequencyBand.Bass;
                    tier = (b % 3 == 0) ? EnemyTier.Tier3_High : (b % 5 == 0 ? EnemyTier.Tier1_Low : EnemyTier.Tier2_Mid);
                    notes.Add(new BeatNote(time, currentLane, band, tier));
                }

                // Occasional 16th-note Highs stream during high intensity sections
                if (b > 16 && b % 16 >= 12 && b % 2 == 1)
                {
                    float halfTime = time + (secondsPerBeat * 0.5f);
                    Lane offLane = (currentLane == Lane.Left) ? Lane.Right : Lane.Left;
                    notes.Add(new BeatNote(halfTime, offLane, FrequencyBand.High, EnemyTier.Tier3_High));
                }
            }

            notes.Sort((a, b) => a.time.CompareTo(b.time));
            return notes;
        }
    }
}
