using System;
using System.Collections.Generic;
using UnityEngine;
using NeonStrike.Core;
using NeonStrike.Audio;
using NeonStrike.Player;
using NeonStrike.Enemies;

namespace NeonStrike.Game
{
    public class RhythmCombatManager : MonoBehaviour
    {
        public static RhythmCombatManager Instance { get; private set; }

        [Header("References")]
        [SerializeField] private PlayerCombatController player;
        [SerializeField] private AudioSyncEngine audioSync;
        [SerializeField] private GameObject enemyPrefab;

        [Header("Tracks Library")]
        [SerializeField] private List<TrackMetadata> availableTracks = new List<TrackMetadata>();

        [Header("Gameplay Settings")]
        [SerializeField] private bool oneButtonMode = false;
        [SerializeField] private float approachDuration = 1.6f;

        [Header("Hit Timing Windows (Seconds)")]
        [SerializeField] private float perfectWindow = 0.045f; // 45ms
        [SerializeField] private float goodWindow = 0.090f;    // 90ms
        [SerializeField] private float okWindow = 0.140f;      // 140ms

        // State
        public int Score { get; private set; }
        public int Combo { get; private set; }
        public int MaxCombo { get; private set; }
        public int PerfectHits { get; private set; }
        public int GoodHits { get; private set; }
        public int OkHits { get; private set; }
        public int MissHits { get; private set; }
        public bool OneButtonMode => oneButtonMode;

        public event Action<HitRating, Lane> OnHitEvaluated;
        public event Action<int, int> OnScoreComboChanged; // score, combo

        private List<BeatNote> currentChart = new List<BeatNote>();
        private List<EnemyController> activeEnemies = new List<EnemyController>();
        private int nextSpawnIndex = 0;
        private bool isGameRunning = false;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            if (audioSync == null) audioSync = FindFirstObjectByType<AudioSyncEngine>();
            if (player == null) player = FindFirstObjectByType<PlayerCombatController>();
        }

        private void Start()
        {
            // If audio clips are found in Resources or assigned, start with first track
            if (availableTracks.Count > 0 && availableTracks[0].clip != null)
            {
                StartTrack(availableTracks[0]);
            }
        }

        public void ToggleOneButtonMode()
        {
            oneButtonMode = !oneButtonMode;
        }

        public void StartTrack(TrackMetadata track)
        {
            Score = 0;
            Combo = 0;
            MaxCombo = 0;
            PerfectHits = 0;
            GoodHits = 0;
            OkHits = 0;
            MissHits = 0;
            nextSpawnIndex = 0;

            // Clear old enemies
            foreach (var enemy in activeEnemies)
            {
                if (enemy != null) Destroy(enemy.gameObject);
            }
            activeEnemies.Clear();

            // Generate procedural beat chart
            float duration = (track.clip != null) ? track.clip.length : 180f;
            currentChart = BeatChartGenerator.GenerateChart(duration, track.bpm);

            if (audioSync != null && track.clip != null)
            {
                audioSync.PlayTrack(track.clip, 0.5);
            }

            isGameRunning = true;
        }

        private void Update()
        {
            if (!isGameRunning || audioSync == null) return;

            float songTime = audioSync.GetSongTime();

            // 1. Spawn incoming enemies
            while (nextSpawnIndex < currentChart.Count &&
                   currentChart[nextSpawnIndex].time - songTime <= approachDuration)
            {
                SpawnEnemy(currentChart[nextSpawnIndex]);
                nextSpawnIndex++;
            }

            // 2. Update active enemies position & check for misses
            for (int i = activeEnemies.Count - 1; i >= 0; i--)
            {
                var enemy = activeEnemies[i];
                if (enemy == null || enemy.IsDefeated)
                {
                    activeEnemies.RemoveAt(i);
                    continue;
                }

                enemy.UpdatePosition(songTime);

                // Check if past OK window -> Miss
                if (songTime - enemy.TargetTime > okWindow)
                {
                    enemy.OnMissed();
                    activeEnemies.RemoveAt(i);
                    RegisterMiss(enemy.Lane);
                }
            }

            // 3. Process Player Input
            HandlePlayerInput(songTime);
        }

        private void SpawnEnemy(BeatNote note)
        {
            GameObject enemyObj = new GameObject("Enemy_" + note.band + "_" + note.tier);
            EnemyController enemy = enemyObj.AddComponent<EnemyController>();
            enemy.Initialize(note, approachDuration);
            activeEnemies.Add(enemy);
        }

        private void HandlePlayerInput(float songTime)
        {
            if (oneButtonMode)
            {
                // In One-Button mode: SPACE, Enter, or any click triggers auto-target
                if (Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return) || Input.GetMouseButtonDown(0))
                {
                    StrikeOneButton(songTime);
                }
            }
            else
            {
                // In 2-Button mode: Left Arrow / A strikes Left, Right Arrow / D strikes Right
                if (Input.GetKeyDown(KeyCode.LeftArrow) || Input.GetKeyDown(KeyCode.A))
                {
                    StrikeLane(Lane.Left, songTime);
                }
                else if (Input.GetKeyDown(KeyCode.RightArrow) || Input.GetKeyDown(KeyCode.D))
                {
                    StrikeLane(Lane.Right, songTime);
                }
            }
        }

        private void StrikeOneButton(float songTime)
        {
            // Auto-detect and strike the nearest incoming beat enemy across both lanes
            EnemyController closestEnemy = null;
            float smallestDelta = float.MaxValue;

            foreach (var enemy in activeEnemies)
            {
                if (enemy.IsDefeated) continue;
                float delta = Mathf.Abs(enemy.TargetTime - songTime);
                if (delta < smallestDelta)
                {
                    smallestDelta = delta;
                    closestEnemy = enemy;
                }
            }

            if (closestEnemy != null)
            {
                EvaluateHit(closestEnemy, smallestDelta);
            }
            else
            {
                // Empty whiff
                RegisterMiss(Lane.Left);
            }
        }

        private void StrikeLane(Lane lane, float songTime)
        {
            // Find closest enemy in this specific lane
            EnemyController closestEnemy = null;
            float smallestDelta = float.MaxValue;

            foreach (var enemy in activeEnemies)
            {
                if (enemy.IsDefeated || enemy.Lane != lane) continue;
                float delta = Mathf.Abs(enemy.TargetTime - songTime);
                if (delta < smallestDelta)
                {
                    smallestDelta = delta;
                    closestEnemy = enemy;
                }
            }

            if (closestEnemy != null)
            {
                EvaluateHit(closestEnemy, smallestDelta);
            }
            else
            {
                // Empty whiff
                RegisterMiss(lane);
            }
        }

        private void EvaluateHit(EnemyController enemy, float delta)
        {
            HitRating rating = HitRating.Miss;

            if (delta <= perfectWindow)
            {
                rating = HitRating.Perfect;
                Score += 300 * (1 + Combo / 10);
                Combo++;
                PerfectHits++;
            }
            else if (delta <= goodWindow)
            {
                rating = HitRating.Good;
                Score += 150 * (1 + Combo / 10);
                Combo++;
                GoodHits++;
            }
            else if (delta <= okWindow)
            {
                rating = HitRating.Ok;
                Score += 50 * (1 + Combo / 10);
                Combo++;
                OkHits++;
            }
            else
            {
                rating = HitRating.Miss;
                Combo = 0;
                MissHits++;
            }

            if (Combo > MaxCombo) MaxCombo = Combo;

            if (rating != HitRating.Miss)
            {
                // Dynamic song audio surge on hit (+25% volume punch)
                if (audioSync != null) audioSync.TriggerHitSurge();

                // Player strike animation & combo VFX
                if (player != null) player.Strike(enemy.Lane, Combo);

                enemy.OnHitDefeated(rating);
            }
            else
            {
                enemy.OnMissed();
            }

            activeEnemies.Remove(enemy);
            OnHitEvaluated?.Invoke(rating, enemy.Lane);
            OnScoreComboChanged?.Invoke(Score, Combo);
        }

        private void RegisterMiss(Lane lane)
        {
            Combo = 0;
            MissHits++;
            OnHitEvaluated?.Invoke(HitRating.Miss, lane);
            OnScoreComboChanged?.Invoke(Score, Combo);
        }

        public float GetAccuracy()
        {
            int total = PerfectHits + GoodHits + OkHits + MissHits;
            if (total == 0) return 100f;
            return ((PerfectHits * 100f + GoodHits * 70f + OkHits * 40f) / (total * 100f)) * 100f;
        }

        public string GetGrade()
        {
            float acc = GetAccuracy();
            if (acc >= 98f && MissHits == 0) return "S";
            if (acc >= 92f) return "A";
            if (acc >= 80f) return "B";
            if (acc >= 65f) return "C";
            return "D";
        }
    }
}
